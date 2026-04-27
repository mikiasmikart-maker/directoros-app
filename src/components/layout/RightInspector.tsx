import { memo, useState, useMemo, useEffect } from 'react';
import type { CompiledPromptPayload, EngineTarget, InspectorField, SceneNode, SelectedFeedbackSummary, QuickActionModel } from '../../models/directoros';
import type { MemoryCategory, MemoryProfile, PrimitiveValue } from '../../types/memory';
import type { DeliveryManifest } from '../../utils/manifestBuilder';
import { CompiledPromptPanel } from '../inspector/CompiledPromptPanel';
import { InspectorFields } from '../inspector/InspectorFields';
import { ProfileBindingSection } from '../inspector/ProfileBindingSection';
import { Panel } from '../shared/Panel';
import { RuntimeOfflineStatus } from '../shared/RuntimeOfflineStatus';
import { interactionClass } from '../shared/interactionContract';
import type { PostPipelineStageState, SceneGraphNode } from '../../types/graph';
import type { FamilyPreviewAuthorityKind } from '../../utils/familyPreviewAuthority';
import type { SelectedJobNextActionResolution } from '../../utils/selectedJobNextAction';
import type { RuntimeSignalContext, LivePreviewState } from '../workspace/RenderPreview';
import type { Conflict } from '../../types/presence';
import { formatOperatorId } from '../../utils/operationalLanguage';
// Presence imports removed to resolve TS6192 unused import error
const normalizeShotState = (state: string) => {
  if (state === 'compiling' || state === 'routed') return 'active';
  return state;
};

const shortJobId = (jobId?: string) => {
  if (!jobId) return 'n/a';
  if (jobId.length <= 12) return jobId;
  return `${jobId.slice(0, 6)}â€¦${jobId.slice(-4)}`;
};


type InspectorTab = 'pipeline' | 'intelligence' | 'decision' | 'activity';

interface RightInspectorProps {
  selectedFeedbackSummary?: SelectedFeedbackSummary;
  scene?: SceneNode;
  currentFocus?: Array<{ label: 'Scene' | 'Family' | 'Job' | 'Output'; value: string; active?: boolean }>;
  fields: InspectorField[];
  payload: CompiledPromptPayload | null;
  profiles: MemoryProfile[];
  engineTarget: EngineTarget;
  inspectorValues: Record<string, PrimitiveValue>;
  onEngineTargetChange: (target: EngineTarget) => void;
  onOverrideChange: (key: string, value: PrimitiveValue) => void;
  onBindProfile: (category: MemoryCategory, profileId: string) => void;
  selectedGraphNode?: SceneGraphNode;
  selectedGraphContext?: { upstream: string[]; downstream: string[] };
  postPipelineCollapsed?: boolean;
  postPipelineSummary?: { stages: PostPipelineStageState[]; activeStage?: string; completedCount: number; blockedStage?: string; overallStatus?: string; exportFormat?: string; resolution?: string; codec?: string; deliveryTarget?: string };
  activitySummary?: string;
  productionFamily?: {
    familyLabel: string;
    lineageRootId: string;
    familyState: string;
    lineageTrail: string[];
    timelineNodes?: Array<{ label: string; kind: 'root' | 'retry' | 'winner' | 'approved' | 'replacement'; active?: boolean; evidenceRole?: 'operational_truth' | 'supporting_evidence' | 'historical_artifact' }>;
    currentWinnerJobId?: string;
    approvedOutputJobId?: string;
    replacementJobId?: string;
    nextFamilyAction: string;
    evidenceTargetJobId?: string;
    evidenceReason?: string;
    rankedEvidenceCandidates?: Array<{ jobId: string; label: string; reason: string; role: 'operational_truth' | 'supporting_evidence' | 'historical_artifact'; isDefault?: boolean }>;
  };
  inboxItems?: import('../../review/reviewLineageTruth').InboxItem[];
  onJumpToInboxItem?: (item: import('../../review/reviewLineageTruth').InboxItem) => void;
  selectedJobTelemetry?: {
    previewAuthority?: {
      kind: FamilyPreviewAuthorityKind;
      label: string;
      jobId?: string;
    };
    status: string;
    lifecycle: string;
    mode: string;
    activeRoute: string;
    strategy: string;
    preflight: string;
    dependencyHealth: string;
    canonicalState?: string;
    authoritativeOutput?: string;
    lineageSummary?: string;
    nextAction?: SelectedJobNextActionResolution;
    lastMeaningfulChange?: string;
    currentWinnerJobId?: string;
    approvedOutputJobId?: string;
    replacementJobId?: string;
    selectedJobId?: string;
    selectedOutputPath?: string;
    failedStage?: string;
    failureReason?: string;
    manifestPath?: string;
    pinned?: boolean;
    metadata?: Record<string, any>;
    technicalSpecs?: {
      resolution?: string;
      codec?: string;
      exportFormat?: string;
    };
  };
  resolvedPreviewContext?: {
    currentOutput?: { jobId?: string; path?: string; kind: string; isAuthority: boolean };
    selectedOutput?: { jobId?: string; path?: string; kind: string; isAuthority: boolean };
    approvedOutput?: { jobId?: string; path?: string; kind: string; isAuthority: boolean };
    deliverableReadyOutput?: { jobId?: string; path?: string; kind: string; isAuthority: boolean };
    authorityKind: FamilyPreviewAuthorityKind;
    authorityJobId?: string;
    focusMode: 'current' | 'selected';
    isAuthority: boolean;
  };
  livePreview: LivePreviewState;
  sceneReviewBoard?: {
    actionAggregates?: { approved: number; finalized: number; needsRevision: number; rejected: number; superseded: number; total: number };
    status: string;
    passRate: { value: number; approved: number; reviewable: number };
    retryPressure: { value: number; band: string };
    bestKnownCoverage: { value: number; covered: number; reviewable: number };
    failureClusters: Array<{ reasonCode: string; count: number; shots: string[] }>;
    explanations: { summary: string; whyNotApproved: string; fastestPathToGreen: string };
    shotExceptions: Array<{ shotId: string }>;
    evidenceRefs: { shotIds: string[]; reasonCodes: string[] };
  };
  shotQueue?: Array<{ id: string; title: string; order: number; state: string; progress: number; stage: string; lastAction: string; isCurrent: boolean }>;
  activeShotId?: string;
  shotJobLedger?: Array<{ jobId: string; shotId?: string; takeId?: string; version?: number; state: string; progress: number; createdAt: number; route: string; retryDepth?: number; lineageParentJobId?: string; technicalQuality?: number; artifactSeverity?: number; motionStability?: number; bestKnown?: boolean; retrySuggested?: boolean; retryReasonCode?: string; reviewStatus?: string; approvalStatus?: string; actionState?: string; approvedBy?: string; approvedAt?: number; supersededJobId?: string; supersededByJobId?: string; supersedesJobId?: string; finalizedAt?: number; explanationSnippet?: string }>;
  shotLedgerScope?: 'this_shot' | 'all_scene';
  onShotLedgerScopeChange?: (scope: 'this_shot' | 'all_scene') => void;
  selectedShotForLedger?: string;
  onSelectJobFromLedger?: (jobId: string) => void;
  onJumpToShotFromLedger?: (shotId: string) => void;
  onShotAction?: (action: 'start_shot' | 'mark_complete' | 'skip_shot' | 'reset_shot' | 'start_sequence' | 'next_shot' | 'reset_sequence') => void;
  onPostWorkflowAction?: (action: 'approve_review' | 'complete_edit' | 'complete_export' | 'complete_delivery' | 'fail_export' | 'reset' | 'approve_delivery') => void;
  selectedJobQuickActions?: QuickActionModel;
  onOpenEvidence?: () => void;
  onOpenEvidenceCandidate?: (jobId: string) => void;
  onToggleCompareCandidate?: (jobId: string) => void;
  operatorFeedback?: {
    message: string;
    tone: 'info' | 'ok' | 'error';
    scope: 'launch' | 'queue' | 'review' | 'shot' | 'open' | 'delivery';
    emphasis?: 'waiting' | 'transition';
    visible: boolean;
  };
  runtimeSignalContext?: RuntimeSignalContext;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isFocusMode?: boolean;
  presenceActivities?: import('../../types/presence').PresenceActivity[];
  operators?: import('../../types/presence').Operator[];
  conflicts?: Conflict[];
  familyDecisionHistory?: import('../../review/reviewLineageTruth').DecisionHistoryEntry[];
  streamState?: 'connected' | 'degraded' | 'offline';
  deliveryManifest?: DeliveryManifest | null;
}

const getLatencySupportCopy = (selectedJobTelemetry?: RightInspectorProps['selectedJobTelemetry']) => {
  if (!selectedJobTelemetry) return null;

  if (selectedJobTelemetry.status === 'queued') return 'Queued for lane.';
  if (selectedJobTelemetry.status === 'preflight') return 'Checks in motion.';
  if (selectedJobTelemetry.status === 'running') return 'Run in motion.';
  if (selectedJobTelemetry.status === 'packaging') return 'Preparing preview.';
  return null;
};

const getActionFeedbackLabel = (selectedJobTelemetry?: RightInspectorProps['selectedJobTelemetry'], productionFamily?: RightInspectorProps['productionFamily']) => {
  if (selectedJobTelemetry?.status === 'queued') return 'Signal received';
  if (selectedJobTelemetry?.status === 'preflight' || selectedJobTelemetry?.status === 'running' || selectedJobTelemetry?.status === 'packaging') return 'Signal live';
  if (productionFamily) return 'Signal live';
  return 'Signal ready';
};

