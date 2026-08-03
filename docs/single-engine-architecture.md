# Single-engine architecture — Option B/F IMPLEMENTED IN E1 (structural phase)

> Update: the recommended Option B/F below was implemented in Checkpoint E1 —
> the engine is now the internal canonical file engine/source/plumline-engine.js,
> composed build-time into ENGINE_START..END, dist byte-identical, direct/Worker
> on the same bytes. engine/engine.js remains the legacy mirror (later phase).
> See docs/checkpoint-e1-canonical-source.md. The original proposal follows.


This document proposes the target architecture for Checkpoint E. **Nothing here
is implemented.** E0 is baseline + inventory only. Names and paths are
indicative.

## Problem statement (from the E0 evidence)

- The **production** engine is one physical source: the inline region of
  `solver.html` (ENGINE_START..END). Direct execution and the Web Worker both
  consume **exactly those bytes** (engineSource SHA == canonical SHA), so there
  is **no production math duplication**.
- But a **second real source** exists: `engine/engine.js`, the Google Sheets
  add-on twin. 87/89 function bodies are byte-identical after normalisation; 2
  diverge by platform policy only (`newContext_`, `readConstraint_`). The two are
  kept in sync **manually**, which is the real divergence risk.
- The production contract is **coupled to `solver.html`**: the Worker slices the
  page's own script text to get the engine. There is no standalone editable
  engine file for production.

So the E goal "a single canonical, editable engine source" means: give production
a **single physical file** that is composed into `solver.html` at build time
(byte-identical output), and make the add-on twin a **derivative of that same
file** rather than a hand-maintained parallel copy.

## Options

**Option A — keep the engine inline in solver.html as canonical.** Single
production source already, zero output change, but no standalone editable file and
the add-on twin stays a manual parallel copy. Lowest effort, does not meet the E
goal of one editable source shared with the add-on.

**Option B — move the engine verbatim to an internal file, compose build-time.**
e.g. `engine/source/plumline-engine.js`, injected between ENGINE_START/END at
build. One editable production source; dist byte-identical if the injection is
exact. The Worker keeps slicing the composed page, so direct/Worker parity is
preserved for free. The add-on twin can later be generated from the same file.
Follows the proven D compositor pattern (`compose-solver.js`).

**Option C — internal file + runtime bundle.** Adds a build bundle step and risks
byte drift / an extra request. Rejected: no new requests allowed, GitHub Pages
must stay sufficient.

**Option D — ES module shared by UI and Worker.** Cleanest in theory, but a
module Worker + `import` changes requests and CSP, breaks `file://`, and would
alter public output. Rejected for this product.

**Option E — external Worker file.** Adds a network request and a separate public
artifact; breaks `file://`. Rejected.

**Option F — build-time hybrid: one internal source, inline-composed for direct
execution, same bytes reused for the Blob Worker, zero new requests, dist
byte-identical initially.** This is Option B stated in full, and it matches the
current Worker mechanism (the Worker already reuses the inline bytes). Preferred.

## Analysis grid

| criterion | A | B/F | C | D | E |
|---|---|---|---|---|---|
| single editable source | no | **yes** | yes | yes | yes |
| dist byte-identical initially | yes | **yes** | risk | no | no |
| new requests | 0 | **0** | risk | +1 | +1 |
| works on `file://` | yes | **yes** | risk | no | no |
| GitHub Pages sufficient | yes | **yes** | yes | yes | yes |
| Vite fit | yes | **yes** | extra | extra | extra |
| CSP unchanged | yes | **yes** | risk | no | risk |
| Worker Blob unchanged | yes | **yes** | risk | no | no |
| direct/Worker byte parity | yes | **yes** | risk | risk | risk |
| test rework | none | **moderate** | high | high | high |
| Windows / spaced paths | ok | **ok** | ok | ok | ok |
| rollback ease | n/a | **easy** | medium | hard | hard |
| byte-transform risk | none | **low** | high | high | medium |
| maintainability | low | **high** | medium | high | medium |

## Recommendation

**Option B/F: move the engine verbatim into one internal file and compose it
build-time into the historical ENGINE_START..END position, keeping direct
execution and the Worker on the same bytes, zero new requests, dist/solver.html
byte-identical in the first structural phase.** This accepts the E0 preferred
hypothesis, with the evidence: the Worker already reuses the inline bytes, and the
D compositor pattern already gives a proven, reversible build-time injection with
byte-identity guards.

Reject the hypothesis's silent assumption of "engine duplication inside
production": there is none. The consolidation that matters is **inline vs add-on
twin**, addressed by making `engine/engine.js` a derivative of the single source
in a later phase rather than a hand-kept copy.

## Proposed E roadmap

- **E0** — baseline, inventory, architecture (this checkpoint). No engine move.
- **E1** — physical single source: extract the engine verbatim into an internal
  file (e.g. `engine/source/plumline-engine.js`, NOT under `assets/`), compose it
  build-time into ENGINE_START..END. Output byte-identical; direct/Worker exact
  source parity; dist/solver.html unchanged. Structural only — no math change.
- **E2** — formalise parser / references / ranges / validation / linearisation
  contracts against the single source (tests point at it; still no math change).
- **E3** — model construction, bounds, domains, continuous simplex contracts.
- **E4** — branch-and-bound, integer/binary/mixed, limits contracts.
- **E5** — verification, states, stop reasons, error taxonomy contracts.
- **E6** — Worker, fallback, add-on-twin reconciliation (make `engine.js` a
  derivative of the single source), error accessibility, final golden, ZIP.

Each future phase stops for authorization, keeps output byte-identical when
structural, and never mixes a file move with an algorithm change. Algorithm
changes are out of scope until a later, explicitly authorized phase.

