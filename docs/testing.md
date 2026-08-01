# Testing

Run everything with `npm run verify` (the same command CI runs). It runs the full
test battery, then builds and validates dist, the manifest, and the smoke inputs.

## The battery (`node engine/run_all.js`)

Suites are listed in `engine/suites.js`. Checkpoint A shipped 6742 assertions;
Checkpoint B1 adds suites (total grows, none of the 6742 may be lost).

### Composed-HTML rule (Checkpoint B1)

After B1, source pages carry `PLUMLINE:` shell markers. A suite that evaluates the
final DOM (structure, navigation, accessibility, mobile menu, links, visible i18n,
header/footer, active page) MUST read the COMPOSED HTML, not the marker source:

    const { composedHtml } = require('./composed-html.js');
    const html = composedHtml(siteDir, page);   // composes if the source has markers

Suites that deliberately inspect RAW source (the inline engine block, Worker
parity, reduced-motion CSS, locale functions — regions the composer never touches)
keep reading the file directly. These are enumerated in
`RAW_SOURCE_ALLOWLIST` in `engine/tests_composed_reads.js`.

### `tests_composed_reads.js` (regression guard)

Fails if a DOM suite reads a MIGRATED page's source directly without going through
`composedHtml`, unless the file is on the explicit allowlist. This is what stops a
future suite from silently seeing markers instead of the shell. When a new page is
migrated, any suite still reading it raw trips this guard.

### `tests_shell_b1.js` (composition guarantees)

For all 8 composed pages: exactly one header/primary-nav/main/footer, zero
duplicate ids, zero residual markers, correct active link + `aria-current`, the 5
core nav links in order, `data-i18n`/ARIA preserved, nav + footer present without
JS, no runtime fragment fetch. Plus the two shell variants (informational vs
solver: header class, logo size, on-page nav, select class) and cross-variant
guards. Plus `learnCapabilities` authorized on capabilities.html only.

### `tests_shell_composition_negative.js` (real negative mutations)

Every case introduces a REAL malformed input and proves the composer / guards
FAIL — not just that the positive path works. Covered (the required cases plus
extras): (1) header.html removed, (2) footer.html removed, (3) duplicate HEADER,
(4) duplicate FOOTER, (5) guide declared `pageType=solver`, (6) solver declared
informational, (7) `learnCapabilities` on guide (unknown attribute there), (8)
capabilities missing `learnCapabilities`, (9) about with `active=guide`, (10)
footer `pageType` override (unknown attribute), (11) unknown attribute, (12)
duplicate attribute, (12b) boolean not `true`/`false`, (13) a MUTATED fragment
producing `aria-current` on the wrong link (detected in the composed DOM), (14) a
MUTATED fragment producing a duplicate id (detected in the composed DOM), (15) the
raw-read guard executed for real (see below), (16) the FAQ generator from a spaced
path (delegated to `tests_spaces_path.js`).

Strict-parser cases (the marker body must be consumed WHOLE — only `name="value"`
tokens separated by whitespace): P1 bare attribute `bogus`, P2 unquoted `bogus=x`,
P3 single-quoted `bogus='x'`, P4 residual `!!!`, P5 `active` omitted on index.html,
P6 `active` omitted on about.html, P7 `pageType` omitted, P8 `learnCapabilities="false"`
on a normal page (unknown attribute), P9 `learnCapabilities="false"` on capabilities
(must be exactly `"true"`), P10 extra whitespace between attributes still composes
(positive control), P11 leading/trailing whitespace still composes (positive
control), P12 duplicate `active` whose second copy uses invalid syntax.

Case 15 is a REAL guard execution, not a string inspection: it builds a temp tree
whose path contains a space, copies `tests_composed_reads.js`, `composed-html.js`,
the 8 migrated pages and the composer+fragments into it, writes a bad
`engine/tests_bad_raw.js` that does `fs.readFileSync(path.join(siteDir,
'solver.html'))`, and runs `execFileSync(process.execPath,
[tempEngine/tests_composed_reads.js], { cwd: tempRoot })`. It asserts the runner
exits NON-ZERO and its output names `tests_bad_raw.js`. Then it replaces the bad
suite with one that routes through `composedHtml` and asserts the same runner now
exits ZERO. The temp tree is always removed in `finally`.

