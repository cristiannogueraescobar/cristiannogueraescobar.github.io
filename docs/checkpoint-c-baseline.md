# Checkpoint C0 — informational pages baseline

Real state of the seven informational pages before any C change. Base SHA:
pending user verification (assistant works from a snapshot, cannot fetch
origin/main). Node used: v22.22.2 (repo pins `>=24.15.0 <25`; 24.15.0 unavailable
here). `npm run verify`: ALL GREEN. `npm run build`: green. Baseline test total:
**7397**. Motor 82657 / 5d68ed17… intact (3/3), Worker parity 143, B1 golden 9,
B2 contracts green, B3 CSS golden 28. solver.html is OUT of scope.

## Per-page inventory (real data)

| Page | Lines | Chars | Bytes (UTF-8) | `<section>` | Inline `<script>` | `<style>` | `<a>` | `<img>` | data-i18n | id= | meta | canonical | og: | twitter | JSON-LD | aria- | gen regions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| index (home) | 298 | 24 614 | 24 622 | 13 | 3 | 0 | 19 | 2 | 126 | 11 | 17 | 1 | 9 | 5 | 2 | 14 | 8 |
| guide | 161 | 15 202 | 15 202 | 12 | 1 | 0 | 9 | 0 | 63 | 6 | 16 | 1 | 8 | 4 | 0 | 0 | 0 |
| examples | 135 | 8 647 | 8 665 | 2 | 2 | 1 | 10 | 0 | 3 | 2 | 15 | 1 | 8 | 4 | 1 | 0 | 0 |
| capabilities | 205 | 15 837 | 15 837 | 5 | 2 | 0 | 18 | 3 | 85 | 25 | 15 | 1 | 8 | 4 | 1 | 9 | 4 |
| about | 70 | 4 928 | 4 928 | 2 | 1 | 0 | 2 | 0 | 14 | 2 | 15 | 1 | 8 | 4 | 0 | 0 | 0 |
| privacy | 74 | 6 230 | 6 236 | 0 | 1 | 0 | 4 | 0 | 34 | 0 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| terms | 68 | 4 629 | 4 641 | 0 | 1 | 0 | 1 | 0 | 25 | 0 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |

"gen regions" counts `HOME_*_START/END` and `CAPABILITIES_*_START/END` marker
pairs already present in the source (see canonical sources below).

## Shell composition (B1) — already in place
Every page carries `<!-- PLUMLINE:HEADER pageType="…" active="…" -->` and
`<!-- PLUMLINE:FOOTER -->` (capabilities carries HEADER via its template; all seven
carry FOOTER). B1 replaces these with real header/footer fragments at build. The
`<head>` (metadata) and `<main>` (body) are inline in each source page. C must not
touch the shell composition, fragments, PAGE_CONTEXT, or B1 golden.

## Duplication analysis (real, measured)

### `<head>` metadata — mostly page-specific, NOT duplication
Only **3** `<meta>`/`<link>` lines are byte-identical across all seven pages:
`charset=utf-8`, the viewport meta, and `plumline.css?v=21`. Everything else
(title, description, canonical, OG, Twitter) is page-specific CONTENT, not
duplicated boilerplate. Privacy/terms carry only 3 metas (no OG/Twitter); the
other five carry the full social set. Centralizing the 3 shared lines would be a
trivial extraction of near-zero value and is NOT proposed.

### Body wrapper — repeated structure, part of the shell frame
The `field-deep` → `plumb` → `<main id="content">` wrapper repeats on every page.
It is structural framing, not content. It sits OUTSIDE the header/footer fragments
but is the same on each page. This is the one genuinely repeated non-shell
structure; whether to extract it is weighed per phase (see proposal), always
build-time and always preserving exact DOM order and the composed output.

### Inline scripts — already minimal
Each page ends with `Plumline.i18n.init('<namespace>')` (home also passes a second
namespace; examples adds a catalog driver comment + the shared examples-data
driver). JSON-LD blocks are page-specific `<script type="application/ld+json">`.
No duplication to extract here — these are one-liners or page-specific content.

## Canonical generation already in place (State D pages)

There are **five generators** and a `data/` directory of canonical sources:
- `engine/gen_capabilities.js` → `capabilities.html` from
  `engine/templates/capabilities.template.html` + `data/media.json`
  (markers `CAPABILITIES_HEAD_START/END`, `CAPABILITIES_CONTENT_START/END`).
- `engine/gen_home_capabilities.js` → the home capabilities region
  (`HOME_CAPABILITIES_START/END`), derived from the capabilities inventory.
- `engine/gen_home_faq.js` → the home FAQ + its JSON-LD
  (`HOME_FAQ_START/END`, `HOME_FAQ_JSONLD_START/END`) from `data/home-faq.json`.
- `engine/gen_jsonld.js` → the home SoftwareApplication JSON-LD
  (`HOME_SOFTWARE_JSONLD_START/END`).
- `engine/gen_claims.js` → `data/claims.json`.

Canonical data: `data/{claims,home-faq,home-screenshots,media,pending-translations}.json`.
All generators have a `--check` mode; `tests_gen_stability.js` proves the two that
both write index.html touch disjoint regions and are order-independent. **These are
the single sources of truth and must be preserved, not duplicated.**

## Classification (A/B/C/D per page)

