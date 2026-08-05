# Checkpoint F3b — Home core sections (use cases, workflow, verification, featured examples)

## Base tree

F3b starts from the effective **F3a-final** tree (the accessibility-corrected
hero). This environment has no access to the real git repository, so the base is
the working tree that reproduces F3a-final exactly (documented limitation; no SHA
is invented). Invariants confirmed on that base:

- Battery baseline: **TOTAL PASSED 12253**, VERIFY ALL GREEN, VALIDATE HTML/DIST
  OK, DIST HTTP OK.
- engine `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`
- mirror `faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`
- dist/solver.html 218396 bytes, sha
  `36bfb88d54c5a4d6cc811db2f05c513adfb90f4908ac947faf3c22dd027862d8`
- CSS F3a `e5167f396c394e241c0be2022047e9929c08893ad20f54fd3b3469a7149b658d`
- nine examples, five languages, six requests, generate:examples green, hero F3a
  intact.

## Scope

F3b modifies ONLY the four Home core sections and their supporting copy, styles,
projector, tests and docs: `#how`, `#use-cases`, `#verify`, `#example`. It does
not touch audiences, the capability/limits summary, privacy, add-on, FAQ, final
CTA, footer, nav, general SEO metadata, the Examples index, Guide, Capabilities,
Solver, the engine, the mirror or the Worker. No new pages, no new examples.

## BEFORE audit

- `#how`: four steps (Paste / Confirm / Solve / Check) in a `grid-4`.
- `#use-cases`: six identical `grid-3` cards, each linking a canonical slug.
- `#verify`: a two-column layout — four points plus a heavy
  `verified-result-production.png/webp` screenshot.
- `#example`: five hand-written cards that re-used the use-case i18n keys and
  duplicated example metadata by hand, plus a "See all examples" text link.

## AFTER structure

### How it works — three steps
A semantic `<ol class="how3">` with exactly three panels, numbers in brass:
1. **Paste or build your model** (`howStep1H/P`).
2. **Confirm decisions, limits and objective** (`howStep2H/P`) — communicates
   review-before-solving ("so you can review them before solving").
3. **Solve and check the result** (`howStep3H/P`).
The process is understandable without opening the Guide, and is not repeated in
any other section.

### Use cases — hierarchy
Two featured decisions (`.uc-hero`, production-plan + workforce-scheduling) with a
"Featured decision" tag, then a compact `.uc-list` of four
(supplier-activation, delivery-load, marketing-budget, project-selection). Six
total, not six identical cards. Every slug is a canonical catalogue slug.

Catalogue correspondences (all real; none invented): production→production-plan,
workforce→workforce-scheduling, supplier→supplier-activation,
delivery→delivery-load, marketing→marketing-budget, project→project-selection.

### Verification — semantic HTML/CSS flow (the differentiator)
The screenshot is removed. A `figure.verify-flow` renders four phases as an
ordered list of panels: **Model interpreted → Result calculated → Formulas
checked → Status reported**. The final phase uses a green check glyph (✓) plus
text, so it reads without relying on colour. The section keeps the four verify
points and adds an honest disclaimer (`verHonest`): Plumline shows the
interpreted model and rechecks the result against the formulas; it does not claim
a whole spreadsheet is correct, and an inaccurate model may not represent the real
decision. Approved vocabulary only (optimal, feasible, incomplete, infeasible,
unbounded, verification, result status); no forbidden claims (mathematical proof,
guaranteed, always correct, perfect answer, error-free). No engine runtime, no
Solver duplication, no fetch, no new numbers.

### Featured examples — catalogue projection
`#example` now carries closed markers `<!-- HOME_FEATURED_START/END -->` filled by
a new deterministic projector. Three-to-four featured examples (four in the
current design): production, workforce, project, blend. Each card shows only
catalogue-derived metadata — title, description, model type, maximise/minimise —
and a canonical `solver.html?ex=<slug>` link, plus an "Explore all examples" CTA
to `examples.html`.

## Projector — engine/gen_home_featured.js

Single source of truth: the canonical catalogue
(`src/shared/examples/index.js`). Home keeps only a closed, ordered list of
featured KEYS (`FEATURED_KEYS = ['production','workforce','project','blend']`);
title/description/type/sense/URL are projected, never hand-copied. Guards (all
fatal): key not in catalogue, key duplicated in the Home list or the catalogue,
example not public, missing markers, duplicated markers. HTML and attributes are
escaped; links are canonical. A `--check` mode is the stale guard. The projector
is idempotent (two runs → identical bytes) and touches only its own region.

Integration into official flows:
- `npm run verify` → step 4c runs `gen_home_featured.js --check` (build does not
  depend on a manual prior run).
