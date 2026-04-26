import { DeliveryRegistry } from '../../components/review/DeliveryRegistry';
type RunLane = 'active' | 'queued' | 'attention';
type RunMode = 'cinematic' | 'studio_run' | 'all' | 'delivery';

type LiveRunItem = {
  id: string;
  label: string;
  lane: RunLane;
  mode: Exclude<RunMode, 'all'>;
  canonicalState: string;
  route: string;
  diagnostics?: string;
  trustTraceSummary?: string;
  failureSummary?: string;
  actionSuggestion?: string;
  latencyLabel?: string;
  waitStateLabel?: string;
  stale?: boolean;
  pinned?: boolean;
};

interface SCR02LiveRunsBoardProps {
  modeFilter?: RunMode;
  laneFilter?: RunLane | 'all';
  sortMode?: 'priority' | 'newest' | 'oldest';
  healthChips?: string[];
  queuePressureLabel?: string;
  slaDriftLabel?: string;
  runs?: LiveRunItem[];
  selectedRunId?: string;
  onModeFilterChange?: (mode: RunMode) => void;
  onLaneFilterChange?: (lane: RunLane | 'all') => void;
  onSortModeChange?: (mode: 'priority' | 'newest' | 'oldest') => void;
  onSelectRun?: (runId: string) => void;
  onTogglePinRun?: (runId: string) => void;
  onOpenOutputs?: (runId: string) => void;
  onOpenManifest?: (runId: string) => void;
  onEscalateToIntervention?: (runId: string) => void;
  onOpenWorkspace?: (runId: string) => void;
  onOpenCommandConsole?: (runId: string) => void;
  onCancelRun?: (runId: string) => void;
  deliveryRegistryItems?: import('../../review/types').DeliveryRegistryItem[];
  sequenceReadiness?: import('../../review/types').SequenceReadiness;
  // Phase 4 Vector E: scene-keyed seal entry (undefined = not yet sealed)
  activeSequenceSealEntry?: { sealedAt: number; sealedByLabel: string; sealedShotCount: number };
  onSealSequence?: () => void;
  onJumpToShot?: (shotId: string) => void;
}

const laneTitle: Record<RunLane, string> = {
  active: 'Active',
  queued: 'Queued',
  attention: 'Attention',
};

const laneTone: Record<RunLane, string> = {
  active: ' border-t-2 border-[#8144C0] bg-panel/20',
  queued: ' border-t-2 border-white/5 bg-panel/10',
  attention: ' border-t-2 border-rose-500/20 bg-rose-500/5',
};

const getCanonicalStateTone = (canonicalState: string) =>
  canonicalState === 'cancelled'
    ? 'rounded-sm border border-amber-300/15 bg-amber-500/10 text-amber-100/70'
    : canonicalState === 'failed'
      ? 'rounded-sm border border-rose-300/25 bg-rose-500/10 text-rose-100/80'
      : canonicalState === 'completed'
        ? 'rounded-sm border border-emerald-300/15 bg-emerald-500/5 text-emerald-100/60'
        : 'rounded-sm border border-cyan-300/25 bg-cyan-500/10 text-cyan-100';

const getDetailLabels = (canonicalState: string) =>
  canonicalState === 'cancelled'
    ? { summaryLabel: 'Reason', summaryFallback: 'Cancelled by operator.', actionLabel: 'Action', actionFallback: 'Run again when ready.' }
    : canonicalState === 'completed'
      ? { summaryLabel: 'Reason', summaryFallback: 'Output is ready.', actionLabel: 'Action', actionFallback: 'Open output.' }
      : { summaryLabel: 'Reason', summaryFallback: 'Execution failed.', actionLabel: 'Action', actionFallback: 'Retry or inspect output.' };

