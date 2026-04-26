# Session: 2026-04-12 00:42:11 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 1b2a64af-26e1-4608-b87c-f87e7be441ec
- **Source**: webchat

## Conversation Summary

user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 01:40 GMT+3] Implement Phase 3G Pass 1: Attention Hierarchy (presentation-only).

Do not add new signals. Only rank and demote existing ones.

Goal:
Ensure only one primary attention target per surface and remove equal-weight competition.

Rules:
- Do not change lifecycle meaning
- Do not change lineage, authority, selection, review, or queue behavior
- Do not introduce new states
- Do not add decorative signals

Implementation:

1. Define a shared attention-tier mapping:
 Tier A = actionable state (failure, active run, primary decision, authority)
 Tier B = context (lineage, review, output context)
 Tier C = telemetry (queue stats, metadata, diagnostics)

2. RenderPreview vs Selected Decision:
 - active render → RenderPreview Tier A, decision surface Tier B
 - no active render → decision surface Tier A, preview Tier B

3. CenterWorkspace vs RightInspector:
 - CenterWorkspace = Tier A decision authority
 - RightInspector = Tier B support (demote duplicate summaries)

4. Authority vs lifecycle:
 - only one Tier A chip at a time
 - priority: authority > failure > active lifecycle > focus

5. Telemetry:
 - demote all queue stats, route, strategy, repeated chips to Tier C

6. Transition signals:
 - show “Just changed” only for the currently focused job, not duplicated across surfaces

Success criteria:
- eye lands on one primary signal per surface
- no competing Tier A signals
- support data is still available but visually quiet
assistant: I’m applying a presentation-only pass now. I’ll centralize the tier rules, then demote duplicate/high-noise elements in RenderPreview, CenterWorkspace, and RightInspector without touching behavior or states.
assistant: I found the hot spots. The main work is in three files: RenderPreview for active-vs-decision priority, CenterWorkspace for keeping decision authority primary, and RightInspector for demoting duplicate decision summaries into quiet support.
assistant: Pass 1 is in. I’ve made RenderPreview own Tier A during active runs, kept CenterWorkspace as the main decision authority when idle, and pushed the inspector into quieter support territory with less duplicate urgency.
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 01:44 GMT+3] Run a verification pass for Phase 3G Pass 1 only.

Validate:
1. active run state: RenderPreview is the clear Tier A surface
2. idle/no active run state: CenterWorkspace decision block becomes the clear Tier A surface
3. RightInspector reads as Tier B support, not a co-primary surface
4. no duplicate Tier A chips remain during active-run states
5. queue stats, route/strategy, paused/stalled chips are visually demoted to Tier C
6. “Just changed” is not duplicated across competing surfaces

Return:
- exact runtime findings
- pass/fail by check
- any remaining over-emphasized or under-emphasized signals
- exact files changed only if a fix is required
assistant: I’m doing a verification-only sweep now against the actual render logic and the updated presentation rules. I’ll return pass/fail per check and call out any remaining hierarchy leaks without patching.
assistant: [[reply_to_current]] Session summary  
Verification pass completed for Phase 3G Pass 1 only. The hierarchy is improved, but 2 checks still fail because some Center and Inspector elements remain too visually loud during active-run states.

Next 3 actions  
1. Demote CenterWorkspace lifecycle chip/primary action block during active runs  
2. Quiet RightInspector family timeline and strong tinted support rows  
3. Gate RenderPreview “Just changed” to active-run ownership only

## Pass / fail by check

### 1. Active run state: RenderPreview is the clear Tier A surface
**Result: PARTIAL FAIL**

**What passes**
- RenderPreview now owns a single primary chip
- active-run states suppress preview decision summary
- telemetry chips in preview are quieter than before
- live preview remains the largest and clearest active surface

**What still competes**
- CenterWorkspace still shows a strong selected-job lifecycle chip with saturated lifecycle color
- CenterWorkspace primary action block remains visually strong even during active run
- selected job header and decision card still read close to Tier A
- RightInspector still has a fairly dense “Lifecycle + Output Context” support block

