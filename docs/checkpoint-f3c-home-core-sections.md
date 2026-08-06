# Checkpoint F3c — Home closing sections (consolidation + contracts)

## Base tree

F3c starts from the **F3b-final** committed state (12551 tests, all green). This
environment has no access to the real git repository, so the base is the working
tree that reproduces F3b-final exactly (documented limitation; no SHA invented).
Baseline confirmed before any change:

- Battery: TOTAL PASSED 12551, VERIFY ALL GREEN, VALIDATE HTML/DIST OK, DIST HTTP
  OK, deterministic build.
- engine `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`
- mirror `faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`
- dist/solver.html 218396 bytes, sha
  `36bfb88d54c5a4d6cc811db2f05c513adfb90f4908ac947faf3c22dd027862d8`
- dist/index.html sha `4ec4fe2f49ed729add5b0d990629501d45338ff39f0b70f25fa2ffce6b9a1f17`
- nine examples, five languages (en/es/pt/de/fr), six requests.

## Nature of this checkpoint

F3c is a **consolidation checkpoint**. Auditing the F3b-final tree showed the
seven F3c areas were ALREADY implemented, honest, coherent and translated in the
five languages: #capabilities (four cards of real capabilities, projected from
product-capabilities.js), #privacy (a local spreadsheet to browser to result flow
with "nothing uploaded, no account, closing the tab clears it"), #limits (three
honest boundary cards, non-linear rejection), #addon (Google Sheets add-on badged
"Coming soon" / "currently in review" / "Free", no fake waitlist), #help, #faq
(six `<details>` items with a generated FAQPage JSON-LD), and the final CTA.

Per the approved decision, F3c does NOT redesign or rewrite correct content. Its
value is turning existing, correct behaviour into explicit, verifiable,
regression-protected contracts. No copy, HTML, CSS, i18n or behaviour that was
already correct was changed. `index.html`, `assets/i18n.js` and
`assets/plumline.css` are byte-identical to F3b, and so is the built
`dist/index.html` (`4ec4fe2f…`). All 17 before/after screenshots are byte-identical.

## Files

Added (3):
- `engine/tests_f3c_home_sections.js` — the F3c contract suite.
- `engine/tests_f3c_home_sections_negative.js` — the portable negative suite.
- `docs/checkpoint-f3c-home-core-sections.md` — this document.

Modified (2):
- `engine/suites.js` — registers both `tests_f3c_home_sections` and
  `tests_f3c_home_sections_negative` in the official battery.
- `engine/tests_composed_reads.js` — one minimal, documented allowlist entry for
  `tests_f3c_home_sections.js` (it reads index.html `<main>` raw, a region the
  shell composer never touches).

Deleted: none.

## F3c contract suite (tests_f3c_home_sections.js)

The 25 required contracts are covered:

1. Existence and order of all F3c sections (capabilities, privacy, limits, add-on,
   help, faq) and the final CTA after the FAQ.
2/3/4. Strict separation. `<main>` is split into individual `<section>` blocks by
   an enumerator; the CTA section is selected by its OWN content
   (`sectionContaining('data-i18n="ctaTitle"')`), so extraction can never span
   F3a/F3b. `f3cHtml` is exactly the six F3c sections plus that CTA section, and a
   contract asserts it contains none of the F3a/F3b-exclusive markers
   (hero-demo, proof-strip, id="how"/"use-cases"/"verify"/"example",
   HOME_FEATURED, verify-flow, how3-step, uc-hero, exName_, etc.). The F3a hero
   and F3b sections are asserted present and intact; every F3b section precedes
   every F3c section.
5/6. Five-language coverage by ORIGIN. `resolveMeta(lang, key)` mirrors
   production's lookupTranslation (order common, home, capabilities, examples,
   then English) and returns { value, namespace, requestedLanguage,
   sourceLanguage, usedEnglishFallback }. For every F3c key in en/es/pt/de/fr a
   local entry must exist (usedEnglishFallback === false) and the value must be a
   non-empty string. Detection is by source, not text comparison, so a legitimate
   translation identical to English passes because it exists locally, while a
   missing key that fell through to English fails. There is no anyTranslated
   heuristic and no word-count exception.
