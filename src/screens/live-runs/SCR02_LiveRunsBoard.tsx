import { DeliveryRegistry } from '../../components/review/DeliveryRegistry';
import { mapTechnicalState } from '../../utils/operationalLanguage';
import { EvidenceStack, type EvidenceItemData } from '../../components/shared/EvidenceStack';
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
  active: ' border-t border-dos-sig-continuity/40 bg-dos-panel/20',
  queued: ' border-t border-dos-border bg-dos-panel/10',
  attention: ' border-t border-dos-sig-warning/30 bg-dos-sig-warning/5',
};

const getCanonicalStateTone = (canonicalState: string) =>
  canonicalState === 'cancelled'
    ? 'rounded-sm border border-dos-sig-warning/20 bg-dos-sig-warning/5 text-dos-sig-warning/70'
    : canonicalState === 'failed'
      ? 'rounded-sm border border-dos-sig-warning/30 bg-dos-sig-warning/10 text-dos-sig-warning/90'
      : canonicalState === 'completed'
        ? 'rounded-sm border border-dos-sig-trust/20 bg-dos-sig-trust/5 text-dos-sig-trust/60'
        : 'rounded-sm border border-dos-sig-runtime/30 bg-dos-sig-runtime/10 text-dos-sig-runtime';

const getDetailLabels = (canonicalState: string) =>
  canonicalState === 'cancelled'
    ? { summaryLabel: 'Reason', summaryFallback: 'Cancelled by operator.', actionLabel: 'Action', actionFallback: 'Run again when ready.' }
    : canonicalState === 'completed'
      ? { summaryLabel: 'Reason', summaryFallback: 'Output is ready.', actionLabel: 'Action', actionFallback: 'Open output.' }
      : { summaryLabel: 'Reason', summaryFallback: 'Runtime stalled.', actionLabel: 'Action', actionFallback: 'Initiate recovery or inspect output.' };

