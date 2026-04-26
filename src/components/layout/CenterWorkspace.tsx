import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneNode, CurrentFocusItem, QuickActionItem, QuickActionModel, SelectedFeedbackSummary } from '../../models/directoros';
import type { RenderJobCounts, RenderQueueJob } from '../../render/jobQueue';
import { RenderPreview, type LaunchReadinessState, type LivePreviewState, type RuntimeSignalContext, type ShootoutState } from '../workspace/RenderPreview';
import { SceneProductionTimeline } from '../workspace/SceneProductionTimeline';
import { Panel } from '../shared/Panel';
import { RuntimeOfflineStatus } from '../shared/RuntimeOfflineStatus';
import { SceneGraphCanvas } from '../graph/SceneGraphCanvas';
import { asyncFeedbackClass, interactionClass } from '../shared/interactionContract';
import type { GraphNodeType, SceneGraphState } from '../../types/graph';
import type { ReviewActionType } from '../../review/types';
import type { DecisionHistoryEntry } from '../../review/reviewLineageTruth';
import type { GuardResult } from '../../review/guardReasons';
import type { FamilyPreviewAuthorityKind, FamilyPreviewEvidenceRole } from '../../utils/familyPreviewAuthority';
import type { SelectedJobNextActionResolution } from '../../utils/selectedJobNextAction';
import type { NextBestAction as NBAType } from '../../review/reviewLineageTruth';
import { mapTechnicalState, formatOperatorId } from '../../utils/operationalLanguage';

type JobModeFilter = 'cinematic' | 'studio_run' | 'all';
type JobSortMode = 'active_first' | 'queued_first' | 'failed_first' | 'newest_first';

const getJobWorkflowMode = (job: RenderQueueJob): Exclude<JobModeFilter, 'all'> =>
  job.bridgeJob.outputType === 'video' ? 'cinematic' : 'studio_run';

const shortJobId = (jobId?: string, prefix = 'Attempt') => {
  if (!jobId) return 'n/a';
  return formatOperatorId(jobId, prefix);
};

const lifecycleTone: Record<string, string> = {
  queued: 'm6-signal-ambient text-slate-500/40',
  preflight: 'm6-signal-ambient text-slate-500/50',
  running: 'm6-signal-ambient text-slate-400/60',
  packaging: 'm6-signal-ambient text-slate-400/70',
  completed: 'm6-signal-elevated text-[var(--m6-state-active-fg)] shadow-[0_0_8px_rgba(130,201,161,0.05)]',
  failed: 'm6-signal-urgent text-[var(--m6-state-critical-fg)] shadow-[0_0_12px_rgba(180,132,132,0.15)]',
  cancelled: 'm6-signal-ambient text-[var(--m6-state-warn-fg)] opacity-50',
  focusing: 'm6-signal-ambient text-slate-500/40',
};

const formatElapsed = (createdAt: number) => {
  const secs = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
};

const evidenceRoleTone = (role?: EvidenceRole) =>
  role === 'operational_truth'
    ? 'rounded border border-[var(--m6-state-active-border)] bg-[var(--m6-state-active-bg)] text-[var(--m6-state-active-fg)]'
    : role === 'supporting_evidence'
      ? 'rounded border border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
      : 'rounded border border-[var(--m6-border-soft)] bg-panel/30 text-textMuted/78';

const lifecycleStages: RenderQueueJob['state'][] = ['queued', 'preflight', 'running', 'packaging', 'completed', 'failed', 'cancelled'];
type RailStageState = 'complete' | 'active' | 'pending' | 'failed' | 'cancelled';

const getRailStageState = (
  jobState: RenderQueueJob['state'],
  stage: RenderQueueJob['state'],
  failedStage?: RenderQueueJob['failedStage']
): RailStageState => {
  if (jobState === 'cancelled') {
    if (stage === 'cancelled') return 'cancelled';
    const stageIdx = lifecycleStages.indexOf(stage);
    const cancelledIdx = lifecycleStages.indexOf('cancelled');
    return stageIdx < cancelledIdx ? 'complete' : 'pending';
  }

  if (jobState === 'failed') {
    const effectiveFailedStage = failedStage ?? 'failed';
    if (stage === effectiveFailedStage) return 'failed';
    const idx = lifecycleStages.indexOf(stage);
    const failedIdx = lifecycleStages.indexOf(effectiveFailedStage);
    return idx < failedIdx ? 'complete' : 'pending';
  }

  const currentIdx = lifecycleStages.indexOf(jobState);
  const stageIdx = lifecycleStages.indexOf(stage);

  if (stageIdx < currentIdx) return 'complete';
  if (stageIdx === currentIdx) return 'active';
  return 'pending';
};

const railStageTone: Record<RailStageState, string> = {
  complete: 'bg-[var(--m6-state-active-bg)] text-[var(--m6-state-active-fg)]',
  active: 'bg-panel/40 text-slate-400/76',
  pending: 'bg-panel/20 text-textMuted/40',
  failed: 'bg-[var(--m6-state-critical-bg)] text-[var(--m6-state-critical-fg)]',
  cancelled: 'bg-[var(--m6-state-warn-bg)] text-[var(--m6-state-warn-fg)]',
};

const lifecycleRank: Record<RenderQueueJob['state'], number> = {
  running: 0,
  preflight: 1,
  packaging: 2,
  queued: 3,
  failed: 4,
  cancelled: 5,
  completed: 6,
};

const getOperatorStateLabel = (job?: RenderQueueJob) => {
  if (!job) return 'none';
  if (job.state === 'queued') return 'Queued • Pending lane';
  if (job.state === 'preflight') return 'Preparing • Running checks';
  if (job.state === 'running') return 'Rendering • Generating output';
  if (job.state === 'packaging') return 'Finalizing • Preparing preview';
  if (job.state === 'failed') {
    const failedBeforeStart = (job.failedStage === 'queued' || job.failedStage === 'preflight');
    return failedBeforeStart ? 'Blocked at startup' : `Failed during ${mapTechnicalState(job.failedStage ?? 'running')}`;
  }
  return mapTechnicalState(job.state);
};

const getSelectedJobActionLabel = (params: {
  selectedJob?: RenderQueueJob;
  selectedJobNextAction?: SelectedJobNextActionResolution;
  hasApprovedOutput: boolean;
  hasCurrentWinner: boolean;
  hasReplacement: boolean;
  canRetryLatestAttempt: boolean;
  canInspectHistoricalOutput: boolean;
}) => {
  const { selectedJob, selectedJobNextAction, hasApprovedOutput, hasCurrentWinner, hasReplacement, canRetryLatestAttempt, canInspectHistoricalOutput } = params;
  if (!selectedJob) return undefined;
  if (selectedJobNextAction?.primaryActionKey === 'retry_latest_attempt' && canRetryLatestAttempt) return 'Retry failed latest attempt';
  if (hasApprovedOutput) return 'Open Output';
  if (hasCurrentWinner) return 'Open Current Output';
  if (hasReplacement) return 'Open Replacement';
  if (canInspectHistoricalOutput) return 'Inspect Output';
  return undefined;
};

const getSelectedJobDecisionMicrocopy = (params: {
  selectedJob?: RenderQueueJob;
  recommendationReason?: string;
  selectedLastMeaningfulChange: string;
  selectedJobPrimaryControlLabel?: string;
  productionFamily?: ProductionFamilySummary;
  selectedJobQuickActions?: QuickActionModel;
}): SelectedFeedbackSummary => {
  const { selectedJob, recommendationReason, selectedLastMeaningfulChange, selectedJobPrimaryControlLabel, productionFamily, selectedJobQuickActions } = params;
  if (!selectedJob) {
    if (productionFamily) {
      return {
        status: productionFamily.familyState,
        reason: productionFamily.nextFamilyAction,
        nextStep: 'Consult the Command Authority for the next move.',
        authorityLabel: 'family focus',
        focusLabel: 'family focus',
      };
    }
    return {
      status: 'No selection',
      reason: 'Select a job or family to reveal workspace actions.',
      nextStep: 'Jump from the Review Inbox to begin.',
      authorityLabel: 'none',
      focusLabel: 'scene focus',
    };
  }

  const status = getOperatorStateLabel(selectedJob);
  let reason = recommendationReason ?? selectedLastMeaningfulChange;
  let nextStep = selectedJobPrimaryControlLabel ? `${selectedJobPrimaryControlLabel} now.` : 'Inspect the selected job.';

  const primaryAction = selectedJobQuickActions?.primary;
  if (primaryAction?.disabled && primaryAction.disabledReason) {
    reason = `Blocked: ${primaryAction.disabledReason}`;
    nextStep = `Resolve the blocker to enable ${primaryAction.label}.`;
  } else if (selectedJob && productionFamily?.currentWinnerId && selectedJob.id !== productionFamily.currentWinnerId) {
    // Lineage Impact logic derived from Family state
    reason = `Caution: Acting on this will supersede current Winner.`;
  }

  if (['queued', 'preflight'].includes(selectedJob.state)) nextStep = 'Await execution or cancel attempt.';
  else if (['running', 'packaging'].includes(selectedJob.state)) nextStep = 'Monitor progress or stop active run.';
  else if (selectedJob.state === 'failed') nextStep = selectedJobPrimaryControlLabel ? `${selectedJobPrimaryControlLabel} to recover.` : 'Inspect failure.';
  else if (selectedJob.state === 'completed') {
    if (primaryAction?.disabled) {
       // nextStep is already set above
    } else {
       nextStep = selectedJobPrimaryControlLabel ? `${selectedJobPrimaryControlLabel} to review the finished output.` : 'Review the completed output.';
    }
  }

  return { 
    status, 
    reason, 
    nextStep,
    authorityLabel: 'live authority',
    focusLabel: 'job focus',
  };
};

