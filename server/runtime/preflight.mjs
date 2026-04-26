import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { derivedPaths, runtimeConfig } from './config.mjs';
import { withTimeout } from './helpers.mjs';

const runCommand = (command, args = []) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', (error) => resolve({ ok: false, exitCode: 1, stdout, stderr, error: error.message }));
    child.on('close', (code) => resolve({ ok: code === 0, exitCode: code ?? 1, stdout, stderr }));
  });

const checkUrl = async (url) => {
  try {
    const response = await withTimeout(fetch(url), runtimeConfig.healthTimeoutMs, 'health_timeout');
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const checkPath = (label, targetPath, required = true) => {
  const exists = fs.existsSync(targetPath);
  return {
    name: label,
    status: exists ? 'pass' : required ? 'fail' : 'warn',
    message: exists ? targetPath : `Missing path: ${targetPath}`,
  };
};

export const runPreflight = async ({ requestBody } = {}) => {
  const checks = [];

  checks.push(checkPath('studio_run_path', runtimeConfig.studioRunPy));
  checks.push(checkPath('studio_run_cwd', derivedPaths.studioRunCwd));
  checks.push(checkPath('studio_pipeline_root', runtimeConfig.studioPipelineRoot));
  checks.push(checkPath('pipeline_outputs_root', derivedPaths.pipelineOutputsRoot));
  checks.push(checkPath('pipeline_templates_root', derivedPaths.pipelineTemplatesRoot));

  const python = await runCommand(runtimeConfig.pythonBin, ['--version']);
  checks.push({
    name: 'python',
    status: python.ok ? 'pass' : 'fail',
    message: python.ok ? (python.stdout || python.stderr || 'python available').trim() : (python.error || python.stderr || 'python unavailable').trim(),
  });

  const comfy = await checkUrl(runtimeConfig.comfyHealthUrl);
  checks.push({
    name: 'comfyui',
    status: comfy.ok ? 'pass' : 'warn',
    message: comfy.ok ? `ComfyUI reachable (${comfy.status})` : `ComfyUI check failed${comfy.error ? `: ${comfy.error}` : ''}`,
  });


  if (requestBody) {
    const required = ['scene_id', 'engine_target'];
    for (const key of required) {
      const present = !!requestBody[key];
      checks.push({
        name: `request.${key}`,
        status: present ? 'pass' : 'fail',
        message: present ? 'present' : 'required field missing',
      });
    }
    const hasPayloadShape = !!(requestBody.compiled_prompt || requestBody.parameters || requestBody.recipe || requestBody.family);
    checks.push({
      name: 'request.render_payload',
      status: hasPayloadShape ? 'pass' : 'warn',
      message: hasPayloadShape ? 'render payload present' : 'request accepted with minimal payload only',
    });
  }

  const passed = checks.every((check) => check.status !== 'fail');
  return {
    passed,
    checks,
    dependency_status: {
      comfyui: checks.find((check) => check.name === 'comfyui')?.status === 'pass' ? 'ok' : 'down',
      python: checks.find((check) => check.name === 'python')?.status === 'pass' ? 'ok' : 'down',
      bridge: 'ok',
    },
  };
};
