# Session: 2026-04-11 19:51:18 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 39ca99e6-7192-421c-9cdc-f19d12c002a9
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Saturday, April 11th, 2026 - 10:43 PM (Africa/Nairobi) / 2026-04-11 19:43 UTC
assistant: [[reply_to_current]] Mike, Solvi here 🎬 Ready to run the DirectorOS control room with you, fast and clean. What do you want to tackle first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sat 2026-04-11 22:43 GMT+3] Start Phase 3F with lifecycle mapping only.

Do not patch yet.

Context:
- Phase 3C family continuity is locked
- Phase 3D selected-job action hierarchy is locked
- Phase 3E canonical feedback summary is locked
- Do not change lineage, authority, selection semantics, or cross-surface behavior

Return only:
1. all current lifecycle states and transition states used in runtime/job/queue UI
2. where each lifecycle signal is derived from
3. which surfaces display each lifecycle signal
4. any missing, duplicated, ambiguous, delayed, or conflicting transition feedback
5. the minimum safe patch plan to improve lifecycle visibility without semantic drift
6. one implementation prompt for the first scoped pass
assistant: I'll map the lifecycle signals across runtime, job, and queue UI without changing anything, then I'll return the exact gaps and the smallest safe pass.
assistant: I’ve got the core runtime/job pipeline map. I’m pulling the UI surfaces next so I can pin each signal to where it actually appears and spot the visibility gaps cleanly.
assistant: [[reply_to_current]] 1. Current lifecycle states and transition states used in runtime/job/queue UI

Runtime render job states
- `queued`
- `preflight`
- `running`
- `packaging`
- `completed`
- `failed`
- `cancelled`

Live preview monitor states
- `idle`
- `ready`
- `queued`
- `running`
- `packaging`
- `completed`
- `failed`

Shot execution states
- `waiting`
- `active`
- `compiling`
- `routed`
- `rendering`
- `review`
- `completed`
- `failed`
- `blocked`
- `skipped`

Graph/runtime activity states
- `idle`
- `waiting`
- `active`
- `processing`
- `completed`
- `failed`
- `blocked`

Post-pipeline stage states
- `pending`
- `waiting`
- `active`
- `approved`
- `completed`
- `ready`
- `failed`
- `blocked`

Review/projection states
- `reviewStatus`: `pending`, `in_progress`, `completed`, `blocked`
- `approvalStatus`: `unreviewed`, `needs_revision`, `approved`, `rejected`, `superseded`
- `actionState`: `pending`, `approved`, `needs_revision`, `rejected`, `superseded`, `finalized`
- operator canonical state: render state or `best_known` or action state above

Queue/runtime control states
- `running`
- `paused`

Named transition labels/microcopy now in UI
- `Ready to launch selected scene`
- `Signal received`
- `Signal live`
- `Signal resolved`
- `Signal flagged`
- `Queued for lane`
- `Checks in motion`
- `Run in motion`
- `Preview resolving`
- `Blocked before render start`
- `Current Output ready`
- `Execution failed`
- `Render completed → Review active`
- `Render failed → Post workflow blocked`
- `Review approved → Edit active`
- `Edit completed → Export active`
- `Export completed → Delivery ready`
- `Delivery sent → Pipeline complete`
- `Export failed → Delivery blocked`

2. Where each lifecycle signal is derived from

Render job lifecycle
- Source of truth: `render/jobQueue.ts`
- Hydrated/merged from runtime bridge: `runtime/sync.ts`
- Provider-driven transitions: `render/renderQueueController.ts`
- Event stream source: `render/jobEvents.ts`

Live preview lifecycle
- Derived in `App.tsx` from:
  - `previewState`
  - render job events from `subscribeRenderJobEvents`
  - `syncLivePreviewFromRenderState`
- Not an independent truth source, it is a UI projection

Shot lifecycle
- Derived in `App.tsx` from local `shotSequenceByScene`
- Updated from render preview progress during render
- Also manually advanced by shot action handlers
- This is UI/runtime orchestration state, not provider truth

Graph node/connection lifecycle
- Derived in `App.tsx` inside `graphForCompile`
- Mapped from:
  - `previewState.mode/progress`
  - `shotQueueSummary`
  - `postWorkflowByScene`
  - route resolution
  - preview authority context

Post-pipeline lifecycle
- Derived from `createPostWorkflowFromRender(previewState.mode)`
- Then optionally advanced by local UI actions in `onPostWorkflowAction`
- Lives in `postWorkflowByScene`

Review/projection lifecycle
- Derived from render events in `review/runtime.ts`
- Canonical shot decision written on `job.completed` and `job.failed`
- Resolved for selected job/family in `review/reviewLineageTruth.ts`

Canonical selected job / family lifecycle
- Selected job: `resolveOperatorReviewState(...)`
- Family: `resolveProductionFamilyTruth(...)`
- Both consumed in `App.tsx`

Queue mode
- Source: `render/queueState.ts`
- Read in `App.tsx` via `getQueueState().mode`

3. Which surfaces display each lifecycle signal

RenderPreview / current output monitor
- displays: `idle`, `ready`, `queued`, `running`, `packaging`, `completed`, `failed`
- plus transition feedback like signal/latency/stage labels
- file: `components/workspace/RenderPreview.tsx`

Center workspace, selected job rail and job cards
- displays render job lifecycle:
  - `queued`, `preflight`, `running`, `packaging`, `completed`, `failed`, `cancelled`
- displays failed stage and operator state labels
- file: `components/layout/CenterWorkspace.tsx`

Right inspector, decision/intelligence/pipeline/activity tabs
- displays:
  - selected job status
  - canonical state
  - lifecycle
  - preflight/dependency summaries
  - reviewStatus / approvalStatus / actionState
  - post-pipeline stage status
  - family state
