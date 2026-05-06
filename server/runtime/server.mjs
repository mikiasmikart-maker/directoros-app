import fs from 'node:fs';
import http from 'node:http';
import { URL } from 'node:url';
import { runtimeConfig, derivedPaths } from './config.mjs';
import { json, safeReadJsonFile, writeJsonFile } from './helpers.mjs';
import { runPreflight } from './preflight.mjs';
import { getJobDetail, getJobs, getRecentRenders, getTimeline, readManifest, resolveManifestForSubmission } from './pipeline_discovery.mjs';
import { invokeStudioRun } from './studio_run.mjs';

const parseBody = async (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({ __parse_error: true });
      }
    });
  });

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

/**
 * Sanitize job ID to match studio-run safe filename logic exactly.
 * Replaces slashes and colons with double underscores.
 */
const sanitizeJobId = (id) => {
  if (!id) return id;
  return id.replace(/[/\\:]/g, '__');
};

const acceptedRunsRegistryPath = `${derivedPaths.pipelineOutputsRoot}/runtime/accepted_runs.json`;

const getAcceptedRuns = async () => {
  try {
    const current = await safeReadJsonFile(acceptedRunsRegistryPath);
    return Array.isArray(current?.runs) ? current.runs : [];
  } catch {
    return [];
  }
};

