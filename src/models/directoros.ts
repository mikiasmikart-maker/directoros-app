import type { PrimitiveValue, SceneLocalOverrides, SceneMemoryBindings } from '../types/memory';
import type { EnginePayloadBranch, EngineRouteState } from '../types/engine';
import type { GraphCompileSummary, SceneGraphConnection, SceneGraphLayout, SceneGraphNode } from '../types/graph';

export type ID = string;
export type EngineTarget = 'auto' | 'flux' | 'veo' | 'runway' | 'comfyui';

export type InspectorFieldType = 'text' | 'number' | 'select' | 'textarea' | 'toggle' | 'range';

export interface SceneNode {
  id: ID;
  name: string;
  type: 'scene' | 'shot' | 'character' | 'camera' | 'lighting' | 'audio';
  parentId?: ID;
  children?: ID[];
  prompt: string;
  params: Record<string, PrimitiveValue>;
  memoryBindings?: SceneMemoryBindings;
  localOverrides?: SceneLocalOverrides;
  graph?: {
    nodes: SceneGraphNode[];
    connections: SceneGraphConnection[];
    layout: SceneGraphLayout;
  };
}

export interface TimelineClip {
  id: ID;
  sceneId: ID;
  start: number;
  duration: number;
  startMs?: number;
  durationMs?: number;
  label: string;
  track: number;
  emphasis?: 'calm' | 'balanced' | 'intense';
  overrideNote?: string;
  motionBehavior?: string;
  overrideParams?: Record<string, PrimitiveValue>;
  parentJobId?: string;
}

export interface TimelineState {
  currentFrame: number;
  fps: number;
  duration: number;
  clips: TimelineClip[];
  isPlaying: boolean;
  playheadPositionMs: number;
  sessionStartMs: number;
  sessionEndMs: number;
}

export interface InspectorField {
  key: string;
  label: string;
  type: InspectorFieldType;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  helperText?: string;
  group?: 'shot' | 'camera' | 'motion' | 'style';
}

export interface RenderJob {
  id: ID;
  sceneId: ID;
  status: 'idle' | 'queued' | 'compiling' | 'rendering' | 'complete' | 'error';
  progress: number;
  outputPath?: string;
  error?: string;
}

export interface AppState {
  activePanel: 'scene' | 'timeline' | 'inspector';
  selectedSceneId?: ID;
  selectedClipId?: ID;
  selectedGraphNodeId?: ID;
  engineTarget: EngineTarget;
  isDarkMode: true;
}

export interface CompiledPromptPayload {
  sceneId: ID;
  sceneName: string;
  engineTarget: EngineTarget;
  compiledPrompt: string;
  payload: {
    scene: {
      basePrompt: string;
      summary?: string;
    };
    parameters: Record<string, PrimitiveValue>;
    sources: Record<string, 'scene' | 'memory' | 'manual' | 'mixed' | 'timeline'>;
    memoryProfileIds: string[];
    timeline: {
      clipId?: string;
      shotId?: string;
      start: number;
      duration: number;
      emphasis?: string;
      overrideNote?: string;
      motionBehavior?: string;
    };
    shotContext: {
      shotId?: string;
      sceneId: string;
      takeId: string;
      version: number;
    };
    engineHints: string[];
    graph?: GraphCompileSummary;
    route: EngineRouteState;
    routeContext: {
      activeRoute: string;
      targetEngine: Exclude<EngineTarget, 'auto'>;
      activeTargets: Array<Exclude<EngineTarget, 'auto'>>;
      strategy: string;
    };
    routeBranches: EnginePayloadBranch[];
  };
}

export type QuickActionIntent = 'primary' | 'secondary' | 'utility' | 'danger';
export type QuickActionTone = 'brand' | 'neutral' | 'danger' | 'success' | 'accent' | 'none';

export type CurrentFocusItem = {
  label: 'Scene' | 'Family' | 'Job' | 'Output';
  value: string;
  active?: boolean;
};

export interface QuickActionItem {
  key: string;
  label: string;
  intent: QuickActionIntent;
  disabled: boolean;
  disabledReason?: string;
  tone?: QuickActionTone;
  onTrigger: () => void | Promise<void>;
}

export interface QuickActionModel {
  primary?: QuickActionItem;
  secondary: QuickActionItem[];
  terminalState: 'completed' | 'failed' | 'cancelled' | 'active' | 'other';
}

export interface SelectedFeedbackSummary {
  status: string; // Keep broad for now to include non-job statuses
  reason: string;
  nextStep: string;
  authorityLabel: string;
  focusLabel: string;
}
