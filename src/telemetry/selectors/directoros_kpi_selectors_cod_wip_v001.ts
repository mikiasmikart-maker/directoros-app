export interface TelemetryEnvelope {
  event_name?: string;
  occurred_at?: string;
  outcome?: { status?: string; code?: string; message?: string };
  metrics?: { latency_ms?: number | null; queue_ms?: number | null };
  subject?: { id?: string };
}

export interface TelemetryKpiValue {
  valueLabel: string;
  subLabel: string;
  stale: boolean;
}

const asTime = (iso?: string): number | undefined => {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : undefined;
};

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const percentile = (values: number[], p: number): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

const fmtMs = (ms?: number): string => (typeof ms === 'number' ? `${Math.round(ms)}ms` : '—');
const fmtPct = (value?: number): string => (typeof value === 'number' ? `${Math.round(value * 100)}%` : '—');

const ageLabel = (events: TelemetryEnvelope[]): string => {
  const latest = events
    .map((e) => asTime(e.occurred_at))
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => b - a)[0];
  if (!latest) return 'no samples';
  const deltaMs = Date.now() - latest;
  const mins = Math.floor(deltaMs / 60000);
  if (mins < 1) return 'live';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const isStale = (events: TelemetryEnvelope[], staleAfterMs = 15 * 60_000): boolean => {
  const latest = events
    .map((e) => asTime(e.occurred_at))
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => b - a)[0];
  if (!latest) return true;
  return Date.now() - latest > staleAfterMs;
};

const byEvent = (events: TelemetryEnvelope[], name: string) => events.filter((e) => e.event_name === name);

export const selectCommandSuccessRateKpi = (events: TelemetryEnvelope[]): TelemetryKpiValue => {
  const completed = byEvent(events, 'command.execution.completed');
  const success = completed.filter((e) => e.outcome?.status === 'success').length;
  const rate = completed.length ? success / completed.length : undefined;
  return {
    valueLabel: fmtPct(rate),
    subLabel: completed.length ? `${success}/${completed.length} successful • ${ageLabel(completed)}` : 'no completed commands yet',
    stale: isStale(completed),
  };
};

export const selectCommandP95LatencyKpi = (events: TelemetryEnvelope[]): TelemetryKpiValue => {
  const completed = byEvent(events, 'command.execution.completed');
  const values = completed
    .map((e) => e.metrics?.latency_ms)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const p95 = percentile(values, 95);
  return {
    valueLabel: fmtMs(p95),
    subLabel: values.length ? `${values.length} samples • ${ageLabel(completed)}` : 'no latency samples yet',
    stale: isStale(completed),
  };
};

export const selectReconciliationCycleHealthKpi = (events: TelemetryEnvelope[]): TelemetryKpiValue => {
  const completed = byEvent(events, 'reconciliation.cycle.completed');
  const success = completed.filter((e) => e.outcome?.status === 'success').length;
  const rate = completed.length ? success / completed.length : undefined;
  return {
    valueLabel: fmtPct(rate),
    subLabel: completed.length ? `${success}/${completed.length} cycles healthy • ${ageLabel(completed)}` : 'no reconciliation cycles yet',
    stale: isStale(completed),
  };
};

export const selectOpenInterventionsCountKpi = (events: TelemetryEnvelope[]): TelemetryKpiValue => {
  const lifecycle = events.filter((e) =>
    e.event_name === 'intervention.lifecycle.opened' ||
    e.event_name === 'intervention.lifecycle.resolved' ||
    e.event_name === 'intervention.lifecycle.closed'
  );

  const open = new Set<string>();
  lifecycle
    .slice()
    .sort((a, b) => (asTime(a.occurred_at) ?? 0) - (asTime(b.occurred_at) ?? 0))
    .forEach((evt) => {
      const id = evt.subject?.id;
      if (!id) return;
      if (evt.event_name === 'intervention.lifecycle.opened') open.add(id);
      if (evt.event_name === 'intervention.lifecycle.resolved' || evt.event_name === 'intervention.lifecycle.closed') open.delete(id);
    });

  return {
    valueLabel: String(open.size),
    subLabel: lifecycle.length ? `from lifecycle stream • ${ageLabel(lifecycle)}` : 'no intervention lifecycle events yet',
    stale: isStale(lifecycle),
  };
};

export const selectInterventionMedianResolutionTimeKpi = (events: TelemetryEnvelope[]): TelemetryKpiValue => {
  const lifecycle = events.filter((e) =>
    e.event_name === 'intervention.lifecycle.opened' ||
    e.event_name === 'intervention.lifecycle.resolved' ||
    e.event_name === 'intervention.lifecycle.closed'
  );

  const openedAtById = new Map<string, number>();
  const resolutionDurations: number[] = [];

  lifecycle
    .slice()
    .sort((a, b) => (asTime(a.occurred_at) ?? 0) - (asTime(b.occurred_at) ?? 0))
    .forEach((evt) => {
      const id = evt.subject?.id;
      const at = asTime(evt.occurred_at);
      if (!id || typeof at !== 'number') return;
      if (evt.event_name === 'intervention.lifecycle.opened') {
        openedAtById.set(id, at);
        return;
      }
      if (evt.event_name === 'intervention.lifecycle.resolved' || evt.event_name === 'intervention.lifecycle.closed') {
        const openedAt = openedAtById.get(id);
        if (typeof openedAt === 'number' && at >= openedAt) resolutionDurations.push(at - openedAt);
        openedAtById.delete(id);
      }
    });

  const med = median(resolutionDurations);
  return {
    valueLabel: fmtMs(med),
    subLabel: resolutionDurations.length ? `${resolutionDurations.length} resolved interventions • ${ageLabel(lifecycle)}` : 'no resolved interventions yet',
    stale: isStale(lifecycle),
  };
};

export const selectProjectionThroughputKpi = (events: TelemetryEnvelope[]): TelemetryKpiValue => {
  const completed = byEvent(events, 'projection.render.completed');
  const now = Date.now();
  const windowMs = 60 * 60_000;
  const recentCount = completed.filter((e) => {
    const t = asTime(e.occurred_at);
    return typeof t === 'number' && now - t <= windowMs;
  }).length;

  return {
    valueLabel: `${recentCount}/h`,
    subLabel: completed.length ? `${completed.length} total projection completions • ${ageLabel(completed)}` : 'no projection completions yet',
    stale: isStale(completed),
  };
};
