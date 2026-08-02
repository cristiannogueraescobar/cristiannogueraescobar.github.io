# Solver interface architecture — IMPLEMENTED (D1–D5 COMPLETE; Checkpoint E not started)

> STATUS: Option D (build-time composition) is fully implemented. D1 (grid), D2
> (detection + Variable Settings), D3 (execution + errors + results), D4
> (visualization + examples + exports), and D5 (bootstrap + accessibility + final
> integration) are all landed. Nine fragments compose byte-identically to the pre-D
> baseline; dist is byte-identical to pre-D. See the checkpoint docs, with
> docs/checkpoint-d5-integration.md as the final summary. Checkpoint E (engine/Worker
> math) is NOT started and is the only phase authorized to change the frozen engine.
> Fragments live under the INTERNAL path `engine/fragments/solver-ui/`, NEVER
> published to dist.

## Subsystem classification (A/B/C/D/E)

Each solver subsystem is classified per the Checkpoint D principle. The engine and
Worker math are class E (frozen for Checkpoint E). Most of the UI is class C
(monolithic but with clear seams) — it is one big inline script, not duplicated
code, so the work is careful extraction, not de-duplication.

- **Grid model + rendering + selection + keyboard + clipboard + undo** — Class C.
  One cohesive subsystem inside the monolith with a clear boundary (owns
  `ROWS`/`COLS`/`grid`/`sheet` + undo stack). Extract as a unit with a stable
  contract; do not fragment into ten tiny files. Already protected by
  `tests_grid_input`, `tests_grid_a11y`.

- **Detection orchestration + Variable Settings UI** — Class C. Presents engine
  detection results and collects per-variable continuous/integer/binary + bounds.
  The DETECTION MATH is class E (inside the engine); only the presentation/collection
  is class C. Protected by `tests_panel`.

- **Solve orchestration + Worker client + fallback** — Class C for the orchestration
  (button state, token issuing, cancel, main-thread fallback), Class E for the
  Worker's math body. The seam is the message contract (token in / result out).
  Protected by `tests_worker_parity`, `tests_worker_token`, `tests_solve_announce`.

- **Results presentation + solve details** — Class C. Formats engine output into
  tables/receipt/summary. Must NOT reinterpret results — it renders what the engine
  returned. Protected by `tests_solve_announce`, `tests_states`.

- **Localized errors** — Class C. Maps engine error phases to localized messages
  (`localizeEngineError`). Class E error CODES stay in the engine; only the
  localization is UI. Protected by `tests_error_i18n` (134).

- **Feasible-region plot** — Class C, with a caveat: several plot helpers
  (`intersect`, `line`, `clipFeasibleToBox_`, `recedes`, `polygonDimension_`) are
  GEOMETRY that borders on math. They are presentation geometry (drawing the 2D
  region), not solver math, but they must be moved verbatim and pinned by golden so
  no tolerance/behaviour shifts. Protected by `tests_region_plot` (74).

- **Examples drawer + loading** — Class C consuming Class D data. `examples-data.js`
  is the single source of truth (a C3 fact). The drawer only renders it; do not copy
  example data into a second source. Protected by `tests_ex_drawer`, `tests_examples`.

- **Exports (CSV/Excel/TXT + download)** — Class C. DOM/state-dependent
  serialization. Extract with care because it reads current grid/result state.

- **Localization glue** — Class B (already correctly organised). `Plumline.i18n`
  is a shared B2 module; the page calls `Plumline.i18n.init('solver')`. Do NOT
  re-implement; document and keep the single init.

- **Shell header/footer** — Class B (B1, composed at build). Out of scope for D.

- **Engine (parser, simplex, branch-and-bound, verification, tolerances, states)**
  — Class E. Frozen. Byte-identical region. Reorganisation is Checkpoint E.

- **Worker math body** — Class E. Frozen. D only documents/protects the
  orchestration around it.

## Architecture options evaluated

**Option A — Single script + internal namespaces.** Keep one inline script; group
functions under internal namespace objects (e.g. `Grid`, `Solve`, `Plot`).
Advantages: zero new requests; no Vite/Pages impact; smallest migration risk; engine
region untouched; dist unchanged. Risks: maintainability gain is modest (still one
file); does not deliver "responsibilities in separate files". Requests added: 0.

**Option B — Ordered classic scripts.** Extract UI subsystems into
`assets/solver/*.js` loaded as classic `<script>` tags in dependency order.
Advantages: real file separation; classic scripts work on GitHub Pages and from
`file://`; no framework; module-scope globals can be preserved via a shared
namespace object. Risks: load-order fragility; each file is a request unless bundled;
must preserve single-binding of listeners; hoisting/`this`/closure changes during
extraction. Vite impact: must be added to the multipage build inputs. Pages impact:
none. Requests added: up to N unless bundled at build.

**Option C — ES modules in the interface.** Extract to ES modules with
`import`/`export`. Advantages: clean boundaries, tree-shakeable, Vite-native. Risks:
ES modules do NOT run from `file://` (breaks local open-the-file use); `type=module`
defers and changes execution timing (i18n/init order); larger blast radius on the
Worker-source extraction; more Vite transformation of the scripts. Pages impact:
works, but the `file://` regression is real for a tool that advertises local use.
Requests added: several in dev; bundled in prod.

