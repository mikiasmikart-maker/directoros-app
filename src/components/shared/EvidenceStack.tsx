import React from 'react';

/**
 * EvidenceStack State Model
 * Defines the constitutional signals for forensic traces.
 */
export type EvidenceState = 
  | 'evidence'  // Raw context / forensic data (Continuity Violet)
  | 'active'    // Currently participating / flowing (Runtime Cyan)
  | 'inherited' // Derived from parent lineage (Muted / Dashed)
  | 'drift'     // Divergence detected (Drift Amber)
  | 'warning'   // Potential failure / staleness (Warning Orange)
  | 'sealed'    // Immutable / Verified truth (Trust Green)
  | 'broken';   // Explicit failure / rejection (Warning/Critical)

/**
 * Single node in the EvidenceStack
 */
export interface EvidenceItemData {
  id: string;
  label: string;
  value?: string | number | boolean;
  state: EvidenceState;
  timestamp?: number;
  sourceLabel?: string;
  metadata?: Record<string, any>;
  icon?: React.ReactNode;
}

export interface EvidenceStackProps {
  items: EvidenceItemData[];
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onItemSelect?: (id: string) => void;
  className?: string;
}

/**
 * Helper to map states to Tailwind signal classes
 */
const getEvidenceTone = (state: EvidenceState): string => {
  switch (state) {
    case 'evidence':
      return 'border-dos-sig-continuity/30 bg-dos-sig-continuity/5 text-dos-sig-continuity/90';
    case 'active':
      return 'border-dos-sig-runtime/40 bg-dos-sig-runtime/10 text-dos-sig-runtime shadow-[0_0_12px_rgba(0,209,255,0.1)]';
    case 'inherited':
      return 'border-white/5 border-dashed bg-transparent text-textMuted/60';
    case 'drift':
      return 'border-dos-sig-drift/50 bg-dos-sig-drift/10 text-dos-sig-drift font-bold';
    case 'warning':
      return 'border-dos-sig-warning/40 bg-dos-sig-warning/10 text-dos-sig-warning';
    case 'sealed':
      return 'border-dos-sig-trust/40 bg-dos-sig-trust/8 text-dos-sig-trust font-medium';
    case 'broken':
      return 'border-dos-sig-warning/60 bg-dos-sig-warning/15 text-dos-sig-warning font-bold italic';
    default:
      return 'border-white/5 bg-dos-panel/40 text-textMuted';
  }
};

/**
 * EvidenceStack Primitive
 * A "dumb" presentational component for visualizing job lineage, ancestry, 
 * and operational diagnostics traces.
 */
export const EvidenceStack: React.FC<EvidenceStackProps> = ({
  items,
  title,
  collapsible = false,
  defaultExpanded = true,
  onItemSelect,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  if (!items || items.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {title && (
        <header 
          className={`flex items-center justify-between px-1 mb-1 ${collapsible ? 'cursor-pointer select-none hover:opacity-80' : ''}`}
          onClick={() => collapsible && setIsExpanded(!isExpanded)}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            {title}
          </div>
          {collapsible && (
            <span className="text-[9px] text-neutral-600">
              {isExpanded ? 'Collapse' : 'Expand'}
            </span>
          )}
        </header>
      )}

      {isExpanded && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemSelect?.(item.id)}
              disabled={!onItemSelect}
              className={`group w-full rounded border px-3 py-2 text-left transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-accent/20 ${getEvidenceTone(item.state)} ${onItemSelect ? 'hover:scale-[1.01] hover:brightness-110 active:scale-[0.99]' : 'cursor-default'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.icon && <span className="shrink-0">{item.icon}</span>}
                    <span className="truncate text-[11px] leading-tight">{item.label}</span>
                  </div>
                  {item.value !== undefined && (
                    <div className="mt-1 font-mono text-[10px] opacity-70 truncate">
                      {String(item.value)}
                    </div>
                  )}
                </div>
                {item.sourceLabel && (
                  <span className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">
                    {item.sourceLabel}
                  </span>
                )}
              </div>
              {item.timestamp && (
                <div className="mt-1.5 text-[8px] uppercase tracking-widest opacity-30 group-hover:opacity-50">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
