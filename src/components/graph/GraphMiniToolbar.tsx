interface GraphMiniToolbarProps {
  selectedShotId?: string;
  showConnections: boolean;
  showLabels: boolean;
  zoomPercent?: number;
  onFitGraph: () => void;
  onResetLayout: () => void;
  onToggleConnections: () => void;
  onToggleLabels: () => void;
  onFocusSelectedShot: () => void;
}

export const GraphMiniToolbar = ({
  selectedShotId,
  showConnections,
  showLabels,
  zoomPercent,
  onFitGraph,
  onResetLayout,
  onToggleConnections,
  onToggleLabels,
  onFocusSelectedShot,
}: GraphMiniToolbarProps) => (
  <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={onFitGraph} className="rounded bg-white/[0.03] px-2 py-1 text-white/75 hover:bg-white/[0.05] hover:text-white/90">
        Fit
      </button>
      <button onClick={onResetLayout} className="rounded bg-white/[0.03] px-2 py-1 text-white/75 hover:bg-white/[0.05] hover:text-white/90">
        Reset
      </button>
      <button onClick={onToggleConnections} className="rounded bg-white/[0.03] px-2 py-1 text-white/75 hover:bg-white/[0.05] hover:text-white/90">
        {showConnections ? 'Hide Links' : 'Show Links'}
      </button>
      <button onClick={onToggleLabels} className="rounded bg-white/[0.03] px-2 py-1 text-white/75 hover:bg-white/[0.05] hover:text-white/90">
        {showLabels ? 'Hide Labels' : 'Show Labels'}
      </button>
      <button
        onClick={onFocusSelectedShot}
        className="rounded bg-white/[0.03] px-2 py-1 text-white/75 hover:bg-white/[0.05] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!selectedShotId}
      >
        Focus Shot
      </button>
      {typeof zoomPercent === 'number' ? <span className="ml-1 rounded bg-white/[0.03] px-1.5 py-1 text-[10px] text-white/60">{zoomPercent}%</span> : null}
  </div>
);