**Runtime finding**
RenderPreview is leading, but not cleanly enough. CenterWorkspace still asks for attention too early when an active run exists.

---

### 2. Idle / no active run state: CenterWorkspace decision block becomes the clear Tier A surface
**Result: PASS**

**What passes**
- CenterWorkspace decision surface regains stronger border/background when no active render
- “Just changed” reappears there only when no active render
- RenderPreview decision summary is allowed again only when idle, and it is visually quieter
- Center primary action remains the strongest decision affordance

**Runtime finding**
When the run is idle, the center decision block correctly becomes the strongest operational target.

---

### 3. RightInspector reads as Tier B support, not a co-primary surface
**Result: PARTIAL FAIL**

**What passes**
- duplicate Decision / Review summary block was removed from inspector
- inspector header, chips, and support labels are quieter
- action cluster is framed as secondary actions

**What still competes**
- the decision tab still contains a large dense support slab
- family timeline badges remain colorful enough to pull attention
- “Current Lifecycle”, “Approved Output”, “Authority”, “Recommended Next Move” still stack with relatively high visual presence
- pipeline tab can still feel too strong because active post-pipeline rows use vivid active styling

**Runtime finding**
Inspector is more supportive now, but not fully Tier B. It still feels like a second decision console in some states.

---

### 4. No duplicate Tier A chips remain during active-run states
**Result: FAIL**

**Duplicates still present**
- RenderPreview primary chip
- CenterWorkspace selected-job lifecycle chip
- CenterWorkspace selected job state badge
- inspector lifecycle badge in decision header

**Runtime finding**
Only one of these should read Tier A during active run, but at least 3 lifecycle/priority chips remain visually prominent.

---

### 5. Queue stats, route/strategy, paused/stalled chips are visually demoted to Tier C
**Result: PARTIAL PASS**

**What passes**
- queue stats in CenterWorkspace are quieter than before
- paused/stalled chips in preview and inspector are demoted to neutral support styling
- route/strategy cards in RenderPreview are visually quieter than the live preview body

**What still feels too loud**
- RenderPreview engine/route/strategy cards are still a dedicated 3-card row directly under the live shot strip
- Center queue metrics remain in the decision block header, which keeps telemetry too close to decision authority
- inspector telemetry rows remain numerous, even if individually dimmer

**Runtime finding**
Tier C demotion is directionally correct, but telemetry is still too spatially close to Tier A/B content.

---

### 6. “Just changed” is not duplicated across competing surfaces
**Result: FAIL**

**What passes**
- CenterWorkspace hides “Just changed” during active render
- RightInspector hides it during active render for selected job support

**What fails**
- RenderPreview still shows “Just changed” whenever transition job matches selected or live job, including idle states where CenterWorkspace also shows it
- in idle selected-job state, preview and center can both show “Just changed”

**Runtime finding**
Duplication is reduced, but not eliminated. Ownership is not singular yet.

---

## Remaining over-emphasized signals
- CenterWorkspace selected job lifecycle chip during active run
- CenterWorkspace primary action block during active run
- RightInspector family timeline colored badges
- RightInspector “Lifecycle + Output Context” support slab
- RenderPreview engine / route / strategy card row
- repeated lifecycle labels across preview, center, inspector

## Remaining under-emphasized signals
- singular authority signal during active run
- distinction between “live run attention” and “decision attention”
- support-only status of inspector
- explicit ownership of transition feedback by one surface only

## Exact runtime findings
- Active run hierarchy improved, but CenterWorkspace still competes visually with the preview.
- Idle hierarchy works correctly, center becomes the dominant decision surface.
- Inspector is quieter, but not quiet enough to stop reading as a parallel decision panel.
- Duplicate high-priority lifecycle chips remain across surfaces.
- “Just changed” still has cross-surface duplication in idle selected-job scenarios.

## Fix required?
Yes.

