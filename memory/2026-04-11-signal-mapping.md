# Session: 2026-04-11 19:26:46 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: c2beca05-f668-46d6-96e9-2ae8ee59461f
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Saturday, April 11th, 2026 - 10:22 PM (Africa/Nairobi) / 2026-04-11 19:22 UTC
assistant: [[reply_to_current]] Mike, Solvi here 🎬 Clean slate, control room live, ready to keep this fast and precise. What do you want to shape, diagnose, or fix first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sat 2026-04-11 22:22 GMT+3] Start Phase 3E with signal mapping only.

Do not patch yet.

Return:
1. all current state-feedback surfaces involved in selected-job, queue-row, and runtime/global notices
2. where each surface gets its state from
3. any duplicated, conflicting, missing, delayed, or weak feedback signals
4. the minimum patch plan to improve coherence without changing lineage, authority, selection semantics, same-card evolution, or cross-surface behavior
5. one implementation prompt for the first scoped pass
assistant: I’m mapping the feedback chain now, staying in signal-only mode. I have the core runtime/state files; next I’m tracing the actual UI surfaces that render selected-job, queue-row, and notice feedback so the mismatch map is precise.
assistant: [[reply_to_current]] 1. Session summary  
Phase 3E signal map is concentrated in App state derivation plus three visible surfaces: Current Output Monitor, Decision Surface, and Inspector decision/intelligence panes.  
The feedback system is rich, but authority/focus/selection signals are repeated across surfaces with slightly different wording and timing, which is where coherence starts to drift.

2. Next 3 actions  
1) Treat `App.tsx` as the feedback authority composer, not the components.  
2) Normalize surface roles: monitor = live execution, decision surface = selected job/family, inspector = canonical readout.  
3) First patch pass should unify copy + signal priority only, with no lineage/selection behavior changes.

3. Signal mapping

### A. Selected-job feedback surfaces
- **CenterWorkspace, Decision Surface, “Selected Job Detail”**
  - Source:
    - `selectedJob` from `selectedJobId -> runtimeJobs`
    - `selectedJobReview` from `reviewSnapshot.shotProjections + decisionProposalByJobId + actionAuditByJobId`
    - `selectedJobNextAction` / `selectedJobDecisionMicrocopy`
    - `selectedOutputPath`, `selectedOutputCandidates`
    - queue context from `renderJobs`, `queueMode`
  - Role:
    - Main selected-job truth surface for lifecycle, lineage rail, outputs, M4/M5 review state, retry/cancel/open actions

- **RightInspector, Decision tab**
  - Source:
    - `selectedJobTelemetry` assembled in `App.tsx`
    - `productionFamily`
    - `resolvedPreviewContext`
    - `operatorFeedback`
  - Role:
    - Canonical decision summary for selected job or family, including authority, focus state, recommendation, lineage, output trail

- **RightInspector, Intelligence tab**
  - Source:
    - same `selectedJobTelemetry.m4`
    - `productionFamily`
  - Role:
    - Expanded metrics/explanations/status chips for selected job/family

- **RenderPreview, Focus/authority chips**
  - Source:
    - `selectedJobId`
    - `selectedOutputPath`
    - `authorityKind`
    - `focusMode`
  - Role:
    - Shows that a job/output is in focus while live monitor remains a separate surface

- **TopBar current focus**
  - Source:
    - `currentFocus` derived from `selectedScene`, `selectedFamilyRootId`, `selectedJob`, `artifactFocus.outputPath`
  - Role:
    - Breadcrumb-like high-level focus indicator

### B. Queue-row / queue feedback surfaces
- **CenterWorkspace, queue stats in Decision Surface header**
  - Source:
    - `renderJobs`
    - `queueStats`
    - `queueMode`
  - Role:
    - active / queued / running counts, cinematic vs studio lanes

- **CenterWorkspace queue rows / visible jobs**
  - Source:
    - `renderJobs`
    - `selectedJobId`
    - filtered `visibleJobs`
  - Role:
    - row selection, queue position, job lifecycle scanning

- **Selected job “Queue Context”**
  - Source:
    - `queueStats.selectedQueuePosition`
    - `renderJobs`
  - Role:
    - selected row’s place in queue

- **RightInspector secondary controls**
  - Source:
    - `selectedJobTelemetry.status`
    - `productionFamily`
  - Role:
    - queue-aware action affordances like cancel/retry/open

### C. Runtime/global notice surfaces
- **TopBar stream badges**
  - Source:
    - `streamState`
    - `lastStreamEventAt`
    - `previewState.mode` for “System Ready”
  - Role:
    - transport/global liveness

- **RenderPreview launch/monitor notices**
  - Source:
    - `livePreview`
    - `launchReadiness`
    - `operatorFeedback` when scope is `launch` or `delivery`
  - Role:
    - live execution acknowledgement, launch blockers, progress, failure

- **CenterWorkspace operator feedback**
  - Source:
    - `operatorFeedback`
  - Role:
    - transient notice for queue/review/open/delivery/shot actions

