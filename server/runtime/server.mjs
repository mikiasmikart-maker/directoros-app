import fs from 'node:fs';
import http from 'node:http';
import { URL } from 'node:url';
import { runtimeConfig, derivedPaths } from './config.mjs';
import { json, safeReadJsonFile, writeJsonFile } from './helpers.mjs';
import { runPreflight } from './preflight.mjs';
import { getJobDetail, getJobs, getRecentRenders, getTimeline, resolveManifestForSubmission } from './pipeline_discovery.mjs';
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
 * Replaces slashes with double underscores.
 */
const sanitizeJobId = (id) => {
  if (!id) return id;
  return id.replace(/\//g, '__').replace(/\\/g, '__');
};

const acceptedRunsRegistryPath = `${derivedPaths.pipelineOutputsRoot}/runtime/accepted_runs.json`;

const persistAcceptedRun = async (entry) => {
  try {
    const current = await safeReadJsonFile(acceptedRunsRegistryPath);
    const runs = Array.isArray(current?.runs) ? current.runs : [];
    const nextRuns = [...runs.filter((run) => run?.job_id !== entry.job_id), entry];
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

    const preflight = await runPreflight({ requestBody: body });
    if (!preflight.passed) {
      return json(res, 400, { ok: false, accepted: false, status: 'failed', preflight, dependency_status: preflight.dependency_status, errors: ['preflight failed'] });
    }

    const baseLabel = body.job_label || body.job || `rb-${Date.now()}`;
    const canonicalJobId = sanitizeJobId(baseLabel);

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

    void persistAcceptedRun({
      job_id: canonicalJobId,
      status: 'queued',
      accepted_at: new Date().toISOString(),
      engine_target: body.engine_target,
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
