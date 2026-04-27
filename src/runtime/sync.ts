import { createRenderBridgeJob } from '../bridge/renderBridge';
import type { CompiledPromptPayload } from '../models/directoros';
import { runtimeApi } from './api';
import type { RuntimeOutputAsset, RuntimeRenderSubmissionResponse } from './types';
import { addRenderJob, listRenderJobs, persistJobs, setRenderJobState, type RenderJobState, type RenderQueueJob } from '../render/jobQueue';
import { emitRenderJobEvent } from '../render/jobEvents';
import { forcePersistRenderCache, saveRenderResult, upsertRenderManifest } from '../data/renderCache';
import type { RenderManagerCallbacks, RenderPreviewState } from '../render/renderManager';

const mapRuntimeStatusToJobState = (status: RuntimeRenderSubmissionResponse['status'] | string): RenderJobState => {
  if (status === 'queued' || status === 'preflight' || status === 'running' || status === 'packaging' || status === 'completed' || status === 'failed' || status === 'cancelled') return status;
  return 'failed';
};

// --- containment test pass begin ---
const MAX_SYNC_JOBS = 5;
// --- containment test pass end ---

const mapOutputAssets = (assets?: RuntimeOutputAsset[]) =>
  (assets || []).map((asset) => ({ path: asset.path, mediaType: asset.kind === 'video' ? ('video' as const) : ('image' as const) }));

const pickPreviewType = (value?: string) => {
  if (!value) return undefined;
  return /\.(mp4|mov|webm|mkv)(\?.*)?$/i.test(value) ? ('video' as const) : ('image' as const);
};

const resolveLocalRuntimeJob = (runtimeJob: any, locals: RenderQueueJob[]) => {
  const runtimeJobId = runtimeJob?.job_id as string | undefined;
  const manifestPath = runtimeJob?.manifest_path as string | undefined;

  if (!runtimeJobId) return undefined;

  return (
    // 1. Primary: Exact bridge ID match (authoritative link)
    locals.find((job) => job.runtimeBridgeJobId === runtimeJobId) ||
    // 2. Secondary: Remote job_label matching local ID (common for submissions)
    locals.find((job) => job.id === runtimeJobId) ||
    // 3. Tertiary: Manifest path match
    locals.find((job) => job.manifestPath && manifestPath && job.manifestPath === manifestPath) ||
    // 4. Fallback: Retries and lineage
    locals.find(
      (job) =>
        job.bridgeJob.id === runtimeJobId ||
        job.bridgeJob.payload.lineageParentJobId === runtimeJobId ||
        job.retryOf === runtimeJobId
    )
  );
};

const TERMINAL_JOB_STATES = new Set<RenderJobState>(['completed', 'failed', 'cancelled']);

/*
 * DirectorOS terminal-state grammar lock
 * Keep terminal copy and action labels canonical unless Mike explicitly changes the product language.
 * This is a reference only and must not affect runtime behavior.
 *
 * Completed → "Output is ready."
 * Failed → "Execution failed."
 * Cancelled → "Cancelled by operator."
 *
 * Canonical actions:
 * - Review Output
 * - Retry Latest Attempt
 * - Open Output Folder
 * - Open Manifest
 */

const HYDRATION_STATE_ORDER: Record<RenderJobState, number> = {
  queued: 0,
  preflight: 1,
  running: 2,
  packaging: 3,
  completed: 4,
  failed: 4,
  cancelled: 4,
};

