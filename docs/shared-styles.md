# Shared styles (Checkpoint B3)

B3 formalizes Plumline's CSS architecture. The audit found **State B**: the shared
shell CSS is already centralized in one external stylesheet, `assets/plumline.css`,
loaded by all eight pages, with no cross-page duplication to extract. B3 therefore
changed no production CSS — it added golden fixtures, structural/isolation
contracts, negatives, and this documentation. See `checkpoint-b3-baseline.md` for
the full inventory.

## Where the shared styles live
- `assets/plumline.css?v=21` — the single shared stylesheet. Loaded by all eight
  pages via one `<link rel="stylesheet">`. Contains the shell (header variants,
  nav, mobile menu, drawer/backdrop, footer, language selector, `:focus-visible`),
  the shared custom properties (`:root`), the shared breakpoints, and each page's
  page-scoped CSS. 641 lines, 35 441 characters, 35 459 bytes (UTF-8), ~350
  rules, 23 media queries, 31 custom properties, 4 `!important`, 0 `@keyframes`,
  0 `@font-face`.
- `solver.html` inline `<style>` — the solver's VARIANT plus its solver-only CSS
  (grid, results/receipt, charts/plot, Variable Settings, the spinner keyframe).
  Loads AFTER plumline.css so its variant overrides win the cascade.
- `examples.html` inline `<style>` — Examples catalog CSS (page-specific).

## What was centralized vs what stayed specific
- **Centralized (already, before B3):** all shared shell styles, in plumline.css.
- **Stayed a variant:** the solver's inline base overrides (`body` 16px/1.6 vs the
  sheet's 17px/1.62; `.wrap` fallback; `a` link treatment), its on-page "How to
  use" nav, and the Capabilities footer difference.
- **Stayed page-specific:** solver grid/results/charts CSS (solver inline block),
  Examples catalog CSS (examples inline block).

## How the cascade is preserved
plumline.css loads first on every page; on solver.html and examples.html the inline
`<style>` loads immediately after, so any selector the inline block redeclares wins
— which is how the solver's deliberate variant overrides the shared base. B3 does
not move any rule, so rule order, specificity, media-query order, and the base↔
responsive ordering are all exactly as approved. The CSS golden hash freezes the
entire content of plumline.css and both inline blocks, so any reorder, value
change, or specificity change is caught.

## How the variants are preserved
The informational header (`.mast`, logo SVG 24×38 in the HTML) and the solver
header (`.top`, logo SVG 20×30 — note the logo dimensions are SVG attributes in the
page markup, protected by the B1 shell golden, not CSS) remain distinct. The
solver's variant is never forced onto informational pages, and no informational
page loads solver-only CSS. The Capabilities footer difference is preserved; no new
visual variant was created.

## Is there build-time composition?
No. The shell CSS is a single real stylesheet, not composed from fragments. B3
introduced no CSS composition, no `PLUMLINE:SHARED-SHELL-STYLES` marker, and no
`src/shared/styles` partials — adding them would be indirection over an
already-centralized stylesheet and would risk the solver's variant for no gain.
There are therefore no CSS partials to publish, none in dist, and no marker to
leave residual.

## Pre-existing solver responsive overrides in the shared sheet
plumline.css already carries a few solver-scoped RESPONSIVE overrides inside media
queries (e.g. `.exports{flex-wrap:wrap}` next to `button.solve`, `.controls-row`,
`.grid-tools`). This is the approved pre-B3 cascade — the solver's inline block
defines the base, the sheet holds the small-screen override. B3 does not move
these; they are frozen by the golden hash. The isolation contract guards against
the INTRODUCTION of NEW grid/results/charts selectors (`#grid`, `.gridwrap`,
`.receipt`, `.plot`, `.vs-row` stay at 0), not against a purity the approved state
never had.

## How to add a shared style rule
1. Confirm it is genuinely shared shell styling used by more than one page.
2. Add it to `assets/plumline.css` in the correct cascade position.
3. Bump the cache version (`plumline.css?v=N`) in all eight pages AND in
   `engine/templates/capabilities.template.html`, then add/extend a reusable
   version checker and a negative with the old version (mirroring B2's asset
   version pattern).
4. Update the CSS golden fixture (see below) and run the battery.

## What NOT to add to the shared sheet
- solver-only grid/results/charts/Variable-Settings selectors;
- a rule that only one page uses when it belongs in that page's inline block or a
  page-scoped selector;
- a new external stylesheet (keep it to the one shared sheet unless a documented,
  authorized exception applies);
- anything that changes the solver's variant.

## How to add a breakpoint
Add the media query to plumline.css at the correct order relative to existing base
and responsive rules (never place a responsive rule before its base rule). Update
the CSS golden fixture's `breakpoints` list and re-freeze the hash.

## How to update the golden fixtures
The golden lives in `engine/fixtures/css-golden/shell-css-golden.json` (exact CSS
fragments + SHA-256 hashes, derived from the approved state, NOT generated by any
compositor). The `*_bytes` fields are true UTF-8 byte lengths measured with
`Buffer.byteLength(value, 'utf8')` (not `String.length`, which counts UTF-16 code
units — for plumline.css that is 35 441 characters vs 35 459 bytes). After an
intentional, approved CSS change: re-extract the affected fragments and re-compute
the hashes from the new approved CSS, update the JSON, and confirm
`tests_css_golden.js` passes. Never regenerate the expected values with the same
code path the test validates.

## How to test parity and detect a visual regression
- `node engine/tests_css_golden.js` — exact fragments + whole-sheet hashes.
- `node engine/tests_css_structure.js` — stylesheet count/order, inline `<style>`
  placement, shell selectors present, no grid/results/charts in the shared sheet,
  no runtime CSS injection, no partials.
- `node engine/tests_css_negative.js` — mutates temp trees and runs the official
  checkers to prove they bite (changed color/padding/breakpoint, removed selector/
  focus, altered specificity, added `!important`, grid/receipt leaked into the
  shell, informational page gains inline `<style>`, new external sheet, CSS fetch/
  innerHTML, a partial directory appears).
Final pixel-level visual parity is left to the Windows/GitHub CI with a real
browser; this environment has none, so parity is proven by exact CSS golden +
structural contracts, not screenshots.

## How to revert B3 without reverting B1/B2
B3 added only: `docs/checkpoint-b3-baseline.md`, `docs/shared-styles.md`, the
`engine/fixtures/css-golden/` fixture, `engine/tests_css_golden.js`,
`engine/tests_css_structure.js`, `engine/tests_css_negative.js`, the three new
names in `engine/suites.js`, and the three new names in engine/suites.js, and the two allowlist entries in engine/tests_composed_reads.js. To revert B3: delete those files and fixtures, remove the three suite names, and remove the two allowlist entries. B1 (shell composition, fragments, PAGE_CONTEXT, golden fixtures) and B2 (behavior guards, asset versions) are untouched by B3 and need no change. No production CSS, HTML, or cache version was modified by B3, so there is nothing else to undo.