**Option D — Build-time composition (like B1 shell).** Author UI subsystems as
separate source fragments; compose them into the single inline script at build time
(the B1 pattern already in the repo). Advantages: separate, maintainable source
files AND byte-identical published output AND zero new requests AND dist unchanged
AND engine region preserved verbatim. Risks: composition must guarantee byte-identity
(golden-gated, exactly like B1/C generators); build step complexity. Vite impact:
reuses the existing compose step. Pages impact: none (output identical). Requests
added: 0.

**Option E — Hybrid.** Build-time composition (Option D) for the published inline
script, with the same source fragments also loadable as ordered classic scripts for
tests/dev. Advantages: all of D plus testability of individual units. Risks: two
assembly paths to keep in sync (mitigated by a golden that asserts the composed
output equals the concatenated fragments).

## Recommendation

**Option D — build-time composition**, following the established B1/C pattern. It is
the only option that satisfies every non-negotiable at once: solver.html URL and
published bytes unchanged, engine region byte-identical, no new requests, no
framework, no SPA, no `fetch` of HTML, GitHub Pages and `file://` both preserved,
dist unchanged. It delivers the actual goal (maintainable, separated source with
clear responsibilities) without paying it in requests or risk to the math.

The interface source is authored as fragments under `engine/fragments/solver-ui/`
(INTERNAL, never published), composed into the existing single inline `<script>` at
build, with a golden asserting the composed script is byte-identical to today's UI
region and that the engine region between the markers is untouched. Concrete module seams (from the
D0.3 map): `state`, `grid`, `selection`, `clipboard`, `undo`, `detection-ui`,
`variable-settings`, `solve-controller`, `worker-client`, `results`, `errors`,
`plot`, `exports`, `examples`, `bootstrap`. This list is derived from the audit, not
forced; fine seams may be merged to avoid over-fragmentation (Class C guidance).

Requests: unchanged at 6 (build-time composition adds no runtime request). No
performance claim is made — the goal is maintainability and isolation.

## Proposed phases (each STOPS for authorisation)

- **D1 — grid + input interaction.** Grid creation, selection, editing, keyboard
  navigation, paste, auto-resize, undo, clipboard, clearing, grid accessibility.
  Extract the grid subsystem as one unit; golden-pin grid DOM + a11y; keep
  `tests_grid_input`/`tests_grid_a11y` green.

- **D2 — detection + Variable Settings.** Detection orchestration, candidate
  presentation, variable selection, continuous/integer/binary config, interface
  validation, messages. The engine's detection math is NOT touched. Keep
  `tests_panel` green.

- **D3 — execution, errors, status, results.** Solve button, run state, Worker
  orchestration, fallback, localized errors, announcements, results, solve details,
  visual states. Engine and Worker math NOT touched. Keep `tests_worker_parity`,
  `tests_worker_token`, `tests_solve_announce`, `tests_error_i18n` green.

- **D4 — plot, examples, exports.** Feasible region drawing, visualization, example
  drawer, example loading, CSV/Excel/TXT export, download. No math change; plot
  geometry moved verbatim and golden-pinned. Keep `tests_region_plot`,
  `tests_ex_drawer`, `tests_examples` green.

- **D5 — accessibility + final integration.** Focus, keyboard, announcements,
  dialogs, reduced motion, responsive, empty states, isolation contract, final
  golden, documentation, cumulative ZIP. Prove the engine region stayed
  byte-identical across all phases.

## Risk register (evaluated, not yet mitigated)

- Heavy module-scope global reliance — extraction must preserve a shared state object
  or namespaces; risk of losing access to private `const`/`let`.
- Script order / hoisting / closures — a handler may reference a variable declared
  later; order-sensitive.
- Extraction changing `this` or scope — method vs free-function binding.
- Double initialisation / duplicated listeners — all listeners currently bind once;
  extraction must not introduce a second binding path.
- Worker stale messages / race conditions — token invalidation is the only guard;
  must be preserved exactly.
- Fallback divergence — `solveMainThread` must stay behaviourally identical to the
  Worker path (parity already tested; keep it).
- Blob Worker + CSP — the runtime Blob Worker must keep working; do not switch to a
  file the CSP/Pages setup may block.
- ES modules + `file://` — reason Option C was rejected.
- Vite transforming scripts — composition must yield byte-identical output.
- i18n init order — `Plumline.i18n.init('solver')` timing must not change.
- examples-data.js single source — do not create a second example source.
- plot depends on result; export depends on DOM — extraction order matters (plot
  after results, export reads live state).
- Windows/Linux + spaced paths — keep LF/UTF-8 and spaced-path behaviour.
- dist differences — every phase must keep dist byte-identical for solver.html.
- Engine touched accidentally — the golden + engine-integrity test must gate every
  phase.

## Non-goals (restated)

No new design, copy, capabilities, examples, languages, math, syntax, results,
limits, tolerances, states, SEO, metadata, URLs, shell, footer, shared assets, DNS,
Render, backend, API, accounts, DB, auth, SPA, or component framework. No dependency
added without stopping to ask.
