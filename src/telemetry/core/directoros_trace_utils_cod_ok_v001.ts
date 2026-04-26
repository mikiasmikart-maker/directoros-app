
export interface TraceSeed {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  causation_id: string | null;
  correlation_id: string;
}

export function newTrace(correlationId: string): TraceSeed {
  return {
    trace_id: `trc_${crypto.randomUUID().replace(/-/g, "")}`,
    span_id: `spn_${crypto.randomUUID().replace(/-/g, "")}`,
    parent_span_id: null,
    causation_id: null,
    correlation_id: correlationId
  };
}

export function childSpan(parent: TraceSeed, causationId?: string): TraceSeed {
  return {
    trace_id: parent.trace_id,
    span_id: `spn_${crypto.randomUUID().replace(/-/g, "")}`,
    parent_span_id: parent.span_id,
    causation_id: causationId ?? null,
    correlation_id: parent.correlation_id
  };
}

export function makeStream(entity: "command" | "intervention" | "reconciliation" | "projection", id: string): string {
  return `${entity}:${id}`;
}
