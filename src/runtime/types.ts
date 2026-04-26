export interface RuntimePreflightCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
}

export interface RuntimePreflightStatus {
  passed: boolean;
  checks: RuntimePreflightCheck[];
}

export interface RuntimeDependencyStatus {
  comfyui?: 'ok' | 'down' | 'unknown';
  ollama?: 'ok' | 'down' | 'unknown';
  python?: 'ok' | 'down' | 'unknown';
  bridge?: 'ok' | 'down' | 'unknown';
}

export interface RuntimeOutputAsset {
  path: string;
  url?: string;
  filename: string;
  kind: 'image' | 'image_sequence' | 'video' | 'unknown';
  role: 'preview' | 'authoritative' | 'historical' | 'pointer_alias';
  label?: string;
  modified_at?: string;
  modified_time_ms?: number;
}

export interface RuntimeManifestRef {
  path: string;
  filename: string;
  created_at?: string;
  job_id?: string;
  engine?: string;
  output_path?: string;
  latest_for_family?: boolean;
}

export interface RuntimeHealthStatus {
  ok: boolean;
  bridge_status: 'ok' | 'degraded' | 'down';
  studio_run_status: 'ok' | 'degraded' | 'down';
  pipeline_status: 'ok' | 'degraded' | 'down';
  dependency_status: RuntimeDependencyStatus;
  precheck_enforced: boolean;
  checked_at: string;
  warnings?: string[];
  errors?: string[];
  preflight: RuntimePreflightStatus;
}

export interface RuntimeRenderSubmissionRequest {
  scene_id: string;
  shot_id?: string;
  job_label?: string;
  mode?: string;
  engine_target: string;
  intent?: string;
  recipe?: string;
  family?: string;
  version?: string;
  style?: string;
  constraints?: string;
  compiled_prompt?: string;
  parameters?: object;
  timeline?: object;
  route_context?: object;
  shot_context?: object;
  lineage_parent_job_id?: string;
  seed?: number;
  validate_only?: boolean;
  mock?: boolean;
}

export interface RuntimeRenderSubmissionResponse {
  ok: boolean;
  accepted: boolean;
  status: 'queued' | 'preflight' | 'failed';
  job_id: string;
  manifest_path?: string;
  preview_image?: string;
  preview_image_url?: string;
  warnings?: string[];
  errors?: string[];
  preflight: RuntimePreflightStatus;
  dependency_status: RuntimeDependencyStatus;
  metadata?: Record<string, any>;
}
