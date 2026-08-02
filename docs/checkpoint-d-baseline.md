# Checkpoint D0 — solver.html interface baseline

Baseline captured before any Checkpoint D reorganisation. This document is an audit
and a map. No production code, no engine, and no Worker code was changed to produce
it. The engine and Worker are frozen for Checkpoint E and are recorded here by hash
and inventory only, never by copying their bodies.

## D0.1 Technical baseline

- Base SHA: pending user verification (assistant works from a snapshot with no `.git`).
- Node: v22.22.2 (repo pins v24.15.0 for CI/build; validated locally on 22.22.2).
- OS: Linux x86_64.
- `npm run verify`: ALL GREEN. `npm run build`: green. VALIDATE DIST: OK. DIST HTTP: OK.
- Total tests: 8218.
- Engine: 82657 chars / 82697 UTF-8 bytes / SHA-256
  `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`.
- Worker parity: 143. Worker token: 6.

### solver.html shape

- 4573 lines / 215429 chars / 215539 UTF-8 bytes.
- head: 20157 bytes. body: 195339 bytes.
- Inline `<style>`: 1 block, 18061 bytes (solver visual variant; loads after the
  shared sheet so its solver-scoped overrides win — a B3 fact, not a D change).
- Inline `<script>`: 1 block, 187795 bytes. This single script holds BOTH the engine
  region (82697 bytes) AND the whole solver UI (105098 bytes: 2613 before the engine
  marker, 102485 after).
- External scripts (4, in load order): `assets/examples-data.js?v=1`,
  `assets/i18n.js?v=82`, `assets/nav-menu.js?v=6`, `assets/build-badge.js?v=2`.
- External stylesheet: `assets/plumline.css?v=21`.

### Element and attribute inventory (body)

- img 0, a 1, form 0, button 22, input 5, select 4, dialog 0, details 2, canvas 0,
  svg 2, table 3, textarea 0.
- id: 37 total, 37 unique. Unique classes: 91. data-i18n: 41. aria-\* attrs: 17.
  role: 3. tabindex: 1. Inline `on*` handlers: 0 (all events bound in JS).

### Platform APIs (inside the inline script)

- localStorage 0, sessionStorage 0, fetch 0, XMLHttpRequest 0 (no network, no
  storage — consistent with "runs locally, no account, no tracking").
- new Worker 1, Blob 2, createObjectURL 3, revokeObjectURL 2, FileReader 1,
  navigator.clipboard 2, download attr 1, element.click() 2.
- setTimeout 3, clearTimeout 1, setInterval 0, requestAnimationFrame 0,
  MutationObserver 0, ResizeObserver 0.
- addEventListener 32 total across the script (14 at UI module level; the rest are
  nested inside handlers/factories).

## D0 engine boundary (frozen)

- Markers: `/* ENGINE_START */` (line 433) … `/* ENGINE_END */` (line 2586).
- Canonical convention (matches `tests_engine_integrity.js`):
  `slice(indexOf(START), indexOf(END))` — includes the START marker text, excludes
  the END marker. Length 82657 chars / 82697 bytes / SHA
  `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`.
- Engine functions: 90 (names, whitespace, comments, order, tolerances NOT touched
  in D — reorganisation belongs to Checkpoint E).
- Engine uses no localStorage/fetch; it is a pure compute region.

## D0 Worker boundary (frozen)

- Creation: the UI extracts `engineSource` (the ENGINE_START..ENGINE_END region),
  concatenates it with a small "glue" (`onmessage` handler + `postMessage` result),
  builds `new Blob([src + glue], {type:'application/javascript'})`, calls
  `URL.createObjectURL`, then `new Worker(url)`, then `revokeObjectURL`.
- No external Worker file, no fetch: the Worker source is composed at runtime from
  the same inline engine region, which is why direct/Worker parity holds.
- Correlation: every message carries a `token` (85 references) so stale responses
  from a superseded solve are ignored.
- Fallback: `solveMainThread` runs the engine on the main thread when
  `typeof Worker` is unavailable or Worker construction throws (guarded near line
  3137; fallback path near line 2198).
- Cancellation: `cancelSolve` (a dynamically inserted control) plus token
  invalidation.
- Checkpoint D may document and protect this orchestration layer but must not alter
  the Worker's mathematical code.

## D0.2 DOM map (regions, root ids, responsibility)

Body regions in document order (selector → responsibility):

- Shell header/footer — composed at build (B1); OUT of scope for D.
- `#content` — main solver container (created in source, not by JS).
- Toolbar / examples entry — `#openExamples` (opens the examples drawer).
- Grid — `#grid` (the spreadsheet table), `#gridsize` (dimensions readout), grid
  tools `#addRow #delRow #addCol #delCol #importCsv #detectVars #undoGrid`,
  `#csvFile` (hidden file input for CSV import).
