import type { RenderBridgeJob } from '../bridge/renderBridge';

interface SimJob {
  startedAt: number;
  durationMs: number;
  fail: boolean;
  cancelled?: boolean;
}

const jobs = new Map<string, SimJob>();

export const submitJob = async (job: RenderBridgeJob): Promise<{ externalJobId: string }> => {
  void job;
  const externalJobId = `flux-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  jobs.set(externalJobId, { startedAt: Date.now(), durationMs: 3200, fail: false });
  return { externalJobId };
};

export const getStatus = async (
  externalJobId: string
): Promise<{ status: 'queued' | 'rendering' | 'completed' | 'failed'; progress: number }> => {
  const job = jobs.get(externalJobId);
  if (!job) return { status: 'failed', progress: 0 };

  const elapsed = Date.now() - job.startedAt;
  const progress = Math.max(5, Math.min(100, Math.round((elapsed / job.durationMs) * 100)));
  if (job.fail) return { status: 'failed', progress };
  if (progress >= 100) return { status: 'completed', progress: 100 };
  return { status: progress < 20 ? 'queued' : 'rendering', progress };
};

export const fetchResult = async (externalJobId: string): Promise<{ outputs: string[] }> => ({
  outputs: [`renders/${externalJobId}/frame_0001.png`],
});

export const cancelJob = async (externalJobId: string): Promise<{ cancelled: boolean; message?: string }> => {
  const existed = jobs.delete(externalJobId);
  return {
    cancelled: existed,
    message: existed ? 'Flux connector cancelled remote simulation.' : 'Flux connector did not find remote job during cancel.',
  };
};
