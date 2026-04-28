import type { RenderBridgeJob } from '../bridge/renderBridge';
import { emitRenderJobEvent } from './jobEvents';
import { emitEvent, makeStream, newTrace } from '../telemetry';
import type { DirectorOSEventEnvelope, EmitContext } from '../telemetry';

export type RenderJobState = 'queued' | 'preflight' | 'running' | 'packaging' | 'completed' | 'failed' | 'cancelled';

export type OutputMediaType = 'image' | 'video';

export interface RenderOutputAsset {
  path: string;
  mediaType: OutputMediaType;
}

export interface RuntimeRenderJob {
  id: string;
  sceneId: string;
  shotId?: string;
  takeId?: string;
  version?: number;
  lineageParentJobId?: string;
  engine: RenderBridgeJob['engine'];
  state: RenderJobState;
  progress: number;
  createdAt: number;
  updatedAt: number;
  bridgeJob: RenderBridgeJob;
  externalJobId?: string;
  runtimeBridgeJobId?: string;
  resultPaths?: string[];
  outputAssets?: RenderOutputAsset[];
  previewImage?: string;
  previewMedia?: string;
  previewType?: OutputMediaType;
  error?: string;
  failedStage?: Exclude<RenderJobState, 'completed'>;
  dependencyIssue?: string;
  manifestPath?: string;
  runtimeWarnings?: string[];
  runtimeErrors?: string[];
  preflightStatus?: { passed: boolean; checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message?: string }> };
  dependencyStatus?: { comfyui?: 'ok' | 'down' | 'unknown'; ollama?: 'ok' | 'down' | 'unknown'; python?: 'ok' | 'down' | 'unknown'; bridge?: 'ok' | 'down' | 'unknown' };
  retryOf?: string;
  retryDepth?: number;
  retrySource?: string;
  metadata?: Record<string, any>;
}

const STATE_ORDER: Record<RenderJobState, number> = {
  queued: 0,
  preflight: 1,
  running: 2,
  packaging: 3,
  completed: 4,
  failed: 4,
  cancelled: 4,
};

const TERMINAL_STATES = new Set<RenderJobState>(['completed', 'failed', 'cancelled']);

const pickDefined = <T>(incoming: T | undefined, existing: T | undefined): T | undefined => (incoming !== undefined ? incoming : existing);

const mergeUnique = (incoming?: string[], existing?: string[]) => {
  if (!incoming?.length) return existing;
  if (!existing?.length) return incoming;
  return Array.from(new Set([...existing, ...incoming]));
};

const shouldAdvanceState = (existing: RenderJobState, incoming: RenderJobState) => {
  if (existing === incoming) return true;
  if (TERMINAL_STATES.has(existing)) return false;
  return STATE_ORDER[incoming] >= STATE_ORDER[existing];
};

export interface RuntimeJobCounts {
  total: number;
  queued: number;
  rendering: number;
}

export type RenderQueueJob = RuntimeRenderJob;
export type RenderJobCounts = RuntimeJobCounts;

const JOBS_KEY = 'directoros.renderJobs.v1';
const hasWindow = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const runtimeJobs = new Map<string, RuntimeRenderJob>();

// --- containment test pass begin ---
const MAX_PERSISTED_JOBS = 10;
const MAX_IN_MEMORY_JOBS = 10;
const PERSIST_DEBOUNCE_MS = 500;
let persistTimeout: ReturnType<typeof setTimeout> | null = null;
// --- containment test pass end ---