- Solve controls — `#solve`, `#senseSel` (min/max), `#senseHint`, `#whole`
  (integer toggle), `#localeSel` (number-format locale), `#clear`.
- Variable Settings — `#varSettings` (container), `#varSettingsBody` (per-variable
  continuous/integer/binary + bounds UI, populated by JS).
- Status / results — `#solveAnnounce` (aria-live status), `#result`,
  `#placeholder`, `#selfcheck-row` `#selftest` `#selftest-out` (self-test control),
  `#how` (help text).
- Examples drawer — `#exDrawerBackdrop` `#exDrawer` `#exDrawerTitle`
  `#closeExamples` `#exDrawerBody` (list rendered by JS from examples-data.js).
- Dynamically inserted controls — `#cancelSolve` (during solve), `#compatSolve`
  (compat-mode offer), `#exp-csv` `#exp-xls` `#exp-txt` (export buttons).
- Live regions — 2 `aria-live="polite"`, one `role="status"`.

## D0.3 Code map (function inventory)

101 UI functions + 90 engine functions in the inline script. UI functions grouped by
subsystem (names only; bodies not copied):

- Localization: `t`, `applyLang`, `activeLocale`, `currentLocaleMode`,
  `localizeEngineError`, `esc`.
- Grid model/render: `render`, `mkSheet`, `sheetFrom`, `sheetFromGrid`,
  `sheetToArrays`, `ensureShape`, `blank`, `addRow`, `delRow`, `addCol`, `delCol`,
  `colLetter`, `lastRowHasData`, `lastColHasData`, `syncGridTools`, `num`, `fmt`,
  `clip`.
- Selection / keyboard / clipboard / undo: `snapshot`, `saveUndo`, `doUndo`,
  `clearUndo`, `restore`, `parseClipboard`, `pasteBlock`, `parseCSV`,
  `importCSVText`, `importCSVFile`, `safeCsvText_`.
- Detection + Variable Settings: `detectForPanel`, `setDetectLabel`,
  `renderVarPanel`, `resetVarPanel`, `settingsFor`, `hasCustomSettings`,
  `variableDomains`, `categoryOf`, `typeOf`, `senseOf`, `senseConfirmed`,
  `updateSenseHint`, `cleanBound`, `varError`, `anyVarError`, `showVarError`,
  `objectiveSignature`, `sameObjective`, `modelChanged`, `metaFor`, `slugOf`.
- Solve orchestration + Worker: `runSolve`, `solve`, `solve2D`, `solveMainThread`,
  `solveExample`, `buildWorker`, `engineSource`, `cancelSolve`, `offerCompatMode`,
  `runSelfTest`.
- Results / details: `presentResult`, `renderReceipt`, `solutionRows`,
  `solveDetailsHTML`, `addWorkedSteps`, `copySummary`, `announce`, `flash`.
- Errors: `showTrouble`, `showEngineTrouble`.
- Plot (feasible region): `drawFeasibleRegion`, `feasible`, `intersect`, `line`,
  `lineAcrossBox`, `clipFeasibleToBox_`, `normalizeConstraint_`, `recedes`,
  `polygonDimension_`, `plotMaximum_`, `geometryEpsilon_`, `sx`, `sy`, `mkSheet`,
  `backgroundEls`, `scrollBehavior`.
- Examples: `renderExamplesDrawer`, `examplesInCategory`, `loadExample`,
  `openDrawer`, `closeDrawer`, `updateExampleUrl`.
- Exports: `exportCSV`, `exportExcel`, `download`.
- Utilities: `set`.

