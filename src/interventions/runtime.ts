import { emitEvent, makeStream, newTrace } from '../telemetry';
import type { DirectorOSEventEnvelope, EmitContext } from '../telemetry';

export type InterventionActionType = 'create' | 'assign' | 'escalate' | 'resolve' | 'close' | 'clear';

export type InterventionStatus = 'open' | 'assigned' | 'escalated' | 'resolved' | 'closed' | 'cleared';

export interface InterventionEvent {
  eventId: string;
  interventionId: string;
  actionType: InterventionActionType;
  occurredAt: string;
  actor: string;
  sourceJobId?: string;
  sourceShotId?: string;
  sourceSceneId?: string;
  reasonCode: string;
  impactSummary: string;
  assignee?: string;
}

export interface InterventionProjection {
  id: string;
  status: InterventionStatus;
  createdAt: string;
  updatedAt: string;
  sourceJobId?: string;
  sourceShotId?: string;
  sourceSceneId?: string;
  assignee?: string;
  lastReasonCode: string;
  lastImpactSummary: string;
  escalated: boolean;
  resolved: boolean;
  closed: boolean;
  cleared: boolean;
  historyCount: number;
}

const STORAGE_KEY = 'directoros.interventions.eventlog.v1';

const readEvents = (): InterventionEvent[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as InterventionEvent[];
  } catch {
    return [];
  }
};

