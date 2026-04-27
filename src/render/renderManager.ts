import type { RenderPreviewFormat } from '../bridge/renderBridge';
import { submitRuntimeRender, retryRuntimeRender } from '../runtime/sync';
import { compilePromptPayload } from '../utils/promptCompiler';
import type { CompiledPromptPayload, EngineTarget, SceneNode, TimelineClip } from '../models/directoros';
import type { MemoryProfile, PrimitiveValue } from '../types/memory';
import type { SceneGraphState } from '../types/graph';
import type { RenderQueueJob } from './jobQueue';

interface CompileInput {
  scene?: SceneNode;
  clips: TimelineClip[];
  selectedClipId?: string;
  memoryProfilesById: Record<string, MemoryProfile>;
  inspectorOverrides?: Record<string, PrimitiveValue>;
  engineTarget: EngineTarget;
  graphState?: SceneGraphState;
}

export interface RenderPreviewState {
  mode: 'idle' | 'queued' | 'preflight' | 'rendering' | 'packaging' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  label?: string;
  canonicalState?: string;
  resultPaths?: string[];
  previewImage?: string;
  previewMedia?: string;
  previewType?: 'image' | 'video';
  previewFormat?: RenderPreviewFormat;
}

export interface RenderManagerCallbacks {
  onQueueUpdate?: (job: RenderQueueJob) => void;
  onPreviewUpdate?: (state: RenderPreviewState) => void;
}

export const runRenderPipeline = async (
  compileInput: CompileInput,
  callbacks: RenderManagerCallbacks = {}
): Promise<{ jobId: string; compiledPayload: CompiledPromptPayload } | null> => {
  const compiledPayload = compilePromptPayload(compileInput);
  if (!compiledPayload) return null;

  return submitRuntimeRender(compiledPayload, callbacks);
};

export const runRenderPipelineFromBridgeJob = async (
  sourceJob: Pick<RenderQueueJob, 'id' | 'retryDepth' | 'bridgeJob' | 'state'>,
  callbacks: RenderManagerCallbacks = {}
): Promise<{ jobId: string } | null> => {
  const result = await retryRuntimeRender(sourceJob, callbacks);
  if (!result?.jobId) {
    callbacks.onPreviewUpdate?.({ mode: 'failed', progress: 0, label: 'Retry rejected: only failed jobs can be retried.' });
    return null;
  }
  return { jobId: result.jobId };
};
