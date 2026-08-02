# Checkpoint D1 — grid interface extraction

D1 extracts the contiguous grid + input-interaction region of the solver UI out of
the single inline `<script>` in solver.html into ONE internal fragment, composed
back at build time so the public output is byte-identical to the pre-D baseline.

## Architecture as implemented

- **Internal fragment directory:** `engine/fragments/solver-ui/` (NOT under
  `assets/`). Fragments here are never published: they are not copied to dist, not
  fetched at runtime, not in the public manifest, and not reachable from GitHub
  Pages. (The D0 proposal originally suggested `assets/solver/`; D1 corrects this to
  an internal path so fragments can never leak into dist.)
- **Fragment created (1):** `engine/fragments/solver-ui/grid-interaction.js` — 271
  lines / 12354 bytes. It holds the contiguous grid block verbatim: `render`,
  `ensureShape`, `addRow`, `addCol`, `lastRowHasData`, `lastColHasData`, `delRow`,
  `delCol`, `syncGridTools`, `parseClipboard`, `snapshot`, `restore`, `saveUndo`,
  `pasteBlock`, `doUndo`, `parseCSV`, `importCSVText`, `importCSVFile`, `clearUndo`,
  `sheetFromGrid` (first fn `render`, last fn `sheetFromGrid`).
- **Canonical composer:** `src/shared/compose-solver.js`, exporting
  `composeSolverInterface(html, rootDir)` and `composeSolverIfNeeded(html, label,
  rootDir)`. ONE implementation used by Vite dev, Vite build, `validate_dist.js`,
  and the test router `engine/composed-html.js`.
- **Source markers (in solver.html):**
  `/* SOLVER_UI_GRID_INTERACTION_START:grid-interaction.js */` and
  `/* SOLVER_UI_GRID_INTERACTION_END */`. The composer replaces the marker block
  with the verbatim bytes of the declared fragment.

## Composition order (single, canonical)

1. shell composition (B1, `composeHtml`),
2. solver-UI composition (D, `composeSolverIfNeeded`),
3. Vite transform/build.

This exact order is used everywhere: Vite `closeBundle` and `transformIndexHtml`,
`validate_dist.js`, and `composed-html.js`. No test path composes in a different
order. Each step is a no-op when its markers are absent, so non-solver pages and
unmigrated pages pass through unchanged.

## source vs composed vs dist (three distinct states)

- **source** `solver.html`: 4304 lines / 203170 chars / 203280 bytes. Reorganised:
  the grid region is replaced by the two markers. This file necessarily changed.
- **composed (solver-UI only)**: 215539 bytes — byte-identical to the pre-D
  solver.html baseline. This is what `composeSolverInterface` returns.
- **dist public** `dist/solver.html`: 218349 bytes, SHA
  `4dbf1a8abe8498aa03d7620ad7f8043b646f914f38203906e483a8ca7f6514b4` — byte-identical
  to the pre-D1 dist. The 2810-byte difference vs the composed solver-UI is the B1
  shell (header/footer) expansion, which pre-dates D and is unrelated to the grid
  extraction.

## file:// compatibility

The GENERATED output (dist/solver.html and the composed HTML) is a standalone
document: engine + UI inline, Worker built from a runtime Blob, zero new requests,
so the built solver opens locally from `file://` exactly as before. The SOURCE
solver.html (with markers) is NOT a runnable page on its own — it is composed at
build. We do not claim the marker source runs directly from `file://`; only the
composed/built output does. (Not independently re-verified in a browser this phase;
see Limitations.)

## Functions extracted / deliberately NOT extracted

- **Extracted (20)** — the contiguous grid block above.
- **Deliberately NOT extracted (grid-related but interleaved with other
  subsystems):** `colLetter` (line ~410, before the engine), `sheetToArrays`
  (~3533), `clip` (~3840), `num`/`safeCsvText_` (~4235), `sheetFrom` (~4454). These
  are single-purpose helpers scattered between D2–D5 code; extracting them would
  require reordering (forbidden) or creating tiny fragments (forbidden). They stay
  in place. Grid KEYBOARD listeners live in the post-engine bootstrap
  (`document.addEventListener('keydown', …)`), NOT in the fragment, so they are
  protected by the `ui_post_engine` / body golden rather than moved.
- **Not touched:** detection math, `detectForPanel`, Variable Settings, Solve,
  Worker orchestration, results, plot, examples drawer, exports, engine, Worker.

## Globals and scope

The composed output is a single inline script with one lexical scope. The fragment
is inserted verbatim — no IIFE, no new function wrapper, no namespace, no module, no
extra block, no added `'use strict'`, no `const`/`let`/`var` change, no hoisting or
`this` change, no change to initialisation order. The grid globals (`ROWS`, `COLS`,
`data`, undo state) remain in the same enclosing IIFE they were in before.

## Listeners

The composed output has the same 32 `addEventListener` occurrences as the baseline
(composition is verbatim and idempotent). A contract asserts composing twice yields
identical output, so composition/init does not duplicate listeners. Handlers are not
converted to delegation.

## How to …

- **Edit grid code:** edit `engine/fragments/solver-ui/grid-interaction.js`, then
  update the golden (below). Do NOT edit the grid region inside solver.html — it is
  now a marker block.
- **Add a fragment:** add a `{name,file}` entry to `REGIONS` in
  `src/shared/compose-solver.js` (this is the CLOSED allowlist), place the fragment
  in `engine/fragments/solver-ui/`, add the marker pair in solver.html at the
  region's original position (never reorder), and extend the golden.
