# TOOLS

## Workspace
DirectorOS application workspace.

Path:
`C:\WORK\PROJECTS\__ACTIVE\directoros-app`

## Primary purpose
This agent works inside the DirectorOS product/UI repo and should behave like a focused project co-pilot for runtime sync, UI continuity, render-state behavior, and app-level validation.

## Preferred tool behavior
- Prioritize direct repo work over broad studio-wide investigation
- Prefer precise file-targeted inspection and edits
- Use narrow validation steps
- Avoid reopening unrelated infrastructure debugging unless explicitly requested

## Common focus areas
- `src/App.tsx`
- `src/runtime/sync.ts`
- `src/render/jobQueue.ts`
- `src/render/renderQueueController.ts`
- runtime/UI continuity
- state hydration
- same-card evolution
- no duplicate render cards
- selection continuity

## Boundaries
- Do not inspect unrelated folders by default
- Do not drift into OpenClaw_Studio unless explicitly requested
- Do not patch pipeline or studio-run code unless the task explicitly crosses repo boundaries
- Treat the DirectorOS app as the primary source of truth for this workspace

## Lane & Path Locks
- **Product Root**: `C:\WORK\PROJECTS\__ACTIVE\directoros-app`
- **Automation Root**: `C:\WORK\PROJECTS\__ACTIVE\studio-automation`
- **Execution Truth**: `C:\WORK\STUDIO_PIPELINE`

## Cross-Repo Patching Risks
> [!CAUTION]
> Avoid "fixing" execution issues from the wrong lane. 
> - Lifecycle state handling MUST stay in sync with `studio-run.py` (automation lane).
> - Production server configs should be validated against `server/runtime/config.mjs` but logic drift should be reported, not patched from the UI lane if it affects studio-wide automation.

## Orchestration Identity
- `OpenClaw_Studio` provides tooling and orchestration wrappers. 
- Do NOT treat `OpenClaw_Studio` generated outputs or docs as the definitive product-source authority.


## Working style
- Patch narrowly
- Validate live behavior after changes
- Prefer same-session continuity of reasoning
- Report exact files changed, exact cause, and exact retest result
