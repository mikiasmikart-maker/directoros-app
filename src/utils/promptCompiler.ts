import type { CompiledPromptPayload, EngineTarget, SceneNode, TimelineClip } from '../models/directoros';
import type { MemoryProfile, PrimitiveValue } from '../types/memory';
import { createRouteState } from '../data/engineRoutes';
import { buildRouteBranches, formatForEngine } from './engineFormatter';
import { compileGraphComposition } from './graphCompiler';
import type { SceneGraphState } from '../types/graph';

interface CompileInput {
  scene?: SceneNode;
  clips: TimelineClip[];
  selectedClipId?: string;
  memoryProfilesById: Record<string, MemoryProfile>;
  inspectorOverrides?: Record<string, PrimitiveValue>;
  engineTarget: EngineTarget;
  graphState?: SceneGraphState;
}

const flattenMemoryParameters = (profiles: MemoryProfile[]): Record<string, PrimitiveValue> => {
  return profiles.reduce<Record<string, PrimitiveValue>>((acc, profile) => {
    Object.entries(profile.parameters).forEach(([key, value]) => {
      acc[key] = value;
    });
    return acc;
  }, {});
};

export const compilePromptPayload = ({
  scene,
  clips,
  selectedClipId,
  memoryProfilesById,
  inspectorOverrides,
  engineTarget,
  graphState,
}: CompileInput): CompiledPromptPayload | null => {
  if (!scene) return null;

  const boundProfileIds = Object.values(scene.memoryBindings ?? {}).filter(Boolean) as string[];
  const boundProfiles = boundProfileIds.map((id) => memoryProfilesById[id]).filter(Boolean);

  const memoryParams = flattenMemoryParameters(boundProfiles);
  const sceneParams = scene.params ?? {};
  const localOverrideParams = scene.localOverrides?.parameters ?? {};
  const manualParams = inspectorOverrides ?? {};

  const clip =
    clips.find((c) => c.id === selectedClipId && c.sceneId === scene.id) ??
    clips.find((c) => c.sceneId === scene.id);

  const timelineParams = clip?.overrideParams ?? {};

  const mergedParams: Record<string, PrimitiveValue> = {
    ...memoryParams,
    ...sceneParams,
    ...localOverrideParams,
    ...manualParams,
    ...timelineParams,
  };

  const sources = Object.keys(mergedParams).reduce<Record<string, 'scene' | 'memory' | 'manual' | 'mixed' | 'timeline'>>((acc, key) => {
    const fromMemory = key in memoryParams;
    const fromScene = key in sceneParams || key in localOverrideParams;
    const fromManual = key in manualParams;
    const fromTimeline = key in timelineParams;

    const count = [fromMemory, fromScene, fromManual, fromTimeline].filter(Boolean).length;
    if (fromTimeline) acc[key] = count > 1 ? 'mixed' : 'timeline';
    else if (fromManual) acc[key] = count > 1 ? 'mixed' : 'manual';
    else if (fromMemory && fromScene) acc[key] = 'mixed';
    else if (fromMemory) acc[key] = 'memory';
    else acc[key] = 'scene';
    return acc;
  }, {});

  const graphComposition = compileGraphComposition(graphState, engineTarget);
  const route = graphComposition?.route ?? createRouteState(engineTarget);

  const formatted = formatForEngine(route.primaryEngine, {
    basePrompt: scene.prompt,
    emphasis: clip?.emphasis,
    motionBehavior: clip?.motionBehavior,
    routeStrategy: route.strategy,
  });

  const memorySummary = boundProfiles.map((profile) => `${profile.category}: ${profile.summary}`).join('; ');
  const shotSummary = graphComposition?.shotNodes
    .map((shot) => `${shot.title}(${shot.overrides?.framing ?? 'default'}, ${shot.overrides?.motion ?? 'default'})`)
    .join('; ');

  const compiledPrompt = [
    formatted.promptPrefix,
    scene.prompt,
    scene.localOverrides?.summary,
    memorySummary ? `memory context -> ${memorySummary}` : null,
    clip?.overrideNote ? `timeline override -> ${clip.overrideNote}` : null,
    shotSummary ? `shot graph -> ${shotSummary}` : null,
    `route -> ${route.mode}/${route.strategy} -> ${route.activeTargets.join(', ')}`,
    formatted.promptSuffix || null,
  ]
    .filter(Boolean)
    .join(' | ');

  const routeBranches = buildRouteBranches(route, scene.prompt, mergedParams);
  const currentShot =
    graphComposition?.shotNodes.find((shot) => shot.isCurrent) ??
    graphComposition?.shotNodes.find((shot) => ['active', 'compiling', 'routed', 'rendering', 'review'].includes(shot.runtimeState ?? '')) ??
    graphComposition?.shotNodes[0];
  const takeId = clip?.id ? `${clip.id}-take` : 'take-001';
  const version = Number(mergedParams.version ?? 1);

  const resolvedTargetEngine = route.primaryEngine;

  return {
    sceneId: scene.id,
    sceneName: scene.name,
    engineTarget: resolvedTargetEngine,
    compiledPrompt,
    payload: {
      scene: {
        basePrompt: scene.prompt,
        summary: scene.localOverrides?.summary,
      },
      parameters: mergedParams,
      sources,
      memoryProfileIds: boundProfileIds,
      timeline: {
        clipId: clip?.id,
        shotId: currentShot?.id,
        start: clip?.start ?? 0,
        duration: clip?.duration ?? Number(mergedParams.duration ?? 120),
        emphasis: clip?.emphasis,
        overrideNote: clip?.overrideNote,
        motionBehavior: clip?.motionBehavior,
      },
      shotContext: {
        shotId: currentShot?.id,
        sceneId: scene.id,
        takeId,
        version: Number.isFinite(version) && version > 0 ? Math.floor(version) : 1,
      },
      engineHints: formatted.hints,
      graph: graphComposition ? { ...graphComposition, route } : undefined,
      route,
      routeContext: {
        activeRoute: route.presetId,
        targetEngine: resolvedTargetEngine,
        activeTargets: route.activeTargets,
        strategy: route.strategy,
      },
      routeBranches,
    },
  };
};
