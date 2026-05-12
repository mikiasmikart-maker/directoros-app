# DirectorOS Visual System Audit

This document provides a comprehensive visual system audit across the normalized DirectorOS screens (SCR01, SCR02, SCR04, SCR05, SCR06) and the remaining legacy-styled SCR03 Workspace. The goal is to identify cross-screen visual imbalances and plan the final normalization pass for SCR03 without modifying runtime logic or graph behavior.

## User Review Required
Please review the findings and the proposed sequencing for the SCR03 visual normalization phase. This plan focuses strictly on token migration and typographic alignment. No functional logic or graph mechanisms will be altered.

## System Audit Hotspots (PASS/WARN)

### PASS: Normalized Surfaces
- **SCR01 Control Room:** `PASS`
  - Consistently applies `dos-panel`, `dos-border`, and `dos-text-*` tokens.
  - Strict typographic hierarchy (`text-[10px]`, `tracking-widest`, `uppercase`) for structural labels.
  - Signal colors (`dos-sig-trust`, `dos-sig-warning`) applied with appropriate opacity restraint.
- **SCR02 Live Runs:** `PASS`
  - Predictable lane backgrounds (`bg-dos-panel/10`, `bg-dos-panel/20`).
  - Strict border definitions ensuring clean visual rhythm.
  - Action buttons map cleanly to `dos` signals.
- **SCR04 Console:** `PASS`
  - Excellent use of constitutional charcoal context panels.
  - Command execution surfaces feel operational and un-opinionated.
- **SCR05 Intervention Queue:** `PASS`
  - Quiet interface highlighting urgent items gracefully through controlled token opacity (`bg-dos-sig-warning/8`).
- **SCR06 Audit:** `PASS`
  - Append-only event stream utilizes restrained charcoal coloring (`bg-dos-panel/45`) and muted typography.

### WARN: Legacy Surfaces (SCR03 Workspace)
- **CenterWorkspace.tsx:** `WARN`
  - **Glow Intensity:** Employs heavy legacy glows (`shadow-[0_4px_16px_rgba(34,211,238,0.12)]`, `shadow-[0_12px_32px_rgba(2,6,23,0.18)]`) contrary to the new flat, charcoal baseline.
  - **Legacy Tokens:** Rampant use of base Tailwind colors (`slate-500`, `rose-500`, `amber-500`, `cyan-500`, `indigo-500`) instead of semantic `dos-*` or `dos-sig-*` registries.
  - **Hardcoded Gradients:** Retains legacy gradients (`linear-gradient(180deg,rgba(25,25,25,0.72)...)`) instead of flat `bg-dos-panel` opacity utility classes.
- **RenderPreview.tsx:** `WARN`
  - **CTA Aggression:** The primary render action button is aggressively purple (`bg-[#8144C0]`) with intense padding, heavy glow (`shadow-[0_0_20px_rgba(129,68,192,0.2)]`), and loud borders.
  - **Typography Dominance:** Scene title/prompt preview text is `text-5xl lg:text-6xl font-bold text-white drop-shadow-xl`, vastly overpowering surrounding operational metadata (which sits at `10px`).
  - **Hardcoded Accents:** Left-rail border indicator uses `#8144C0` directly.

## Prioritized Cohesion Issues

1. **CTA / Button Saturation (SCR03)**
   - The purple `#8144C0` Render CTA disrupts the calm visual rhythm established by the other 5 screens. It needs to be migrated to a `dos-sig-continuity` or `dos-sig-runtime` equivalent with flattened shadows and quieter borders.
2. **Typography Hierarchy Imbalance (SCR03)**
   - Prompt/Scene title text in `RenderPreview` is massive (`6xl`) and glowing (`drop-shadow-xl`). It must be restrained—lowering weight, decreasing scale to a more operational `xl` or `2xl`, and utilizing `dos-text/90` to remove the intense contrast.
3. **Glow Intensity and Overlay Fog (SCR03)**
   - Shadows and intense glowing active states (e.g., `shadow-[0_0_8px_...]`) within the workspace cards (Next Move, Active Jobs, Output Previews) violate the constitutional charcoal aesthetic. 
4. **Token Migration Gap (SCR03)**
   - Absolute references to Tailwind `slate-*`, `rose-*`, and `cyan-*` need to be swapped to `dos-text-muted`, `dos-sig-warning`, `dos-sig-trust`, and `dos-sig-runtime`.

## Recommended Sequencing for SCR03 Phases

To safely reconcile the Workspace without disturbing the `STUDIO_PIPELINE` or `SceneGraphCanvas`, the following phased sequence is recommended:

### Phase 1: CTA and Typography Normalization (`RenderPreview.tsx`)
- Flatten the purple `#8144C0` CTA button: replace hardcoded colors and shadows with `dos-sig-continuity` semantic utilities.
- Compress the Prompt text size: reduce `text-5xl`/`text-6xl` to `text-2xl` or `text-3xl`, strip `drop-shadow-xl`, and apply `text-dos-text/90`.
- Replace inline hex codes with `dos-border` and `dos-bg/40` classes.

### Phase 2: Token and Shadow Migration (`CenterWorkspace.tsx` Part 1)
- Strip all `shadow-[...]` classes representing legacy glow from cards, panels, and active states.
- Replace hardcoded background gradients (e.g., `bg-[linear-gradient(...)]`) with `bg-dos-panel/40` or appropriate opacity variations.
- Adopt `border-dos-border` consistently.

### Phase 3: Signal Tone Normalization (`CenterWorkspace.tsx` Part 2)
- Map legacy Tailwind base colors to semantic signals:
  - `slate-400`/`slate-500` -> `dos-text-muted`
  - `cyan-500` -> `dos-sig-trust` or `dos-sig-continuity`
  - `rose-500` -> `dos-sig-warning` (or `m6-state-critical` if appropriate)
  - `amber-500` -> `dos-sig-drift`
- Ensure operator presence and conflict badges align with the subdued opacity paradigm seen in `SCR05` and `SCR01`.

## Conclusion
Executing these 3 focused visual phases will bring SCR03 Workspace fully into alignment with the system-wide constitutional charcoal aesthetic, achieving the unified operational system goal.
