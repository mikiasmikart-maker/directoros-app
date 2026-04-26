import type { RenderBridgeJob } from '../bridge/renderBridge';
import { saveRenderResult, upsertRenderManifest } from '../data/renderCache';
import { mapProviderStatusToRenderState, type EngineAdapter, type EngineAdapterError } from '../engines/adapter';
import { getStatus as comfyStatus, fetchResult as comfyResult, submitJob as comfySubmit, cancelJob as comfyCancel } from '../engines/comfyConnector';
import { getStatus as fluxStatus, fetchResult as fluxResult, submitJob as fluxSubmit, cancelJob as fluxCancel } from '../engines/fluxConnector';
import { getStatus as runwayStatus, fetchResult as runwayResult, submitJob as runwaySubmit, cancelJob as runwayCancel } from '../engines/runwayConnector';
import { getStatus as veoStatus, fetchResult as veoResult, submitJob as veoSubmit, cancelJob as veoCancel } from '../engines/veoConnector';
import { emitRenderJobEvent } from './jobEvents';
import { addRenderJob, getRenderJob, listQueueEligibleJobs, listRenderJobs, setRenderJobState, type RenderQueueJob, updateRenderProgress, completeRenderJob, failRenderJob } from './jobQueue';
import { addActiveJobId, dequeueJobId, enqueueJobId, getQueueState, removeActiveJobId, resetQueueExecutionPointers, setQueueMode } from './queueState';
import type { RenderManagerCallbacks } from './renderManager';
import { emitEvent, makeStream, newTrace } from '../telemetry';
import type { DirectorOSEventEnvelope, EmitContext } from '../telemetry';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_STATUS_TRANSIENT_ERRORS = 4;
const RESULT_FETCH_RETRIES = 3;
const RESULT_FETCH_BACKOFF_MS = 650;

const normalizeResultPaths = (paths: string[]): string[] => {
  const normalized = paths
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => {
      if (path.startsWith('/view?')) return `/comfyui${path}`;
      return path;
    });

  return Array.from(new Set(normalized));
};

const previewContactsheetPattern = /contact[\s_-]*sheet/i;
const videoPreviewPattern = /\.(mp4|mov|webm|mkv)$/i;

export type OutputMediaType = 'image' | 'video';
export interface NormalizedOutputAsset {
  path: string;
  mediaType: OutputMediaType;
}

const classifyOutputMediaType = (path: string): OutputMediaType => (videoPreviewPattern.test(path) ? 'video' : 'image');

const normalizeOutputAssets = (paths: string[]): NormalizedOutputAsset[] =>
  normalizeResultPaths(paths).map((path) => ({ path, mediaType: classifyOutputMediaType(path) }));

const resolveCanonicalPreviewMedia = (resultPaths: string[]): { previewImage?: string; previewMedia?: string; previewType?: OutputMediaType; outputAssets: NormalizedOutputAsset[] } => {
  const outputAssets = normalizeOutputAssets(resultPaths);
  if (!outputAssets.length) return { outputAssets };

  const imageAssets = outputAssets.filter((asset) => asset.mediaType === 'image');
  const contactsheet = imageAssets.find((asset) => previewContactsheetPattern.test(asset.path));

  if (contactsheet) {
    return { previewImage: contactsheet.path, previewMedia: contactsheet.path, previewType: 'image', outputAssets };
  }

  if (imageAssets.length) {
    const firstSortedImage = [...imageAssets].sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))[0];
    return { previewImage: firstSortedImage.path, previewMedia: firstSortedImage.path, previewType: 'image', outputAssets };
  }

  const firstSortedVideo = [...outputAssets].sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))[0];
  return { previewMedia: firstSortedVideo.path, previewType: 'video', outputAssets };
};

