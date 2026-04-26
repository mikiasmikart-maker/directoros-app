# Session: 2026-04-11 22:35:13 UTC

- **Session Key**: agent:directoros_dev:main
- **Session ID**: 76a36ff6-1c28-48c7-8aca-252c46dd5c09
- **Source**: webchat

## Conversation Summary

user: A new session was started via /new or /reset. Run your Session Startup sequence - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.
Current time: Sunday, April 12th, 2026 - 1:31 AM (Africa/Nairobi) / 2026-04-11 22:31 UTC
assistant: [[reply_to_current]] Solvi here, Mike 🎬 Fast, clean control-room mode is up, and I’m ready to keep DirectorOS sharp and stable.

What do you want to do first?
user: Sender (untrusted metadata):
```json
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

[Sun 2026-04-12 01:32 GMT+3] Locate and define Phase 3G: Operator Attention and Signal Prioritization.

Context:
- Phase 3F Pass 1 and Pass 2.1 are locked and verified
- Lifecycle and transition signals are now correct and perceptible

Goal:
Prioritize signals so operators can immediately identify:
- what requires attention
- what can be ignored
- what is informational only

Without changing:
- lifecycle meaning
- lineage
- authority
- selection semantics
- queue behavior
- cross-surface behavior

Return:
1. chapter name
2. why it is the correct next step
3. target surfaces/files
4. guardrails to preserve 3C–3F
5. implementation order
6. one clean implementation prompt
assistant: [[reply_to_current]] **Session summary**  
Phase 3F is stable: lifecycle and transition signals are now accurate and perceptible.  
The next move is not new meaning, but visual and interaction-level triage so operators know what matters at a glance.

**Next 3 actions**  
1. Define a strict attention hierarchy above existing lifecycle signals  
2. Apply it only at presentation/emphasis layers, not state logic  
3. Validate across board, card, detail, and overlay surfaces for consistency

### 1. Chapter name
**Phase 3G: Operator Attention and Signal Prioritization**

### 2. Why it is the correct next step
3F made signals correct and visible.  
3G makes them **operationally legible under pressure** by ranking signal emphasis into attention-needed, ignorable/background, and informational-only, without changing the underlying system meaning.

### 3. Target surfaces/files
Focus on surfaces where operators scan, decide, and recover context fast:

- **Primary surfaces**
  - board / list cards
  - selected card state
  - detail or inspector panel
  - queue/status strips
  - badges, pills, labels, icons, pulse/glow treatments
  - empty/loading/error/system messaging blocks
  - toast or ephemeral notices, if present

- **Likely file targets**
  - `src/App.tsx`
  - components rendering job/render cards
  - status badge / chip / pill components
  - queue or render controller UI surfaces
  - selection/detail panel components
  - shared UI tokens for color, emphasis, opacity, borders, motion

### 4. Guardrails to preserve 3C–3F
- Do **not** change lifecycle definitions or status mapping
- Do **not** change lineage visibility or lineage logic
- Do **not** change authority/source-of-truth rules
- Do **not** change selection behavior or selected-card semantics
- Do **not** change queue ordering, queue state, or queue behavior
- Do **not** introduce cross-surface divergence in priority styling
- Do **not** encode new meaning into color/motion that conflicts with 3F
- Keep prioritization as a **presentation layer over existing truth**
- Prefer reducing noise over adding more signals
- Escalation should be driven by operator relevance, not visual decoration

### 5. Implementation order
1. **Audit current signals by surface**  
   Classify each visible signal as actionable, passive, or informational.

2. **Define attention tiers**  
   - Tier A: requires operator attention now  
   - Tier B: relevant but not urgent  
   - Tier C: informational/background only

3. **Map existing states to emphasis rules**  
   Use emphasis changes only: contrast, weight, scale, placement, motion restraint, persistence.

4. **Apply to high-scan surfaces first**  
   Board/list cards, queue strips, selected card.

5. **Normalize secondary surfaces**  
   Detail panel, toasts, supporting labels, empty/system states.

6. **Run preservation pass**  
   Confirm lifecycle meaning, lineage, authority, selection, and queue behavior remain untouched.

7. **Run noise-reduction pass**  
   Remove duplicate emphasis, competing badges, unnecessary pulse, or equal-weight signals.

### 6. One clean implementation prompt
**Prompt:**  
“Implement Phase 3G: Operator Attention and Signal Prioritization for DirectorOS. Build a presentation-only attention hierarchy that helps operators instantly distinguish (1) requires attention, (2) can be ignored for now, and (3) informational only. Do not change lifecycle meaning, lineage, authority, selection semantics, queue behavior, or cross-surface behavior. Audit all visible status/signal surfaces first, then apply a consistent priority system across cards, selected state, detail panels, queue strips, badges, and notices using restrained emphasis changes only (contrast, weight, placement, persistence, motion). Reduce noise, prevent competing signals, and preserve all 3C–3F logic exactly.”

**File-safe name**  
`phase-3g-operator-attention-and-signal-prioritization.md`
