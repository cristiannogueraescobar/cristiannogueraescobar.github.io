# Checkpoint E0 — single-engine baseline

Baseline, inventory and architecture map for Checkpoint E (single canonical
engine). E0 changes **no engine byte, no public output, no Worker payload**. It
only measures the current state and proposes the E1–E6 roadmap.

## Environment and base state

- Git: **no `.git` in this environment** — base SHA is **pending user
  verification**; no branch was created and none is simulated. On a real
  checkout, branch `refactor/single-engine` should be cut from the merged
  Checkpoint D `main`.
- Node here: **v22.22.2** (official environment is v24.15.0).
- OS here: Linux.
- `rm -rf dist; npm ci; npm run verify; npm run build; npm run verify` →
  both verify runs **10230**, VERIFY ALL GREEN, VALIDATE DIST OK, DIST HTTP OK.
- The spec's approved figure is **10231** on Windows/Node 24 over merged `main`.
  My snapshot reproduces **10230** deterministically. The 1-test difference is
  **not** platform-conditional: I found no assertion gated on `process.platform`,
  Node version or OS. The most likely cause is that merged `main` carries one
  post-merge assertion my snapshot predates. I do **not** force the figure; E0
  adds its own tests on top of whatever the real base total is (see below).

## Engine parity (unchanged in E0)

- Canonical engine slice `html.slice(indexOf(ENGINE_START), indexOf(ENGINE_END))`
  (START included, END excluded — same as `tests_engine_integrity.js`):
  **82657 chars / 82697 bytes / SHA
  `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`**, lines
  433–2586 of `solver.html`.
- engine integrity 3, Worker parity 143, Worker token 6.
- Composed solver 215539 bytes; dist/solver.html 218349 bytes, SHA
  `4dbf1a8a…`; 6 requests; 5 languages (en/es/pt/de/fr).

## E0.1 — Math source inventory

Two real sources of engine mathematics exist:

1. **Canonical production engine** — the inline region of `solver.html`
   (ENGINE_START..END). This is what ships. Direct execution and the Web Worker
   both consume **exactly these bytes** (see E0.7/E0.8).
2. **`engine/engine.js`** — the Node-requireable **twin of the Google Sheets
   add-on** (`Engine.gs`). It reads a Sheets-like `sheet` object and exports
   `module.exports` for tests. 90 declared functions, 90220 bytes, SHA
   `6190cb47…`.

No `.js` file re-implements simplex / branch-and-bound / parser independently.
The Worker glue is the only other math-adjacent runtime code, and it only wraps
detect+solve; it does not reimplement them.

## E0.2 — Engine limits

Recorded in the fixture: line 433→2586, 82657 chars / 82697 bytes, SHA as above,
90 `function` declarations, 0 classes, constant objects `ENGINE` and `APP`.
Markers: START **included**, END **excluded** by the official slice.

## E0.3 — Functional map (categories present)

Cell/reference utilities, tokenisation, parser, expression evaluation, ranges,
SUM/SUMIF, formula validation, model detection, objective/constraint
classification, linearisation, vector/matrix construction, bounds,
continuous/integer/binary domains, normalisation, simplex, branch-and-bound,
verification, states, stop reasons, diagnostics, serialisation, the Worker
contract and the engine's public surface (`detectModel_`, `solveModel_`,
`classifyGridCell_`, …).

Functions that **look** mathematical but are **visualization only** (D4, NOT the
engine): the plot clipping/geometry in `receipt-plot-exports.js`
(`clipFeasibleToBox_`, `solve2D`, `ANGULAR_EPS`, the plot's own
`normalizeConstraint_`). These do not affect the solver result and must not be
folded into the engine.

## E0.4 — Constants and tolerances

Identical in both sources and frozen: `MAX_DEPTH 40`, `BRANCH_NODES 4000`,
`BRANCH_DEPTH 60`, `BRANCH_MILLIS 20000`, `EPSILON 1e-9`, `PIVOT_TOLERANCE 1e-7`,
`MAX_ITERATIONS 20000`, `MAX_SCAN_COLUMNS 4`, `FREE_VARIABLE_LIMIT 50`,
`FREE_CONSTRAINT_LIMIT 20`. Plot geometry tolerances (`ANGULAR_EPS`,
`geometryEpsilon_`) are **separate** and belong to D4, not the engine.

## E0.5 — Input contract

The engine consumes a Sheets-like `sheet` (via `getDataRange().getFormulas()` /
`getValues()`) plus a `localeMode`; the model then carries `objective` (+
`sense`), `constraints`, variable cells, `bounds`, `domains`, and a
`wholeNumbers` toggle. The Worker request additionally carries `token`,
`formulas`, `values`, `wholeNumbers`, `domains`, `sense`. No new API is invented
in E0.

