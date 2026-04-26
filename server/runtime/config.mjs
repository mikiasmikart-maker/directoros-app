import path from 'node:path';

const env = process.env;

export const runtimeConfig = {
  port: Number(env.DIRECTOROS_RUNTIME_PORT || env.STUDIO_RUN_BRIDGE_PORT || 8787),
  appRoot: path.resolve(process.cwd()),
  studioAutomationRoot: env.STUDIO_AUTOMATION_ROOT || 'C:/WORK/PROJECTS/__ACTIVE/studio-automation',
  studioRunPy:
    env.STUDIO_RUN_PY ||
    'C:/WORK/PROJECTS/__ACTIVE/studio-automation/modules/automation-tools/studio-run/studio_run.py',
  pythonBin: env.STUDIO_RUN_PYTHON || 'python',
  studioPipelineRoot: env.STUDIO_PIPELINE_ROOT || 'C:/WORK/STUDIO_PIPELINE',
  comfyHealthUrl: env.COMFY_HEALTH_URL || 'http://127.0.0.1:8188/object_info',
  healthTimeoutMs: Number(env.DIRECTOROS_RUNTIME_HEALTH_TIMEOUT_MS || 2500),
  mockPromptCompiler: env.DIRECTOROS_MOCK_COMPILER === 'true',
};

export const derivedPaths = {
  studioRunCwd: path.dirname(runtimeConfig.studioRunPy),
  recipesDir: path.join(path.dirname(runtimeConfig.studioRunPy), 'recipes'),
  familiesDir: path.join(path.dirname(runtimeConfig.studioRunPy), 'families'),
  pipelineOutputsRoot: path.join(runtimeConfig.studioPipelineRoot, 'outputs'),
  comfyOutputsRoot: path.join(runtimeConfig.studioPipelineRoot, 'outputs', 'comfy'),
  comfyFinalRoot: path.join(runtimeConfig.studioPipelineRoot, 'outputs', 'comfy', 'final'),
  pipelineTemplatesRoot: path.join(runtimeConfig.studioPipelineRoot, 'templates'),
  jobsStateRoot: path.join(runtimeConfig.studioPipelineRoot, 'state', 'jobs'),
};
