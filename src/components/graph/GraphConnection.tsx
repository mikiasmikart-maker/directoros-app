import type { SceneGraphConnection, SceneGraphNode } from '../../types/graph';

interface GraphConnectionProps {
  connection: SceneGraphConnection;
  nodesById: Record<string, SceneGraphNode>;
  nodeWidth?: number;
  nodeAnchorY?: number;
  showLabels?: boolean;
  emphasis?: 'normal' | 'related' | 'faded';
  laneIndex?: number;
  onDelete?: (connectionId: string) => void;
}

export const GraphConnection = ({
  connection,
  nodesById,
  nodeWidth = 212,
  nodeAnchorY = 36,
  showLabels,
  emphasis = 'normal',
  laneIndex = 0,
  onDelete,
}: GraphConnectionProps) => {
  const from = nodesById[connection.from];
  const to = nodesById[connection.to];
  if (!from || !to) return null;

  const startX = from.position.x + nodeWidth - 1;
  const startY = from.position.y + nodeAnchorY;
  const endX = to.position.x - 1;
  const endY = to.position.y + nodeAnchorY;

  const laneShift = ((laneIndex % 5) - 2) * 4;
  const delta = Math.max(72, (endX - startX) * 0.4) + Math.abs(endY - startY) * 0.06;
  const bendY = laneShift + (endY - startY) * 0.08;

  // SVG Safety: Multi-factor validation to prevent "Expected number" errors in path d attribute.
  // We explicitly check derived values like delta and bendY to catch any NaN leakage.
  if (
    !Number.isFinite(startX) || !Number.isFinite(startY) ||
    !Number.isFinite(endX) || !Number.isFinite(endY) ||
    !Number.isFinite(laneShift) || !Number.isFinite(delta) ||
    !Number.isFinite(bendY)
  ) {
    return null;
  }

  const path = `M ${startX} ${startY} C ${startX + delta} ${startY + bendY}, ${endX - delta} ${endY - bendY}, ${endX} ${endY}`;

  if (path.includes('NaN') || path.includes('undefined') || path.includes('Infinity')) {
    return null;
  }

  const isCompilerToRender = from.type === 'compiler' && to.type === 'render_output';
  const isRoutePath = Boolean(connection.activeRoute);
  const isPostPipelinePath = ['review_node', 'edit_node', 'export_node', 'delivery_node'].includes(from.type) || ['review_node', 'edit_node', 'export_node', 'delivery_node'].includes(to.type);
  const isRelated = emphasis === 'related';
  const isFaded = emphasis === 'faded';
  const isRuntimeActive = connection.runtimeState === 'active' || connection.runtimeState === 'processing';
  const isRuntimeFailed = connection.runtimeState === 'failed' || connection.runtimeState === 'blocked';

  const baseStroke = isRuntimeFailed
    ? 'var(--dos-sig-warning)'
    : isRuntimeActive
      ? 'var(--dos-sig-runtime)'
      : isRoutePath
        ? 'var(--dos-sig-runtime)'
        : isCompilerToRender
          ? 'var(--dos-text-muted)'
          : isPostPipelinePath
            ? 'var(--dos-text-muted)'
            : 'var(--dos-text-muted)';

  const stroke = isFaded ? 'var(--dos-text-muted)' : isRelated ? 'var(--dos-sig-continuity)' : baseStroke;
  const strokeWidth = isCompilerToRender ? (isRelated ? '1.2' : '1.1') : isRelated ? '1.0' : '0.85';
  
  const strokeOpacity = isFaded 
    ? 0.15 
    : isRuntimeActive 
      ? 0.65 
      : isRuntimeFailed 
        ? 0.45 
        : isRoutePath 
          ? 0.4 
          : isRelated 
            ? 0.8 
            : isPostPipelinePath 
              ? 0.22 
              : 0.32;

  return (
    <g>
      {isCompilerToRender ? <path d={path} fill="none" stroke="var(--dos-text-muted)" strokeWidth="1.5" opacity={isFaded ? 0.1 : 0.25} /> : null}
      {isRuntimeActive && !isFaded ? <path d={path} fill="none" stroke="var(--dos-sig-runtime)" strokeWidth="2.5" opacity={0.15} /> : null}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={isRuntimeActive ? '6 5' : isCompilerToRender ? '0' : '2 3'}
        strokeOpacity={strokeOpacity}
        className={isRuntimeActive ? 'graph-connection-flow' : undefined}
      />
      <path d={path} fill="none" stroke="transparent" strokeWidth="10" className="cursor-pointer" onClick={() => onDelete?.(connection.id)} />
      <circle cx={endX} cy={endY} r={isCompilerToRender ? '2.5' : '2'} fill={isRuntimeFailed ? 'var(--dos-sig-warning)' : isRuntimeActive ? 'var(--dos-sig-runtime)' : 'var(--dos-text-muted)'} opacity={isFaded ? 0.2 : isRelated ? 0.9 : 0.6} />
      {showLabels && connection.label ? (
        <text
          x={(startX + endX) / 2}
          y={(startY + endY) / 2 - 6}
          textAnchor="middle"
          fill="var(--dos-text-muted)"
          opacity={isFaded ? 0.3 : 0.7}
          fontSize="9"
          fontWeight={isCompilerToRender ? '600' : '500'}
          letterSpacing="0.02em"
        >
          {connection.label}
        </text>
      ) : null}
    </g>
  );
};
