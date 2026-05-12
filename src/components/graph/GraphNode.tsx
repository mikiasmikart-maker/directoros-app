import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SceneGraphNode } from '../../types/graph';

interface GraphNodeProps {
  node: SceneGraphNode;
  nodeWidth?: number;
  isSelected: boolean;
  isDimmed?: boolean;
  isHovered?: boolean;
  isConnectionSource?: boolean;
  isPostPipelineGroup?: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onStartConnection: (id: string) => void;
  onCompleteConnection: (id: string) => void;
  onHoverStart?: (id: string) => void;
  onHoverEnd?: (id: string) => void;
  onDelete: (id: string) => void;
}

const stateTone = {
  compiled: 'text-dos-sig-trust/88',
  stale: 'text-dos-sig-drift/88',
  pending: 'text-dos-text/84',
  ready: 'text-dos-text/84',
  queued: 'text-dos-sig-drift/88',
  rendering: 'text-dos-sig-runtime/88',
  completed: 'text-dos-sig-trust/88',
  failed: 'text-dos-sig-warning/90',
} as const;

const runtimeTone = {
  idle: 'bg-dos-panel/32 text-dos-text-muted/82',
  waiting: 'bg-dos-panel/20 text-dos-text/70',
  active: 'bg-dos-sig-runtime/11 text-dos-sig-runtime/90',
  processing: 'bg-dos-sig-drift/11 text-dos-sig-drift/90',
  completed: 'bg-dos-sig-trust/11 text-dos-sig-trust/90',
  failed: 'bg-dos-sig-warning/12 text-dos-sig-warning/90',
  blocked: 'bg-dos-sig-warning/10 text-dos-sig-warning/90',
} as const;

const runtimeLabel = {
  idle: 'idle',
  waiting: 'waiting',
  active: 'active',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  blocked: 'blocked',
} as const;

const normalizeShotState = (state?: string) => {
  if (!state) return 'waiting';
  if (state === 'compiling' || state === 'routed') return 'active';
  return state;
};

const nodeRoleStyle: Record<SceneGraphNode['type'], { shell: string; badge: string; title: string }> = {
  character: { shell: '', badge: 'bg-dos-panel/20 text-dos-text/60', title: 'text-dos-text/80' },
  product: { shell: '', badge: 'bg-dos-panel/20 text-dos-text/60', title: 'text-dos-text/80' },
  environment: { shell: '', badge: 'bg-dos-panel/20 text-dos-text/60', title: 'text-dos-text/80' },
  lighting: { shell: '', badge: 'bg-dos-panel/20 text-dos-text/60', title: 'text-dos-text/80' },
  camera: { shell: '', badge: 'bg-dos-panel/20 text-dos-text/60', title: 'text-dos-text/80' },
  shot: {
    shell: '',
    badge: 'bg-dos-sig-drift/10 text-dos-sig-drift/84',
    title: 'text-dos-text/90 font-medium',
  },
  compiler: {
    shell: '',
    badge: 'bg-dos-sig-continuity/10 text-dos-sig-continuity/84',
    title: 'text-dos-text/90 font-medium tracking-[0.01em]',
  },
  engine_router: {
    shell: '',
    badge: 'bg-dos-sig-runtime/10 text-dos-sig-runtime/84',
    title: 'text-dos-text/90 font-medium tracking-[0.01em]',
  },
  engine_target: {
    shell: '',
    badge: 'bg-dos-sig-continuity/10 text-dos-sig-continuity/84',
    title: 'text-dos-text/90 font-medium',
  },
  render_output: {
    shell: '',
    badge: 'bg-dos-sig-runtime/11 text-dos-sig-runtime/86',
    title: 'text-dos-text/90 font-medium',
  },
  review_node: {
    shell: '',
    badge: 'bg-dos-panel/16 text-dos-text/70',
    title: 'text-dos-text/85 font-medium',
  },
  edit_node: {
    shell: '',
    badge: 'bg-dos-panel/16 text-dos-text/70',
    title: 'text-dos-text/85 font-medium',
  },
  export_node: {
    shell: '',
    badge: 'bg-dos-panel/16 text-dos-text/70',
    title: 'text-dos-text/85 font-medium',
  },
  delivery_node: {
    shell: '',
    badge: 'bg-dos-panel/16 text-dos-text/70',
    title: 'text-dos-text/85 font-medium',
  },
};

