# DirectorOS Operator Workflow Hardening

## Phase Anchor

DirectorOS is now in **function/workflow hardening**.

The visual shell is considered stable.
The system goal shifts from polish to **state trust, action clarity, and operator efficiency**.

Functional model:
- **Left = context / selection**
- **Center = active production space**
- **Right = decision + truth surface**

The interface should behave like a **reliable control room**, not just a polished dashboard.

---

## Canonical Operator Flows

## 1) Single Still Render

### Intent
Generate one authoritative still output for the currently selected scene/shot context.

### Entry conditions
- Scene is selected
- Active shot is known
- Route and engine target are derivable
- Prompt/compiler state is current enough to launch

### Canonical flow
1. Operator selects scene / shot context on the left.
2. Center workspace shows active graph + launch context.
3. Right truth surface confirms:
   - selected scene
   - selected shot
   - current route
   - target engine
   - whether launch is valid now
4. Operator launches render.
5. System transitions through:
   - queued
   - preflight
   - running
   - packaging
   - completed OR failed
6. On success, system marks one result as:
   - **latest completed run**
   - **authoritative preview asset** for that run
7. Operator can then choose one next valid action:
   - approve best known
   - mark needs revision
   - reject
   - open artifact / manifest
   - retry only if failure path or deliberate re-run path exists

### Required truth rules
- Execution state must reflect the **live run state**, not artifact browsing state.
- Preview must clearly indicate whether it is:
  - live execution monitor
  - latest authoritative result
  - manually focused historical artifact
- Only one surface should be authoritative for “what is happening now.”

### Output truth objects
- selected scene
- selected shot
- launched run id
- canonical lifecycle state
- authoritative preview asset
- valid next action

---

## 2) Family Render

### Intent
Generate multiple sibling outputs for the same shot/context so operator can compare candidates.

### Entry conditions
- Same as single still render
- Operator explicitly enters multi-output / family intent

### Canonical flow
1. Operator selects a shot.
2. Operator launches a family run or repeated sibling runs within one shot lineage.
3. System groups outputs under one **shot family group**.
4. Group displays:
   - shot id
   - family size
   - latest run state
   - best-known candidate if available
   - failures count
   - unresolved items count
5. Operator opens the family group.
6. Operator compares siblings.
7. System marks one candidate as:
   - best known
   - approved
   - superseded
   - needs revision
8. Remaining siblings remain historical evidence, not current truth.

### Required truth rules
- Family grouping is by **shot lineage / sibling comparison context**, not just by visual closeness or latest timestamp.
- Best-known must be explicit.
- Historical siblings must not visually compete with the current authoritative candidate.

### Output truth objects
- lineage root / family id
- sibling count
- current best-known job
- current approved job if any
- superseded jobs
- next valid operator action

---

## 3) Review / Revision Cycle

### Intent
Assess output quality, decide whether it is acceptable, and either approve or send back for revision.

### Canonical flow
1. Operator selects a completed job.
2. Right decision surface shows:
   - measured signals
   - review status
   - approval status
   - explanation summary
   - current best-known result
3. Operator decides:
   - approve best known
   - mark needs revision
   - reject output
   - finalize shot
4. If revision is requested:
   - system records why
   - system keeps prior result visible as historical evidence
   - next valid action becomes retry / rerender path
5. If approved:
   - system elevates approved state in truth surface
   - next valid action becomes finalize / proceed downstream

### Required truth rules
- Review status and approval status must not feel like duplicate badges with unclear differences.
- Decision outputs must resolve to one plain-language state.
- The operator should never have to infer whether a result is reviewable, approved, superseded, or final.

### Output truth objects
- review state
- approval state
- best-known state
- reason for revision or rejection
- valid next action

---

## 4) Retry / Supersede Cycle

### Intent
Launch a new run because a previous run failed, drifted, or was replaced by a better candidate.

### Canonical flow
1. Operator selects a failed or non-winning job.
2. System shows lineage context:
   - root job
   - parent job
   - retry depth
   - whether selected job is current best-known / superseded / failed
3. Operator takes one of two pathways:

#### A. Retry
- used when run failed or needs another pass from similar context
- system launches child run linked to parent/root lineage
- child becomes newest lineage node
- parent remains visible as evidence

