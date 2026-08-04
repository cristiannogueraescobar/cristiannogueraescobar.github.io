# Plumline architecture

Plumline is a multi-page STATIC site on GitHub Pages. No SPA, no framework, no
backend. Vite is a dev/build tool only.

## Layers

- **Public pages** (8): `index`, `solver`, `guide`, `examples`, `capabilities`,
  `about`, `privacy`, `terms` — each a real `.html` URL, unchanged by any refactor.
- **Solver engine**: inlined in `solver.html` between `/* ENGINE_START */` and
  `/* ENGINE_END */`. A Worker is built at runtime by re-reading that inline
  script. OUT OF SCOPE for shell work; must stay byte-for-byte identical.
- **Shared shell** (Checkpoint B1): header/nav/mobile controls/language
  selector/footer/build-badge, composed at build time from
  `src/shared/compose-shell.js`. See `docs/shared-components.md`.
- **i18n**: `assets/i18n.js` holds the 5-language dictionary (en/es/pt/de/fr) and
  the runtime resolver (common → page namespace → authorized extras → English
  fallback). Not restructured by B1.
- **Assets**: `assets/` (CSS, runtime JS, screenshots) copied verbatim into dist.

## Build pipeline (Checkpoint A + B1)

1. Vite emits the 8 HTML entry points.
2. `plumlineComposeShell` (dev + build) composes `PLUMLINE:` shell markers.
3. `plumlineBuild.closeBundle` copies the `assets/` tree verbatim, copies root
   public files (`CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml`,
   `build-info.json`, `google…​.html`), and re-derives each dist page from source
   (composing markers) so dist is fully determined by source.
4. CI stamps `build-info.json`, writes `assets/hashes.txt`, and the production
   smoke verifies every manifest entry by SHA-256. See
   `docs/github-pages-deployment.md`.

## Generated pages (State D)

Some pages are generated from canonical data, not hand-authored. capabilities.html
(Checkpoint C4) is produced by `engine/gen_capabilities.js` from
`engine/templates/capabilities.template.html` (chrome + two region markers), the
capability inventory `assets/product-capabilities.js` (24 entries, 16 shown), the
imagery in `data/media.json`, and the copy in `assets/i18n.js`. The generator is
deterministic, has a `--check` mode (the CI gate), fills the two markers exactly
once, validates each image file and its five-language alt text, and derives the
JSON-LD featureList from the shown inventory. `index.html` (Checkpoint C5) also
carries generated regions: HOME_CAPABILITIES (gen_home_capabilities.js), HOME_FAQ +
HOME_FAQ_JSONLD (gen_home_faq.js from data/home-faq.json), and HOME_SOFTWARE_JSONLD
(gen_jsonld.js); gen_claims.js writes data/claims.json (a data file, NOT an
index.html region). Those three index.html generators touch disjoint regions
(tests_gen_stability), locate their regions by `_START`/`_END` markers, and each
requires its markers exactly once. index.html has 13 `<section>` elements: 11 are
hand-authored (hero-split, trust-bar, how, use-cases, verify, example, privacy,
limits, add-on, help, final CTA) and 2 host a generated region (`#capabilities`,
`#faq`); two more generated regions sit in `<head>` and are not sections. Generated
pages are never edited by hand — edit the source data or template and regenerate.

## Guarantees preserved across refactors

Public URLs, GitHub Pages hosting, `CNAME`, the exact dist-root allowlist, the 8
HTML pages, manifest/requiredPaths/SHA verification, the inline engine + Worker,
all copy and 5 translations (byte-identical visible values), and the approved
design tokens. Checkpoint B1 changes only HOW the shell markup is stored and
composed, not what the user receives — the 8 dist pages are byte-for-byte
identical to the approved pre-B1 product.

## Solver interface composition (Checkpoint D)

