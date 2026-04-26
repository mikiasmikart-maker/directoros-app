import type { EngineTarget } from '../models/directoros';

export type EngineRouteMode = 'auto' | 'single' | 'multi';
export type EngineOutputStrategy = 'still_image' | 'cinematic_video' | 'refine_then_render' | 'runway_motion';

export interface EngineRoutePreset {
  id: string;
  label: string;
  mode: EngineRouteMode;
  strategy: EngineOutputStrategy;
  primaryEngine: Exclude<EngineTarget, 'auto'>;
  targets: Array<Exclude<EngineTarget, 'auto'>>;
  fallbackEngine?: Exclude<EngineTarget, 'auto'>;
  summary: string;
}

export interface EngineRouteState {
  presetId: string;
  mode: EngineRouteMode;
  strategy: EngineOutputStrategy;
  targets: Array<Exclude<EngineTarget, 'auto'>>;
  activeTargets: Array<Exclude<EngineTarget, 'auto'>>;
  primaryEngine: Exclude<EngineTarget, 'auto'>;
  fallbackEngine?: Exclude<EngineTarget, 'auto'>;
  summary: string;
}

export interface EnginePayloadBranch {
  engine: Exclude<EngineTarget, 'auto'>;
  strategy: EngineOutputStrategy;
  payloadSummary: string;
  promptVariant: string;
  parameterKeys: string[];
}
