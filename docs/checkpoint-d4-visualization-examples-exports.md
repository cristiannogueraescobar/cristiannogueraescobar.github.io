# Checkpoint D4 — visualization, examples & exports extraction

D4 extracts the remaining visualization (receipt + feasible-region plot), examples
(loading + drawer), and exports (CSV/XLS/TXT) UI into three internal fragments,
composed back at build time so the public output stays byte-identical to the pre-D
baseline. It changes NO mathematical contract, NO geometry, and NO export format.

## Function audit

- **Extracted D4 UI (22 functions across 3 regions):**
  - examples loading: `loadExample`, `updateExampleUrl` (+ the `EXAMPLE_BY_SLUG`
    resolver state).
  - receipt + plot + exports: `renderReceipt` (now fully D4 — see below),
    `polygonDimension_`, `clipFeasibleToBox_`, `drawFeasibleRegion`,
    `addWorkedSteps`, `lineAcrossBox`, `geometryEpsilon_`, `normalizeConstraint_`
    (plot-scoped), `solve2D`, `solutionRows`, `safeCsvText_`, `download`,
    `exportCSV`, `exportExcel`, `copySummary`, `flash` (+ `ANGULAR_EPS`).
  - examples drawer: `renderExamplesDrawer`, `backgroundEls`, `openDrawer`,
    `closeDrawer`.
- **`renderReceipt` — the mixed function from D3, now fully D4.** In D3 it was left
  in source because it renders the receipt (D3-adjacent) AND wires the CSV export
  button (`exportCSV`) and draws the feasible-region plot (`drawFeasibleRegion`). In
  D4 all of its dependencies (plot + exports) are in scope in the SAME region, so it
  moves verbatim with them into `receipt-plot-exports.js` — no split, same order.
- **Deliberately NOT extracted:**
  - `esc` — shared HTML-escape utility called by other fragments; stays in the
    source scope. A checker assertion enforces it is not copied into a D4 fragment.
  - `currentLocaleMode` — shared utility (also used by D2); stays in source.
  - The examples/drawer bootstrap listeners (`data-ex` chip wiring, openExamples /
    closeExamples / backdrop click, the drawer keydown/Escape handler) stay in the
    post-engine bootstrap — deferred to D5.

## Plot ↔ engine boundary

- **Frozen (engine math, Class E):** everything inside ENGINE_START/END — parser,
  simplex, branch-and-bound, verification, states, tolerances, detection.
  `solveLinearProgram_`, `classifyModel_`, `detectModel_`, etc. Note the engine has
  its OWN `normalizeConstraint_` (a solver helper); it is untouched.
- **D4 geometric visualization (moved verbatim):** transforms an already-computed
  result into coordinates, clips against the visible box (`clipFeasibleToBox_`,
  Sutherland–Hodgman), computes intersections for drawing (`solve2D` with nested
  `intersect`/`feasible`), chooses the viewport, and emits SVG. These use geometry
  tolerances (`ANGULAR_EPS = 128*Number.EPSILON`, `geometryEpsilon_`) that affect
  ONLY the drawn region, never the solver's numeric result. The plot's
  `normalizeConstraint_` is a DIFFERENT function from the engine's — same name,
  separate scope — so it legitimately appears twice in the composed output (a
  checker assertion pins exactly that: once in the engine, once in the plot
  fragment). No formula, tolerance, clipping rule, normalization, ordering, or
  degenerate-case behaviour changed.

## Fragments (3, at their historical positions)

The D4 code lives in three historical zones, captured as three regions in canonical
source order:

1. `engine/fragments/solver-ui/examples-loading.js` (62 lines / 2948 b) — BEFORE the
   D1 grid markers (`EXAMPLE_BY_SLUG` + loadExample + updateExampleUrl).
2. `engine/fragments/solver-ui/receipt-plot-exports.js` (607 lines / 33488 b) —
   AFTER the D3 SOLVE_RESULTS markers (renderReceipt → the full plot geometry →
   exports, ending at `flash`; `esc` stays out).
