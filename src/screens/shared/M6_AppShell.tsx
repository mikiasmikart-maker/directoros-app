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
    <div className="min-h-screen bg-dos-bg text-dos-text">
      <header className="sticky top-0 z-40 border-b border-white/[0.022] bg-dos-bg/84 backdrop-blur-[8px] shadow-m6tier1">
        <div className="mx-auto w-full max-w-[1880px] px-4 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/mikart-logo.png" alt="Mikart" className="h-[29px] w-[29px] shrink-0 object-contain drop-shadow-md opacity-95" />
              <div className="flex flex-col justify-center gap-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-dos-text leading-none translate-y-[1px]">MIKART DIRECTOROS</div>
                <div className="text-[9.5px] font-normal tracking-normal text-dos-text-muted leading-none">Cinematic AI Production System</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] opacity-[0.9]">
              <span className="rounded border border-white/[0.018] bg-white/[0.008] px-2 py-1 text-dos-text-muted/86">health: <span className="font-medium text-dos-text/90">{systemHealthLabel}</span></span>
              <span className="rounded border border-white/[0.018] bg-white/[0.008] px-2 py-1 text-dos-text-muted/86">stream: <span className="font-medium text-dos-text/90">{streamStateLabel}</span></span>
              <span className="rounded border border-white/[0.018] bg-white/[0.008] px-2 py-1 text-dos-text-muted/86">queue: <span className="font-medium text-dos-text/90">{queueModeLabel}</span></span>
              <span className="rounded border border-white/[0.018] bg-white/[0.008] px-2 py-1 text-dos-text-muted/86">context: <span className="font-medium text-dos-text/90">{activeContextLabel ?? 'none'}</span></span>
              <button
                type="button"
                onClick={() => {
                  onOpenInterventions?.();
                  onNavigate?.('interventions');
                }}
                className="m6-tab-btn m6-control inline-flex items-center justify-center rounded bg-dos-sig-warning/10 px-2 py-1 text-dos-sig-warning transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-dos-sig-warning/15 active:bg-dos-sig-warning/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-dos-sig-warning/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-dos-sig-warning/10"
              >
                {attentionLabel}
              </button>
            </div>
          </div>

          <div className="mt-2">
            <nav className="flex flex-wrap items-center gap-1 rounded-md border border-white/[0.018] bg-white/[0.008] p-1 text-[11px] uppercase tracking-[0.12em]">
              {navItems.map((item) => {
                const isActive = activeScreen === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate?.(item.key)}
                    data-active={isActive}
                    className={`m6-tab-btn inline-flex items-center justify-center rounded px-2.5 py-1 transition-[color,background-color,box-shadow,opacity,transform] duration-180 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-dos-sig-runtime/20 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-dos-text-muted ${isActive ? 'text-dos-text/92 bg-white/[0.026] shadow-[inset_0_-1px_0_rgba(255,255,255,0.035)]' : 'text-dos-text-muted opacity-68 hover:bg-white/[0.016] hover:opacity-90 hover:text-dos-text/88 active:opacity-80'}`}
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
        <section className={`mb-3 flex flex-wrap items-end justify-between gap-4 rounded-md bg-dos-panel/34 px-3 py-2.5 m6-tier-2 ${activeScreen === 'workspace' ? 'mx-0.5' : ''}`}>
          <div>
            <div className="m6-section-title">M6 Control Room</div>
            <h1 className="text-[18px] font-semibold tracking-[0.02em] text-dos-text">{screenTitle}</h1>
            {screenSubtitle ? <p className="m6-meta">{screenSubtitle}</p> : null}
          </div>
          {actionsSlot ? <div className="flex flex-wrap items-center gap-1.5">{actionsSlot}</div> : null}
        </section>

        <section className="relative min-h-[calc(100vh-190px)] rounded-md border border-white/[0.02] bg-panelSoft/26 p-1.5">
          {children}
          {overlaySlot}
        </section>
      </main>
      <footer className="sticky bottom-0 z-40 border-t border-white/[0.022] bg-dos-bg/90 backdrop-blur-[8px] py-2 px-6 shadow-[0_-6px_24px_rgba(0,0,0,0.38)]">
        <div className="mx-auto flex w-full max-w-[1880px] items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[9px] uppercase tracking-[0.15em] text-dos-text-muted font-bold">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-dos-sig-trust/40" />System Persistence Active</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white/10" />VRAM Buffer: Guarded</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] uppercase tracking-[0.12em] text-dos-text-muted font-bold">Live Throughput</span>
            <div className="flex items-center gap-1 rounded bg-black/30 border border-white/[0.02] px-2.5 py-1 text-[10px] font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.006)]">
              <span className="text-dos-sig-runtime font-bold">{queueModeLabel.split('/')[0].trim()}</span>
              <span className="text-dos-text-muted px-1 opacity-40">/</span>
              <span className="text-dos-text-muted/80">{queueModeLabel.split('/')[1]?.trim() ?? '0 queued'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