Fragment mutations use `createComposer({ fragmentDir })` against a temp fragment
dir seeded from the real fragments; page mutations use throwaway HTML with a valid
`PAGE_CONTEXT` filename. Mutations are temporary and always restored; no lingering
HTTP server; LF-only.

### `tests_engine_integrity.js` (engine SHA pin)

Pins the inline solver engine by its canonical SHA-256. The canonical convention
(the same `html.slice(indexOf(START), indexOf(END))` used by
`tests_worker_parity.js` and `tests_structure.js`) slices from `ENGINE_START` up to
but NOT including `ENGINE_END`: length 82657, SHA-256
`5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`. The doc comment
also records the alternate (END-included) value (82673 chars,
`bf93e3ca…`) so the two are never silently swapped.

### `tests_shell_golden.js` (independent golden baseline)

Nine byte-for-byte comparisons of the composer's output against fixtures in
`engine/fixtures/shell-golden/`. The fixtures were extracted from the pre-B1
approved product (one derived by hand from the no-active header), NOT generated by
the composer, so a composer change cannot move both the output and the expected at
once — drift makes the suite fail. Proven to bite: mutating a fragment class turns
the header suites red.

## Shared behavior (Checkpoint B2)

Four suites formalize the already-shared shell behavior (see
`checkpoint-b2-shared-behavior.md`). They sit ALONGSIDE the pre-existing
`tests_nav_menu.js`, which already covers the drawer's Escape, backdrop, focus
trap, focus restoration, link clicks, and breakpoint cleanup in depth (68
assertions across every real page). The B2 suites do NOT re-run those; they add
what was missing:

- `tests_build_badge.js` — executes `assets/build-badge.js` in jsdom with a mocked
  fetch, COUNTING fetch calls: valid response, network error, 404, invalid JSON,
  missing commit, DEV-LOCAL, missing testsPassed, missing element (0 fetches),
  double init before and after DOMContentLoaded (exactly 1 fetch each), a
  non-blocking check, no unhandled rejection, and a negative that strips the
  idempotency guard and proves double init then makes 2 fetches.
- `tests_shared_behavior.js` — adds the mobile-menu IDEMPOTENCY contract
  (double-init attaches no duplicate listeners; one drawer) plus aria-expanded and
  scroll-lock cleanup, and the language-selector/storage contracts: five
  languages; localStorage valid, invalid code, absent, and THROWING on read and on
  write; namespace fallback proven with a key whose Spanish and English values
  differ (`closeMenu` → "Cerrar"/"Close"), including a negative that forces an
  English fallback and shows the check fails; and the globals contract (nav-menu
  and build-badge add no global, i18n adds only `Plumline`; no `data-*-init`
  attribute in any source page).
- `tests_shell_isolation.js` — exports `checkShellIsolation(siteDir)`, the single
  official checker used by BOTH this suite and the negatives: the engine and
  Worker code live only in `solver.html`; informational pages carry no solver
  markers; the shared modules contain no engine/Worker code, fetch no HTML
  fragment, and never rebuild the shell via innerHTML; shared scripts load on all
  8 pages; page-specific scripts load only where they belong.
- `tests_shared_behavior_negative.js` — real mutations proving the guards bite.
  N1/N2 strip each idempotency guard and show double init reintroduces duplicate
  listeners. N3-N8 run the OFFICIAL `checkShellIsolation()` against a fresh temp
  tree carrying one mutation each (engine injected in about.html; a fragment
  fetch, an innerHTML shell rebuild, a Worker, and a `solveModel_` reference in a
  shared module; a solver-only script loaded by index.html), asserting `fail > 0`
  with a message that names the mutation, and removing the tree in `finally`.

