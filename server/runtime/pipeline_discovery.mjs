import path from 'node:path';
import { derivedPaths } from './config.mjs';
import { fileExists, listFilesSafe, normalizeOutputKind, parseManifestTimestamp, safeReadJsonFile, statSafe, toFileUrlPath, toIso } from './helpers.mjs';

const acceptedRunsRegistryPath = path.join(derivedPaths.pipelineOutputsRoot, 'runtime', 'accepted_runs.json');

const manifestFilter = (entry) => /^manifest_\d{8}_\d{6}\.json$/i.test(entry.name);

const normalizeManifestRef = (manifestPath, manifest) => ({
  path: manifestPath,
  filename: path.basename(manifestPath),
  created_at: manifest?.created_at || parseManifestTimestamp(path.basename(manifestPath)),
  job_id: manifest?.job_name,
  engine: manifest?.template || manifest?.checkpoint,
  output_path: manifest?.final_copies?.[0]?.dest || manifest?.latest_output_path,
  latest_for_family: false,
});

const toOutputAsset = async (filePath, role = 'historical') => {
  const stats = await statSafe(filePath);
  return {
    path: filePath,
    url: toFileUrlPath(filePath),
    filename: path.basename(filePath),
    kind: normalizeOutputKind(filePath),
    role,
    modified_at: toIso(stats?.mtime),
    modified_time_ms: stats?.mtimeMs,
  };
};

export const sanitizeJobId = (id) => {
  if (!id) return id;
  return id.replace(/[/\\:]/g, '__');
};

const jobStateFilter = (entry) => entry.name.endsWith('.json');

export const readJobStates = async () => {
  const files = await listFilesSafe(derivedPaths.jobsStateRoot, jobStateFilter);
  const states = await Promise.all(files.map(safeReadJsonFile));
  return states.filter(Boolean);
};

export const listManifestPaths = async () => {
  const files = await listFilesSafe(derivedPaths.comfyOutputsRoot, manifestFilter);
  const withStats = await Promise.all(files.map(async (file) => ({ file, stats: await statSafe(file) })));
  return withStats.sort((a, b) => (b.stats?.mtimeMs || 0) - (a.stats?.mtimeMs || 0)).map((entry) => entry.file);
};

export const readLatestPointer = async () => {
  const latestPath = path.join(derivedPaths.comfyOutputsRoot, 'latest_manifest.json');
  return safeReadJsonFile(latestPath);
};

export const readManifest = async (manifestPath) => {
  const manifest = await safeReadJsonFile(manifestPath);
  if (!manifest) return null;

  const outputPaths = [];
  for (const entry of manifest.final_copies || []) {
    if (entry?.dest) outputPaths.push(entry.dest);
  }
  if (manifest.latest_output_path) outputPaths.push(manifest.latest_output_path);

  const uniqueOutputPaths = [...new Set(outputPaths)].filter(Boolean);
  const outputAssets = await Promise.all(
    uniqueOutputPaths.map(async (outputPath, index) => toOutputAsset(outputPath, index === 0 ? 'authoritative' : 'historical')),
  );
  const authoritativeOutput = outputAssets[0];
  const previewImage = authoritativeOutput && authoritativeOutput.kind === 'image' ? authoritativeOutput.url : undefined;

  return {
    manifest,
    manifest_ref: normalizeManifestRef(manifestPath, manifest),
    output_assets: outputAssets,
    authoritative_output: authoritativeOutput,
    preview_image: previewImage,
    output_paths: uniqueOutputPaths,
  };
};

export const readAcceptedRunsRegistry = async () => {
  const registry = await safeReadJsonFile(acceptedRunsRegistryPath);
  if (!registry || typeof registry !== 'object') return { runs: [] };
  return {
    runs: Array.isArray(registry.runs) ? registry.runs : [],
  };
};