- **Update the golden:** re-capture
  `engine/fixtures/solver-ui-golden/solver-grid-d1.json` from the composer output
  (never from the same test that validates it), then run the suites.
- **Run tests:** `node engine/tests_solver_grid.js` (positive, 75 after the v4 dist-determinism + functional-needle
  message-specific-negative correction),
  `node engine/tests_solver_grid_negative.js` (negatives, 121), or `npm run verify`.
- **Revert D1 without reverting A–C:** reinsert the fragment bytes in place of the
  marker block in solver.html, delete `engine/fragments/solver-ui/`,
  `src/shared/compose-solver.js`, the two D1 test suites and the D1 golden, remove
  the two suite names from `engine/suites.js`, remove the `tests_solver_grid.js`
  allowlist entry, and revert the solver-composition chaining in
  `vite.config.mjs`, `engine/composed-html.js`, `engine/validate_dist.js`, and the
  redirection of the eight solver suites to `composedHtml`. A/B/C are untouched.

## Engine stays inside solver.html

The engine was NOT moved to a fragment. The region between `/* ENGINE_START */` and
`/* ENGINE_END */` remains in solver.html, byte-identical: 82657 chars / 82697 bytes
/ SHA `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`. The
composer refuses any marker placed inside the engine region.

## Metrics (before → after)

- solver.html source: 4573 lines / 215539 bytes → 4304 lines / 203280 bytes (the
  grid region moved to a fragment).
- composed solver-UI: 215539 bytes (== baseline).
- dist/solver.html: 218349 bytes, unchanged vs pre-D1.
- Fragments: 0 → 1 (grid-interaction.js, 271 lines / 12354 bytes).
- Functions extracted: 20. Globals extracted: 0 (globals stay in the shared scope).
  Listeners moved: 0 (grid keyboard stays in the bootstrap).
- Requests: 6 → 6. Public payload: unchanged. Manifest / requiredPaths: unchanged.
- New files: 4 (compose-solver.js, grid-interaction.js, tests_solver_grid.js,
  tests_solver_grid_negative.js) + 1 golden (solver-grid-d1.json) + this doc.
- Modified: solver.html (markers), vite.config.mjs, engine/composed-html.js,
  engine/validate_dist.js, engine/suites.js, engine/tests_composed_reads.js
  (allowlist hygiene), engine/tests_structure.js (locale block → composed), and 8
  solver suites redirected to `composedHtml` (tests_grid_input, tests_panel,
  tests_region_plot, tests_solve_announce, tests_error_i18n, tests_worker_parity,
  tests_examples, tests_direction).
- Tests: 8218 → 8367 (+149: +76 positive checker, +81 negatives, −9 raw reads no
  longer counted by the composed-reads guard, +1 guard entry counted).
- RAW_SOURCE_ALLOWLIST: 21 → 15 keys (removed 7 obsolete solver raw-read entries
  now using composedHtml; added 1 justified entry for tests_solver_grid.js, the
  composer contract).
- Engine: 82657 chars / 82697 bytes / SHA 5d68ed17…, unchanged. Worker parity 143,
  Worker token 6, unchanged.

Distinctions (not a complexity reduction): the main source file shrank; the number
of internal files rose by one fragment; the public payload is unchanged; build
complexity rose slightly (one composer step, chained in one canonical order);
maintainability improved (grid code is now an isolated, golden-pinned unit);
performance is unchanged.

## Validation

`npm ci` + `npm run verify` + `npm run build`: VERIFY ALL GREEN, VALIDATE DIST OK,
DIST HTTP OK, TOTAL 8367. Engine integrity 3/3, Worker parity 143, Worker token 6,
grid suites (grid_input 43, grid_a11y 39, panel 34) green, B1/B2/B3 green, C1–C5
green, five languages (en/es/pt/de/fr), spaced-path runs green, dist/solver.html
byte-identical to pre-D1, no fragment or marker in dist.

## Public differences intended: none

Public HTML/CSS/JS output: unchanged. dist/solver.html byte-identical to pre-D1.
Requests 6 → 6. Payload unchanged. Visual differences: none (composed output is
byte-identical to the baseline).

## Follow-up (D2)

D2 added a second fragment (`variable-settings.js`) to the same composer and
`REGIONS` allowlist (order: grid, then variable-settings), and the D1 negative
suite's `makeTree` now copies ALL fragments so it composes cleanly regardless of how
many phases have landed. D1's grid fragment, its 20 functions, its order, and its
suites are unchanged. See docs/checkpoint-d2-detection-variable-settings.md and
docs/checkpoint-d3-execution-results.md (D3 added three more fragments to the same
composer; the canonical order is now GRID_INTERACTION → SOLVE_WORKER_CLIENT →
VARIABLE_SETTINGS → SOLVE_ORCHESTRATION → SOLVE_RESULTS).

## Follow-up (D4)

D4 added examples-loading.js, receipt-plot-exports.js (with the previously-mixed
renderReceipt, the feasible-region plot, and CSV/XLS/TXT exports), and
examples-drawer.js to the same composer. Canonical order is now EXAMPLES_LOADING →
GRID_INTERACTION → SOLVE_WORKER_CLIENT → VARIABLE_SETTINGS → SOLVE_ORCHESTRATION →
SOLVE_RESULTS → RECEIPT_PLOT_EXPORTS → EXAMPLES_DRAWER. This phase's fragment,
functions, and suites are unchanged. See
docs/checkpoint-d4-visualization-examples-exports.md.

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
