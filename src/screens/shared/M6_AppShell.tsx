import type { ReactNode } from 'react';

export type M6ScreenKey = 'overview' | 'live_runs' | 'workspace' | 'console' | 'interventions' | 'audit';

interface M6NavItem {
  key: M6ScreenKey;
  label: string;
}

interface M6AppShellProps {
  activeScreen: M6ScreenKey;
  screenTitle: string;
  screenSubtitle?: string;
  systemHealthLabel: string;
  streamStateLabel: string;
  queueModeLabel: string;
  activeContextLabel?: string;
  attentionLabel?: string;
  children: ReactNode;
  actionsSlot?: ReactNode;
  overlaySlot?: ReactNode;
  onNavigate?: (screen: M6ScreenKey) => void;
  onOpenInterventions?: () => void;
}

const navItems: M6NavItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'live_runs', label: 'Live Runs' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'console', label: 'Console' },
  { key: 'interventions', label: 'Interventions' },
  { key: 'audit', label: 'Audit' },
];

export const M6_AppShell = ({
  activeScreen,
  screenTitle,
  screenSubtitle,
  systemHealthLabel,
  streamStateLabel,
  queueModeLabel,
  activeContextLabel,
  attentionLabel = 'Attention',
  children,
  actionsSlot,
  overlaySlot,
  onNavigate,
  onOpenInterventions,
}: M6AppShellProps) => {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-white/[0.035] bg-[rgba(18,18,18,0.86)] backdrop-blur-[12px] shadow-[0_8px_24px_rgba(2,6,23,0.14)]">
        <div className="mx-auto w-full max-w-[1880px] px-4 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/mikart-logo.png" alt="Mikart" className="h-[29px] w-[29px] shrink-0 object-contain drop-shadow-md opacity-95" />
              <div className="flex flex-col justify-center gap-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-100 leading-none translate-y-[1px]">MIKART DIRECTOROS</div>
                <div className="text-[9.5px] font-normal tracking-normal text-slate-500/70 leading-none">Cinematic AI Production System</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] opacity-[0.9]">
              <span className="m6-surface-quiet rounded px-2 py-1 text-textMuted/62">health: <span className="font-medium text-text/92">{systemHealthLabel}</span></span>
              <span className="m6-surface-quiet rounded px-2 py-1 text-textMuted/62">stream: <span className="font-medium text-text/92">{streamStateLabel}</span></span>
              <span className="m6-surface-quiet rounded px-2 py-1 text-textMuted/62">queue: <span className="font-medium text-text/92">{queueModeLabel}</span></span>
              <span className="m6-surface-quiet rounded px-2 py-1 text-textMuted/62">context: <span className="font-medium text-text/92">{activeContextLabel ?? 'none'}</span></span>
              <button
                type="button"
                onClick={() => {
                  onOpenInterventions?.();
                  onNavigate?.('interventions');
                }}
                className="m6-tab-btn m6-control inline-flex items-center justify-center rounded bg-rose-500/10 px-2 py-1 text-rose-100 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-rose-500/12 active:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-300/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-rose-500/10"
              >
                {attentionLabel}
              </button>
            </div>
          </div>

          <div className="mt-2">
            <nav className="m6-surface-quiet flex flex-wrap items-center gap-1 rounded-md p-1 text-[11px] uppercase tracking-[0.12em]">
              {navItems.map((item) => {
                const isActive = activeScreen === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate?.(item.key)}
                    data-active={isActive}
                    className={`m6-tab-btn inline-flex items-center justify-center rounded px-2.5 py-1 transition-[color,background-color,box-shadow,opacity,transform] duration-180 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-textMuted/68 ${isActive ? 'text-accent shadow-[inset_0_-1px_0_rgba(120,160,255,0.38)]' : 'text-textMuted/68 opacity-70 hover:opacity-95 hover:text-text active:opacity-85'}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-[1880px] py-4 ${activeScreen === 'workspace' ? 'px-2' : 'px-6'}`}>
        <section className={`mb-3 flex flex-wrap items-end justify-between gap-4 rounded-md bg-[rgba(20,20,22,0.46)] px-3 py-2.5 m6-tier-2 ${activeScreen === 'workspace' ? 'mx-0.5' : ''}`}>
          <div>
            <div className="m6-section-title">M6 Control Room</div>
            <h1 className="text-[18px] font-semibold tracking-[0.02em] text-text">{screenTitle}</h1>
            {screenSubtitle ? <p className="m6-meta">{screenSubtitle}</p> : null}
          </div>
          {actionsSlot ? <div className="flex flex-wrap items-center gap-1.5">{actionsSlot}</div> : null}
        </section>

        <section className="relative min-h-[calc(100vh-190px)] rounded-md border border-white/[0.02] bg-panelSoft/26 p-1.5">
          {children}
          {overlaySlot}
        </section>
      </main>
      <footer className="sticky bottom-0 z-40 border-t border-white/[0.035] bg-[rgba(14,14,16,0.94)] backdrop-blur-[12px] py-2 px-6 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
        <div className="mx-auto flex w-full max-w-[1880px] items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[9px] uppercase tracking-[0.15em] text-slate-500/70 font-bold">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500/40" />System Persistence Active</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-slate-700" />VRAM Buffer: Guarded</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] uppercase tracking-[0.12em] text-slate-500 font-bold">Live Throughput</span>
            <div className="flex items-center gap-1 rounded bg-black/40 border border-white/[0.03] px-2.5 py-1 text-[10px] font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
              <span className="text-cyan-400/90 font-bold">{queueModeLabel.split('/')[0].trim()}</span>
              <span className="text-slate-600 px-1 opacity-40">/</span>
              <span className="text-slate-400/80">{queueModeLabel.split('/')[1]?.trim() ?? '0 queued'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
