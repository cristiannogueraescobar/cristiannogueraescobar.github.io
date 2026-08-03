# Checkpoint E6 — Single editable engine source, Worker integration and mirror reconciliation

Status: Checkpoint E implementation complete; pending Windows/Node 24 validation, CI, merge and production verification.

## Goal

Close Checkpoint E by consolidating the engine to a single editable mathematical
source, turning the Node/add-on twin `engine/engine.js` into a deterministic
generated artefact, formalising the Worker/direct/fallback integration, and
producing a verified overlay for the whole checkpoint. E6 changes no mathematics,
no algorithm, no tolerance, no status, no stop reason, no error, no translation
and no UI. The public web output stays byte-identical.

## Single editable source

- Editable mathematical source: `engine/source/plumline-engine.js` (the canonical engine).
- Editable adapter authority: `engine/generate-engine-mirror.js` (the generator) and `engine/source/engine-platform-adapter.json` (the platform-adaptation manifest).
- Generated artefact: `engine/engine.js` (the Node/add-on mirror). It carries a `GENERATED FILE — DO NOT EDIT MANUALLY` banner naming the canonical source and the regeneration command.

No developer synchronises two engines. Editing the mirror by hand, or leaving it
stale, is caught by the freshness guard.

## Canonical engine (unchanged)

- Path: `engine/source/plumline-engine.js`
- 82657 characters, 82697 bytes UTF-8, LF
- SHA-256: `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`

E6 does not modify the canonical engine.

## Mirror: from hand-maintained to generated

- Old hand-maintained mirror: 90220 bytes, SHA-256 `6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa`.
- New generated mirror: 84242 bytes, SHA-256 `faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`, LF, UTF-8.

### Why the byte representation changed

The old mirror carried independently-authored add-on comments in 11 functions
(about 4583 bytes of comment divergence, e.g. `detectModel_` alone differed by
2046 characters). Deriving those exact comments from the canonical source was not
maintainable, so the generated mirror inherits the canonical comments and the
generated banner instead. Only comments, the banner and the wrapper differ; the
mathematics is identical. Byte-identity with the old mirror was therefore not
maintainable, and the approved path (a new SHA plus demonstrated equivalence) was
taken.

### Equivalence

- Structural: 89 top-level declarations in both (90 total including `dotProduct_`, which is declared in two scopes; 89 unique names). 88 comparable top-level functions by name. 86 are byte-exact common mathematical bodies; 2 are the intentionally platform-adapted functions.
- Functional: `solveModel_` produces identical results (elapsedMs excluded) across continuous, integer, infeasible and multi-constraint cases.
- Exports: the same 20 exports in the same order.

The correct statement is: 86 common mathematical bodies are equivalent, 2
functions are intentionally platform-adapted, and the wrapper/API differences are
non-mathematical. It is NOT "88/88 identical".

## Generator

- Path: `engine/generate-engine-mirror.js`, 5938 bytes, SHA-256 `c563560df07dcd7ce0b30ac5d75351febfdcee5fddeebc4895c70accf89b35b6`.
- Reads only the canonical source and the adapter manifest.
- Applies exactly two transformations, each requiring exactly one match.
- Adds the generated banner, the add-on header and the IIFE + CommonJS/global wrapper with 20 exports.
- Deterministic: LF, UTF-8, no timestamps, no absolute paths, no environment data, no network, no dist, no solver.html, no engine execution during generation.
- Atomic write (temp file + rename), cleanup on error, no partial files.
- Fails specifically on: missing canonical, missing adapter, zero matches, multiple matches, unexpected signature/structure, a third adaptation, or a changed constant.

Regenerate with the single explicit write command: `npm run generate:engine-mirror`.
`npm run verify` only checks that the mirror is fresh; it never rewrites it.

## Platform adapter (two approved divergences)

- Path: `engine/source/engine-platform-adapter.json`, 6266 bytes, SHA-256 `3e592a8e8452fec480539023c3bbb022ec076e301eb1dd4b92f11810769a2935`.

### A1 — newContext_

- Canonical: `newContext_(grid, variables)`, `allowCachedFormulaFallback: false` fixed. On the web every formula's stored value is 0, so folding an unsupported formula to its cached value would inject a false 0; the web build always forbids the fallback.
- Mirror: `newContext_(grid, variables, options)`, `allowCachedFormulaFallback: !(options && options.allowCachedFormulaFallback === false)`. In the add-on the cached value is exact, so the fallback is safe and allowed by default.
- Consumer: the add-on formula-limit evaluation. Approved.

### A2 — readConstraint_

- Canonical: combined guard `if (limitFormula !== null && variables)`.
- Mirror: nested guard `if (limitFormula !== null) { if (variables) { ... } }`. Behaviourally identical; the add-on keeps the structure split. No result, error, field or value changes. Approved.

The checker fails if a third divergence appears, if an adaptation touches another
function, changes a constant, an operator, a call, a return, an export, or the
wrapper outside the contract.

## Historical-fixture policy

Each phase fixture describes its own phase. E0 describes the pre-E baseline; E1-E5
describe their phase; only E6 records the transition from the hand-maintained
mirror to the generated mirror.

- E0 keeps the historical mirror (6190cb47, 90220 bytes) and was restored byte-identical (self-SHA `b174a9e5...`).
- E1, E2 have no mirror-current-state pin (not applicable).
- E3, E4, E5 keep the historical mirror SHA (6190cb47) for their phase.
- E6 is the only fixture whose current mirror is the generated new mirror.

Enforcement: the E6 checker asserts E0/E3/E4/E5 keep the historical SHA and never
the E6 SHA; negatives N54/N55 fail if a historical fixture is rewritten to adopt
the E6 mirror.

