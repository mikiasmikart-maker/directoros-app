type AuditEventStatus = 'ok' | 'info' | 'warning' | 'blocked' | 'error';

type AuditEventItem = {
  id: string;
  occurredAtLabel: string;
  eventTypeLabel: string;
  status: AuditEventStatus;
  runLabel?: string;
  actorLabel?: string;
  commandLabel?: string;
  outcomeLabel?: string;
  canonicalStateLabel: string;
  beforeContext?: string;
  afterContext?: string;
  trustDecisionSummary?: string;
  traceId?: string;
  linkedRunId?: string;
  linkedIntentId?: string;
};

interface SCR06AuditReplayTimelineProps {
  auditHealthLabel: string;
  eventCount: number;
  replayScopeLabel: string;
  timeWindowLabel: string;
  selectedEventsCount?: number;
  incidentPacketReadinessLabel?: string;
  latencyChipLabel?: string;
  waitStateLabel?: string;
  staleLabel?: string;
  reconciliationSteps?: string[];
  events?: AuditEventItem[];
  selectedEventId?: string;
  onSelectEvent?: (eventId: string) => void;
  onFilterByRun?: () => void;
  onFilterByActor?: () => void;
  onFilterByCommand?: () => void;
  onFilterByOutcome?: () => void;
  onStartReplay?: () => void;
  onPauseReplay?: () => void;
  onStepReplay?: () => void;
  onMoveTimeCursor?: () => void;
  onMoveEventCursor?: () => void;
  onJumpToRun?: (runId?: string) => void;
  onJumpToIntervention?: (intentId?: string) => void;
  onExportIncidentPacket?: () => void;
}

const statusTone: Record<AuditEventStatus, string> = {
  ok: ' bg-emerald-500/10 text-emerald-100',
  info: ' bg-cyan-500/10 text-cyan-100',
  warning: ' bg-amber-500/10 text-amber-100',
  blocked: ' bg-orange-500/10 text-orange-100',
  error: ' bg-rose-500/10 text-rose-100',
};