const enforceInMemoryCap = () => {
  if (runtimeJobs.size <= MAX_IN_MEMORY_JOBS) return;
  const allJobs = Array.from(runtimeJobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  const toDelete = allJobs.slice(MAX_IN_MEMORY_JOBS);
  toDelete.forEach((j) => runtimeJobs.delete(j.id));
};

export const persistJobs = () => {
  if (!hasWindow) return;
  
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      const t0 = performance.now();
      
      // --- containment test pass: preserve ordering and cap ---
      const allJobs = Array.from(runtimeJobs.values()).sort((a, b) => b.createdAt - a.createdAt);
      const cappedJobs = allJobs.slice(0, MAX_PERSISTED_JOBS);
      const payload = JSON.stringify(cappedJobs);
      // --- containment test pass end ---

      const stringifyDuration = performance.now() - t0;

      const t1 = performance.now();
      window.localStorage.setItem(JOBS_KEY, payload);
      const writeDuration = performance.now() - t1;

      console.debug(`[directoros.instrumentation] Persistence | Stringify: ${stringifyDuration.toFixed(2)}ms | LocalStorage: ${writeDuration.toFixed(2)}ms | Payload Size: ${(payload.length / 1024).toFixed(1)} KB | Count: ${cappedJobs.length}`);
    } catch {
      // ignore persistence failure
    }
  }, PERSIST_DEBOUNCE_MS);
};

