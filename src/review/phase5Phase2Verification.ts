import { getProjectionChecksum, listJobApprovalProjections, replayFromZero, replayReviewEventsIntoProjection } from './projections';
import { getReviewRuntimeSnapshot, resetReviewRuntimeState, submitReviewAction, writeShotDecisionFromScorerForTest } from './runtime';
import type { ReviewActionCommand } from './types';

const baseCommand = (overrides: Partial<ReviewActionCommand> & Pick<ReviewActionCommand, 'actionType' | 'idempotencyKey'>): ReviewActionCommand => ({
  actionType: overrides.actionType,
  projectId: overrides.projectId ?? 'proj_directoros',
  sceneId: overrides.sceneId ?? 'scene_m5_p2',
  shotId: overrides.shotId ?? 'shot_m5_p2_01',
  jobId: overrides.jobId ?? 'job_m5_best_01',
  lineageRootJobId: overrides.lineageRootJobId ?? (overrides.jobId ?? 'job_m5_best_01'),
  queueId: overrides.queueId ?? 'queue_main_a',
  connectorId: overrides.connectorId ?? 'veo',
  idempotencyKey: overrides.idempotencyKey,
  actor: overrides.actor ?? { source: 'operator', approvedBy: 'qa.operator' },
  guard: overrides.guard ?? { authorityResult: 'granted', projectionVersion: 1 },
  data: overrides.data ?? {},
  occurredAt: overrides.occurredAt,
});

export const runPhase5Phase2Verification = () => {
  resetReviewRuntimeState();

  // Seed M4 decision baseline for two shots so action guards have deterministic best-known state.
  writeShotDecisionFromScorerForTest({
    sceneId: 'scene_m5_p2',
    shotId: 'shot_m5_p2_01',
    jobId: 'job_m5_best_01',
    lineageRootJobId: 'job_m5_best_01',
    mode: 'completed',
    engine: 'veo',
  });

  writeShotDecisionFromScorerForTest({
    sceneId: 'scene_m5_p2',
    shotId: 'shot_m5_p2_02',
    jobId: 'job_m5_best_02',
    lineageRootJobId: 'job_m5_best_02',
    mode: 'completed',
    engine: 'veo',
  });

  const t0 = Date.now();

  const approve = submitReviewAction(
    baseCommand({
      actionType: 'approve_best_known',
      idempotencyKey: 'm5:p2:approve:001',
      data: { selectedJobId: 'job_m5_best_01', approvalMode: 'final' },
      occurredAt: t0 + 1,
    })
  );

  const finalize = submitReviewAction(
    baseCommand({
      actionType: 'finalize_shot',
      idempotencyKey: 'm5:p2:finalize:001',
      data: { finalJobId: 'job_m5_best_01', releaseIntent: 'internal' },
    })
  );

  const supersede = submitReviewAction(
    baseCommand({
      actionType: 'supersede_with_job',
      idempotencyKey: 'm5:p2:supersede:001',
      shotId: 'shot_m5_p2_02',
      jobId: 'job_m5_best_02',
      lineageRootJobId: 'job_m5_best_02',
      data: {
        supersededJobId: 'job_m5_best_02',
        replacementJobId: 'job_m5_alt_02',
        reasonCode: 'CREATIVE_DIRECTION_CHANGE',
      },
    })
  );

  const invalidFinalizeBeforeApproval = submitReviewAction(
    baseCommand({
      actionType: 'finalize_shot',
      idempotencyKey: 'm5:p2:invalid-finalize:001',
      sceneId: 'scene_m5_p2_b',
      shotId: 'shot_m5_p2_02',
      jobId: 'job_m5_other_01',
      lineageRootJobId: 'job_m5_other_01',
      data: { finalJobId: 'job_m5_other_01' },
    })
  );

  const duplicateApprove = submitReviewAction(
    baseCommand({
      actionType: 'approve_best_known',
      idempotencyKey: 'm5:p2:approve:001',
      data: { selectedJobId: 'job_m5_best_01', approvalMode: 'final' },
    })
  );

  const liveSnapshot = getReviewRuntimeSnapshot();
  const liveProjectionShot1 = liveSnapshot.shotProjections.find((item) => item.shotId === 'shot_m5_p2_01');
  const liveProjectionShot2 = liveSnapshot.shotProjections.find((item) => item.shotId === 'shot_m5_p2_02');

  const liveChecksum = getProjectionChecksum();
  const liveJobProjectionCount = listJobApprovalProjections().length;

  replayReviewEventsIntoProjection(liveSnapshot.eventLog);

  const replayedSnapshot = getReviewRuntimeSnapshot();
  const replayChecksum = getProjectionChecksum();
  const replayFromZeroSnapshot = replayFromZero(liveSnapshot.eventLog);

  const replayProjectionShot1 = replayedSnapshot.shotProjections.find((item) => item.shotId === 'shot_m5_p2_01');
  const replayProjectionShot2 = replayedSnapshot.shotProjections.find((item) => item.shotId === 'shot_m5_p2_02');

  const replaySafe =
    liveProjectionShot1?.actionState?.current === replayProjectionShot1?.actionState?.current &&
    liveProjectionShot1?.actionState?.approvedBy === replayProjectionShot1?.actionState?.approvedBy &&
    liveProjectionShot1?.actionState?.approvedAt === replayProjectionShot1?.actionState?.approvedAt &&
    liveProjectionShot1?.actionState?.finalizedAt === replayProjectionShot1?.actionState?.finalizedAt &&
    liveProjectionShot2?.actionState?.current === replayProjectionShot2?.actionState?.current &&
    liveProjectionShot2?.actionState?.supersededJobId === replayProjectionShot2?.actionState?.supersededJobId;

  return {
    checks: {
      actionEventsAccepted: Boolean(approve.accepted && supersede.accepted && finalize.accepted),
      replaySafeActionState: Boolean(replaySafe),
      invalidFinalizeRejected: Boolean(invalidFinalizeBeforeApproval.rejected && invalidFinalizeBeforeApproval.reasonCode === 'INVALID_FINALIZE_BEFORE_APPROVAL'),
      duplicateDeduped: Boolean(duplicateApprove.duplicate),
      auditTrailPresent: Boolean(
        replayProjectionShot1?.actionState?.approvedBy &&
          replayProjectionShot1?.actionState?.approvedAt &&
          replayProjectionShot1?.actionState?.finalizedAt &&
          replayProjectionShot2?.actionState?.supersededJobId
      ),
      projectionChecksumStable: liveChecksum === replayChecksum && replayChecksum === replayFromZeroSnapshot.checksum,
      jobProjectionMaterialized: liveJobProjectionCount > 0,
    },
    events: {
      total: liveSnapshot.eventLog.length,
      actionEvents: liveSnapshot.eventLog.filter((event) => event.eventType.startsWith('review.action.')).length,
    },
    outcomes: {
      approve,
      supersede,
      finalize,
      invalidFinalizeBeforeApproval,
      duplicateApprove,
    },
    liveProjection: {
      shot1: liveProjectionShot1,
      shot2: liveProjectionShot2,
    },
    replayProjection: {
      shot1: replayProjectionShot1,
      shot2: replayProjectionShot2,
    },
  };
};
