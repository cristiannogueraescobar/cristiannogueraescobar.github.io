# Checkpoint F0 — Product design, marketing, information architecture and example-library baseline

Status: audit only (complete pass). F0 does not modify any public product (HTML,
CSS, public JS, assets, translations, Vite inputs, sitemap, robots), the engine,
the generated mirror, the generator, the adapter, or the public output. No suites
created. Only documentation and `.gitignore` changed. No commit, push, PR, merge or
deploy.

Real Checkpoint F base: `91a69c8cd15ec26fb3df37dd01e5514f778ec80e` (main, after
`git pull --ff-only` from `fdedc81`).

## F0.1 — Repo state and .gitignore protection

Confirmed on `91a69c8`: `plumline-checkpoint-e-ready-to-copy.zip` not tracked (already
removed); `engine/examples-data.js` not tracked (dead duplicate removed);
`.github/workflows/ci.yml` and `deploy.yml` present in HEAD; `assets/examples-data.js`
present. `.gitignore` did not contain the archive pattern; F0 adds it:

```
# Generated checkpoint archives
plumline-checkpoint-*.zip
```

This changes no public file, no workflow, and no tracked ZIP exists. It is the only
non-documentation change in F0.

## F0.2 — Baseline reproduced

Linux Node v22.22.2, `rm -rf dist; npm ci; npm run verify; npm run build; npm run verify; npm run build`:
verify #1 = verify #2 = 11664 (identical), VERIFY ALL GREEN, VALIDATE DIST OK, DIST
HTTP TESTS OK. Invariants: canonical `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`,
mirror `faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`, generator
`c563560df07dcd7ce0b30ac5d75351febfdcee5fddeebc4895c70accf89b35b6`, adapter
`3e592a8e8452fec480539023c3bbb022ec076e301eb1dd4b92f11810769a2935`, composed 215539,
dist 218349 / `4dbf1a8abe8498aa03d7620ad7f8043b646f914f38203906e483a8ca7f6514b4`, six
public requests, five languages, allowlist 18.

## F0.3 — Repository audit

Public HTML (8): index, solver, examples, guide, capabilities, about, privacy,
terms (+ a Google verification file). Editable assets: `plumline.css`, `i18n.js`
(five-language store), `examples-data.js` (public metadata), `product-capabilities.js`,
`nav-menu.js`, `build-badge.js`, `cap-lightbox.js`, `screenshots/` (png+webp).
Composition: `src/shared/compose-shell.js`, `compose-solver.js`,
`src/shared/fragments/header.html` + `footer.html`, `vite.config.mjs` (8 inputs),
`sitemap.xml` (Home `/`), `robots.txt`. Generated: `engine/engine.js`. Structural
debt: example definition split across seven places (see F0.17).

## F0.4 — Route inventory

| route | title | H1 | canonical |
|---|---|---|---|
| `/` | Plumline \| Free Spreadsheet Optimisation Solver | Find the best answer. Then see it checked. | `/` |
| `/solver.html` | Online Optimisation Solver: Continuous, Integer, Binary & Mixed-Integer \| Plumline | Optimise a spreadsheet without leaving your browser. | `/solver.html` |
| `/examples.html` | Optimisation Examples: Production, Scheduling, Blending, Knapsack and More | Ready-to-solve models. | `/examples.html` |
| `/guide.html` | How to Solve an Optimisation Problem (Step by Step, with Example) \| Plumline | How to solve an optimisation problem | `/guide.html` |
| `/capabilities.html` | Plumline Capabilities \| Spreadsheet Optimisation Solver | What Plumline can solve, check and explain | `/capabilities.html` |
| `/about.html` | About Plumline: Who Makes It and How It Verifies Results | One tool, built to be trusted. | `/about.html` |
| `/privacy.html` | Privacy policy — Plumline | Privacy policy | `/privacy.html` |
| `/terms.html` | Terms of service — Plumline | Terms of service | `/terms.html` |

## F0.5 — Root / index.html

