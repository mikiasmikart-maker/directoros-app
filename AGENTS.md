# AGENTS.md - DirectorOS Workspace

This folder is the DirectorOS v2 UI rebuild workspace. Treat it that way.

## Every Session

Before doing anything else:

1. Read `SOUL.md`
2. Read `USER.md`
3. Read `IDENTITY.md`
4. Read `HEARTBEAT.md` if heartbeat behavior matters for the current task

Do not ask permission. Just load the workspace context and continue.

## Workspace Purpose

Use this workspace for:

- DirectorOS v2 new UI architecture, screens, components, and docs.
- Frontend UI shell rebuilding.

**Note:** v2 work is frontend UI shell only.

## System Lane Authorities

To maintain architectural integrity and prevent repository drift, the following lane authorities are locked:

- **directoros_v2**: `C:\WORK\PROJECTS\__ACTIVE\directoros-v2`
  - *Authority*: Active DirectorOS v2 UI Rebuild Workspace.
- **directoros_legacy**: `C:\WORK\PROJECTS\__ACTIVE\directoros-app`
  - *Authority*: Legacy/reference only. Do NOT modify unless explicitly requested. Use only for visual/reference inspection.
- **studio_run_dev**: `C:\WORK\PROJECTS\__ACTIVE\studio-automation`
  - *Authority*: Execution Logic, Tool Wrappers, Automation Scripts. (Execution wrapper source)
- **pipeline_ops**: `C:\WORK\STUDIO_PIPELINE`
  - *Authority*: Execution Truth, Final Render Outputs, Job State Persistence. (Lifecycle authority)
- **prompt_lab**: Orchestration & Prompt Engineering Lane.

## Boundary Guardrails

- **One-Way Truth**: DirectorOS consumes and presents pipeline truth from `STUDIO_PIPELINE`. It MUST NOT redefine execution lifecycle truth or state transitions locally.
- **Runtime Bridge**: The runtime bridge remains the integration layer.
- **No Cross-Repo Drift**: Never modify `studio-automation` or `STUDIO_PIPELINE` paths from this workspace unless the task explicitly requires cross-repo intervention.
- **Tooling vs. Product**: `OpenClaw_Studio` documentation and wrappers are orchestration/tooling only. They are NOT product-source or pipeline-truth authority.

## Safety

- Do not modify `directoros-app` unless explicitly requested.
- Do not inspect unrelated folders when the task is scoped to DirectorOS v2.
- Do not patch models or global config from here unless explicitly requested.
- Avoid destructive commands without approval.
- Prefer diagnosis, then minimal intervention.

## Working Style

- Keep outputs short, structured, and operational.
- Separate config issues, workspace issues, and UI/render issues clearly.
- When a mismatch exists, report the exact mismatch before proposing a fix.
- Prioritize runtime safety and UI consistency over speed.

## Heartbeats

If heartbeat is enabled for this agent, `HEARTBEAT.md` must stay minimal unless Mike asks for proactive checks.

## Make It Better

Keep this workspace clean, specific, and tuned for DirectorOS operations.
