import React, { useRef, useMemo, useEffect } from 'react';
import type { TimelineClip } from '../../models/directoros';

interface TimelineTrackProps {
  clips: TimelineClip[];
  playheadPositionMs: number;
  sessionStartMs: number;
  sessionEndMs: number;
  selectedClipId?: string;
  onSelectClip: (clipId: string) => void;
  onScrub: (posMs: number) => void;
  shotAuthorityMap?: Record<string, { isApproved: boolean; isWinner: boolean }>;
  selectedOverrideClipId?: string;
}

export const TimelineTrack = ({
  clips,
  playheadPositionMs,
  sessionStartMs,
  sessionEndMs,
  selectedClipId,
  onSelectClip,
  onScrub,
  shotAuthorityMap = {},
  selectedOverrideClipId,
}: TimelineTrackProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalDuration = sessionEndMs - sessionStartMs || 1;

  // Linear mapping: time_ms -> normalized x (0 to 1)
  const getTimeX = (ms: number) => (ms - sessionStartMs) / totalDuration;

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const normalizedX = Math.max(0, Math.min(1, x / rect.width));
    const targetMs = sessionStartMs + normalizedX * totalDuration;
    onScrub(targetMs);
  };

  const [isScrubbing, setIsScrubbing] = React.useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    handleInteraction(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const normalizedX = Math.max(0, Math.min(1, x / rect.width));
        const targetMs = sessionStartMs + normalizedX * totalDuration;
        onScrub(targetMs);
      }
    };
    const handleMouseUp = () => setIsScrubbing(false);

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, sessionStartMs, totalDuration, onScrub]);

  // G1 Ruler Ticks
  const rulerTicks = useMemo(() => {
    const ticks = [];
    const secStep = 1000; // 1 second
    const minStep = 60000; // 1 minute
    
    // Start at nearest second
    const startSec = Math.floor(sessionStartMs / secStep) * secStep;
    for (let t = startSec; t <= sessionEndMs; t += secStep) {
      if (t < sessionStartMs) continue;
      const x = getTimeX(t) * 100;
      const isMinute = (t % minStep === 0);
      ticks.push(
        <line
          key={`tick-${t}`}
          x1={`${x}%`}
          y1={0}
          x2={`${x}%`}
          y2={isMinute ? 8 : 4}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
      );
    }
    return ticks;
  }, [sessionStartMs, sessionEndMs, totalDuration]);

  // Lineage Connectors
  const connectors = useMemo(() => {
    const paths: React.ReactNode[] = [];
    const clipMap = new Map(clips.map(c => [c.id, c]));

    clips.forEach(clip => {
      // Correlate by parentJobId or job_id lineage
      if (clip.parentJobId && clipMap.has(clip.parentJobId)) {
        const parent = clipMap.get(clip.parentJobId)!;
        const startMs = clip.startMs ?? 0;
        const pStartMs = parent.startMs ?? 0;
        const pDurMs = parent.durationMs ?? 0;

        const x1 = getTimeX(pStartMs + pDurMs) * 100;
        const x2 = getTimeX(startMs) * 100;
        const y = 31 + (clip.track % 4) * 18; // Adjusted to match clip rect vertical centers
        
        paths.push(
          <path
            key={`conn-${clip.id}`}
            d={`M ${x1}% ${y} C ${(x1 + x2) / 2}% ${y}, ${(x1 + x2) / 2}% ${y}, ${x2}% ${y}`}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        );
      }
    });
    return paths;
  }, [clips, totalDuration, sessionStartMs]);

  return (
    <div 
      ref={containerRef}
      className="relative h-24 w-full cursor-crosshair select-none overflow-hidden bg-black/40"
      onMouseDown={onMouseDown}
    >
      <svg className="h-full w-full" style={{ shapeRendering: 'crispEdges' }}>
        {/* Background Grid / Ruler */}
        <g>{rulerTicks}</g>

        {/* Lineage Bridges */}
        <g>{connectors}</g>

        {/* Event Blocks */}
        {clips.map((clip) => {
          const startMs = clip.startMs ?? (sessionStartMs + (clip.start / 24) * 1000);
          const durMs = clip.durationMs ?? (clip.duration / 24) * 1000;
          
          const xPercent = getTimeX(startMs) * 100;
          const widthPercent = (durMs / totalDuration) * 100;
          const isSelected = selectedClipId === clip.id;
          const isSelectedOverride = selectedOverrideClipId === clip.id;
          
          const authority = shotAuthorityMap[clip.sceneId] || { isApproved: false, isWinner: false };
          const { isApproved, isWinner } = authority;

          const rectY = 24 + (clip.track % 4) * 18;

          return (
            <g key={clip.id} onClick={(e) => { e.stopPropagation(); onSelectClip(clip.id); }}>
              {/* Base Clip Shape */}
              <rect
                x={`${xPercent}%`}
                y={rectY}
                width={`${widthPercent}%`}
                height={14}
                fill={isSelected ? 'rgba(120, 160, 255, 0.4)' : 'rgba(255,255,255,0.15)'}
                className="transition-colors duration-150"
              />

              {/* Selected Override (White Perimeter Stroke) - Playhead Local */}
              {isSelectedOverride && (
                <rect
                  x={`${xPercent}%`}
                  y={rectY}
                  width={`${widthPercent}%`}
                  height={14}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="pointer-events-none"
                />
              )}

              {/* Authority Markers (Top Right) */}
              {isApproved ? (
                <rect
                  x={`calc(${xPercent + widthPercent}% - 6px)`}
                  y={rectY + 2}
                  width={4}
                  height={4}
                  fill="#FFFFFF"
                  className="pointer-events-none"
                />
              ) : isWinner ? (
                <rect
                  x={`calc(${xPercent + widthPercent}% - 6px)`}
                  y={rectY + 2}
                  width={4}
                  height={4}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="pointer-events-none"
                />
              ) : null}

              {isSelected && (
                <text
                  x={`${xPercent}%`}
                  y={rectY - 4}
                  fill="white"
                  fontSize="8"
                  fontWeight="500"
                  className="pointer-events-none uppercase tracking-tighter opacity-60"
                >
                  {clip.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Playhead Needle */}
        <line
          x1={`${getTimeX(playheadPositionMs) * 100}%`}
          y1={0}
          x2={`${getTimeX(playheadPositionMs) * 100}%`}
          y2="100%"
          stroke="#FFFFFF"
          strokeWidth="1"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
};