3. `engine/fragments/solver-ui/examples-drawer.js` (67 lines / 3486 b) — after the
   exports (renderExamplesDrawer → backgroundEls → openDrawer → closeDrawer; the
   bootstrap listeners stay in source).

## Markers & canonical order

`REGIONS` in `src/shared/compose-solver.js` (== source appearance order):

```
EXAMPLES_LOADING → GRID_INTERACTION → SOLVE_WORKER_CLIENT → VARIABLE_SETTINGS →
SOLVE_ORCHESTRATION → SOLVE_RESULTS → RECEIPT_PLOT_EXPORTS → EXAMPLES_DRAWER
```

Same composer as D1–D3 — no second composer. Recomposes byte-identical to the pre-D
baseline (215539 b).

## Contracts (documented, not invented)

- **Examples (canonical source `assets/examples-data.js`, NOT modified):**
  `loadExample(name)` resolves a public slug via `EXAMPLE_BY_SLUG` to an internal
  key, loads the grid/sense/types/bounds, resets prior state (via `modelChanged`),
  and `updateExampleUrl` maintains the `?ex=<slug>` URL. Slugs, category order, and
  the URL format are unchanged. solver.html's example GRIDS/RESULTS/MODELS remain
  protected by the existing `tests_examples` (143) and `tests_ex_drawer` (21) — this
  checker deliberately does NOT inspect example math, so no example-math case is a D4
  negative.
- **Drawer:** `openDrawer`/`closeDrawer`/`renderExamplesDrawer` over ids
  `#exDrawer`/`#openExamples`/`#closeExamples`/`#exDrawerBackdrop`/`#exDrawerBody`,
  grouped by `CATEGORY_ORDER`, with focus management (`backgroundEls`), Escape, and
  backdrop click. Open/close lifecycle and focus return unchanged.
- **Exports:** `exportCSV` (`text/csv`, `safeCsvText_` quoting), `exportExcel`
  (`application/vnd…` XLS), `copySummary` (TXT via clipboard or `download`), all via
  `download()` → `new Blob` + `createObjectURL` + `<a download>` + `revokeObjectURL`.
  Headers, row order, values, quoting, delimiters, encoding, MIME types, extensions,
  and filenames (e.g. `plumline-solution.txt`) are unchanged. No new format, no
  external dependency.

## State (D4)

`lastResult`, the current plot/SVG, drawer open/closed, selected category/example,
slug, export controls, the temporary Blob URL, DOM refs, and prior focus all keep
their existing lifecycle. The extraction moves the code into the same lexical scope,
so no state is duplicated, nothing becomes a new `window` property, and no
invalidation changed.

## Listeners

The export button bindings created by `renderReceipt` move verbatim with it; the
drawer's open/close/backdrop/Escape listeners stay in the source bootstrap. Nothing
is converted to delegation; composition is idempotent so nothing is duplicated after
multiple solves or drawer opens.

## How to …

- **Edit the plot:** edit `receipt-plot-exports.js` (geometry + SVG), then update the
  D4 golden. Do NOT change tolerances/clipping/scales/colors — those are frozen by
  the byte-identical golden.
- **Add or modify an example:** edit the canonical sources — `assets/examples-data.js`
  (slug/category/type/sense metadata) and the example grids/models in solver.html
  (guarded by tests_examples/tests_ex_drawer). Do NOT create a third source or copy
  `CATEGORY_ORDER` into a fragment.
- **Edit exports:** edit `receipt-plot-exports.js`. Do NOT change MIME types,
  extensions, filenames, quoting, or add a format.
- **What belongs to Checkpoint E:** all engine math and the Worker mathematical
  payload. The plot's geometry is D4 (visualization), NOT E — but its tolerances and
  formulas are frozen and must not change.
- **What is deferred to D5:** the examples/drawer bootstrap listeners, `esc` and
  other shared utilities, and the final accessibility/bootstrap audit.
