import type { RuntimeHealthStatus, RuntimeRenderSubmissionRequest, RuntimeRenderSubmissionResponse } from './types';

const API_BASE = import.meta.env.VITE_DIRECTOROS_RUNTIME_API || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: controller.signal,
      ...init,
    });
    clearTimeout(id);

    // Identify proxy timeouts/failures as connection issues
    if (response.status === 500 || response.status === 504 || response.status === 503 || response.status === 502) {
      const connError = new Error(`Runtime bridge unreachable via proxy (${response.status})`);
      (connError as any).isConnectionError = true;
      throw connError;
    }

    const data = await response.json();
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `Runtime request failed: ${response.status}`);
    }
    return data as T;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      const timeoutError = new Error('Runtime request timed out');
      (timeoutError as any).isTimeout = true;
      throw timeoutError;
    }
    
    if (err instanceof TypeError && (err.message.includes('Failed to fetch') || err.message.includes('Load failed') || err.message.includes('NetworkError'))) {
      const connError = new Error('Runtime bridge connection refused');
      (connError as any).isConnectionError = true;
      throw connError;
    }
    
    throw err;
  }
}


export const runtimeApi = {
  health: async (): Promise<RuntimeHealthStatus> => request(`/api/runtime/health?t=${Date.now()}`),
  render: async (payload: RuntimeRenderSubmissionRequest): Promise<RuntimeRenderSubmissionResponse> =>
    request('/api/runtime/render', { method: 'POST', body: JSON.stringify(payload) }),
  jobs: async (limit = 100) => request(`/api/runtime/jobs?limit=${limit}`),
  jobDetail: async (jobId: string) => request(`/api/runtime/jobs/${encodeURIComponent(jobId)}`),
  cancelJob: async (jobId: string) => request(`/api/runtime/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' }),
  recentRenders: async (limit = 8) => request(`/api/runtime/recent-renders?limit=${limit}`),
  timeline: async (limit = 30) => request(`/api/runtime/timeline?limit=${limit}`),
};
