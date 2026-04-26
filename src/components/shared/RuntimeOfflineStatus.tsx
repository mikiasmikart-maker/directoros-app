import React from 'react';

interface RuntimeOfflineStatusProps {
  state: 'connected' | 'degraded' | 'offline';
  className?: string;
}

export const RuntimeOfflineStatus: React.FC<RuntimeOfflineStatusProps> = ({ state, className = '' }) => {
  if (state === 'connected') return null;

  const config = {
    offline: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M17.08 20A2 2 0 0 0 19 18a2 2 0 0 0-1.92-2H17a2 2 0 0 0-2 2 2 2 0 0 0 2 2z"/>
          <path d="M7 20h.01"/>
          <path d="M12 20h.01"/>
          <path d="M2 10a11 11 0 0 1 11.21-10c.16 0 .31.01.47.01"/>
          <line x1="2" y1="2" x2="22" y2="22"/>
          <path d="M8.5 7.42A10.78 10.78 0 0 1 12 7 c .16 0 .31.01.47.01"/>
          <path d="M15.5 10.42c.16 0 .31.01.47.01a6.39 6.39 0 0 1 2.5 1"/>
        </svg>
      ),
      title: 'RUNTIME BRIDGE OFFLINE',
      message: 'Active control and live mutation disabled. Bridge unavailable.',
      tone: 'bg-[var(--m6-state-stop-bg)] border-[var(--m6-state-stop-border)] text-[var(--m6-state-stop-fg)]',
      accent: 'bg-[var(--m6-state-stop-fg)]',
    },
    degraded: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="m22 12-4-4-4 4 4 4z"/>
          <path d="M10 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
          <path d="M2 12h3"/>
          <path d="M14 12h4"/>
        </svg>
      ),
      title: 'RUNTIME SIGNAL DEGRADED',
      message: 'Live stream interrupted. Control may be sluggish or unreliable.',
      tone: 'bg-[var(--m6-state-warn-bg)] border-[var(--m6-state-warn-border)] text-[var(--m6-state-warn-fg)]',
      accent: 'bg-[var(--m6-state-warn-fg)]',
    },
  }[state] || {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    title: 'STATUS UNKNOWN',
    message: 'Checking runtime bridge status...',
    tone: 'bg-panel/40 border-[var(--m6-border-soft)] text-textMuted',
    accent: 'bg-slate-500',
  };

  return (
    <div className={`flex flex-col gap-1.5 rounded-md border p-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300 ${config.tone} ${className}`}>
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded-sm ${config.tone} border-none`}>
          {config.icon}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] leading-none">
            {config.title}
          </span>
          <span className="text-[11px] opacity-80 mt-1 leading-tight">
            {config.message}
          </span>
        </div>
        {state === 'offline' && (
          <div className="ml-auto">
            <div className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
          </div>
        )}
      </div>
    </div>
  );
};
