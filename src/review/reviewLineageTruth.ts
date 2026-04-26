import type { RenderQueueJob, RenderJobState } from '../render/jobQueue';
import type { ShotReviewProjection } from './types';

export type ReviewActionState = 'pending' | 'approved' | 'needs_revision' | 'rejected' | 'superseded' | 'finalized';
export type ReviewApprovalStatus = 'unreviewed' | 'needs_revision' | 'approved' | 'rejected' | 'superseded';
export type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type OperatorCanonicalState = RenderJobState | 'best_known' | ReviewActionState;
export type EvidenceRole = 'operational_truth' | 'supporting_evidence' | 'historical_artifact';

export interface ReviewActionAuditRecord {
  actionState?: ReviewActionState;
  approvedBy?: string;
  approvedAt?: number;
  supersededJobId?: string;
  supersededByJobId?: string;
  supersedesJobId?: string;
  finalizedAt?: number;
  reasonCode?: string;
}

export interface DecisionHistoryEntry {
  eventId: string;
  eventType: string;
  occurredAt: number;
  actor: 'operator' | 'system';
  jobId: string;
  description: string;
  rationale?: string;
  supersededJobId?: string;
}

export interface DecisionProposalRecord {
  rankedCandidates: Array<{ candidateId: string; score: number }>;
  policyId?: string;
  policyHash?: string;
  eventId: string;
}

export interface OperatorReviewState {
  shotId?: string;
  selectedJobId?: string;
  reviewStatus?: ReviewStatus;
  approvalStatus?: ReviewApprovalStatus;
  actionState?: ReviewActionState;
  bestKnownJobId?: string;
  approvedJobId?: string;
  replacementJobId?: string;
  replacementAnchorJobId?: string;
  actionAudit: {
    approvedBy?: string;
    approvedAt?: number;
    supersededJobId?: string;
    supersededByJobId?: string;
    supersedesJobId?: string;
    finalizedAt?: number;
  };
  measuredSignals?: ShotReviewProjection['measuredSignals'];
  retryRecommendation?: {
    recommend: boolean;
    reasonCode?: string;
    authorityState: 'eligible' | 'blocked';
  };
  explanations: {
    summary?: string;
    bestKnownWhy: string[];
    retryWhy: string[];
    humanNotes?: string;
  };
  trace: {
    scorerVersion?: string;
    policyId?: string;
    eventId?: string;
  };
  canonicalState: OperatorCanonicalState;
  isBestKnown: boolean;
  isApproved: boolean;
  isFinalized: boolean;
}

export interface ProductionFamilyTruth {
  lineageRootId: string;
  shotId?: string;
  familyLabel: string;
  familyState: string;
  lineageTrail: string[];
  timelineNodes: Array<{
    label: string;
    kind: 'root' | 'retry' | 'winner' | 'approved' | 'replacement';
    active?: boolean;
    evidenceRole?: EvidenceRole;
  }>;
  bestKnownJobId?: string;
  approvedOutputJobId?: string;
  replacementAnchorJobId?: string;
  replacementJobId?: string;
  evidenceTargetJobId?: string;
  evidenceReason?: string;
  latestAttemptJobId?: string;
  latestFailedJobId?: string;
  nextFamilyAction: string;
  rankedEvidenceCandidates: Array<{
    jobId: string;
    label: string;
    reason: string;
    role: EvidenceRole;
    isDefault?: boolean;
  }>;
}

export type NBAState =
  | 'SHOOTOUT_ACTIVE'
  | 'RECOVERY_REQUIRED'
  | 'COMMIT_PENDING'
  | 'DIVERGENCE_DETECTED'
  | 'FINALIZATION_READY'
  | 'CONTINUE_PRODUCTION';

export interface NextBestAction {
  state: NBAState;
  title: string;
  reason: string;
  accent: 'cyan' | 'rose' | 'emerald' | 'amber' | 'indigo' | 'slate';
  cta: string;
  predictiveHint?: string;
}

export type RiskLevel = 'stable' | 'elevated' | 'critical';

export interface RiskForecast {
  level: RiskLevel;
  reason: string;
}

export type InboxPriority = 'critical' | 'needs_commit' | 'diverged' | 'none';

