import type { RenderQueueJob } from './jobQueue';

export type RenderJobEventType =
  | 'job.created'
  | 'job.queued'
  | 'job.preflight.started'
  | 'job.running'
  | 'job.packaging'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'job.retry.created'
  | 'job.requeued'
  | 'job.progress'
  | 'queue.paused'
  | 'queue.resumed';

export interface RenderJobEvent {
  type: RenderJobEventType;
  job?: RenderQueueJob;
  queueState?: 'running' | 'paused';
  timestamp: number;
}

type Listener = (event: RenderJobEvent) => void;

const listeners = new Set<Listener>();
const EVENT_LOG_KEY = 'directoros.renderEventLog.v1';
const EVENT_LOG_LIMIT = 300;
const hasWindow = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const appendEventLog = (event: RenderJobEvent) => {
  if (!hasWindow) return;
  try {
    const raw = window.localStorage.getItem(EVENT_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as RenderJobEvent[]) : [];
    const next = [...parsed, event].slice(-EVENT_LOG_LIMIT);
    window.localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence issues for event stream
  }
};

export const emitRenderJobEvent = (event: Omit<RenderJobEvent, 'timestamp'>) => {
  const fullEvent: RenderJobEvent = { ...event, timestamp: Date.now() };
  appendEventLog(fullEvent);
  listeners.forEach((listener) => listener(fullEvent));
};

export const subscribeRenderJobEvents = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const listPersistedRenderJobEvents = (): RenderJobEvent[] => {
  if (!hasWindow) return [];
  try {
    const raw = window.localStorage.getItem(EVENT_LOG_KEY);
    return raw ? (JSON.parse(raw) as RenderJobEvent[]) : [];
  } catch {
    return [];
  }
};
