# Checkpoint D2 — detection & Variable Settings extraction

D2 extracts the contiguous detection-orchestration + Variable-Settings region of the
solver UI into a second internal fragment, composed back at build time so the public
output stays byte-identical to the pre-D baseline. It changes NO detection math.

## UI vs mathematical audit

The Checkpoint-D principle: D2 separates the detection/Variable-Settings INTERFACE,
it does not change how a model is detected. The split as audited:

- **Frozen engine detection-math (Class E, NOT touched):** `detectModel_`,
  `classifyModel_`, `buildVariableDomains_`, `candidateIsLinear_`, `linearize_`,
  `coefficientVector_`, `describeModel_`, `loadGrid_`, `labelFor_`, `expandRange_`,
  `cellAt_`, and every formula/linearity/coefficient routine. These stay inside the
  engine region and are called by the UI, never reimplemented.
- **Extracted UI/orchestration (Class B in D2 terms):** the region reads the grid,
  requests detection through the existing engine API (`detectModel_`), receives
  candidates, presents them, renders Variable Settings, captures
  continuous/integer/binary + bounds, validates the user's input, shows localized
  messages, and converts the UI settings to the existing contract Solve consumes.

## Architecture as implemented

- **Fragment created (2nd):** `engine/fragments/solver-ui/variable-settings.js` —
  12469 bytes. Verbatim contiguous region (source lines 2917–3168, before markers)
  holding 15 functions: `objectiveSignature`, `sameObjective`, `senseConfirmed`,
  `updateSenseHint`, `resetVarPanel`, `setDetectLabel`, `detectForPanel`,
  `settingsFor`, `cleanBound`, `varError`, `showVarError`, `anyVarError`,
  `hasCustomSettings`, `renderVarPanel`, `variableDomains` (first fn
  `objectiveSignature`, last fn `variableDomains`), plus the panel state var
  `confirmedObjectiveSig`.
- **Source markers:** `/* SOLVER_UI_VARIABLE_SETTINGS_START:variable-settings.js */`
  … `/* SOLVER_UI_VARIABLE_SETTINGS_END */`, placed at the region's original
  position (after the D1 grid markers, before `solve`).
- **Composer:** the SAME `src/shared/compose-solver.js`. The CLOSED allowlist
  `REGIONS` now has two entries in canonical order:
  `GRID_INTERACTION` → `grid-interaction.js`, then
  `VARIABLE_SETTINGS` → `variable-settings.js`. No separate D2 composer.

## Functions extracted / deliberately NOT extracted

- **Extracted (15):** listed above — all detection/Variable-Settings UI.
- **Deliberately NOT extracted:** `metaFor`, `categoryOf`, `slugOf`, `senseOf`,
  `typeOf` (one-line helpers at ~2741, interleaved with example/model metadata used
  across phases); `modelChanged` (~3284, sits amongst D3 solve code); `syncGridTools`
  (already in the D1 grid fragment). Engine detection-math functions are NOT
  extracted (they are Class E). No UI-side reimplementation of detection was created.
- The detectVars button LISTENER lives in the post-engine bootstrap (not in the
  fragment); it is protected by the `ui_post_engine`/body golden.

## Composition order (unchanged, canonical)

shell (B1) → solver-UI (D: grid then variable-settings, in `REGIONS` order) → Vite.
Used by Vite dev/build, `engine/composed-html.js`, `engine/validate_dist.js`, and
the D1 + D2 checkers. Each step is a no-op when its markers are absent.

## source vs composed vs dist (three distinct states)

- **source** `solver.html`: 4054 lines / 190909 bytes. Reorganised: grid + Variable
  Settings regions are now marker blocks. This file necessarily changed.
- **composed (solver-UI, before Vite)**: 215539 bytes — byte-identical to the pre-D
  solver.html baseline; this is what `composeSolverInterface` returns (the inline
  script reconstructed).
- **dist public** `dist/solver.html`: 218349 bytes, SHA `4dbf1a8a…` — byte-identical
  to the pre-D1 dist. The difference vs the composed solver-UI is the B1 shell
  expansion, which pre-dates D. Do NOT conflate the intermediate composed hash/size
  with dist/solver.html.

## Contracts (documented, not invented)

- **Detection → UI:** entry `detectForPanel(opts)` calls the engine entry
  `detectModel_(sheet, localeMode)`; candidates are collected into the state var
  `detectedVars` as objects with fields `{cell, label}` (`label` from the engine's
  `labelFor_`). Settings for cells no longer decision variables are dropped so a
  stale invalid bound cannot block solving invisibly (existing behaviour, preserved).
- **Variable Settings → Solve:** entry `variableDomains(variableCells, wholeToggle)`
  returns `{ integer, bounds }` where `bounds` is a list of `{lower, upper}` and
  `integer` is an index list or `false`. Types offered: `continuous`, `integer`,
  `binary`. This is the existing contract Solve consumes; D2 did not rename any
  property or add any format conversion.

## Variable Settings protected surface

Root `#varSettings` / `#varSettingsBody`; controls `#detectVars`, `#whole`,
`#senseSel`, `#senseHint`; type options continuous/integer/binary; default values,
lower/upper bounds, validation (`varError`/`anyVarError`/`showVarError`), messages,
apply (`variableDomains`), open/close, focus, keyboard, data-i18n, ARIA, labels,
roles, visible/hidden state. The published terminology, mixed-model behaviour, and
the mathematical limits (when a variable is integer/binary) are unchanged.

