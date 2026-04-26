import type { EngineTarget } from '../models/directoros';
import type { EngineRoutePreset, EngineRouteState } from '../types/engine';

export const engineRoutePresets: EngineRoutePreset[] = [
  {
    id: 'still_image_route',
    label: 'Still Image Route',
    mode: 'single',
    strategy: 'still_image',
    primaryEngine: 'flux',
    targets: ['flux'],
    fallbackEngine: 'comfyui',
    summary: 'High fidelity still image output with FLUX and optional ComfyUI fallback.',
  },
  {
    id: 'cinematic_video_route',
    label: 'Cinematic Video Route',
    mode: 'multi',
    strategy: 'cinematic_video',
    primaryEngine: 'veo',
    targets: ['veo', 'runway'],
    fallbackEngine: 'runway',
    summary: 'Video-first route prioritizing Veo continuity with Runway fallback motion pass.',
  },
  {
    id: 'refine_then_render_route',
    label: 'Refine Then Render',
    mode: 'multi',
    strategy: 'refine_then_render',
    primaryEngine: 'comfyui',
    targets: ['comfyui', 'flux'],
    fallbackEngine: 'flux',
    summary: 'Refinement in ComfyUI then final still polish in FLUX.',
  },
  {
    id: 'runway_motion_route',
    label: 'Runway Motion Route',
    mode: 'single',
    strategy: 'runway_motion',
    primaryEngine: 'runway',
    targets: ['runway'],
    fallbackEngine: 'veo',
    summary: 'Motion-commercial style output routed directly through Runway.',
  },
];

export const resolveRoutePresetForEngine = (engineTarget: EngineTarget) => {
  if (engineTarget === 'auto') return engineRoutePresets[0];
  return engineRoutePresets.find((preset) => preset.primaryEngine === engineTarget || preset.targets.includes(engineTarget)) ?? engineRoutePresets[0];
};

export const createRouteState = (engineTarget: EngineTarget): EngineRouteState => {
  const preset = resolveRoutePresetForEngine(engineTarget);
  const primaryEngine = engineTarget === 'auto' ? preset.primaryEngine : (engineTarget as EngineRouteState['primaryEngine']);

  const activeTargets = preset.mode === 'single' ? [primaryEngine] : Array.from(new Set([primaryEngine, ...preset.targets]));

  return {
    presetId: preset.id,
    mode: engineTarget === 'auto' ? 'auto' : preset.mode,
    strategy: preset.strategy,
    targets: preset.targets,
    activeTargets,
    primaryEngine,
    fallbackEngine: preset.fallbackEngine,
    summary: preset.summary,
  };
};