const connectors: Record<RenderBridgeJob['engine'], EngineAdapter> = {
  flux: {
    submitJob: fluxSubmit,
    getStatus: async (externalJobId) => {
      const status = await fluxStatus(externalJobId);
      return {
        providerStatus:
          status.status === 'queued' ? 'queued' : status.status === 'rendering' ? 'running' : status.status === 'completed' ? 'succeeded' : 'failed',
        progress: status.progress,
      };
    },
    fetchResult: fluxResult,
    cancelJob: fluxCancel,
  },
  veo: {
    submitJob: veoSubmit,
    getStatus: async (externalJobId) => {
      const status = await veoStatus(externalJobId);
      return {
        providerStatus:
          status.status === 'queued' ? 'queued' : status.status === 'rendering' ? 'running' : status.status === 'completed' ? 'succeeded' : 'failed',
        progress: status.progress,
      };
    },
    fetchResult: veoResult,
    cancelJob: veoCancel,
  },
  runway: {
    submitJob: runwaySubmit,
    getStatus: async (externalJobId) => {
      const status = await runwayStatus(externalJobId);
      return {
        providerStatus:
          status.status === 'queued' ? 'queued' : status.status === 'rendering' ? 'running' : status.status === 'completed' ? 'succeeded' : 'failed',
        progress: status.progress,
      };
    },
    fetchResult: runwayResult,
    cancelJob: runwayCancel,
  },
  comfyui: { submitJob: comfySubmit, getStatus: comfyStatus, fetchResult: comfyResult, cancelJob: comfyCancel },
};

interface QueueTask {
  bridgeJob: RenderBridgeJob;
  promptText: string;
  callbacks: RenderManagerCallbacks;
}

interface CancelRequest {
  remoteStopAttempted: boolean;
  remoteStopConfirmed: boolean;
  degraded: boolean;
  note?: string;
}

export interface RetryQueueResult {
  jobId?: string;
  blocked?: 'source_not_failed' | 'missing_source_metadata' | 'duplicate_shot_guard' | 'max_queue_length';
}

const pendingTasks = new Map<string, QueueTask>();
const cancelRequests = new Map<string, CancelRequest>();

const writeManifest = (job: RenderQueueJob) => {
  const manifestPath = job.manifestPath ?? `STUDIO_PIPELINE/outputs/${job.id}/render_metadata.json`;
  upsertRenderManifest({
    jobId: job.id,
    sceneId: job.sceneId,
    shotId: job.shotId,
    takeId: job.takeId,
    version: job.version,
    lineageParentJobId: job.lineageParentJobId ?? job.retryOf,
    engine: job.engine,
    externalJobId: job.externalJobId,
    state: job.state,
    progress: job.progress,
    route: job.bridgeJob.payload.routeContext.activeRoute,
    strategy: job.bridgeJob.payload.routeContext.strategy,
    manifestPath,
    updatedAt: Date.now(),
    resultPaths: job.resultPaths,
    outputAssets: job.outputAssets,
    previewImage: job.previewImage,
    previewMedia: job.previewMedia,
    previewType: job.previewType,
    error: job.error,
  });
};

const isDuplicateShotEnqueue = (bridgeJob: RenderBridgeJob) => {
  const shotId = bridgeJob.payload.shotContext?.shotId ?? bridgeJob.payload.timeline?.shotId;
  if (!shotId) return false;
  return listQueueEligibleJobs().some((job) => job.sceneId === bridgeJob.sceneId && job.shotId === shotId);
};

const fetchResultWithRetries = async (connector: EngineAdapter, externalJobId: string) => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RESULT_FETCH_RETRIES; attempt += 1) {
    try {
      return await connector.fetchResult(externalJobId);
    } catch (error) {
      const adapterError = error as EngineAdapterError;
      lastError = error;
      const canRetry =
        attempt < RESULT_FETCH_RETRIES &&
        (adapterError?.retryable === true || adapterError?.kind === 'missing_artifact' || adapterError?.kind === 'timeout');
      if (!canRetry) throw error;
      await sleep(RESULT_FETCH_BACKOFF_MS * (attempt + 1));
    }
  }
  throw lastError;
};

