type InterventionPriority = 'urgent' | 'high' | 'normal';

type InterventionItem = {
  id: string;
  title: string;
  sourceRunLabel?: string;
  sourceSceneLabel?: string;
  priority: InterventionPriority;
  confidenceGapLabel: string;
  trustStateLabel: string;
  agingLabel: string;
  canonicalStateLabel: string;
  evidenceSummary?: string;
  recommendationSummary?: string;
  decisionContextSummary?: string;
  auditTraceLabel?: string;
  latencyLabel?: string;
  stale?: boolean;
};

interface SCR05InterventionQueueProps {
  queueHealthLabel: string;
  urgentCount: number;
  agingCount: number;
  blockedCount: number;
  slaCounterLabel: string;
  quickPathLabel?: string;
  interventions?: InterventionItem[];
  selectedInterventionId?: string;
  onSelectIntervention?: (id: string) => void;
  onApprove?: (id: string) => void;
  onRevise?: (id: string) => void;
  onReject?: (id: string) => void;
  onSupersede?: (id: string) => void;
  onDefer?: (id: string) => void;
  onAssign?: (id: string) => void;
  onEscalate?: (id: string) => void;
  onJumpToRun?: (id: string) => void;
  onJumpToScene?: (id: string) => void;
  onConfirmAuditTrace?: (id: string) => void;
  onCreateQuickIntervention?: () => void;
}

const priorityTone: Record<InterventionPriority, string> = {
  urgent: 'border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] text-[var(--m6-state-critical-fg)]',
  high: 'border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] text-[var(--m6-state-warn-fg)]',
  normal: 'border-[var(--m6-state-focus-border)]/20 bg-cyan-500/10 text-cyan-100',
};

