import { TelemetryKpiCard } from './TelemetryKpiCard';
import {
  selectCommandP95LatencyKpi,
  selectCommandSuccessRateKpi,
  selectInterventionMedianResolutionTimeKpi,
  selectOpenInterventionsCountKpi,
  selectProjectionThroughputKpi,
  selectReconciliationCycleHealthKpi,
  type TelemetryEnvelope,
} from '../../telemetry/selectors/directoros_kpi_selectors_cod_wip_v001';

export interface TelemetryKpiStripProps {
  events: TelemetryEnvelope[];
}

export const TelemetryKpiStrip = ({ events }: TelemetryKpiStripProps) => {
  const commandSuccess = selectCommandSuccessRateKpi(events);
  const commandP95 = selectCommandP95LatencyKpi(events);
  const reconciliationHealth = selectReconciliationCycleHealthKpi(events);
  const openInterventions = selectOpenInterventionsCountKpi(events);
  const interventionMedian = selectInterventionMedianResolutionTimeKpi(events);
  const projectionThroughput = selectProjectionThroughputKpi(events);

  return (
    <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      <TelemetryKpiCard title="Command Success Rate" {...commandSuccess} />
      <TelemetryKpiCard title="Command P95 Latency" {...commandP95} />
      <TelemetryKpiCard title="Reconciliation Cycle Health" {...reconciliationHealth} />
      <TelemetryKpiCard title="Open Interventions Count" {...openInterventions} />
      <TelemetryKpiCard title="Intervention Resolution Time (median)" {...interventionMedian} />
      <TelemetryKpiCard title="Projection Throughput" {...projectionThroughput} />
    </section>
  );
};
