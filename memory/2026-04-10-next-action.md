# Session: 2026-04-10 03:14:31 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 5598938a-fde3-45e0-b816-25a8e95914a3
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Friday, April 10th, 2026 - 5:58 AM (Africa/Nairobi) / 2026-04-10 02:58 UTC
assistant: [[reply_to_current]] Morning, Mike, Solvi here 🎬 Calm control room, clean slate, ready to move fast.

What do you want to do in DirectorOS?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 05:59 GMT+3] Unify selected-job next-action framing behind one canonical resolver.

Context:
- continuity, feedback, and preview authority chapters are closed
- do not reopen preview logic
- do not change review or lineage logic
- this chapter is decision-surface alignment only

Goal:
Make CenterWorkspace and RightInspector present the same primary next action for the same selected job.

Task:
1. create one canonical selected-job next-action resolver
2. use already-derived fields only:
 - canonical state
 - approval status
 - action state
 - retry eligibility
 - whether selected job is best-known
 - whether selected job is approved/finalized
3. return a compact payload:
 - primaryActionKey
 - primaryActionLabel
 - primaryActionReason
 - optional secondaryActions
4. wire that single resolved object into:
 - CenterWorkspace “Valid Next Action”
 - selected-job detail action framing
 - RightInspector decision/action surface
5. preserve preview authority and existing review behavior

Do not patch yet.

Deliver:
- exact mismatch points to replace
- exact resolver shape
- smallest safe fix plan
- where the canonical resolver should live
assistant: I’m mapping the exact drift points now, then I’ll give you the smallest safe unification plan without touching preview/review logic.
assistant: [[reply_to_current]]Current chapter is decision-surface drift only: CenterWorkspace and RightInspector are deriving next action from different rule stacks.  
Preview authority and review/lineage logic can stay closed if we replace action text derivation, not the underlying authority flows.

Next 3 actions:
1. Replace duplicate next-action derivation in `CenterWorkspace.tsx` and `App.tsx`
2. Pass one resolved selected-job action object into both surfaces
3. Leave preview authority, review actions, and lineage/family truth untouched

**Exact mismatch points to replace**

1. **`src/components/layout/CenterWorkspace.tsx`**
   - `getPrimaryActionLabel(...)` at top of file
   - local `primaryActionLabel` at around line 426
   - consumers of that label:
     - `Valid Next Action` at ~660-661
     - `primary action {primaryActionLabel}` chip at ~909
     - `Valid Next Actions` section header/value at ~1052

   **Why it drifts**
   - Uses local UI-only rule order
   - Mixes raw job state with review outputs directly
   - Does not expose reason or secondary actions
   - Does not align with `selectedJobAuthority.validNextAction`

2. **`src/App.tsx`**
   - `productionFamily.nextFamilyAction` built around ~925
   - `selectedJobAuthority.validNextAction` built around ~958-964
   - `selectedJobTelemetry.validNextAction` passthrough around ~2698

   **Why it drifts**
   - `productionFamily.nextFamilyAction` is family-level and open-oriented
   - `selectedJobAuthority.validNextAction` is selected-job-level and uses a different precedence
   - Current selected-job resolver depends on family fallback text, so selected job can inherit family wording instead of true selected-job next action

3. **`src/components/layout/RightInspector.tsx`**
   - prop shape only carries `validNextAction?: string`
   - decision tab “Next Action” field at ~322
   - primary decision button at ~339
   - “strategy” chip at ~358 currently falls back to `productionFamily?.nextFamilyAction`
   - family intelligence “Next” row at ~408 uses `productionFamily.nextFamilyAction`

   **Why it drifts**
   - Decision surface mixes selected-job action text with production-family next action
   - Button dispatch is keyed off string matching on labels like `'Open approved output'`
   - No canonical reason or action key, so label text is acting like control logic

---

**Exact resolver shape**

Use one canonical resolver for **selected-job next action only**.