const processTask = async (task: QueueTask) => {
  const bridgeJob = task.bridgeJob;
  const connector = connectors[bridgeJob.engine];
  let queueJob = getRenderJob(bridgeJob.id);
  if (!queueJob) return;

  queueJob = setRenderJobState(bridgeJob.id, 'preflight') ?? queueJob;
  task.callbacks.onQueueUpdate?.(queueJob);

  if (cancelRequests.has(bridgeJob.id)) {
    const cancelMeta = cancelRequests.get(bridgeJob.id);
    queueJob = setRenderJobState(bridgeJob.id, 'cancelled', { error: cancelMeta?.note ?? 'Cancelled by operator before engine submit' }) ?? queueJob;
    writeManifest(queueJob);
    task.callbacks.onQueueUpdate?.(queueJob);
    task.callbacks.onPreviewUpdate?.({ mode: 'cancelled', progress: queueJob.progress, label: queueJob.error });
    return;
  }

  try {
    const { externalJobId } = await connector.submitJob(bridgeJob);
    queueJob = setRenderJobState(bridgeJob.id, 'running', { externalJobId }) ?? queueJob;
    writeManifest(queueJob);
    task.callbacks.onQueueUpdate?.(queueJob);

    let done = false;
    let transientStatusErrors = 0;
    while (!done) {
      if (cancelRequests.has(bridgeJob.id)) {
        const cancelMeta = cancelRequests.get(bridgeJob.id);
        const cancellationNote = cancelMeta?.degraded
          ? cancelMeta.note ?? 'Cancellation requested, but connector cannot confirm remote stop.'
          : cancelMeta?.remoteStopAttempted
            ? cancelMeta.remoteStopConfirmed
              ? 'Cancelled by operator (connector confirmed remote stop)'
              : cancelMeta.note ?? 'Cancelled locally after connector cancel attempt; remote stop unconfirmed.'
            : 'Cancelled by operator';

        queueJob = setRenderJobState(bridgeJob.id, 'cancelled', { error: cancellationNote }) ?? queueJob;
        writeManifest(queueJob);
        task.callbacks.onQueueUpdate?.(queueJob);
        task.callbacks.onPreviewUpdate?.({ mode: 'cancelled', progress: queueJob.progress, label: queueJob.error });
        done = true;
        break;
      }

      await sleep(500);

      let status: Awaited<ReturnType<EngineAdapter['getStatus']>>;
      try {
        status = await connector.getStatus(externalJobId);
        transientStatusErrors = 0;
      } catch (error) {
        const adapterError = error as EngineAdapterError;
        const retryable = Boolean(adapterError?.retryable) || adapterError?.kind === 'timeout' || adapterError?.kind === 'retryable_transport';

        if (retryable && transientStatusErrors < MAX_STATUS_TRANSIENT_ERRORS) {
          transientStatusErrors += 1;
          task.callbacks.onPreviewUpdate?.({
            mode: 'rendering',
            progress: queueJob.progress,
            label: `${bridgeJob.engine.toUpperCase()} transient status retry ${transientStatusErrors}/${MAX_STATUS_TRANSIENT_ERRORS}`,
            previewFormat: bridgeJob.previewFormat,
          });
          continue;
        }

        throw error;
      }

      queueJob = updateRenderProgress(bridgeJob.id, status.progress) ?? queueJob;

      if (status.providerStatus === 'failed') {
        queueJob = failRenderJob(bridgeJob.id, `${bridgeJob.engine.toUpperCase()} provider reported failed status`, {
          failedStage: 'running',
          dependencyIssue: `${bridgeJob.engine} adapter returned providerStatus=failed`,
          manifestPath: `STUDIO_PIPELINE/outputs/${bridgeJob.id}/render_metadata.json`,
        }) ?? queueJob;
        writeManifest(queueJob);
        task.callbacks.onQueueUpdate?.(queueJob);
        task.callbacks.onPreviewUpdate?.({ mode: 'failed', progress: queueJob.progress, label: queueJob.error });
        done = true;
        break;
      }

      const mappedState = mapProviderStatusToRenderState(status.providerStatus);
      if (mappedState === 'cancelled') {
        queueJob = setRenderJobState(bridgeJob.id, 'cancelled', { error: `${bridgeJob.engine.toUpperCase()} provider cancelled job` }) ?? queueJob;
        writeManifest(queueJob);
        task.callbacks.onQueueUpdate?.(queueJob);
        task.callbacks.onPreviewUpdate?.({ mode: 'cancelled', progress: queueJob.progress, label: queueJob.error });
        done = true;
        break;
      }

      task.callbacks.onQueueUpdate?.(queueJob);
      task.callbacks.onPreviewUpdate?.({
        mode: 'rendering',
        progress: queueJob.progress,
        label: `${bridgeJob.engine.toUpperCase()} rendering • ${bridgeJob.payload.routeContext.strategy}`,
        previewFormat: bridgeJob.previewFormat,
      });

      if (status.providerStatus === 'succeeded') {
        queueJob = setRenderJobState(bridgeJob.id, 'packaging') ?? queueJob;
        writeManifest(queueJob);
        task.callbacks.onQueueUpdate?.(queueJob);

        const result = await fetchResultWithRetries(connector, externalJobId);
        const normalizedResultPaths = normalizeResultPaths(result.outputs);
        const preview = resolveCanonicalPreviewMedia(normalizedResultPaths);
        queueJob = completeRenderJob(
          bridgeJob.id,
          normalizedResultPaths,
          preview.previewImage,
          preview.previewMedia,
          preview.previewType,
          preview.outputAssets
        ) ?? queueJob;
        writeManifest(queueJob);
        saveRenderResult({
          jobId: bridgeJob.id,
          sceneId: bridgeJob.sceneId,
          engine: bridgeJob.engine,
          prompt: task.promptText,
          seed: bridgeJob.seed,
          outputs: normalizedResultPaths,
          resultPaths: normalizedResultPaths,
          outputAssets: preview.outputAssets,
          previewImage: preview.previewImage,
          previewMedia: preview.previewMedia,
          previewType: preview.previewType,
          timestamp: Date.now(),
        });
        task.callbacks.onQueueUpdate?.(queueJob);
        task.callbacks.onPreviewUpdate?.({
          mode: 'completed',
          progress: 100,
          resultPaths: normalizedResultPaths,
          previewImage: preview.previewImage,
          previewMedia: preview.previewMedia,
          previewType: preview.previewType,
          previewFormat: bridgeJob.previewFormat,
          label: `${bridgeJob.engine.toUpperCase()} completed`,
        });
        done = true;
      }
    }
  } catch (error) {
    const adapterError = error as EngineAdapterError;
    const dependencyIssue = `${bridgeJob.engine} adapter failure (${adapterError?.kind ?? 'unknown'}${adapterError?.retryable ? ', retryable' : ''})`;
    queueJob = failRenderJob(bridgeJob.id, adapterError?.message ?? 'Adapter execution failed', {
      failedStage: queueJob.state === 'preflight' ? 'preflight' : 'running',
      dependencyIssue,
      manifestPath: `STUDIO_PIPELINE/outputs/${bridgeJob.id}/render_metadata.json`,
    }) ?? queueJob;
    writeManifest(queueJob);
    task.callbacks.onQueueUpdate?.(queueJob);
    task.callbacks.onPreviewUpdate?.({ mode: 'failed', progress: queueJob.progress, label: queueJob.error });
  }
};

