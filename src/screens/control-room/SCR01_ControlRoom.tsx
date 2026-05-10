import { TelemetryKpiStrip } from '../../components/telemetry/TelemetryKpiStrip';
import type { TelemetryEnvelope } from '../../telemetry/selectors/directoros_kpi_selectors_cod_wip_v001';

interface ControlRoomPriorityItem {
  id: string;
  label: string;
  detail?: string;
  severity?: 'low' | 'medium' | 'high';
  href?: string;
}

interface ControlRoomEventItem {
  id: string;
  message: string;
  occurredAtLabel: string;
}

interface SCR01ControlRoomProps {
  systemHealth: string;
  streamState: string;
  streamTimestampLabel?: string;
  queueMode: string;
  activeRunLabel?: string;
  activeShotLabel?: string;
  throughputSeries?: number[];
  progressLabel?: string;
  riskLabel?: string;
  canonicalStateLabel: string;
  nextStepLabel?: string;
  alerts?: ControlRoomPriorityItem[];
  blockedDecisions?: ControlRoomPriorityItem[];
  interventions?: ControlRoomPriorityItem[];
  events?: ControlRoomEventItem[];
  telemetryEvents?: TelemetryEnvelope[];
  onOpenAttention?: () => void;
  onOpenWorkspace?: () => void;
  onOpenRun?: () => void;
  onSendToIntervention?: () => void;
  onOpenPriorityItem?: (item: ControlRoomPriorityItem) => void;
}

const severityTone: Record<NonNullable<ControlRoomPriorityItem['severity']>, string> = {
  low: ' bg-dos-sig-trust/10 text-dos-sig-trust/90',
  medium: ' bg-dos-sig-warning/10 text-dos-sig-warning/90',
  high: ' bg-dos-sig-warning/15 text-dos-sig-warning/95',
};