Three minimal production fixes accompany these, each with the regression test
above: a `data-nav-menu-init` guard in `assets/nav-menu.js`, a `data-lang-init`
guard in `assets/i18n.js`, and a `data-build-badge-init` guard in
`assets/build-badge.js`. All three are runtime-only attributes that make a double
initialization a safe no-op (no duplicate listeners; a single fetch) without
changing content, style, endpoint, cache policy, error handling, or any observable
behavior — each script loads once in production, and the attributes never appear
in the source HTML or dist.

## Shared styles (Checkpoint B3)

Three suites formalize the CSS architecture (audit = State B: the shell CSS is
already one shared `assets/plumline.css`; see `shared-styles.md`). No production
CSS changed.

- `tests_css_golden.js` — exports `checkCssGolden(siteDir)` and verifies the CSS
  against `engine/fixtures/css-golden/shell-css-golden.json` (exact fragments +
  SHA-256 hashes derived from the approved state, NOT generated by a compositor):
  whole-sheet hash + UTF-8 byte length (via `Buffer.byteLength`, not
  `String.length`), exact shell fragments (`.mast`, `:focus-visible`,
  `.mobile-menu`, `.menu-toggle`, `.foot`, `.fine`, reduced-motion), structural
  counts (media queries, custom properties, `!important`, keyframes, font-face),
  every breakpoint present, and the solver-variant and Examples inline `<style>`
  blocks unchanged by hash.
- `tests_css_structure.js` — exports `checkCssStructure(siteDir)`: each page loads
  exactly one external stylesheet (`plumline.css?v=21`), no page adds a second CSS
  file, only solver and examples carry an inline `<style>` (the six informational
  pages carry none), the link precedes the inline `<style>`, shell selectors are
  present in the shared sheet, NO grid/results/charts selectors leak into it, no
  shared module fetches a `.css` or injects a `<style>`/`<link>`, and there is no
  CSS partial directory.
- `tests_css_negative.js` — builds temp trees, applies one real mutation each, and
  runs the SAME official checker (`checkCssGolden` / `checkCssStructure`), then
  asserts `fail > 0` with a message naming the mutation, removing the tree in
  `finally`: changed color/padding/breakpoint, removed selector/focus, altered
  specificity, added `!important`, a mutated solver variant, `#grid`/`.receipt`
  leaked into the shared sheet, an informational page gaining an inline `<style>`,
  a new external stylesheet, a CSS `fetch`, a CSS `innerHTML` injection, and a
  partial directory appearing.

The CSS golden and structure checkers are read-only static analysers; the
allowlist in `tests_composed_reads.js` records why `tests_css_golden.js` and
`tests_css_structure.js` read the inline `<style>` of solver/examples raw (a
region the composer never touches). `tests_css_negative.js` is deliberately NOT in
the allowlist — it copies pages into temp trees with `copyFileSync` and mutates
those, so it performs no raw read of a migrated page; the guard asserts this
explicitly.

## Legal / informational pages (Checkpoint C1)

Two suites protect about/privacy/terms (audit = State B; no production change).

- `tests_legal_pages.js` — exports `checkLegalPages(siteDir)` and verifies each
  page against `engine/fixtures/pages-golden/legal-pages.json` (captured from the
  pre-C1 source, NOT compositor-generated): `<head>` and `<main>` SHA-256 + UTF-8
  byte length (via `Buffer.byteLength`), exact canonical, i18n namespace,
  data-i18n key set, heading order, link set, id set (no duplicates), script src
  set, asset versions, every `#anchor` resolving to an id, isolation (no
  engine/Worker/grid/charts/exports, no fetch, no innerHTML, one stylesheet), and
  legal-content separation (privacy `pv*` vs terms `tm*`, both sharing only
  `updated`; about `about*`).
- `tests_legal_pages_negative.js` — 20 cases, each mutates a temp tree, runs the
  SAME `checkLegalPages()`, asserts `fail > 0` with a message naming the mutation,
  and removes the tree in `finally` (lost section, changed heading, lost
  `updated`, changed canonical, removed data-i18n, removed link, changed
  namespace, privacy↔terms text mixing, mixed keys, reordered headings, removed
  script, changed asset version, fetch, innerHTML, published partial, duplicate
  id, broken anchor, and a solver-touch case proving the checker never depends on
  solver).

