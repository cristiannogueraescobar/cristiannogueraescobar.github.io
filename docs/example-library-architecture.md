# Example library architecture (F0 companion)

Status: proposal for review (Checkpoint F0). No data migrated, no example added.

## Current duplication (the F1 problem)

Each example is spread across seven places:

1. `assets/examples-data.js` — key, slug, category, type, sense; also the canonical solver-URL builder `PL_buildExampleSolverUrl` (URL uses the slug). It does NOT hold the full model.
2. `solver.html` — the `EXAMPLES` object: grid, formulas, per-variable domains, expected {status, modelType, objective, tolerance}.
3. `assets/i18n.js` — title key `exName_<key>`, description key `exDesc_<key>`, in five languages.
4. `examples.html` — static cards, no-JS fallback, one `ItemList` JSON-LD with 9 `ListItem`s.
5. `index.html` — featured examples and use-case links.
6. `assets/product-capabilities.js` — capability↔example relationships.
7. tests/fixtures — expected values, slugs, structural contracts.

There is no single source of truth; adding or changing an example means editing up to
seven files consistently.

## Complete nine-example inventory

Expected VALUES (solution vectors) are NOT pinned for any example; solver.html pins
only status/modelType/objective (and tolerance for blend). Values below are taken from
source, not solved.

| key | slug | category | type | sense | whole | openVarSettings | domains | rows | status | modelType | objective | tolerance | values | SUM | SUMPRODUCT | SUMIF | `<=` | `>=` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| production | production-plan | start | continuous | max | no | no | no | 8 | optimal | continuous | 1760 | — | not pinned | y | y | n | y | n |
| workshop | workshop-chart | start | continuous | max | no | no | no | 7 | optimal | continuous | 900 | — | not pinned | y | y | n | y | n |
| blend | cheapest-feed-blend | start | continuous | min | no | no | no | 9 | optimal | continuous | 27.352941176470587 | yes | not pinned | y | y | n | y | y |
| marketing | marketing-budget | business | continuous | max | no | yes | yes | 7 | optimal | continuous | 21350 | — | not pinned | y | n | n | y | n |
| workforce | workforce-scheduling | business | integer | min | yes | no | no | 17 | optimal | integer | 23 | — | not pinned | y | n | n | n | y |
| shipping | shipping-plan | business | integer | min | yes | no | no | 14 | optimal | integer | 450 | — | not pinned | y | n | n | y | y |
| project | project-selection | binary | binary | max | no | yes | yes | 9 | optimal | binary | 125 | — | not pinned | y | y | n | y | n |
| delivery | delivery-load | binary | binary | max | no | yes | yes | 10 | optimal | binary | 240 | — | not pinned | y | y | n | y | n |
| supplier | supplier-activation | binary | mixed | min | no | yes | yes | 13 | optimal | mixed | 830 | — | not pinned | y | n | n | y | y |

Chart eligibility: two-variable models only (workshop). Marginal-impact eligibility:
where a limit binds (e.g. production). Protecting suites/fixtures: `tests_examples.js`,
`tests_examples_page.js` (+negative), `examples-page.json` golden, the
examples-data↔EXAMPLES key-match assertion, and `solver-ui-golden/*` for the rendered
production example.

## Coverage matrix (corrected, per example)

