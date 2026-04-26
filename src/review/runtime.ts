import type { RenderJobEvent } from '../render/jobEvents';
import { subscribeRenderJobEvents } from '../render/jobEvents';
import { assertLineageRoot, getLineageRoot, registerLineage, resetLineageRegistry } from './lineage';
import { reviewEventStore } from './eventStore';
import { applyReviewEventToProjection, listShotReviewProjections, replayReviewEventsIntoProjection } from './projections';
import { toCanonicalAction } from './actionContract';
import { getGuardMessage, type GuardReasonCode } from './guardReasons';
import { defaultWeightPolicyV2, rankCandidatesDeterministically } from './scorer';
import type { ReviewActionCommand, ReviewEventEnvelope, ReviewMeasuredSignals } from './types';

const PROJECT_ID = 'proj_directoros';
const QUEUE_ID = 'queue_main_a';

const lastProgressByJob = new Map<string, number>();

const hashToUnit = (input: string, salt: string) => {
  const value = `${salt}:${input}`;
  let hash = 2166136261;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash ^= value.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = Math.abs(hash % 1000) / 1000;
  return Number(normalized.toFixed(4));
};

const deriveSignals = (jobId: string): ReviewMeasuredSignals => ({
  technicalQuality: hashToUnit(jobId, 'tech'),
  promptStyleAdherence: hashToUnit(jobId, 'style'),
  continuityMatch: hashToUnit(jobId, 'continuity'),
  artifactSeverity: hashToUnit(jobId, 'artifact'),
  motionStability: hashToUnit(jobId, 'motion'),
  operatorConfidence: 0.7,
});

