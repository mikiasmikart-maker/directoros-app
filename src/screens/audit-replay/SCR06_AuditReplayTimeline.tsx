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
  ok: ' bg-dos-sig-trust/10 text-dos-sig-trust/90',
  info: ' bg-dos-sig-runtime/10 text-dos-sig-runtime/90',
  warning: ' bg-dos-sig-warning/10 text-dos-sig-warning/90',
  blocked: ' bg-dos-sig-warning/12 text-dos-sig-warning/92',
  error: ' bg-dos-sig-warning/15 text-dos-sig-warning/95',
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
        <section className="m6-tier-2 rounded-md p-3 border border-dos-border">
          <div className="grid gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] text-[10px] uppercase tracking-wide">
            <div className="rounded bg-dos-panel/45 px-2 py-1.5 text-dos-text-muted">audit health: <span className="text-dos-text/92">{auditHealthLabel}</span></div>
            <div className="rounded bg-dos-panel/45 px-2 py-1.5 text-dos-text-muted">events: <span className="text-dos-text/92">{eventCount}</span></div>
            <div className="rounded bg-dos-panel/45 px-2 py-1.5 text-dos-text-muted">scope: <span className="text-dos-text/92">{replayScopeLabel}</span></div>
            <div className="rounded bg-dos-panel/45 px-2 py-1.5 text-dos-text-muted">window: <span className="text-dos-text/92">{timeWindowLabel}</span></div>
            <button type="button" onClick={onExportIncidentPacket} className="rounded bg-dos-sig-warning/10 px-2 py-1.5 text-dos-sig-warning/90">Export Incident Packet</button>
          </div>
          <div className="mt-2 grid gap-1.5 text-[10px] uppercase tracking-wide lg:grid-cols-3">
            <div className="rounded bg-dos-sig-runtime/8 px-2 py-1 text-dos-sig-runtime/90">latency: {latencyChipLabel ?? 'n/a'}</div>
            <div className="rounded bg-dos-sig-continuity/10 px-2 py-1 text-dos-sig-continuity/90">wait-state: {waitStateLabel ?? 'steady'}</div>
            <div className="rounded bg-dos-sig-warning/10 px-2 py-1 text-dos-sig-warning/90">stale: {staleLabel ?? 'fresh'}</div>
          </div>
        </section>

        <section className="grid min-h-0 gap-3 [grid-template-columns:minmax(0,13fr)_minmax(0,7fr)]">
          <section className="m6-tier-2 min-h-0 rounded-md p-3 border border-dos-border">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="m6-smalltext text-[10px] font-normal uppercase tracking-[0.14em] text-dos-text-muted/62">Append-only Event Stream</div>
              <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide">
                <button type="button" onClick={onFilterByRun} className="rounded bg-dos-panel/45 px-2 py-1 text-dos-text-muted hover:bg-dos-panel/52 hover:text-dos-text/88">run</button>
                <button type="button" onClick={onFilterByActor} className="rounded bg-dos-panel/45 px-2 py-1 text-dos-text-muted hover:bg-dos-panel/52 hover:text-dos-text/88">actor</button>
                <button type="button" onClick={onFilterByCommand} className="rounded bg-dos-panel/45 px-2 py-1 text-dos-text-muted hover:bg-dos-panel/52 hover:text-dos-text/88">command</button>
                <button type="button" onClick={onFilterByOutcome} className="rounded bg-dos-panel/45 px-2 py-1 text-dos-text-muted hover:bg-dos-panel/52 hover:text-dos-text/88">outcome</button>
              </div>
            </div>
            <div className="max-h-[56vh] space-y-1.5 overflow-auto pr-0.5 font-mono text-[10px]">
              {events.length ? (
                events.map((event) => {
                  const selectedRow = selected?.id === event.id;
                  return (
                    <button key={event.id} type="button" onClick={() => onSelectEvent?.(event.id)} className={`w-full rounded px-2 py-1.5 text-left transition-colors ${selectedRow ? ' bg-dos-sig-continuity/12' : ' bg-dos-panel/45 hover:bg-dos-panel/52 hover:text-dos-text/88'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-dos-text/92">{event.occurredAtLabel} • {event.eventTypeLabel}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${statusTone[event.status]}`}>{event.status}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase tracking-wide text-dos-text-muted/85">
                        {event.runLabel ? <span className="rounded bg-dos-panel/45 px-1 py-0.5">run {event.runLabel}</span> : null}
                        {event.actorLabel ? <span className="rounded bg-dos-panel/45 px-1 py-0.5">actor {event.actorLabel}</span> : null}
                        {event.commandLabel ? <span className="rounded bg-dos-panel/45 px-1 py-0.5">cmd {event.commandLabel}</span> : null}
                        {event.outcomeLabel ? <span className="rounded bg-dos-panel/45 px-1 py-0.5">outcome {event.outcomeLabel}</span> : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="font-sans text-[11px] text-dos-text-muted/75 rounded bg-dos-panel/35 px-2 py-2">No events in selected scope.</div>
              )}
            </div>
          </section>

          <aside className="m6-tier-1 min-h-0 rounded-md p-4 border border-dos-border">
            <div className="m6-smalltext mb-2 text-[10px] font-normal uppercase tracking-[0.14em] text-dos-text-muted/62">Replay Detail</div>
            {selected ? (
              <div className="space-y-2 text-[11px]">
                <div className="rounded bg-dos-panel/45 px-2 py-1.5 text-dos-text/92">{selected.eventTypeLabel}</div>
                <div className="rounded bg-dos-sig-runtime/10 px-2 py-1.5 text-[10px] uppercase tracking-wide text-dos-sig-runtime/90">canonical state: {selected.canonicalStateLabel}</div>
                <section className="rounded bg-dos-panel/40 p-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-dos-text-muted/58">Before Context</div>
                  <div className="text-dos-text/90">{selected.beforeContext ?? 'No before context.'}</div>
                </section>
                <section className="rounded bg-dos-panel/40 p-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-dos-text-muted/58">After Context</div>
                  <div className="text-dos-text/90">{selected.afterContext ?? 'No after context.'}</div>
                </section>
                <section className="rounded bg-dos-sig-continuity/8 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-sig-continuity/85">Trust Decision Summary</div>
                  <div className="text-dos-text/90">{selected.trustDecisionSummary ?? 'No trust decision summary.'}</div>
                </section>
                <section className="rounded bg-dos-panel/40 p-2 text-[10px] uppercase tracking-wide text-dos-text-muted/85">
                  <div>actor: <span className="text-dos-text/92">{selected.actorLabel ?? 'n/a'}</span></div>
                  <div>trace id: <span className="text-dos-text/92">{selected.traceId ?? 'n/a'}</span></div>
                </section>
                <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
                  <button type="button" onClick={() => onJumpToRun?.(selected.linkedRunId)} className="rounded bg-dos-sig-continuity/10 px-2 py-1 text-dos-sig-continuity">Open Linked Run</button>
                  <button type="button" onClick={() => onJumpToIntervention?.(selected.linkedIntentId)} className="rounded bg-dos-sig-warning/10 px-2 py-1 text-dos-sig-warning/90">Open Linked Intervention</button>
                </div>
              </div>
            ) : (
              <div className="rounded bg-dos-panel/35 px-2 py-2 text-[11px] text-dos-text-muted/75">Select an event to inspect replay detail.</div>
            )}
          </aside>
        </section>

        <section className="m6-tier-3 rounded-md p-3 border border-dos-border">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.13em] text-dos-text-muted/90">Replay Controls</div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide">
                <button type="button" onClick={onStartReplay} className="rounded bg-dos-sig-trust/10 px-2.5 py-1 text-dos-sig-trust/90">Start</button>
                <button type="button" onClick={onPauseReplay} className="rounded bg-dos-sig-warning/10 px-2.5 py-1 text-dos-sig-warning/90">Pause</button>
                <button type="button" onClick={onStepReplay} className="rounded bg-dos-sig-runtime/10 px-2.5 py-1 text-dos-sig-runtime/90">Step</button>
                <button type="button" onClick={onMoveTimeCursor} className="rounded bg-dos-panel/45 px-2.5 py-1 text-dos-text-muted hover:bg-dos-panel/52 hover:text-dos-text/88">Time Cursor</button>
                <button type="button" onClick={onMoveEventCursor} className="rounded bg-dos-panel/45 px-2.5 py-1 text-dos-text-muted hover:bg-dos-panel/52 hover:text-dos-text/88">Event Cursor</button>
              </div>
              <div className="mt-2 rounded bg-dos-panel/40 p-2 text-[10px] uppercase tracking-wide text-dos-text-muted/85">
                <div className="mb-1 text-dos-text-muted/75">reconciliation timeline</div>
                {reconciliationSteps.length ? (
                  <ul className="space-y-1">
                    {reconciliationSteps.map((step, idx) => <li key={`${step}-${idx}`} className="text-dos-text/90">• {step}</li>)}
                  </ul>
                ) : (
                  <div className="text-dos-text/80">No reconcile activity captured.</div>
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.13em] text-dos-text-muted/90">Packet / Export Summary</div>
              <div className="space-y-1 rounded bg-dos-panel/40 p-2 text-[10px] uppercase tracking-wide text-dos-text-muted">
                <div>selected events: <span className="text-dos-text/92">{selectedEventsCount}</span></div>
                <div>packet readiness: <span className="text-dos-text/92">{incidentPacketReadinessLabel}</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