`solver.html` is assembled the same way the shell is (B1): the source page carries
nine `SOLVER_UI_*` marker blocks, and `src/shared/compose-solver.js` — the single
composer used by Vite dev, Vite build, `engine/composed-html.js`, and
`engine/validate_dist.js` — replaces each block with the verbatim bytes of an internal
fragment under `engine/fragments/solver-ui/`. The composed inline script is
byte-identical to the pre-D baseline, and `dist/solver.html` is byte-identical to the
pre-D public artifact; the fragments are NEVER published. The nine regions, in
canonical order, are EXAMPLES_LOADING, GRID_INTERACTION, SOLVE_WORKER_CLIENT,
VARIABLE_SETTINGS, SOLVE_ORCHESTRATION, SOLVE_RESULTS, RECEIPT_PLOT_EXPORTS,
EXAMPLES_DRAWER, and BOOTSTRAP_ACCESSIBILITY. The engine region
(`/* ENGINE_START */`…`/* ENGINE_END */`, 82657 chars) and the Worker are frozen
throughout D and are the province of Checkpoint E. Module-level i18n utilities and the
IIFE-head example data/state remain inline by design. See
docs/checkpoint-d5-integration.md for the full account.

Checkpoint E (single canonical engine) is in its baseline phase E0 only: an
inventory and architecture map, no engine move. E0 found ONE production engine
source (the inline ENGINE_START..END region, sliced identically by direct
execution and the Worker) plus a second real source, engine/engine.js (the
Google Sheets add-on twin, 87/89 bodies identical after normalisation). See
docs/checkpoint-e-baseline.md and docs/single-engine-architecture.md
(PROPOSED — NOT IMPLEMENTED). Checkpoint E1 then extracted the engine VERBATIM into the internal canonical file engine/source/plumline-engine.js (the official slice: includes ENGINE_START, excludes ENGINE_END), composed build-time into the historical position by the one official compositor; direct execution and the Worker consume the same composed bytes, dist/solver.html stays byte-identical, and engine/engine.js remains the legacy mirror (consolidated only later). See docs/checkpoint-e1-canonical-source.md. Checkpoint E is NOT complete after E1. Checkpoint E2 then made the mathematical front-end (references, ranges, tokeniser, parser, SUM/SUMIF, comparison + criteria, validation, linearisation, coefficient extraction) run directly against the canonical source through a vm harness (engine/canonical-engine-harness.js) with a closed export list (engine/e2-exports.js); no engine byte, parser, operator, error or result changed, and engine/engine.js stays the untouched mirror. See docs/checkpoint-e2-parser-validation-linearization.md. Checkpoint E is NOT complete after E2. Checkpoint E3 then made canonical model construction and continuous solving (context, grid, variable order, objective, direction, constraints, operators, RHS, coefficient vectors/matrices, normalisation, bounds, free/fixed variables, domain metadata, continuous classification, standard form, tableau, continuous simplex, pivot, continuous optimal/unbounded/infeasible at the internal level) run directly against the canonical source through the same harness with a separate closed export list (engine/e3-exports.js, phase 'e3'); a fully-continuous model never enters branch-and-bound; no engine byte, mirror byte, tolerance, algorithm or public output changed. See docs/checkpoint-e3-model-construction-continuous-simplex.md. Checkpoint E is NOT complete after E3. Checkpoint E4 then made canonical integer / binary / mixed solving and branch-and-bound (integer indices, whole-number detection, binary/mixed domains, integrality, branch-variable selection, node creation, ceil-first DFS traversal, incumbent, pruning, node/depth/time limits, and the internal integer result contract) run directly against the canonical source through the same harness with a separate closed export list (engine/e4-exports.js, phase 'e4'); a fully-continuous model still never enters branch-and-bound; no engine byte, mirror byte, constant, tolerance, branching policy or public output changed. See docs/checkpoint-e4-integer-branch-and-bound.md. Checkpoint E is NOT complete after E4.


## Update: dist-determinism correction (during E4)

During Checkpoint E4 a dist-dependency was found: five canonical suites gated a dist/solver.html byte-identical assertion on fs.existsSync(dist), making the battery count 11095 without a prior build and 11104 with one. Fix: the six E1 composition checks now use the OFFICIAL compositor (composeSolverInterface) and run always; the three Category-B byte-identity assertions (parser_frontend, model_continuous, integer checker) plus two skip-as-pass branches (P48, P54) were removed, their byte-identity contract owned solely by validate_dist during npm run build. The battery is now deterministic: TOTAL PASSED 11099 with and without dist. E3 baseline adjusted to 10849; E4 increment 250; E4 total 11099. See docs/checkpoint-e4-integer-branch-and-bound.md.