(These groupings are the audit's proposed seams; nothing is moved in D0.)

## D0.4 Globals and state

Module-scope state (UI): `engineWorker` (Worker handle), `ROWS`/`COLS` (grid
dimensions), `rows`/`grid`/`sheet` (grid model + DOM), `lastResult` (last solve
result), `solving`/`pending` (solve status flags), undo state, selection anchors.
Only one global is exposed on `window`: `window.__plumline` (a debug/self-test
handle). Localization is consumed via the shared `Plumline.i18n` module
(`Plumline.i18n.init('solver')`, 9 refs).

Classification of the state:

- UI-only: grid dimensions, selection, undo stack, solve status flags, DOM refs,
  plot state, examples/drawer state, result presentation state.
- Engine: internal to the frozen region; not exposed.
- Worker: `engineWorker` handle + token counter (orchestration, not math).
- Shared: `Plumline.i18n` (B2 module), asset versions.

Risks to note (not fixed in D0): heavy reliance on module-scope mutable globals; the
grid model and DOM are updated together by several functions; solve status is a pair
of flags rather than one state object; token invalidation is the only guard against
stale Worker responses.

## D0.5 Events

14 UI-level `addEventListener` bindings (click ×6, change ×4, input ×2, keydown ×2)
plus 2 document-level listeners; 0 window-level. All bindings run once at
initialisation (no re-binding path observed), so extraction must preserve
single-binding semantics. Grid keyboard navigation and paste are bound on the grid
container; the file input drives CSV import; the locale select drives number
formatting; the solve button drives orchestration.

## D0.6 Test coverage map (solver subsystems)

Real, executing suites already protect the interface (SRC = inspects solver source;
jsdom = loads the page in jsdom; REAL = extracts/executes real engine or UI code):

- Grid input/editing: `tests_grid_input` (43; SRC+jsdom+REAL+spaces).
- Grid accessibility: `tests_grid_a11y` (39; SRC+jsdom+REAL).
- Detection/Variable Settings panel: `tests_panel` (34; SRC+REAL).
- Feasible-region plot: `tests_region_plot` (74; SRC+jsdom+REAL).
- Solve announce/status: `tests_solve_announce` (23; SRC+jsdom+REAL+spaces).
- Examples drawer: `tests_ex_drawer` (21; SRC+jsdom+REAL).
- Localized errors: `tests_error_i18n` (134; SRC+jsdom+REAL).
- Worker parity: `tests_worker_parity` (143; SRC+REAL). Worker token contract:
  `tests_worker_token` (6; SRC).
- Engine states/bounds/safety/strict: `tests_states` (3), `tests_bounds` (12),
  `tests_safety` (56), `tests_strict` (19), `tests_single_var` (25),
  `tests_sumif_criteria` (22) — engine behaviour, REAL execution.
- Examples model math: `tests_examples` (143; REAL).
- Locale/direction: `tests_locale` (29), `tests_direction` (10).
- Structure/hygiene: `tests_structure` (329), `tests_site_hygiene` (242),
  `tests_engine_integrity` (3).

Gaps (candidate D-phase golden targets, not added in D0): there is no single
solver-interface golden that pins the full body region order + ids + data-i18n +
aria + control set + asset versions in one fixture (this D0 fixture is the first);
no explicit spaced-path coverage for the plot/exports suites; no isolation contract
proving the UI extraction does not touch the engine region byte range.

## D0 request accounting (measured, not projected)

- solver.html today: 1 HTML document + 4 external JS + 1 external CSS = 6 requests.
  Engine inline (0 requests). Worker via runtime Blob (0 network requests).
- Sizes: HTML 215539 bytes; inline engine 82697 bytes; UI script 105098 bytes;
  inline style 18061 bytes.
- Any future split into modules would ADD requests unless bundled at build. This is
  measured in D0.7 per option. D is about maintainability and safety, not payload
  reduction; no performance improvement is claimed.

## D0 public-diff statement

During D0: public HTML modified 0; CSS modified 0; public JS modified 0; engine
modified 0; Worker modified 0; requests added 0; payload modified 0; visual
differences none. The only files created are this baseline doc, the proposal doc
(`solver-interface.md`, marked NOT IMPLEMENTED), and the baseline fixture
`engine/fixtures/solver-ui-golden/solver-interface-baseline.json`.

## D0 metrics summary

- solver.html total: 215539 bytes.
- UI (script minus engine): 105098 bytes. Engine: 82697 bytes. Inline style: 18061
  bytes.
- Functions: 191 total in the inline script — 101 UI, 90 engine.
- Module-level UI globals: ~10 state names; 1 exposed (`window.__plumline`).
- UI-level listeners: 14 (+2 document-level).
- DOM regions: ~10 (grid, solve controls, variable settings, status/results,
  examples drawer, plot, exports, live regions, help, dynamic controls).
- Controls: 22 button, 5 input, 4 select, 2 details, 3 table, 2 svg.
- Related test suites: ~20 directly; ~8218 total in the suite.
- Current requests: 6. Proposed modules: see D0.7 (recommendation preserves 6 via
  build-time composition). Files to be created in future phases: TBD per phase.

No reduction in complexity is claimed in D0. D0 increases documentation and adds one
baseline fixture; it changes no behaviour.

## D1 correction (fragment location)

The D0 proposal suggested `assets/solver/` for fragments. D1 places them under the
INTERNAL path `engine/fragments/solver-ui/` instead, so they are never published to
dist, never fetched, and never in the public manifest. See
docs/checkpoint-d1-grid.md. D2 (detection + Variable Settings) added a second
fragment to the same internal directory and composer — see
docs/checkpoint-d2-detection-variable-settings.md. D3 (execution + errors + results)
added three more fragments (worker client, orchestration, results) — see
docs/checkpoint-d3-execution-results.md. D4 (visualization + examples + exports)
added three more (examples-loading, receipt-plot-exports, examples-drawer) and moved
the previously-mixed renderReceipt fully into D4 — see
docs/checkpoint-d4-visualization-examples-exports.md. D5 (bootstrap + accessibility +
final integration) added the ninth fragment (bootstrap-accessibility) and the
cumulative D1–D5 golden/checker; Checkpoint D is complete — see
docs/checkpoint-d5-integration.md.
