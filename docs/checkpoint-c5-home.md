# Checkpoint C5 — Home page

Scope: index.html and its generation toolchain. Result: **State D + C** (generated
regions + hand-authored sections). C5 formalizes the region boundaries, the
canonical sources, and the sync between data and page, adding golden + contracts +
docs. The public output (index.html) is byte-identical to the C0 baseline; three
generator guards were added (see "Real defects fixed"). This is the final phase of
Checkpoint C.

## Architectural decision: keep the mixed page; protect its boundaries

index.html is NOT reorganized by length. No section is extracted to a fragment; no
extra compositor is added (the existing generators already own their regions and
there is no significant uncovered duplication). C5 conserves the generated regions
and the hand-authored sections, protects their boundaries, formalizes the canonical
sources, and adds golden + contracts. No second FAQ/capabilities/claims/JSON-LD
source, no static-section JSON, no runtime render, no section fetch, no innerHTML
cards, no component framework.

## Canonical sources (map of ownership)

1. **index.html** — the hand-authored sections (hero, trust bar, how/steps,
   use-cases, verify, example, privacy summary, limits, add-on, help, final CTA),
   the visual order, the CTAs, and the metadata no generator manages. It is also
   the host of the generated regions (below) but never a second manual source for
   any of them.
2. **data/home-faq.json** — the canonical FAQ list (ordered q/a i18n key pairs).
3. **engine/gen_home_faq.js** — renders BOTH the visible `<details>` accordion
   (HOME_FAQ) AND the FAQPage JSON-LD (HOME_FAQ_JSONLD) from that one list, so the
   two can never drift.
4. **assets/product-capabilities.js** — the canonical capability inventory.
5. **engine/gen_home_capabilities.js** — selects/renders the Home capability
   summary (HOME_CAPABILITIES) from the inventory + i18n.
6. **data/claims.json + engine/gen_claims.js** — the canonical claims and their
   publication (gen_claims writes data/claims.json, a data file — NOT an index.html
   region).
7. **engine/gen_jsonld.js** — the SoftwareApplication JSON-LD (HOME_SOFTWARE_JSONLD)
   derived from the inventory.