const getSelectedJobHistoryRail = (params: {
  selectedJob?: RenderQueueJob;
  productionFamily?: ProductionFamilySummary;
}) => {
  const { selectedJob, productionFamily } = params;
  if (!selectedJob) return [] as Array<{ label: string; tone: string; detail: string; active?: boolean }>;

  const items: Array<{ label: string; tone: string; detail: string; active?: boolean }> = [];

  if (selectedJob.retryOf || selectedJob.lineageParentJobId) {
    items.push({
      label: 'Retry',
      tone: 'border-indigo-300/24 bg-indigo-500/10 text-indigo-100',
      detail: `from previous take`,
    });
  } else {
    items.push({
      label: 'Root',
      tone: 'border-[var(--m6-border-soft)] bg-panel/24 text-slate-300/74',
      detail: 'initial attempt in this chain',
    });
  }

  if (selectedJob.state === 'failed') {
    items.push({
      label: 'Failed',
      tone: 'border-rose-300/24 bg-rose-500/10 text-rose-100',
      detail: selectedJob.failedStage ? `at ${mapTechnicalState(selectedJob.failedStage)}` : 'Attempt failed',
    });
  }

  const isWinner = productionFamily?.currentWinnerId === selectedJob.id;
  const isLatest = productionFamily?.latestAttemptId === selectedJob.id;

  if (isWinner && isLatest) {
    items.push({
      label: 'Winner + Latest',
      tone: 'border-cyan-300/35 bg-cyan-500/12 text-cyan-100',
      detail: 'current best and newest attempt',
    });
  } else {
    if (isWinner) {
      items.push({
        label: 'Winner',
        tone: 'border-cyan-300/24 bg-cyan-500/10 text-cyan-100',
        detail: 'current best-known result',
      });
    }
    if (isLatest) {
      items.push({
        label: 'Latest',
        tone: 'border-indigo-400/34 bg-indigo-500/14 text-indigo-100',
        detail: 'newest attempt in lineage',
      });
    }
  }

  if (productionFamily?.approvedOutputId === selectedJob.id) {
    items.push({
      label: 'Approved',
      tone: 'border-[var(--m6-state-active-border)] bg-[var(--m6-state-active-bg)] text-[var(--m6-state-active-fg)]',
      detail: 'current truth for this surface',
    });
  }

  if (productionFamily?.replacementJobId === selectedJob.id) {
    items.push({
      label: 'Superseded',
      tone: 'border-amber-300/24 bg-amber-500/10 text-amber-100',
      detail: 'current winner has been superseded',
    });
  }

  items.push({
    label: 'Now',
    tone: 'border-[var(--m6-border-soft)] bg-panel/12 text-slate-500/60',
    detail: mapTechnicalState(selectedJob.state),
    active: true,
  });

  return items;
};

const getFamilyHealth = (family?: ProductionFamilySummary) => {
  if (!family) return { label: 'No lineage', tone: 'm6-signal-ambient text-slate-500/40' };

  const hasWinner = Boolean(family.currentWinnerId);
  const hasApproved = Boolean(family.approvedOutputId);
  const latestFailed = family.familyState === 'failed';

  if (hasApproved) return { label: 'Truth Locked', tone: 'm6-signal-elevated text-[var(--m6-state-active-fg)]' };
  if (latestFailed) return { label: 'Regressed', tone: 'm6-signal-urgent text-[var(--m6-state-critical-fg)]' };
  if (hasWinner) return { label: 'Stable', tone: 'm6-signal-elevated text-cyan-400/60' };
  return { label: 'Emerging', tone: 'm6-signal-elevated text-amber-400/60' };
};

type EvidenceRole = FamilyPreviewEvidenceRole;

interface RankedEvidenceCandidate {
  jobId: string;
  label: string;
  reason: string;
  role: EvidenceRole;
  isDefault?: boolean;
}

interface CompareEvidenceItem {
  jobId: string;
  label: string;
  reason: string;
  role: EvidenceRole;
  previewPath?: string;
  framing?: string;
  lineageHint?: string;
}

interface ProductionFamilySummary {
  lineageRootId: string;
  familyLabel: string;
  familyState: string;
  currentWinnerId?: string;
  approvedOutputId?: string;
  replacementJobId?: string;
  latestAttemptId?: string;
  lineageTrail: string[];
  timelineNodes: Array<{ label: string; kind: 'root' | 'retry' | 'winner' | 'approved' | 'replacement'; active?: boolean; evidenceRole?: EvidenceRole }>;
  nextFamilyAction: string;
  evidenceTargetJobId?: string;
  evidenceReason?: string;
  suggestedPairLabel?: string;
  suggestedPairPrimaryJobId?: string;
  suggestedPairPartnerJobId?: string;
  rankedEvidenceCandidates?: RankedEvidenceCandidate[];
}

