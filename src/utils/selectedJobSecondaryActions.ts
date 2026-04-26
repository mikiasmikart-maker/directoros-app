export type SelectedJobSecondaryActionId =
  | 'open_approved_output'
  | 'open_current_winner'
  | 'jump_to_replacement'
  | 'retry_latest_attempt'
  | 'inspect_historical_artifact';

export interface SelectedJobSecondaryActionContractItem {
  id: SelectedJobSecondaryActionId;
  label: string;
}

export const SELECTED_JOB_SECONDARY_ACTIONS: SelectedJobSecondaryActionContractItem[] = [
  { id: 'open_approved_output', label: 'Open Output' },
  { id: 'open_current_winner', label: 'Open Output' },
  { id: 'jump_to_replacement', label: 'Open Output' },
  { id: 'retry_latest_attempt', label: 'Retry' },
  { id: 'inspect_historical_artifact', label: 'Inspect Output' },
];
