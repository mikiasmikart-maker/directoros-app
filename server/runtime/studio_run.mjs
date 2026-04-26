import { spawn } from 'node:child_process';
import path from 'node:path';
import { runtimeConfig } from './config.mjs';

const buildRenderArgs = (body = {}, jobId) => {
  const command = body.command || 'render';
  const args = [runtimeConfig.studioRunPy, command];
  const pairs = [
    ['--intent', body.intent],
    ['--recipe', body.recipe],
    ['--family', body.family],
    ['--job', jobId || body.job_label || body.job],
    ['--version', body.version],
    ['--style', body.style],
    ['--constraints', body.constraints],
    ['--template', body.template],
    ['--subject', body.subject],
    ['--subject-profile', body.subject_profile],
    ['--style-profile', body.style_profile],
    ['--constraint-profile', body.constraint_profile],
  ];
  for (const [flag, value] of pairs) {
    if (value) args.push(flag, String(value));
  }
  
  if (body.validate_only) args.push('--preview-prompt', '--json');
  if (body.mock || process.env.DIRECTOROS_MOCK_COMPILER === 'true') {
    args.push('--mock');
  }
  
  return args;
};

export const invokeStudioRun = async (body = {}, jobId) => {
  const args = buildRenderArgs(body, jobId);
  
  return new Promise((resolve) => {
    try {
      const child = spawn(runtimeConfig.pythonBin, args, {
        cwd: path.dirname(runtimeConfig.studioRunPy),
        windowsHide: true,
        shell: false,
        detached: true,
        stdio: 'ignore', // Fully disconnect IO to prevent blocking/pipe issues
      });

      // Crucial: Detach the child process from the parent's event loop
      // so the server can survive or exit independently.
      child.unref();

      // Listen for the initial result to return 202 status or immediate error
      child.on('error', (error) => {
        resolve({ ok: false, accepted: false, spawned: false, error: error.message });
      });

      child.on('spawn', () => {
        // Process is now running in the background, isolated.
        resolve({ ok: true, accepted: true, spawned: true, pid: child.pid });
      });
    } catch (err) {
      resolve({ ok: false, accepted: false, spawned: false, error: err.message });
    }
  });
};
