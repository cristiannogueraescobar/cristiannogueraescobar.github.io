# Checkpoint C4 — Capabilities page

Scope: capabilities.html and its generation toolchain. Result: **State D**
(generated page). C4 formalizes the template → generator → output → dist flow with
region golden + generator-parity + sync contracts + docs. The public output
(capabilities.html) is byte-identical to the C0 baseline; one generator guard was
added (see "One generator fix").

## Architectural decision: keep the generated pipeline; protect it

capabilities.html is GENERATED and must never become a second manual source. It is
NOT reorganized. C4 adds contracts around the existing, deterministic generator
and the page it produces. No second template, no duplicated JSON, no parallel
manual fragments, no new generator, no runtime generation, no JS-built cards.

## Canonical sources (map of ownership)

1. **engine/templates/capabilities.template.html** — the page chrome: doctype,
   `<head>` shell (charset, viewport, canonical, plumline.css), the B1
   `PLUMLINE:HEADER`/`PLUMLINE:FOOTER` markers, the page-specific footer marker
   `learnCapabilities="true"`, the script tags (i18n, nav-menu, build-badge,
   cap-lightbox), and the two generated-region markers
   `<!-- CAPABILITIES_HEAD -->` and `<!-- CAPABILITIES_CONTENT -->` (each wrapped
   by `_START`/`_END` delimiter comments that remain in the approved output).
2. **assets/product-capabilities.js** — the capability inventory: 24 entries; the
   single source of truth for what is public/available/shown. 16 are shown
   (`public === true && status === 'available' && exampleStatus !== 'pending'`);
   8 hidden/pending are deliberately NOT rendered. Exports CAPABILITIES,
   GROUP_ORDER, STATUSES, ALL_LANGS, GROUP_DOCS, isPublic, featuredOnHome.
3. **data/media.json** — product imagery by slot: file, width, height, altKey,
   captionKey, loading, fetchpriority (3 slots: hero-model, verification-receipt,
   feasible-region; basePath assets/capabilities/).
4. **assets/i18n.js** — the copy. English is rendered inline (with data-i18n) so
   the page works with JS off; the other four languages are checked to exist.
5. **engine/gen_capabilities.js** — the deterministic generator (`--check` mode).
   Reads 1–4, fills the two markers, validates each image file exists and each
   altKey resolves in all five languages, and derives the JSON-LD featureList from
   the shown inventory.
6. **engine/gen_claims.js / data/claims.json** — the claims source (already
   generated + `--check`), unchanged by C4.
7. **capabilities.html** — the GENERATED output. Never a manual source.

No responsibility is duplicated. The visible card title (English display copy) and
the internal id/type/group are different responsibilities and are not forced
identical — a documented, legitimate distinction.

## Generation flow
`product-capabilities.js` + `media.json` + `i18n.js` (via `gen_capabilities.js`)
fill the two markers in `capabilities.template.html` → `capabilities.html` → the
Vite build copies it into `dist/` byte-identically. The `_START`/`_END` region
delimiters are intentional and remain in both source and dist; the inner
`<!-- CAPABILITIES_HEAD -->` / `<!-- CAPABILITIES_CONTENT -->` placeholders are
filled and never appear in the output.

## One generator fix (a real, test-demonstrated defect)