export const SCR05_InterventionQueue = ({
  queueHealthLabel,
  urgentCount,
  agingCount,
  blockedCount,
  slaCounterLabel,
  quickPathLabel,
  interventions = [],
  selectedInterventionId,
  onSelectIntervention,
  onApprove,
  onRevise,
  onReject,
  onSupersede,
  onDefer,
  onAssign,
  onEscalate,
  onJumpToRun,
  onJumpToScene,
  onConfirmAuditTrace,
  onCreateQuickIntervention,
}: SCR05InterventionQueueProps) => {
  const selected = interventions.find((item) => item.id === selectedInterventionId) ?? interventions[0];

  return (
    <main className="h-full min-w-0 p-3">
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3">
        <section className="m6-tier-2 rounded-md px-4 py-3 border border-[var(--m6-border-soft)]">
          <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-2 text-[10px] uppercase tracking-wide">
            <div className="rounded border border-[var(--dos-border)] bg-panel/45 px-2 py-1.5 text-textMuted">Queue Health: <span className="text-text/92">{queueHealthLabel}</span></div>
            <div className="rounded border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-2 py-1.5 text-[var(--m6-state-critical-fg)]">Urgent: {urgentCount}</div>
            <div className="rounded border border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] px-2 py-1.5 text-[var(--m6-state-warn-fg)]">Aging: {agingCount}</div>
            <div className="rounded border border-[var(--dos-border)] bg-panel/45 px-2 py-1.5 text-textMuted">Blocked: <span className="text-text/92">{blockedCount}</span></div>
            <div className="rounded border border-cyan-500/15 bg-cyan-500/8 px-2 py-1.5 text-cyan-100">SLA: {slaCounterLabel}</div>
            <div className="rounded border border-indigo-500/15 bg-indigo-500/10 px-2 py-1.5 text-indigo-100">path: {quickPathLabel ?? 'create → assign → resolve'}</div>
          </div>
        </section>

        <section className="grid min-h-0 gap-3 [grid-template-columns:minmax(0,11fr)_minmax(0,9fr)]">
          <section className="m6-tier-2 min-h-0 rounded-md p-3">
            <div className="m6-smalltext mb-2 text-[10px] font-normal uppercase tracking-[0.14em] text-slate-500/62">Intervention List</div>
            <div className="max-h-[58vh] space-y-1.5 overflow-auto pr-0.5">
              {interventions.length ? (
                interventions.map((item) => {
                  const isSelected = item.id === selected?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectIntervention?.(item.id)}
                      className={`w-full rounded border px-3 py-2 text-left transition-all ${isSelected ? 'border-[var(--m6-state-focus-border)]/40 bg-accent/12' : 'border-[var(--m6-border-soft)] bg-panel/45 hover:border-[var(--dos-border)] hover:bg-panel/52 hover:text-text/88'}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-[12px] font-bold text-text/92">{item.title}</span>
                        <span className="truncate text-[11px] text-textMuted/80">{item.evidenceSummary || 'No context provided'}</span>
                        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-textMuted/60">
                          <span className={`${item.priority === 'urgent' ? 'text-[var(--m6-state-critical-fg)] font-bold' : ''}`}>{item.priority}</span>
                          <span className="opacity-30">•</span>
                          <span>{item.trustStateLabel}</span>
                          <span className="opacity-30">•</span>
                          <span>{item.agingLabel}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded bg-panel/35 px-2 py-2 text-[11px] text-textMuted/75">No interventions queued.</div>
              )}
            </div>
          </section>

          <aside className="m6-tier-1 min-h-0 rounded-md p-4">
            <div className="m6-smalltext mb-2 text-[10px] font-normal uppercase tracking-[0.14em] text-slate-500/62">Intervention Detail</div>
            {selected ? (
              <div className="space-y-2 text-[11px]">
                <div className="rounded border border-[var(--dos-border)] bg-panel/45 px-2 py-1.5 text-text/92">{selected.title}</div>
                <div className="rounded border border-cyan-500/15 bg-cyan-500/10 px-2 py-1.5 text-[10px] uppercase tracking-wide text-cyan-100">canonical state: {selected.canonicalStateLabel}</div>
                <section className="rounded bg-panel/40 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-textMuted/80">Evidence</div>
                  <div className="text-text/90">{selected.evidenceSummary ?? 'No evidence summary provided.'}</div>
                </section>
                <section className="rounded bg-panel/40 p-3 ring-1 ring-white/5">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Next Move</div>
                  <div className="text-[12px] font-bold text-text/95">{selected.recommendationSummary ?? 'Pending Analysis...'}</div>
                  <div className="mt-1 text-[11px] text-textMuted/85">{selected.decisionContextSummary ?? 'Calculating optimal path...'}</div>
                </section>
                <section className="rounded bg-panel/20 p-2 border border-white/5">
                  <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-textMuted/60">Evidence Context</div>
                  <div className="text-[11px] text-textMuted/90">{selected.evidenceSummary ?? 'No evidence summary provided.'}</div>
                </section>
                <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
                  <button type="button" onClick={() => onAssign?.(selected.id)} className="rounded border border-[var(--dos-border)] px-2 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88">Assign</button>
                  <button type="button" onClick={() => onDefer?.(selected.id)} className="rounded border border-[var(--dos-border)] px-2 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88">Defer</button>
                  <button type="button" onClick={() => onEscalate?.(selected.id)} className="rounded border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-2 py-1 text-[var(--m6-state-critical-fg)]">Escalate</button>
                  <button type="button" onClick={() => onJumpToRun?.(selected.id)} className="rounded border border-[var(--m6-state-focus-border)]/20 bg-accent/10 px-2 py-1 text-accent">Open Run</button>
                  <button type="button" onClick={() => onJumpToScene?.(selected.id)} className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-indigo-100">Open Scene</button>
                  <button type="button" onClick={() => onConfirmAuditTrace?.(selected.id)} className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-100">Confirm Audit Trace</button>
                </div>
                {selected.auditTraceLabel ? <div className="text-[10px] uppercase tracking-wide text-textMuted/80">Audit: {selected.auditTraceLabel}</div> : null}
              </div>
            ) : (
              <div className="rounded bg-panel/35 px-2 py-2 text-[11px] text-textMuted/75">Select an intervention to inspect details.</div>
            )}
          </aside>
        </section>

        <section className="rounded-md border border-[var(--m6-border-soft)] bg-panel/40 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <button 
                type="button" 
                disabled={!selected} 
                onClick={() => selected && onApprove?.(selected.id)} 
                className="rounded-md bg-[#8144C0] px-6 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-purple-500/20 ring-1 ring-purple-400/30 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                Resolve
              </button>
              <div className="h-8 w-px bg-white/10 mx-2" />
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-50">
                <button type="button" disabled={!selected} onClick={() => selected && onAssign?.(selected.id)} className="px-2 py-1 hover:text-text hover:opacity-100 disabled:opacity-40">Assign</button>
                <button type="button" disabled={!selected} onClick={() => selected && onRevise?.(selected.id)} className="px-2 py-1 hover:text-text hover:opacity-100 disabled:opacity-40">Revise</button>
                <button type="button" disabled={!selected} onClick={() => selected && onReject?.(selected.id)} className="px-2 py-1 hover:text-text hover:opacity-100 disabled:opacity-40 text-[var(--m6-state-critical-fg)]">Escalate</button>
                <button type="button" disabled={!selected} onClick={() => selected && onDefer?.(selected.id)} className="px-2 py-1 hover:text-text hover:opacity-100 disabled:opacity-40">Defer</button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button type="button" disabled={!selected} onClick={() => selected && onSupersede?.(selected.id)} className="rounded border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-wide text-textMuted hover:bg-white/5 hover:text-text disabled:opacity-40">Close</button>
              <button type="button" onClick={onCreateQuickIntervention} className="rounded border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[10px] uppercase tracking-wide text-indigo-200 hover:bg-indigo-500/20">Manual Override</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
