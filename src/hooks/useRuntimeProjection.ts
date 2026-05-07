import { useMemo } from 'react';
import type {
  RuntimeTruthInput,
  RuntimeProjectionOutput,
  CanonicalRunSurface,
  ReviewProjection,
  InterventionItem,
  WorkspaceProjection,
  ShotQueueItem,
  LedgerProjection,
} from '../types/projection';
import { sortShotsInSequence } from '../utils/shotExecution';
import { resolveSelectedJobNextAction } from '../utils/selectedJobNextAction';
import { findLineageRootId } from '../review/reviewLineageTruth';

/**
 * [PHASE 2] Runtime Truth Isolation Pass: Non-Behavioral Extraction.
 * This hook centralizes all UI-side derivations that were previously inline in App.tsx.
 */

export function useRuntimeProjection(input: RuntimeTruthInput): RuntimeProjectionOutput {
  const { jobs, reviewSnapshot, previewState, selection, ledger, shotSequence, interventionProjections } = input;

  // 1. CANONICAL RUN SURFACE (Selected Job Focus)
  const canonical = useMemo<CanonicalRunSurface | undefined>(() => {
    if (!selection.jobId) return undefined;
    const selectedJob = jobs.find((j) => j.id === selection.jobId || j.runtimeBridgeJobId === selection.jobId);
    if (!selectedJob) return undefined;

    const shotProjection = reviewSnapshot.shotProjections.get(selectedJob.shotId || '');
    const canonicalState = (selectedJob as any).state === 'failed' ? 'failed' : (shotProjection?.actionState?.current ?? selectedJob.state);
    
    const unresolvedAttention = selectedJob.state === 'failed' && !shotProjection?.actionState?.finalJobId;

    return {
      id: selectedJob.id,
      jobId: selectedJob.id,
      status: selectedJob.state,
      canonicalState,
      authoritativeOutput: shotProjection?.bestKnownOutputSelection?.selectedJobId === selectedJob.id 
        ? (selectedJob as any).previewMedia || (selectedJob as any).previewImage 
        : undefined,
      authoritativeOutputLabel: shotProjection?.approvalStatus === 'approved' ? 'approved' : shotProjection?.bestKnownOutputSelection?.selectedJobId === selectedJob.id ? 'winner' : 'none',
      lineageSummary: `Family lineage root • ${selectedJob.id.slice(0, 8)}`,
      previewAuthority: shotProjection?.approvalStatus === 'approved' ? { kind: 'approved_output', role: 'operational_truth', label: 'approved output', jobId: selectedJob.id } : { kind: 'none', role: 'historical_artifact', label: 'no authority' },
      nextAction: resolveSelectedJobNextAction({
        canonicalState,
        approvalStatus: shotProjection?.approvalStatus,
        actionState: shotProjection?.actionState?.current,
        retryEligible: unresolvedAttention,
        isBestKnown: shotProjection?.bestKnownOutputSelection?.selectedJobId === selectedJob.id,
        isApprovedOrFinalized: shotProjection?.approvalStatus === 'approved' || shotProjection?.actionState?.current === 'finalized',
      }),
      lastMeaningfulChange: `Lifecycle ${selectedJob.state}`,
    };
  }, [jobs, reviewSnapshot.shotProjections, selection.jobId]);

  // 2. REVIEW PROJECTION (Lineage/Family Context)
  const review = useMemo<ReviewProjection | undefined>(() => {
    const selectedJob = selection.jobId ? jobs.find((j) => j.id === selection.jobId || j.runtimeBridgeJobId === selection.jobId) : undefined;
    const shotId = selectedJob?.shotId || selection.familyId;
    if (!shotId) return undefined;

    const shotProjection = reviewSnapshot.shotProjections.get(shotId);
    
    return {
      shotId,
      selectedJobId: selection.jobId,
      approvalStatus: shotProjection?.approvalStatus ?? 'unreviewed',
      explanations: {
        summary: shotProjection?.explanations?.summary ?? 'No review explanation provided.',
        whyNotApproved: (shotProjection?.explanations as any)?.whyNotApproved ?? 'Quality thresholds not yet verified.',
        fastestPathToGreen: (shotProjection?.explanations as any)?.fastestPathToGreen ?? 'Run standard render pipeline.',
      },
      nextBestAction: {
        label: shotProjection?.approvalStatus === 'approved' ? 'Finalize Output' : 'Commit Winner',
        intent: shotProjection?.approvalStatus === 'approved' ? 'primary' : 'secondary',
      },
      bestKnownJobId: shotProjection?.bestKnownOutputSelection?.selectedJobId,
      approvedJobId: shotProjection?.actionState?.finalJobId,
      replacementJobId: shotProjection?.actionState?.supersededByJobId,
      actionState: shotProjection?.actionState?.current,
      suggestedPairPrimaryJobId: (shotProjection as any)?.suggestedPairPrimaryJobId,
      suggestedPairPartnerJobId: (shotProjection as any)?.suggestedPairPartnerJobId,
      lineageRootId: selectedJob ? findLineageRootId(selectedJob, jobs) : undefined,
    };
  }, [jobs, reviewSnapshot.shotProjections, selection.jobId, selection.familyId]);

  // 3. WORKSPACE PROJECTION (High-level Scene Health)
  const workspace = useMemo<WorkspaceProjection>(() => {
    const approved = Array.from(reviewSnapshot.shotProjections.values()).filter(p => p.approvalStatus === 'approved').length;
    const finalized = Array.from(reviewSnapshot.shotProjections.values()).filter(p => p.actionState?.current === 'finalized').length;
    const total = shotSequence?.length || 0;

    const status = finalized === total && total > 0 ? 'healthy' :
                   approved > 0 ? 'preparing' :
                   'needs_attention';

    return {
      sceneId: selection.sceneId,
      status,
      actionAggregates: {
        approved,
        finalized,
        needsRevision: 0,
        rejected: 0,
        superseded: 0,
        total,
      },
      passRate: { value: total > 0 ? approved / total : 0, approved, reviewable: total },
      retryPressure: { value: 0, band: 'stable' },
      bestKnownCoverage: { value: 0, covered: 0, reviewable: total },
      failureClusters: [],
      explanations: { summary: 'Stability check active', whyNotApproved: 'Pending coverage', fastestPathToGreen: 'Resolve queue' },
      shotExceptions: [],
      evidenceRefs: { shotIds: [], reasonCodes: [] },
    };
  }, [reviewSnapshot.shotProjections, selection.sceneId, shotSequence]);

  // 4. INTERVENTIONS PROJECTION
  const interventions = useMemo(() => {
    const items: InterventionItem[] = interventionProjections.map(p => ({
      ...p,
      operatorDecision: (p as any).decision,
      priority: p.severity === 'critical' || p.severity === 'high' ? 'urgent' : p.severity === 'medium' ? 'high' : 'normal',
      confidenceGapLabel: 'Manual verify required',
      trustStateLabel: p.status === 'pending' ? 'untrusted' : 'verified',
      agingLabel: 'Fresh',
      canonicalStateLabel: p.status,
      evidenceSummary: p.message,
    }));
    
    const activeCount = items.filter(i => i.status === 'pending').length;
    
    let severity: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    if (activeCount > 0) {
      const levels = { low: 1, medium: 2, high: 3, critical: 4 };
      const highest = items.reduce((max, curr) => 
        levels[curr.severity] > levels[max] ? curr.severity : max
      , 'low' as 'low' | 'medium' | 'high' | 'critical');
      severity = highest;
    }

    return { items, activeCount, severity };
  }, [interventionProjections]);

  // 5. LEDGER PROJECTION (Lineage Timeline)
  const ledgerOutput = useMemo<LedgerProjection[]>(() => {
    const scopeJobs = ledger.scope === 'selected_shot' 
      ? jobs.filter(j => j.shotId === ledger.focusId)
      : jobs;

    return scopeJobs.sort((a, b) => b.createdAt - a.createdAt).map(job => {
      const shotProjection = reviewSnapshot.shotProjections.get(job.shotId || '');
      return {
        jobId: job.id,
        shotId: job.shotId,
        takeId: job.takeId,
        version: job.version,
        state: job.state,
        progress: job.progress,
        createdAt: job.createdAt,
        route: (job as any).route || 'default',
        retryDepth: job.retryDepth,
        lineageParentJobId: job.lineageParentJobId,
        bestKnown: shotProjection?.bestKnownOutputSelection?.selectedJobId === job.id,
        approvalStatus: shotProjection?.approvalStatus,
        actionState: shotProjection?.actionState?.current,
      };
    });
  }, [jobs, reviewSnapshot.shotProjections, ledger]);

  // 6. SHOT QUEUE PROJECTION
  const shotQueue = useMemo<ShotQueueItem[]>(() => {
    if (!shotSequence) return [];
    
    return sortShotsInSequence(shotSequence).map((node, index) => {
      const isCurrent = (previewState as any).activeShotId === node.id;
      
      return {
        id: node.id,
        title: node.title,
        order: index + 1,
        state: (node.shotRuntimeState || 'waiting') as any,
        progress: 0,
        stage: node.shotCurrentStage || 'Idle',
        lastAction: 'Pending signal',
        isCurrent,
      };
    });
  }, [shotSequence, previewState, reviewSnapshot.shotProjections]);

  return {
    workspace,
    canonical,
    review,
    interventions,
    ledger: ledgerOutput,
    runs: ledgerOutput,
    shotQueue,
  };
}
