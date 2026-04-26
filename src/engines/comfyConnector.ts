import type { RenderBridgeJob } from '../bridge/renderBridge';
import { EngineAdapterError, type EngineAdapter, type ProviderJobStatus } from './adapter';

interface TrackedComfyJob {
  startedAt: number;
  lastProgress: number;
}

interface ComfyPromptSubmitResponse {
  prompt_id?: string;
  error?: string;
  node_errors?: unknown;
}

interface ComfyHistoryOutputImage {
  filename?: string;
  subfolder?: string;
  type?: string;
}

interface ComfyHistoryNodeOutput {
  images?: ComfyHistoryOutputImage[];
}

interface ComfyHistoryRecord {
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: Array<{ type?: string; data?: { exception_message?: string } }>;
  };
  outputs?: Record<string, ComfyHistoryNodeOutput>;
}

interface ComfyQueueSnapshot {
  queue_running?: Array<[number, string]>;
  queue_pending?: Array<[number, string]>;
}

const tracked = new Map<string, TrackedComfyJob>();

const COMFY_BASE_URL = (import.meta.env.VITE_COMFYUI_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://127.0.0.1:8188';
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_COMFYUI_TIMEOUT_MS ?? 12_000);
const MAX_RETRIES = Number(import.meta.env.VITE_COMFYUI_RETRIES ?? 3);
const RETRY_BACKOFF_MS = Number(import.meta.env.VITE_COMFYUI_BACKOFF_MS ?? 450);
const SMOKE_MODE = String(import.meta.env.VITE_COMFYUI_SMOKE_MODE ?? 'false').toLowerCase() === 'true';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const asEngineError = (error: unknown): EngineAdapterError => {
  if (error instanceof EngineAdapterError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new EngineAdapterError('ComfyUI request timed out.', {
      kind: 'timeout',
      retryable: true,
      provider: 'comfyui',
      cause: error,
    });
  }
  return new EngineAdapterError('Unexpected ComfyUI adapter failure.', {
    kind: 'fatal_transport',
    retryable: false,
    provider: 'comfyui',
    cause: error,
  });
};

const requestJson = async <T>(path: string, init: RequestInit = {}, retryCount = MAX_RETRIES): Promise<T> => {
  let lastError: EngineAdapterError | undefined;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${COMFY_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        throw new EngineAdapterError(`ComfyUI HTTP ${response.status} on ${path}`, {
          kind: retryable ? 'retryable_transport' : 'provider_failure',
          retryable,
          provider: 'comfyui',
          statusCode: response.status,
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = asEngineError(error);
      const shouldRetry = lastError.retryable && attempt < retryCount;
      if (!shouldRetry) throw lastError;
      const backoff = RETRY_BACKOFF_MS * Math.max(1, attempt + 1);
      await sleep(backoff);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new EngineAdapterError('ComfyUI request failed after retries.', {
    kind: 'fatal_transport',
    provider: 'comfyui',
  });
};

const getComfyQueueMembership = async (externalJobId: string): Promise<'queued' | 'running' | 'none'> => {
  const snapshot = await requestJson<ComfyQueueSnapshot>('/queue');
  const running = (snapshot.queue_running ?? []).some((entry) => entry[1] === externalJobId);
  if (running) return 'running';
  const pending = (snapshot.queue_pending ?? []).some((entry) => entry[1] === externalJobId);
  if (pending) return 'queued';
  return 'none';
};

const mapComfyHistoryStatus = (record?: ComfyHistoryRecord): ProviderJobStatus => {
  if (!record) return 'unknown';
  const status = record.status?.status_str?.toLowerCase();
  if (status?.includes('error') || status?.includes('failed')) return 'failed';
  if (record.status?.completed) return 'succeeded';
  return 'running';
};

const listOutputImages = (record?: ComfyHistoryRecord): ComfyHistoryOutputImage[] => {
  if (!record?.outputs) return [];
  return Object.values(record.outputs)
    .flatMap((node) => node.images ?? [])
    .filter((img) => Boolean(img.filename));
};

const verifyArtifactReachable = async (url: string) => {
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (response.ok) return;
      lastStatus = response.status;
    } catch (error) {
      const adapterError = asEngineError(error);
      if (!adapterError.retryable || attempt >= 2) {
        throw new EngineAdapterError(`ComfyUI artifact unreachable: ${url}`, {
          kind: 'missing_artifact',
          retryable: false,
          provider: 'comfyui',
          statusCode: lastStatus,
          cause: error,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(RETRY_BACKOFF_MS * (attempt + 1));
  }

  throw new EngineAdapterError(`ComfyUI artifact unavailable (HTTP ${lastStatus ?? 'unknown'}): ${url}`, {
    kind: 'missing_artifact',
    retryable: false,
    provider: 'comfyui',
    statusCode: lastStatus,
  });
};

const buildComfyWorkflow = (job: RenderBridgeJob) => {
  if (SMOKE_MODE) {
    return {
      1: {
        class_type: 'EmptyImage',
        inputs: {
          width: job.payload.parameters?.width ?? 1024,
          height: job.payload.parameters?.height ?? 576,
          batch_size: 1,
          color: 0,
        },
      },
      2: {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: `directoros/${job.sceneId}/${job.id}`,
          images: ['1', 0],
        },
      },
    };
  }

  return {
    3: {
      class_type: 'KSampler',
      inputs: {
        cfg: job.payload.parameters?.cfg ?? 5.5,
        denoise: 1,
        latent_image: ['5', 0],
        model: ['4', 0],
        negative: ['7', 0],
        positive: ['6', 0],
        sampler_name: job.payload.parameters?.sampler ?? 'dpmpp_2m',
        scheduler: 'karras',
        seed: job.seed,
        steps: job.payload.parameters?.steps ?? 30,
      },
    },
    4: {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: `${job.payload.parameters?.model ?? 'sd_xl_base_1.0'}.safetensors`,
      },
    },
    5: {
      class_type: 'EmptyLatentImage',
      inputs: {
        batch_size: 1,
        height: job.payload.parameters?.height ?? 1024,
        width: job.payload.parameters?.width ?? 1024,
      },
    },
    6: {
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['4', 1],
        text: job.payload.prompt,
      },
    },
    7: {
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['4', 1],
        text: 'low quality, blurry, distorted anatomy, extra limbs',
      },
    },
    8: {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
    },
    9: {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: `directoros/${job.sceneId}/${job.id}`,
        images: ['8', 0],
      },
    },
  };
};