## Exact files changed only if a fix is required
- `src/components/workspace/RenderPreview.tsx`
- `src/components/layout/CenterWorkspace.tsx`
- `src/components/layout/RightInspector.tsx`

Copy/paste label  
`phase-3g-pass1_verification_fail-partial_attention-hierarchy`
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 01:49 GMT+3] Apply Phase 3G Pass 1.1 fixes (attention demotion only).

Do not add new signals.
Do not increase visual intensity anywhere.
Only reduce competing emphasis when a Tier A surface is active.

Fixes:

1. CenterWorkspace demotion during active run:
- reduce lifecycle chip contrast and saturation
- reduce primary action block contrast and border strength
- slightly flatten decision card background
- ensure center reads as Tier B when preview is active

2. RightInspector demotion:
- reduce saturation of lifecycle badges and family timeline
- reduce font weight of support labels
- slightly compress spacing to reduce visual mass
- ensure inspector reads clearly as Tier B support

3. “Just changed” ownership:
- if active run exists → show only in RenderPreview
- if no active run → show only in CenterWorkspace
- remove all duplicate rendering across surfaces

Success criteria:
- RenderPreview is the only clear Tier A during active run
- CenterWorkspace becomes clearly secondary during active run
- RightInspector never reads as co-primary
- only one “Just changed” is visible at any time
- no duplicate Tier A lifecycle chips remain visually dominant
assistant: I’m applying the follow-up demotion pass now, strictly presentation-only. I’ll soften the Center and Inspector during active runs and make “Just changed” single-owner by state.
assistant: One edit block collided on repeated button styles. I’m narrowing those replacements so the demotion lands cleanly without touching behavior.
assistant: [[reply_to_current]] Session summary  
Phase 3G Pass 1.1 fixes applied, still presentation-only. Active-run competition is further reduced and “Just changed” now has single-surface ownership by state.

Next 3 actions  
1. Re-run the same 6 verification checks  
2. Confirm Center no longer competes during active run  
3. Confirm Inspector now reads consistently as Tier B support

What changed  
- RenderPreview now owns “Just changed” only during active runs
- CenterWorkspace selected-job lifecycle chip and primary action block are softer during active runs
- Center decision card background is flatter during active runs
- RightInspector decision support slab is quieter, tighter, and less saturated
- RightInspector family timeline badges are reduced to low-intensity support styling
- RightInspector no longer renders “Just changed”

Files changed  
- `src/components/workspace/RenderPreview.tsx`
- `src/components/layout/CenterWorkspace.tsx`
- `src/components/layout/RightInspector.tsx`

Copy/paste label  
`phase-3g-pass1-1_attention-demotion-only`
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 01:51 GMT+3] Re-run the Phase 3G Pass 1 verification after Pass 1.1 demotion fixes.

Validate:
1. active run state: RenderPreview is the clear Tier A surface
2. idle / no active run state: CenterWorkspace decision block becomes the clear Tier A surface
3. RightInspector reads as Tier B support, not a co-primary surface
4. no duplicate Tier A chips remain during active-run states
5. queue stats, route/strategy, paused/stalled chips are visually demoted to Tier C
6. “Just changed” is visible on only one surface at a time

Return:
- exact runtime findings
- pass/fail by check
- any remaining over-emphasized or under-emphasized signals
- exact files changed only if a fix is required
assistant: I’m re-running the same verification against the updated presentation rules now. I’ll keep it strict to Pass 1 criteria and only call out files if anything still needs correction.
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 01:51 GMT+3] Re-run the Phase 3G Pass 1 verification after Pass 1.1 demotion fixes.

Validate:
1. active run state: RenderPreview is the clear Tier A surface
2. idle / no active run state: CenterWorkspace decision block becomes the clear Tier A surface
3. RightInspector reads as Tier B support, not a co-primary surface
4. no duplicate Tier A chips remain during active-run states
5. queue stats, route/strategy, paused/stalled chips are visually demoted to Tier C
6. “Just changed” is visible on only one surface at a time

