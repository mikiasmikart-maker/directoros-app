export type LifecyclePresentationState = 'idle' | 'ready' | 'queued' | 'preflight' | 'running' | 'packaging' | 'completed' | 'failed' | 'cancelled';

interface LifecyclePresentationOptions {
  statusLabel?: string | null;
  errorLabel?: string | null;
  failedStage?: 'queued' | 'preflight' | 'running' | 'packaging' | 'failed';
}

const normalize = (value?: string | null) => (value ?? '').toLowerCase();

export const getLifecycleVisibility = (
  state: LifecyclePresentationState,
  options: LifecyclePresentationOptions = {}
) => {
  const status = normalize(options.statusLabel);
  const error = normalize(options.errorLabel);
  const failedStage = options.failedStage;
  const failedBeforeRenderStart = state === 'failed' && (failedStage === 'queued' || failedStage === 'preflight' || status.includes('preflight') || error.includes('preflight'));

  switch (state) {
    case 'idle':
      return {
        stateLabel: 'idle',
        stageLabel: 'Awaiting execution state',
        monitorLabel: 'Not ready to launch',
        status: 'Idle',
        latencyCue: null,
        actionAcknowledgement: 'Signal pending',
      };
    case 'ready':
      return {
        stateLabel: 'ready',
        stageLabel: 'Ready to launch selected scene',
        monitorLabel: 'Ready to launch selected scene',
        status: 'Ready',
        latencyCue: null,
        actionAcknowledgement: 'Signal ready',
      };
    case 'queued':
      return {
        stateLabel: 'queued',
        stageLabel: 'Queued • waiting for lane',
        monitorLabel: 'In Progress • waiting for lane',
        status: 'Queued',
        latencyCue: 'Queued for lane.',
        actionAcknowledgement: 'Signal received',
      };
    case 'preflight':
      return {
        stateLabel: 'preflight',
        stageLabel: 'Preflight • running checks',
        monitorLabel: 'In Progress • running checks',
        status: 'Preflight',
        latencyCue: 'Checks in motion.',
        actionAcknowledgement: 'Signal live',
      };
    case 'running':
      return {
        stateLabel: 'running',
        stageLabel: 'In Progress • generating output',
        monitorLabel: 'In Progress • generating output',
        status: 'Running',
        latencyCue: 'Run in motion.',
        actionAcknowledgement: 'Signal live',
      };
    case 'packaging':
      return {
        stateLabel: 'packaging',
        stageLabel: 'In Progress • preparing preview',
        monitorLabel: 'In Progress • preparing preview',
        status: 'Packaging',
        latencyCue: 'Preview resolving.',
        actionAcknowledgement: 'Signal live',
      };
    case 'completed':
      return {
        stateLabel: 'completed',
        stageLabel: options.statusLabel ?? 'Current Output ready',
        monitorLabel: 'Current Output ready',
        status: 'Completed',
        latencyCue: null,
        actionAcknowledgement: 'Signal resolved',
      };
    case 'failed':
      return {
        stateLabel: 'failed',
        stageLabel: failedBeforeRenderStart ? 'Blocked before render start' : 'Execution failed',
        monitorLabel: failedBeforeRenderStart ? 'Blocked before render start' : 'Execution failed',
        status: 'Failed',
        latencyCue: null,
        actionAcknowledgement: 'Signal flagged',
        failedBeforeRenderStart,
      };
    case 'cancelled':
      return {
        stateLabel: 'cancelled',
        stageLabel: 'Cancelled • execution stopped',
        monitorLabel: 'Execution cancelled',
        status: 'Cancelled',
        latencyCue: null,
        actionAcknowledgement: 'Signal stopped',
      };
    default:
      return {
        stateLabel: state,
        stageLabel: options.statusLabel ?? 'Awaiting execution state',
        monitorLabel: options.statusLabel ?? 'Awaiting execution state',
        status: state,
        latencyCue: null,
        actionAcknowledgement: 'Signal pending',
      };
  }
};