const mapRunToEvidence = (run: LiveRunItem): EvidenceItemData[] => {
  const items: EvidenceItemData[] = [];
  
  if (run.diagnostics) {
    items.push({
      id: `${run.id}-diag`,
      label: 'System Diagnostic',
      value: run.diagnostics,
      state: run.canonicalState === 'running' ? 'active' : 'evidence',
      sourceLabel: 'Runtime'
    });
  }
  
  if (run.failureSummary) {
    items.push({
      id: `${run.id}-fail`,
      label: 'Critical Fault',
      value: run.failureSummary,
      state: 'broken',
      sourceLabel: 'Forensics'
    });
  }

  if (run.trustTraceSummary) {
    items.push({
      id: `${run.id}-trust`,
      label: 'Trust Verification',
      value: run.trustTraceSummary,
      state: 'sealed',
      sourceLabel: 'Registry'
    });
  }
  
  return items;
};

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
    <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-dos-border bg-dos-bg/40 px-4">
          <div className="grid w-full gap-4 lg:grid-cols-[auto_auto_1fr_auto]">
            <div className="flex items-center gap-1 rounded bg-dos-panel/30 p-1 text-[9px] font-mono uppercase tracking-wider">
              {(['cinematic', 'studio_run', 'all', 'delivery'] as RunMode[]).map((mode) => (
                <button key={mode} type="button" onClick={() => onModeFilterChange?.(mode)} className={`rounded px-2 py-0.5 transition-colors ${modeFilter === mode ? 'bg-dos-sig-continuity/20 text-dos-sig-continuity' : 'text-dos-text-muted/60 hover:bg-dos-panel/50 hover:text-dos-text/80'}`}>
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded bg-dos-panel/30 p-1 text-[9px] font-mono uppercase tracking-wider">
              {(['all', 'active', 'queued', 'attention'] as Array<RunLane | 'all'>).map((lane) => (
                <button key={lane} type="button" onClick={() => onLaneFilterChange?.(lane)} className={`rounded px-2 py-0.5 transition-colors ${laneFilter === lane ? 'bg-dos-sig-continuity/20 text-dos-sig-continuity' : 'text-dos-text-muted/60 hover:bg-dos-panel/50 hover:text-dos-text/80'}`}>
                  {lane}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {healthChips.length ? (
                healthChips.map((chip, index) => (
                  <span key={`${chip}-${index}`} className="text-[9px] uppercase tracking-[0.15em] text-dos-text-muted/50">
                    {chip}
                  </span>
                ))
              ) : (
                <span className="text-[9px] uppercase tracking-[0.15em] text-dos-text-muted/40">System Ready</span>
              )}
            </div>
            <select value={sortMode} onChange={(event) => onSortModeChange?.(event.target.value as 'priority' | 'newest' | 'oldest')} className="bg-transparent text-[9px] font-mono uppercase tracking-wider text-dos-text-muted/60 focus:outline-none cursor-pointer hover:text-dos-text/80 transition-colors">
              <option value="priority" className="bg-dos-bg">priority</option>
              <option value="newest" className="bg-dos-bg">newest</option>
              <option value="oldest" className="bg-dos-bg">oldest</option>
            </select>
          </div>
        </header>
        <section className="flex-1 min-h-0">
          {modeFilter === 'delivery' ? (
            <div className="h-full rounded-md bg-dos-sig-trust/5 p-4 m6-tier-1 border border-dos-border">
              <div className="mb-4 flex items-center justify-between border-b border-dos-sig-trust/10 pb-2 text-[10px] uppercase tracking-[0.15em]">
                <div className="flex items-center gap-3">
                  <span className="text-dos-sig-trust/80">Delivery Registry • Sealed Truth</span>
                  {sequenceReadiness && (
                    <span className={`rounded-sm px-2 py-0.5 font-bold transition-colors ${
                      activeSequenceSealEntry
                        ? 'bg-dos-sig-warning/20 text-dos-sig-warning'
                        : sequenceReadiness.isReady
                          ? 'bg-dos-sig-trust/20 text-dos-sig-trust'
                          : 'bg-dos-panel/40 text-dos-text-muted/70'
                    }`}>
                      {activeSequenceSealEntry ? 'APPROVED FOR DELIVERY' : sequenceReadiness.isReady ? 'READY TO APPROVE' : 'NOT READY'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {sequenceReadiness && !sequenceReadiness.isReady && sequenceReadiness.totalCount > 0 && (
                    <span className="text-[9px] text-dos-text-muted/60 normal-case tracking-normal">
                      Missing {sequenceReadiness.missingShots.length} shot{sequenceReadiness.missingShots.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-dos-sig-trust/80">{deliveryRegistryItems.length} / {sequenceReadiness?.totalCount ?? 0} Items</span>
                </div>
              </div>
              <div className="h-[calc(100%-2rem)] flex flex-col min-h-0">
                {sequenceReadiness?.totalCount === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-3 opacity-60">
                    <div className="h-px w-12 bg-dos-text-muted/20" />
                    <div className="text-[10px] uppercase tracking-[0.2em] text-dos-text-muted">No shots defined in active sequence</div>
                    <div className="text-[9px] text-dos-text-muted/60">Readiness check requires a populated timeline</div>
                    <div className="h-px w-12 bg-dos-text-muted/20" />
                  </div>
                ) : (
                  <DeliveryRegistry items={deliveryRegistryItems} onJumpToShot={onJumpToShot || (() => { })} />
                )}
                {/* Phase 4 Vector E — Seal Action Zone */}
                {sequenceReadiness && sequenceReadiness.totalCount > 0 && !activeSequenceSealEntry && sequenceReadiness.isReady && (
                  <div className="mt-4 flex items-center justify-between border-t border-dos-sig-trust/15 pt-4">
                    <span className="text-[9px] uppercase tracking-wider text-dos-text-muted/60">
                      All {sequenceReadiness.totalCount} shot{sequenceReadiness.totalCount !== 1 ? 's' : ''} confirmed
                    </span>
                    <button
                      id="btn-approve-sequence"
                      type="button"
                      onClick={onSealSequence}
                      className="rounded border border-dos-sig-trust/40 bg-dos-sig-trust/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-dos-sig-trust transition-all hover:bg-dos-sig-trust/28 hover:border-dos-sig-trust/60 active:scale-[0.97]"
                    >
                      Approve for Delivery
                    </button>
                  </div>
                )}
                {/* Phase 4 Vector E — Inline Seal Receipt */}
                {activeSequenceSealEntry && (
                  <div className="mt-4 flex items-center justify-between border-t border-dos-sig-trust/20 pt-4">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-dos-sig-trust">
                        ✦ Approved for Delivery
                      </div>
                      <div className="text-[9px] text-dos-text-muted/60">
                        {activeSequenceSealEntry.sealedShotCount} shot{activeSequenceSealEntry.sealedShotCount !== 1 ? 's' : ''}
                        {' · '}{activeSequenceSealEntry.sealedByLabel}
                        {' · '}{new Date(activeSequenceSealEntry.sealedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className="rounded-sm border border-dos-sig-trust/30 bg-dos-sig-trust/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-dos-sig-trust/80">
                      locked
                    </span>
                  </div>
                )}
                {sequenceReadiness && !sequenceReadiness.isReady && sequenceReadiness.totalCount > 0 && sequenceReadiness.missingShots.length > 0 && (
                  <div className="mt-4 border-t border-dos-sig-trust/10 pt-4">
                    <div className="mb-2 text-[9px] uppercase tracking-wider text-dos-text-muted/60 font-medium">Missing Approval for {sequenceReadiness.missingShots.length} shot{sequenceReadiness.missingShots.length > 1 ? 's' : ''}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sequenceReadiness.missingShots.map(shot => (
                        <button
                          key={shot.id}
                          onClick={() => onJumpToShot?.(shot.id)}
                          className="rounded-sm border border-dos-border bg-dos-panel/30 px-2 py-1 text-[10px] text-dos-text-muted hover:bg-dos-panel/50 hover:text-dos-text transition-all"
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
              <section className="grid min-h-0 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,0.9fr)]">
                {(['active', 'queued', 'attention'] as RunLane[]).map((lane) => (
                  <div key={lane} className={`flex flex-col min-h-0 rounded-md overflow-hidden ${laneTone[lane]} ${lane === 'active' ? 'shadow-[0_0_0_1px_rgba(207,140,255,0.04)]' : ''}`}>
                    <div className={`flex items-center justify-between border-b border-dos-border bg-dos-panel/10 px-3 text-[9px] uppercase tracking-[0.15em] font-bold ${lane === 'active' ? 'py-2.5 text-dos-text-muted/70' : 'py-2 text-dos-text-muted/50'}`}>
                      <span>{laneTitle[lane]}</span>
                      <span className="text-dos-text-muted/40">{runsByLane[lane].length}</span>
                    </div>
                    <div className={`flex-1 overflow-auto m6-scrollbar-thin ${lane === 'active' ? 'p-2 space-y-2' : 'p-1.5 space-y-1.5'}`}>
                      {runsByLane[lane].length ? (
                        runsByLane[lane].map((run) => {
                          const visuallySelected = run.id === selectedRun?.id;
                          const isActive = lane === 'active';
                          const isCompleted = run.canonicalState === 'completed';
                          const isSediment = (isCompleted || run.stale) && !visuallySelected;
                          const title = mapTechnicalState(run.canonicalState);
                          
                          return (
                            <button 
                              key={run.id} 
                              type="button" 
                              onClick={() => onSelectRun?.(run.id)} 
                              className={`group relative w-full overflow-hidden rounded-md border text-left transition-all duration-120 ${
                                visuallySelected
                                  ? 'border-dos-sig-continuity/60 bg-dos-sig-continuity/10 shadow-[0_6px_18px_rgba(207,140,255,0.10)]'
                                  : isSediment
                                    ? 'border-dos-border/30 bg-dos-panel/10 opacity-45 grayscale-[0.25] shadow-none hover:opacity-70 hover:bg-dos-panel/20 hover:border-dos-border/50'
                                    : isActive
                                      ? 'border-dos-sig-continuity/20 bg-dos-panel/35 shadow-sm hover:bg-dos-panel/55 hover:border-dos-sig-continuity/35'
                                      : 'border-dos-border/55 bg-dos-panel/22 shadow-sm hover:bg-dos-panel/40 hover:border-dos-border'
                              } ${isActive && !isSediment ? 'px-4 py-3.5' : isSediment ? 'px-2.5 py-1.5' : 'px-3 py-2.5'}`}
                            >
                              {visuallySelected && <div className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-dos-sig-continuity/80" />}
                              <div className="flex items-center justify-between gap-2">
                                <span className={`truncate font-medium tracking-tight ${visuallySelected ? 'text-white' : isSediment ? 'text-white/45' : isActive ? 'text-white/95' : 'text-white/70'} ${isActive && !isSediment ? 'text-[12px]' : isSediment ? 'text-[10px]' : 'text-[11px]'}`}>
                                  {run.label}
                                </span>
                                {run.pinned && <span className="text-[8px] text-dos-sig-warning/60 uppercase tracking-widest">pinned</span>}
                              </div>
                              <div className={`flex flex-wrap items-center ${isSediment ? 'mt-1 gap-1.5' : 'mt-1.5 gap-2'}`}>
                                <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getCanonicalStateTone(run.canonicalState)} ${isSediment ? 'opacity-70' : ''}`}>
                                  {title}
                                </span>
                                <span className={`font-mono uppercase tracking-tighter ${isSediment ? 'text-[8px] text-dos-text-muted/25' : 'text-[9px] text-dos-text-muted/40'}`}>
                                  {run.route}
                                </span>
                                {isActive && !isSediment && (
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <div className="h-1 w-1 rounded-full bg-dos-sig-continuity animate-pulse" />
                                    <span className="text-[8px] text-dos-sig-continuity/60 uppercase tracking-widest font-bold">Signal Live</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center h-24 rounded border border-dashed border-dos-border bg-dos-panel/5 text-[10px] text-dos-text-muted/40 italic">
                          No runs in lane.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </section>
              <aside className="flex flex-col overflow-hidden rounded-md border border-dos-border bg-dos-bg/20">
                <header className="flex h-10 shrink-0 items-center gap-3 border-b border-dos-border bg-dos-panel/20 px-3">
                  <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-dos-text-muted/50">
                    <div className="h-3 w-1 bg-dos-sig-continuity/60" />
                    Inspector
                  </div>
                </header>
                <div className="flex-1 overflow-auto p-4 space-y-4 m6-scrollbar-thin">
                  {selectedRun ? (
                    <div className="animate-in fade-in slide-in-from-right-1 duration-150 space-y-4">
                      <div className="space-y-1">
                        <div className="text-[8px] uppercase tracking-widest text-dos-text-muted/40 font-bold">Job Identity</div>
                        <div className="text-[11px] font-semibold text-dos-text/90 truncate">{selectedRun.label}</div>
                        <div className="text-[9px] font-mono text-dos-text-muted/30 uppercase tracking-tighter select-all">{selectedRun.id}</div>
                      </div>

                      <div className="grid gap-3 rounded-md border border-dos-border bg-dos-panel/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase text-dos-text-muted/40 tracking-tight">System State</span>
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getCanonicalStateTone(selectedRun.canonicalState)}`}>
                            {mapTechnicalState(selectedRun.canonicalState)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase text-dos-text-muted/40 tracking-tight">Active Route</span>
                          <span className="text-[10px] font-mono text-dos-text/60 uppercase">{selectedRun.route}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase text-dos-text-muted/40 tracking-tight">Latency</span>
                          <span className="text-[10px] text-dos-text/80 font-medium">{selectedRun.latencyLabel ?? 'steady'}</span>
                        </div>
                        
                        <div className="border-t border-dos-border/40 pt-3 mt-1">
                          <EvidenceStack 
                            title="Diagnostics" 
                            items={mapRunToEvidence(selectedRun)} 
                          />
                        </div>

                        <div className="border-t border-dos-border/40 pt-2">
                          <div className="text-[8px] uppercase tracking-widest text-dos-text-muted/40 font-bold mb-1">{selectedRunDetailLabels?.summaryLabel}</div>
                          <div className="text-[10.5px] text-dos-text/70 font-medium">
                            {selectedRun.failureSummary ?? selectedRunDetailLabels?.summaryFallback}
                          </div>
                        </div>

                        <div className="border-t border-dos-border/40 pt-2">
                          <div className="text-[8px] uppercase tracking-widest text-dos-text-muted/50 font-bold mb-1">Recommended Action</div>
                          <div className="text-[10.5px] text-dos-sig-continuity/90 font-bold tracking-tight">
                            {selectedRun.actionSuggestion ?? selectedRunDetailLabels?.actionFallback}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider font-bold">
                        <button type="button" onClick={() => onTogglePinRun?.(selectedRun.id)} className="rounded bg-dos-sig-warning/10 py-2 text-dos-sig-warning hover:bg-dos-sig-warning/15 transition-colors border border-dos-sig-warning/10">Pin</button>
                        <button type="button" onClick={() => onOpenWorkspace?.(selectedRun.id)} className="rounded bg-dos-sig-continuity/10 py-2 text-dos-sig-continuity hover:bg-dos-sig-continuity/20 transition-colors border border-dos-sig-continuity/20">Workspace</button>
                        <button type="button" onClick={() => onOpenOutputs?.(selectedRun.id)} className="rounded bg-dos-panel/30 py-2 text-dos-text-muted/80 hover:bg-dos-panel/50 hover:text-dos-text transition-all border border-dos-border">Open Output</button>
                        <button type="button" onClick={() => onOpenManifest?.(selectedRun.id)} className="rounded bg-dos-panel/30 py-2 text-dos-text-muted/80 hover:bg-dos-panel/50 hover:text-dos-text transition-all border border-dos-border">Manifest</button>
                        <button type="button" onClick={() => onEscalateToIntervention?.(selectedRun.id)} className="rounded bg-dos-sig-warning/10 py-2 text-dos-sig-warning hover:bg-dos-sig-warning/15 transition-colors border border-dos-sig-warning/10">Escalate</button>
                        <button type="button" onClick={() => onOpenCommandConsole?.(selectedRun.id)} className="rounded bg-indigo-500/10 py-2 text-indigo-400 hover:bg-indigo-500/15 transition-colors border border-indigo-500/10">Console</button>
                        {['queued', 'preflight', 'running', 'packaging'].includes(selectedRun.canonicalState) && (
                          <button type="button" onClick={() => onCancelRun?.(selectedRun.id)} className="rounded bg-dos-sig-warning/10 py-2 text-dos-sig-warning hover:bg-dos-sig-warning/20 transition-colors border border-dos-sig-warning/20">Cancel Run</button>
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
        <footer className="border-t border-dos-border bg-dos-bg/40 px-4 py-2">
          <div className="grid gap-8 md:grid-cols-2 text-[9px] font-mono uppercase tracking-[0.2em]">
            <div className="flex items-center gap-3">
              <span className="text-dos-text-muted/40">Queue Pressure:</span>
              <span className="text-dos-sig-runtime/70">{queuePressureLabel}</span>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <span className="text-dos-text-muted/40">SLA Drift:</span>
              <span className="text-dos-sig-warning/60">{slaDriftLabel}</span>
            </div>
          </div>
        </footer>
      </div>
    );
};