7/8/9/10/11/12/13. Product truth per language. For each of en/es/pt/de/fr the
   RESOLVED F3c prose is scanned with a per-language forbidden-claims dictionary
   covering eight categories: absolute mathematical proof, perfect/guaranteed
   answer, always correct, error-free, add-on available now, waitlist/spot
   reservation, server/cloud processing, personal Gmail. COUNTIF must not appear;
   capabilities are projected (HOME_CAPABILITIES markers) with only the four real
   model types; limits state honest boundaries; the add-on is not presented as
   available; contact email is on `@plumline.online`.
14/15. FAQ ↔ JSON-LD parity: exactly one FAQPage node is located across all
   JSON-LD blocks and all `@graph` members (zero or many fails). The visible FAQ
   questions AND answers are extracted; the JSON-LD `mainEntity` count, each
   `Question.name` and each `Question.acceptedAnswer.text` must match the visible
   pair exactly (order and set), every entity is a `Question` with an
   `acceptedAnswer` of `@type` `Answer`, there are no duplicate questions or
   answers on either side, the visible HTML answer is the escaped form of the same
   canonical text (production's escText treatment, so entities/whitespace never
   cause artificial diffs), the visible `<summary>` question text is likewise the
   escaped canonical question (with explicit transitivity: visible == canonical ==
   JSON-LD name, so a tampered summary cannot pass a dictionary-only comparison),
   and every JSON-LD block parses with strict JSON.parse.
16. Accessibility, run over f3cHtml which includes ALL seven areas (capabilities,
   privacy, limits, add-on, help, faq) AND the exact CTA section — so help and the
   CTA are not left out: no duplicate IDs, no empty links, each section has a
   heading, FAQ uses `<details>`/`<summary>`; every anchor has a non-empty href,
   internal `#id` link targets exist, aria-labelledby / aria-describedby resolve
   to existing ids, each FAQ `<details>` has exactly one `<summary>`, and f3cHtml
   declares no `<h1>`.
17. No remote resources/trackers/new requests. The fetch/endpoint check runs over
   all seven areas (capabilities, privacy, limits, add-on, help, faq, CTA). Scope
   note: this suite checks the Home source for trackers and remote `<script>`/
   `<link stylesheet>` plus the six-request contract; full remote-resource
   coverage (images, fonts, iframes, every asset, live HTTP 200 / broken-link
   crawling) is owned by the canonical suites tests_assets.js, validate_html.js and
   engine/test_dist_http.js.
7. Capabilities and limits by the canonical source. The projected capabilities
   region is parsed structurally: the models group card (its `<h3>` carries
   capGroupModels) yields EVERY real `<li>` inside its `<ul>` — with or without
   data-i18n — in document order, one array entry per `<li>` (so a manual `<li>`
   without a model key is visible and fails, not silently skipped). Each `<li>`
   must carry exactly one model nameKey and that key must be canonical. That
   ordered array of keys is compared DIRECTLY (element by element, no Set) against
   the canonical model nameKeys the owner (assets/product-capabilities.js) marks
   for the Home (isShown(c) && c.group === 'models' && typeof c.homeSummaryRank ===
   'number', in rank order: continuous/integer/binary/mixed): same count, same key
   at each position, same order, no duplicates, no manual entry, no extra card.
   For limits, over the RESOLVED text of each of en/es/pt/de/fr: the linear-model
   scope is stated, non-linear support is DENIED (rejected/unsupported) with a
   per-language rule, and non-linear support is never claimed.
18/19/20. engine, mirror, catalogue and the nine examples intact.
21/22. Windows portability of the suite itself (no cp/rm/mv/sed/grep/bash/sh/cmd/
   powershell; no child_process require; no external process spawned).
23/24/25. Determinism and non-weakening are covered by the full battery running
   twice with an identical total and the byte-identical build.

## F3c negative suite (tests_f3c_home_sections_negative.js)

