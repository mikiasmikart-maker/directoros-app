// DirectorOS telemetry barrel (phase-1)

export type * from "./types/directoros_event_types_cod_ok_v001";
export { emitEvent } from "./core/directoros_event_emitter_cod_ok_v001";
export type { EventStore, EmitContext } from "./core/directoros_event_emitter_cod_ok_v001";
export { makeStream, newTrace, childSpan } from "./core/directoros_trace_utils_cod_ok_v001";
export type { TraceSeed } from "./core/directoros_trace_utils_cod_ok_v001";

// schema paths (for loader/bootstrap)
export const TELEMETRY_SCHEMA_PATHS_V001 = {
  envelope: "./schemas/directoros_event_envelope_ref_ok_v001.schema.json",
  command: "./schemas/directoros_command_events_ref_ok_v001.schema.json",
  intervention: "./schemas/directoros_intervention_events_ref_ok_v001.schema.json",
  reconciliation: "./schemas/directoros_reconciliation_events_ref_ok_v001.schema.json",
  projection: "./schemas/directoros_projection_events_ref_ok_v001.schema.json"
} as const;

export const TELEMETRY_SCHEMA_VERSION = "directoros.event.v001" as const;
