# MIKART DirectorOS Phase 02 — Scene Memory + Prompt Compiler

Milestone: `mikart_directoros_phase02_scene_memory_v001`

## What was added

- Scene Memory profile system with reusable profiles:
  - Categories: `character`, `product`, `environment`, `lighting`, `camera`
  - Profile schema: `id`, `name`, `category`, `summary`, `tags?`, `sourceType`, `parameters`
- Scene model upgrades:
  - `memoryBindings` for profile ID references
  - `localOverrides` for scene-local values/summary
- Prompt compiler rebuilt to merge inputs from:
  1. Scene metadata
  2. Bound memory profiles
  3. Manual inspector overrides
  4. Selected timeline clip override data
  5. Selected engine target
- Engine routing foundation (`auto`, `flux`, `veo`, `runway`) as local formatting strategy only.
- Inspector upgrades:
  - Engine target selector
  - Profile binding section
  - Editable override fields with source status (`scene`, `memory`, `manual`, `mixed`, `timeline`)
- Prompt preview upgrades:
  - `Compiled Prompt` mode
  - `Engine Payload` JSON mode
- Timeline semantic integration:
  - Selected clip now contributes emphasis, override note, motion behavior, and override params.

## Data flow

1. UI selection state identifies active scene + clip + engine target.
2. Scene memory bindings are resolved through `memoryProfilesById`.
3. Compiler merge order (later wins):
   - memory params → scene params → scene local overrides → inspector manual overrides → timeline override params
4. Compiler computes field source attribution (`memory/manual/mixed/...`).
5. Engine formatter injects target-specific wording + hint strategy.
6. Output emitted as:
   - Human-readable compiled cinematic prompt
   - Structured payload object for downstream engine adapters.

## Notes

- No external API/auth/backend calls introduced.
- Timeline visuals remain unchanged; semantic contribution is now included during compilation.
