import type { ReviewEventEnvelope, ShotReviewProjection } from './types';

export interface JobApprovalProjection {
  jobId: string;
  shotId: string;
  sceneId: string;
  projectId: string;
  updatedAt: number;
  sourceEventId: string;
  approvalStatus?: ShotReviewProjection['approvalStatus'];
  actionState?: ShotReviewProjection['actionState'];
}

export interface ReducerState {
  shots: Map<string, ShotReviewProjection>;
  jobs: Map<string, JobApprovalProjection>;
}

const ensureShot = (state: ReducerState, event: ReviewEventEnvelope): ShotReviewProjection => {
  const existing = state.shots.get(event.shotId);
  if (existing) return existing;
  const seed: ShotReviewProjection = {
    projectId: event.projectId,
    sceneId: event.sceneId,
    shotId: event.shotId,
    updatedAt: event.occurredAt,
    sourceEventId: event.eventId,
  };
  state.shots.set(event.shotId, seed);
  return seed;
};

const ensureJob = (state: ReducerState, event: ReviewEventEnvelope): JobApprovalProjection => {
  const existing = state.jobs.get(event.jobId);
  if (existing) return existing;
  const seed: JobApprovalProjection = {
    projectId: event.projectId,
    sceneId: event.sceneId,
    shotId: event.shotId,
    jobId: event.jobId,
    updatedAt: event.occurredAt,
    sourceEventId: event.eventId,
  };
  state.jobs.set(event.jobId, seed);
  return seed;
};

const applyToShot = (current: ShotReviewProjection, event: ReviewEventEnvelope): ShotReviewProjection => {
  const next: ShotReviewProjection = {
    ...current,
    projectId: event.projectId,
    sceneId: event.sceneId,
    shotId: event.shotId,
    updatedAt: event.occurredAt,
    sourceEventId: event.eventId,
  };

  if (event.eventType === 'review.best_known.changed') {
    const payload = event.payload as { selectedJobId: string };
    next.bestKnownOutputSelection = {
      selectedJobId: payload.selectedJobId,
      selectionMode: 'auto',
    };
  }

  if (event.eventType === 'review.retry.recommended') {
    const payload = event.payload as { recommend: boolean; reasonCode?: string };
    next.retryRecommendation = {
      recommend: payload.recommend,
      reasonCode: payload.reasonCode,
    };
  }

  if (event.eventType === 'review.decision.confirmed') {
    const payload = event.payload as {
      bestKnownOutputSelection?: { selectedJobId: string };
      retryRecommendation?: { recommend: boolean; reasonCode?: string };
      reviewStatus?: ShotReviewProjection['reviewStatus'];
      approvalStatus?: ShotReviewProjection['approvalStatus'];
      summary?: string;
    };

    if (payload.bestKnownOutputSelection?.selectedJobId) {
      next.bestKnownOutputSelection = {
        selectedJobId: payload.bestKnownOutputSelection.selectedJobId,
        selectionMode: 'auto',
      };
    }

    if (payload.retryRecommendation) {
      next.retryRecommendation = {
        recommend: payload.retryRecommendation.recommend,
        reasonCode: payload.retryRecommendation.reasonCode,
      };
    }

    if (payload.reviewStatus) next.reviewStatus = payload.reviewStatus;
    if (payload.approvalStatus) next.approvalStatus = payload.approvalStatus;
    if (payload.summary) {
      next.explanations = {
        ...(next.explanations ?? { summary: payload.summary }),
        summary: payload.summary,
      };
    }
  }

  if (event.eventType === 'review.status.changed') {
    const payload = event.payload as { reviewStatus: ShotReviewProjection['reviewStatus']; summary?: string };
    next.reviewStatus = payload.reviewStatus;
    if (payload.summary) {
      next.explanations = {
        ...(next.explanations ?? { summary: payload.summary }),
        summary: payload.summary,
      };
    }
  }

  if (event.eventType === 'review.approval.changed') {
    const payload = event.payload as { approvalStatus: ShotReviewProjection['approvalStatus'] };
    next.approvalStatus = payload.approvalStatus;
  }

  if (
    event.eventType === 'review.action.approved' ||
    event.eventType === 'review.action.revision_requested' ||
    event.eventType === 'review.action.rejected' ||
    event.eventType === 'review.action.superseded' ||
    event.eventType === 'review.action.finalized'
  ) {
    const payload = event.payload as {
      audit?: { approvedBy?: string; approvedAt?: number; supersededJobId?: string; supersededByJobId?: string; supersedesJobId?: string; finalizedAt?: number };
      data?: { finalJobId?: string };
    };

    const currentAction =
      event.eventType === 'review.action.approved'
        ? 'approved'
        : event.eventType === 'review.action.revision_requested'
          ? 'needs_revision'
          : event.eventType === 'review.action.rejected'
            ? 'rejected'
            : event.eventType === 'review.action.superseded'
              ? 'superseded'
              : 'finalized';

    next.actionState = {
      current: currentAction,
      approvedBy: payload.audit?.approvedBy ?? next.actionState?.approvedBy,
      approvedAt: payload.audit?.approvedAt ?? next.actionState?.approvedAt,
      supersededJobId: payload.audit?.supersededJobId ?? next.actionState?.supersededJobId,
      supersededByJobId: payload.audit?.supersededByJobId ?? next.actionState?.supersededByJobId,
      supersedesJobId: payload.audit?.supersedesJobId ?? next.actionState?.supersedesJobId,
      finalizedAt: payload.audit?.finalizedAt ?? next.actionState?.finalizedAt,
      finalJobId: payload.data?.finalJobId ?? next.actionState?.finalJobId,
      lastActionEventId: event.eventId,
    };

    if (currentAction === 'approved') next.approvalStatus = 'approved';
    if (currentAction === 'needs_revision') next.approvalStatus = 'needs_revision';
    if (currentAction === 'rejected') next.approvalStatus = 'rejected';
    if (currentAction === 'superseded') next.approvalStatus = 'superseded';
  }

  return next;
};