Return:
- exact runtime findings
- pass/fail by check
- any remaining over-emphasized or under-emphasized signals
- exact files changed only if a fix is required
assistant: [[reply_to_current]] Session summary  
Phase 3G Pass 1 re-verification after Pass 1.1 is complete. The hierarchy is now mostly correct, but one active-run duplication issue and one support-noise issue still remain.

Next 3 actions  
1. Demote the remaining CenterWorkspace lifecycle echo in active-run detail rows  
2. Quiet RightInspector scene review slabs when not the active task surface  
3. Re-run verification once more after that narrow pass

## Pass / fail by check

### 1. Active run state: RenderPreview is the clear Tier A surface
**Result: PASS**

**Exact runtime findings**
- RenderPreview remains the strongest surface during active runs via the live render header, preview media block, active shot strip, and lifecycle microcopy block.
- CenterWorkspace decision surface is visibly flatter during active runs, with reduced border, muted lifecycle text, softer state chip, and lowered primary-action contrast.
- RightInspector support sections are dimmer, tighter, and less saturated than the preview.

---

### 2. Idle / no active run state: CenterWorkspace decision block becomes the clear Tier A surface
**Result: PASS**

**Exact runtime findings**
- CenterWorkspace still regains the stronger cyan-led decision treatment when no active render exists.
- RenderPreview suppresses active-run emphasis and only shows the quieter decision summary when idle.
- “Just changed” correctly moves to CenterWorkspace in idle state.

---

### 3. RightInspector reads as Tier B support, not a co-primary surface
**Result: PARTIAL PASS**

**Exact runtime findings**
- The selected-job support slab is quieter now: lower contrast, reduced label weight, tighter spacing, and flatter family timeline badges.
- “Just changed” is removed from RightInspector entirely.
- However, other inspector sections still contain some medium-contrast slabs that can pull attention, especially:
  - `Scene Review Board (M4.1)`
  - `Decision Trace`
  - `Shot Queue` active row states

These are less dominant than before, but still a bit too present for strict Tier B support.

---

### 4. No duplicate Tier A chips remain during active-run states
**Result: PARTIAL FAIL**

**Exact runtime findings**
- The major duplicate Tier A issue was reduced successfully.
- RenderPreview is now the only clear Tier A owner.
- But CenterWorkspace still repeats lifecycle emphasis in the lower detail grid:
  - `Lifecycle` row still renders `selectedJob.state` with the original stronger lifecycle chip styling
- This is no longer co-primary, but it is still a visually strong duplicate lifecycle chip during active run.

---

### 5. Queue stats, route/strategy, paused/stalled chips are visually demoted to Tier C
**Result: PASS**

**Exact runtime findings**
- Queue stats in CenterWorkspace header are quiet enough now to read as operational telemetry.
- Route / strategy / engine cards in RenderPreview are subdued support blocks, not dominant decision signals.
- Queue paused / stalled chips in preview and center read as muted support, not action-driving alerts.
- Telemetry remains a little dense spatially, but intensity is within Tier C.

---

### 6. “Just changed” is visible on only one surface at a time
**Result: PASS**

**Exact runtime findings**
- During active run, “Just changed” appears only in RenderPreview.
- During idle / no active run, “Just changed” appears only in CenterWorkspace.
- RightInspector no longer duplicates it.

---

## Remaining over-emphasized signals
- CenterWorkspace lower `Lifecycle` detail-row chip
- RightInspector `Scene Review Board (M4.1)` slab
- RightInspector `Decision Trace` slab
- RightInspector `Shot Queue` active-row accent state

## Remaining under-emphasized signals
- None critically under-emphasized for Pass 1
- The main remaining issue is duplicate support intensity, not missing emphasis

## Fix required?
Yes, narrowly.

## Exact files changed only if a fix is required
- `src/components/layout/CenterWorkspace.tsx`
- `src/components/layout/RightInspector.tsx`

Copy/paste label  
`phase-3g-pass1_reverification_partial-fail_remaining-support-competition`
