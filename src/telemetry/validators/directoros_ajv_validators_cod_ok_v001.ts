import Ajv2020 from "ajv/dist/2020";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import envelopeSchema from "../schemas/directoros_event_envelope_ref_ok_v001.schema.json";
import commandSchema from "../schemas/directoros_command_events_ref_ok_v001.schema.json";
import interventionSchema from "../schemas/directoros_intervention_events_ref_ok_v001.schema.json";
import reconciliationSchema from "../schemas/directoros_reconciliation_events_ref_ok_v001.schema.json";
import projectionSchema from "../schemas/directoros_projection_events_ref_ok_v001.schema.json";
import type { DirectorOSEventEnvelope } from "../types/directoros_event_types_cod_ok_v001";

export interface ValidatorSet {
  envelope: ValidateFunction;
  command: ValidateFunction;
  intervention: ValidateFunction;
  reconciliation: ValidateFunction;
  projection: ValidateFunction;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

ajv.addSchema(envelopeSchema, "directoros_event_envelope_ref_ok_v001.schema.json");

export const validators: ValidatorSet = {
  envelope: ajv.compile(envelopeSchema),
  command: ajv.compile(commandSchema),
  intervention: ajv.compile(interventionSchema),
  reconciliation: ajv.compile(reconciliationSchema),
  projection: ajv.compile(projectionSchema)
};

export function assertValid(validator: ValidateFunction, payload: unknown): void {
  if (!validator(payload)) {
    const detail = JSON.stringify(validator.errors ?? [], null, 2);
    throw new Error(`Telemetry schema validation failed: ${detail}`);
  }
}

export function isEnvelopeEvent(payload: unknown): payload is DirectorOSEventEnvelope {
  return !!validators.envelope(payload);
}

export function isCommandEvent(payload: unknown): payload is DirectorOSEventEnvelope {
  return !!validators.command(payload);
}

export function isInterventionEvent(payload: unknown): payload is DirectorOSEventEnvelope {
  return !!validators.intervention(payload);
}

export function isReconciliationEvent(payload: unknown): payload is DirectorOSEventEnvelope {
  return !!validators.reconciliation(payload);
}

export function isProjectionEvent(payload: unknown): payload is DirectorOSEventEnvelope {
  return !!validators.projection(payload);
}
