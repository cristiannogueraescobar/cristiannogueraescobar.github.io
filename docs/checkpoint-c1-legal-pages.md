# Checkpoint C1 — legal / informational pages

Scope: about.html, privacy.html, terms.html. No other page touched. Result:
**State B** — the three pages are correctly organized; C1 changes NO production
HTML/CSS and adds contracts + golden + documentation only.

## Architectural decision: do NOT extract a legal skeleton

Privacy and terms share `<main class="prose">`, an `<h1 data-i18n>`, and a
`<p class="updated" data-i18n="updated">`. Measured before deciding:
- Byte-identical lines between the two files: 26 — but almost all are the B1 shell
  markers, standard HTML boilerplate (`<!DOCTYPE>`, head, meta, the asset
  `<script>`s) and the `field-deep/plumb` wrapper. The legal skeleton that is
  genuinely their own and non-shell is 3 lines / 95 bytes
  (`<main class="prose">`, the updated paragraph, `</main>`).
- Their inner structure DIFFERS: privacy's `<main>` has 47 tags, terms' has 29,
  with different heading/paragraph/list sequences. There is no shared body to
  compose.

Against the seven criteria: extracting would NOT remove significant duplication
(criterion 1 fails — 95 bytes), the legal content differs so there is no single
body source (2), and it would risk mixing the two namespaces (4). The cost — a
second body compositor separate from the B1 shell, 4+ new files, 15+ tests — far
exceeds the reduction (criterion 7 fails). **Decision: do not extract. Protect
in place.** This mirrors B3, which was also State B.

about does NOT share a template with privacy/terms: it is a short branded page (2
`<section>`s, full OG/Twitter metadata, its own `about` i18n namespace), whereas
privacy/terms are `prose` legal documents under the shared `legal` namespace with
disjoint key prefixes.

## Structure of each page

### about
`<main id="content">` → 2 `<section>`s of branded copy; `<h1>` + 5 `<h3>`; 14
`data-i18n` keys, all `about*`; i18n namespace `about`; full OG/Twitter set;
canonical `https://plumline.online/about.html`.

### privacy
`<main class="prose">` → `<h1 data-i18n="pvTitle">` → `<p class="updated"
data-i18n="updated">` → headings/paragraphs/lists; 34 `data-i18n` keys (33 `pv*`
+ the shared `updated`); i18n namespace `legal`; no OG/Twitter; canonical
`https://plumline.online/privacy.html`.

### terms
`<main class="prose">` → `<h1 data-i18n="tmTitle">` → the updated paragraph →
headings/paragraphs; 25 `data-i18n` keys (24 `tm*` + `updated`); i18n namespace
`legal`; no OG/Twitter; canonical `https://plumline.online/terms.html`.

## Namespaces and "legal content not mixed"
privacy and terms share the `legal` i18n namespace but use disjoint key prefixes:
privacy owns `pv*`, terms owns `tm*`, and both share only `updated`. The checker
proves no `pv*` key ever appears in terms and no `tm*` key in privacy — this is
the machine-checkable meaning of "legal content not mixed". about uses only
`about*` keys.

## Metadata (individual, per page)
Each page keeps its own title, description, canonical, and (for about) OG/Twitter
tags. These are page-specific content, not shared boilerplate; only 3 head lines
(charset, viewport, the stylesheet link) are identical across pages and are left
inline. C1 changes none of them.

## Contracts added (the official checker)
`engine/tests_legal_pages.js` exports `checkLegalPages(siteDir)` →
`{ pass, fail, failures }`, used by BOTH the positive suite and the negatives.
It verifies, against `engine/fixtures/pages-golden/legal-pages.json` (captured
from the pre-C1 source, NOT compositor-generated):
- `<head>` and `<main>` SHA-256 + UTF-8 byte length per page (via
  `Buffer.byteLength`) — any removed section, changed heading, reordered content,
  or changed text trips the main hash;
- exact canonical, i18n namespace, data-i18n key set, heading order (tag:key),
  link set, id set (and no duplicate ids), script src set, asset versions;
- every `href="#id"` resolves to an existing id on the page;
- isolation: no engine/Worker/grid/charts/exports markup, no `fetch`, no
  `innerHTML`, exactly one stylesheet request (no added requests);
- legal content not mixed (pv*/tm* separation) and about's own namespace.

## Negative tests
`engine/tests_legal_pages_negative.js` — 20 cases, each mutates a temp tree, runs
the SAME `checkLegalPages()`, asserts `fail > 0` with a message naming the
mutation, and removes the tree in `finally`: about loses a section / changes a
heading; privacy loses `updated` / changes canonical / removes a data-i18n; terms
changes a heading / removes a link / changes the namespace; privacy text copied
into terms; terms text copied into privacy; keys mixed across pages; heading
order changed; shared script removed; asset version changed; content fetched;
main built via innerHTML; a legal source partial published; duplicate id; broken
anchor; and a case that mutates about while also touching solver, proving the
legal checker validates the legal pages and never depends on solver.

## How to edit each page
Edit the page's `<main>` (content) and `<head>` (metadata) directly in the source
HTML. After an intentional, approved change, re-capture the affected page's
`head_sha256`/`main_sha256`/byte lengths and any changed inventory (headings,
keys, links, ids) into `legal-pages.json`, then run
`node engine/tests_legal_pages.js`. Keep privacy keys prefixed `pv*`, terms keys
`tm*`, and about keys `about*`; never move a `pv*` key into terms or a `tm*` key
into privacy. Do not move legal text into JSON or JavaScript.

## How to update fixtures
`legal-pages.json` holds the expected region hashes and inventory. Never
regenerate the expected values with the same code path the test validates —
re-extract them from the newly approved source.

## How to revert C1 without reverting A/B
C1 added only: `engine/tests_legal_pages.js`,
`engine/tests_legal_pages_negative.js`,
`engine/fixtures/pages-golden/legal-pages.json`, two suite names in
`engine/suites.js`, and one allowlist entry (`tests_legal_pages.js`) in
`engine/tests_composed_reads.js`. To revert: delete those files/fixtures and
remove the two suite names and the one allowlist entry. No production page, CSS,
asset, shell (B1), behavior (B2), or CSS golden (B3) was changed by C1, so there
is nothing else to undo.

## Metrics
- Production HTML/CSS modified: **0** (about/privacy/terms head+main byte-identical
  to the C0 baseline).
- Source lines/bytes before == after (no page edited).
- Structural duplication removed: 0 (the 95-byte legal skeleton was measured and
  deliberately not extracted; see the decision above).
- Files added: 3 (2 test suites + 1 fixture). Files modified: 2 (suites.js,
  tests_composed_reads.js). Files deleted: 0.
- Tests added: 123 (63 positive + 60 negative). Total 7397 → 7520.
- Requests before == after (one stylesheet per page; no engine/Worker/grid).
- Payload before == after.
- Complexity added: two static test suites + one fixture; no compositor, no
  dependency, no framework.
- Improvement: contracts, isolation, namespace-separation protection, and
  documentation. No public difference.
