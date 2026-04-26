import React from 'react';
import { SurgicalMediaPreview } from './SurgicalMediaPreview';
import type { RenderQueueJob } from '../../render/jobQueue';
import type { Conflict } from '../../types/presence';

// --- G1 STANDARD TYPES ---
export interface LivePreviewState {
  mode: 'idle' | 'ready' | 'queued' | 'preflight' | 'running' | 'packaging' | 'completed' | 'failed' | 'cancelled';
  activeJobId: string | null;
  activeShotId: string | null;
  previewImage: string | null;
  previewMedia: string | null;
  previewType: 'image' | 'video' | null;
  statusLabel: string | null;
  progressLabel: string | null;
  errorLabel: string | null;
  progressPercent?: number;
}

export interface LifecycleTransitionSignal {
  jobId?: string;
  previousState: Exclude<LivePreviewState['mode'], 'idle' | 'ready'>;
  nextState: Exclude<LivePreviewState['mode'], 'idle' | 'ready'>;
  timestamp: number;
}

export interface RuntimeSignalContext {
  lastTransition?: LifecycleTransitionSignal;
  stalled?: {
    active: boolean;
    sinceTimestamp?: number;
    state?: Exclude<LivePreviewState['mode'], 'idle' | 'ready'>;
  };
  queueMode?: 'running' | 'paused';
  selectedDiffersFromLive?: boolean;
}

export interface LaunchReadinessState {
  isReady: boolean;
  reason: string | null;
  checklist: Array<{ label: string; ok: boolean }>;
}

export interface ShootoutState {
  active: boolean;
  leftJobId?: string;
  rightJobId?: string;
  leftJob?: RenderQueueJob;
  rightJob?: RenderQueueJob;
  leftAuthority?: 'approved_output' | 'current_winner' | 'selected_attempt' | 'latest_attempt' | 'historical_artifact' | 'none';
  rightAuthority?: 'approved_output' | 'current_winner' | 'selected_attempt' | 'latest_attempt' | 'historical_artifact' | 'none';
  onExit: () => void;
  onCommit?: (side: 'left' | 'right', rationale: string) => void;
}

export interface RenderPreviewProps {
  sceneName?: string;
  livePreview: LivePreviewState;
  operatorFeedback?: {
    message: string;
    tone: 'info' | 'ok' | 'error';
    scope: 'launch' | 'queue' | 'review' | 'shot' | 'open' | 'delivery';
    emphasis?: 'waiting' | 'transition';
    visible: boolean;
  };
  launchReadiness: LaunchReadinessState;
  onLaunch: () => void;
  activeShotTitle?: string;
  activeShotId?: string;
  engineTargetLabel?: string;
  routeLabel?: string;
  strategyLabel?: string;
  selectedJobId?: string;
  selectedOutputPath?: string;
  authorityKind?: 'approved_output' | 'current_winner' | 'selected_attempt' | 'latest_attempt' | 'historical_artifact' | 'none';
  focusMode?: 'current' | 'selected';
  selectedFeedbackSummary?: {
    status: string;
    reason: string;
    nextStep: string;
    authorityLabel: string;
    focusLabel: string;
  };
  isLatest?: boolean;
  runtimeSignalContext?: RuntimeSignalContext;
  isDismissed?: boolean;
  onDismissFailure?: (jobId: string) => void;
  onJumpToLive?: () => void;
  onToggleLeftCollapse?: () => void;
  onToggleRightCollapse?: () => void;
  isLeftCollapsed?: boolean;
  isRightCollapsed?: boolean;
  shootout?: ShootoutState;
  conflicts?: Conflict[];
  selectedPreviewImage?: string | null;
  selectedPreviewMedia?: string | null;
  selectedPreviewType?: 'image' | 'video' | null;
}

// THE GATEKEEPER: Flipped to false for visual verification
const DISABLE_PREVIEW_RENDERING = false;

