# Checkpoint D5 — final solver interface integration

D5 is the final phase of Checkpoint D. It extracts the remaining bootstrap +
accessibility code into one fragment, establishes the cumulative D1–D5 golden and
checker (the authority for the exact global region order), hardens the composer, and
finalizes the documentation. It changes NO mathematical contract and NO Worker
behaviour; the composed output stays byte-identical to the pre-D baseline.

## Final architecture

Three states, unchanged in kind since D1:
- **source** `solver.html` (2802 lines / 123556 bytes): the reorganized page — the
  engine region, nine `SOLVER_UI_*` marker blocks, the inline `<style>`, the shell
  markers, and the module-level + IIFE-head code that legitimately stays inline.
- **composed solver-UI** (215539 bytes): byte-identical to the pre-D baseline. The
  composer replaces each marker block with its fragment's bytes.
- **dist/solver.html** (218349 bytes, SHA `4dbf1a8a…`): the shell-expanded public
  artifact, byte-identical to pre-D. No markers, no fragment paths, no published
  fragments.

## Nine fragments (canonical order)

```
EXAMPLES_LOADING → GRID_INTERACTION → SOLVE_WORKER_CLIENT → VARIABLE_SETTINGS →
SOLVE_ORCHESTRATION → SOLVE_RESULTS → RECEIPT_PLOT_EXPORTS → EXAMPLES_DRAWER →
BOOTSTRAP_ACCESSIBILITY
```

| Fragment | bytes | phase |
|---|---|---|
| examples-loading.js | 2948 | D4 |
| grid-interaction.js | 12354 | D1 |
| solve-worker-client.js | 4551 | D3 |
| variable-settings.js | 12469 | D2 |
| solve-orchestration.js | 8007 | D3 |
| errors-results.js | 4773 | D3 |
| receipt-plot-exports.js | 33488 | D4 |
| examples-drawer.js | 3486 | D4 |
| bootstrap-accessibility.js | 10805 | D5 |

## D5 extraction

