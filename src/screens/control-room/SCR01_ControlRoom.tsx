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
  low: ' bg-emerald-500/10 text-emerald-100',
  medium: ' bg-amber-500/10 text-amber-100',
  high: ' bg-rose-500/10 text-rose-100',
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
      <polyline points={points} fill="none" stroke="rgba(125,211,252,0.85)" strokeWidth="2" />
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
  <section className="rounded-md bg-panel/45 p-2.5">
    <div className="mb-2 text-[10px] uppercase tracking-[0.13em] text-textMuted/90">{title}</div>
    <div className="space-y-1.5">
      {items.length ? (
        items.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpenItem?.(item)} className="w-full rounded bg-panel/45 px-2 py-1.5 text-left hover:bg-panel/52 hover:text-text/88">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-text/92">{item.label}</span>
              {item.severity ? (
                <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${severityTone[item.severity]}`}>{item.severity}</span>
              ) : null}
            </div>
            {item.detail ? <div className="mt-1 text-[10px] text-textMuted/80">{item.detail}</div> : null}
          </button>
        ))
      ) : (
        <div className="rounded bg-panel/35 px-2 py-2 text-[11px] text-textMuted/75">No items.</div>
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
        <section className="m6-tier-2 rounded-md px-4 py-3">
          <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_auto] gap-2 text-[10px] uppercase tracking-wide">
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">health: <span className="text-text/95">{systemHealth}</span></div>
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">stream: <span className="text-text/95">{streamState}</span></div>
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">time: <span className="text-text/95">{streamTimestampLabel ?? '—'}</span></div>
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">queue: <span className="text-text/95">{queueMode}</span></div>
            <div className="rounded bg-panel/45 px-2 py-1.5 text-textMuted">active: <span className="text-text/95">{activeRunLabel ?? activeShotLabel ?? 'none'}</span></div>
            <button type="button" onClick={onOpenAttention} className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-100 hover:bg-panel/52 hover:text-text/88">
              Attention → SCR-05
            </button>
          </div>
        </section>

        <TelemetryKpiStrip events={telemetryEvents} />

        <section className="grid min-h-0 gap-3 [grid-template-columns:minmax(0,7fr)_minmax(0,3fr)]">
          <section className="m6-tier-1 rounded-md p-4">
            <div className="m6-section-title mb-2">Now Canvas</div>
            <div className="mb-3 rounded bg-panel/40 p-2.5">
              <div className="mb-1 text-[11px] text-text/90">Mini flow visualization (read-only)</div>
              <div className="rounded bg-black/35 px-2 py-2 text-[10px] text-textMuted/85">{activeShotLabel ?? 'No active shot'} → compile → route → render → review</div>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-1.5 text-[10px] uppercase tracking-wide">
              <span className="rounded bg-panel/45 px-1.5 py-1 text-textMuted">progress: <span className="text-text/95">{progressLabel ?? '—'}</span></span>
              <span className="rounded bg-panel/45 px-1.5 py-1 text-textMuted">risk: <span className="text-text/95">{riskLabel ?? '—'}</span></span>
              <span className="rounded bg-cyan-500/10 px-1.5 py-1 text-cyan-100">state: {canonicalStateLabel}</span>
              <span className="rounded bg-panel/45 px-1.5 py-1 text-textMuted">next: <span className="text-text/95">{nextStepLabel ?? '—'}</span></span>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
              <button type="button" onClick={onOpenWorkspace} className="rounded bg-accent/12 px-2 py-1 text-accent">Open Workspace</button>
              <button type="button" onClick={onOpenRun} className="rounded px-2 py-1 text-textMuted hover:bg-panel/52 hover:text-text/88text-text">Open Run</button>
              <button type="button" onClick={onSendToIntervention} className="rounded bg-amber-500/10 px-2 py-1 text-amber-100">Send to Intervention</button>
            </div>
          </section>

          <section className="min-h-0 space-y-2.5">
            <PriorityPanel title="Alerts" items={alerts} onOpenItem={onOpenPriorityItem} />
            <PriorityPanel title="Blocked Decisions" items={blockedDecisions} onOpenItem={onOpenPriorityItem} />
            <PriorityPanel title="Interventions" items={interventions} onOpenItem={onOpenPriorityItem} />
          </section>
        </section>

        <section className="m6-tier-3 grid gap-3 rounded-md p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-textMuted/60">Throughput</div>
            <div className="rounded bg-panel/40 px-2 py-1.5">
              <MiniThroughput series={throughputSeries} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.13em] text-textMuted/85">Latest Events</div>
            <div className="max-h-20 space-y-1.5 overflow-auto rounded bg-panel/40 p-2">
              {(events ?? []).length ? (
                events?.map((event) => (
                  <div key={event.id} className="rounded bg-panel/35 px-2 py-1 text-[11px] text-text/90">
                    <span className="text-textMuted/75">{event.occurredAtLabel}</span> • {event.message}
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-textMuted/75">No recent events.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