const pumpQueue = async () => {
  const state = getQueueState();
  if (state.mode === 'paused') return;

  while (getQueueState().mode === 'running' && getQueueState().activeJobIds.length < getQueueState().policy.maxConcurrentJobs && getQueueState().queuedJobIds.length > 0) {
    const nextJobId = getQueueState().queuedJobIds[0];
    const task = pendingTasks.get(nextJobId);
    dequeueJobId(nextJobId);
    if (!task) continue;

    addActiveJobId(nextJobId);
    setTimeout(async () => {
      try {
        await processTask(task);
      } finally {
        removeActiveJobId(nextJobId);
        pendingTasks.delete(nextJobId);
        cancelRequests.delete(nextJobId);
        void pumpQueue();
      }
    }, 0);
  }
};

export const reconcileDurableRenderAuthority = async () => {
  resetQueueExecutionPointers();

  const telemetryEnabled = (() => {
    try {
      return window.localStorage.getItem('telemetry.instrumentation.phase1.enabled') === 'true';
    } catch {
      return false;
    }
  })();

  const cycleStartedAt = Date.now();
  const cycleId = `recon_${cycleStartedAt}_${Math.random().toString(16).slice(2, 8)}`;
  const traceSeed = telemetryEnabled ? newTrace(cycleId) : undefined;
  let driftCount = 0;
  let repairedCount = 0;

  const telemetryEventStore = {
    append: async (event: DirectorOSEventEnvelope) => {
      try {
        const key = 'directoros.telemetry.eventlog.v1';
        const raw = window.localStorage.getItem(key);
        const parsed = raw ? (JSON.parse(raw) as DirectorOSEventEnvelope[]) : [];
        const next = [...parsed, event].slice(-1000);
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // best-effort only
      }
    },
  };

  const emitReconciliationTelemetry = async (
    eventName: 'reconciliation.cycle.started' | 'reconciliation.cycle.completed',
    status: string,
    code: string,
    message: string
  ) => {
    if (!telemetryEnabled || !traceSeed) return;
    try {
      const ctx: EmitContext = {
        producer: { service: 'directoros-app', module: 'm7_truth', instance_id: 'web-main' },
        actor: { type: 'system', id: 'm7_reconciler', session_id: 'web-session', lane: 'lane_1' },
        trace: { ...traceSeed },
        subject: { type: 'reconciliation_cycle', id: cycleId, engine: 'truth-engine', target: 'render_queue.comfyui' },
        sequence: { stream: makeStream('reconciliation', cycleId), index: eventName === 'reconciliation.cycle.started' ? 1 : 2 },
      };

      await emitEvent(telemetryEventStore, ctx, {
        event_name: eventName,
        outcome: { status, code, message },
        metrics: eventName === 'reconciliation.cycle.completed' ? { latency_ms: Date.now() - cycleStartedAt, queue_ms: 0 } : { latency_ms: null, queue_ms: 0 },
        data: {
          drift_detected: driftCount > 0,
          drift_count: driftCount,
          repaired_count: repairedCount,
        },
      });
    } catch {
      // best-effort only
    }
  };

  await emitReconciliationTelemetry('reconciliation.cycle.started', 'started', 'OK', 'Reconciliation cycle started');

  const persisted = listRenderJobs().filter((job) => job.engine === 'comfyui');

  try {
    for (const job of persisted) {
      const manifestPath = job.manifestPath ?? `STUDIO_PIPELINE/outputs/${job.id}/render_metadata.json`;

      if (job.state === 'completed') {
        const normalized = normalizeResultPaths(job.resultPaths ?? []);
        if (normalized.length) {
          const patched = setRenderJobState(job.id, 'completed', { resultPaths: normalized, manifestPath }) ?? job;
          writeManifest(patched);
        } else {
          driftCount += 1;
          repairedCount += 1;
          const failed = failRenderJob(job.id, 'Recovered completed job missing artifact references', {
            failedStage: 'packaging',
            dependencyIssue: 'reconciliation:missing_artifact_after_completed',
            manifestPath,
          }) ?? job;
          writeManifest(failed);
        }
        continue;
      }

      if (job.state === 'failed' || job.state === 'cancelled') {
        writeManifest(job);
        continue;
      }

      if (!job.externalJobId) {
        driftCount += 1;
        repairedCount += 1;
        const orphan = failRenderJob(job.id, 'Recovered orphaned in-flight job without provider job id', {
          failedStage: job.state === 'queued' ? 'queued' : 'preflight',
          dependencyIssue: 'reconciliation:orphaned_no_external_job_id',
          manifestPath,
        }) ?? job;
        writeManifest(orphan);
        continue;
      }

      try {
        const status = await connectors.comfyui.getStatus(job.externalJobId);

        if (status.providerStatus === 'failed') {
          driftCount += 1;
          repairedCount += 1;
          const failed = failRenderJob(job.id, 'Recovered provider-failed job from Comfy status', {
            failedStage: 'running',
            dependencyIssue: 'reconciliation:provider_failed',
            manifestPath,
          }) ?? job;
          writeManifest(failed);
          continue;
        }

        if (status.providerStatus === 'succeeded' || job.state === 'packaging') {
          const packaging = setRenderJobState(job.id, 'packaging', { manifestPath, externalJobId: job.externalJobId }) ?? job;
          writeManifest(packaging);

          const result = await fetchResultWithRetries(connectors.comfyui, job.externalJobId);
          const normalizedResultPaths = normalizeResultPaths(result.outputs);

          if (!normalizedResultPaths.length) {
            driftCount += 1;
            repairedCount += 1;
            const missing = failRenderJob(job.id, 'Recovered job succeeded but artifacts were missing', {
              failedStage: 'packaging',
              dependencyIssue: 'reconciliation:missing_artifact_after_provider_success',
              manifestPath,
            }) ?? job;
            writeManifest(missing);
            continue;
          }

          const preview = resolveCanonicalPreviewMedia(normalizedResultPaths);
          const completed = completeRenderJob(
            job.id,
            normalizedResultPaths,
            preview.previewImage,
            preview.previewMedia,
            preview.previewType,
            preview.outputAssets
          ) ?? job;
          writeManifest(completed);
          saveRenderResult({
            jobId: job.id,
            sceneId: job.sceneId,
            shotId: job.shotId,
            takeId: job.takeId,
            version: job.version,
            lineageParentJobId: job.lineageParentJobId ?? job.retryOf,
            engine: job.engine,
            prompt: job.bridgeJob.payload.prompt,
            seed: job.bridgeJob.seed,
            outputs: normalizedResultPaths,
            resultPaths: normalizedResultPaths,
            outputAssets: preview.outputAssets,
            previewImage: preview.previewImage,
            previewMedia: preview.previewMedia,
            previewType: preview.previewType,
            timestamp: Date.now(),
          });
          continue;
        }

        driftCount += 1;
        repairedCount += 1;
        const orphanRunning = failRenderJob(job.id, 'Recovered orphaned running job after restart/reconnect', {
          failedStage: 'running',
          dependencyIssue: 'reconciliation:orphaned_running_after_restart',
          manifestPath,
        }) ?? job;
        writeManifest(orphanRunning);
      } catch (error) {
        driftCount += 1;
        repairedCount += 1;
        const adapterError = error as EngineAdapterError;
        const failed = failRenderJob(job.id, adapterError?.message ?? 'Reconciliation failed while contacting provider', {
          failedStage: 'running',
          dependencyIssue: `reconciliation:provider_transport:${adapterError?.kind ?? 'unknown'}`,
          manifestPath,
        }) ?? job;
        writeManifest(failed);
      }
    }

    await emitReconciliationTelemetry('reconciliation.cycle.completed', 'success', 'OK', 'Reconciliation cycle completed');
  } catch (error) {
    await emitReconciliationTelemetry('reconciliation.cycle.completed', 'failed', 'ERR_RECON', 'Reconciliation cycle failed');
    throw error;
  }
};

