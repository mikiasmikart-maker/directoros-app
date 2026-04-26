import type { RenderQueueJob } from './jobQueue';
import {
  clearQueuedJobs,
  pauseQueue,
  resumeQueue,
  retryFailedQueueJob,
} from './renderQueueController';
import { getRenderJob } from './jobQueue';
import { cancelRuntimeJob } from '../runtime/sync';

export const queueActions = {
  pauseQueue,
  resumeQueue,
  clearQueue: clearQueuedJobs,
  cancelJob: async (jobId: string) => {
    const job = getRenderJob(jobId);
    if (!job) return null;
    return cancelRuntimeJob(job);
  },
  retryFailedJob: (job: RenderQueueJob) => retryFailedQueueJob(job),
};
