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
    ? 'rgba(244, 63, 94, 0.58)'
    : isRuntimeActive
      ? 'rgba(125, 211, 252, 0.86)'
      : isRoutePath
        ? 'rgba(77, 163, 255, 0.76)'
        : isCompilerToRender
          ? 'rgba(86, 104, 132, 0.62)'
          : isPostPipelinePath
            ? 'rgba(98, 112, 132, 0.34)'
            : 'rgba(63, 77, 101, 0.42)';
  const stroke = isFaded ? 'rgba(63, 77, 101, 0.18)' : isRelated ? 'rgba(102, 124, 158, 0.8)' : baseStroke;
  const strokeWidth = isCompilerToRender ? (isRelated ? '1.28' : '1.16') : isRelated ? '1.02' : '0.88';
  const strokeOpacity = isFaded ? 0.64 : 1;

  return (
    <g>
      {isCompilerToRender ? <path d={path} fill="none" stroke="rgba(54, 70, 96, 0.19)" strokeWidth="1.75" opacity={isFaded ? 0.35 : 0.72} /> : null}
      {isRuntimeActive && !isFaded ? <path d={path} fill="none" stroke="rgba(125, 211, 252, 0.2)" strokeWidth="2.8" opacity={0.45} /> : null}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={isRuntimeActive ? '7 6' : isCompilerToRender ? '0' : '2.1 3.4'}
        opacity={strokeOpacity}
        className={isRuntimeActive ? 'graph-connection-flow' : undefined}
      />
      <path d={path} fill="none" stroke="transparent" strokeWidth="10" className="cursor-pointer" onClick={() => onDelete?.(connection.id)} />
      <circle cx={endX} cy={endY} r={isCompilerToRender ? '2.7' : '2.05'} fill={isCompilerToRender ? 'rgba(112, 132, 162, 0.8)' : 'rgba(94, 113, 146, 0.65)'} opacity={isFaded ? 0.45 : isRelated ? 0.9 : 0.72} />
      {showLabels && connection.label ? (
        <text
          x={(startX + endX) / 2}
          y={(startY + endY) / 2 - 6}
          textAnchor="middle"
          fill={isCompilerToRender ? 'rgba(155, 174, 204, 0.72)' : 'rgba(132, 148, 176, 0.62)'}
          opacity={isFaded ? 0.45 : 0.82}
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
