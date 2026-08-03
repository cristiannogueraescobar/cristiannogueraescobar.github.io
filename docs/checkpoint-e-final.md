# Checkpoint E — Final summary

Status: Checkpoint E implementation complete; pending Windows/Node 24 validation, CI, merge and production verification.

Base commit: `2832526220e79d3b278497219b030b95c3d6d8dd`. Branch: `refactor/single-engine`.

## What Checkpoint E achieved

Checkpoint E consolidated the Plumline optimisation engine to a single editable
mathematical source and hardened the test surface around it, phase by phase:

- E0 — baseline: pinned the pre-E engine, the Worker execution contracts and the hand-maintained add-on twin.
- E1 — canonical source: made `engine/source/plumline-engine.js` the one editable engine, composed verbatim into the solver and sliced by the Worker.
- E2 — parser, validation, linearization.
- E3 — model construction and continuous simplex.
- E4 — integer branch-and-bound.
- E5 — verification statuses and errors (with characterised defects D-E5-1 and D-E5-2).
- E6 — single editable source, Worker/mirror consolidation: turned `engine/engine.js` into a deterministic generated artefact, formalised the Worker/direct/fallback integration, reconciled the historical fixtures, and produced the verified overlay.

## Totals

- main pre-E: 10231
- post-E0: 10267
- post-E1: 10450
- post-E2: 10630
- post-E3 (deterministic): 10849
- post-E4 (deterministic): 11099
- post-E5 (deterministic): 11392
- post-E6: see `docs/checkpoint-e6-worker-mirror-final.md` and the final `npm run verify` output.

## Single-engine architecture (final)

- One editable mathematical source: `engine/source/plumline-engine.js`.
- One generated Node/add-on mirror: `engine/engine.js`, derived by `engine/generate-engine-mirror.js` from the canonical source plus the two approved platform adaptations declared in `engine/source/engine-platform-adapter.json`.
- Direct and Worker execution use the same canonical bytes; the main-thread fallback uses the same composed canonical scope.

## Key SHAs

- Canonical engine: `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`.
- Old hand-maintained mirror: `6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa`.
- Generated mirror: `faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`.
- Generator: `c563560df07dcd7ce0b30ac5d75351febfdcee5fddeebc4895c70accf89b35b6`.
- Adapter: `3e592a8e8452fec480539023c3bbb022ec076e301eb1dd4b92f11810769a2935`.
- dist/solver.html: `4dbf1a8abe8498aa03d7620ad7f8043b646f914f38203906e483a8ca7f6514b4`.

## How to edit the engine

1. Edit `engine/source/plumline-engine.js`.
2. Run `npm run generate:engine-mirror` to regenerate `engine/engine.js`.
3. Run `npm run verify` (checks freshness, never regenerates) and `npm run build`.

To add a platform adaptation, extend `engine/source/engine-platform-adapter.json`
and the generator, keeping each transformation to exactly one match; the checker
fails on a third divergence or a widened scope.

## Rollback

- Rollback E6: restore the hand-maintained mirror, remove the generator/adapter/E6 fixture/E6 suites, revert the historical-fixture refactors.
- Rollback the whole Checkpoint E: return to base commit `2832526220e79d3b278497219b030b95c3d6d8dd`.

## Pending

Windows/Node v24.15.0 validation, CI, merge and production verification.
