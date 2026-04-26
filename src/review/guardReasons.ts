export type GuardReasonCode =
  | 'invalid_state'
  | 'authority_boundary'
  | 'already_finalized'
  | 'missing_review_outcome'
  | 'superseded_job'
  | 'lineage_conflict'
  | 'no_target_job'
  | 'self_supersede_forbidden';

export interface GuardResult {
  blocked: boolean;
  reasonCode?: GuardReasonCode;
  message?: string;
}

const reasonMessages: Record<GuardReasonCode, string> = {
  invalid_state: 'Action is not allowed from the current job state',
  authority_boundary: 'Action blocked by authority boundary',
  already_finalized: 'Shot is finalized and cannot be changed',
  missing_review_outcome: 'Finalize requires an approved review outcome',
  superseded_job: 'Selected job is already superseded',
  lineage_conflict: 'Supersede lineage conflict detected',
  no_target_job: 'No valid target job available for supersede',
  self_supersede_forbidden: 'Job cannot supersede itself',
};

export const getGuardMessage = (reasonCode: GuardReasonCode): string => reasonMessages[reasonCode];

export const makeBlockedGuard = (reasonCode: GuardReasonCode): GuardResult => ({
  blocked: true,
  reasonCode,
  message: getGuardMessage(reasonCode),
});

export const makeAllowedGuard = (): GuardResult => ({ blocked: false });

export const normalizeReasonCode = (raw?: string): GuardReasonCode | undefined => {
  if (!raw) return undefined;
  const code = raw.trim().toUpperCase();
  if (['AUTHORITY_DENIED'].includes(code)) return 'authority_boundary';
  if (['INVALID_ALREADY_FINALIZED', 'INVALID_FINALIZED_IMMUTABLE'].includes(code)) return 'already_finalized';
  if (['INVALID_FINALIZE_BEFORE_APPROVAL', 'MISSING_APPROVED_BY'].includes(code)) return 'missing_review_outcome';
  if (['INVALID_JOB_STATE_NOT_COMPLETED', 'MISSING_SELECTION_CONTEXT', 'INVALID_NOT_BEST_KNOWN'].includes(code)) return 'invalid_state';
  if (['INVALID_SUPERSEDE_NO_REPLACEMENT'].includes(code)) return 'no_target_job';
  if (['INVALID_SUPERSEDE_SELF_REFERENCE'].includes(code)) return 'self_supersede_forbidden';
  if (['INVALID_SUPERSEDE_JOB_MISMATCH', 'INVALID_SUPERSEDE_TARGET', 'lineage_mismatch'.toUpperCase()].includes(code)) return 'lineage_conflict';
  return undefined;
};

export const normalizeGuardFromRaw = (raw?: string): GuardResult => {
  const normalized = normalizeReasonCode(raw);
  if (!normalized) return { blocked: false };
  return makeBlockedGuard(normalized);
};