export interface InboxItem {
  lineageRootId: string;
  shotId?: string;
  label: string;
  priority: InboxPriority;
  reason: string;
  targetJobId?: string;
  risk?: RiskForecast;
}

const shortJobId = (jobId: string) => (jobId.length <= 12 ? jobId : `${jobId.slice(0, 6)}…${jobId.slice(-4)}`);

export const findLineageRootId = (job: RenderQueueJob, jobs: RenderQueueJob[]) => {
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

export const resolveOperatorReviewState = ({
  selectedJob,
  projection,
  decisionProposal,
  actionAudit,
}: {
  selectedJob?: RenderQueueJob;
  projection?: ShotReviewProjection;
  decisionProposal?: DecisionProposalRecord;
  actionAudit?: ReviewActionAuditRecord;
}): OperatorReviewState | undefined => {
  if (!selectedJob || !projection) return undefined;

  const bestKnown = projection.bestKnownOutputSelection;
  const retry = projection.retryRecommendation;
  const resolvedActionState = actionAudit?.actionState ?? projection.actionState?.current;
  const approvalStatus = projection.approvalStatus;
  const approvedJobId = approvalStatus === 'approved' ? bestKnown?.selectedJobId : undefined;
  const replacementAnchorJobId = selectedJob.id;
  const replacementJobId = actionAudit?.supersededByJobId;
  const isBestKnown = bestKnown?.selectedJobId === selectedJob.id;
  const isApproved = approvedJobId === selectedJob.id;
  const isFinalized = resolvedActionState === 'finalized';

  const canonicalState: OperatorCanonicalState =
    selectedJob.state === 'failed'
      ? 'failed'
      : selectedJob.state === 'cancelled'
        ? 'cancelled'
        : resolvedActionState
          ? resolvedActionState
          : selectedJob.state === 'completed' && isBestKnown
            ? 'best_known'
            : selectedJob.state;

  return {
    shotId: selectedJob.shotId,
    selectedJobId: selectedJob.id,
    reviewStatus: projection.reviewStatus,
    approvalStatus,
    actionState: resolvedActionState,
    bestKnownJobId: bestKnown?.selectedJobId,
    approvedJobId,
    replacementAnchorJobId,
    replacementJobId,
    actionAudit: {
      approvedBy: actionAudit?.approvedBy,
      approvedAt: actionAudit?.approvedAt,
      supersededJobId: actionAudit?.supersededJobId,
      supersededByJobId: actionAudit?.supersededByJobId,
      supersedesJobId: actionAudit?.supersedesJobId,
      finalizedAt: actionAudit?.finalizedAt,
    },
    measuredSignals: projection.measuredSignals,
    retryRecommendation: retry
      ? {
        recommend: retry.recommend,
        reasonCode: retry.reasonCode,
        authorityState: selectedJob.state === 'failed' ? 'eligible' : 'blocked',
      }
      : undefined,
    explanations: {
      summary: projection.explanations?.summary,
      bestKnownWhy: bestKnown
        ? [
          `Selection mode: ${bestKnown.selectionMode}.`,
          bestKnown.selectedJobId === selectedJob.id ? 'Current job is best-known for this shot.' : `Best-known points to ${bestKnown.selectedJobId}.`,
        ]
        : [],
      retryWhy: retry?.recommend ? [`Retry suggested: ${retry.reasonCode ?? 'quality threshold not met'}.`] : [],
      humanNotes: selectedJob.state === 'failed' ? selectedJob.error : undefined,
    },
    trace: {
      scorerVersion: decisionProposal?.policyId ?? 'composite_score_v2',
      policyId: decisionProposal?.policyHash ?? 'default_weight_policy_v2',
      eventId: decisionProposal?.eventId,
    },
    canonicalState,
    isBestKnown,
    isApproved,
    isFinalized,
  };
};
export const resolveProductionFamilyTruth = ({
  lineageRootId,
  familyLabel,
  jobs,
  projection,
  actionAuditByJobId,
}: {
  lineageRootId: string;
  familyLabel: string;
  jobs: RenderQueueJob[];
  projection?: ShotReviewProjection;
  actionAuditByJobId: Map<string, ReviewActionAuditRecord>;
}): ProductionFamilyTruth => {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const belongsToRoot = (job: RenderQueueJob) => {
    let current: RenderQueueJob | undefined = job;
    let depth = 0;
    while (current && depth < 12) {
      if (current.id === lineageRootId) return true;
      const parentId: string | undefined = current.lineageParentJobId ?? current.retryOf;
      current = parentId ? byId.get(parentId) : undefined;
      depth += 1;
    }
    return job.id === lineageRootId;
  };

  const familyJobs = jobs.filter(belongsToRoot).sort((a, b) => b.createdAt - a.createdAt);
  const latestAttempt = familyJobs[0];
  const latestFailed = familyJobs.find((j) => j.state === 'failed');

  const bestKnownJobId = projection?.bestKnownOutputSelection?.selectedJobId;
  const approvedOutputJobId = projection?.approvalStatus === 'approved' ? bestKnownJobId : undefined;

  let replacementJobId: string | undefined;
  let replacementAnchorJobId: string | undefined;
  for (const [id, audit] of actionAuditByJobId.entries()) {
    if (audit.supersededByJobId) {
      replacementJobId = audit.supersededByJobId;
      replacementAnchorJobId = id;
    }
  }

  const familyState = latestAttempt ? getOperatorStateLabel(latestAttempt) : 'idle';
  const lineageTrail = familyJobs.map((j) => j.id);

  const timelineNodes: ProductionFamilyTruth['timelineNodes'] = familyJobs.map((j) => ({
    label: shortJobId(j.id),
    kind: j.id === lineageRootId ? 'root' : j.id === approvedOutputJobId ? 'approved' : j.id === bestKnownJobId ? 'winner' : 'retry',
    active: j.id === latestAttempt?.id,
  }));

  const evidenceTargetJobId = approvedOutputJobId ?? bestKnownJobId ?? latestAttempt?.id;
  const evidenceReason = projection?.explanations?.summary ?? 'Pending review pass.';

  const nextFamilyAction = (approvedOutputJobId ? 'Finalize Output' : 'Commit Winner');

  const rankedEvidenceCandidates = familyJobs.slice(0, 5).map((j) => ({
    jobId: j.id,
    label: `Attempt ${shortJobId(j.id)}`,
    reason: j.state === 'failed' ? 'Failure investigation' : 'Quality audit',
    role: (j.id === approvedOutputJobId ? 'operational_truth' : 'supporting_evidence') as EvidenceRole,
  }));

  return {
    lineageRootId,
    shotId: latestAttempt?.shotId,
    familyLabel,
    familyState,
    lineageTrail,
    timelineNodes,
    bestKnownJobId,
    approvedOutputJobId,
    replacementAnchorJobId,
    replacementJobId,
    evidenceTargetJobId,
    evidenceReason,
    latestAttemptJobId: latestAttempt?.id,
    latestFailedJobId: latestFailed?.id,
    nextFamilyAction,
    rankedEvidenceCandidates,
  };
};

export const resolveRiskForecast = ({
  family,
  activities,
  conflicts,
}: {
  family: ProductionFamilyTruth;
  activities: import('../types/presence').PresenceActivity[];
  conflicts: import('../types/presence').Conflict[];
}): RiskForecast => {
  const familyActivities = activities.filter((act) => act.targetId === family.lineageRootId && act.operatorId !== 'op_alpha');
  const familyConflicts = conflicts.filter((c) => c.operatorId !== 'op_alpha');

  // Priority 1: Peer Commit Pressure (Critical)
  if (familyActivities.some((act) => act.type === 'preparing_commit')) {
    return { level: 'critical', reason: 'Peer commit pressure' };
  }

  // Priority 2: Conflict Pressure (Critical for High, Elevated for Medium)
  if (familyConflicts.some((c) => c.severity === 'high')) {
    return { level: 'critical', reason: 'Conflict pressure' };
  }
  if (familyConflicts.some((c) => c.severity === 'medium')) {
    return { level: 'elevated', reason: 'Conflict pressure' };
  }

  // Priority 3: Retry Fragility (Elevated)
  if (family.lineageTrail.length > 3) {
    return { level: 'elevated', reason: 'Retry fragility' };
  }

  // Priority 4: Unresolved Truth Drift (Elevated)
  if (family.bestKnownJobId && family.latestAttemptJobId && family.bestKnownJobId !== family.latestAttemptJobId) {
    return { level: 'elevated', reason: 'Unresolved truth drift' };
  }

  return { level: 'stable', reason: 'Stable' };
};

export const resolveInboxItem = (
  family: ProductionFamilyTruth,
  jobs: RenderQueueJob[],
  risk?: RiskForecast
): InboxItem | null => {
  const latestJob = family.latestAttemptJobId ? jobs.find(j => j.id === family.latestAttemptJobId) : undefined;

  let item: InboxItem | null = null;

  // 1. CRITICAL — latest attempt failed
  if (latestJob?.state === 'failed') {
    item = {
      lineageRootId: family.lineageRootId,
      shotId: family.shotId,
      label: family.familyLabel,
      priority: 'critical',
      reason: 'Latest attempt failed',
      targetJobId: family.latestAttemptJobId,
      risk,
    };
  }

  // 2. NEEDS COMMIT — winner exists, no approved output
  else if (family.bestKnownJobId && !family.approvedOutputJobId) {
    item = {
      lineageRootId: family.lineageRootId,
      shotId: family.shotId,
      label: family.familyLabel,
      priority: 'needs_commit',
      reason: 'Winner needs commitment',
      targetJobId: family.bestKnownJobId,
      risk,
    };
  }

  // 3. DIVERGED — latest successful differs from current winner
  else if (latestJob?.state === 'completed' && family.bestKnownJobId && latestJob.id !== family.bestKnownJobId) {
    item = {
      lineageRootId: family.lineageRootId,
      shotId: family.shotId,
      label: family.familyLabel,
      priority: 'diverged',
      reason: 'Output diverged from winner',
      targetJobId: latestJob.id,
      risk,
    };
  }

  return item;
};

function getOperatorStateLabel(job: RenderQueueJob) {
  if (job.state === 'failed') return 'failed';
  if (job.state === 'completed') return 'ready';
  return job.state;
}

export const resolveFamilyDecisionHistory = (
  lineageRootId: string,
  eventLog: any[]
): DecisionHistoryEntry[] => {
  const familyEvents = eventLog
    .filter((event) => event.lineageRootJobId === lineageRootId)
    .filter((event) =>
      [
        'review.decision.proposed',
        'review.decision.confirmed',
        'review.action.approved',
        'review.action.superseded',
        'review.action.finalized',
        'review.action.rejected',
        'review.action.revision_requested',
      ].includes(event.eventType)
    );

  const entries: DecisionHistoryEntry[] = familyEvents.map((event) => {
    const actor: 'operator' | 'system' = event.payload?.actor?.source === 'operator' ? 'operator' : 'system';
    const audit = event.payload?.audit;
    const data = event.payload?.data;

    let description = '';
    let rationale = event.payload?.summary || audit?.reasonCode || data?.reasonCode;

    switch (event.eventType) {
      case 'review.decision.proposed':
        description = 'Proposed as Winner';
        break;
      case 'review.decision.confirmed':
        description = 'Confirmed as Winner';
        break;
      case 'review.action.approved':
        description = 'Approved as Truth';
        break;
      case 'review.action.superseded':
        description = `Superseded by ${shortJobId(event.jobId)}`;
        break;
      case 'review.action.finalized':
        description = 'Finalized Shot';
        break;
      case 'review.action.rejected':
        description = 'Rejected Output';
        break;
      case 'review.action.revision_requested':
        description = 'Revision Requested';
        break;
      default:
        description = event.eventType;
    }

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      actor,
      jobId: event.jobId,
      description,
      rationale,
      supersededJobId: audit?.supersededJobId,
    };
  });

  // Sort newest first and limit to 10
  return entries.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 10);
};

