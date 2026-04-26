# Session: 2026-04-12 01:41:19 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 1e27b8a8-028c-430d-bc0f-69b25706c1de
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Sunday, April 12th, 2026 - 4:37 AM (Africa/Nairobi) / 2026-04-12 01:37 UTC
assistant: [[reply_to_current]] Morning Mike, Solvi here 🎬 sharp, calm, and ready in the control room. What do you want to do first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 04:37 GMT+3] Resume from locked Phase 3H Pass C baseline in `directoros-app`.

Start with a narrow inspection for Phase 3H Pass D: Inspector decision integration.
Do not patch until the current inspector decision path is confirmed.

Scope:
- src/components/layout/RightInspector.tsx
- any strictly local inspector decision/microcopy helper it already imports or defines
- any local overlay/decision UI seam introduced by Pass C, only if already connected by import boundary

Rules:
- do not reopen Pass A/B/C interaction or overlay mechanics
- do not redesign command-console proof behavior
- do not change app-shell, queue, runtime controller, or global state
- preserve inspector layout rhythm, selection continuity, and render-card stability
- keep build green

Return only:
1. current RightInspector decision path
2. where command-console overlay decision/microcopy can connect cleanly
3. any dead helper paths or TS-noise seams in this local scope
4. the minimum safe patch plan
5. one final implementation prompt for Pass D
assistant: [[reply_to_current]]1. **current RightInspector decision path**  
- Decision UI is fully inline inside `src/components/layout/RightInspector.tsx`, under `activeTab === 'decision'`.
- Entry gate is `activeTab === 'decision' && (selectedJobTelemetry || productionFamily)`.
- Core decision source is `selectedJobTelemetry?.nextAction`, normalized through `getSelectedJobPrimaryControl(...)`, but that computed primary control is currently **not rendered** in the visible decision panel.
- What is rendered now:
  - lifecycle/output context cards
  - recommended next move text via `selectedJobTelemetry?.nextAction?.primaryActionLabel ?? productionFamily?.nextFamilyAction ?? 'inspect'`
  - optional reason copy via `selectedJobTelemetry?.nextAction?.primaryActionReason`
  - secondary action stack via `SELECTED_JOB_SECONDARY_ACTIONS`, filtered against the hidden `selectedJobPrimaryControl?.onClickKey`
  - support/open actions wired directly to local props callbacks
- So the confirmed path is:  
  **telemetry/family props → inline decision summary copy → hidden primary-control resolver → rendered secondary/support buttons**

2. **where command-console overlay decision/microcopy can connect cleanly**  
- Cleanest seam is inside the existing `activeTab === 'decision'` block, specifically beside or just below:
  - `Recommended Next Move`
  - `selectedJobTelemetry?.nextAction?.primaryActionReason`
  - the `selectedJobPrimaryControl` resolution
- Best local integration point:
  - derive a small inspector-facing decision payload from `selectedJobTelemetry?.nextAction`, `selectedJobPrimaryControl`, and existing context labels
  - render command-console overlay microcopy from that payload in the same decision section before secondary actions
- Why this seam is clean:
  - it already owns decision authority text
  - it already resolves actionable intent
  - it stays within current import boundary and avoids reopening overlay mechanics
- Secondary clean seam, only if Pass C already connected it by import, is any existing local overlay/decision presenter that can accept:
  - label
  - reason
  - status/focus badges
  - action key

3. **any dead helper paths or TS-noise seams in this local scope**  
- `getSelectedJobPrimaryControl(...)` is **partially dead** right now, computed and used only for filtering secondary actions, not for actual primary-action rendering.
- `selectedFeedbackSummary?.reason` and `selectedFeedbackSummary?.nextStep` exist in props but are not surfaced in the decision block shown here.
- `currentFocus` is declared in props but not destructured or used in the component body.
- `_shotJobLedger`, `_shotLedgerScope`, `_onShotLedgerScopeChange`, `_selectedShotForLedger`, `_onSelectJobFromLedger`, `_onJumpToShotFromLedger`, `_onOpenEvidence` are intentionally parked underscore bindings, so not broken, but they are local TS-noise seams in this file.
- There is no separate imported inspector-decision helper in the shown scope besides `SELECTED_JOB_SECONDARY_ACTIONS`.

4. **the minimum safe patch plan**  
- Do not touch overlay mechanics or command-console behavior.
- Keep patch local to `RightInspector.tsx`.
- Minimum safe Pass D patch:
  1. expose the already-resolved `selectedJobPrimaryControl` in the decision tab as inspector decision microcopy/action context
  2. add a tiny local decision-copy helper or inline mapper for:
     - primary label
     - primary reason
     - fallback from `nextAction` / family next action
     - optional operator wording for command-console overlay handoff
  3. place that microcopy directly above the existing secondary actions block
  4. preserve all current secondary/support buttons unchanged
  5. remove only truly dead local decision helpers if they become redundant, otherwise keep churn near-zero
- This keeps selection continuity, render-card stability, and app-shell/runtime boundaries untouched.

5. **one final implementation prompt for Pass D**  
Implement Phase 3H Pass D in `src/components/layout/RightInspector.tsx` only: confirm and surface the existing inspector decision authority path by rendering a small decision handoff block in the `decision` tab that uses `selectedJobPrimaryControl`, `selectedJobTelemetry?.nextAction`, and existing family/job context to provide command-console-ready decision microcopy. Do not change overlay mechanics, app-shell/runtime/global state, or secondary action behavior. Keep layout rhythm intact, remove no behavior except dead local decision-path code if clearly unused, and keep the build green.