- **index (home) — State D (generated) + C (specific).** Large parts are already
  generated into marked regions (capabilities, FAQ, both JSON-LD blocks) from
  canonical sources. The hero, steps, verification, add-on, and contact sections
  are page-specific hand-authored HTML. No new source of truth may be created;
  the generated regions stay generated. Highest risk (SEO, JSON-LD, generators).
- **capabilities — State D (generated).** Fully driven by
  `capabilities.template.html` + `data/media.json` via `gen_capabilities.js`
  (head + content regions), plus the lightbox and a special footer. Canonical
  source is the template; must NOT get a second source. High risk.
- **guide — State C (monolithic, specific).** 12 sections of documentation-style
  content, 63 data-i18n keys, one `init('guide')` script. No duplication; content
  is specific. Candidate for at most a clear source reorganization, no
  per-section fragmentation.
- **examples — State C/D.** Static catalog HTML plus `assets/examples-data.js`
  (shared metadata driving both catalog and solver) and a page-specific inline
  `<style>` (frozen by B3 golden). The catalog must stay in HTML (not runtime
  generated). Low structural duplication.
- **about — State C (specific).** A short branded page (2 sections, OG/Twitter
  present). Structurally unlike privacy/terms; does NOT group with them.
- **privacy — State C, shares a skeleton with terms.** `<main class="prose">` →
  `<h1 data-i18n>` → `<p class="updated" data-i18n="updated">` → headings/paragraphs.
- **terms — State C, shares a skeleton with privacy.** Same `prose` skeleton;
  only the data-i18n keys and text differ (that is content, not structure).

No single solution fits all seven. Home and capabilities are already State-D
generated and must be preserved as-is; guide/examples/about are specific
monoliths; privacy/terms share a real legal `prose` skeleton.

## What is genuinely shared vs specific
- Genuinely shared, non-shell: the `field-deep/plumb/main` body wrapper (all
  pages) and the `prose` legal skeleton (privacy + terms only).
- Everything else is page-specific content or already-generated regions.

## Proposal per phase (to be authorized one at a time)

The guiding decision: **formalize and protect first; extract only where a real,
repeated non-shell structure exists and extraction preserves the exact composed
output.** Given the audit, C is closer to a "protect + document + minimal
build-time source reorganization" checkpoint than a large centralization — much
like B3 turned out to be State B.

- **C0 (this turn):** baseline, classification, proposal, risks, and the baseline
  golden fixtures plan. No page modified.
- **C1 (legal):** protect about/privacy/terms with independent golden fixtures
  (exact body, section order, headings, IDs, anchors, links, data-i18n, metadata,
  JSON-LD, images, scripts) + structural contracts. Extract the shared `prose`
  legal skeleton for privacy/terms into a build-time source ONLY if it keeps the
  composed dist byte-identical and never mixes the two namespaces; otherwise leave
  them and just add contracts. about stays as-is (distinct structure). Negatives:
  privacy text in terms, legal content mixed, metadata swapped, etc.
- **C2 (guide):** golden fixture + contracts; source reorganization only if it
  yields a clear maintainability win with byte-identical dist. Likely State B
  (already organized) → protect + document.
- **C3 (examples):** golden fixture + contracts protecting the catalog, slugs,
  math data, `examples-data.js`, and the inline `<style>` (already B3-frozen).
  Keep the catalog in HTML.
- **C4 (capabilities):** protect the canonical generation. Golden fixture derived
  from the pre-C generated output (NOT from the generator), plus contracts that
  the template + `data/media.json` remain the single source and `gen_capabilities
  --check` stays green. No second source of truth.
- **C5 (home):** protect the generated regions and hand-authored sections. Golden
  fixture from the pre-C output; contracts that the generators own their marked
  regions and the hand-authored sections are unchanged. Highest risk, done last.

## Files proposed to create/modify (across the whole of C — not this turn)
Create: `docs/checkpoint-c-baseline.md` (this file), `docs/informational-pages.md`,
`engine/fixtures/pages-golden/` (independent per-page fixtures), and per-phase
`engine/tests_pages_*.js` suites + one negative suite. Modify (later, per phase):
`engine/suites.js` (register new suites), `docs/{architecture,testing,
github-pages-deployment}.md`. If a shared legal skeleton is extracted:
`src/pages/legal/` source + a body composer with its own tests, kept strictly
separate from the B1 shell composer. NO production page is modified in C0.

## Risks
- Home and capabilities are generator-driven; any reorganization risks
  desynchronizing a generated region from its canonical source. Mitigation:
  golden from pre-C output + preserve `--check`, do these phases last.
- Extracting the body wrapper or the legal skeleton could shift whitespace or DOM
  order in dist. Mitigation: require byte-identical composed dist or an exact,
  documented, protected diff — never a generic allowlist.
- examples inline `<style>` is B3-frozen; must not move.
- No browser here: visual parity is by golden HTML + contracts; final visual
  validation left to Windows/GitHub.

## Baseline metrics (source, pre-C)
Total informational source: 1011 lines / 80 087 chars / 80 131 bytes across 7
pages. Inline `<style>`: 1 (examples, B3-frozen). Inline `<script>`: 11 total
(6 are the one-line `init(...)`, 4 JSON-LD, 1 examples catalog driver). External
generators: 5. Canonical data files: 5. CSS requests/page: 1 (plumline.css?v=21).
No page loads engine/Worker/grid/charts/exports. These are the numbers each phase
will be measured against.

## Confirmation
No production file was modified in C0. Only this baseline document was created.