const mergeRuntimeJob = (local: RenderQueueJob, runtimeJob: any, detail?: any, skipPersist = false) => {
  const resolved = detail ?? runtimeJob;
  const resolvedState = mapRuntimeStatusToJobState(resolved?.status ?? runtimeJob.status);
  const outputs = resolved?.outputs ?? runtimeJob.outputs ?? [];
  const preview = resolved?.preview_image_url ?? resolved?.preview_image ?? runtimeJob.preview_image_url ?? runtimeJob.preview_image;
  const localIsTerminal = TERMINAL_JOB_STATES.has(local.state);
  const runtimeIsTerminal = TERMINAL_JOB_STATES.has(resolvedState);
  const shouldForceHydrateState =
    resolvedState !== local.state &&
    HYDRATION_STATE_ORDER[resolvedState] > HYDRATION_STATE_ORDER[local.state] &&
    !(localIsTerminal && !runtimeIsTerminal);

  return setRenderJobState(local.id, resolvedState, {
    runtimeBridgeJobId: runtimeJob.job_id ?? resolved?.job_id ?? local.runtimeBridgeJobId,
    manifestPath: resolved?.manifest_path ?? runtimeJob.manifest_path ?? local.manifestPath,
    resultPaths: outputs.map((asset: RuntimeOutputAsset) => asset.path),
    outputAssets: mapOutputAssets(outputs),
    previewImage: preview,
    previewMedia: preview,
    previewType: pickPreviewType(preview),
    error: resolved?.errors?.[0] ?? runtimeJob.errors?.[0],
    runtimeWarnings: resolved?.warnings ?? runtimeJob.warnings,
    runtimeErrors: resolved?.errors ?? runtimeJob.errors,
    preflightStatus: resolved?.preflight,
    dependencyStatus: resolved?.dependency_status,
    metadata: {
      ...(resolved?.metadata ?? runtimeJob.metadata ?? local.metadata),
      payload: undefined, // STRIP: Dead weight
    },
    forceHydrateState: shouldForceHydrateState,
    skipPersist,
  }) ?? local;
};

const derivePreviewState = (job: RenderQueueJob): RenderPreviewState => ({
  mode:
    job.state === 'queued'
      ? 'queued'
      : job.state === 'preflight'
        ? 'preflight'
        : job.state === 'running'
          ? 'rendering'
          : job.state === 'packaging'
            ? 'packaging'
            : job.state === 'completed'
              ? 'completed'
              : job.state === 'failed'
                ? 'failed'
                : job.state === 'cancelled'
                  ? 'cancelled'
                  : 'idle',
  progress: job.progress,
  label: job.error || `${job.engine.toUpperCase()} ${job.state}`,
  canonicalState: job.state,
  resultPaths: job.resultPaths,
  previewImage: job.previewImage,
  previewMedia: job.previewMedia,
  previewType: job.previewType,
  previewFormat: job.bridgeJob.previewFormat,
});

const upsertManifestSnapshot = (job: RenderQueueJob, skipPersist = false) => {
  upsertRenderManifest({
    jobId: job.id,
    sceneId: job.sceneId,
    shotId: job.shotId,
    takeId: job.takeId,
    version: job.version,
    lineageParentJobId: job.lineageParentJobId ?? job.retryOf,
    engine: job.engine,
    externalJobId: job.externalJobId,
    runtimeBridgeJobId: job.runtimeBridgeJobId,
    state: job.state,
    progress: job.progress,
    route: job.bridgeJob.payload.routeContext.activeRoute,
    strategy: job.bridgeJob.payload.routeContext.strategy,
    manifestPath: job.manifestPath ?? `STUDIO_PIPELINE/outputs/${job.id}/render_metadata.json`,
    updatedAt: job.updatedAt,
    resultPaths: job.resultPaths,
    outputAssets: job.outputAssets,
    previewImage: job.previewImage,
    previewMedia: job.previewMedia,
    previewType: job.previewType,
    error: job.error,
  }, skipPersist);
};

