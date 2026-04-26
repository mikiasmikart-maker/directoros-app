import type { ReactNode } from 'react';

export interface TelemetryKpiCardProps {
  title: string;
  valueLabel: string;
  subLabel: string;
  stale?: boolean;
  icon?: ReactNode;
}

export const TelemetryKpiCard = ({ title, valueLabel, subLabel, stale = false, icon }: TelemetryKpiCardProps) => {
  return (
    <article className={`rounded-md border px-3 py-2.5 ${stale ? 'border-amber-300/30 bg-amber-500/8' : 'border-panel/40 bg-panel/45'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.12em] text-textMuted/90">{title}</div>
        <div className="text-[10px] text-textMuted/75">{stale ? 'stale-safe' : icon ?? 'live'}</div>
      </div>
      <div className="text-[18px] font-semibold leading-tight text-text/95">{valueLabel}</div>
      <div className="mt-1 text-[10px] text-textMuted/80">{subLabel}</div>
    </article>
  );
};