- **Inline receipts, job-level**
  - Source:
    - `inlineActionReceiptByJob[selectedJob.id]`
    - local temporary cues like `selectedInlineCue`, `m5InlineCue`
  - Role:
    - near-action confirmation for job actions

- **Inline receipts, family-level**
  - Source:
    - `inlineActionReceiptByFamily[productionFamily.lineageRootId]`
  - Role:
    - near-action confirmation for family actions

- **Command console previews**
  - Source:
    - `commandValidationPreview`
    - `commandTrustImpactPreview`
  - Role:
    - runtime/global notice for operator commands

- **Screen-level runtime summaries**
  - Source:
    - `runtimeTimeline`
    - `runtimeRecentRenders`
    - `streamState`
    - `renderJobs`
  - Role:
    - broader operational status outside the workspace pane

4. Signal weaknesses and conflicts

### Duplicated
- Selected-job status appears in:
  - CenterWorkspace truth summary
  - lifecycle badge
  - RightInspector decision status
  - RightInspector intelligence chips
  - RenderPreview focus chips
- Authority/output state appears in:
  - RenderPreview authority label
  - RightInspector Current/Selected/Approved/Deliverable-ready rows
  - graph render/post nodes
- “Next action” appears in:
  - selected-job microcopy
  - primary action button
  - RightInspector recommendation
  - family next move

### Conflicting or weak
- **Live monitor vs selected job**
  - `RenderPreview` shows current live execution, but also shows selected-job/output focus chips.
  - This is accurate, but semantically mixed. The surface can feel like it is showing selected-job authority when it is actually a live-run monitor.

- **Status vocabulary drift**
  - Similar concepts use different labels:
    - `Current Output ready`
    - `Approved Output in focus`
    - `Current winner`
    - `selected attempt`
    - `deliverable-ready`
    - `Signal received/live/resolved/flagged`
  - Meaning is mostly right, but the lexicon is not tightly normalized.

- **Transient notice overlap**
  - `operatorFeedback`, inline receipts, and local inline cues can all fire for adjacent actions.
  - Result: same action can create multiple stacked confirmations at different scopes.

- **Queue state timing mismatch**
  - `livePreview` updates from event stream and render callbacks.
  - selected job and queue rows update from `runtimeJobs/listRenderJobs`.
  - This can briefly make monitor state feel ahead of row/detail state.

- **Global “System Ready” is weak**
  - TopBar uses `previewState.mode === failed ? error : accent`.
  - That is not a true global health signal, only a render-preview-derived tone.

- **Family vs selected job hierarchy is correct but not always visually obvious**
  - There is logic that output inspection does not clear selected-job focus, but the surfaces repeat that rule instead of expressing it once clearly.

### Missing
- No single explicit “feedback priority” rule rendered to the operator, for example:
  - live execution
  - selected job
  - selected output
  - family authority
- No single canonical status component reused across surfaces, so wording and emphasis drift.

### Delayed
- Stream-driven preview can move faster than reconciled row/detail/family truth.
- Reconcile and sync paths can update after live preview already shifted mode.

5. Minimum patch plan, no behavior changes
- **Do not change state lineage or selection logic.**
- Patch only presentation composition.

#### Pass 1, minimum safe coherence patch
1. Introduce one small derived presenter model in `App.tsx`, for example:
   - `selectedFeedbackSummary`
   - includes:
     - canonical status label
     - canonical reason
     - canonical next step
     - canonical authority label
     - canonical focus label
2. Feed that same summary into:
   - CenterWorkspace selected-job truth summary
   - RightInspector decision header/body
   - RenderPreview focus/authority chip copy
3. Define strict surface roles:
   - RenderPreview: live run only, plus one small focus note
   - CenterWorkspace: active decision/action surface
   - RightInspector: canonical read-only explanation surface
4. Reduce duplicate transient signals:
   - keep `operatorFeedback` for global/runtime notices
   - keep inline receipts for local job/family action confirmation
   - remove duplicate local microcopy where it merely echoes the same action result
5. Normalize wording only:
   - pick one set of labels for:
     - current output
     - selected output
     - approved output
     - deliverable-ready output
     - current winner
     - next action
     - failed before render start / failed during render / packaging failed

This preserves:
- lineage
- authority
- selection semantics
- same-card evolution
- cross-surface behavior

6. One implementation prompt for first scoped pass  
**Prompt:**  
Phase 3E pass 1. Do a presentation-only coherence patch for selected-job, queue-row, and runtime/global feedback. Do not change lineage, authority rules, selection semantics, same-card evolution, queue behavior, or cross-surface behavior. In `App.tsx`, add one derived `selectedFeedbackSummary` object that normalizes canonical status, reason, next step, authority label, and focus label from existing state. Then update `CenterWorkspace`, `RightInspector`, and `RenderPreview` to consume that shared summary so wording and priority are consistent. Keep `RenderPreview` framed as live execution first, keep `CenterWorkspace` as the action surface, keep `RightInspector` as read-only canonical explanation, and reduce duplicated confirmations where the same action currently emits overlapping local cues plus global notices.
