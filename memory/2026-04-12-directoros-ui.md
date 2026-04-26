# Session: 2026-04-12 16:15:40 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 9a8eebee-8f76-4d81-94fa-5efc2825eab7
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Sunday, April 12th, 2026 - 7:11 PM (Africa/Nairobi) / 2026-04-12 16:11 UTC
assistant: [[reply_to_current]] Solvi here 🎬, ready in the DirectorOS control room, fast and clean. What do you want to shape or fix first, Mike?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 19:11 GMT+3] DirectorOS local UI/product pass: interaction feel + operator speed.

Goal:
Make the fastest operator move immediately obvious.

Focus:
- one visually dominant primary action per state
- demote secondary/support actions
- reduce explanatory copy where it slows action
- improve scan speed and emphasis
- sharpen “see state → act” flow

Target surfaces:
- src/components/layout/CenterWorkspace.tsx
- src/components/layout/RightInspector.tsx
- src/components/layout/TopBar.tsx

Constraints:
- preserve all logic
- preserve locked terminal-state language
- no queue/runtime/hydration/selection/focus changes
- no backend/data-shape changes
- no new features unless a tiny local UI affordance is clearly justified

Priorities:
1. CenterWorkspace: primary vs secondary action emphasis, especially Selected Job and family sections
2. RightInspector: reduce Decision-tab scan drag and make the actionable line lead
3. TopBar: strengthen active/working-status signal without adding noise

First report:
- 2-line audit summary
- exact mismatch map by surface
- exact smallest patch strategy
- exact files to change
- next 3 actions
assistant: I’m auditing the three target surfaces now, then I’ll give you the mismatch map and smallest safe patch path before touching anything.
assistant: [[reply_to_current]] 2-line session summary  
Current operator surfaces already contain the right controls, but action hierarchy is too flat, especially in Selected Job and Decision views.  
Fastest move is being diluted by low-contrast primaries, repeated context blocks, and support actions visually competing with the next executable step.

Exact mismatch map by surface

1. `src/components/layout/CenterWorkspace.tsx`
- `Selected Job` block has the right decision data, but the actual primary action is visually too similar to surrounding controls.
- `Primary Action` section is too small and understated relative to the amount of adjacent metadata.
- `Secondary Actions` reads like another action tier, not a demoted support tray.
- Family state area is decent structurally, but “Next move” is still subordinate to supporting evidence controls.
- Result: operator has to read before acting, instead of seeing the move first.

2. `src/components/layout/RightInspector.tsx`
- Decision tab starts with dense lifecycle/context rows before the handoff action, so scan path is backwards.
- “Decision Handoff” exists, but it lands too low and competes with too much repeated context.
- Secondary actions are verbose and uniformly styled, which slows picking.
- There is duplicated explanatory context across lifecycle, lineage, output context, and selection focus.
- Result: actionable line does not lead, and decision scanning drags.

3. `src/components/layout/TopBar.tsx`
- Active/working signal is present, but weakly staged.
- “System Ready” is too generic relative to actual stream/runtime state.
- Working-state emphasis does not step up enough when reconnecting/offline/live updates matter.
- Result: top bar informs, but does not quickly signal “safe / live / degraded” at a glance.

Exact smallest patch strategy
- Reweight hierarchy only, no logic changes.
- In `CenterWorkspace`, enlarge and visually elevate the single primary action, compress/demote secondary controls into a quieter support row, and tighten decision copy so the next move leads.
- In `RightInspector`, move the handoff card to the top of the Decision tab, trim duplicated support copy, and convert secondary actions into a quieter utility stack.
- In `TopBar`, strengthen live/degraded status contrast and make the working signal more immediate through label/tone/layout emphasis only.

Exact files to change
- `src/components/layout/CenterWorkspace.tsx`
- `src/components/layout/RightInspector.tsx`
- `src/components/layout/TopBar.tsx`

Next 3 actions
1. Patch `CenterWorkspace.tsx` for dominant primary-action hierarchy and quieter support controls.
2. Patch `RightInspector.tsx` Decision tab so the actionable handoff line leads the scan.
3. Patch `TopBar.tsx` for stronger live/degraded status readability, then do a quick visual pass for hierarchy consistency.

Copy/paste prompt  
“Apply a UI-only operator-speed pass across CenterWorkspace, RightInspector, and TopBar. Preserve logic and locked terminal-state language. Make one primary action per state visually dominant, demote support actions, reduce decision-tab scan drag, and strengthen live/degraded status signal without adding noise.”

File-safe naming  
`operator-speed-ui-pass-2026-04-12`