## Direct, Worker and fallback

- Direct and Worker use the same canonical bytes. The Worker's `engineSource()` scans the page scripts for `/* ENGINE_START */`..`/* ENGINE_END */` and returns `txt.slice(a, b)` — including ENGINE_START, excluding ENGINE_END — exactly the canonical bytes.
- Fallback `runSolve()` calls `detectModel_`/`solveModel_` from the same composed canonical scope, never `engine/engine.js`.
- None of them use the generator or the adapter, none fetch, none add a request.

Worker byte contracts (from the E1 fixture):

- engineSource: 82697 bytes, SHA-256 `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`.
- separator: one LF (0x0a), count 1, at offset 82697.
- glue: 900 bytes, SHA-256 `5bc80049a8575056596b834e45e46b338ae38e095d5abfc2072175d40ab9b7b9`.
- Blob: 83598 bytes (82697 + 1 + 900), SHA-256 `ec3d60685850dfa5fc43d7a79b0e60028dd7264303734cf7d9cf45413b0e3a05`.

### Protocol

- Request: `token`, `formulas`, `values`, `localeMode`, `wholeNumbers`, `domains`, `sense`.
- Response success: `token`, `ok: true`, `out`, `wholeNumbers`.
- Response error: `token`, `ok: false`, `phase`, `error` (phase is `read` when `detectModel_` threw, otherwise `solve`).

### Token, stale and lifecycle

- `workerToken` starts at 0; each solve does `myToken = ++workerToken`.
- `onmessage` ignores a response whose token differs from the global `workerToken`; `onerror` compares `myToken !== workerToken`. A stale response does not set the result, announce, plot, export, or replace the current error.
- Lifecycle: `Blob([src + '\n' + glue], {type:'application/javascript'})`, `URL.createObjectURL`, `new Worker`, `URL.revokeObjectURL` immediately; success clears `workerBusy`; error terminates; cancel/replace bumps the token, terminates and nulls `engineWorker` to rebuild.

### Errors and localization

The mathematical result is a field on `out` (a status). A technical engine error
is thrown and surfaced as `{ok:false, phase, error}` (Worker) or caught in
`runSolve` (fallback). An infrastructure error (Worker/Blob/postMessage/onerror)
is distinct and sets `engineWorker=false` or terminates. `localizeEngineError`
stays in the UI layer and is reached on the Worker error path, the fallback path
and solve; the engine never localizes. E6 moves no error text or translation into
the engine.

## Suite authorities

- Canonical harness (`canonical-engine-harness.js`): common mathematical logic — the E1-E5 canonical suites.
- Generated-mirror harness (`engine/harness.js`, now documented as "Compatibility harness for the generated engine mirror"): standalone add-on artefact and API compatibility — tests_states, tests_safety, tests_bounds, tests_single_var, tests_strict, tests_sumif_criteria, tests_locale, tests_grid_input.
- composedHtml: web integration — tests_direction, tests_examples, tests_panel.
- Worker source: tests_worker_parity, tests_worker_token.
- UI/jsdom: tests_error_i18n, tests_solve_announce.

No suite depends on a second editable mathematical source. No suite contains a
manual maths copy. Migrated 0, split 0; the status-bearing legacy suites are
retained as generated-mirror compatibility coverage (their maths traces to the
single canonical source through the derived mirror). No case lost, no PASSED lost,
no expected changed.

## Tests

- Checker `checkSingleEngineWorkerAndMirror` (`tests_e6_worker_mirror.js`): 64.
- Positive (`tests_e6_worker_mirror_positive.js`): 27.
- Negative (`tests_e6_worker_mirror_negative.js`): 55 (N1-N55, including N54/N55 for the historical-fixture policy).
- Needle auditor (`tests_e6_needle_audit.js`): 126.

## Allowlist and dist independence

`RAW_SOURCE_ALLOWLIST` stays at 18 (unchanged from post-E5). No E6 suite,
generator, adapter, fixture or harness is added. The battery is identical with and
without dist (11664). No E0-E6 checker depends on dist. `validate_dist` confirms
dist equals the composed source and that the canonical source, mirror, generator,
adapter and fixtures are never published, with no `SOLVER_ENGINE_SOURCE` marker,
six requests, and manifest/requiredPaths intact.

## Public output (unchanged)

- Recomposed solver source: 123556 bytes.
- Composed solver: 215539 bytes.
- dist/solver.html: 218349 bytes, SHA-256 `4dbf1a8abe8498aa03d7620ad7f8043b646f914f38203906e483a8ca7f6514b4`.
- Six requests, five languages, Worker parity 143, Worker token 6, engine integrity 3.

The mirror change does not affect production: the Worker uses `engineSource`
sliced from the canonical engine, not the mirror.

## Rollback

- Rollback E6: restore the hand-maintained `engine/engine.js` (6190cb47), remove the generator, adapter, E6 fixture and E6 suites, and revert the historical-fixture refactors. The canonical source and public output are unaffected.
- Rollback the whole Checkpoint E: return to base commit `2832526220e79d3b278497219b030b95c3d6d8dd`.

## Carried-over characterisations

- D-E5-1: `explainStatus_` has a dead branch for a status the engine never produces (characterised, not fixed).
- D-E5-2: a limit without an incumbent maps to `unknown` with `optimalityProven` false; `solveModel_` preserves the stop reason (characterised, not fixed).

## Limitations

Validated on Linux, Node v22.22.2. Windows, Node v24.15.0, real-browser and visual
validation, CI, merge and production verification are pending.
