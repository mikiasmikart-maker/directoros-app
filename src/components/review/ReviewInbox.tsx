import { memo } from 'react';
import type { InboxItem } from '../../review/reviewLineageTruth';
import { RiskPredictor } from './RiskPredictor';
import { mapIntentType } from '../../utils/operationalLanguage';

interface ReviewInboxProps {
  items: InboxItem[];
  onJump: (item: InboxItem) => void;
  onRetry?: (item: InboxItem) => void;
  onCommit?: (item: InboxItem) => void;
  onShootout?: (item: InboxItem) => void;
  onDismiss?: (item: InboxItem) => void;
  focusedFamilyRootId?: string;
  focusedJobId?: string;
  presenceActivities?: import('../../types/presence').PresenceActivity[];
  operators?: import('../../types/presence').Operator[];
  conflicts?: import('../../types/presence').Conflict[];
}

const priorityTone: Record<InboxItem['priority'], string> = {
  critical: 'm6-signal-urgent text-[var(--m6-state-critical-fg)] border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] shadow-[0_4px_12px_rgba(180,132,132,0.08)]',
  needs_commit: 'm6-signal-elevated text-[var(--m6-state-active-fg)] border-[var(--m6-state-active-border)] bg-[var(--m6-state-active-bg)]',
  diverged: 'm6-signal-elevated text-[var(--m6-state-warn-fg)] border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)]',
  none: 'm6-signal-ambient text-textMuted/45 border-[var(--dos-border)] bg-panel/20',
};

const priorityLabel: Record<InboxItem['priority'], string> = {
  critical: 'Critical',
  needs_commit: 'Pnd', // Consistent with ShiftHandoff
  diverged: 'Diverged',
  none: 'Idle',
};

export const ReviewInbox = memo(({
  items,
  onJump,
  focusedFamilyRootId,
  focusedJobId,
  presenceActivities = [],
  operators = [],
  conflicts = []
}: ReviewInboxProps) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 p-2.5 pb-4 border-b border-[var(--m6-border-soft)]">
      <div className="flex items-center justify-between mb-1 px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-textMuted/60">Review Inbox</h3>
        <span className="text-[9px] font-mono tabular-nums text-textMuted/40">{items.length} Pending</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item, index) => {
          const isFamilyMatch = item.lineageRootId === focusedFamilyRootId;
          const isJobMatch = item.targetJobId === focusedJobId;
          const isActive = isFamilyMatch || isJobMatch;

          return (
            <div
              key={item.lineageRootId}
              className={`group relative flex flex-col gap-1 rounded-md border p-2 text-left transition-all ${isActive
                ? isJobMatch
                  ? 'border-cyan-500/40 bg-panel/60 ring-1 ring-cyan-500/20'
                  : 'border-cyan-500/25 bg-panel/48 ring-1 ring-cyan-500/10'
                : 'border-[var(--m6-border-soft)] bg-panel/34 hover:border-[var(--dos-border)] hover:bg-panel/46'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[9px] font-mono text-violet-400/60 tabular-nums tracking-tight">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <span className={`truncate text-[11px] font-medium transition-colors ${isActive ? 'text-white' : 'text-slate-400/70 group-hover:text-white'}`}>
                    {item.label}
                  </span>
                </div>
                <span className={`rounded-[3px] border px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider ${priorityTone[item.priority]}`}>
                  {priorityLabel[item.priority]}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className={`truncate text-[9px] transition-colors ${isActive ? 'text-textMuted/90' : 'text-textMuted/35 group-hover:text-textMuted/80'}`}>
                    {item.reason}
                  </span>
                  <RiskPredictor forecast={item.risk} />
                </div>

                {/* Presence Signals */}
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {presenceActivities
                    .filter((act) => act.targetId === item.lineageRootId && act.operatorId !== 'op_alpha')
                    .map((act) => {
                      const operator = operators.find((op) => op.id === act.operatorId);
                      if (!operator) return null;
                      const intentChar = act.type === 'reviewing' ? 'R' : act.type === 'comparing' ? 'C' : act.type === 'preparing_commit' ? 'P' : act.type === 'retrying' ? 'T' : null;
                      const conflict = conflicts.find(c => c.operatorId === act.operatorId);

                      const ringClass = conflict
                        ? conflict.severity === 'high' ? 'ring-rose-500/60 m6-animate-pulse-urgent' : conflict.severity === 'medium' ? 'ring-amber-500/40 shadow-[0_0_4px_rgba(245,158,11,0.2)]' : 'ring-[var(--m6-border-soft)]'
                        : 'ring-[var(--m6-border-soft)]';

                      const textClass = conflict
                        ? conflict.severity === 'high' ? 'text-rose-400 urgent-text' : conflict.severity === 'medium' ? 'text-amber-400/90' : 'text-cyan-400/80'
                        : '';

                      return (
                        <div
                          key={act.operatorId}
                          title={`${operator.name} is ${mapIntentType(act.type)}${act.lastAction ? `: ${act.lastAction}` : ''}${conflict ? ` - CONFLICT: ${conflict.message}` : ''}`}
                          className={`flex h-3 w-3 items-center justify-center rounded-full border border-panel ring-1 transition-all duration-300 ${ringClass} ${act.type === 'viewing' ? 'opacity-40 saturate-[0.2]' : 'opacity-100'}`}
                          style={{ backgroundColor: intentChar ? 'rgba(0,0,0,0.6)' : operator.color }}
                        >
                          {intentChar ? (
                            <span className={`text-[7px] font-bold leading-none ${textClass}`} style={{ color: textClass ? undefined : operator.color }}>{intentChar}</span>
                          ) : null}
                        </div>
                      );
                    })}
                </div>

                {/* Intervention Dock - Simplified to Jump Only */}
                <div className="hidden group-hover:flex items-center gap-1.5 animate-in fade-in slide-in-from-right-1 duration-100">
                  <button
                    type="button"
                    onClick={() => onJump(item)}
                    className="text-[10px] text-cyan-400/80 hover:text-cyan-300 ml-1 font-medium transition-colors"
                  >
                    Jump ›
                  </button>
                </div>
                <span className="block group-hover:hidden shrink-0 text-[10px] text-cyan-400/80">Jump ›</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
});
