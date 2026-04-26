import type { EngineTarget } from '../models/directoros';
import type { EngineRouteMode, EngineRouteState, EngineOutputStrategy } from './engine';
import type { MemoryCategory, MemorySourceType, PrimitiveValue } from './memory';

export type GraphNodeType =
  | 'character'
  | 'product'
  | 'environment'
  | 'lighting'
  | 'camera'
  | 'shot'
  | 'compiler'
  | 'engine_router'
  | 'engine_target'
  | 'render_output'
  | 'review_node'
  | 'edit_node'
  | 'export_node'
  | 'delivery_node';

export type CompileState = 'compiled' | 'stale' | 'pending';
export type RenderState = 'ready' | 'queued' | 'rendering' | 'completed' | 'failed';
export type PostPipelineStage = 'review' | 'edit' | 'export' | 'delivery';
export type PostPipelineStatus = 'pending' | 'waiting' | 'active' | 'approved' | 'ready' | 'completed' | 'blocked' | 'failed';
export type PipelineActivityState = 'idle' | 'waiting' | 'active' | 'processing' | 'completed' | 'failed' | 'blocked';
export type ShotRuntimeState =
  | 'waiting'
  | 'active'
  | 'compiling'
  | 'routed'
  | 'rendering'
  | 'review'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'skipped';

export interface PostPipelineStageState {
  stage: PostPipelineStage;
  label: string;
  status: PostPipelineStatus;
}

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface SceneGraphLayout {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
}

export interface ShotOverrides {
  framing?: string;
  duration?: number;
  motion?: string;
  emphasis?: string;
  timelineNotes?: string;
}

export interface SceneGraphNode {
  id: string;
  type: GraphNodeType;
  title: string;
  category: string;
  role: string;
  isActive: boolean;
  shotRuntimeState?: ShotRuntimeState;
  shotOrder?: number;
  shotCurrentStage?: string;
  shotIsCurrent?: boolean;
  profileId?: string;
  profileName?: string;
  sourceType?: MemorySourceType | 'scene' | 'system';
  parameterTag?: string;
  downstreamEffect?: string;
  activeOverrides?: Record<string, PrimitiveValue>;
  inheritsGlobal?: boolean;
  shotOverrides?: ShotOverrides;
  compileState?: CompileState;
  renderState?: RenderState;
  engineTarget?: EngineTarget;
  outputHint?: string;
  routeMode?: EngineRouteMode;
  routeStrategy?: EngineOutputStrategy;
  activeRoute?: boolean;
  routeSource?: string;
  routeState?: EngineRouteState;
  review_mode?: string;
  frame_selection?: string;
  quality_status?: string;
  timeline_length?: string;
  clip_count?: number;
  edit_status?: string;
  export_format?: string;
  resolution?: string;
  codec?: string;
  delivery_target?: string;
  publish_status?: string;
  post_stage?: PostPipelineStage;
  post_status?: PostPipelineStatus;
  post_stage_states?: PostPipelineStageState[];
  post_active_stage?: string;
  post_completed_count?: number;
  runtimeState?: PipelineActivityState;
  runtimeProgress?: number;
  runtimeLastAction?: string;
  runtimeNextStage?: string;
  runtimeTimestamp?: string;
  authorityLabel?: string;
  authorityTone?: 'current' | 'selected' | 'approved' | 'deliverable' | 'none';
  authorityIsCanonical?: boolean;
  readinessHintLabel?: string;
  readinessHintTone?: 'deliverable' | 'none';
  position: GraphNodePosition;
}

export interface SceneGraphConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  activeRoute?: boolean;
  runtimeState?: PipelineActivityState;
}

export interface SceneGraphState {
  id: string;
  sceneId: string;
  name: string;
  templateId: string;
  defaultEngineTarget: EngineTarget;
  nodes: SceneGraphNode[];
  connections: SceneGraphConnection[];
  layout: SceneGraphLayout;
}

export interface GraphCompileSummary {
  activeNodes: Array<Pick<SceneGraphNode, 'id' | 'type' | 'title' | 'profileId' | 'sourceType'>>;
  shotNodes: Array<{
    id: string;
    title: string;
    inheritsGlobal: boolean;
    overrides?: SceneGraphNode['shotOverrides'];
    order?: number;
    runtimeState?: ShotRuntimeState;
    isCurrent?: boolean;
  }>;
  bindings: Record<string, string>;
  engineTarget: EngineTarget;
  route?: EngineRouteState;
}

export interface GraphTemplate {
  id: string;
  label: string;
  description: string;
  defaultEngineTarget: EngineTarget;
  bindings: Partial<Record<MemoryCategory, string>>;
  nodes: Omit<SceneGraphNode, 'profileId' | 'profileName' | 'sourceType'>[];
  connections: SceneGraphConnection[];
}
