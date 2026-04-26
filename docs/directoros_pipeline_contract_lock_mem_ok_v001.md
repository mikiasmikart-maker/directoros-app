# DirectorOS ↔ STUDIO_PIPELINE Contract Lock

## Purpose

This note locks the boundary between `directoros-app` and `STUDIO_PIPELINE` before any lifecycle visibility work continues.

The goal is to prevent semantic drift.
This is a documentation and structure lock only.
No runtime behavior changes are introduced here.

---

## Boundary Rule

`STUDIO_PIPELINE` is the sole source of execution lifecycle truth.

`directoros-app` may only:
- read pipeline truth
- interpret pipeline truth for operator clarity
- present pipeline truth in the UI

`directoros-app` must not:
- invent execution lifecycle states
- redefine execution lifecycle meaning
- promote UI wording into new runtime truth
- treat review or decision state as execution state

---

## Locked Execution Lifecycle Contract

The raw execution lifecycle states are:
- `queued`
- `preflight`
- `running`
- `packaging`
- `completed`
- `failed`
- `cancelled`

These states come from pipeline truth, including pipeline runtime and manifests.
They are not UI-authored states.

Presentation helpers in `directoros-app` may normalize labels, helper text, and visual tone, but they must not change the underlying lifecycle meaning.

---

## Layer Separation

### 1. Execution lifecycle layer
This layer represents pipeline truth.
It answers:
- what execution is doing now
- what stage the run is in
- whether execution completed, failed, or was cancelled

Authority: `STUDIO_PIPELINE`

### 2. Decision / review overlay layer
This layer represents DirectorOS interpretation and operator decision context.
It includes concepts such as:
- best known
- approved
- needs revision
- rejected
- superseded
- finalized

Authority: `directoros-app`

These overlay states must remain secondary to execution lifecycle.
They must not replace, mutate, or masquerade as raw execution lifecycle.

---

## Presentation Rules

1. Primary lifecycle line = execution lifecycle truth.
2. Secondary lifecycle line = decision or review overlay.
3. `preflight` must remain visible as its own execution state.
4. `cancelled` must remain visible as its own execution state.
5. UI copy may clarify pipeline truth, but may not create new lifecycle semantics.
6. If a surface shows a lifecycle label, it must derive from pipeline truth, not local UI invention.

---

## Explicit Non-Changes

This contract lock does not change:
- runtime logic
- lifecycle derivation
- queue behavior
- API endpoints
- review logic
- selection semantics
- cross-surface behavior
- Phase 3F implementation scope

This note is a boundary lock only.

---

## Safe Usage Inside DirectorOS

Allowed:
- shared lifecycle presentation helpers
- canonical labels for pipeline-provided states
- helper text that explains the current pipeline stage
- visual styling by lifecycle tone

Not allowed:
- adding new execution states in UI without pipeline support
- collapsing distinct raw pipeline states into one semantic truth
- using review state as the primary execution status
- beginning Phase 3F behavior work from this document alone

---

## Working Rule for Future Patches

Any lifecycle visibility patch must pass this check:

- Does it preserve `STUDIO_PIPELINE` as execution truth authority?
- Does it keep DirectorOS review/decision state as a separate overlay?
- Does it avoid runtime, endpoint, and derivation changes?

If any answer is no, the patch is out of contract.