export const RenderPreview: React.FC<RenderPreviewProps> = (props) => {
  // Mapping existing props to the G1 Job abstraction for the Elastic HUD
  const job = {
    id: props.selectedJobId ?? props.livePreview.activeJobId,
    state: props.livePreview.mode,
    previewImage: props.selectedPreviewImage ?? props.selectedPreviewMedia ?? props.livePreview.previewImage ?? props.livePreview.previewMedia,
    previewMedia: props.selectedPreviewMedia ?? props.livePreview.previewMedia,
    previewType: props.selectedPreviewType ?? props.livePreview.previewType ?? 'image',
    shotName: props.activeShotTitle ?? 'No Selection',
    engine: props.engineTargetLabel ?? 'Veo',
    role: props.authorityKind === 'none' ? 'SHOT' : props.authorityKind?.split('_')[0].toUpperCase() || 'SHOT',
  };

  const { previewImage, previewMedia, previewType, state, id, role = "SHOT" } = job;

  const isRunning = ['queued', 'preflight', 'running', 'packaging'].includes(state);
  const isFailed = state === 'failed';
  const isCancelled = state === 'cancelled';
  const isReady = state === 'ready' || state === 'completed' || state === 'idle';

  const dotColor = isRunning ? '#8144C0' : isReady ? '#10B981' : (isFailed ? '#F43F5E' : '#525252');
  const dotShadow = isRunning ? 'shadow-[0_0_8px_#8144C0]' : isReady ? 'shadow-[0_0_8px_#10B981]' : (isFailed ? 'shadow-[0_0_8px_#F43F5E]' : '');

  const actionLabel = isRunning ? 'Signal Live' : (isFailed || isCancelled ? 'Retry Attempt' : 'Render Scene');

  return (
    <div className="relative flex-1 min-h-0 w-full bg-[#050505] flex flex-col overflow-hidden group">
      
      {/* VRAM ARMOR: Media Layer */}
      <div className="absolute inset-0 z-0">
        {previewImage && (
          <SurgicalMediaPreview 
            src={previewImage} 
            type={previewType || 'image'} 
            className="w-full h-full object-cover opacity-25 transition-opacity duration-1000"
          />
        )}
      </div>

      {/* G1 MINIMALIST HUD */}
      <div className="relative z-10 flex flex-col h-full p-12 justify-between pointer-events-none">
        
        {/* ZONE 1: SYSTEM ORIGIN */}
        <div className="flex justify-between items-start border-l-2 border-[#8144C0] pl-4 pointer-events-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-light text-neutral-500 uppercase tracking-widest">Job_ID</span>
            <span className="text-xs font-mono text-white/90 tracking-tight">{id || 'NULL_PTR'}</span>
          </div>

          {/* TACTICAL SIDEBAR CONTROLS */}
          <div className="flex gap-2 mx-auto">
             <button 
               onClick={props.onToggleLeftCollapse}
               className={`px-3 py-1 text-[9px] font-mono tracking-tighter border transition-all duration-200 ${props.isLeftCollapsed ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-neutral-600 hover:border-white/20 hover:text-white'}`}
             >
               {props.isLeftCollapsed ? '[+ L_SIDE]' : '[- L_SIDE]'}
             </button>
             <button 
               onClick={props.onToggleRightCollapse}
               className={`px-3 py-1 text-[9px] font-mono tracking-tighter border transition-all duration-200 ${props.isRightCollapsed ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-neutral-600 hover:border-white/20 hover:text-white'}`}
             >
               {props.isRightCollapsed ? '[+ R_SIDE]' : '[- R_SIDE]'}
             </button>
          </div>

          <div className="text-right flex flex-col items-end">
             <span className="text-[10px] font-light text-neutral-500 uppercase tracking-widest">Runtime State</span>
             <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold uppercase ${isFailed ? 'text-rose-400' : 'text-white'}`}>
                  {state === 'completed' && !previewImage && !previewMedia ? 'COMPLETED — NO ARTIFACT' : (state || 'READY')}
                </span>
                <div 
                  className={`w-1.5 h-1.5 rounded-full ${dotShadow} ${isRunning ? 'animate-pulse' : ''}`} 
                  style={{ backgroundColor: dotColor }} 
                />
             </div>
             {isFailed && props.livePreview.errorLabel && (
               <span className="text-[9px] font-mono text-rose-500/80 mt-1 max-w-[200px] truncate">{props.livePreview.errorLabel}</span>
             )}
          </div>
        </div>

        {/* ZONE 2: THE SUBJECT */}
        <div className="flex flex-col space-y-1 max-w-3xl pointer-events-auto">
          <div className="flex items-center gap-2">
             <div className="w-1 h-3 bg-[#8144C0]" />
             <span className="text-[10px] font-light text-neutral-400 tracking-widest uppercase">{role || 'Shot'} Context</span>
          </div>
          <div className="flex items-baseline gap-6">
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tighter text-white leading-none drop-shadow-xl">
              {job.shotName || 'No Selection'}
            </h1>
            
            {/* PRIMARY RENDER ACTION */}
            <button
              onClick={props.onLaunch}
              className={`px-6 py-2 text-[10px] font-bold tracking-[0.2em] uppercase border transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(129,68,192,0.2)] ${
                isFailed 
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                  : 'bg-[#8144C0] hover:bg-[#9359d1] text-white border-[#a166e2]'
              }`}
              disabled={!props.launchReadiness.isReady || isRunning}
            >
              {actionLabel}
            </button>
          </div>
        </div>

        {/* ZONE 3: TECHNICAL MANIFEST */}
        <div className="grid grid-cols-3 gap-8 border-t border-white/5 pt-6">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-light text-neutral-500 tracking-widest uppercase">Instructor</span>
            <span className="text-xs font-medium text-white uppercase">{job.engine || 'VEO'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-light text-neutral-500 tracking-widest uppercase">Latency</span>
            <span className="text-xs font-medium text-white">42ms</span>
          </div>
          <div className="flex flex-col gap-1 items-end justify-end ml-auto">
             <span className="text-[8px] font-light text-neutral-600 uppercase tracking-widest">Mikart DirectorOS v6.1</span>
          </div>
        </div>

      </div>
    </div>
  );
};