One Home source (`index.html`); `/` canonical; `index.html` publicly accessible. The
shared shell fragments use `index.html` (2 header positions) and `index.html#addon`
(2 header + 2 footer positions); source totals 2× `index.html`, 5× `index.html#addon`.
Propagated by the shared shell to all 8 pages: dist has 8× `href="index.html"` and
17× `href="index.html#addon"` (25 references). Future normalisation to `/` and
`/#addon` belongs in the shared fragments; `tests_shell_b1.js`,
`tests_shell_composition_negative.js`, `tests_nav_menu.js` and every page's
expectations must then be rebaselined. Not a two-Home-content problem. Not corrected
in F0.

## F0.6 — Visual matrix (complete)

Captured with headless Chromium from the built `dist/`, then discarded (not committed).
Method key: DOM = programmatic DOM check (horizontal overflow measured as
`scrollWidth > innerWidth`); UI = state reached by real UI interaction (load example,
solve, open panel/menu). All pages/states below were actually captured at the marked
resolutions; none is substituted by another resolution.

| page_or_state | 1440x1000 | 1200x900 | 390x844 | 360x800 | method | result | finding | severity |
|---|---|---|---|---|---|---|---|---|
| Home — initial viewport | captured | captured | captured | captured | UI+DOM | OK, no overflow | message repeated across sections | P1 content |
| Home — full page | captured | captured | captured | captured | UI | OK | long; repetition | P1 content |
| Home — mobile nav open | n/a | n/a | captured | captured | UI | OK | none | — |
| Solver — empty | captured | captured | captured | captured | UI+DOM | OK, no overflow | mixes product+marketing | P2 |
| Solver — Production plan loaded | captured | captured | captured | captured | UI | OK (loaded=true all 4) | none | — |
| Solver — solved result | captured | captured | captured | captured | UI | OK (solved=true all 4) | none | — |
| Solver — Variable Settings open | captured | captured | captured | captured | UI | OK (varsettings=true all 4) | dense but readable | P3 |
| Solver — model/technical error | captured | n/a | captured | n/a | UI | OK; "quantities to decide are not obvious" message shown | none | — |
| Solver — incomplete/unknown | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | — | NOT TESTED | requires a node/time limit (BRANCH_MILLIS) to be hit; not reachable deterministically via the UI without a clock stub or a fixture, and F0 must not modify production | n/a |
| Solver — mobile nav open | n/a | n/a | captured | captured | UI | OK | none | — |
| Solver — horizontal overflow (mobile) | n/a | n/a | measured | measured | DOM | no overflow | grid scrolls within its container | — |
| Examples | captured | captured | captured | captured | UI+DOM | OK, no overflow | no filters/detail pages | P2 |
| Guide | captured | captured | captured | captured | UI+DOM | OK, no overflow | none | — |
| Capabilities | captured | captured | captured | captured | UI+DOM | OK, no overflow | none | — |
| About | captured | captured | captured | captured | UI+DOM | OK, no overflow | none | — |
| Privacy | captured | captured | captured | captured | UI+DOM | OK, no overflow | none | — |
| Terms | captured | captured | captured | captured | UI+DOM | OK, no overflow | none | — |

