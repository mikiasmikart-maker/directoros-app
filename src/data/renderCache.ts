import type { RenderBridgeJob } from '../bridge/renderBridge';
import type { OutputMediaType, RenderOutputAsset } from '../render/jobQueue';

export interface RenderCacheEntry {
  jobId: string;
  sceneId: string;
  shotId?: string;
  takeId?: string;
  version?: number;
  lineageParentJobId?: string;
  engine: RenderBridgeJob['engine'];
  prompt: string;
  seed: number;
  outputs: string[];
  resultPaths: string[];
  outputAssets?: RenderOutputAsset[];
  previewImage?: string;
  previewMedia?: string;
  previewType?: OutputMediaType;
  timestamp: number;
}

export interface RenderManifestEntry {
  jobId: string;
  sceneId: string;
  shotId?: string;
  takeId?: string;
  version?: number;
  lineageParentJobId?: string;
  engine?: RenderBridgeJob['engine'];
  externalJobId?: string;
  runtimeBridgeJobId?: string;
  state: 'queued' | 'preflight' | 'running' | 'packaging' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  route: string;
  strategy: string;
  manifestPath: string;
  updatedAt: number;
  resultPaths?: string[];
  outputAssets?: RenderOutputAsset[];
  previewImage?: string;
  previewMedia?: string;
  previewType?: OutputMediaType;
  error?: string;
}

const CACHE_KEY = 'directoros.renderCache.v2';
const MANIFEST_KEY = 'directoros.renderManifest.v1';

const cache = new Map<string, RenderCacheEntry>();
const manifests = new Map<string, RenderManifestEntry>();

const hasWindow = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const MAX_CACHE_ENTRIES = 100;

const prune = () => {
  if (cache.size > MAX_CACHE_ENTRIES) {
    const keys = Array.from(cache.keys()).sort((a, b) => (cache.get(b)?.timestamp || 0) - (cache.get(a)?.timestamp || 0));
    keys.slice(MAX_CACHE_ENTRIES).forEach(k => cache.delete(k));
  }
  if (manifests.size > MAX_CACHE_ENTRIES) {
    const keys = Array.from(manifests.keys()).sort((a, b) => (manifests.get(b)?.updatedAt || 0) - (manifests.get(a)?.updatedAt || 0));
    keys.slice(MAX_CACHE_ENTRIES).forEach(k => manifests.delete(k));
  }
};

const persist = () => {
  if (!hasWindow) return;
  prune();
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(cache.values())));
  window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(Array.from(manifests.values())));
};

const hydrate = () => {
  if (!hasWindow) return;
  try {
    const rawCache = window.localStorage.getItem(CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache) as RenderCacheEntry[];
      parsed.forEach((entry) => cache.set(entry.jobId, entry));
    }

    const rawManifest = window.localStorage.getItem(MANIFEST_KEY);
    if (rawManifest) {
      const parsed = JSON.parse(rawManifest) as RenderManifestEntry[];
      parsed.forEach((entry) => manifests.set(entry.jobId, entry));
    }
  } catch {
    // ignore hydration issues and continue with in-memory cache
  }
};

hydrate();

export const saveRenderResult = (entry: RenderCacheEntry, skipPersist = false): RenderCacheEntry => {
  cache.set(entry.jobId, entry);
  if (!skipPersist) persist();
  return entry;
};

export const upsertRenderManifest = (entry: RenderManifestEntry, skipPersist = false): RenderManifestEntry => {
  manifests.set(entry.jobId, entry);
  if (!skipPersist) persist();
  return entry;
};

export const forcePersistRenderCache = () => persist();

export const getRenderResult = (jobId: string): RenderCacheEntry | undefined => cache.get(jobId);

export const getRenderManifest = (jobId: string): RenderManifestEntry | undefined => manifests.get(jobId);

export const listRenderResults = (): RenderCacheEntry[] => Array.from(cache.values()).sort((a, b) => b.timestamp - a.timestamp);

export const listRenderManifests = (): RenderManifestEntry[] => Array.from(manifests.values()).sort((a, b) => b.updatedAt - a.updatedAt);