export const RightInspector = memo(({
  selectedFeedbackSummary,
  scene,
  fields,
  payload,
  profiles,
  engineTarget,
  inspectorValues,
  onEngineTargetChange,
  onOverrideChange,
  onBindProfile,
  selectedGraphNode,
  selectedGraphContext,
  postPipelineCollapsed = false,
  postPipelineSummary,
  activitySummary,
  productionFamily,
  inboxItems,
  selectedJobTelemetry,
  sceneReviewBoard,
  shotQueue,
  activeShotId,
  onJumpToShotFromLedger,
  onShotAction,
  onPostWorkflowAction,
  selectedJobQuickActions,
  onOpenEvidence: _onOpenEvidence,
  onOpenEvidenceCandidate,
  operatorFeedback,
  runtimeSignalContext,
  resolvedPreviewContext,
  livePreview,
  isCollapsed = false,
  onToggleCollapse,
  isFocusMode = false,
  presenceActivities = [],
  operators = [],
  conflicts = [],
  familyDecisionHistory = [],
  streamState = 'connected',
  onJumpToInboxItem,
  deliveryManifest,
}: RightInspectorProps) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('decision');

  // Phase 4.1: Resolve Bidirectional Triage Shuttle Logic
  const nextMissingShot = useMemo(() => {
    if (!deliveryManifest || !deliveryManifest.shots) return null;
    const currentIndex = deliveryManifest.shots.findIndex(s => s.shotId === activeShotId);
    // Forward-only search for 'missing' status (no wraparound)
    return deliveryManifest.shots.slice(currentIndex + 1).find(s => s.status === 'missing') ?? null;
  }, [deliveryManifest, activeShotId]);

  const prevMissingShot = useMemo(() => {
    if (!deliveryManifest || !deliveryManifest.shots) return null;
    const currentIndex = deliveryManifest.shots.findIndex(s => s.shotId === activeShotId);
    if (currentIndex <= 0) return null;
    // Backward-only search for 'missing' status (no wraparound)
    return [...deliveryManifest.shots.slice(0, currentIndex)].reverse().find(s => s.status === 'missing') ?? null;
  }, [deliveryManifest, activeShotId]);

  const formatShuttleLabel = (shot: { order: number; label: string }, prefix: string) => {
    const shortTitle = shot.label.length > 14 ? `${shot.label.slice(0, 13)}…` : shot.label;
    return `${prefix} [${shot.order.toString().padStart(2, '0')}] • ${shortTitle.toUpperCase()}`;
  };

  const missingCount = useMemo(() => {
    if (!deliveryManifest || !deliveryManifest.shots) return 0;
    return deliveryManifest.shots.filter(s => s.status === 'missing').length;
  }, [deliveryManifest]);


  const handleDownloadManifestJson = (manifest: DeliveryManifest) => {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = manifest.metadata.sealedAt || manifest.metadata.generatedAt;
    const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = manifest.sequence.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `manifest_${safeName}_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pass 37: Entry Intent Pivot
  // When entering a new family focus that has decision intent (evidenceReason),
  // force pivot to the 'decision' tab.
  useEffect(() => {
    if (productionFamily?.lineageRootId && productionFamily.evidenceReason) {
      setActiveTab('decision');
    }
  }, [productionFamily?.lineageRootId]);

  const normalizedShotQueue = (shotQueue ?? []).map((shot) => ({ ...shot, state: normalizeShotState(shot.state) }));
  const activeShot = normalizedShotQueue.find((shot) => shot.id === activeShotId) ?? normalizedShotQueue.find((shot) => shot.isCurrent);
  const hasActiveShot = Boolean(activeShot);
  const primarySequenceAction = hasActiveShot ? 'next_shot' : 'start_sequence';
  const primarySequenceLabel = hasActiveShot ? 'Next Shot' : 'Start Sequence';
  const hasExplicitSelection = Boolean(selectedGraphNode || selectedJobTelemetry || productionFamily);
  const hasSelectedJobTarget = Boolean(selectedJobTelemetry?.selectedJobId);
  const selectedJobPrimaryControl = selectedJobQuickActions?.primary;
  // Phase 4, Vector A: Delivery Readiness Logic (Refined: Job > Graph)
  const deliveryReadiness = useMemo(() => {
    if (!selectedJobTelemetry) return null;

    const isApproved =
      selectedJobTelemetry.approvedOutputJobId === selectedJobTelemetry.selectedJobId ||
      selectedJobTelemetry.canonicalState === 'approved' ||
      selectedJobTelemetry.canonicalState === 'finalized';
    
    const isExecutionSuccess = selectedJobTelemetry.canonicalState === 'completed' || 
                               selectedJobTelemetry.canonicalState === 'approved' || 
                               selectedJobTelemetry.canonicalState === 'finalized' ||
                               selectedJobTelemetry.lifecycle === 'completed';
    const hasArtifact = Boolean(selectedJobTelemetry.selectedOutputPath);

    // Specs Authoritative Check (Job > Sequence/Graph Fallback)
    const specs = {
      resolution: selectedJobTelemetry.technicalSpecs?.resolution || postPipelineSummary?.resolution || selectedGraphNode?.resolution,
      codec: selectedJobTelemetry.technicalSpecs?.codec || postPipelineSummary?.codec || selectedGraphNode?.codec,
      exportFormat: selectedJobTelemetry.technicalSpecs?.exportFormat || postPipelineSummary?.exportFormat || selectedGraphNode?.export_format,
    };

    const hasSpecs = Boolean(specs.resolution && specs.exportFormat);

    const missing = [];
    if (!isExecutionSuccess) missing.push('Render Execution Incomplete');
    if (!isApproved) missing.push('Awaiting Approval');
    if (!hasSpecs) missing.push('Technical Specs Missing');
    if (!hasArtifact) missing.push('Master Asset Unresolved');

    const isReady = missing.length === 0;

    const nextAction = !isExecutionSuccess ? 'Run render pipeline' : 
                       !isApproved ? 'Review and approve output' :
                       !hasSpecs ? 'Update technical specs' :
                       !hasArtifact ? 'Reconcile artifact path' : 'Ready to lock';

    const isPromotionCandidate = isExecutionSuccess && hasArtifact && hasSpecs && !isApproved;

    return { isReady, missing, nextAction, specs, isPromotionCandidate };
  }, [selectedJobTelemetry, selectedGraphNode]);

  const isActionRequired = Boolean(selectedJobPrimaryControl && !selectedJobPrimaryControl.disabled);
  const decisionActionLabel = selectedJobPrimaryControl?.label ?? selectedJobTelemetry?.nextAction?.primaryActionLabel ?? productionFamily?.nextFamilyAction ?? 'Inspect';
  const decisionActionReason = selectedJobPrimaryControl
    ? (selectedJobPrimaryControl.disabled && selectedJobPrimaryControl.disabledReason
      ? `Blocked: ${selectedJobPrimaryControl.disabledReason}`
      : (selectedJobPrimaryControl.key === 'open_output' ? 'Reviewing output detail.' : `Next move: ${selectedJobPrimaryControl.label}`))
    : (selectedJobTelemetry?.nextAction?.primaryActionReason ?? 'Decision authority is waiting on the next local handoff.');
  const focusStateLabel = hasSelectedJobTarget ? (resolvedPreviewContext?.focusMode === 'selected' ? 'job + selected output in focus' : 'job in focus') : productionFamily ? 'family in focus' : 'no focus';
  const latencySupportCopy = getLatencySupportCopy(selectedJobTelemetry);
  const actionFeedbackLabel = getActionFeedbackLabel(selectedJobTelemetry, productionFamily);
  const hasActiveRender =
    selectedJobTelemetry?.status === 'queued' ||
    selectedJobTelemetry?.status === 'preflight' ||
    selectedJobTelemetry?.status === 'running' ||
    selectedJobTelemetry?.status === 'packaging';
  const justChangedLabel = !hasActiveRender && runtimeSignalContext?.lastTransition && runtimeSignalContext.lastTransition.jobId === selectedJobTelemetry?.selectedJobId
    ? `Just changed: ${runtimeSignalContext.lastTransition.previousState} â†’ ${runtimeSignalContext.lastTransition.nextState}`
    : null;

  const mergedCoordinationTimeline = useMemo(() => {
    const familyId = productionFamily?.lineageRootId;
    if (!familyId) return [];

    const intents = presenceActivities
      .filter((act) => act.targetId === familyId && act.operatorId !== 'op_alpha')
      .map((act) => ({
        id: `intent-${act.operatorId}-${act.type}`,
        uid: act.operatorId,
        kind: 'active_intent' as const,
        type: act.type,
        timestamp: Date.now(), // Ephemeral
      }));

    const decisions = familyDecisionHistory.map((entry) => ({
      id: `decision-${entry.eventId}`,
      uid: entry.actor === 'operator' ? 'op_alpha' : 'system', // Default to alpha if operator, or system
      kind: 'resolved_decision' as const,
      type: entry.eventType,
      timestamp: entry.occurredAt,
      summary: entry.description,
    }));

    return [...intents, ...decisions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [productionFamily?.lineageRootId, presenceActivities, familyDecisionHistory]);


  const stalledLabel = runtimeSignalContext?.stalled?.active ? `No new runtime signal${runtimeSignalContext.stalled.state ? ` • ${runtimeSignalContext.stalled.state}` : ''}` : null;

  if (isCollapsed) {
    return (
      <aside className={`h-full border-l border-white/5 bg-[#050505] p-1 ${isFocusMode ? 'focus-dim' : ''}`}>
        <button
          type="button"
          aria-label="Expand inspector panel"
          onClick={onToggleCollapse}
          className="group inline-flex h-full w-full items-center justify-center rounded-md border border-white/5 bg-white/[0.02] text-neutral-600 transition-all hover:bg-white/[0.04] hover:text-neutral-400 active:scale-[0.98]"
        >
          <span className="text-lg leading-none transition-transform duration-180 group-hover:-translate-x-[1px]">‹</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={`h-full min-h-0 flex flex-col overflow-hidden border-l border-white/5 bg-[#050505] ${isFocusMode ? 'focus-dim' : ''}`}>
      {/* 1. UNIFIED HEADER */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4 bg-black/20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Collapse inspector panel"
            onClick={onToggleCollapse}
            className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            ›
          </button>
          <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            <div className="w-1 h-3 bg-[#8144C0]" />
            Inspector
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedJobQuickActions?.secondary.find(a => a.key === 'cancel_job') && (
            <button
              onClick={selectedJobQuickActions.secondary.find(a => a.key === 'cancel_job')?.onTrigger}
              disabled={selectedJobQuickActions.secondary.find(a => a.key === 'cancel_job')?.disabled}
              className="text-[8px] font-mono text-rose-500/60 hover:text-rose-400 uppercase tracking-widest border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 rounded transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Cancel Run
            </button>
          )}
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-0.5 border border-white/5">
            <div className="h-1 w-1 rounded-full bg-[#8144C0] animate-pulse shadow-[0_0_8px_rgba(129,68,192,0.4)]" />
            <span className="text-[8px] font-mono text-[#8144C0]/80 uppercase tracking-widest font-bold">Signal Live</span>
          </div>
        </div>
      </header>

      {/* 1b. HUD CONTEXT (Optional sub-header for telemetry) */}
      <div className="flex flex-col border-b border-white/[0.03] bg-black/10 px-4 py-2 gap-1">
        <div className="text-[11px] font-mono text-white/80 truncate tracking-tighter">
          {scene?.name ?? 'No_Scene'} <span className="text-neutral-700 mx-1">//</span> {activeShot?.title ?? 'No_Shot'}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-neutral-600 uppercase">Registry:</span>
          <span className="text-[8px] font-mono text-neutral-500">
            {selectedJobTelemetry?.selectedJobId ? formatOperatorId(selectedJobTelemetry.selectedJobId, 'JOB') : 'NONE_PTR'}
          </span>
        </div>
      </div>

      {/* 2. TABS: Manifest Navigation */}
      <nav className="flex items-center border-b border-white/[0.03] bg-black/20">
        {(['decision', 'intelligence', 'activity', 'pipeline'] as InspectorTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const hasSignal = tab === 'decision' && isActionRequired;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[9px] font-mono uppercase tracking-[0.1em] transition-all relative ${
                isActive 
                  ? 'text-white bg-white/[0.03]' 
                  : 'text-neutral-500 hover:text-neutral-400 hover:bg-white/[0.01]'
              }`}
            >
              {tab}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8144C0]" />}
              {hasSignal && <span className="absolute right-2 top-2 h-1 w-1 rounded-full bg-[#8144C0]" />}
            </button>
          );
        })}
      </nav>

      {/* 3. CONTENT ZONE */}
      <div className="flex-1 min-h-0 overflow-y-auto m6-scrollbar-thin p-3 space-y-4">
        <RuntimeOfflineStatus state={streamState} />

        {!hasExplicitSelection ? (
          <div className="flex flex-col px-6 pt-16 pb-8 h-full animate-in fade-in duration-1000 ease-out">
            <div className="mb-12">
              <div className="mb-2 text-[9px] uppercase font-bold tracking-[0.3em] text-white/10 select-none">System Presence</div>
              <div className="text-[12px] text-white/30 leading-[1.7] font-light">
                Awaiting operator selection to populate inspector fields. Use <span className="text-white/50 font-medium select-none">ESC</span> to clear focus stacks.
              </div>
            </div>

            {inboxItems && inboxItems.length > 0 ? (
              <div className="space-y-6">
                <div className="group">
                  <div className="mb-2.5 text-[10px] uppercase tracking-[0.15em] text-textMuted/40 group-hover:text-textMuted/60 transition-colors">Pending Handoff</div>
                  <div className="p-3.5 rounded bg-panel/20 border border-[var(--m6-border-soft)] shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[11px] font-medium text-text/90">{inboxItems[0].label}</div>
                      <div className="text-[9px] text-textMuted/50 tabular-nums">01</div>
                    </div>
                    <div className="text-[10px] text-textMuted/50 mb-4 leading-relaxed">
                      {inboxItems[0].reason} • {inboxItems[0].priority.replace('_', ' ')}
                    </div>

                    <button
                      onClick={() => onJumpToInboxItem?.(inboxItems[0])}
                      className="w-full py-2.5 rounded bg-panel/40 hover:bg-panel/60 text-text/90 text-[10px] uppercase tracking-[0.2em] font-medium transition-[background-color,border-color,transform] duration-120 border border-[var(--m6-border-soft)] active:scale-[0.98]"
                    >
                      Jump to Next Context ›
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.13em] text-textMuted/40 text-left">Pressure</div>
                    <div className={`text-xs font-medium ${sceneReviewBoard?.retryPressure.band === 'critical' ? 'text-rose-400/80' :
                        sceneReviewBoard?.retryPressure.band === 'high' ? 'text-amber-400/80' :
                          'text-cyan-400/70'
                      }`}>
                      {sceneReviewBoard?.retryPressure.band.toUpperCase() ?? 'STABLE'}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.13em] text-textMuted/40 text-left">Pipeline</div>
                    <div className="text-xs font-medium text-textMuted/80">
                      {sceneReviewBoard?.actionAggregates?.approved ?? 0} / {sceneReviewBoard?.actionAggregates?.total ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-1000">
                <div className="mb-6">
                  <div className="mb-3 text-[9px] uppercase font-bold tracking-[0.2em] text-white/10">Queue Status</div>
                  <div className="p-5 rounded border border-dashed border-white/[0.03] bg-white/[0.01] text-[11px] text-white/20 leading-relaxed italic font-light">
                    Inbox is quiet. All pending triage signals have been cleared or dismissed.
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] tracking-wide">
                    <span className="text-textMuted/40 uppercase">Scene Health</span>
                    <span className="text-cyan-400/60 font-medium">{sceneReviewBoard?.status.toUpperCase() ?? 'HEALTHY'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] tracking-wide">
                    <span className="text-textMuted/40 uppercase">Approval Coverage</span>
                    <span className="text-textMuted/80 font-medium">
                      {Math.round((sceneReviewBoard?.bestKnownCoverage.value ?? 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto border-t border-[var(--m6-border-soft)] pt-6 text-center">
              <div className="text-[9px] uppercase tracking-[0.3em] text-textMuted/20 font-light">
                DirectorOS • Operator Shell
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'intelligence' ? (
          <div className="animate-in fade-in slide-in-from-right-1 duration-150">
            <div className="mb-3 space-y-3.5 rounded-md border border-[var(--m6-border-soft)] bg-[linear-gradient(180deg,rgba(18,18,20,0.58)_0%,rgba(14,14,16,0.54)_100%)] px-3 py-3 shadow-[0_6px_14px_rgba(2,6,23,0.07),inset_0_1px_0_rgba(255,255,255,0.01)]">
              <div>
                <div className="mb-1 text-[11px] font-medium text-slate-300/88">Render Engine</div>
                <select
                  value={engineTarget}
                  onChange={(event) => onEngineTargetChange(event.target.value as EngineTarget)}
                  disabled={streamState === 'offline'}
                  title={streamState === 'offline' ? 'Runtime Offline' : undefined}
                  className="m6-control w-full rounded-md bg-[rgba(18,18,20,0.62)] px-2 py-1.5 text-xs text-text transition-[border-color,box-shadow] duration-180 motion-reduce:transition-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <option value="auto">Auto</option>
                  <option value="flux">Flux</option>
                  <option value="veo">Veo</option>
                  <option value="runway">Runway</option>
                  <option value="comfyui">ComfyUI</option>
                </select>
              </div>

              <div className="rounded-md border border-[var(--m6-border-soft)] bg-panel/18 px-3 py-3 text-[10px] text-slate-400/66">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500/62">Control Read</div>
                  <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-[9px] text-slate-400/62">local surface</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded bg-panel/20 px-2.5 py-2.5">
                    <div className="text-[10px] text-slate-300/80">Operator-ready inputs</div>
                    <div className="mt-1 text-[10px] leading-[1.5] text-slate-500/60">Every control is phrased for shot direction, not schema structure, so decisions scan faster.</div>
                  </div>
                  <div className="rounded bg-panel/20 px-2.5 py-2.5">
                    <div className="text-[10px] text-slate-300/80">Readable source badges</div>
                    <div className="mt-1 text-[10px] leading-[1.5] text-slate-500/60">Each field shows where its guidance comes from so scene defaults, memory pulls, and manual overrides stay clear.</div>
                  </div>
                  <div className="rounded bg-panel/20 px-2.5 py-2.5">
                    <div className="text-[10px] text-slate-300/80">Cinematic grouping</div>
                    <div className="mt-1 text-[10px] leading-[1.5] text-slate-500/60">Controls are arranged by shot intent, framing, movement, and atmosphere for quick operator passes.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'pipeline' && postPipelineSummary ? (
          <div className="animate-in fade-in slide-in-from-right-1 duration-150">
            <div className="mb-3 rounded-md border border-[var(--m6-border-soft)] bg-[linear-gradient(180deg,rgba(18,18,20,0.6)_0%,rgba(14,14,16,0.56)_100%)] px-3.5 py-3 text-[11px] text-slate-300/78 shadow-[0_8px_20px_rgba(2,6,23,0.1),inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-medium text-slate-300/90">Post Pipeline Summary</div>
                <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-[10px] text-slate-500/64">
                  {postPipelineCollapsed ? 'folded' : 'live'}
                </span>
              </div>
              <div className="mt-2 space-y-1.5 text-[11px] text-slate-300/72">
                {postPipelineSummary.stages.map((stage) => {
                  const isActive = stage.status === 'active';
                  const isCompleted = ['approved', 'ready', 'completed'].includes(stage.status);
                  return (
                    <div
                      key={stage.stage}
                      className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 ${isActive
                        ? 'border-[var(--m6-state-focus-border)]/40 bg-panel/46 shadow-[inset_2px_0_0_var(--m6-state-focus-border)]'
                        : isCompleted
                          ? 'border-[var(--dos-border)] bg-panel/30 shadow-[inset_2px_0_0_var(--m6-state-active-fg)]/20'
                          : 'border-[var(--m6-border-soft)] bg-panel/20'
                        }`}
                    >
                      <span className={isActive ? 'text-slate-100/84' : isCompleted ? 'text-slate-300/70' : 'text-slate-400/62'}>{stage.label}</span>
                      <span className=" text-[10px] text-textMuted/50">{stage.status}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 pt-2 text-[11px]">
                <span className="text-[10px] text-slate-500 mt-0.5">Active Stage</span>
                <span className="text-slate-300">{postPipelineSummary.activeStage ?? 'none'}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Completed</span>
                <span className="text-slate-300">{postPipelineSummary.completedCount}/{postPipelineSummary.stages.length}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Overall</span>
                <span className="text-slate-300">{postPipelineSummary.overallStatus ?? 'waiting'}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Export</span>
                <span className="text-slate-300">{postPipelineSummary.exportFormat ?? 'mp4'}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Delivery</span>
                <span className="text-slate-300">{postPipelineSummary.deliveryTarget ?? 'internal screening'}</span>
              </div>
              <div className="mt-2 pt-2">
                {postPipelineSummary.activeStage === 'Review' ? (
                  <button onClick={() => onPostWorkflowAction?.('approve_review')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-[10px] text-accent transition-[background-color,color,box-shadow,transform] duration-180 ease-out hover:bg-accent/12 active:scale-[0.98] focus-visible:outline-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35">Approve Review</button>
                ) : null}
                {postPipelineSummary.activeStage === 'Edit' ? (
                  <button onClick={() => onPostWorkflowAction?.('complete_edit')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-[10px] text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">Approve Edit</button>
                ) : null}
                {postPipelineSummary.activeStage === 'Export' ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onPostWorkflowAction?.('complete_export')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-[10px] text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">Approve Export</button>
                    <button onClick={() => onPostWorkflowAction?.('fail_export')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] text-rose-100/80 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:text-rose-100/90 active:text-rose-100/84 focus-visible:outline-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-rose-100/80">Fail Export</button>
                  </div>
                ) : null}
                {(postPipelineSummary.activeStage === 'Delivery' || postPipelineSummary.overallStatus?.includes('delivery ready')) ? (
                  <button onClick={() => onPostWorkflowAction?.('complete_delivery')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-[10px] text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">Approve Delivery</button>
                ) : null}

                <details className="mt-2">
                  <summary className="cursor-pointer rounded text-[10px] text-slate-500/64 focus-visible:outline-none focus-visible:m6-focus-ring">Advanced</summary>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {postPipelineSummary.activeStage !== 'Export' ? (
                      <button onClick={() => onPostWorkflowAction?.('fail_export')} className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] text-textMuted/85 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:text-text/80 active:text-text/76 focus-visible:outline-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-textMuted/85">Fail Export</button>
                    ) : null}
                    <button onClick={() => onPostWorkflowAction?.('reset')} className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] text-textMuted/85 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:text-text/80 active:text-text/76 focus-visible:outline-none focus-visible:m6-focus-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-textMuted/85">Reset Post Workflow</button>
                  </div>
                </details>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'decision' && (selectedJobTelemetry || productionFamily) ? (
          <div className="animate-in fade-in slide-in-from-right-1 duration-150">
            <div className="mb-2 rounded-md border border-[var(--m6-border-soft)] bg-[linear-gradient(180deg,rgba(18,18,20,0.52)_0%,rgba(14,14,16,0.48)_100%)] px-2.5 py-2.5 text-[10px] text-slate-500/60 shadow-[0_6px_16px_rgba(2,6,23,0.06),inset_0_1px_0_rgba(255,255,255,0.008)]">
              <div className={`rounded border px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.008)] transition-[background-color,border-color,box-shadow] duration-180 ${isActionRequired ? 'border-accent/40 bg-accent/[0.04] shadow-[0_0_12px_rgba(120,160,255,0.05)]' : 'border-[var(--m6-border-soft)] bg-panel/12'}`}>
                <div className="flex items-center justify-between gap-1.5">
                  {decisionActionLabel ? (
                    <button
                      type="button"
                      disabled={!selectedJobPrimaryControl || selectedJobPrimaryControl.disabled}
                      onClick={selectedJobPrimaryControl?.onTrigger}
                      className={`rounded border px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase transition-all active:scale-[0.98] ${
                        selectedJobPrimaryControl && !selectedJobPrimaryControl.disabled
                          ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                          : selectedJobTelemetry?.status === 'failed' 
                            ? 'border-rose-500/20 bg-rose-500/5 text-rose-400/80' 
                            : 'border-[var(--m6-border-soft)] bg-panel/12 text-slate-500/60 cursor-not-allowed'
                      }`}
                    >
                      {decisionActionLabel}
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 text-[10.5px] leading-[1.5] text-slate-300 font-medium tracking-tight">
                  {decisionActionReason}
                </div>

                {selectedJobTelemetry?.status === 'failed' && (
                  <div className="mt-2 border-t border-rose-500/10 pt-2 text-[10px] text-slate-400/90 leading-relaxed italic">
                    {selectedJobTelemetry.failureReason ?? 'Execution paused at unexpected state.'}
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[8px]">
                  <span className={`m6-signal-elevated rounded border px-1.5 py-0.5 font-bold uppercase tracking-tight shadow-[0_0_8px_rgba(34,211,238,0.1)] border-cyan-400/40 bg-cyan-500/10 text-cyan-100`}>
                    {selectedJobTelemetry?.canonicalState ?? selectedJobTelemetry?.lifecycle ?? (hasActiveRender ? livePreview.mode : 'Idle State')}
                  </span>
                  <span className={`m6-signal-ambient rounded border px-1.5 py-0.5 font-bold uppercase tracking-tight ${hasActiveRender ? 'border-transparent text-slate-700' : 'border-[var(--m6-border-soft)] text-slate-500'}`}>{focusStateLabel}</span>
                </div>

                {/* Dedicated Pre-Commit Conflict Warning */}
                {conflicts.length > 0 && (
                  <div className={`mt-3 rounded-md border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)] ${conflicts.some(c => c.severity === 'high') ? 'border-[var(--m6-state-stop-border)] bg-[var(--m6-state-stop-bg)] text-[var(--m6-state-critical-fg)] m6-animate-pulse-urgent' : 'border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] text-[var(--m6-state-warn-fg)]'
                    }`}>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em]">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      Conflict Signal
                    </div>
                    <div className="mt-1.5 text-[10px] font-medium leading-[1.4]">
                      {conflicts[0].message}
                      {conflicts.length > 1 && <span className="ml-1 opacity-60 italic">(+{conflicts.length - 1} other risky overlaps)</span>}
                    </div>
                  </div>
                )}

                {/* Phase 4: Delivery Validation Section */}
                {deliveryReadiness && (
                  <div className={`mt-3 rounded-md border px-3 py-2.5 transition-all duration-180 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)] ${deliveryReadiness.isReady ? 'border-[var(--dos-border)] bg-panel/24' : 'border-[var(--m6-border-soft)] bg-panel/12'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500/70">Delivery Validation</div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${deliveryReadiness.isReady ? 'm6-signal-elevated border-emerald-400/30 bg-emerald-500/10 text-emerald-100/90' : 'm6-signal-ambient border-slate-500/30 bg-slate-500/10 text-slate-400'}`}>
                        {deliveryReadiness.isReady ? 'Ready' : 'Incomplete'}
                      </span>
                    </div>
                    
                    <div className="mt-2.5 space-y-1.5">
                      {deliveryReadiness.isReady ? (
                        <div className="text-[10px] text-emerald-200/60 leading-[1.4] italic">
                          All authority requirements met. Shot is verified for deliverable handoff.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {deliveryReadiness.missing.map(req => (
                            <div key={req} className="flex items-center gap-2 text-[10px] text-textMuted/64">
                              <span className="h-1 w-1 rounded-full bg-slate-700" />
                              {req}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 border-t border-white/[0.04] pt-2 flex items-center justify-between group">
                      <div className="text-[9px] text-slate-500">Next Action</div>
                      {selectedJobPrimaryControl && !selectedJobPrimaryControl.disabled ? (
                        <button
                          type="button"
                          onClick={selectedJobPrimaryControl.onTrigger}
                          className={`text-[10px] font-bold tracking-tight px-2 py-0.5 rounded transition-all hover:bg-accent/10 active:scale-[0.98] ${deliveryReadiness.isReady ? 'text-accent' : 'text-slate-300'}`}
                        >
                          {deliveryReadiness.nextAction} ›
                        </button>
                      ) : (
                        <div className={`text-[10px] font-medium ${deliveryReadiness.isReady ? 'text-accent' : 'text-slate-300/80'}`}>
                          {deliveryReadiness.nextAction}
                        </div>
                      )}
                    </div>

                    {deliveryReadiness.isPromotionCandidate && (
                      <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <button
                          onClick={() => onPostWorkflowAction?.('approve_delivery')}
                          disabled={streamState === 'offline'}
                          className="w-full py-2.5 rounded-md bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-500/15 active:scale-[0.98] transition-all duration-120 flex items-center justify-center gap-2"
                        >
                          <span className="text-[10px] uppercase tracking-[0.14em] font-bold">Approve for Delivery</span>
                          <span className="text-xs transition-transform group-active:translate-x-0.5">›</span>
                        </button>
                        <div className="mt-1.5 text-center text-[8px] text-emerald-500/40 uppercase tracking-widest font-medium">Promote validated output to production truth</div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Phase 4: Delivery Manifest (Export Logic) */}
                {deliveryManifest && (
                  <div className="mt-4 pt-4 border-t-2 border-dashed border-cyan-500/15 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-4 flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                        Delivery Manifest
                      </div>
                      <div className="flex items-center gap-3">
                        {prevMissingShot && (
                          <button
                            type="button"
                            onClick={() => onJumpToShotFromLedger?.(prevMissingShot.shotId)}
                            className="text-[9px] uppercase tracking-[0.12em] font-bold text-cyan-400/40 hover:text-cyan-300 transition-colors flex items-center gap-1 group"
                          >
                            <span className="text-[10px] transition-transform group-hover:-translate-x-0.5">«</span>
                            <span>{formatShuttleLabel(prevMissingShot, 'Prev')}</span>
                          </button>
                        )}
                        {nextMissingShot && (
                          <button
                            type="button"
                            onClick={() => onJumpToShotFromLedger?.(nextMissingShot.shotId)}
                            className="text-[9px] uppercase tracking-[0.12em] font-bold text-cyan-400/60 hover:text-cyan-300 transition-colors flex items-center gap-1 group"
                          >
                            <span>{formatShuttleLabel(nextMissingShot, 'Next')} · {missingCount} remaining</span>
                            <span className="text-[10px] transition-transform group-hover:translate-x-0.5">»</span>
                          </button>
                        )}
                        <div className="px-2 py-0.5 rounded-sm bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-mono text-cyan-400/80 tracking-wider">
                          {deliveryManifest.summary.finalizedShots.toString().padStart(2, '0')} / {deliveryManifest.summary.totalShots.toString().padStart(2, '0')} RESOLVED
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 px-1">
                      {/* 1. Sequence Identity */}
                      <div className="space-y-1">
                        <div className="text-[8px] uppercase tracking-widest text-slate-500/60 font-bold">Sequence Identity</div>
                        <div className="flex items-center justify-between group">
                          <span className="text-[11px] font-semibold text-slate-200 truncate">{deliveryManifest.sequence.name}</span>
                          <span className="text-[9px] font-mono text-slate-500/40 group-hover:text-slate-500/60 transition-colors uppercase select-all">{deliveryManifest.sequence.id.slice(0, 8)}</span>
                        </div>
                      </div>

                      {/* 2. Metadata */}
                      <div className="grid grid-cols-2 gap-4 border-y border-white/[0.03] py-3">
                        <div className="space-y-1">
                          <div className="text-[8px] uppercase tracking-widest text-slate-500/60 font-bold">Approved At</div>
                          <div className="text-[10px] font-mono text-slate-300/80">
                            {new Date(deliveryManifest.metadata.sealedAt || deliveryManifest.metadata.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] uppercase tracking-widest text-slate-500/60 font-bold">Operator</div>
                          <div className="text-[10px] font-medium text-slate-300/80 truncate">{deliveryManifest.metadata.operator}</div>
                        </div>
                      </div>

                      {/* 4. Action Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(deliveryManifest, null, 2));
                          }}
                          className="flex items-center justify-center gap-2 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/5 text-cyan-200/80 text-[10px] uppercase tracking-[0.08em] font-bold hover:bg-cyan-500/10 active:scale-[0.98] transition-all"
                        >
                          <span>Copy JSON</span>
                          <span className="text-xs opacity-30">⎋</span>
                        </button>
                        <button
                          onClick={() => handleDownloadManifestJson(deliveryManifest)}
                          className="flex items-center justify-center gap-2 py-2 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-100 text-[10px] uppercase tracking-[0.08em] font-bold hover:bg-cyan-500/20 active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(34,211,238,0.1)]"
                        >
                          <span>Download</span>
                          <span className="text-xs opacity-50">↓</span>
                        </button>
                      </div>

                      {/* 5. Compact Shot Resolution Summary */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">Resolution Map</div>
                          <span className="text-[8px] text-slate-500/40 italic">Sequential index</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {deliveryManifest.shots.slice(0, 15).map((shot, idx) => {
                             const isActive = shot.shotId === activeShotId;
                             const isNextTarget = shot.shotId === nextMissingShot?.shotId;
                             return (
                               <button 
                                 key={shot.shotId} 
                                 type="button"
                                 title={`${shot.label}: ${shot.status}${isActive ? ' (Current Focus)' : ''}${isNextTarget ? ' (Next Target)' : ''}`}
                                 onClick={() => {
                                   if (shot.status === 'finalized' && shot.resolution?.jobId) {
                                     onOpenEvidenceCandidate?.(shot.resolution.jobId);
                                   } else {
                                     onJumpToShotFromLedger?.(shot.shotId);
                                   }
                                 }}
                                 className={interactionClass('passive', `h-4 flex items-center justify-center rounded-sm text-[8px] font-mono border transition-all duration-120 focus-visible:m6-focus-ring ${
                                   shot.status === 'finalized' 
                                     ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 active:scale-[0.95]' 
                                     : 'bg-slate-500/5 border-slate-500/10 text-slate-500 hover:bg-slate-500/15 active:scale-[0.95]'
                                 } ${isActive ? 'border-white/40 bg-white/5 ring-1 ring-white/10' : isNextTarget ? 'border-cyan-400/40 bg-cyan-500/5' : ''}`)}
                               >
                                 {(idx + 1).toString().padStart(2, '0')}
                               </button>
                             );
                           })}
                          {deliveryManifest.shots.length > 15 && (
                            <div className="h-4 flex items-center justify-center rounded-sm text-[8px] font-mono bg-slate-500/5 border border-slate-500/10 text-slate-500/40">
                              ...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 6. Collapsible Raw JSON */}
                      <details className="group border-t border-white/[0.03] pt-2">
                        <summary className="list-none cursor-pointer flex items-center justify-between py-1 text-[9px] uppercase tracking-[0.15em] text-cyan-500/30 hover:text-cyan-500/50 transition-colors">
                          <span>TECHNICAL SCHEMA</span>
                          <span className="text-[10px] transform group-open:rotate-90 transition-transform">›</span>
                        </summary>
                        <div className="mt-2 p-2.5 rounded bg-black/60 border border-white/5 max-h-[140px] overflow-auto m6-scrollbar-thin">
                          <pre className="text-[9px] font-mono leading-relaxed text-cyan-400/60 select-all whitespace-pre-wrap">
                            {JSON.stringify(deliveryManifest, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  </div>
                )}

                {/* Precision Comparison Context */}
                {selectedJobTelemetry?.selectedJobId && productionFamily?.currentWinnerJobId && selectedJobTelemetry.selectedJobId !== productionFamily.currentWinnerJobId && (
                  <div className="mt-3 rounded-md border border-white/[0.04] bg-panel/18 px-3 py-2.5 text-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      <span>Compared to Winner</span>
                      <span className="text-amber-400/80">Not Current Winner</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
                      {/* We only have ID comparison here, if we had full Winner Job object we'd do deeper factual diffs */}
                      <span className="flex items-center gap-1.5 italic font-medium"><span className="h-1 w-1 rounded-full bg-slate-600" />Later Attempt</span>
                      <span className="flex items-center gap-1.5 italic font-medium opacity-60"><span className="h-1 w-1 rounded-full bg-slate-700" />Identity Ref: {shortJobId(productionFamily.currentWinnerJobId)}</span>
                    </div>
                    <div className="mt-2.5 border-t border-white/5 pt-2 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-300">
                      Lineage Impact: Promotion will supersede existing Production Truth.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 grid gap-1 grid-cols-1">
                <div className="m6-signal-secondary rounded bg-panel/12 px-2.5 py-1.5">
                  <div className="grid grid-cols-[80px_1fr] items-center gap-x-2">
                    <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-500/50 mt-0.5">Selection</div>
                    <div className="truncate text-slate-200/90 font-medium">
                      {scene?.name ?? 'No Scene'} <span className="opacity-30">/</span> {activeShot?.title?.replace(/^shot\s*\d+\s*:?\s*/i, '') ?? 'No Shot'} <span className="opacity-30">/</span> {productionFamily?.familyLabel ?? 'Family'}
                    </div>
                  </div>
                </div>
                <div className="m6-signal-ambient grid gap-1 sm:grid-cols-2">
                  <div className="rounded bg-panel/8 px-2.5 py-1.5"><div className="grid grid-cols-[80px_1fr] items-center gap-x-2"><div className="text-[8px] font-bold uppercase tracking-[0.06em] text-slate-500/50 mt-0.5">Job Focus</div><div className="truncate text-slate-300/80">{selectedJobTelemetry?.selectedJobId ? formatOperatorId(selectedJobTelemetry.selectedJobId, 'JOB') : 'NONE'}</div></div></div>
                  <div className="rounded bg-panel/8 px-2.5 py-1.5"><div className="grid grid-cols-[80px_1fr] items-center gap-x-2"><div className="text-[8px] font-bold uppercase tracking-[0.06em] text-slate-500/50 mt-0.5">Authority</div><div className="truncate text-slate-300/80">{selectedJobTelemetry?.previewAuthority?.label ?? 'NONE'}</div></div></div>
                </div>
              </div>

              {/* Diagnostic Insight (Rule #4: Explanatory Detail) */}
              {selectedJobTelemetry?.status === 'failed' && (
                <div className="mt-2 flex items-center justify-between px-2 py-1 rounded bg-rose-500/5 text-[9px] text-slate-500/60 uppercase tracking-widest font-bold">
                  <span>Failed Stage</span>
                  <span className="text-rose-400/60">{selectedJobTelemetry.failedStage ?? 'RUNNING'}</span>
                </div>
              )}

              <div className="mt-3 border-t border-white/[0.04] pt-3">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500/50">Technical Manifest Truth</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between rounded bg-black/20 px-2 py-1.5 text-[10px]">
                    <span className="text-slate-500 uppercase tracking-wide">Route</span>
                    <span className="text-slate-200 font-mono italic">{selectedJobTelemetry?.activeRoute ?? 'Default'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-black/20 px-2 py-1.5 text-[10px]">
                    <span className="text-slate-500 uppercase tracking-wide">Strategy</span>
                    <span className="text-slate-200 font-mono italic">{selectedJobTelemetry?.strategy ?? 'Standard'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-black/20 px-2 py-1.5 text-[10px]">
                    <span className="text-slate-500 uppercase tracking-wide">Engine</span>
                    <span className="text-slate-200 font-mono italic">{engineTarget.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {(productionFamily?.timelineNodes?.length || operatorFeedback?.visible || latencySupportCopy || runtimeSignalContext?.queueMode === 'paused' || stalledLabel || selectedFeedbackSummary?.focusLabel) ? (
                <div className="mt-2 rounded bg-panel/14 px-3 py-2 text-[9px] text-slate-500/58">
                  {productionFamily?.timelineNodes?.length ? (
                    <div>
                      <div className="mb-1 text-[9px] uppercase tracking-[0.08em] text-slate-500/56">Family timeline</div>
                      <div className="flex flex-wrap items-center gap-1 text-[9px]">
                        {(productionFamily.timelineNodes ?? []).map((node, index, arr) => {
                          const isLatest = index === arr.length - 1;
                          const isFailed = node.kind === 'retry' && node.label.toLowerCase().includes('failed'); // Heuristic based on common usage
                          return (
                            <span 
                              key={`${node.kind}-${index}`} 
                              className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 transition-all duration-150 ${
                                isLatest 
                                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300/80 font-bold shadow-[0_0_8px_rgba(6,182,212,0.1)]' 
                                  : isFailed
                                    ? 'border-rose-500/20 bg-rose-500/5 text-rose-400/50'
                                    : 'border-[var(--m6-border-soft)] bg-panel/18 text-slate-500/60'
                              }`}
                            >
                              {isLatest && <span className="h-1 w-1 rounded-full bg-cyan-500/60" />}
                              {node.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="rounded border border-[var(--m6-border-soft)] bg-panel/16 px-1.5 py-0.5">{operatorFeedback?.visible && ['review', 'queue', 'open', 'delivery', 'shot'].includes(operatorFeedback.scope) ? operatorFeedback.message : actionFeedbackLabel}</span>
                    {latencySupportCopy ? <span className="rounded border border-[var(--m6-border-soft)] bg-panel/16 px-1.5 py-0.5">{latencySupportCopy}</span> : null}
                    {runtimeSignalContext?.queueMode === 'paused' ? <span className="rounded border border-[var(--m6-border-soft)] bg-panel/16 px-1.5 py-0.5">Queue paused</span> : null}
                    {stalledLabel ? <span className="rounded border border-[var(--m6-border-soft)] bg-panel/16 px-1.5 py-0.5">{stalledLabel}</span> : null}
                    {justChangedLabel ? <span className="rounded border border-[var(--m6-border-soft)] bg-panel/16 px-1.5 py-0.5 m6-signal-once animate-in fade-in slide-in-from-left-1 duration-200">{justChangedLabel}</span> : null}
                    <span className="rounded border border-[var(--m6-border-soft)] bg-panel/16 px-1.5 py-0.5">{selectedFeedbackSummary?.focusLabel ?? 'No focus'}</span>
                  </div>
                </div>
              ) : null}

              <div className="mt-2 rounded-md border border-[var(--m6-border-soft)] bg-panel/14 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.007)]">
                <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.08em] text-slate-500/50">Utility actions</div>
                <div className="grid min-h-[40px] grid-cols-1 gap-1">
                  {(selectedJobQuickActions?.secondary ?? []).map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={action.onTrigger}
                      disabled={action.disabled}
                      title={action.disabled ? `Action Blocked: ${action.disabledReason ?? 'Incompatible state'}` : undefined}
                      className={interactionClass('secondary', `inline-flex items-center rounded border border-transparent bg-panel/16 px-2 py-1 text-left ${action.tone === 'danger' ? 'text-rose-100/68' : 'text-slate-400/60'} focus-visible:m6-focus-ring disabled:opacity-35 disabled:cursor-not-allowed`)}
                    >
                      <div className="flex flex-col">
                        <span>{action.label}</span>
                        {action.disabled && action.disabledReason && (
                          <span className="text-[8px] opacity-40 leading-tight block">{action.disabledReason}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2 rounded-md border border-indigo-500/10 bg-indigo-500/[0.03] p-2.5">
                <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.12em] text-indigo-200/50">Presence Awareness</div>
                <div className="space-y-1.5">
                  {presenceActivities
                    .filter((act) => act.targetId === (productionFamily?.lineageRootId ?? selectedJobTelemetry?.selectedJobId) && act.operatorId !== 'op_alpha')
                    .map((act) => {
                      const operator = operators.find((op) => op.id === act.operatorId);
                      if (!operator) return null;
                      const hasConflict = conflicts.some((c: Conflict) => c.operatorId === act.operatorId);
                      const isHighConflict = conflicts.some((c: Conflict) => c.operatorId === act.operatorId && c.severity === 'high');
                      return (
                        <div key={act.operatorId} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${isHighConflict ? 'm6-animate-pulse-urgent' : ''}`} style={{ backgroundColor: operator.color }} />
                            <span className="text-[10px] font-medium text-slate-200/90">{operator.name}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-[9px] ${hasConflict ? 'text-rose-400 font-bold' : 'text-slate-500/80'} ${isHighConflict ? 'm6-animate-pulse-urgent' : ''}`}>
                              {hasConflict ? `CONFLICT: ${conflicts.find(con => con.operatorId === act.operatorId)?.myIntent.replace('_', ' ')}` :
                                act.type === 'viewing' ? 'Viewing' :
                                  act.type === 'reviewing' ? 'Reviewing' :
                                    act.type === 'comparing' ? 'Shootout' :
                                      act.type === 'preparing_commit' ? 'Committing' :
                                        act.type === 'retrying' ? 'Retrying' :
                                          `Last Action: ${act.lastAction}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {presenceActivities.filter((act) => act.targetId === (productionFamily?.lineageRootId ?? selectedJobTelemetry?.selectedJobId) && act.operatorId !== 'op_alpha').length === 0 && (
                    <div className="py-0.5 text-center text-[9px] italic text-slate-600/40 tracking-wider">No other operators present</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'intelligence' && (selectedJobTelemetry || productionFamily) ? (
          <div className="mt-2 rounded-md m6-tier-3 m6-surface-quiet bg-violet-500/10 px-3 py-2.5 text-xs text-textMuted">
            <div className="text-[10px] font-medium text-violet-300/80 ">{selectedJobTelemetry ? 'Render Read • Selected Job' : 'Render Read • Production Family'}</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">status: {selectedJobTelemetry?.status ?? productionFamily?.familyState ?? 'idle'}</span>
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">lifecycle: {selectedJobTelemetry?.lifecycle ?? productionFamily?.familyState ?? 'idle'}</span>
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">mode: {selectedJobTelemetry?.mode ?? 'production_family'}</span>
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">route: {selectedJobTelemetry?.activeRoute ?? productionFamily?.lineageRootId ?? 'family lineage'}</span>
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">strategy: {selectedJobTelemetry?.strategy ?? 'family-first'}</span>
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">preflight: {selectedJobTelemetry?.preflight ?? 'family authority active'}</span>
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">dependency: {selectedJobTelemetry?.dependencyHealth ?? (productionFamily?.replacementJobId ? 'replacement tracked' : 'stable lineage')}</span>
              {selectedJobTelemetry?.failedStage ? <span className="rounded border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-1.5 py-0.5 text-[var(--m6-state-critical-fg)]">Failed stage: {selectedJobTelemetry.failedStage}</span> : null}
              {selectedJobTelemetry?.failureReason ? <span className="rounded border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-1.5 py-0.5 text-[var(--m6-state-critical-fg)]">Reason: {selectedJobTelemetry.failureReason}</span> : null}
              {selectedJobTelemetry?.failedStage && selectedJobTelemetry?.failureReason ? (
                <span className="rounded border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-1.5 py-0.5 text-[var(--m6-state-critical-fg)]">
                  {selectedJobTelemetry.failedStage === 'queued' || selectedJobTelemetry.failedStage === 'preflight'
                    ? 'Failed before render start'
                    : `Failed at ${selectedJobTelemetry.failedStage} • ${selectedJobTelemetry.failureReason}`}
                </span>
              ) : null}
              {selectedJobTelemetry?.manifestPath ? <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-slate-500/64">manifest: {selectedJobTelemetry.manifestPath}</span> : null}
              {selectedJobTelemetry?.pinned ? <span className="rounded border border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] px-1.5 py-0.5 text-[var(--m6-state-warn-fg)]">pinned</span> : null}
            </div>
            {productionFamily && !selectedJobTelemetry ? (
              <div className="mt-2 grid gap-1.5 text-[10px]">
                <div className="rounded bg-panel/20 px-3 py-2.5">
                  <div className="mb-1 text-[10px] text-slate-500">Family Read</div>
                  <div className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-0.5 text-slate-300/72">
                    <div className="text-[10px] text-slate-500">Family</div><div>{productionFamily.familyLabel}</div>
                    <div className="text-[10px] text-slate-500">Root</div><div>{productionFamily.lineageRootId}</div>
                    <div className="text-[10px] text-slate-500">State</div><div>{productionFamily.familyState}</div>
                    <div className="text-[10px] text-slate-500">Next</div><div>{productionFamily.nextFamilyAction}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'activity' && (
          <div className="animate-in fade-in slide-in-from-right-1 duration-150">
            <div className="mb-4">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300/80">Recent Team Activity</div>
                <div className="text-[9px] font-medium text-slate-500/60 uppercase tracking-widest">Team Signals</div>
              </div>

              {mergedCoordinationTimeline.length > 0 ? (
                <div className="relative space-y-3 pl-3.5 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-[1px] before:bg-[var(--m6-border-soft-active)]">
                  {mergedCoordinationTimeline.map((item: any) => {
                    const operator = operators.find((op) => op.id === item.uid);
                    const isIntent = item.kind === 'active_intent';
                    const label = isIntent
                      ? `is ${item.type.replace('_', ' ')}`
                      : (item as any).summary || item.type.split('.').pop()?.replace('_', ' ');

                    return (
                      <div key={item.id} className="relative group">
                        <div className={`absolute -left-[12px] top-[4px] h-1.5 w-1.5 rounded-full border ring-offset-panel ${isIntent ? 'bg-cyan-500/60 border-cyan-400/20 shadow-[0_0_4px_rgba(6,182,212,0.2)]' : 'bg-slate-800 border-slate-700/50'}`} style={isIntent && operator ? { backgroundColor: operator.color, opacity: 0.6 } : {}} />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className={`font-bold ${isIntent ? 'text-text/90' : 'text-textMuted/70'}`}>
                              {operator?.name || 'System'}
                            </span>
                            <span className={`text-[9px] ${isIntent ? 'text-cyan-400/70' : 'text-slate-500/60'} uppercase tracking-tight`}>
                              {isIntent ? 'intent' : 'resolved'}
                            </span>
                            {item.timestamp && !isIntent && (
                              <span className="ml-auto text-[8px] text-slate-600 font-mono">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] leading-tight ${isIntent ? 'text-slate-300' : 'text-slate-500 italic'}`}>
                            {label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded border border-dashed border-[var(--m6-border-soft)] p-4 text-center ">
                  <span className="text-[10px] text-slate-600 uppercase tracking-widest italic">No recent peer signals</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && activitySummary ? (
          <div className="mb-3 rounded-md border border-[var(--m6-border-soft)] m6-tier-3 m6-surface-quiet bg-[rgba(18,18,20,0.58)] px-3 py-2.5 text-xs text-slate-500/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.014)]">
            <div className="text-[11px] font-medium text-slate-300/90">Runtime Activity (Secondary)</div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-slate-300/72">{activitySummary}</div>
          </div>
        ) : null}


        {activeTab === 'decision' && sceneReviewBoard ? (
          <div className="mb-3 rounded-md border border-[var(--m6-border-soft)] m6-tier-3 m6-surface-quiet bg-[rgba(18,18,20,0.58)] px-3 py-2.5 text-xs text-slate-500/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.014)]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-slate-300/90">Scene Review Board (M4.1)</div>
              <span className="rounded border border-[var(--m6-border-soft)] bg-panel/22 px-1.5 py-0.5 text-[9px]  text-text/72">{sceneReviewBoard.status}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] ">
              <span className="rounded bg-panel/30 px-1.5 py-1">pass-rate {Math.round(sceneReviewBoard.passRate.value * 100)}%</span>
              <span className="rounded bg-panel/30 px-1.5 py-1">retry pressure {sceneReviewBoard.retryPressure.band}</span>
              <span className="rounded bg-panel/30 px-1.5 py-1">best-known {Math.round(sceneReviewBoard.bestKnownCoverage.value * 100)}%</span>
              <span className="rounded bg-panel/30 px-1.5 py-1">exceptions {sceneReviewBoard.shotExceptions.length}</span>
              <span className="rounded border border-[var(--m6-state-active-border)] bg-[var(--m6-state-active-bg)] px-1.5 py-1 text-[var(--m6-state-active-fg)]">approved {sceneReviewBoard.actionAggregates?.approved ?? 0}/{sceneReviewBoard.actionAggregates?.total ?? 0}</span>
              <span className="rounded border border-slate-500/25 bg-slate-500/5 px-1.5 py-1 text-slate-400/80">finalized {sceneReviewBoard.actionAggregates?.finalized ?? 0}/{sceneReviewBoard.actionAggregates?.total ?? 0}</span>
              <span className="rounded border border-[var(--m6-state-warn-border)] bg-[var(--m6-state-warn-bg)] px-1.5 py-1 text-[var(--m6-state-warn-fg)]">needs revision {sceneReviewBoard.actionAggregates?.needsRevision ?? 0}</span>
              <span className="rounded border border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] px-1.5 py-1 text-[var(--m6-state-critical-fg)]">rejected {sceneReviewBoard.actionAggregates?.rejected ?? 0} • superseded {sceneReviewBoard.actionAggregates?.superseded ?? 0}</span>
            </div>
          </div>
        ) : null}

        {activeTab === 'decision' && sceneReviewBoard ? (
          <div className="mb-3 rounded-md border border-[var(--m6-border-soft)] m6-tier-3 m6-surface-quiet bg-[rgba(18,18,20,0.58)] px-3 py-2.5 text-xs text-slate-500/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.014)]">
            <div className="text-[11px] font-medium text-slate-300/90">Decision Trace</div>
            <div className="mt-2 rounded-md border border-[var(--m6-border-soft)] bg-panel/28 px-2.5 py-1.5 text-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.014)]">
              <div className="text-slate-300">{sceneReviewBoard.explanations.summary}</div>
              <div className="mt-1 text-slate-500/64">Why not approved: {sceneReviewBoard.explanations.whyNotApproved}</div>
              <div className="text-slate-500/64">Fastest path: {sceneReviewBoard.explanations.fastestPathToGreen}</div>
            </div>
          </div>
        ) : null}

        {activeTab === 'activity' && normalizedShotQueue.length ? (
          <div className="mb-3 rounded-md border border-[var(--m6-border-soft)] m6-tier-3 m6-surface-quiet bg-[rgba(18,18,20,0.58)] px-3 py-2.5 text-xs text-slate-500/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.014)]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-slate-300/90">Shot Queue</div>
              <span className="text-[10px]  text-slate-300/72">{activeShot?.title ?? 'no active shot'}</span>
            </div>
            <div className="mt-2 ">
              {normalizedShotQueue.map((shot) => {
                const isActive = shot.id === activeShot?.id;
                const isResolved = shot.state === 'completed' || shot.state === 'skipped';
                const isWaiting = shot.state === 'waiting';

                return (
                  <div key={shot.id} className={`m6-surface-quiet flex items-center justify-between rounded m6-tier-3 px-2.5 py-1.5 transition-[background-color,border-color,box-shadow] duration-180 ${isActive ? 'bg-accent/10 border-[var(--m6-state-focus-border)]/40 shadow-[0_0_0_1px_rgba(120,160,255,0.12)]' : isResolved ? 'bg-[var(--m6-state-active-bg)] border-[var(--m6-state-active-border)]' : isWaiting ? 'bg-panel/25 border-[var(--m6-border-soft)]' : 'bg-panel/35 border-[var(--m6-border-soft)]'}`}>
                    <div className="min-w-0">
                      <div className={`truncate text-[11px] ${isActive ? 'text-text' : 'text-slate-300/72'}`}>
                        <span className="mr-1.5 text-slate-500/64">{shot.order}.</span>
                        {shot.title}
                      </div>
                      {isActive ? <div className="mt-0.5 text-[10px] text-cyan-100/75">{shot.stage}</div> : null}
                    </div>
                    <span className={`ml-2 rounded border px-1.5 py-0.5 text-[9px]  ${isActive ? 'border-[var(--m6-state-focus-border)]/40 bg-cyan-500/12 text-cyan-100' : isResolved ? 'border-[var(--m6-state-active-border)] bg-[var(--m6-state-active-bg)] text-[var(--m6-state-active-fg)]' : shot.state === 'failed' || shot.state === 'blocked' ? 'border-[var(--m6-state-critical-border)] bg-[var(--m6-state-critical-bg)] text-[var(--m6-state-critical-fg)]' : 'border-[var(--m6-border-soft)] bg-panel/35 text-textMuted/50'}`}>{shot.state}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-2">
              <button onClick={() => onShotAction?.(primarySequenceAction as 'start_sequence' | 'next_shot')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded bg-accent/10 px-2.5 py-1 text-[10px] text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">{primarySequenceLabel}</button>
              {hasActiveShot ? <button onClick={() => onShotAction?.('start_sequence')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] text-textMuted/85 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:text-text/80 active:text-text/76 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-textMuted/85">Restart</button> : null}
              <button onClick={() => onShotAction?.('reset_sequence')} disabled={streamState === 'offline'} className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] text-textMuted/50 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:text-textMuted/58 active:text-textMuted/54 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-textMuted/50">Reset</button>
            </div>
          </div>
        ) : null}

        {activeTab === 'intelligence' && selectedGraphNode ? (
          <div className="mb-3 rounded-md border border-[var(--m6-border-soft)] m6-tier-3 m6-surface-quiet bg-[rgba(18,18,20,0.58)] px-3 py-2.5 text-xs text-slate-500/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.014)]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-accent">Graph Node Context</div>
              <span className="rounded border border-accent/35 bg-accent/10 px-1.5 py-0.5 text-[10px]  text-accent/90">
                {selectedGraphNode.type.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-1.5 text-sm font-medium leading-tight text-text">{selectedGraphNode.title}</div>

            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 text-[11px]">
              <span className="text-[10px] text-slate-500 mt-0.5">Node Type</span>
              <span className="text-slate-300">{selectedGraphNode.type.replace('_', ' ')}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Source</span>
              <span className="text-slate-300">{selectedGraphNode.sourceType ?? 'system'}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Profile</span>
              <span className="text-slate-300">{selectedGraphNode.profileName ?? 'none'}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Role</span>
              <span className="text-slate-300">{selectedGraphNode.role}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Runtime State</span>
              <span className="text-slate-300">{selectedGraphNode.runtimeState ?? 'idle'}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Progress</span>
              <span className="text-slate-300">{selectedGraphNode.runtimeProgress ?? 0}%</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Last Action</span>
              <span className="text-slate-300">{selectedGraphNode.runtimeLastAction ?? 'No runtime action yet'}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Next Stage</span>
              <span className="text-slate-300">{selectedGraphNode.runtimeNextStage ?? 'n/a'}</span>
              {selectedGraphNode.type === 'shot' ? (
                <>
                  <span className="text-[10px] text-slate-500 mt-0.5">Shot Order</span>
                  <span className="text-slate-300">{selectedGraphNode.shotOrder ?? 'n/a'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Shot Runtime</span>
                  <span className="text-slate-300">{normalizeShotState(selectedGraphNode.shotRuntimeState ?? 'waiting')}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Current Stage</span>
                  <span className="text-slate-300">{selectedGraphNode.shotCurrentStage ?? 'queued'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Next In Queue</span>
                  <span className="text-slate-300">{shotQueue?.find((s) => s.order === (selectedGraphNode.shotOrder ?? 0) + 1)?.title ?? 'none'}</span>
                </>
              ) : null}
              {selectedGraphNode.type === 'engine_router' ? (
                <>
                  <span className="text-[10px] text-slate-500 mt-0.5">Route Mode</span>
                  <span className="text-slate-300">{selectedGraphNode.routeState?.mode ?? selectedGraphNode.routeMode ?? 'auto'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Active Targets</span>
                  <span className="text-slate-300">{selectedGraphNode.routeState?.activeTargets.join(', ') ?? 'none'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Primary / Fallback</span>
                  <span className="text-slate-300">
                    {selectedGraphNode.routeState?.primaryEngine ?? 'n/a'}
                    {selectedGraphNode.routeState?.fallbackEngine ? ` / ${selectedGraphNode.routeState.fallbackEngine}` : ''}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Output Strategy</span>
                  <span className="text-slate-300">{selectedGraphNode.routeState?.strategy ?? selectedGraphNode.routeStrategy ?? 'n/a'}</span>
                </>
              ) : null}
              {selectedGraphNode.type === 'engine_target' ? (
                <>
                  <span className="text-[10px] text-slate-500 mt-0.5">Engine Type</span>
                  <span className="text-slate-300">{selectedGraphNode.engineTarget ?? 'n/a'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Output Type</span>
                  <span className="text-slate-300">{selectedGraphNode.category}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Payload Summary</span>
                  <span className="text-slate-300">{selectedGraphNode.routeStrategy ?? 'engine branch payload'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Active Route</span>
                  <span className="text-slate-300">{selectedGraphNode.activeRoute ? 'active' : 'inactive'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Route Source</span>
                  <span className="text-slate-300">{selectedGraphNode.routeSource ?? 'engine_router'}</span>
                </>
              ) : null}
              {selectedGraphNode.type === 'review_node' ? (
                <>
                  <span className="text-[10px] text-slate-500 mt-0.5">Review Mode</span>
                  <span className="text-slate-300">{selectedGraphNode.review_mode ?? 'standard'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Frame Selection</span>
                  <span className="text-slate-300">{selectedGraphNode.frame_selection ?? 'key moments'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Quality Status</span>
                  <span className="text-slate-300">{selectedGraphNode.quality_status ?? 'pending'}</span>
                </>
              ) : null}
              {selectedGraphNode.type === 'edit_node' ? (
                <>
                  <span className="text-[10px] text-slate-500 mt-0.5">Timeline Length</span>
                  <span className="text-slate-300">{selectedGraphNode.timeline_length ?? 'n/a'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Clip Count</span>
                  <span className="text-slate-300">{selectedGraphNode.clip_count ?? 0}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Edit Status</span>
                  <span className="text-slate-300">{selectedGraphNode.edit_status ?? 'assembly'}</span>
                </>
              ) : null}
              {selectedGraphNode.type === 'export_node' ? (
                <>
                  <span className="text-[10px] text-slate-500 mt-0.5">Export Format</span>
                  <span className="text-slate-300">{selectedGraphNode.export_format ?? 'mp4'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Resolution</span>
                  <span className="text-slate-300">{selectedGraphNode.resolution ?? '4k'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Codec</span>
                  <span className="text-slate-300">{selectedGraphNode.codec ?? 'h.264'}</span>
                </>
              ) : null}
              {selectedGraphNode.type === 'delivery_node' ? (
                <>
                  <span className="text-[10px] text-slate-500 mt-0.5">Delivery Target</span>
                  <span className="text-slate-300">{selectedGraphNode.delivery_target ?? 'screening'}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Publish Status</span>
                  <span className="text-slate-300">{selectedGraphNode.publish_status ?? 'not published'}</span>
                </>
              ) : null}
            </div>

            {selectedGraphNode.type === 'shot' ? (
              <div className="mt-2 rounded bg-panel/30 px-2.5 py-2 text-[10px]">
                {(() => {
                  const shotState = normalizeShotState(selectedGraphNode.shotRuntimeState ?? 'waiting');
                  const primaryAction = shotState === 'active' || shotState === 'rendering' || shotState === 'review' ? 'mark_complete' : 'start_shot';
                  const primaryLabel = primaryAction === 'mark_complete' ? 'Mark Shot Complete' : 'Start Shot';

                  return (
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => onShotAction?.(primaryAction)} className="inline-flex items-center justify-center rounded border border-[var(--m6-state-focus-border)]/25 bg-accent/10 px-2 py-1 text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">{primaryLabel}</button>
                      {primaryAction !== 'mark_complete' ? <button onClick={() => onShotAction?.('mark_complete')} className="inline-flex items-center justify-center rounded border border-[var(--m6-border-soft)] px-2 py-1 text-textMuted/50 transition-[color,background-color,border-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-panel/52 hover:text-text/88 hover:border-[var(--dos-border)] active:text-text/82 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-textMuted/50 disabled:hover:border-[var(--m6-border-soft)]">Mark Complete</button> : null}
                      <button onClick={() => onShotAction?.('skip_shot')} className="inline-flex items-center justify-center rounded border border-[var(--m6-border-soft)] px-2 py-1 text-textMuted/50 transition-[color,background-color,border-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-panel/52 hover:text-text/88 hover:border-[var(--dos-border)] active:text-text/82 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-textMuted/50 disabled:hover:border-[var(--m6-border-soft)]">Skip</button>
                      <button onClick={() => onShotAction?.('reset_shot')} className="inline-flex items-center justify-center rounded border border-[var(--m6-border-soft)] px-2 py-1 text-textMuted/50 transition-[color,background-color,border-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-panel/52 hover:text-text/88 hover:border-[var(--dos-border)] active:text-text/82 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-textMuted/50 disabled:hover:border-[var(--m6-border-soft)]">Reset</button>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {['review_node', 'edit_node', 'export_node', 'delivery_node'].includes(selectedGraphNode.type) ? (
              <div className="mt-2 rounded bg-panel/30 px-2.5 py-2 text-[10px]">
                <div className="flex flex-wrap gap-1.5">
                  {selectedGraphNode.type === 'review_node' ? <button onClick={() => onPostWorkflowAction?.('approve_review')} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">Approve Review</button> : null}
                  {selectedGraphNode.type === 'edit_node' ? <button onClick={() => onPostWorkflowAction?.('complete_edit')} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">Approve Edit</button> : null}
                  {selectedGraphNode.type === 'export_node' ? (
                    <>
                      <button onClick={() => onPostWorkflowAction?.('complete_export')} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">Approve Export</button>
                      <button onClick={() => onPostWorkflowAction?.('fail_export')} className="inline-flex items-center justify-center rounded px-2 py-1 text-rose-100/80 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:text-rose-100/90 active:text-rose-100/84 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-300/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-rose-100/80">Fail Export</button>
                    </>
                  ) : null}
                  {selectedGraphNode.type === 'delivery_node' ? <button onClick={() => onPostWorkflowAction?.('complete_delivery')} className="inline-flex items-center justify-center rounded bg-accent/10 px-2 py-1 text-accent transition-[background-color,color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:bg-accent/12 active:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-accent/10">Approve Delivery</button> : null}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer rounded text-[10px] text-slate-500/64 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24">Advanced</summary>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button onClick={() => onPostWorkflowAction?.('reset')} className="inline-flex items-center justify-center rounded px-2 py-1 text-textMuted/85 transition-[color,background-color,box-shadow,transform] duration-180 motion-reduce:transition-none hover:text-text/80 active:text-text/76 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/24 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-textMuted/85">Reset Workflow</button>
                  </div>
                </details>
              </div>
            ) : null}

            <div className="mt-2 rounded bg-panel/30 px-2.5 py-2 text-[11px]">
              <div className="text-[10px] uppercase tracking-[0.11em] text-textMuted/50">Upstream Connections</div>
              {selectedGraphContext?.upstream?.length ? (
                <ul className="mt-1.5 space-y-0.5 text-slate-300/72">
                  {selectedGraphContext.upstream.map((item, index) => (
                    <li key={`up-${index}-${item}`}>â€¢ {item}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-slate-500/64">None</div>
              )}

              <div className="mt-2 text-[10px] uppercase tracking-[0.11em] text-textMuted/50">Downstream Connections</div>
              {selectedGraphContext?.downstream?.length ? (
                <ul className="mt-1.5 space-y-0.5 text-slate-300/72">
                  {selectedGraphContext.downstream.map((item, index) => (
                    <li key={`down-${index}-${item}`}>â€¢ {item}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-slate-500/64">None</div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'intelligence' ? (
          <>
            <ProfileBindingSection scene={scene} profiles={profiles} onBindProfile={onBindProfile} />

            <div className="mt-3 pt-3">
              <InspectorFields
                fields={fields}
                scene={scene}
                values={inspectorValues}
                sources={payload?.payload.sources ?? {}}
                onOverrideChange={onOverrideChange}
              />
            </div>
          </>
        ) : null}
      </div>

      <Panel title="Prompt Preview" className="border-[var(--dos-border)] bg-[rgba(18,18,20,0.54)] shadow-[0_8px_18px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.012)]">
        <CompiledPromptPanel payload={payload} currentJob={selectedJobTelemetry} />
      </Panel>
    </aside>
  );
});



