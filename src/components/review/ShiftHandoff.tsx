import { useMemo } from 'react';
import { mapTechnicalState } from '../../utils/operationalLanguage';

export interface ShiftHandoffProps {
  currentFocusLabel?: string;
  lastOperatorDecision?: {
    description: string;
    occurredAt: number;
    jobId: string;
  };
  inboxPressure: {
    critical: number;
    needsCommit: number;
  };
  resumeAction?: {
    title: string;
    cta: string;
    onTrigger: () => void;
    readiness?: 'ready' | 'stale' | 'unavailable';
  };
}

export const ShiftHandoff = ({
  currentFocusLabel = 'No active focus selected',
  lastOperatorDecision,
  inboxPressure,
  resumeAction,
}: ShiftHandoffProps) => {
  const timeLabel = useMemo(() => {
    if (!lastOperatorDecision?.occurredAt) return '';
    const diff = Date.now() - lastOperatorDecision.occurredAt;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }, [lastOperatorDecision?.occurredAt]);

  const hasPressure = inboxPressure.critical > 0 || inboxPressure.needsCommit > 0;

  return (
    <div className="mb-2 overflow-hidden rounded-md border border-[var(--dos-border)] border-l-2 border-l-[var(--m6-border-soft-active)] bg-panel/40 p-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-all duration-200 hover:bg-panel/50">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-textMuted/60">Session State</span>
        {hasPressure && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/8 px-1.5 py-0.5 text-[9px] font-medium text-amber-300/70">
            <span className="h-1 w-1 rounded-full bg-amber-400/60" />
            Attention Required
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-textMuted/45">Current Focus</div>
          <div className="truncate text-[11px] font-medium text-text/90 italic">{currentFocusLabel}</div>
        </div>
        
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-textMuted/45">Last Decision</div>
          <div className="truncate text-[11px] text-textMuted/80">
            {lastOperatorDecision ? (
              <>
                <span className="text-cyan-400/70 font-medium">{lastOperatorDecision.description}</span>
                <span className="ml-1 text-[10px] opacity-40">({timeLabel})</span>
              </>
            ) : (
              'None recorded'
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-textMuted/45">Inbox Pressure</div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={inboxPressure.critical > 0 ? 'text-rose-400/90 font-medium' : 'text-textMuted/40'}>
              {inboxPressure.critical} Critical
            </span>
            <span className="h-2 w-[1px] bg-white/5" />
            <span className={inboxPressure.needsCommit > 0 ? 'text-emerald-400/90 font-medium' : 'text-textMuted/40'}>
              {inboxPressure.needsCommit} Pnd
            </span>
          </div>
        </div>

        <div className="min-w-0 flex items-end justify-end">
          {resumeAction && (
            <button
              onClick={resumeAction.onTrigger}
              className="group flex items-center gap-1.5 rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-[10px] font-medium text-cyan-400/60 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/15 hover:text-cyan-400 hover:shadow-[0_0_8px_rgba(125,211,252,0.15)] active:scale-95"
            >
              <span className="leading-none">{resumeAction.cta}</span>
              <span className="text-[8px] opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          )}
        </div>
      </div>

      {resumeAction && (
        <div className="mt-2 border-t border-[var(--m6-border-soft)] pt-1.5">
          <div className="text-[10px] text-textMuted/50 leading-tight">
            <span className="text-accent/60 mr-1 opacity-70">Resume target:</span>
            <span>{resumeAction.title}</span>
            {resumeAction.readiness && resumeAction.readiness !== 'ready' && (
              <span className={`ml-1.5 inline-flex items-center text-[9px] font-medium ${
                resumeAction.readiness === 'stale' ? 'text-amber-400/60' : 'text-rose-400/60'
              }`}>
                • {mapTechnicalState(resumeAction.readiness)}
              </span>
            )}
            {resumeAction.readiness === 'ready' && (
              <span className="ml-1.5 text-[9px] opacity-20 italic">(ready)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