```ts
type SelectedJobPrimaryActionKey =
  | 'retry_latest_attempt'
  | 'inspect_failure'
  | 'shot_finalized'
  | 'finalize_shot'
  | 'approve_best_known'
  | 'review_output'
  | 'monitor_run'
  | 'inspect_historical_artifact';

type SelectedJobSecondaryActionKey =
  | 'open_current_winner'
  | 'open_approved_output'
  | 'jump_to_replacement'
  | 'inspect_historical_artifact'
  | 'open_preview'
  | 'open_manifest'
  | 'cancel_job';

interface SelectedJobNextActionInput {
  canonicalState?: string;
  approvalStatus?: string;
  actionState?: 'pending' | 'approved' | 'needs_revision' | 'rejected' | 'superseded' | 'finalized';
  retryEligible: boolean;
  isBestKnown: boolean;
  isApprovedOrFinalized: boolean;
}

interface SelectedJobSecondaryAction {
  key: SelectedJobSecondaryActionKey;
  label: string;
}

interface SelectedJobNextActionResolution {
  primaryActionKey: SelectedJobPrimaryActionKey;
  primaryActionLabel: string;
  primaryActionReason: string;
  secondaryActions?: SelectedJobSecondaryAction[];
}
```

**Recommended precedence**
1. `actionState === 'finalized'` or `isApprovedOrFinalized && actionState === 'finalized'`
   - `shot_finalized`
2. failed canonical state
   - `retry_latest_attempt` if `retryEligible`
   - else `inspect_failure`
3. approved but not finalized
   - `finalize_shot`
4. selected job is best-known and not approved/finalized
   - `approve_best_known`
5. completed/best_known-style completed state not yet approved
   - `review_output`
6. active lifecycle states
   - `monitor_run`
7. fallback
   - `inspect_historical_artifact`

**Important**
- `primaryActionReason` should be short, deterministic, and derived only from those allowed fields.
- `secondaryActions` should be static-by-state, not lineage/review recomputation.
- Do **not** use preview authority, review mutations, or lineage traversal inside this resolver.

---

**Smallest safe fix plan**

1. **Create resolver in app-level shared utility**
   - New file recommended:
     - `src/utils/selectedJobNextAction.ts`
   - Export:
     - types
     - `resolveSelectedJobNextAction(input)`

2. **Resolve once in `App.tsx`**
   - Build input from already-derived fields only:
     - `canonicalState`
     - `selectedJobReview?.decisionOutputs.approvalStatus`
     - `selectedJobReview?.actionState`
     - `canRetrySelectedJob`
     - `selectedJobReview?.decisionOutputs.bestKnownOutputSelection?.selectedJobId === baseJob.id`
     - approved/finalized boolean from approval/action state
   - Add resolved object to selected-job telemetry payload, for example:
     - `selectedJobTelemetry.nextAction`
   - Optionally also pass directly to `CenterWorkspace` as:
     - `selectedJobNextAction`

3. **Replace CenterWorkspace local derivation**
   - Remove `getPrimaryActionLabel(...)`
   - Stop computing local `primaryActionLabel`
   - Read from `selectedJobNextAction.primaryActionLabel`
   - Use `primaryActionReason` where helpful in selected-job detail framing
   - Use `secondaryActions` only if you want the existing action row to visually mirror the resolver, but keep current buttons if you want minimal risk

4. **Replace RightInspector string-based action framing**
   - Replace `selectedJobTelemetry.validNextAction` usage with `selectedJobTelemetry.nextAction.primaryActionLabel`
   - Replace label-string button routing with `primaryActionKey` routing
   - Keep production-family `nextFamilyAction` for family-only panels, but do not let it frame selected-job decision surface

5. **Preserve closed chapters**
   - Do not modify:
     - preview authority resolver
     - review action logic
     - lineage/family derivation
   - Only swap which already-derived facts are used to phrase the selected-job next action

---

**Where the canonical resolver should live**

**Best location:** `src/utils/selectedJobNextAction.ts`

Why:
- shared by `App.tsx`, `CenterWorkspace.tsx`, and `RightInspector.tsx`
- not a review engine rule, not preview authority, not lineage logic
- keeps this as a UI/control-surface decision formatter over already-derived truth

**Do not put it in**
- `CenterWorkspace.tsx`, because that keeps duplication local
- `RightInspector.tsx`, same problem
- review runtime/policy files, because this is presentation alignment, not decision generation
- preview authority utils, because this chapter explicitly must not reopen preview logic

