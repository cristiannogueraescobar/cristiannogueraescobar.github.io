# Checkpoint C3 — Examples page

Scope: examples.html (audited alongside assets/examples-data.js and solver.html,
which are NOT modified). Result: **State B/D** — correctly organized; C3 changes
NO production and adds a sync contract + region golden + isolation + docs.

## Architectural decision: do NOT reorganize

Examples has two LEGITIMATE representations, not eliminable duplication:
- **examples.html** — the visible, accessible catalog: 9 literal
  `<a href="solver.html?ex=<slug>">Title</a>` cards in `<main>`, present without
  JavaScript.
- **assets/examples-data.js** — the SINGLE SOURCE OF TRUTH for each example's
  slug, category, model type and objective direction (`META[]` of 9 objects
  `{key, slug, category, type, sense}`, `CATEGORY_ORDER`, and
  `buildExampleSolverUrl`). Both the solver's Examples drawer and examples.html
  read it.

The slug appears in BOTH the HTML link and examples-data.js. That is deliberate
progressive enhancement — the catalog must work without JS — NOT a defect to
remove. Per the brief, we add a sync checker instead of eliminating it. No third
source of truth is created; no static content is turned into JSON.

## Canonical sources (responsibilities)
- **examples.html**: the visible catalog and its SEO (title, description,
  canonical, OG/Twitter, the ItemList JSON-LD). It owns what the user sees.
- **assets/examples-data.js**: the canonical slug/category/type/sense metadata,
  shared by examples.html and the solver drawer. It owns the identifiers.
- **solver.html**: the full grids, per-variable domains and expected results (its
  `EXAMPLES` object, keyed by `key`; the loader resolves `?ex=<slug>` via
  `EXAMPLE_BY_SLUG`). Already protected by `tests_examples.js` (every example
  solves to its declared result) — C3 does NOT duplicate the math.

## Deliberate duplication and the sync contract
The 9 slugs live in both examples.html (visible links) and examples-data.js
(canonical). The C3 checker enforces they stay in sync rather than removing the
duplication:
- every visible HTML card slug exists exactly once in examples-data.js;
- every examples-data.js slug appears in the HTML catalog;
- HTML card order equals `META[]` order;
- no duplicate slugs in HTML or in the data;
- every data category is a known `CATEGORY_ORDER` value (no internal/pending
  category leaks into the catalog — there are no internal/pending flags today);
- `buildExampleSolverUrl(key)` yields exactly `solver.html?ex=<slug>` for each
  example and `null` for an unknown key. This is checked via examples-data.js's
  `module.exports`, NOT via the full solver HTML — Examples integrity, data
  compatibility, and solver integrity (its own suites) stay separate.

Fields that are NOT forced identical: the visible card TITLE (English display
text in examples.html) vs the internal `key`/`type`/`sense` in examples-data.js —
different responsibilities, documented here as a legitimate exception.

## Catalog accessible without JS (progressive enhancement)
The 9 cards are literal in `<main>`, so the title, catalog, cards, and solver
links all exist with JavaScript disabled. The inline script's `renderCatalog()`
does `#exCatalog.innerHTML = …` (guarded by `if (!root) return`) to ENHANCE the
already-present catalog (e.g. localized "open in solver" labels); it does not
build the main catalog from scratch and does not `fetch`. The checker asserts the
static cards are present and that the page never fetches content.

## Inline style (B3-owned)
examples.html has a page-specific inline `<style>` frozen by B3. The C3 checker
asserts its inner-content SHA-256 and byte length match the B3 golden
(`examples_style_sha256` = 844eb13c…, 885 bytes) — it does NOT re-freeze or move
any CSS, and plumline.css?v=21 is untouched.

## Isolation
Examples does not load the engine, a Worker, simplex/branch-and-bound, grid,
charts, or exports; examples-data.js contains data, not the engine. No requests
added. solver.html, B1, B2, B3, C1, and C2 remain intact.

## Contracts added (the official checker)
`engine/tests_examples_page.js` exports `checkExamplesPage(siteDir)` →
`{ pass, fail, failures }`, used by BOTH the positive suite and the negatives.
Against `engine/fixtures/pages-golden/examples-page.json` (from the pre-C3 source,
NOT compositor-generated): one `<main>`; `<head>`/`<main>` SHA-256 + bytes; inline
`<style>` SHA-256 + bytes (B3 convention); JSON-LD present + hash; card order and
count; no duplicate HTML slugs; approved solver-link format; id set (no
duplicates); data-i18n set; script src set; asset versions; canonical; OG/Twitter
counts; examples-data.js file hash + slug/category/CATEGORY_ORDER/count + no
duplicate slugs; the HTML↔data sync contract; the `buildExampleSolverUrl`
compatibility contract; progressive-enhancement presence; and isolation.

