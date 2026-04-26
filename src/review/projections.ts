import type { ReviewEventEnvelope, ShotReviewProjection } from './types';
import { projectionChecksum, type JobApprovalProjection } from './reducers';

const shotProjectionByShotId = new Map<string, ShotReviewProjection>();
const jobProjectionByJobId = new Map<string, JobApprovalProjection>();
const appliedEvents: ReviewEventEnvelope[] = [];

/*
const rebuildFrom = (events: ReviewEventEnvelope[]) => {
  const rebuilt = replayApprovalStateFromEvents(events);
  shotProjectionByShotId.clear();
  jobProjectionByJobId.clear();
  rebuilt.shots.forEach((value, key) => shotProjectionByShotId.set(key, value));
  rebuilt.jobs.forEach((value, key) => jobProjectionByJobId.set(key, value));
};
*/

export const applyReviewEventToProjection = (event: ReviewEventEnvelope) => {
  appliedEvents.push(event);
  if (appliedEvents.length > 1000) {
    appliedEvents.shift();
  }
  // rebuildFrom(appliedEvents); // Temporary isolation test: disabled projection rebuild
};

export const replayReviewEventsIntoProjection = (events: ReviewEventEnvelope[]) => {
  appliedEvents.length = 0;
  appliedEvents.push(...events);
  // rebuildFrom(appliedEvents); // Temporary isolation test: disabled projection rebuild
};

export const replayFromZero = (events: ReviewEventEnvelope[]) => {
  replayReviewEventsIntoProjection(events);
  return {
    shotProjections: listShotReviewProjections(),
    jobProjections: listJobApprovalProjections(),
    checksum: getProjectionChecksum(),
  };
};

export const listShotReviewProjections = () => Array.from(shotProjectionByShotId.values());
export const listJobApprovalProjections = () => Array.from(jobProjectionByJobId.values());

export const getProjectionChecksum = (): string =>
  projectionChecksum({ shots: new Map(shotProjectionByShotId), jobs: new Map(jobProjectionByJobId) });