export const GraphNode = ({
  node,
  nodeWidth = 212,
  isSelected,
  isDimmed = false,
  isHovered = false,
  isConnectionSource,
  isPostPipelineGroup = false,
  onSelect,
  onDragStart,
  onStartConnection,
  onCompleteConnection,
  onHoverStart,
  onHoverEnd,
  onDelete,
}: GraphNodeProps) => {
  const roleStyle = nodeRoleStyle[node.type];
  const isActiveEngineTarget = node.type === 'engine_target' && Boolean(node.activeRoute);
  const isInactiveEngineTarget = node.type === 'engine_target' && !node.activeRoute;
  const shotState = node.type === 'shot' ? normalizeShotState(node.shotRuntimeState) : undefined;
  return (
    <div
      data-graph-node-interactive="true"
      onPointerDown={(event) => onDragStart(node.id, event)}
      onPointerEnter={() => onHoverStart?.(node.id)}
      onPointerLeave={() => onHoverEnd?.(node.id)}
      onClick={() => onSelect(node.id)}
      className={`absolute min-h-[104px] rounded-md border border-dos-border p-2 text-left antialiased shadow-sm transition-[z-index,border-color,background-color,box-shadow,opacity,filter] duration-180 [text-rendering:optimizeLegibility] ${roleStyle.shell} ${
        node.isActive
          ? 'bg-dos-panel/60 opacity-100'
          : 'bg-dos-panel/45 opacity-[0.92] saturate-90'
      } ${
        isActiveEngineTarget
          ? 'border-dos-sig-continuity/30 shadow-[0_0_0_1px_rgba(207,140,255,0.15)]'
          : isInactiveEngineTarget
            ? 'opacity-[0.85] saturate-[0.78]'
            : ''
      } ${
        node.runtimeState === 'active' || node.runtimeState === 'processing'
          ? 'border-dos-sig-runtime/30'
          : node.runtimeState === 'completed'
            ? 'border-dos-sig-trust/30'
            : node.runtimeState === 'failed' || node.runtimeState === 'blocked'
              ? 'border-dos-sig-warning/30'
              : ''
      } ${
        isSelected
          ? 'z-40 border-dos-sig-continuity/50 bg-dos-panel/75 shadow-[0_0_0_1px_rgba(207,140,255,0.1)]'
          : isHovered
            ? 'z-30 border-dos-text-muted/30 bg-dos-panel/65'
            : isDimmed
              ? 'z-20 opacity-[0.35] saturate-[0.6] filter blur-[0.2px]'
              : 'z-20 hover:z-30 hover:border-dos-text-muted/20 hover:bg-dos-panel/60'
      }  ${isConnectionSource ? 'ring-1 ring-dos-sig-drift/30' : ''} ${isPostPipelineGroup ? 'cursor-pointer bg-dos-panelSoft/52' : ''}`}
      style={{ left: Math.round(node.position.x), top: Math.round(node.position.y), width: nodeWidth, touchAction: 'none', transform: 'translateZ(0)', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
    >
      {!isPostPipelineGroup ? (
        <button
          className="absolute right-1 top-1 rounded px-1 text-[9px] text-dos-text-muted/66 hover:text-dos-sig-warning"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(node.id);
          }}
        >
          ×
        </button>
      ) : null}
      <button
        className="absolute -left-2 top-[34px] h-3.5 w-3.5 rounded-full bg-dos-bg text-[8px] text-dos-accent transition-colors"
        title="Connect here"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onCompleteConnection(node.id);
        }}
      />
      {!isPostPipelineGroup ? (
        <button
          className="absolute -right-2 top-[34px] h-3.5 w-3.5 rounded-full bg-dos-bg text-[8px] text-dos-sig-drift transition-colors"
          title="Start connection"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onStartConnection(node.id);
          }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`inline-flex rounded px-1.5 py-[1px] text-[9px] uppercase tracking-[0.14em] ${roleStyle.badge}`}>{node.category}</div>
          <div className={`mt-1 text-[13px] font-medium leading-tight text-dos-text/80 antialiased ${roleStyle.title}`}>
            {node.title}
            {node.type === 'shot' && node.shotIsCurrent ? <span className="ml-1 rounded bg-dos-sig-runtime/8 px-1 py-[1px] text-[8px] uppercase tracking-[0.1em] text-dos-sig-runtime/78">current</span> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 pr-3">
          <span className={`mt-0.5 text-[9px] uppercase tracking-[0.11em] ${node.isActive ? 'text-dos-sig-trust/72' : 'text-dos-text/50'}`}>
            {node.type === 'shot' ? (shotState ?? 'waiting') : node.isActive ? 'active' : 'standby'}
          </span>
          {node.type === 'shot' && shotState ? (
            <span className={`rounded px-1.5 py-0.5 text-[9px] tracking-[0.06em] ${shotState === 'active' || shotState === 'rendering' || shotState === 'review' ? 'bg-dos-sig-runtime/10 text-dos-sig-runtime/88' : shotState === 'completed' || shotState === 'skipped' ? 'bg-dos-sig-trust/10 text-dos-sig-trust/88' : shotState === 'failed' || shotState === 'blocked' ? 'bg-dos-sig-warning/10 text-dos-sig-warning/90' : 'bg-dos-panel/30 text-dos-text-muted/85'}`}>
              {shotState}
            </span>
          ) : node.runtimeState ? (
            <span className={`rounded px-1.5 py-0.5 text-[9px] tracking-[0.06em] ${runtimeTone[node.runtimeState]}`}>
              {runtimeLabel[node.runtimeState]}
            </span>
          ) : null}
        </div>
      </div>

      {isPostPipelineGroup ? (
        <div className="mt-2 space-y-1.5 rounded bg-dos-panel/34 px-2 py-1.5 text-[10px] text-dos-text-muted/76">
          {node.authorityLabel ? (
            <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.06em]">
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 ${node.authorityTone === 'approved' ? 'bg-dos-sig-trust/12 text-dos-sig-trust/88' : node.authorityTone === 'deliverable' ? 'bg-dos-sig-runtime/12 text-dos-sig-runtime/88' : node.authorityTone === 'selected' ? 'bg-dos-sig-drift/12 text-dos-sig-drift/88' : node.authorityTone === 'current' ? 'bg-dos-panel/30 text-dos-text/80' : 'bg-dos-panel/28 text-dos-text-muted/76'}`}>{node.authorityLabel}</span>
                {node.readinessHintLabel ? <span className={`rounded px-1.5 py-0.5 ${node.readinessHintTone === 'deliverable' ? 'bg-dos-sig-runtime/12 text-dos-sig-runtime/88' : 'bg-dos-panel/28 text-dos-text-muted/76'}`}>{node.readinessHintLabel}</span> : null}
              </div>
              {node.authorityIsCanonical ? <span className="text-dos-sig-trust/74">canonical</span> : null}
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span>{node.post_completed_count ?? 0}/{node.post_stage_states?.length ?? 4} complete</span>
            <span className="text-dos-text/74">{node.post_active_stage ? `${node.post_active_stage} active` : 'waiting'}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-black/28">
            <div
              className="h-full rounded bg-dos-text/40"
              style={{ width: `${Math.round(((node.post_completed_count ?? 0) / Math.max(1, node.post_stage_states?.length ?? 4)) * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-1">
            {(node.post_stage_states ?? []).map((stage) => (
              <span
                key={stage.stage}
                className={`h-2 w-2 rounded-full ${
                  stage.status === 'completed' || stage.status === 'approved' || stage.status === 'ready'
                    ? 'bg-dos-sig-trust/84'
                    : stage.status === 'active'
                      ? 'bg-dos-sig-runtime/84'
                      : stage.status === 'blocked' || stage.status === 'failed'
                        ? 'bg-dos-sig-warning/82'
                        : stage.status === 'waiting'
                          ? 'bg-dos-panel/40'
                          : 'bg-dos-panel/30'
                }`}
                title={`${stage.label}: ${stage.status}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="m6-smalltext mt-1.5 grid grid-cols-2 gap-x-1.5 gap-y-0.5 mt-2 text-[9px] font-normal leading-tight text-dos-text-muted/50 antialiased [&_span]:text-dos-text/70">
          {node.type === 'shot' ? (
            <>
              <div>
                order: <span>{node.shotOrder ?? 'n/a'}</span>
              </div>
              <div>
                focus: <span>{node.shotIsCurrent ? 'current' : 'queued'}</span>
              </div>
            </>
          ) : null}
          <div>
            source: <span>{node.sourceType ?? 'system'}</span>
          </div>
          <div>
            tag: <span>{node.parameterTag ?? 'n/a'}</span>
          </div>
          <div className="col-span-2">
            profile: <span>{node.profileName ?? 'none'}</span>
          </div>
          {typeof node.runtimeProgress === 'number' ? (
            <div className="col-span-2">
              progress: <span>{Math.round(node.runtimeProgress)}%</span>
            </div>
          ) : null}
          {node.type === 'compiler' && node.compileState ? (
            <div className="col-span-2">
              compile: <span className={stateTone[node.compileState]}>{node.compileState}</span>
            </div>
          ) : null}
          {node.type === 'engine_router' ? (
            <>
              <div className="col-span-2">
                route: <span className="text-dos-sig-runtime/78">{node.routeMode ?? 'auto'}</span>
              </div>
              <div className="col-span-2">
                strategy: <span>{node.routeStrategy ?? node.routeState?.strategy ?? 'n/a'}</span>
              </div>
              <div className="col-span-2">
                targets: <span>{node.routeState?.activeTargets.length ?? 0}</span>
              </div>
            </>
          ) : null}
          {node.type === 'engine_target' ? (
            <>
              <div className="col-span-2">
                engine: <span>{node.engineTarget ?? 'n/a'}</span>
                {node.activeRoute ? <span className="ml-1 text-dos-sig-trust/82">(active route)</span> : null}
              </div>
              <div className="col-span-2">
                source: <span>{node.routeSource ?? 'router'}</span>
              </div>
            </>
          ) : null}
          {node.type === 'render_output' && node.renderState ? (
            <>
              <div className="col-span-2">
                render: <span className={stateTone[node.renderState]}>{node.renderState}</span>
                {node.engineTarget ? <span className="ml-1 text-dos-text/56">[{node.engineTarget}]</span> : null}
              </div>
              {node.authorityLabel ? (
                <div className="col-span-2">
                  output truth: <span className={node.authorityTone === 'approved' ? 'text-dos-sig-trust/80' : node.authorityTone === 'deliverable' ? 'text-dos-sig-runtime/80' : node.authorityTone === 'selected' ? 'text-dos-sig-drift/80' : 'text-dos-text/70'}>{node.authorityLabel}{node.authorityIsCanonical ? ' • canonical' : ''}</span>
                </div>
              ) : null}
              {node.readinessHintLabel ? (
                <div className="col-span-2">
                  readiness: <span className={node.readinessHintTone === 'deliverable' ? 'text-dos-sig-runtime/80' : 'text-dos-text/70'}>{node.readinessHintLabel}</span>
                </div>
              ) : null}
            </>
          ) : null}
          {node.type === 'review_node' ? (
            <>
              <div className="col-span-2">
                mode: <span>{node.review_mode ?? 'standard'}</span>
              </div>
              <div className="col-span-2">
                frames: <span>{node.frame_selection ?? 'key moments'}</span>
              </div>
              <div className="col-span-2">
                quality: <span>{node.quality_status ?? 'pending'}</span>
              </div>
            </>
          ) : null}
          {node.type === 'edit_node' ? (
            <>
              <div>
                length: <span>{node.timeline_length ?? 'n/a'}</span>
              </div>
              <div>
                clips: <span>{node.clip_count ?? 0}</span>
              </div>
              <div className="col-span-2">
                status: <span>{node.edit_status ?? 'assembly'}</span>
              </div>
            </>
          ) : null}
          {node.type === 'export_node' ? (
            <>
              <div>
                format: <span>{node.export_format ?? 'mp4'}</span>
              </div>
              <div>
                res: <span>{node.resolution ?? '4k'}</span>
              </div>
              <div className="col-span-2">
                codec: <span>{node.codec ?? 'h.264'}</span>
              </div>
            </>
          ) : null}
          {node.type === 'delivery_node' ? (
            <>
              <div className="col-span-2">
                target: <span>{node.delivery_target ?? 'screening'}</span>
              </div>
              <div className="col-span-2">
                publish: <span>{node.publish_status ?? 'not published'}</span>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
