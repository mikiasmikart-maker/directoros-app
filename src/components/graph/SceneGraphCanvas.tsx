import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { graphTemplates } from '../../data/graphTemplates';
import { engineRoutePresets } from '../../data/engineRoutes';
import type { GraphNodeType, PostPipelineStageState, SceneGraphConnection, SceneGraphNode, SceneGraphState } from '../../types/graph';
import { GraphCanvasGrid } from './GraphCanvasGrid';
import { GraphConnection } from './GraphConnection';
import { GraphMiniToolbar } from './GraphMiniToolbar';
import { GraphNode } from './GraphNode';

interface SceneGraphCanvasProps {
  graph?: SceneGraphState;
  selectedNodeId?: string;
  selectedShotId?: string;
  onSelectNode: (nodeId?: string) => void;
  onLoadTemplate: (templateId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onCommitNodeDrag: (nodeId: string, startX: number, startY: number, endX: number, endY: number) => void;
  onCreateConnection: (from: string, to: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onAddNode: (type: GraphNodeType) => void;
  onDeleteNode: (nodeId: string) => void;
  onResetGraph: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  routePresetId?: string;
  onRoutePresetChange?: (presetId: string) => void;
  postPipelineCollapsed: boolean;
  onTogglePostPipelineCollapse: () => void;
}

const canConnect = (fromType: GraphNodeType, toType: GraphNodeType) => {
  if (fromType === 'character' && toType === 'shot') return true;
  if (fromType === 'lighting' && toType === 'shot') return true;
  if (fromType === 'product' && toType === 'shot') return true;
  if (fromType === 'environment' && toType === 'shot') return true;
  if (fromType === 'camera' && toType === 'shot') return true;
  if (fromType === 'shot' && toType === 'compiler') return true;
  if (fromType === 'compiler' && toType === 'engine_router') return true;
  if (fromType === 'engine_router' && toType === 'engine_target') return true;
  if (fromType === 'engine_target' && toType === 'render_output') return true;
  if (fromType === 'compiler' && toType === 'render_output') return true;
  if (fromType === 'render_output' && toType === 'review_node') return true;
  if (fromType === 'review_node' && toType === 'edit_node') return true;
  if (fromType === 'edit_node' && toType === 'export_node') return true;
  if (fromType === 'export_node' && toType === 'delivery_node') return true;
  return false;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const MIN_SCALE = 0.45;
const MAX_SCALE = 1.7;
const NODE_WIDTH = 208;
const NODE_HEIGHT = 112;
const PAN_START_THRESHOLD = 2;
const PAN_CLAMP_MARGIN = 84;
const ZOOM_INTENSITY_MOUSE = 0.00125;
const ZOOM_INTENSITY_TRACKPAD = 0.0019;
const POST_PIPELINE_GROUP_ID = '__post_pipeline_group__';
const postPipelineTypes: GraphNodeType[] = ['review_node', 'edit_node', 'export_node', 'delivery_node'];
const postTypeLabel: Record<GraphNodeType, string> = {
  character: 'Character',
  product: 'Product',
  environment: 'Environment',
  lighting: 'Lighting',
  camera: 'Camera',
  shot: 'Shot',
  compiler: 'Compiler',
  engine_router: 'Router',
  engine_target: 'Engine',
  render_output: 'Render',
  review_node: 'Review',
  edit_node: 'Edit',
  export_node: 'Export',
  delivery_node: 'Delivery',
};

export const SceneGraphCanvas = ({
  graph,
  selectedNodeId,
  selectedShotId,
  onSelectNode,
  onLoadTemplate,
  onMoveNode,
  onCommitNodeDrag,
  onCreateConnection,
  onDeleteConnection,
  onAddNode,
  onDeleteNode,
  onResetGraph,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  routePresetId,
  onRoutePresetChange,
  postPipelineCollapsed,
  onTogglePostPipelineCollapse,
}: SceneGraphCanvasProps) => {
  const [showConnections, setShowConnections] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [pendingConnectionFrom, setPendingConnectionFrom] = useState<string | undefined>();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>();
  const [viewTransform, setViewTransform] = useState({ scale: 0.86, offsetX: 0, offsetY: 0 });
  const [dragPreview, setDragPreview] = useState<Record<string, { x: number; y: number }>>({});
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    pointerId: number;
    nodeId: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const panState = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    hasMoved: boolean;
  } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const dragQueuedRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const spacePanRef = useRef(false);

  const nodes = graph?.nodes ?? [];
  const rawLayout = graph?.layout ?? { width: 1400, height: 560, nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT };
  const layout = { ...rawLayout, width: Math.max(rawLayout.width, 3040), height: Math.max(rawLayout.height, 700) };

  const nodesWithPreview = useMemo(
    () => nodes.map((node) => (dragPreview[node.id] ? { ...node, position: dragPreview[node.id] } : node)),
    [dragPreview, nodes]
  );

  const collapsedPostPipelineNode = useMemo<SceneGraphNode | undefined>(() => {
    if (!postPipelineCollapsed) return undefined;
    const postNodes = nodesWithPreview.filter((node) => postPipelineTypes.includes(node.type));
    const renderNode = nodesWithPreview.find((node) => node.type === 'render_output');
    if (!postNodes.length || !renderNode) return undefined;

    const minX = Math.min(...postNodes.map((node) => node.position.x));
    const minY = Math.min(...postNodes.map((node) => node.position.y));

    const stageStates: PostPipelineStageState[] = postNodes.map((node) => ({
      stage: node.post_stage ?? 'review',
      label: postTypeLabel[node.type],
      status: node.post_status ?? 'pending',
    }));
    const completedCount = stageStates.filter((stage) => ['approved', 'ready', 'completed'].includes(stage.status)).length;
    const activeStage = stageStates.find((stage) => stage.status === 'active')?.label;

    return {
      id: POST_PIPELINE_GROUP_ID,
      type: 'review_node',
      title: 'Post Pipeline',
      category: 'Post',
      role: 'review → edit → export → delivery',
      isActive: postNodes.some((node) => node.isActive),
      parameterTag: `${completedCount}/${postNodes.length} complete`,
      sourceType: 'system',
      profileName: 'Grouped',
      post_stage_states: stageStates,
      post_active_stage: activeStage,
      post_completed_count: completedCount,
      position: { x: Math.max(renderNode.position.x + 246, minX - 6), y: minY },
    };
  }, [nodesWithPreview, postPipelineCollapsed]);

  const visibleNodes = useMemo(() => {
    if (!postPipelineCollapsed || !collapsedPostPipelineNode) return nodesWithPreview;
    return [
      ...nodesWithPreview.filter((node) => !postPipelineTypes.includes(node.type)),
      collapsedPostPipelineNode,
    ];
  }, [collapsedPostPipelineNode, nodesWithPreview, postPipelineCollapsed]);

  const getOffsetBounds = (scale: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return {
        minOffsetX: -Infinity,
        maxOffsetX: Infinity,
        minOffsetY: -Infinity,
        maxOffsetY: Infinity,
      };
    }

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const scaledWidth = layout.width * scale;
    const scaledHeight = layout.height * scale;

    const centeredX = (viewportWidth - scaledWidth) / 2;
    const centeredY = (viewportHeight - scaledHeight) / 2;

    const minOffsetX = scaledWidth >= viewportWidth ? viewportWidth - scaledWidth - PAN_CLAMP_MARGIN : centeredX - PAN_CLAMP_MARGIN;
    const maxOffsetX = scaledWidth >= viewportWidth ? PAN_CLAMP_MARGIN : centeredX + PAN_CLAMP_MARGIN;
    const minOffsetY = scaledHeight >= viewportHeight ? viewportHeight - scaledHeight - PAN_CLAMP_MARGIN : centeredY - PAN_CLAMP_MARGIN;
    const maxOffsetY = scaledHeight >= viewportHeight ? PAN_CLAMP_MARGIN : centeredY + PAN_CLAMP_MARGIN;

    return { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY };
  };

  const clampTransform = (transform: { scale: number; offsetX: number; offsetY: number }) => {
    const { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY } = getOffsetBounds(transform.scale);

    return {
      ...transform,
      offsetX: clamp(transform.offsetX, minOffsetX, maxOffsetX),
      offsetY: clamp(transform.offsetY, minOffsetY, maxOffsetY),
    };
  };

  const nodesById = useMemo(() => {
    const out: Record<string, SceneGraphNode> = {};
    for (const node of visibleNodes) out[node.id] = node;
    return out;
  }, [visibleNodes]);

  const visibleConnections = useMemo(() => {
    const baseConnections = graph?.connections ?? [];
    if (!postPipelineCollapsed || !collapsedPostPipelineNode) return baseConnections;

    const filtered = baseConnections.filter((connection) => {
      const fromNode = nodesWithPreview.find((node) => node.id === connection.from);
      const toNode = nodesWithPreview.find((node) => node.id === connection.to);
      const fromPost = fromNode ? postPipelineTypes.includes(fromNode.type) : false;
      const toPost = toNode ? postPipelineTypes.includes(toNode.type) : false;
      return !fromPost && !toPost;
    });

    const renderNode = nodesWithPreview.find((node) => node.type === 'render_output');
    const renderToPostConnection: SceneGraphConnection = {
      id: 'collapsed-post-pipeline-link',
      from: renderNode?.id ?? '',
      to: collapsedPostPipelineNode.id,
      label: collapsedPostPipelineNode.post_active_stage ? `render complete → ${collapsedPostPipelineNode.post_active_stage.toLowerCase()} active` : 'post pipeline',
      runtimeState:
        renderNode?.runtimeState === 'completed'
          ? 'active'
          : renderNode?.runtimeState === 'failed'
            ? 'failed'
            : 'waiting',
    };

    return renderToPostConnection.from ? [...filtered, renderToPostConnection] : filtered;
  }, [collapsedPostPipelineNode, graph?.connections, nodesWithPreview, postPipelineCollapsed]);

  const clientToGraphPoint = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left - viewTransform.offsetX) / viewTransform.scale,
      y: (clientY - rect.top - viewTransform.offsetY) / viewTransform.scale,
    };
  };

  const onDragStart = (nodeId: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || nodeId === POST_PIPELINE_GROUP_ID || spacePanRef.current) return;
    const node = nodesById[nodeId];
    if (!node) return;
    const pointer = clientToGraphPoint(event.clientX, event.clientY);
    dragState.current = {
      pointerId: event.pointerId,
      nodeId,
      offsetX: pointer.x - node.position.x,
      offsetY: pointer.y - node.position.y,
      startX: node.position.x,
      startY: node.position.y,
      lastX: node.position.x,
      lastY: node.position.y,
    };
    onSelectNode(nodeId);
    viewportRef.current?.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const flushDragFrame = () => {
    dragFrameRef.current = null;
    if (!dragQueuedRef.current) return;
    const { nodeId, x, y } = dragQueuedRef.current;
    setDragPreview((prev) => ({ ...prev, [nodeId]: { x, y } }));
  };

  const queueDragPreview = (nodeId: string, x: number, y: number) => {
    dragQueuedRef.current = { nodeId, x, y };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(flushDragFrame);
  };

  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panState.current && panState.current.pointerId === event.pointerId) {
      const dx = event.clientX - panState.current.startClientX;
      const dy = event.clientY - panState.current.startClientY;

      if (!panState.current.hasMoved && Math.hypot(dx, dy) < PAN_START_THRESHOLD) {
        event.preventDefault();
        return;
      }

      if (!panState.current.hasMoved) {
        panState.current.hasMoved = true;
        setIsPanning(true);
      }

      setViewTransform((prev) =>
        clampTransform({
          ...prev,
          offsetX: panState.current!.startOffsetX + dx,
          offsetY: panState.current!.startOffsetY + dy,
        })
      );
      event.preventDefault();
      return;
    }

    if (!dragState.current || dragState.current.pointerId !== event.pointerId) return;
    const pointer = clientToGraphPoint(event.clientX, event.clientY);
    const x = clamp(pointer.x - dragState.current.offsetX, 0, layout.width - NODE_WIDTH);
    const y = clamp(pointer.y - dragState.current.offsetY, 0, layout.height - NODE_HEIGHT);
    dragState.current.lastX = x;
    dragState.current.lastY = y;
    queueDragPreview(dragState.current.nodeId, x, y);
    event.preventDefault();
  };

  const onDragEnd = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && panState.current && panState.current.pointerId === event.pointerId) {
      if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
        viewportRef.current.releasePointerCapture(event.pointerId);
      }
      panState.current = null;
      setIsPanning(false);
      return;
    }

    if (!dragState.current) return;
    if (event && dragState.current.pointerId !== event.pointerId) return;
    const { pointerId, nodeId, startX, startY, lastX, lastY } = dragState.current;
    if (viewportRef.current?.hasPointerCapture(pointerId)) {
      viewportRef.current.releasePointerCapture(pointerId);
    }
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    dragQueuedRef.current = null;

    onMoveNode(nodeId, lastX, lastY);
    if (startX !== lastX || startY !== lastY) {
      onCommitNodeDrag(nodeId, startX, startY, lastX, lastY);
    }

    setDragPreview((prev) => {
      if (!prev[nodeId]) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    dragState.current = null;
  };

  const fitGraph = () => {
    const viewport = viewportRef.current;
    if (!viewport || !visibleNodes.length) {
      setViewTransform(clampTransform({ scale: 1, offsetX: 0, offsetY: 0 }));
      return;
    }

    const margin = 40;
    const minX = Math.min(...visibleNodes.map((node) => node.position.x));
    const minY = Math.min(...visibleNodes.map((node) => node.position.y));
    const maxX = Math.max(...visibleNodes.map((node) => node.position.x + NODE_WIDTH));
    const maxY = Math.max(...visibleNodes.map((node) => node.position.y + NODE_HEIGHT));

    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const availableWidth = Math.max(1, viewport.clientWidth - margin * 2);
    const availableHeight = Math.max(1, viewport.clientHeight - margin * 2);

    const scale = clamp(Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight), MIN_SCALE, MAX_SCALE);
    const offsetX = (viewport.clientWidth - boundsWidth * scale) / 2 - minX * scale;
    const offsetY = (viewport.clientHeight - boundsHeight * scale) / 2 - minY * scale;

    setViewTransform(clampTransform({ scale, offsetX, offsetY }));
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (dragState.current || panState.current) {
        event.preventDefault();
        return;
      }

      const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      const dy = event.deltaY * deltaScale;
      const looksLikeTrackpad = Math.abs(dy) < 26;

      event.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const intensity = looksLikeTrackpad ? ZOOM_INTENSITY_TRACKPAD : ZOOM_INTENSITY_MOUSE;
      const zoomFactor = Math.exp(-dy * intensity);

      setViewTransform((prev) => {
        const nextScale = clamp(prev.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
        if (nextScale === prev.scale) return prev;
        const graphX = (pointerX - prev.offsetX) / prev.scale;
        const graphY = (pointerY - prev.offsetY) / prev.scale;
        return clampTransform({
          scale: nextScale,
          offsetX: pointerX - graphX * nextScale,
          offsetY: pointerY - graphY * nextScale,
        });
      });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [layout.height, layout.width]);

  useEffect(() => {
    const onResize = () => {
      setViewTransform((prev) => clampTransform(prev));
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layout.height, layout.width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePanRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePanRef.current = false;
    };
    const onBlur = () => {
      spacePanRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        onUndo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        onRedo();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingConnectionFrom(undefined);
        onSelectNode(undefined);
        return;
      }

      if (event.key === 'Delete' && selectedNodeId && selectedNodeId !== POST_PIPELINE_GROUP_ID) {
        event.preventDefault();
        onDeleteNode(selectedNodeId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDeleteNode, onRedo, onUndo, selectedNodeId]);

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
      const pointerId = dragState.current?.pointerId ?? panState.current?.pointerId;
      if (pointerId !== undefined && viewportRef.current?.hasPointerCapture(pointerId)) {
        viewportRef.current.releasePointerCapture(pointerId);
      }
      dragState.current = null;
      panState.current = null;
      setIsPanning(false);
    },
    []
  );

  const completeConnection = (toId: string) => {
    if (toId === POST_PIPELINE_GROUP_ID) {
      onTogglePostPipelineCollapse();
      return;
    }

    if (!pendingConnectionFrom) {
      onSelectNode(toId);
      return;
    }
    const fromNode = nodesById[pendingConnectionFrom];
    const toNode = nodesById[toId];
    if (!fromNode || !toNode) {
      setPendingConnectionFrom(undefined);
      return;
    }
    if (fromNode.id !== toNode.id && canConnect(fromNode.type, toNode.type)) {
      onCreateConnection(fromNode.id, toNode.id);
    }
    setPendingConnectionFrom(undefined);
  };

  return (
    <section className="relative min-h-[500px] overflow-hidden rounded-md border border-white/[0.03] py-10 shadow-[0_4px_14px_rgba(0,0,0,0.15)]" style={{ background: 'radial-gradient(circle at center, rgba(15,25,45,0.2), rgba(5,7,12,0.98))' }}>
      <GraphCanvasGrid />
      <div className="absolute left-3 right-3 top-2 z-20 space-y-1 rounded-md border border-white/[0.02] bg-[rgba(5,7,12,0.64)] px-2 py-1 text-[11px] backdrop-blur-[8px] shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.035] pb-1.5 mb-1.5">
          <GraphMiniToolbar
            selectedShotId={selectedShotId}
            showConnections={showConnections}
            showLabels={showLabels}
            zoomPercent={Math.round(viewTransform.scale * 100)}
            onFitGraph={fitGraph}
            onResetLayout={() => {
              onResetGraph();
              setViewTransform(clampTransform({ scale: 0.86, offsetX: 0, offsetY: 0 }));
            }}
            onToggleConnections={() => setShowConnections((prev) => !prev)}
            onToggleLabels={() => setShowLabels((prev) => !prev)}
            onFocusSelectedShot={() => {
              if (selectedShotId) onSelectNode(selectedShotId);
            }}
          />
          <select
            className="rounded border border-white/[0.03] bg-white/[0.025] px-2 py-1 text-white/68"
            onChange={(event) => event.target.value && onLoadTemplate(event.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Load Template
            </option>
            {graphTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1 text-[10px]">
            <span className="uppercase tracking-[0.12em] text-textMuted">Route Preset</span>
            <select
              value={routePresetId ?? engineRoutePresets[0].id}
              onChange={(event) => onRoutePresetChange?.(event.target.value)}
              className="rounded bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/75"
            >
              {engineRoutePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.id}
                </option>
              ))}
            </select>
            <button
              onClick={onTogglePostPipelineCollapse}
              className="rounded bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/60 hover:bg-white/[0.05] hover:text-white/85"
            >
              {postPipelineCollapsed ? 'Post: Collapsed' : 'Post: Expanded'}
            </button>
          </div>

          <div className="flex min-w-[280px] flex-1 items-center gap-1.5 overflow-x-auto rounded-md bg-black/16 border border-white/[0.02] px-1.5 py-1 shadow-[inset_0_1px_4px_rgba(0,0,0,0.14)]">
            {(['shot', 'environment', 'lighting', 'product', 'engine_target', 'review_node', 'edit_node', 'export_node', 'delivery_node'] as GraphNodeType[]).map((type) => (
              <button
                key={type}
                onClick={() => onAddNode(type)}
                className="shrink-0 rounded border border-transparent bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300/76 hover:bg-white/[0.08] hover:text-slate-100"
              >
                + {type}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={onUndo} disabled={!canUndo} className="rounded border border-white/[0.025] bg-white/[0.022] px-2 py-1 text-white/64 hover:bg-white/[0.04] hover:text-white/82 disabled:opacity-40">
              Undo
            </button>
            <button onClick={onRedo} disabled={!canRedo} className="rounded border border-white/[0.025] bg-white/[0.022] px-2 py-1 text-white/64 hover:bg-white/[0.04] hover:text-white/82 disabled:opacity-40">
              Redo
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-[560px] w-full min-w-0 overflow-hidden ${isPanning ? 'cursor-grabbing' : spacePanRef.current ? 'cursor-grab' : 'cursor-default'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          const targetEl = event.target as HTMLElement | null;
          const interactiveNodeTarget = targetEl?.closest('[data-graph-node-interactive="true"]');
          const isPanButton = event.button === 1 || (event.button === 0 && spacePanRef.current);
          const isCanvasPan = event.button === 0 && !interactiveNodeTarget;

          if (event.button === 0 && !spacePanRef.current && !interactiveNodeTarget) {
            setPendingConnectionFrom(undefined);
            onSelectNode(undefined);
          }

          if (!isPanButton && !isCanvasPan) return;
          if (dragState.current) return;
          panState.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startOffsetX: viewTransform.offsetX,
            startOffsetY: viewTransform.offsetY,
            hasMoved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onLostPointerCapture={() => {
          panState.current = null;
          dragState.current = null;
          setIsPanning(false);
        }}
        onPointerLeave={() => {
          setHoveredNodeId(undefined);
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${Math.round(viewTransform.offsetX)}px, ${Math.round(viewTransform.offsetY)}px) scale(${viewTransform.scale})`,
            transformOrigin: 'top left',
          }}
        >
          <div className="pointer-events-none absolute inset-y-0 left-[6%] w-[72%] bg-[linear-gradient(90deg,transparent_0%,rgba(140,174,220,0.012)_26%,rgba(120,196,201,0.012)_66%,transparent_100%)]" />

          <div className="pointer-events-none absolute left-[3%] top-4 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">Scene Sources</div>
          <div className="pointer-events-none absolute left-[20.2%] top-4 text-[9px] font-bold uppercase tracking-[0.2em] text-sky-400/25">Shot Logic</div>
          <div className="pointer-events-none absolute left-[35.2%] top-4 text-[9px] font-bold uppercase tracking-[0.2em] text-violet-400/25">Prompt Compiler</div>
          <div className="pointer-events-none absolute left-[50.2%] top-4 text-[9px] font-bold uppercase tracking-[0.2em] text-teal-400/25">Engine Router + Targets</div>
          <div className="pointer-events-none absolute left-[74%] top-4 text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-400/20">
            {postPipelineCollapsed ? 'Post Pipeline (Folded)' : 'Post Pipeline'}
          </div>

          {showConnections ? (
            <svg className="absolute inset-0 z-0 h-full w-full" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none">
              <defs>
                <marker id="arrow" markerWidth="7" markerHeight="7" refX="4.5" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L5.5,3 z" fill="rgba(61, 72, 90, 0.56)" />
                </marker>
              </defs>
              {visibleConnections.map((connection: SceneGraphConnection, index) => {
                const isRelated = hoveredNodeId ? connection.from === hoveredNodeId || connection.to === hoveredNodeId : false;
                const emphasis = hoveredNodeId ? (isRelated ? 'related' : 'faded') : 'normal';

                return (
                  <g key={connection.id} markerEnd="url(#arrow)">
                    <GraphConnection
                      connection={connection}
                      nodesById={nodesById}
                      nodeWidth={NODE_WIDTH}
                      showLabels={showLabels}
                      emphasis={emphasis}
                      laneIndex={index}
                      onDelete={connection.id === 'collapsed-post-pipeline-link' ? undefined : onDeleteConnection}
                    />
                  </g>
                );
              })}
            </svg>
          ) : null}

          {visibleNodes.map((node) => (
            <GraphNode
              key={node.id}
              node={node}
              nodeWidth={NODE_WIDTH}
              isSelected={node.id === selectedNodeId || (node.id === POST_PIPELINE_GROUP_ID && postPipelineCollapsed && postPipelineTypes.includes((nodesWithPreview.find((n) => n.id === selectedNodeId)?.type ?? 'shot') as GraphNodeType))}
              isDimmed={Boolean(selectedNodeId) && node.id !== selectedNodeId && node.id !== selectedShotId}
              isHovered={node.id === hoveredNodeId}
              isConnectionSource={node.id === pendingConnectionFrom}
              onSelect={(id) => {
                if (id === POST_PIPELINE_GROUP_ID) {
                  onTogglePostPipelineCollapse();
                  return;
                }
                onSelectNode(id);
              }}
              onDragStart={onDragStart}
              onStartConnection={(id) => {
                if (id !== POST_PIPELINE_GROUP_ID) setPendingConnectionFrom(id);
              }}
              onCompleteConnection={completeConnection}
              onHoverStart={(id) => {
                setHoveredNodeId(id);
              }}
              onHoverEnd={(id) => {
                setHoveredNodeId((prev) => (prev === id ? undefined : prev));
              }}
              onDelete={(id) => {
                if (id !== POST_PIPELINE_GROUP_ID) onDeleteNode(id);
              }}
              isPostPipelineGroup={node.id === POST_PIPELINE_GROUP_ID}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
