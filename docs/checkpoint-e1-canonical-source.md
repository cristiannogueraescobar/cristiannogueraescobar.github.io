# Checkpoint E1 — canonical production engine source

E1 gives the production engine ONE physical, internal, editable source and
composes it build-time into the historical `ENGINE_START..END` position of
`solver.html`. Public output is byte-identical. The engine bytes, the Worker
payload and `engine/engine.js` (the legacy Google Sheets add-on mirror) are
unchanged. **Checkpoint E is NOT complete after E1** — the mirror is consolidated
only in a later phase.

## Baseline reconciliation

- **Base SHA (from the provided `git archive` snapshot's `.git`)**:
  `2832526220e79d3b278497219b030b95c3d6d8dd`, branch cut: `refactor/single-engine`.
- **Main baseline (pre-E0)**: 10231, `tests_composed_reads` 20, on Linux/Node
  22.22.2 — this proved the earlier 10230/10231 gap was NOT platform: my prior
  snapshot simply predated a post-merge assertion (newer, Windows-hardened
  `test_dist_http.js` / `tests_manifest_negative.js` / `tests_examples.js`).
- **Post-E0 reconciled**: 10267, `tests_composed_reads` 21, +36 deterministic.
- **Post-E1**: 10450 (both verify runs identical), +183 from the E1 suites.

## Canonical source

- Path: `engine/source/plumline-engine.js` (internal; NOT under `assets/`,
  `public/` or `dist/`; never published, never a request, never in the manifest).
- **Representation B**: the file IS the official slice —
  `html.slice(indexOf(ENGINE_START), indexOf(ENGINE_END))`: it **includes**
  `/* ENGINE_START */` and **excludes** `/* ENGINE_END */`.
- 2154 lines, 82657 chars, 82697 bytes, LF, UTF-8, verbatim,
  SHA-256 `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`.
- This preserves the `tests_engine_integrity.js` convention exactly and lets the
  composer reconstruct the engine region with a trivial textual substitution.

## Source markers and composition

`solver.html` SOURCE no longer holds the inline engine. In its place, a single
marker pair:

```
/* SOLVER_ENGINE_SOURCE_START:plumline-engine.js */
/* SOLVER_ENGINE_SOURCE_END */
```

The source is 40925 bytes and is **not directly executable**; `composedHtml`
rebuilds the executable solver. The composer replaces `[START marker .. END
marker]` with `(canonical bytes) + /* ENGINE_END */`, so the composed output
carries the historical `ENGINE_START..END` region byte-identically. The
`SOLVER_ENGINE_SOURCE` markers NEVER reach dist; the structural `ENGINE_START`
and `ENGINE_END` DO (they are part of the public contract and the Worker's
`engineSource()` slice).

### One official compositor

`src/shared/compose-solver.js` is the single path used by Vite dev, Vite build,
`composed-html.js`, `validate_dist.js`, and every checker/negative. The
canonical order is:

1. `composeEngineSource()` — restore the engine region from the canonical file.
2. solver-UI composition — restore the 9 fragments.
3. Vite's HTML transform (build only).

`composeEngineSource()` rejects: missing/duplicated/inverted source markers,
residual content between them, a missing/empty canonical file, an absolute path,
traversal, a subdirectory, a disallowed name, a canonical file that doesn't begin
with `ENGINE_START`, a canonical file that contains `ENGINE_END`, a source that
carries both an inline engine and the markers, and a composed slice that doesn't
match the canonical bytes.

### findEngineRegion()

The literals `/* ENGINE_START */` and `/* ENGINE_END */` also appear inside
`engineSource()` as quoted search strings. `findEngineRegion(html)` (exported from
`compose-solver.js`) locates the STRUCTURAL markers — the ones that begin a
comment line (preceded by a newline) — and returns exactly one region or throws.
Tests use it instead of a naive `indexOf/lastIndexOf`.

## Direct path

`runSolve() -> solve() -> detectModel_/solveModel_` run in the same lexical scope
in the composed inline script; `solveMainThread()` is the main-thread fallback.
No runtime imports, ES modules, namespaces, new IIFEs, window properties,
wrappers, exports or extra eval were added — the composed page keeps a single
lexical scope.

## Worker path and the Blob separator

`engineSource()` slices `ENGINE_START..END` from the page's own composed script,
wraps it with the glue, and builds `Blob([src + '\n' + glue])`. Complete hashes:

- engineSource: 82697 bytes, SHA-256
  `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`.
- Worker glue: 900 bytes, SHA-256
  `5bc80049a8575056596b834e45e46b338ae38e095d5abfc2072175d40ab9b7b9`.
- **Separator**: a single LF (`\n`, byte `0x0a`) at offset 82697, inserted by
  `buildWorker` between `src` and `glue`. It is NOT part of the canonical engine
  and was not modified. Arithmetic: `82697 + 1 + 900 = 83598`.
- Blob source: 83598 bytes, SHA-256
  `ec3d60685850dfa5fc43d7a79b0e60028dd7264303734cf7d9cf45413b0e3a05`.

Request `[token, formulas, values, localeMode, wholeNumbers, domains, sense]`;
response ok `[token, ok, out, wholeNumbers]` / err `[token, ok:false, phase,
error]`; token stale guard; `solveMainThread` fallback. Unchanged in E1.

## Legacy mirror: engine/engine.js

`engine/engine.js` (SHA `6190cb47…`) is the Node-requireable Google Sheets add-on
twin, consumed by `harness.js` and the pure-math suites. E1 does NOT modify,
generate or consolidate it. Full inventory vs the canonical source:

- 90 declarations / 89 unique names in BOTH files; 0 production-only, 0
  mirror-only; 89 shared; **87 equivalent**, **2 divergent**.
- Constants: 10 shared, 0 divergent (`MAX_DEPTH 40`, `BRANCH_NODES 4000`,
  `BRANCH_DEPTH 60`, `BRANCH_MILLIS 20000`, `EPSILON 1e-9`, `PIVOT_TOLERANCE
  1e-7`, `MAX_ITERATIONS 20000`, `MAX_SCAN_COLUMNS 4`, `FREE_VARIABLE_LIMIT 50`,
  `FREE_CONSTRAINT_LIMIT 20`).
- Mirror entry points (`module.exports` api, 20): ENGINE, detectModel_,
  solveModel_, detectLocale_, normalizeFormula_, normalizeValue_,
  isFormulaInput_, formulaCellText_, classifyGridCell_, optimise_,
  classifyModel_, buildVariableDomains_, feasibleAt_, dotProduct_, pivot_,
  finiteModel_, validModelShape_, senseFor_, loadGrid_, readConstraint_.
- Production entry points: detectModel_, solveModel_ (direct + Worker, same scope).

The comparison normalisation ignores ONLY comments, whitespace and CRLF/LF. It
must NOT ignore parameters, literals, operators, calls, returns, conditions,
branch structure or defaults. The contract fails on a third divergence, a
vanished shared name, a mis-classified exclusive, or a divergent constant.

### dotProduct_ (declared twice)

`dotProduct_` is declared TWICE in BOTH files: production lines 291 and 1628;
mirror lines 305 and 1680. Each is a **nested** function local to its enclosing
function — the first inside `isWhole_`, the second inside `isSatisfied_`. Because
they live in separate function scopes there is no top-level hoisting conflict and
neither shadows the other; each enclosing function sees only its own. The two
bodies are not byte-identical (parameter names `coeffs`/`values` vs
`coefficients`/`values`, one-line vs braced loop) but compute the same sum of
products, so behaviour is equivalent. Consumers: `isWhole_`, `isSatisfied_`.
Exercised by `tests_safety`, `tests_states`, `tests_bounds` (via the mirror) and
`tests_worker_parity` (inline).

### The two approved functional divergences

1. **`newContext_`** — platform policy. Production forces
   `allowCachedFormulaFallback:false` (web grid stores 0 for formulas); the mirror
   parameterises it via an `options` argument (Sheets cached value is exact).
   Different parameter list and default. A real functional divergence, not
   comments.
2. **`readConstraint_`** — conditional structure. Production combines the guard as
   `if (limitFormula !== null && variables) {...}`; the mirror nests
   `if (limitFormula !== null) { if (variables) {...} }`. Same
   `allowCachedFormulaFallback:false` context is built inside; the branch
   STRUCTURE differs. A real functional divergence, NOT comments-only.

## Tests, fixture, allowlist

- Fixture `engine/fixtures/single-engine/engine-e1-source.json` — full (never
  abbreviated) hashes for canonical file, slice, inner bytes, markers, script
  inline, UI pre/post-engine, composed solver, dist, engineSource, glue,
  separator, Blob, contracts, mirror inventory, dotProduct_, divergences,
  constants, requests, asset versions, provenance, `do_not_regenerate`.
- Checker `checkCanonicalEngineSource(siteDir)` — the ONE authority (50
  assertions), used by both the positive and negative suites; uses the official
  compositor, never re-implements composition.
- Positive suite (11), negative suite (38 cases / 76 assertions),
  `tests_e1_needle_audit` (46) enforcing a specific needle per negative with a
  closed integrity-hash allowlist.
- Adapted to compose/canonical reads: `tests_engine_integrity` (3),
  `tests_engine_baseline` (20) + negative (16), `tests_structure` (329),
  `tests_shell_isolation` (86), `tests_shared_behavior_negative` (25),
  `tests_examples` (143), and the 5 solver negatives (grid 121, detection 185,
  execution 213, visualization 240, interface_final 103) — their engine
  mutations now target the canonical file.
- RAW_SOURCE_ALLOWLIST: pre-E 17 → post-E0 18 → post-E1 18. Removed
  `tests_engine_integrity.js` and `tests_engine_baseline.js` (now composed
  reads); added `tests_canonical_engine_source.js` and
  `tests_canonical_engine_source_positive.js` (feed the official compositor, case
  C). No negative is in the allowlist.

  > Reconciliation note (computed from `.git`): the allowlist at the base commit
  > `2832526…` is **17** entries. An earlier E-series summary said "18 pre-E";
  > that figure was actually the **post-E0** count (17 + `tests_engine_baseline.js`,
  > which E0 itself added). The authoritative progression is pre-E **17** →
  > post-E0 **18** → post-E1 **18**, verified programmatically against
  > `engine/tests_composed_reads.js` in each state, not from documentation.

## How to edit the engine from E1 on

Edit `engine/source/plumline-engine.js` (keep the leading `/* ENGINE_START */`,
do NOT add `/* ENGINE_END */`, keep LF/UTF-8). Never edit the generated engine
region inside a composed page, and never edit the `SOLVER_ENGINE_SOURCE`
placeholder region of `solver.html` by hand except to move the markers
deliberately. Re-run `npm run build && npm run verify`; the E1 checker and
`validate_dist` enforce byte-identity.

## Rollback

E1 is structural and reversible without touching A–D: inline the canonical file's
bytes back between `ENGINE_START`/`ENGINE_END` in `solver.html`, delete
`engine/source/`, revert the `composeEngineSource` step and the E1 test
adaptations. The public output is byte-identical either way, so a rollback
changes nothing users see.

## Still pending (E2–E6)

E2 parser / references / ranges / validation / linearisation; E3 model
construction / bounds / domains / continuous simplex; E4 branch-and-bound /
integer / binary / mixed / limits; E5 verification / states / stop reasons /
errors; E6 Worker / fallback / **mirror reconciliation** (make `engine/engine.js`
a derivative of the single source) / error accessibility / final golden / ZIP.
Each phase stops for authorization and never mixes a file move with an algorithm
change.


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
