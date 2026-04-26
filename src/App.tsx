import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { TopBar } from './components/layout/TopBar';
import { CenterWorkspace } from './components/layout/CenterWorkspace';
import type { LaunchReadinessState, LivePreviewState, LifecycleTransitionSignal, RuntimeSignalContext, ShootoutState } from './components/workspace/RenderPreview';
import { BottomTimeline } from './components/layout/BottomTimeline';
import { RightInspector } from './components/layout/RightInspector';
import { M6_AppShell, type M6ScreenKey } from './screens/shared/M6_AppShell';
import { SCR01_ControlRoom } from './screens/control-room/SCR01_ControlRoom';
import { SCR02_LiveRunsBoard } from './screens/live-runs/SCR02_LiveRunsBoard';
import { SCR04_CommandConsole } from './screens/command-console/SCR04_CommandConsole';
import { SCR05_InterventionQueue } from './screens/intervention-queue/SCR05_InterventionQueue';
import { SCR06_AuditReplayTimeline } from './screens/audit-replay/SCR06_AuditReplayTimeline';
import { OverlaySurface, useOverlayEscape } from './overlay';
import { createRouteState, engineRoutePresets } from './data/engineRoutes';
import { memoryProfiles, memoryProfilesById } from './data/memoryProfiles';
import { mockScenes } from './data/mockScenes';
import { baseInspectorFields } from './data/mockInspectorFields';
import { createGraphFromTemplate, initialGraphStates } from './data/mockGraphState';
import { initialAppState } from './stores/appStore';
import { initialTimelineState, tickFrame, resolveShotAtTime, resolveAuthority } from './stores/timelineStore';
import { selectSceneById } from './stores/selectionStore';
import { compilePromptPayload } from './utils/promptCompiler';
import { getRenderJobCounts, listRenderJobs, type RenderJobCounts, type RenderQueueJob } from './render/jobQueue';
import { runRenderPipeline, runRenderPipelineFromBridgeJob, type RenderPreviewState } from './render/renderManager';
import { syncRuntimeJobsToLocal, syncTimelineState } from './runtime/sync';
import { runtimeApi } from './runtime/api';
import { queueActions } from './render/queueActions';
import { reconcileDurableRenderAuthority } from './render/renderQueueController';
import { getQueueState } from './render/queueState';
import { getReviewRuntimeSnapshot, startReviewRuntime, submitReviewAction } from './review/runtime';
import { getGuardMessage, makeAllowedGuard, makeBlockedGuard, normalizeReasonCode, type GuardResult } from './review/guardReasons';
import type { ReviewActionType } from './review/types';
import { resolveOperatorReviewState, resolveProductionFamilyTruth, resolveFamilyDecisionHistory, type InboxItem, resolveInboxItem, resolveNextBestAction, resolveRiskForecast } from './review/reviewLineageTruth';
import { applyInterventionAction, createIntervention, listInterventionEvents, replayInterventionEvents } from './interventions/runtime';
import type { EngineTarget, SceneNode, TimelineState, TimelineClip, CurrentFocusItem, QuickActionItem, QuickActionModel, SelectedFeedbackSummary } from './models/directoros';
import type { MemoryCategory, PrimitiveValue } from './types/memory';
import type { GraphNodeType, PipelineActivityState, PostPipelineStageState, PostPipelineStatus, RenderState, SceneGraphNode, SceneGraphState, ShotRuntimeState } from './types/graph';
import { getCurrentShotIndex, sortShotsInSequence } from './utils/shotExecution';
import { emitEvent, makeStream, newTrace } from './telemetry';
import type { DirectorOSEventEnvelope, EmitContext, EventTrace } from './telemetry';
import type { TelemetryEnvelope } from './telemetry/selectors/directoros_kpi_selectors_cod_wip_v001';
import { resolveFamilyPreviewAuthority } from './utils/familyPreviewAuthority';
import type { FamilyPreviewAuthorityKind, FamilyPreviewAuthorityResolution } from './utils/familyPreviewAuthority';
import { resolveSelectedJobNextAction } from './utils/selectedJobNextAction';
import { MOCK_OPERATORS, type PresenceState, type PresenceActivityType, type Conflict } from './types/presence';
import { buildDeliveryManifest } from './utils/manifestBuilder';

type GraphHistoryState = Record<string, { undo: SceneGraphState[]; redo: SceneGraphState[] }>;

type PostWorkflowState = {
  review: PostPipelineStatus;
  edit: PostPipelineStatus;
  export: PostPipelineStatus;
  delivery: PostPipelineStatus;
  event?: string;
};

type ShotSequenceState = Record<string, { state: ShotRuntimeState; progress: number; stage: string; lastAction: string; isCurrent?: boolean }>;

type ResumeTargetState = {
  sceneId: string;
  title: string;
  cta: string;
  familyRootId?: string;
  jobId?: string;
  outputPath?: string;
} | undefined;

// Phase 4 Vector E: seal entry keyed by sceneId (session-scoped, no persistence)
type SequenceSealEntry = {
  sealedAt: number;
  sealedByLabel: string;
  sealedShotCount: number;
};
type SequenceSealState = Record<string, SequenceSealEntry>;

type ArtifactFocusState = {
  jobId: string | null;
  outputIndex: number | null;
  outputPath: string | null;
  previewImage: string | null;
};

type CompareEvidenceItem = {
  jobId: string;
  label: string;
  reason: string;
  role: 'operational_truth' | 'supporting_evidence' | 'historical_artifact';
  previewPath?: string;
  framing?: string;
  lineageHint?: string;
};

type ResolvedPreviewContextEntry = {
  jobId?: string;
  path?: string;
  kind: 'current_output' | 'selected_output' | 'approved_output' | 'deliverable_ready_output' | 'none';
  isAuthority: boolean;
};

type ResolvedPreviewContext = {
  currentOutput: ResolvedPreviewContextEntry;
  selectedOutput: ResolvedPreviewContextEntry;
  approvedOutput: ResolvedPreviewContextEntry;
  deliverableReadyOutput: ResolvedPreviewContextEntry;
  authorityKind: FamilyPreviewAuthorityKind;
  authorityJobId?: string;
  focusMode: 'current' | 'selected';
  isAuthority: boolean;
};

type OperatorFeedbackState = {
  message: string;
  tone: 'info' | 'ok' | 'error';
  scope: 'launch' | 'queue' | 'review' | 'shot' | 'open' | 'delivery';
  emphasis?: 'waiting' | 'transition';
  visible: boolean;
};

type InlineActionReceipt = {
  tone: 'info' | 'ok' | 'error';
  message: string;
  next?: string;
  visible: boolean;
  targetJobId?: string;
  supersededJobId?: string;
  rationale?: string;
  guidanceOutcome?: string;
};

type RuntimeLifecycleSignalState = Exclude<LivePreviewState['mode'], 'idle' | 'ready'>;

type JobRuntimeSignalState = {
  lastTransitionByJobId: Record<string, LifecycleTransitionSignal>;
  lastSignalAtByJobId: Record<string, number>;
};

interface QuickActionHandlers {
  onRetry: (job: RenderQueueJob) => Promise<void>;
  onSubmitM5: (type: ReviewActionType) => void;
  onCancel: (id: string) => void;
  onFocus: (job: RenderQueueJob, path?: string) => void;
  onOpen: (path?: string) => void;
}

