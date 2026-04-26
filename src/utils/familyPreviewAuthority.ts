import type { RenderQueueJob } from '../render/jobQueue';

export type FamilyPreviewAuthorityKind = 'approved_output' | 'current_winner' | 'selected_attempt' | 'latest_attempt' | 'historical_artifact' | 'none';
export type FamilyPreviewEvidenceRole = 'operational_truth' | 'supporting_evidence' | 'historical_artifact';

export interface ResolveFamilyPreviewAuthorityInput {
  approvedOutputJob?: RenderQueueJob;
  currentWinnerJob?: RenderQueueJob;
  selectedAttemptJob?: RenderQueueJob;
  latestAttemptJob?: RenderQueueJob;
}

export interface FamilyPreviewAuthorityResolution {
  kind: FamilyPreviewAuthorityKind;
  job?: RenderQueueJob;
  role: FamilyPreviewEvidenceRole;
}

export const resolveFamilyPreviewAuthority = ({
  approvedOutputJob,
  currentWinnerJob,
  selectedAttemptJob,
  latestAttemptJob,
}: ResolveFamilyPreviewAuthorityInput): FamilyPreviewAuthorityResolution => {
  if (approvedOutputJob) {
    return { kind: 'approved_output', job: approvedOutputJob, role: 'operational_truth' };
  }

  if (currentWinnerJob) {
    return { kind: 'current_winner', job: currentWinnerJob, role: 'operational_truth' };
  }

  // If we have a fresh latest attempt (completed), it takes priority over a general historical selection
  // for the "Live rebinding" effect.
  if (latestAttemptJob && latestAttemptJob.state === 'completed') {
    return { kind: 'latest_attempt', job: latestAttemptJob, role: 'supporting_evidence' };
  }

  if (selectedAttemptJob) {
    return { kind: 'selected_attempt', job: selectedAttemptJob, role: 'supporting_evidence' };
  }

  return { kind: 'none', role: 'historical_artifact' };
};