The model/technical error state was reached deterministically by typing a stray
number into a grid cell and solving, which triggers the model-detection error ("the
quantities to decide are not obvious"); no public data was changed. The
incomplete/unknown state is marked NOT TESTED with the reason above rather than
declared complete. Mobile grid interaction and Variable Settings usability were
inspected at 390/360 and read cleanly; no horizontal overflow was measured on any
page or state.

## F0.7 — Existing visual system

Tokens (`plumline.css`): `--paper/--cream #F5F2EB`, `--panel #FFFFFF`, `--deep #12211A`,
`--ink #14170F`, `--soft #5A5E50`, `--faint #68695E`, `--line #D8D4C7`,
`--line-fine #E9E5DA`, `--brass #B5822E` (+text/hi/tint), `--true #1E7A54` (+hi/lo),
`--wrong #B23B2C` (+lo); `--serif`/`--sans`/`--mono`; `--edge 1240px`, `--rail 56px`,
`--radius 8px`, `--radius-sm 4px`. Classification: Keep palette/verification-green/type
roles/radius; Refine rhythm/spacing/density; Unify cards and CTA variants; Replace
none; Remove none; new components for F2+ (filter chips, compact card, detail layout,
model-preview table, tooltip). Evolve, don't rebrand.

## F0.8 — Contracts to rebaseline

~35 page suites + 7 golden fixtures. Domain counts: home 8, examples 3, capabilities
4, guide 2, legal 2, css 3, seo/jsonld 2, i18n 5, nav 1, contrast 1, shell 4. Battery
11664 across 101 suites. (Full preserve/rebaseline/replace table retained from the
prior pass: engine suites untouchable; CSS/home/examples/capabilities/guide/legal
structural snapshots rebaselined in F2-F8; nav/shell rebaselined for the Home-link
normalisation; i18n rebaselined per new copy keys; publication/allowlist behaviour
preserved.) Keep behavioural a11y/SEO/privacy assertions; deliberately rebaseline
visual/structural snapshots.

## F0.9 — Current positioning

Home answers what/free/private/what-you-get/what-now well; the "answer, then checked"
verification angle is honest and differentiating. Weaknesses: message repeated across
sections; abstract hero for non-optimisation audiences; add-on over-weighted while
status unconfirmed; thin audience segmentation. Honest limits present.

## F0.10 — Audiences and strategy

Segments and fit: students/teachers (education, high), small-business owners
(practical, high), operations/production/logistics analysts (practical, high),
existing Excel/Sheets Solver users (browser+privacy, medium-high), technical OR users
(scale — LOW). Strategies A (education-first), B (business-first), C (balanced,
recommended: outcome-led hero + real business example, immediate try/see-how, audience
lanes, honest limits, education preserved via `/learn` and example pages).

## F0.11 — Competitor research (official sources, one claim per row)

All facts verified against the official source in the row; not copied verbatim.
Verification date: current at F0 (2026-08-03).

| competitor | claim_id | exact factual claim | official source owner | official source title | full official URL | relevant section | safe Plumline wording | wording to avoid |
|---|---|---|---|---|---|---|---|---|
| Microsoft Excel Solver | XL-1 | You can specify up to 200 variable cells in Solver | Microsoft | Define and solve a problem by using Solver | https://support.microsoft.com/en-us/office/define-and-solve-a-problem-by-using-solver-5d1a388f-079d-43ac-a7eb-f63e45925040 | "By Changing Variable Cells" | "Plumline has no account or install step to start" | any "handles more variables than Excel" without testing |
| Microsoft Excel Solver | XL-2 | The standard Excel Solver has a limit of 200 decision variables (linear and nonlinear) | Frontline Systems | Standard Excel Solver - Dealing with Problem Size Limits | https://www.solver.com/standard-excel-solver-dealing-problem-size-limits | size limits | "Plumline is for spreadsheet-sized linear models" | claiming a specific Plumline size ceiling not measured |
| Microsoft Excel Solver | XL-3 | The basic Excel Solver allows constraints on up to 100 non-variable cells | Frontline Systems | Standard Excel Solver - Dealing with Problem Size Limits - Continued | https://www.solver.com/standard-excel-solver-dealing-problem-size-limits-continued | constraint limits | (context only) | stating Plumline has "no limits" |
| Microsoft Excel Solver (web) | XL-4 | Add-ins aren't supported in Excel for the web, so the Solver add-in can't run there | Microsoft | Define and solve a problem by using Solver | https://support.microsoft.com/en-us/office/define-and-solve-a-problem-by-using-solver-5d1a388f-079d-43ac-a7eb-f63e45925040 | note on Excel for the web | "Plumline runs in the browser; the Excel Solver add-in does not run in Excel for the web" | "Excel can't optimise" (desktop can) |
| Frontline Solver App | FL-1 | On Solve, the model is queued to Frontline's RASON server on Azure and the workbook is temporarily copied to Azure storage (deleted after solving) | Frontline Systems | Solver Add-in Help and Support | https://www.solver.com/solver-app-help-and-support | cloud solving note | "Plumline never uploads your workbook; it solves locally" | claiming Frontline is insecure |
| OpenSolver for Google Sheets | OS-1 | Uses Glop (LP) and SCIP (MIP) with no artificial limits on problem size | Andrew Mason / Univ. of Auckland | OpenSolver — Google Workspace Marketplace | https://workspace.google.com/marketplace/app/opensolver/207251662973 | listing description | "Plumline needs no install and no account" | "Plumline solves larger/faster than SCIP" |
| OpenSolver for Google Sheets | OS-2 | Requests Drive access to see/edit/create/delete spreadsheets; sends model data to the NEOS server for some engines | Andrew Mason / Univ. of Auckland | OpenSolver for Google Sheets | https://opensolver.org/opensolver-for-google-sheets/ | permissions section | "Plumline processes locally, asks no Drive access, makes no server round-trip" | overstating OpenSolver's privacy risk |
| OpenSolver for Excel | OS-3 | Free open-source Excel VBA add-in using CBC, no artificial size limit (desktop) | Andrew Mason / Univ. of Auckland | OpenSolver for Excel | https://opensolver.org/ | homepage feature list | "Plumline needs no install and runs in the browser" | claiming more raw power than CBC |
| SolverStudio | SS-1 | Free Excel-for-Windows add-in that builds/solves models using modelling languages (PuLP, Pyomo, AMPL, GAMS); solves locally or via NEOS | Andrew Mason / Univ. of Auckland | SolverStudio for Excel | https://solverstudio.org/ | homepage / description | "Plumline needs no modelling language; paste a spreadsheet" | claiming Plumline is more powerful than AMPL/GAMS toolchains |

Notes on the specific items flagged: the "200 variables / 100 constraints" figure is
supported by Microsoft (XL-1, variables) and Frontline (XL-2 variables, XL-3
constraints) with the exact URLs above; "no artificial size limits" is OpenSolver's
own wording (OS-1/OS-3); workbook-copy-to-Azure and NEOS/Drive behaviour come from the
respective official vendor pages (FL-1, OS-2). The Google Apps Script ~6-minute limit
was cited in the prior pass from a secondary blog, not an official Google page, so it
is removed here rather than presented as fact. Wikipedia was removed; SolverStudio now
uses solverstudio.org. Plumline's defensible, demonstrable territory: 100% local
in-browser processing, no account, no install, no data leaving the device, free, with
a visible verification receipt. Do NOT claim greater scale/power than
SCIP/Gurobi/CBC/AMPL. No competitor claim is used in public copy during F0.

## F0.12 — Current information architecture

Header nav → Solver, Examples, Guide, Capabilities, About (+ language). Footer → legal
+ contact. Issues: Home over-loaded; add-on over-weighted while status unconfirmed;
audience journeys incomplete; solver carries marketing; some CTAs repeat.

## F0.13 — Proposed future architecture (candidates, not approved)

Home (redesign), Solver (de-market), Examples (redesign), example detail pages (create,
F5), how-it-works/learn (from Guide), use-cases + selected audience pages (F6),
for-students/for-teachers (F6), Capabilities (keep), limitations (consider/fold),
add-on page (move off Home), About/Privacy/Terms (keep), changelog (optional).
One-person maintainable, five-language localisable.

## F0.14 — Route strategy

Eight hardcoded Vite inputs, encoded across `validate_dist`, `requiredPaths`,
manifest, sitemap, HTTP tests and page fixtures. For example detail pages prefer
(evaluate F1/F4) build-time generation from the canonical example source emitting flat
`/examples/<slug>.html` URLs; avoid hash/query-only detail pages.

## F0.15 — Home outline (future, not written)

Hero (outcome + live demo, single primary CTA) → proof strip → one framed problem →
how it works → what Plumline understood → verification receipt (once, strongly) →
example preview (from the canonical source) → audience lanes → capabilities + honest
limits (linked) → privacy (short) → add-on (reduced or linked) → trimmed FAQ → final
CTA. No five-fold repetition.

## F0.16 — Solver and onboarding

Blends product UI, onboarding, contextual help, examples, result explanation,
marketing and add-on promotion. Separation (F7): keep grid, toolbar, Variable
Settings, detected model, solving, result receipt, verification and error/incomplete
states as product; tooltips/contextual panels for verbose text; move marketing/add-on
to Home/`/add-on`; move deep teaching to Guide/how-it-works and example detail pages.
Not modified in F0.

## F0.17 — Current example architecture (duplication map)

`assets/examples-data.js` (key, slug, category, type, sense — and it also owns the
canonical solver-URL builder `PL_buildExampleSolverUrl`, but NOT the full model),
`solver.html` (`EXAMPLES` object: grid, formulas, domains, expected status/modelType/
objective/tolerance), `assets/i18n.js` (title key `exName_<key>`, description key
`exDesc_<key>`, five languages), `examples.html` (static cards, no-JS fallback, one
`ItemList` JSON-LD with 9 `ListItem`s), `index.html` (featured/use-case links),
`assets/product-capabilities.js` (capability↔example links), tests/fixtures.

## F0.18 — Complete nine-example inventory

Common facts (verified from source): every example has title key `exName_<key>` and
description key `exDesc_<key>` (present in all five languages), category from
`examples-data.js`, appears as a card in `examples.html`, and is included in the single
`ItemList` JSON-LD there. Expected VALUES (per-variable solution vectors) are NOT
currently pinned for any example — solver.html pins only `status`, `modelType`,
`objective` (and `tolerance` for blend). Grid rows/cols are counted from the `EXAMPLES`
grids. Field values below are taken from source, not solved.

| key | slug | category | type (meta) | sense | whole | openVarSettings | domains | grid rows | objective label | expected status | expected modelType | expected objective | tolerance | expected values | SUM | SUMPRODUCT | SUMIF | `<=` | `>=` | Home refs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| production | production-plan | start | continuous | max | no | no | no | 8 | Total profit | optimal | continuous | 1760 | — | not currently pinned | yes | yes | no | yes | no | 11 |
| workshop | workshop-chart | start | continuous | max | no | no | no | 7 | (workshop total) | optimal | continuous | 900 | — | not currently pinned | yes | yes | no | yes | no | 1 |
| blend | cheapest-feed-blend | start | continuous | min | no | no | no | 9 | (blend cost) | optimal | continuous | 27.352941176470587 | yes | not currently pinned | yes | yes | no | yes | yes | 2 |
| marketing | marketing-budget | business | continuous | max | no | yes | yes | 7 | (return) | optimal | continuous | 21350 | — | not currently pinned | yes | no | no | yes | no | 1 |
| workforce | workforce-scheduling | business | integer | min | yes | no | no | 17 | (staff) | optimal | integer | 23 | — | not currently pinned | yes | no | no | no | yes | 2 |
| shipping | shipping-plan | business | integer | min | yes | no | no | 14 | (cost) | optimal | integer | 450 | — | not currently pinned | yes | no | no | yes | yes | 0 |
| project | project-selection | binary | binary | max | no | yes | yes | 9 | (value) | optimal | binary | 125 | — | not currently pinned | yes | yes | no | yes | no | 4 |
| delivery | delivery-load | binary | binary | max | no | yes | yes | 10 | (value) | optimal | binary | 240 | — | not currently pinned | yes | yes | no | yes | no | 1 |
| supplier | supplier-activation | binary | mixed | min | no | yes | yes | 13 | (cost) | optimal | mixed | 830 | — | not currently pinned | yes | no | no | yes | yes | 0 |

Notes: `whole` (wholeNumbers) is set for the integer examples workforce/shipping;
`openVarSettings` opens the Variable Settings panel on load for marketing and the
binary/mixed examples (which carry explicit per-variable `domains`); no example uses
SUMIF; all use SUM, several use SUMPRODUCT; equality (`=`) relations are not used in
the current nine (only `<=` / `>=`). Chart eligibility: only two-variable models can
show the feasible-region chart (workshop is the two-variable "workshop-chart"
example); marginal-impact eligibility applies where a limit is binding (visible in the
solved production example as "estimated improvement from relaxing this limit"). Every
example is protected structurally by `tests_examples.js`, `tests_examples_page.js`
(+negative), the `examples-page.json` golden fixture, and the key-match assertion
between `examples-data.js` and solver's `EXAMPLES`; the solver-visualisation and
interface golden fixtures (`solver-ui-golden/*`) pin the production example's rendered
output. Educational purpose: teach one model shape each; marketing purpose: show real
business framing. Duplicate source locations per example: examples-data.js (meta),
solver.html (model+expected), i18n.js (copy ×5), examples.html (card+JSON-LD),
index.html (featured, where present), product-capabilities.js (links).

## F0.19 — Coverage matrix (per example, corrected)

MODEL: continuous — production, workshop, blend, marketing (public examples);
integer — workforce, shipping; binary — project, delivery; mixed — supplier;
maximise — production, workshop, marketing, project, delivery; minimise — blend,
workforce, shipping, supplier. All four model types and both senses are represented
by public examples.

CONSTRAINTS: `<=` — production, workshop, blend, marketing, shipping, project,
delivery, supplier; `>=` — blend, workforce, shipping, supplier; equality (`=`) — NOT
represented by any public example (engine supports it; a teaching example is a gap);
explicit lower bound / explicit upper bound — represented via per-variable `domains`
on marketing and the binary/mixed examples; fixed variable — not represented as a
public example; free variable — not represented (spreadsheet decisions are
non-negative by default).

FORMULAS: SUM — all nine; SUMPRODUCT — production, workshop, blend, project, delivery;
SUMIF — NOT represented by any public example (engine supports it; a gap);
direct arithmetic references — production/workshop (`=B2*C2` style); locale-specific
syntax — covered by the solver's number-format auto-detect (EU/US), exercised by
`tests_locale.js` at engine level, not by a dedicated public example.

PRODUCT FEATURES: automatic detection — all; Variable Settings — marketing, project,
delivery, supplier (openVarSettings) and available for all; chart — workshop
(two-variable feasible region); marginal impact — where a limit binds (e.g. production
solved); wholeNumbers — workforce, shipping; per-variable domains — marketing, project,
delivery, supplier.

RESULT COVERAGE: optimal — all nine public examples; feasible (non-proven) — not a
public example (engine-tested); unknown/incomplete — engine-tested only (node/time
limit), intentionally not a public example; infeasible — engine-tested only
(`tests_states.js`), not a public example; unbounded — engine-tested only, not a public
example; numerical failure — engine-tested only. Distinction: the nine public examples
all demonstrate `optimal`; the other result states are represented ONLY by engine
tests and are intentionally not shown as public examples (a redesign could add one or
two teaching examples for infeasible/unbounded in F5, clearly labelled).

## F0.20 — Canonical example schema (refined)

Separate fields into three groups.

A. Authoritative source data (stored once): key; slug; translations{title,
shortDescription, fullDescription, problem, businessQuestion, interpretation,
learningPoints}; category; industry; audience; difficulty; tags; featured; model{grid,
sense, wholeNumbers, domains, openVariableSettings}; expected{status, modelType,
objective, tolerance, values ONLY when independently pinned}; presentation{chartEligible,
marginalImpactEligible, relatedExamples, relatedGuides}.

B. Generated data (must NOT be stored as an independent duplicate): solver URL (derive
from slug); JSON-LD object; static card HTML; Home preview HTML; no-JS fallback HTML;
sitemap entries; canonical URLs; browser metadata projection; test-case projections.

C. Excluded from product data (do not store): test implementation names; generated
HTML; complete JSON-LD blobs; duplicate constraint equations; fixture hashes; build
paths.

`constraints`: the solver authority is the grid/formulas; explanatory constraint copy
may live under `translations`; it must never become a second mathematical model.

Derived properties: `modelType` may remain an expected contract but must be checked
against live detection; solver URL derives from slug; grid size derives from grid;
binary/integer counts derive from domains; JSON-LD derives from semantic metadata.

Requirements F1 must satisfy (format decision deferred to F1, not fixed here):
consumable by the Node build and tests; no runtime fetch; no additional public
request; compatible with five languages; deterministic serialisation; no circular data;
works from paths with spaces; GitHub Pages compatible; internal canonical source not
published to dist; exact preservation of the nine current public examples (slugs,
copy, expected status/modelType/objective/tolerance).

## F0.21 — New Examples experience (design)

Hero + search + filters (model type, industry, audience, difficulty) + featured +
compact cards + result preview + no-results state + mobile filter drawer + keyboard
and screen-reader behaviour. Per-example detail pages: yes (F5).

## F0.22 — Controlled expansion (proposal, nothing added)

Target ~24-30. Accept (linear, within honest limits): bakery production, restaurant
menu mix, staff scheduling, shift coverage, transport allocation, warehouse allocation,
supplier selection, facility opening, purchasing/inventory, advertising budget, project
portfolio, feed/meal blending, delivery loading, classroom allocation, volunteer
scheduling, crop planning, energy mix, cash allocation, subscription selection, event
staffing. Reject: nonlinear, vehicle routing needing large formulations, advanced
cutting-stock (column generation), anything outside honest limits or needing
unimplemented functions. A couple of the new examples should intentionally cover
equality constraints and SUMIF, and one or two could teach infeasible/unbounded.

## F0.23 — Example detail template (concept)

Title/summary, business question, model preview, decisions, objective, constraints,
variable types, spreadsheet layout, formulas, expected answer, interpretation, why it
makes sense, sensitivity/marginal impact (when eligible), chart (when eligible),
open-in-solver, related examples, related learning, limitations. Optional: screenshot,
live grid preview, formula table, result receipt, CSV, shareable URL, structured data.

## F0.24 — Copy and tone

Five languages share `assets/i18n.js`. Principles: simple, confident, professional,
approachable, precise; outcome-led; spreadsheet-native; honest; no exaggerated claims;
no unexplained jargon. Canonical glossary to fix per language: optimisation, objective,
decisions, constraints, limits, continuous, integer, binary, mixed-integer, feasible,
optimal, incomplete, infeasible, unbounded, marginal impact, verification. Not
rewritten in F0.

## F0.25 — Trust, contact and add-on

Contact email is live: `contact@plumline.online`. About covers maintainer identity and
verification. Add-on status needs user confirmation before any claim changes. Options:
keep "in review"; reduce Home presence; separate `/add-on` page; or remove from primary
nav. Recommendation: reduce Home weight + own page once status confirmed. No change
made.

## F0.26 — SEO

`capabilities.html` has a single, non-empty `<title>` ("Plumline Capabilities |
Spreadsheet Optimisation Solver", i18n key `capPageTitle`, matching OG/Twitter, composed
by `engine/gen_capabilities.js`, protected by `tests_capabilities.js` /
`capabilities-page.json`; dist confirms one title). No empty-title defect exists. No
separate real SEO defect found in this pass; titles, descriptions, canonicals and
JSON-LD are present and tested. Opportunities (later): honest keyword clusters;
example-detail structured data/canonicals when detail pages exist; hreflang only if
per-language URLs are introduced. No SEO change in F0.

## F0.27 — Accessibility and responsive

Contrast and i18n/nav coverage exist; pages render responsively with a collapsing
mobile menu across 1440/1200/390/360, and no horizontal overflow was measured. Re-verify
during redesign: keyboard/focus order, skip link, heading hierarchy, landmarks,
language selector semantics, future filter/drawer components, tables/accordions, touch
targets, reduced motion, contrast against palette refinement, zoom, overflow. New
components need new a11y contracts in F2/F4/F5.

## F0.28 — Performance and privacy

The approved public contract is six public requests. No analytics, no trackers, no
third-party runtime dependencies; only informational external links. One asset uses
`localStorage` for a UI/language preference (benign, no personal data). Screenshots ship
as png+webp pairs. Privacy is a genuine strength: local processing, no tracking cookies,
no remote solve. Future goals: keep zero trackers/cookies/remote dependencies, keep local
processing, never publish internal source, increase the request count only with explicit
justification, and prefer build-time example data over runtime requests.

## F0.29 — Visual directions (for approval)

A. Professional analytical product. B. Friendly educational workbook. C. Balanced
professional + approachable (recommended): keep cream/deep-green/brass identity, add air
and a clearer type scale, verification-green as the signature accent, compact cards.

## F0.30 — Priorities

Not included (do not exist): capabilities empty title; cleanup-not-merged;
workflows-deleted. The `.gitignore` archive rule was repo hygiene and is now applied.

| finding | severity | impact | effort | phase |
|---|---|---|---|---|
| No single canonical example source (data split across 7 places) | P1 | maintainability/scale | large | F1 |
| Home message repetition | P1 | comprehension/conversion | medium | F3 |
| Weak audience segmentation | P1 | conversion | medium | F3/F6 |
| Add-on prominence on Home (subject to confirmed status) | P1 | trust/clarity | small | F3 (after status confirmed) |
| Solver mixes product + marketing | P2 | focus | medium | F7 |
| Examples lacks filters / detail pages | P2 | SEO/education | large | F4/F5 |
| Library coverage limited to nine examples (no equality/SUMIF/non-optimal teaching examples) | P2 | SEO/coverage | large | F5 |
| Shared-shell Home URL normalisation (`index.html` → `/`) | P3 | minor SEO/consistency | small (shell) + rebaseline | F2/F3 |
| Card and CTA consistency | P3 | polish | medium | F2 |
| Visual rhythm | P3 | polish | medium | F2 |

Severities are not inflated.

## F0.31 — Roadmap

F1 — canonical example data architecture (single source; wire build/tests; the
`.gitignore` archive rule is already applied). F2 — visual system evolution and shared
navigation (incl. shared-shell Home link normalisation and deliberate visual/structural
fixture rebaselining). F3 — Home positioning and redesign (evidence-backed marketing
claims; reduce add-on weight only after user approval of the new add-on message). F4 —
Examples index redesign (filters, cards). F5 — example detail pages and controlled
expansion toward ~24-30 (incl. equality/SUMIF/non-optimal teaching examples). F6 —
use-case, audience and learning pages. F7 — solver onboarding and contextual education.
F8 — localisation, SEO, accessibility and performance. F9 — screenshots, Windows, CI and
production verification. Engine maths never mixed with design.

## F0.32 — Approved planning decisions

Balanced professional + approachable; preserve and refine the existing
cream/deep-green/brass/verification-green identity; practical business outcomes on Home
with strong education paths; canonical example architecture before redesigning Home and
Examples; library target ~24-30 validated examples; no mathematical-engine work inside
Checkpoint F. Authorises planning, not F2/F3 visual implementation.

## F0.33 — F0 files

This audit document (mandatory), `docs/product-information-architecture.md`,
`docs/example-library-architecture.md`, and the `.gitignore` archive rule. No suites
created. No public HTML/CSS/JS/assets/translations/Vite/sitemap/robots/engine/mirror/
generator/adapter/output changes. No committed screenshots.

## F0.34 — Final validation

Baseline unchanged by F0 (audit + `.gitignore` only): invariants intact (canonical
`5d68ed17…`, mirror `faabb2c2…`, dist `4dbf1a8a…`, allowlist 18). Battery increment: 0.
Both verify runs 11664 and identical, VALIDATE DIST OK, DIST HTTP TESTS OK, six public
requests, five languages. Public files byte-identical vs `91a69c8`. Only documentation
and `.gitignore` changed. No redesign implemented, no visual approved, F1 not started,
no commit/push/PR/merge/deploy.

## Limitations

Audited on Linux, Node v22.22.2, against real `main` at `91a69c8`. Visual audit used
temporary headless-Chromium screenshots (discarded, not committed); the
incomplete/unknown solver state is marked NOT TESTED (not deterministically reachable
via the UI without a clock stub or fixture). No Windows, real-user-browser or manual
visual sign-off is claimed.
