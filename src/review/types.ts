export type ReviewEventType =
  | 'review.signal.updated'
  | 'review.decision.proposed'
  | 'review.decision.confirmed'
  | 'review.best_known.changed'
  | 'review.retry.recommended'
  | 'review.retry.enqueued'
  | 'review.status.changed'
  | 'review.approval.changed'
  | 'review.action.approved'
  | 'review.action.revision_requested'
  | 'review.action.rejected'
  | 'review.action.superseded'
  | 'review.action.finalized';
export interface ReviewEventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: ReviewEventType;
  occurredAt: number;
  projectId: string;
  sceneId: string;
  shotId: string;
  jobId: string;
  lineageRootJobId: string;
  queueId: string;
  connectorId: string;
  payload: TPayload;
  idempotencyKey: string;
}

export interface ReviewMeasuredSignals {
  technicalQuality: number;
  promptStyleAdherence: number;
  continuityMatch: number;
  artifactSeverity: number;
  motionStability: number;
  operatorConfidence: number;
}

export interface ShotReviewProjection {
  shotId: string;
  sceneId: string;
  projectId: string;
  updatedAt: number;
  sourceEventId: string;
  measuredSignals?: ReviewMeasuredSignals;
  bestKnownOutputSelection?: {
    selectedJobId: string;
    selectionMode: 'auto';
  };
  retryRecommendation?: {
    recommend: boolean;
    reasonCode?: string;
  };
  reviewStatus?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  approvalStatus?: 'unreviewed' | 'needs_revision' | 'approved' | 'rejected' | 'superseded';
  explanations?: {
    summary: string;
  };
  actionState?: {
    current: 'pending' | 'approved' | 'needs_revision' | 'rejected' | 'superseded' | 'finalized';
    approvedBy?: string;
    approvedAt?: number;
    supersededJobId?: string;
    supersededByJobId?: string;
    supersedesJobId?: string;
    finalizedAt?: number;
    finalJobId?: string;
    lastActionEventId?: string;
  };
}

export type ReviewActionType =
  | 'approve_best_known'
  | 'mark_needs_revision'
  | 'reject_output'
  | 'supersede_with_job'
  | 'finalize_shot';

export interface ReviewActionAudit {
  approvedBy?: string;
  approvedAt?: number;
  supersededJobId?: string;
  supersededByJobId?: string;
  supersedesJobId?: string;
  finalizedAt?: number;
  reasonCode?: string;
  note?: string;
}

export interface ReviewActionCommand {
  actionType: ReviewActionType;
  projectId: string;
  sceneId: string;
  shotId: string;
  jobId: string;
  lineageRootJobId: string;
  queueId: string;
  connectorId: string;
  idempotencyKey: string;
  actor: { source: 'operator' | 'system'; approvedBy?: string };
  guard?: { authorityResult?: 'granted' | 'denied' | 'not_required'; queueAuthorityTokenId?: string; projectionVersion?: number };
  data?: Record<string, unknown>;
  occurredAt?: number;
}

export interface DoublePaneComparison {
  primaryJobId: string;
  partnerJobId: string;
  rule: string;
}

export interface DeliveryRegistryItem {
  id: string;
  shotId: string;
  label: string;
  specs: string;
  actor: string;
  timestamp: string;
  path: string;
}

export interface SequenceReadiness {
  totalCount: number;
  finalizedCount: number;
  isReady: boolean;
  missingShots: Array<{ id: string; title: string }>;
}