interface CenterWorkspaceProps {
  currentFocus?: CurrentFocusItem[];
  engineTargetLabel?: string;
  onPauseQueue?: () => void;
  onResumeQueue?: () => void;
  onClearQueue?: () => void;
  scene?: SceneNode;
  graph?: SceneGraphState;
  selectedGraphNodeId?: string;
  selectedShotNodeId?: string;
  livePreview: LivePreviewState;
  operatorFeedback?: {
    message: string;
    tone: 'info' | 'ok' | 'error';
    scope: 'launch' | 'queue' | 'review' | 'shot' | 'open' | 'delivery';
    emphasis?: 'waiting' | 'transition';
    visible: boolean;
  };
  launchReadiness: LaunchReadinessState;
  jobCounts: RenderJobCounts;
  renderJobs?: RenderQueueJob[];
  selectedJob?: RenderQueueJob;
  selectedJobId?: string;
  selectedFamilyRootId?: string;
  productionFamily?: ProductionFamilySummary;
  selectedJobAuthority?: {
    kind: FamilyPreviewAuthorityKind;
    role: FamilyPreviewEvidenceRole;
    label: string;
    jobId?: string;
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
  shotReviewById?: Record<string, { reviewStatus?: string; approvalStatus?: string; actionState?: string; bestKnownJobId?: string; approvedJobId?: string; supersededByJobId?: string; riskLevel?: 'low' | 'medium' | 'high'; reason?: string }>;
  pinnedJobId?: string;
  selectedOutputPath?: string;
  retryContext?: {
    source: string;
    jobId: string;
    sceneId: string;
    mode: string;
    activeRoute: string;
    strategy: string;
    originalCommand: string;
    manifestPath: string;
    retryOf?: string;
    retryDepth?: number;
    retrySource?: string;
  };
  selectedJobQuickActions?: QuickActionModel;
  selectedFamilyQuickActions?: QuickActionModel;
  selectedJobNextAction?: SelectedJobNextActionResolution;
  onSelectOutput?: (outputPath: string) => void;
  onOpenSelectedOutput?: () => void;
  onOpenPath?: (path?: string) => void;
  onOpenCurrentWinner?: () => void;
  onOpenApprovedOutput?: () => void;
  onJumpToReplacement?: () => void;
  onInspectHistoricalOutput?: () => void;
  onFamilyOpenCurrentWinner?: (jobId?: string) => void;
  onFamilyOpenApprovedOutput?: (jobId?: string) => void;
  onFamilyJumpToReplacement?: (jobId?: string) => void;
  onFamilyRetryLatestAttempt?: (jobId?: string) => void;
  onFamilyInspectOutput?: (jobId?: string, outputPath?: string) => void;
  onTogglePinSelectedJob?: () => void;
  onSelectJob?: (jobId?: string) => void;
  onSelectProductionFamily?: (lineageRootId?: string, representativeJobId?: string) => void;
  onOpenEvidence?: () => void;
  onOpenEvidenceCandidate?: (jobId: string) => void;
  onToggleCompareCandidate?: (jobId: string) => void;
  onCompareSuggestedPair?: () => void;
  compareEvidence?: { left?: CompareEvidenceItem; right?: CompareEvidenceItem; feedback?: string };
  onSubmitM5Action?: (actionType: ReviewActionType) => void;
  m5ActionFeedback?: { level: 'ok' | 'error'; message: string };
  inlineActionReceipt?: { 
    tone: 'info' | 'ok' | 'error'; 
    message: string; 
    next?: string; 
    visible: boolean;
    targetJobId?: string;
    supersededJobId?: string;
    rationale?: string;
    guidanceOutcome?: string;
  };
  familyInlineActionReceipt?: { 
    tone: 'info' | 'ok' | 'error'; 
    message: string; 
    next?: string; 
    visible: boolean;
    targetJobId?: string;
    supersededJobId?: string;
    rationale?: string;
    guidanceOutcome?: string;
  };
  familyDecisionHistory?: DecisionHistoryEntry[];
  m5ActionGuards?: Partial<Record<ReviewActionType, GuardResult>>;
  jobModeFilter?: JobModeFilter;
  onJobModeFilterChange?: (mode: JobModeFilter) => void;
  onRenderScene: () => void;
  onSelectGraphNode: (nodeId?: string) => void;
  onLoadGraphTemplate: (templateId: string) => void;
  onMoveGraphNode: (nodeId: string, x: number, y: number) => void;
  onCommitGraphNodeDrag: (nodeId: string, startX: number, startY: number, endX: number, endY: number) => void;
  onCreateGraphConnection: (from: string, to: string) => void;
  onDeleteGraphConnection: (connectionId: string) => void;
  onAddGraphNode: (type: GraphNodeType) => void;
  onDeleteGraphNode: (nodeId: string) => void;
  onResetGraph: () => void;
  onUndoGraphEdit: () => void;
  onRedoGraphEdit: () => void;
  canUndoGraphEdit: boolean;
  canRedoGraphEdit: boolean;
  currentRoutePresetId?: string;
  onRoutePresetChange: (presetId: string) => void;
  postPipelineCollapsed: boolean;
  onTogglePostPipelineCollapse: () => void;
  activeShotTitle?: string;
  shotQueue?: Array<{ id: string; title: string; order: number; state: string; progress: number; stage: string; duration?: number }>;
  runtimeSignalContext?: RuntimeSignalContext;
  dismissedFailureIds?: Set<string>;
  onDismissFailure?: (jobId: string) => void;
  onJumpToLive: () => void;
  shootout?: ShootoutState;
  isFocusMode?: boolean;
  nextBestAction?: NBAType;
  onNextBestAction?: () => void;
  presenceActivities?: import('../../types/presence').PresenceActivity[];
  operators?: import('../../types/presence').Operator[];
  conflicts?: import('../../types/presence').Conflict[];
  streamState?: 'connected' | 'degraded' | 'offline';
  restorationSignal?: { targetId: string; type: 'shootout_return' | 'screen_return'; timestamp: number } | null;
  winnerChangedSignal?: { winnerId: string; timestamp: number } | null;
  onToggleLeftCollapse?: () => void;
  onToggleRightCollapse?: () => void;
  isLeftCollapsed?: boolean;
  isRightCollapsed?: boolean;
}

type InlineActionReceipt = {
  tone: 'info' | 'ok' | 'error';
  message: string;
  next?: string;
};



export const CenterWorkspace = ({
  currentFocus: _currentFocus = [],
  engineTargetLabel = 'auto',
  onPauseQueue: _onPauseQueue,
  onResumeQueue: _onResumeQueue,
  onClearQueue: _onClearQueue,
  scene,
  graph,
  selectedGraphNodeId,
  selectedShotNodeId,
  livePreview,
  operatorFeedback,
  launchReadiness,
  jobCounts: _jobCounts,
  renderJobs,
  selectedJob,
  selectedJobId,
  selectedFamilyRootId,
  productionFamily,
  selectedJobAuthority: _selectedJobAuthority,
  resolvedPreviewContext,
  shotReviewById,
  pinnedJobId: _pinnedJobId,
  selectedOutputPath,
  retryContext,
  selectedJobQuickActions,
  selectedJobNextAction,
  onSelectOutput,
  onOpenSelectedOutput,
  onInspectHistoricalOutput: _onInspectHistoricalOutput,
  onFamilyOpenApprovedOutput: _onFamilyOpenApprovedOutput,
  onFamilyJumpToReplacement: _onFamilyJumpToReplacement,
  onFamilyRetryLatestAttempt: _onFamilyRetryLatestAttempt,
  onTogglePinSelectedJob,
  onSelectJob,
  onSelectProductionFamily: _onSelectProductionFamily,
  onOpenEvidence: _onOpenEvidence,
  onOpenEvidenceCandidate,
  onToggleCompareCandidate,
  onCompareSuggestedPair,
  inlineActionReceipt,
  familyInlineActionReceipt,
  familyDecisionHistory,
  jobModeFilter = 'all',
  onJobModeFilterChange: _onJobModeFilterChange,
  onRenderScene,
  onSelectGraphNode,
  onLoadGraphTemplate,
  onMoveGraphNode,
  onCommitGraphNodeDrag,
  onCreateGraphConnection,
  onDeleteGraphConnection,
  onAddGraphNode,
  onDeleteGraphNode,
  onResetGraph,
  onUndoGraphEdit,
  onRedoGraphEdit,
  canUndoGraphEdit,
  canRedoGraphEdit,
  currentRoutePresetId,
  onRoutePresetChange,
  postPipelineCollapsed,
  onTogglePostPipelineCollapse,
  activeShotTitle,
  shotQueue,
  runtimeSignalContext,
  dismissedFailureIds,
  onDismissFailure,
  onJumpToLive,
  shootout,
  isFocusMode = false,
  nextBestAction,
  onNextBestAction,
  presenceActivities = [],
  operators = [],
  conflicts = [],
  streamState = 'connected',
  restorationSignal,
  winnerChangedSignal,
  onToggleLeftCollapse,
  onToggleRightCollapse,
  isLeftCollapsed,
  isRightCollapsed,
}: CenterWorkspaceProps) => {
  const [m5InlineCue] = useState<InlineActionReceipt | null>(null);
  const activeFamilyDecisionRef = useRef<HTMLDivElement | null>(null);

  // Continuity & Memory: transient pulse states
  const [returningPulseId, setReturningPulseId] = useState<string | null>(null);
  const [winnerFlashId, setWinnerFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!restorationSignal?.timestamp) return;

    // Grounding (Return Anchor) triggers immediately
    setReturningPulseId(restorationSignal.targetId);
    const anchorTimer = setTimeout(() => setReturningPulseId(null), 1500);

    // Staggered Success (Winner Pivot) triggers after a short delay if present
    let pivotTimer: ReturnType<typeof setTimeout> | null = null;
    if (winnerChangedSignal?.timestamp) {
      pivotTimer = setTimeout(() => {
        setWinnerFlashId(winnerChangedSignal.winnerId);
        setTimeout(() => setWinnerFlashId(null), 1500);
      }, 180); // STAGGER: 180ms Standard Motion
    }

    return () => {
      clearTimeout(anchorTimer);
      if (pivotTimer) clearTimeout(pivotTimer);
    };
  }, [restorationSignal, winnerChangedSignal]);

  // Handle independent winner pivot changes (not tied to restoration)
  useEffect(() => {
    if (!winnerChangedSignal?.timestamp || restorationSignal?.timestamp) return;

    setWinnerFlashId(winnerChangedSignal.winnerId);
    const timer = setTimeout(() => setWinnerFlashId(null), 1500);
    return () => clearTimeout(timer);
  }, [winnerChangedSignal, restorationSignal]);

  const [sortMode] = useState<JobSortMode>('active_first');

  const selectedShot = useMemo(() => 
    graph?.nodes.find(n => (n as any).id === selectedShotNodeId), 
    [graph, selectedShotNodeId]
  ) as any;



  useEffect(() => {
    if (!productionFamily || !selectedFamilyRootId || productionFamily.lineageRootId !== selectedFamilyRootId || selectedJob) return;
    activeFamilyDecisionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [productionFamily, selectedFamilyRootId, selectedJob]);



  // Keyboard Shortcut Layer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input Safety: skip if focused on an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if modifiers are pressed to avoid conflict with browser shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Commit Success: 'c'
      if (e.key.toLowerCase() === 'c') {
        const commitAction = selectedJobQuickActions?.primary;
        // Gate: only trigger if the primary action is an approval/finalization type
        if (commitAction && !commitAction.disabled && (commitAction.key === 'approve_winner' || commitAction.key === 'finalize_shot')) {
          e.preventDefault();
          commitAction.onTrigger();
        }
      }

      // Request Retry: 'r'
      if (e.key.toLowerCase() === 'r') {
        const retryAction = selectedJobQuickActions?.secondary.find(a => a.key.includes('retry'));
        if (retryAction && !retryAction.disabled) {
          e.preventDefault();
          retryAction.onTrigger();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedJobQuickActions]);




  const filteredJobs = useMemo(
    () => (renderJobs ?? []).filter((job) => jobModeFilter === 'all' || getJobWorkflowMode(job) === jobModeFilter),
    [renderJobs, jobModeFilter]
  );

  const visibleJobs = useMemo(() => {
    const next = filteredJobs.slice();
    next.sort((a, b) => {
      if (sortMode === 'newest_first') return b.createdAt - a.createdAt;
      if (sortMode === 'failed_first') {
        const af = a.state === 'failed' ? 0 : 1;
        const bf = b.state === 'failed' ? 0 : 1;
        if (af !== bf) return af - bf;
        return b.createdAt - a.createdAt;
      }
      if (sortMode === 'queued_first') {
        const aq = a.state === 'queued' || a.state === 'preflight' ? 0 : 1;
        const bq = b.state === 'queued' || b.state === 'preflight' ? 0 : 1;
        if (aq !== bq) return aq - bq;
        return a.createdAt - b.createdAt;
      }
      const rankDelta = (lifecycleRank[a.state] ?? 99) - (lifecycleRank[b.state] ?? 99);
      if (rankDelta !== 0) return rankDelta;
      return b.createdAt - a.createdAt;
    });
    return next;
  }, [filteredJobs, sortMode]);

  const selectedOutputCandidates = useMemo(() => {
    if (!selectedJob?.resultPaths?.length) return [] as string[];
    return selectedJob.resultPaths.filter((path) => Boolean(path && path.trim()));
  }, [selectedJob]);

  const withPreviewCacheBust = (path?: string, versionToken?: number) => {
    if (!path) return undefined;
    const join = path.includes('?') ? '&' : '?';
    const token = typeof versionToken === 'number' ? versionToken : Date.now();
    return `${path}${join}v=${token}`;
  };

  const selectedAuthorityPreviewJob = useMemo(() => {
    if (!resolvedPreviewContext?.authorityJobId) return undefined;
    return (renderJobs ?? []).find((job) => job.id === resolvedPreviewContext.authorityJobId);
  }, [renderJobs, resolvedPreviewContext?.authorityJobId]);

  const selectedPreviewSrc = withPreviewCacheBust(selectedAuthorityPreviewJob?.previewImage, selectedAuthorityPreviewJob?.updatedAt);
  const selectedPreviewMediaSrc = withPreviewCacheBust(selectedAuthorityPreviewJob?.previewMedia, selectedAuthorityPreviewJob?.updatedAt);
  const selectedPreviewType = selectedAuthorityPreviewJob?.previewType;

  const hasApprovedOutput = Boolean(productionFamily?.approvedOutputId);
  const hasCurrentWinner = Boolean(productionFamily?.currentWinnerId);
  const hasReplacement = Boolean(productionFamily?.replacementJobId);
  const canRetryLatestAttempt = selectedJob?.state === 'failed';
  const canInspectHistoricalOutput = Boolean(selectedOutputPath || selectedOutputCandidates[0]);
  const selectedJobPrimaryControlLabel = getSelectedJobActionLabel({
    selectedJob,
    selectedJobNextAction,
    hasApprovedOutput,
    hasCurrentWinner,
    hasReplacement,
    canRetryLatestAttempt,
    canInspectHistoricalOutput,
  });
  const selectedLastMeaningfulChange = selectedJob
    ? selectedJob.state === 'failed'
      ? `${selectedJob.failedStage === 'queued' || selectedJob.failedStage === 'preflight' ? 'Blocked at startup' : `Failed at ${mapTechnicalState(selectedJob.failedStage ?? 'running')}`}`
      : productionFamily?.approvedOutputId === selectedJob.id
        ? 'Approved Truth'
        : productionFamily?.currentWinnerId === selectedJob.id
          ? 'Production Winner'
          : selectedJob.state === 'completed'
            ? `Ready • ${formatElapsed(selectedJob.createdAt)} ago`
            : selectedJob.state === 'queued'
              ? 'Queued • Pending lane'
              : selectedJob.state === 'preflight'
                ? 'Preparing • Running checks'
                : selectedJob.state === 'running'
                  ? 'Rendering • Generating output'
                  : selectedJob.state === 'packaging'
                    ? 'Finalizing • Preparing preview'
                    : `State: ${mapTechnicalState(selectedJob.state)}`
    : launchReadiness.isReady
      ? 'System ready for launch'
      : launchReadiness.reason ?? 'Awaiting operator context';

  const selectedFeedbackSummary = useMemo(
    () =>
      getSelectedJobDecisionMicrocopy({
        selectedJob,
        recommendationReason: undefined,
        selectedLastMeaningfulChange,
        selectedJobPrimaryControlLabel,
        productionFamily,
        selectedJobQuickActions,
      }),
    [
      selectedJob,
      selectedLastMeaningfulChange,
      selectedJobPrimaryControlLabel,
      productionFamily,
      selectedJobQuickActions,
    ]
  );

  const selectedJobPrimaryQuickAction = selectedJobQuickActions?.primary;
  const selectedJobSecondaryQuickActions = selectedJobQuickActions?.secondary ?? [];
  const selectedJobHistoryRail = getSelectedJobHistoryRail({
    selectedJob,
    productionFamily,
  });

  const activeJobs = useMemo(
    () => (renderJobs ?? []).filter((job) => ['queued', 'preflight', 'running', 'packaging'].includes(job.state)),
    [renderJobs]
  );
  const hasActiveRender = livePreview.mode === 'queued' || livePreview.mode === 'preflight' || livePreview.mode === 'running' || livePreview.mode === 'packaging';

  const recentLaunchContext = useMemo(() => {
    const latestJob = visibleJobs[0];
    if (!scene) return undefined;
    return {
      shotLabel: activeShotTitle ?? latestJob?.shotId ?? 'No active shot',
      routeLabel: latestJob?.bridgeJob.payload.routeContext.activeRoute ?? 'Default Route',
      strategyLabel: latestJob?.bridgeJob.payload.routeContext.strategy ?? 'Standard Strategy',
    };
  }, [visibleJobs, scene, activeShotTitle]);

  const queueStats = useMemo(() => {
    const all = renderJobs ?? [];
    const queued = all.filter((job) => job.state === 'queued' || job.state === 'preflight').length;
    const running = all.filter((job) => job.state === 'running' || job.state === 'packaging').length;
    const cinematicActive = all.filter((job) => getJobWorkflowMode(job) === 'cinematic' && ['preflight', 'running', 'packaging'].includes(job.state)).length;
    const studioActive = all.filter((job) => getJobWorkflowMode(job) === 'studio_run' && ['preflight', 'running', 'packaging'].includes(job.state)).length;
    const selectedQueuePosition = selectedJob && (selectedJob.state === 'queued' || selectedJob.state === 'preflight')
      ? all
        .filter((job) => job.state === 'queued' || job.state === 'preflight')
        .sort((a, b) => a.createdAt - b.createdAt)
        .findIndex((job) => job.id === selectedJob.id) + 1
      : undefined;

    return {
      active: activeJobs.length,
      queued,
      running,
      cinematicActive,
      studioActive,
      selectedQueuePosition,
    };
  }, [renderJobs, activeJobs.length, selectedJob]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const outputCount = selectedOutputCandidates.length;
      const focusedOutputIndex = selectedOutputPath ? selectedOutputCandidates.indexOf(selectedOutputPath) : 0;

      const isHandledKey =
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === 'Escape' ||
        event.key.toLowerCase() === 'p' ||
        event.key === '[' ||
        event.key === ']';

      if (!isHandledKey) return;

      if ((event.key === '[' || event.key === ']') && outputCount > 1) {
        event.preventDefault();
        const safeIndex = focusedOutputIndex >= 0 ? focusedOutputIndex : 0;
        const nextIndex = event.key === ']'
          ? (safeIndex + 1) % outputCount
          : (safeIndex - 1 + outputCount) % outputCount;
        const nextOutput = selectedOutputCandidates[nextIndex];
        if (nextOutput) onSelectOutput?.(nextOutput);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onSelectJob?.(undefined);
        return;
      }

      if (!visibleJobs.length) return;
      const idx = Math.max(0, visibleJobs.findIndex((job) => job.id === selectedJobId));

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = visibleJobs[Math.min(visibleJobs.length - 1, idx + 1)];
        if (next) onSelectJob?.(next.id);
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = visibleJobs[Math.max(0, idx - 1)];
        if (prev) onSelectJob?.(prev.id);
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onOpenSelectedOutput?.();
      }

      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        onTogglePinSelectedJob?.();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visibleJobs, selectedJobId, onSelectJob, onOpenSelectedOutput, onTogglePinSelectedJob, selectedOutputCandidates, selectedOutputPath, onSelectOutput]);

  return (
    <main className={`h-full min-w-0 bg-[#050505] ${isFocusMode ? 'operator-focus-mode' : ''}`}>
      <Panel
        title="Workspace"
        className="h-full min-h-[340px]"
        rightSlot={
          <div className="flex items-center gap-2 pr-1">
            {presenceActivities
              .filter((act) => act.targetId === (selectedFamilyRootId ?? selectedJobId) && act.operatorId !== 'op_alpha')
              .map((act) => {
                const operator = operators.find((op) => op.id === act.operatorId);
                if (!operator) return null;
                const isActiveIntent = ['reviewing', 'comparing', 'preparing_commit'].includes(act.type);
                return (
                  <div
                    key={act.operatorId}
                    title={`${operator.name} intent: ${act.type.replace('_', ' ')}`}
                    className={`flex items-center gap-1.5 rounded-full border border-white/[0.04] bg-panel/34 px-1.5 py-0.5 text-[9px] transition-all hover:bg-panel/46 ${isActiveIntent ? 'border-amber-500/30 ring-1 ring-amber-500/10' : 'opacity-60'}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${act.type === 'viewing' ? 'animate-pulse' : ''}`} style={{ backgroundColor: operator.color }} />
                    <span className="font-medium text-textMuted/80">{operator.initials}</span>
                    {isActiveIntent && (
                      <span className="ml-0.5 font-bold text-amber-500/80">
                        {act.type === 'reviewing' ? 'R' : act.type === 'comparing' ? 'C' : 'P'}
                      </span>
                    )}
                  </div>
                );
              })}
            {presenceActivities.filter((act) => act.targetId === (selectedFamilyRootId ?? selectedJobId) && act.operatorId !== 'op_alpha').length === 0 && (
              <span className="text-[8px] text-textMuted/30 italic tracking-wider">Solo focus</span>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-3.5">
          <section className="px-1 py-2 flex flex-col group">
            <span className="text-[9px] uppercase font-semibold tracking-[0.2em] text-neutral-600 mb-1.5">Active Scene</span>
            <h2 className="text-2xl font-bold text-white tracking-tighter leading-none">{scene?.name ?? 'No Scene Selected'}</h2>
            <p className="mt-2.5 text-[12px] leading-[1.6] text-white/40 max-w-xl font-light">{scene?.prompt ?? 'Choose a scene from Scenes to activate cinematic workspace preview.'}</p>
          </section>

          <div className={isFocusMode ? 'focus-dim' : ''}>
            <SceneProductionTimeline
              sceneName={scene?.name}
              shots={shotQueue ?? []}
              shotReviewById={shotReviewById}
              selectedShotId={selectedShotNodeId}
              onSelectShot={(shotId) => onSelectGraphNode(shotId)}
              renderJobs={renderJobs}
              dismissedFailureIds={dismissedFailureIds}
            />
          </div>

          <section className="workspace-grid grid min-h-0 flex-1 items-stretch gap-4 pb-0.5 [grid-template-columns:minmax(0,1fr)_clamp(300px,25vw,380px)]">
            <div className="graph-area min-w-0 opacity-65 hover:opacity-100 transition-opacity duration-300">
              <SceneGraphCanvas
                graph={graph}
                selectedNodeId={selectedGraphNodeId}
                selectedShotId={selectedShotNodeId}
                onSelectNode={onSelectGraphNode}
                onLoadTemplate={onLoadGraphTemplate}
                onMoveNode={onMoveGraphNode}
                onCommitNodeDrag={onCommitGraphNodeDrag}
                onCreateConnection={onCreateGraphConnection}
                onDeleteConnection={onDeleteGraphConnection}
                onAddNode={onAddGraphNode}
                onDeleteNode={onDeleteGraphNode}
                onResetGraph={onResetGraph}
                onUndo={onUndoGraphEdit}
                onRedo={onRedoGraphEdit}
                canUndo={canUndoGraphEdit}
                canRedo={canRedoGraphEdit}
                routePresetId={currentRoutePresetId}
                onRoutePresetChange={onRoutePresetChange}
                postPipelineCollapsed={postPipelineCollapsed}
                onTogglePostPipelineCollapse={onTogglePostPipelineCollapse}
              />
            </div>

            <div className="flex flex-col gap-3">
              {shootout?.active && (
                <div className="rounded-md border border-cyan-400/20 bg-cyan-950/20 p-3 shadow-lg ring-1 ring-cyan-400/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-100">Shootout active</span>
                    </div>
                    <button 
                      onClick={shootout.onExit}
                      className="rounded bg-panel/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-textMuted hover:bg-panel/60 hover:text-text transition-colors"
                    >
                      Exit Shootout
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-cyan-50/70">
                    Comparing <span className="font-mono text-cyan-200">{shortJobId(shootout.leftJobId)}</span> vs <span className="font-mono text-cyan-200">{shortJobId(shootout.rightJobId)}</span>. 
                    Evaluating same-family quality delta. Approving one will resolve the truth branch for this family.
                  </div>
                </div>
              )}

              {/* Peer Intent Awareness Banner */}
              {presenceActivities
                .filter(act => act.targetId === (selectedFamilyRootId ?? selectedJobId) && act.operatorId !== 'op_alpha' && (act.type === 'preparing_commit' || act.type === 'comparing'))
                .slice(0, 1)
                .map(act => {
                   const operator = operators.find(op => op.id === act.operatorId);
                   const isConflict = conflicts.some((c) => c.operatorId === act.operatorId);
                   return (
                     <div key="peer-intent-banner" className={`mb-1 flex items-center gap-2 rounded border px-2.5 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200 ${isConflict ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/5'}`}>
                        <div className={`h-1 w-1 rounded-full animate-pulse ${isConflict ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.4)]' : 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.4)]'}`} />
                        <span className={`text-[10px] font-medium tracking-tight ${isConflict ? 'text-rose-200' : 'text-amber-200/80'}`}>
                          {isConflict ? 'COORDINATION CONFLICT: ' : 'Active Intent: '}
                          <span className={isConflict ? 'font-bold text-rose-100' : 'text-amber-100'}>{operator?.name}</span> is {act.type === 'preparing_commit' ? 'preparing a commit' : 'comparing candidates'}
                        </span>
                     </div>
                   );
                })}

              <RenderPreview
                sceneName={scene?.name}
                livePreview={livePreview}
                operatorFeedback={operatorFeedback}
                launchReadiness={launchReadiness}
                onLaunch={onRenderScene}
                onJumpToLive={onJumpToLive}
                activeShotTitle={activeShotTitle}
                activeShotId={shotQueue?.find((shot) => shot.title === activeShotTitle || shot.state === 'active' || shot.state === 'compiling' || shot.state === 'routed')?.id}
                engineTargetLabel={engineTargetLabel}
                routeLabel={recentLaunchContext?.routeLabel}
                strategyLabel={recentLaunchContext?.strategyLabel}
                onToggleLeftCollapse={onToggleLeftCollapse}
                onToggleRightCollapse={onToggleRightCollapse}
                isLeftCollapsed={isLeftCollapsed}
                isRightCollapsed={isRightCollapsed}
                selectedJobId={selectedJob?.id}
                isLatest={selectedJob?.id === productionFamily?.latestAttemptId}
                selectedOutputPath={selectedOutputPath}
                authorityKind={resolvedPreviewContext?.authorityKind}
                focusMode={resolvedPreviewContext?.focusMode}
                selectedFeedbackSummary={selectedFeedbackSummary}
                runtimeSignalContext={runtimeSignalContext}
                isDismissed={selectedJob ? dismissedFailureIds?.has(selectedJob.id) : false}
                onDismissFailure={onDismissFailure}
                shootout={shootout}
                conflicts={conflicts}
                selectedPreviewImage={selectedPreviewSrc}
                selectedPreviewMedia={selectedPreviewMediaSrc}
                selectedPreviewType={selectedPreviewType}
              />



              <RuntimeOfflineStatus state={streamState} />

              <div className={`rounded-xl border p-4 shadow-[0_12px_32px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(255,255,255,0.02)] transition-[border-color,background-color,box-shadow] duration-180 ease-out ${hasActiveRender ? 'border-white/[0.04] bg-[linear-gradient(180deg,rgba(22,22,22,0.52)_0%,rgba(18,18,18,0.48)_100%)]' : 'border-white/[0.06] bg-[linear-gradient(180deg,rgba(25,25,25,0.72)_0%,rgba(20,20,20,0.68)_100%)]'}`}>
                <div className="mb-4 flex items-center justify-between border-b border-white/[0.04] pb-2 text-[10px]">
                  <span className={`${hasActiveRender ? 'text-slate-500' : 'text-cyan-100/60'} font-bold uppercase tracking-[0.12em]`}>Operator Context</span>
                  <div className="flex items-center gap-3 text-[9px] tracking-widest text-slate-500/50">
                    <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-slate-500/30" /> active {queueStats.active}</span>
                    <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-slate-500/30" /> queued {queueStats.queued}</span>
                  </div>
                </div>

                {/* Layer 1: Primary Action (NBA Authority) */}
                <div className="mb-4">
                  {nextBestAction ? (
                    <div className="flex flex-col gap-2">
                       <div className="flex flex-col gap-1">
                        <div className="text-[10px] uppercase font-medium tracking-[0.15em] text-neutral-500 mb-1">
                          Command Authority / Next Move
                        </div>
                        <div className="text-xl font-bold text-white tracking-tighter leading-tight">
                          {nextBestAction.reason}
                        </div>
                      </div>
                      <button
                        key={`nba-${nextBestAction.cta}-${nextBestAction.reason}`}
                        type="button"
                        onClick={onNextBestAction}
                        disabled={streamState === 'offline' || hasActiveRender}
                        className={interactionClass('primary', `mt-3 flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 text-[13px] font-bold uppercase tracking-widest shadow-lg m6-animate-entry-sharp m6-pulse-once active:scale-[0.98] transition-[background-color,border-color,transform,box-shadow,opacity] duration-180 ${
                          hasActiveRender ? 'bg-panel/20 text-slate-500' : 
                          nextBestAction.accent === 'rose' ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 shadow-rose-900/10' :
                          nextBestAction.accent === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 shadow-emerald-900/10' :
                          nextBestAction.accent === 'amber' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 shadow-amber-900/10' :
                          'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 shadow-cyan-900/10'
                        }`)}
                      >
                        {nextBestAction.cta}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                      </button>
                    </div>
                  ) : selectedJobPrimaryQuickAction ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500/70">
                          Execution Control
                        </div>
                        <div className="text-[13px] font-medium leading-[1.4] text-white/94">
                          {selectedFeedbackSummary.nextStep}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={selectedJobPrimaryQuickAction.onTrigger}
                        disabled={selectedJobPrimaryQuickAction.disabled || streamState === 'offline'}
                        className={interactionClass('primary', `mt-1 flex w-full items-center justify-center rounded-lg px-4 py-3 text-[13px] font-bold uppercase tracking-wider border m6-animate-entry-sharp active:scale-[0.98] transition-[background-color,border-color,transform,opacity] duration-180 ${
                          hasActiveRender || selectedJobPrimaryQuickAction.disabled ? 'bg-panel/14 text-slate-500 border-transparent' : 
                          selectedJobPrimaryQuickAction.tone === 'success' ? 'bg-emerald-500/15 text-emerald-100 border-emerald-500/30 hover:bg-emerald-500/25' :
                          selectedJobPrimaryQuickAction.tone === 'brand' ? 'bg-cyan-500/15 text-cyan-100 border-cyan-500/30 hover:bg-cyan-500/25' :
                          'bg-panel/32 text-white/90 border-white/10 hover:bg-panel/42'
                        }`)}
                      >
                        {selectedJobPrimaryQuickAction.label}
                      </button>
                    </div>
                  ) : (selectedJob || productionFamily) ? (
                    <div className="rounded-md border border-white/[0.015] bg-panel/10 p-4 text-center">
                      <div className="text-[11px] font-medium text-slate-500/80 italic">Awaiting decision logic...</div>
                    </div>
                  ) : null}
                </div>

                {/* Layer 2: State & Selection */}
                {(selectedJob || productionFamily) ? (
                  <div className="mb-4 grid grid-cols-[auto_1fr] gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500/60">Canonical State</span>
                      <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] ${hasActiveRender ? 'border-white/[0.01] bg-panel/8 text-slate-600' : `border-white/[0.03] bg-panel/24 ${lifecycleTone[selectedJob?.state ?? productionFamily?.familyState ?? 'focusing']}`}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${['running', 'preflight', 'packaging'].includes(selectedJob?.state ?? '') ? 'animate-pulse bg-cyan-400' : 'bg-current opacity-40'}`} />
                        {selectedJob?.state ?? productionFamily?.familyState ?? 'focusing'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500/60">Selection Context</span>
                      <div className="flex flex-col rounded-md border border-white/[0.024] bg-panel/18 px-2.5 py-1.5">
                        <div className="text-[11px] font-medium text-white/80">
                          {scene?.name ?? 'No Scene'} <span className="mx-1 opacity-20">/</span> {selectedShot?.title?.replace(/^shot\s*\d+\s*:?\s*/i, '') ?? 'No Shot'} <span className="mx-1 opacity-20">/</span> {productionFamily?.familyLabel ?? 'Family Lineage'}
                        </div>
                        <div className="mt-0.5 text-[9px] font-mono text-slate-500">
                          REF: {selectedJob ? formatOperatorId(selectedJob.id, 'JOB') : productionFamily?.currentWinnerId ? formatOperatorId(productionFamily.currentWinnerId, 'WINNER') : 'NONE'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Layer 3: Output & Change */}
                {(selectedJob || productionFamily) ? (
                  <div className="grid grid-cols-2 gap-4 border-t border-white/[0.03] pt-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500/60">Current Output</span>
                      <div className="text-[10px] font-medium text-slate-400">
                        {selectedOutputPath ? selectedOutputPath.split(/[\\/]/).pop() ?? 'Ready Output' : selectedJob?.previewImage ? 'Main Frame' : selectedJob?.previewMedia ? 'Preview Video' : 'No output recorded'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-right">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500/60">Last Change</span>
                      <div className="text-[10px] font-medium text-slate-400">
                        {selectedJob ? `${mapTechnicalState(selectedJob.state)} • ${formatElapsed(selectedJob.createdAt)} ago` : productionFamily?.nextFamilyAction ?? 'Pending'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 rounded bg-panel/28 px-3 py-4 text-center">
                    <div className="mb-1 text-[12px] font-medium text-slate-300">No Selection</div>
                    <div className="text-[11px] text-slate-500">Pick a family card or open a job to enable decisions.</div>
                  </div>
                )}
              </div>

                    {selectedJob ? (
                      <>
                        <div className="rounded bg-panel/20 p-2">
                          <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.08em] text-textMuted/52">Support Actions</div>
                          <div className="flex flex-wrap gap-1 text-[9px]">
                            {(selectedJobSecondaryQuickActions ?? []).map((action: QuickActionItem) => (
                              <button
                                key={action.key}
                                type="button"
                                onClick={action.onTrigger}
                                disabled={action.disabled}
                                className={interactionClass('secondary', `rounded border border-transparent bg-panel/24 px-1.5 py-0.5 ${action.tone === 'danger' ? 'text-rose-100/72' : 'text-textMuted/72'} disabled:opacity-35`)}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-textMuted/54">
                          <span className="uppercase tracking-wide">Job</span>
                          <span className="min-w-0 break-all text-text/84">{selectedJob.id}</span>
                          <span className="uppercase tracking-wide">Lifecycle</span>
                          <span className="text-text/84"><span className={`inline-flex rounded bg-panel/34 px-1.5 py-0.5 uppercase tracking-wide ${lifecycleTone[selectedJob.state]}`}>{selectedJob.state}</span></span>
                          <span className="uppercase tracking-wide">Route</span>
                          <span className="text-text/84">{selectedJob.bridgeJob.payload.routeContext.activeRoute}</span>
                          <span className="uppercase tracking-wide">Strategy</span>
                          <span className="text-text/84">{selectedJob.bridgeJob.payload.routeContext.strategy}</span>
                          <span className="uppercase tracking-wide">Queue Context</span>
                          <span className="text-text/84">
                            {queueStats.selectedQueuePosition
                              ? `position ${queueStats.selectedQueuePosition} • active ${queueStats.active} • queued ${queueStats.queued}`
                              : `active ${queueStats.active} • queued ${queueStats.queued} • running ${queueStats.running}`}
                          </span>
                          <span className="uppercase tracking-wide">Shot Link</span>
                          <span className="text-text/84">{selectedJob.shotId ?? 'unlinked'} • {selectedJob.takeId ?? 'take-001'} • v{String(selectedJob.version ?? 1).padStart(3, '0')}</span>
                          <span className="uppercase tracking-wide">Lineage Parent</span>
                          <span className="text-text/84">{selectedJob.lineageParentJobId ?? selectedJob.retryOf ?? 'none'}</span>
                        </div>

                        {selectedPreviewSrc ? (
                          <div className="mt-2 overflow-hidden rounded bg-black/30">
                            <img src={selectedPreviewSrc} alt={`${selectedJob.id}-selected-preview`} className="h-32 w-full object-cover" />
                          </div>
                        ) : selectedPreviewMediaSrc && selectedPreviewType === 'video' ? (
                          <div className="relative mt-2 overflow-hidden rounded bg-black/30">
                            <video src={selectedPreviewMediaSrc} className="relative z-10 h-32 w-full object-cover pointer-events-auto" controls muted playsInline />
                          </div>
                        ) : null}

                        <div className="mt-2 rounded bg-panel/28 p-2.5">
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.06em] text-textMuted/66">
                            <span>Lifecycle Rail</span>
                            <span className="text-textMuted/80">{formatElapsed(selectedJob.createdAt)}</span>
                          </div>
                          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1.5">
                            {lifecycleStages.map((stage) => {
                              const stageState = getRailStageState(selectedJob.state, stage, selectedJob.failedStage);
                              const isActive = stageState === 'active';
                              return (
                                <div key={`rail-${selectedJob.id}-${stage}`} className={`rounded px-1.5 py-1 text-center text-[9px] uppercase tracking-[0.06em] ${railStageTone[stageState]}`} title={`${stage}${isActive ? ` • active • ${formatElapsed(selectedJob.createdAt)}` : ''}`}>
                                  <div className="truncate">{stage}</div>
                                  {isActive ? <div className="mt-0.5 text-[8px] normal-case tracking-normal">{formatElapsed(selectedJob.createdAt)}</div> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-2 rounded bg-panel/18 p-1.5">
                          <div className="mb-1.5 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.12em] text-textMuted/42">
                            <span>Lineage Trail</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {selectedJobHistoryRail.map((item, index) => (
                              <div key={`history-rail-${selectedJob.id}-${index}`} className={`rounded border px-1.5 py-1 transition-opacity ${item.tone}${item.active ? ' opacity-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]' : ' opacity-60'}`}>
                                <div className="text-[9px] font-bold leading-none">{item.label}</div>
                                <div className="mt-0.5 text-[8px] leading-tight opacity-70 truncate max-w-[80px]">{item.detail}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {retryContext ? (
                          <div className="mt-2 rounded bg-panel/30 p-2 text-[10px] text-textMuted/90">
                            <div className="mb-1 uppercase tracking-wide text-textMuted/66">Retry Context</div>
                            <div>Source: {retryContext.source}</div>
                            <div>Scene: {retryContext.sceneId}</div>
                            <div>Mode: {retryContext.mode}</div>
                            <div>Route: {retryContext.activeRoute}</div>
                            <div>Strategy: {retryContext.strategy}</div>

                            {retryContext.retryOf ? (
                              <div className="mt-1.5 rounded bg-indigo-500/8 px-1.5 py-1 text-indigo-100/90">
                                <div className="uppercase tracking-wide text-[9px] text-indigo-100/80">Retry Chain</div>
                                <div>Original Job: {shortJobId(retryContext.retryOf)}</div>
                                <div>Current: Retry #{retryContext.retryDepth ?? 1}</div>
                                <div className="truncate">{shortJobId(retryContext.retryOf)} → {shortJobId(retryContext.jobId)}</div>
                              </div>
                            ) : (
                              <div className="mt-1.5 rounded bg-panel/30 px-1.5 py-1 text-textMuted/66">Original job (no retry lineage)</div>
                            )}
                          </div>
                        ) : null}

                        {selectedJob.state === 'failed' ? (
                          <div className="mt-2 rounded bg-rose-500/10 p-2 text-[10px] text-rose-100/90">
                            <div className="mb-1 uppercase tracking-wide">Failed</div>
                            <div>Failed stage: {selectedJob.failedStage ?? 'running'}</div>
                            <div>Reason: {selectedJob.error ?? 'Run failed.'}</div>
                            <div>Dependency: {selectedJob.dependencyIssue ?? 'n/a'}</div>
                            <div className="truncate">Manifest: {selectedJob.manifestPath ?? `STUDIO_PIPELINE/outputs/${selectedJob.id}/render_metadata.json`}</div>
                          </div>
                        ) : null}

                        <div className={`mt-2 rounded p-2 transition-colors duration-200 ${conflicts.length > 0 ? 'border border-rose-500/30 bg-rose-500/10 ring-1 ring-rose-500/20' : 'bg-white/[0.03] border border-white/[0.02]'}`}>
                          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
                            <span className={conflicts.length > 0 ? 'text-rose-200 font-bold' : ''}>
                              {conflicts.length > 0 ? 'Conflict Alert: Peer Path Overlap' : 'M5 Lineage Context'}
                            </span>
                            <span className="rounded bg-panel/34 px-1 py-0.5 text-[9px] text-text/84">{productionFamily?.familyState ?? selectedJob.state}</span>
                          </div>
                          <div className="mb-1.5 text-[10px] text-textMuted/70">{selectedFeedbackSummary.nextStep}</div>
                          
                          {/* Unified Path: M5 actions are suppressed in favor of the primary NBA Command Authority */}
                          {false && <div className="hidden" />}

                          {m5InlineCue ? (
                            <div className={`mt-1.5 rounded px-1.5 py-1 text-[10px] ${asyncFeedbackClass(m5InlineCue.tone)}`}>
                              {m5InlineCue.message}
                              {m5InlineCue.next ? <span className="text-textMuted/80"> {' '}• {m5InlineCue.next}</span> : null}
                            </div>
                          ) : null}
                          {inlineActionReceipt?.visible && (
                            <div className={`mt-2 rounded border px-2 py-2 text-[10px] ${inlineActionReceipt.tone === 'ok' ? 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100/90' : 'border-rose-300/20 bg-rose-500/10 text-rose-100/90'}`}>
                              {inlineActionReceipt.guidanceOutcome && (
                                <div className="mb-1.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-textMuted/55">
                                  <span className="opacity-60">▸</span>
                                  <span>{inlineActionReceipt.guidanceOutcome}</span>
                                </div>
                              )}
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-medium">{inlineActionReceipt.message}</div>
                                  {inlineActionReceipt.targetJobId && (
                                    <div className="mt-0.5 text-[9px] text-textMuted/66">
                                      Target: {shortJobId(inlineActionReceipt.targetJobId)}
                                      {inlineActionReceipt.supersededJobId && ` • Supersedes ${shortJobId(inlineActionReceipt.supersededJobId)}`}
                                    </div>
                                  )}
                                  {inlineActionReceipt.rationale && <div className="mt-1 italic text-[9px] text-textMuted/60">"{inlineActionReceipt.rationale}"</div>}
                                  {inlineActionReceipt.next && <div className="mt-1 text-textMuted/72 font-medium">{inlineActionReceipt.next}</div>}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-textMuted/66">
                            <span>Winner ID</span><span>{shortJobId(productionFamily?.currentWinnerId)}</span>
                            <span>Approved ID</span><span>{shortJobId(productionFamily?.approvedOutputId)}</span>
                            <span>Replacement ID</span><span>{shortJobId(productionFamily?.replacementJobId)}</span>
                          </div>
                        </div>

                        <div className="mt-2 rounded bg-panel/30 p-2">
                          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-textMuted/66">
                            <div className="flex items-center gap-2">
                              <span>Outputs</span>
                              <span className="rounded bg-panel/46 px-1.5 py-0.5 text-[9px] text-text/84 normal-case">
                                {selectedOutputCandidates.length ? `${Math.max(1, selectedOutputCandidates.indexOf(selectedOutputPath ?? selectedOutputCandidates[0]) + 1)} / ${selectedOutputCandidates.length}` : '0 / 0'}
                              </span>
                            </div>
                            <span className="text-[9px] uppercase tracking-[0.08em] text-textMuted/60">Use [ / ] to switch</span>
                          </div>
                          {selectedOutputCandidates.length ? (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap gap-1.5 text-[10px]">
                                {selectedOutputCandidates.map((outputPath) => {
                                  const active = (selectedOutputPath ?? selectedOutputCandidates[0]) === outputPath;
                                  const filename = outputPath.split(/[\\/]/).pop() ?? outputPath;
                                  return (
                                    <button
                                      key={outputPath}
                                      type="button"
                                      onClick={() => onSelectOutput?.(outputPath)}
                                      className={`rounded px-1.5 py-1 ${active ? 'bg-accent/14 text-accent' : 'bg-panel/28 text-textMuted/82 hover:text-text'}`}
                                    >
                                      {filename}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="rounded bg-black/25 px-2 py-1.5 text-[10px] text-textMuted/80 break-all">{selectedOutputPath ?? selectedOutputCandidates[0]}</div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-textMuted/66">No output paths recorded for this job yet.</div>
                          )}
                        </div>
                      </>
                    ) : productionFamily ? (
                      <div
                        ref={activeFamilyDecisionRef}
                        className={`mt-2 rounded px-2.5 py-2.5 text-[11px] text-textMuted/80 border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(25,25,25,0.72)_0%,rgba(18,18,18,0.72)_100%)] shadow-[0_0_0_1px_rgba(56,189,248,0.06),0_10px_28px_rgba(8,24,40,0.22)] ${
                          selectedFamilyRootId === returningPulseId ? 'm6-return-anchor' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-100/90 font-medium">Family Lineage</span>
                              <span className={`text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border border-white/[0.04] bg-panel/30 ${getFamilyHealth(productionFamily).tone}`}>
                                {getFamilyHealth(productionFamily).label}
                              </span>
                            </div>
                            <div className="mt-1">
                              Family selected. Use the decision surface and action rail first.
                            </div>
                          </div>
                          {productionFamily.lineageRootId === selectedFamilyRootId && !selectedJob ? (
                            <span className="rounded border border-cyan-300/24 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-cyan-100/82">Active Focus</span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500/62">Default focus target: {productionFamily?.evidenceTargetJobId ? `${shortJobId(productionFamily.evidenceTargetJobId)} • ${productionFamily.evidenceReason ?? 'supporting output'}` : 'none'}</div>
                        {productionFamily?.rankedEvidenceCandidates?.length ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.04] pt-3">
                            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500/50">Evidence & Attempt Candidates</div>
                            {productionFamily?.rankedEvidenceCandidates?.map((candidate) => {
                              const isWinner = candidate.jobId === productionFamily.currentWinnerId;
                              const isLatest = candidate.jobId === productionFamily.latestAttemptId;
                              
                              return (
                                <div 
                                  key={candidate.jobId} 
                                  className={`group relative flex flex-col gap-2.5 rounded-lg border p-3 transition-[border-color,background-color,box-shadow,transform] duration-180 ease-out ${
                                    isWinner ? 'border-cyan-500/40 bg-cyan-500/10 shadow-[0_4px_16px_rgba(34,211,238,0.12)]' : 
                                    isLatest ? 'border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/8' :
                                    'border-white/[0.04] bg-panel/22 hover:bg-panel/32 hover:border-white/[0.08]'
                                  } ${
                                    candidate.jobId === returningPulseId ? 'm6-return-anchor' : ''
                                  } ${
                                    candidate.jobId === winnerFlashId ? 'm6-winner-pivot' : ''
                                  }`}
                                >
                                  {/* Authority & Recency Badges */}
                                  <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
                                    {isWinner && (
                                      <div className="rounded-sm bg-cyan-600/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(34,211,238,0.3)] ring-1 ring-cyan-400/30 backdrop-blur-sm">Winner Authority</div>
                                    )}
                                    {isLatest && !isWinner && (
                                      <div className="rounded-sm bg-indigo-600/70 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-indigo-100/90 shadow-sm ring-1 ring-indigo-400/25 backdrop-blur-sm">Latest Attempt</div>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[11px] font-bold tracking-tight ${isWinner ? 'text-cyan-100' : 'text-slate-200'}`}>{candidate.label}</span>
                                      {candidate.isDefault && <span className="text-[10px] text-slate-500/60 italic font-medium">• default</span>}
                                      {!isWinner && !isLatest && <span className="text-[8px] uppercase tracking-widest text-slate-600 font-bold">• Not Current Winner</span>}
                                      {isLatest && !isWinner && <span className="text-[8px] uppercase tracking-widest text-indigo-400/60 font-bold">• New Take</span>}
                                    </div>
                                    <div className="text-[10px] font-medium leading-[1.3] text-slate-400/80 line-clamp-2">{candidate.reason}</div>
                                  </div>

                                  <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${evidenceRoleTone(candidate.role)}`}>{candidate.role.split('_')[0]}</span>
                                      <span className="text-[10px] font-mono text-slate-600">{formatOperatorId(candidate.jobId)}</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button 
                                        type="button" 
                                        onClick={() => onOpenEvidenceCandidate?.(candidate.jobId)} 
                                        className={`rounded bg-panel/30 px-2 py-1 text-[9px] font-bold uppercase text-slate-400 transition-[background-color,color,border-color] duration-120 hover:bg-panel/50 hover:text-slate-200 border border-white/5 active:scale-[0.99]`}
                                      >
                                        Inspect
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => onToggleCompareCandidate?.(candidate.jobId)} 
                                        className={`rounded bg-panel/30 px-2 py-1 text-[9px] font-bold uppercase text-slate-400 transition-[background-color,color,border-color] duration-120 hover:bg-panel/50 hover:text-slate-200 border border-white/5 active:scale-[0.99]`}
                                      >
                                        Compare
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.06em]">
                          <button type="button" onClick={onCompareSuggestedPair} disabled={!productionFamily?.suggestedPairPrimaryJobId || !productionFamily?.suggestedPairPartnerJobId} className="rounded bg-cyan-500/14 px-2 py-1 text-cyan-100 disabled:opacity-35">Compare Suggested Pair</button>
                        </div>
                        {familyInlineActionReceipt?.visible ? (
                          <div className={`mt-1.5 rounded border px-2 py-2 text-[10px] ${familyInlineActionReceipt.tone === 'ok' ? 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100/90' : 'border-rose-300/20 bg-rose-500/10 text-rose-100/90'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[9px] uppercase tracking-[0.08em] text-textMuted/62">Family Update</div>
                                {familyInlineActionReceipt.guidanceOutcome && (
                                  <div className="mt-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.07em] text-textMuted/50">
                                    <span className="opacity-55">▸</span>
                                    <span>{familyInlineActionReceipt.guidanceOutcome}</span>
                                  </div>
                                )}
                                <div className="mt-0.5 font-medium">{familyInlineActionReceipt.message}</div>
                                {familyInlineActionReceipt.targetJobId && (
                                  <div className="mt-0.5 text-[9px] text-textMuted/66">
                                    Target: {shortJobId(familyInlineActionReceipt.targetJobId)}
                                    {familyInlineActionReceipt.supersededJobId && ` • Supersedes ${shortJobId(familyInlineActionReceipt.supersededJobId)}`}
                                  </div>
                                )}
                                {familyInlineActionReceipt.rationale && <div className="mt-1 italic text-[9px] text-textMuted/60">"{familyInlineActionReceipt.rationale}"</div>}
                                {familyInlineActionReceipt.next ? <div className="mt-1 text-textMuted/72 font-medium">{familyInlineActionReceipt.next}</div> : null}
                              </div>
                            </div>
                            {/* Peer Conflict Notification */}
                            {conflicts.length > 0 && (
                              <div className={`mt-2.5 flex items-center gap-2 rounded border px-2.5 py-1.5 animate-pulse ${
                                conflicts.some(c => c.severity === 'high') ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              }`}>
                                <span className="text-[10px] font-bold uppercase tracking-widest italic">! Peer Conflict</span>
                                <span className="text-[11px] opacity-90 truncate flex-1">{conflicts[0].message}</span>
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className={`mt-1 text-[10px] ${productionFamily.lineageRootId === selectedFamilyRootId && !selectedJob ? 'text-cyan-100/70' : 'text-slate-500/62'}`}>Next move: {productionFamily.nextFamilyAction}</div>
                        {/* Unification: Family Primary Action Suppressed - Unified to NextBestAction authority */}
                        
                        {/* Decision History Surface */}
                        {familyDecisionHistory && familyDecisionHistory.length > 0 && (
                          <div className="mt-4 border-t border-white/5 pt-3">
                            <div className="mb-2 text-[9px] uppercase tracking-[0.1em] text-textMuted/50">Decision History</div>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {familyDecisionHistory.map((entry) => (
                                <div key={entry.eventId} className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-[2px] before:bg-white/10">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[10px] font-medium ${entry.actor === 'operator' ? 'text-indigo-200/90' : 'text-slate-300/70'}`}>
                                      {entry.description}
                                    </span>
                                    <span className="text-[9px] text-textMuted/40">{new Date(entry.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className="text-[9px] text-textMuted/60">
                                    {shortJobId(entry.jobId)} • {entry.actor}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 rounded bg-panel/28 px-2 py-2 text-[11px] text-textMuted/80">
                        Pick a production family card above to operate at family level, or open a job for evidence detail.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </Panel>
          </main>
        );
      };


