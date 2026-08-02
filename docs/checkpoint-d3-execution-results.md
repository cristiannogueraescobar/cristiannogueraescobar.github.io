# Checkpoint D3 — execution, errors & results extraction

D3 extracts the solve-orchestration, Worker-client, and error/result-presentation
regions of the solver UI into three internal fragments, composed back at build time
so the public output stays byte-identical to the pre-D baseline. It changes NO
mathematical contract and NO Worker behaviour.

## Function audit (UI/orchestration vs frozen vs D4)

- **Extracted D3 UI/orchestration (17 functions across 3 regions):** activeLocale,
  fmt, scrollBehavior, announce, engineSource, buildWorker (Worker client);
  solve, sheetToArrays, cancelSolve, modelChanged, offerCompatMode, solveMainThread,
  runSolve (solve orchestration + fallback + invalidation); presentResult,
  showTrouble, showEngineTrouble, solveDetailsHTML (errors + results). The
  Worker-state vars `engineWorker`, `workerBusy`, `workerToken` move verbatim with
  the Worker-client region.
- **Frozen — engine math (Class E), NOT touched:** solveLinearProgram_, linearize_,
  classifyModel_, detectModel_, coefficientVector_, buildVariableDomains_,
  solveModel_, safeLinearize_ and every parser/simplex/branch-and-bound routine.
  The UI shows the returned status; it never recomputes or reinterprets it.
- **Frozen — Worker math/glue payload:** the engine bytes placed in the Blob, the
  message structure, the token property, the payload, serialization, the solve code
  running inside the Worker, the fallback criterion, cancellation, and stale-response
  handling are unchanged. D3 moved the Worker *client/orchestration* verbatim; the
  mathematical payload stays as-is.
- **Deliberately NOT extracted (kept in source):**
  - `renderReceipt` — MIXED D3/D4: it renders the result receipt (D3) but also wires
    the CSV export button (`exportCSV`) and draws the feasible-region plot
    (`drawFeasibleRegion`). Per the D3 rule, a function mixing results with
    plot/export is left in source until D4 rather than split.
  - `currentLocaleMode` — shared utility also called by the D2 Variable-Settings
    fragment; it must stay in the shared source scope.
  - `sheetToArrays` IS extracted (it is Worker-client, structured-cloning the sheet
    for postMessage), but it sits inside the contiguous orchestration block.

## Fragments (3, at their historical positions)

The D3 code lives in TWO historical zones — before and after the D2 marker block —
so it is captured as three regions in canonical source order:

1. `engine/fragments/solver-ui/solve-worker-client.js` (90 lines / 4551 b) —
   activeLocale → buildWorker. Sits BETWEEN the D1 grid markers and the D2 markers.
2. `engine/fragments/solver-ui/solve-orchestration.js` (182 lines / 8007 b) —
   solve → runSolve. Sits AFTER the D2 markers.
3. `engine/fragments/solver-ui/errors-results.js` (70 lines / 4773 b) —
   presentResult → solveDetailsHTML. After the orchestration block, before the
   non-extracted `renderReceipt`.

## Markers & order

Canonical `REGIONS` order in `src/shared/compose-solver.js` (== source appearance
order):

```
GRID_INTERACTION → SOLVE_WORKER_CLIENT → VARIABLE_SETTINGS → SOLVE_ORCHESTRATION → SOLVE_RESULTS
```

Same composer as D1/D2 — no second composer. `engineSource` contains the literal
string `/* ENGINE_START */` (it searches the DOM for the engine); this is NOT a
composition marker and does not confuse the composer, which locates the real engine
region by first `indexOf` (before this fragment) and matches only
`/* SOLVER_UI_..._START/END */`. Verified: the composed output is byte-identical to
the pre-D baseline.

## Worker contract (documented, not invented)

- **Client/orchestration (D3, moved verbatim):** `buildWorker()` builds a Blob from
  `engineSource()` + glue, `URL.createObjectURL`, `new Worker`; `runSolve()` drives
  the solve; `cancelSolve()` cancels; `solveMainThread()` is the fallback when
  `typeof Worker === 'undefined'`.