const applyToJob = (current: JobApprovalProjection, event: ReviewEventEnvelope, shot: ShotReviewProjection): JobApprovalProjection => ({
  ...current,
  projectId: event.projectId,
  sceneId: event.sceneId,
  shotId: event.shotId,
  updatedAt: event.occurredAt,
  sourceEventId: event.eventId,
  approvalStatus: shot.approvalStatus,
  actionState: shot.actionState,
});

const sortEventsDeterministically = (events: ReviewEventEnvelope[]) =>
  [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt - b.occurredAt;
    const seqA = Number((a.payload as { sequence?: number } | undefined)?.sequence ?? 0);
    const seqB = Number((b.payload as { sequence?: number } | undefined)?.sequence ?? 0);
    if (seqA !== seqB) return seqA - seqB;
    return a.eventId.localeCompare(b.eventId);
  });

const dedupeEvents = (events: ReviewEventEnvelope[]) => {
  const seenEventId = new Set<string>();
  const seenIdempotency = new Set<string>();
  const out: ReviewEventEnvelope[] = [];
  for (const event of events) {
    if (seenEventId.has(event.eventId)) continue;
    if (seenIdempotency.has(event.idempotencyKey)) continue;
    seenEventId.add(event.eventId);
    seenIdempotency.add(event.idempotencyKey);
    out.push(event);
  }
  return out;
};

export const replayApprovalStateFromEvents = (events: ReviewEventEnvelope[]): ReducerState => {
  const state: ReducerState = {
    shots: new Map<string, ShotReviewProjection>(),
    jobs: new Map<string, JobApprovalProjection>(),
  };

  const ordered = sortEventsDeterministically(dedupeEvents(events));
  for (const event of ordered) {
    const shot = applyToShot(ensureShot(state, event), event);
    state.shots.set(event.shotId, shot);

    const job = applyToJob(ensureJob(state, event), event, shot);
    state.jobs.set(event.jobId, job);
  }

  return state;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
};

export const projectionChecksum = (state: ReducerState): string => {
  const snapshot = {
    shots: Array.from(state.shots.values()).sort((a, b) => a.shotId.localeCompare(b.shotId)),
    jobs: Array.from(state.jobs.values()).sort((a, b) => a.jobId.localeCompare(b.jobId)),
  };
  const json = stableStringify(snapshot);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32_${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