The positive suite reads about/privacy/terms `<head>`/`<main>` raw; the allowlist
in `tests_composed_reads.js` records why (regions the shell compositor never
touches — verified byte-identical source vs dist). The negative suite copies into
temp trees, so it is deliberately NOT allowlisted.

## Guide page (Checkpoint C2)

Two suites protect guide.html (audit = State B; no production change).

- `tests_guide_page.js` — exports `checkGuidePage(siteDir)` and verifies guide
  against `engine/fixtures/pages-golden/guide-page.json` (captured from the pre-C2
  source, NOT compositor-generated): one `<main>`; `<head>`/`<main>` SHA-256 +
  UTF-8 byte length; section count/order; heading order; id set (no duplicates);
  anchors resolve; link set; data-i18n key set/count; `guide` namespace with no
  foreign key; the status-terminology keys present; OG/Twitter counts; script src
  set; asset versions; canonical; and isolation (no engine/Worker/grid/charts/
  exports, no fetch, no innerHTML, one stylesheet).
- `tests_guide_page_negative.js` — 25 cases, each mutates a temp tree, runs the
  SAME `checkGuidePage()`, asserts `fail > 0` with a message naming the mutation,
  and cleans up in `finally` (remove/duplicate/reorder section; remove/relevel/
  rename heading; remove/duplicate id; break anchor; change link; remove
  data-i18n; foreign key; change namespace; change canonical; change metadata;
  remove script; change asset version; fetch; innerHTML; engine; Worker; grid;
  published partial; solver-touch; and a spaced-path run).

The positive suite reads guide's `<head>`/`<main>` raw; the allowlist in
`tests_composed_reads.js` records why (regions the shell compositor never touches
— verified byte-identical source vs dist). The negative suite copies into temp
trees, so it is NOT allowlisted.

## Examples page (Checkpoint C3)

Two suites protect examples.html + its data (audit = State B/D; no production
change).

- `tests_examples_page.js` — exports `checkExamplesPage(siteDir)` and verifies
  against `engine/fixtures/pages-golden/examples-page.json` (from the pre-C3
  source, NOT compositor-generated): one `<main>`; `<head>`/`<main>` SHA-256 +
  bytes; inline `<style>` SHA-256 + bytes (matching the B3 golden inner content);
  JSON-LD present + hash; card order/count; no duplicate HTML slugs; approved
  `solver.html?ex=<slug>` link format; id set (no duplicates); data-i18n set;
  script src set; asset versions; canonical; OG/Twitter counts; examples-data.js
  file hash + slug/category/CATEGORY_ORDER/count + no duplicate slugs; the
  HTML↔data slug sync; the `buildExampleSolverUrl` compatibility contract (via
  examples-data.js `module.exports`, not the full solver HTML); progressive-
  enhancement presence (static catalog exists without JS); and isolation (no
  engine/Worker/grid/charts/exports, no fetch).