export const enqueueBridgeRenderJob = (
  bridgeJob: RenderBridgeJob,
  promptText: string,
  callbacks: RenderManagerCallbacks = {},
  lineage?: { retryOf?: string; retryDepth?: number; retrySource?: string }
): { jobId?: string; blocked?: string } => {
  const state = getQueueState();
  if (state.policy.duplicateShotGuard && isDuplicateShotEnqueue(bridgeJob)) {
    return { blocked: 'duplicate_shot_guard' };
  }
  if (state.queuedJobIds.length >= state.policy.maxQueueLength) {
    return { blocked: 'max_queue_length' };
  }

  let queueJob = addRenderJob(bridgeJob, lineage);
  queueJob = setRenderJobState(bridgeJob.id, 'queued', { manifestPath: `STUDIO_PIPELINE/outputs/${bridgeJob.id}/render_metadata.json` }) ?? queueJob;
  callbacks.onQueueUpdate?.(queueJob);
  callbacks.onPreviewUpdate?.({
    mode: 'queued',
    progress: 0,
    label: `${bridgeJob.engine.toUpperCase()} queued • route ${bridgeJob.payload.routeContext.activeRoute}`,
  });

  pendingTasks.set(bridgeJob.id, { bridgeJob, promptText, callbacks });
  enqueueJobId(bridgeJob.id);
  emitRenderJobEvent({ type: 'job.requeued', job: queueJob });
  void pumpQueue();
  return { jobId: bridgeJob.id };
};