## Update: Checkpoint E5 (canonical verification, statuses and error contracts)

E5 pins solution verification, final statuses, stop reasons, optimalityProven, the result adaptation and the status-vs-error separation directly against the canonical source through the harness (E5 phase). No engine/mirror/algorithm/public-output change. Verification is the COMBINATION of isSatisfied_ / feasibleAt_ / buildVariableDomains_ / isWhole_ / dotProduct_ orchestrated by solveModel_ (there is no single verifySolution_). Real statuses: optimal/feasible/infeasible/unbounded/unknown/numerical_failure/invalid_model; incomplete is UI-only, NOT an engine status. Exports: E2 24 / E3 22 / E4 8 / E5 9. Parity 3 direct + 1 observable (solveModel_, elapsedMs documented as a non-deterministic temporal field, the ONLY excluded field; all other contractual fields compared exactly). Approved divergences stay 2 (newContext_/readConstraint_). Characterised defects D-E5-1 (explainStatus_ dead branch) and D-E5-2 (limit without incumbent -> unknown, stopReason preserved) are pinned, NOT fixed. Suites: checker 70, positive 54, negative 53, auditor 116; migrated 0, split 0 (status-bearing legacy drive the mirror end-to-end -> E6). Allowlist stays 18. E5 increment +293; total 11392, identical with and without dist. See docs/checkpoint-e5-verification-statuses-errors.md.

## Engine source of truth (Checkpoint E6)

`engine/source/plumline-engine.js` is the single editable mathematical source.
`engine/engine.js` is a generated Node/add-on mirror (see
`docs/single-engine-architecture.md` and `docs/checkpoint-e6-worker-mirror-final.md`).
Regenerate with `npm run generate:engine-mirror`; `npm run verify` only checks
freshness. The public web output is byte-identical and the Worker slices the
canonical engine, not the mirror.

## Canonical example catalogue (Checkpoint F1)

The nine built-in solver examples have a single editable authority,
`src/shared/examples/catalogue.js` (data-only CommonJS). Every consumer is a
projection derived from it at build/composition time: the solver `EXAMPLES` object
(via a `SOLVER_EXAMPLES_CATALOGUE` marker in `solver.html`, composed to 6125 bytes),
the two i18n sub-sections per language in `assets/i18n.js` (180 occurrences,
regenerated in place by closed structure), the `assets/examples-data.js` META lines,
the `examples.html` ItemList JSON-LD and no-JS links, Home slug references, and the
capability↔example relation in `assets/product-capabilities.js` (by `exampleId`).

Helpers are separated: `schema.js` (validation), `serialize.js` (deterministic
serializers), `projectors.js` (region regeneration), `index.js`
(`loadAndValidateCatalogue`, the validated entry every projection uses). The
catalogue is internal source — never published to dist, no runtime request. The
public output is byte-identical to the pre-F1 baseline (composed solver 215539, dist
solver 218349, sha `4dbf1a8a…`, six requests, five languages). `model.fieldOrder` is
a historical serialization contract, not a model authority. `npm run generate:examples`
is the single generator; `npm run verify` step 4b checks projection staleness without
writing. See `docs/checkpoint-f1-canonical-example-catalogue.md`.

## Visual system and shared navigation (Checkpoint F2)

F2 formalizes the shared visual language into an additive token + component
layer in `assets/plumline.css` (semantic colors, spacing, fluid typography,
shape, elevation, focus/interaction; system fonts only, zero remote fonts) and
refines the shared header/footer/solver shell through it. It adds a focus-visible
**skip link** and a normalized `<main id="content">` on all 8 pages, a
`skipToContent` i18n key in all 5 languages, a unique `aria-current="page"` per
page (the Home logo carries it via a new `home` key in `compose-shell.js`), and
root-relative Home/add-on links (`/`, `/#addon`; zero `index.html` hrefs).
`assets/nav-menu.js` is unchanged — its full mobile-drawer a11y contract is now
pinned by tests. F2 is a **deliberate visual rebaseline**: public output changes
on purpose (composed solver 215539 → 215613, dist solver 218349 → 218396); the
engine, mirror, catalogue, 9 examples, 5 languages and 6 requests are unchanged.
See `docs/checkpoint-f2-visual-system-navigation.md`.