The generator used `template.replace(marker, …)`, which only substitutes the FIRST
occurrence. A duplicated marker would silently leave an unfilled placeholder in the
output. Negative N29 demonstrated this. Per the brief ("only modify production if a
test proves a real inconsistency"), the generator now requires each region marker
to appear EXACTLY once and throws otherwise. This does NOT change the approved
output (verified: capabilities.html byte-identical to the C0 baseline; `--check`
green); it only makes a duplicated/missing marker fatal. No public HTML/CSS/JS,
template, inventory, media, or lightbox was changed.

## Contracts added (the official checker)
`engine/tests_capabilities_page.js` exports `checkCapabilitiesPage(siteDir)` →
`{ pass, fail, failures }`, used by the positive suite, the negatives, and the sync
checks. Against `engine/fixtures/pages-golden/capabilities-page.json` (captured
from the pre-C4 approved output, NOT re-run through the generator here): one
`<main>`; `<head>`/`<main>`/template SHA-256 + bytes; region markers present
exactly once and inner placeholders filled; section order/count; heading order; id
set (no duplicates); anchors resolve; data-i18n set; scripts; asset versions;
canonical; OG/Twitter counts; JSON-LD; every image's src/alt/width/height/loading;
HTML↔inventory sync (every shown capability appears once as a cap-node, no
hidden/pending id leaks in); HTML↔media.json sync (each page image is a slot file
with matching width/height and the file exists); lightbox hooks + version; the
page-specific footer marker; progressive enhancement; and isolation.

## Generator parity
`engine/tests_capabilities_generator.js` drives the REAL generator (never a
reimplementation) in temp trees: it reproduces the approved page byte-for-byte;
`--check` is green when current and non-zero when stale; two runs are identical; it
touches only capabilities.html; it fails on a missing OR duplicated marker, on a
missing required capability id, on a missing media file, and on a missing alt key
in a language; it runs from a spaced path; it emits LF UTF-8; and it leaves no
inner placeholder behind while keeping the region delimiters.

## Negative tests
`engine/tests_capabilities_page_negative.js` — 40 cases, each mutates a temp tree,
runs the official `checkCapabilitiesPage()` (or, for template-marker/data-key/
traversal cases, the REAL generator), asserts the specific failure, and cleans up
in `finally`: remove/duplicate/reorder a section; remove a heading; duplicate an
id; break an anchor; remove a data-i18n; foreign-namespace key; change canonical;
change metadata; change JSON-LD; remove/duplicate a capability node; expose a
hidden capability; reorder capabilities; change a visible claim; desync
product-capabilities.js; remove a media slot; change an image src/alt/width/height/
loading; remove/version cap-lightbox.js; remove a lightbox hook/ARIA; change the
footer marker; template missing/duplicated marker; renamed required id; unknown
media file; media basePath traversal; residual placeholder; fetch; innerHTML;
engine; Worker; grid/charts/exports; published partial; and a spaced-path run.

## Lightbox
`assets/cap-lightbox.js?v=1` — accessible image dialog (role=dialog,
aria-modal=true, labelled Close, Escape, backdrop click, focus trap, scroll lock).
Progressive enhancement: the figure links (`a.cap-figure-link`) open the full-size
image with JS off. C4 protects the hooks, the ARIA hook, and the loaded version; it
does not rewrite the lightbox.

## Footer-specific
capabilities.html is the only page whose FOOTER marker carries
`learnCapabilities="true"` (an extra footer link, predating B1). C4 protects that
marker; it is a deliberate difference and is not normalized away.

## How to add a capability
Add it to `assets/product-capabilities.js` (with a real testFile/testMarker, a
nameKey/descriptionKey present in all five languages, and its group). If it should
be visible, set public/available/not-pending and place it in the right group
renderer's id list in `engine/gen_capabilities.js` if the group uses an explicit
list. Run `node engine/gen_capabilities.js` to regenerate, then
`node engine/tests_capabilities.js` and `node engine/tests_capabilities_page.js`,
and update `capabilities-page.json` from the newly approved output.

## How to change an image
Edit `data/media.json` (or replace the file under `assets/capabilities/`). Ensure
the altKey/captionKey exist in all five languages. Regenerate and update the
fixture's `images` block from the approved output.

## How to change a claim
Claims/copy live in `assets/i18n.js` (and `data/claims.json` for the claims
source). Edit there, regenerate, and re-approve. Never edit capabilities.html.

## Which generators to run / how to use --check
`node engine/gen_capabilities.js` writes the page; `--check` exits non-zero if the
page is out of date (the CI gate runs `--check`). `node engine/gen_claims.js
--check` for claims. `npm run verify` runs the full battery.

## How to update the fixture
Re-extract the expected values in `capabilities-page.json` from the newly approved
capabilities.html and template — never from the same generator run the test
validates in the same step.

## Files that must never be edited by hand
`capabilities.html` (generated). Edit the template, the inventory, media.json, or
the copy instead, then regenerate.

## How to revert C4 without reverting C1–C3 or A/B
C4 added: `engine/tests_capabilities_page.js`,
`engine/tests_capabilities_page_negative.js`,
`engine/tests_capabilities_generator.js`,
`engine/fixtures/pages-golden/capabilities-page.json`, three suite names in
`engine/suites.js`, one allowlist entry in `engine/tests_composed_reads.js`, and
the exactly-once marker guard in `engine/gen_capabilities.js`. To revert: delete
those files/fixtures, remove the three suite names and the one allowlist entry, and
revert the marker guard in the generator (the guard does not affect output, so
reverting it leaves capabilities.html unchanged). No production page, asset, shell,
behavior, CSS, or C1–C3 artifact was changed.

## Metrics
- Public HTML/CSS/JS modified: **0** (capabilities.html byte-identical to the C0
  baseline; template, media.json, product-capabilities.js, cap-lightbox.js, i18n
  all unchanged).
- Generator modified: 1 file (`engine/gen_capabilities.js`) — a defensive
  exactly-once marker guard that does not change the output.
- Template: 32 lines / 1 322 bytes.
- capabilities.html: 205 lines / 15 837 chars / 15 837 bytes — before == after.
- Generated regions: 2 (HEAD, CONTENT). Canonical sources: 6 (template, inventory,
  media.json, i18n, gen_capabilities.js, claims).
- Capabilities: 24 in inventory, 16 shown. Claims: canonical data in
  data/claims.json (generated from the inventory); localized copy in assets/i18n.js.
  Images: 3.
- Real duplication found: 0 (the page is generated from single sources).
  Duplication removed: 0.
- Files added: 4 (3 test suites + 1 fixture). Files modified: 3 (suites.js,
  tests_composed_reads.js, gen_capabilities.js). Files deleted: 0.
- Tests added: 222 (84 page + 114 negative + 23 generator + 1 composed_reads).
  Total 7747 → 7969.
- Requests before == after. Payload before == after.
- Complexity added: three static test suites + one fixture + one generator guard;
  no second source, no runtime change.
- Improvement: generation-parity contracts, HTML↔inventory/media sync, lightbox/
  footer/isolation protection, and documentation. No public difference.