export const SCR06_AuditReplayTimeline = ({
  auditHealthLabel,
  eventCount,
  replayScopeLabel,
  timeWindowLabel,
  selectedEventsCount = 0,
  incidentPacketReadinessLabel = 'not ready',
  latencyChipLabel,
  waitStateLabel,
  staleLabel,
  reconciliationSteps = [],
  events = [],
  selectedEventId,
  onSelectEvent,
  onFilterByRun,
  onFilterByActor,
  onFilterByCommand,
  onFilterByOutcome,
  onStartReplay,
  onPauseReplay,
  onStepReplay,
  onMoveTimeCursor,
  onMoveEventCursor,
  onJumpToRun,
  onJumpToIntervention,
  onExportIncidentPacket,
}: SCR06AuditReplayTimelineProps) => {
  const selected = events.find((event) => event.id === selectedEventId) ?? events[0];

  return (
    <main className="h-full min-w-0 p-3">
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3">
        <section className="m6-tier-2 rounded-md p-3">
          <div className="grid gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] text-[10px] uppercase tracking-wide">
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">audit health: <span className="text-text/92">{auditHealthLabel}</span></div>
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">events: <span className="text-text/92">{eventCount}</span></div>
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">scope: <span className="text-text/92">{replayScopeLabel}</span></div>
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">window: <span className="text-text/92">{timeWindowLabel}</span></div>
            <button type="button" onClick={onExportIncidentPacket} className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-100">Export Incident Packet</button>
          </div>
          <div className="mt-2 grid gap-1.5 text-[10px] uppercase tracking-wide lg:grid-cols-3">
            <div className="rounded bg-cyan-500/8 px-2 py-1 text-cyan-100">latency: {latencyChipLabel ?? 'n/a'}</div>
            <div className="rounded bg-indigo-500/10 px-2 py-1 text-indigo-100">wait-state: {waitStateLabel ?? 'steady'}</div>
            <div className="rounded bg-amber-500/10 px-2 py-1 text-amber-100">stale: {staleLabel ?? 'fresh'}</div>
          </div>
        </section>

        <section className="grid min-h-0 gap-3 [grid-template-columns:minmax(0,13fr)_minmax(0,7fr)]">
          <section className="m6-tier-2 min-h-0 rounded-md p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="m6-smalltext text-[10px] font-normal uppercase tracking-[0.14em] text-slate-500/62">Append-only Event Stream</div>
              <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide">
                <button type="button" onClick={onFilterByRun} className="rounded bg-panel/45 px-2 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88text-text">run</button>
                <button type="button" onClick={onFilterByActor} className="rounded bg-panel/45 px-2 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88text-text">actor</button>
                <button type="button" onClick={onFilterByCommand} className="rounded bg-panel/45 px-2 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88text-text">command</button>
                <button type="button" onClick={onFilterByOutcome} className="rounded bg-panel/45 px-2 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88text-text">outcome</button>
              </div>
            </div>
            <div className="max-h-[56vh] space-y-1.5 overflow-auto pr-0.5 font-mono text-[10px]">
              {events.length ? (
                events.map((event) => {
                  const selectedRow = selected?.id === event.id;
                  return (
                    <button key={event.id} type="button" onClick={() => onSelectEvent?.(event.id)} className={`w-full rounded px-2 py-1.5 text-left ${selectedRow ? ' bg-accent/12' : ' bg-panel/45 hover:bg-panel/52 hover:text-text/88'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-text/92">{event.occurredAtLabel} • {event.eventTypeLabel}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${statusTone[event.status]}`}>{event.status}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase tracking-wide text-textMuted/85">
                        {event.runLabel ? <span className="rounded bg-panel/45 px-1 py-0.5">run {event.runLabel}</span> : null}
                        {event.actorLabel ? <span className="rounded bg-panel/45 px-1 py-0.5">actor {event.actorLabel}</span> : null}
                        {event.commandLabel ? <span className="rounded bg-panel/45 px-1 py-0.5">cmd {event.commandLabel}</span> : null}
                        {event.outcomeLabel ? <span className="rounded bg-panel/45 px-1 py-0.5">outcome {event.outcomeLabel}</span> : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="font-sans text-[11px] text-textMuted/75 rounded bg-panel/35 px-2 py-2">No events in selected scope.</div>
              )}
            </div>
          </section>

          <aside className="m6-tier-1 min-h-0 rounded-md p-4">
            <div className="m6-smalltext mb-2 text-[10px] font-normal uppercase tracking-[0.14em] text-slate-500/62">Replay Detail</div>
            {selected ? (
              <div className="space-y-2 text-[11px]">
                <div className="rounded bg-panel/45 px-2 py-1.5 text-text/92">{selected.eventTypeLabel}</div>
                <div className="rounded bg-cyan-500/10 px-2 py-1.5 text-[10px] uppercase tracking-wide text-cyan-100">canonical state: {selected.canonicalStateLabel}</div>
                <section className="rounded bg-panel/40 p-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-textMuted/58">Before Context</div>
                  <div className="text-text/90">{selected.beforeContext ?? 'No before context.'}</div>
                </section>
                <section className="rounded bg-panel/40 p-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-textMuted/58">After Context</div>
                  <div className="text-text/90">{selected.afterContext ?? 'No after context.'}</div>
                </section>
                <section className="rounded bg-violet-500/8 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-violet-100/85">Trust Decision Summary</div>
                  <div className="text-text/90">{selected.trustDecisionSummary ?? 'No trust decision summary.'}</div>
                </section>
                <section className="rounded bg-panel/40 p-2 text-[10px] uppercase tracking-wide text-textMuted/85">
                  <div>actor: <span className="text-text/92">{selected.actorLabel ?? 'n/a'}</span></div>
                  <div>trace id: <span className="text-text/92">{selected.traceId ?? 'n/a'}</span></div>
                </section>
                <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
                  <button type="button" onClick={() => onJumpToRun?.(selected.linkedRunId)} className="rounded bg-accent/10 px-2 py-1 text-accent">Open Linked Run</button>
                  <button type="button" onClick={() => onJumpToIntervention?.(selected.linkedIntentId)} className="rounded bg-rose-500/10 px-2 py-1 text-rose-100">Open Linked Intervention</button>
                </div>
              </div>
            ) : (
              <div className="rounded bg-panel/35 px-2 py-2 text-[11px] text-textMuted/75">Select an event to inspect replay detail.</div>
            )}
          </aside>
        </section>

        <section className="m6-tier-3 rounded-md p-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.13em] text-textMuted/90">Replay Controls</div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide">
                <button type="button" onClick={onStartReplay} className="rounded bg-emerald-500/10 px-2.5 py-1 text-emerald-100">Start</button>
                <button type="button" onClick={onPauseReplay} className="rounded bg-amber-500/10 px-2.5 py-1 text-amber-100">Pause</button>
                <button type="button" onClick={onStepReplay} className="rounded bg-cyan-500/10 px-2.5 py-1 text-cyan-100">Step</button>
                <button type="button" onClick={onMoveTimeCursor} className="rounded bg-panel/45 px-2.5 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88text-text">Time Cursor</button>
                <button type="button" onClick={onMoveEventCursor} className="rounded bg-panel/45 px-2.5 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88text-text">Event Cursor</button>
              </div>
              <div className="mt-2 rounded bg-panel/40 p-2 text-[10px] uppercase tracking-wide text-textMuted/85">
                <div className="mb-1 text-textMuted/75">reconciliation timeline</div>
                {reconciliationSteps.length ? (
                  <ul className="space-y-1">
                    {reconciliationSteps.map((step, idx) => <li key={`${step}-${idx}`} className="text-text/90">• {step}</li>)}
                  </ul>
                ) : (
                  <div className="text-text/80">No reconcile activity captured.</div>
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.13em] text-textMuted/90">Packet / Export Summary</div>
              <div className="space-y-1 rounded bg-panel/40 p-2 text-[10px] uppercase tracking-wide text-textMuted">
                <div>selected events: <span className="text-text/92">{selectedEventsCount}</span></div>
                <div>packet readiness: <span className="text-text/92">{incidentPacketReadinessLabel}</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
