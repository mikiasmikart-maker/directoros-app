import { useEffect, useMemo, useRef } from 'react';

interface ShotTimelineItem {
  id: string;
  title: string;
  order: number;
  state: string;
  progress: number;
  stage?: string;
  duration?: number; // Duration in seconds or relative 'beats'
}

interface SceneProductionTimelineProps {
  sceneName?: string;
  shots: ShotTimelineItem[];
  shotReviewById?: Record<string, { reviewStatus?: string; approvalStatus?: string; actionState?: string; bestKnownJobId?: string; riskLevel?: 'low' | 'medium' | 'high'; reason?: string }>;
  selectedShotId?: string;
  onSelectShot?: (shotId?: string) => void;
  renderJobs?: import('../../render/jobQueue').RenderQueueJob[];
  dismissedFailureIds?: Set<string>;
}

const normalizeState = (state: string) => {
  if (state === 'rendering' || state === 'compiling' || state === 'routed' || state === 'active' || state === 'review') return 'running';
  if (state === 'completed' || state === 'skipped') return 'completed';
  if (state === 'queued' || state === 'waiting') return 'queued';
  if (state === 'failed' || state === 'blocked') return 'failed';
  return 'pending';
};

const toneByState: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  finalized: 'bg-emerald-500/10 text-emerald-400',
  running: 'bg-[#8144C0]/10 text-white',
  queued: 'bg-amber-500/10 text-amber-400',
  needs_revision: 'bg-amber-500/10 text-amber-400',
  rejected: 'bg-rose-500/10 text-rose-400',
  failed: 'bg-rose-500/10 text-rose-400',
  pending: 'bg-panel/30 text-white/20',
};

const getCanonicalTimelineState = (shotState: string, review?: { actionState?: string; approvalStatus?: string }) =>
  review?.actionState ?? review?.approvalStatus ?? normalizeState(shotState);

export const SceneProductionTimeline = ({ sceneName, shots, shotReviewById, selectedShotId, onSelectShot, renderJobs, dismissedFailureIds }: SceneProductionTimelineProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Awwwards Hierarchy Styles
  const UI_LABEL = "text-[10px] font-light tracking-[0.05em] text-neutral-500";
  const accentColor = "#8144C0"; // Mikart Purple

  // PHASE 5: TEMPORAL MATH
  const DEFAULT_BEAT = 5; // Default shot duration if missing
  const shotsWithDuration = shots.map(s => ({ ...s, duration: s.duration || DEFAULT_BEAT }));
  const totalDuration = shotsWithDuration.reduce((acc, s) => acc + s.duration, 0) || 1;

  const completedCount = shots.filter((shot) => {
    const canonicalState = getCanonicalTimelineState(shot.state, shotReviewById?.[shot.id]);
    return ['approved', 'finalized', 'ready', 'completed'].includes(canonicalState);
  }).length;

  return (
    <section className="flex flex-col gap-3">
      {/* HEADER SCROLLING HUD */}
      <div className="flex justify-between items-end px-1">
        <div className="flex flex-col gap-1">
           <span className={UI_LABEL}>Temporal map</span>
           <span className="text-[11px] text-white/60">
             {sceneName || 'ROOT_SCENE'} <span className="mx-1 opacity-30">//</span> {completedCount}/{shots.length} assets synced
           </span>
        </div>
        <div className="flex flex-col items-end gap-1">
           <span className={UI_LABEL}>Total runtime</span>
           <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">
             {totalDuration.toFixed(1)}s
           </span>
        </div>
      </div>

      {/* THE MAP SURFACE */}
      <div 
        ref={containerRef}
        className="relative h-24 w-full bg-[#050505] border border-white/5 overflow-hidden group flex"
      >
        {/* G1 RULER TICKS */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
           {Array.from({ length: Math.ceil(totalDuration) }).map((_, i) => (
             <div 
               key={i} 
               className="absolute top-0 bottom-0 border-l border-white/10"
               style={{ left: `${(i / totalDuration) * 100}%` }}
             >
               <span className="absolute top-1 left-1 text-[7px] font-mono opacity-20">{i}s</span>
             </div>
           ))}
        </div>

        {/* SHOT SEGMENTS */}
        <div className="relative z-10 flex w-full h-full">
          {shotsWithDuration.map((shot) => {
            const state = normalizeState(shot.state);
            const selected = shot.id === selectedShotId;
            const isLive = state === 'running';
            const review = shotReviewById?.[shot.id];
            const canonicalState = getCanonicalTimelineState(shot.state, review);
            const isFailed = canonicalState === 'failed' || canonicalState === 'rejected' || (shotReviewById?.[shot.id]?.riskLevel === 'high');
            const progress = state === 'completed' ? 100 : Math.max(0, Math.min(100, shot.progress ?? 0));
            const widthPercent = (shot.duration / totalDuration) * 100;

            return (
              <button
                key={shot.id}
                ref={(el) => { rowRefs.current[shot.id] = el; }}
                onClick={() => onSelectShot?.(shot.id)}
                style={{ width: `${widthPercent}%` }}
                className={`
                  relative h-full border-r border-white/[0.03] transition-all duration-300 flex flex-col justify-end p-2
                  ${selected ? 'bg-white/[0.06] z-20 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]' : 'hover:bg-white/[0.03]'}
                  ${isLive || isFailed ? 'z-30' : ''}
                `}
              >
                {/* STATE INDICATOR (Pulse for Live, Tint for Failed) */}
                {isLive && (
                  <div 
                    className="absolute inset-0 pointer-events-none animate-pulse z-0"
                    style={{ background: `linear-gradient(to top, ${accentColor}25 0%, transparent 80%)` }}
                  />
                )}
                {isFailed && (
                  <div 
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{ background: `linear-gradient(to top, rgba(244, 63, 94, 0.1) 0%, transparent 80%)` }}
                  />
                )}

                {/* ACTIVE RIDGE (Authority Highlight) */}
                {isLive && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-[3px] z-20"
                    style={{ backgroundColor: accentColor, boxShadow: `0 0 12px ${accentColor}` }}
                  />
                )}
                {isFailed && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-[3px] z-20 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                  />
                )}

                {/* PROGRESS BAR (Grounded) */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.02]">
                  <div 
                    className="h-full transition-all duration-500"
                    style={{ 
                      width: `${progress}%`,
                      backgroundColor: isLive ? accentColor : (isFailed ? '#f43f5e' : (canonicalState === 'completed' || canonicalState === 'approved' ? '#10b981' : '#334155')),
                      boxShadow: isLive ? `0 0-8px ${accentColor}` : 'none'
                    }}
                  />
                </div>

                {/* METADATA */}
                <div className="relative z-10 flex flex-col items-start gap-0.5 overflow-hidden">
                   <span className="text-[8px] font-mono text-white/20 tracking-widest truncate w-full text-left uppercase">
                     SH_{shot.order.toString().padStart(2, '0')}
                   </span>
                   <span className={`text-[10px] font-bold tracking-tight truncate w-full text-left ${selected ? 'text-white' : 'text-white/50'}`}>
                     {shot.title.replace(/^shot\s*\d+\s*:?\s*/i, '')}
                   </span>
                   <span className={`text-[7px] font-semibold uppercase tracking-[0.15em] ${toneByState[canonicalState] || 'text-white/10'}`}>
                     {canonicalState}
                   </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FOOTER: EMPTY STATE */}
      {!shots.length && (
        <div className="p-8 border border-dashed border-white/10 rounded flex items-center justify-center">
           <span className={UI_LABEL}>No sequence data found in registry</span>
        </div>
      )}
    </section>
  );
};