- **Token & stale rejection:** `workerToken` correlates request/response; a response
  whose token does not match the current one is ignored. `revokeObjectURL` cleans up
  the Blob URL. All preserved verbatim.
- **Frozen (E):** engineSource bytes, glue, Blob construction, message/response
  structure, token property, payload, serialization, cancellation criterion, and the
  order of `revokeObjectURL` — none modified.

## State (D3)

`solving`/`pending` are expressed through `workerBusy` + `workerToken` +
`engineWorker`; the last result, current error, visible status, the Solve/Cancel
buttons, the result region and placeholder, live regions, and solve-details
open/closed state all keep their existing lifecycle. The extraction moves the code
into the same lexical scope, so no state is duplicated, nothing becomes a new
`window` property, and no lifecycle changed.

## Localized errors

`showTrouble`, `showEngineTrouble`, and `presentResult` map engine status codes
(`optimal`, `feasible`, `infeasible`, `unbounded`, `numerical_failure`,
`invalid_model`, and incomplete/unknown) to localized `t('...')` strings across
en/es/pt/de/fr. `err.message` is never rendered into the DOM by a D3 fragment (a
checker assertion enforces this). No key, copy, fallback, or classification changed;
`assets/i18n.js` was not modified.

## Results

`presentResult` picks the title/body per status and calls `renderReceipt` (which
stays in source until D4) for the successful path, or `showTrouble` otherwise, then
`announce`s a concise spoken summary. `solveDetailsHTML` renders the collapsible
solve details (time/nodes/model type/stopped-reason/optimality). DOM order, classes,
ids, data-i18n, ARIA, announcements, visibility, and rounding are unchanged.

## How to …

- **Edit the orchestration / Worker client / error+result presentation:** edit the
  relevant fragment (`solve-worker-client.js`, `solve-orchestration.js`,
  `errors-results.js`), then update the D3 golden. Do NOT edit these regions inside
  solver.html — they are marker blocks.
- **What belongs to Checkpoint E:** all engine math and the Worker mathematical
  payload/glue (engineSource bytes, message structure, solve code inside the Worker).
  Never move these into a fragment or reimplement them.
- **What is deferred to D4:** `renderReceipt`, the feasible-region plot, the examples
  drawer, and CSV/XLS/TXT exports. Do not extract them in D3.
- **Update the golden:** re-capture
  `engine/fixtures/solver-ui-golden/solver-execution-d3.json` from the composer
  output (never from the validating test), then run the suites.
- **Run tests:** `node engine/tests_solver_execution.js` (138 after the v4 dist-determinism + functional-needle correction),
  `node engine/tests_solver_execution_negative.js` (213), or `npm run verify`.
- **Revert D3 without reverting D1/D2 or A–C:** reinsert the three fragment blocks in
  place of their marker blocks in solver.html, delete the three D3 fragments, remove
  the `SOLVE_WORKER_CLIENT` / `SOLVE_ORCHESTRATION` / `SOLVE_RESULTS` entries from
  `REGIONS` in `src/shared/compose-solver.js`, delete the two D3 suites and the D3
  golden, remove the two suite names from `engine/suites.js`, remove the
  `tests_solver_execution.js` allowlist entry, and revert the `tests_structure.js`
  scrollBehavior block to reading raw. D1/D2 fragments, composer regions, suites, and
  A/B/C are untouched.

## Engine and Worker stay intact

Engine region byte-identical: 82657 chars / 82697 bytes / SHA
`5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`. No math function
moved out of the engine, none copied into a fragment, no UI-side recompute. Worker
parity 143, token 6 — unchanged.

## Metrics (before → after D3)

- solver.html source: 4054 lines / 190909 bytes → 3715 lines / 173873 bytes.
- composed solver-UI: 215539 bytes (== baseline, unchanged).
- dist/solver.html: 218349 bytes, unchanged vs pre-D.
- Fragments: 2 → 5 (grid-interaction 12354 b, variable-settings 12469 b,
  solve-worker-client 4551 b, solve-orchestration 8007 b, errors-results 4773 b).