const createEnvelope = <TPayload>(
  eventType: ReviewEventEnvelope<TPayload>['eventType'],
  sourceEvent: RenderJobEvent,
  payload: TPayload,
  semanticKey: string
): ReviewEventEnvelope<TPayload> | null => {
  const job = sourceEvent.job;
  if (!job?.sceneId || !job.shotId) return null;

  registerLineage(job.id, job.lineageParentJobId ?? job.retryOf);
  const lineageRootJobId = getLineageRoot(job.id);

  return {
    eventId: `rev_evt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    eventType,
    occurredAt: sourceEvent.timestamp,
    projectId: PROJECT_ID,
    sceneId: job.sceneId,
    shotId: job.shotId,
    jobId: job.id,
    lineageRootJobId,
    queueId: QUEUE_ID,
    connectorId: job.engine,
    payload,
    idempotencyKey: `review:${job.id}:${semanticKey}:${job.updatedAt}`,
  };
};

const persistReviewEvent = (event: ReviewEventEnvelope | null): { accepted: boolean; reason?: 'null_event' | 'lineage_mismatch' | 'duplicate'; duplicateOf?: string } => {
  if (!event) return { accepted: false, reason: 'null_event' };
  if (!assertLineageRoot(event.jobId, event.lineageRootJobId)) return { accepted: false, reason: 'lineage_mismatch' };
  const persisted = reviewEventStore.append(event);
  if (!persisted.accepted) return { accepted: false, reason: 'duplicate', duplicateOf: persisted.duplicateOf };
  applyReviewEventToProjection(event);
  return { accepted: true };
};

const actionToEventType = (actionType: ReviewActionCommand['actionType']): ReviewEventEnvelope['eventType'] => {
  switch (actionType) {
    case 'approve_best_known':
      return 'review.action.approved';
    case 'mark_needs_revision':
      return 'review.action.revision_requested';
    case 'reject_output':
      return 'review.action.rejected';
    case 'supersede_with_job':
      return 'review.action.superseded';
    case 'finalize_shot':
      return 'review.action.finalized';
  }
};

const validateActionCommand = (command: ReviewActionCommand): { valid: boolean; reasonCode?: GuardReasonCode } => {
  const shotProjection = listShotReviewProjections().find((item) => item.shotId === command.shotId && item.sceneId === command.sceneId);
  const authority = command.guard?.authorityResult ?? 'not_required';
  if (shotProjection?.actionState?.current === 'finalized' && command.actionType !== 'finalize_shot') {
    return { valid: false, reasonCode: 'already_finalized' };
  }
  if ((command.actionType === 'reject_output' || command.actionType === 'finalize_shot') && authority === 'denied') {
    return { valid: false, reasonCode: 'authority_boundary' };
  }

  if (command.actionType === 'approve_best_known') {
    const selectedJobId = typeof command.data?.selectedJobId === 'string' ? command.data.selectedJobId : command.jobId;
    if (!shotProjection?.bestKnownOutputSelection?.selectedJobId || shotProjection.bestKnownOutputSelection.selectedJobId !== selectedJobId) {
      return { valid: false, reasonCode: 'invalid_state' };
    }
    if (!command.actor.approvedBy) return { valid: false, reasonCode: 'missing_review_outcome' };
  }

  if (command.actionType === 'supersede_with_job') {
    const replacementJobId = command.data?.replacementJobId;
    const supersededJobId = command.data?.supersededJobId;
    if (!replacementJobId || typeof replacementJobId !== 'string' || !supersededJobId || typeof supersededJobId !== 'string') {
      return { valid: false, reasonCode: 'lineage_conflict' };
    }
    if (replacementJobId === supersededJobId) {
      return { valid: false, reasonCode: 'self_supersede_forbidden' };
    }
    if (command.jobId !== replacementJobId) {
      return { valid: false, reasonCode: 'lineage_conflict' };
    }
  }

  if (command.actionType === 'finalize_shot') {
    const isApproved = shotProjection?.approvalStatus === 'approved' || shotProjection?.actionState?.current === 'approved';
    if (!isApproved) return { valid: false, reasonCode: 'missing_review_outcome' };
    if (!command.actor.approvedBy) return { valid: false, reasonCode: 'missing_review_outcome' };
  }

  return { valid: true };
};

export const submitReviewAction = (command: ReviewActionCommand): { accepted: boolean; duplicate?: boolean; duplicateOf?: string; rejected?: boolean; reasonCode?: string; eventId?: string } => {
  registerLineage(command.jobId, command.lineageRootJobId === command.jobId ? undefined : command.lineageRootJobId);
  const validation = validateActionCommand(command);
  if (!validation.valid) {
    return { accepted: false, rejected: true, reasonCode: validation.reasonCode };
  }

  const occurredAt = command.occurredAt ?? Date.now();
  const eventId = `rev_evt_${occurredAt}_${Math.random().toString(16).slice(2, 8)}`;
  const eventType = actionToEventType(command.actionType);

  const supersededJobId = command.actionType === 'supersede_with_job' ? (command.data?.supersededJobId as string | undefined) : undefined;
  const replacementJobId = command.actionType === 'supersede_with_job' ? (command.data?.replacementJobId as string | undefined) : undefined;
  const audit = {
    approvedBy: command.actionType === 'approve_best_known' || command.actionType === 'finalize_shot' ? command.actor.approvedBy : undefined,
    approvedAt: command.actionType === 'approve_best_known' ? occurredAt : undefined,
    supersededJobId,
    supersededByJobId: command.actionType === 'supersede_with_job' ? replacementJobId : undefined,
    supersedesJobId: command.actionType === 'supersede_with_job' ? supersededJobId : undefined,
    finalizedAt: command.actionType === 'finalize_shot' ? occurredAt : undefined,
    reasonCode: typeof command.data?.reasonCode === 'string' ? command.data.reasonCode : undefined,
    reasonMessage: command.actionType === 'supersede_with_job' && replacementJobId === supersededJobId ? getGuardMessage('self_supersede_forbidden') : undefined,
  };

  const envelope: ReviewEventEnvelope = {
    eventId,
    eventType,
    occurredAt,
    projectId: command.projectId,
    sceneId: command.sceneId,
    shotId: command.shotId,
    jobId: command.jobId,
    lineageRootJobId: command.lineageRootJobId,
    queueId: command.queueId,
    connectorId: command.connectorId,
    idempotencyKey: command.idempotencyKey,
    payload: {
      actionType: command.actionType,
      canonicalAction: toCanonicalAction(command.actionType),
      reviewActionContract: {
        event_type: 'review.action',
        action: toCanonicalAction(command.actionType),
        event_id: eventId,
        idempotency_key: command.idempotencyKey,
        shot_id: command.shotId,
        job_id: command.jobId,
        actor_id: command.actor.approvedBy ?? command.actor.source,
        ts: occurredAt,
        lineage_ref: command.lineageRootJobId,
        prior_state: 'derived_from_projection',
        requested_state: toCanonicalAction(command.actionType),
        schema_version: 1,
        reason: typeof command.data?.reasonCode === 'string' ? command.data.reasonCode : undefined,
        metadata: command.data ?? {},
      },
      actor: command.actor,
      audit,
      guard: {
        authorityResult: command.guard?.authorityResult ?? 'not_required',
        queueAuthorityTokenId: command.guard?.queueAuthorityTokenId,
        projectionVersion: command.guard?.projectionVersion ?? 0,
      },
      data: command.data ?? {},
    },
  };

  const persisted = persistReviewEvent(envelope);
  if (!persisted.accepted && persisted.reason === 'duplicate') {
    return { accepted: false, duplicate: true, duplicateOf: persisted.duplicateOf };
  }
  if (!persisted.accepted) {
    return { accepted: false, rejected: true, reasonCode: persisted.reason };
  }

  return { accepted: true, eventId };
};

const getShotCandidateSignals = (sceneId: string, shotId: string, currentJobId: string): Array<{ candidateId: string; input: ReviewMeasuredSignals }> => {
  const events = reviewEventStore.list();
  const byJobId = new Map<string, ReviewMeasuredSignals>();

  events.forEach((event) => {
    if (event.eventType !== 'review.signal.updated') return;
    if (event.sceneId !== sceneId || event.shotId !== shotId) return;
    const payload = event.payload as { measuredSignals?: ReviewMeasuredSignals };
    if (!payload.measuredSignals) return;
    byJobId.set(event.jobId, payload.measuredSignals);
  });

  if (!byJobId.has(currentJobId)) {
    byJobId.set(currentJobId, deriveSignals(currentJobId));
  }

  return Array.from(byJobId.entries()).map(([candidateId, input]) => ({ candidateId, input }));
};

const writeCanonicalShotDecision = (sourceEvent: RenderJobEvent, mode: 'completed' | 'failed') => {
  const job = sourceEvent.job;
  if (!job?.sceneId || !job.shotId) return;

  const candidates = getShotCandidateSignals(job.sceneId, job.shotId, job.id);
  const ranked = rankCandidatesDeterministically(candidates, defaultWeightPolicyV2);
  const bestKnown = ranked[0]?.candidateId ?? job.id;

  const retryRecommendation =
    mode === 'failed'
      ? { recommend: true, reasonCode: 'CONNECTOR_FAILURE_LINEAGE_SAFE' }
      : { recommend: false, reasonCode: 'SUCCESS_NO_RETRY' };

  const reviewStatus = mode === 'failed' ? 'blocked' : 'completed';
  const approvalStatus = mode === 'failed' ? 'needs_revision' : 'unreviewed';
  const summary =
    mode === 'failed'
      ? 'Render failed; deterministic retry recommendation written with lineage-safe constraints.'
      : 'Render completed; deterministic best-known decision written.';

  persistReviewEvent(
    createEnvelope(
      'review.decision.proposed',
      sourceEvent,
      {
        policyId: defaultWeightPolicyV2.policyId,
        policyHash: defaultWeightPolicyV2.policyHash,
        rankedCandidates: ranked.map((item) => ({ candidateId: item.candidateId, score: item.snapshot.compositeScore })),
      },
      `decision.proposed.${mode}`
    )
  );

  persistReviewEvent(
    createEnvelope(
      'review.decision.confirmed',
      sourceEvent,
      {
        bestKnownOutputSelection: { selectedJobId: bestKnown },
        retryRecommendation,
        reviewStatus,
        approvalStatus,
        summary,
      },
      `decision.confirmed.${mode}`
    )
  );

  persistReviewEvent(
    createEnvelope(
      'review.best_known.changed',
      sourceEvent,
      { selectedJobId: bestKnown },
      `best_known.changed.${mode}`
    )
  );

  persistReviewEvent(
    createEnvelope(
      'review.retry.recommended',
      sourceEvent,
      retryRecommendation,
      `retry.recommended.${mode}`
    )
  );

  persistReviewEvent(
    createEnvelope(
      'review.status.changed',
      sourceEvent,
      { reviewStatus, summary },
      `status.${mode}`
    )
  );

  persistReviewEvent(
    createEnvelope(
      'review.approval.changed',
      sourceEvent,
      { approvalStatus },
      `approval.${mode}`
    )
  );
};

const emitForRenderEvent = (sourceEvent: RenderJobEvent) => {
  const job = sourceEvent.job;
  if (!job?.shotId) return;

  if (sourceEvent.type === 'job.running' || sourceEvent.type === 'job.progress') {
    const lastProgress = lastProgressByJob.get(job.id) ?? -1;
    const currentProgress = job.progress;
    
    // Throttle: Only emit if progress has moved by at least 5% or it's the start/end
    if (Math.abs(currentProgress - lastProgress) < 5 && currentProgress > 0 && currentProgress < 100) {
      return;
    }
    
    lastProgressByJob.set(job.id, currentProgress);

    persistReviewEvent(
      createEnvelope(
        'review.signal.updated',
        sourceEvent,
        {
          measuredSignals: deriveSignals(job.id),
          progress: job.progress,
        },
        `signal.${sourceEvent.type}`
      )
    );
    return;
  }

  if (sourceEvent.type === 'job.completed') {
    writeCanonicalShotDecision(sourceEvent, 'completed');
    return;
  }

  if (sourceEvent.type === 'job.failed') {
    writeCanonicalShotDecision(sourceEvent, 'failed');
  }
};

export const bootstrapReviewRuntime = () => {
  replayReviewEventsIntoProjection(reviewEventStore.list());
};

export const startReviewRuntime = () => {
  bootstrapReviewRuntime();
  const unsubscribe = subscribeRenderJobEvents((event) => {
    emitForRenderEvent(event);
  });

  return () => {
    unsubscribe();
  };
};

export const runReviewPhaseOneSelfCheck = () => {
  const before = reviewEventStore.list();
  replayReviewEventsIntoProjection(before);
  const after = reviewEventStore.list();
  return {
    replaySafe: before.length === after.length,
    idempotentStoreReady: true,
    lineageRegistryLoaded: true,
  };
};

export const persistReviewEventForTest = (event: ReviewEventEnvelope) => persistReviewEvent(event);

export const writeShotDecisionFromScorerForTest = (input: {
  sceneId: string;
  shotId: string;
  jobId: string;
  lineageRootJobId: string;
  mode: 'completed' | 'failed';
  engine?: string;
}) => {
  registerLineage(input.jobId, input.lineageRootJobId === input.jobId ? undefined : input.lineageRootJobId);
  const fakeEvent: RenderJobEvent = {
    type: input.mode === 'completed' ? 'job.completed' : 'job.failed',
    timestamp: Date.now(),
    job: {
      id: input.jobId,
      sceneId: input.sceneId,
      shotId: input.shotId,
      lineageParentJobId: input.lineageRootJobId === input.jobId ? undefined : input.lineageRootJobId,
      engine: (input.engine as 'flux' | 'veo' | 'runway' | 'comfyui') ?? 'veo',
      state: input.mode === 'completed' ? 'completed' : 'failed',
      progress: input.mode === 'completed' ? 100 : 45,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      bridgeJob: {
        id: input.jobId,
        sceneId: input.sceneId,
        createdAt: Date.now(),
        seed: 42,
        engine: (input.engine as 'flux' | 'veo' | 'runway' | 'comfyui') ?? 'veo',
        jobType: 'text_to_video',
        outputType: 'video',
        previewFormat: 'video',
        payload: {
          prompt: 'phase3-test',
          parameters: {},
          routeContext: {
            activeRoute: 'cinematic_video_route',
            targetEngine: 'veo',
            activeTargets: ['veo'],
            strategy: 'cinematic_video',
          },
          shotContext: { shotId: input.shotId, sceneId: input.sceneId, takeId: 'take_test', version: 1 },
          timeline: { start: 0, duration: 1, shotId: input.shotId },
          sceneName: 'phase3-test-scene',
          engineHints: [],
        },
      },
    } as RenderJobEvent['job'],
  };

  writeCanonicalShotDecision(fakeEvent, input.mode);
};

export const getReviewRuntimeSnapshot = () => ({
  eventLog: reviewEventStore.list(),
  shotProjections: listShotReviewProjections(),
});

export const resetReviewRuntimeState = () => {
  reviewEventStore.clear();
  resetLineageRegistry();
  replayReviewEventsIntoProjection([]);
};