// ---------------------------------------------------------------------------
// Pass 24: Guidance Confidence Scoring
// Computes a 0–1 confidence value from job activity, risk level, and lineage
// depth. predictiveHint is shown only when confidence >= HINT_CONFIDENCE_THRESHOLD.
// ---------------------------------------------------------------------------

const computeHintConfidence = ({
  latestJobState,
  riskLevel,
  lineageDepth,
}: {
  latestJobState?: RenderQueueJob['state'];
  riskLevel?: RiskLevel;
  lineageDepth: number;
}): number => {
  const activityScore =
    latestJobState === 'running' || latestJobState === 'packaging' ? 0.0
      : latestJobState === 'queued' || latestJobState === 'preflight' ? 0.3
        : latestJobState === 'completed' || latestJobState === 'failed' || latestJobState === 'cancelled' ? 1.0
          : 0.7; // undefined / no latest job — lean toward silence

  const riskScore =
    riskLevel === 'critical' ? 0.0
      : riskLevel === 'elevated' ? 0.5
        : riskLevel === 'stable' ? 1.0
          : 0.7; // undefined / unknown — lean toward silence

  const depthScore = Math.max(0, 1 - (lineageDepth - 1) / 5);

  return (activityScore * 0.50) + (riskScore * 0.35) + (depthScore * 0.15);
};

