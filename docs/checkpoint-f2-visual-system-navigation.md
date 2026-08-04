# Checkpoint F2 — visual system and shared navigation

F2 evolves Plumline's shared visual language and navigation toward a
**balanced professional + approachable** identity, without touching the engine,
the example catalogue, page content, or marketing copy. It is a
**deliberate visual rebaseline**: unlike a pure refactor, F2 changes the public
rendered output on purpose. Every public change is recorded here.

## Baseline

- **Base tree**: the effective post-F1 working tree (clean base commit
  `9566e15` + the complete F1 overlay). This is what F2 was built on top of, and
  what the F2 overlay must be applied to.
- **Base battery**: `TOTAL PASSED: 11891`, engine `5d68ed17…`, mirror
  `faabb2c2…`, 9 examples, 5 languages, 6 canonical requests, `generate:examples`
  green.
- **Invariants held across F2** (verified after every change): engine source
  SHA `5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf`,
  generated mirror SHA
  `faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`, the 9
  canonical examples, the 5 languages (en/es/pt/de/fr), the 6 public network
  requests, `generate:examples --check` green, zero remote fonts, zero trackers,
  zero content/marketing changes.

## Visual direction

Cream paper background, deep-green inverted chrome, brass accent, verification
green for solved/verified states. The F2 layer formalizes this into tokens so
future pages inherit it consistently instead of re-deriving ad-hoc values.

F2 does **not** redesign the Home hero/sections, the Examples page, solver
onboarding, marketing copy, the overall page structure, or the visible example
library. Those remain owned by their own checkpoints (C5 Home, F1 catalogue,
future F7 onboarding).

## Design tokens (additive)

The F2 token layer was **added** to `:root` in `assets/plumline.css`; no existing
token was removed, so identity values stay backward-compatible. New scales:

- **Semantic colors**: `--bg`, `--surface`, `--surface-2`, `--text`, `--text-2`,
  `--text-muted`, `--accent`, `--accent-text`, `--verify`, `--border`,
  `--border-subtle`, plus status colors (`--success`, `--warning`, `--error`,
  `--info`) and their tint backgrounds. These alias the identity tokens
  (`--paper`, `--panel`, `--ink`, `--brass`, `--true`, …), which stay the single
  source of truth for hex values.
- **Spacing**: `--space-1 … --space-16` on a 4px base.
- **Typography**: `--fs-display / --fs-h1 / --fs-h2 / --fs-h3 / --fs-body /
  --fs-small / --fs-label` (fluid `clamp()`), line-heights `--lh-*`, weights
  `--fw-*`, letter-spacing `--ls-*`. System font stack only — **zero** remote
  fonts.
- **Layout**: `--w-content / --w-reading / --w-wide`, `--gutter / --gutter-sm`,
  `--section-y`.
- **Shape**: `--radius-lg` (14px), `--radius-pill` (999px).
- **Elevation**: `--shadow-subtle / --shadow-card / --shadow-float`.
- **Interaction**: `--focus-ring`, `--transition`, `--disabled-opacity`,
  `--tap-min` (44px).

## Components (shared)

Appended as a component layer at the end of `assets/plumline.css`:

- **Skip link** (`.skip-link`): visually hidden until `:focus`, then slides into
  view from the top. Present on all 8 pages.
- **Buttons** (`.btn2` + `--primary/secondary/tertiary/danger/icon`): hover,
  `:focus-visible`, active and disabled states, min target 44px.
- **Links** (`.link`): inline link affordance.
- **Nav** (`.nav a`): hover + `aria-current` underline (never color-only); the
  solver top bar uses the brass-highlight variant.