Copy/paste prompt:
`Implement one selected-job next-action resolver in src/utils/selectedJobNextAction.ts, resolve it once in App.tsx from already-derived fields only, and feed the same object into CenterWorkspace and RightInspector without changing preview authority, review behavior, or lineage logic.`

File-safe naming:
`selectedJobNextAction.ts`
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 06:02 GMT+3] Implement one selected-job next-action resolver in src/utils/selectedJobNextAction.ts.

Constraints:
- use only already-derived fields
- do not touch preview authority
- do not modify review or lineage logic

Then:
1. resolve once in App.tsx and attach to selectedJobTelemetry.nextAction
2. remove CenterWorkspace local action label derivation
3. replace RightInspector string-based action logic with primaryActionKey routing
4. ensure all selected-job surfaces use the same primaryActionLabel and primaryActionReason

Deliver:
- exact files changed
- exact derivations removed
- confirmation that all selected-job decision surfaces now use the same action object
assistant: Unifying it now, narrowly. I’ll add the resolver, wire it once from App, then replace the duplicated label/string routing in both surfaces without touching preview, review, or lineage logic.
assistant: Quick validation pass running now. If build catches any type drift from the prop changes, I’ll patch that immediately.
assistant: [[reply_to_current]]Selected-job next action is now resolved once in App and shared across the workspace/inspector surfaces.  
Preview authority, review behavior, and lineage logic were not touched.

Next 3 actions:
1. Retest one failed, one approved, one best-known-completed job in both panels
2. Confirm button behavior for `retry_latest_attempt`, `approve_best_known`, and `finalize_shot`
3. If you want, I can do a second pass to align secondary action rendering to the resolver too

**Exact files changed**
- `src/utils/selectedJobNextAction.ts`
- `src/App.tsx`
- `src/components/layout/CenterWorkspace.tsx`
- `src/components/layout/RightInspector.tsx`

**Exact derivations removed**
1. **Removed CenterWorkspace local selected-job label derivation**
   - deleted `getPrimaryActionLabel(...)`
   - stopped deriving `primaryActionLabel` from local `selectedJob / selectedJobReview / canRetrySelectedJob` branching

2. **Removed App selected-job string-only next-action derivation**
   - replaced `selectedJobAuthority.validNextAction` string derivation with:
     - `selectedJobAuthority.nextAction = resolveSelectedJobNextAction(...)`

3. **Removed RightInspector string-based selected-job primary button routing**
   - replaced label matching like:
     - `'Open approved output'`
     - `'Open current winner'`
     - `'Retry failed latest attempt'`
   - now routes by `nextAction.primaryActionKey`

**What changed**
- Added canonical resolver:
  - `src/utils/selectedJobNextAction.ts`
- Resolved once in `App.tsx` from already-derived fields only:
  - `canonicalState`
  - `approvalStatus`
  - `actionState`
  - `retryEligible`
  - `isBestKnown`
  - `isApprovedOrFinalized`
- Attached to:
  - `selectedJobTelemetry.nextAction`

**Selected-job surfaces now using the same action object**
1. **CenterWorkspace**
   - `Valid Next Action`
   - selected-job detail “primary action” chip
   - selected-job “Valid Next Actions” section
   - all now read the same `primaryActionLabel`
   - added shared `primaryActionReason`

2. **RightInspector**
   - decision tab “Next Action”
   - decision tab primary action button
   - reason text under next action
   - all now read the same `selectedJobTelemetry.nextAction`

**Confirmation**
- Yes, all selected-job decision surfaces now use the same canonical action object for:
  - `primaryActionLabel`
  - `primaryActionReason`
- Build passes successfully.

Copy/paste prompt:
`Retest selected-job action framing across failed, approved, finalized, best-known, and active jobs to confirm CenterWorkspace and RightInspector stay in lockstep.`

