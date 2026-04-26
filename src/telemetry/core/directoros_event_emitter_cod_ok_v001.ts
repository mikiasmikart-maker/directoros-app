import type { DirectorOSEventEnvelope, EventActor, EventTrace } from "../types/directoros_event_types_cod_ok_v001";

export interface EventStore {
  append(event: DirectorOSEventEnvelope): Promise<void>;
}

export interface EmitContext {
  producer: { service: string; module: string; instance_id: string };
  actor: EventActor;
  trace: EventTrace;
  subject: { type: string; id: string; engine: string; target: string };
  sequence: { stream: string; index: number };
}

export function makeEventId(prefix = "evt"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function makeIdempotencyKey(subjectId: string, eventName: string, index: number): string {
  return `${subjectId}:${eventName}:${index}`;
}

export async function emitEvent<TData extends Record<string, unknown>>(
  store: EventStore,
  ctx: EmitContext,
  input: {
    event_name: string;
    outcome: { status: string; code: string; message: string };
    metrics?: { latency_ms?: number | null; queue_ms?: number | null };
    data?: TData;
    occurred_at?: string;
  }
): Promise<DirectorOSEventEnvelope<TData>> {
  const now = new Date().toISOString();
  const event: DirectorOSEventEnvelope<TData> = {
    schema_version: "directoros.event.v001",
    event_id: makeEventId(),
    event_name: input.event_name,
    occurred_at: input.occurred_at ?? now,
    recorded_at: now,
    producer: ctx.producer,
    trace: ctx.trace,
    actor: ctx.actor,
    subject: ctx.subject,
    sequence: ctx.sequence,
    idempotency: {
      key: makeIdempotencyKey(ctx.subject.id, input.event_name, ctx.sequence.index),
      replay_safe: true
    },
    outcome: input.outcome,
    metrics: {
      latency_ms: input.metrics?.latency_ms ?? null,
      queue_ms: input.metrics?.queue_ms ?? null
    },
    data: (input.data ?? {}) as TData
  };

  const { assertValid, validators } = await import("../validators/directoros_ajv_validators_cod_ok_v001");
  assertValid(validators.envelope, event);
  await store.append(event);
  return event;
}
