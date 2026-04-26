import { memo } from 'react';
import type { DeliveryRegistryItem } from '../../review/types';
import { interactionClass } from '../shared/interactionContract';

interface DeliveryRegistryProps {
  items: DeliveryRegistryItem[];
  onJumpToShot: (shotId: string) => void;
}

export const DeliveryRegistry = memo(({ items, onJumpToShot }: DeliveryRegistryProps) => {
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-3 opacity-60">
        <div className="h-px w-12 bg-text/20" />
        <div className="text-[10px] uppercase tracking-[0.2em] text-textMuted">No outputs finalized for delivery</div>
        <div className="h-px w-12 bg-text/20" />
      </div>
    );
  }

  return (
    <div className="h-full space-y-2 overflow-auto pr-2 custom-scrollbar">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative flex flex-col space-y-4 rounded-md border border-emerald-500/15 bg-emerald-500/5 p-4 transition-all hover:bg-emerald-500/8"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-emerald-500/10 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-emerald-400/90">Deliverable Asset</span>
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">SEALED</span>
              </div>
              <div className="text-[13px] font-medium text-text/95">{item.label}</div>
            </div>
            
            <button
              onClick={() => onJumpToShot(item.shotId)}
              className={`${interactionClass} flex items-center gap-1.5 rounded-sm bg-accent/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-accent transition-all hover:bg-accent/20`}
            >
              Jump to Lineage
              <span className="text-[8px] opacity-60">→</span>
            </button>
          </div>

          {/* Grid Metadata */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-textMuted/70">Authoritative Run ID</div>
              <div className="font-mono text-[11px] text-text/80">{item.id}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-textMuted/70">Technical Specs</div>
              <div className="text-[11px] text-text/80">{item.specs}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-textMuted/70">Operator Authority</div>
              <div className="text-[11px] text-text/80">{item.actor}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-textMuted/70">Finalized At</div>
              <div className="text-[11px] text-text/80">{item.timestamp}</div>
            </div>
          </div>

          {/* Preview / Artifact */}
          {item.path && (
            <div className="relative mt-2 overflow-hidden rounded-sm border border-emerald-500/20 bg-black/40">
              <div className="flex h-24 items-center justify-center p-2 opacity-80 transition-opacity group-hover:opacity-100">
                <div 
                  className="h-full w-full bg-cover bg-center" 
                  style={{ backgroundImage: `url(${item.path})`, imageRendering: 'pixelated' }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                   <div className="rounded border border-white/20 bg-black/60 px-2 py-1 text-[9px] uppercase tracking-widest text-white ring-1 ring-white/10">View Artifact</div>
                </div>
              </div>
            </div>
          )}
          
          <div className="absolute -left-1 top-4 h-8 w-0.5 rounded-full bg-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      ))}
    </div>
  );
});