const persistAcceptedRun = async (entry) => {
  try {
    const runs = await getAcceptedRuns();
    const existing = runs.find((r) => r?.job_id === entry.job_id);
    const updated = { ...existing, ...entry };
    if (entry.runtime && existing?.runtime) {
      updated.runtime = { ...existing.runtime, ...entry.runtime };
    }
    const nextRuns = [...runs.filter((run) => run?.job_id !== entry.job_id), updated];
    await writeJsonFile(acceptedRunsRegistryPath, { runs: nextRuns });
  } catch (error) {
    console.warn('[runtime-render] accepted-run registry write failed', error?.message || error);
  }
};

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/runtime/files' && req.method === 'GET') {
    const filePath = url.searchParams.get('path');
    if (!filePath || !fs.existsSync(filePath)) return json(res, 404, { ok: false, error: 'file_not_found' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (pathname === '/runtime/health' && req.method === 'GET') {
    const preflight = await runPreflight();
    return json(res, 200, {
      ok: preflight.passed,
      bridge_status: 'ok',
      studio_run_status: preflight.checks.find((check) => check.name === 'studio_run_path')?.status === 'pass' ? 'ok' : 'down',
      pipeline_status: preflight.checks.find((check) => check.name === 'studio_pipeline_root')?.status === 'pass' ? 'ok' : 'down',
      dependency_status: preflight.dependency_status,
      precheck_enforced: true,
      checked_at: new Date().toISOString(),
      warnings: preflight.checks.filter((check) => check.status === 'warn').map((check) => `${check.name}: ${check.message}`),
      errors: preflight.checks.filter((check) => check.status === 'fail').map((check) => `${check.name}: ${check.message}`),
      preflight,
    });
  }

  if (pathname === '/runtime/render' && req.method === 'POST') {
    console.log('[runtime-render] entry');
    const body = await parseBody(req);
    if (body.__parse_error) return json(res, 400, { ok: false, error: 'invalid_json' });

    // Patch Retry Path: Resolve parameters from STUDIO_PIPELINE manifest authority
    if (body.intent === 'retry') {
      const targetJobId = body.job_id || body.job || body.job_label;
      if (!targetJobId) return json(res, 400, { ok: false, error: 'retry_target_missing' });

      let resolved = await resolveManifestForSubmission(targetJobId);
      
      // Identity Guard: If we only found accepted_run, check if a manifest exists anyway (lifecycle truth)
      if (resolved?.accepted_run && !resolved.manifest) {
        const detail = await getJobDetail(targetJobId);
        if (detail?.manifest_path) {
          const manifestData = await readManifest(detail.manifest_path);
          if (manifestData) resolved = { ...resolved, ...manifestData };
        }
      }

      const availableRecipeNames = new Set(
        fs.existsSync(derivedPaths.recipesDir)
          ? fs.readdirSync(derivedPaths.recipesDir)
            .map((name) => name.replace(/\.[^.]+$/, '').trim())
            .filter(Boolean)
          : []
      );

      const availableTemplateNames = new Set(
        fs.existsSync(derivedPaths.pipelineTemplatesRoot)
          ? fs.readdirSync(derivedPaths.pipelineTemplatesRoot)
            .map((name) => name.replace(/\.[^.]+$/, '').trim())
            .filter(Boolean)
          : []
      );

      const familyToRecipeMap = {
        box: 'box_cinematic_packshot',
      };

      const isCheckpointLike = (value) => /\.(safetensors|ckpt)$/i.test(value) || /sd[_-]?xl/i.test(value);
      const isRunnableRecipe = (value) => Boolean(value) && !isCheckpointLike(value) && availableRecipeNames.has(value);
      const isRunnableTemplateContract = (value) => Boolean(value) && !isCheckpointLike(value) && (availableTemplateNames.has(value) || availableRecipeNames.has(value));

      // Resolution Engine Helper
      const resolveRunnableFrom = (source) => {
        if (!source) return null;
        const sRecipe = typeof source.recipe === 'string' ? source.recipe.trim() : '';
        const sTemplate = typeof source.template === 'string' ? source.template.trim() : '';
        const sFamily = typeof source.family === 'string' ? source.family.trim() : '';

        if (isRunnableRecipe(sRecipe)) return { recipe: sRecipe, template: undefined, from: 'recipe' };
        if (isRunnableTemplateContract(sTemplate) && isRunnableRecipe(sTemplate)) return { recipe: sTemplate, template: sTemplate, from: 'template' };
        
        const familyRecipe = familyToRecipeMap[sFamily.toLowerCase()] || '';
        if (isRunnableRecipe(familyRecipe)) return { recipe: familyRecipe, from: 'family' };
        
        return null;
      };

      // Precedence: valid manifest -> valid explicit POST -> valid accepted_run hint -> reject
      let runSpec = resolveRunnableFrom(resolved?.manifest);
      let resolvedFrom = runSpec ? `manifest.${runSpec.from}` : '';
      
      if (!runSpec) {
        runSpec = resolveRunnableFrom(body); // Explicit POST
        if (runSpec) resolvedFrom = `body.${runSpec.from}`;
      }
      
      if (!runSpec && resolved?.accepted_run?.body_source) {
        runSpec = resolveRunnableFrom(resolved.accepted_run.body_source); // Accepted Run Hint
        if (runSpec) resolvedFrom = `accepted_run_hint.${runSpec.from}`;
      }

      if (!runSpec) {
        const m = resolved?.manifest || {};
        const checkpoint = typeof m.checkpoint === 'string' ? m.checkpoint.trim() : '';
        const blockedReason = checkpoint || isCheckpointLike(m.recipe) || isCheckpointLike(m.template)
          ? 'checkpoint_or_model_name_cannot_be_used_as_recipe_template'
          : 'no_runnable_recipe_or_template_contract';
        
        console.warn(`[runtime-render] retry blocked: ${blockedReason} target=${targetJobId}`);
        return json(res, 422, {
          ok: false,
          error: 'invalid_manifest_contract',
          job_id: targetJobId,
          parent_job_id: targetJobId,
          message: checkpoint
            ? 'Retry hydration failed: checkpoint-only manifest is blocked; runnable manifest.recipe/template/family contract required.'
            : 'Retry hydration failed: no runnable recipe/template could be resolved from manifest, explicit POST, or accepted_run hint.',
        });
      }

      // Re-hydrate request from best available source
      const m = resolved?.manifest || {};
      const hint = resolved?.accepted_run?.body_source || {};
      
      body.intent = m.intent || body.intent || hint.intent || 'render';
      body.family = m.family || body.family || hint.family;
      body.engine_target = m.engine_target || body.engine_target || hint.engine_target || (m.checkpoint ? 'comfyui' : 'studio_run');
      body.scene_id = m.scene_id || body.scene_id || hint.scene_id || 'retry-sync';
      body.parent_job_id = targetJobId; // parent_job_id immutable
      body.recipe = runSpec.recipe;
      body.template = runSpec.template;

      console.log(`[runtime-render] retry hydrated: target=${targetJobId} source=${resolvedFrom} recipe=${body.recipe} template=${body.template || ''} engine=${body.engine_target}`);

      // Assign a fresh unique label for the retry run
      const existingRuns = await getAcceptedRuns();
      let candidateLabel = `${targetJobId.replace(/.*__/g, '')}-retry-${Date.now()}`;
      let attempt = 0;
      while (existingRuns.some((r) => sanitizeJobId(r.job_id) === sanitizeJobId(candidateLabel))) {
        candidateLabel = `${targetJobId.replace(/.*__/g, '')}-retry-${Date.now()}-${++attempt}`;
      }
      body.job_label = candidateLabel;
    }

    const baseLabel = body.job_label || body.job || body.job_id || `rb-${Date.now()}`;
    const canonicalJobId = sanitizeJobId(baseLabel);

    // Duplicate Guard: Logical conflict returns 409, idempotent collapse returns 202
    const existingRuns = await getAcceptedRuns();
    const existing = existingRuns.find((r) => sanitizeJobId(r.job_id) === canonicalJobId);
    if (existing) {
      const isIdempotent = existing.parent_job_id === body.parent_job_id && existing.engine_target === body.engine_target;
      if (isIdempotent) {
        console.log(`[runtime-render] duplicate guard: idempotent collapse for ${canonicalJobId}`);
        return json(res, 202, {
          ok: true,
          accepted: true,
          status: existing.status || 'queued',
          job_id: canonicalJobId,
          message: 'idempotent_replay_collapse',
        });
      } else {
        console.warn(`[runtime-render] duplicate guard: logical conflict for ${canonicalJobId}`);
        return json(res, 409, { ok: false, error: 'conflict', message: 'Job ID already exists with different parameters' });
      }
    }

    const preflight = await runPreflight({ requestBody: body });
    if (!preflight.passed) {
      return json(res, 400, { ok: false, accepted: false, status: 'failed', preflight, dependency_status: preflight.dependency_status, errors: ['preflight failed'] });
    }

    // Pre-spawn Identity Reservation: Reserve in accepted_runs with status queued
    await persistAcceptedRun({
      job_id: canonicalJobId,
      parent_job_id: body.parent_job_id,
      status: 'queued',
      accepted_at: new Date().toISOString(),
      engine_target: body.engine_target,
      body_source: body, // Store parameters as hint for future retries
    });

    const result = await invokeStudioRun(body, canonicalJobId);
    if (!result.ok) {
      return json(res, 502, {
        ok: false,
        accepted: false,
        status: 'failed',
        job_id: canonicalJobId,
        manifest_path: undefined,
        preview_image: undefined,
        preview_image_url: undefined,
        warnings: preflight.checks.filter((check) => check.status === 'warn').map((check) => `${check.name}: ${check.message}`),
        errors: [result.error || 'studio-run spawn failed'],
        preflight,
        dependency_status: preflight.dependency_status,
        runtime: {
          spawned: false,
          pid: undefined,
        },
      });
    }

    // Post-spawn Update: Only update runtime.pid after successful spawn
    await persistAcceptedRun({
      job_id: canonicalJobId,
      runtime: { pid: result.pid },
    });

    console.log('[runtime-render] pre-202');
    return json(res, 202, {
      ok: true,
      accepted: true,
      status: body.validate_only ? 'preflight' : 'queued',
      job_id: canonicalJobId,
      manifest_path: undefined,
      preview_image: undefined,
      preview_image_url: undefined,
      warnings: preflight.checks.filter((check) => check.status === 'warn').map((check) => `${check.name}: ${check.message}`),
      errors: [],
      preflight,
      dependency_status: preflight.dependency_status,
      runtime: {
        spawned: true,
        pid: result.pid,
      },
    });
  }

  if (pathname === '/runtime/jobs' && req.method === 'GET') {
    const limit = Number(url.searchParams.get('limit') || '100');
    return json(res, 200, { ok: true, jobs: await getJobs(limit) });
  }

  if (pathname.startsWith('/runtime/jobs/') && pathname.endsWith('/cancel') && req.method === 'POST') {
    const jobId = decodeURIComponent(pathname.replace('/runtime/jobs/', '').replace('/cancel', ''));
    const job = await getJobDetail(jobId);
    if (!job) return json(res, 404, { ok: false, error: 'job_not_found' });
    return json(res, 202, {
      ok: true,
      accepted: false,
      job_id: jobId,
      status: job.status,
      cancellation: {
        supported: false,
        requested: true,
        final: false,
        message: 'Runtime bridge does not yet support remote cancellation for Studio-Run jobs. Request recorded locally only.',
      },
    });
  }

  if (pathname.startsWith('/runtime/jobs/') && req.method === 'GET') {
    const jobId = decodeURIComponent(pathname.replace('/runtime/jobs/', ''));
    const job = await getJobDetail(jobId);
    if (!job) return json(res, 404, { ok: false, error: 'job_not_found' });
    return json(res, 200, { ok: true, job });
  }

  if (pathname === '/runtime/recent-renders' && req.method === 'GET') {
    const limit = Number(url.searchParams.get('limit') || '8');
    return json(res, 200, { ok: true, recent: await getRecentRenders(limit) });
  }

  if (pathname === '/runtime/timeline' && req.method === 'GET') {
    const limit = Number(url.searchParams.get('limit') || '30');
    return json(res, 200, { ok: true, events: await getTimeline(limit) });
  }

  return json(res, 404, { ok: false, error: 'not_found' });
});

server.listen(runtimeConfig.port, () => {
  console.log(`DirectorOS runtime bridge listening on ${runtimeConfig.port}`);
});
