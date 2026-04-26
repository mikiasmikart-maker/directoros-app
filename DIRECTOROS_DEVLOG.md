# DIRECTOROS_DEVLOG.md

## Milestone M1 — Live Render Operations
**Date:** 2026-03-17

### Key systems completed
- job-first architecture
- lifecycle + queue intelligence
- retry lineage
- scene production timeline
- live event streaming
- operator transport badge

### Status
stable baseline for next phase.

## Contract Lock — DirectorOS ↔ STUDIO_PIPELINE
**Date:** 2026-04-12

### Scope
- documentation and minimal structure only
- no behavior changes
- Phase 3F not started here

### Lock
- `STUDIO_PIPELINE` is the sole source of execution lifecycle truth
- `directoros-app` only reads, interprets, and presents that truth
- raw lifecycle states are locked to: `queued`, `preflight`, `running`, `packaging`, `completed`, `failed`, `cancelled`
- decision and review states remain a separate DirectorOS overlay layer

### Reference
- `docs/directoros_pipeline_contract_lock_mem_ok_v001.md`