- D3 functions extracted: 17. D4 functions NOT extracted: renderReceipt (+ its plot
  and export). Engine math NOT extracted: all. Globals extracted: 0 new (Worker
  state vars move with their region, same scope). Listeners moved: 0 (Solve listener
  stays in the source bootstrap; the Cancel binding was already inside the
  orchestration block and moves verbatim with it).
- Requests 6 → 6. Public payload unchanged. Manifest / requiredPaths unchanged.
- New files: 3 fragments + tests_solver_execution.js +
  tests_solver_execution_negative.js + 1 golden (solver-execution-d3.json) + this
  doc.
- Modified: solver.html (D3 markers), src/shared/compose-solver.js (REGIONS +3),
  engine/suites.js (+2 suites), engine/tests_composed_reads.js (+1 justified
  allowlist entry), engine/tests_structure.js (scrollBehavior block → composedHtml,
  a shared-test adaptation), engine/tests_solver_detection_negative.js (N45 worker
  glue now mutates the D3 fragment — a mechanical shared-test adaptation).
- Tests: 8573 → 8821 (+248 net: +121 D3 checker, +127 D3 negatives, +1 composed-reads
  guard entry, −1 raw read no longer counted after the scrollBehavior redirect).
- RAW_SOURCE_ALLOWLIST: 16 → 17 keys (+1 justified: tests_solver_execution.js reads
  source only to compose+validate; negatives NOT allowlisted).
- Engine 82657/82697/5d68ed17 unchanged. Worker parity 143, token 6 unchanged.

Distinctions (not a complexity reduction): the main source file shrank again; the
number of internal fragments rose by three; the public payload is unchanged; build
complexity rose slightly (the same composer, three more allowlisted regions);
maintainability improved (execution, Worker client, and results are now isolated,
golden-pinned units); the mathematical logic and Worker payload are byte-for-byte
unchanged.

## Public differences intended: none

Public HTML/CSS/JS: unchanged. dist/solver.html byte-identical to pre-D. Requests
6 → 6. Payload unchanged. Visual differences: none.

## Follow-up (D4)

D4 moved `renderReceipt` (the mixed function D3 deliberately left in source) fully
into a new `receipt-plot-exports.js` fragment, together with the feasible-region
plot geometry and the CSV/XLS/TXT exports, plus `examples-loading.js` and
`examples-drawer.js`. The canonical order became EXAMPLES_LOADING → GRID_INTERACTION
→ SOLVE_WORKER_CLIENT → VARIABLE_SETTINGS → SOLVE_ORCHESTRATION → SOLVE_RESULTS →
RECEIPT_PLOT_EXPORTS → EXAMPLES_DRAWER. D3's `tests_solver_execution.js` order check
was relaxed to a canonical-relative subsequence so later phases can add regions
without a false failure. D3's fragments, functions, and Worker contract are
unchanged. See docs/checkpoint-d4-visualization-examples-exports.md.

## Follow-up (D5 — Checkpoint D complete)

D5 extracted the remaining bootstrap + accessibility code into a ninth fragment
(bootstrap-accessibility.js) and added the cumulative D1–D5 golden
(solver-interface-d5-final.json) and checker (checkSolverInterfaceFinal), which is the
authority for the EXACT global order of all nine regions. The composer gained a
completeness guard (a declared region must have a marker). This phase's fragments,
functions, and suites are unchanged. Canonical order is now EXAMPLES_LOADING →
GRID_INTERACTION → SOLVE_WORKER_CLIENT → VARIABLE_SETTINGS → SOLVE_ORCHESTRATION →
SOLVE_RESULTS → RECEIPT_PLOT_EXPORTS → EXAMPLES_DRAWER → BOOTSTRAP_ACCESSIBILITY. See
docs/checkpoint-d5-integration.md.
