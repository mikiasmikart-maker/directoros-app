import { useMemo, useState } from 'react';
import type { CompiledPromptPayload } from '../../models/directoros';

type ViewMode = 'prompt' | 'payload';

interface CompiledPromptPanelProps {
  payload: CompiledPromptPayload | null;
  currentJob?: {
    metadata?: Record<string, any>;
  };
}

export const CompiledPromptPanel = ({ payload, currentJob }: CompiledPromptPanelProps) => {
  const [mode, setMode] = useState<ViewMode>('prompt');

  const output = useMemo(() => {
    if (!payload) return 'No payload - select a scene';
    if (mode === 'prompt') {
      // Pass 43: Live Lens State Unification
      // Prioritize canonical expanded_prompt from job metadata.
      // If missing (legacy or live), fall back to technical compiled prompt.
      return currentJob?.metadata?.expanded_prompt || payload.compiledPrompt;
    }
    return JSON.stringify(payload.payload, null, 2);
  }, [payload, mode, currentJob]);

  return (
    <div>
      <div className="mb-3 inline-flex gap-1 rounded-md border border-[rgba(255,255,255,0.04)] bg-[rgba(10,16,28,0.5)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.012)]">
        <button
          onClick={() => setMode('prompt')}
          className={`m6-tab-btn inline-flex flex-1 items-center justify-center rounded px-2 py-1 text-[11px] transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-textMuted/50 ${mode === 'prompt' ? 'bg-accent/10 text-text/82 shadow-[inset_0_-1px_0_rgba(120,160,255,0.38)]' : 'text-textMuted/50 hover:bg-white/[0.025] hover:text-text/72 active:text-text/68'}`}
        >
          Compiled Output
        </button>
        <button
          onClick={() => setMode('payload')}
          className={`m6-tab-btn inline-flex flex-1 items-center justify-center rounded px-2 py-1 text-[11px] transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-textMuted/50 ${mode === 'payload' ? 'bg-accent/10 text-text/82 shadow-[inset_0_-1px_0_rgba(120,160,255,0.38)]' : 'text-textMuted/50 hover:bg-white/[0.025] hover:text-text/72 active:text-text/68'}`}
        >
          Technical Pipeline
        </button>
      </div>

      {payload ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded border border-white/5 bg-black/40 px-2.5 py-1.5">
            <div className="text-[8px] font-light tracking-[0.05em] text-neutral-600 uppercase">Active route</div>
            <div className="mt-0.5 break-all text-[9px] font-mono text-neutral-400">{payload.payload.routeContext.activeRoute}</div>
          </div>
          <div className="rounded border border-white/5 bg-black/40 px-2.5 py-1.5">
            <div className="text-[8px] font-light tracking-[0.05em] text-neutral-600 uppercase">Target engine</div>
            <div className="mt-0.5 text-[9px] font-mono text-neutral-400">{payload.payload.routeContext.targetEngine}</div>
          </div>
        </div>
      ) : null}

      <div className="max-h-72 overflow-auto rounded border border-white/5 bg-black/60 p-3 m6-scrollbar-thin">
        {mode === 'prompt' ? (
          <div className="text-[13px] leading-relaxed font-light tracking-tight text-neutral-200 [text-wrap:pretty]">
            {output}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words text-[10px] font-mono leading-relaxed text-neutral-400">
            {output}
          </pre>
        )}
      </div>
    </div>
  );
};
