# Checkpoint B3 — shared styles baseline

Real state of Plumline's CSS before any B3 change, measured against the working
tree (base SHA: pending user verification — the assistant works from a snapshot
and cannot fetch origin/main). Node used: v22.22.2 (repo pins `>=24.15.0 <25`;
24.15.0 unavailable here). `npm run verify`: ALL GREEN. `npm run build`: green.
Baseline test total: 7252.

## Headline finding — audit classification: STATE B

**The shared shell CSS is already centralized in one external stylesheet,
`assets/plumline.css`, loaded by all eight pages.** There is no duplicated shell
CSS across pages to extract. The two remaining inline `<style>` blocks are a
solver-specific variant and page-specific Examples CSS — not shared shell. So the
architectural goal of B3 is already met; B3 formalizes it with contracts, golden
fixtures, and documentation, and changes no production CSS.

## CSS inventory (real data)

### External stylesheets
Every page loads exactly one external stylesheet: `assets/plumline.css?v=21`.
- 641 lines, 35 441 characters, 35 459 bytes (UTF-8 — a few multi-byte
  characters make bytes exceed `String.length`).
- ~350 rule blocks, 23 `@media` queries, 31 custom-property declarations, 0
  `@keyframes`, 0 `@font-face`, 4 `!important`.
- Breakpoints: max-width 560 (×7), 900 (×4), 680 (×3), 820 (×2), 760, 520, 1000;
  min-width 901, 1500, 1900; plus `prefers-reduced-motion: reduce`.
- Focus: a base `:focus-visible` rule (outline 2px `--true`) plus two
  capabilities-specific focus rules. No `@media print`.

### Inline `<style>` blocks
| Page | Inline `<style>` | What it is |
| --- | --- | --- |
| index, guide, capabilities, about, privacy, terms | none | shell + page CSS all from plumline.css |
| solver.html | 1 block, 246 lines, 18 059 chars / 18 061 bytes (UTF-8) | solver VARIANT + solver-only CSS |
| examples.html | 1 block, 13 lines, 885 chars / 885 bytes (UTF-8, all ASCII) | Examples page-specific CSS |

### Load order (solver.html and examples.html)
`<link rel="stylesheet" href="assets/plumline.css?v=21">` (line 22) is loaded
BEFORE the inline `<style>` (line 23). So the inline block, where it redeclares a
selector, WINS the cascade — this is how the solver's deliberate variant overrides
the base.

## Requests per page (CSS)
Same on every page: one external stylesheet request. solver.html and examples.html
additionally carry one inline `<style>` (no extra request). No page loads a
second external CSS file.

## The solver inline block — a deliberate variant, NOT duplicated shell

The solver's inline `<style>` opens with a `:root{…}` of 21 custom properties and
a few base rules, then contains solver-only CSS. Analysis:

- **`:root` (21 vars):** every one of the 21 is present in plumline.css with an
  IDENTICAL value (0 value differences). plumline.css defines 27 vars total (6
  more: `--deep-2`, `--edge`, `--radius`, `--radius-sm`, `--rail`, `--wrong-lo`).
  The inline `:root` is therefore a redundant re-declaration of identical values —
  it changes no computed value. It is NOT a defect (nothing differs) and removing
  it is a cosmetic edit that State B forbids; it stays.