## Negative tests
`engine/tests_examples_page_negative.js` — 26 cases (77 assertions), each mutates
a temp tree, runs the SAME `checkExamplesPage()`, asserts `fail > 0` with a
message identifying the mutation, and cleans up in `finally`: remove/duplicate/
reorder a card; change an HTML card slug; remove/duplicate a data slug; change a
shared title; change a category; break a solver link; a data example missing from
HTML; expose an internal/pending category; remove a script; change an asset
version; change canonical; change JSON-LD; remove a data-i18n; change the inline
style; fetch; catalog built via innerHTML with the static cards removed; engine
reference; new Worker; grid/charts/exports markup; published partial; duplicate
id; a solver-touch case proving Examples integrity does not depend on solver's
full HTML beyond the slug contracts; and a spaced-path run.

Model coefficients, constraints, and expected results are NOT negative cases of
`checkExamplesPage()`. They live in solver.html and mutating them does not — and
must not — trip the Examples checker, so they are not valid Examples negatives.
They are protected EXTERNALLY by `tests_examples.js` (each example solves to its
declared result) and `tests_ex_drawer.js` (drawer focus); those suites stay green
and are the guardians of the math, but they are not presented as negatives of
`checkExamplesPage()`. This keeps Examples integrity, data compatibility, and
solver integrity separate.

## How to add an example
1. Add its full model (grid, domains, expected result) to solver.html's
   `EXAMPLES` under a new `key`.
2. Add a `{ key, slug, category, type, sense }` entry to `examples-data.js`
   `META[]` in the correct category order.
3. Add a visible `<a href="solver.html?ex=<slug>">Title</a>` card to
   examples.html `<main>` in the same order.
4. Update `examples-page.json` (card order/count, ids, data-i18n, region hashes,
   examples_data slugs/categories/count/file hash) from the approved source.
5. Run `node engine/tests_examples_page.js` and `node engine/tests_examples.js`.

## How to modify a model
Edit the model in solver.html's `EXAMPLES` and its expected result; run
`node engine/tests_examples.js` (it re-solves and verifies). The Examples-page
checker is unaffected (it does not encode the math).

## Which tests and generators to run
`tests_examples.js` (models solve to expected results), `tests_ex_drawer.js`
(solver drawer focus), `tests_examples_page.js` + `_negative.js` (C3 catalog +
sync). No generator writes examples.html.

## How to update the fixture
`examples-page.json` holds the expected region hashes, card/slug inventory, and
examples-data.js inventory. Never regenerate the expected values with the same
code path the test validates — re-extract from the approved source. The
`style_sha256`/`style_bytes` are of the `<style>` inner content, matching the B3
golden.

## What must NOT move to runtime
The visible catalog stays in HTML (never runtime-generated). The inline `<style>`
stays (B3). The math models stay in solver.html. JSON-LD is authored in HTML, not
generated from examples-data.js at runtime.

## How to revert C3 without reverting C1/C2 or A/B
C3 added only: `engine/tests_examples_page.js`,
`engine/tests_examples_page_negative.js`,
`engine/fixtures/pages-golden/examples-page.json`, two suite names in
`engine/suites.js`, and one allowlist entry (`tests_examples_page.js`) in
`engine/tests_composed_reads.js`. To revert: delete those files/fixtures and
remove the two suite names and the one allowlist entry. No production page, asset,
shell (B1), behavior (B2), CSS golden (B3), or C1/C2 artifact was changed.

## Metrics
- Production HTML/CSS/JS modified: **0** (examples.html head+main byte-identical
  to the C0 baseline; examples-data.js untouched; plumline.css?v=21 untouched).
- examples.html: 135 lines / 8 647 chars / 8 665 bytes — before == after.
- assets/examples-data.js: 44 lines / 2 644 bytes — before == after.
- Cards: 9. Examples in data: 9. Slugs: 9 (0 duplicates in HTML or data).
- Deliberately-duplicated field: the slug (HTML link + data), for progressive
  enhancement — kept, now sync-checked.
- Real duplication found: the 9 slugs (deliberate). Duplication removed: 0.
- Files added: 3 (2 test suites + 1 fixture). Files modified: 2 (suites.js,
  tests_composed_reads.js). Files deleted: 0.
- Tests added: 122 (44 positive + 77 negative + 1 composed_reads). Total 7625 →
  7747.
- Requests before == after. Payload before == after. Inline blocks before ==
  after (1 `<style>`, the JSON-LD, and the catalog/i18n script).
- Complexity added: two static test suites + one fixture; no compositor, no
  dependency, no framework, no runtime change.
- Improvement: HTML↔data sync contract, isolation, and documentation. No public
  difference.