- **Cards** (`.card2`): distinct interactive vs static affordances.
- **Badges** (`.badge` + `--verify/accent/neutral/info`).
- **Panels** (`.panel`): status panels.
- **Global focus contract**: outlines are never removed; a visible focus ring is
  guaranteed.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` neutralizes F2
  transitions/transforms.

## Header

The header is composed from `src/shared/fragments/header.html` in two variants
(informational `.mast`, solver `.top`) via `src/shared/compose-shell.js`. F2
refines it through the shared token + component layer: consistent height, nav
hierarchy via `.nav`, integrated language selector, a visible-but-not-dominant
CTA, and a clean responsive collapse into the mobile drawer. No new nav links
were added and the add-on strategy is unchanged.

## Mobile navigation

`assets/nav-menu.js` already carries the full accessibility contract and is
**unchanged** by F2 (11222 bytes, before and after). It provides:

- a toggle that flips `aria-expanded`;
- a real modal panel (`role="dialog"`, `aria-modal="true"`);
- close on `Escape`;
- explicit focus management (focus into the panel, return to the toggle);
- close on outside interaction (backdrop);
- cleanup across breakpoints (`matchMedia`);
- drawer links **cloned** from the page's own primary nav, so the drawer link
  set cannot drift from the primary set;
- touch targets ≥ 44px.

F2 adds tests that pin this contract (see below) rather than changing the code.

## Active state (aria-current)

Exactly one `aria-current="page"` element per page **where the page maps to a
nav destination**:

- `index` → the **logo/lockup** carries it (Home is not a primary-nav item, so
  the logo is its current-page anchor);
- `solver`, `guide`, `examples`, `about` → their primary-nav link;
- `capabilities`, `privacy`, `terms` → **zero** (correctly not in the primary
  nav).

Mechanism: `compose-shell.js` substitutes `{{AC:<key>}}` → `aria-current="page"`
for the active key only, validated against `NAV_KEYS`. A `home` key was added to
`NAV_KEYS` / `ACTIVE_TO_KEY`, the lockup carries `{{AC:home}}` in both header
variants, and `index.html`'s `PAGE_CONTEXT`/marker set `active="home"`.

## Footer

Composed from `src/shared/fragments/footer.html`. F2 refines hierarchy,
spacing and legibility through the token + component layer. Legal links and the
`contact@plumline.online` contact are preserved; no new commercial copy was
added.

## Root link normalization

All shared Home / add-on links are root-relative: `index.html` → `/`,
`index.html#addon` → `/#addon`. This covers the header logo, the footer, and the
solver body's add-on CTA. After F2 there are **zero** `href="index.html…"`
occurrences in page sources or in the composed shell. Canonical/sitemap already
used `/`.

## Solver shell (visual only)

The solver's shared shell (top nav, page background, spacing, global buttons,
typography, footer, responsive shell) inherits the F2 token + component layer.
The skip link and `<main id="content">` were added to the solver too. **Not
touched**: the grid, detector, formula handling, Variable Settings internals,
result layout, charts, the engine, the Worker, examples, or runtime URLs
(onboarding is F7).

## Accessibility

- Skip link on every page, targeting a real unique `<main id="content">`.
- `skipToContent` i18n key added in all 5 languages (EN "Skip to content", ES
  "Saltar al contenido", PT "Saltar para o conteúdo", DE "Zum Inhalt springen",
  FR "Aller au contenu").
- Focus never removed; visible focus ring via `--focus-ring`.
- `aria-current` unique per page (above).
- Mobile drawer contract (above).
- Reduced-motion honored.
- Touch targets ≥ 44px (`--tap-min`).
- **WCAG AA contrast** (computed in `tests_f2_visual_nav.js`, not eyeballed):

  | Pairing | Ratio | AA normal (≥4.5) |
  |---|---|---|
  | ink on paper | 16.20 | pass |
  | ink on panel | 18.12 | pass |
  | secondary ink-2 on paper | 9.66 | pass |
  | brass-text on paper | 4.88 | pass |
  | verification green on paper | 4.73 | pass |
  | paper on deep green | 14.93 | pass |

## Responsive

The token-driven gutters, fluid type, and the existing mobile drawer keep the
shell usable across the target widths (320, 360, 390, 768, 1200, 1440, 1920).
Because this environment cannot run a real browser, pixel-level responsive
verification is a **local human step** — see the capture guide below. The CSS is
analyzed statically (no contradictory media queries; single breakpoint at 820px
for the drawer).

## Performance and privacy