- `package.json` script `generate:home-featured`.
- `tests_home_generator.js` drives it in temp trees (clean --check, byte-for-byte
  reproduction, determinism, region isolation, stale drift, missing/duplicated
  markers).
- `tests_f3b_home_sections.js` runs the projector guards and stale/idempotency
  checks.

## Home namespaces

Home now loads the examples namespace so the projected titles/descriptions
resolve at runtime:
`Plumline.i18n.init('home', ['capabilities', 'examples'])`. The resolution order
is `common → home → capabilities → examples`, matching the runtime.

## Translations (five languages)

~26 new keys per language (en/es/pt/de/fr): howTitle3, howStep1H/P..howStep3H/P,
ucLead, ucFeaturedTag, ucMoreTitle, verFlowTitle, verFlow1H/P..verFlow4H/P,
verHonest, exTypeContinuous/Integer/Binary/Mixed, exSenseMax/Min. British
English, short phrases, canonical terminology, no visible English fallback, FR
apostrophes escaped. Orphan keys from the old markup were removed from the home
namespace only (howTitle-home, howPaste/Confirm/Solve/Check H+P, exWorkshopH),
leaving the solver namespace untouched.

## Accessibility

Semantic `<ol>` for the steps and the verify flow; decorative numbers are
`aria-hidden`; the verify figure has an accessible name (figcaption); the status
phase does not rely on colour (✓ glyph + text); use-case and featured links wrap
a heading for an accessible name; no nested interactive controls; no duplicate
IDs; no empty links. WCAG AA targeted.

## Responsive

The three how-steps, the two-up featured grid, the compact use-case list and the
verify layout collapse to one column at ≤860px. Captured widths are exactly the
viewport width at 320/360/390/768/1200/1440 — no horizontal overflow. German and
Spanish copy fits without clipping.

## Performance and privacy

| Asset | Before (F3a) | After (F3b) |
| --- | --- | --- |
| index.html | 26840 | (F3b main) |
| plumline.css | 53913 | 58492 |
| assets/i18n.js | 277218 | 284501 |
| dist/solver.html | 218396 (36bfb88d…) | 218396 (36bfb88d…) unchanged |

Six requests, zero remote sources, zero CDN, zero trackers, zero new cookies,
zero runtime fetch, zero new runtime dependencies. The verify screenshot removal
drops image bytes; the sections are HTML/CSS + inline text. The composed solver
is unchanged (CSS is external).

## Tests and rebaselines

New suite `tests_f3b_home_sections.js` (167 assertions): A How it works, B use
cases, C verification, D featured examples (+ projector stale/idempotency/marker/
escape guards), E general contracts. Registered in `suites.js` and allowlisted in
`tests_composed_reads.js` (minimal, specific, documented — reads index.html
`<main>` raw, a region the shell composer never touches).

Rebaselines, each classified:
- `tests_i18n_pages.js`, `tests_i18n_coverage.js` — **preserved functional
  contract**: added `examples` as a Home namespace (runtime parity).
- `tests_home_i18n.js` — **intentional F3b redesign rebaseline**: namespace guard
  now checks `['capabilities','examples']` (exact, no duplicates); verify-image
  assertion replaced by the four-phase flow translation checks.
- `tests_home_render.js`, `tests_home_seo.js` — **obsolete duplicated structure
  replaced**: Home is image-free; approved copy howSolveP→howStep3P.
- `tests_home_page.js` / `home-page.json` — **intentional rebaseline**: main SHA,
  heading order, generated-region markers (incl. HOME_FEATURED), pictures=0.
- `tests_home_page_negative.js` — **intentional rebaseline**: N29–N35 retargeted
  to real F3b contracts (remove a step, alter a slug, remove the verify flow, add
  a fourth step, break the examples CTA, remove a HOME_FEATURED marker).
- `validate_html.js` — **intentional rebaseline**: verifyShotAlt contract
  replaced by a strong verification-flow contract with real negative mutations.
- `tests_home_capabilities_refs.js` — **canonical catalogue projection**:
  exName_/exDesc_ allowed ONLY inside the HOME_FEATURED markers (projection), not
  outside (manual duplication still fails).
- `tests_home_generator.js` — **canonical catalogue projection**: gen_home_featured
  added to the generator-parity set.
- `tests_canonical_catalogue_positive.js`, css-golden — **intentional physical
  rebaseline**: i18n.js 284501, CSS 58492 (not the only semantic evidence).

## Accounting