The D5 fragment `bootstrap-accessibility.js` (181 lines / 10805 bytes) is the single
contiguous, brace-balanced bootstrap region at the tail of the IIFE (between the
EXAMPLES_DRAWER marker and the IIFE's `})();`). It moves verbatim and contains:
- the examples-drawer bootstrap listeners deferred from D4 (openExamples /
  closeExamples / exDrawerBackdrop click, and the drawer keydown/Escape handler);
- the solve/grid listeners (solve, clear, addRow/delRow/addCol/delCol, undoGrid,
  detectVars);
- the Variable-Settings listeners (whole, senseSel, localeSel);
- the CSV-import listeners (importCsv, csvFile);
- the grid keyboard handler;
- `runSelfTest` and its button binding;
- the language selector;
- the `?ex=` URL initialization and the default-example load (`'production'`);
- the test-only hook `window.__plumline` (guarded by `window.__PLUMLINE_TEST__`,
  inert in production) that the a11y test battery drives.

## Code that remains inline (and why)

Not everything left in solver.html is extracted — per the D5 principle, a fragment is
not created just to empty the source:
- **Module-level shared utilities** (`t`, `localizeEngineError`, `colLetter`,
  `applyLang`, and `var LANG`) live OUTSIDE the IIFE and are shared by BOTH the engine
  and the IIFE. Moving them into a fragment would break the shared scope. They stay
  inline (a checker assertion enforces they are NOT in any fragment).
- **IIFE-head state and example data** (`ROWS`/`COLS`/`data`/`blank`, the `EXAMPLES`
  catalog, `CATEGORY_ORDER`/`EXAMPLE_META`/`EXAMPLES_OK`, and the
  `metaFor`/`categoryOf`/`slugOf`/`senseOf`/`typeOf`/`examplesInCategory` helpers) are
  shared initialization/data consumed by multiple regions. Kept inline as bootstrap
  source rather than forced into a fragment.
- **`esc`** (shared HTML-escape) and **`currentLocaleMode`** (shared, used by D2)
  remain inline as decided in D3/D4.

## Bootstrap initialization order (protected)

The composed page runs, in order: module-level i18n utils → engine → IIFE-head state
+ EXAMPLES + helpers → the nine fragment regions in order → the bootstrap region
(drawer listeners → Escape keydown → solve/grid listeners → VS listeners → import
listeners → grid keyboard → runSelfTest → lang selector → `?ex=` init +
`loadExample`) → the test hook → `})();`. The golden pins this by byte-identity of
the composed inline script; the final checker additionally asserts the presence and
single registration of each listener.

## Composer hardening (D5)

The composer gained ONE new guard: once a page carries ANY solver-UI marker, EVERY
region declared in the closed `REGIONS` array must have a marker in the source. A
region declared but missing from the source would otherwise silently drop its
fragment. A page with zero markers ("not yet migrated") is handled earlier and never
trips this. This does NOT change the composed output (still byte-identical 215539 b).

## Order-contract review (D4 → D5)

D4 relaxed `tests_solver_execution.js`'s order check from the full marker list to a
**canonical-relative subsequence**, so a later phase could add regions without a
false failure. D5 preserves that (D3 and D4 checkers each verify only their own
regions' relative order) and moves the authority for the EXACT global order of all
nine regions into `checkSolverInterfaceFinal`. Net coverage is higher, not lower: the
exact full order is now pinned in one authoritative place, and the composer itself
rejects a missing or out-of-order region.

## Final golden + cumulative checker

- `engine/fixtures/solver-ui-golden/solver-interface-d5-final.json` — head/body/style/
  inline-script/ui-pre/engine/ui-post SHAs+bytes, the nine fragments + exact order,
  the inline-remaining inventory, the bootstrap contract, aria/live/role counts,
  external scripts, css version, requests, and the dist public hash. **Provenance
  (three classes, matching the fixture's `note` and `provenance` block exactly):**
  (1) INDEPENDENT HISTORICAL SOURCE, re-compared against a pre-D / pre-phase fixture
  by `tests_no_selfgen_golden.js` — head/body/engine/style(inner)/ui_script/
  external_scripts/css_version (pre-D D0 baseline `solver-interface-baseline.json`);
  composed_total/inline_script/ui_pre_engine/ui_post_engine/requests/dist_public/
  controls (D1 phase golden; composed_total cross-checked == 215539 pre-D bytes); the
  eight earlier fragment SHAs (D1–D4 per-phase goldens); aria.aria_attrs and
  data_i18n_count (D2 and D4 phase goldens). (2) REVIEWED D5 CAPTURE, captured once
  during D5 from the composed baseline with no earlier fixture to compare against —
  the bootstrap-accessibility fragment SHA, aria.tabindex/live/role_status,
  bootstrap_contract, inline_remaining, fragment_order. (3) MANUALLY-DERIVED CONTRACT,
  hand-written and not captured — d5_contract_patterns. `tests_no_selfgen_golden.js`
  pins the fixture's own SHA-256 (accidental-change guard for classes 2 and 3) AND
  re-compares every class-(1) field against its historical fixture
  (independent-provenance guard), so the expected can never be silently re-derived
  from the thing it validates.
- `checkSolverInterfaceFinal(siteDir)` — the authoritative cumulative D1–D5 contract.
  It INVOKES the four phase checkers (each failure names its phase) and adds the
  global contracts: exact global region order, the composer REGIONS order, the D5
  bootstrap contract, the inline-remaining utilities, final byte-identity of
  head/body/style(inner)/engine/ui-script-no-engine, and the publication contract. It
  does NOT duplicate the phase checkers' hundreds of assertions.

## Accessibility (cumulative, protected)

Grid role/keyboard/tabindex/aria-selected labels; `#solveAnnounce` and the aria-live
polite regions; `role="status"`; disabled/busy on Solve/Cancel; Variable-Settings
labels; the drawer's focus management (`backgroundEls`), Escape-to-close, backdrop
click, and focus return; details/summary; the plot SVG; the export buttons; accessible
names; focus after error and after result; keyboard-only operation. All pinned by the
composed body/inline-script byte-identity and by the final checker's aria/role counts.

## How to …

- **Edit the bootstrap/listeners/a11y wiring:** edit `bootstrap-accessibility.js`,
  then update the D5 final golden. Do NOT edit this region inside solver.html — it is a
  marker block.
- **Edit any earlier subsystem:** edit its fragment (see the D1–D4 docs), then update
  that phase's golden AND re-run the final checker.
- **Add a fragment (future phase):** add a marker block in the source at its historical
  position, add the region to `REGIONS` in canonical order, create the fragment,
  capture/extend the golden, and add the region to the final golden's `fragment_order`.
  The composer's completeness guard will reject a declared-but-unmarked region.
- **Update fixtures (provenance matters):**
  - The D1–D4 per-phase goldens are captured from an APPROVED PRE-PHASE composed
    output that is independent of the test that validates them — never from the
    checker under test.
  - `solver-interface-d5-final.json` is assembled by COMBINING three provenance
    classes (stated per-field in the fixture's `provenance` block): (1) independent
    historical sources re-compared by `tests_no_selfgen_golden.js` — the pre-D D0
    baseline (head/body/engine/style/ui_script/external_scripts/css_version), the D1
    phase golden (composed_total/inline_script/ui_pre_engine/ui_post_engine/requests/
    dist_public/controls, composed_total cross-checked == 215539 pre-D bytes), the
    D1–D4 per-phase goldens (the eight earlier fragment SHAs), and the D2/D4 phase
    goldens (aria.aria_attrs, data_i18n_count); (2) reviewed D5 captures with no
    earlier fixture to compare against (bootstrap-accessibility SHA, aria.tabindex/
    live/role_status, bootstrap_contract, inline_remaining, fragment_order); (3) the
    manually-derived d5_contract_patterns.
  - It must NEVER be regenerated automatically from the composer during
    `npm run verify`; `tests_no_selfgen_golden.js` pins its SHA-256 to enforce this.
  - When you deliberately change the final golden, also update `PINNED_SHA` in
    `tests_no_selfgen_golden.js` after review.
- **What belongs to Checkpoint E:** all engine math and the Worker mathematical
  payload/glue. D never touched them; E is the only place authorized to change them.
- **Revert D without reverting A–C:** reinsert every fragment block in place of its
  marker in solver.html, delete the nine fragments, empty `REGIONS`, delete the D1–D5
  suites/goldens, remove them from `engine/suites.js`, remove the D allowlist entries,
  revert the composer's D5 completeness guard, and restore the raw reads that D
  redirected to `composedHtml`. A/B/C are independent and untouched.

## Engine and Worker stay intact

Engine region byte-identical: 82657 chars / 82697 bytes / SHA
`5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`. Worker parity 143,
token 6 — unchanged.

## Metrics (Checkpoint D overall: pre-D → final)

- solver.html source: 4573 lines / 215539 bytes → 2802 lines / 123556 bytes
  (−1771 lines / −91983 bytes; ~43% smaller).
- composed solver-UI: 215539 bytes → 215539 bytes (unchanged, byte-identical).
- dist/solver.html: 218349 bytes → 218349 bytes (unchanged, byte-identical).
- Fragments: 0 → 9 (total 92881 bytes of internal, never-published fragment source).
- Functions/regions extracted by phase: D1 grid (20 fns), D2 detection + Variable
  Settings (15 fns), D3 execution + worker client + results (17 fns), D4 receipt +
  plot + exports + examples (22 fns), D5 bootstrap + a11y (one contiguous region).
- Remaining inline: module-level i18n utils (t/localizeEngineError/colLetter/applyLang/
  LANG), IIFE-head state + EXAMPLES + example helpers, esc, currentLocaleMode.
- Requests: 6 → 6. Public payload: unchanged. Manifest / requiredPaths: unchanged.
- Tests: 8218 (end of C) → 10230 (DETERMINISTIC — identical with or without a dist
  build present; the per-phase checkers no longer gate assertions on dist existence,
  dist byte-identity is validated post-build by validate_dist.js). Increment +2012
  across D. New negative CASES across D: 33 (D1) + 50 (D2) + 57 (D3) + 64 (D4) +
  27 (D5) = 231 cases; negative ASSERTIONS across D: 121 (D1) + 185 (D2) + 213 (D3) +
  240 (D4) + 103 (D5) = 862. Positive checker ASSERTIONS: 75 (D1) + 107 (D2) +
  138 (D3) + 158 (D4) + 124 (D5) = 602. Needle auditor: 516 (includes a per-checker
  guard that no positive checker reads dist/solver.html). Anti-selfgen provenance
  suite: 38. Every checker-based negative (170 calls) asserts a SPECIFIC functional
  failure message; only 12 declared drift/prior-fragment/golden-tamper cases keep a
  hash/bytes needle, the other 158 are functional-specific.
- RAW_SOURCE_ALLOWLIST: 21 (end of C) → 18. Removed 8 during D (7 obsolete solver
  raw-reads redirected to composedHtml in D1, + tests_status_coverage.js in D5); added
  5 (one composer-contract checker per phase). Net −3.
- New files across D: 9 fragments + 12 suites (5 checkers + 5 negatives +
  tests_no_selfgen_golden + tests_needle_audit) + 6 goldens + 6 docs + the composer.
  Modified: solver.html, compose-solver.js, suites.js, tests_composed_reads.js, several
  shared test adaptations, vite.config.mjs, composed-html.js, validate_dist.js.
- Engine 82657/82697/5d68ed17 unchanged. Worker parity 143, token 6 unchanged.

Distinctions: the main source file shrank ~43%; internal fragment source and test code
grew (protection, not payload); the public payload, performance, geometry, export
formats, and all mathematics are byte-for-byte unchanged; maintainability and
regression protection improved substantially (every subsystem is now an isolated,
golden-pinned unit with positive + negative coverage).

## Public differences intended: none

Public HTML/CSS/JS: unchanged. dist/solver.html byte-identical to pre-D. Requests
6 → 6. Payload unchanged. Visual differences: none.

## Checkpoint E boundary

Checkpoint E is NOT started. It is the only phase authorized to change the engine math
or the Worker mathematical payload/glue. D reorganized the UI around a frozen engine;
E would work on the engine itself.
