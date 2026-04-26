import { memo } from 'react';
import type { RiskForecast } from '../../review/reviewLineageTruth';

interface RiskPredictorProps {
  forecast?: RiskForecast;
}

const riskLevels = {
  stable: {
    color: 'bg-slate-500/20',
    barCount: 1,
    label: 'Nominal Risk',
  },
  elevated: {
    color: 'bg-amber-500/60',
    barCount: 2,
    label: 'Elevated Risk',
  },
  critical: {
    color: 'bg-rose-500/80',
    barCount: 4,
    label: 'Critical Risk',
  },
};

export const RiskPredictor = memo(({ forecast }: RiskPredictorProps) => {
  if (!forecast || forecast.level === 'stable') return null;

  const level = riskLevels[forecast.level];
  const bars = [1, 2, 3, 4];

  return (
    <div 
      className="flex items-center gap-0.5" 
      title={`Forecast: ${level.label} - ${forecast.reason}`}
    >
      <div className="flex gap-[1px]">
        {bars.map((bar) => (
          <div
            key={bar}
            className={`h-2 W-[2px] rounded-[0.5px] ${
              bar <= level.barCount ? level.color : 'bg-white/5'
            } ${forecast.level === 'critical' ? 'animate-pulse' : ''}`}
            style={{ width: '2px' }}
          />
        ))}
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-tighter opacity-80 ${
        forecast.level === 'critical' ? 'text-rose-400' : 'text-amber-400'
      }`}>
        Risk
      </span>
    </div>
  );
});