## E0.6 — Output contract

`solveModel_` returns `status`, `objective`, `values`, model-type info,
`nodesExplored`, timing, `stopReason`, `optimalityProven`, plus error/warning
info surfaced by the UI. Statuses: `optimal`, `feasible`, `infeasible`,
`unbounded`, `numerical_failure`, `invalid_model`, `unknown`, and the limit
statuses `iteration_limit` / `time_limit` / `node_limit` normalised in the
presentation layer. Semantics are **not** changed in E0.

## E0.7 — Direct execution

`runSolve()` → `solve()` (solve-orchestration.js) calls `detectModel_` /
`solveModel_` **in the same lexical scope** as the inline engine. When the Worker
is unavailable, `solveMainThread()` runs the **same inline functions** on the
main thread. Direct and Worker paths therefore consume the same engine bytes.

## E0.8 — Worker execution

`engineSource()` scans the page's own `<script>` text for the ENGINE_START..END
slice, wraps it with an `onmessage` glue that rebuilds the sheet and runs
detect+solve, and creates a `Blob([engine + glue], {type:'application/javascript'})`
Worker via `createObjectURL` (revoked after construction), token-correlated with
a stale-response guard.

- engineSource bytes 82697, SHA `5d68ed17…` (**== canonical engine**).
- glue bytes **900**, SHA `5bc80049…`.
- Blob source bytes **83598**, SHA `ec3d6068…`.

The Worker uses the **same** engine bytes, not `engine.js`.

## E0.9 — Real duplication

The only cross-source duplication is **production-inline vs add-on-twin**
(`engine/engine.js`): 89 shared function names, **87 bodies byte-identical** after
comment/whitespace normalisation, **2 divergent** — `newContext_` (web forces
`allowCachedFormulaFallback:false`, add-on parameterises it) and `readConstraint_`
(comments only). This is class **B (source + legitimate derivative)** kept in sync
manually, **not** class A production duplication. The plot `normalizeConstraint_`
is class **F (visualization, same name, different responsibility)** — not engine
duplication.

## E0.10 — Textual dependencies

- ENGINE marker slicing: `tests_engine_integrity`, `tests_worker_parity` (via
  composedHtml), and the runtime `engineSource()`.
- `eval` of extracted functions: `tests_panel`, `tests_grid_input`,
  `tests_direction`, `tests_region_plot`, `tests_solve_announce`,
  `tests_error_i18n`, `tests_worker_parity`, `tests_examples`, `tests_ex_drawer`.
- `require('./engine.js')`: `tests_bounds`, `tests_safety`, `tests_states`,
  `tests_locale`, `tests_panel`, `tests_grid_input`, and `harness`.

These are the high-risk points for any future physical move of the engine.

## E0.11 — Math test map

| suite | passed | source under test |
|---|---|---|
| tests_engine_integrity | 3 | inline raw slice |
| tests_worker_parity | 143 | inline via composedHtml + eval |
| tests_worker_token | 6 | worker token protocol |
| tests_bounds | 12 | engine.js (add-on twin) |
| tests_safety | 56 | engine.js |
| tests_states | 3 | engine.js |
| tests_locale | 29 | engine.js |
| tests_panel | 34 | engine.js + inline eval |
| tests_grid_input | 43 | engine.js + inline eval |
| tests_direction | 10 | inline via composedHtml |
| tests_region_plot | 74 | inline via composedHtml (plot) |
| tests_solve_announce | 23 | inline via composedHtml |
| tests_error_i18n | 134 | inline via composedHtml |
| tests_examples | 143 | inline via composedHtml |
| tests_ex_drawer | 21 | inline via composedHtml |

Gap worth noting for later phases: the "pure math" suites (bounds/safety/states/
locale) exercise the **add-on twin**, while parity/announce/error suites exercise
the **inline** engine. E1 should make both consume one physical source so these
can never drift.

## E0.12 — States and errors

Math statuses vs stop reasons vs infrastructure errors are already distinct in
the code (status from `solveModel_`; stopReason for limits; parser/model errors
thrown then localised by `localizeEngineError`/`showEngineTrouble`; worker/blob
failures fall back to main thread). E0 does not reclassify any of them.

## E0.13 — Architecture options and recommendation

See `docs/single-engine-architecture.md` (**PROPOSED — NOT IMPLEMENTED**).

## Files created in E0

- `engine/fixtures/single-engine/engine-e0-baseline.json` — independent baseline.
- `engine/tests_engine_baseline.js` — minimal guard `checkEngineBaseline`.
- `engine/tests_engine_baseline_negative.js` — 8 baseline negatives.
- `docs/checkpoint-e-baseline.md`, `docs/single-engine-architecture.md`.