- file: `components/layout/RightInspector.tsx`

Scene production timeline
- displays canonicalized shot states:
  - normalized shot state or review/action override
  - `approved`, `finalized`, `needs_revision`, `rejected`, `superseded`, `completed`, `running`, `queued`, `failed`
- file: `components/workspace/SceneProductionTimeline.tsx`

Graph canvas / graph nodes / graph connections
- displays:
  - node runtime state: `idle`, `waiting`, `active`, `processing`, `completed`, `failed`, `blocked`
  - shot state chips
  - render output authority/readiness hints
  - post-pipeline progress
- files:
  - `components/graph/GraphNode.tsx`
  - `components/graph/GraphConnection.tsx`
  - `components/graph/SceneGraphCanvas.tsx`

Top bar / M6 screens
- lighter summaries only:
  - render failed attention
  - queue active/queued counts
  - canonical state labels in screen summaries
- mostly derived from App-level projections

4. Missing, duplicated, ambiguous, delayed, or conflicting transition feedback

Missing
- No explicit visible `cancelled` lifecycle in RenderPreview, it is collapsed to `idle` or `failed` behavior.
- No dedicated transition feedback for `preflight -> running`.
- No dedicated transition feedback for `running -> packaging`.
- No dedicated feedback when reconciliation mutates a job from in-flight to failed/orphaned/missing artifact recovery.
- No explicit family-level transition cue when state changes from `best_known` to `approved` or `approved` to `superseded/finalized`.

Duplicated
- Same underlying state is described multiple ways across surfaces:
  - `queued` becomes “Queued”, “In Progress • waiting for lane”, “Signal received”, “Queued for lane”
  - `running` becomes “running”, “In Progress • generating output”, “Signal live”, “Run in motion”
  - `packaging` becomes “packaging”, “In Progress • preparing preview”, “Preview resolving”
  - `failed` becomes “failed”, “Execution failed”, “Blocked before render start”, “Signal flagged”
- This duplication is not fatal, but it weakens crisp lifecycle reading.

Ambiguous
- RenderPreview uses `mode='queued'` while checking `statusLabel` text for preflight, so preflight is visually nested inside queued rather than clearly first-class.
- `cancelled` is terminal in runtime/job truth, but not preserved as a first-class monitor/display state.
- `best_known`, `approved`, and `finalized` are all surfaced as status-like labels, but not consistently separated as:
  - output ranking
  - approval authority
  - terminal decision lock
- `completed` means render complete in some surfaces, but in timeline/post surfaces “complete” can also imply review/post completion.

Delayed
- Review projection writes happen on completed/failed events, so review/approval signals appear after render terminal event, not during transition.
- Post workflow becomes active/blocked only after preview completion/failure, so render-to-review handoff is slightly delayed and locally inferred.
- Reconciler repairs can change durable truth later than the original runtime moment, but user-facing feedback does not indicate this as recovered state.

Conflicting
- RenderPreview treats cancel paths as failed/idle-adjacent rather than true cancelled.
- Scene timeline may show review-derived canonical states like `approved` or `finalized`, while render/job surfaces still emphasize raw render state `completed`, which can make one shot look both “completed” and “finalized” depending on surface.
- Graph render node authority/readiness can imply stronger completion semantics than the raw selected job lifecycle.
- Preflight failure is shown as “Blocked before render start”, but underlying state is still `failed`, creating mixed semantics without a stable shared label.

5. Minimum safe patch plan to improve lifecycle visibility without semantic drift

Pass 1, visibility-only, no semantic changes
- Preserve all existing truth sources and transitions.
- Add a shared presentation mapper for lifecycle labels, not new lifecycle logic.
- Make `preflight` and `cancelled` first-class display states everywhere they already exist in truth.
- Standardize one display phrase per raw render state, with optional secondary helper copy.

Minimum patch targets
- `RenderPreview.tsx`
  - preserve `cancelled` visibly instead of collapsing it into idle/failed-adjacent language
  - show `preflight` as its own monitor label if `statusLabel` indicates it
- `CenterWorkspace.tsx`
  - reuse same display labels for selected job rail / operator status copy
- `RightInspector.tsx`
  - align status microcopy to same lifecycle mapping
- optionally tiny shared utility, e.g. `src/utils/lifecyclePresentation.ts`

Safe mapping shape
- raw render lifecycle: `queued | preflight | running | packaging | completed | failed | cancelled`
- canonical overlays remain separate:
  - `best_known`
  - `approved`
  - `finalized`
  - `needs_revision`
  - `rejected`
  - `superseded`

Recommended display separation
- Primary line: raw execution lifecycle
- Secondary line: decision/review overlay
- This avoids changing semantics while removing cross-surface blur

6. One implementation prompt for the first scoped pass

Implement Phase 3F pass 1 as a visibility-only lifecycle presentation cleanup.

Constraints:
- Do not change lineage, authority, selection semantics, review semantics, or cross-surface behavior.
- Do not alter runtime truth sources or transition rules.
- Do not patch decision logic.
- Only normalize lifecycle presentation.

Scope:
- Add a small shared lifecycle presentation helper for raw render job states.
- Make `preflight` and `cancelled` first-class visible states in RenderPreview, CenterWorkspace, and RightInspector.
- Keep canonical review states (`best_known`, `approved`, `finalized`, `needs_revision`, `rejected`, `superseded`) as separate overlay labels, not replacements for raw execution lifecycle.
- Preserve all existing actions and routing.

Success criteria:
- The same raw render state displays with the same primary label across the three surfaces.
- `preflight` is no longer visually buried under queued.
- `cancelled` is visible as cancelled, not silently collapsed into idle/failed language.
- No semantic drift, no behavior changes, no new transitions.
