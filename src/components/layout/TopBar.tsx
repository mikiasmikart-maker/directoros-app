import { StatusBadge } from '../shared/StatusBadge';

interface TopBarProps {
  renderStatus: string;
  streamState?: 'connected' | 'degraded' | 'offline';
  lastEventAt?: number;
  currentFocus?: Array<{ label: string; value: string; active?: boolean }>;
}

const MAX_CRUMB_LEN = 20;
const shortValue = (v: string) => v.length > MAX_CRUMB_LEN ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;

export const TopBar = ({ renderStatus, streamState = 'offline', lastEventAt, currentFocus = [] }: TopBarProps) => {
  const labels: Record<string, string> = {
    connected: 'LIVE',
    degraded: 'DEGRADED',
    offline: 'OFFLINE'
  };

  const tones: Record<string, 'neutral' | 'accent' | 'success' | 'error' | 'warning' | 'critical'> = {
    connected: 'success',
    degraded: 'warning',
    offline: 'critical'
  };

  const streamLabel = labels[streamState] || (streamState === 'offline' ? 'OFFLINE' : 'LIVE');
  const streamTone = tones[streamState] || (streamState === 'offline' ? 'critical' : 'success');
  const streamHint = streamState === 'offline' ? 'Bridge disconnected (8787)' : lastEventAt ? `Last event: ${new Date(lastEventAt).toLocaleTimeString()}` : 'Last event: --';
  const runtimeLabel = streamState === 'offline' ? 'Runtime Offline' : renderStatus === 'failed' ? 'Render Blocked' : renderStatus === 'running' ? 'Render Active' : renderStatus === 'queued' ? 'Render Queued' : renderStatus;

  const statusKey = `${streamState}:${renderStatus}`;

  // Compact focus breadcrumb derived from currentFocus — label preferred, short ID as fallback
  const focusCrumbs = currentFocus
    .filter((f) => f.active !== false)
    .map((f) => (f.value && f.value.trim() ? shortValue(f.value) : f.label));
  const focusBreadcrumb = focusCrumbs.length > 0 ? focusCrumbs.join(' › ') : null;

  return (
    <header key={statusKey} className="border-b border-[var(--m6-border-soft)] bg-panel/76 px-4 py-1.5 backdrop-blur-md transition-[background-color,border-color] duration-200 ease-out">
      <div className="flex min-h-[28px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="leading-tight text-[9px] uppercase tracking-[0.14em] text-textMuted/42">Workspace Operations</div>
          {focusBreadcrumb && (
            <span
              aria-label="Current operator focus"
              className="hidden sm:inline-flex items-center rounded border border-[var(--m6-border-soft)] bg-panel/20 px-1.5 py-0.5 text-[9px] tracking-[0.06em] text-textMuted/38 select-none max-w-[260px] truncate"
              title={focusBreadcrumb}
            >
              {focusBreadcrumb}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-[var(--dos-border)] bg-panel/40 px-2.5 py-1.5">
            <StatusBadge label={streamLabel} tone={streamTone} />
            <div className="leading-tight">
              <div className="text-[11px] font-semibold tracking-[0.08em] text-text">{runtimeLabel}</div>
              <div className="text-[10px] text-textMuted/62" title={streamHint}>{streamHint}</div>
            </div>
          </div>
          <span className="rounded-md border border-[var(--m6-border-soft)] bg-panel/30 px-2 py-1 text-[10px] font-medium tracking-[0.08em] text-textMuted/64">
            Current Output Monitor
          </span>
        </div>
      </div>
    </header>
  );
};
