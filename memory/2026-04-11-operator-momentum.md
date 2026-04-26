# Session: 2026-04-11 18:32:29 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 518f8bba-57bb-4e71-9861-5f184c99bc68
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Saturday, April 11th, 2026 - 9:30 PM (Africa/Nairobi) / 2026-04-11 18:30 UTC
assistant: [[reply_to_current]] Solvi here 🎬 Calm control room, clean slate, ready to move. What do you want to do in DirectorOS?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sat 2026-04-11 21:30 GMT+3] Phase 3B Pass B is locked green.

System state:
- Family actions emit local inline receipts only
- No duplicate feedback surfaces
- Family anchoring is explicit and stable
- Next-move guidance is quiet and adjacent
- Selected-job behavior untouched

We are now entering Phase 3C: Operator Momentum Layer.

Goal:
Increase operator speed, reduce hesitation, and make actions feel immediate and obvious.

Start with:
1. Inline next-action buttons inside family receipts
2. Instant click acknowledgment (pre-async feedback)
3. Focus gravity on active family context

Do not modify lineage, state authority, or cross-surface logic.

Proceed with scoped implementation plan.
assistant: I’m mapping the current control surfaces first, then I’ll turn this into a tight Phase 3C plan with exact touchpoints.
assistant: I found the state anchors in App, now I’m locating the receipt UI and family-focus touchpoints so the Phase 3C plan stays scoped and exact.
assistant: [[reply_to_current]]  
Session summary: Phase 3B is stable and the Phase 3C entry points are clear in the current workspace. The right insertion zone is the family-level decision surface plus the existing App focus/receipt state, without touching lineage or cross-surface authority.  

Next 3 actions:
1. Add family receipt CTA buttons inside the existing family receipt block only, wired to already-scoped family actions.
2. Add instant press-state acknowledgment before async action resolution, limited to receipt/action controls.
3. Add active-family focus gravity styling and auto-focus retention when a family becomes the current operating context.

Scoped implementation plan:
1. Inline next-action buttons inside family receipts
   - Touchpoints:
     - `src/components/layout/CenterWorkspace.tsx`
     - optional minimal prop expansion from `src/App.tsx`
   - Approach:
     - Extend `familyInlineActionReceipt` rendering from text-only to receipt + CTA row.
     - Use existing family handlers only:
       - `onFamilyOpenCurrentWinner`
       - `onFamilyOpenApprovedOutput`
       - `onFamilyRetryLatestAttempt`
       - `onFamilyInspectOutput`
       - `onFamilyJumpToReplacement` if already active in this surface
     - Map CTA set from receipt intent / `productionFamily.nextFamilyAction`, not from new authority logic.
   - Guardrail:
     - No lineage mutation logic changes.
     - No new cross-surface routing behavior.

2. Instant click acknowledgment (pre-async feedback)
   - Touchpoints:
     - `src/components/layout/CenterWorkspace.tsx`
     - possibly tiny local UI state only
   - Approach:
     - Add local “pressed/working” microstate per action button.
     - On click, immediately show:
       - pressed visual state
       - short inline cue like “Opening approved output…” / “Retry queued…”
     - Then call existing handler.
     - Clear state on timeout or next receipt refresh.
   - Guardrail:
     - UI-only optimism, not state-authority optimism.
     - Do not claim success before durable result.

3. Focus gravity on active family context
   - Touchpoints:
     - `src/components/layout/CenterWorkspace.tsx`
     - `src/App.tsx`
   - Approach:
     - Strengthen visual priority for the active family card/decision block:
       - brighter border/background
       - subtle anchor badge
       - local scroll-into-view / retained prominence when family is selected
     - Use existing `selectedFamilyRootId` as the sole focus anchor.
     - Preserve current selected-job behavior, only bias layout emphasis toward the active family container when no job drill-down is needed.
   - Guardrail:
     - No changes to `selectedJobId` semantics.
     - No changes to review authority, reconciliation, or selected-job control flow.

Recommended implementation order:
1. Family receipt CTAs
2. Instant click acknowledgment
3. Focus gravity styling and retention

Copy/paste prompt:
“Implement Phase 3C in DirectorOS with strict scope: upgrade family inline receipts into actionable receipt cards, add immediate pre-async click acknowledgment, and increase visual/focus gravity for the active family context using existing selectedFamilyRootId. Do not modify lineage, authority, selected-job semantics, or cross-surface logic.”

File-safe naming:
- `phase-3c-operator-momentum-layer`
- `phase-3c-family-receipt-cta-pass`
- `phase-3c-focus-gravity-pass`

If you want, I can start Pass C1 now and patch the receipt CTAs first.