| Asset | Before (F1) | After (F2) | Δ |
|---|---|---|---|
| `assets/plumline.css` | 35459 B | 45522 B | +10063 B (token + component layer) |
| `assets/i18n.js` | 274099 B | 274285 B | +186 B (`skipToContent` ×5) |
| `assets/nav-menu.js` | 11222 B | 11222 B | 0 (unchanged) |
| `index.html` | 24622 B | 24709 B | +87 B (skip link + `active="home"`) |
| composed solver | 215539 B | 215613 B | +74 B (skip link + `main#content`; add-on link normalized) |
| `dist/solver.html` | 218349 B | 218396 B | +47 B |

Zero remote fonts, zero CDN, zero trackers (grepped in tests). The 6 canonical
public network requests are unchanged (pinned by the E6 fixture).

## New public output hashes (F2)

- composed solver: **215613** bytes
- `dist/solver.html`: **218396** bytes, SHA `36bfb88d…`
- `assets/plumline.css`: **45522** bytes (822 lines)
- `assets/i18n.js`: **274285** bytes

## Tests

New suite **`engine/tests_f2_visual_nav.js`** (registered in `engine/suites.js`,
runs in CI), **107 assertions**, deterministic and independent of whether
`dist/` is present (the shell is composed in memory via `compose-shell.js`). It
pins: the F2 token layer, the skip link + `main#content` on every page,
`aria-current` uniqueness, root link normalization, the mobile-nav a11y
contract, shared component classes, computed WCAG AA contrast, reduced-motion,
absence of remote fonts/trackers, and the six canonical requests.

### Battery increment

- `11891` — base (effective F1 tree).
- `11955` (+64) — after F2 fixture rebaselines. The increment comes from
  rebaselined suites **gaining assertions** (e.g. the shell golden gained the
  `home` active case; solver goldens and the structure suite gained checks), not
  from new suites.
- `12062` (+107) — after registering `tests_f2_visual_nav.js`.

Total is stable at **12062** whether the battery runs before or after a build.

### Fixtures rebaselined (with classification)

Every change below is a **deliberate visual rebaseline** or an **accessibility
improvement** — no guard was deleted, no snapshot trivialized, no assertion
weakened.

- `engine/fixtures/shell-golden/*.html` — regenerated; **added**
  `header-informational-home.html` + its `eq()` case. *(new contract: the Home
  active state.)*
- `engine/fixtures/pages-golden/legal-pages.json` — head/main SHA+bytes,
  i18n keys, links, ids regenerated; a `SHARED_SHELL_KEYS=['skipToContent']`
  exception was added to the "about uses its own namespace" check. *(accessibility
  improvement: the skip link is a shared shell key, legitimately outside the
  page namespace.)*
- `engine/fixtures/pages-golden/guide-page.json`,
  `examples-page.json` — i18n keys / links / ids / anchors regenerated.
  *(accessibility improvement: skip link.)*
- `engine/fixtures/pages-golden/home-page.json` — i18n keys regenerated using
  the checker's exact **deduplicating** extraction
  (`Array.from(new Set(...)).sort()` → 117 keys). *(accessibility improvement.)*
- `engine/fixtures/pages-golden/capabilities-page.json` — main SHA+bytes,
  template SHA+bytes, ids, i18n keys (deduplicated) regenerated; the skip link
  went into `engine/templates/capabilities.template.html` and `id="content"`
  into `engine/gen_capabilities.js`, then `capabilities.html` was regenerated by
  its generator. The `tests_capabilities.js` "shared .plumb width container"
  regex was relaxed to allow the new `id`. *(accessibility improvement.)*
- `engine/fixtures/solver-ui-golden/{solver-grid-d1,solver-detection-d2,
  solver-execution-d3,solver-visualization-d4,solver-interface-d5-final,
  solver-interface-baseline}.json` — composed_total / head / body / aria /
  data-i18n-count regenerated; **engine region SHA preserved and verified** in
  every one. *(intentional visual rebaseline: skip link + `main#content` +
  normalized add-on link in the solver shell.)*
