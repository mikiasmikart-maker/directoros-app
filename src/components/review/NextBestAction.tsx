import { useRef, useEffect, useState } from 'react';
import type { NextBestAction as NBAType } from '../../review/reviewLineageTruth';

// ---------------------------------------------------------------------------
// Pass 25: Guidance Persistence & Dismissal Memory
// Continuous exposure model — suppresses a hint only after it has been
// visible for HINT_ABSORPTION_MS of uninterrupted time. Resets on hint
// change or disappearance so short flashes never accumulate toward suppression.
// Memory scope: per NBAState, session-only (no localStorage).
// ---------------------------------------------------------------------------
const HINT_ABSORPTION_MS = 10_000;
const POLL_INTERVAL_MS = 1_000;

interface NextBestActionProps {
  nba: NBAType;
  onAction: () => void;
}

const accentColors = {
  cyan: 'border-cyan-400/30 bg-cyan-950/20 text-cyan-100',
  rose: 'border-rose-400/30 bg-rose-950/20 text-rose-100',
  emerald: 'border-emerald-400/30 bg-emerald-950/20 text-emerald-100',
  amber: 'border-amber-400/30 bg-amber-950/20 text-amber-100',
  indigo: 'border-indigo-400/30 bg-indigo-950/20 text-indigo-100',
  slate: 'border-slate-400/30 bg-slate-950/20 text-slate-100',
};

const pulseColors = {
  cyan: 'bg-cyan-400',
  rose: 'bg-rose-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  indigo: 'bg-indigo-400',
  slate: 'bg-slate-400',
};

export const NextBestAction = ({ nba, onAction }: NextBestActionProps) => {
  // Per-NBAState suppression registry. Persists across re-renders; never
  // resets unless the component unmounts (i.e., operator navigates away).
  const suppressedStates = useRef<Set<string>>(new Set());

  // Timestamp of when the current hint became continuously visible.
  // Null means no active exposure window.
  const hintStartRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Trigger re-render after a state is absorbed (useRef mutations are silent).
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const { state, predictiveHint } = nba;

    // Clear any in-flight interval from a prior hint/state.
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // No hint, or this state is already absorbed — reset clock and bail.
    if (!predictiveHint || suppressedStates.current.has(state)) {
      hintStartRef.current = null;
      return;
    }

    // Continuous exposure starts now.
    hintStartRef.current = Date.now();

    // Poll every second. Only suppress after 10 seconds of *uninterrupted*
    // visibility — the cleanup below resets hintStartRef if the hint changes.
    intervalRef.current = setInterval(() => {
      if (hintStartRef.current === null) return;
      const elapsed = Date.now() - hintStartRef.current;
      if (elapsed >= HINT_ABSORPTION_MS) {
        suppressedStates.current.add(state);
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        hintStartRef.current = null;
        // Trigger re-render so the hint disappears from the DOM.
        forceUpdate((n) => n + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      // Hint changed or disappeared — cancel interval and reset exposure clock.
      // Short flashes won't carry elapsed time into the next appearance.
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      hintStartRef.current = null;
    };
  }, [nba.state, nba.predictiveHint]);

  // Gate render: hide if no hint provided, or if this state is already absorbed.
  const hintVisible = !!nba.predictiveHint && !suppressedStates.current.has(nba.state);

  return (
    <div className={`group relative overflow-hidden rounded-md border p-3 shadow-sm ring-1 ring-[var(--m6-border-soft)] transition-all duration-300 hover:ring-[var(--dos-border)] ${accentColors[nba.accent]}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel/40">
            <div className={`h-1.5 w-1.5 animate-pulse rounded-full ${pulseColors[nba.accent]}`} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Next Best Action</span>
              <span className="h-px w-4 bg-current opacity-20" />
              <span className="text-[11px] font-bold uppercase tracking-wide">{nba.title}</span>
            </div>
            <p className="mt-0.5 truncate text-[12px] leading-relaxed opacity-80">{nba.reason}</p>
            {hintVisible && (
              <p className="mt-1.5 border-t border-current/10 pt-1.5 text-[10px] leading-relaxed opacity-40">
                {nba.predictiveHint}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          className="shrink-0 rounded-md bg-panel/40 px-4 py-2 text-[11px] font-bold uppercase tracking-widest ring-1 ring-white/20 transition-all hover:bg-white/10 hover:ring-white/40 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95"
        >
          {nba.cta}
        </button>
      </div>
      {/* Decorative gradient flare */}
      <div className="absolute -right-4 -top-8 h-24 w-24 bg-current opacity-[0.02] blur-2xl" />
    </div>
  );
};