#### B. Supersede
- used when another sibling becomes the winning output
- system marks older selected job as superseded
- system records replacement job id
- decision surface updates valid next actions accordingly

### Required truth rules
- Retry is a **new child run**.
- Supersede is a **decision state change**, not a rerun.
- Parent/root lineage must be readable without opening multiple panels.
- The operator should instantly know:
  - what this job came from
  - whether it is still current
  - what replaced it
  - whether retry is valid now

### Output truth objects
- lineage root
- parent job
- retry depth
- superseded by / supersedes
- retry eligibility
- valid next action

---

## UI Audit Against Canonical Flows

## Overall Read
The current app already has the right raw ingredients:
- left scene selection
- center production surface
- right inspector/truth area
- grouped job cards
- selected job detail
- review and lineage metadata

But functionally it still behaves like **multiple partially-authoritative surfaces** instead of one coherent operator model.

---

## High-Friction Findings

## 1) Preview truthfulness is the top trust risk

### Current issue
The main execution preview can be overwritten by output focus behavior.

In `App.tsx`, `focusJobOutput()` sets `previewState` to a completed/focused artifact state when the operator selects a job output.
That means the center “Render Monitor” can stop representing live execution and start representing historical artifact focus.

### Why this is dangerous
This collapses two different truths into one panel:
- **execution truth** = what the system is doing now
- **artifact truth** = what result the operator is browsing

A control room cannot merge those.

### Required fix
Split preview state into two separate authorities:
1. **executionMonitorState**
   - live queue / render lifecycle state
   - only updated by queue/render pipeline
2. **artifactFocusState**
   - currently selected historical or completed asset
   - updated by output/job browsing

### UX rule
The preview panel must explicitly say one of:
- Live execution monitor
- Latest authoritative result
- Focused historical artifact

---

## 2) Operation Context is useful but not yet decisive

### Current issue
Operation Context shows queue stats and launch context, but it still reads like a telemetry card rather than a decision surface.

It tells the operator facts, but not:
- what is selected now
- what action is valid now
- whether launch is trustworthy now
- what changed last

### Required fix
Refactor the card into an **Operator Context** block with five rows:
- Selection: scene / shot / job
- State: canonical current state
- Current output: latest authoritative result or none
- Valid next action: launch / review / retry / finalize / open artifact
- Last change: latest event summary

### UX rule
No generic queue-only framing. It must answer “what should I do next?” in one glance.

---

## 3) Recent renders grouping is structurally close, but semantically weak

### Current issue
The grouped job cards show runs, ok/fail counts, mode, lineage count, and preview.
But they do not strongly distinguish:
- latest run
- best-known result
- approved result
- superseded result
- failed latest but valid previous winner

### Required fix
Each group should expose three explicit truths:
- **Current winner**
- **Latest attempt**
- **Group health**

### Proposed card model
For each grouped render family:
- shot label
- mode
- family size
- current winner badge
- latest attempt state
- last change summary
- next valid action button

### UX rule
A latest run is not automatically the current winner.
That distinction must be visible without opening detail.

---

## 4) Job detail lineage exists, but the decision hierarchy is still too scattered

### Current issue
Selected job detail includes lineage parent, retry depth, review evidence, retry context, outputs, failure diagnostics, and actions.
This is strong data coverage, but the operator has to scan too many separate blocks to answer:
- what am I looking at?
- is it current?
- what replaced it?
- what can I do now?

### Required fix
Move to a top-loaded decision hierarchy:
1. identity
2. canonical state
3. lineage truth
4. authoritative preview
5. valid next actions
6. expanded evidence/details

### Proposed summary block at top of selected job detail
- Job: id / shot / take / version
- Truth: failed / best known / approved / superseded / finalized
- Lineage: root / parent / retry depth / replaced by
- Current output: authoritative asset path or unavailable
- Next valid action: retry / approve / supersede / finalize / inspect

### UX rule
Evidence panels should support the decision, not bury it.

---

## 5) Scene → render launch flow is visually present but action logic is under-signaled

### Current issue
The render launch button is visible, and route/engine/strategy are displayed, but launch readiness is still mostly implicit.
The operator is expected to infer whether the scene context is actually launch-safe.