const isProcessAlive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const toPendingAcceptedRunJob = (entry) => {
  const isAlive = entry.runtime?.pid ? isProcessAlive(entry.runtime.pid) : true;
  const isFailed = !isAlive;
  return {
    job_id: entry.job_id,
    parent_job_id: entry.parent_job_id,
    mode: entry.mode || 'studio_run',
    preset: 'pending',
    status: isFailed ? 'failed' : 'queued',
    preview_image: undefined,
    preview_image_url: undefined,
    started_at: entry.accepted_at,
    ended_at: isFailed ? new Date().toISOString() : undefined,
    duration_ms: undefined,
    manifest_path: entry.manifest_path,
    engine: entry.engine_target,
    warnings: isFailed ? ['process died before manifest materialization'] : ['awaiting manifest materialization'],
  };
};

const toPendingAcceptedRunDetail = (entry) => {
  const isAlive = entry.runtime?.pid ? isProcessAlive(entry.runtime.pid) : true;
  const isFailed = !isAlive;
  return {
    job_id: entry.job_id,
    parent_job_id: entry.parent_job_id,
    mode: entry.mode || 'studio_run',
    preset: 'pending',
    status: isFailed ? 'failed' : 'queued',
    command: undefined,
    started_at: entry.accepted_at,
    ended_at: undefined,
    variation_count: 0,
    seeds: entry.seed ? [entry.seed] : undefined,
    outputs: [],
    authoritative_output: undefined,
    manifest_path: entry.manifest_path,
    manifest_ref: entry.manifest_path ? { path: entry.manifest_path, filename: path.basename(entry.manifest_path) } : undefined,
    preflight: { passed: true, checks: [] },
    dependency_status: { bridge: 'ok' },
    errors: isFailed ? ['background process exited prematurely'] : [],
    warnings: isFailed ? ['process died before manifest materialization'] : ['awaiting manifest materialization'],
    metadata_path: undefined,
    preview_image_url: undefined,
    preview_image: undefined,
    engine: entry.engine_target,
    runtime: { pid: entry.runtime?.pid },
  };
};

export const getRecentRenders = async (limit = 8) => {
  const manifestPaths = await listManifestPaths();
  const manifests = await Promise.all(manifestPaths.slice(0, limit).map((manifestPath) => readManifest(manifestPath)));
  return manifests.filter(Boolean).map((entry) => ({
    path: entry.authoritative_output?.path || entry.manifest_ref.path,
    imageUrl: entry.preview_image,
    filename: entry.authoritative_output?.filename || entry.manifest_ref.filename,
    label: entry.manifest?.job_name || entry.manifest_ref.filename,
    modifiedTime: entry.authoritative_output?.modified_at || entry.manifest_ref.created_at,
    modifiedTimeMs: entry.authoritative_output?.modified_time_ms || undefined,
    manifestPath: entry.manifest_ref.path,
    jobId: sanitizeJobId(entry.manifest?.job_name),
  }));
};

