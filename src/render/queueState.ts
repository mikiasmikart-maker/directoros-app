import { defaultQueuePolicy, type QueuePolicy } from './queuePolicy';

export type RuntimeControlMode = 'running' | 'paused';

export interface RuntimeControlState {
  mode: RuntimeControlMode;
  stagedJobIds: string[];
  queuedJobIds: string[];
  activeJobIds: string[];
  policy: QueuePolicy;
}

export type QueueRuntimeState = RuntimeControlMode;
export type QueueState = RuntimeControlState;

const RUNTIME_CONTROL_STATE_KEY = 'directoros.runtimeControlState.v1';
const hasWindow = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

let runtimeControlState: RuntimeControlState = {
  mode: 'running',
  stagedJobIds: [],
  queuedJobIds: [],
  activeJobIds: [],
  policy: defaultQueuePolicy,
};

const persistQueueState = () => {
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(RUNTIME_CONTROL_STATE_KEY, JSON.stringify(runtimeControlState));
  } catch {
    // ignore persistence errors
  }
};

const hydrateQueueState = () => {
  if (!hasWindow) return;
  try {
    const raw = window.localStorage.getItem(RUNTIME_CONTROL_STATE_KEY) ?? window.localStorage.getItem('directoros.queueState.v1');
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<RuntimeControlState> & { queuedJobIds?: string[] };
    const stagedJobIds = Array.isArray(parsed.stagedJobIds) ? parsed.stagedJobIds : Array.isArray(parsed.queuedJobIds) ? parsed.queuedJobIds : [];
    runtimeControlState = {
      mode: parsed.mode === 'paused' ? 'paused' : 'running',
      stagedJobIds,
      queuedJobIds: stagedJobIds,
      activeJobIds: Array.isArray(parsed.activeJobIds) ? parsed.activeJobIds : [],
      policy: { ...defaultQueuePolicy, ...(parsed.policy ?? {}) },
    };
  } catch {
    // ignore hydration issues
  }
};

hydrateQueueState();

export const getRuntimeControlState = () => runtimeControlState;
export const getQueueState = getRuntimeControlState;

export const setRuntimeControlMode = (mode: RuntimeControlMode) => {
  runtimeControlState = { ...runtimeControlState, mode };
  persistQueueState();
  return runtimeControlState;
};

export const setQueueMode = setRuntimeControlMode;

export const stageRuntimeJobId = (jobId: string) => {
  const stagedJobIds = [...runtimeControlState.stagedJobIds, jobId];
  runtimeControlState = { ...runtimeControlState, stagedJobIds, queuedJobIds: stagedJobIds };
  persistQueueState();
};

export const enqueueJobId = stageRuntimeJobId;

export const unstageRuntimeJobId = (jobId: string) => {
  const stagedJobIds = runtimeControlState.stagedJobIds.filter((id) => id !== jobId);
  runtimeControlState = { ...runtimeControlState, stagedJobIds, queuedJobIds: stagedJobIds };
  persistQueueState();
};

export const dequeueJobId = unstageRuntimeJobId;

export const addActiveRuntimeJobId = (jobId: string) => {
  runtimeControlState = { ...runtimeControlState, activeJobIds: [...runtimeControlState.activeJobIds, jobId] };
  persistQueueState();
};

export const addActiveJobId = addActiveRuntimeJobId;

export const removeActiveRuntimeJobId = (jobId: string) => {
  runtimeControlState = { ...runtimeControlState, activeJobIds: runtimeControlState.activeJobIds.filter((id) => id !== jobId) };
  persistQueueState();
};

export const removeActiveJobId = removeActiveRuntimeJobId;

export const patchRuntimeControlPolicy = (patch: Partial<QueuePolicy>) => {
  runtimeControlState = { ...runtimeControlState, policy: { ...runtimeControlState.policy, ...patch } };
  persistQueueState();
  return runtimeControlState.policy;
};

export const patchQueuePolicy = patchRuntimeControlPolicy;

export const resetRuntimeExecutionPointers = () => {
  runtimeControlState = {
    ...runtimeControlState,
    stagedJobIds: [],
    queuedJobIds: [],
    activeJobIds: [],
  };
  persistQueueState();
  return runtimeControlState;
};

export const resetQueueExecutionPointers = resetRuntimeExecutionPointers;