const HINT_CONFIDENCE_THRESHOLD = 0.5;

export const resolveNextBestAction = ({
  family,
  jobs,
  shootoutActive,
  riskLevel,
}: {
  family: ProductionFamilyTruth;
  jobs: RenderQueueJob[];
  shootoutActive?: boolean;
  riskLevel?: RiskLevel;
}): NextBestAction => {
  const latestJob = family.latestAttemptJobId ? jobs.find((j) => j.id === family.latestAttemptJobId) : undefined;

  const confidence = computeHintConfidence({
    latestJobState: latestJob?.state,
    riskLevel,
    lineageDepth: family.lineageTrail.length,
  });
  const showHint = confidence >= HINT_CONFIDENCE_THRESHOLD;

  // 1. SHOOTOUT_ACTIVE
  if (shootoutActive) {
    return {
      state: 'SHOOTOUT_ACTIVE',
      title: 'Eval Delta',
      reason: 'Dual-pane comparison active. Identify winner to resolve truth branch.',
      accent: 'cyan',
      cta: 'Resolve Winner',
      predictiveHint: showHint ? 'Once resolved, winner commit becomes the immediate next step.' : undefined,
    };
  }

  // 2. RECOVERY_REQUIRED
  if (latestJob?.state === 'failed') {
    return {
      state: 'RECOVERY_REQUIRED',
      title: 'Retry Attempt',
      reason: 'Latest production attempt failed. Shortest path: Rerun with adjustment.',
      accent: 'rose',
      cta: 'Rerun Attempt',
      predictiveHint: showHint ? 'Check the failure reason before rerunning.' : undefined,
    };
  }

  // 3. COMMIT_PENDING
  if (family.bestKnownJobId && !family.approvedOutputJobId) {
    return {
      state: 'COMMIT_PENDING',
      title: 'Commit Winner',
      reason: 'High-confidence candidate identified. Approve to lock operational truth.',
      accent: 'emerald',
      cta: 'Approve Winner',
      predictiveHint: showHint ? 'Approval will surface finalization as the next step.' : undefined,
    };
  }

  // 4. DIVERGENCE_DETECTED
  if (latestJob?.state === 'completed' && family.bestKnownJobId && latestJob.id !== family.bestKnownJobId) {
    return {
      state: 'DIVERGENCE_DETECTED',
      title: 'Inspect Drift',
      reason: 'Latest output diverged from winner. Evaluate quality delta.',
      accent: 'amber',
      cta: 'Launch Shootout',
      predictiveHint: showHint ? 'Shootout will let you decide which output locks operational truth.' : undefined,
    };
  }

  // 5. FINALIZATION_READY
  if (family.approvedOutputJobId && family.familyState !== 'finalized') {
    return {
      state: 'FINALIZATION_READY',
      title: 'Finalize Lineage',
      reason: 'Truth locked. Mark as finalized to seal production record.',
      accent: 'indigo',
      cta: 'Mark Finalized',
      predictiveHint: showHint ? 'Finalizing seals this family. No further commits will be required.' : undefined,
    };
  }

  // 6. CONTINUE_PRODUCTION — no hint, silence is correct
  return {
    state: 'CONTINUE_PRODUCTION',
    title: 'Monitor Production',
    reason: 'Family healthy. Continue monitoring active pipeline state.',
    accent: 'slate',
    cta: 'Open Output',
  };
};
