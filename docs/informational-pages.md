# Informational pages architecture

How Plumline's seven informational pages (index, guide, examples, capabilities,
about, privacy, terms) are organized. This document grows one phase at a time
across Checkpoint C. solver.html is out of scope.

## Shared frame (from B1)
Every page carries `<!-- PLUMLINE:HEADER pageType="…" active="…" -->` and
`<!-- PLUMLINE:FOOTER -->`. The B1 shell compositor replaces these with real
header/footer fragments at build (Vite), producing complete HTML in dist. The
`<head>` (metadata) and `<main>` (body) are authored inline per page and are NOT
touched by the shell compositor — verified byte-identical source vs dist for the
`<head>` and `<main>` regions.

## Canonical generation already in place
Five generators own marked regions from canonical data under `data/`:
`gen_capabilities.js` (capabilities.html from `capabilities.template.html` +
`data/media.json`), `gen_home_capabilities.js`, `gen_home_faq.js`
(`data/home-faq.json`), `gen_jsonld.js`, `gen_claims.js` (`data/claims.json`).
Each has a `--check` mode; `tests_gen_stability.js` proves the two that both write
index.html touch disjoint regions. These are the single sources of truth for their
regions and must never be duplicated by hand-edited HTML.

## Per-page status

### Legal / informational (C1 — done)
- **about** — State B. Short branded page, own `about` i18n namespace, full
  OG/Twitter. Distinct from privacy/terms; does not share a template.
- **privacy** — State B. `<main class="prose">` legal document, `legal` namespace,
  `pv*` key prefix + shared `updated`.
- **terms** — State B. Same `prose` skeleton, `legal` namespace, `tm*` key prefix
  + shared `updated`.
- Protected by `checkLegalPages()` + `legal-pages.json` fixture + 20 negatives.
  No production change. The 95-byte shared legal skeleton was measured and
  deliberately not extracted (cost ≫ reduction). See
  `checkpoint-c1-legal-pages.md`.

### guide (C2 — done)
- **guide** — State B. Long documentation page (12 sections, 18 headings, 63
  `guide`-namespace i18n keys, 6 ids, 2 anchors). Length is not duplication:
  10/12 sections have unique skeletons, only ~265 bytes of trivial wrappers
  repeat, so nothing was extracted. Protected by `checkGuidePage()` +
  `guide-page.json` fixture + 25 negatives, including the status-terminology keys.
  No production change. See `checkpoint-c2-guide.md`.

### examples (C3 — done)
- **examples** — State B/D. Two legitimate representations: examples.html (visible
  9-card catalog, works without JS) and assets/examples-data.js (single source of
  truth for slug/category/type/sense). The full math models/results live in
  solver.html and are guarded by `tests_examples.js`. The slug appears in both the
  HTML link and the data — deliberate progressive enhancement, kept and
  sync-checked, not removed. Protected by `checkExamplesPage()` +
  `examples-page.json` fixture + 26 negatives (HTML↔data sync, catalog-without-JS,
  B3 inline style, isolation). Model coefficients, constraints, and expected
  results are guarded externally by `tests_examples.js` and `tests_ex_drawer.js`
  (not by checkExamplesPage, and not counted as Examples negatives).
  No production change. See `checkpoint-c3-examples.md`.

### capabilities (C4 — done)
- **capabilities** — State D (generated). capabilities.html is produced by
  `engine/gen_capabilities.js` from the template
  (`engine/templates/capabilities.template.html`), the inventory
  (`assets/product-capabilities.js`: 24 entries, 16 shown), `data/media.json`
  (3 images), and `assets/i18n.js`. Never a manual source. Protected by
  `checkCapabilitiesPage()` + `capabilities-page.json` fixture + generator-parity
  suite + 40 negatives (region golden, generator parity, HTML↔inventory/media
  sync, lightbox, page-specific footer, isolation). One generator guard added
  (exactly-once markers, demonstrated by a negative); the public output is
  byte-identical to the C0 baseline. See `checkpoint-c4-capabilities.md`.

### index / Home (C5 — done)
- **index** — State D + C. index.html has 13 `<section>` elements in `<main>`:
  11 are purely hand-authored (hero-split, trust-bar, how, use-cases, verify,
  example, privacy, limits, add-on, help, final CTA) and 2 host a generated region
  (`#capabilities` hosts HOME_CAPABILITIES, `#faq` hosts HOME_FAQ). Two further
  generated regions live in `<head>` and are NOT sections (HOME_SOFTWARE_JSONLD,
  HOME_FAQ_JSONLD). Three generators write index.html regions
  (gen_home_capabilities.js → HOME_CAPABILITIES; gen_home_faq.js → HOME_FAQ +
  HOME_FAQ_JSONLD; gen_jsonld.js → HOME_SOFTWARE_JSONLD); gen_claims.js is related
  but writes data/claims.json, NOT an index.html region. Protected by
  `checkHomePage()` + `home-page.json` fixture + generator-parity suite + 55
  negatives (region golden, region boundaries, generator parity,
  FAQ/capabilities/image sync, hero, contact/add-on, isolation) + a positive
  solver-independence contract. Three generator
  guards added (exactly-once markers, demonstrated by negatives); the public output
  is byte-identical to the C0 baseline. See `checkpoint-c5-home.md`. Checkpoint C is
  now complete (C0–C5).

## What must NOT move to shared
- Page-specific content (each page's `<main>` body).
- Per-page metadata (title, description, canonical, OG/Twitter) — only charset,
  viewport, and the stylesheet link are identical across pages and stay inline.
- Legal text — never into JSON or JavaScript.
- Generated regions — they belong to their generator + canonical data file.
- The examples inline `<style>` (frozen by B3).

## How to revert C without reverting A/B
Each phase's additions are test suites, fixtures, docs, and (where justified)
build-time source with its own compositor and tests — all listed in that phase's
doc. Reverting a phase means deleting its files and unregistering its suites; the
A (build), B1 (shell), B2 (behavior), and B3 (CSS) layers are never modified by C.
