# Session: 2026-04-10 17:15:53 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 7a90a261-1f55-4292-8219-79b3e08f9ce2
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Friday, April 10th, 2026 - 8:00 PM (Africa/Nairobi) / 2026-04-10 17:00 UTC
assistant: [[reply_to_current]] Solvi here 🎬 Calm control room is up and ready, Mike.

What do you want to drive first: UI polish, runtime diagnosis, or a precise fix?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 20:01 GMT+3] Patch selected-job action surfaces so advisory review recommendations never appear as executable runtime CTAs.

Context:
- selected-job next-action framing chapter is closed
- review/lineage truth is closed
- do not reopen lineage, preview authority, continuity, or action resolver logic

Goal:
Separate recommendation from executable control on selected-job surfaces.

Tasks:
1. In RightInspector:
 - stop using review recommendation labels as clickable primary CTA labels
 - show canonical recommendation as read-only guidance
 - show a separate literal evidence/control CTA whose label matches its real handler
 - remove deceptive mapping in runSelectedJobPrimaryAction()

2. In CenterWorkspace:
 - rename advisory wording from executable-sounding labels to recommendation wording
 - keep executable controls in their own literal action section

3. Do not add review mutation behavior
4. Do not change canonical next-action resolution
5. Keep this a presentation/control-semantics fix only

Deliver:
- exact files changed
- exact deceptive mappings removed
- exact new recommendation vs executable wording
- exact before/after surface behavior
assistant: On it. I’ll keep this scoped to presentation/control semantics only, inspect the two surfaces, then patch the misleading CTA wiring without touching action resolution.
assistant: I found the exact issue. Both surfaces are using review recommendation labels as if they were executable controls. I’m patching the selected-job views so recommendation stays read-only, and every clickable CTA uses its literal handler label only.
assistant: [[reply_to_current]] 2-line session summary  
Selected-job recommendation and executable control are now separated on both target surfaces.  
No lineage, review truth, preview authority, continuity, or next-action resolution logic was changed.

Next 3 actions  
1. Retest selected failed, approved, winner, and artifact-only jobs in both surfaces  
2. Confirm every clickable label now matches its real handler literally  
3. If you want, I can do one more narrow pass on copy consistency for family-level cards only

Exact files changed  
- `src/components/layout/RightInspector.tsx`
- `src/components/layout/CenterWorkspace.tsx`

Exact deceptive mappings removed  
- In `RightInspector`, removed the `runSelectedJobPrimaryAction()` deceptive label-to-handler bridge
- Removed review recommendation labels being used as clickable primary CTA labels, specifically where recommendation labels like:
  - `Approve Best Known`
  - `Finalize Shot`
  - other `selectedJobTelemetry.nextAction.primaryActionLabel` values
  were being shown as the clickable button while actually triggering:
  - `onOpenCurrentWinner`
  - `onOpenApprovedOutput`
  - `onJumpToReplacement`
  - `onRetryLatestAttempt`
  - `onInspectHistoricalArtifact`

Exact new recommendation vs executable wording  
- `RightInspector`
  - Read-only section label: `Recommendation`
  - New literal control section: `Executable Control`
  - Literal CTA labels now resolve to real handlers only:
    - `Retry Latest Attempt`
    - `Open Approved Output`
    - `Open Current Winner`
    - `Jump to Replacement`
    - `Inspect Historical Artifact`
- `CenterWorkspace`
  - Renamed advisory wording:
    - `Valid Next Action` → `Recommendation`
    - `Valid Next Actions` → `Recommendation`
    - `primary action ...` → `recommendation ...`
  - M4 decision outputs renamed:
    - `best-known:` → `best-known recommendation:`
    - `retry:` → `retry recommendation:`
  - Added separate executable section labels:
    - `Executable Control`
    - `Literal Actions`

Exact before/after surface behavior  
- Before
  - Selected-job surfaces displayed advisory review/canonical recommendation text as if it were the actual executable CTA
  - Clicking the primary CTA could perform a different literal action than the button label implied
