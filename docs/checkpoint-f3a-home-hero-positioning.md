# Checkpoint F3a — Home hero, positioning and product demonstration

F3a redesigns only the top of the Home page — hero, central positioning, primary
and secondary CTAs, a semantic HTML/CSS product demonstration, and a short proof
strip — so the product is understandable in under ten seconds and the change is
clearly visible against F2. The rest of Home is structurally unchanged; F3b is
not started.

## Base

- **Base tree**: the effective F2-final working tree (post-merge of F2).
- **Base battery**: `TOTAL PASSED: 12068`, engine
  `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`, mirror
  `faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`, 9 examples,
  5 languages, 6 requests, canonical catalogue green, `generate:examples` green,
  F2 visual system applied. F2 dist solver 218396 bytes, sha
  `36bfb88d54c5a4d6cc811db2f05c513adfb90f4908ac947faf3c22dd027862d8`.
- **Invariants held across F3a**: engine, mirror, the 9 examples, the catalogue,
  the Solver, the Worker, example URLs, and all pages other than Home — unchanged.
  The composed solver stays 215613 / dist solver 218396 (the stylesheet is
  external, not inlined into the solver).

## Positioning

Central message: **"Turn spreadsheet decisions into answers you can check."** It
communicates spreadsheet decisions, optimisation, a result, verification,
privacy and ease of use. Forbidden claims (best / most powerful / unlimited /
enterprise-grade / guaranteed / mathematical proof / invented testimonials or
figures) are not used.

## Hero — before / after

- **Before (F2)**: eyebrow "Optimisation you can verify"; H1 "Find the best
  answer. Then see it checked."; a longer lead; CTAs "Try a real business
  example" and "Paste your spreadsheet model"; three check chips; a heavy hero
  **screenshot** (`hero-production-desktop.png/webp` + mobile variants).
- **After (F3a)**: eyebrow "Spreadsheet optimisation you can check"; a single H1
  "Turn spreadsheet decisions into answers you can check."; a short lead; two
  CTAs — **primary "Open the solver" → solver.html**, **secondary "Explore
  examples" → examples.html**; a privacy/trust microcopy line; and a semantic
  HTML/CSS **product demonstration** replacing the screenshot.

## Product demonstration structure

A semantic `<figure class="hero-demo">` with a `<figcaption>` accessible name,
holding an ordered list of exactly **four phases**:

1. **Spreadsheet model** — a small CSS grid of products / profit / hours.
2. **Decisions and limits detected** — a brass badge "Continuous · maximise".
3. **Optimised result** — the objective value **1,760**.
4. **Verification** — a verification-green badge "Optimal solution proven" and
   two check lines (objective checked, constraints recalculated).

No runtime solver, no second model, no fetch, no canvas, no iframe, no video, no
heavy image, no remote asset. It renders with JavaScript off.

## Authority of the pinned data (1760 / optimal / continuous / max)

The demo shows only values that are **pinned historical authority**, never
invented: `engine/fixtures/product/example-catalogue-f1.json` pins
production-plan `expected.objective = 1760`, `expected.status = "optimal"`,
`expected.modelType = "continuous"`, and `sense = "max"`. `validate_html.js` and
`tests_f3a_hero.js` both assert the demo's values equal this fixture authority,
so the demo cannot drift from the canonical example or introduce unpinned values.

## Proof strip

Five verifiable claims, all matching the product: Runs in your browser · No
account required · Your model stays on your device · Free to use · Five
languages. No invented logos, users, companies, ratings or statistics.

## Languages

All new copy exists in en / es / pt / de / fr with zero visible English
fallback. 3 hero keys were rewritten (heroEyebrow, heroTitle, heroLead2) and 18
new keys added (heroCtaPrimary, heroCtaSecondary, heroTrust, demoTitle,
demoStep1–4, demoModel, demoObjLabel, demoStatus, demoCheckObj, demoCheckCons,
proofBrowser, proofNoAccount, proofDevice, proofFree, proofLangs). 12 orphaned
hero keys were removed across all five languages (60 lines): chipBrowser,
chipNoAccount, chipPaste, heroCtaExample, heroCtaPaste, trustLocal,
trustNoAccount, trustLangs, trustFormats, trustChecked, heroShotAlt,
demoStep4Note. German and Spanish mobile were checked for wrapping and button
fit; no clipping or horizontal overflow.

## SEO

Updated to match the new positioning, canonical preserved:
- `<title>`: "Plumline | Spreadsheet Optimisation You Can Check"
- meta description (147 chars): "Turn spreadsheet decisions into answers you can
  check. Plumline finds the best allocation for your model and verifies it
  against your own formulas."
- OG title / OG description / Twitter title / Twitter description aligned to the
  new message.