Modified: `engine/suites.js` (register the two E0 suites); `docs/architecture.md`
and `docs/testing.md` (link E0 only).

## Zero public change

`dist/solver.html` stays byte-identical (`4dbf1a8a…`, 218349 bytes); engine SHA
unchanged; 6 requests; no engine/Worker/UI/fragment byte changed; no engine file
published. E0 adds only Node-side baseline tests + docs.


## Update: E1 implemented

Checkpoint E1 has since extracted the engine into the internal canonical file
`engine/source/plumline-engine.js` and composes it build-time into the historical
`ENGINE_START..END` position (public output byte-identical). This E0 document
remains the baseline of record; see `docs/checkpoint-e1-canonical-source.md` for
the implemented state. `engine/engine.js` is still the legacy mirror. Checkpoint E
is not complete.


## Update: E2 implemented

Checkpoint E2 has since made the mathematical front-end run against the canonical source via a vm harness (closed export list, layered-grammar contracts, canonical/mirror parity). No engine byte or public output changed; engine/engine.js is still the legacy mirror. See docs/checkpoint-e2-parser-validation-linearization.md. Checkpoint E is not complete.


## Update: E3 implemented

Checkpoint E3 has since made canonical model construction and continuous solving run directly against the canonical source through the harness (E3 phase, closed 22-function export list, continuous simplex/bounds/domains/parity contracts). A fully-continuous model never enters branch-and-bound. No engine byte, mirror byte, or public output changed; engine/engine.js is still the legacy mirror; branch-and-bound (E4), final statuses (E5) and Worker/mirror reconciliation (E6) remain pending. See docs/checkpoint-e3-model-construction-continuous-simplex.md. Checkpoint E is not complete.


## Update: E4 implemented

Checkpoint E4 has since made canonical integer / binary / mixed solving and branch-and-bound run directly against the canonical source through the harness (E4 phase, closed 8-function export list; branch-and-bound traversal, branch selection, incumbent, pruning, node/depth/time limits and the internal integer result contract). A fully-continuous model still never enters branch-and-bound. No engine byte, mirror byte, constant, tolerance or public output changed; engine/engine.js is still the legacy mirror; final statuses (E5) and Worker/mirror reconciliation (E6) remain pending. See docs/checkpoint-e4-integer-branch-and-bound.md. Checkpoint E is not complete.


## Update: Checkpoint E5 (canonical verification, statuses and error contracts)

E5 pins solution verification, final statuses, stop reasons, optimalityProven, the result adaptation and the status-vs-error separation directly against the canonical source through the harness (E5 phase). No engine/mirror/algorithm/public-output change. Verification is the COMBINATION of isSatisfied_ / feasibleAt_ / buildVariableDomains_ / isWhole_ / dotProduct_ orchestrated by solveModel_ (there is no single verifySolution_). Real statuses: optimal/feasible/infeasible/unbounded/unknown/numerical_failure/invalid_model; incomplete is UI-only, NOT an engine status. Exports: E2 24 / E3 22 / E4 8 / E5 9. Parity 3 direct + 1 observable (solveModel_, elapsedMs documented as a non-deterministic temporal field, the ONLY excluded field; all other contractual fields compared exactly). Approved divergences stay 2 (newContext_/readConstraint_). Characterised defects D-E5-1 (explainStatus_ dead branch) and D-E5-2 (limit without incumbent -> unknown, stopReason preserved) are pinned, NOT fixed. Suites: checker 70, positive 54, negative 53, auditor 116; migrated 0, split 0 (status-bearing legacy drive the mirror end-to-end -> E6). Allowlist stays 18. E5 increment +293; total 11392, identical with and without dist. See docs/checkpoint-e5-verification-statuses-errors.md.

## Checkpoint E6 update

Superseded in part by Checkpoint E6. `engine/engine.js` is now a deterministic
generated artefact derived from the single editable canonical source
`engine/source/plumline-engine.js` by `engine/generate-engine-mirror.js` (plus the
two approved platform adaptations in `engine/source/engine-platform-adapter.json`).
This phase's fixture keeps the HISTORICAL mirror SHA
(`6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa`) for its phase;
only the E6 fixture records the generated mirror
(`faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`) as the current
state. The canonical engine, the public output and this phase's behaviour are
unchanged. See `docs/checkpoint-e6-worker-mirror-final.md` and
`docs/checkpoint-e-final.md`.

Status: Checkpoint E implementation complete; pending Windows/Node 24 validation,
CI, merge and production verification.
