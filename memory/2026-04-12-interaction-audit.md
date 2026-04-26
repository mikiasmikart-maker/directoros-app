# Session: 2026-04-12 03:59:39 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: fc065adc-6208-423c-8a25-ce4856d591f1
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Sunday, April 12th, 2026 - 6:56 AM (Africa/Nairobi) / 2026-04-12 03:56 UTC
assistant: [[reply_to_current]] Morning, Mike, Solvi here 🎬 Sharp and ready in the DirectorOS control room. What do you want to move on first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 06:56 GMT+3] Run a DirectorOS cross-surface interaction-consistency audit for cancelled, failed, and completed across:
- preview
- selected-job
- family/decision
- Live Runs

Only report local UI/product mismatches in:
- wording
- hierarchy
- affordance
- spacing
- iconography
- emphasis
- chip/badge treatment
- action clarity

Ignore:
- queue
- runtime
- hydration
- selection
- focus
- backend/data-shape changes

Goal:
Make the four surfaces read like one intentional control surface, not four separately-correct interpretations.

First report:
- 2-line audit summary
- exact mismatch map by surface
- exact shared primitives/tokens involved
- whether a patch is needed
- minimal patch strategy
- next 3 actions
assistant: I’m tracing the four UI surfaces directly in the repo now, then I’ll map mismatches only at the local product layer.
assistant: [[reply_to_current]]1. The four surfaces are close on state truth, but they still read like separate dialects: Preview speaks lifecycle, Selected Job mixes lifecycle + review, Family speaks lineage/evidence, and Live Runs speaks ops triage.
2. Main mismatch is not data, it’s presentation grammar: the same cancelled/failed/completed outcomes change names, chip logic, action labels, and emphasis depending on where Mike is looking.

**Exact mismatch map by surface**

**Preview**
- **Wording**
  - Uses “Execution cancelled”, “Execution failed”, “Preview ready”, “Blocked before render start”, “Completed”.
  - Completion is framed as **preview availability**, not canonical run/result state.
  - Cancelled uses “Execution stopped” and “Signal stopped”, which does not match the other surfaces’ more direct lifecycle language.
- **Hierarchy**
  - Primary emphasis is lifecycle monitor first, decision/review second.
  - For completed, the state reads as visual-preview success more than operator outcome.
- **Affordance**
  - Only one main action, “Render Scene / Re-run Scene / Regenerate Scene”.
  - No matching direct next-step affordance language for cancelled vs failed vs completed beyond microcopy.
- **Spacing**
  - Very dense chip row and footer note, especially when status + authority + runtime cues stack.
- **Iconography**
  - Mostly pulse/dot semantics, no distinct icon treatment by terminal state.
- **Emphasis**
  - Strong visual emphasis on live state, weaker emphasis on decision consequence.
- **Chip/badge treatment**
  - Primary chip can switch between authority/failure/stage/focus, so terminal-state badge behavior is inconsistent.
- **Action clarity**
  - Failed says “Regenerate Scene”, completed says “Re-run Scene”, cancelled says relaunch in helper text only. Not a single shared action grammar.

**Selected-job**
- **Wording**
  - Uses “Lifecycle”, “Decision / Review”, “Primary Action”, “Secondary Actions”, “Failure Diagnostics”.
  - Mixes “Open Current Preview”, “Open Current Output”, “Open Approved Output”, “Inspect Output”, “Retry Latest Attempt”.
  - “Current Output” means winner in one place, file artifact in another.
- **Hierarchy**
  - Lifecycle block first, then decision block, then actions, then rails, then evidence.
  - For completed jobs, review actions dominate; for failed jobs, diagnostics dominate. Good locally, but inconsistent relative to Family/Live Runs.
- **Affordance**
  - Richest affordance surface, but labels drift from Family and Preview.
  - “Approve Output”, “Replace with Output”, “Finalize Shot” use review terminology not echoed in Preview/Live Runs.
- **Spacing**
  - Multiple stacked cards with similar weight, so “Primary Action” does not always visually outrank supporting detail.
- **Iconography**
  - Color-only differentiation, no terminal-state icon shorthand.
- **Emphasis**
  - Over-emphasizes review machinery versus simple terminal-state clarity.
- **Chip/badge treatment**
  - Lifecycle badge, rail badges, review badge all use different treatment levels.
- **Action clarity**
  - Strongest surface overall, but naming overlaps: preview/output/approved/current/replacement are not normalized.

**Family / decision**
- **Wording**
  - Uses “Production family selected”, “decision surface”, “family action rail”, “evidence”, “Current Winner”, “Approved Output”, “Replacement”.
  - Failed family state is implied via “Retry failed latest attempt”, but not always surfaced in the same direct terminal-state language as other surfaces.
