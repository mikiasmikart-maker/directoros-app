import { EvidenceStack } from '../../components/shared/EvidenceStack';

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
    <div className="flex h-full flex-col p-3">
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3">
        <section className="m6-tier-2 rounded-md px-4 py-3 border border-dos-border">
          <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-2 text-[10px] uppercase tracking-wide">
            <div className="rounded border border-dos-border bg-dos-panel/45 px-2 py-1.5 text-dos-text-muted/60">Queue Health: <span className="text-dos-text/90">{queueHealthLabel}</span></div>
            <div className="rounded border border-dos-sig-warning/30 bg-dos-sig-warning/8 px-2 py-1.5 text-dos-sig-warning/90">Urgent: {urgentCount}</div>
            <div className="rounded border border-dos-sig-drift/30 bg-dos-sig-drift/8 px-2 py-1.5 text-dos-sig-drift/90">Aging: {agingCount}</div>
            <div className="rounded border border-dos-border bg-dos-panel/45 px-2 py-1.5 text-dos-text-muted/60">Blocked: <span className="text-dos-text/90">{blockedCount}</span></div>
            <div className="rounded border border-dos-sig-continuity/30 bg-dos-sig-continuity/8 px-2 py-1.5 text-dos-sig-continuity/90">SLA: {slaCounterLabel}</div>
            <div className="rounded border border-dos-sig-continuity/30 bg-dos-sig-continuity/8 px-2 py-1.5 text-dos-sig-continuity/90">path: {quickPathLabel ?? 'create → assign → resolve'}</div>
          </div>
        </section>

        <section className="grid min-h-0 gap-3 [grid-template-columns:minmax(0,11fr)_minmax(0,9fr)]">
          <section className="m6-tier-2 min-h-0 rounded-md p-3">
            <div className="m6-smalltext mb-2 text-[10px] font-normal uppercase tracking-[0.14em] text-dos-text-muted/60">Intervention List</div>
            <div className="max-h-[58vh] space-y-1.5 overflow-auto pr-0.5">
              {interventions.length ? (
                interventions.map((item) => {
                  const isSelected = item.id === selected?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectIntervention?.(item.id)}
                      className={`w-full rounded border px-3 py-2 text-left transition-all ${isSelected ? 'border-dos-sig-continuity/40 bg-dos-sig-continuity/12 shadow-[0_4px_16px_rgba(207,140,255,0.12)]' : 'border-dos-border bg-dos-panel/40 hover:border-dos-border hover:bg-dos-panel/50 hover:text-dos-text/90'}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-[12px] font-bold text-dos-text/90">{item.title}</span>
                        <span className="truncate text-[11px] text-dos-text-muted/80">{item.evidenceSummary || 'No context provided'}</span>
                        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-dos-text-muted/60">
                          <span className={`${item.priority === 'urgent' ? 'text-dos-sig-warning font-bold' : ''}`}>{item.priority}</span>
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
                <div className="rounded border border-dos-border bg-dos-panel/40 px-2 py-2 text-[11px] text-dos-text-muted/80">No interventions queued.</div>
              )}
            </div>
          </section>

          <aside className="m6-tier-1 min-h-0 rounded-md p-4">
            <div className="m6-smalltext mb-2 text-[10px] font-normal uppercase tracking-[0.14em] text-dos-text-muted/60">Intervention Detail</div>
            {selected ? (
              <div className="space-y-2 text-[11px]">
                <div className="rounded border border-dos-border bg-dos-panel/40 px-2 py-1.5 text-dos-text/90">{selected.title}</div>
                <div className="rounded border border-dos-sig-runtime/20 bg-dos-sig-runtime/10 px-2 py-1.5 text-[10px] uppercase tracking-wide text-dos-sig-runtime/90">canonical state: {selected.canonicalStateLabel}</div>
                <section className="rounded bg-dos-panel/40 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-text-muted/80">Evidence</div>
                  <div className="text-dos-text/90">{selected.evidenceSummary ?? 'No evidence summary provided.'}</div>
                </section>
                <section className="rounded bg-dos-panel/40 p-3 ring-1 ring-dos-border">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-dos-sig-runtime">Next Move</div>
                  <div className="text-[12px] font-bold text-dos-text/90">{selected.recommendationSummary ?? 'Pending Analysis...'}</div>
                  <div className="mt-1 text-[11px] text-dos-text-muted/80">{selected.decisionContextSummary ?? 'Calculating optimal path...'}</div>
                </section>
                <EvidenceStack
                  title="Evidence Context"
                  items={[
                    {
                      id: 'evidence_summary',
                      label: selected.evidenceSummary ?? 'No evidence summary provided.',
                      state: 'evidence',
                      sourceLabel: selected.sourceRunLabel ?? 'UNKNOWN_RUN',
                    },
                    {
                      id: 'trust_state',
                      label: selected.trustStateLabel,
                      state: selected.priority === 'urgent' ? 'warning' : 'sealed',
                      sourceLabel: 'TRUST_GATE',
                    },
                  ]}
                />
                <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
                  <button type="button" onClick={() => onAssign?.(selected.id)} className="rounded border border-dos-border px-2 py-1 text-dos-text-muted/80 hover:bg-dos-panel/50 hover:text-dos-text/90">Assign</button>
                  <button type="button" onClick={() => onDefer?.(selected.id)} className="rounded border border-dos-border px-2 py-1 text-dos-text-muted/80 hover:bg-dos-panel/50 hover:text-dos-text/90">Defer</button>
                  <button type="button" onClick={() => onEscalate?.(selected.id)} className="rounded border border-dos-sig-warning/40 bg-dos-sig-warning/10 px-2 py-1 text-dos-sig-warning">Escalate</button>
                  <button type="button" onClick={() => onJumpToRun?.(selected.id)} className="rounded border border-dos-sig-runtime/30 bg-dos-sig-runtime/10 px-2 py-1 text-dos-sig-runtime">Open Run</button>
                  <button type="button" onClick={() => onJumpToScene?.(selected.id)} className="rounded border border-dos-sig-continuity/30 bg-dos-sig-continuity/10 px-2 py-1 text-dos-sig-continuity">Open Scene</button>
                  <button type="button" onClick={() => onConfirmAuditTrace?.(selected.id)} className="rounded border border-dos-sig-runtime/30 bg-dos-sig-runtime/10 px-2 py-1 text-dos-sig-runtime">Confirm Audit Trace</button>
                </div>
                {selected.auditTraceLabel ? <div className="text-[10px] uppercase tracking-wide text-dos-text-muted/80">Audit: {selected.auditTraceLabel}</div> : null}
              </div>
            ) : (
              <div className="rounded bg-dos-panel/40 px-2 py-2 text-[11px] text-dos-text-muted/80">Select an intervention to inspect details.</div>
            )}
          </aside>
        </section>

        <section className="rounded-md border border-dos-border bg-dos-panel/40 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <button 
                type="button" 
                disabled={!selected} 
                onClick={() => selected && onApprove?.(selected.id)} 
                className="rounded-md bg-dos-sig-continuity px-6 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-dos-sig-continuity/20 ring-1 ring-dos-sig-continuity/30 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                Resolve
              </button>
              <div className="h-8 w-px bg-dos-border mx-2" />
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-50">
                <button type="button" disabled={!selected} onClick={() => selected && onAssign?.(selected.id)} className="px-2 py-1 hover:text-dos-text hover:opacity-100 disabled:opacity-40">Assign</button>
                <button type="button" disabled={!selected} onClick={() => selected && onRevise?.(selected.id)} className="px-2 py-1 hover:text-dos-text hover:opacity-100 disabled:opacity-40">Revise</button>
                <button type="button" disabled={!selected} onClick={() => selected && onReject?.(selected.id)} className="px-2 py-1 hover:text-dos-text hover:opacity-100 disabled:opacity-40 text-dos-sig-warning">Escalate</button>
                <button type="button" disabled={!selected} onClick={() => selected && onDefer?.(selected.id)} className="px-2 py-1 hover:text-dos-text hover:opacity-100 disabled:opacity-40">Defer</button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button type="button" disabled={!selected} onClick={() => selected && onSupersede?.(selected.id)} className="rounded border border-dos-border px-3 py-1.5 text-[10px] uppercase tracking-wide text-dos-text-muted/80 hover:bg-dos-panel/50 hover:text-dos-text disabled:opacity-40">Close</button>
              <button type="button" onClick={onCreateQuickIntervention} className="rounded border border-dos-sig-continuity/30 bg-dos-sig-continuity/10 px-3 py-1.5 text-[10px] uppercase tracking-wide text-dos-sig-continuity/90 hover:bg-dos-sig-continuity/20">Manual Override</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
