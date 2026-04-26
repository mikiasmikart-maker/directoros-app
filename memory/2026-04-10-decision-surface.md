# Session: 2026-04-10 02:58:31 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: a9e8ac88-dade-484e-bc06-210a9c480cc9
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Friday, April 10th, 2026 - 5:53 AM (Africa/Nairobi) / 2026-04-10 02:53 UTC
assistant: [[reply_to_current]] Morning Mike, Solvi here 🎬 Clean control room, fresh session, ready to move fast and keep the runtime sharp. What do you want to tackle first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 05:53 GMT+3] Continue from closed preview authority phase 2. Do not reopen preview logic.

Start the next DirectorOS chapter: decision-surface alignment.

Goal:
Inspect operator-facing decision surfaces for any mismatch between:
- labels
- state authority
- recommended action
- selected job context

Focus:
1. selected-job decision surface
2. CenterWorkspace action framing
3. RightInspector action clarity
4. whether failure/review states suggest the correct next move

Task:
1. inspect current decision surfaces only
2. identify the single highest-value mismatch
3. propose a minimal surgical fix plan

Do not patch yet.

Deliver:
- exact mismatch point
- why it matters to operator speed/clarity
- smallest safe fix plan
assistant: Quick pass now, I hit a path mismatch on the workspace components, so I’m tracing the actual layout files before I call the mismatch.
assistant: [[reply_to_current]] 2-line session summary  
I inspected the current operator decision surfaces across selected-job, CenterWorkspace, and RightInspector.  
Highest-value mismatch is not preview authority, it is action framing drift: the same selected job can present conflicting “next action” guidance across surfaces.

Next 3 actions  
1. Lock one canonical next-action resolver for selected-job state.  
2. Feed that resolver into CenterWorkspace and RightInspector labels/buttons.  
3. Keep failure/review wording tied to authority state, not just lifecycle state.

Exact mismatch point  
The clearest mismatch is between CenterWorkspace `getPrimaryActionLabel(...)` and the selected-job / RightInspector action surfaces.

Current logic in `src\components\layout\CenterWorkspace.tsx`:
- approved job/actionState approved => primary label becomes `Finalize shot`
- failed job => `Retry job` or `Inspect failure`
- best-known selected job => `Approve best known`

But in the same selected-job detail area, the available actions still show:
- `Open Current Winner`
- `Open Approved Output`
- `Retry Latest Attempt`
- `Inspect Historical Artifact`
- M5 actions including `Approve Best Known` and `Finalize Shot`

So the top “Valid Next Action” can say `Finalize shot`, while the surface still presents equal-weight neighboring actions, and RightInspector independently renders:
- `productionFamily?.nextFamilyAction ?? selectedJobTelemetry?.validNextAction ?? 'inspect'`

That means action recommendation is derived in more than one place and framed differently depending on which panel the operator is looking at.

Why it matters to operator speed/clarity  
This is a control-room decision surface, so the operator needs one answer to “what should I do next?”.  
Right now the UI makes the operator re-interpret state:
- lifecycle says one thing,
- review authority says another,
- buttons expose multiple parallel actions without a clearly dominant safe move.

In failure/review states, that slows action selection and increases hesitation, especially when a failed latest attempt, approved output, or best-known result coexist in the same lineage.

Smallest safe fix plan  
1. Create one canonical selected-job next-action resolver in `App.tsx` or a small shared helper, using already-derived authority fields:
   - canonical state
   - approval status
   - action state
   - retry eligibility
   - whether selected job is best-known
   - whether selected job is approved/finalized
2. Return a tight payload, for example:
   - `primaryActionKey`
   - `primaryActionLabel`
   - `primaryActionReason`
   - optional `secondaryActions`
3. Pass that single resolved object into:
   - CenterWorkspace “Valid Next Action”
   - selected-job detail header/chip
   - RightInspector decision tab action row
4. Do not change preview authority logic. Only replace duplicate label derivation so all operator-facing decision surfaces say the same next move.

Copy/paste prompt  
“Unify selected-job next-action framing behind one canonical resolver. Preserve preview authority. Do not change review logic, only align labels and primary action recommendation across CenterWorkspace and RightInspector.”

File-safe naming  
- `decisionActionResolver.ts`
- `selectedJobNextAction.ts`
- `decision-surface-alignment-notes.md`