- `tests_examples_page_negative.js` — 26 cases (77 assertions), each mutates a
  temp tree, runs the SAME `checkExamplesPage()`, asserts `fail > 0` with a
  message naming the mutation, and cleans up in `finally` (remove/duplicate/
  reorder card; change HTML card slug; remove/duplicate data slug; change shared
  title; change category; break solver link; data example missing from HTML;
  internal/pending category exposed; remove script; change asset version; change
  canonical; change JSON-LD; remove data-i18n; change inline style; fetch; catalog
  via innerHTML with static cards removed; engine; Worker; grid/charts/exports;
  published partial; duplicate id; a solver-touch case proving independence from
  solver's full HTML; and a spaced-path run).

Model/result integrity is NOT a negative case of `checkExamplesPage()` — mutating
solver.html's math must not trip the Examples checker. It stays with the existing
`tests_examples.js` (each example solves to its declared result) and
`tests_ex_drawer.js` (drawer focus), which remain green and guard the math
externally.

The positive suite reads examples.html raw and `require()`s examples-data.js; the
allowlist in `tests_composed_reads.js` records why (regions the shell composer
never touches — verified byte-identical source vs dist). The negative suite copies
into temp trees, so it is NOT allowlisted.

## Capabilities page (Checkpoint C4)

capabilities.html is a GENERATED page (State D). Three suites protect it and its
toolchain.

- `tests_capabilities_page.js` — exports `checkCapabilitiesPage(siteDir)` and
  verifies against `engine/fixtures/pages-golden/capabilities-page.json` (from the
  pre-C4 approved output, NOT re-run through the generator): one `<main>`;
  `<head>`/`<main>`/template SHA-256 + bytes; region markers present exactly once
  and inner placeholders filled; section order/count; heading order; id set (no
  duplicates); anchors resolve; data-i18n set; scripts; asset versions; canonical;
  OG/Twitter; JSON-LD; every image's src/alt/width/height/loading; HTML↔inventory
  sync (each shown capability appears once as a cap-node, no hidden/pending id
  leaks); HTML↔media.json sync (each page image is a slot file with matching
  dimensions that exists on disk); lightbox hooks + version; the page-specific
  footer marker; progressive enhancement; and isolation.
- `tests_capabilities_generator.js` — drives the REAL `gen_capabilities.js` in
  temp trees: reproduces the approved page byte-for-byte; `--check` green when
  current / non-zero when stale; deterministic; touches only capabilities.html;
  fails on a missing OR duplicated marker, a missing required capability id, a
  missing media file, and a missing alt key in a language; runs from a spaced
  path; emits LF UTF-8; leaves no inner placeholder while keeping the delimiters.
- `tests_capabilities_page_negative.js` — 40 cases, each mutates a temp tree, runs
  the official checker (or the real generator for template-marker/data-key/
  traversal cases), asserts the specific failure, and cleans up in `finally`.

The existing `tests_capabilities.js` (1139, inventory honesty),
`tests_jsonld_features.js` (JSON-LD featureList↔inventory), and
`tests_home_capabilities.js` (Home) stay green and are not duplicated. The
positive suite reads capabilities.html and the template raw and `require()`s the
inventory/media; the allowlist in `tests_composed_reads.js` records why (regions
the shell composer never touches — verified byte-identical source vs dist). The
negative and generator suites copy into temp trees / drive the generator, so
neither is allowlisted.

Note: C4 added one generator guard (`gen_capabilities.js` now requires each region
marker exactly once, demonstrated by a negative). It does not change the output —
capabilities.html stays byte-identical to the C0 baseline.

## Home page (Checkpoint C5)

index.html is State D + C (generated regions + hand-authored sections). Three suites
protect it and its toolchain.

- `tests_home_page.js` — exports `checkHomePage(siteDir)` and verifies against
  `engine/fixtures/pages-golden/home-page.json` (from the pre-C5 approved output,
  NOT re-run through any generator): one `<main>`; `<head>`/`<main>` SHA-256 +
  bytes; 13-section order; heading order; id set (no duplicates); anchors resolve;
  data-i18n set; ARIA count; scripts; asset versions; canonical; OG/Twitter; both
  JSON-LD blocks; generated-region markers exactly once, in order, START-before-END,
  no unfilled placeholder; FAQ sync (home-faq.json order/count, no duplicates, one
  in the accordion, one Question per JSON-LD entry); every picture/source/img; hero
  responsive contract; contact mailto (no personal Gmail, no waitlist); progressive
  enhancement; isolation. It also carries a positive isolation contract (2
  assertions): editing solver.html in a temp tree leaves `checkHomePage` green
  (solver independence), so the checker reports 63 (61 core + 2 contract).
- `tests_home_generator.js` — drives the REAL gen_home_capabilities/gen_home_faq/
  gen_jsonld (and gen_claims) in temp trees: `--check` green; reproduce the approved
  index.html byte-for-byte; deterministic; each touches only its own region; fail on
  missing/duplicated/inverted markers; gen_home_faq fails on incomplete FAQ data;
  run from a spaced path; emit LF UTF-8; leave no residual placeholder; do not modify
  solver.html; gen_claims writes only data/claims.json.
- `tests_home_page_negative.js` — 55 cases, each mutates a temp tree, runs the
  official checker (or the real generator for marker/data cases), asserts the
  specific failure, and cleans up in `finally`.

The existing tests_home_capabilities (80), tests_home_faq (90), tests_home_i18n
(31), tests_home_render (232, jsdom), tests_home_seo (189), tests_jsonld (8),
tests_jsonld_features (26) and tests_gen_stability (3) stay green and are not
duplicated. The positive suite reads index.html raw and `require()`s the inventory /
reads home-faq.json; the allowlist in `tests_composed_reads.js` records why (regions
the shell composer never touches — verified byte-identical source vs dist). The
negative and generator suites copy into temp trees / drive the generators, so
neither is allowlisted.

Note: C5 added three generator guards (each index.html generator now requires its
markers exactly once, demonstrated by negatives). They do not change the output —
index.html stays byte-identical to the C0 baseline.

## Checkpoint C — final RAW_SOURCE_ALLOWLIST

The `RAW_SOURCE_ALLOWLIST` object in `tests_composed_reads.js` has **21 keys** after
C5. Two metrics matter, both with the same +5 increment from Checkpoint C:

- **Whole object:** pre-C **16** → post-C **21** (+5).
- **`tests_*.js` entries only:** pre-C **14** → post-C **19** (+5).

The +5 are the five positive page-checkers added by Checkpoint C (one per phase):
`tests_legal_pages.js` (C1), `tests_guide_page.js` (C2), `tests_examples_page.js`
(C3), `tests_capabilities_page.js` (C4), `tests_home_page.js` (C5) — each reads only
the head/main (and its data source) of one page, justified because those regions are
byte-identical source vs dist.

The full 21 keys (sorted), with the two auxiliary (non-`tests_*.js`) entries marked:

```
compose-shell.test-note        [auxiliary: a shell-composition annotation, not a suite]
composed-html.js               [auxiliary: the composed-HTML router module itself]
tests_capabilities_page.js     [C4]
tests_css_golden.js
tests_css_structure.js
tests_direction.js
tests_engine_integrity.js
tests_error_i18n.js
tests_examples.js
tests_examples_page.js         [C3]
tests_grid_input.js
tests_guide_page.js            [C2]
tests_home_page.js             [C5]
tests_legal_pages.js           [C1]
tests_panel.js
tests_region_plot.js
tests_shell_composition_negative.js
tests_solve_announce.js
tests_status_coverage.js
tests_structure.js
tests_worker_parity.js
```

Of the 19 `tests_*.js` entries, 14 pre-date Checkpoint C (solver DOM suites, engine/
worker integrity, error-i18n, shell-composition-negative, and the two B3 CSS suites
tests_css_golden / tests_css_structure) and 5 were added by C. No negative suite and
no generator suite is ever allowlisted (they copy into temp trees or drive the real
generators). No stale entries remain.

(Note: the guard's own console line prints `PASSED: N` where N counts framework
checks, not the object size — the authoritative allowlist figure is the 21-key
`RAW_SOURCE_ALLOWLIST` object, of which 19 are `tests_*.js` entries.)

## dist / manifest validation (Checkpoint A, preserved)

`validate_dist.js` (exact root allowlist, per-page parity — now `dist ==
composeHtml(source)` for migrated pages, root public byte-identical, recursive
asset parity, no internal files), `test_dist_http.js` (full manifest SHA-256 +
requiredPaths over HTTP), `verify_manifest.js` shared with the production smoke,
and `validate_lockfile.js` (platform variants + engines).

## Windows / portability

LF via `.gitattributes`, Node 24.15.0, portable lockfile (Linux/Windows/macOS),
`execFileSync` for paths with spaces, no HTTP server left with open handles, no
Bash-only constructs in Node scripts. `tests_spaces_path.js` is a dedicated
contract: it copies the FAQ generator and its inputs into a temp dir whose path
CONTAINS A SPACE, runs the generator via `execFileSync(process.execPath, […])`
(succeeds), shows the old concatenated `execSync('node ' + path)` form breaks
there, and asserts both `tests_home_faq.js` and `run_all.js` use the safe form.