const hydrateJobs = () => {
  if (!hasWindow) return;
  try {
    const raw = window.localStorage.getItem(JOBS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as RuntimeRenderJob[];
    parsed.forEach((job) => runtimeJobs.set(job.id, job));
    enforceInMemoryCap();
  } catch {
    // ignore hydration issues
  }
};

hydrateJobs();

const isTelemetryPhase1Enabled = (): boolean => {
  try {
    return window.localStorage.getItem('telemetry.instrumentation.phase1.enabled') === 'true';
  } catch {
    return false;
  }
};

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

const emitProjectionRenderCompleted = async (job: RuntimeRenderJob): Promise<void> => {
  if (!isTelemetryPhase1Enabled()) return;
  try {
    const projectionId = `projection_${job.id}`;
    const trace = newTrace(projectionId);
    const ctx: EmitContext = {
      producer: { service: 'directoros-app', module: 'm8_operator', instance_id: 'web-main' },
      actor: { type: 'system', id: 'projection-renderer', session_id: 'web-session', lane: 'lane_1' },
      trace,
      subject: { type: 'projection', id: projectionId, engine: 'projection-engine', target: job.id },
      sequence: { stream: makeStream('projection', projectionId), index: 1 },
    };

    await emitEvent(telemetryEventStore, ctx, {
      event_name: 'projection.render.completed',
      outcome: { status: 'success', code: 'OK', message: 'Projection render completed' },
      metrics: { latency_ms: null, queue_ms: 0 },
      data: {
        view_id: `job:${job.id}`,
        component: 'render_job_card',
        render_version: String(job.updatedAt),
        source_occurred_at: new Date(job.updatedAt).toISOString(),
      },
    });
  } catch {
    // best-effort only
  }
};

export const addRenderJob = (
  bridgeJob: RenderBridgeJob,
  lineage?: { retryOf?: string; retryDepth?: number; retrySource?: string }
): RuntimeRenderJob => {
  const existing = runtimeJobs.get(bridgeJob.id);
  if (existing) {
    const next: RuntimeRenderJob = {
      ...existing,
      sceneId: existing.sceneId ?? bridgeJob.sceneId,
      shotId: existing.shotId ?? bridgeJob.payload.shotContext?.shotId ?? bridgeJob.payload.timeline?.shotId,
      takeId: existing.takeId ?? bridgeJob.payload.shotContext?.takeId,
      version: existing.version ?? bridgeJob.payload.shotContext?.version,
      lineageParentJobId: existing.lineageParentJobId ?? bridgeJob.payload.lineageParentJobId ?? lineage?.retryOf,
      bridgeJob: existing.bridgeJob ?? { ...bridgeJob, payload: { ...bridgeJob.payload, graph: undefined } as any },
      retryOf: existing.retryOf ?? lineage?.retryOf,
      retryDepth: existing.retryDepth ?? lineage?.retryDepth,
      retrySource: existing.retrySource ?? lineage?.retrySource,
      updatedAt: Date.now(),
    };
    runtimeJobs.set(next.id, next);
    enforceInMemoryCap();
    persistJobs();
    return next;
  }

  const now = Date.now();
  const job: RuntimeRenderJob = {
    id: bridgeJob.id,
    sceneId: bridgeJob.sceneId,
    shotId: bridgeJob.payload.shotContext?.shotId ?? bridgeJob.payload.timeline?.shotId,
    takeId: bridgeJob.payload.shotContext?.takeId,
    version: bridgeJob.payload.shotContext?.version,
    lineageParentJobId: bridgeJob.payload.lineageParentJobId ?? lineage?.retryOf,
    engine: bridgeJob.engine,
    state: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    bridgeJob: {
      ...bridgeJob,
      payload: { ...bridgeJob.payload, graph: undefined } as any, // STRIP: Dead weight
    },
    retryOf: lineage?.retryOf,
    retryDepth: lineage?.retryDepth,
    retrySource: lineage?.retrySource,
  };
  runtimeJobs.set(job.id, job);
  enforceInMemoryCap();
  persistJobs();
  emitRenderJobEvent({ type: 'job.created', job });
  if (job.retryOf) {
    emitRenderJobEvent({ type: 'job.retry.created', job });
  }
  return job;
};

export const getRenderJob = (jobId: string): RuntimeRenderJob | undefined => runtimeJobs.get(jobId);

export const listRenderJobs = (): RuntimeRenderJob[] => Array.from(runtimeJobs.values()).sort((a, b) => b.createdAt - a.createdAt);

export const setRenderJobState = (
  jobId: string,
  state: RenderJobState,
  patch?: Partial<Pick<RuntimeRenderJob, 'externalJobId' | 'runtimeBridgeJobId' | 'error' | 'resultPaths' | 'outputAssets' | 'previewImage' | 'previewMedia' | 'previewType' | 'failedStage' | 'dependencyIssue' | 'manifestPath' | 'runtimeWarnings' | 'runtimeErrors' | 'preflightStatus' | 'dependencyStatus' | 'metadata'>> & { forceHydrateState?: boolean; skipPersist?: boolean }
): RuntimeRenderJob | undefined => {
  const existing = runtimeJobs.get(jobId);
  if (!existing) return undefined;
  if (!patch?.forceHydrateState && !shouldAdvanceState(existing.state, state)) return existing;

  const nextState = existing.state === state ? existing.state : state;
  const nextProgress =
    nextState === 'completed'
      ? 100
      : nextState === 'cancelled'
        ? existing.progress
        : Math.max(existing.progress, patch?.resultPaths?.length ? 100 : existing.progress);

  const next: RuntimeRenderJob = {
    ...existing,
    externalJobId: pickDefined(patch?.externalJobId, existing.externalJobId),
    runtimeBridgeJobId: pickDefined(patch?.runtimeBridgeJobId, existing.runtimeBridgeJobId),
    error: pickDefined(patch?.error, existing.error),
    resultPaths: mergeUnique(patch?.resultPaths, existing.resultPaths),
    outputAssets: patch?.outputAssets?.length ? patch.outputAssets : existing.outputAssets,
    previewImage: pickDefined(patch?.previewImage, existing.previewImage),
    previewMedia: pickDefined(patch?.previewMedia, existing.previewMedia),
    previewType: pickDefined(patch?.previewType, existing.previewType),
    failedStage: pickDefined(patch?.failedStage, existing.failedStage),
    dependencyIssue: pickDefined(patch?.dependencyIssue, existing.dependencyIssue),
    manifestPath: pickDefined(patch?.manifestPath, existing.manifestPath),
    runtimeWarnings: mergeUnique(patch?.runtimeWarnings, existing.runtimeWarnings),
    runtimeErrors: mergeUnique(patch?.runtimeErrors, existing.runtimeErrors),
    preflightStatus: pickDefined(patch?.preflightStatus, existing.preflightStatus),
    dependencyStatus: pickDefined(patch?.dependencyStatus, existing.dependencyStatus),
    state: nextState,
    updatedAt: Date.now(),
    progress: nextProgress,
  };

  runtimeJobs.set(jobId, next);
  enforceInMemoryCap();
  if (!patch?.skipPersist) persistJobs();

  if (nextState !== existing.state) {
    const eventTypeByState: Record<RenderJobState, 'job.queued' | 'job.preflight.started' | 'job.running' | 'job.packaging' | 'job.completed' | 'job.failed' | 'job.cancelled'> = {
      queued: 'job.queued',
      preflight: 'job.preflight.started',
      running: 'job.running',
      packaging: 'job.packaging',
      completed: 'job.completed',
      failed: 'job.failed',
      cancelled: 'job.cancelled',
    };

    emitRenderJobEvent({ type: eventTypeByState[nextState], job: next });
    if (nextState === 'completed') {
      void emitProjectionRenderCompleted(next);
    }
  }
  return next;
};

export const updateRenderProgress = (jobId: string, progress: number): RuntimeRenderJob | undefined => {
  const existing = runtimeJobs.get(jobId);
  if (!existing) return undefined;

  const clamped = Math.max(0, Math.min(100, progress));
  const nextState: RenderJobState = clamped >= 100 ? 'completed' : existing.state;
  const next: RuntimeRenderJob = {
    ...existing,
    progress: clamped,
    state: nextState,
    updatedAt: Date.now(),
  };

  const progressJump = Math.abs(clamped - (existing.progress || 0));
  const shouldEmit = nextState !== existing.state || progressJump >= 2 || clamped === 100 || clamped === 0;

  runtimeJobs.set(jobId, next);
  enforceInMemoryCap();
  persistJobs();

  if (shouldEmit) {
    emitRenderJobEvent({ type: 'job.progress', job: next });
  }
  
  return next;
};

export const completeRenderJob = (
  jobId: string,
  resultPaths: string[],
  previewImage?: string,
  previewMedia?: string,
  previewType?: OutputMediaType,
  outputAssets?: RenderOutputAsset[]
): RenderQueueJob | undefined =>
  setRenderJobState(jobId, 'completed', { resultPaths, previewImage, previewMedia, previewType, outputAssets });

export const failRenderJob = (
  jobId: string,
  error: string,
  diagnostics?: { failedStage?: Exclude<RenderJobState, 'completed'>; dependencyIssue?: string; manifestPath?: string }
): RenderQueueJob | undefined =>
  setRenderJobState(jobId, 'failed', {
    error,
    failedStage: diagnostics?.failedStage ?? 'running',
    dependencyIssue: diagnostics?.dependencyIssue,
    manifestPath: diagnostics?.manifestPath,
  });

export const getRenderJobCounts = (): RuntimeJobCounts => {
  const all = Array.from(runtimeJobs.values());
  return {
    total: all.length,
    queued: all.filter((job) => job.state === 'queued' || job.state === 'preflight').length,
    rendering: all.filter((job) => job.state === 'running' || job.state === 'packaging').length,
  };
};

export const listActiveRuntimeJobs = (): RuntimeRenderJob[] =>
  Array.from(runtimeJobs.values()).filter((job) => ['queued', 'preflight', 'running', 'packaging'].includes(job.state));

export const listQueueEligibleJobs = listActiveRuntimeJobs;

// --- phase1 telemetry scaffold begin (projection_render) ---
// OBSERVE-ONLY scaffold (no behavior change).
// Scope hint: job.completed authoritative state transition
// Keep behind: telemetry.instrumentation.phase1.enabled
//
// Suggested import (adjust alias/path to repo conventions):
// import { emitEvent } from "@/telemetry";
//
// Suggested runtime gate:
// const telemetryPhase1Enabled = config.get("telemetry.instrumentation.phase1.enabled") === true;
//
// Suggested events for this module:
//   - projection.render.completed
//
// Usage pattern (best-effort):
// if (telemetryPhase1Enabled) {
//   try {
//     await emitEvent(eventStore, ctx.seq("<event_name>"), { ... });
//   } catch (err) {
//     logger?.warn?.("telemetry emit failed", { err });
//   }
// }
// --- phase1 telemetry scaffold end (projection_render) ---