- **Update the golden:** re-capture
  `engine/fixtures/solver-ui-golden/solver-visualization-d4.json` from the composer
  output (never from the validating test), then run the suites.
- **Run tests:** `node engine/tests_solver_visualization.js` (158 after the v4 dist-determinism + functional-needle correction),
  `node engine/tests_solver_visualization_negative.js` (240), or `npm run verify`.
- **Revert D4 without reverting D1–D3 or A–C:** reinsert the three fragment blocks in
  place of their marker blocks in solver.html, delete the three D4 fragments, remove
  the `EXAMPLES_LOADING` / `RECEIPT_PLOT_EXPORTS` / `EXAMPLES_DRAWER` entries from
  `REGIONS`, delete the two D4 suites and the D4 golden, remove the two suite names
  from `engine/suites.js`, and remove the `tests_solver_visualization.js` allowlist
  entry. The D3 order-check subsequence adaptation can stay (it is forward-compatible)
  or be reverted to the full-list check. D1/D2/D3 and A/B/C are untouched.

## Engine and Worker stay intact

Engine region byte-identical: 82657 chars / 82697 bytes / SHA
`5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`. No math function
moved out of the engine, none copied into a fragment, no UI-side recompute. Worker
parity 143, token 6 — unchanged.

## Metrics (before → after D4)

- solver.html source: 3715 lines / 173873 bytes → 2982 lines / 134245 bytes.
- composed solver-UI: 215539 bytes (== baseline, unchanged).
- dist/solver.html: 218349 bytes, unchanged vs pre-D.
- Fragments: 5 → 8 (examples-loading 2948 b, grid-interaction 12354 b,
  solve-worker-client 4551 b, variable-settings 12469 b, solve-orchestration 8007 b,
  errors-results 4773 b, receipt-plot-exports 33488 b, examples-drawer 3486 b).
- D4 functions extracted: 22 (incl. renderReceipt, 9 plot-geometry helpers, 6
  exports). Geometry constant `ANGULAR_EPS` moved verbatim. Engine math NOT
  extracted: all. Shared utils NOT extracted: esc, currentLocaleMode. Globals
  extracted: 0 new (EXAMPLE_BY_SLUG moves with its region, same scope). Listeners
  moved: the export bindings inside renderReceipt (verbatim); drawer bootstrap
  listeners stay in source.
- Requests 6 → 6. Public payload unchanged. Manifest / requiredPaths unchanged.
- New files: 3 fragments + tests_solver_visualization.js +
  tests_solver_visualization_negative.js + 1 golden (solver-visualization-d4.json) +
  this doc.
- Modified: solver.html (D4 markers), src/shared/compose-solver.js (REGIONS +3),
  engine/suites.js (+2 suites), engine/tests_composed_reads.js (+1 justified
  allowlist entry), engine/tests_solver_execution.js (D3 order check relaxed to a
  canonical-relative subsequence so later phases can add regions — a mechanical
  forward-compat adaptation).
- Tests: 8821 → 9107 (+286: +142 D4 checker, +143 D4 negatives, +1 composed-reads
  guard entry).
- RAW_SOURCE_ALLOWLIST: 17 → 18 keys (+1 justified: tests_solver_visualization.js
  reads source only to compose+validate; negatives NOT allowlisted).
- Engine 82657/82697/5d68ed17 unchanged. Worker parity 143, token 6 unchanged.

Distinctions (not a complexity reduction): the main source file shrank substantially
(the 33 KB plot/exports block moved out); the number of internal fragments rose by
three; the public payload is unchanged; build complexity rose slightly (the same
composer, three more allowlisted regions); maintainability improved (plot, examples,
and exports are now isolated, golden-pinned units); the mathematical logic, geometry,
and export formats are byte-for-byte unchanged.

## Public differences intended: none

Public HTML/CSS/JS: unchanged. dist/solver.html byte-identical to pre-D. Requests
6 → 6. Payload unchanged. Visual differences: none.

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