export const submitRuntimeRender = async (
  compiledPayload: CompiledPromptPayload,
  callbacks: RenderManagerCallbacks = {},
): Promise<{ jobId: string; compiledPayload: CompiledPromptPayload } | null> => {
  const bridgeJob = createRenderBridgeJob(compiledPayload);
  let localJob = addRenderJob(bridgeJob);
  callbacks.onQueueUpdate?.(localJob);
  callbacks.onPreviewUpdate?.({ mode: 'queued', progress: 0, label: `${bridgeJob.engine.toUpperCase()} queued`, previewFormat: bridgeJob.previewFormat });
  emitRenderJobEvent({ type: 'job.requeued', job: localJob });

  const payload = {
    scene_id: compiledPayload.sceneId,
    shot_id: compiledPayload.payload.shotContext?.shotId ?? compiledPayload.payload.timeline?.shotId,
    job_label: bridgeJob.id,
    mode: bridgeJob.jobType,
    engine_target: bridgeJob.engine,
    intent: compiledPayload.compiledPrompt,
    compiled_prompt: compiledPayload.compiledPrompt,
    parameters: compiledPayload.payload.parameters,
    timeline: compiledPayload.payload.timeline,
    route_context: compiledPayload.payload.routeContext,
    shot_context: compiledPayload.payload.shotContext,
    lineage_parent_job_id: bridgeJob.payload.lineageParentJobId,
    seed: bridgeJob.seed,
    mock: true,
  };

  try {
    const submission = (await runtimeApi.render(payload)) as RuntimeRenderSubmissionResponse;
    const initialSubmitState = submission.status === 'failed' || !submission.ok ? 'failed' : 'queued';
    const submissionPreview = submission.preview_image_url ?? submission.preview_image;
    localJob = setRenderJobState(bridgeJob.id, initialSubmitState, {
      runtimeBridgeJobId: submission.job_id,
      manifestPath: submission.manifest_path,
      previewImage: submissionPreview,
      previewMedia: submissionPreview,
      previewType: pickPreviewType(submissionPreview),
      error: submission.errors?.[0],
      runtimeWarnings: submission.warnings,
      runtimeErrors: submission.errors,
      preflightStatus: submission.preflight,
      dependencyStatus: submission.dependency_status,
      metadata: submission.metadata ?? localJob.metadata,
    }) ?? localJob;

    const detailEnvelope = (await runtimeApi.jobDetail(submission.job_id).catch(() => null)) as { job?: any } | null;
    const runtimeJob = detailEnvelope?.job;
    if (runtimeJob) {
      localJob = mergeRuntimeJob(localJob, { ...runtimeJob, job_id: runtimeJob.job_id ?? submission.job_id, manifest_path: runtimeJob.manifest_path ?? submission.manifest_path }, runtimeJob);

      if (runtimeJob.outputs?.length) {
        saveRenderResult({
          jobId: localJob.id,
          sceneId: localJob.sceneId,
          shotId: localJob.shotId,
          takeId: localJob.takeId,
          version: localJob.version,
          lineageParentJobId: localJob.lineageParentJobId,
          engine: localJob.engine,
          prompt: localJob.bridgeJob.payload.prompt,
          seed: localJob.bridgeJob.seed,
          outputs: runtimeJob.outputs.map((asset: RuntimeOutputAsset) => asset.path),
          resultPaths: runtimeJob.outputs.map((asset: RuntimeOutputAsset) => asset.path),
          outputAssets: mapOutputAssets(runtimeJob.outputs),
          previewImage: runtimeJob.preview_image_url ?? runtimeJob.preview_image,
          previewMedia: runtimeJob.preview_image_url ?? runtimeJob.preview_image,
          previewType: runtimeJob.preview_image ? 'image' : undefined,
          timestamp: Date.now(),
        });
      }
    }

    upsertManifestSnapshot(localJob);
    callbacks.onQueueUpdate?.(localJob);
    callbacks.onPreviewUpdate?.(derivePreviewState(localJob));
    return { jobId: localJob.id, compiledPayload };
  } catch (error) {
    localJob = setRenderJobState(bridgeJob.id, 'failed', {
      error: error instanceof Error ? error.message : 'runtime bridge submission failed',
      runtimeErrors: [error instanceof Error ? error.message : 'runtime bridge submission failed'],
    }) ?? localJob;
    upsertManifestSnapshot(localJob);
    callbacks.onQueueUpdate?.(localJob);
    callbacks.onPreviewUpdate?.(derivePreviewState(localJob));
    return null;
  }
};