- `engine/fixtures/single-engine/engine-e1-source.json` — composed solver
  bytes/SHA → 215613; canonical engine source preserved. *(intentional visual
  rebaseline.)*
- `engine/fixtures/single-engine/engine-e6-worker-mirror-final.json` — composed
  215613, dist 218396; requests=6, engine, mirror preserved. *(intentional
  visual rebaseline.)*
- `engine/tests_no_selfgen_golden.js` — `PINNED_SHA` updated to the new d5
  golden SHA; baseline byte reference updated. *(intentional visual rebaseline;
  the anti-self-regeneration guard is kept, only its pinned value moves.)*
- `engine/tests_structure.js`, `tests_nav_menu.js`, `tests_shell_b1.js` — accept
  `/` and `/#addon` as canonical Home/add-on. *(intentional visual rebaseline:
  root normalization.)*
- `engine/fixtures/css-golden/shell-css-golden.json` — regenerated with the
  checker's own hashing. *(intentional visual rebaseline: token + component
  layer.)*
- `engine/tests_canonical_catalogue_positive.js` — `i18n.js` size assertion
  274099 → 274285. *(accessibility improvement: `skipToContent` key.)*
- `engine/tests_canonical_engine_source_positive.js`,
  `engine/tests_e6_worker_mirror{,_positive}.js` — composed/dist byte assertions
  updated to 215613 / 218396. *(intentional visual rebaseline.)*

The historical F1 fixture `engine/fixtures/product/example-catalogue-f1.json` is
**not** altered: it pins the F1 contract and its checker compares against the
catalogue, not against absolute F2 sizes.

## Rollback

Revert the F2 overlay (restore the listed files to their effective-F1 state).
Because F2 is additive at the token/component level and every public rebaseline
is recorded above with its old value, a revert restores the 11891 baseline
exactly. See `docs/rollback.md`.

## Local screenshot / visual review guide

This environment cannot produce browser screenshots, so the pixel-level visual
review is a **local human step**. It is a pending *local-validation* item, not a
code failure. To capture the review set locally:

1. Build and serve:
   ```
   npm ci
   npm run build
   npx http-server dist -p 8080   # or any static server
   ```
2. Capture each page at each width. Use the browser devtools device toolbar to
   set an exact viewport, then capture a **full-page** screenshot.

**Widths (px):** 320×568, 360×800, 390×844, 768×1024, 1200×900, 1440×1000,
1920×1080.

**Pages / states to capture** (open URL, reach state, capture):

| # | Page | State | How to reach | PNG filename |
|---|---|---|---|---|
| 1 | `/` | default | open Home | `home-{width}.png` |
| 2 | `/` | skip link focused | load, press `Tab` once | `home-skiplink-{width}.png` |
| 3 | `/solver.html` | default shell | open Solver | `solver-{width}.png` |
| 4 | `/guide.html` | default | open Guide | `guide-{width}.png` |
| 5 | `/examples.html` | default | open Examples | `examples-{width}.png` |
| 6 | `/capabilities.html` | default | open Capabilities | `capabilities-{width}.png` |
| 7 | `/about.html` | default | open About | `about-{width}.png` |
| 8 | `/privacy.html` | default | open Privacy | `privacy-{width}.png` |
| 9 | `/terms.html` | default | open Terms | `terms-{width}.png` |
| 10 | any page | mobile drawer open | at ≤820px, click the menu toggle | `drawer-open-{width}.png` |
| 11 | any page | drawer link focused | open drawer, `Tab` to a link | `drawer-focus-{width}.png` |
| 12 | any page | language selector open | click the language control | `lang-open-{width}.png` |
| 13 | `/solver.html` | primary button focus | `Tab` to a global button | `solver-btn-focus-{width}.png` |

Recommended capture matrix: pages 1–9 at all seven widths; states 10–13 at 360,
768, and 1440.

**Before/after visual checklist** (compare F1 vs F2 at each width):