### Required fix
Add explicit launch readiness status:
- ready
- blocked: no scene
- blocked: no active shot
- blocked: route unresolved
- blocked: queue paused
- blocked: render already in progress

### UX rule
The launch panel should always answer:
- what will launch
- where it will go
- whether it is allowed now
- what will happen next

---

## Duplication / Ambiguity Audit

## Duplicate state indicators
Current state is duplicated across:
- Render Monitor
- Operation Context
- Render Jobs cards
- Selected Job Detail
- Right Inspector telemetry block

### Problem
These surfaces are not clearly ordered by authority.

### Fix
Define authority order:
1. **Right panel truth surface** = canonical selected-object truth
2. **Center execution monitor** = live run truth
3. **Recent render groups** = historical/run family truth
4. Everything else = supporting telemetry only

---

## Stale thumbnails risk
Current preview cards may display image/video previews, but the interface does not always communicate whether the thumbnail is:
- latest run preview
- authoritative current output
- a historical sibling
- unavailable because provider truth is unresolved

### Fix
Every thumbnail needs a small truth tag:
- live
- latest
- winner
- historical
- unavailable

---

## Weak next-step cues
The app exposes many actions, but fewer decisive cues.

### Fix
For every selected job, expose exactly one emphasized primary action and keep the rest secondary.

Examples:
- failed → **Retry Job**
- completed but not reviewed → **Approve Best Known** or **Mark Needs Revision**
- approved → **Finalize Shot**
- superseded → **Open Replacement**

---

## Weak grouping between job types
Current cinematic / studio_run filter is useful, but job families are still mostly grouped by shot + mode.
That’s only part of the story.

### Fix
Primary grouping should be by **shot lineage family**, with mode as a trait, not the main identity.

---

## Overly large empty zones
There is still some passive empty space around the launch/preview area and around detail sections when no strong decision content is surfaced.

### Fix
Fill empty space with truth-dense summaries, not decoration:
- launch readiness
- last change
- winner/latest split
- lineage summary
- primary action

---

## Recommended Fix Order

## Pass 1 — Trust-critical
1. Separate execution monitor state from artifact focus state
2. Add explicit launch readiness and valid-next-action messaging
3. Add canonical state summary at top of selected job detail

## Pass 2 — Decision clarity
4. Reframe Operation Context into Operator Context / Decision Surface
5. Upgrade recent render groups to show winner vs latest attempt
6. Reduce duplicate state indicators by assigning authority roles

## Pass 3 — Lineage fluency
7. Make retry/supersede relationships visible in one compact summary line
8. Add replacement/winner quick-jump actions
9. Demote deep evidence blocks below the decision layer

---

## Surface-by-Surface Change Spec

## A. Render Monitor
Must show:
- live execution state only
- launch readiness
- active shot
- target route
- target engine
- current lifecycle stage
- latest execution event

Must not pretend a historical focused artifact is a live run.

## B. Operator Context Panel
Must show:
- selection
- canonical state
- current output truth
- valid next action
- last change

## C. Recent Renders / Family Groups
Must show:
- shot family
- latest attempt
- current winner
- family health
- next action

## D. Selected Job Detail
Must begin with:
- identity
- state truth
- lineage truth
- current authoritative output
- primary action

## E. Right Panel
Should evolve from “Inspector” into **decision + truth**.
This is the canonical answer surface for the selected thing.

---

## Build Recommendation

### Suggested implementation sequence
1. Introduce separate execution monitor state vs artifact focus state in `App.tsx`
2. Refactor `RenderPreview.tsx` to render live execution truth only
3. Refactor center Operation Context into an operator decision block
4. Upgrade grouped render cards in `CenterWorkspace.tsx`
5. Reorder selected job detail so canonical truth comes first
6. Reframe `RightInspector.tsx` default behavior around decision/truth authority

---

## Immediate Next Move

Implement **Pass 1** first.

That means:
- fix preview truthfulness
- make launch readiness explicit
- surface canonical state + valid next action above all selected job detail content

Those three changes will make DirectorOS feel materially more like a control room before any deeper visual restructuring.
