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
                      className={`w-full rounded border px-2.5 py-1.5 text-left transition-all ${isSelected ? 'border-[var(--m6-state-focus-border)]/40 bg-accent/12' : 'border-[var(--m6-border-soft)] bg-panel/45 hover:border-[var(--dos-border)] hover:bg-panel/52 hover:text-text/88'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-text/92">{item.title}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide font-bold ${priorityTone[item.priority]}`}>{item.priority}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] uppercase tracking-wide text-textMuted/85">
                        <span className="rounded bg-panel/45 px-1 py-0.5">confidence gap: {item.confidenceGapLabel}</span>
                        <span className="rounded bg-panel/45 px-1 py-0.5">trust: {item.trustStateLabel}</span>
                        <span className="rounded bg-panel/45 px-1 py-0.5">aging: {item.agingLabel}</span>
                        <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-cyan-100">state: {item.canonicalStateLabel}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase tracking-wide text-textMuted/80">
                        <span className="rounded border border-[var(--dos-border)] bg-panel/45 px-1 py-0.5">latency: {item.latencyLabel ?? 'n/a'}</span>
                        {item.stale ? <span className="rounded border border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] px-1 py-0.5 text-[var(--m6-state-warn-fg)]">stale</span> : null}
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
                <section className="rounded bg-panel/40 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-textMuted/80">Recommendation</div>
                  <div className="text-text/90">{selected.recommendationSummary ?? 'No recommendation summary provided.'}</div>
                </section>
                <section className="rounded bg-panel/40 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-textMuted/80">Canonical Decision Context</div>
                  <div className="text-text/90">{selected.decisionContextSummary ?? 'No canonical decision context provided.'}</div>
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

        <section className="rounded-md border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--m6-state-critical-fg)]/90">Decision Action Rail</div>
            <button type="button" onClick={onCreateQuickIntervention} className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-indigo-100">Create Intervention</button>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
            <button type="button" disabled={!selected} onClick={() => selected && onApprove?.(selected.id)} className="rounded border border-[var(--m6-state-active-border)] bg-[var(--m6-state-active-bg)] px-2.5 py-1 text-[var(--m6-state-active-fg)] disabled:opacity-40">Resolve</button>
            <button type="button" disabled={!selected} onClick={() => selected && onAssign?.(selected.id)} className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-100 disabled:opacity-40">Assign</button>
            <button type="button" disabled={!selected} onClick={() => selected && onRevise?.(selected.id)} className="rounded border border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] px-2.5 py-1 text-[var(--m6-state-warn-fg)] disabled:opacity-40">Revise</button>
            <button type="button" disabled={!selected} onClick={() => selected && onReject?.(selected.id)} className="rounded border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-2.5 py-1 text-[var(--m6-state-critical-fg)] disabled:opacity-40">Escalate</button>
            <button type="button" disabled={!selected} onClick={() => selected && onSupersede?.(selected.id)} className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-indigo-100 disabled:opacity-40">Close</button>
            <button type="button" disabled={!selected} onClick={() => selected && onDefer?.(selected.id)} className="rounded border border-[var(--dos-border)] px-2.5 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88 disabled:opacity-40">Defer</button>
          </div>
        </section>
      </div>
    </main>
  );
};