- Model type: continuous (production, workshop, blend, marketing), integer (workforce, shipping), binary (project, delivery), mixed (supplier) — all four covered by public examples.
- Sense: max (production, workshop, marketing, project, delivery), min (blend, workforce, shipping, supplier) — both covered.
- Constraints: `<=` (all but workforce), `>=` (blend, workforce, shipping, supplier), equality `=` NOT covered by any public example (engine supports it — gap), explicit lower/upper bounds via per-variable domains (marketing + binary/mixed), fixed/free variables not covered as public examples.
- Formulas: SUM (all), SUMPRODUCT (production, workshop, blend, project, delivery), SUMIF NOT covered (engine supports it — gap), direct arithmetic (production/workshop), locale-specific syntax handled by number-format auto-detect (engine-tested, not a dedicated example).
- Product features: automatic detection (all), Variable Settings (marketing/project/delivery/supplier auto-open; available for all), chart (workshop), marginal impact (binding-limit cases), wholeNumbers (workforce, shipping), per-variable domains (marketing/project/delivery/supplier).
- Result coverage: optimal (all nine public examples); feasible-non-proven, unknown/incomplete, infeasible, unbounded, numerical failure are represented ONLY by engine tests and are intentionally not public examples. A redesign could add clearly-labelled infeasible/unbounded teaching examples in F5.

Distinction: public examples all show `optimal`; other result states are engine-tested
only; equality and SUMIF are engine-supported but not yet shown in a public example.

## Refined canonical schema

A. Authoritative source data (store once): key; slug; translations{title,
shortDescription, fullDescription, problem, businessQuestion, interpretation,
learningPoints}; category; industry; audience; difficulty; tags; featured;
model{grid, sense, wholeNumbers, domains, openVariableSettings}; expected{status,
modelType, objective, tolerance, values ONLY when independently pinned};
presentation{chartEligible, marginalImpactEligible, relatedExamples, relatedGuides}.

B. Generated data (never stored as an independent duplicate): solver URL (from slug),
JSON-LD object, static card HTML, Home preview HTML, no-JS fallback HTML, sitemap
entries, canonical URLs, browser metadata projection, test-case projections.

C. Excluded from product data: test implementation names, generated HTML, complete
JSON-LD blobs, duplicate constraint equations, fixture hashes, build paths.

`constraints`: the solver authority is the grid/formulas; explanatory constraint copy
may live under translations; it must never become a second mathematical model.

Derived properties: modelType is an expected contract checked against live detection;
solver URL from slug; grid size from grid; binary/integer counts from domains; JSON-LD
from semantic metadata.

Requirements F1 must satisfy (final format chosen in F1, not here): consumable by the
Node build and tests; no runtime fetch; no additional public request; five-language
compatible; deterministic serialisation; no circular data; works from paths with
spaces; GitHub Pages compatible; internal canonical source not published to dist; exact
preservation of the nine current public examples (slugs, copy, expected
status/modelType/objective/tolerance).

## Controlled expansion (proposal, nothing added in F0)

Target ~24-30. Accept (linear, within honest limits): bakery production, restaurant
menu mix, staff scheduling, shift coverage, transport allocation, warehouse allocation,
supplier selection, facility opening, purchasing/inventory, advertising budget, project
portfolio, feed/meal blending, delivery loading, classroom allocation, volunteer
scheduling, crop planning, energy mix, cash allocation, subscription selection, event
staffing. Reject: nonlinear, vehicle routing needing large formulations, advanced
cutting-stock (column generation), anything outside honest limits or needing
unimplemented functions. Cover the current gaps: at least one equality-constraint
example, one SUMIF example, and one or two clearly-labelled infeasible/unbounded
teaching examples.

## Example detail template (concept)

Title/summary, business question, model preview, decisions, objective, constraints,
variable types, spreadsheet layout, formulas, expected answer, interpretation, why it
makes sense, sensitivity/marginal impact (when eligible), chart (when eligible),
open-in-solver, related examples, related learning, limitations. Optional: screenshot,
live grid preview, formula table, result receipt, CSV, shareable URL, structured data.

## Update: Checkpoint F1 — canonical authority realised

The example data described here now has a single editable authority,
`src/shared/examples/catalogue.js`, from which every consumer is projected at build
time (see `docs/checkpoint-f1-canonical-example-catalogue.md`). F1 did NOT expand the
library: it preserves the nine existing examples exactly, with byte-identical public
output. Expanding the library (new examples) is a later, visible rebaseline.
