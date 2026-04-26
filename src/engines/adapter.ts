import type { RenderBridgeJob } from '../bridge/renderBridge';
import type { RenderJobState } from '../render/jobQueue';

export type ProviderJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'unknown';

export type EngineAdapterErrorKind =
  | 'retryable_transport'
  | 'fatal_transport'
  | 'timeout'
  | 'provider_failure'
  | 'missing_artifact'
  | 'bad_response';

export class EngineAdapterError extends Error {
  kind: EngineAdapterErrorKind;
  retryable: boolean;
  provider?: string;
  statusCode?: number;

  constructor(
    message: string,
    options: {
      kind: EngineAdapterErrorKind;
      retryable?: boolean;
      provider?: string;
      statusCode?: number;
      cause?: unknown;
    }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'EngineAdapterError';
    this.kind = options.kind;
    this.retryable = options.retryable ?? false;
    this.provider = options.provider;
    this.statusCode = options.statusCode;
  }
}

export interface EngineAdapter {
  submitJob: (job: RenderBridgeJob) => Promise<{ externalJobId: string }>;
  getStatus: (externalJobId: string) => Promise<{ providerStatus: ProviderJobStatus; progress: number }>;
  fetchResult: (externalJobId: string) => Promise<{ outputs: string[] }>;
  cancelJob?: (externalJobId: string) => Promise<{ cancelled: boolean; message?: string }>;
}

export const mapProviderStatusToRenderState = (status: ProviderJobStatus): RenderJobState => {
  switch (status) {
    case 'queued':
      return 'preflight';
    case 'running':
      return 'running';
    case 'succeeded':
      return 'packaging';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'unknown':
    default:
      return 'running';
  }
};