- **Hierarchy**
  - Family-level abstraction first, specific job second. Correct, but the top message is instructional rather than state-led.
- **Affordance**
  - Actions are lineage-aware, but wording differs from Selected-job: “Open Current Winner” vs “Open Current Output”.
- **Spacing**
  - Evidence list, receipt, next move, compare pair all compete for attention in the same vertical block.
- **Iconography**
  - Evidence role badges exist, but no shared terminal-state iconography with Preview or Live Runs.
- **Emphasis**
  - Emphasis is on truth/evidence lineage, not terminal-state outcome. That makes completed/failed/cancelled feel indirect here.
- **Chip/badge treatment**
  - Evidence-role chips are semantic, while state chips are weaker or absent.
- **Action clarity**
  - Good for lineage operations, weaker for simple “what happened / what now” consistency.

**Live Runs**
- **Wording**
  - Uses lane terms “Active / Queued / Attention”.
  - Detail labels switch by state: cancelled gets “Cancellation Note / Next Step”; everything else gets “Failure Explain / Suggested Action”.
  - Completed currently gets the fallback non-completed language path, so it reads like neither success nor review-ready.
- **Hierarchy**
  - Lane first, selected run detail second. Good operationally.
  - Terminal-state meaning is subordinate to lane organization.
- **Affordance**
  - Actions are ops-oriented: “Open Outputs”, “Open Manifest”, “Escalate”, “Workspace”, “Command Console”.
  - No state-specific primary action treatment for completed vs failed vs cancelled.
- **Spacing**
  - Compact and readable, but selected detail panel is flatter than the richer workspace surfaces.
- **Iconography**
  - Mostly chip color, no shared visual grammar with workspace surfaces.
- **Emphasis**
  - Heavy ops emphasis, low decision/review emphasis.
- **Chip/badge treatment**
  - Canonical-state chip exists, but lane column color and state chip compete.
- **Action clarity**
  - Strong for ops inspection, weak for shared cross-surface next-step language.

**Exact shared primitives/tokens involved**
- **States**
  - `completed`, `failed`, `cancelled`
- **State labels / microcopy**
  - “Preview ready”
  - “Execution failed”
  - “Execution cancelled”
  - “Blocked before render start”
  - “Retry failed latest attempt”
  - “Open Approved Output”
  - “Open Current Output”
  - “Open Current Winner”
  - “Inspect Output”
  - “Decision / Review”
  - “Failure Diagnostics”
  - “Cancellation Note”
  - “Suggested Action”
  - “Next Step”
- **Visual tokens**
  - Emerald success treatment
  - Rose failure treatment
  - Orange/amber cancelled treatment
  - Cyan active/in-progress treatment
  - Rounded chips/badges with mixed border/background opacity patterns
  - Small uppercase labels at 9px, 10px, 11px with inconsistent tracking and weight
- **Concept primitives**
  - lifecycle state
  - review state
  - family truth / authority
  - evidence role
  - primary action / next action
  - artifact target: preview / output / approved output / winner / replacement

**Whether a patch is needed**
- **Yes.**
- Not for logic or state derivation, but for **shared UI language and emphasis normalization** across the four surfaces.

**Minimal patch strategy**
- Create one **shared terminal-state copy grammar** for `completed`, `failed`, `cancelled`:
  - shared title
  - shared short reason
  - shared next-step verb
- Normalize artifact/action naming:
  - choose one canonical pair, likely:
    - **Open Approved Output**
    - **Open Current Output**
    - **Open Replacement**
    - **Retry Latest Attempt**
    - **Inspect Output**
  - remove “Open Current Winner” from user-facing labels, keep winner as internal/family truth wording only.
- Normalize terminal-state chip treatment:
  - one badge tone set for completed/failed/cancelled across Preview, Selected-job, Live Runs.
- In Live Runs, add proper completed detail labels instead of falling through to failure-oriented copy.
- In Family surface, lead with **family state + next action** before evidence list/instructional text.
- Keep layout changes minimal, mostly wording, badge, and emphasis adjustments.

**Next 3 actions**
1. Define the shared terminal-state copy set and canonical action labels for completed, failed, cancelled.
2. Patch Preview, Family/Decision, and Live Runs to use the same labels, badge tones, and next-step grammar.
3. Re-audit Selected-job against the patched surfaces and tighten the remaining action naming drift.

**Copy/paste prompt**
- “Unify completed, failed, and cancelled language across Preview, Selected Job, Family, and Live Runs using one terminal-state grammar, one action-label set, and one badge treatment system. Keep logic unchanged.”

**File-safe naming**
- `directoros-cross-surface-state-consistency-audit-2026-04-12`
- `directoros-terminal-state-grammar-v1`
