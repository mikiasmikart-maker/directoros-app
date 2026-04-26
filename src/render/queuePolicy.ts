export interface QueuePolicy {
  maxConcurrentJobs: number;
  maxQueueLength: number;
  duplicateShotGuard: boolean;
  gpuLockProtection: boolean;
}

export const defaultQueuePolicy: QueuePolicy = {
  maxConcurrentJobs: 2,
  maxQueueLength: 25,
  duplicateShotGuard: true,
  gpuLockProtection: false,
};