## Key risks (E1 onward)

Accidental byte change; scope/hoisting/closure shifts if the engine leaves the
IIFE; the Worker `engineSource()` slice breaking if markers move; the 9 `eval`
test suites and the `require('./engine.js')` suites depending on exact text;
Vite transforming the injected code; line endings / Unicode / `Buffer.byteLength`;
Windows and spaced paths; the plot's same-named `normalizeConstraint_`; and
CSP / `file://` if the injection method changes. E1 must inject verbatim and prove
dist byte-identity before anything else.


## Update: E2 implemented

Checkpoint E2 has since made the mathematical front-end run against the canonical source via a vm harness (closed export list, layered-grammar contracts, canonical/mirror parity). No engine byte or public output changed; engine/engine.js is still the legacy mirror. See docs/checkpoint-e2-parser-validation-linearization.md. Checkpoint E is not complete.


## Update: E3 implemented

Checkpoint E3 has since made canonical model construction and continuous solving run directly against the canonical source through the harness (E3 phase, closed 22-function export list, continuous simplex/bounds/domains/parity contracts). A fully-continuous model never enters branch-and-bound. No engine byte, mirror byte, or public output changed; engine/engine.js is still the legacy mirror; branch-and-bound (E4), final statuses (E5) and Worker/mirror reconciliation (E6) remain pending. See docs/checkpoint-e3-model-construction-continuous-simplex.md. Checkpoint E is not complete.


## Update: E4 implemented

Checkpoint E4 has since made canonical integer / binary / mixed solving and branch-and-bound run directly against the canonical source through the harness (E4 phase, closed 8-function export list; branch-and-bound traversal, branch selection, incumbent, pruning, node/depth/time limits and the internal integer result contract). A fully-continuous model still never enters branch-and-bound. No engine byte, mirror byte, constant, tolerance or public output changed; engine/engine.js is still the legacy mirror; final statuses (E5) and Worker/mirror reconciliation (E6) remain pending. See docs/checkpoint-e4-integer-branch-and-bound.md. Checkpoint E is not complete.


## Update: dist-determinism correction (during E4)

During Checkpoint E4 a dist-dependency was found: five canonical suites gated a dist/solver.html byte-identical assertion on fs.existsSync(dist), making the battery count 11095 without a prior build and 11104 with one. Fix: the six E1 composition checks now use the OFFICIAL compositor (composeSolverInterface) and run always; the three Category-B byte-identity assertions (parser_frontend, model_continuous, integer checker) plus two skip-as-pass branches (P48, P54) were removed, their byte-identity contract owned solely by validate_dist during npm run build. The battery is now deterministic: TOTAL PASSED 11099 with and without dist. E3 baseline adjusted to 10849; E4 increment 250; E4 total 11099. See docs/checkpoint-e4-integer-branch-and-bound.md.


## Update: Checkpoint E5 (canonical verification, statuses and error contracts)

E5 pins solution verification, final statuses, stop reasons, optimalityProven, the result adaptation and the status-vs-error separation directly against the canonical source through the harness (E5 phase). No engine/mirror/algorithm/public-output change. Verification is the COMBINATION of isSatisfied_ / feasibleAt_ / buildVariableDomains_ / isWhole_ / dotProduct_ orchestrated by solveModel_ (there is no single verifySolution_). Real statuses: optimal/feasible/infeasible/unbounded/unknown/numerical_failure/invalid_model; incomplete is UI-only, NOT an engine status. Exports: E2 24 / E3 22 / E4 8 / E5 9. Parity 3 direct + 1 observable (solveModel_, elapsedMs documented as a non-deterministic temporal field, the ONLY excluded field; all other contractual fields compared exactly). Approved divergences stay 2 (newContext_/readConstraint_). Characterised defects D-E5-1 (explainStatus_ dead branch) and D-E5-2 (limit without incumbent -> unknown, stopReason preserved) are pinned, NOT fixed. Suites: checker 70, positive 54, negative 53, auditor 116; migrated 0, split 0 (status-bearing legacy drive the mirror end-to-end -> E6). Allowlist stays 18. E5 increment +293; total 11392, identical with and without dist. See docs/checkpoint-e5-verification-statuses-errors.md.

## Checkpoint E6 — single editable source (final)

The engine now has exactly one editable mathematical source,
`engine/source/plumline-engine.js`. The Node/add-on twin `engine/engine.js` is a
GENERATED artefact (banner: `GENERATED FILE — DO NOT EDIT MANUALLY`) produced
deterministically by `engine/generate-engine-mirror.js` from the canonical source
plus the two approved platform adaptations (`newContext_`, `readConstraint_`)
declared in `engine/source/engine-platform-adapter.json`.

- Edit the engine: edit the canonical source, then run `npm run generate:engine-mirror`.
- `npm run verify` checks the mirror is fresh; it never regenerates.
- 86 common mathematical bodies are byte-exact between canonical and mirror; 2 functions are intentionally platform-adapted; the wrapper/API (20 exports) is non-mathematical.
- Direct and Worker use the same canonical bytes (engineSource slice); the main-thread fallback uses the same composed canonical scope. None use the mirror.

Old mirror SHA `6190cb47...` (90220 bytes) → generated mirror SHA `faabb2c2...`
(84242 bytes). Byte-identity with the old mirror was not maintainable (11
functions had independently-authored comments); AST and functional equivalence are
demonstrated instead. See `docs/checkpoint-e6-worker-mirror-final.md`.

Status: Checkpoint E implementation complete; pending Windows/Node 24 validation,
CI, merge and production verification.