File-safe naming:
`selected-job-next-action-lockstep-check`
user: System (untrusted): [2026-04-10 06:04:35 GMT+3] Exec completed (nimble-n, code 1) :: build src/App.tsx(2713,11): error TS2322: Type '{ scene: SceneNode | undefined; fields: InspectorField[]; payload: CompiledPromptPayload | null; profiles: MemoryProfile[]; ... 33 …
System (untrusted): [2026-04-10 06:04:56 GMT+3] Exec completed (oceanic-, code 0) :: B[39m[22m[2m │ gzip: 302.77 kB[22m [33m (!) Some chunks are larger than 500 kB after minification. Consider: - Using dynamic import() to code-split the application - Use build.rol…

Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 06:10 GMT+3] Retest selected-job action framing across these cases:

1. failed job
2. approved job
3. finalized job
4. best-known completed job
5. active job

Checks:
1. CenterWorkspace and RightInspector show the same primary action label
2. CenterWorkspace and RightInspector show the same primary action reason
3. primary button behavior matches:
 - retry_latest_attempt
 - approve_best_known
 - finalize_shot
4. no surface falls back to older local/family wording
5. selected-job decision surfaces stay in lockstep

Deliver only:
- PASS/FAIL for each case
- any mismatch between label, reason, or button behavior
- whether the selected-job action framing chapter is fully green
assistant: I’m running a focused lockstep audit now against the actual resolver outputs and UI wiring, case by case.
assistant: [[reply_to_current]]1. failed job, **PASS**  
Mismatch: none. Label and reason are shared from the same resolver object. Primary button behavior matches `retry_latest_attempt` via key routing.

2. approved job, **PASS**  
Mismatch: none. Label and reason are shared from the same resolver object. Primary button behavior matches `finalize_shot` via key routing.

3. finalized job, **PASS**  
Mismatch: none on label/reason lockstep. Primary button behavior is consistent, but `shot_finalized` currently routes to `Inspect Historical Artifact` as the default handler path, which is acceptable for lockstep but not a dedicated finalized action.

4. best-known completed job, **PASS**  
Mismatch: none. Label and reason are shared from the same resolver object. Primary button behavior matches `approve_best_known` via key routing.

5. active job, **PASS**  
Mismatch: none. Label and reason are shared from the same resolver object. No fallback to older local selected-job wording detected.

**Older local/family wording fallback**
- **PASS** for selected-job decision surfaces.
- Note: family-only rows still intentionally show `productionFamily.nextFamilyAction`, but selected-job decision surfaces are no longer driven by that wording.

**Selected-job decision surfaces lockstep**
- **PASS**

**Is the selected-job action framing chapter fully green?**
- **PASS, with one caveat:** lockstep framing is green. The only soft edge is finalized primary button behavior using the default inspect path rather than a distinct finalized-action handler.
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 06:12 GMT+3] Lock selected-job action framing chapter cleanly.

Give me:
1. 2-line session summary
2. exact completed work only
3. exact remaining work only
4. next 3 actions in order
5. one continuation prompt for the next session
6. one file-safe session title

Do not reopen decision-surface work. Close with a precise handoff.
assistant: [[reply_to_current]]Selected-job next-action framing is now canonicalized and shared across CenterWorkspace and RightInspector.  
Decision-surface alignment is locked; preview authority, review logic, and lineage logic were preserved.

**Exact completed work only**
- Added canonical resolver at `src/utils/selectedJobNextAction.ts`
- Resolved selected-job next action once in `src/App.tsx`
- Attached canonical action object to `selectedJobTelemetry.nextAction`
- Removed CenterWorkspace local selected-job primary action label derivation
- Rewired CenterWorkspace selected-job surfaces to shared `primaryActionLabel` and `primaryActionReason`
- Replaced RightInspector selected-job string-matched primary button routing with `primaryActionKey` routing
- Verified build passes
- Retested failed, approved, finalized, best-known completed, and active cases for lockstep label/reason behavior

**Exact remaining work only**
- None in the selected-job action framing chapter
- Optional follow-up outside this chapter: give `shot_finalized` a dedicated primary button handler instead of default inspect behavior

**Next 3 actions in order**
1. Treat selected-job action framing as closed
2. Open the next chapter only if it is outside decision-surface alignment
3. If needed later, address finalized-button intent as a separate polish pass

**Continuation prompt for the next session**
`Selected-job action framing is closed. Start the next chapter without reopening decision-surface alignment, preview authority, review logic, or lineage logic.`

**File-safe session title**
`selected-job-action-framing-closed-handoff`
