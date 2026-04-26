import type { CompiledPromptPayload, EngineTarget } from '../models/directoros';

export type RenderEngineTarget = EngineTarget | 'comfyui';
export type RenderOutputType = 'image' | 'image_sequence' | 'video';
export type RenderPreviewFormat = 'single_frame' | 'sequence' | 'video';

export interface RenderBridgePayload {
  prompt: string;
  parameters: CompiledPromptPayload['payload']['parameters'];
  timeline: CompiledPromptPayload['payload']['timeline'];
  shotContext: CompiledPromptPayload['payload']['shotContext'];
  engineHints: string[];
  sceneName: string;
  routeContext: CompiledPromptPayload['payload']['routeContext'];
  lineageParentJobId?: string;
}

export interface RenderBridgeJob {
  id: string;
  sceneId: string;
  engine: Exclude<RenderEngineTarget, 'auto'>;
  jobType: 'text_to_image' | 'text_to_video' | 'workflow';
  outputType: RenderOutputType;
  previewFormat: RenderPreviewFormat;
  seed: number;
  payload: RenderBridgePayload;
  createdAt: number;
}

interface BridgeMap {
  jobType: RenderBridgeJob['jobType'];
  outputType: RenderOutputType;
  previewFormat: RenderPreviewFormat;
}

const BRIDGE_MAP: Record<Exclude<RenderEngineTarget, 'auto'>, BridgeMap> = {
  flux: { jobType: 'text_to_image', outputType: 'image', previewFormat: 'single_frame' },
  veo: { jobType: 'text_to_video', outputType: 'video', previewFormat: 'video' },
  runway: { jobType: 'text_to_video', outputType: 'video', previewFormat: 'video' },
  comfyui: { jobType: 'workflow', outputType: 'image_sequence', previewFormat: 'sequence' },
};

const resolveEngine = (compiled: CompiledPromptPayload): Exclude<RenderEngineTarget, 'auto'> => {
  if (compiled.engineTarget !== 'auto') return compiled.engineTarget;
  return compiled.payload.routeContext.targetEngine;
};

export const createRenderBridgeJob = (compiled: CompiledPromptPayload): RenderBridgeJob => {
  const engine = resolveEngine(compiled);
  const map = BRIDGE_MAP[engine];

  return {
    id: `rb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    sceneId: compiled.sceneId,
    engine,
    jobType: map.jobType,
    outputType: map.outputType,
    previewFormat: map.previewFormat,
    seed: Math.floor(Math.random() * 1_000_000),
    payload: {
      prompt: compiled.compiledPrompt,
      parameters: compiled.payload.parameters,
      timeline: compiled.payload.timeline,
      shotContext: compiled.payload.shotContext,
      engineHints: compiled.payload.engineHints,
      sceneName: compiled.sceneName,
      routeContext: compiled.payload.routeContext,
    },
    createdAt: Date.now(),
  };
};
