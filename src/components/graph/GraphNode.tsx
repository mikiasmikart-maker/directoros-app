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
  compiled: 'text-emerald-300/88',
  stale: 'text-amber-300/88',
  pending: 'text-slate-300/84',
  ready: 'text-slate-300/84',
  queued: 'text-amber-300/88',
  rendering: 'text-cyan-300/88',
  completed: 'text-emerald-300/88',
  failed: 'text-rose-300/90',
} as const;

const runtimeTone = {
  idle: 'bg-panel/32 text-textMuted/82',
  waiting: 'bg-slate-500/8 text-slate-200/82',
  active: 'bg-cyan-500/11 text-cyan-100/90',
  processing: 'bg-amber-500/11 text-amber-100/90',
  completed: 'bg-emerald-500/11 text-emerald-100/90',
  failed: 'bg-rose-500/12 text-rose-100/90',
  blocked: 'bg-rose-500/10 text-rose-100/90',
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
  character: { shell: '', badge: 'bg-slate-500/10 text-slate-200/68', title: 'text-slate-300/85' },
  product: { shell: '', badge: 'bg-slate-500/10 text-slate-200/68', title: 'text-slate-300/85' },
  environment: { shell: '', badge: 'bg-slate-500/10 text-slate-200/68', title: 'text-slate-300/85' },
  lighting: { shell: '', badge: 'bg-slate-500/10 text-slate-200/68', title: 'text-slate-300/85' },
  camera: { shell: '', badge: 'bg-slate-500/10 text-slate-200/68', title: 'text-slate-300/85' },
  shot: {
    shell: '',
    badge: 'bg-amber-400/10 text-amber-200/84',
    title: 'text-slate-200/90 font-medium',
  },
  compiler: {
    shell: '',
    badge: 'bg-violet-500/10 text-violet-200/84',
    title: 'text-slate-200/90 font-medium tracking-[0.01em]',
  },
  engine_router: {
    shell: '',
    badge: 'bg-sky-500/10 text-sky-200/84',
    title: 'text-slate-200/90 font-medium tracking-[0.01em]',
  },
  engine_target: {
    shell: '',
    badge: 'bg-indigo-500/10 text-indigo-200/84',
    title: 'text-slate-200/90 font-medium',
  },
  render_output: {
    shell: '',
    badge: 'bg-cyan-400/11 text-cyan-200/86',
    title: 'text-slate-200/90 font-medium',
  },
  review_node: {
    shell: '',
    badge: 'bg-slate-500/8 text-slate-200/74',
    title: 'text-slate-300/85 font-medium',
  },
  edit_node: {
    shell: '',
    badge: 'bg-slate-500/8 text-slate-200/74',
    title: 'text-slate-300/85 font-medium',
  },
  export_node: {
    shell: '',
    badge: 'bg-slate-500/8 text-slate-200/74',
    title: 'text-slate-300/85 font-medium',
  },
  delivery_node: {
    shell: '',
    badge: 'bg-slate-500/8 text-slate-200/74',
    title: 'text-slate-300/85 font-medium',
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
      className={`absolute min-h-[104px] rounded-md border border-[rgba(255,255,255,0.08)] p-2 text-left antialiased shadow-[0_8px_20px_rgba(2,6,23,0.10)] transition-[z-index,border-color,background-color,box-shadow,opacity,filter] duration-180 [text-rendering:optimizeLegibility] ${roleStyle.shell} ${
        node.isActive
          ? 'bg-[rgba(8,12,20,0.6)] opacity-100'
          : 'bg-[rgba(8,12,20,0.45)] opacity-[0.92] saturate-90'
      } ${
        isActiveEngineTarget
          ? 'border-[rgba(129,68,192,0.3)] shadow-[0_0_0_1px_rgba(129,68,192,0.2),0_8px_18px_rgba(0,0,0,0.3)]'
          : isInactiveEngineTarget
            ? 'opacity-[0.85] saturate-[0.78]'
            : ''
      } ${
        node.runtimeState === 'active' || node.runtimeState === 'processing'
          ? 'shadow-[0_0_0_1px_rgba(120,160,255,0.11),0_8px_18px_rgba(32,52,82,0.13)]'
          : node.runtimeState === 'completed'
            ? 'shadow-[0_0_0_1px_rgba(16,185,129,0.1),0_7px_16px_rgba(20,44,36,0.1)]'
            : node.runtimeState === 'failed' || node.runtimeState === 'blocked'
              ? 'shadow-[0_0_0_1px_rgba(244,63,94,0.16)]'
              : ''
      } ${
        isSelected
          ? 'z-40 border-[rgba(129,68,192,0.5)] bg-[rgba(10,14,22,0.7)] shadow-[0_0_0_1px_rgba(129,68,192,0.3),0_12px_24px_rgba(0,0,0,0.4)]'
          : isHovered
            ? 'z-30 border-[rgba(255,255,255,0.16)] bg-[rgba(10,14,22,0.6)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_20px_rgba(8,14,26,0.2)]'
            : isDimmed
              ? 'z-20 opacity-[0.35] saturate-[0.6] filter blur-[0.2px]'
              : 'z-20 hover:z-30 hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(10,14,22,0.6)]'
      }  ${isConnectionSource ? 'ring-1 ring-amber-300/30' : ''} ${isPostPipelineGroup ? 'cursor-pointer bg-[rgba(17,24,38,0.52)]' : ''}`}
      style={{ left: Math.round(node.position.x), top: Math.round(node.position.y), width: nodeWidth, touchAction: 'none', transform: 'translateZ(0)', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
    >
      {!isPostPipelineGroup ? (
        <button
          className="absolute right-1 top-1 rounded px-1 text-[9px] text-textMuted/66 hover:text-rose-300"
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
        className="absolute -left-2 top-[34px] h-3.5 w-3.5 rounded-full bg-bg text-[8px] text-accent transition-colors"
        title="Connect here"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onCompleteConnection(node.id);
        }}
      />
      {!isPostPipelineGroup ? (
        <button
          className="absolute -right-2 top-[34px] h-3.5 w-3.5 rounded-full bg-bg text-[8px] text-amber-200 transition-colors"
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
          <div className={`mt-1 text-[13px] font-medium leading-tight text-slate-100/80 antialiased ${roleStyle.title}`}>
            {node.title}
            {node.type === 'shot' && node.shotIsCurrent ? <span className="ml-1 rounded bg-cyan-500/8 px-1 py-[1px] text-[8px] uppercase tracking-[0.1em] text-cyan-100/78">current</span> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 pr-3">
          <span className={`mt-0.5 text-[9px] uppercase tracking-[0.11em] ${node.isActive ? 'text-emerald-300/72' : 'text-slate-300/58'}`}>
            {node.type === 'shot' ? (shotState ?? 'waiting') : node.isActive ? 'active' : 'standby'}
          </span>
          {node.type === 'shot' && shotState ? (
            <span className={`rounded px-1.5 py-0.5 text-[9px] tracking-[0.06em] ${shotState === 'active' || shotState === 'rendering' || shotState === 'review' ? 'bg-cyan-500/10 text-cyan-100/88' : shotState === 'completed' || shotState === 'skipped' ? 'bg-emerald-500/10 text-emerald-100/88' : shotState === 'failed' || shotState === 'blocked' ? 'bg-rose-500/10 text-rose-100/90' : 'bg-panel/30 text-textMuted/85'}`}>
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
        <div className="mt-2 space-y-1.5 rounded bg-panel/34 px-2 py-1.5 text-[10px] text-textMuted/76">
          {node.authorityLabel ? (
            <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.06em]">
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 ${node.authorityTone === 'approved' ? 'bg-emerald-500/12 text-emerald-100/88' : node.authorityTone === 'deliverable' ? 'bg-cyan-500/12 text-cyan-100/88' : node.authorityTone === 'selected' ? 'bg-amber-500/12 text-amber-100/88' : node.authorityTone === 'current' ? 'bg-slate-500/12 text-slate-200/80' : 'bg-panel/28 text-textMuted/76'}`}>{node.authorityLabel}</span>
                {node.readinessHintLabel ? <span className={`rounded px-1.5 py-0.5 ${node.readinessHintTone === 'deliverable' ? 'bg-cyan-500/12 text-cyan-100/88' : 'bg-panel/28 text-textMuted/76'}`}>{node.readinessHintLabel}</span> : null}
              </div>
              {node.authorityIsCanonical ? <span className="text-emerald-100/74">canonical</span> : null}
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span>{node.post_completed_count ?? 0}/{node.post_stage_states?.length ?? 4} complete</span>
            <span className="text-text/74">{node.post_active_stage ? `${node.post_active_stage} active` : 'waiting'}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-black/28">
            <div
              className="h-full rounded bg-slate-200/58"
              style={{ width: `${Math.round(((node.post_completed_count ?? 0) / Math.max(1, node.post_stage_states?.length ?? 4)) * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-1">
            {(node.post_stage_states ?? []).map((stage) => (
              <span
                key={stage.stage}
                className={`h-2 w-2 rounded-full ${
                  stage.status === 'completed' || stage.status === 'approved' || stage.status === 'ready'
                    ? 'bg-emerald-300/84'
                    : stage.status === 'active'
                      ? 'bg-cyan-300/84'
                      : stage.status === 'blocked' || stage.status === 'failed'
                        ? 'bg-rose-300/82'
                        : stage.status === 'waiting'
                          ? 'bg-slate-300/52'
                          : 'bg-slate-400/42'
                }`}
                title={`${stage.label}: ${stage.status}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="m6-smalltext mt-1.5 grid grid-cols-2 gap-x-1.5 gap-y-0.5 mt-2 text-[9px] font-normal leading-tight text-slate-500/50 antialiased [&_span]:text-slate-300/60">
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
                route: <span className="text-sky-200/78">{node.routeMode ?? 'auto'}</span>
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
                {node.activeRoute ? <span className="ml-1 text-emerald-300/82">(active route)</span> : null}
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
                {node.engineTarget ? <span className="ml-1 text-text/56">[{node.engineTarget}]</span> : null}
              </div>
              {node.authorityLabel ? (
                <div className="col-span-2">
                  output truth: <span className={node.authorityTone === 'approved' ? 'text-emerald-200/80' : node.authorityTone === 'deliverable' ? 'text-cyan-200/80' : node.authorityTone === 'selected' ? 'text-amber-200/80' : 'text-slate-300/70'}>{node.authorityLabel}{node.authorityIsCanonical ? ' • canonical' : ''}</span>
                </div>
              ) : null}
              {node.readinessHintLabel ? (
                <div className="col-span-2">
                  readiness: <span className={node.readinessHintTone === 'deliverable' ? 'text-cyan-200/80' : 'text-slate-300/70'}>{node.readinessHintLabel}</span>
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
