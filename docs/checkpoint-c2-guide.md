# Checkpoint C2 — Guide page

Scope: guide.html. No other page touched. Result: **State B** — Guide is already
correctly organized; C2 changes NO production HTML/CSS and adds contracts +
golden + documentation only.

## Architectural decision: do NOT reorganize Guide

Guide is a long page (12 sections, 18 headings, 63 i18n keys), but length is not
duplication. Measured:
- Of the 12 sections, 10 have unique skeletons; one wrapper pattern
  (`section` → `div.sec-head` → `h2` → `p.muted`) repeats 3×.
- The only repeated lines are trivial wrappers (`<div class="sec-head">`,
  `<section class="section" …>`, `<div class="plumb">`) — ~265 bytes total, in a
  12 921-byte `<main>`.

Against the seven criteria, extracting these wrappers would NOT reduce significant
duplication (criterion 1 — 265 bytes), each section's content is unique so there
is no shared canonical body (2), and a section compositor would risk the 6 ids,
2 anchors, and 63 i18n keys (4, 5) while requiring a per-section source or a
second compositor (6, 7). **Decision: do not reorganize. Protect in place.** This
matches C1 and B3, which were also State B.

## Structure of Guide's 12 sections
Twelve `<section>`s in `<main id="content">`. Five carry ids used as in-page
anchors: `variables`, `direction`, `status`, `explanation`, `limits`. Heading
hierarchy: one `h1`, then a sequence of `h2` with nested `h3` (18 headings total),
frozen in order by the golden. 6 ids total, 0 duplicates, 2 anchors, both
resolving.

## i18n namespace and protected terminology
- Namespace: `guide` (`Plumline.i18n.init('guide')`). 63 `data-i18n` keys with
  the guide-family prefixes (`guide*`, `g*`, `status*`, `explain*`, `limits*`).
- **Status terminology (protected):** the published solver-state vocabulary —
  `statusOptimalLabel/Desc`, `statusFeasibleLabel/Desc`, `statusIncompleteLabel/
  Desc`, `statusInfeasibleLabel/Desc`, `statusUnboundedLabel/Desc` (11 keys). The
  checker asserts these keys are present, so the documented state names cannot
  silently drift.

## Metadata
Own title, description, canonical `https://plumline.online/guide.html`, full
OG/Twitter set. All frozen by the head hash and the explicit canonical/OG/Twitter
checks.

## Contracts added (the official checker)
`engine/tests_guide_page.js` exports `checkGuidePage(siteDir)` →
`{ pass, fail, failures }`, used by BOTH the positive suite and the negatives.
It verifies, against `engine/fixtures/pages-golden/guide-page.json` (captured from
the pre-C2 source, NOT compositor-generated): exactly one `<main>`; `<head>` and
`<main>` SHA-256 + UTF-8 byte length; section count and order; heading order
(tag:key); id set (no duplicates); anchors resolve; link set; data-i18n key set
and count; i18n namespace with no foreign-namespace key; status terminology keys
present; OG/Twitter counts; script src set; asset versions; canonical; and
isolation (no engine/Worker/grid/charts/exports, no fetch, no innerHTML, one
stylesheet).

## Negative tests
`engine/tests_guide_page_negative.js` — 25 cases, each mutates a temp tree, runs
the SAME `checkGuidePage()`, asserts `fail > 0` with a message naming the
mutation, and removes the tree in `finally`: remove/duplicate/reorder a section;
remove/relevel/rename a heading; remove/duplicate an id; break an anchor; change a
link; remove a data-i18n; foreign-namespace key; change namespace; change
canonical; change metadata; remove a script; change an asset version; fetch;
innerHTML; engine reference; new Worker; grid markup; published partial; a
solver-touch case proving the checker never depends on solver; and a case that
runs the checker from a temp path containing a space.

## How to edit Guide / add a section / add an anchor
Edit `<main>` in guide.html directly. To add a section, add a `<section>` (with an
`id` if it needs an anchor) in the correct order, add its headings and `data-i18n`
keys under the `guide` namespace, then update `guide-page.json`
(section_order/count, heading_order, ids, anchors, data-i18n set, region hashes,
byte lengths) from the newly approved source and run
`node engine/tests_guide_page.js`. To add an anchor, add the target `id` and the
`href="#id"`; the checker requires every anchor to resolve. Keep all keys in the
`guide` namespace; never introduce a `pv*`/`tm*`/`about*`/`cap*`/`home*` key.

## How to update the fixture
`guide-page.json` holds the expected region hashes and inventory. Never regenerate
the expected values with the same code path the test validates — re-extract them
from the newly approved source.

## How to revert C2 without reverting C1 or A/B
C2 added only: `engine/tests_guide_page.js`,
`engine/tests_guide_page_negative.js`,
`engine/fixtures/pages-golden/guide-page.json`, two suite names in
`engine/suites.js`, and one allowlist entry (`tests_guide_page.js`) in
`engine/tests_composed_reads.js`. To revert: delete those files/fixtures and
remove the two suite names and the one allowlist entry. No production page, CSS,
asset, shell (B1), behavior (B2), CSS golden (B3), or C1 legal artifact was
changed by C2.

## Metrics
- Production HTML/CSS/JS modified: **0** (guide.html head+main byte-identical to
  the C0 baseline).
- Lines/characters/bytes before == after (page not edited): 161 lines / 15 202
  chars / 15 202 bytes.
- Real internal duplication found: ~265 bytes of trivial wrappers (10/12 sections
  have unique skeletons).
- Duplication removed: 0 (measured and deliberately not extracted; see decision).
- Files added: 3 (2 test suites + 1 fixture). Files modified: 2 (suites.js,
  tests_composed_reads.js). Files deleted: 0.
- Tests added: 104 (30 positive + 74 negative). Total 7520 → 7625.
- Requests before == after (one stylesheet; no engine/Worker/grid).
- Payload before == after.
- Complexity added: two static test suites + one fixture; no compositor, no
  dependency, no framework.
- Improvement: contracts, status-terminology protection, isolation, and
  documentation. No public difference.
