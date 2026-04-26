import { interactionClass } from './interactionContract';

interface StatusBadgeProps {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'error' | 'warning' | 'critical';
}

const toneClass: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  neutral: 'border border-[var(--m6-border-soft)] bg-panelSoft/40 text-textMuted/70',
  accent: 'border border-[var(--m6-state-focus-border)]/20 bg-accent/10 text-accent/90 shadow-[var(--m6-state-focus-glow)]',
  success: 'border border-[var(--m6-state-active-border)] bg-[var(--m6-state-active-bg)] text-[var(--m6-state-active-fg)]',
  warning: 'border border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] text-[var(--m6-state-warn-fg)]',
  error: 'border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] text-[var(--m6-state-critical-fg)]',
  critical: 'border border-[var(--m6-state-stop-border)] bg-[var(--m6-state-stop-bg)] text-[var(--m6-state-stop-fg)] m6-signal-stop',
};

export const StatusBadge = ({ label, tone = 'neutral' }: StatusBadgeProps) => (
  <span className={interactionClass('passive', `rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.04em] ${toneClass[tone]}`)}>{label}</span>
);
