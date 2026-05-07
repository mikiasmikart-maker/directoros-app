import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
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
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'], // capture stdout/stderr
      });

      // --- Pipe Handoff Hardening ---
      // We MUST drain stdout/stderr to prevent the child process from hanging
      // when the OS pipe buffer fills up.
      const logPath = path.join(runtimeConfig.studioPipelineRoot, 'outputs', 'runtime', 'studio_run.log');
      const logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
      let logWritable = true;
      const backlog = [];

      const writeLog = (line) => {
        if (!line) return;
        if (!logWritable) {
          if (runtimeConfig.debug) console.warn('[studio_run log fallback]', line.trim());
          return;
        }
        if (backlog.length) {
          while (backlog.length && logWritable) {
            const queued = backlog.shift();
            if (!logStream.write(queued)) {
              backlog.unshift(queued);
              return;
            }
          }
        }
        if (!logStream.write(line)) {
          backlog.push(line);
        }
      };

      logStream.on('drain', () => {
        while (backlog.length && logWritable) {
          const next = backlog.shift();
          if (!logStream.write(next)) {
            backlog.unshift(next);
            break;
          }
        }
      });

      logStream.on('error', (err) => {
        logWritable = false;
        backlog.length = 0;
        console.warn('[studio_run] log stream unavailable; continuing drain without file logging:', err?.message || err);
      });

      const timestamp = new Date().toISOString();
      writeLog(`\n[${timestamp}] SPAWN: ${runtimeConfig.pythonBin} ${args.join(' ')}\n`);

      child.stdout?.on('data', (data) => {
        const str = data.toString();
        writeLog(`[STDOUT] ${str}`);
        if (runtimeConfig.debug) console.log('[studio_run stdout]', str);
      });

      child.stderr?.on('data', (data) => {
        const str = data.toString();
        writeLog(`[STDERR] ${str}`);
        if (runtimeConfig.debug) console.error('[studio_run stderr]', str);
      });

      child.on('exit', (code) => {
        writeLog(`[${new Date().toISOString()}] EXIT: ${code}\n`);
        if (logWritable) logStream.end();
        if (runtimeConfig.debug) console.log('[studio_run exit]', code);
      });

      child.on('error', (error) => {
        writeLog(`[${new Date().toISOString()}] ERROR: ${error.message}\n`);
        if (logWritable) logStream.end();
        resolve({ ok: false, accepted: false, spawned: false, error: error.message });
      });

      child.on('spawn', () => {
        // Process is now running in the background, isolated and being drained.
        resolve({ ok: true, accepted: true, spawned: true, pid: child.pid });
      });
    } catch (err) {
      resolve({ ok: false, accepted: false, spawned: false, error: err.message });
    }
  });
};