export const retryRuntimeRender = async (
  sourceJob: Pick<RenderQueueJob, 'id' | 'retryDepth' | 'bridgeJob' | 'state'>,
  callbacks: RenderManagerCallbacks = {},
): Promise<{ jobId: string } | null> => {
  if (sourceJob.state !== 'failed') return null;

  const sourceBridgeJob = sourceJob.bridgeJob;
  const payload = {
    scene_id: sourceBridgeJob.sceneId,
    shot_id: sourceBridgeJob.payload.shotContext?.shotId ?? sourceBridgeJob.payload.timeline?.shotId,
    job_label: `rb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    mode: sourceBridgeJob.jobType,
    engine_target: sourceBridgeJob.engine,
    intent: sourceBridgeJob.payload.prompt,
    compiled_prompt: sourceBridgeJob.payload.prompt,
    parameters: sourceBridgeJob.payload.parameters,
    timeline: sourceBridgeJob.payload.timeline,
    route_context: sourceBridgeJob.payload.routeContext,
    shot_context: sourceBridgeJob.payload.shotContext,
    lineage_parent_job_id: sourceJob.id,
    seed: sourceBridgeJob.seed,
    mock: true,
  };

  const bridgeJob = {
    ...sourceBridgeJob,
    id: payload.job_label,
    createdAt: Date.now(),
    payload: {
      ...sourceBridgeJob.payload,
      lineageParentJobId: sourceJob.id,
    },
  };

  let localJob = addRenderJob(bridgeJob, {
    retryOf: sourceJob.id,
    retryDepth: (sourceJob.retryDepth ?? 0) + 1,
    retrySource: 'runtime_retry',
  });
  callbacks.onQueueUpdate?.(localJob);
  callbacks.onPreviewUpdate?.(derivePreviewState(localJob));
  emitRenderJobEvent({ type: 'job.retry.created', job: localJob });

  try {
    const submission = (await runtimeApi.render(payload)) as RuntimeRenderSubmissionResponse;
    const initialSubmitState = submission.status === 'failed' || !submission.ok ? 'failed' : 'queued';
    const submissionPreview = submission.preview_image_url ?? submission.preview_image;
    localJob = setRenderJobState(localJob.id, initialSubmitState, {
      runtimeBridgeJobId: submission.job_id,
      manifestPath: submission.manifest_path,
      previewImage: submissionPreview,
      previewMedia: submissionPreview,
      previewType: pickPreviewType(submissionPreview),
      error: submission.errors?.[0],
      runtimeWarnings: submission.warnings,
      runtimeErrors: submission.errors,
      preflightStatus: submission.preflight,
      dependencyStatus: submission.dependency_status,
      metadata: submission.metadata ?? localJob.metadata,
    }) ?? localJob;
    upsertManifestSnapshot(localJob);
    callbacks.onQueueUpdate?.(localJob);
    callbacks.onPreviewUpdate?.(derivePreviewState(localJob));
    return { jobId: localJob.id };
  } catch (error) {
    localJob = setRenderJobState(localJob.id, 'failed', {
      error: error instanceof Error ? error.message : 'runtime retry failed',
      runtimeErrors: [error instanceof Error ? error.message : 'runtime retry failed'],
    }) ?? localJob;
    upsertManifestSnapshot(localJob);
    callbacks.onQueueUpdate?.(localJob);
    callbacks.onPreviewUpdate?.(derivePreviewState(localJob));
    return null;
  }
};

export const cancelRuntimeJob = async (job: RenderQueueJob): Promise<{ supported: boolean; requested: boolean; final: boolean; message: string }> => {
  try {
    const response = (await runtimeApi.cancelJob(job.id)) as { cancellation?: { supported: boolean; requested: boolean; final: boolean; message: string } };
    const message = response.cancellation?.message || 'Cancellation request sent.';
    const patched = setRenderJobState(job.id, job.state, {
      error: message,
      runtimeWarnings: [message],
    });
    if (patched) upsertManifestSnapshot(patched);
    return response.cancellation || { supported: false, requested: true, final: false, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cancellation request failed';
    const patched = setRenderJobState(job.id, job.state, {
      error: message,
      runtimeWarnings: [message],
    });
    if (patched) upsertManifestSnapshot(patched);
    return { supported: false, requested: false, final: false, message };
  }
};

export const syncRuntimeJobsToLocal = async (): Promise<RenderQueueJob[]> => {
  const jobsEnvelope = (await runtimeApi.jobs(MAX_SYNC_JOBS).catch((err) => {
    if (err?.isConnectionError) return { _isOffline: true };
    return null;
  })) as { jobs?: any[]; _isOffline?: boolean } | null;

  if (!jobsEnvelope || jobsEnvelope._isOffline || !jobsEnvelope.jobs) {
    return listRenderJobs();
  }

  const locals = listRenderJobs();

  for (const runtimeJob of jobsEnvelope.jobs as any[]) {
    const local = resolveLocalRuntimeJob(runtimeJob, locals);
    if (!local) continue;

    // GUARD: Only fetch details if the status has actually changed
    // or if the job isn't in a terminal state yet.
    const needsDetail = local.state !== runtimeJob.status && !TERMINAL_JOB_STATES.has(local.state);

    let detail = null;
    if (needsDetail) {
      const detailEnvelope = (await runtimeApi.jobDetail(runtimeJob.job_id).catch(() => null)) as { job?: any } | null;
      detail = detailEnvelope?.job;
    }

    const patched = mergeRuntimeJob(local, runtimeJob, detail, true);
    if (patched) {
      const resolvedDetail = detail ?? runtimeJob;
      if (resolvedDetail?.outputs?.length) {
        saveRenderResult({
          jobId: patched.id,
          sceneId: patched.sceneId,
          shotId: patched.shotId,
          takeId: patched.takeId,
          version: patched.version,
          lineageParentJobId: patched.lineageParentJobId,
          engine: patched.engine,
          prompt: patched.bridgeJob.payload.prompt,
          seed: patched.bridgeJob.seed,
          outputs: resolvedDetail.outputs.map((asset: RuntimeOutputAsset) => asset.path),
          resultPaths: resolvedDetail.outputs.map((asset: RuntimeOutputAsset) => asset.path),
          outputAssets: mapOutputAssets(resolvedDetail.outputs),
          previewImage: resolvedDetail.preview_image_url ?? resolvedDetail.preview_image,
          previewMedia: resolvedDetail.preview_image_url ?? resolvedDetail.preview_image,
          previewType: resolvedDetail.preview_image ? 'image' : undefined,
          timestamp: Date.now(),
        }, true);
      }
      upsertManifestSnapshot(patched, true);
    }
  }

  persistJobs();
  forcePersistRenderCache();
  return listRenderJobs();
};

export const syncTimelineState = async (limit = 100): Promise<{ events: any[], bounds: { startMs: number, endMs: number } }> => {
  const timelineEnvelope = (await runtimeApi.timeline(limit).catch(() => null)) as { events?: any[] } | null;
  const events = timelineEnvelope?.events ?? [];
  
  if (events.length === 0) {
    const now = Date.now();
    return { events: [], bounds: { startMs: now, endMs: now } };
  }

  let minStart = Infinity;
  let maxEnd = -Infinity;

  events.forEach((event: any) => {
    const start = event.created_at ? new Date(event.created_at).getTime() : 0;
    const end = event.completed_at ? new Date(event.completed_at).getTime() : start + (event.duration_ms || 0);
    
    if (start > 0 && start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
  });

  // Fallback for invalid dates
  if (minStart === Infinity) minStart = Date.now();
  if (maxEnd === -Infinity) maxEnd = minStart + 1000;

  return {
    events,
    bounds: {
      startMs: minStart,
      endMs: maxEnd
    }
  };
};