## State

D2 state: detected candidates (`detectedVars`), per-variable settings
(`varSettings`), panel staleness (`panelStale`), confirmed objective signature
(`confirmedObjectiveSig`), plus references to `whole`/`senseSel`/grid/`sheet`. The
extraction moves the code verbatim into the same lexical scope, so no state is
duplicated, no second copy is created, nothing becomes a new `window` property, the
lifecycle is unchanged, and the existing invalidation (dropping settings for removed
variables) is preserved.

## Listeners

Listeners for detectVars and Variable-Settings controls remain in the post-engine
bootstrap; the fragment holds only functions. Composition is verbatim and
idempotent, so no listener is duplicated. Handlers are not converted to delegation.

## i18n and errors

The solver namespace, data-i18n keys, detection/ambiguity/incomplete-model messages,
Variable-Settings and bound/type error strings, and `localizeEngineError` usage are
all unchanged across en/es/pt/de/fr. No raw English string was added, `err.message`
is not shown directly, no key or fallback or resolution priority changed, and
`assets/i18n.js` was not modified.

## How to …

- **Edit detection UI or Variable Settings:** edit
  `engine/fragments/solver-ui/variable-settings.js`, then update the D2 golden. Do
  NOT edit the region inside solver.html — it is a marker block.
- **What belongs to Checkpoint E:** all detection math (`detectModel_` and the
  parser/linearity/coefficient routines) — frozen; never move them into a fragment
  or reimplement them in the UI.
- **Update the golden:** re-capture
  `engine/fixtures/solver-ui-golden/solver-detection-d2.json` from the composer
  output (never from the validating test), then run the suites.
- **Run tests:** `node engine/tests_solver_detection.js` (107 after the v4 dist-determinism + functional-needle correction),
  `node engine/tests_solver_detection_negative.js` (185), or `npm run verify`.
- **Revert D2 without reverting D1 or A–C:** reinsert the variable-settings fragment
  bytes in place of its marker block in solver.html, delete
  `engine/fragments/solver-ui/variable-settings.js`, remove the `VARIABLE_SETTINGS`
  entry from `REGIONS` in `src/shared/compose-solver.js`, delete the two D2 suites
  and the D2 golden, remove the two suite names from `engine/suites.js`, and remove
  the `tests_solver_detection.js` allowlist entry. D1 (grid fragment + composer +
  D1 suites) and A/B/C are untouched.

## Engine and Worker stay intact

The engine region is byte-identical: 82657 chars / 82697 bytes / SHA
`5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`. No detection
function was moved out of the engine, none was copied into a fragment, and no
UI-side detection math was written. The Worker (engineSource, glue, Blob,
createObjectURL, constructor, messages, tokens, cancellation, fallback,
serialization) is unchanged: parity 143, token 6.

## Metrics (before → after D2)

- solver.html source: 4304 lines / 203280 bytes → 4054 lines / 190909 bytes.
- composed solver-UI: 215539 bytes (== baseline, unchanged).
- dist/solver.html: 218349 bytes, unchanged vs pre-D1.
- Fragments: 1 (D1) → 2 (D1 grid-interaction.js 12354 b + D2 variable-settings.js
  12469 b).
- D2 functions extracted: 15. Engine math functions NOT extracted: all of them.
  Globals extracted: 0 (stay in the shared scope). Listeners moved: 0.
- Requests 6 → 6. Public payload unchanged. Manifest / requiredPaths unchanged.
- New files: 3 (variable-settings.js, tests_solver_detection.js,
  tests_solver_detection_negative.js) + 1 golden (solver-detection-d2.json) + this
  doc.
- Modified: solver.html (D2 markers), src/shared/compose-solver.js (REGIONS +1),
  engine/suites.js (+2 suites), engine/tests_composed_reads.js (+1 justified
  allowlist entry), engine/tests_solver_grid_negative.js (makeTree copies all
  fragments — a mechanical shared-test adaptation).
- Tests: 8367 → 8573 (+206: +92 D2 checker, +113 D2 negatives, +1 composed-reads
  guard entry).
- RAW_SOURCE_ALLOWLIST: 15 → 16 keys (+1 justified: tests_solver_detection.js reads
  source only to compose+validate; negatives NOT allowlisted).
- Engine 82657/82697/5d68ed17 unchanged. Worker parity 143, token 6 unchanged.

Distinctions (not a complexity reduction): the main source file shrank again; the
number of internal fragments rose by one; the public payload is unchanged; build
complexity rose slightly (the same composer, one more allowlisted region);
maintainability improved (detection UI + Variable Settings are now an isolated,
golden-pinned unit); the mathematical logic is byte-for-byte unchanged.

## Public differences intended: none

Public HTML/CSS/JS: unchanged. dist/solver.html byte-identical to pre-D1. Requests
6 → 6. Payload unchanged. Visual differences: none.

## Follow-up (D3)

D3 added three more fragments (solve-worker-client.js, solve-orchestration.js,
errors-results.js) to the same composer and `REGIONS` allowlist. The canonical order
became GRID_INTERACTION → SOLVE_WORKER_CLIENT → VARIABLE_SETTINGS →
SOLVE_ORCHESTRATION → SOLVE_RESULTS (the worker-client region sits between the D1 and
D2 markers in source). D2's variable-settings fragment, its 15 functions, and its
suites are unchanged. See docs/checkpoint-d3-execution-results.md.

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