- canonical stays `https://plumline.online/`.
- SoftwareApplication + FAQ JSON-LD stay coherent (generated, unchanged by copy).

## Accessibility

Single H1; eyebrow; demo is a `<figure>` with a `<figcaption>` accessible name;
decorative parts (`hero-demo__n`, the sheet, ticks) are `aria-hidden`; check
ticks are not colour-only (a "✓" glyph plus text); focus states via F2 tokens;
skip link and mobile nav unchanged. Computed WCAG AA contrast: brass-on-cream
number badge, ink-2 notes on cream (≥ 4.5), verification green on cream (≥ 4.5),
white on verification green (≥ 4.5).

## Responsive

Verified with real Chromium at 1440×1000, 1200×900, 768×1024, 390×844, 360×800,
320×568. The hero is two columns on wide viewports and stacks on mobile; the demo
flow is a CSS grid that stacks; CTAs stack; the proof strip wraps. Zero
horizontal overflow; German/Spanish hero and buttons fit.

## Performance

| Asset | Before (F2) | After (F3a) | Δ |
|---|---|---|---|
| `index.html` | 24826 B | 26812 B | +1986 B (hero markup + demo) |
| `assets/plumline.css` | 51318 B | 53387 B | +2069 B (F3a layer) |
| `assets/i18n.js` | 274285 B | 277019 B | +2734 B (new copy − orphans) |
| composed solver | 215613 B | 215613 B | 0 (CSS external) |
| dist/solver.html | 218396 B | 218396 B | 0 |

The hero no longer loads the hero screenshots (removed from the render), so the
Home first paint drops those image requests. Zero remote fonts, zero CDN, zero
trackers, six canonical requests unchanged.

## Tests

New suite **`engine/tests_f3a_hero.js`** (registered in `engine/suites.js`, on
the composed-reads allowlist), 184 assertions: exactly one H1, eyebrow, primary
CTA → solver, secondary CTA → examples, four-phase demo, pinned authority
1760/optimal/continuous/max from the F1 fixture, five-claim proof strip,
five-language copy, zero fallback, no fake social proof, no external assets, six
requests, WCAG AA contrast, responsive structure, no duplicate IDs, no empty
links, engine/catalogue/Solver intact.

`engine/validate_html.js` was strengthened, not weakened: the old two-image
contract (heroShotAlt + verifyShotAlt) became a stronger demo contract that
keeps verifyShotAlt and adds: exactly one `figure.hero-demo`; demo inside the
hero; a valid accessible name; exactly the four expected phases in order; the
pinned 1760/optimal/continuous/max matched against the F1 fixture; no
img/canvas/iframe/video/script/fetch/remote asset in the demo; the old hero
image must not return; and the demo i18n keys present in all five languages. It
fails against real mutations (demo removed, a phase removed, the pinned value
altered, the figcaption removed, an old hero image reintroduced) — all verified.

### Accounting

- `12068` — F2-final base.
- `12049` (−19) — structural rebaseline of the hero redesign: home_render and
  home_i18n verify one image (verify) instead of two (hero+verify), and the 12
  orphaned hero i18n keys were removed, reducing i18n-coverage assertions. No
  assertion was weakened; these are fewer because the hero image contract was
  replaced by the stronger demo contract in validate_html.js (which runs in
  `verify`, not in the `run_all` count).
- `12234` (+185) — `tests_f3a_hero` (184) plus one composed-reads allowlist entry
  (+1).

Both verify runs report `12234`, identical before and after a build. No skips are
counted as passes.

### Fixtures modified (all intentional Home-redesign rebaselines)

- `engine/fixtures/css-golden/shell-css-golden.json` — CSS grew to 53387 bytes
  (F3a layer): whole-sheet sha/bytes, shell fragments, counts regenerated with
  the checker's own functions.
- `engine/fixtures/pages-golden/home-page.json` — head sha/bytes (SEO), main
  sha/bytes, section signatures, ARIA count, pictures (hero picture removed),
  data-i18n keys regenerated.
- `engine/tests_home_seo.js` — approved title, approved meta description, approved
  heroLead2 in five languages, and the image-reference thresholds updated for the
  HTML demo (still asserts the verify screenshot and its exact dims).
- `engine/tests_home_render.js`, `engine/tests_home_i18n.js` — verify-image alt
  translation kept; hero-image assertions removed (image replaced by the demo).
- `engine/tests_home_page_negative.js` — N30/N33/N34 retargeted to real
  contracts of the new markup (verify image srcset/loading; N34 now protects the
  pinned demo objective 1,760).
- `engine/tests_home_capabilities_refs.js`, `engine/tests_canonical_catalogue_negative.js`
  — the "home restores a canonical title key" mutation re-anchored on
  `heroCtaPrimary` (heroCtaExample was removed); still trips the duplicate-title
  guard.
