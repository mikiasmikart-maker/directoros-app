/**
 * Operational language mapping for DirectorOS.
 * Provides concise, operator-safe wording for technical states and IDs.
 */

export const mapTechnicalState = (state: string): string => {
  const mapping: Record<string, string> = {
    'preflight': 'Preparing',
    'running': 'Rendering',
    'packaging': 'Finalizing',
    'queued': 'Queued',
    'completed': 'Ready',
    'failed': 'Failed',
    'cancelled': 'Stopped',
    'stale': 'Out of sync',
    'unavailable': 'Temporarily unavailable',
    'ready': 'Ready',
  };
  return mapping[state.toLowerCase()] || state;
};

/**
 * Maps actor/intent types to operator-facing labels.
 */
export const mapIntentType = (type: string): string => {
  const mapping: Record<string, string> = {
    'reviewing': 'Reviewing',
    'comparing': 'Comparing',
    'preparing_commit': 'Finalizing',
    'retrying': 'Retrying',
    'viewing': 'Viewing',
  };
  return mapping[type.toLowerCase()] || type.replace('_', ' ');
};

/**
 * Formats IDs for human display only when disambiguation is required.
 * Prefer contextual labels (Winner, Latest, etc.) over this helper.
 */
export const formatOperatorId = (id?: string, prefix = 'Attempt'): string => {
  if (!id) return 'n/a';
  // Keep it short and neutral for any remaining leakage points
  if (id.length <= 8) return id;
  return `${prefix} ${id.slice(0, 4).toUpperCase()}`;
};