const initialOperatorFeedback: OperatorFeedbackState = {
  message: '',
  tone: 'info',
  scope: 'launch',
  visible: false,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const initialPreviewState: RenderPreviewState = {
  mode: 'idle',
  progress: 0,
  label: 'Idle - ready to render',
};

const initialLivePreview: LivePreviewState = {
  mode: 'idle',
  activeJobId: null,
  activeShotId: null,
  previewImage: null,
  previewMedia: null,
  previewType: null,
  statusLabel: 'Idle - ready to render',
  progressLabel: '0%',
  errorLabel: null,
  progressPercent: 0,
};

const initialArtifactFocus: ArtifactFocusState = {
  jobId: null,
  outputIndex: null,
  outputPath: null,
  previewImage: null,
};

const ACTIVE_RUNTIME_SIGNAL_STATES: RuntimeLifecycleSignalState[] = ['queued', 'preflight', 'running', 'packaging'];
const STALLED_SIGNAL_THRESHOLD_MS = 15000;
const TRANSITION_SIGNAL_RETENTION_MS = 3000;

const isRuntimeLifecycleSignalState = (value: LivePreviewState['mode']): value is RuntimeLifecycleSignalState =>
  ['queued', 'preflight', 'running', 'packaging', 'completed', 'failed', 'cancelled'].includes(value);



const graphTypeMeta: Record<GraphNodeType, { category: string; role: string; x: number; y: number }> = {
  character: { category: 'Character', role: 'character context', x: 40, y: 80 },
  product: { category: 'Product', role: 'product context', x: 40, y: 140 },
  environment: { category: 'Environment', role: 'environment context', x: 40, y: 220 },
  lighting: { category: 'Lighting', role: 'lighting direction', x: 40, y: 300 },
  camera: { category: 'Camera', role: 'camera language', x: 40, y: 380 },
  shot: { category: 'Shot', role: 'shot orchestration', x: 380, y: 240 },
  compiler: { category: 'Compiler', role: 'graph convergence', x: 620, y: 240 },
  engine_router: { category: 'Router', role: 'execution routing', x: 880, y: 240 },
  engine_target: { category: 'Engine Target', role: 'engine branch target', x: 1130, y: 240 },
  render_output: { category: 'Render', role: 'execution output', x: 1450, y: 240 },
  review_node: { category: 'Review', role: 'quality review gate', x: 1680, y: 240 },
  edit_node: { category: 'Edit', role: 'timeline assembly state', x: 1910, y: 240 },
  export_node: { category: 'Export', role: 'export package state', x: 2140, y: 240 },
  delivery_node: { category: 'Delivery', role: 'distribution handoff state', x: 2370, y: 240 },
};

const postNodeTypeToStage = {
  review_node: 'review',
  edit_node: 'edit',
  export_node: 'export',
  delivery_node: 'delivery',
} as const;

const createPostWorkflowFromRender = (mode: RenderPreviewState['mode']): PostWorkflowState => {
  if (mode === 'completed') {
    return { review: 'active', edit: 'waiting', export: 'waiting', delivery: 'waiting', event: 'Render completed → Review active' };
  }
  if (mode === 'failed') {
    return { review: 'blocked', edit: 'blocked', export: 'blocked', delivery: 'blocked', event: 'Render failed → Post workflow blocked' };
  }
  return { review: 'pending', edit: 'waiting', export: 'waiting', delivery: 'waiting', event: 'Awaiting render output' };
};

const findSmartNodePlacement = (graph: SceneGraphState, type: GraphNodeType) => {
  const meta = graphTypeMeta[type];
  const nodeWidth = 212;
  const nodeHeight = 112;
  const gap = 20;
  const stepX = nodeWidth + gap;
  const stepY = 30;
  const maxX = Math.max(0, graph.layout.width - nodeWidth);
  const maxY = Math.max(0, graph.layout.height - nodeHeight);
  const occupied = graph.nodes.map((node) => ({
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + nodeWidth,
    bottom: node.position.y + nodeHeight,
  }));

  const overlaps = (x: number, y: number) => {
    const left = x;
    const top = y;
    const right = x + nodeWidth;
    const bottom = y + nodeHeight;
    return occupied.some((slot) => !(right + gap < slot.left || left - gap > slot.right || bottom + gap < slot.top || top - gap > slot.bottom));
  };

  for (let ring = 0; ring < 14; ring += 1) {
    const startX = clamp(meta.x + ring * 20, 0, maxX);
    const startY = clamp(meta.y + ring * stepY, 0, maxY);

    for (let lane = 0; lane < 8; lane += 1) {
      const direction = lane % 2 === 0 ? 1 : -1;
      const laneOffset = Math.ceil(lane / 2);
      const x = clamp(startX + direction * laneOffset * stepX, 0, maxX);
      const y = clamp(startY + lane * stepY, 0, maxY);
      if (!overlaps(x, y)) return { x, y };
    }
  }

  return { x: clamp(meta.x, 0, maxX), y: clamp(meta.y, 0, maxY) };
};

const seedScenesWithGraphs = (scenes: SceneNode[]) =>
  scenes.map((scene) => {
    if (scene.type !== 'scene') return scene;
    const graph = initialGraphStates[scene.id] ?? createGraphFromTemplate(scene.id, scene.name);
    return { ...scene, graph: { nodes: graph.nodes, connections: graph.connections, layout: graph.layout } };
  });

const buildJobQuickActions = (
  job: RenderQueueJob | undefined,
  review: { isBestKnown?: boolean; isApproved?: boolean; isFinalized?: boolean; approvalStatus?: string; actionState?: string; } | undefined,
  handlers: QuickActionHandlers
): QuickActionModel | undefined => {
  if (!job) return undefined;

  const terminalState: QuickActionModel['terminalState'] =
    job.state === 'completed' ? 'completed' :
      job.state === 'failed' ? 'failed' :
        job.state === 'cancelled' ? 'cancelled' :
          ['queued', 'preflight', 'running', 'packaging'].includes(job.state) ? 'active' : 'other';

  const secondary: QuickActionItem[] = [];
  if (['queued', 'preflight', 'running', 'packaging'].includes(job.state)) {
    secondary.push({
      key: 'cancel_job',
      label: 'Cancel Attempt',
      intent: 'danger',
      tone: 'danger',
      disabled: false,
      onTrigger: () => handlers.onCancel(job.id),
    });
  } else if (['completed', 'failed', 'cancelled'].includes(job.state)) {
    secondary.push(
      {
        key: 'inspect_folder',
        label: 'Inspect Folder',
        intent: 'secondary',
        tone: 'neutral',
        disabled: false,
        onTrigger: () => {
          const path = (job as any).outputPath ?? (job as any).manifestPath?.replace(/[\\/][^\\/]+$/, '');
          if (path) handlers.onOpen(path);
        },
      },
      {
        key: 'inspect_metadata',
        label: 'Inspect Metadata',
        intent: 'utility',
        tone: 'neutral',
        disabled: !job.manifestPath,
        onTrigger: () => handlers.onOpen(job.manifestPath),
      }
    );
  }

  let primary: QuickActionItem | undefined;

  if (job.state === 'failed' || job.state === 'cancelled') {
    primary = {
      key: job.state === 'failed' ? 'retry_failed' : 'retry_cancelled',
      label: 'Retry Attempt',
      intent: 'primary',
      tone: 'brand',
      disabled: false,
      onTrigger: () => handlers.onRetry(job),
    };
  } else if (job.state === 'completed') {
    if (review?.isBestKnown && review?.approvalStatus !== 'approved' && review?.actionState !== 'finalized') {
      primary = {
        key: 'approve_winner',
        label: 'Commit Success',
        intent: 'primary',
        tone: 'success',
        disabled: false,
        onTrigger: () => handlers.onSubmitM5('approve_best_known'),
      };
    } else if (review?.isApproved && review?.actionState !== 'finalized') {
      primary = {
        key: 'finalize_shot',
        label: 'Approve Shot',
        intent: 'primary',
        tone: 'brand',
        disabled: false,
        onTrigger: () => handlers.onSubmitM5('finalize_shot'),
      };
    } else {
      const hasArtifact = Boolean(job.previewImage || job.previewMedia || (job.resultPaths && job.resultPaths.length > 0));
      primary = {
        key: 'open_output',
        label: 'Open Output',
        intent: 'primary',
        tone: 'neutral',
        disabled: false,
        onTrigger: () => handlers.onFocus(job),
      };
    }
  }

  return { primary, secondary, terminalState };
};

const buildFamilyQuickActions = (
  family: {
    bestKnownJobId?: string;
    approvedOutputJobId?: string;
    latestAttemptJobId?: string;
    familyState: string;
  } | undefined,
  lineage: RenderQueueJob[],
  handlers: QuickActionHandlers
): QuickActionModel | undefined => {
  if (!family) return undefined;

  const terminalState: QuickActionModel['terminalState'] =
    family.familyState === 'approved' ? 'completed' :
      family.familyState === 'failed' ? 'failed' :
        ['queued', 'running', 'packaging'].includes(family.familyState) ? 'active' : 'other';

  let primary: QuickActionItem | undefined;
  const targetId = family.approvedOutputJobId ?? family.bestKnownJobId ?? family.latestAttemptJobId;
  const targetJob = lineage.find(j => j.id === targetId);

  if ((family.familyState === 'failed' || family.familyState === 'cancelled') && targetJob) {
    primary = {
      key: 'family_retry',
      label: 'Retry Family',
      intent: 'primary',
      tone: 'brand',
      disabled: false,
      onTrigger: () => handlers.onRetry(targetJob),
    };
  } else if (targetJob) {
    primary = {
      key: 'family_open',
      label: 'Open Output',
      intent: 'primary',
      tone: 'neutral',
      disabled: false,
      onTrigger: () => handlers.onFocus(targetJob),
    };
  }

  return { primary, secondary: [], terminalState };
};

function App() {
  const [appState, setAppState] = useState(initialAppState);
  const [scenes, setScenes] = useState<SceneNode[]>(() => seedScenesWithGraphs(mockScenes));
  const [timelineState, setTimelineState] = useState<TimelineState>(initialTimelineState);
  const [previewState, setPreviewState] = useState<RenderPreviewState>(initialPreviewState);
  const [livePreview, setLivePreview] = useState<LivePreviewState>(initialLivePreview);
  const [artifactFocus, setArtifactFocus] = useState<ArtifactFocusState>(initialArtifactFocus);
  const [runtimeJobCounts, setRuntimeJobCounts] = useState<RenderJobCounts>(getRenderJobCounts());
  const [runtimeJobs, setRuntimeJobs] = useState<RenderQueueJob[]>(listRenderJobs());
  const [runtimeRecentRenders, setRuntimeRecentRenders] = useState<Array<{ path: string; imageUrl?: string; filename: string; label: string; modifiedTime?: string; modifiedTimeMs?: number; manifestPath?: string; jobId?: string }>>([]);
  const [runtimeTimeline, setRuntimeTimeline] = useState<Array<{ id: string; job_id: string; manifest_path?: string; status: string; created_at?: string; completed_at?: string; duration_ms?: number; output_path?: string; image_url?: string; engine?: string; summary?: string }>>([]);
  const renderJobs = runtimeJobs;
  const setRenderJobs = setRuntimeJobs;
  const jobCounts = runtimeJobCounts;
  const setJobCounts = setRuntimeJobCounts;
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [selectedFamilyRootId, setSelectedFamilyRootId] = useState<string>();
  const [compareEvidence, setCompareEvidence] = useState<{ left?: CompareEvidenceItem; right?: CompareEvidenceItem; feedback?: string }>({});
  const [pinnedJobId, setPinnedJobId] = useState<string>();
  const [selectedOutputByJob, setSelectedOutputByJob] = useState<Record<string, string>>({});
  const [jobModeFilter, setJobModeFilter] = useState<'cinematic' | 'studio_run' | 'all' | 'delivery'>('all');
  const [operatorHasExplicitFocus, setOperatorHasExplicitFocus] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamState, setStreamState] = useState<'connected' | 'degraded' | 'offline'>('offline');
  const [runtimeControlMode, setRuntimeControlMode] = useState<'running' | 'paused'>(getQueueState().mode);
  const lastUIProgressUpdateAt = useRef<number>(0);
  const queueMode = runtimeControlMode;
  const [lastStreamEventAt, setLastStreamEventAt] = useState<number | undefined>(undefined);
  const [inspectorOverrides, setInspectorOverrides] = useState<Record<string, Record<string, PrimitiveValue>>>({});
  const [graphStates, setGraphStates] = useState<Record<string, SceneGraphState>>(initialGraphStates);
  const [graphHistory, setGraphHistory] = useState<GraphHistoryState>({});
  const [selectedGraphNodeByScene, setSelectedGraphNodeByScene] = useState<Record<string, string>>({});
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [postPipelineCollapsed, setPostPipelineCollapsed] = useState(true);
  const [postWorkflowByScene, setPostWorkflowByScene] = useState<Record<string, PostWorkflowState>>({});
  const [shotSequenceByScene, setShotSequenceByScene] = useState<Record<string, ShotSequenceState>>({});
  const [shotLedgerScope, setShotLedgerScope] = useState<'this_shot' | 'all_scene'>('this_shot');
  const [m5ActionFeedbackByJob, setM5ActionFeedbackByJob] = useState<Record<string, { level: 'ok' | 'error'; message: string }>>({});
  const [inlineActionReceiptByJob, setInlineActionReceiptByJob] = useState<Record<string, InlineActionReceipt>>({});
  const [inlineActionReceiptByFamily, setInlineActionReceiptByFamily] = useState<Record<string, InlineActionReceipt>>({});
  const [activeM6Screen, setActiveM6Screen] = useState<M6ScreenKey>('workspace');
  const [isCommandConsoleOpen, setIsCommandConsoleOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [selectedCommandTemplate, setSelectedCommandTemplate] = useState<string>();
  const [commandValidationPreview, setCommandValidationPreview] = useState('');
  const [commandTrustImpactPreview, setCommandTrustImpactPreview] = useState('');
  const [lastExecutedCommand, setLastExecutedCommand] = useState<string>('');
  const [interventionVersion, setInterventionVersion] = useState(0);
  const [selectedInterventionId, setSelectedInterventionId] = useState<string>();
  const [operatorFeedback, setOperatorFeedback] = useState<OperatorFeedbackState>(initialOperatorFeedback);
  const [jobRuntimeSignals, setJobRuntimeSignals] = useState<JobRuntimeSignalState>({ lastTransitionByJobId: {}, lastSignalAtByJobId: {} });
  const [dismissedFailureIds, setDismissedFailureIds] = useState<Set<string>>(new Set());
  const [dismissedInboxItemIds, setDismissedInboxItemIds] = useState<Set<string>>(new Set());
  const [shootout, setShootout] = useState<ShootoutState>({
    active: false,
    onExit: () => setShootout(prev => ({ ...prev, active: false })),
  });
  const [persistentResumeTarget, setPersistentResumeTarget] = useState<ResumeTargetState>(undefined);
  // Phase 4 Vector E: per-scene seal state (session only, keyed by selectedScene.id)
  const [sequenceSealState, setSequenceSealState] = useState<SequenceSealState>({});

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    // Robust loading guard against hydration mismatch / race conditions
    const timer = setTimeout(() => setIsHydrated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // Continuity & Memory phase restoration states
  const [preShootoutFocus, setPreShootoutFocus] = useState<{ jobId?: string; familyRootId?: string } | null>(null);
  const [restorationSignal, setRestorationSignal] = useState<{ targetId: string; type: 'shootout_return' | 'screen_return'; timestamp: number } | null>(null);
  const [winnerChangedSignal, setWinnerChangedSignal] = useState<{ winnerId: string; timestamp: number } | null>(null);

  const shootoutRef = useRef(shootout);
  // Pass 26: Transient ref for passing guidanceOutcome from handleNextBestAction
  // into the async onSubmitM5Action receipt. Never triggers a re-render; consumed
  // Pass 26: Transient ref for passing guidanceOutcome from handleNextBestAction
  // into the async onSubmitM5Action receipt. Never triggers a re-render; consumed
  // and cleared immediately inside onSubmitM5Action.
  const pendingGuidanceOutcomeRef = useRef<string | undefined>(undefined);


  
  useEffect(() => {
    // Continuity & Memory: trace pre-shootout focus for restoration logic
    if (preShootoutFocus) {
      console.debug('[DirectorOS] Continuity: focus captured', preShootoutFocus);
    }
  }, [preShootoutFocus]);

  useEffect(() => {
    shootoutRef.current = shootout;
  }, [shootout]);

  const [presenceState, setPresenceState] = useState<PresenceState>(() => {
    const now = Date.now();
    return {
      activeOperators: MOCK_OPERATORS,
      activities: [
        { operatorId: 'op_bravo', targetId: 'mock_root_1', type: 'viewing', timestamp: now },
        { operatorId: 'op_charlie', targetId: 'mock_root_2', type: 'touched', timestamp: now - 120000, lastAction: 'Launch Shootout' },
      ],
    };
  });

  const broadcastIntent = useCallback((targetId: string, type: PresenceActivityType, lastAction?: string) => {
    setPresenceState((prev) => {
      const otherActivities = prev.activities.filter((act) => act.operatorId !== 'op_alpha');
      return {
        ...prev,
        activities: [
          ...otherActivities,
          { operatorId: 'op_alpha', targetId, type, timestamp: Date.now(), lastAction },
        ],
      };
    });
  }, []);

  const resolveConflicts = useCallback((targetId: string): Conflict[] => {
    const myActivity = presenceState.activities.find(act => act.operatorId === 'op_alpha' && act.targetId === targetId);
    if (!myActivity || myActivity.type === 'viewing') return [];

    const peerActivities = presenceState.activities.filter(act => act.targetId === targetId && act.operatorId !== 'op_alpha');

    return peerActivities.reduce((acc: Conflict[], peer) => {
      // High Severity: Dual preparing_commit
      if (myActivity.type === 'preparing_commit' && peer.type === 'preparing_commit') {
        acc.push({
          operatorId: peer.operatorId,
          peerIntent: peer.type,
          myIntent: myActivity.type,
          severity: 'high',
          message: 'Dual commit preparation detected.'
        });
      }
      // Medium Severity: commit vs comparison, or dual comparison
      else if ((myActivity.type === 'preparing_commit' && peer.type === 'comparing') || (myActivity.type === 'comparing' && peer.type === 'preparing_commit')) {
        acc.push({
          operatorId: peer.operatorId,
          peerIntent: peer.type,
          myIntent: myActivity.type,
          severity: 'medium',
          message: 'Triage comparison / commit preparation clash.'
        });
      }
      else if (myActivity.type === 'comparing' && peer.type === 'comparing') {
        acc.push({
          operatorId: peer.operatorId,
          peerIntent: peer.type,
          myIntent: myActivity.type,
          severity: 'medium',
          message: 'Multiple operators comparing this family.'
        });
      }
      // Low Severity: retrying vs reviewing
      else if ((myActivity.type === 'retrying' && peer.type === 'reviewing') || (myActivity.type === 'reviewing' && peer.type === 'retrying')) {
        acc.push({
          operatorId: peer.operatorId,
          peerIntent: peer.type,
          myIntent: myActivity.type,
          severity: 'low',
          message: 'Peer reviewing while you are retrying.'
        });
      }

      return acc;
    }, []);
  }, [presenceState.activities]);

  // Decay for active intents (2-min) and touch signals (5-min)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const twoMinsAgo = now - 2 * 60 * 1000;
      const fiveMinsAgo = now - 5 * 60 * 1000;

      setPresenceState((prev) => ({
        ...prev,
        activities: prev.activities.filter((act) => {
          // Keep current user standard viewing signal (managed by focus effect)
          if (act.operatorId === 'op_alpha' && act.type === 'viewing') return true;

          // Active intents have shorter expiry
          if (act.type === 'comparing' || act.type === 'preparing_commit' || act.type === 'reviewing') {
            return act.timestamp > twoMinsAgo;
          }

          // Legacy touch signals have longer expiry
          return act.timestamp > fiveMinsAgo;
        }),
      }));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Sync active focus for current operator (op_alpha)
  useEffect(() => {
    const targetId = selectedFamilyRootId ?? selectedJobId;
    if (!targetId) {
      setPresenceState((prev) => ({
        ...prev,
        activities: prev.activities.filter((act) => act.operatorId !== 'op_alpha'),
      }));
      return;
    }

    // Check current intent to avoid overwriting high-priority signals
    setPresenceState((prev) => {
      const currentActive = prev.activities.find(act => act.operatorId === 'op_alpha');

      // If we are already signaling a high-priority intent on this same target, don't revert to 'viewing'
      if (currentActive?.targetId === targetId && (currentActive.type === 'comparing' || currentActive.type === 'preparing_commit')) {
        return prev;
      }

      const otherActivities = prev.activities.filter((act) => act.operatorId !== 'op_alpha');
      return {
        ...prev,
        activities: [
          ...otherActivities,
          { operatorId: 'op_alpha', targetId, type: 'viewing', timestamp: Date.now() },
        ],
      };
    });

    // Escalation: If focus remains stable for 3s, signal 'reviewing'
    const escalationTimeout = setTimeout(() => {
      setPresenceState((prev) => {
        const currentActive = prev.activities.find(act => act.operatorId === 'op_alpha');
        if (currentActive?.targetId === targetId && currentActive.type === 'viewing') {
          return {
            ...prev,
            activities: [
              ...prev.activities.filter(act => act.operatorId !== 'op_alpha'),
              { operatorId: 'op_alpha', targetId, type: 'reviewing', timestamp: Date.now() }
            ]
          };
        }
        return prev;
      });
    }, 3000);

    return () => clearTimeout(escalationTimeout);
  }, [selectedFamilyRootId, selectedJobId]);

  const selectedScene = useMemo(() => selectSceneById(scenes, appState.selectedSceneId).selectedScene, [scenes, appState.selectedSceneId]);

  const selectedGraph = useMemo(() => {
    if (!selectedScene) return undefined;
    const sceneGraph = selectedScene.graph;
    if (sceneGraph) {
      const current = graphStates[selectedScene.id] ?? createGraphFromTemplate(selectedScene.id, selectedScene.name);
      return { ...current, nodes: sceneGraph.nodes, connections: sceneGraph.connections, layout: sceneGraph.layout };
    }
    return graphStates[selectedScene.id] ?? createGraphFromTemplate(selectedScene.id, selectedScene.name);
  }, [graphStates, selectedScene]);

  useEffect(() => {
    if (!operatorFeedback.visible) return;
    const timeout = window.setTimeout(() => setOperatorFeedback((prev) => ({ ...prev, visible: false })), operatorFeedback.emphasis === 'transition' ? 2600 : 1800);
    return () => window.clearTimeout(timeout);
  }, [operatorFeedback]);

  const pushOperatorFeedback = (
    message: string,
    tone: OperatorFeedbackState['tone'] = 'info',
    scope: OperatorFeedbackState['scope'] = 'launch',
    emphasis?: OperatorFeedbackState['emphasis']
  ) => {
    setOperatorFeedback({ message, tone, scope, emphasis, visible: true });
  };

  const pushInlineJobReceipt = (jobId: string, receipt: Omit<InlineActionReceipt, 'visible'>) => {
    setInlineActionReceiptByJob((prev) => ({ ...prev, [jobId]: { ...receipt, visible: true } }));
  };

  const pushInlineFamilyReceipt = (familyRootId: string, receipt: Omit<InlineActionReceipt, 'visible'>) => {
    setInlineActionReceiptByFamily((prev) => ({ ...prev, [familyRootId]: { ...receipt, visible: true } }));
  };

  useEffect(() => {
    if (!Object.values(inlineActionReceiptByJob).some((entry) => entry.visible) && !Object.values(inlineActionReceiptByFamily).some((entry) => entry.visible)) return;
    const timeout = window.setTimeout(() => {
      setInlineActionReceiptByJob((prev) => Object.fromEntries(Object.entries(prev).map(([key, value]) => [key, { ...value, visible: false }])));
      setInlineActionReceiptByFamily((prev) => Object.fromEntries(Object.entries(prev).map(([key, value]) => [key, { ...value, visible: false }])));
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [inlineActionReceiptByJob, inlineActionReceiptByFamily]);

  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        setIsFocusMode((prev) => !prev);
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setTimelineState((prev) => ({
          ...prev,
          playheadPositionMs: prev.playheadPositionMs + 100,
        }));
        return;
      }

      if (event.key !== 'Escape') return;

      event.preventDefault();
      // Pass 29: Escape clears the full focus stack so operator never gets stuck.
      setIsFocusMode(false);
      setSelectedJobId(undefined);
      setSelectedFamilyRootId(undefined);
      setArtifactFocus(initialArtifactFocus);
      if (selectedScene) {
        setSelectedGraphNodeByScene((prev) => {
          if (!(selectedScene.id in prev)) return prev;
          const next = { ...prev };
          delete next[selectedScene.id];
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedScene]);

  useOverlayEscape(true);

  const openCommandConsole = useCallback(() => {
    setIsCommandConsoleOpen(true);
    setActiveM6Screen('console');
  }, []);

  const closeCommandConsole = useCallback(() => {
    setIsCommandConsoleOpen(false);
    setActiveM6Screen('workspace');
  }, []);

  const selectedGraphNodeId = selectedScene ? selectedGraphNodeByScene[selectedScene.id] : undefined;
  const postWorkflow = selectedScene 
    ? postWorkflowByScene[selectedScene.id] 
    : { review: 'pending', edit: 'waiting', export: 'waiting', delivery: 'waiting' } as PostWorkflowState;

  const selectedGraphNode = useMemo<SceneGraphNode | undefined>(() => selectedGraph?.nodes?.find((node) => node.id === selectedGraphNodeId), [selectedGraph, selectedGraphNodeId]);

  const formatFocusValue = (value: string, max = 42) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

  const selectedGraphContext = useMemo(() => {
    if (!selectedGraphNode || !selectedGraph) return undefined;

    const nodesById = Object.fromEntries(selectedGraph.nodes.map((node) => [node.id, node]));
    const upstream = selectedGraph.connections
      .filter((connection) => connection.to === selectedGraphNode.id)
      .map((connection) => nodesById[connection.from]?.title ?? connection.from);
    const downstream = selectedGraph.connections
      .filter((connection) => connection.from === selectedGraphNode.id)
      .map((connection) => nodesById[connection.to]?.title ?? connection.to);

    return { upstream, downstream };
  }, [selectedGraph, selectedGraphNode]);

  const shotQueueSummary = useMemo(() => {
    if (!selectedGraph?.nodes || !selectedScene) return [] as Array<{ id: string; title: string; order: number; state: ShotRuntimeState; progress: number; stage: string; lastAction: string; isCurrent: boolean; duration?: number }>;
    const sceneState = shotSequenceByScene[selectedScene.id] ?? {};
    const shots = sortShotsInSequence(selectedGraph.nodes.filter((node) => node.type === 'shot'));

    return shots.map((shot, index) => {
      const current = sceneState[shot.id];
      const fallbackState: ShotRuntimeState = index === 0 ? 'active' : 'waiting';
      const duration = typeof shot.shotOverrides?.duration === 'number' ? shot.shotOverrides.duration : 5;
      return {
        id: shot.id,
        title: shot.title,
        order: index + 1,
        state: current?.state ?? fallbackState,
        progress: current?.progress ?? (index === 0 ? 8 : 0),
        stage: current?.stage ?? (index === 0 ? 'queued for compile' : 'waiting in sequence'),
        lastAction: current?.lastAction ?? (index === 0 ? 'Sequence armed' : 'Awaiting previous shot completion'),
        isCurrent: current?.isCurrent ?? index === 0,
        duration,
      };
    });
  }, [selectedGraph, selectedScene, shotSequenceByScene]);

  const activeShot = useMemo(() => {
    const idx = getCurrentShotIndex(shotQueueSummary);
    return idx >= 0 ? shotQueueSummary[idx] : undefined;
  }, [shotQueueSummary]);

  const selectedShotForLedger = useMemo(() => (selectedGraphNode?.type === 'shot' ? selectedGraphNode.id : activeShot?.id), [selectedGraphNode, activeShot]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return undefined;
    return runtimeJobs.find((job) => job.id === selectedJobId || job.runtimeBridgeJobId === selectedJobId);
  }, [runtimeJobs, selectedJobId]);




  const refreshRuntimeSurfaces = async () => {
    if (streamState === 'offline') {
      return [];
    }
    const [_, recentEnvelope, timelineResult] = await Promise.all([
      syncRuntimeJobsToLocal(),
      runtimeApi.recentRenders(12).catch(() => ({ recent: [] })),
      syncTimelineState(100).catch(() => ({ events: [], bounds: { startMs: Date.now(), endMs: Date.now() + 1000 } })),
    ]);

    const persistedJobs = listRenderJobs();
    const counts = getRenderJobCounts();

    setTimelineState(prev => {
      const { events, bounds } = timelineResult;
      const mappedClips: TimelineClip[] = events.map((ev, idx) => ({
        id: ev.id,
        sceneId: 'root',
        start: 0,
        duration: 0,
        startMs: ev.created_at ? new Date(ev.created_at).getTime() : 0,
        durationMs: ev.duration_ms || 0,
        label: ev.job_id || `Job ${idx}`,
        track: idx % 3,
        parentJobId: (ev as any).lineage_parent_job_id,
      }));

      // Auto-follow logic: If end has moved, snap playhead to end
      const endMoved = bounds.endMs > prev.sessionEndMs;
      const nextPlayhead = endMoved ? bounds.endMs : prev.playheadPositionMs;

      return {
        ...prev,
        clips: mappedClips.slice(0, 50), // Cap timeline Virtual DOM weight
        sessionStartMs: bounds.startMs,
        sessionEndMs: bounds.endMs,
        playheadPositionMs: nextPlayhead,
      };
    });

    setRuntimeJobs(() => persistedJobs);
    setRenderJobs(() => persistedJobs);
    setRuntimeJobCounts(counts);
    setJobCounts(counts);
    setRuntimeRecentRenders((recentEnvelope as { recent?: any[] }).recent ?? []);
    setRuntimeTimeline(timelineResult.events);
    setLastStreamEventAt(Date.now());

    return persistedJobs;
  };

  const handleTimelineScrub = (posMs: number) => {
    setTimelineState(prev => ({ ...prev, playheadPositionMs: posMs }));

    // Core interactivity: Find and select the job at this position
    const activeClip = timelineState.clips.find(clip =>
      clip.startMs !== undefined && clip.durationMs !== undefined &&
      posMs >= clip.startMs && posMs <= (clip.startMs + clip.durationMs)
    );

    if (activeClip && activeClip.id !== appState.selectedClipId) {
      setAppState(prev => ({ ...prev, selectedClipId: activeClip.id }));
      // Also potentially select the associated job
      const associatedJob = runtimeJobs.find(j => j.id === activeClip.id || j.runtimeBridgeJobId === activeClip.id);
      if (associatedJob) {
        setSelectedJobId(associatedJob.id);
        setSelectedFamilyRootId(findLineageRootId(associatedJob, runtimeJobs));
      }
    }
  };

  const getDefaultOutputPath = (job?: RenderQueueJob) => {
    if (!job) return undefined;
    return job.previewImage ?? job.previewMedia;
  };

  const syncLivePreviewFromRenderState = (state: RenderPreviewState | undefined, activeJob?: RenderQueueJob, activeShotId?: string | null) => {
    if (!state) return;
    const nextMode: LivePreviewState['mode'] =
      activeJob?.state === 'cancelled'
        ? 'cancelled'
        : state.mode === 'queued'
          ? 'queued'
          : state.mode === 'completed'
            ? 'completed'
            : state.mode === 'failed'
              ? 'failed'
              : activeJob?.state === 'preflight'
                ? 'preflight'
                : activeJob?.state === 'packaging'
                  ? 'packaging'
                  : state.mode === 'rendering'
                    ? 'running'
                    : 'idle';

    const shouldClearPreview =
      nextMode === 'queued' ||
      nextMode === 'preflight' ||
      nextMode === 'cancelled' ||
      (state.mode === 'failed' && ((state.label ?? '').toLowerCase().includes('preflight') || !state.previewImage && !state.previewMedia));

    setLivePreview({
      mode: nextMode,
      activeJobId: nextMode === 'cancelled' ? activeJob?.id ?? null : activeJob?.id ?? null,
      activeShotId: activeShotId ?? activeJob?.shotId ?? null,
      previewImage: shouldClearPreview ? null : state.previewImage ?? activeJob?.previewImage ?? null,
      previewMedia: shouldClearPreview ? null : state.previewMedia ?? activeJob?.previewMedia ?? null,
      previewType: shouldClearPreview ? null : state.previewType ?? activeJob?.previewType ?? null,
      statusLabel: state.label ?? (nextMode === 'idle' ? 'Idle - ready to render' : nextMode),
      progressLabel: `${state.progress}%`,
      errorLabel: state.mode === 'failed' ? state.label ?? 'Render failed' : null,
      progressPercent: nextMode === 'cancelled' ? activeJob?.progress ?? state.progress : state.progress,
    });
  };

  const findLineageRootId = (job: RenderQueueJob, jobs: RenderQueueJob[]) => {
    const byId = new Map(jobs.map((entry) => [entry.id, entry]));
    let current: RenderQueueJob | undefined = job;
    let guard = 0;
    while (current && (current.lineageParentJobId || current.retryOf) && guard < 12) {
      const parentId: string | undefined = current.lineageParentJobId ?? current.retryOf;
      const parent: RenderQueueJob | undefined = parentId ? byId.get(parentId) : undefined;
      if (!parent) break;
      current = parent;
      guard += 1;
    }
    return current?.id ?? job.id;
  };

  const runtimeSignalContext = useMemo<RuntimeSignalContext>(() => {
    const targetJobId = selectedJob?.id ?? livePreview.activeJobId ?? undefined;
    const rawLastTransition = targetJobId ? jobRuntimeSignals.lastTransitionByJobId[targetJobId] : undefined;
    const lastTransition = rawLastTransition && Date.now() - rawLastTransition.timestamp <= TRANSITION_SIGNAL_RETENTION_MS ? rawLastTransition : undefined;
    const lastSignalAt = targetJobId ? jobRuntimeSignals.lastSignalAtByJobId[targetJobId] : undefined;
    const stalled = targetJobId && livePreview.mode && isRuntimeLifecycleSignalState(livePreview.mode) && ACTIVE_RUNTIME_SIGNAL_STATES.includes(livePreview.mode)
      ? {
        active: Boolean(lastSignalAt && Date.now() - lastSignalAt > STALLED_SIGNAL_THRESHOLD_MS),
        sinceTimestamp: lastSignalAt,
        state: livePreview.mode,
      }
      : { active: false as const };

    return {
      lastTransition,
      stalled,
      queueMode,
      selectedDiffersFromLive: Boolean(selectedJob?.id && livePreview.activeJobId && selectedJob.id !== livePreview.activeJobId),
    };
  }, [selectedJob?.id, livePreview.activeJobId, livePreview.mode, jobRuntimeSignals, queueMode]);

  const selectedFamilyJobs = useMemo(() => {
    if (!selectedFamilyRootId) return [] as RenderQueueJob[];
    return runtimeJobs
      .filter((job) => findLineageRootId(job, renderJobs) === selectedFamilyRootId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [runtimeJobs, selectedFamilyRootId]);

  const selectedFamilyRepresentativeJob = useMemo(() => {
    if (selectedJob && selectedFamilyRootId && findLineageRootId(selectedJob, runtimeJobs) === selectedFamilyRootId) return selectedJob;
    return selectedFamilyJobs[0];
  }, [selectedJob, selectedFamilyJobs, selectedFamilyRootId, runtimeJobs]);

  const selectedOutputPath = useMemo(() => {
    if (!selectedJob) return undefined;
    const focused = artifactFocus.jobId === selectedJob.id ? artifactFocus.outputPath ?? undefined : undefined;
    if (focused && selectedJob.resultPaths?.includes(focused)) return focused;
    const chosen = selectedOutputByJob[selectedJob.id];
    if (chosen && selectedJob.resultPaths?.includes(chosen)) return chosen;
    return getDefaultOutputPath(selectedJob);
  }, [selectedJob, selectedOutputByJob, artifactFocus]);

  // DECOUPLED: Use explicit refresh signal or lastStreamEventAt to avoid re-calc on every progress tick
  const reviewSnapshot = useMemo(() => getReviewRuntimeSnapshot(), [lastStreamEventAt]);

  const shotProjectionByShotId = useMemo(() => {
    const map = new Map<string, (typeof reviewSnapshot.shotProjections)[number]>();
    reviewSnapshot.shotProjections.forEach((projection) => map.set(projection.shotId, projection));
    return map;
  }, [reviewSnapshot]);

  const selectedJobProjection = useMemo(() => {
    if (!selectedJob?.shotId) return undefined;
    return shotProjectionByShotId.get(selectedJob.shotId);
  }, [selectedJob, shotProjectionByShotId]);

  const decisionProposalByJobId = useMemo(() => {
    const proposals = new Map<string, { rankedCandidates: Array<{ candidateId: string; score: number }>; policyId?: string; policyHash?: string; eventId: string }>();
    reviewSnapshot.eventLog.forEach((event) => {
      if (event.eventType !== 'review.decision.proposed') return;
      const payload = event.payload as { rankedCandidates?: Array<{ candidateId: string; score: number }>; policyId?: string; policyHash?: string };
      proposals.set(event.jobId, {
        rankedCandidates: payload.rankedCandidates ?? [],
        policyId: payload.policyId,
        policyHash: payload.policyHash,
        eventId: event.eventId,
      });
    });
    return proposals;
  }, [reviewSnapshot]);

  const selectedDecisionProposal = useMemo(() => {
    if (!selectedJob) return undefined;
    return decisionProposalByJobId.get(selectedJob.id);
  }, [selectedJob, decisionProposalByJobId]);

  const actionAuditByJobId = useMemo(() => {
    const entries = new Map<string, {
      actionState?: 'pending' | 'approved' | 'needs_revision' | 'rejected' | 'superseded' | 'finalized';
      approvedBy?: string;
      approvedAt?: number;
      supersededJobId?: string;
      supersededByJobId?: string;
      supersedesJobId?: string;
      finalizedAt?: number;
    }>();

    const rank: Record<string, number> = {
      'review.action.approved': 1,
      'review.action.revision_requested': 2,
      'review.action.rejected': 3,
      'review.action.superseded': 4,
      'review.action.finalized': 5,
    };

    reviewSnapshot.eventLog
      .filter((event) => event.eventType.startsWith('review.action.'))
      .sort((a, b) => (a.occurredAt === b.occurredAt ? (rank[a.eventType] ?? 0) - (rank[b.eventType] ?? 0) : a.occurredAt - b.occurredAt))
      .forEach((event) => {
        const payload = event.payload as { audit?: { approvedBy?: string; approvedAt?: number; supersededJobId?: string; supersededByJobId?: string; supersedesJobId?: string; finalizedAt?: number } };
        const nextState =
          event.eventType === 'review.action.approved'
            ? 'approved'
            : event.eventType === 'review.action.revision_requested'
              ? 'needs_revision'
              : event.eventType === 'review.action.rejected'
                ? 'rejected'
                : event.eventType === 'review.action.superseded'
                  ? 'superseded'
                  : 'finalized';
        entries.set(event.jobId, {
          actionState: nextState,
          approvedBy: payload.audit?.approvedBy,
          approvedAt: payload.audit?.approvedAt,
          supersededJobId: payload.audit?.supersededJobId,
          supersededByJobId: payload.audit?.supersededByJobId,
          supersedesJobId: payload.audit?.supersedesJobId,
          finalizedAt: payload.audit?.finalizedAt,
        });
      });

    return entries;
  }, [reviewSnapshot]);

  const selectedJobReview = useMemo(() => {
    if (!selectedJob || !selectedJobProjection) return undefined;
    const scores = selectedJobProjection.measuredSignals;
    const bestKnown = selectedJobProjection.bestKnownOutputSelection;
    const retry = selectedJobProjection.retryRecommendation;
    const bestKnownRank = selectedDecisionProposal?.rankedCandidates.findIndex((item) => item.candidateId === bestKnown?.selectedJobId);
    const approvalStatus = selectedJobProjection.approvalStatus;
    const jobActionAudit = actionAuditByJobId.get(selectedJob.id);

    return {
      measuredSignals: scores,
      decisionOutputs: {
        bestKnownOutputSelection: bestKnown
          ? {
            selectedJobId: bestKnown.selectedJobId,
            selectionMode: bestKnown.selectionMode,
            rankPosition: typeof bestKnownRank === 'number' && bestKnownRank >= 0 ? bestKnownRank + 1 : undefined,
            availableCandidates: selectedDecisionProposal?.rankedCandidates.length ?? 0,
          }
          : undefined,
        retryRecommendation: retry
          ? {
            recommend: retry.recommend,
            reasonCode: retry.reasonCode,
            authorityState: (selectedJob.state === 'failed' ? 'eligible' : 'blocked') as 'eligible' | 'blocked',
          }
          : undefined,
        reviewStatus: selectedJobProjection.reviewStatus,
        approvalStatus,
      },
      explanations: {
        summary: selectedJobProjection.explanations?.summary,
        bestKnownWhy: bestKnown
          ? [
            `Selection mode: ${bestKnown.selectionMode}.`,
            bestKnown.selectedJobId === selectedJob.id
              ? 'Current job is best-known for this shot.'
              : `Best-known points to ${bestKnown.selectedJobId}.`,
          ]
          : [],
        retryWhy: retry?.recommend ? [`Retry suggested: ${retry.reasonCode ?? 'quality threshold not met'}.`] : [],
        humanNotes: selectedJob.state === 'failed' ? selectedJob.error : undefined,
      },
      trace: {
        scorerVersion: selectedDecisionProposal?.policyId ?? 'composite_score_v2',
        policyId: selectedDecisionProposal?.policyHash ?? 'default_weight_policy_v2',
        eventId: selectedDecisionProposal?.eventId,
      },
      actionState: jobActionAudit?.actionState ?? selectedJobProjection.actionState?.current,
      actionAudit: {
        approvedBy: jobActionAudit?.approvedBy,
        approvedAt: jobActionAudit?.approvedAt,
        supersededJobId: jobActionAudit?.supersededJobId,
        supersededByJobId: jobActionAudit?.supersededByJobId,
        supersedesJobId: jobActionAudit?.supersedesJobId,
        finalizedAt: jobActionAudit?.finalizedAt,
      },
    };
  }, [selectedJob, selectedJobProjection, selectedDecisionProposal, actionAuditByJobId]);

  const deriveCanonicalRunSurface = (
    job: RenderQueueJob,
    shotProjection?: (typeof reviewSnapshot.shotProjections)[number],
    actionAudit?: {
      actionState?: 'pending' | 'approved' | 'needs_revision' | 'rejected' | 'superseded' | 'finalized';
    },
  ) => {
    const terminalState = job.state;
    const isFailed = terminalState === 'failed';
    const isCancelled = terminalState === 'cancelled';
    const isCompleted = terminalState === 'completed';

    const canonicalState =
      isFailed
        ? 'failed'
        : isCancelled
          ? 'cancelled'
          : actionAudit?.actionState
            ? actionAudit.actionState
            : isCompleted && shotProjection?.bestKnownOutputSelection?.selectedJobId === job.id
              ? 'best_known'
              : isCompleted
                ? 'completed'
                : terminalState;

    const diagnostics =
      job.error ??
      (isFailed
        ? 'Failure recorded (provider did not return diagnostic text).'
        : isCancelled
          ? 'Cancelled by operator.'
          : undefined);

    return {
      canonicalState,
      diagnostics,
      unresolvedAttention: isFailed || isCancelled || canonicalState === 'needs_revision' || canonicalState === 'rejected',
      bestKnown: shotProjection?.bestKnownOutputSelection?.selectedJobId === job.id,
      lineageParent: (job as any).retryOfJobId,
    };
  };

  const sceneReviewBoard = useMemo(() => {
    if (!selectedScene) return undefined;
    const shotRows = shotQueueSummary.map((shot) => {
      const projection = shotProjectionByShotId.get(shot.id);
      const retry = projection?.retryRecommendation;
      const effectiveApprovalStatus = projection?.approvalStatus;
      const isApproved = effectiveApprovalStatus === 'approved';
      const isReviewable = projection?.reviewStatus !== 'blocked';
      const riskScore = projection?.measuredSignals
        ? (projection.measuredSignals.artifactSeverity * 0.5 + (1 - projection.measuredSignals.motionStability) * 0.3 + (1 - projection.measuredSignals.continuityMatch) * 0.2)
        : 0;
      return {
        shotId: shot.id,
        approvalStatus: effectiveApprovalStatus,
        reviewStatus: projection?.reviewStatus,
        bestKnownJobId: projection?.bestKnownOutputSelection?.selectedJobId,
        retryRecommendation: retry,
        reasonSnippet: projection?.explanations?.summary,
        blocked: projection?.reviewStatus === 'blocked',
        approved: isApproved,
        reviewable: isReviewable,
        riskScore,
      };
    });

    const reviewable = shotRows.filter((row) => row.reviewable);
    const approved = reviewable.filter((row) => row.approved);
    const finalizedCount = shotRows.filter((row) => shotProjectionByShotId.get(row.shotId)?.actionState?.current === 'finalized').length;
    const needsRevisionCount = shotRows.filter((row) => row.approvalStatus === 'needs_revision').length;
    const rejectedCount = shotRows.filter((row) => row.approvalStatus === 'rejected').length;
    const supersededCount = shotRows.filter((row) => row.approvalStatus === 'superseded').length;
    const retryOpen = shotRows.filter((row) => row.retryRecommendation?.recommend).length;
    const blockedRetries = shotRows.filter((row) => row.blocked && row.retryRecommendation?.recommend).length;
    const highPriorityRetries = shotRows.filter((row) => row.retryRecommendation?.recommend && row.riskScore >= 0.6).length;
    const pressureValue = reviewable.length ? (retryOpen + highPriorityRetries * 2 + blockedRetries * 3) / reviewable.length : 0;
    const pressureBand = pressureValue >= 2 ? 'critical' : pressureValue >= 1.25 ? 'high' : pressureValue >= 0.75 ? 'medium' : 'low';
    const covered = reviewable.filter((row) => Boolean(row.bestKnownJobId)).length;
    const exceptions = shotRows.filter((row) => row.reviewStatus === 'blocked' || row.approvalStatus === 'needs_revision' || row.approvalStatus === 'rejected');

    return {
      status: pressureBand === 'critical' ? 'blocked' : pressureBand === 'high' ? 'needs_attention' : exceptions.length ? 'watch' : 'healthy',
      passRate: { value: reviewable.length ? approved.length / reviewable.length : 0, approved: approved.length, reviewable: reviewable.length },
      retryPressure: { value: pressureValue, band: pressureBand },
      bestKnownCoverage: { value: reviewable.length ? covered / reviewable.length : 0, covered, reviewable: reviewable.length },
      failureClusters: (() => {
        const cluster = new Map<string, { reasonCode: string; count: number; shots: string[] }>();
        shotRows.forEach((row) => {
          const key = row.retryRecommendation?.reasonCode;
          if (!key) return;
          const current = cluster.get(key) ?? { reasonCode: key, count: 0, shots: [] };
          current.count += 1;
          if (!current.shots.includes(row.shotId)) current.shots.push(row.shotId);
          cluster.set(key, current);
        });
        return Array.from(cluster.values()).sort((a, b) => b.count - a.count).slice(0, 3);
      })(),
      explanations: {
        summary: pressureBand === 'low' ? 'Scene is tracking healthy with low retry pressure.' : `Scene is under ${pressureBand} retry pressure and needs targeted shot cleanup.`,
        whyNotApproved: exceptions.length
          ? `${exceptions.length} shots still blocked or marked needs revision.`
          : 'No blocking shots currently detected.',
        fastestPathToGreen: exceptions.length
          ? `Resolve retry reasons on ${exceptions.slice(0, 3).map((item) => item.shotId).join(', ')} and re-run review.`
          : 'Maintain approvals and monitor drift.',
      },
      shotExceptions: exceptions,
      evidenceRefs: {
        shotIds: exceptions.map((item) => item.shotId),
        reasonCodes: exceptions
          .map((item) => item.retryRecommendation?.reasonCode)
          .filter((code): code is string => Boolean(code)),
      },
      actionAggregates: {
        approved: approved.length,
        finalized: finalizedCount,
        needsRevision: needsRevisionCount,
        rejected: rejectedCount,
        superseded: supersededCount,
        total: shotRows.length,
      },
    };
  }, [selectedScene, shotQueueSummary, shotProjectionByShotId]);

  const lineageFamily = useMemo(() => {
    const baseJob = selectedJob ?? selectedFamilyRepresentativeJob;
    if (!baseJob) return [] as RenderQueueJob[];
    const byId = new Map(renderJobs.map((job) => [job.id, job]));
    let root = baseJob;
    let guard = 0;
    while ((root.lineageParentJobId || root.retryOf) && guard < 12) {
      const parentId: string | undefined = root.lineageParentJobId ?? root.retryOf;
      const parent: RenderQueueJob | undefined = parentId ? byId.get(parentId) : undefined;
      if (!parent) break;
      root = parent;
      guard += 1;
    }
    const rootId = root.id;
    const belongsToRoot = (job: RenderQueueJob) => {
      let current: RenderQueueJob | undefined = job;
      let depth = 0;
      while (current && depth < 12) {
        if (current.id === rootId) return true;
        const parentId: string | undefined = current.lineageParentJobId ?? current.retryOf;
        current = parentId ? byId.get(parentId) : undefined;
        depth += 1;
      }
      return job.id === rootId;
    };
    return renderJobs.filter((job) => belongsToRoot(job)).sort((a, b) => b.createdAt - a.createdAt);
  }, [selectedJob, selectedFamilyRepresentativeJob, renderJobs]);

  const familyDecisionHistory = useMemo(() => {
    if (!selectedFamilyRootId) return [];
    return resolveFamilyDecisionHistory(selectedFamilyRootId, reviewSnapshot.eventLog);
  }, [selectedFamilyRootId, reviewSnapshot.eventLog]);


  const resolvedOperatorReviewState = useMemo(() => resolveOperatorReviewState({
    selectedJob,
    projection: selectedJobProjection,
    decisionProposal: selectedDecisionProposal,
    actionAudit: selectedJob ? actionAuditByJobId.get(selectedJob.id) : undefined,
  }), [selectedJob, selectedJobProjection, selectedDecisionProposal, actionAuditByJobId]);

  const shotJobLedger = useMemo(() => {
    if (!selectedScene) return [] as Array<{ jobId: string; shotId?: string; takeId?: string; version?: number; state: string; progress: number; createdAt: number; route: string; retryDepth?: number; lineageParentJobId?: string }>;

    const sceneJobs = renderJobs.filter((job) => job.sceneId === selectedScene.id);
    const projectionMap = new Map(getReviewRuntimeSnapshot().shotProjections.map((projection) => [projection.shotId, projection]));
    const scopedJobs =
      shotLedgerScope === 'all_scene'
        ? sceneJobs
        : sceneJobs.filter((job) => (!selectedShotForLedger ? true : job.shotId === selectedShotForLedger));

    const byId = new Map(scopedJobs.map((job) => [job.id, job]));
    const children = new Map<string, typeof scopedJobs>();
    const roots: typeof scopedJobs = [];

    scopedJobs.forEach((job) => {
      const parentId = job.lineageParentJobId ?? job.retryOf;
      if (parentId && byId.has(parentId)) {
        const list = children.get(parentId) ?? [];
        list.push(job);
        children.set(parentId, list);
      } else {
        roots.push(job);
      }
    });

    const ordered: typeof scopedJobs = [];
    const visit = (job: (typeof scopedJobs)[number]) => {
      ordered.push(job);
      const kids = (children.get(job.id) ?? []).slice().sort((a, b) => a.createdAt - b.createdAt);
      kids.forEach(visit);
    };

    roots
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach(visit);

    return ordered.map((job) => {
      const projection = job.shotId ? projectionMap.get(job.shotId) : undefined;
      return {
        jobId: job.id,
        shotId: job.shotId,
        takeId: job.takeId,
        version: job.version,
        state: job.state,
        progress: job.progress,
        createdAt: job.createdAt,
        route: job.bridgeJob.payload.routeContext.activeRoute,
        retryDepth: job.retryDepth,
        lineageParentJobId: job.lineageParentJobId ?? job.retryOf,
        technicalQuality: projection?.measuredSignals?.technicalQuality,
        artifactSeverity: projection?.measuredSignals?.artifactSeverity,
        motionStability: projection?.measuredSignals?.motionStability,
        bestKnown: projection?.bestKnownOutputSelection?.selectedJobId === job.id,
        retrySuggested: projection?.retryRecommendation?.recommend,
        retryReasonCode: projection?.retryRecommendation?.reasonCode,
        reviewStatus: projection?.reviewStatus,
        approvalStatus: projection?.approvalStatus,
        actionState: projection?.actionState?.current,
        approvedBy: projection?.actionState?.approvedBy,
        approvedAt: projection?.actionState?.approvedAt,
        supersededJobId: projection?.actionState?.supersededJobId,
        supersededByJobId: selectedJob?.id === job.id ? resolvedOperatorReviewState?.replacementJobId : undefined,
        supersedesJobId: projection?.actionState?.supersedesJobId,
        finalizedAt: projection?.actionState?.finalizedAt,
        explanationSnippet: projection?.explanations?.summary,
      };
    });
  }, [selectedScene, selectedShotForLedger, renderJobs, shotLedgerScope, activeShot, postWorkflow, resolvedOperatorReviewState]);

  const currentWinnerJob = useMemo(() => {
    const winnerId = resolvedOperatorReviewState?.bestKnownJobId;
    return winnerId ? renderJobs.find((job) => job.id === winnerId) : undefined;
  }, [resolvedOperatorReviewState, renderJobs]);

  const approvedOutputJob = useMemo(() => {
    const approvedJobId = resolvedOperatorReviewState?.approvedJobId;
    return approvedJobId ? renderJobs.find((job) => job.id === approvedJobId) : undefined;
  }, [resolvedOperatorReviewState, renderJobs]);

  const replacementJob = useMemo(() => {
    const replacementId = resolvedOperatorReviewState?.replacementJobId;
    return replacementId ? renderJobs.find((job) => job.id === replacementId) : undefined;
  }, [resolvedOperatorReviewState, renderJobs]);

  const resolvedProductionFamilyTruth = useMemo(() => {
    if (!selectedFamilyRootId) return undefined;
    return resolveProductionFamilyTruth({
      lineageRootId: selectedFamilyRootId,
      familyLabel: `Family ${selectedFamilyRootId.slice(0, 6)}`,
      jobs: renderJobs,
      projection: selectedJobProjection,
      actionAuditByJobId,
    });
  }, [selectedFamilyRootId, renderJobs, selectedJobProjection, actionAuditByJobId]);


  const getSupportingEvidenceJob = (jobs: RenderQueueJob[]) => {
    if (!jobs.length) return undefined;
    const latestAttempt = jobs[0];
    const latestFailed = jobs.find((job) => job.state === 'failed' && job.bridgeJob.sceneId && job.bridgeJob.payload?.prompt && job.bridgeJob.payload?.routeContext?.activeRoute && job.bridgeJob.payload?.routeContext?.strategy);
    if (latestFailed) return latestFailed;
    if (approvedOutputJob) return approvedOutputJob;
    if (currentWinnerJob) return currentWinnerJob;
    return latestAttempt;
  };

  const supportingEvidenceJob = useMemo(() => getSupportingEvidenceJob(lineageFamily), [lineageFamily, approvedOutputJob, currentWinnerJob]);
  const rankedEvidenceCandidates = useMemo<Array<{ jobId: string; label: string; reason: string; role: 'operational_truth' | 'supporting_evidence' | 'historical_artifact'; isDefault?: boolean }>>(() => {
    if (!lineageFamily.length) return [];
    return lineageFamily.slice(0, 5).map((job, index) => {
      const role: 'operational_truth' | 'supporting_evidence' | 'historical_artifact' = approvedOutputJob?.id === job.id
        ? 'operational_truth'
        : currentWinnerJob?.id === job.id && !approvedOutputJob
          ? 'operational_truth'
          : supportingEvidenceJob?.id === job.id
            ? 'supporting_evidence'
            : 'historical_artifact';
      const reason = job.state === 'failed'
        ? 'failed latest when attention is needed'
        : approvedOutputJob?.id === job.id
          ? 'approved output when approval exists'
          : currentWinnerJob?.id === job.id
            ? 'current winner when present'
            : index === 0
              ? 'latest attempt as fallback evidence'
              : 'alternate valid supporting attempt';
      return {
        jobId: job.id,
        label: `${job.id.length <= 12 ? job.id : `${job.id.slice(0, 6)}…${job.id.slice(-4)}`} • ${job.state}`,
        reason,
        role,
        isDefault: supportingEvidenceJob?.id === job.id,
      };
    });
  }, [lineageFamily, approvedOutputJob, currentWinnerJob, supportingEvidenceJob]);

  const buildCompareEvidenceItem = (jobId: string): CompareEvidenceItem | undefined => {
    const job = renderJobs.find((entry) => entry.id === jobId);
    const candidate = rankedEvidenceCandidates.find((entry) => entry.jobId === jobId);
    if (!job || !candidate) return undefined;
    const defaultId = supportingEvidenceJob?.id;
    const framing = approvedOutputJob?.id === job.id
      ? 'Approved vs Candidate'
      : currentWinnerJob?.id === job.id
        ? 'Winner vs Alternate'
        : job.state === 'failed'
          ? 'Latest vs Historical'
          : candidate.isDefault
            ? 'Default Evidence'
            : 'Alternate Evidence';
    const lineageHint = defaultId && defaultId !== job.id
      ? `${job.id.length <= 12 ? job.id : `${job.id.slice(0, 6)}…${job.id.slice(-4)}`} compared against ${defaultId.length <= 12 ? defaultId : `${defaultId.slice(0, 6)}…${defaultId.slice(-4)}`}`
      : `Family lineage node ${job.id.length <= 12 ? job.id : `${job.id.slice(0, 6)}…${job.id.slice(-4)}`}`;
    return {
      jobId: job.id,
      label: candidate.label,
      reason: candidate.reason,
      role: candidate.role,
      previewPath: selectedOutputByJob[job.id] ?? getDefaultOutputPath(job),
      framing,
      lineageHint,
    };
  };

  const getSuggestedComparePartner = (jobId: string) => {
    const latestFailed = lineageFamily.find((job) => job.state === 'failed');
    const latestAttempt = lineageFamily[0];
    const alternateCandidate = rankedEvidenceCandidates.find((candidate) => candidate.jobId !== jobId && candidate.role !== 'historical_artifact');
    const supersededCandidate = replacementJob && replacementJob.id !== jobId ? replacementJob : undefined;

    if (currentWinnerJob?.id === jobId && latestFailed && latestFailed.id !== jobId) return { partnerId: latestFailed.id, rule: 'winner vs failed latest' };
    if (approvedOutputJob?.id === jobId && alternateCandidate) return { partnerId: alternateCandidate.jobId, rule: 'approved vs alternate' };
    if (latestFailed?.id === jobId && currentWinnerJob && currentWinnerJob.id !== jobId) return { partnerId: currentWinnerJob.id, rule: 'failed latest vs winner' };
    if (latestAttempt?.id === jobId && supersededCandidate) return { partnerId: supersededCandidate.id, rule: 'latest vs superseded' };
    if (alternateCandidate) return { partnerId: alternateCandidate.jobId, rule: 'default vs alternate' };
    if (latestAttempt && latestAttempt.id !== jobId) return { partnerId: latestAttempt.id, rule: 'candidate vs latest' };
    return undefined;
  };

  const suggestedCompareSeedJobId = supportingEvidenceJob?.id ?? rankedEvidenceCandidates[0]?.jobId;
  const suggestedComparePair = suggestedCompareSeedJobId ? getSuggestedComparePartner(suggestedCompareSeedJobId) : undefined;
  const suggestedPairLabel = suggestedCompareSeedJobId && suggestedComparePair?.partnerId
    ? `${suggestedComparePair.rule} • ${(suggestedCompareSeedJobId.length <= 12 ? suggestedCompareSeedJobId : `${suggestedCompareSeedJobId.slice(0, 6)}…${suggestedCompareSeedJobId.slice(-4)}`)} vs ${(suggestedComparePair.partnerId.length <= 12 ? suggestedComparePair.partnerId : `${suggestedComparePair.partnerId.slice(0, 6)}…${suggestedComparePair.partnerId.slice(-4)}`)}`
    : undefined;

  const productionFamily = useMemo(() => {
    if (!resolvedProductionFamilyTruth) return undefined;
    return {
      lineageRootId: resolvedProductionFamilyTruth.lineageRootId,
      familyLabel: resolvedProductionFamilyTruth.familyLabel,
      familyState: resolvedProductionFamilyTruth.familyState,
      currentWinnerId: resolvedProductionFamilyTruth.bestKnownJobId,
      approvedOutputId: resolvedProductionFamilyTruth.approvedOutputJobId,
      replacementJobId: resolvedProductionFamilyTruth.replacementJobId,
      latestAttemptId: resolvedProductionFamilyTruth.latestAttemptJobId,
      lineageTrail: resolvedProductionFamilyTruth.lineageTrail,
      timelineNodes: resolvedProductionFamilyTruth.timelineNodes,
      nextFamilyAction: resolvedProductionFamilyTruth.nextFamilyAction,
      evidenceTargetJobId: resolvedProductionFamilyTruth.evidenceTargetJobId,
      evidenceReason: resolvedProductionFamilyTruth.evidenceReason,
      rankedEvidenceCandidates,
      suggestedPairLabel,
      suggestedPairPrimaryJobId: suggestedCompareSeedJobId,
      suggestedPairPartnerJobId: suggestedComparePair?.partnerId,
    };
  }, [resolvedProductionFamilyTruth, rankedEvidenceCandidates, suggestedPairLabel, suggestedCompareSeedJobId, suggestedComparePair]);

  const selectedJobAuthority = useMemo(() => {
    const baseJob = selectedJob ?? selectedFamilyRepresentativeJob;
    if (!baseJob) return undefined;
    const previewAuthority = resolveFamilyPreviewAuthority({
      approvedOutputJob,
      currentWinnerJob,
      selectedAttemptJob: supportingEvidenceJob,
    });
    const authoritativeOutput =
      previewAuthority.kind === 'approved_output'
        ? 'approved output'
        : previewAuthority.kind === 'current_winner'
          ? 'current winner'
          : previewAuthority.kind === 'selected_attempt'
            ? 'selected attempt'
            : 'none';
    const canonicalState = resolvedOperatorReviewState?.canonicalState ?? productionFamily?.familyState ?? baseJob.state;
    const lineageSummary = productionFamily
      ? `${productionFamily.familyLabel} • root ${productionFamily.lineageRootId}`
      : baseJob.retryOf || baseJob.lineageParentJobId
        ? `retry child of ${(baseJob.lineageParentJobId ?? baseJob.retryOf)}`
        : `lineage root ${lineageFamily.at(-1)?.id ?? baseJob.id}`;
    const retryEligible = Boolean(baseJob.bridgeJob.sceneId && baseJob.bridgeJob.payload?.prompt && baseJob.bridgeJob.payload?.routeContext?.activeRoute && baseJob.bridgeJob.payload?.routeContext?.strategy);
    const hasArtifact = Boolean(baseJob.previewImage || baseJob.previewMedia || (baseJob.resultPaths && baseJob.resultPaths.length > 0));

    const nextAction = resolveSelectedJobNextAction({
      canonicalState,
      approvalStatus: resolvedOperatorReviewState?.approvalStatus,
      actionState: resolvedOperatorReviewState?.actionState,
      retryEligible,
      isBestKnown: resolvedOperatorReviewState?.bestKnownJobId === baseJob.id,
      isApprovedOrFinalized: resolvedOperatorReviewState?.actionState === 'finalized' || resolvedOperatorReviewState?.approvalStatus === 'approved' || resolvedOperatorReviewState?.actionState === 'approved',
      hasArtifact,
    });
    const lastMeaningfulChange = (lineageFamily[0]?.state ?? baseJob.state) === 'failed'
      ? `Failed at ${(lineageFamily[0] ?? baseJob).failedStage ?? 'running'}${(lineageFamily[0] ?? baseJob).error ? ` • ${(lineageFamily[0] ?? baseJob).error}` : ''}`
      : selectedJobReview?.actionAudit?.finalizedAt
        ? `Finalized • ${new Date(selectedJobReview.actionAudit.finalizedAt).toLocaleString()}`
        : selectedJobReview?.actionAudit?.approvedAt
          ? `Approved • ${new Date(selectedJobReview.actionAudit.approvedAt).toLocaleString()}`
          : `Lifecycle ${baseJob.state}`;
    return {
      canonicalState,
      authoritativeOutput,
      previewAuthority: {
        kind: previewAuthority.kind,
        role: previewAuthority.role,
        jobId: previewAuthority.job?.id,
        label:
          previewAuthority.kind === 'approved_output'
            ? `approved output${previewAuthority.job ? ` • ${previewAuthority.job.id}` : ''}`
            : previewAuthority.kind === 'current_winner'
              ? `current winner${previewAuthority.job ? ` • ${previewAuthority.job.id}` : ''}`
              : previewAuthority.kind === 'latest_attempt'
                ? `latest attempt${previewAuthority.job ? ` • ${previewAuthority.job.id}` : ''}`
                : previewAuthority.kind === 'selected_attempt'
                  ? `selected attempt${previewAuthority.job ? ` • ${previewAuthority.job.id}` : ''}`
                  : 'none',
      },
      lineageSummary,
      nextAction,
      lastMeaningfulChange,
      currentWinnerJobId: currentWinnerJob?.id,
      approvedOutputJobId: approvedOutputJob?.id,
      replacementJobId: replacementJob?.id,
      selectedJobId: baseJob.id,
      selectedOutputPath: selectedOutputPath ?? artifactFocus.outputPath ?? getDefaultOutputPath(baseJob),
    };
  }, [selectedJob, selectedFamilyRepresentativeJob, resolvedOperatorReviewState, currentWinnerJob, approvedOutputJob, supportingEvidenceJob, replacementJob, selectedOutputPath, artifactFocus.outputPath, lineageFamily, productionFamily]);

  const timelineActiveShot = useMemo(() => resolveShotAtTime(timelineState.playheadPositionMs, timelineState), [timelineState.playheadPositionMs, timelineState]);

  const shotAuthorityMap = useMemo(() => {
    const map: Record<string, { isApproved: boolean; isWinner: boolean }> = {};
    shotQueueSummary.forEach(shot => {
      const projection = shotProjectionByShotId.get(shot.id);
      map[shot.id] = {
        isApproved: projection?.approvalStatus === 'approved',
        isWinner: !!projection?.bestKnownOutputSelection?.selectedJobId && projection?.approvalStatus !== 'approved'
      };
    });
    return map;
  }, [shotQueueSummary, shotProjectionByShotId]);

  const selectedOverrideClipId = useMemo(() => {
    if (!timelineActiveShot || !selectedJobId) return undefined;
    const selectedJob = renderJobs.find(j => j.id === selectedJobId);
    // Selected override is shot-local and playhead-local:
    // Only show if the selected job belongs to the clip currently under the playhead.
    if (selectedJob && (selectedJob.shotId === timelineActiveShot.sceneId || selectedJob.sceneId === timelineActiveShot.sceneId)) {
      return timelineActiveShot.id;
    }
    return undefined;
  }, [timelineActiveShot, selectedJobId, renderJobs]);

  const resolvedPreviewContext = useMemo<ResolvedPreviewContext>(() => {
    // Phase 3: Director Mode - Favor timeline authority if active shot exists
    const timelineResolution = timelineActiveShot ? resolveAuthority(timelineActiveShot.sceneId, runtimeJobs, selectedJobId) : null;

    // Phase 3 Correction: Shot Boundary & Gap Handling
    // If we are in a gap (no active shot), return a blackout/none authority.
    // This prevents "leaking" the global inspector selection into temporal gaps.
    const authority: FamilyPreviewAuthorityResolution = timelineActiveShot
      ? (timelineResolution ?? { kind: 'none', job: undefined, role: 'historical_artifact' })
      : { kind: 'none', job: undefined, role: 'historical_artifact' };

    const currentOutputJob = timelineResolution?.job ?? selectedFamilyJobs[0] ?? selectedJob ?? selectedFamilyRepresentativeJob;
    const selectedOutputJob = selectedJob ?? supportingEvidenceJob ?? currentWinnerJob ?? approvedOutputJob ?? currentOutputJob;
    const deliverableReadyJob =
      resolvedOperatorReviewState?.actionState === 'finalized' || resolvedOperatorReviewState?.approvalStatus === 'approved'
        ? approvedOutputJob ?? currentWinnerJob ?? selectedOutputJob
        : undefined;

    const authorityPath = authority.job ? (selectedOutputByJob[authority.job.id] ?? getDefaultOutputPath(authority.job)) : undefined;
    const selectedPath = selectedOutputJob ? (artifactFocus.jobId === selectedOutputJob.id && artifactFocus.outputPath ? artifactFocus.outputPath : selectedOutputByJob[selectedOutputJob.id] ?? getDefaultOutputPath(selectedOutputJob)) : undefined;

    return {
      currentOutput: {
        jobId: currentOutputJob?.id,
        path: currentOutputJob ? (selectedOutputByJob[currentOutputJob.id] ?? getDefaultOutputPath(currentOutputJob)) : undefined,
        kind: currentOutputJob ? ('current_output' as const) : ('none' as const),
        isAuthority: authority.job?.id === currentOutputJob?.id,
      },
      selectedOutput: {
        jobId: selectedOutputJob?.id,
        path: selectedPath,
        kind: selectedOutputJob ? ('selected_output' as const) : ('none' as const),
        isAuthority: authority.job?.id === selectedOutputJob?.id,
      },
      approvedOutput: {
        jobId: approvedOutputJob?.id,
        path: approvedOutputJob ? (selectedOutputByJob[approvedOutputJob.id] ?? getDefaultOutputPath(approvedOutputJob)) : undefined,
        kind: approvedOutputJob ? ('approved_output' as const) : ('none' as const),
        isAuthority: authority.kind === 'approved_output',
      },
      deliverableReadyOutput: {
        jobId: deliverableReadyJob?.id,
        path: deliverableReadyJob ? (selectedOutputByJob[deliverableReadyJob.id] ?? getDefaultOutputPath(deliverableReadyJob)) : authorityPath,
        kind: deliverableReadyJob ? ('deliverable_ready_output' as const) : ('none' as const),
        isAuthority: Boolean(deliverableReadyJob && authority.job?.id === deliverableReadyJob.id),
      },
      authorityKind: authority.kind,
      authorityJobId: authority.job?.id,
      focusMode: artifactFocus.outputPath ? ('selected' as const) : ('current' as const),
      isAuthority: Boolean(authority.job),
    };
  }, [timelineActiveShot, runtimeJobs, selectedJobId, selectedFamilyJobs, selectedJob, selectedFamilyRepresentativeJob, supportingEvidenceJob, currentWinnerJob, approvedOutputJob, resolvedOperatorReviewState, selectedOutputByJob, artifactFocus.jobId, artifactFocus.outputPath, lineageFamily]);

  const selectedFeedbackSummary = useMemo<SelectedFeedbackSummary | undefined>(() => {
    const authorityLabel = selectedJobAuthority?.previewAuthority.label
      ?? (resolvedPreviewContext.authorityKind === 'approved_output'
        ? 'approved output'
        : resolvedPreviewContext.authorityKind === 'current_winner'
          ? 'current winner'
          : resolvedPreviewContext.authorityKind === 'selected_attempt'
            ? 'selected attempt'
            : 'no authority');

    const focusLabel = artifactFocus.outputPath
      ? `output focus • ${selectedJob ? 'job retained' : 'family context'}`
      : selectedJob
        ? 'job focus'
        : productionFamily
          ? 'family focus'
          : 'scene focus';

    if (selectedJob) {
      return {
        status: selectedJobAuthority?.canonicalState ?? selectedJob.state,
        reason:
          selectedJobReview?.explanations.summary
          ?? selectedJobAuthority?.lastMeaningfulChange
          ?? (selectedJob.state === 'failed' ? selectedJob.error ?? 'Failed run requires review.' : `Lifecycle ${selectedJob.state}`),
        nextStep: selectedJobAuthority?.nextAction.primaryActionLabel
          ?? (selectedJob.state === 'failed'
            ? 'Retry latest attempt.'
            : selectedJob.state === 'completed'
              ? 'Review current output.'
              : ['queued', 'preflight', 'running', 'packaging'].includes(selectedJob.state)
                ? 'Monitor active execution.'
                : 'Inspect selected job.'),
        authorityLabel,
        focusLabel,
      };
    }

    if (productionFamily) {
      return {
        status: productionFamily.familyState,
        reason: productionFamily.evidenceReason ?? `Lineage root ${productionFamily.lineageRootId}`,
        nextStep: productionFamily.nextFamilyAction,
        authorityLabel,
        focusLabel,
      };
    }

    return undefined;
  }, [selectedJob, selectedJobAuthority, selectedJobReview, resolvedPreviewContext, artifactFocus.outputPath, productionFamily]);



  const deliveryRegistryItems = useMemo<import('./review/types').DeliveryRegistryItem[]>(() => {
    const projections = getReviewRuntimeSnapshot().shotProjections;
    return projections
      .filter((p) => p.actionState?.current === 'finalized' && p.actionState.finalJobId)
      .map((p) => {
        const shot = shotQueueSummary.find((s) => s.id === p.shotId);
        const job = renderJobs.find((j) => j.id === p.actionState?.finalJobId);
        const actor = p.actionState?.approvedBy || 'System';
        const timestamp = p.actionState?.finalizedAt ? new Date(p.actionState.finalizedAt).toLocaleString() : 'Recent';
        const path = job ? (selectedOutputByJob[job.id] ?? getDefaultOutputPath(job)) : '';

        return {
          id: p.actionState?.finalJobId || '',
          shotId: p.shotId,
          label: shot?.title || p.shotId,
          specs: job ? `${job.bridgeJob.payload.parameters.quality || 'Standard'} • ${job.engine}` : 'N/A',
          actor,
          timestamp,
          path,
        };
      });
  }, [renderJobs, shotQueueSummary, selectedOutputByJob]);

  const sequenceReadiness = useMemo<import('./review/types').SequenceReadiness>(() => {
    const finalizedIds = new Set(deliveryRegistryItems.map(item => item.shotId));
    const missingShots = shotQueueSummary
      .filter(shot => !finalizedIds.has(shot.id))
      .map(shot => ({ id: shot.id, title: shot.title }));

    return {
      totalCount: shotQueueSummary.length,
      finalizedCount: deliveryRegistryItems.length,
      isReady: shotQueueSummary.length > 0 && missingShots.length === 0,
      missingShots,
    };
  }, [deliveryRegistryItems, shotQueueSummary]);

  // Phase 4 Vector E: derive current scene's seal entry
  const activeSequenceSealEntry = selectedScene ? sequenceSealState[selectedScene.id] : undefined;

  const handleSealSequence = useCallback(() => {
    if (!selectedScene) return;
    if (!sequenceReadiness.isReady || sequenceSealState[selectedScene.id]) return;
    // Resolve operator label: prefer presenceState op_alpha name, fall back to 'operator'
    const selfOperator = presenceState.activeOperators.find(op => op.id === 'op_alpha');
    const operatorLabel = selfOperator?.name ?? 'operator';
    setSequenceSealState(prev => ({
      ...prev,
      [selectedScene.id]: {
        sealedAt: Date.now(),
        sealedByLabel: operatorLabel,
        sealedShotCount: sequenceReadiness.totalCount,
      },
    }));
  }, [selectedScene, sequenceReadiness.isReady, sequenceReadiness.totalCount, sequenceSealState, presenceState.activeOperators]);

  const shotReviewById = useMemo(() => {
    const summary = Object.fromEntries(shotQueueSummary.map((shot) => {
      const projection = shotProjectionByShotId.get(shot.id);
      const risk = projection?.measuredSignals
        ? (projection.measuredSignals.artifactSeverity * 0.5 + (1 - projection.measuredSignals.motionStability) * 0.3 + (1 - projection.measuredSignals.continuityMatch) * 0.2)
        : 0;
      const riskLevel: 'low' | 'medium' | 'high' = risk >= 0.66 ? 'high' : risk >= 0.33 ? 'medium' : 'low';
      return [shot.id, {
        reviewStatus: projection?.reviewStatus,
        approvalStatus: projection?.approvalStatus,
        actionState: projection?.actionState?.current,
        bestKnownJobId: projection?.bestKnownOutputSelection?.selectedJobId,
        approvedJobId: projection?.bestKnownOutputSelection?.selectedJobId && projection?.approvalStatus === 'approved' ? projection.bestKnownOutputSelection.selectedJobId : undefined,
        supersededByJobId: projection?.bestKnownOutputSelection?.selectedJobId && projection?.approvalStatus === 'approved' && resolvedProductionFamilyTruth?.approvedOutputJobId === projection.bestKnownOutputSelection.selectedJobId ? resolvedProductionFamilyTruth.replacementJobId : undefined,
        riskLevel,
        reason: projection?.explanations?.summary,
      }];
    }));
    
    return summary;
  }, [shotQueueSummary, resolvedProductionFamilyTruth, lastStreamEventAt]);

  const deliveryManifest = useMemo(() => {
    if (!activeSequenceSealEntry) return null;
    return buildDeliveryManifest(
      selectedScene,
      activeSequenceSealEntry,
      deliveryRegistryItems,
      sequenceReadiness,
      shotQueueSummary
    );
  }, [selectedScene, activeSequenceSealEntry, deliveryRegistryItems, sequenceReadiness, shotQueueSummary]);

  const retryContext = useMemo(() => {
    if (!selectedJob) return undefined;
    return {
      source: 'historical job',
      jobId: selectedJob.id,
      sceneId: selectedJob.bridgeJob.sceneId,
      mode: selectedJob.bridgeJob.outputType === 'video' ? 'cinematic' : 'studio_run',
      activeRoute: selectedJob.bridgeJob.payload.routeContext.activeRoute,
      strategy: selectedJob.bridgeJob.payload.routeContext.strategy,
      originalCommand: `${selectedJob.bridgeJob.engine}:${selectedJob.bridgeJob.jobType}`,
      manifestPath: selectedJob.manifestPath ?? `STUDIO_PIPELINE/outputs/${selectedJob.id}/render_metadata.json`,
      retryOf: selectedJob.retryOf,
      retryDepth: selectedJob.retryDepth ?? 0,
      retrySource: selectedJob.retrySource,
    };
  }, [selectedJob]);

  const canRetrySelectedJob = useMemo(() => {
    if (!selectedJob || isRendering || selectedJob.state !== 'failed') return false;
    return Boolean(selectedJob.bridgeJob.sceneId && selectedJob.bridgeJob.payload?.prompt && selectedJob.bridgeJob.payload?.routeContext?.activeRoute && selectedJob.bridgeJob.payload?.routeContext?.strategy);
  }, [selectedJob, isRendering]);

  const commandTemplates = useMemo(() => [
    'retry',
    'cancel',
    'reconcile',
    'open manifest',
    'open artifact',
  ], []);

  // Copy guard: preserve canonical terminal action labels from src/runtime/sync.ts when editing operator-facing labels.
  const parseCommandIntent = (raw: string) => {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return { intent: 'none' as const };
    if (normalized.startsWith('retry')) return { intent: 'retry' as const };
    if (normalized.startsWith('cancel')) return { intent: 'cancel' as const };
    if (normalized.startsWith('reconcile')) return { intent: 'reconcile' as const };
    if (normalized.startsWith('open manifest') || normalized === 'manifest' || normalized === 'open metadata') return { intent: 'open_manifest' as const };
    if (normalized.startsWith('open artifact') || normalized.startsWith('open output') || normalized === 'artifact') return { intent: 'open_artifact' as const };
    return { intent: 'unknown' as const };
  };

  const openPath = (path?: string) => {
    if (!path) return;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    window.open(`file:///${path.replace(/\\/g, '/')}`, '_blank');
  };

  const isTelemetryPhase1Enabled = () => {
    try {
      return window.localStorage.getItem('telemetry.instrumentation.phase1.enabled') === 'true';
    } catch {
      return false;
    }
  };

  const telemetryEventStore = {
    append: async (event: DirectorOSEventEnvelope) => {
      try {
        const key = 'directoros.telemetry.eventlog.v1';
        const raw = window.localStorage.getItem(key);
        const parsed = raw ? (JSON.parse(raw) as DirectorOSEventEnvelope[]) : [];
        const next = [...parsed, event].slice(-1000);
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // best-effort only
      }
    },
  };

  const telemetryEvents = useMemo<TelemetryEnvelope[]>(() => {
    try {
      const raw = window.localStorage.getItem('directoros.telemetry.eventlog.v1');
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed as TelemetryEnvelope[];
    } catch {
      return [];
    }
  }, [interventionVersion, lastStreamEventAt]);

  const executeConsoleCommand = async (raw: string, dryRun = false) => {
    const parsed = parseCommandIntent(raw);
    if (parsed.intent === 'none') {
      setCommandValidationPreview('No command entered.');
      setCommandTrustImpactPreview('No authority writes.');
      return;
    }

    if (parsed.intent === 'unknown') {
      setCommandValidationPreview(`Unsupported command: ${raw}. Supported: retry, cancel, reconcile, open manifest, open artifact.`);
      setCommandTrustImpactPreview('Blocked by command policy.');
      return;
    }

    if (dryRun) {
      if (parsed.intent === 'retry') {
        setCommandValidationPreview(canRetrySelectedJob ? 'Retry eligible for selected failed job.' : 'Retry blocked: select a failed job with complete historical metadata.');
        setCommandTrustImpactPreview(canRetrySelectedJob ? 'Will enqueue a lineage-safe retry job and append durable events.' : 'No state mutation.');
        return;
      }
      if (parsed.intent === 'cancel') {
        const canCancel = Boolean(selectedJob && ['queued', 'preflight', 'running', 'packaging'].includes(selectedJob.state));
        setCommandValidationPreview(canCancel ? 'Cancel eligible for selected active/queued job.' : 'Cancel blocked: selected job is not cancellable.');
        setCommandTrustImpactPreview(canCancel ? 'Will append cancellation event and update durable manifest state.' : 'No state mutation.');
        return;
      }
      if (parsed.intent === 'reconcile') {
        setCommandValidationPreview('Reconcile eligible.');
        setCommandTrustImpactPreview('Will re-derive durable authority state from persisted jobs and provider truth.');
        return;
      }
      if (parsed.intent === 'open_manifest') {
        setCommandValidationPreview(selectedJob ? 'Manifest open path resolved.' : 'Open manifest blocked: no selected job.');
        setCommandTrustImpactPreview('Read-only action.');
        return;
      }
      if (parsed.intent === 'open_artifact') {
        setCommandValidationPreview(selectedOutputPath ? 'Artifact open path resolved.' : 'Open artifact blocked: selected job has no output path.');
        setCommandTrustImpactPreview('Read-only action.');
      }
      return;
    }

    const telemetryEnabled = isTelemetryPhase1Enabled();
    const telemetryStart = Date.now();
    const commandId = `cmd_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const traceSeed: EventTrace | undefined = telemetryEnabled ? newTrace(commandId) : undefined;

    const emitCommandTelemetry = async (
      eventName: 'command.execution.requested' | 'command.execution.started' | 'command.execution.completed',
      status: string,
      code: string,
      message: string
    ) => {
      if (!telemetryEnabled || !traceSeed) return;
      try {
        const ctx: EmitContext = {
          producer: { service: 'directoros-app', module: 'm8_operator', instance_id: 'web-main' },
          actor: { type: 'operator', id: 'operator.ui', session_id: 'web-session', lane: 'lane_1' },
          trace: { ...traceSeed },
          subject: { type: 'command', id: commandId, engine: 'operator-console', target: parsed.intent },
          sequence: { stream: makeStream('command', commandId), index: eventName === 'command.execution.requested' ? 1 : eventName === 'command.execution.started' ? 2 : 3 },
        };

        await emitEvent(telemetryEventStore, ctx, {
          event_name: eventName,
          outcome: { status, code, message },
          metrics: eventName === 'command.execution.completed' ? { latency_ms: Date.now() - telemetryStart, queue_ms: 0 } : { latency_ms: null, queue_ms: 0 },
          data: { intent: parsed.intent, dry_run: false, raw_command: raw },
        });
      } catch {
        // best-effort only
      }
    };

    await emitCommandTelemetry('command.execution.requested', 'requested', 'OK', 'Command accepted');
    await emitCommandTelemetry('command.execution.started', 'started', 'OK', 'Command execution started');

    if (parsed.intent === 'retry') {
      if (!selectedJob || !canRetrySelectedJob) {
        setCommandValidationPreview('Retry blocked: selected job is not retry-eligible.');
        setCommandTrustImpactPreview('No authority mutation.');
        await emitCommandTelemetry('command.execution.completed', 'failed', 'BLOCKED', 'Retry blocked: selected job is not retry-eligible');
        return;
      }
      setIsRendering(true);
      try {
        await runRenderPipelineFromBridgeJob(selectedJob, {
          onQueueUpdate: (job) => {
            const jobs = listRenderJobs();
            const counts = getRenderJobCounts();
            setRuntimeJobCounts(counts);
            setJobCounts(counts);
            setRuntimeJobs(() => jobs);
            setRenderJobs(() => jobs);
            if (job.state === 'completed') {
              const defaultOutput = getDefaultOutputPath(job);
              if (defaultOutput) {
                setSelectedOutputByJob((prev) => ({ ...prev, [job.id]: prev[job.id] ?? defaultOutput }));
              }
              if (!pinnedJobId) {
                setSelectedJobId(job.id);
                if (defaultOutput) focusJobOutput(job, defaultOutput);
              }
            }
          },
          onPreviewUpdate: (state) => {
            setPreviewState(state);
            syncLivePreviewFromRenderState(state, selectedJob, activeShot?.id ?? null);
          },
        });
        setCommandValidationPreview('Retry command executed.');
        setCommandTrustImpactPreview('Lineage-safe retry enqueued with durable event updates.');
        await emitCommandTelemetry('command.execution.completed', 'success', 'OK', 'Retry command executed');
      } catch (error) {
        await emitCommandTelemetry('command.execution.completed', 'failed', 'ERR_EXEC', 'Retry command failed');
        throw error;
      } finally {
        setIsRendering(false);
      }
      setLastExecutedCommand(raw);
      return;
    }

    if (parsed.intent === 'cancel') {
      if (!selectedJob || !['queued', 'preflight', 'running', 'packaging'].includes(selectedJob.state)) {
        setCommandValidationPreview('Cancel blocked: selected job not in cancellable state.');
        setCommandTrustImpactPreview('No authority mutation.');
        await emitCommandTelemetry('command.execution.completed', 'failed', 'BLOCKED', 'Cancel blocked: selected job not in cancellable state');
        return;
      }
      const cancelResult = await queueActions.cancelJob(selectedJob.id);
      await refreshRuntimeSurfaces();
      setCommandValidationPreview(cancelResult?.message ?? `Cancel requested for ${selectedJob.id}.`);
      setCommandTrustImpactPreview(cancelResult?.supported ? 'Runtime cancellation path executed.' : 'Runtime bridge recorded a local cancellation request without claiming remote stop.');
      await emitCommandTelemetry('command.execution.completed', 'success', 'OK', 'Cancel command executed');
      setLastExecutedCommand(raw);
      return;
    }

    if (parsed.intent === 'reconcile') {
      await reconcileDurableRenderAuthority();
      await refreshRuntimeSurfaces();
      setCommandValidationPreview('Reconcile completed.');
      setCommandTrustImpactPreview('Durable authority reconciled against provider and local manifests.');
      await emitCommandTelemetry('command.execution.completed', 'success', 'OK', 'Reconcile command executed');
      setLastExecutedCommand(raw);
      return;
    }

    if (parsed.intent === 'open_manifest') {
      if (!selectedJob) {
        setCommandValidationPreview('Open manifest blocked: no selected job.');
        setCommandTrustImpactPreview('No action.');
        await emitCommandTelemetry('command.execution.completed', 'failed', 'BLOCKED', 'Open manifest blocked: no selected job');
        return;
      }
      openPath(selectedJob.manifestPath ?? `STUDIO_PIPELINE/outputs/${selectedJob.id}/render_metadata.json`);
      setCommandValidationPreview('Manifest opened.');
      setCommandTrustImpactPreview('Read-only action executed.');
      await emitCommandTelemetry('command.execution.completed', 'success', 'OK', 'Open manifest command executed');
      setLastExecutedCommand(raw);
      return;
    }

    if (parsed.intent === 'open_artifact') {
      if (!selectedOutputPath) {
        setCommandValidationPreview('Open artifact blocked: no resolved output path.');
        setCommandTrustImpactPreview('No action.');
        await emitCommandTelemetry('command.execution.completed', 'failed', 'BLOCKED', 'Open artifact blocked: no resolved output path');
        return;
      }
      openPath(selectedOutputPath);
      setCommandValidationPreview('Artifact opened.');
      setCommandTrustImpactPreview('Read-only action executed.');
      await emitCommandTelemetry('command.execution.completed', 'success', 'OK', 'Open artifact command executed');
      setLastExecutedCommand(raw);
    }
  };

  useEffect(() => {
    const stopReviewRuntime = startReviewRuntime();
    return () => {
      stopReviewRuntime();
    };
  }, []);

  useEffect(() => {
    // Temporary isolation test: re-enabling reconciliation (Step 1) and refresh (Step 2)
    void reconcileDurableRenderAuthority();
    void refreshRuntimeSurfaces();
  }, []);

  useEffect(() => {
    const BASE_DELAY = 5000;
    const DEGRADED_DELAY = 8000;
    const OFFLINE_BASE_DELAY = 10000;
    const OFFLINE_MAX_DELAY = 60000;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;
    let isDestroyed = false;

    const scheduleNext = (currentState: 'connected' | 'degraded' | 'offline', failures: number) => {
      if (isDestroyed) return;
      let delay: number;
      if (currentState === 'connected') {
        delay = BASE_DELAY;
      } else if (currentState === 'degraded') {
        delay = DEGRADED_DELAY;
      } else {
        delay = Math.min(OFFLINE_BASE_DELAY * Math.pow(2, failures - 1), OFFLINE_MAX_DELAY);
      }
      timeoutId = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (isDestroyed) return;
      try {
        const health = await runtimeApi.health();
        
        // --- Phase 3 Contract Fix: Handle missing bridge_status at top level ---
        const isBridgeOk = health.bridge_status === 'ok' || health.dependency_status?.bridge === 'ok';
        if (health.ok && !health.bridge_status && health.dependency_status?.bridge) {
           console.warn('[directoros.contract] API Drift Detected: "bridge_status" missing from top-level health response. Using "dependency_status.bridge" fallback.');
        }

        const nextState = (health.ok && isBridgeOk) ? 'connected' : 'degraded';
        
        if (consecutiveFailures > 0) {
          console.info('[runtime] Bridge reconnected. Restoring normal polling cadence.');
        }
        consecutiveFailures = 0;

        // 1. Update state purely
        setStreamState(nextState);

        // 2. Trigger side-effects - Allow sync in DEGRADED to prevent zombie UI
        // We only skip sync in 'offline' mode.
        if (nextState === 'connected' || nextState === 'degraded') {
          // Temporary isolation test: disabled polling
          // await refreshRuntimeSurfaces();
          // await reconcileDurableRenderAuthority();
        }

        scheduleNext(nextState, 0);
      } catch (err: any) {
        if (isDestroyed) return;
        const nextState: 'offline' | 'degraded' = err.isConnectionError ? 'offline' : 'degraded';
        consecutiveFailures++;
        if (consecutiveFailures === 1) {
          console.warn('[runtime] Bridge unreachable — entering offline mode. Backoff active.');
        }
        setStreamState(nextState);
        scheduleNext(nextState, consecutiveFailures);
      }
    };

    // Initial check
    void tick();

    const onOffline = () => {
      setStreamState('offline');
    };

    const onOnline = () => {
      // Cancel any pending timeout before scheduling an immediate tick
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setStreamState('degraded');
      void reconcileDurableRenderAuthority();
      // Schedule an immediate tick to confirm connectivity
      timeoutId = setTimeout(tick, 0);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      isDestroyed = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);


  const selectedShotNodeId = useMemo(() => {
    // 1. directly selected job shotId
    if (selectedJob?.shotId) return selectedJob.shotId;

    // 2. family representativeJobId -> resolved shotId
    if (selectedFamilyRepresentativeJob?.shotId) return selectedFamilyRepresentativeJob.shotId;

    // 3. latest valid family job -> resolved shotId
    const latestFamilyShotId = selectedFamilyJobs.find(j => j.shotId)?.shotId;
    if (latestFamilyShotId) return latestFamilyShotId;

    // 4. fallback: selectedGraphNodeId (only if no external selection context at all)
    if (!selectedJobId && !selectedFamilyRootId) {
      return selectedGraph?.nodes.find((node) => node.type === 'shot' && node.id === selectedGraphNodeId)?.id;
    }

    return undefined;
  }, [selectedJob, selectedFamilyRepresentativeJob, selectedFamilyJobs, selectedGraph, selectedGraphNodeId, selectedJobId, selectedFamilyRootId]);

  const postPipelineSummary = useMemo(() => {
    if (!selectedGraph) return undefined;
    const postNodes = selectedGraph.nodes.filter((node) => ['review_node', 'edit_node', 'export_node', 'delivery_node'].includes(node.type));
    if (!postNodes.length) return undefined;

    const workflowState = postWorkflow ?? createPostWorkflowFromRender(previewState.mode);
    const stageStates: PostPipelineStageState[] = [
      { stage: 'review', label: 'Review', status: workflowState.review },
      { stage: 'edit', label: 'Edit', status: workflowState.edit },
      { stage: 'export', label: 'Export', status: workflowState.export },
      { stage: 'delivery', label: 'Delivery', status: workflowState.delivery },
    ];

    const exportNode = postNodes.find((node) => node.type === 'export_node');
    const deliveryNode = postNodes.find((node) => node.type === 'delivery_node');
    const blockedStage = stageStates.find((item) => item.status === 'blocked' || item.status === 'failed')?.label;
    const overallStatus = stageStates.every((item) => item.status === 'completed')
      ? 'pipeline complete'
      : blockedStage
        ? `${blockedStage.toLowerCase()} blocked`
        : stageStates.find((item) => item.status === 'active')
          ? `${stageStates.find((item) => item.status === 'active')?.label} active`
          : 'waiting';

    return {
      stages: stageStates,
      activeStage: stageStates.find((item) => item.status === 'active')?.label,
      completedCount: stageStates.filter((item) => ['approved', 'ready', 'completed'].includes(item.status)).length,
      blockedStage,
      overallStatus,
      exportFormat: exportNode?.export_format,
      resolution: exportNode?.resolution,
      codec: exportNode?.codec,
      deliveryTarget: deliveryNode?.delivery_target,
    };
  }, [selectedGraph, postWorkflow, previewState.mode]);

  const sceneOverrides = useMemo(() => (selectedScene ? inspectorOverrides[selectedScene.id] ?? {} : {}), [selectedScene, inspectorOverrides]);

  const renderStateByPreview: Record<RenderPreviewState['mode'], RenderState> = {
    idle: 'ready',
    queued: 'queued',
    rendering: 'rendering',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'failed',
  };

  const upsertSceneGraph = (sceneId: string, graph: SceneGraphState) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId && scene.type === 'scene'
          ? { ...scene, graph: { nodes: graph.nodes, connections: graph.connections, layout: graph.layout } }
          : scene
      )
    );
  };

  const applyGraphEdit = (sceneId: string, updater: (graph: SceneGraphState) => SceneGraphState, trackHistory = true) => {
    setGraphStates((prev) => {
      const current = prev[sceneId] ?? createGraphFromTemplate(sceneId, scenes.find((s) => s.id === sceneId)?.name ?? 'Scene');
      const next = updater(current);
      if (trackHistory) {
        setGraphHistory((history) => {
          const currentHistory = history[sceneId] ?? { undo: [], redo: [] };
          return {
            ...history,
            [sceneId]: {
              undo: [...currentHistory.undo, current],
              redo: [],
            },
          };
        });
      }
      upsertSceneGraph(sceneId, next);
      return { ...prev, [sceneId]: next };
    });
  };

  const commitDragHistory = (sceneId: string, nodeId: string, startX: number, startY: number) => {
    setGraphHistory((history) => {
      const currentHistory = history[sceneId] ?? { undo: [], redo: [] };
      const currentGraph = graphStates[sceneId] ?? createGraphFromTemplate(sceneId, scenes.find((s) => s.id === sceneId)?.name ?? 'Scene');
      const beforeDrag: SceneGraphState = {
        ...currentGraph,
        nodes: currentGraph.nodes.map((node) => (node.id === nodeId ? { ...node, position: { x: startX, y: startY } } : node)),
      };
      return {
        ...history,
        [sceneId]: {
          undo: [...currentHistory.undo, beforeDrag],
          redo: [],
        },
      };
    });
  };

  const resetGraphToTemplateBaseline = (sceneId: string, sceneName: string) => {
    const currentGraph = graphStates[sceneId] ?? createGraphFromTemplate(sceneId, sceneName);
    const baseline = createGraphFromTemplate(sceneId, sceneName, currentGraph.templateId);
    const baselineNodeIds = new Set(baseline.nodes.map((node) => node.id));

    const preservedUserNodes = currentGraph.nodes.filter((node) => !baselineNodeIds.has(node.id));
    const mergedNodes = [...baseline.nodes, ...preservedUserNodes];
    const mergedNodeIds = new Set(mergedNodes.map((node) => node.id));
    const baselinePairs = new Set(baseline.connections.map((connection) => `${connection.from}->${connection.to}`));

    const preservedConnections = currentGraph.connections.filter((connection) => {
      const key = `${connection.from}->${connection.to}`;
      return mergedNodeIds.has(connection.from) && mergedNodeIds.has(connection.to) && !baselinePairs.has(key);
    });

    applyGraphEdit(sceneId, () => ({
      ...currentGraph,
      ...baseline,
      nodes: mergedNodes,
      connections: [...baseline.connections, ...preservedConnections],
      layout: baseline.layout,
    }));
  };

  // Layer 1: Static Graph Memo (Structure + Profiles)
  const staticGraph = useMemo<SceneGraphState | undefined>(() => {
    if (!selectedScene || !selectedGraph) return selectedGraph;

    const routeState = createRouteState(appState.engineTarget === 'auto' ? selectedGraph.defaultEngineTarget : appState.engineTarget);

    const nextNodes = selectedGraph.nodes.map((node) => {
      const boundProfileId = selectedScene.memoryBindings?.[node.type as keyof typeof selectedScene.memoryBindings];
      const profile = boundProfileId ? memoryProfilesById[boundProfileId] : undefined;
      const base = {
        ...node,
        profileId: profile?.id,
        profileName: profile?.name,
        sourceType: profile?.sourceType ?? node.sourceType,
      };

      if (node.type === 'engine_router') {
        return {
          ...base,
          routeMode: routeState.mode,
          routeStrategy: routeState.strategy,
          routeState,
          isActive: true,
        };
      }

      if (node.type === 'engine_target') {
        const target = node.engineTarget;
        const activeRoute = Boolean(target && routeState.activeTargets.includes(target as (typeof routeState.activeTargets)[number]));
        return {
          ...base,
          activeRoute,
          isActive: activeRoute,
          routeMode: routeState.mode,
          routeStrategy: routeState.strategy,
          routeSource: 'engine_router',
        };
      }

      if (node.type === 'render_output') {
        return {
          ...base,
          engineTarget: routeState.primaryEngine,
          routeMode: routeState.mode,
          routeStrategy: routeState.strategy,
        };
      }

      return base;
    });

    return { ...selectedGraph, nodes: nextNodes };
  }, [selectedScene, selectedGraph, appState.engineTarget, memoryProfilesById]);

  // Layer 2: Runtime Overlay (Lightweight Injection)
  const graphForCompile = useMemo<SceneGraphState | undefined>(() => {
    const _t0 = performance.now();
    if (!staticGraph || !selectedScene) return staticGraph;

    const phaseByProgress =
      previewState.mode === 'queued'
        ? 1
        : previewState.mode === 'rendering'
          ? previewState.progress < 18 ? 1 : previewState.progress < 38 ? 2 : previewState.progress < 78 ? 3 : 4
          : previewState.mode === 'completed' ? 5 : previewState.mode === 'failed' ? 4 : 0;

    const workflowState = postWorkflowByScene[selectedScene.id] ?? createPostWorkflowFromRender(previewState.mode);
    const postStages: PostPipelineStageState[] = [
      { stage: 'review', label: 'Review', status: workflowState.review },
      { stage: 'edit', label: 'Edit', status: workflowState.edit },
      { stage: 'export', label: 'Export', status: workflowState.export },
      { stage: 'delivery', label: 'Delivery', status: workflowState.delivery },
    ];

    // O(1) lookup maps
    const shotMap = new Map(shotQueueSummary.map(s => [s.id, s]));
    const _rpc = resolvedPreviewContext;

    const nextNodes = staticGraph.nodes.map((node) => {
      if (node.type === 'shot') {
        const shot = shotMap.get(node.id);
        const state = shot?.state ?? 'waiting';
        const runtimeState: PipelineActivityState =
          ['active', 'compiling', 'routed', 'rendering', 'review'].includes(state) ? 'active' :
          ['completed', 'skipped'].includes(state) ? 'completed' :
          state === 'failed' ? 'failed' : state === 'blocked' ? 'blocked' : 'waiting';

        return {
          ...node,
          shotOrder: shot?.order,
          shotRuntimeState: state,
          shotCurrentStage: shot?.stage,
          shotIsCurrent: shot?.isCurrent,
          runtimeState,
          runtimeLastAction: shot?.lastAction ?? 'Awaiting sequence trigger',
          runtimeNextStage: shot?.stage ?? 'queued',
          isActive: state !== 'waiting',
        };
      }

      if (node.type === 'compiler') {
        const runtimeState: PipelineActivityState =
          previewState.mode === 'failed' && phaseByProgress <= 1 ? 'failed' :
          phaseByProgress >= 2 || previewState.mode === 'completed' ? 'completed' :
          phaseByProgress >= 1 ? 'processing' : 'idle';

        return {
          ...node,
          compileState: (runtimeState === 'completed' ? 'compiled' : runtimeState === 'processing' ? 'pending' : 'stale') as 'compiled' | 'pending' | 'stale',
          runtimeState,
          runtimeProgress: phaseByProgress >= 2 ? 100 : phaseByProgress >= 1 ? 62 : 0,
          runtimeLastAction: runtimeState === 'completed' ? 'Compiled prompt package' : runtimeState === 'processing' ? 'Compiling active prompt' : 'Awaiting render trigger',
          runtimeNextStage: runtimeState === 'completed' ? 'Engine Router' : 'Prompt Compiler',
        };
      }

      if (node.type === 'engine_router') {
        const runtimeState: PipelineActivityState =
          previewState.mode === 'failed' && phaseByProgress <= 2 ? 'failed' :
          phaseByProgress >= 3 || previewState.mode === 'completed' ? 'completed' :
          phaseByProgress >= 2 ? 'active' : phaseByProgress >= 1 ? 'waiting' : 'idle';

        return {
          ...node,
          runtimeState,
          runtimeProgress: runtimeState === 'completed' ? 100 : runtimeState === 'active' ? 55 : runtimeState === 'waiting' ? 16 : 0,
          runtimeLastAction: runtimeState === 'completed' ? `Routed to ${(node.routeState?.primaryEngine ?? 'ENGINE').toUpperCase()}` : runtimeState === 'active' ? 'Resolving route preset' : 'Waiting for compiler',
          runtimeNextStage: runtimeState === 'completed' ? 'Engine Target' : 'Engine Router',
        };
      }

      if (node.type === 'engine_target') {
        const isPrimary = node.engineTarget === node.routeState?.primaryEngine;
        const runtimeState: PipelineActivityState = !node.activeRoute ? 'waiting' :
          previewState.mode === 'failed' && isPrimary ? 'failed' :
          previewState.mode === 'completed' && isPrimary ? 'completed' :
          phaseByProgress >= 3 && isPrimary ? 'processing' :
          phaseByProgress >= 2 && isPrimary ? 'active' : 'waiting';

        return {
          ...node,
          runtimeState,
          runtimeProgress: runtimeState === 'completed' ? 100 : runtimeState === 'processing' ? Math.max(12, previewState.progress) : runtimeState === 'active' ? 34 : 0,
          runtimeLastAction: runtimeState === 'completed' ? `${(node.engineTarget ?? 'engine').toUpperCase()} output ready` :
            runtimeState === 'processing' ? `${(node.engineTarget ?? 'engine').toUpperCase()} rendering` :
            runtimeState === 'active' ? `${(node.engineTarget ?? 'engine').toUpperCase()} branch engaged` : 'Standby branch',
          runtimeNextStage: runtimeState === 'completed' ? 'Render Output' : node.engineTarget?.toUpperCase(),
        };
      }

      if (node.type === 'render_output') {
        const runtimeState: PipelineActivityState =
          previewState.mode === 'failed' ? 'failed' : previewState.mode === 'completed' ? 'completed' :
          previewState.mode === 'rendering' ? 'processing' : previewState.mode === 'queued' ? 'waiting' : 'idle';

        const authorityLabel = _rpc?.approvedOutput.jobId ? 'approved output' : _rpc?.selectedOutput.jobId ? 'selected output' : _rpc?.currentOutput.jobId ? 'current output' : undefined;
        const authorityTone: SceneGraphNode['authorityTone'] = _rpc?.approvedOutput.jobId ? 'approved' : _rpc?.selectedOutput.jobId ? 'selected' : _rpc?.currentOutput.jobId ? 'current' : 'none';
        const readinessHintLabel: SceneGraphNode['readinessHintLabel'] = _rpc?.deliverableReadyOutput.jobId ? 'deliverable-ready' : undefined;

        return {
          ...node,
          renderState: renderStateByPreview[previewState.mode],
          outputHint: previewState.resultPaths?.[0] ?? previewState.label,
          runtimeState,
          runtimeProgress: previewState.mode === 'completed' ? 100 : previewState.progress,
          runtimeLastAction:
            previewState.mode === 'completed' ? `${activeShot?.title ?? 'Active shot'} → ${node.engineTarget?.toUpperCase() ?? 'ENGINE'} completed` :
            previewState.mode === 'failed' ? `${activeShot?.title ?? 'Active shot'} render failed` :
            previewState.mode === 'rendering' ? `${activeShot?.title ?? 'Active shot'} → ${node.engineTarget?.toUpperCase() ?? 'ENGINE'} rendering` : 'Awaiting engine target output',
          runtimeNextStage: previewState.mode === 'completed' ? 'Review' : 'Render Output',
          authorityLabel,
          authorityTone,
          authorityIsCanonical: _rpc ? (_rpc.authorityJobId === _rpc.deliverableReadyOutput.jobId || _rpc.authorityJobId === _rpc.approvedOutput.jobId || _rpc.authorityJobId === _rpc.selectedOutput.jobId) : false,
          readinessHintLabel,
          readinessHintTone: readinessHintLabel ? ('deliverable' as const) : ('none' as const),
        };
      }

      if (node.type in postNodeTypeToStage) {
        const stage = postNodeTypeToStage[node.type as keyof typeof postNodeTypeToStage];
        const state = postStages.find((item) => item.stage === stage);
        const runtimeState: PipelineActivityState =
          ['active'].includes(state?.status ?? '') ? 'active' :
          ['approved', 'completed', 'ready'].includes(state?.status ?? '') ? 'completed' :
          state?.status === 'failed' ? 'failed' : state?.status === 'blocked' ? 'blocked' : 'waiting';

        return {
          ...node,
          post_stage: stage,
          post_status: state?.status ?? 'pending',
          runtimeState,
          runtimeProgress: runtimeState === 'completed' ? 100 : runtimeState === 'active' ? 24 : 0,
          runtimeLastAction: runtimeState === 'active' ? `${state?.label ?? 'Stage'} active` : runtimeState === 'blocked' ? `${state?.label ?? 'Stage'} blocked by render failure` : `${state?.label ?? 'Stage'} pending`,
          runtimeNextStage: runtimeState === 'active' ? 'Editorial review actions' : state?.label,
          authorityLabel: _rpc?.approvedOutput.jobId ? 'approved output' : _rpc?.selectedOutput.jobId ? 'selected output' : undefined,
          authorityTone: (_rpc?.approvedOutput.jobId ? 'approved' : _rpc?.selectedOutput.jobId ? 'selected' : 'none') as 'approved' | 'selected' | 'none',
          authorityIsCanonical: Boolean(_rpc?.authorityJobId),
          readinessHintLabel: _rpc?.deliverableReadyOutput.jobId ? 'deliverable-ready' : undefined,
          readinessHintTone: _rpc?.deliverableReadyOutput.jobId ? ('deliverable' as const) : ('none' as const),
        };
      }

      return node;
    });

    const nodeMap = new Map(nextNodes.map(n => [n.id, n]));

    const nextConnections = staticGraph.connections.map((connection) => {
      const toNode = nodeMap.get(connection.to);
      const fromNode = nodeMap.get(connection.from);
      const activeRoute =
        (fromNode?.type === 'engine_router' && toNode?.type === 'engine_target' && Boolean(toNode.activeRoute)) ||
        (fromNode?.type === 'engine_target' && toNode?.type === 'render_output' && Boolean(fromNode.activeRoute));
      const runtimeState: PipelineActivityState =
        fromNode?.runtimeState === 'failed' || toNode?.runtimeState === 'failed' || toNode?.runtimeState === 'blocked' ? 'failed' :
        fromNode?.runtimeState === 'active' || fromNode?.runtimeState === 'processing' || toNode?.runtimeState === 'active' || toNode?.runtimeState === 'processing' ? 'active' :
        fromNode?.runtimeState === 'completed' && toNode?.runtimeState === 'completed' ? 'completed' : activeRoute ? 'waiting' : 'idle';

      return { ...connection, activeRoute, runtimeState };
    });

    const _elapsed = performance.now() - _t0;
    if (_elapsed > 50) console.warn(`[DirectorOS][BLOCK] graphForCompile runtime overlay took ${_elapsed.toFixed(1)}ms`);
    return { ...staticGraph, nodes: nextNodes, connections: nextConnections };
  }, [staticGraph, isRendering, previewState, postWorkflowByScene, shotQueueSummary, activeShot, resolvedPreviewContext]);


  const activeRoutePresetId = useMemo(
    () => graphForCompile?.nodes.find((node) => node.type === 'engine_router')?.routeState?.presetId,
    [graphForCompile]
  );

  const compiledPayload = useMemo(
    () =>
      compilePromptPayload({
        scene: selectedScene,
        clips: timelineState.clips,
        selectedClipId: selectedShotNodeId ?? appState.selectedClipId,
        memoryProfilesById,
        inspectorOverrides: sceneOverrides,
        engineTarget: appState.engineTarget,
        graphState: graphForCompile,
      }),
    [selectedScene, timelineState.clips, selectedShotNodeId, appState.selectedClipId, appState.engineTarget, sceneOverrides, graphForCompile]
  );




  const resolvedDisplayEngine = useMemo(() => {
    if (compiledPayload?.payload.routeContext.targetEngine) return compiledPayload.payload.routeContext.targetEngine.toUpperCase();
    const routerNodeEngine = graphForCompile?.nodes.find((node) => node.type === 'engine_router')?.routeState?.primaryEngine;
    if (routerNodeEngine) return routerNodeEngine.toUpperCase();
    return appState.engineTarget === 'auto' ? 'AUTO' : appState.engineTarget.toUpperCase();
  }, [compiledPayload, graphForCompile, appState.engineTarget]);

  const currentFocus = useMemo<CurrentFocusItem[]>(() => {
    const items: CurrentFocusItem[] = [];
    if (selectedScene?.name) items.push({ label: 'Scene', value: selectedScene.name, active: !selectedFamilyRootId && !selectedJob && !artifactFocus.outputPath });
    if (selectedFamilyRootId) items.push({ label: 'Family', value: `family ${selectedFamilyRootId.slice(0, 6)}`, active: !selectedJob && !artifactFocus.outputPath });
    if (selectedJob) items.push({ label: 'Job', value: selectedJob.id.length <= 12 ? selectedJob.id : `${selectedJob.id.slice(0, 6)}…${selectedJob.id.slice(-4)}`, active: !artifactFocus.outputPath });
    if (artifactFocus.outputPath) {
      const outputName = artifactFocus.outputPath.split(/[\\/]/).pop() ?? artifactFocus.outputPath;
      items.push({ label: 'Output', value: outputName, active: true });
    } else if (items.length) {
      items[items.length - 1] = { ...items[items.length - 1], active: true };
    }
    return items;
  }, [selectedScene, selectedFamilyRootId, selectedJob, artifactFocus.outputPath]);

  const activitySummary = useMemo(() => {
    const renderState = previewState.mode === 'rendering' ? `rendering ${previewState.progress}%` : previewState.mode;
    const reviewState = (postWorkflow?.review ?? (previewState.mode === 'completed' ? 'active' : previewState.mode === 'failed' ? 'blocked' : 'pending'));
    const runtimeLine = `${activeShot?.title ?? 'No active shot'} • Compiled (${previewState.mode === 'idle' ? 'idle' : 'completed'}) → Routed (${previewState.mode === 'idle' ? 'waiting' : 'completed'}) → ${resolvedDisplayEngine} (${previewState.mode === 'rendering' ? 'processing' : previewState.mode === 'completed' ? 'completed' : 'waiting'}) → Render (${renderState}) → Review (${reviewState})`;
    return postWorkflow?.event ? `${runtimeLine} • ${postWorkflow.event}` : runtimeLine;
  }, [resolvedDisplayEngine, previewState.mode, previewState.progress, postWorkflow, activeShot]);

  const launchReadiness = useMemo<LaunchReadinessState>(() => {
    const hasScene = Boolean(selectedScene);
    const hasActiveShot = Boolean(activeShot?.id);
    const hasCompiledPrompt = Boolean(compiledPayload);
    const hasRoute = Boolean(compiledPayload?.payload.routeContext.activeRoute);
    const laneAvailable = !['queued', 'running', 'packaging'].includes(livePreview.mode);

    const checklist = [
      { label: 'Scene selected', ok: hasScene, severity: 'blocking' as const },
      { label: 'Active shot available', ok: hasActiveShot, severity: 'blocking' as const },
      { label: 'Route resolved', ok: hasRoute, severity: 'blocking' as const },
      { label: 'Prompt compiled', ok: hasCompiledPrompt, severity: 'blocking' as const },
      { label: 'Lane available', ok: laneAvailable, severity: 'warning' as const },
    ];

    const reason = !hasScene
      ? 'Select a scene to render.'
      : !hasActiveShot
        ? 'Select or activate a shot.'
        : !hasRoute
          ? 'Choose a route or preset.'
          : !hasCompiledPrompt
            ? 'Resolve compile issues before launch.'
            : !laneAvailable
              ? 'A render is already active.'
              : null;

    return {
      isReady: checklist.every((item) => item.ok),
      reason,
      checklist,
    };
  }, [selectedScene, activeShot?.id, compiledPayload, livePreview.mode]);

  // Pass 43: Live Lens State Unification
  // Forces 'expanded_prompt' update in canonical job state when parameters move.
  useEffect(() => {
    // Only perform expansion if a job is selected and template is available
    if (!selectedJobId || !compiledPayload) return;

    const targetJob = renderJobs.find((j) => j.id === selectedJobId);
    if (!targetJob) return;

    const prompt = compiledPayload?.payload?.scene.basePrompt;
    if (typeof prompt !== 'string') {
      console.warn(`[DirectorOS] Crash-fix: prompt missing for job ${selectedJobId}`);
      return;
    }
    const tone = (sceneOverrides.emotionalTone as string) || 'professional';

    // Logic must match studio_run.py MockGeminiProvider for trace consistency
    let expanded = '';
    if (prompt.includes('|')) {
      const parts = prompt.split('|').map((p) => p.trim());
      if (parts.length >= 6) {
        expanded = (
          `${tone.charAt(0).toUpperCase() + tone.slice(1)} studio render of ${parts[0]}. ` +
          `The sequence leverages ${parts[1]} logic to achieve a cinematic weighting of ${parts[2]}. ` +
          `Movement is established with a ${parts[3]} language, ensuring ${parts[4]} flow. ` +
          `Stabilization is set to ${parts[5].toLowerCase() === 'true' ? 'active' : 'direct'}.`
        );
      } else {
        expanded = `${tone.charAt(0).toUpperCase() + tone.slice(1)} render: ${parts.join(' ')}`;
      }
    } else {
      expanded = `${tone.charAt(0).toUpperCase() + tone.slice(1)} approach: ${prompt}`;
    }

    // Only patch if actually different to prevent infinite cycles
    if (targetJob.metadata?.expanded_prompt === expanded) return;

    setRenderJobs((prev) =>
      prev.map((job) =>
        job.id === selectedJobId
          ? {
            ...job,
            metadata: {
              ...job.metadata,
              expanded_prompt: expanded,
              provider_status: 'mocked'
            }
          }
          : job
      )
    );
  }, [compiledPayload, selectedJobId, sceneOverrides.emotionalTone, renderJobs]);

  useEffect(() => {
    if (!['idle', 'ready'].includes(livePreview.mode)) return;
    setLivePreview((prev) => ({
      ...prev,
      mode: launchReadiness.isReady ? 'ready' : 'idle',
      statusLabel: launchReadiness.isReady ? 'Ready to launch current scene' : launchReadiness.reason ?? 'Idle - ready to render',
      progressLabel: launchReadiness.isReady ? 'Ready' : launchReadiness.reason ?? 'Blocked',
      errorLabel: null,
      progressPercent: 0,
      activeShotId: activeShot?.id ?? null,
    }));
  }, [launchReadiness, activeShot?.id, livePreview.mode]);

  useEffect(() => {
    const t = setInterval(() => {
      setTimelineState((prev) => (prev.isPlaying ? tickFrame(prev) : prev));
    }, 800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedScene || !selectedGraph) return;
    const shots = sortShotsInSequence(selectedGraph.nodes.filter((n) => n.type === 'shot'));
    if (!shots.length) return;

    setShotSequenceByScene((prev) => {
      if (prev[selectedScene.id] && Object.keys(prev[selectedScene.id]).length) return prev;
      const seeded: ShotSequenceState = {};
      shots.forEach((shot, index) => {
        seeded[shot.id] = {
          state: index === 0 ? 'active' : 'waiting',
          progress: index === 0 ? 8 : 0,
          stage: index === 0 ? 'queued for compile' : 'waiting in queue',
          lastAction: index === 0 ? 'Sequence initialized' : 'Awaiting previous shot completion',
          isCurrent: index === 0,
        };
      });
      return { ...prev, [selectedScene.id]: seeded };
    });
  }, [selectedScene, selectedGraph]);

  const onSelectScene = (id: string) => {
    const sceneName = scenes.find((scene) => scene.id === id)?.name ?? 'scene';
    setAppState((prev: typeof initialAppState) => ({ ...prev, selectedSceneId: id }));
    setPreviewState(initialPreviewState);
    setLivePreview(initialLivePreview);
    setArtifactFocus(initialArtifactFocus);
    setOperatorHasExplicitFocus(false);
    // Pass 29: hard-reset family + job on scene change so stale breadcrumbs never bleed across scenes.
    setSelectedFamilyRootId(undefined);
    setSelectedJobId(undefined);
    if (persistentResumeTarget?.sceneId !== id) {
      setPersistentResumeTarget(undefined);
    }
    setPostWorkflowByScene((prev) => (prev[id] ? prev : { ...prev, [id]: createPostWorkflowFromRender('idle') }));
    pushOperatorFeedback(`Focus moved to scene: ${formatFocusValue(sceneName)}`, 'info', 'open', 'transition');
  };

  const onBindProfile = (category: MemoryCategory, profileId: string) => {
    if (!selectedScene) return;

    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== selectedScene.id) return scene;
        const current = { ...(scene.memoryBindings ?? {}) };
        if (!profileId) delete current[category];
        else current[category] = profileId;

        return { ...scene, memoryBindings: current };
      })
    );
  };

  const onOverrideChange = (key: string, value: PrimitiveValue) => {
    if (!selectedScene) return;

    setInspectorOverrides((prev) => ({
      ...prev,
      [selectedScene.id]: {
        ...(prev[selectedScene.id] ?? {}),
        [key]: value,
      },
    }));
  };

  const onEngineTargetChange = (engineTarget: EngineTarget) => {
    setAppState((prev: typeof initialAppState) => ({ ...prev, engineTarget }));
  };

  const onRoutePresetChange = (presetId: string) => {
    const preset = engineRoutePresets.find((item) => item.id === presetId);
    if (!preset) return;
    onEngineTargetChange(preset.primaryEngine);
  };

  const onLoadGraphTemplate = (templateId: string) => {
    if (!selectedScene) return;
    const next = createGraphFromTemplate(selectedScene.id, selectedScene.name, templateId);
    setGraphStates((prev) => ({ ...prev, [selectedScene.id]: next }));
    setGraphHistory((prev) => ({ ...prev, [selectedScene.id]: { undo: [], redo: [] } }));
    upsertSceneGraph(selectedScene.id, next);
  };

  const focusJobOutput = (job: RenderQueueJob, outputPath?: string, isExplicit = false, title?: string) => {
    if (isExplicit) setOperatorHasExplicitFocus(true);
    const focused = outputPath ?? getDefaultOutputPath(job);

    if (isExplicit) {
      setPersistentResumeTarget({
        sceneId: job.sceneId,
        title: title ?? (focused ? 'Review Output' : 'Review Job'),
        cta: 'Resume',
        familyRootId: findLineageRootId(job, renderJobs),
        jobId: job.id,
        outputPath: focused,
      });
    }

    if (!focused) return;
    const outputIndex = (job.resultPaths ?? []).findIndex((path) => path === focused);
    setSelectedFamilyRootId(findLineageRootId(job, renderJobs));
    setSelectedJobId(job.id);
    setSelectedOutputByJob((prev) => ({ ...prev, [job.id]: focused }));
    setArtifactFocus({
      jobId: job.id,
      outputIndex: outputIndex >= 0 ? outputIndex : 0,
      outputPath: focused,
      previewImage: focused,
    });
    const outputName = focused.split(/[\\/]/).pop() ?? focused;
    pushOperatorFeedback(`Focus moved to output: ${formatFocusValue(outputName)}`, 'info', 'open', 'transition');
  };

  const onJumpToLive = () => {
    setOperatorHasExplicitFocus(false);
    if (livePreview.activeJobId) {
      const activeJob = listRenderJobs().find((j) => j.id === livePreview.activeJobId);
      if (activeJob) {
        setSelectedJobId(activeJob.id);
        const output = getDefaultOutputPath(activeJob);
        if (output) focusJobOutput(activeJob, output, false);
      }
    }
    pushOperatorFeedback('Jump to Live Monitor', 'info', 'open', 'transition');
  };

  const onRenderScene = async () => {
    if (!selectedScene || isRendering || isProcessing) return;

    const _renderStart = performance.now();
    console.log('[DirectorOS][TIMING] onRenderScene: entry');

    setIsProcessing(true); // Lock the gate

    setOperatorHasExplicitFocus(false);
    pushOperatorFeedback('Launch live', 'info', 'launch', 'waiting');
    setIsRendering(true);

    const _afterStateSet = performance.now();
    const _initDuration = _afterStateSet - _renderStart;
    if (_initDuration > 50) console.warn(`[DirectorOS][BLOCK] onRenderScene initial setState took ${_initDuration.toFixed(1)}ms`);
    else console.log(`[DirectorOS][TIMING] onRenderScene: initial setState done in ${_initDuration.toFixed(1)}ms`);

    try {
      const pipelineResult = await runRenderPipeline(
        {
          scene: selectedScene,
          clips: timelineState.clips,
          selectedClipId: appState.selectedClipId,
          memoryProfilesById,
          inspectorOverrides: sceneOverrides,
          engineTarget: appState.engineTarget,
          graphState: graphForCompile,
        },
        {
          onQueueUpdate: (job) => {
            const _qStart = performance.now();
            const now = Date.now();
            const isTerminal = job.state === 'completed' || job.state === 'failed' || job.state === 'cancelled';
            const isTransition = job.state === 'preflight' || job.state === 'queued' || job.state === 'packaging';
            
            // THROTTLE: Only update UI state once per second unless it's a critical state transition
            const shouldThrottle = !isTerminal && !isTransition && (now - lastUIProgressUpdateAt.current < 1000);

            const jobs = listRenderJobs();
            const counts = getRenderJobCounts();
            
            // IDENTITY GATE: Only trigger re-render if jobs list structure or terminal states changed
            const jobsSignature = jobs.map(j => `${j.id}:${j.state}:${j.progress}`).join('|');
            if (jobsSignature === (window as any).__lastJobsSignature && !isTerminal && !isTransition) {
               return;
            }
            (window as any).__lastJobsSignature = jobsSignature;

            if (shouldThrottle) {
               return;
            }

            lastUIProgressUpdateAt.current = now;
            setRuntimeJobCounts(counts);
            setJobCounts(counts);
            setRuntimeJobs(() => jobs);
            setRenderJobs(() => jobs);

            // Signal update to heavy memos ONLY on state/order changes (not progress)
            if (job.state !== 'running') {
              setLastStreamEventAt(Date.now());
            }

            // Immediate Selection Sync: Eliminate "null pointer" / "NONE_PTR" lag
            if (job.state === 'queued' || job.state === 'preflight') {
              setSelectedJobId(job.id);
            }

            if (job.state === 'completed') {
              const defaultOutput = getDefaultOutputPath(job);
              if (defaultOutput) {
                setSelectedOutputByJob((prev) => ({ ...prev, [job.id]: prev[job.id] ?? defaultOutput }));
              }

              if (!pinnedJobId && !operatorHasExplicitFocus) {
                setSelectedJobId(job.id);
                if (defaultOutput) {
                  focusJobOutput(job, defaultOutput, false);
                }
              }
            }
            const _qElapsed = performance.now() - _qStart;
            if (_qElapsed > 50) console.warn(`[DirectorOS][BLOCK] onQueueUpdate (${job.state}) took ${_qElapsed.toFixed(1)}ms`);
          },
          onPreviewUpdate: (state) => {
            const _pStart = performance.now();
            const now = Date.now();
            const isTerminal = state.mode === 'completed' || state.mode === 'failed' || state.mode === 'cancelled';
            
            // THROTTLE: Only update UI state once per second unless it's a terminal state transition
            if (!isTerminal && now - lastUIProgressUpdateAt.current < 1000) {
              return;
            }
            lastUIProgressUpdateAt.current = now;

            setPreviewState(state);
            syncLivePreviewFromRenderState(state, undefined, activeShot?.id ?? null);
            if (!selectedScene) return;

            setShotSequenceByScene((prev) => {
              const current = prev[selectedScene.id] ?? {};
              const activeId = Object.entries(current).find(([, v]) => v.isCurrent)?.[0] ?? activeShot?.id;
              if (!activeId) return prev;
              const currentShot = current[activeId] ?? { state: 'active' as ShotRuntimeState, progress: 8, stage: 'compiling', lastAction: 'Shot activated', isCurrent: true };

              const nextState: ShotRuntimeState =
                state.mode === 'queued'
                  ? 'compiling'
                  : state.mode === 'rendering'
                    ? state.progress < 35
                      ? 'compiling'
                      : state.progress < 65
                        ? 'routed'
                        : 'rendering'
                    : state.mode === 'completed'
                      ? 'review'
                      : state.mode === 'failed'
                        ? 'failed'
                        : currentShot.state;

              // IDENTITY GATE: Only update sequence state if the shot status actually changed
              if (currentShot.state === nextState && !isTerminal) {
                 return prev;
              }

              const next: ShotSequenceState = {
                ...current,
                [activeId]: {
                  ...currentShot,
                  state: nextState,
                  progress: state.mode === 'completed' ? 100 : Math.max(currentShot.progress, state.progress),
                  stage:
                    nextState === 'compiling'
                      ? 'prompt compile'
                      : nextState === 'routed'
                        ? 'engine routed'
                        : nextState === 'rendering'
                          ? 'rendering'
                          : nextState === 'review'
                            ? 'review ready'
                            : nextState === 'failed'
                              ? 'render failed'
                              : currentShot.stage,
                  lastAction:
                    nextState === 'compiling'
                      ? 'Compiled active shot payload'
                      : nextState === 'routed'
                        ? `Routed to ${resolvedDisplayEngine}`
                        : nextState === 'rendering'
                          ? 'Shot rendering in progress'
                          : nextState === 'review'
                            ? 'Render completed → Review active'
                            : nextState === 'failed'
                              ? 'Shot render failed'
                              : currentShot.lastAction,
                  isCurrent: true,
                },
              };

              return { ...prev, [selectedScene.id]: next };
            });

            if (state.mode === 'completed' || state.mode === 'failed') {
              setPostWorkflowByScene((prev) => ({ ...prev, [selectedScene.id]: createPostWorkflowFromRender(state.mode) }));
            }
            const _pElapsed = performance.now() - _pStart;
            if (_pElapsed > 50) console.warn(`[DirectorOS][BLOCK] onPreviewUpdate (${state.mode}) took ${_pElapsed.toFixed(1)}ms`);
          },
        }
      );

      // Selection is now handled immediately in onQueueUpdate to prevent lag
      const latestJobs = await refreshRuntimeSurfaces();

      // Clear dismissal if we are re-starting a previously dismissed failure context
      if (activeShot?.id) {
        setDismissedFailureIds(prev => {
          const next = new Set(prev);
          latestJobs.forEach(job => {
            if (job.shotId === activeShot.id) next.delete(job.id);
          });
          return next;
        });
      }

      const submittedJob = pipelineResult?.jobId ? latestJobs.find((job) => job.id === pipelineResult.jobId) : undefined;
      if (submittedJob?.state === 'completed') {
        const defaultOutput = getDefaultOutputPath(submittedJob);
        if (defaultOutput) {
          setSelectedOutputByJob((prev) => ({ ...prev, [submittedJob.id]: prev[submittedJob.id] ?? defaultOutput }));
          focusJobOutput(submittedJob, defaultOutput);
        }
      }
    } finally {
      setIsRendering(false);
      setIsProcessing(false);
    }
  };

  const updatePostWorkflow = (updater: (current: PostWorkflowState) => PostWorkflowState) => {
    if (!selectedScene) return;
    setPostWorkflowByScene((prev) => {
      const current = prev[selectedScene.id] ?? createPostWorkflowFromRender(previewState.mode);
      return { ...prev, [selectedScene.id]: updater(current) };
    });
  };

  const onPostWorkflowAction = (action: 'approve_review' | 'complete_edit' | 'complete_export' | 'complete_delivery' | 'fail_export' | 'reset' | 'approve_delivery') => {
    if (action === 'approve_review') pushOperatorFeedback('Review approved', 'ok', 'review', 'transition');
    if (action === 'complete_edit') pushOperatorFeedback('Edit completed', 'ok', 'review', 'transition');
    if (action === 'complete_export') pushOperatorFeedback('Deliverable ready', 'ok', 'delivery', 'transition');
    if (action === 'complete_delivery') pushOperatorFeedback('Delivery sent', 'ok', 'delivery', 'transition');
    if (action === 'approve_delivery') pushOperatorFeedback('Promoted to Delivery-Approved state', 'ok', 'delivery', 'transition');
    if (action === 'fail_export') pushOperatorFeedback('Export needs attention', 'error', 'delivery');
    if (action === 'reset') pushOperatorFeedback('Workflow ready', 'info', 'delivery');
    updatePostWorkflow((current) => {
      if (action === 'reset') return createPostWorkflowFromRender(previewState.mode);
      if (action === 'approve_review') {
        if (current.review !== 'active') return current;
        return { ...current, review: 'approved', edit: 'active', export: 'waiting', delivery: 'waiting', event: 'Review approved → Edit active' };
      }
      if (action === 'complete_edit') {
        if (current.edit !== 'active') return current;
        return { ...current, edit: 'completed', export: 'active', delivery: 'waiting', event: 'Edit completed → Export active' };
      }
      if (action === 'complete_export') {
        if (current.export !== 'active') return current;
        return { ...current, export: 'completed', delivery: 'ready', event: 'Export completed → Delivery ready' };
      }
      if (action === 'complete_delivery') {
        if (current.delivery !== 'ready' && current.delivery !== 'active') return current;
        return { ...current, delivery: 'completed', event: 'Delivery sent → Pipeline complete' };
      }
      if (action === 'fail_export') {
        if (current.export !== 'active') return current;
        return { ...current, export: 'failed', delivery: 'blocked', event: 'Export failed → Delivery blocked' };
      }
      if (action === 'approve_delivery') {
        const job = selectedJob ?? supportingEvidenceJob;
        if (job) {
          // Pass 37: Reuse lineage authority mechanism but wrap in delivery context feedback.
          // This ensures the job is promoted to 'Approved' status globally.
          onSubmitM5Action('approve_best_known', job, 'Manual operator promotion for delivery');
        }
        // No direct post-workflow stage change, as approval is a gating state for the current stage
        return current;
      }
      return current;
    });
  };

  const updateShotSequence = (updater: (current: ShotSequenceState, sceneGraph: SceneGraphState) => ShotSequenceState) => {
    if (!selectedScene || !selectedGraph) return;
    setShotSequenceByScene((prev) => {
      const current = prev[selectedScene.id] ?? {};
      return { ...prev, [selectedScene.id]: updater(current, selectedGraph) };
    });
  };

  const markShotActive = (shotId: string) => {
    updateShotSequence((current, sceneGraph) => {
      const shots = sortShotsInSequence(sceneGraph.nodes.filter((n) => n.type === 'shot'));
      const next: ShotSequenceState = { ...current };
      shots.forEach((shot) => {
        const existing = next[shot.id];
        if (shot.id === shotId) {
          next[shot.id] = { state: 'active', progress: Math.max(existing?.progress ?? 0, 8), stage: 'compiling', lastAction: 'Shot activated', isCurrent: true };
        } else {
          const state = existing?.state ?? 'waiting';
          next[shot.id] = { state: state === 'completed' || state === 'skipped' ? state : 'waiting', progress: state === 'completed' ? 100 : state === 'skipped' ? 100 : 0, stage: state === 'completed' ? 'completed' : state === 'skipped' ? 'skipped' : 'waiting in queue', lastAction: existing?.lastAction ?? 'Awaiting previous shot completion', isCurrent: false };
        }
      });
      return next;
    });
  };

  const onShotExecutionAction = (action: 'start_shot' | 'mark_complete' | 'skip_shot' | 'reset_shot' | 'start_sequence' | 'next_shot' | 'reset_sequence') => {
    if (!selectedScene || !selectedGraph) return;
    const shots = sortShotsInSequence(selectedGraph.nodes.filter((n) => n.type === 'shot'));
    if (!shots.length) return;

    const currentIdx = getCurrentShotIndex(shotQueueSummary);
    const currentShot = currentIdx >= 0 ? shotQueueSummary[currentIdx] : undefined;
    const selectedShot = selectedGraphNode?.type === 'shot' ? selectedGraphNode : undefined;
    const targetShotId = selectedShot?.id ?? currentShot?.id ?? shots[0].id;

    if (action === 'start_sequence') {
      pushOperatorFeedback('Sequence live', 'ok', 'shot');
      markShotActive(shots[0].id);
      return;
    }

    if (action === 'reset_sequence') {
      pushOperatorFeedback('Sequence ready', 'info', 'shot');
      setShotSequenceByScene((prev) => {
        const next: ShotSequenceState = {};
        shots.forEach((shot, index) => {
          next[shot.id] = {
            state: index === 0 ? 'active' : 'waiting',
            progress: index === 0 ? 8 : 0,
            stage: index === 0 ? 'queued for compile' : 'waiting in queue',
            lastAction: index === 0 ? 'Sequence reset → first shot armed' : 'Awaiting previous shot completion',
            isCurrent: index === 0,
          };
        });
        return { ...prev, [selectedScene.id]: next };
      });
      return;
    }

    updateShotSequence((current) => {
      const next: ShotSequenceState = { ...current };
      const idx = shots.findIndex((s) => s.id === targetShotId);
      const sequenceIdx = idx >= 0 ? idx : 0;
      const currentEntry = next[targetShotId] ?? { state: 'waiting' as ShotRuntimeState, progress: 0, stage: 'waiting in queue', lastAction: 'Awaiting trigger', isCurrent: false };

      if (action === 'start_shot') {
        pushOperatorFeedback('Shot live', 'ok', 'shot');
        next[targetShotId] = { ...currentEntry, state: 'active', progress: Math.max(currentEntry.progress, 8), stage: 'compiling', lastAction: 'Shot manually started', isCurrent: true };
      }

      if (action === 'mark_complete') {
        pushOperatorFeedback('Shot complete', 'ok', 'shot', 'transition');
        next[targetShotId] = { ...currentEntry, state: 'completed', progress: 100, stage: 'completed', lastAction: 'Shot marked complete', isCurrent: false };
        const nxt = shots[sequenceIdx + 1];
        if (nxt) {
          const nx = next[nxt.id];
          if (!nx || (nx.state !== 'completed' && nx.state !== 'skipped')) {
            next[nxt.id] = { state: 'active', progress: 8, stage: 'compiling', lastAction: `Activated after ${currentEntry.lastAction}`, isCurrent: true };
          }
        }
      }

      if (action === 'skip_shot') {
        pushOperatorFeedback('Shot skipped', 'info', 'shot');
        next[targetShotId] = { ...currentEntry, state: 'skipped', progress: 100, stage: 'skipped', lastAction: 'Shot skipped by director', isCurrent: false };
        const nxt = shots[sequenceIdx + 1];
        if (nxt) next[nxt.id] = { ...(next[nxt.id] ?? { state: 'waiting', progress: 0, stage: 'waiting in queue', lastAction: 'Awaiting previous shot completion' }), state: 'active', progress: 8, stage: 'compiling', lastAction: 'Activated after skip', isCurrent: true };
      }

      if (action === 'reset_shot') {
        pushOperatorFeedback('Shot ready', 'info', 'shot');
        next[targetShotId] = { ...currentEntry, state: 'waiting', progress: 0, stage: 'waiting in queue', lastAction: 'Shot reset', isCurrent: false };
      }

      if (action === 'next_shot') {
        pushOperatorFeedback('Next shot live', 'ok', 'shot');
        const nxt = shots[Math.max(0, sequenceIdx + 1)] ?? shots[0];
        next[targetShotId] = { ...currentEntry, state: currentEntry.state === 'failed' ? 'failed' : 'completed', progress: currentEntry.state === 'failed' ? currentEntry.progress : 100, stage: currentEntry.state === 'failed' ? currentEntry.stage : 'completed', lastAction: currentEntry.state === 'failed' ? currentEntry.lastAction : 'Advanced to next shot', isCurrent: false };
        if (nxt && nxt.id !== targetShotId) {
          next[nxt.id] = { ...(next[nxt.id] ?? { state: 'waiting', progress: 0, stage: 'waiting in queue', lastAction: 'Awaiting previous shot completion' }), state: 'active', progress: 8, stage: 'compiling', lastAction: 'Advanced from previous shot', isCurrent: true };
        }
      }

      Object.keys(next).forEach((id) => {
        if (id !== targetShotId && next[id]?.isCurrent && next[id].state !== 'active') next[id] = { ...next[id], isCurrent: false };
      });

      const activeIds = Object.entries(next).filter(([, value]) => value.isCurrent).map(([id]) => id);
      if (activeIds.length > 1) {
        activeIds.slice(1).forEach((id) => {
          next[id] = { ...next[id], isCurrent: false };
        });
      }

      return next;
    });
  };

  const getM5ActionGuard = (actionType: ReviewActionType): GuardResult => {
    if (!selectedJob || !selectedScene || !selectedJob.shotId) return makeBlockedGuard('invalid_state');

    const shotProjection = shotProjectionByShotId.get(selectedJob.shotId);
    const approvalStatus = shotProjection?.approvalStatus;
    const actionState = shotProjection?.actionState?.current;
    const bestKnownId = shotProjection?.bestKnownOutputSelection?.selectedJobId;

    if (actionState === 'finalized' && actionType !== 'finalize_shot') return makeBlockedGuard('already_finalized');

    if (actionType === 'approve_best_known') {
      if (selectedJob.state !== 'completed') return makeBlockedGuard('invalid_state');
      if (!bestKnownId || bestKnownId !== selectedJob.id) return makeBlockedGuard('invalid_state');
      if (approvalStatus === 'superseded') return makeBlockedGuard('superseded_job');
      return makeAllowedGuard();
    }

    if (actionType === 'mark_needs_revision' || actionType === 'reject_output') {
      if (selectedJob.state !== 'completed') return makeBlockedGuard('invalid_state');
      if (actionType === 'reject_output' && queueMode !== 'running') return makeBlockedGuard('authority_boundary');
      return makeAllowedGuard();
    }

    if (actionType === 'supersede_with_job') {
      const siblingJobs = renderJobs.filter((job) => job.shotId === selectedJob.shotId && job.id !== selectedJob.id);
      if (!siblingJobs.length) return makeBlockedGuard('no_target_job');
      return makeAllowedGuard();
    }

    if (actionType === 'finalize_shot') {
      if (queueMode !== 'running') return makeBlockedGuard('authority_boundary');
      if (actionState === 'finalized') return makeBlockedGuard('already_finalized');
      if (approvalStatus !== 'approved') return makeBlockedGuard('missing_review_outcome');
      return makeAllowedGuard();
    }

    return makeAllowedGuard();
  };

  const m5ActionGuards = useMemo(() => ({
    approve_best_known: getM5ActionGuard('approve_best_known'),
    mark_needs_revision: getM5ActionGuard('mark_needs_revision'),
    reject_output: getM5ActionGuard('reject_output'),
    supersede_with_job: getM5ActionGuard('supersede_with_job'),
    finalize_shot: getM5ActionGuard('finalize_shot'),
  }), [selectedJob, selectedScene, shotProjectionByShotId, queueMode, renderJobs]);

  const onSubmitM5Action = useCallback((actionType: ReviewActionType, overrideJob?: RenderQueueJob, overrideRationale?: string, overrideSupersededJobId?: string) => {
    const targetJob = overrideJob ?? selectedJob;
    if (!targetJob || !selectedScene || !targetJob.shotId) {
      pushOperatorFeedback('Action blocked: missing job or scene context', 'error', 'review');
      return;
    }

    // Intent signal: preparing_commit for high-stakes actions
    if (['approve_best_known', 'supersede_with_job', 'finalize_shot'].includes(actionType)) {
      const familyRootId = findLineageRootId(targetJob, renderJobs);

      // Pass 16: Pre-flight conflict check
      const conflicts = resolveConflicts(familyRootId);
      if (conflicts.length > 0) {
        const peerNames = conflicts.map(c => presenceState.activeOperators.find(op => op.id === c.operatorId)?.name).join(', ');
        pushOperatorFeedback(`Coordination Conflict: ${peerNames} also acting on this family`, 'error', 'review');
        // We continue anyway as it's non-blocking, but the feedback informs the operator.
      }

      broadcastIntent(familyRootId, 'preparing_commit', `Action: ${actionType}`);
    }

    const guard = m5ActionGuards[actionType];
    if (guard?.blocked && guard.reasonCode) {
      const reasonCode = guard.reasonCode;
      pushOperatorFeedback(guard.message ?? getGuardMessage(reasonCode), 'error', 'review');
      setM5ActionFeedbackByJob((prev) => ({
        ...prev,
        [targetJob.id]: { level: 'error', message: `Reason: ${reasonCode} | Message: ${guard.message ?? (reasonCode ? getGuardMessage(reasonCode) : 'Action blocked')}` },
      }));
      return;
    }

    const shotProjection = shotProjectionByShotId.get(targetJob.shotId);

    const authorityResult =
      actionType === 'reject_output' || actionType === 'finalize_shot'
        ? (queueMode === 'running' ? 'granted' : 'denied')
        : 'not_required';

    try {
      const result = submitReviewAction({
        actionType,
        projectId: 'proj_directoros',
        sceneId: selectedScene.id,
        shotId: targetJob.shotId,
        jobId: targetJob.id,
        lineageRootJobId: shotProjection?.bestKnownOutputSelection?.selectedJobId ?? targetJob.id,
        queueId: 'queue_main_a',
        connectorId: targetJob.engine,
        idempotencyKey: `m5:ui:${actionType}:${targetJob.id}:${Date.now()}`,
        actor: { source: 'operator', approvedBy: 'director.ui' },
        guard: { authorityResult, projectionVersion: 1, queueAuthorityTokenId: authorityResult === 'granted' ? `qauth-${Date.now()}` : undefined },
        data:
          actionType === 'approve_best_known'
            ? { selectedJobId: targetJob.id, rationale: overrideRationale }
            : actionType === 'supersede_with_job'
              ? { supersededJobId: overrideSupersededJobId ?? (targetJob.id !== selectedJob?.id ? selectedJob?.id : undefined), replacementJobId: targetJob.id, reasonCode: 'CREATIVE_DIRECTION_CHANGE', rationale: overrideRationale }
              : { rationale: overrideRationale },
      });

      const acceptedMessage = result.accepted
        ? actionType === 'approve_best_known'
          ? 'Approved'
          : actionType === 'mark_needs_revision'
            ? 'Revision requested'
            : actionType === 'reject_output'
              ? 'Output rejected'
              : actionType === 'supersede_with_job'
                ? 'Replacement recorded'
                : 'Finalized'
        : getGuardMessage(normalizeReasonCode(result.reasonCode) ?? 'invalid_state');

      pushOperatorFeedback(
        acceptedMessage,
        result.accepted ? ('ok' as const) : ('error' as const),
        'review' as const,
        result.accepted ? ('transition' as const) : undefined
      );

      const familyRootId = findLineageRootId(targetJob, renderJobs);
      const nextByAction: Partial<Record<ReviewActionType, string>> = {
        approve_best_known: 'Next: Open approved output',
        finalize_shot: 'Next: Move to next family',
        mark_needs_revision: 'Next: Retry or inspect replacement output',
        reject_output: 'Next: Retry latest attempt or inspect replacement',
        supersede_with_job: 'Next: Open replacement output',
      };

      if (result.accepted) {
        if (overrideJob) {
          // Continuity & Memory: Signal winner changed if applies before closing shootout
          const prevWinnerId = currentWinnerJob?.id;

          setShootout(prev => {
            // Restore context on commit-exit as well
            setPreShootoutFocus((pre: { jobId?: string; familyRootId?: string } | null) => {
              if (pre) {
                const jobStillExists = pre.jobId ? renderJobs.some(j => j.id === pre.jobId) : true;
                if (jobStillExists) {
                  setSelectedJobId(pre.jobId);
                  setSelectedFamilyRootId(pre.familyRootId);
                  setRestorationSignal({ targetId: pre.jobId || pre.familyRootId || '', type: 'shootout_return', timestamp: Date.now() });
                }
              }
              return null;
            });
            return { ...prev, active: false };
          });

          // After state settles, check if winner changed to emit pivot signal
          // and let CenterWorkspace handle the highlight on the winner card
          setTimeout(() => {
            const newWinnerId = resolvedOperatorReviewState?.bestKnownJobId;
            if (newWinnerId && newWinnerId !== prevWinnerId) {
              setWinnerChangedSignal({ winnerId: newWinnerId, timestamp: Date.now() });
            }
          }, 50);
        }
        setSelectedFamilyRootId(familyRootId);
        setSelectedJobId(targetJob.id);

        // Pass 26: consume the pending guidance outcome (set by handleNextBestAction
        // when the NBA had an active predictiveHint). Clear immediately after read.
        const guidanceOutcome = pendingGuidanceOutcomeRef.current;
        pendingGuidanceOutcomeRef.current = undefined;

        const payload = {
          tone: 'ok' as const,
          message: acceptedMessage,
          next: nextByAction[actionType],
          targetJobId: targetJob.id,
          supersededJobId: overrideSupersededJobId ?? (targetJob.id !== selectedJob?.id ? selectedJob?.id : undefined),
          rationale: overrideRationale || undefined,
          guidanceOutcome,
        };

        pushInlineJobReceipt(targetJob.id, payload);
        pushInlineFamilyReceipt(familyRootId, payload);
      } else {
        pendingGuidanceOutcomeRef.current = undefined;
        pushInlineJobReceipt(targetJob.id, { tone: 'error', message: acceptedMessage, next: 'Next: Resolve the blocked review condition' });
        pushInlineFamilyReceipt(familyRootId, { tone: 'error', message: acceptedMessage, next: 'Next: Resolve the blocked review condition' });
      }

      setM5ActionFeedbackByJob((prev) => {
        const normalizedReason = normalizeReasonCode(result.reasonCode);
        const normalizedMessage = normalizedReason ? `Reason: ${normalizedReason} | Message: ${getGuardMessage(normalizedReason)}` : undefined;
        return {
          ...prev,
          [targetJob.id]: result.accepted
            ? { level: 'ok', message: `${actionType} accepted` }
            : { level: 'error', message: normalizedMessage ?? (result.duplicate ? 'DUPLICATE_ACTION' : 'ACTION_REJECTED') },
        };
      });
    } catch (err: any) {
      pushOperatorFeedback(`Action failed: ${err.message}`, 'error', 'review');
      setM5ActionFeedbackByJob((prev) => ({
        ...prev,
        [targetJob.id]: { level: 'error', message: err.message },
      }));
    }

    const jobs = listRenderJobs();
    const counts = getRenderJobCounts();
    setRuntimeJobs(() => jobs);
    setRenderJobs(() => jobs);
    setRuntimeJobCounts(counts);
    setJobCounts(counts);
  }, [selectedJob, selectedScene, shotProjectionByShotId, queueMode, renderJobs, m5ActionGuards, presenceState.activeOperators, presenceState.activities, pushInlineJobReceipt, pushInlineFamilyReceipt, pushOperatorFeedback]);

  const findAuthorityKind = (jobId: string | undefined, jobs: RenderQueueJob[]): ShootoutState['leftAuthority'] => {
    if (!jobId) return 'none';
    if (approvedOutputJob?.id === jobId) return 'approved_output';
    if (currentWinnerJob?.id === jobId) return 'current_winner';
    if (jobs[0]?.id === jobId) return 'latest_attempt';
    return 'historical_artifact';
  };

  const onCommitShootout = useCallback((side: 'left' | 'right', rationale: string) => {
    const s = shootoutRef.current;
    const job = side === 'left' ? s.leftJob : s.rightJob;
    const otherId = side === 'left' ? s.rightJobId : s.leftJobId;
    const authority = side === 'left' ? s.leftAuthority : s.rightAuthority;
    const otherAuthority = side === 'left' ? s.rightAuthority : s.leftAuthority;

    if (!job) {
      pushOperatorFeedback('Commit failed: job context lost for side ' + side, 'error', 'review');
      return;
    }

    let action: ReviewActionType = 'approve_best_known';
    let supersededId: string | undefined = undefined;

    if (authority !== 'approved_output' && otherAuthority === 'approved_output') {
      action = 'supersede_with_job';
      supersededId = otherId;
    }

    try {
      onSubmitM5Action(action, job, rationale, supersededId);
    } catch (err: any) {
      pushOperatorFeedback(`Shootout commit failed: ${err.message}`, 'error', 'review');
    }
  }, [onSubmitM5Action, pushOperatorFeedback]);

  const onToggleCompareCandidate = useCallback((jobId: string) => {
    const job = renderJobs.find(j => j.id === jobId);
    if (!job) return;

    setCompareEvidence(prev => {
      const isLeft = prev.left?.jobId === jobId;
      const isRight = prev.right?.jobId === jobId;

      if (isLeft) return { ...prev, left: undefined };
      if (isRight) return { ...prev, right: undefined };

      const item = buildCompareEvidenceItem(jobId);
      if (!item) return prev;

      if (!prev.left) return { ...prev, left: item };
      return { ...prev, right: item };
    });

    setShootout(prev => {
      const currentEvidence = compareEvidence; // capture current state
      let nextLeftId = currentEvidence.left?.jobId;
      let nextRightId = currentEvidence.right?.jobId;

      if (nextLeftId === jobId) nextLeftId = undefined;
      else if (nextRightId === jobId) nextRightId = undefined;
      else if (!nextLeftId) nextLeftId = jobId;
      else nextRightId = jobId;

      if (nextLeftId && nextRightId) {
        setPreShootoutFocus({ jobId: selectedJobId, familyRootId: selectedFamilyRootId });
        const leftJob = renderJobs.find(j => j.id === nextLeftId);
        if (leftJob) broadcastIntent(findLineageRootId(leftJob, renderJobs), 'comparing', 'Manual Shootout');

        return {
          ...prev,
          active: true,
          leftJobId: nextLeftId,
          rightJobId: nextRightId,
          leftJob,
          rightJob: renderJobs.find(j => j.id === nextRightId),
          leftAuthority: findAuthorityKind(nextLeftId, renderJobs),
          rightAuthority: findAuthorityKind(nextRightId, renderJobs),
          onCommit: onCommitShootout,
          onExit: () => {
            setShootout(p => {
              setPreShootoutFocus((pre: { jobId?: string; familyRootId?: string } | null) => {
                if (pre) {
                  const jobStillExists = pre.jobId ? renderJobs.some(j => j.id === pre.jobId) : true;
                  const familyStillExists = pre.familyRootId ? renderJobs.some(j => findLineageRootId(j, renderJobs) === pre.familyRootId) : true;
                  if (jobStillExists && familyStillExists) {
                    setSelectedJobId(pre.jobId);
                    setSelectedFamilyRootId(pre.familyRootId);
                    if (pre.jobId || pre.familyRootId) {
                      setRestorationSignal({ targetId: (pre.jobId || pre.familyRootId)!, type: 'shootout_return', timestamp: Date.now() });
                    }
                  }
                }
                return null;
              });
              return { ...p, active: false };
            });
          }
        };
      }
      return { ...prev, active: false };
    });
  }, [renderJobs, compareEvidence, buildCompareEvidenceItem, approvedOutputJob, currentWinnerJob, onCommitShootout]);

  const onCompareSuggestedPair = useCallback(() => {
    if (!productionFamily?.suggestedPairPrimaryJobId || !productionFamily?.suggestedPairPartnerJobId) return;

    const leftJobId = productionFamily.suggestedPairPrimaryJobId;
    const rightJobId = productionFamily.suggestedPairPartnerJobId;

    // Continuity & Memory: capture pre-shootout focus
    setPreShootoutFocus({ jobId: selectedJobId, familyRootId: selectedFamilyRootId });

    setShootout(prev => ({
      ...prev,
      active: true,
      leftJobId,
      rightJobId,
      leftJob: renderJobs.find(j => j.id === leftJobId),
      rightJob: renderJobs.find(j => j.id === rightJobId),
      leftAuthority: findAuthorityKind(leftJobId, renderJobs),
      rightAuthority: findAuthorityKind(rightJobId, renderJobs),
      onCommit: onCommitShootout,
      onExit: () => {
        setShootout(p => {
          setPreShootoutFocus((pre: { jobId?: string; familyRootId?: string } | null) => {
            if (pre) {
              // Restoration logic identical to handleShootoutInboxItem
              const jobStillExists = pre.jobId ? renderJobs.some(j => j.id === pre.jobId) : true;
              const familyStillExists = pre.familyRootId ? renderJobs.some(j => findLineageRootId(j, renderJobs) === pre.familyRootId) : true;
              if (jobStillExists && familyStillExists) {
                setSelectedJobId(pre.jobId);
                setSelectedFamilyRootId(pre.familyRootId);
                if (pre.jobId || pre.familyRootId) {
                  setRestorationSignal({ targetId: (pre.jobId || pre.familyRootId)!, type: 'shootout_return', timestamp: Date.now() });
                }
              }
            }
            return null;
          });
          return { ...p, active: false };
        });
      }
    }));
  }, [productionFamily, renderJobs, approvedOutputJob, currentWinnerJob, onCommitShootout]);

  const handleRetryInboxItem = useCallback(async (item: InboxItem) => {
    const job = item.targetJobId ? renderJobs.find(j => j.id === item.targetJobId) : undefined;
    if (!job) {
      pushOperatorFeedback('Retry failed: target job context lost', 'error', 'review');
      return;
    }
    broadcastIntent(item.lineageRootId, 'retrying', 'Retry Attempt');
    pushOperatorFeedback(`Retrying failed attempt for ${item.label}`, 'info', 'review', 'waiting');
    setIsRendering(true);
    try {
      await runRenderPipelineFromBridgeJob(job, {
        onQueueUpdate: () => {
          const jobs = listRenderJobs();
          setRuntimeJobs(() => jobs);
          setRenderJobs(() => jobs);
        },
      });
      pushOperatorFeedback(`Retry enqueued for ${item.label}`, 'ok', 'review', 'transition');
    } catch (err: any) {
      pushOperatorFeedback(`Retry failed: ${err.message}`, 'error', 'review');
    } finally {
      setIsRendering(false);
    }
  }, [renderJobs, pushOperatorFeedback]);

  const handleCommitInboxItem = useCallback((item: InboxItem) => {
    const job = item.targetJobId ? renderJobs.find(j => j.id === item.targetJobId) : undefined;
    if (!job) {
      pushOperatorFeedback('Commit failed: job context lost', 'error', 'review');
      return;
    }
    broadcastIntent(item.lineageRootId, 'preparing_commit', 'Commit Winner');
    onSubmitM5Action('approve_best_known', job, 'One-step commit from Review Inbox');
  }, [renderJobs, onSubmitM5Action, broadcastIntent, pushOperatorFeedback]);

  const handleShootoutInboxItem = useCallback((item: InboxItem) => {
    const job = item.targetJobId ? renderJobs.find(j => j.id === item.targetJobId) : undefined;
    if (!job) {
      pushOperatorFeedback('Shootout failed: job context lost', 'error', 'review');
      return;
    }

    const familyRootId = item.lineageRootId;

    // Broadcast intent: comparing
    broadcastIntent(familyRootId, 'comparing', 'Launch Shootout');

    const familyJobs = renderJobs.filter(j => findLineageRootId(j, renderJobs) === item.lineageRootId);
    const partner = familyJobs.find(j => j.id !== item.targetJobId && j.state === 'completed') || familyJobs[0];

    if (partner) {
      // Continuity & Memory: capture pre-shootout focus for restoration
      setPreShootoutFocus({ jobId: selectedJobId, familyRootId: selectedFamilyRootId });

      setShootout({
        active: true,
        leftJobId: item.targetJobId!,
        rightJobId: partner.id,
        leftJob: job,
        rightJob: partner,
        leftAuthority: findAuthorityKind(item.targetJobId, renderJobs),
        rightAuthority: findAuthorityKind(partner.id, renderJobs),
        onCommit: onCommitShootout,
        onExit: () => {
          // Restore prior context only if valid
          setShootout(prev => {
            const currentWinnerId = currentWinnerJob?.id;

            // Validation & Fallback logic
            setPreShootoutFocus((pre: { jobId?: string; familyRootId?: string } | null) => {
              if (pre) {
                const jobStillExists = pre.jobId ? renderJobs.some(j => j.id === pre.jobId) : true;
                const familyStillExists = pre.familyRootId ? renderJobs.some(j => findLineageRootId(j, renderJobs) === pre.familyRootId) : true;

                if (jobStillExists && familyStillExists) {
                  setSelectedJobId(pre.jobId);
                  setSelectedFamilyRootId(pre.familyRootId);

                  if (pre.jobId) {
                    setRestorationSignal({ targetId: pre.jobId, type: 'shootout_return', timestamp: Date.now() });
                  } else if (pre.familyRootId) {
                    setRestorationSignal({ targetId: pre.familyRootId, type: 'shootout_return', timestamp: Date.now() });
                  }
                } else {
                  // Fallback to current winner if pre-focus was lost
                  if (currentWinnerId) {
                    setSelectedJobId(currentWinnerId);
                    setRestorationSignal({ targetId: currentWinnerId, type: 'shootout_return', timestamp: Date.now() });
                  }
                }
              }
              return null;
            });

            return { ...prev, active: false };
          });
        },
      });
      pushOperatorFeedback(`Opening shootout for ${item.label}`, 'info', 'review', 'transition');
    } else {
      pushOperatorFeedback('Shootout failed: no suitable partner job found in family', 'error', 'review');
    }
  }, [renderJobs, onCommitShootout, pushOperatorFeedback, broadcastIntent]);

  const handleDismissInboxItem = useCallback((item: InboxItem) => {
    setDismissedInboxItemIds(prev => new Set(prev).add(item.lineageRootId));
    pushOperatorFeedback(`Notice dismissed for ${item.label}`, 'info', 'review');
  }, [pushOperatorFeedback]);

  const quickActionHandlers = useMemo<QuickActionHandlers>(() => ({
    onRetry: async (job: RenderQueueJob) => {
      const familyRootId = findLineageRootId(job, renderJobs);
      broadcastIntent(familyRootId, 'retrying', 'Retry Attempt');
      setIsRendering(true);
      try {
        const result = await runRenderPipelineFromBridgeJob(job, {
          onQueueUpdate: (newJob) => {
            const jobs = listRenderJobs();
            const counts = getRenderJobCounts();
            setRuntimeJobCounts(counts);
            setJobCounts(counts);
            setRuntimeJobs(() => jobs);
            setRenderJobs(() => jobs);

            // Immediate Selection Sync: Eliminate "null pointer" / "NONE_PTR" lag on retry
            if (newJob.state === 'queued' || newJob.state === 'preflight') {
              setSelectedJobId(newJob.id);
            }
          },
        });
      } finally {
        setIsRendering(false);
      }
    },
    onSubmitM5: onSubmitM5Action,
    onCancel: (id: string) => queueActions.cancelJob(id),
    onFocus: (job, path) => focusJobOutput(job, path, true),
    onOpen: (path) => path && openPath(path),
  }), [activeShot?.id, onSubmitM5Action]);

  const refinedJobQuickActions = useMemo(() =>
    buildJobQuickActions(selectedJob, selectedJobReview, quickActionHandlers),
    [selectedJob, selectedJobReview, quickActionHandlers]
  );

  const refinedFamilyQuickActions = useMemo(() =>
    buildFamilyQuickActions(resolvedProductionFamilyTruth, renderJobs, quickActionHandlers),
    [resolvedProductionFamilyTruth, renderJobs, quickActionHandlers]
  );

  const currentHistory = selectedScene ? graphHistory[selectedScene.id] : undefined;

  const nextBestAction = useMemo(() => {
    if (!resolvedProductionFamilyTruth) return undefined;
    return resolveNextBestAction({
      family: resolvedProductionFamilyTruth,
      jobs: renderJobs,
      shootoutActive: shootout.active,
    });
  }, [resolvedProductionFamilyTruth, renderJobs, shootout.active]);

  // Pass 26: canonical one-line guidance outcome strings per NBA state.
  // These surface in the inlineActionReceipt after a hint-guided CTA fires.
  const NBA_GUIDANCE_OUTCOMES: Partial<Record<import('./review/reviewLineageTruth').NBAState, string>> = {
    COMMIT_PENDING: 'Winner locked. Finalization is the next step.',
    FINALIZATION_READY: 'Lineage sealed. Production record is now closed.',
    RECOVERY_REQUIRED: 'Retry enqueued. Monitor for recovery.',
    DIVERGENCE_DETECTED: 'Shootout opened. Evaluate outputs to resolve truth.',
    SHOOTOUT_ACTIVE: 'Shootout in progress. Resolve the winner to continue.',
  };

  const handleNextBestAction = useCallback(() => {
    if (!nextBestAction || !resolvedProductionFamilyTruth) return;

    const { state } = nextBestAction;
    const lineageRootId = resolvedProductionFamilyTruth.lineageRootId;
    // Only attach guidanceOutcome when the NBA had an active hint (hint-guided path).
    const guidanceOutcome = nextBestAction.predictiveHint ? NBA_GUIDANCE_OUTCOMES[state] : undefined;

    switch (state) {
      case 'SHOOTOUT_ACTIVE':
        // Focus shootout pane if needed, but it's already active
        break;
      case 'RECOVERY_REQUIRED': {
        const failedJobId = resolvedProductionFamilyTruth.latestAttemptJobId;
        if (failedJobId) {
          // Stamp guidanceOutcome onto the job receipt after retry enqueue
          if (guidanceOutcome && failedJobId) {
            pushInlineJobReceipt(failedJobId, { tone: 'info', message: 'Retry enqueued', next: 'Next: Monitor recovery', guidanceOutcome });
            pushInlineFamilyReceipt(lineageRootId, { tone: 'info', message: 'Retry enqueued', next: 'Next: Monitor recovery', guidanceOutcome });
          }
          handleRetryInboxItem({ lineageRootId, targetJobId: failedJobId } as InboxItem);
        }
        break;
      }
      case 'COMMIT_PENDING': {
        const winnerId = resolvedProductionFamilyTruth.bestKnownJobId;
        if (winnerId) {
          // guidanceOutcome is appended inside onSubmitM5Action via handleCommitInboxItem
          // We pass it via a ref so the receipt enrichment is deferred post-action.
          pendingGuidanceOutcomeRef.current = guidanceOutcome;
          handleCommitInboxItem({ lineageRootId, targetJobId: winnerId } as InboxItem);
        }
        break;
      }
      case 'DIVERGENCE_DETECTED': {
        const latestId = resolvedProductionFamilyTruth.latestAttemptJobId;
        if (latestId) handleShootoutInboxItem({ lineageRootId, targetJobId: latestId } as InboxItem);
        break;
      }
      case 'FINALIZATION_READY': {
        const approvedId = resolvedProductionFamilyTruth.approvedOutputJobId;
        const job = approvedId ? renderJobs.find(j => j.id === approvedId) : undefined;
        if (job) {
          pendingGuidanceOutcomeRef.current = guidanceOutcome;
          onSubmitM5Action('finalize_shot', job, 'Guided finalization from NBA');
        }
        break;
      }
      case 'CONTINUE_PRODUCTION': {
        const outputId = resolvedProductionFamilyTruth.approvedOutputJobId || resolvedProductionFamilyTruth.bestKnownJobId || resolvedProductionFamilyTruth.latestAttemptJobId;
        if (outputId) {
          const outJob = renderJobs.find(j => j.id === outputId);
          if (outJob) focusJobOutput(outJob);
        }
        break;
      }
    }
  }, [nextBestAction, resolvedProductionFamilyTruth, renderJobs, handleRetryInboxItem, handleCommitInboxItem, handleShootoutInboxItem, onSubmitM5Action, pushInlineJobReceipt, pushInlineFamilyReceipt]);

  const handleJumpToInboxItem = useCallback((item: InboxItem) => {
    broadcastIntent(item.lineageRootId, 'preparing_commit', 'Commit Winner');

    // Pass 29: always reset artifact focus first so a previous jump's Output crumb
    // never leaks into the next target. focusJobOutput will re-set it if the job
    // has output; if not (failed job), the family+job selection below still lands.
    setArtifactFocus(initialArtifactFocus);

    // Always anchor family + job selection — these drive TopBar breadcrumb,
    // RightInspector, and Session State regardless of artifact availability.
    setSelectedFamilyRootId(item.lineageRootId);

    if (item.targetJobId) {
      setSelectedJobId(item.targetJobId);
      const targetJob = renderJobs.find(j => j.id === item.targetJobId);
      if (targetJob) {
        // Pass 28: also call focusJobOutput for artifact focus when output exists.
        // focusJobOutput is a no-op if job has no resultPaths (e.g. failed jobs),
        // but the selection IDs above are already set so focus still lands.
        focusJobOutput(targetJob, undefined, true, item.label);
      }
    } else {
      setSelectedJobId(undefined);
    }

    pushOperatorFeedback(`Jumping to ${item.label} (${item.reason})`, 'info', 'review', 'transition');
  }, [renderJobs, pushOperatorFeedback, broadcastIntent, focusJobOutput, setSelectedFamilyRootId, setSelectedJobId]);

  const handleResumePersistentTarget = useCallback(() => {
    if (!persistentResumeTarget) return;
    const { jobId, familyRootId, outputPath } = persistentResumeTarget;

    if (jobId) {
      const job = renderJobs.find((j) => j.id === jobId);
      if (job) {
        // Step 3 refinement: use isExplicit=false to restore focus without rewriting memory
        focusJobOutput(job, outputPath, false);
        return;
      }
    }

    if (familyRootId) {
      setSelectedFamilyRootId(familyRootId);
      setSelectedJobId(undefined);
      setArtifactFocus(initialArtifactFocus);
      pushOperatorFeedback(`Resuming focus to family: ${familyRootId.slice(0, 6)}`, 'info', 'open', 'transition');
      return;
    }

    setPersistentResumeTarget(undefined);
  }, [persistentResumeTarget, renderJobs, focusJobOutput, setSelectedFamilyRootId, setSelectedJobId, pushOperatorFeedback]);

  const inboxItems = useMemo(() => {
    const rootIds = new Set<string>();
    renderJobs.forEach((job) => rootIds.add(findLineageRootId(job, renderJobs)));

    const items: InboxItem[] = [];
    rootIds.forEach((rootId) => {
      const rootJob = renderJobs.find((j) => j.id === rootId);
      const shotId = rootJob?.shotId;
      const projection = shotId ? shotProjectionByShotId.get(shotId) : undefined;

      const familyTruth = resolveProductionFamilyTruth({
        lineageRootId: rootId,
        familyLabel: `Family ${rootId.slice(0, 6)}`,
        jobs: renderJobs,
        projection,
        actionAuditByJobId,
      });

      const risk = resolveRiskForecast({
        family: familyTruth,
        activities: presenceState.activities,
        conflicts: resolveConflicts(rootId),
      });

      const item = resolveInboxItem(familyTruth, renderJobs, risk);
      if (item) items.push(item);
    });

    const priorityScore: Record<InboxItem['priority'], number> = {
      critical: 0,
      needs_commit: 1,
      diverged: 2,
      none: 3,
    };

    return items
      .filter((item) => !dismissedInboxItemIds.has(item.lineageRootId))
      .sort((a, b) => priorityScore[a.priority] - priorityScore[b.priority]);
  }, [renderJobs, shotProjectionByShotId, actionAuditByJobId, dismissedInboxItemIds, presenceState.activities, resolveConflicts]);

  const globalHandoff = useMemo(() => {
    const lastDecisionEvent = reviewSnapshot.eventLog
      .filter((e) => e.eventType.startsWith('review.action.'))
      .sort((a, b) => b.occurredAt - a.occurredAt)[0];

    const targetJobId = persistentResumeTarget?.jobId;
    const targetFamilyId = persistentResumeTarget?.familyRootId;

    // Pass 37: Enhanced suppression
    // 1. Target is already focused
    // 2. Target family is already resolved (approved/finalized)
    const isTargetResolved = (() => {
      if (!targetFamilyId) return false;
      const familyJobs = renderJobs.filter(j => findLineageRootId(j, renderJobs) === targetFamilyId);
      return familyJobs.some(j => {
        const audit = actionAuditByJobId.get(j.id);
        return audit?.actionState === 'approved' || audit?.actionState === 'finalized';
      });
    })();

    const isSuppressed = persistentResumeTarget && (
      (persistentResumeTarget.jobId === selectedJobId) ||
      (persistentResumeTarget.familyRootId === selectedFamilyRootId && !selectedJobId) ||
      isTargetResolved
    );

    let readiness: 'ready' | 'stale' | 'unavailable' | undefined = undefined;
    if (persistentResumeTarget && targetJobId) {
      const job = renderJobs.find(j => j.id === targetJobId);
      if (!job) {
        readiness = 'unavailable';
      } else {
        const rootId = persistentResumeTarget.familyRootId;
        const familyJobs = rootId ? renderJobs.filter(j => findLineageRootId(j, renderJobs) === rootId) : [];
        const approvedJob = familyJobs.find(j => {
          const audit = actionAuditByJobId.get(j.id);
          return audit?.actionState === 'approved' || audit?.actionState === 'finalized';
        });
        const latestJob = familyJobs.sort((a, b) => b.createdAt - a.createdAt)[0];

        if (approvedJob && approvedJob.id !== targetJobId) {
          readiness = 'stale';
        } else if (latestJob && latestJob.id !== targetJobId && latestJob.createdAt > job.createdAt) {
          readiness = 'stale';
        } else {
          readiness = 'ready';
        }
      }
    }

    const resumeTarget = (persistentResumeTarget && !isSuppressed) ? {
      title: persistentResumeTarget.title,
      cta: persistentResumeTarget.cta,
      onTrigger: handleResumePersistentTarget,
      readiness,
    } : (nextBestAction && nextBestAction.title) ? {
      title: nextBestAction.title,
      cta: 'Resume',
      onTrigger: handleNextBestAction,
    } : (inboxItems.length > 0) ? {
      title: `Review ${inboxItems[0].label}`,
      cta: 'Triage',
      onTrigger: () => handleJumpToInboxItem(inboxItems[0]),
    } : undefined;

    return {
      currentFocusLabel: resolvedProductionFamilyTruth?.familyLabel,
      lastOperatorDecision: lastDecisionEvent ? {
        description: lastDecisionEvent.eventType.split('.').pop()?.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) ?? 'Action',
        occurredAt: lastDecisionEvent.occurredAt,
        jobId: lastDecisionEvent.jobId,
      } : undefined,
      inboxPressure: {
        critical: inboxItems.filter((i) => i.priority === 'critical').length,
        needsCommit: inboxItems.filter((i) => i.priority === 'needs_commit').length,
      },
      resumeAction: resumeTarget,
    };
  }, [persistentResumeTarget, selectedJobId, selectedFamilyRootId, renderJobs, actionAuditByJobId, reviewSnapshot.eventLog, inboxItems, nextBestAction, handleNextBestAction, handleJumpToInboxItem, resolvedProductionFamilyTruth?.familyLabel]);

  const workspaceView = (
    <div className="flex h-full min-h-0 flex-col bg-bg text-text">
      <TopBar renderStatus={previewState.mode} streamState={streamState} lastEventAt={lastStreamEventAt} currentFocus={currentFocus} />
      <div
        className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-x-0 bg-[#050505] transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: `${isLeftPanelCollapsed ? '3rem' : 'clamp(210px, 18vw, 16rem)'} minmax(0, 1fr) ${isRightPanelCollapsed ? '3rem' : 'clamp(270px, 24vw, 20rem)'}` }}
      >
        <LeftSidebar
          scenes={scenes}
          selectedSceneId={appState.selectedSceneId}
          onSelectScene={onSelectScene}
          isCollapsed={isLeftPanelCollapsed}
          isFocusMode={isFocusMode}
          onToggleCollapse={() => setIsLeftPanelCollapsed((prev) => !prev)}
          inboxItems={inboxItems}
          onJumpToInboxItem={handleJumpToInboxItem}
          onRetryInboxItem={handleRetryInboxItem}
          onCommitInboxItem={handleCommitInboxItem}
          onShootoutInboxItem={handleShootoutInboxItem}
          onDismissInboxItem={handleDismissInboxItem}
          selectedFamilyRootId={selectedFamilyRootId}
          selectedJobId={selectedJobId}
          handoff={globalHandoff}
          presenceActivities={presenceState.activities}
          operators={presenceState.activeOperators}
          conflicts={selectedFamilyRootId ? resolveConflicts(selectedFamilyRootId) : []}
        />
        <CenterWorkspace
          nextBestAction={nextBestAction}
          onNextBestAction={handleNextBestAction}
          isFocusMode={isFocusMode}
          engineTargetLabel={resolvedDisplayEngine}
          onPauseQueue={() => {
            pushOperatorFeedback('Queue on hold', 'info', 'queue');
            queueActions.pauseQueue();
          }}
          onResumeQueue={() => {
            pushOperatorFeedback('Queue live', 'ok', 'queue');
            queueActions.resumeQueue();
          }}
          onClearQueue={() => {
            pushOperatorFeedback('Queue clear', 'info', 'queue');
            queueActions.clearQueue();
          }}
          scene={selectedScene}
          graph={graphForCompile}
          selectedGraphNodeId={selectedGraphNodeId}
          selectedShotNodeId={selectedShotNodeId}
          livePreview={livePreview}
          operatorFeedback={operatorFeedback}
          launchReadiness={launchReadiness}
          jobCounts={runtimeJobCounts}
          runtimeSignalContext={runtimeSignalContext}
          onRenderScene={onRenderScene}
          dismissedFailureIds={dismissedFailureIds}
          onDismissFailure={(jobId) => setDismissedFailureIds((prev: Set<string>) => new Set(prev).add(jobId))}
          onJumpToLive={onJumpToLive}
          restorationSignal={restorationSignal}
          winnerChangedSignal={winnerChangedSignal}
          selectedJobQuickActions={refinedJobQuickActions}
          selectedFamilyQuickActions={refinedFamilyQuickActions}
          onSelectGraphNode={(nodeId) => {
            if (!selectedScene) return;
            setSelectedGraphNodeByScene((prev) => {
              const next = { ...prev };
              if (!nodeId) {
                delete next[selectedScene.id];
                return next;
              }
              next[selectedScene.id] = nodeId;
              return next;
            });
            setSelectedJobId(undefined);
            if (nodeId) pushOperatorFeedback('Focus moved to graph node', 'info', 'open', 'transition');
          }}
          onLoadGraphTemplate={onLoadGraphTemplate}
          onMoveGraphNode={(nodeId, x, y) => {
            if (!selectedScene) return;
            applyGraphEdit(
              selectedScene.id,
              (graph) => ({
                ...graph,
                nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, position: { x, y } } : node)),
              }),
              false
            );
          }}
          onCommitGraphNodeDrag={(nodeId, startX, startY, endX, endY) => {
            if (!selectedScene) return;
            applyGraphEdit(
              selectedScene.id,
              (graph) => ({
                ...graph,
                nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, position: { x: endX, y: endY } } : node)),
              }),
              false
            );
            commitDragHistory(selectedScene.id, nodeId, startX, startY);
          }}
          onCreateGraphConnection={(from, to) => {
            if (!selectedScene) return;
            applyGraphEdit(selectedScene.id, (graph) => {
              const exists = graph.connections.some((connection) => connection.from === from && connection.to === to);
              if (exists) return graph;
              return {
                ...graph,
                connections: [...graph.connections, { id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, from, to }],
              };
            });
          }}
          onDeleteGraphConnection={(connectionId) => {
            if (!selectedScene) return;
            applyGraphEdit(selectedScene.id, (graph) => ({
              ...graph,
              connections: graph.connections.filter((connection) => connection.id !== connectionId),
            }));
          }}
          onAddGraphNode={(type) => {
            if (!selectedScene) return;
            applyGraphEdit(selectedScene.id, (graph) => {
              const count = graph.nodes.filter((node) => node.type === type).length;
              const meta = graphTypeMeta[type];
              const position = findSmartNodePlacement(graph, type);
              const enginePool: Array<Exclude<EngineTarget, 'auto'>> = ['flux', 'comfyui', 'veo', 'runway'];
              const nextEngine = type === 'engine_target' ? enginePool[count % enginePool.length] : undefined;
              const workflowMetadata =
                type === 'review_node'
                  ? ({ review_mode: 'director pass', frame_selection: 'key moments', quality_status: 'pending', post_stage: 'review', post_status: 'pending' } as const)
                  : type === 'edit_node'
                    ? ({ timeline_length: '00:00:30', clip_count: 0, edit_status: 'assembly', post_stage: 'edit', post_status: 'pending' } as const)
                    : type === 'export_node'
                      ? ({ export_format: 'mp4', resolution: '3840x2160', codec: 'h.264', post_stage: 'export', post_status: 'pending' } as const)
                      : type === 'delivery_node'
                        ? ({ delivery_target: 'internal screening', publish_status: 'not published', post_stage: 'delivery', post_status: 'pending' } as const)
                        : {};
              return {
                ...graph,
                nodes: [
                  ...graph.nodes,
                  {
                    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type,
                    title: `${meta.category} ${count + 1}`,
                    category: meta.category,
                    role: meta.role,
                    isActive: true,
                    engineTarget: nextEngine,
                    routeSource: type === 'engine_target' ? 'engine_router' : undefined,
                    ...workflowMetadata,
                    position,
                  },
                ],
              };
            });
          }}
          onDeleteGraphNode={(nodeId) => {
            if (!selectedScene) return;
            applyGraphEdit(selectedScene.id, (graph) => ({
              ...graph,
              nodes: graph.nodes.filter((node) => node.id !== nodeId),
              connections: graph.connections.filter((connection) => connection.from !== nodeId && connection.to !== nodeId),
            }));
          }}
          onResetGraph={() => {
            if (!selectedScene) return;
            resetGraphToTemplateBaseline(selectedScene.id, selectedScene.name);
          }}
          onUndoGraphEdit={() => {
            if (!selectedScene) return;
            const sceneId = selectedScene.id;
            const history = graphHistory[sceneId];
            if (!history?.undo.length) return;
            const currentGraph = graphStates[sceneId];
            const previousGraph = history.undo[history.undo.length - 1];
            setGraphStates((prev) => ({ ...prev, [sceneId]: previousGraph }));
            setGraphHistory((prev) => ({
              ...prev,
              [sceneId]: {
                undo: history.undo.slice(0, -1),
                redo: currentGraph ? [...history.redo, currentGraph] : history.redo,
              },
            }));
            upsertSceneGraph(sceneId, previousGraph);
          }}
          onRedoGraphEdit={() => {
            if (!selectedScene) return;
            const sceneId = selectedScene.id;
            const history = graphHistory[sceneId];
            if (!history?.redo.length) return;
            const currentGraph = graphStates[sceneId];
            const nextGraph = history.redo[history.redo.length - 1];
            setGraphStates((prev) => ({ ...prev, [sceneId]: nextGraph }));
            setGraphHistory((prev) => ({
              ...prev,
              [sceneId]: {
                undo: currentGraph ? [...history.undo, currentGraph] : history.undo,
                redo: history.redo.slice(0, -1),
              },
            }));
            upsertSceneGraph(sceneId, nextGraph);
          }}
          canUndoGraphEdit={Boolean(currentHistory?.undo.length)}
          canRedoGraphEdit={Boolean(currentHistory?.redo.length)}
          currentRoutePresetId={activeRoutePresetId}
          onRoutePresetChange={onRoutePresetChange}
          postPipelineCollapsed={postPipelineCollapsed}
          onTogglePostPipelineCollapse={() => setPostPipelineCollapsed((prev) => !prev)}
          activeShotTitle={activeShot?.title}
          shotQueue={shotQueueSummary}
          renderJobs={runtimeJobs}
          selectedJob={selectedJob}
          selectedJobId={selectedJobId}
          selectedFamilyRootId={selectedFamilyRootId}
          productionFamily={productionFamily}
          selectedJobAuthority={selectedJobAuthority?.previewAuthority}
          resolvedPreviewContext={resolvedPreviewContext ? {
            ...resolvedPreviewContext,
            currentOutput: { ...resolvedPreviewContext.currentOutput },
            selectedOutput: { ...resolvedPreviewContext.selectedOutput },
            approvedOutput: { ...resolvedPreviewContext.approvedOutput },
            deliverableReadyOutput: { ...resolvedPreviewContext.deliverableReadyOutput },
          } : undefined}
          onSubmitM5Action={onSubmitM5Action}
          m5ActionFeedback={selectedJob ? m5ActionFeedbackByJob[selectedJob.id] : undefined}
          inlineActionReceipt={selectedJob ? inlineActionReceiptByJob[selectedJob.id] : undefined}
          familyInlineActionReceipt={productionFamily ? inlineActionReceiptByFamily[productionFamily.lineageRootId] : undefined}
          m5ActionGuards={m5ActionGuards}
          shotReviewById={shotReviewById}
          pinnedJobId={pinnedJobId}
          selectedOutputPath={selectedOutputPath}
          retryContext={retryContext}
          onSelectOutput={(outputPath: string) => {
            if (!selectedJob || !outputPath) return;
            focusJobOutput(selectedJob, outputPath);
          }}
          onOpenSelectedOutput={() => {
            if (!selectedOutputPath || !selectedJob) return;
            const familyRootId = findLineageRootId(selectedJob, renderJobs);
            setSelectedFamilyRootId(familyRootId);
            setSelectedJobId(selectedJob.id);
            pushInlineJobReceipt(selectedJob.id, { tone: 'info', message: 'Selected output opened', next: 'Next: Review this output or open its folder' });
            pushInlineFamilyReceipt(familyRootId, { tone: 'info', message: 'Selected output opened', next: 'Next: Stay on this family and review the opened output' });
            pushOperatorFeedback('Opening preview', 'info', 'open');
            openPath(selectedOutputPath);
          }}
          onInspectHistoricalOutput={() => {
            if (!selectedJob) return;
            const output = selectedOutputPath ?? getDefaultOutputPath(selectedJob);
            if (output) focusJobOutput(selectedJob, output);
          }}
          onFamilyOpenCurrentWinner={(jobId) => {
            const target = jobId ? renderJobs.find((job) => job.id === jobId) : undefined;
            if (!target) return;
            const familyRootId = findLineageRootId(target, renderJobs);
            setSelectedFamilyRootId(familyRootId);
            setSelectedJobId(target.id);
            pushInlineFamilyReceipt(familyRootId, { tone: 'info', message: 'Current output opened, focus remains on this family.' });
            const output = selectedOutputByJob[target.id] ?? getDefaultOutputPath(target);
            if (output) focusJobOutput(target, output);
          }}
          onFamilyOpenApprovedOutput={(jobId) => {
            const target = jobId ? renderJobs.find((job) => job.id === jobId) : undefined;
            if (!target) return;
            const familyRootId = findLineageRootId(target, renderJobs);
            setSelectedFamilyRootId(familyRootId);
            setSelectedJobId(target.id);
            pushInlineFamilyReceipt(familyRootId, { tone: 'ok', message: 'Approved output opened. Focus remains on this family.' });
            const output = selectedOutputByJob[target.id] ?? getDefaultOutputPath(target);
            if (output) focusJobOutput(target, output);
          }}
          onFamilyJumpToReplacement={(jobId) => {
            const target = jobId ? renderJobs.find((job) => job.id === jobId) : undefined;
            if (!target) return;
            const familyRootId = findLineageRootId(target, renderJobs);
            setSelectedFamilyRootId(familyRootId);
            setSelectedJobId(target.id);
            pushInlineFamilyReceipt(familyRootId, { tone: 'info', message: 'Replacement opened, focus remains on this family.' });
            const output = selectedOutputByJob[target.id] ?? getDefaultOutputPath(target);
            if (output) focusJobOutput(target, output);
          }}
          onFamilyRetryLatestAttempt={async (jobId) => {
            const seedJob = jobId ? renderJobs.find((job) => job.id === jobId) : undefined;
            const familyRootId = seedJob ? findLineageRootId(seedJob, renderJobs) : selectedFamilyRootId;
            const familyJobs = familyRootId
              ? renderJobs.filter((job) => findLineageRootId(job, renderJobs) === familyRootId).sort((a, b) => b.createdAt - a.createdAt)
              : [];
            const retryTarget = familyJobs.find((job) => job.state === 'failed' && job.bridgeJob.sceneId && job.bridgeJob.payload?.prompt && job.bridgeJob.payload?.routeContext?.activeRoute && job.bridgeJob.payload?.routeContext?.strategy)
              ?? seedJob;
            if (!retryTarget) return;
            setSelectedFamilyRootId(familyRootId ?? findLineageRootId(retryTarget, renderJobs));
            setSelectedJobId(retryTarget.id);
            setIsRendering(true);
            try {
              await runRenderPipelineFromBridgeJob(retryTarget, {
                onQueueUpdate: (job) => {
                  const jobs = listRenderJobs();
                  const counts = getRenderJobCounts();
                  setRuntimeJobCounts(counts);
                  setJobCounts(counts);
                  setRuntimeJobs(() => jobs);
                  setRenderJobs(() => jobs);
                  if (job.state === 'completed') {
                    const defaultOutput = getDefaultOutputPath(job);
                    if (defaultOutput) {
                      setSelectedOutputByJob((prev) => ({ ...prev, [job.id]: prev[job.id] ?? defaultOutput }));
                    }
                    setSelectedFamilyRootId(findLineageRootId(job, jobs));
                    setSelectedJobId(job.id);
                    if (defaultOutput) focusJobOutput(job, defaultOutput);
                  }
                },
                onPreviewUpdate: (state) => {
                  setPreviewState(state);
                  syncLivePreviewFromRenderState(state, retryTarget, activeShot?.id ?? null);
                },
              });
            } finally {
              setIsRendering(false);
            }
          }}
          onFamilyInspectOutput={(jobId: string | undefined, outputPath: string | undefined) => {
            const target = jobId ? renderJobs.find((job) => job.id === jobId) : undefined;
            if (!target) return;
            const familyRootId = findLineageRootId(target, renderJobs);
            setSelectedFamilyRootId(familyRootId);
            setSelectedJobId(target.id);
            pushInlineFamilyReceipt(familyRootId, { tone: 'info', message: 'Family output opened, review detail next.' });
            const output = outputPath ?? selectedOutputByJob[target.id] ?? getDefaultOutputPath(target);
            if (output) focusJobOutput(target, output);
          }}
          onTogglePinSelectedJob={() => {
            if (!selectedJobId) return;
            setPinnedJobId((prev) => (prev === selectedJobId ? undefined : selectedJobId));
          }}
          onSelectProductionFamily={(lineageRootId, representativeJobId) => {
            setSelectedFamilyRootId(lineageRootId);
            setSelectedJobId(undefined);
            if (lineageRootId) pushOperatorFeedback('Family focus active', 'info', 'open', 'transition');
            if (selectedScene) {
              setSelectedGraphNodeByScene((prev) => {
                if (!(selectedScene.id in prev)) return prev;
                const next = { ...prev };
                delete next[selectedScene.id];
                return next;
              });
            }
            if (representativeJobId) {
              const rep = renderJobs.find((job) => job.id === representativeJobId);
              if (rep) {
                const output = selectedOutputByJob[rep.id] ?? getDefaultOutputPath(rep);
                if (output) focusJobOutput(rep, output);
              }
            }
          }}
          onOpenEvidence={() => {
            const evidenceJob = getSupportingEvidenceJob(lineageFamily) ?? selectedFamilyRepresentativeJob ?? selectedJob;
            if (!evidenceJob) return;
            setSelectedJobId(evidenceJob.id);
            setSelectedFamilyRootId(findLineageRootId(evidenceJob, renderJobs));
            const output = selectedOutputByJob[evidenceJob.id] ?? getDefaultOutputPath(evidenceJob);
            if (output) focusJobOutput(evidenceJob, output);
          }}
          onOpenEvidenceCandidate={(jobId) => {
            const evidenceJob = renderJobs.find((job) => job.id === jobId);
            if (!evidenceJob) return;
            setSelectedJobId(evidenceJob.id);
            setSelectedFamilyRootId(findLineageRootId(evidenceJob, renderJobs));
            const output = selectedOutputByJob[evidenceJob.id] ?? getDefaultOutputPath(evidenceJob);
            if (output) focusJobOutput(evidenceJob, output);
          }}
          onToggleCompareCandidate={onToggleCompareCandidate}
          onCompareSuggestedPair={onCompareSuggestedPair}
          jobModeFilter={jobModeFilter as any}
          onJobModeFilterChange={setJobModeFilter}
          familyDecisionHistory={familyDecisionHistory}
          presenceActivities={presenceState.activities}
          operators={presenceState.activeOperators}
          conflicts={selectedFamilyRootId ? resolveConflicts(selectedFamilyRootId) : []}
          streamState={streamState}
          onToggleLeftCollapse={() => setIsLeftPanelCollapsed((prev) => !prev)}
          onToggleRightCollapse={() => setIsRightPanelCollapsed((prev) => !prev)}
          isLeftCollapsed={isLeftPanelCollapsed}
          isRightCollapsed={isRightPanelCollapsed}
        />
        <RightInspector
          deliveryManifest={deliveryManifest}
          selectedFeedbackSummary={selectedFeedbackSummary}
          scene={selectedScene}
          currentFocus={currentFocus}
          activitySummary={activitySummary}
          fields={baseInspectorFields}
          payload={compiledPayload}
          profiles={memoryProfiles}
          engineTarget={appState.engineTarget}
          inspectorValues={compiledPayload?.payload.parameters ?? {}}
          onEngineTargetChange={onEngineTargetChange}
          onOverrideChange={onOverrideChange}
          onBindProfile={onBindProfile}
          selectedGraphNode={selectedGraphNode}
          selectedGraphContext={selectedGraphContext}
          isCollapsed={isRightPanelCollapsed}
          isFocusMode={isFocusMode}
          onToggleCollapse={() => setIsRightPanelCollapsed((prev) => !prev)}
          presenceActivities={presenceState.activities}
          operators={presenceState.activeOperators}
          conflicts={selectedFamilyRootId ? resolveConflicts(selectedFamilyRootId) : []}
          inboxItems={inboxItems}
          onJumpToInboxItem={handleJumpToInboxItem}
          productionFamily={resolvedProductionFamilyTruth ? {
            familyLabel: resolvedProductionFamilyTruth.familyLabel,
            lineageRootId: resolvedProductionFamilyTruth.lineageRootId,
            familyState: resolvedProductionFamilyTruth.familyState,
            lineageTrail: resolvedProductionFamilyTruth.lineageTrail,
            timelineNodes: resolvedProductionFamilyTruth.timelineNodes,
            currentWinnerJobId: resolvedProductionFamilyTruth.bestKnownJobId,
            approvedOutputJobId: resolvedProductionFamilyTruth.approvedOutputJobId,
            replacementJobId: resolvedProductionFamilyTruth.replacementJobId,
            nextFamilyAction: resolvedProductionFamilyTruth.nextFamilyAction,
            evidenceTargetJobId: resolvedProductionFamilyTruth.evidenceTargetJobId,
            evidenceReason: resolvedProductionFamilyTruth.evidenceReason,
            rankedEvidenceCandidates: resolvedProductionFamilyTruth.rankedEvidenceCandidates,
          } : undefined}
          selectedJobTelemetry={selectedJob ? {
            status: selectedJob.state === 'failed' ? 'attention required' : selectedJob.state === 'completed' ? 'ready' : 'active',
            lifecycle: selectedJob.state,
            mode: selectedJob.bridgeJob.outputType === 'video' ? 'cinematic' : 'studio_run',
            activeRoute: selectedJob.bridgeJob.payload.routeContext.activeRoute,
            strategy: selectedJob.bridgeJob.payload.routeContext.strategy,
            preflight: selectedJob.state === 'queued' ? 'pending' : selectedJob.state === 'preflight' ? 'running checks' : selectedJob.state === 'failed' ? 'failed' : 'passed',
            dependencyHealth: selectedJob.state === 'failed' ? 'degraded' : selectedJob.state === 'preflight' ? 'checking' : 'healthy',
            canonicalState: selectedJobAuthority?.canonicalState,
            authoritativeOutput: selectedJobAuthority?.authoritativeOutput,
            previewAuthority: selectedJobAuthority?.previewAuthority,
            lineageSummary: selectedJobAuthority?.lineageSummary,
            nextAction: selectedJobAuthority?.nextAction,
            lastMeaningfulChange: selectedJobAuthority?.lastMeaningfulChange,
            currentWinnerJobId: selectedJobAuthority?.currentWinnerJobId,
            approvedOutputJobId: selectedJobAuthority?.approvedOutputJobId,
            replacementJobId: selectedJobAuthority?.replacementJobId,
            selectedJobId: selectedJobAuthority?.selectedJobId,
            selectedOutputPath: selectedJobAuthority?.selectedOutputPath,
            failedStage: selectedJob.state === 'failed' ? selectedJob.failedStage : undefined,
            failureReason: selectedJob.state === 'failed' ? selectedJob.error : undefined,
            manifestPath: selectedJob.manifestPath,
            pinned: pinnedJobId === selectedJob.id,
            metadata: selectedJob.metadata,
            technicalSpecs: {
              resolution: String(selectedJob.bridgeJob.payload.parameters['resolution'] || ''),
              codec: String(selectedJob.bridgeJob.payload.parameters['codec'] || ''),
              exportFormat: String(selectedJob.bridgeJob.payload.parameters['export_format'] || ''),
            },
          } : undefined}
          runtimeSignalContext={runtimeSignalContext}
          livePreview={livePreview}
          resolvedPreviewContext={resolvedPreviewContext ? {
            ...resolvedPreviewContext,
            currentOutput: { ...resolvedPreviewContext.currentOutput },
            selectedOutput: { ...resolvedPreviewContext.selectedOutput },
            approvedOutput: { ...resolvedPreviewContext.approvedOutput },
            deliverableReadyOutput: { ...resolvedPreviewContext.deliverableReadyOutput },
          } : undefined}
          sceneReviewBoard={sceneReviewBoard}
          shotQueue={shotQueueSummary}
          activeShotId={activeShot?.id}
          shotJobLedger={shotJobLedger}
          shotLedgerScope={shotLedgerScope}
          onShotLedgerScopeChange={setShotLedgerScope}
          selectedShotForLedger={selectedShotForLedger}
          onSelectJobFromLedger={(jobId) => {
            setSelectedJobId(jobId);
            if (!selectedScene) return;
            setSelectedGraphNodeByScene((prev) => {
              if (!(selectedScene.id in prev)) return prev;
              const next = { ...prev };
              delete next[selectedScene.id];
              return next;
            });
          }}
          onJumpToShotFromLedger={(shotId) => {
            if (!selectedScene) return;
            setSelectedGraphNodeByScene((prev) => ({ ...prev, [selectedScene.id]: shotId }));
            setSelectedJobId(undefined);
          }}
          onShotAction={onShotExecutionAction}
          onPostWorkflowAction={onPostWorkflowAction}
          selectedJobQuickActions={refinedJobQuickActions}
          familyDecisionHistory={familyDecisionHistory}

          onOpenEvidence={() => {
            const evidenceJob = getSupportingEvidenceJob(lineageFamily) ?? selectedFamilyRepresentativeJob ?? selectedJob;
            if (!evidenceJob) return;
            setSelectedJobId(evidenceJob.id);
            setSelectedFamilyRootId(findLineageRootId(evidenceJob, renderJobs));
            const output = selectedOutputByJob[evidenceJob.id] ?? getDefaultOutputPath(evidenceJob);
            if (output) focusJobOutput(evidenceJob, output);
          }}
          onOpenEvidenceCandidate={(jobId) => {
            const evidenceJob = renderJobs.find((job) => job.id === jobId);
            if (!evidenceJob) return;
            setSelectedJobId(evidenceJob.id);
            setSelectedFamilyRootId(findLineageRootId(evidenceJob, renderJobs));
            const output = selectedOutputByJob[evidenceJob.id] ?? getDefaultOutputPath(evidenceJob);
            if (output) focusJobOutput(evidenceJob, output);
          }}
          onToggleCompareCandidate={onToggleCompareCandidate}
          streamState={streamState}
        />
        <BottomTimeline
          clips={timelineState.clips}
          playheadPositionMs={timelineState.playheadPositionMs}
          sessionStartMs={timelineState.sessionStartMs}
          sessionEndMs={timelineState.sessionEndMs}
          selectedClipId={appState.selectedClipId}
          onSelectClip={(clipId) => setAppState((prev: typeof initialAppState) => ({ ...prev, selectedClipId: clipId }))}
          onScrub={handleTimelineScrub}
          shotAuthorityMap={shotAuthorityMap}
          selectedOverrideClipId={selectedOverrideClipId}
        />
      </div>
    </div>
  );

  const interventionEvents = useMemo(() => listInterventionEvents(), [interventionVersion]);

  const interventionProjections = useMemo(() => replayInterventionEvents(interventionEvents), [interventionEvents]);

  const interventionById = useMemo(() => new Map(interventionProjections.map((item) => [item.id, item])), [interventionProjections]);

  const appendInterventionAndRefresh = () => setInterventionVersion((prev) => prev + 1);

  const createInterventionFromContext = (reasonCode: string, impactSummary: string, overrideJobId?: string) => {
    const interventionId = createIntervention({
      actor: 'operator',
      sourceJobId: overrideJobId ?? selectedJob?.id,
      sourceShotId: selectedJob?.shotId,
      sourceSceneId: selectedScene?.id,
      reasonCode,
      impactSummary,
    });
    appendInterventionAndRefresh();
    setSelectedInterventionId(interventionId);
    setActiveM6Screen('interventions');
    return interventionId;
  };

  const onInterventionAction = (id: string, action: 'assign' | 'escalate' | 'resolve' | 'close' | 'clear') => {
    const projection = interventionById.get(id);
    if (!projection) return;
    applyInterventionAction({
      interventionId: id,
      actionType: action,
      actor: 'operator',
      assignee: action === 'assign' ? (projection.assignee ?? 'ops.primary') : projection.assignee,
      reasonCode:
        action === 'assign'
          ? 'operator_assignment'
          : action === 'escalate'
            ? 'risk_escalation'
            : action === 'resolve'
              ? 'resolution_confirmed'
              : action === 'close'
                ? 'case_closed'
                : 'queue_cleared',
      impactSummary:
        action === 'assign'
          ? 'Intervention ownership assigned for deterministic follow-through.'
          : action === 'escalate'
            ? 'Intervention priority escalated due to trust/risk impact.'
            : action === 'resolve'
              ? 'Intervention resolved and authority state stabilized.'
              : action === 'close'
                ? 'Intervention closed after resolution evidence review.'
                : 'Intervention cleared from active queue without deleting history.',
    });

    if (action === 'resolve' && projection.sourceJobId) {
      const job = renderJobs.find((j) => j.id === projection.sourceJobId);
      if (job && job.state === 'failed') {
        quickActionHandlers.onRetry(job);
      }
    }

    appendInterventionAndRefresh();
  };

  const interventionItems = useMemo(() => {
    const now = Date.now();
    const fromEvents = interventionProjections.map((entry) => {
      const linkedJob = entry.sourceJobId ? renderJobs.find((job) => job.id === entry.sourceJobId) : undefined;
      const projection = entry.sourceShotId ? shotProjectionByShotId.get(entry.sourceShotId) : undefined;
      const priority = entry.status === 'escalated' ? 'urgent' : entry.status === 'open' || entry.status === 'assigned' ? 'high' : 'normal';
      const canonicalJob = linkedJob ? deriveCanonicalRunSurface(linkedJob, projection, actionAuditByJobId.get(linkedJob.id)) : undefined;
      const ageMs = Math.max(0, now - new Date(entry.updatedAt).getTime());
      const ageMin = Math.round(ageMs / 60000);
      return {
        id: entry.id,
        title: linkedJob ? `${linkedJob.engine.toUpperCase()} intervention` : `Intervention ${entry.id.slice(-6)}`,
        sourceRunLabel: entry.sourceJobId,
        sourceSceneLabel: selectedScene?.name,
        priority,
        confidenceGapLabel: `${Math.round(((projection?.measuredSignals?.operatorConfidence ?? 0) * 100))}%`,
        trustStateLabel: entry.status,
        agingLabel: ageMin >= 60 ? `${Math.floor(ageMin / 60)}h` : `${ageMin}m`,
        canonicalStateLabel: entry.status,
        evidenceSummary: canonicalJob?.diagnostics ?? projection?.explanations?.summary ?? 'Intervention event-derived evidence.',
        recommendationSummary: entry.lastReasonCode,
        decisionContextSummary: entry.lastImpactSummary,
        auditTraceLabel: `${entry.historyCount} events`,
        latencyLabel: `${ageMin}m since last action`,
        stale: ageMin >= 20 && (entry.status === 'open' || entry.status === 'assigned' || entry.status === 'escalated'),
      } as const;
    });

    return fromEvents;
  }, [interventionProjections, renderJobs, selectedScene?.name, shotProjectionByShotId, actionAuditByJobId]);

  const auditReplayEvents = useMemo(() => {
    const reviewEvents = reviewSnapshot.eventLog.map((event) => ({
      id: event.eventId,
      occurredAt: event.occurredAt,
      occurredAtLabel: new Date(event.occurredAt).toLocaleTimeString(),
      eventTypeLabel: event.eventType,
      status: event.eventType.includes('rejected') ? 'blocked' as const : event.eventType.includes('failed') ? 'error' as const : event.eventType.includes('approved') ? 'ok' as const : 'info' as const,
      runLabel: event.jobId,
      actorLabel: (event.payload as any)?.actor?.approvedBy,
      commandLabel: event.eventType,
      outcomeLabel: event.eventType,
      canonicalStateLabel: selectedJobReview?.actionState ?? selectedJobReview?.decisionOutputs.approvalStatus ?? 'pending',
      beforeContext: 'Pre-action state captured from prior event context.',
      afterContext: 'Post-action state recorded in append-only event log.',
      trustDecisionSummary: 'Trust decision persisted via review runtime event stream.',
      traceId: event.eventId,
      linkedRunId: event.jobId,
      linkedIntentId: event.jobId,
    }));

    const interventionAudit = interventionEvents.map((event) => ({
      id: event.eventId,
      occurredAt: event.occurredAt,
      occurredAtLabel: new Date(event.occurredAt).toLocaleTimeString(),
      eventTypeLabel: `intervention.${event.actionType}`,
      status: event.actionType === 'escalate' ? 'blocked' as const : event.actionType === 'resolve' ? 'ok' as const : 'info' as const,
      runLabel: event.sourceJobId,
      actorLabel: event.actor,
      commandLabel: `intervention.${event.actionType}`,
      outcomeLabel: event.reasonCode,
      canonicalStateLabel: interventionById.get(event.interventionId)?.status ?? 'open',
      beforeContext: `Intervention ${event.interventionId} prior state replayed from event stream.`,
      afterContext: event.impactSummary,
      trustDecisionSummary: `Reason ${event.reasonCode}; append-only intervention authority event persisted.`,
      traceId: event.eventId,
      linkedRunId: event.sourceJobId,
      linkedIntentId: event.interventionId,
    }));

    return [...reviewEvents, ...interventionAudit]
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
      .slice(0, 40);
  }, [interventionById, interventionEvents, reviewSnapshot.eventLog, selectedJobReview?.actionState, selectedJobReview?.decisionOutputs.approvalStatus]);

  const operatorProjection = useMemo(() => {
    const now = Date.now();
    const streamLagMs = lastStreamEventAt ? Math.max(0, now - lastStreamEventAt) : undefined;
    const streamLagSec = streamLagMs ? Math.round(streamLagMs / 1000) : undefined;
    const stale = streamLagMs ? streamLagMs > 45000 : streamState !== 'connected';
    const waitStateLabel = streamState === 'offline'
      ? 'offline'
      : streamLagMs && streamLagMs > 15000
        ? 'waiting on stream'
        : 'live';

    const recentReconcile = reviewSnapshot.eventLog
      .filter((event) => event.eventType.includes('reconcile'))
      .slice(-1)[0];
    const latestRuntimeTimeline = runtimeTimeline[0];
    const latestRuntimeRecent = runtimeRecentRenders[0];

    const selectedCommandIntent = parseCommandIntent(commandInput.trim() || selectedCommandTemplate || '').intent;
    const commandIntentLabel = selectedCommandIntent === 'none' ? 'idle' : selectedCommandIntent.replace('_', ' ');

    const commandRiskLabel =
      selectedCommandIntent === 'retry' || selectedCommandIntent === 'reconcile'
        ? 'medium'
        : selectedCommandIntent === 'cancel'
          ? 'high'
          : selectedCommandIntent === 'open_manifest' || selectedCommandIntent === 'open_artifact'
            ? 'low'
            : selectedCommandIntent === 'unknown'
              ? 'blocked'
              : 'none';

    const expectedResultLabel =
      selectedCommandIntent === 'retry'
        ? 'enqueue lineage-safe retry'
        : selectedCommandIntent === 'cancel'
          ? 'request runtime-aware cancellation'
          : selectedCommandIntent === 'reconcile'
            ? 'refresh canonical projection'
            : selectedCommandIntent === 'open_manifest'
              ? 'open metadata file'
              : selectedCommandIntent === 'open_artifact'
                ? 'open rendered output'
                : selectedCommandIntent === 'unknown'
                  ? 'no-op'
                  : 'await command';

    const nextBestActionLabel =
      selectedCommandIntent === 'unknown'
        ? 'use retry/cancel/reconcile/open'
        : selectedCommandIntent === 'none'
          ? 'dry-run before execute'
          : selectedCommandIntent === 'cancel'
            ? 'send blocked flow to intervention if denied'
            : 'execute when validation passes';

    const commandUnavailableReason =
      selectedCommandIntent === 'none'
        ? 'enter a command or choose a template'
        : selectedCommandIntent === 'unknown'
          ? 'unsupported command; use retry/cancel/reconcile/open'
          : selectedCommandIntent === 'retry'
            ? canRetrySelectedJob
              ? undefined
              : 'retry requires a failed selected run with complete metadata'
            : selectedCommandIntent === 'cancel'
              ? selectedJob && ['queued', 'preflight', 'running', 'packaging'].includes(selectedJob.state)
                ? undefined
                : 'cancel requires a queued/running selected run'
              : selectedCommandIntent === 'open_manifest'
                ? selectedJob
                  ? undefined
                  : 'open manifest requires a selected run'
                : selectedCommandIntent === 'open_artifact'
                  ? selectedOutputPath
                    ? undefined
                    : 'open artifact requires a resolved output path'
                  : undefined;

    return {
      latencyChipLabel: streamLagSec !== undefined ? `${streamLagSec}s stream lag` : 'no stream timestamp',
      waitStateLabel,
      staleLabel: stale ? 'stale' : 'fresh',
      stale,
      quickPathLabel: 'create → assign → resolve',
      commandIntentLabel,
      commandRiskLabel,
      expectedResultLabel,
      nextBestActionLabel,
      executeDisabled: Boolean(commandUnavailableReason),
      executeDisabledReasonLabel: commandUnavailableReason,
      reconcileSteps: [
        `detect: ${stale ? 'drift/lag observed' : 'authority aligned'}`,
        `attempt: ${recentReconcile ? `reconcile seen ${new Date(recentReconcile.occurredAt).toLocaleTimeString()}` : latestRuntimeTimeline?.created_at ? `runtime timeline ${new Date(latestRuntimeTimeline.created_at).toLocaleTimeString()}` : 'await reconcile event'}`,
        `result: ${commandValidationPreview || latestRuntimeRecent?.label || recentReconcile?.eventType || 'no recent result'}`,
        `settled: ${stale ? 'pending authority settle' : 'settled'}`,
      ],
    };
  }, [
    lastStreamEventAt,
    streamState,
    reviewSnapshot.eventLog,
    commandInput,
    selectedCommandTemplate,
    commandValidationPreview,
    canRetrySelectedJob,
    selectedJob,
    selectedOutputPath,
    runtimeTimeline,
    runtimeRecentRenders,
  ]);

  const operatorState = useMemo(() => {
    const commandLog = reviewSnapshot.eventLog.slice(-24).reverse().map((event) => ({
      id: event.eventId,
      commandLabel: event.eventType,
      runOrSessionLabel: event.jobId,
      status: event.eventType.includes('rejected') ? 'blocked' as const : event.eventType.includes('failed') ? 'error' as const : 'ok' as const,
      occurredAtLabel: new Date(event.occurredAt).toLocaleTimeString(),
      detail: event.eventId,
    }));

    const liveRuns = renderJobs.map((job) => {
      const shotProjection = shotProjectionByShotId.get(job.shotId ?? '');
      const actionAudit = actionAuditByJobId.get(job.id);
      const canonical = deriveCanonicalRunSurface(job, shotProjection, actionAudit);
      const diagnostics = canonical.diagnostics ?? 'No diagnostics';
      const failureSummary =
        job.state === 'failed'
          ? `Run failed at ${job.failedStage ?? 'unknown stage'}: ${diagnostics}`
          : canonical.unresolvedAttention
            ? `Run requires attention: ${canonical.canonicalState}`
            : 'No active failure signals.';
      const actionSuggestion =
        job.state === 'failed'
          ? 'Open command console → dry-run retry; escalate intervention if retry is blocked.'
          : canonical.canonicalState === 'needs_revision'
            ? 'Send to intervention rail for assign/resolve quick path.'
            : canonical.unresolvedAttention
              ? 'Inspect diagnostics and reconcile before next action.'
              : 'Continue monitoring.';

      return {
        id: job.id,
        label: `${job.engine.toUpperCase()} • ${job.shotId ?? 'unlinked shot'}`,
        lane: canonical.unresolvedAttention ? 'attention' as const : job.state === 'queued' || job.state === 'preflight' || job.state === 'running' || job.state === 'packaging' ? 'queued' as const : 'active' as const,
        mode: job.bridgeJob.outputType === 'video' ? 'cinematic' as const : 'studio_run' as const,
        canonicalState: canonical.canonicalState,
        route: job.bridgeJob.payload.routeContext.activeRoute,
        diagnostics,
        trustTraceSummary: decisionProposalByJobId.get(job.id)?.eventId ?? (canonical.bestKnown ? `best-known • ${job.id}` : undefined),
        failureSummary,
        actionSuggestion,
        latencyLabel: operatorProjection.latencyChipLabel,
        waitStateLabel: operatorProjection.waitStateLabel,
        stale: operatorProjection.stale,
        pinned: pinnedJobId === job.id,
      };
    });

    return {
      ...operatorProjection,
      liveRuns,
      commandLog,
      resultTraceLines: reviewSnapshot.eventLog.slice(-10).map((event) => `${new Date(event.occurredAt).toISOString()} ${event.eventType}`),
      recentOutcomeSummary: commandValidationPreview || reviewSnapshot.eventLog.at(-1)?.eventType,
      interventions: interventionItems,
      auditEvents: auditReplayEvents,
    };
  }, [
    reviewSnapshot.eventLog,
    renderJobs,
    shotProjectionByShotId,
    actionAuditByJobId,
    decisionProposalByJobId,
    operatorProjection,
    pinnedJobId,
    commandValidationPreview,
    interventionItems,
    auditReplayEvents,
  ]);

  const selectedFailureExplainability = useMemo(() => {
    if (!selectedJob) {
      return {
        summary: 'none',
        suggestion: 'Select a run to view diagnostics and next action.',
      };
    }

    if (selectedJob.state !== 'failed') {
      return {
        summary: selectedJob.error ? `info: ${selectedJob.error}` : 'No failure recorded for selected run.',
        suggestion: 'Continue monitoring or dry-run next command.',
      };
    }

    const raw = selectedJob.error?.trim() || 'Provider returned no diagnostic text.';
    const lower = raw.toLowerCase();
    const suggestion =
      lower.includes('timeout')
        ? 'Suggestion: retry with queue pressure reduced and check provider latency.'
        : lower.includes('auth') || lower.includes('permission')
          ? 'Suggestion: validate provider credentials then reconcile.'
          : lower.includes('cancel')
            ? 'Suggestion: verify operator intent and rerun if cancellation was accidental.'
            : 'Suggestion: open manifest, inspect trace, then enqueue a lineage-safe retry.';

    return {
      summary: `Failure: ${selectedJob.error || 'Unknown error code'}`,
      suggestion,
    };
  }, [selectedJob]);

  const m6Screens: Record<M6ScreenKey, { title: string; subtitle: string; content: ReactNode }> = {
    overview: {
      title: 'SCR-01 Control Room Overview',
      subtitle: 'Triage-first mission control snapshot',
      content: (
        <SCR01_ControlRoom
          systemHealth={streamState === 'connected' ? 'healthy' : 'degraded'}
          streamState={streamState}
          streamTimestampLabel={lastStreamEventAt ? new Date(lastStreamEventAt).toLocaleTimeString() : '—'}
          queueMode={queueMode}
          activeRunLabel={selectedJob?.id}
          activeShotLabel={activeShot?.title}
          progressLabel={`${previewState.progress}%`}
          riskLabel={selectedJobReview?.decisionOutputs.retryRecommendation?.recommend ? 'medium' : 'low'}
          canonicalStateLabel={selectedJobReview?.actionState ?? selectedJobReview?.decisionOutputs.approvalStatus ?? 'pending'}
          nextStepLabel={postPipelineSummary?.activeStage ?? 'monitor'}
          throughputSeries={renderJobs.slice(-12).map((job, idx) => (job.state === 'completed' ? 60 + idx * 2 : job.state === 'failed' ? 20 : 40))}
          alerts={renderJobs.filter((j) => j.state === 'failed').slice(0, 4).map((job) => ({ id: job.id, label: `${job.engine.toUpperCase()} failed`, detail: job.error, severity: 'high' as const }))}
          blockedDecisions={shotQueueSummary.filter((s) => shotProjectionByShotId.get(s.id)?.approvalStatus === 'needs_revision').slice(0, 4).map((shot) => ({ id: shot.id, label: shot.title, detail: 'Needs revision', severity: 'medium' as const }))}
          interventions={interventionItems.slice(0, 4).map((item) => ({ id: item.id, label: item.title, detail: item.canonicalStateLabel, severity: item.priority === 'urgent' ? 'high' as const : item.priority === 'high' ? 'medium' as const : 'low' as const }))}
          events={(reviewSnapshot.eventLog ?? []).slice(-6).reverse().map((event) => ({ id: event.eventId, message: event.eventType, occurredAtLabel: new Date(event.occurredAt).toLocaleTimeString() }))}
          telemetryEvents={telemetryEvents}
          onOpenAttention={() => setActiveM6Screen('interventions')}
          onOpenWorkspace={() => setActiveM6Screen('workspace')}
          onOpenRun={() => setActiveM6Screen('live_runs')}
          onSendToIntervention={() => {
            createInterventionFromContext('manual_triage_request', 'Manual send-to-intervention requested from control room.');
          }}
        />
      ),
    },
    live_runs: {
      title: 'SCR-02 Live Runs Board',
      subtitle: 'Operational lanes for active, queued, and attention runs',
      content: (
        <SCR02_LiveRunsBoard
          healthChips={[`total ${jobCounts.total}`, `rendering ${jobCounts.rendering}`, `queued ${jobCounts.queued}`]}
          queuePressureLabel={`${renderJobs.filter((job) => ['queued', 'preflight', 'running', 'packaging'].includes(job.state)).length} active / ${renderJobs.filter((job) => job.state === 'queued' || job.state === 'preflight').length} queued`}
          slaDriftLabel={streamState === 'connected' ? 'stable' : 'drifting'}
          selectedRunId={selectedJobId}
          runs={operatorState.liveRuns}
          onSelectRun={setSelectedJobId}
          onTogglePinRun={(runId) => setPinnedJobId((prev) => (prev === runId ? undefined : runId))}
          onOpenWorkspace={(runId) => {
            const job = renderJobs.find((j) => j.id === runId);
            if (!job) {
              console.warn(`[DirectorOS] Focus fail: job ${runId} not found in manifest cache.`);
              setActiveM6Screen('workspace');
              return;
            }
            // Anchor scene if different
            if (job.sceneId && job.sceneId !== selectedScene?.id) {
              onSelectScene(job.sceneId);
            }
            // Anchor family, job, and artifact via canonical jump path
            handleJumpToInboxItem({
              lineageRootId: findLineageRootId(job, renderJobs),
              targetJobId: job.id,
              label: job.shotId ?? job.id,
              reason: 'Workspace Focus',
            } as any);
            setActiveM6Screen('workspace');
          }}
          onOpenCommandConsole={() => setActiveM6Screen('console')}
          onCancelRun={(id) => queueActions.cancelJob(id)}
          deliveryRegistryItems={deliveryRegistryItems}
          sequenceReadiness={sequenceReadiness}
          activeSequenceSealEntry={activeSequenceSealEntry}
          onSealSequence={handleSealSequence}
          modeFilter={jobModeFilter}
          onModeFilterChange={setJobModeFilter}
          onJumpToShot={(shotId) => {
            const registryItem = deliveryRegistryItems.find(i => i.shotId === shotId);
            if (registryItem) {
              handleJumpToInboxItem({
                lineageRootId: shotId,
                targetJobId: registryItem.id,
                itemType: 'shot_resolved'
              } as any);
              setActiveM6Screen('workspace');
            }
          }}
          onEscalateToIntervention={(runId) => {
            createInterventionFromContext('run_escalated_from_live_runs', 'Escalated from SCR-02 live runs surface.', runId);
          }}
        />
      ),
    },
    workspace: {
      title: 'SCR-03 Workspace',
      subtitle: 'Graph-first cinematic production surface',
      content: workspaceView,
    },
    console: {
      title: 'SCR-04 Command Console',
      subtitle: 'Deterministic operator command and validation surface',
      content: workspaceView,
    },
    interventions: {
      title: 'SCR-05 Intervention Queue',
      subtitle: 'Human-in-the-loop gate for trust-critical decisions',
      content: (
        <SCR05_InterventionQueue
          queueHealthLabel={sceneReviewBoard?.status ?? 'healthy'}
          urgentCount={interventionProjections.filter((entry) => entry.status === 'escalated').length}
          agingCount={interventionProjections.filter((entry) => entry.status === 'open' || entry.status === 'assigned').length}
          blockedCount={interventionProjections.filter((entry) => entry.status === 'open' || entry.status === 'escalated').length}
          slaCounterLabel={streamState === 'connected' ? 'on target' : 'watch'}
          quickPathLabel={operatorState.quickPathLabel}
          interventions={operatorState.interventions}
          selectedInterventionId={selectedInterventionId}
          onSelectIntervention={setSelectedInterventionId}
          onAssign={(id) => onInterventionAction(id, 'assign')}
          onEscalate={(id) => onInterventionAction(id, 'escalate')}
          onApprove={(id) => onInterventionAction(id, 'resolve')}
          onRevise={(id) => onInterventionAction(id, 'assign')}
          onReject={(id) => onInterventionAction(id, 'escalate')}
          onSupersede={(id) => onInterventionAction(id, 'close')}
          onDefer={(id) => onInterventionAction(id, 'clear')}
          onConfirmAuditTrace={(id) => onInterventionAction(id, 'resolve')}
          onCreateQuickIntervention={() => {
            createInterventionFromContext('quick_create_from_rail', 'Intervention created from quick-path rail.');
          }}
          onJumpToRun={() => setActiveM6Screen('live_runs')}
          onJumpToScene={() => setActiveM6Screen('workspace')}
        />
      ),
    },
    audit: {
      title: 'SCR-06 Audit & Replay Timeline',
      subtitle: 'Append-only forensic replay and incident packet surface',
      content: (
        <SCR06_AuditReplayTimeline
          auditHealthLabel={streamState === 'offline' ? 'degraded' : 'healthy'}
          eventCount={reviewSnapshot.eventLog.length + interventionEvents.length}
          replayScopeLabel={selectedScene?.name ?? 'all scenes'}
          timeWindowLabel='last 24h'
          selectedEventsCount={Math.min(12, reviewSnapshot.eventLog.length + interventionEvents.length)}
          incidentPacketReadinessLabel={reviewSnapshot.eventLog.length + interventionEvents.length ? 'ready' : 'empty'}
          latencyChipLabel={operatorState.latencyChipLabel}
          waitStateLabel={operatorState.waitStateLabel}
          staleLabel={operatorState.staleLabel}
          reconciliationSteps={operatorState.reconcileSteps}
          events={operatorState.auditEvents}
          onJumpToRun={() => setActiveM6Screen('live_runs')}
          onJumpToIntervention={() => setActiveM6Screen('interventions')}
        />
      ),
    },
  };

  const currentScreen = m6Screens[activeM6Screen];

  const commandConsoleOverlay = (
    <OverlaySurface
      id="scr-04-command-console"
      layer="commandPanel"
      open={isCommandConsoleOpen}
      motion="fade-up"
      dismissOnEscape
      dismissOnOutsidePress
      onDismiss={closeCommandConsole}
    >
      <SCR04_CommandConsole
        commandInput={commandInput}
        targetScopeLabel={selectedScene?.name ?? 'global'}
        quickTemplates={commandTemplates}
        selectedTemplate={selectedCommandTemplate}
        validationPreviewLabel={commandValidationPreview || undefined}
        trustImpactPreviewLabel={commandTrustImpactPreview || undefined}
        canonicalContextLabel={selectedJobReview?.actionState ?? selectedJobReview?.decisionOutputs.approvalStatus ?? 'pending'}
        routeSummaryLabel={selectedJob?.bridgeJob.payload.routeContext.activeRoute}
        targetSummaryLabel={selectedJob?.engine}
        diagnosticsSummaryLabel={selectedFailureExplainability.summary}
        commandIntentLabel={operatorState.commandIntentLabel}
        commandRiskLabel={operatorState.commandRiskLabel}
        expectedResultLabel={operatorState.expectedResultLabel}
        nextBestActionLabel={operatorState.nextBestActionLabel}
        commandLog={operatorState.commandLog}
        resultTraceLines={operatorState.resultTraceLines}
        rollbackHints={['Re-run with dry-run first', 'Compare trust impact preview before execute', selectedFailureExplainability.suggestion]}
        recentOutcomeSummary={operatorState.recentOutcomeSummary}
        executeDisabled={operatorState.executeDisabled}
        executeDisabledReasonLabel={operatorState.executeDisabledReasonLabel}
        onCommandInputChange={setCommandInput}
        onSelectTemplate={(template) => {
          setSelectedCommandTemplate(template);
          setCommandInput(template);
          void executeConsoleCommand(template, true);
        }}
        onExecuteCommand={() => {
          const raw = commandInput.trim() || selectedCommandTemplate || '';
          void executeConsoleCommand(raw, false);
        }}
        onDryRunValidate={() => {
          const raw = commandInput.trim() || selectedCommandTemplate || '';
          void executeConsoleCommand(raw, true);
        }}
        onRerunLastCommand={() => {
          if (!lastExecutedCommand) return;
          setCommandInput(lastExecutedCommand);
          void executeConsoleCommand(lastExecutedCommand, false);
        }}
        onOpenImpactedRun={() => {
          setIsCommandConsoleOpen(false);
          setActiveM6Screen('live_runs');
        }}
        onSendBlockedToIntervention={() => {
          createInterventionFromContext('blocked_command_path', 'Blocked command path escalated to intervention queue.');
        }}
      />
    </OverlaySurface>
  );

  if (!isHydrated || !selectedScene || !selectedGraph?.nodes) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#050505] text-[#888]">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#333] border-t-[#8144C0]" />
        <div className="text-sm uppercase tracking-widest">Initializing Control Room...</div>
      </div>
    );
  }

  return (
    <M6_AppShell
      activeScreen={activeM6Screen}
      screenTitle={currentScreen.title}
      screenSubtitle={currentScreen.subtitle}
      systemHealthLabel={streamState === 'connected' ? 'healthy' : 'degraded'}
      streamStateLabel={streamState}
      queueModeLabel={`${runtimeJobCounts.rendering} active / ${runtimeJobCounts.queued} queued`}
      activeContextLabel={selectedScene?.name ?? 'no active scene'}
      attentionLabel={`operator attention ${runtimeJobs.filter((job) => job.state === 'failed').length}`}
      onNavigate={(screen) => {
        if (screen === 'console') {
          openCommandConsole();
          return;
        }
        if (screen === 'workspace' && activeM6Screen !== 'workspace') {
          // Continuity: anchor last selection when returning to workspace
          const targetId = selectedJobId || selectedFamilyRootId;
          if (targetId) {
            setRestorationSignal({ targetId, type: 'screen_return', timestamp: Date.now() });
          }
        }
        setIsCommandConsoleOpen(false);
        setActiveM6Screen(screen);
      }}
      onOpenInterventions={() => {
        setIsCommandConsoleOpen(false);
        setActiveM6Screen('interventions');
      }}
      overlaySlot={commandConsoleOverlay}
    >
      {currentScreen.content}
    </M6_AppShell>
  );
}

export default App;