- `engine/tests_canonical_catalogue_positive.js` — i18n.js physical size 274285
  → 277019 (legitimate physical contract; semantic catalogue values untouched).
- `engine/tests_composed_reads.js` — `tests_f3a_hero.js` added to the raw-source
  allowlist with its reason.

## Screenshots

Real Chromium captures. before/ = the F2 Home (33 states); after/ = the F3a Home
(27 states) at the six viewports, including initial, hero close-up, CTA group,
product demonstration, proof strip, mobile menu, skip-link focus, language-selector
focus, Spanish mobile, German mobile; comparison/ = 21 BEFORE|AFTER pairs.
Delivered in `plumline-checkpoint-f3a-visual-review.zip` (never inside the repo
overlay).

## Output hashes (F3a)

- `index.html`: 26812 bytes
- `assets/plumline.css`: 53387 bytes
- `assets/i18n.js`: 277019 bytes
- `dist/index.html`: 29541 bytes
- `dist/solver.html`: 218396 bytes, sha
  `36bfb88d54c5a4d6cc811db2f05c513adfb90f4908ac947faf3c22dd027862d8` (unchanged)

## Rollback

Revert the F3a overlay (restore the listed files to their F2-final state). F3a is
additive in CSS and self-contained in the hero markup + i18n keys; every fixture
rebaseline is recorded above with its old value, so a revert restores the 12068
baseline exactly.

## Remaining work (F3b onward)

F3a stops at the top of Home. F3b (how it works, use cases, verification,
featured examples, audiences, capabilities/limits, privacy, add-on, FAQ, final
CTA) and later checkpoints remain. Examples is NOT redesigned. **F3b has not been
started.**

## F3a-final — accessibility and contrast correction

An independent review found two secondary hero texts sitting on the dark field
(`.field-deep`, `--deep` #12211A) with light-ground tokens, so they were nearly
invisible:

- `.hero-trust` used `--text-2` (#3B3F33) → 1.55:1 on `--deep`.
- `.hero-demo__cap` used `--text-muted` (#5A5E50) → 2.50:1 on `--deep`.

Fix: two contextual tokens for secondary text on the dark field, attenuated
cream composited over `--deep` (following the existing `.field-deep` pattern):

- `--on-deep-2: rgba(245,242,235,.78)` → ~9.5:1 (AAA)
- `--on-deep-muted: rgba(245,242,235,.72)` → ~8.2:1 (AAA)

`.hero-demo__cap` now uses `--on-deep-2` (9.50:1) and `.hero-trust` uses
`--on-deep-muted` (8.24:1). Both clear AA (and 7:1) while staying below the H1
(solid cream ~14.9:1), preserving hierarchy. Other hero text was re-checked and
already passes: heroLead2 (cream @ .82, 10.34:1), eyebrow (brass-hi #D8A94A,
7.70:1), and the demo's internal text/badges sit on light panels (9.66–16.20:1);
none were changed.

Accessible i18n: the proof strip's static `aria-label="Why Plumline"` gained a
translatable hook `data-i18n-aria="proofLabel"` (the i18n runtime already
translates `data-i18n-aria` into `aria-label`). `proofLabel` was added in all
five languages (Why Plumline / Por qué Plumline / Porquê Plumline / Warum
Plumline / Pourquoi Plumline), so the label no longer stays English after a
language switch.

Tests: `tests_f3a_hero.js` grew from 184 to 197 assertions. New checks compute
the REAL composited colour (resolving `var(--token)` recursively and compositing
`rgba(...)` over `--deep`, not a bare hex): `.hero-trust` and `.hero-demo__cap`
each ≥ 4.5 on `--deep`; neither uses the light-ground token; the rgba resolution
path is exercised; `proofLabel` exists in five languages; the proof strip carries
`data-i18n-aria="proofLabel"`; and the i18n runtime applies `data-i18n-aria →
aria-label`. Verified to trip on real mutations: restoring `var(--text-2)` on
`.hero-trust`, restoring `var(--text-muted)` on `.hero-demo__cap`, and restoring
the untranslatable `aria-label="Why Plumline"`.

Accounting: 12234 → 12253 (+19): +13 in `tests_f3a_hero` (contrast + proofLabel +
runtime-hook assertions) and +6 across coverage/golden suites for the new
`proofLabel` key (×5 languages) and the two new CSS tokens. No existing test was
weakened. CSS grew to 53913 bytes (two tokens); i18n.js to 277218 bytes
(proofLabel ×5). The composed solver and dist solver are unchanged
(`36bfb88d…`); the CSS is external. Both verify runs report 12253.