const adapter: EngineAdapter = {
  submitJob: async (job) => {
    await requestJson('/system_stats', { method: 'GET' }, 5);

    const response = await requestJson<ComfyPromptSubmitResponse>('/prompt', {
      method: 'POST',
      body: JSON.stringify({
        prompt: buildComfyWorkflow(job),
        client_id: `directoros-${job.id}`,
      }),
    });

    if (!response.prompt_id) {
      throw new EngineAdapterError(response.error ?? 'ComfyUI did not return prompt_id.', {
        kind: 'bad_response',
        retryable: false,
        provider: 'comfyui',
      });
    }

    tracked.set(response.prompt_id, { startedAt: Date.now(), lastProgress: 3 });
    return { externalJobId: response.prompt_id };
  },

  getStatus: async (externalJobId) => {
    const historyById = await requestJson<Record<string, ComfyHistoryRecord>>(`/history/${externalJobId}`);
    const record = historyById[externalJobId];
    const mapped = mapComfyHistoryStatus(record);

    const tracker = tracked.get(externalJobId) ?? { startedAt: Date.now(), lastProgress: 3 };

    if (mapped === 'failed') {
      const providerMessage = record?.status?.messages?.find((m) => m.type === 'execution_error')?.data?.exception_message;
      throw new EngineAdapterError(providerMessage ?? 'ComfyUI reported provider failure.', {
        kind: 'provider_failure',
        provider: 'comfyui',
      });
    }

    if (mapped === 'succeeded') {
      tracked.set(externalJobId, { ...tracker, lastProgress: 100 });
      return { providerStatus: 'succeeded' as const, progress: 100 };
    }

    const queueState = await getComfyQueueMembership(externalJobId);
    if (queueState === 'queued') {
      const progress = Math.min(20, Math.max(5, tracker.lastProgress));
      tracked.set(externalJobId, { ...tracker, lastProgress: progress });
      return { providerStatus: 'queued' as const, progress };
    }

    if (queueState === 'running') {
      const elapsedMs = Date.now() - tracker.startedAt;
      const inferredProgress = Math.min(95, Math.max(21, Math.round(elapsedMs / 180)));
      const progress = Math.max(tracker.lastProgress, inferredProgress);
      tracked.set(externalJobId, { ...tracker, lastProgress: progress });
      return { providerStatus: 'running' as const, progress };
    }

    const fallbackProgress = Math.min(95, Math.max(21, tracker.lastProgress));
    tracked.set(externalJobId, { ...tracker, lastProgress: fallbackProgress });
    return { providerStatus: 'running' as const, progress: fallbackProgress };
  },

  fetchResult: async (externalJobId) => {
    const historyById = await requestJson<Record<string, ComfyHistoryRecord>>(`/history/${externalJobId}`);
    const record = historyById[externalJobId];
    const images = listOutputImages(record);

    if (!images.length) {
      throw new EngineAdapterError('ComfyUI completed but returned no output artifacts.', {
        kind: 'missing_artifact',
        retryable: false,
        provider: 'comfyui',
      });
    }

    const outputs = images.map((img) => {
      const params = new URLSearchParams({
        filename: img.filename ?? '',
      });
      if (img.subfolder) params.set('subfolder', img.subfolder);
      if (img.type) params.set('type', img.type);
      return `${COMFY_BASE_URL}/view?${params.toString()}`;
    });

    const normalized = Array.from(new Set(outputs.map((path) => path.trim()).filter(Boolean)));
    if (!normalized.length) {
      throw new EngineAdapterError('ComfyUI completed but returned no normalized output artifacts.', {
        kind: 'missing_artifact',
        retryable: false,
        provider: 'comfyui',
      });
    }

    for (const artifactUrl of normalized) {
      await verifyArtifactReachable(artifactUrl);
    }

    tracked.delete(externalJobId);
    return { outputs: normalized };
  },

  cancelJob: async (externalJobId) => {
    try {
      await requestJson('/interrupt', { method: 'POST', body: JSON.stringify({}) }, 1);
      tracked.delete(externalJobId);
      return { cancelled: true, message: 'ComfyUI interrupt sent.' };
    } catch (error) {
      const adapterError = asEngineError(error);
      return {
        cancelled: false,
        message: `ComfyUI cancel failed: ${adapterError.message}`,
      };
    }
  },
};

export const submitJob = adapter.submitJob;
export const getStatus = adapter.getStatus;
export const fetchResult = adapter.fetchResult;
export const cancelJob = adapter.cancelJob;