export const getJobs = async (limit = 100) => {
  const manifestPaths = await listManifestPaths();
  const manifests = await Promise.all(manifestPaths.slice(0, limit).map((manifestPath) => readManifest(manifestPath)));
  const manifestJobsRaw = manifests.filter(Boolean).map((entry) => {
    const jobId = sanitizeJobId(entry.manifest?.job_name || path.basename(entry.manifest_ref.path, '.json'));
    return {
      job_id: jobId,
      parent_job_id: entry.manifest?.parent_job_id,
      mode: entry.manifest?.family ? 'studio_run' : 'cinematic',
      preset: entry.manifest?.template || 'unknown',
      status: entry.manifest?.status || 'completed',
      preview_image: entry.authoritative_output?.path,
      preview_image_url: entry.preview_image,
      started_at: entry.manifest?.created_at,
      ended_at: entry.manifest?.completed_at,
      duration_ms:
        entry.manifest?.created_at && entry.manifest?.completed_at
          ? new Date(entry.manifest.completed_at).getTime() - new Date(entry.manifest.created_at).getTime()
          : undefined,
      manifest_path: entry.manifest_ref.path,
      engine: entry.manifest?.checkpoint || entry.manifest?.template,
    };
  });

  // Deduplicate manifest jobs (keep newest/first)
  const manifestJobs = [];
  const manifestSeenIds = new Set();
  for (const m of manifestJobsRaw) {
    if (!manifestSeenIds.has(m.job_id)) {
      manifestJobs.push(m);
      manifestSeenIds.add(m.job_id);
    }
  }
  
  const registry = await readAcceptedRunsRegistry();
  const lineageMap = new Map();
  for (const r of registry.runs) {
    if (r?.job_id) lineageMap.set(sanitizeJobId(r.job_id), r.parent_job_id);
  }

  const pipelineStates = await readJobStates();
  const primaryJobsList = [];
  const primaryJobIdsSet = new Set();

  for (const state of pipelineStates) {
    if (!state.job_id) continue;
    const canonicalId = sanitizeJobId(state.job_id);
    primaryJobIdsSet.add(canonicalId);

    const augmentingManifest = manifestJobs.find(m => m.job_id === canonicalId);
    const registryParentId = lineageMap.get(canonicalId);

    let duration_ms = undefined;
    const startIso = state.timestamps?.queued;
    const endIso = state.timestamps?.completed || state.timestamps?.failed || state.timestamps?.cancelled;
    if (startIso && endIso) {
      duration_ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    }

    primaryJobsList.push({
      job_id: canonicalId,
      parent_job_id: state.metadata?.parent_job_id || augmentingManifest?.parent_job_id || registryParentId,
      mode: 'studio_run',
      preset: state.recipe || augmentingManifest?.preset || 'unknown',
      status: state.state || 'queued',
      preview_image: augmentingManifest?.preview_image,
      preview_image_url: augmentingManifest?.preview_image_url,
      started_at: startIso || augmentingManifest?.started_at,
      ended_at: endIso || augmentingManifest?.ended_at,
      duration_ms: duration_ms || augmentingManifest?.duration_ms,
      manifest_path: augmentingManifest?.manifest_path,
      engine: augmentingManifest?.engine || 'unknown',
      errors: state.error ? [state.error] : []
    });
  }

  const unmergedManifestJobs = manifestJobs.filter(m => !primaryJobIdsSet.has(m.job_id));

  // Also apply lineage to unmerged manifest jobs
  for (const m of unmergedManifestJobs) {
    if (!m.parent_job_id) {
      m.parent_job_id = lineageMap.get(m.job_id);
    }
  }

  const mergedJobIdsSet = new Set([...primaryJobIdsSet, ...unmergedManifestJobs.map(m => m.job_id)]);

  const pendingAcceptedRuns = [];
  const pendingSeenIds = new Set();
  // registry.runs might have duplicates from rapid retry clicks; pick first (newest if prepended, but registry is usually appended)
  // Actually getJobs sorts by started_at later, so we just need uniqueness here.
  for (const entry of registry.runs) {
    if (!entry?.job_id) continue;
    const cid = sanitizeJobId(entry.job_id);
    if (mergedJobIdsSet.has(cid) || pendingSeenIds.has(cid)) continue;

    const mapped = toPendingAcceptedRunJob(entry);
    mapped.job_id = cid;
    pendingAcceptedRuns.push(mapped);
    pendingSeenIds.add(cid);
  }

  const allJobs = [...primaryJobsList, ...unmergedManifestJobs, ...pendingAcceptedRuns];
  return allJobs.sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime()).slice(0, limit);
};

