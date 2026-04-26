# Session: 2026-04-12 15:42:15 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 15acf9cd-eac3-408c-a5d2-c89ded34951a
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Sunday, April 12th, 2026 - 6:59 AM (Africa/Nairobi) / 2026-04-12 03:59 UTC
assistant: [[reply_to_current]] Morning, Mike, Solvi here 🎬 Sharp, calm, and ready in the control room. What do you want to do first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 07:00 GMT+3] Before applying any UI changes, define a canonical terminal-state grammar for DirectorOS.

Task:
- create one unified language system for completed, failed, and cancelled
- define for each:
 - state title
 - short reason line
 - primary action label
 - secondary action label
- define one canonical action vocabulary (no synonyms across surfaces)
- define one shared badge/chip usage rule for all surfaces

Do not patch any UI yet.

Then report:
- the final terminal-state grammar
- the canonical action label set
- any conflicts with current wording
- minimal application plan across Preview, Live Runs, Family, and Selected Job
assistant: I’m checking current wording first so the grammar fits the app instead of being abstract.
assistant: Found the core state strings in `src/App.tsx`. I’m reading the relevant UI blocks now to map wording conflicts precisely.
assistant: [[reply_to_current]]Current work: defining the terminal-state language before any UI patching, so Preview, Live Runs, Family, and Selected Job all speak the same ending state.
I checked current wording and there are real conflicts now, especially around failed/cancelled labels and retry verbs.

Next 3 actions:
1. Lock this grammar as the single source of truth
2. Map each current conflicting phrase to the canonical replacement
3. Apply it later surface-by-surface, starting with shared helpers, not per-screen copy edits

**Final terminal-state grammar**

### 1) Completed
- **State title:** `Completed`
- **Short reason line:** `Output finished successfully.`
- **Primary action label:** `Review Output`
- **Secondary action label:** `Open Output Folder`

### 2) Failed
- **State title:** `Failed`
- **Short reason line:** `Run stopped because execution failed.`
- **Primary action label:** `Retry Latest Attempt`
- **Secondary action label:** `Open Manifest`

### 3) Cancelled
- **State title:** `Cancelled`
- **Short reason line:** `Run was stopped before completion.`
- **Primary action label:** `Retry Latest Attempt`
- **Secondary action label:** `Open Manifest`

**Canonical action label set**
Use these labels exactly, with no synonyms across surfaces:
- `Review Output`
- `Retry Latest Attempt`
- `Open Output Folder`
- `Open Manifest`
- `Cancel Run`
- `Open Command Console`
- `Open Workspace`
- `Escalate`

Notes:
- Use `Retry Latest Attempt` for both **failed** and **cancelled** if retry is allowed.
- Do not alternate with `Retry`, `Retry cancelled run`, `Re-run Scene`, `Regenerate Scene`, `Rerun Last`, `Run again`, or `Open Outputs`.

**Shared badge/chip usage rule**
- Every surface gets **one primary terminal badge/chip only**.
- Badge text must be the canonical state title only: `Completed`, `Failed`, or `Cancelled`.
- Do not use mood words or derived labels in the chip, like `Preview ready`, `Failure`, `Signal flagged`, `Execution stopped`.
- Detail text below/next to the chip carries the reason line.
- Color may vary by theme, but semantics must not:
  - Completed = success tone
  - Failed = danger tone
  - Cancelled = warning/neutral-stop tone

**Any conflicts with current wording**
Main conflicts I found:

- **Completed conflicts**
  - `Preview ready`
  - `Signal resolved`
  - `Review output` is already good, but completion title varies by surface
  - `Open Outputs` vs `Open Output Folder`

- **Failed conflicts**
  - `Execution failed`
  - `Failure`
  - `Signal flagged`
  - `Render failed`
  - `Shot render failed`
  - `Failed at ...`
  - `Regenerate Scene`
  - `Retry`
  - `Retry failed latest attempt`

- **Cancelled conflicts**
  - `Execution cancelled`
  - `Execution stopped.`
  - `Signal stopped`
  - `Inspect cancelled run`
  - `Retry cancelled run`

- **Action vocabulary conflicts**
  - `Retry`
  - `Retry Latest Attempt`
  - `Retry failed latest attempt`
  - `Retry cancelled run`
  - `Re-run Scene`
  - `Regenerate Scene`
  - `Rerun Last`
  - `Open Outputs`
  - `Open Output Folder`

- **Badge/chip conflicts**
  - chips currently show things like `Failure`, `Preview ready`, `cancelled`, and other derived labels instead of one stable title system

**Minimal application plan**

### Preview
- Replace terminal chip text with canonical titles only
- Replace terminal CTA labels with:
  - Completed → `Review Output`
  - Failed/Cancelled → `Retry Latest Attempt`
- Keep detailed error text, but normalize the first short reason line to canonical grammar

### Live Runs
- Keep lane logic as-is
- Normalize selected run terminal labels:
  - title/badge = canonical state title
  - summary line = canonical short reason line
  - actions use canonical labels only
- Replace `Open Outputs` with `Open Output Folder`

### Family
- Use the same terminal badge titles on lineage cards and selected family detail
- Normalize next-family recovery action to `Retry Latest Attempt`
- Keep lineage concepts like winner/approved/replacement separate from terminal-state grammar

### Selected Job
- Make terminal state the top-level title language:
  - `Completed`, `Failed`, `Cancelled`
- Normalize action resolver output:
  - remove `Retry cancelled run`
  - remove `Inspect cancelled run` as terminal primary language
  - use `Retry Latest Attempt` or fallback to `Open Manifest`
- Keep failure stage detail as diagnostic subtext, not the state title

**Recommendation**
Use this as the canonical spec:

- state titles are nouns/adjectives: `Completed`, `Failed`, `Cancelled`
- reason lines are short neutral sentences
- actions are operator verbs, fixed across all surfaces
- chips only show terminal state, never interpretation

Copy/paste prompt:
`Apply the DirectorOS terminal-state grammar exactly: Completed / Failed / Cancelled, with canonical actions Review Output, Retry Latest Attempt, Open Output Folder, Open Manifest, and one shared badge rule across Preview, Live Runs, Family, and Selected Job.`

File-safe naming:
`directoros-terminal-state-grammar-v1`