- Header height consistent; logo legible; CTA visible but not dominant.
- Active nav item underlined (not color-only); exactly one current item.
- Cards/badges/buttons use the new radii, shadows, and spacing.
- Verification green reads as "solved/verified", brass as accent.
- Footer hierarchy and spacing legible; legal + contact present.
- No horizontal overflow; titles not clipped; language selector visible.
- Skip link appears on first `Tab` and lands on main content.
- Mobile drawer opens, traps focus, closes on `Escape`/backdrop, returns focus.
- Focus ring visible on every interactive element.
- Touch targets feel ≥ 44px on the 320–390 widths.

**Human-validation items** (cannot be asserted in code here):

- Overall "balanced professional + approachable" impression.
- Perceived readability of body text on cream and on deep green.
- Drawer animation smoothness (and that reduced-motion disables it).
- No layout shift (CLS) on load.
- Language selector legibility across all 5 languages.

## Remaining (F3–F9, not started)

F2 stops at the shared visual system + navigation. Home hero/section redesign,
Examples page redesign, solver onboarding (F7), and later checkpoints remain.
**F3 has not been started.**

## F2 final — visual delta (applying the system to real components)

A visual review of the first F2 pass found it technically sound but visually
near-invisible: `.btn2`, `.card2` and `.panel` were defined in the stylesheet
but had **zero usages** in the live markup, so BEFORE/AFTER looked almost
identical. This delta wires the F2 components to the real components without
touching copy, structure, the engine, the catalogue, or the solver's behavior.

Applied:

- **Button hierarchy** — the Home hero/CTA buttons now use `.btn2` with
  `--primary` (solid brass), `--secondary` (outline surface) and a new
  `.btn2--lg` size modifier. The remaining legacy `.btn` variants (the solver's
  own buttons) were tokenized in place. Computed AA contrast on the new
  pairings: `btn2--primary` ink-on-brass **5.35**, hover **8.36**, `.btn.solve`
  white-on-verification-green **5.29** — all ≥ 4.5.
- **Interactive cards** — Home's example cards (`.ex-card`/`.uc-card`) now carry
  `.card2`: consistent surface, padding, border, `--radius-lg`, subtle shadow,
  and a genuine hover affordance (accent border + card shadow + lift) because
  they are anchors. Static cards do not lift.
- **Capability steps** — the "Paste your model / Adjust it / Export the result"
  numbered steps carry `.card2` (via the generator + template), giving them a
  real card surface with a brass number badge.
- **Info blocks → panels** — the capabilities model-notes callouts
  (continuous/integer) carry `.panel`: quiet surface with an accent hairline.
- **Chrome tokenization** — header gets a subtle bottom hairline and accent nav
  hover; the language selector reads as an integrated control; the footer gets a
  top hairline and accent link hover; example chips gain tokenized hover/focus;
  the examples no-JS cards share the card surface. Cream stays the dominant
  background; brass stays a restrained accent; verification green stays reserved
  for trust/result states.

Fixtures rebaselined by the delta (all intentional visual rebaselines):
`engine/fixtures/css-golden/shell-css-golden.json` (CSS grew to 49943 bytes,
102 custom properties, 26 media queries), `engine/fixtures/pages-golden/
home-page.json` (main SHA/bytes), `engine/fixtures/pages-golden/
capabilities-page.json` (main + template SHA/bytes, ids). The engine, mirror,
examples, catalogue, 5 languages and 6 requests are unchanged; the composed
solver stays 215613 and dist/solver.html stays 218396 (the stylesheet is
external, not inlined into the solver).

Tests: `tests_f2_visual_nav.js` gained **6 assertions** pinning that the
components are actually USED in the markup (btn2 + primary/secondary hierarchy on
Home, card2 on Home cards and capability steps, panel on the capabilities info
block), so a regression back to unused classes fails. Battery: **12068**
(12062 + 6), stable before/after a build.

### AFTER screenshots

Regenerated locally with Playwright + headless Chromium (available in this
environment): all **60 AFTER** captures matching the BEFORE set 1:1, plus **11
BEFORE|AFTER comparisons**, at the four resolutions (1200×900, 1440×1000,
360×800, 390×844). Delivered in `plumline-checkpoint-f2-final-visual-review.zip`
alongside the received BEFORE set and the original comparisons.