- After
  - Recommendation is displayed as read-only guidance only
  - Executable control is displayed separately
  - The clickable CTA label always matches the real handler it invokes
  - Secondary executable actions remain in their own literal action section
  - No review mutation behavior added
  - No canonical next-action resolution changed

Copy/paste prompt  
- “Test selected-job surfaces with four states: failed, approved, winner-only, artifact-only. Confirm recommendation is read-only and every CTA label exactly matches the invoked handler.”

File-safe naming  
- `selected-job-recommendation-vs-control-semantics-fix`
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 20:05 GMT+3] Test selected-job recommendation vs executable control semantics.

Validate these states in both CenterWorkspace and RightInspector:
1. failed
2. approved
3. winner-only
4. artifact-only

Checks:
1. recommendation is read-only, not clickable
2. executable control label exactly matches the handler it invokes
3. no CTA still uses advisory wording as executable text
4. CenterWorkspace and RightInspector stay semantically aligned
5. no lineage/review/preview behavior changed as a side effect

Deliver only:
- PASS/FAIL for each state
- any remaining label/handler mismatch
- whether the selected-job recommendation vs control chapter is fully green
assistant: I’m validating the four selected-job states against the actual rendered control logic in both files now, staying strictly on semantics and side effects.
assistant: I found one remaining semantic mismatch path. CenterWorkspace’s primary executable control still derives from review metadata in a way that can disagree with RightInspector for replacement and approved/winner precedence. I’m fixing that alignment now before I give you the matrix.
assistant: [[reply_to_current]] 2-line session summary  
Selected-job recommendation vs executable control is now aligned across both surfaces for the four target states.  
I found one CenterWorkspace precedence mismatch during validation and cleared it before final verdict.

Next 3 actions  
1. Keep this chapter closed  
2. Retest in UI if you want visual confirmation only  
3. Move to the next selected-job chapter

1. failed  
- PASS

2. approved  
- PASS

3. winner-only  
- PASS

4. artifact-only  
- PASS

Any remaining label/handler mismatch  
- None found after the final alignment fix

Whether the selected-job recommendation vs control chapter is fully green  
- YES, fully green
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 20:10 GMT+3] Lock selected-job recommendation vs executable control chapter cleanly.

Give me:
1. 2-line session summary
2. exact completed work only
3. exact remaining work only
4. next 3 actions in order
5. one continuation prompt for the next session
6. one file-safe session title

Do not reopen recommendation/control semantics work. Close with a precise handoff.
assistant: [[reply_to_current]] 2-line session summary  
Selected-job recommendation vs executable control is closed and green in both `CenterWorkspace` and `RightInspector`.  
Advisory wording is now read-only, executable CTAs are literal, and no side-effect changes were introduced to lineage, review, preview, or next-action resolution.

2. exact completed work only  
- Patched `src/components/layout/RightInspector.tsx`
- Patched `src/components/layout/CenterWorkspace.tsx`
- Removed deceptive primary CTA label-to-handler mapping from `RightInspector`
- Split selected-job surfaces into read-only `Recommendation` and separate executable control sections
- Renamed advisory copy in `CenterWorkspace` from executable-sounding wording to recommendation wording
- Kept executable controls in their own literal action section
- Renamed M4 advisory text to:
  - `best-known recommendation`
  - `retry recommendation`
- Aligned selected-job executable control precedence across both surfaces for:
  - failed
  - approved
  - winner-only
  - artifact-only
- Validated all four selected-job states as PASS
- Confirmed no remaining label/handler mismatch
- Confirmed the chapter is fully green

3. exact remaining work only  
- None in the selected-job recommendation vs executable control chapter

4. next 3 actions in order  
1. Leave this chapter closed  
2. Choose the next selected-job chapter to inspect  
3. Run a new scoped pass only on that chapter’s own surfaces and labels

5. one continuation prompt for the next session  
- “Start from the closed green state for selected-job recommendation vs executable control, do not revisit it, and inspect the next selected-job chapter with the same presentation-only discipline.”

6. one file-safe session title  
- `selected-job-recommendation-vs-executable-control-closed-green`
