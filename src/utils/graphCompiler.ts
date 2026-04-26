import type { EngineTarget } from '../models/directoros';
import type { GraphCompileSummary, SceneGraphState } from '../types/graph';

export const compileGraphComposition = (
  graph: SceneGraphState | undefined,
  engineTarget: EngineTarget
): GraphCompileSummary | null => {
  if (!graph) return null;

  const activeNodes = graph.nodes
    .filter(
      (node) =>
        node.isActive &&
        node.type !== 'compiler' &&
        node.type !== 'render_output' &&
        node.type !== 'review_node' &&
        node.type !== 'edit_node' &&
        node.type !== 'export_node' &&
        node.type !== 'delivery_node'
    )
    .map((node) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      profileId: node.profileId,
      sourceType: node.sourceType,
    }));

  const shotNodes = graph.nodes
    .filter((node) => node.type === 'shot' && node.isActive)
    .map((node) => ({
      id: node.id,
      title: node.title,
      inheritsGlobal: Boolean(node.inheritsGlobal),
      overrides: node.shotOverrides,
      order: node.shotOrder,
      runtimeState: node.shotRuntimeState,
      isCurrent: node.shotIsCurrent,
    }));

  const bindings = graph.nodes.reduce<Record<string, string>>((acc, node) => {
    if (node.profileId) acc[node.type] = node.profileId;
    return acc;
  }, {});

  const routeNode = graph.nodes.find((node) => node.type === 'engine_router');

  return {
    activeNodes,
    shotNodes,
    bindings,
    engineTarget: engineTarget === 'auto' ? graph.defaultEngineTarget : engineTarget,
    route: routeNode?.routeState,
  };
};
