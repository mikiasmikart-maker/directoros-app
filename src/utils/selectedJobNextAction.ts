export type SelectedJobPrimaryActionKey =
  | 'retry_latest_attempt'
  | 'inspect_failure'
  | 'inspect_cancelled_run'
  | 'shot_finalized'
  | 'finalize_shot'
  | 'approve_best_known'
  | 'review_output'
  | 'monitor_run'
  | 'inspect_historical_artifact';

export type SelectedJobSecondaryActionKey =
  | 'open_current_winner'
  | 'open_approved_output'
  | 'jump_to_replacement'
  | 'retry_latest_attempt'
  | 'inspect_historical_artifact';

export interface SelectedJobSecondaryAction {
  key: SelectedJobSecondaryActionKey;
  label: string;
}

export interface SelectedJobNextActionInput {
  canonicalState?: string;
  approvalStatus?: string;
  actionState?: 'pending' | 'approved' | 'needs_revision' | 'rejected' | 'superseded' | 'finalized';
  retryEligible: boolean;
  isBestKnown: boolean;
  isApprovedOrFinalized: boolean;
  hasArtifact?: boolean;
}

export interface SelectedJobNextActionResolution {
  primaryActionKey: SelectedJobPrimaryActionKey;
  primaryActionLabel: string;
  primaryActionReason: string;
  secondaryActions?: SelectedJobSecondaryAction[];
}

export const resolveSelectedJobNextAction = ({
  canonicalState,
  approvalStatus,
  actionState,
  retryEligible,
  isBestKnown,
  isApprovedOrFinalized,
  hasArtifact = true,
}: SelectedJobNextActionInput): SelectedJobNextActionResolution => {
  const failed = canonicalState === 'failed';
  const cancelled = canonicalState === 'cancelled';
  const active = canonicalState === 'queued' || canonicalState === 'preflight' || canonicalState === 'running' || canonicalState === 'packaging';
  const completedLike = canonicalState === 'completed' || canonicalState === 'best_known' || canonicalState === 'approved';

  if (actionState === 'finalized') {
    return {
      primaryActionKey: 'shot_finalized',
      primaryActionLabel: 'Finalized',
      primaryActionReason: 'Selected job is already finalized.',
      secondaryActions: [
        { key: 'open_approved_output', label: 'Open Output' },
        { key: 'inspect_historical_artifact', label: 'Inspect Output' },
      ],
    };
  }

  if (failed) {
    return retryEligible
      ? {
          primaryActionKey: 'retry_latest_attempt',
          primaryActionLabel: 'Retry',
          primaryActionReason: 'Selected job is failed and retry-eligible.',
          secondaryActions: [
            { key: 'inspect_historical_artifact', label: 'Inspect Output' },
          ],
        }
      : {
          primaryActionKey: 'inspect_failure',
          primaryActionLabel: 'Inspect Output',
          primaryActionReason: 'Selected job is failed but retry is blocked.',
          secondaryActions: [
            { key: 'inspect_historical_artifact', label: 'Inspect Output' },
          ],
        };
  }

  if (cancelled) {
    return retryEligible
      ? {
          primaryActionKey: 'retry_latest_attempt',
          primaryActionLabel: 'Retry',
          primaryActionReason: 'Selected job was intentionally cancelled and can be launched again.',
          secondaryActions: [
            { key: 'inspect_historical_artifact', label: 'Inspect Output' },
          ],
        }
      : {
          primaryActionKey: 'inspect_cancelled_run',
          primaryActionLabel: 'Inspect Output',
          primaryActionReason: 'Selected job was intentionally cancelled and remains distinct from failure state.',
          secondaryActions: [
            { key: 'inspect_historical_artifact', label: 'Inspect Output' },
          ],
        };
  }

  if (isApprovedOrFinalized && approvalStatus === 'approved') {
    return {
      primaryActionKey: 'finalize_shot',
      primaryActionLabel: 'Finalize',
      primaryActionReason: 'Selected job is approved and awaiting finalization.',
      secondaryActions: [
        { key: 'open_approved_output', label: 'Open Output' },
        { key: 'inspect_historical_artifact', label: 'Inspect Output' },
      ],
    };
  }

  if (isBestKnown && !isApprovedOrFinalized) {
    return {
      primaryActionKey: 'approve_best_known',
      primaryActionLabel: 'Approve',
      primaryActionReason: 'Selected job is the current best-known output.',
      secondaryActions: [
        { key: 'open_current_winner', label: 'Open Output' },
        { key: 'inspect_historical_artifact', label: 'Inspect Output' },
      ],
    };
  }

  if (completedLike) {
    return {
      primaryActionKey: hasArtifact ? 'review_output' : 'inspect_historical_artifact',
      primaryActionLabel: hasArtifact ? 'Open Output' : 'Inspect Job',
      primaryActionReason: hasArtifact ? 'Selected job is completed and not yet approved/finalized.' : 'Selected job is completed but no artifact is registered.',
      secondaryActions: [
        { key: 'inspect_historical_artifact', label: 'Inspect Output' },
      ],
    };
  }

  if (active) {
    return {
      primaryActionKey: 'monitor_run',
      primaryActionLabel: 'Inspect Output',
      primaryActionReason: 'Selected job is still in an active execution state.',
      secondaryActions: [
        { key: 'inspect_historical_artifact', label: 'Inspect Output' },
      ],
    };
  }

  return {
    primaryActionKey: 'inspect_historical_artifact',
    primaryActionLabel: 'Inspect Output',
    primaryActionReason: 'Selected job has no stronger next action from current derived state.',
    secondaryActions: [
      { key: 'inspect_historical_artifact', label: 'Inspect Output' },
    ],
  };
};
