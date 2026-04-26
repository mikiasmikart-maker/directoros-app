import type { DirectorOSEventEnvelope } from "./directoros_event_types_cod_ok_v001";
import {
  isCommandEvent,
  isEnvelopeEvent,
  isInterventionEvent,
  isProjectionEvent,
  isReconciliationEvent
} from "../validators/directoros_ajv_validators_cod_ok_v001";

export function requireEnvelopeEvent(payload: unknown): DirectorOSEventEnvelope {
  if (!isEnvelopeEvent(payload)) {
    throw new Error("Invalid envelope event payload");
  }
  return payload;
}

export function requireCommandEvent(payload: unknown): DirectorOSEventEnvelope {
  if (!isCommandEvent(payload)) {
    throw new Error("Invalid command event payload");
  }
  return payload;
}

export function requireInterventionEvent(payload: unknown): DirectorOSEventEnvelope {
  if (!isInterventionEvent(payload)) {
    throw new Error("Invalid intervention event payload");
  }
  return payload;
}

export function requireReconciliationEvent(payload: unknown): DirectorOSEventEnvelope {
  if (!isReconciliationEvent(payload)) {
    throw new Error("Invalid reconciliation event payload");
  }
  return payload;
}

export function requireProjectionEvent(payload: unknown): DirectorOSEventEnvelope {
  if (!isProjectionEvent(payload)) {
    throw new Error("Invalid projection event payload");
  }
  return payload;
}
