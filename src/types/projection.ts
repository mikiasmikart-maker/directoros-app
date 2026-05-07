import type { RenderQueueJob } from '../render/jobQueue';
import type { ShotRuntimeState } from './graph';
import type { ReviewEventEnvelope, ShotReviewProjection } from '../review/types';
import type { RenderPreviewState } from '../render/renderManager';
import type { LivePreviewState } from '../components/workspace/RenderPreview';
import type { FamilyPreviewAuthorityKind, FamilyPreviewEvidenceRole } from '../utils/familyPreviewAuthority';
import type { ReviewApprovalStatus } from '../review/reviewLineageTruth';
import type { SelectedJobNextActionResolution } from '../utils/selectedJobNextAction';

/**
 * [PHASE 1] Projection Boundary Contract.
 * These types define the PASIVE projection of the runtime truth.
 * No state is created here; only labeled, summarized, and decorated.
 */

export interface RuntimeTruthInput {
  jobs: RenderQueueJob[];
  reviewSnapshot: {
    shotProjections: Map<string, ShotReviewProjection>;
    eventLog: ReviewEventEnvelope[];
  };
  previewState: RenderPreviewState;
  livePreview: LivePreviewState;
  selection: {
    jobId?: string;
    familyId?: string;
    sceneId?: string;
  };
  ledger: {
    scope: 'selected_shot' | 'all_scene';
    focusId?: string;
  };
  graph?: import('./graph').SceneGraphState;
  shotSequence?: import('./graph').SceneGraphNode[];
  interventionProjections: InterventionProjection[];
}

export interface RuntimeProjectionOutput {
  workspace: WorkspaceProjection;
  canonical?: CanonicalRunSurface;
  review?: ReviewProjection;
  interventions: {
    items: InterventionItem[];
    activeCount: number;
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  };
  ledger: LedgerProjection[];
  runs: LedgerProjection[]; // Alias for compatibility
  shotQueue: ShotQueueItem[];
}

export interface CanonicalRunSurface {
  id: string;                               // [AUTHORITY]
  jobId: string;                            // [AUTHORITY]
  status: string;                           // [AUTHORITY]
  canonicalState: string;                   // [AUTHORITY]
  authoritativeOutput?: string;             // [AUTHORITY]
  authoritativeOutputLabel?: string;     // [DISPLAY_ONLY]
  lineageSummary?: string;               // [DISPLAY_ONLY]
  nextAction?: SelectedJobNextActionResolution; // [DISPLAY_ONLY]
  previewAuthority?: {
    kind: FamilyPreviewAuthorityKind;
    role: FamilyPreviewEvidenceRole;
    label: string;
    jobId?: string;
  };
  lastMeaningfulChange?: string;          // [DISPLAY_ONLY]
}

export interface ReviewProjection {
  shotId?: string;
  selectedJobId?: string;
  approvalStatus: ReviewApprovalStatus;
  explanations: {
    summary: string;
    whyNotApproved: string;
    fastestPathToGreen: string;
  };
  nextBestAction: {
    label: string;
    intent: 'primary' | 'secondary' | 'danger';
  };
  bestKnownJobId?: string;
  approvedJobId?: string;
  replacementJobId?: string;
  actionState?: string;
  suggestedPairPrimaryJobId?: string;
  suggestedPairPartnerJobId?: string;
  lineageRootId?: string;
}

export interface InterventionProjection {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'resolved' | 'acknowledged' | 'escalated' | 'open' | 'assigned' | 'closed';
  title: string;
  message: string;
}

export interface InterventionItem extends InterventionProjection {
  operatorDecision?: string;             // [OPERATOR_DECISION]
  priority: 'urgent' | 'high' | 'normal';
  confidenceGapLabel: string;
  trustStateLabel: string;
  agingLabel: string;
  canonicalStateLabel: string;
  evidenceSummary?: string;
  recommendationSummary?: string;
  decisionContextSummary?: string;
  auditTraceLabel?: string;
}

export interface WorkspaceProjection {
  sceneId?: string;
  status: string;
  actionAggregates: {
    approved: number;
    finalized: number;
    needsRevision: number;
    rejected: number;
    superseded: number;
    total: number;
  };
  passRate: { value: number; approved: number; reviewable: number };
  retryPressure: { value: number; band: string };
  bestKnownCoverage: { value: number; covered: number; reviewable: number };
  failureClusters: Array<{ reasonCode: string; count: number; shots: string[] }>;
  explanations: { summary: string; whyNotApproved: string; fastestPathToGreen: string };
  shotExceptions: Array<{ shotId: string }>;
  evidenceRefs: { shotIds: string[]; reasonCodes: string[] };
}

export interface ShotQueueItem {
  id: string;
  title: string;
  order: number;
  state: ShotRuntimeState;
  progress: number;
  stage: string;
  lastAction: string;
  isCurrent: boolean;
  duration?: number;
}

export interface LedgerProjection {
  jobId: string;
  shotId?: string;
  takeId?: string;
  version?: number;
  state: string;
  progress: number;
  createdAt: number;
  route: string;
  retryDepth?: number;
  lineageParentJobId?: string;
  technicalQuality?: number;
  artifactSeverity?: number;
  motionStability?: number;
  bestKnown?: boolean;
  retrySuggested?: boolean;
  retryReasonCode?: string;
  reviewStatus?: string;
  approvalStatus?: string;
  actionState?: string;
  approvedBy?: string;
  approvedAt?: number;
  supersededJobId?: string;
  supersededByJobId?: string;
  supersedesJobId?: string;
  finalizedAt?: number;
  explanationSnippet?: string;
}