export const pauseQueue = () => {
  setQueueMode('paused');
  emitRenderJobEvent({ type: 'queue.paused', queueState: 'paused' });
};

export const resumeQueue = () => {
  setQueueMode('running');
  emitRenderJobEvent({ type: 'queue.resumed', queueState: 'running' });
  void pumpQueue();
};

export const cancelActiveOrQueuedJob = async (jobId: string) => {
  const job = getRenderJob(jobId);
  if (!job) return;

  const state = getQueueState();
  if (state.queuedJobIds.includes(jobId)) {
    dequeueJobId(jobId);
    pendingTasks.delete(jobId);
    const cancelled = setRenderJobState(jobId, 'cancelled', { error: 'Cancelled from queue before execution' });
    if (cancelled) writeManifest(cancelled);
    return;
  }

  if (!state.activeJobIds.includes(jobId)) return;

  const connector = connectors[job.engine];
  const externalJobId = job.externalJobId;
  const cancelMeta: CancelRequest = {
    remoteStopAttempted: false,
    remoteStopConfirmed: false,
    degraded: false,
  };

  if (!externalJobId) {
    cancelMeta.degraded = true;
    cancelMeta.note = 'Cancelled during preflight before external job id was issued.';
  } else if (connector.cancelJob) {
    cancelMeta.remoteStopAttempted = true;
    try {
      const result = await connector.cancelJob(externalJobId);
      cancelMeta.remoteStopConfirmed = Boolean(result.cancelled);
      if (result.message) cancelMeta.note = result.message;
      if (!result.cancelled && !cancelMeta.note) {
        cancelMeta.note = 'Connector cancel attempted, but remote stop was not confirmed.';
      }
    } catch {
      cancelMeta.note = 'Connector cancel call failed; cancellation finalized locally.';
    }
  } else {
    cancelMeta.degraded = true;
    cancelMeta.note = 'Connector does not support cancelJob; cancellation finalized locally only.';
  }

  cancelRequests.set(jobId, cancelMeta);
};