8. **assets/i18n.js** — the five-language copy.
9. **data/media.json + assets/screenshots/** — image inventory/paths/properties
   (the hero + verify images live directly in index.html markup; their responsive
   contract is protected by the golden).
10. index.html is partially generated output but the manual source for regions with
    no generator.

No region has two manual sources.

## Region map

Four generated regions, each with a single owner, non-overlapping, START before
END, each marker exactly once, delimiters kept in source and dist:

| Region | Owner | Data | Location |
|---|---|---|---|
| HOME_SOFTWARE_JSONLD | gen_jsonld.js | product-capabilities.js + i18n | head |
| HOME_FAQ_JSONLD | gen_home_faq.js | home-faq.json + i18n | head |
| HOME_CAPABILITIES | gen_home_capabilities.js | product-capabilities.js + i18n | main |
| HOME_FAQ | gen_home_faq.js | home-faq.json + i18n | main |

`tests_gen_stability.js` proves the three index.html generators touch disjoint
regions (running them in any order is byte-identical). No inner placeholder ever
ships; the `_START`/`_END` delimiters are intentional and remain in the output.

## Real defects fixed (three generator guards)

The three index.html generators located their regions with `indexOf`, which uses
the FIRST occurrence. A duplicated START/END marker would silently drop the content
between the copies and leave a corrupt page that `--check` then accepts. Negatives
N43/N45 demonstrated this. Per the brief ("apply the minimal change and document
why it does not modify public output"), each generator now requires its markers to
appear EXACTLY once (`indexOf === lastIndexOf`) and throws otherwise. This does NOT
change the approved output (verified: index.html byte-identical to the C0 baseline;
all three `--check` green); it only makes a duplicated marker fatal. No public
HTML/CSS/JS, data, or copy was changed.

## Contracts added (the official checker)

`engine/tests_home_page.js` exports `checkHomePage(siteDir)` → `{ pass, fail,
failures }`, used by the positive suite, the negatives, and the sync checks, against
`engine/fixtures/pages-golden/home-page.json` (captured from the pre-C5 approved
output, NOT re-run through any generator): one `<main>`; `<head>`/`<main>` SHA-256 +
bytes; 13-section order (id|class signatures); heading order; id set (no
duplicates); anchors resolve; data-i18n set; ARIA count; scripts; asset versions;
canonical; OG/Twitter counts; both JSON-LD blocks; generated-region markers present
exactly once, in order, START-before-END, no unfilled placeholder; FAQ sync
(home-faq.json order/count, no duplicates, each question once in the accordion, one
Question per entry in the FAQ JSON-LD); every `<picture>`/`<source>`/`<img>`
(src/srcset/media/type/alt/width/height/loading/fetchpriority); hero responsive
contract; contact mailto (no personal Gmail, no unauthorized waitlist); progressive
enhancement; and isolation. As a positive isolation contract it also confirms
solver independence: editing solver.html in a temp tree leaves `checkHomePage`
green (this is a positive assertion about the checker, so it lives with the
positive suite, not among the negatives).

## Generator parity

`engine/tests_home_generator.js` drives the REAL generators in temp trees:
`--check` green; the three reproduce the approved index.html byte-for-byte;
deterministic; each touches only its own region; fails on missing/duplicated/
inverted markers; gen_home_faq fails on incomplete FAQ data; runs from a spaced
path; emits LF UTF-8; leaves no residual placeholder; does not modify solver.html;
and gen_claims writes only data/claims.json.

## Negative tests

`engine/tests_home_page_negative.js` — 55 cases, each mutates a temp tree, runs the
official `checkHomePage()` (or the real generator for marker/data cases), asserts
the specific failure, and cleans up in `finally`. Covers: remove/duplicate/reorder
a section; remove/relevel a heading; duplicate id; break anchor; change CTA/link;
remove data-i18n; foreign key; remove ARIA; change canonical/metadata/OG; change
the main and FAQ JSON-LD; remove/duplicate/reorder a FAQ; desync the accordion;
unpublished FAQ data; remove/duplicate/expose/reorder a Home capability; change a
claim; desync product-capabilities.js; remove an image; change src/srcset/alt/
width/height/loading/fetchpriority; remove a source; change the hero CTA; change
contact; introduce a personal Gmail; introduce a waitlist; remove a script; change
an asset version; missing/duplicated/inverted/overlapping markers; unknown data;
bad FAQ data; residual placeholder; fetch; innerHTML; engine; Worker; grid/charts/
exports; published source partial; and a spaced-path run. (The former
solver-independence case is now a positive isolation contract in
tests_home_page.js — see "Contracts added".)

## Home manual sections

index.html has 13 `<section>` elements in `<main>`: 11 are purely hand-authored
(hero-split, trust-bar, how, use-cases, verify, example, privacy, limits, add-on,
help, final CTA) and 2 host a generated region (`#capabilities` hosts
HOME_CAPABILITIES, `#faq` hosts HOME_FAQ). The 11 hand-authored sections are
protected by the `<main>` golden: exact order, headings, copy/i18n keys, CTAs and
destinations, ids/anchors, ARIA, and images. They are not turned into
runtime-generated content, not moved inside a generator's region, and not
duplicated. (Two further generated regions, HOME_SOFTWARE_JSONLD and
HOME_FAQ_JSONLD, live in `<head>` and are not sections.)

## Hero and images

The hero keeps its responsive `<picture>` contract: mobile/desktop `<source>`s,
WebP/PNG, srcset, media queries, alt, width/height, loading, and fetchpriority — all
pinned by the golden. No image or CSS is modified; the existing aspect-ratio and
zero-CLS contract is preserved by not touching the markup.

## FAQ

data/home-faq.json is the single source; gen_home_faq renders both the visible
accordion and the FAQPage JSON-LD from it. The checker verifies order, count, no
duplicates, each question once in the accordion, and one Question per entry in the
JSON-LD. Deep five-language and answer sync stays with tests_home_faq (90).

## Capabilities

The Home capability summary is selected/rendered by gen_home_capabilities from
product-capabilities.js. Home is NOT the canonical inventory. Hidden/pending
capabilities do not appear. Deep sync stays with tests_home_capabilities (80).

## JSON-LD and SEO

Both JSON-LD blocks (SoftwareApplication + FAQPage) are pinned by the golden and
generated (never at runtime). featureList↔inventory and page-appropriate subsets
stay with tests_jsonld (8) and tests_jsonld_features (26). Title/description/
canonical/OG/Twitter are pinned; no copy or claim is changed.

## Contact and add-on

Contact is `mailto:contact@plumline.online`; the checker forbids a personal Gmail
and an unauthorized waitlist and pins the add-on's published state. No commercial
strategy is changed in C5.

## How to edit a manual section
Edit index.html directly (outside the generated regions), regenerate nothing for
manual regions, run `node engine/tests_home_page.js`, and update home-page.json
from the newly approved output.

## How to modify the FAQ
Edit data/home-faq.json (and its i18n keys), run `node engine/gen_home_faq.js`, then
re-approve and update the fixture's faq_order.

## How to modify a capability
Edit assets/product-capabilities.js, run `node engine/gen_home_capabilities.js` and
`node engine/gen_jsonld.js`, re-approve, update the fixture.

## How to modify a claim
Claims/copy live in assets/i18n.js (and data/claims.json via gen_claims.js). Edit
there, regenerate, re-approve. Never edit index.html's generated regions by hand.

## How to change an image
Replace the file under assets/screenshots/ (and/or edit the `<picture>` markup for a
hand-authored image). Update the fixture's `pictures` block from the approved output.

## Which generators to run / how to use --check
`node engine/gen_home_capabilities.js`, `node engine/gen_home_faq.js`, `node
engine/gen_jsonld.js` write into index.html; `node engine/gen_claims.js` writes
data/claims.json. Each `--check` exits non-zero when out of date (the CI gate runs
`--check`). `npm run verify` runs the full battery.

## How to update the fixture
Re-extract the expected values in home-page.json from the newly approved index.html
— never from the same generator run the test validates in the same step.

## What must never be built at runtime
The main content, capabilities, FAQ, or JSON-LD must never be built with fetch,
innerHTML, or a client component framework. index.html works with JS off.

## How to revert C5 without reverting C1–C4 or A/B
C5 added: `engine/tests_home_page.js`, `engine/tests_home_page_negative.js`,
`engine/tests_home_generator.js`, `engine/fixtures/pages-golden/home-page.json`,
three suite names in `engine/suites.js`, one allowlist entry in
`engine/tests_composed_reads.js`, and the exactly-once marker guard in each of
`engine/gen_home_capabilities.js`, `engine/gen_home_faq.js`, `engine/gen_jsonld.js`.
To revert: delete those files/fixtures, remove the three suite names and the one
allowlist entry, and revert the three marker guards (they do not affect output, so
reverting them leaves index.html unchanged). No production page, asset, shell,
behavior, CSS, or C1–C4 artifact was changed.

## Metrics
- Public HTML/CSS/JS modified: **0** (index.html byte-identical to the C0 baseline;
  the six other informational pages and solver unchanged; assets/data/copy unchanged).
- Generators modified: 3 files (gen_home_capabilities.js, gen_home_faq.js,
  gen_jsonld.js) — a defensive exactly-once marker guard each; no output change.
- index.html: 298 lines / 24 614 chars / 24 622 bytes — before == after.
- Sections: 13 `<section>` in `<main>` — 11 hand-authored, 2 host a generated
  region (`#capabilities`, `#faq`). Generated regions: 4 total (2 in those sections
  + 2 in `<head>`: HOME_SOFTWARE_JSONLD, HOME_FAQ_JSONLD), owned by 3 generators.
  Generators: 3 write index.html regions (gen_home_capabilities, gen_home_faq,
  gen_jsonld); gen_claims.js is related but writes data/claims.json, NOT an
  index.html region. Canonical sources: 9.
- FAQ: 6 entries. Home capabilities: 16 (grouped in 4 cards). Claims: canonical
  data in data/claims.json (generated from the inventory); localized copy in
  assets/i18n.js. JSON-LD blocks: 2. Images: 2 `<picture>` (WebP+PNG, responsive).
  CTAs: multiple solver.html links + contact mailto.
- Real duplication found: 0. Duplication removed: 0.
- Files added: 4 (3 test suites + 1 fixture). Files modified: 3 generators +
  suites.js + tests_composed_reads.js + 4 docs. Files deleted: 0.
- Tests added: 249 (63 page + 156 negative + 29 generator + 1 composed_reads).
  Total 7969 → 8218.
- RAW_SOURCE_ALLOWLIST: the C5 change adds one entry (tests_home_page.js). Across
  all of Checkpoint C the object grows from 16 to 21 keys (+5, one page checker per
  phase); of these keys, the `tests_*.js` entries grow from 14 to 19 (+5) and 2 are
  auxiliary non-suite entries (compose-shell.test-note, composed-html.js). Negatives
  and generators are never allowlisted. See docs/testing.md for the full 21-key list.
- Requests before == after. Payload before == after.
- Complexity added: three static test suites + one fixture + three generator guards;
  no second source, no runtime change.
- Improvement: region-boundary contracts, FAQ/capabilities/image sync, isolation
  protection, and documentation. No public difference.
