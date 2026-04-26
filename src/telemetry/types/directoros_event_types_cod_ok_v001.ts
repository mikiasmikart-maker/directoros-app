export type LaneId = `lane_${number}`;

export interface EventProducer {
  service: string;
  module: string;
  instance_id: string;
}

export interface EventTrace {
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  causation_id?: string | null;
  correlation_id: string;
}

export interface EventActor {
  type: "operator" | "system";
  id: string;
  session_id: string;
  lane: LaneId;
}

export interface EventSubject {
  type: string;
  id: string;
  engine: string;
  target: string;
}

export interface EventSequence {
  stream: string;
  index: number;
}

export interface EventIdempotency {
  key: string;
  replay_safe: true;
}

export interface EventOutcome {
  status: string;
  code: string;
  message: string;
}

export interface EventMetrics {
  latency_ms: number | null;
  queue_ms: number | null;
}

export interface DirectorOSEventEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> {
  schema_version: "directoros.event.v001";
  event_id: string;
  event_name: string;
  occurred_at: string;
  recorded_at: string;
  producer: EventProducer;
  trace: EventTrace;
  actor: EventActor;
  subject: EventSubject;
  sequence: EventSequence;
  idempotency: EventIdempotency;
  outcome: EventOutcome;
  metrics: EventMetrics;
  data: TData;
}

export type CommandEventName =
  | "command.execution.requested"
  | "command.execution.validated"
  | "command.execution.started"
  | "command.execution.completed"
  | "command.execution.rolled_back"
  | "command.explainability.provided";

export type InterventionEventName =
  | "intervention.lifecycle.opened"
  | "intervention.lifecycle.annotated"
  | "intervention.lifecycle.escalated"
  | "intervention.lifecycle.resolved"
  | "intervention.lifecycle.closed";

export type ReconciliationEventName =
  | "reconciliation.cycle.started"
  | "reconciliation.cycle.completed"
  | "reconciliation.repair.attempted"
  | "reconciliation.repair.completed";

export type ProjectionEventName =
  | "projection.render.requested"
  | "projection.render.completed"
  | "ui.action.invoked"
  | "ui.action.completed";
