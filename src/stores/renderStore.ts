import type { RenderJob, SceneNode } from '../models/directoros';

export const createRenderJob = (scene?: SceneNode): RenderJob => ({
  id: `render-${Date.now()}`,
  sceneId: scene?.id ?? 'unknown',
  status: scene ? 'queued' : 'error',
  progress: 0,
  error: scene ? undefined : 'No scene selected',
});

export const nextRenderState = (job: RenderJob): RenderJob => {
  if (job.status === 'error' || job.status === 'complete') return job;

  if (job.progress >= 100) {
    return { ...job, status: 'complete', progress: 100, outputPath: `renders/${job.sceneId}.mp4` };
  }

  const status = job.progress < 20 ? 'compiling' : 'rendering';
  return { ...job, status, progress: Math.min(job.progress + 20, 100) };
};


