import type { ReviewActionType } from './types';

export type CanonicalReviewAction = 'approve' | 'revise' | 'reject' | 'supersede' | 'finalize';

export const legacyToCanonicalAction: Record<ReviewActionType, CanonicalReviewAction> = {
  approve_best_known: 'approve',
  mark_needs_revision: 'revise',
  reject_output: 'reject',
  supersede_with_job: 'supersede',
  finalize_shot: 'finalize',
};

export interface CanonicalReviewActionEventContract {
  event_type: 'review.action';
  action: CanonicalReviewAction;
  event_id: string;
  idempotency_key: string;
  shot_id: string;
  job_id: string;
  actor_id: string;
  ts: number;
  lineage_ref: string;
  prior_state: string;
  requested_state: string;
  schema_version: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export const toCanonicalAction = (action: ReviewActionType): CanonicalReviewAction => legacyToCanonicalAction[action];