const MiniThroughput = ({ series = [] }: { series?: number[] }) => {
  if (!series.length) return <div className="text-[11px] text-textMuted/75">No throughput data yet.</div>;

  const max = Math.max(...series, 1);
  const points = series
    .map((value, index) => {
      const x = (index / Math.max(1, series.length - 1)) * 100;
      const y = 100 - (value / max) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
      <polyline points={points} fill="none" stroke="var(--dos-sig-runtime)" strokeWidth="2" />
    </svg>
  );
};

const PriorityPanel = ({
  title,
  items = [],
  onOpenItem,
}: {
  title: string;
  items?: ControlRoomPriorityItem[];
  onOpenItem?: (item: ControlRoomPriorityItem) => void;
}) => (
  <section className="rounded-md bg-dos-panel/45 p-2.5 border border-dos-border">
    <div className="mb-2 text-[10px] uppercase tracking-[0.13em] text-dos-text-muted/90">{title}</div>
    <div className="space-y-1.5">
      {items.length ? (
        items.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpenItem?.(item)} className="w-full rounded bg-dos-panel/45 px-2 py-1.5 text-left hover:bg-dos-panel/52 hover:text-dos-text/88">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-dos-text/92">{item.label}</span>
              {item.severity ? (
                <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${severityTone[item.severity]}`}>{item.severity}</span>
              ) : null}
            </div>
            {item.detail ? <div className="mt-1 text-[10px] text-dos-text-muted/80">{item.detail}</div> : null}
          </button>
        ))
      ) : (
        <div className="rounded bg-dos-panel/35 px-2 py-2 text-[11px] text-dos-text-muted/75">No items.</div>
      )}
    </div>
  </section>
);

export const SCR01_ControlRoom = ({
  systemHealth,
  streamState,
  streamTimestampLabel,
  queueMode,
  activeRunLabel,
  activeShotLabel,
  throughputSeries,
  progressLabel,
  riskLabel,
  canonicalStateLabel,
  nextStepLabel,
  alerts,
  blockedDecisions,
  interventions,
  events,
  telemetryEvents = [],
  onOpenAttention,
  onOpenWorkspace,
  onOpenRun,
  onSendToIntervention,
  onOpenPriorityItem,
}: SCR01ControlRoomProps) => {
  return (
    <main className="h-full min-w-0 p-3">
      <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto] gap-3">
        <section className="m6-tier-2 flex items-center justify-between rounded-md border border-dos-border px-4 py-2">
          <div className="flex items-center gap-6 text-[10px] uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${systemHealth === 'optimal' ? 'bg-dos-sig-trust' : 'bg-dos-sig-warning'} animate-pulse`} />
              <span className="text-dos-text-muted">Health: <span className="text-dos-text/92">{systemHealth}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${streamState === 'active' ? 'bg-dos-sig-runtime' : 'bg-dos-panel/60'}`} />
              <span className="text-dos-text-muted">Stream: <span className="text-dos-text/92">{streamState}</span> <span className="ml-1 opacity-40">({streamTimestampLabel ?? '—'})</span></span>
            </div>
            <div className="text-dos-text-muted">Queue: <span className="text-dos-text/92">{queueMode}</span></div>
            <div className="text-dos-text-muted">Active: <span className="text-dos-accent">{activeRunLabel ?? activeShotLabel ?? 'none'}</span></div>
          </div>
          <button type="button" onClick={onOpenAttention} className="rounded border border-dos-sig-warning/30 bg-dos-sig-warning/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-dos-sig-warning/90 hover:bg-dos-sig-warning/20">
            Attention → SCR-05
          </button>
        </section>

        <TelemetryKpiStrip events={telemetryEvents} />

        <section className="grid min-h-0 gap-3 [grid-template-columns:minmax(0,7fr)_minmax(0,3fr)]">
          <section className="m6-tier-1 rounded-md p-4 border border-dos-border">
            <div className="m6-section-title mb-2">Now Canvas</div>
            <div className="mb-3 rounded bg-dos-panel/40 p-2.5">
              <div className="mb-1 text-[11px] text-dos-text/90">Mini flow visualization (read-only)</div>
              <div className="rounded bg-dos-bg-pure/35 px-2 py-2 text-[10px] text-dos-text-muted/85">{activeShotLabel ?? 'No active shot'} → compile → route → render → review</div>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-1.5 text-[10px] uppercase tracking-wide">
              <span className="rounded bg-dos-panel/45 px-1.5 py-1 text-dos-text-muted">progress: <span className="text-dos-text/95">{progressLabel ?? '—'}</span></span>
              <span className="rounded bg-dos-panel/45 px-1.5 py-1 text-dos-text-muted">risk: <span className="text-dos-text/95">{riskLabel ?? '—'}</span></span>
              <span className="rounded bg-dos-sig-runtime/10 px-1.5 py-1 text-dos-sig-runtime/90">state: {canonicalStateLabel}</span>
              <span className="rounded bg-dos-panel/45 px-1.5 py-1 text-dos-text-muted">next: <span className="text-dos-text/95">{nextStepLabel ?? '—'}</span></span>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
              <button type="button" onClick={onOpenWorkspace} className="rounded bg-dos-accent/12 px-2 py-1 text-dos-accent">Open Workspace</button>
              <button type="button" onClick={onOpenRun} className="rounded px-2 py-1 text-dos-text-muted hover:bg-dos-panel/52 hover:text-dos-text/88">Open Run</button>
              <button type="button" onClick={onSendToIntervention} className="rounded bg-dos-sig-warning/10 px-2 py-1 text-dos-sig-warning/90">Send to Intervention</button>
            </div>
          </section>

          <section className="min-h-0 space-y-2.5">
            <PriorityPanel title="Alerts" items={alerts} onOpenItem={onOpenPriorityItem} />
            <PriorityPanel title="Blocked Decisions" items={blockedDecisions} onOpenItem={onOpenPriorityItem} />
            <PriorityPanel title="Interventions" items={interventions} onOpenItem={onOpenPriorityItem} />
          </section>
        </section>

        <section className="m6-tier-3 grid gap-3 rounded-md p-4 border border-dos-border md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-dos-text-muted/60">Throughput</div>
            <div className="rounded bg-dos-panel/40 px-2 py-1.5">
              <MiniThroughput series={throughputSeries} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.13em] text-dos-text-muted/85">Latest Events</div>
            <div className="max-h-20 space-y-1.5 overflow-auto rounded bg-dos-panel/40 p-2">
              {(events ?? []).length ? (
                events?.map((event) => (
                  <div key={event.id} className="rounded bg-dos-panel/35 px-2 py-1 text-[11px] text-dos-text/90">
                    <span className="text-dos-text-muted/75">{event.occurredAtLabel}</span> • {event.message}
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-dos-text-muted/75">No recent events.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