- **Base rules DIFFER on purpose:** `body` is `font-size:16px; line-height:1.6`
  inline vs `17px; 1.62; text-rendering:optimizeLegibility` in the sheet; `.wrap`
  is `max-width:var(--edge,1360px)` inline vs `var(--edge)` in the sheet; `a` is
  `color:var(--ink)` inline vs the sheet's underlined-link treatment. Because the
  inline block loads AFTER the sheet, these are the solver's INTENTIONAL variant.
  This is exactly what the pliego protects ("no fuerces el solver a usar estilos
  informativos si tiene una variante propia"). Must not be moved.
- **Solver-only CSS:** the block contains grid (`.grid` ×16), results
  (`.receipt` ×19, `.result` ×4, `.lim`, `.trouble`, `.exports`), and charts
  (`.plot` ×13) styles, plus `.vs-row` (Variable Settings) and one `@keyframes`
  (the spinner). All of this is page-specific and forbidden to move.

## The Examples inline block
`.ex-grid`, `.ex-cat`, `.xcard` (+ hover) — Examples catalog CSS that uses shared
variables (`var(--faint)`, `var(--brass)`, `var(--line)`) from plumline.css. It is
page-specific and stays inline.

## Shell selectors live in plumline.css (real counts)
`.mast` (informational header) ×3, `.top` (solver header) ×46, `nav` ×22,
`footer`/`.foot` present, `.mobile-menu*` ×7, `.menu-toggle` ×3, `lang`
(selector) ×6, `:focus-visible` ×3. The build badge (`#buildBadge`) has no
dedicated selector — it is a `<span>` inside `.foot .fine`, whose styling comes
from plumline.css.

### Pre-existing solver overrides in plumline.css (documented, not a defect)
plumline.css already carries a small number of solver-scoped RESPONSIVE overrides
inside `@media` blocks — e.g. `.exports{flex-wrap:wrap}` and `.exports .chip{...}`
alongside `button.solve`, `.controls-row`, `.grid-tools` in a small-screen media
query. This is the pre-B3 approved cascade: the solver's inline `<style>` defines
the base `.exports`, and the shared sheet holds its responsive override. B3 does
NOT move these (moving them would change the approved cascade). The isolation
contract therefore guards against the INTRODUCTION of NEW grid/results/charts
selectors into the shared sheet (grid `#grid`/`.gridwrap`, results `.receipt`,
charts `.plot`, Variable-Settings `.vs-row` are all 0 in plumline.css and must
stay 0), rather than asserting a purity the approved state never had. The exact
current content of plumline.css — including these overrides — is frozen by the CSS
golden hash, so any change to them is caught.

## Classification (per the pliego)

### A — shared, already centralized in plumline.css (protect with contracts)
Header (`.mast` / `.top`), primary nav, mobile menu (`.mobile-menu*`,
`.menu-toggle`), drawer/backdrop, language selector, footer (`.foot`, `.fine`
that styles the build badge), shell `:focus-visible`, shared shell breakpoints and
custom properties.

### B — legitimate variant (protect explicitly; never merge)
- informational header `.mast` (logo 24×38) vs solver header `.top` (logo 20×30);
- the solver's inline base overrides (`body` 16px/1.6, `.wrap` fallback, `a`);
- the solver's on-page "How to use" nav;
- the Capabilities footer difference (its extra learn link);
- selectors that exist only in one variant.

### C — page-specific, forbidden to move
- solver grid/results/charts/Variable-Settings CSS (solver inline block);
- Examples catalog CSS (examples inline block);
- Home hero/cards, Capabilities table, legal content — all in plumline.css under
  page-scoped selectors and left where they are.

### D — dead or seemingly dead
Not the target of B3. No CSS is removed. If any rule looks unused, it is left in
place; proving deadness and removing it is out of scope for a formalization
checkpoint.

## Cache version
`assets/plumline.css?v=21` is identical across all eight pages. B3 does NOT modify
plumline.css, so its version is NOT bumped (bumping an unchanged asset's version is
explicitly disallowed).

## Scope implication for B3 (confirmed: State B)
Because the shell CSS is already one shared stylesheet with no cross-page
duplication, there is nothing to centralize and no build-time composition to
introduce (which would risk the solver's deliberate variant for no gain). B3
therefore: documents this baseline, classifies the CSS, adds independent golden
fixtures for the shared shell + variants, adds cascade/specificity/breakpoint
contracts, adds isolation guards (no grid/results/charts CSS in the shared shell;
no informational page loads solver-only CSS; no CSS fetch/innerHTML/runtime
injection; no CSS partial published to dist), and adds negatives that mutate temp
trees and run the SAME official checker. No production CSS, inline block, cache
version, or HTML is changed.