export const getJobDetail = async (jobId) => {
  const canonicalJobId = sanitizeJobId(jobId);

  const registry = await readAcceptedRunsRegistry();
  const persistedParentId = registry.runs.find(r => sanitizeJobId(r.job_id) === canonicalJobId)?.parent_job_id;

  const pipelineStates = await readJobStates();
  const matchingState = pipelineStates.find(s => s && sanitizeJobId(s.job_id) === canonicalJobId);

  let augmentingManifestEntry = null;
  const manifestPaths = await listManifestPaths();
  for (const manifestPath of manifestPaths) {
    const entry = await readManifest(manifestPath);
    if (!entry) continue;
    const candidateId = sanitizeJobId(entry.manifest?.job_name || path.basename(manifestPath, '.json'));
    if (candidateId === canonicalJobId) {
      augmentingManifestEntry = entry;
      break;
    }
  }

  const acceptedRun = (await readAcceptedRunsRegistry()).runs.find((entry) => sanitizeJobId(entry?.job_id) === canonicalJobId);
  
  let baseDetail = null;

  if (matchingState) {
    const endIso = matchingState.timestamps?.completed || matchingState.timestamps?.failed || matchingState.timestamps?.cancelled;
    baseDetail = {
      job_id: canonicalJobId,
      parent_job_id: matchingState.metadata?.parent_job_id || augmentingManifestEntry?.manifest?.parent_job_id || persistedParentId,
      mode: 'studio_run',
      preset: matchingState.recipe || augmentingManifestEntry?.manifest?.template || 'unknown',
      status: matchingState.state || 'queued',
      command: undefined,
      started_at: matchingState.timestamps?.queued || augmentingManifestEntry?.manifest?.created_at,
      ended_at: endIso || augmentingManifestEntry?.manifest?.completed_at,
      variation_count: augmentingManifestEntry && Array.isArray(augmentingManifestEntry.output_assets) ? augmentingManifestEntry.output_assets.length : 0,
      seeds: augmentingManifestEntry?.manifest?.contract?.seed ? [augmentingManifestEntry.manifest.contract.seed] : undefined,
      outputs: augmentingManifestEntry?.output_assets || [],
      authoritative_output: augmentingManifestEntry?.authoritative_output,
      manifest_path: augmentingManifestEntry?.manifest_ref?.path,
      manifest_ref: augmentingManifestEntry?.manifest_ref,
      preflight: { passed: matchingState.state !== 'failed', checks: [] },
      dependency_status: { comfyui: 'ok', ollama: augmentingManifestEntry?.manifest?.ollama_model ? 'ok' : 'unknown' },
      errors: matchingState.error ? [matchingState.error] : [],
      warnings: augmentingManifestEntry?.manifest?.contract_fallback_used ? ['contract fallback used'] : [],
      metadata_path: undefined,
      preview_image_url: augmentingManifestEntry?.preview_image,
      preview_image: augmentingManifestEntry?.authoritative_output?.path,
      engine: augmentingManifestEntry?.manifest?.checkpoint || augmentingManifestEntry?.manifest?.template,
    };
  } else if (augmentingManifestEntry) {
    baseDetail = {
      job_id: canonicalJobId,
      parent_job_id: augmentingManifestEntry.manifest?.parent_job_id || persistedParentId,
      mode: augmentingManifestEntry.manifest?.family ? 'studio_run' : 'cinematic',
      preset: augmentingManifestEntry.manifest?.template || 'unknown',
      status: augmentingManifestEntry.manifest?.status || 'completed',
      command: undefined,
      started_at: augmentingManifestEntry.manifest?.created_at,
      ended_at: augmentingManifestEntry.manifest?.completed_at,
      variation_count: Array.isArray(augmentingManifestEntry.output_assets) ? augmentingManifestEntry.output_assets.length : 0,
      seeds: augmentingManifestEntry.manifest?.contract?.seed ? [augmentingManifestEntry.manifest.contract.seed] : undefined,
      outputs: augmentingManifestEntry.output_assets,
      authoritative_output: augmentingManifestEntry.authoritative_output,
      manifest_path: augmentingManifestEntry.manifest_ref.path,
      manifest_ref: augmentingManifestEntry.manifest_ref,
      preflight: { passed: true, checks: [] },
      dependency_status: { comfyui: 'ok', ollama: augmentingManifestEntry.manifest?.ollama_model ? 'ok' : 'unknown' },
      errors: [],
      warnings: augmentingManifestEntry.manifest?.contract_fallback_used ? ['contract fallback used'] : [],
      metadata_path: undefined,
      preview_image_url: augmentingManifestEntry.preview_image,
      preview_image: augmentingManifestEntry.authoritative_output?.path,
      engine: augmentingManifestEntry.manifest?.checkpoint || augmentingManifestEntry.manifest?.template,
    };
  } else if (acceptedRun) {
    const mapped = toPendingAcceptedRunDetail(acceptedRun);
    mapped.job_id = sanitizeJobId(mapped.job_id);
    baseDetail = mapped;
  }

  if (baseDetail && baseDetail.parent_job_id) {
    // Shallow lookup for parent info to enable UI provenance thumbnails
    const parentId = baseDetail.parent_job_id;
    const parentManifestPaths = await listManifestPaths();
    for (const p of parentManifestPaths.slice(0, 50)) { // Limit search depth for performance
      const entry = await readManifest(p);
      if (entry && sanitizeJobId(entry.manifest?.job_name || path.basename(p, '.json')) === sanitizeJobId(parentId)) {
        baseDetail.parent_info = {
          job_id: parentId,
          status: entry.manifest?.status || 'completed',
          preview_image_url: entry.preview_image,
        };
        break;
      }
    }
  }

  return baseDetail;
};