export const clearQueuedJobs = () => {
  const queued = [...getQueueState().queuedJobIds];
  queued.forEach((jobId) => {
    void cancelActiveOrQueuedJob(jobId);
  });
};

export const retryFailedQueueJob = (
  sourceJob: Pick<RenderQueueJob, 'id' | 'retryDepth' | 'bridgeJob' | 'state'>,
  callbacks: RenderManagerCallbacks = {}
): RetryQueueResult => {
  if (sourceJob.state !== 'failed') {
    return { blocked: 'source_not_failed' };
  }

  const sourceBridgeJob = sourceJob?.bridgeJob;
  if (!sourceBridgeJob?.sceneId || !sourceBridgeJob?.payload?.prompt) {
    return { blocked: 'missing_source_metadata' };
  }

  const retryBridgeJob: RenderBridgeJob = {
    ...sourceBridgeJob,
    id: `rb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: Date.now(),
    payload: {
      ...sourceBridgeJob.payload,
      lineageParentJobId: sourceJob.id,
    },
  };

  const enqueueResult = enqueueBridgeRenderJob(retryBridgeJob, sourceBridgeJob.payload.prompt, callbacks, {
    retryOf: sourceJob.id,
    retryDepth: (sourceJob.retryDepth ?? 0) + 1,
    retrySource: 'historical_job',
  });

  return {
    jobId: enqueueResult.jobId,
    blocked: enqueueResult.blocked as RetryQueueResult['blocked'],
  };
};

// --- phase1 telemetry scaffold begin (reconciliation_cycle) ---
// OBSERVE-ONLY scaffold (no behavior change).
// Scope hint: reconcileDurableRenderAuthority lifecycle
// Keep behind: telemetry.instrumentation.phase1.enabled
//
// Suggested import (adjust alias/path to repo conventions):
// import { emitEvent } from "@/telemetry";
//
// Suggested runtime gate:
// const telemetryPhase1Enabled = config.get("telemetry.instrumentation.phase1.enabled") === true;
//
// Suggested events for this module:
//   - reconciliation.cycle.started
//   - reconciliation.cycle.completed
//
// Usage pattern (best-effort):
// if (telemetryPhase1Enabled) {
//   try {
//     await emitEvent(eventStore, ctx.seq("<event_name>"), { ... });
//   } catch (err) {
//     logger?.warn?.("telemetry emit failed", { err });
//   }
// }
// --- phase1 telemetry scaffold end (reconciliation_cycle) ---
