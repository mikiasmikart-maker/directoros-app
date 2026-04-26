import { registerLineage } from './lineage';
import { replayReviewEventsIntoProjection } from './projections';
import { getReviewRuntimeSnapshot, persistReviewEventForTest, resetReviewRuntimeState, writeShotDecisionFromScorerForTest } from './runtime';
import type { ReviewEventEnvelope, ReviewMeasuredSignals } from './types';

const baseEnvelope = (overrides: Partial<ReviewEventEnvelope> & Pick<ReviewEventEnvelope, 'eventType' | 'jobId' | 'shotId' | 'sceneId' | 'lineageRootJobId' | 'payload' | 'idempotencyKey'>): ReviewEventEnvelope => ({
  eventId: `evt_${Math.random().toString(16).slice(2, 10)}`,
  eventType: overrides.eventType,
  occurredAt: Date.now(),
  projectId: 'proj_directoros',
  sceneId: overrides.sceneId,
  shotId: overrides.shotId,
  jobId: overrides.jobId,
  lineageRootJobId: overrides.lineageRootJobId,
  queueId: 'queue_main_a',
  connectorId: 'veo',
  payload: overrides.payload,
  idempotencyKey: overrides.idempotencyKey,
});

export const runPhase3Verification = () => {
  resetReviewRuntimeState();

  registerLineage('job_root_1');
  registerLineage('job_retry_1', 'job_root_1');

  const measuredSignalsRoot: ReviewMeasuredSignals = {
    technicalQuality: 0.88,
    promptStyleAdherence: 0.8,
    continuityMatch: 0.79,
    motionStability: 0.75,
    operatorConfidence: 0.71,
    artifactSeverity: 0.22,
  };

  const measuredSignalsRetry: ReviewMeasuredSignals = {
    technicalQuality: 0.81,
    promptStyleAdherence: 0.76,
    continuityMatch: 0.74,
    motionStability: 0.69,
    operatorConfidence: 0.68,
    artifactSeverity: 0.35,
  };

  persistReviewEventForTest(
    baseEnvelope({
      eventType: 'review.signal.updated',
      sceneId: 'scene_p3',
      shotId: 'shot_p3_01',
      jobId: 'job_root_1',
      lineageRootJobId: 'job_root_1',
      payload: { measuredSignals: measuredSignalsRoot },
      idempotencyKey: 'p3:signal:job_root_1',
    })
  );

  persistReviewEventForTest(
    baseEnvelope({
      eventType: 'review.signal.updated',
      sceneId: 'scene_p3',
      shotId: 'shot_p3_01',
      jobId: 'job_retry_1',
      lineageRootJobId: 'job_root_1',
      payload: { measuredSignals: measuredSignalsRetry },
      idempotencyKey: 'p3:signal:job_retry_1',
    })
  );

  writeShotDecisionFromScorerForTest({
    sceneId: 'scene_p3',
    shotId: 'shot_p3_01',
    jobId: 'job_retry_1',
    lineageRootJobId: 'job_root_1',
    mode: 'failed',
  });

  const snapBeforeReplay = getReviewRuntimeSnapshot();
  const liveProjection = snapBeforeReplay.shotProjections.find((item) => item.shotId === 'shot_p3_01');

  const eventLog = snapBeforeReplay.eventLog;
  const replayEventCount = eventLog.length;

  // replay-safe rebuild check
  replayReviewEventsIntoProjection(eventLog);
  const snapAfterReplay = getReviewRuntimeSnapshot();
  const replayProjection = snapAfterReplay.shotProjections.find((item) => item.shotId === 'shot_p3_01');

  const completenessPass = Boolean(
    liveProjection?.bestKnownOutputSelection?.selectedJobId &&
      typeof liveProjection?.retryRecommendation?.recommend === 'boolean' &&
      liveProjection?.reviewStatus &&
      liveProjection?.approvalStatus
  );

  const bestKnownPersistPass = liveProjection?.bestKnownOutputSelection?.selectedJobId === 'job_root_1';
  const retryLineageSafePass = liveProjection?.retryRecommendation?.reasonCode === 'CONNECTOR_FAILURE_LINEAGE_SAFE';
  const replaySafeStatusPass =
    liveProjection?.reviewStatus === replayProjection?.reviewStatus &&
    liveProjection?.approvalStatus === replayProjection?.approvalStatus;

  return {
    gates: {
      shotReviewWriteCompleteness: completenessPass,
      bestKnownPersisted: bestKnownPersistPass,
      retryLineageSafe: retryLineageSafePass,
      replaySafeStatusWrites: replaySafeStatusPass,
    },
    eventLogCount: replayEventCount,
    liveProjection,
    replayProjection,
  };
};