export const SCR02_LiveRunsBoard = ({
  modeFilter = 'all',
  laneFilter = 'all',
  sortMode = 'priority',
  healthChips = [],
  deliveryRegistryItems = [],
  sequenceReadiness,
  activeSequenceSealEntry,
  onSealSequence,
  onJumpToShot,
  queuePressureLabel = 'stable',
  slaDriftLabel = 'within threshold',
  runs = [],
  selectedRunId,
  onModeFilterChange,
  onLaneFilterChange,
  onSortModeChange,
  onSelectRun,
  onTogglePinRun,
  onOpenOutputs,
  onOpenManifest,
  onEscalateToIntervention,
  onOpenWorkspace,
  onOpenCommandConsole,
  onCancelRun,
}: SCR02LiveRunsBoardProps) => {
  const filtered = runs.filter((run) => (modeFilter === 'all' ? true : run.mode === modeFilter) && (laneFilter === 'all' ? true : run.lane === laneFilter));
  const selectedRun = filtered.find((run) => run.id === selectedRunId) ?? filtered[0];
  const selectedRunDetailLabels = selectedRun ? getDetailLabels(selectedRun.canonicalState) : null;
  const runsByLane: Record<RunLane, LiveRunItem[]> = {
    active: filtered.filter((run) => run.lane === 'active'),
    queued: filtered.filter((run) => run.lane === 'queued'),
    attention: filtered.filter((run) => run.lane === 'attention'),
  };

  return (
    <main className="h-full min-w-0 bg-[#050505]">
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-white/5 bg-black/20 px-4">
          <div className="grid w-full gap-4 lg:grid-cols-[auto_auto_1fr_auto]">
            <div className="flex items-center gap-1 rounded bg-white/[0.03] p-1 text-[9px] font-mono uppercase tracking-wider">
              {(['cinematic', 'studio_run', 'all', 'delivery'] as RunMode[]).map((mode) => (
                <button key={mode} type="button" onClick={() => onModeFilterChange?.(mode)} className={`rounded px-2 py-0.5 transition-colors ${modeFilter === mode ? 'bg-[#8144C0]/20 text-[#8144C0]' : 'text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-300'}`}>
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded bg-white/[0.03] p-1 text-[9px] font-mono uppercase tracking-wider">
              {(['all', 'active', 'queued', 'attention'] as Array<RunLane | 'all'>).map((lane) => (
                <button key={lane} type="button" onClick={() => onLaneFilterChange?.(lane)} className={`rounded px-2 py-0.5 transition-colors ${laneFilter === lane ? 'bg-[#8144C0]/20 text-[#8144C0]' : 'text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-300'}`}>
                  {lane}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {healthChips.length ? (
                healthChips.map((chip, index) => (
                  <span key={`${chip}-${index}`} className="text-[9px] uppercase tracking-[0.15em] text-neutral-600">
                    {chip}
                  </span>
                ))
              ) : (
                <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-700">System Ready</span>
              )}
            </div>
            <select value={sortMode} onChange={(event) => onSortModeChange?.(event.target.value as 'priority' | 'newest' | 'oldest')} className="bg-transparent text-[9px] font-mono uppercase tracking-wider text-neutral-500 focus:outline-none">
              <option value="priority">priority</option>
              <option value="newest">newest</option>
              <option value="oldest">oldest</option>
            </select>
          </div>
        </header>
        <section className="flex-1 min-h-0">
          {modeFilter === 'delivery' ? (
            <div className="h-full rounded-md bg-emerald-500/5 p-4 m6-tier-1">
              <div className="mb-4 flex items-center justify-between border-b border-emerald-500/10 pb-2 text-[10px] uppercase tracking-[0.15em]">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400/80">Delivery Registry • Sealed Truth</span>
                  {sequenceReadiness && (
                    <span className={`rounded-sm px-2 py-0.5 font-bold transition-colors ${
                      activeSequenceSealEntry
                        ? 'bg-amber-500/20 text-amber-300'
                        : sequenceReadiness.isReady
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-panel/40 text-textMuted/70'
                    }`}>
                      {activeSequenceSealEntry ? 'APPROVED FOR DELIVERY' : sequenceReadiness.isReady ? 'READY TO APPROVE' : 'NOT READY'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {sequenceReadiness && !sequenceReadiness.isReady && sequenceReadiness.totalCount > 0 && (
                    <span className="text-[9px] text-textMuted/60 normal-case tracking-normal">
                      Missing {sequenceReadiness.missingShots.length} shot{sequenceReadiness.missingShots.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-emerald-400/80">{deliveryRegistryItems.length} / {sequenceReadiness?.totalCount ?? 0} Items</span>
                </div>
              </div>
              <div className="h-[calc(100%-2rem)] flex flex-col min-h-0">
                {sequenceReadiness?.totalCount === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-3 opacity-60">
                    <div className="h-px w-12 bg-textMuted/20" />
                    <div className="text-[10px] uppercase tracking-[0.2em] text-textMuted">No shots defined in active sequence</div>
                    <div className="text-[9px] text-textMuted/60">Readiness check requires a populated timeline</div>
                    <div className="h-px w-12 bg-textMuted/20" />
                  </div>
                ) : (
                  <DeliveryRegistry items={deliveryRegistryItems} onJumpToShot={onJumpToShot || (() => { })} />
                )}
                {/* Phase 4 Vector E — Seal Action Zone */}
                {sequenceReadiness && sequenceReadiness.totalCount > 0 && !activeSequenceSealEntry && sequenceReadiness.isReady && (
                  <div className="mt-4 flex items-center justify-between border-t border-emerald-500/15 pt-4">
                    <span className="text-[9px] uppercase tracking-wider text-textMuted/60">
                      All {sequenceReadiness.totalCount} shot{sequenceReadiness.totalCount !== 1 ? 's' : ''} confirmed
                    </span>
                    <button
                      id="btn-approve-sequence"
                      type="button"
                      onClick={onSealSequence}
                      className="rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 transition-all hover:bg-emerald-500/28 hover:border-emerald-500/60 active:scale-[0.97]"
                    >
                      Approve for Delivery
                    </button>
                  </div>
                )}
                {/* Phase 4 Vector E — Inline Seal Receipt */}
                {activeSequenceSealEntry && (
                  <div className="mt-4 flex items-center justify-between border-t border-emerald-500/20 pt-4">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                        ✦ Approved for Delivery
                      </div>
                      <div className="text-[9px] text-textMuted/60">
                        {activeSequenceSealEntry.sealedShotCount} shot{activeSequenceSealEntry.sealedShotCount !== 1 ? 's' : ''}
                        {' · '}{activeSequenceSealEntry.sealedByLabel}
                        {' · '}{new Date(activeSequenceSealEntry.sealedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-emerald-400/80">
                      locked
                    </span>
                  </div>
                )}
                {sequenceReadiness && !sequenceReadiness.isReady && sequenceReadiness.totalCount > 0 && sequenceReadiness.missingShots.length > 0 && (
                  <div className="mt-4 border-t border-emerald-500/10 pt-4">
                    <div className="mb-2 text-[9px] uppercase tracking-wider text-textMuted/60 font-medium">Missing Approval for {sequenceReadiness.missingShots.length} shot{sequenceReadiness.missingShots.length > 1 ? 's' : ''}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sequenceReadiness.missingShots.map(shot => (
                        <button
                          key={shot.id}
                          onClick={() => onJumpToShot?.(shot.id)}
                          className="rounded-sm border border-panel/50 bg-panel/30 px-2 py-1 text-[10px] text-textMuted hover:bg-panel/50 hover:text-text transition-all"
                        >
                          {shot.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-0 gap-3 [grid-template-columns:minmax(0,13fr)_minmax(0,7fr)]">
              <section className="grid min-h-0 gap-3 md:grid-cols-3">
                {(['active', 'queued', 'attention'] as RunLane[]).map((lane) => (
                  <div key={lane} className={`flex flex-col min-h-0 rounded-md overflow-hidden ${laneTone[lane]}`}>
                    <div className="flex items-center justify-between border-b border-white/[0.03] bg-black/10 px-3 py-2 text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-bold">
                      <span>{laneTitle[lane]}</span>
                      <span className="text-neutral-700">{runsByLane[lane].length}</span>
                    </div>
                    <div className="flex-1 overflow-auto m6-scrollbar-thin p-1.5 space-y-1.5">
                      {runsByLane[lane].length ? (
                        runsByLane[lane].map((run) => {
                          const selected = run.id === selectedRunId;
                          const isActive = lane === 'active';
                          const isFailed = run.canonicalState === 'failed';
                          const isCompleted = run.canonicalState === 'completed';
                          
                          const title = run.canonicalState === 'completed' ? 'Completed' : run.canonicalState === 'failed' ? 'Failed' : run.canonicalState === 'cancelled' ? 'Cancelled' : run.canonicalState;
                          
                          return (
                            <button 
                              key={run.id} 
                              type="button" 
                              onClick={() => onSelectRun?.(run.id)} 
                              className={`group relative w-full rounded-md border px-3.5 py-3 text-left transition-all duration-120 ${
                                selected 
                                  ? 'border-[#8144C0]/40 bg-[#8144C0]/10 shadow-[0_4px_16px_rgba(129,68,192,0.12)]' 
                                  : 'border-white/[0.06] bg-panel/40 hover:bg-panel/52 hover:border-white/[0.12] shadow-sm'
                              } ${isCompleted && !selected ? 'opacity-60 grayscale-[0.5]' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`truncate text-[11px] font-medium tracking-tight ${selected ? 'text-white' : isActive ? 'text-white/90' : 'text-white/70'}`}>
                                  {run.label}
                                </span>
                                {run.pinned && <span className="text-[8px] text-amber-500/60 uppercase tracking-widest">pinned</span>}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getCanonicalStateTone(run.canonicalState)}`}>
                                  {title}
                                </span>
                                <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter">
                                  {run.route}
                                </span>
                                {isActive && (
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <div className="h-1 w-1 rounded-full bg-[#8144C0] animate-pulse" />
                                    <span className="text-[8px] text-[#8144C0]/60 uppercase tracking-widest font-bold">Signal Live</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center h-24 rounded border border-dashed border-white/5 bg-white/[0.01] text-[10px] text-neutral-700 italic">
                          No runs in lane.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </section>
              <aside className="flex flex-col overflow-hidden rounded-sm border border-white/5 bg-black/10">
                <header className="flex h-10 shrink-0 items-center gap-3 border-b border-white/5 bg-black/20 px-3">
                  <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">
                    <div className="h-3 w-1 bg-[#8144C0]" />
                    Inspector
                  </div>
                </header>
                <div className="flex-1 overflow-auto p-4 space-y-4 m6-scrollbar-thin">
                  {selectedRun ? (
                    <div className="animate-in fade-in slide-in-from-right-1 duration-150 space-y-4">
                      <div className="space-y-1">
                        <div className="text-[8px] uppercase tracking-widest text-neutral-500 font-bold">Job Identity</div>
                        <div className="text-[11px] font-semibold text-slate-200 truncate">{selectedRun.label}</div>
                        <div className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter select-all">{selectedRun.id}</div>
                      </div>

                      <div className="grid gap-3 rounded-md border border-white/[0.03] bg-white/[0.01] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.005)]">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-tight">System State</span>
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getCanonicalStateTone(selectedRun.canonicalState)}`}>
                            {selectedRun.canonicalState}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-tight">Active Route</span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">{selectedRun.route}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-tight">Latency</span>
                          <span className="text-[10px] text-slate-300 font-medium">{selectedRun.latencyLabel ?? 'steady'}</span>
                        </div>
                        
                        <div className="border-t border-white/[0.03] pt-2 mt-1">
                          <div className="text-[8px] uppercase tracking-widest text-neutral-600 font-bold mb-1">Diagnostics</div>
                          <div className="text-[10px] text-slate-400 leading-relaxed italic">
                            {selectedRun.diagnostics ?? 'No diagnostic signals recorded.'}
                          </div>
                        </div>

                        <div className="border-t border-white/[0.03] pt-2">
                          <div className="text-[8px] uppercase tracking-widest text-neutral-600 font-bold mb-1">{selectedRunDetailLabels?.summaryLabel}</div>
                          <div className="text-[10.5px] text-slate-300 font-medium">
                            {selectedRun.failureSummary ?? selectedRunDetailLabels?.summaryFallback}
                          </div>
                        </div>

                        <div className="border-t border-white/[0.03] pt-2">
                          <div className="text-[8px] uppercase tracking-widest text-neutral-600 font-bold mb-1">Recommended Action</div>
                          <div className="text-[10.5px] text-[#8144C0] font-bold tracking-tight">
                            {selectedRun.actionSuggestion ?? selectedRunDetailLabels?.actionFallback}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider font-bold">
                        <button type="button" onClick={() => onTogglePinRun?.(selectedRun.id)} className="rounded bg-amber-500/10 py-2 text-amber-500/80 hover:bg-amber-500/15 transition-colors border border-amber-500/10">Pin</button>
                        <button type="button" onClick={() => onOpenWorkspace?.(selectedRun.id)} className="rounded bg-[#8144C0]/10 py-2 text-[#8144C0] hover:bg-[#8144C0]/20 transition-colors border border-[#8144C0]/20">Workspace</button>
                        <button type="button" onClick={() => onOpenOutputs?.(selectedRun.id)} className="rounded bg-white/[0.03] py-2 text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-all border border-white/5">Open Output</button>
                        <button type="button" onClick={() => onOpenManifest?.(selectedRun.id)} className="rounded bg-white/[0.03] py-2 text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-all border border-white/5">Manifest</button>
                        <button type="button" onClick={() => onEscalateToIntervention?.(selectedRun.id)} className="rounded bg-rose-500/10 py-2 text-rose-500/80 hover:bg-rose-500/15 transition-colors border border-rose-500/10">Escalate</button>
                        <button type="button" onClick={() => onOpenCommandConsole?.(selectedRun.id)} className="rounded bg-indigo-500/10 py-2 text-indigo-400 hover:bg-indigo-500/15 transition-colors border border-indigo-500/10">Console</button>
                        {['queued', 'preflight', 'running', 'packaging'].includes(selectedRun.canonicalState) && (
                          <button type="button" onClick={() => onCancelRun?.(selectedRun.id)} className="rounded bg-rose-500/10 py-2 text-rose-500 hover:bg-rose-500/20 transition-colors border border-rose-500/20">Cancel Run</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-8 opacity-20 text-center space-y-2">
                      <div className="text-[9px] uppercase tracking-[0.3em]">Awaiting Selection</div>
                      <div className="text-[10px] italic">Select a job for diagnostics</div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </section>
        <footer className="border-t border-white/5 bg-black/40 px-4 py-2">
          <div className="grid gap-8 md:grid-cols-2 text-[9px] font-mono uppercase tracking-[0.2em]">
            <div className="flex items-center gap-3">
              <span className="text-neutral-600">Queue Pressure:</span>
              <span className="text-cyan-400/80">{queuePressureLabel}</span>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <span className="text-neutral-600">SLA Drift:</span>
              <span className="text-amber-500/60">{slaDriftLabel}</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
};
