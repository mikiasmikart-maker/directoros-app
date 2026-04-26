import clsx from 'clsx';

export type InteractionTier = 'primary' | 'secondary' | 'passive';

const BASE = 'transition-[border-color,background-color,color,opacity,box-shadow,transform] duration-[150ms] ease-out motion-reduce:transition-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35';

const HOVER: Record<InteractionTier, string> = {
  primary: 'hover:brightness-[1.06] hover:saturate-[1.06] hover:shadow-[0_0_0_1px_rgba(120,160,255,0.08)] active:scale-[0.98] active:brightness-[1.02]',
  secondary: 'hover:border-[rgba(120,160,255,0.08)] hover:bg-panel/24 hover:text-slate-200/78 active:scale-[0.99]',
  passive: 'hover:bg-panel/52 hover:text-text/88 active:opacity-80',
};

const DISABLED: Record<InteractionTier, string> = {
  primary: 'disabled:hover:brightness-100 disabled:hover:saturate-100 disabled:hover:shadow-none',
  secondary: 'disabled:hover:border-transparent disabled:hover:bg-inherit disabled:hover:text-inherit',
  passive: 'disabled:hover:bg-inherit disabled:hover:text-inherit',
};

export const interactionClass = (tier: InteractionTier, className?: string) => clsx(BASE, HOVER[tier], DISABLED[tier], className);

export const asyncFeedbackClass = (tone: 'info' | 'ok' | 'error' = 'info') =>
  tone === 'ok'
    ? 'bg-emerald-500/10 text-emerald-100/90'
    : tone === 'error'
      ? 'bg-rose-500/10 text-rose-100/90'
      : 'bg-cyan-500/10 text-cyan-100/90';
