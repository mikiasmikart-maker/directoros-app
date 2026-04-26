import { createRouteState } from './engineRoutes';
import { graphTemplates } from './graphTemplates';
import { memoryProfilesById } from './memoryProfiles';
import type { SceneGraphState } from '../types/graph';

const sceneTemplateMap: Record<string, string> = {
  'scene-001': 'opening_addis_dawn_template',
  'scene-002': 'market_energy_template',
};

const defaultLayout = {
  width: 2520,
  height: 560,
  nodeWidth: 230,
  nodeHeight: 132,
};

export const createGraphFromTemplate = (sceneId: string, sceneName: string, templateId?: string): SceneGraphState => {
  const fallback = graphTemplates.find((t) => t.id === 'product_hero_template') ?? graphTemplates[0];
  const template = graphTemplates.find((t) => t.id === (templateId ?? sceneTemplateMap[sceneId])) ?? fallback;

  const routeState = createRouteState(template.defaultEngineTarget);

  const nodes = template.nodes.map((node) => {
    const binding = template.bindings[node.type as keyof typeof template.bindings];
    const profile = binding ? memoryProfilesById[binding] : undefined;

    return {
      ...node,
      profileId: profile?.id,
      profileName: profile?.name,
      sourceType: profile?.sourceType,
      engineTarget: node.type === 'render_output' ? routeState.primaryEngine : node.engineTarget,
      routeState: node.type === 'engine_router' ? routeState : undefined,
      activeRoute:
        node.type === 'engine_target' && node.engineTarget
          ? routeState.activeTargets.includes(node.engineTarget as (typeof routeState.activeTargets)[number])
          : undefined,
    };
  });

  return {
    id: `${sceneId}-${template.id}`,
    sceneId,
    name: `${sceneName} Graph`,
    templateId: template.id,
    defaultEngineTarget: template.defaultEngineTarget,
    nodes,
    connections: [...template.connections],
    layout: defaultLayout,
  };
};

export const initialGraphStates: Record<string, SceneGraphState> = {
  'scene-001': createGraphFromTemplate('scene-001', 'Opening - Addis Dawn'),
  'scene-002': createGraphFromTemplate('scene-002', 'Market Energy'),
};