Portable and reproducible: each mutation is applied to an isolated temp copy
(`fs.cpSync` into an `fs.mkdtemp` path containing a space; `fs.rmSync` cleanup in
`finally`), and the F3c suite is run against it via `process.execPath` with stdout
and stderr captured. A mutation passes ONLY when the file actually changed
(expectedChange), the suite exited non-zero, the output contains the SPECIFIC
expected contract (expectedFailure), and there is NO SyntaxError / MODULE_NOT_FOUND
/ other infrastructure error. A clean control tree must pass. The suite runs 17
mutations: COUNTIF; fake waitlist; personal Gmail; forbidden absolute claim
(English prose); an F3c section removed; add-on marked available; a forbidden claim
in the SPANISH value only ("Respuesta perfecta y siempre correcta, totalmente
garantizada." — no English auxiliary text, must trip the [es] contract); a
forbidden claim in the GERMAN value only (must trip [de]); a JSON-LD answer text
altered (breaks the answer-parity contract); a visible `<summary>` question text
changed while keeping its data-i18n and leaving the dictionary and JSON-LD intact
(must trip the visible-question canonical contract); an empty href in the CTA; a
broken internal #id target in the CTA; an invented fifth model capability card;
a duplicated canonical model card as a fifth entry (which a Set-based check would
hide — trips the count/duplicate/order contracts); a swapped order of two canonical
model cards (trips the exact-order contract); a manual `<li>` without data-i18n in
the models card (trips the per-<li> "exactly one model nameKey" contract); a
visible `<summary>` question text tampered while keeping its data-i18n and leaving
the dictionary and JSON-LD intact (trips the visible-question canonical contract);
and non-linear support falsely
claimed in PORTUGUESE only (trips the [pt] limits contract). Multilingual coverage
spans es/de/pt.

## Accounting

- 12551 — F3b-final baseline.
- +755 — tests_f3c_home_sections (registered in the battery).
- +80 — tests_f3c_home_sections_negative (registered in the battery).
- +1 — one composed_reads allowlist entry for tests_f3c_home_sections.js.
- = **13387**. Both final verify runs report 13387. No existing test was weakened.

## Validation

From a clean tree, using the repo's canonical npm scripts (portable, no Unix-only
commands):

    npm ci
    npm run verify
    npm run build
    npm run verify
    npm run build

Both verify runs report 13387, VERIFY ALL GREEN, VALIDATE HTML/DIST OK, DIST HTTP
OK. Deterministic build (solver 36bfb88d…, index 4ec4fe2f…). engine/mirror intact,
nine examples, five languages, six requests, zero remote/trackers. Both suites run
individually green; both run green from a path containing spaces; zero external
commands. To clean the build directory portably between runs, use the repo's
build tooling (`npm run build` regenerates `dist/` in place) rather than any
Unix-only command.

## Screenshots

AFTER captured from a clean build on a fresh port (8362), non-persistent context,
service workers blocked, cache disabled, cache-buster query; served CSS sha
`4c743aed3f36104b10015369e4cbe116b3e1c19fb8a38f784da8de31bfe862b4` (unchanged from
F3b). All 17 before/after pairs are byte-identical, confirming F3a/F3b/F3c content
did not change.

## Portability

Both F3c suites use only Node APIs; no Unix executable, no cmd/PowerShell.
Verified running from a path with spaces. Declared compatible with Windows Node
24.15.0; this environment is Linux, so the suites were not physically run on
Windows — the final real validation is to be done locally on Windows.

## Rollback

1. Delete `engine/tests_f3c_home_sections.js`,
   `engine/tests_f3c_home_sections_negative.js` and this document.
2. In `engine/suites.js`, remove both `tests_f3c_home_sections` and
   `tests_f3c_home_sections_negative` from the registration list.
3. In `engine/tests_composed_reads.js`, remove the allowlist entry for
   `tests_f3c_home_sections.js`.

That restores F3b-final at 12551. There are no content changes and no deletions to
undo.

## Overlay package

The ready-to-copy overlay contains five files under `overlay/` (the three added
files and the two modified files), plus `OVERLAY_MANIFEST.txt` and
`SHA256SUMS.txt` at the PACKAGE ROOT (not inside `overlay/`), so copying the
contents of `overlay/` to the repo root never copies package metadata.
`SHA256SUMS.txt` verifies the five overlay files plus `OVERLAY_MANIFEST.txt`
(6/6 OK) and does not include itself.

## Remaining

F3 is NOT declared complete by this document. No later checkpoint has begun.
