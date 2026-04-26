# Session: 2026-04-10 03:20:18 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: ac8c896f-5c65-4679-9b5a-9a72b5ebe511
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Friday, April 10th, 2026 - 6:14 AM (Africa/Nairobi) / 2026-04-10 03:14 UTC
assistant: [[reply_to_current]] Morning, Mike, Solvi here 🎬 sharp and ready in the control room. What are we building or fixing first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Fri 2026-04-10 06:15 GMT+3] Selected-job action framing is closed.

Start the next chapter: secondary action rendering alignment.

Goal:
Make secondary actions around the selected job feel intentional, ordered, and consistent with the canonical primary action without reopening preview authority, review logic, lineage logic, or decision-surface alignment.

Task:
1. inspect current secondary action rows/buttons in CenterWorkspace and RightInspector
2. identify the highest-value mismatch in action order, grouping, or emphasis
3. propose a minimal surgical fix plan

Do not patch yet.

Deliver:
- exact mismatch point
- why it matters to operator clarity
- smallest safe fix plan
assistant: I’m tracing the two surfaces directly now, focusing only on action rows and button ordering so we can isolate the cleanest mismatch without drifting into authority or review logic.
assistant: [[reply_to_current]] 1. Session summary  
Secondary action surfaces are carrying duplicate and unordered actions across CenterWorkspace and RightInspector.  
The highest-value mismatch is not missing capability, it is emphasis drift: multiple secondary buttons compete with the canonical next action instead of orbiting it.

2. Next 3 actions  
1) Collapse duplicate secondary actions into one consistent ordered cluster around the canonical primary action  
2) Keep family-level and selected-job-level secondary sets parallel, with the same fallback order  
3) Demote utility/file-open actions into a trailing utility group so decision actions read first

3. Exact mismatch point  
The clearest mismatch is in selected-job secondary actions:

- `CenterWorkspace` → “Valid Next Actions” row puts many peers side by side:
  - Open Current Winner
  - Open Approved Output
  - Jump To Replacement
  - Retry Latest Attempt
  - Inspect Historical Artifact
  - Retry Job / Retry Same Context
  - Cancel Job
  - Open Preview / Open First Output / Open Output Folder / Open Manifest / Open Metadata

- `RightInspector` → Decision tab row uses a different peer set and order:
  - primary action
  - Open Current Winner
  - Open Approved Output
  - Jump To Replacement
  - Retry Latest Attempt
  - Inspect Historical Artifact
  - Open Evidence

This creates two mismatches at once:
- same semantic action set, different ordering/grouping by surface
- utility actions and alternate actions sit at the same visual rank as the canonical next move

4. Why it matters to operator clarity  
When the selected job is under pressure, the operator should be able to read:
primary move first, nearest valid alternates second, utilities last.

Right now the UI says too many things with the same weight, so the operator has to re-parse intent per panel. That weakens confidence in what the system considers “next”, even though the canonical primary action logic is already correct.

5. Smallest safe fix plan  
- Define one shared secondary-action order contract around the existing canonical primary action, without changing any underlying logic:
  1. Open Approved Output
  2. Open Current Winner
  3. Jump To Replacement
  4. Retry Latest Attempt
  5. Inspect Historical Artifact
- Apply that same ordered cluster to both:
  - `CenterWorkspace` selected-job action row
  - `RightInspector` decision action row
- Move non-decision utility actions into a separate trailing utility group in `CenterWorkspace` only:
  - Cancel Job
  - Open Preview
  - Open First Output
  - Open Output Folder
  - Open Manifest / Open Metadata
- Remove obvious duplicate-label noise where both buttons trigger the same action:
  - `Retry Job` + `Retry Same Context` → keep one
  - `Open Manifest` + `Open Metadata` → keep one label

Smallest safe outcome: no authority changes, no review changes, no lineage changes, just cleaner ordering, grouping, and emphasis.