- 12253 — F3a baseline.
- +91 — F3b contracts and rebaselines before registering the suite → 12344.
- +167 — suite F3b registered → 12511.
- +1 — composed_reads allowlist entry → 12512.
- +7 — home_generator featured-parity integration → **12519**.

Both final verify runs report **12519**; skips, manual checks and
expected-to-fail mutations are not counted.

## Validation

From a clean tree: `rm -rf dist; npm ci; npm run verify; npm run build; npm run
verify; npm run build`. Both verify runs 12519, VERIFY ALL GREEN, VALIDATE
HTML/DIST OK, DIST HTTP OK. dist/solver.html unchanged (36bfb88d…, 218396),
engine/mirror intact, nine examples, catalogue green, five languages, six
requests, zero remote/trackers.

## Screenshots and hashes

- CSS after F3b: `4c743aed3f36104b10015369e4cbe116b3e1c19fb8a38f784da8de31bfe862b4`
  (the served CSS during AFTER capture matches this; it differs from F3a because
  F3b appends the F3b style layer — a legitimate change).
- dist/solver.html: 36bfb88d… (unchanged).
- AFTER captures were taken from a clean build on a fresh port, non-persistent
  context, service workers blocked, cache disabled, cache-buster query.

## Rollback

Revert the overlay files (2 added, 20 modified, 0 deleted) back to their F3a-final
state; there are no deletions. Removing the two added files
(`engine/gen_home_featured.js`, `engine/tests_f3b_home_sections.js`),
un-registering the suite in `suites.js` and the allowlist in
`tests_composed_reads.js`, and reverting `index.html` / `assets/*` / the rebaselined
tests restores F3a-final at 12253.

## Remaining for F3c (not started)

The still-untouched Home sections — audiences, capability/limits summary,
privacy, add-on, help, FAQ, final CTA — remain exactly as approved. F3 is NOT
complete; F3c has not begun.

## F3b-final — Windows portability corrections

An independent review flagged three issues to fix before applying the overlay on
Windows. None change the design, copy, sections, featured examples or positioning
(the built index.html and plumline.css are byte-identical to the prior F3b:
index dist 4ec4fe2f…, CSS 4c743aed…).

1. **Windows portability (blocking).** The F3b suites used Unix executables via
   `execFileSync('cp'/'rm', ...)`, which fail on Windows Node with `spawnSync cp
   ENOENT` / `rm ENOENT`. Replaced with cross-platform Node APIs: temp-tree copies
   use `fs.cpSync(src, dst, { recursive: true })` and cleanup uses
   `fs.rmSync(dir, { recursive: true, force: true })`. Node subprocesses run via
   `process.execPath` (no bare `'node'`). No `cp`, `rm`, `mv`, `sed`, `grep`,
   `bash`, `sh`, `cmd` or `powershell`; no Git Bash / WSL / coreutils dependency.
   The temp tests are otherwise identical, always clean up, and support paths with
   spaces (verified by running the suites from `/tmp/path with spaces`). A new
   section F in `tests_f3b_home_sections.js` fails if any F3b suite reintroduces an
   external command, and asserts the projector spawns no external process.

2. **Fixed-length lookup removed.** `gen_home_featured.js` `resolve()` looped
   `for (i = 0; i < 9; i++)`; it now uses `catalogue.filter(entry => entry &&
   entry.key === key)` over the whole catalogue, and the suite helper uses
   `catalogue.find(...)`. The projector works for any valid catalogue length; the
   "nine examples" count is kept as a SEPARATE published-catalogue contract
   (`catalogue.length === 9`), not baked into the lookup. A new section G asserts
   the projector source has no `< 9` bound and that a full-scan filter finds an
   entry past index 8.

3. **SCREENSHOT_MANIFEST.csv fixed.** The header declared 15 columns but rows
   carried 16 values (`non-persistent,sw-blocked,yes-no-store` under
   `clean_context,cache_disabled`). Added the missing `service_workers` column so
   the header is
   `set,file,page,state,viewport,language,width,height,bytes,sha256,served_css_sha256,capture_url,port,clean_context,service_workers,cache_disabled`.
   The CSV is generated with a real CSV writer (correct quoting for fields with
   commas) and validated automatically: every row has the same column count as the
   header, comma fields are quoted, 52 data rows plus the header, file references
   exist, and hashes match.

Accounting: 12519 → **12551** (+32), all in `tests_f3b_home_sections.js`
(167 → 199): section F (Windows portability guards) and section G (full-collection
resolve). No existing test weakened. Both verify runs report 12551.

Windows note: this environment is Linux, so the suites were not physically run on
Windows. The code no longer depends on any Unix executable (only `fs.*` and
`process.execPath`), and the final real validation will be done locally on Windows
Node 24.15.0.