export const getTimeline = async (limit = 30) => {
  const manifestPaths = await listManifestPaths();
  const manifestEntries = await Promise.all(manifestPaths.slice(0, limit).map((manifestPath) => readManifest(manifestPath)));

  const pipelineStates = await readJobStates();

  const timelineEntries = [];
  const processedJobIds = new Set();

  for (const s of pipelineStates) {
    if (!s.job_id) continue;
    const canonicalId = sanitizeJobId(s.job_id);
    processedJobIds.add(canonicalId);

    const ma = manifestEntries.find(entry => entry && sanitizeJobId(entry.manifest?.job_name || entry.manifest_ref.filename) === canonicalId);
    const endIso = s.timestamps?.completed || s.timestamps?.failed || s.timestamps?.cancelled;

    timelineEntries.push({
      id: `timeline:${canonicalId}`,
      job_id: canonicalId,
      manifest_path: ma?.manifest_ref?.path,
      recipe: s.recipe || ma?.manifest?.recipe,
      family: s.family || ma?.manifest?.family,
      status: s.state || 'completed',
      created_at: s.timestamps?.queued || ma?.manifest?.created_at,
      completed_at: endIso || ma?.manifest?.completed_at,
      duration_ms: (s.timestamps?.queued && endIso)
        ? new Date(endIso).getTime() - new Date(s.timestamps.queued).getTime()
        : undefined,
      output_path: ma?.authoritative_output?.path,
      image_url: ma?.preview_image,
      engine: ma?.manifest?.checkpoint || ma?.manifest?.template || 'unknown',
      summary: s.metadata?.intent || ma?.manifest?.intent,
    });
  }

  for (const entry of manifestEntries.filter(Boolean)) {
    const canonicalId = sanitizeJobId(entry.manifest?.job_name || entry.manifest_ref.filename);
    if (processedJobIds.has(canonicalId)) continue;

    timelineEntries.push({
      id: `timeline:${entry.manifest_ref.filename}`,
      job_id: canonicalId,
      manifest_path: entry.manifest_ref.path,
      recipe: entry.manifest?.recipe,
      family: entry.manifest?.family,
      status: entry.manifest?.status || 'completed',
      created_at: entry.manifest?.created_at,
      completed_at: entry.manifest?.completed_at,
      duration_ms:
        entry.manifest?.created_at && entry.manifest?.completed_at
          ? new Date(entry.manifest.completed_at).getTime() - new Date(entry.manifest.created_at).getTime()
          : undefined,
      output_path: entry.authoritative_output?.path,
      image_url: entry.preview_image,
      engine: entry.manifest?.checkpoint || entry.manifest?.template || 'unknown',
      summary: entry.manifest?.intent,
    });
  }

  return timelineEntries.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, limit);
};

export const resolveManifestForSubmission = async (submittedJobLabel) => {
  const acceptedRun = (await readAcceptedRunsRegistry()).runs.find((entry) => entry?.job_id === submittedJobLabel);
  if (acceptedRun) return { accepted_run: acceptedRun };

  const pointer = await readLatestPointer();
  const manifestPath = pointer?.latest_manifest_path;
  if (manifestPath && (await fileExists(manifestPath))) {
    const entry = await readManifest(manifestPath);
    if (entry && (!submittedJobLabel || entry.manifest?.job_name === submittedJobLabel || manifestPath.includes(submittedJobLabel))) {
      return entry;
    }
  }

  const manifestPaths = await listManifestPaths();
  // Search deeper to find older jobs
  for (const candidate of manifestPaths.slice(0, 200)) {
    const entry = await readManifest(candidate);
    if (!entry) continue;
    const manifestJobId = sanitizeJobId(entry.manifest?.job_name);
    if (!submittedJobLabel || manifestJobId === submittedJobLabel || candidate.includes(submittedJobLabel)) return entry;
  }
  return null;
};