const writeEvents = (events: InterventionEvent[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

export const listInterventionEvents = () => readEvents();

export const appendInterventionEvent = (event: Omit<InterventionEvent, 'eventId' | 'occurredAt'>) => {
  const full: InterventionEvent = {
    ...event,
    eventId: `ivt_evt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  };
  const next = [...readEvents(), full];
  writeEvents(next);

  const telemetryEnabled = (() => {
    try {
      return window.localStorage.getItem('telemetry.instrumentation.phase1.enabled') === 'true';
    } catch {
      return false;
    }
  })();

  const lifecycleMap: Record<InterventionActionType, 'intervention.lifecycle.opened' | 'intervention.lifecycle.resolved' | 'intervention.lifecycle.closed' | null> = {
    create: 'intervention.lifecycle.opened',
    resolve: 'intervention.lifecycle.resolved',
    close: 'intervention.lifecycle.closed',
    clear: 'intervention.lifecycle.closed',
    assign: null,
    escalate: null,
  };

  const telemetryEventName = lifecycleMap[full.actionType];

  const emitInterventionTelemetry = async () => {
    if (!telemetryEnabled || !telemetryEventName) return;
    try {
      const trace = newTrace(full.interventionId);
      const telemetryEventStore = {
        append: async (telemetryEvent: DirectorOSEventEnvelope) => {
          try {
            const key = 'directoros.telemetry.eventlog.v1';
            const raw = window.localStorage.getItem(key);
            const parsed = raw ? (JSON.parse(raw) as DirectorOSEventEnvelope[]) : [];
            const nextEvents = [...parsed, telemetryEvent].slice(-1000);
            window.localStorage.setItem(key, JSON.stringify(nextEvents));
          } catch {
            // best-effort only
          }
        },
      };

      const stateEvents = next.filter((item) => item.interventionId === full.interventionId);
      const sequenceIndex = stateEvents.length;

      const ctx: EmitContext = {
        producer: { service: 'directoros-app', module: 'm8_operator', instance_id: 'web-main' },
        actor: { type: 'operator', id: full.actor, session_id: 'web-session', lane: 'lane_1' },
        trace,
        subject: { type: 'intervention', id: full.interventionId, engine: 'operator-engine', target: full.sourceJobId ?? full.sourceShotId ?? 'intervention' },
        sequence: { stream: makeStream('intervention', full.interventionId), index: sequenceIndex },
      };

      await emitEvent(telemetryEventStore, ctx, {
        event_name: telemetryEventName,
        outcome: { status: telemetryEventName.split('.').pop() ?? 'unknown', code: 'OK', message: `Intervention ${full.actionType}` },
        metrics: { latency_ms: null, queue_ms: 0 },
        data: {
          reason: full.reasonCode,
          severity: full.actionType === 'escalate' ? 'high' : full.actionType === 'resolve' || full.actionType === 'close' || full.actionType === 'clear' ? 'low' : 'medium',
          confidence: undefined,
          threshold: undefined,
          resolution: full.actionType === 'resolve' || full.actionType === 'close' || full.actionType === 'clear' ? full.impactSummary : undefined,
        },
      });
    } catch {
      // best-effort only
    }
  };

  void emitInterventionTelemetry();
  return full;
};

export const createIntervention = (params: {
  actor: string;
  sourceJobId?: string;
  sourceShotId?: string;
  sourceSceneId?: string;
  reasonCode: string;
  impactSummary: string;
}) => {
  const interventionId = `ivt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  appendInterventionEvent({
    interventionId,
    actionType: 'create',
    actor: params.actor,
    sourceJobId: params.sourceJobId,
    sourceShotId: params.sourceShotId,
    sourceSceneId: params.sourceSceneId,
    reasonCode: params.reasonCode,
    impactSummary: params.impactSummary,
  });
  return interventionId;
};

export const applyInterventionAction = (params: {
  interventionId: string;
  actionType: Exclude<InterventionActionType, 'create'>;
  actor: string;
  reasonCode: string;
  impactSummary: string;
  assignee?: string;
}) => appendInterventionEvent(params);

export const replayInterventionEvents = (events: InterventionEvent[]): InterventionProjection[] => {
  const byId = new Map<string, InterventionProjection>();

  for (const event of events) {
    const existing = byId.get(event.interventionId);
    const base: InterventionProjection =
      existing ?? {
        id: event.interventionId,
        status: 'open',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        sourceJobId: event.sourceJobId,
        sourceShotId: event.sourceShotId,
        sourceSceneId: event.sourceSceneId,
        assignee: undefined,
        lastReasonCode: event.reasonCode,
        lastImpactSummary: event.impactSummary,
        escalated: false,
        resolved: false,
        closed: false,
        cleared: false,
        historyCount: 0,
      };

    const next: InterventionProjection = {
      ...base,
      updatedAt: event.occurredAt,
      sourceJobId: base.sourceJobId ?? event.sourceJobId,
      sourceShotId: base.sourceShotId ?? event.sourceShotId,
      sourceSceneId: base.sourceSceneId ?? event.sourceSceneId,
      assignee: event.assignee ?? base.assignee,
      lastReasonCode: event.reasonCode,
      lastImpactSummary: event.impactSummary,
      historyCount: base.historyCount + 1,
    };

    if (event.actionType === 'create') next.status = 'open';
    if (event.actionType === 'assign') next.status = 'assigned';
    if (event.actionType === 'escalate') {
      next.status = 'escalated';
      next.escalated = true;
    }
    if (event.actionType === 'resolve') {
      next.status = 'resolved';
      next.resolved = true;
    }
    if (event.actionType === 'close') {
      next.status = 'closed';
      next.closed = true;
    }
    if (event.actionType === 'clear') {
      next.status = 'cleared';
      next.cleared = true;
    }

    byId.set(event.interventionId, next);
  }

  return Array.from(byId.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
};

// --- phase1 telemetry scaffold begin (intervention_lifecycle) ---
// OBSERVE-ONLY scaffold (no behavior change).
// Scope hint: create/apply intervention events
// Keep behind: telemetry.instrumentation.phase1.enabled
//
// Suggested import (adjust alias/path to repo conventions):
// import { emitEvent } from "@/telemetry";
//
// Suggested runtime gate:
// const telemetryPhase1Enabled = config.get("telemetry.instrumentation.phase1.enabled") === true;
//
// Suggested events for this module:
//   - intervention.lifecycle.opened
//   - intervention.lifecycle.resolved
//   - intervention.lifecycle.closed
//
// Usage pattern (best-effort):
// if (telemetryPhase1Enabled) {
//   try {
//     await emitEvent(eventStore, ctx.seq("<event_name>"), { ... });
//   } catch (err) {
//     logger?.warn?.("telemetry emit failed", { err });
//   }
// }
// --- phase1 telemetry scaffold end (intervention_lifecycle) ---
