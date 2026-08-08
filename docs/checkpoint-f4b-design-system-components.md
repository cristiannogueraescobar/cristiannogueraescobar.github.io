# Checkpoint F4b — Design system: tokens and reusable components

## 1. Objective

Convert the approved F4a visual direction ("editorial decision instrument") into
a reusable, auditable, production-ready design system, WITHOUT wiring it to any
public page. Later checkpoints must be able to compose real components (buttons,
surfaces, receipts, status blocks, example cards, forms, layouts, typography,
spacing, metadata, technical panels) instead of redesigning them each time.

## 2. Baseline

Integrated post-F4a tree: Node 24.15.0, Vite 6.4.3, 13,608 tests, VERIFY ALL
GREEN, HTML/DIST/HTTP green, deterministic build, 5 real languages
(en/es/pt/de/fr), 9 public examples, engine/Worker/mirror protected. Confirmed
before any change: the battery reproduces 13,608 all green and the build
reproduces dist/index.html 4ec4fe2f… and dist/solver.html 36bfb88d… unchanged.

## 3. Audit of the existing CSS

`assets/plumline.css` already carries an F2 token layer (~91 custom properties)
that mixes primitives and a first semantic aliasing (`--bg`, `--surface`,
`--text`, spacing/type/layout scales) in one `:root`. It is functional but does
not separate a primitive floor from a semantic layer, and the F4a prototype
declared its OWN parallel token set (52 tokens), 34 of which share names with
production while some diverge in value (F4a refined `--brass-text` to #7A5518 for
AA; production still has #8A6222). Legacy repeated classes: card (19), btn (12),
badge (12), eyebrow (11), chip, field-deep, grid, tag. This duplication and
divergence is exactly what a single canonical source resolves.

## 4. F4a inventory

Kept: identity palette (cream/deep green/brass/verification green), Newsreader +
Manrope, the verification receipt, the spreadsheet surface, status semantics,
measurement language, the honest AA token values (#7A5518 brass text, #8E5A14
warning text), the mono-stack strategy for ≤ ≥ →. Normalised into tokens:
spacing, type ramp, radii, shadow, layout widths. Not carried over: the F4a
sequence (that is a motion concern for F4c), any page-specific section markup.

## 5. Architecture decisions

Single canonical source at `src/shared/design-system/`, namespaced `--pl-*` and
`.pl-*` to avoid collision with legacy `assets/plumline.css`. Layers with a
strict one-way dependency direction: primitives -> semantic -> (base, layout,
components, forms, instrument, utilities). The token policy is precise, not
absolute: consumer layers must not reference primitive tokens directly; brand/
system colours must come from semantic roles; and system-level typography,
spacing, borders and targets must use their semantic roles. Small local geometric
values (a 1px hairline offset, a per-component width or gap) may stay local when
turning them into a token would not express a reusable decision — the system does
not invent tokens just to be able to say "never raw values". Layout keeps its
documented layout-measurement exception, and per-instance custom properties such
as `--pl-grid-min` are valid. Native CSS custom properties only — no Style
Dictionary, Sass, extra PostCSS, generators or dependencies, because the
deterministic CSS custom-property cascade already expresses primitive/semantic/
component cleanly.

## 6. Canonical token source

`src/shared/design-system/index.css` is the single entry point; it `@import`s the
nine layers in dependency order. The showcase and (later) production import THIS,
never a copy. Tests assert this file exists and that the showcase references it.

## 7. Primitive tokens

Raw, context-free values in `01-primitives.css`: cream/green/brass/ink/amber/red
scales, white, type families, weights, a fluid size ramp, leading/tracking,
spacing (4px base, 0-20), border widths, radii (sm/md/pill), a "none" and a
single card shadow, and layout measurements (edge/reading/data widths, rails,
tap targets). Primitives never alias other tokens.

## 8. Semantic tokens

`02-semantic.css` derives meaning from primitives. Most roles are direct aliases
(`--x: var(--prim)`), but some are stable COMPOSITIONS of primitives — the
translucent inverse-muted text is derived from the single canonical
`--pl-cream-100` via `color-mix(in srgb, var(--pl-cream-100)
var(--pl-opacity-muted), transparent)` so it tracks a cream re-theme with no
duplicated RGB sibling, and the typography shorthands compose primitive
family/weight/size/leading. The layer covers: bg
canvas/surface/inverse; text primary/secondary/muted/faint/inverse/inverse-muted/
on-brass; border subtle/border/strong; action primary/hover/text; process roles;
status verified/warning/error/info with tints; focus; typographic SIZE, WEIGHT,
TRACKING and LEADING roles; typography shorthands; spacing roles; border-width
roles; shape roles; target-size roles; elevation roles; interaction. It is NOT a
1:1 alias table — the comments state where a role is a composition. Changing a
primitive re-themes everything without touching a component, and the T9 contract
forbids a semantic role from reintroducing a raw brand hex or a literal-channel
colour disconnected from the primitive palette.

## 9. Component-token policy and enforced dependency direction

The dependency direction is now ENFORCED, not just documented. Consumer layers
(03-base, 06-components, 07-forms, 08-instrument, 09-utilities) reference ONLY
semantic roles — 0 direct primitive references — verified by the C1 contract per
file, which names any offending file+token as a "direct primitive token use".
The one deliberate, documented exception is 04-layout, which may reference ONLY
the primitive layout MEASUREMENTS (widths/rails/tap targets), because a
structural page measure is not a re-themable colour/spacing decision; the C1
contract allows that layer only those primitives and no others.

Component tokens remain reserved for a decision a semantic role cannot express.
After the refactor, every component decision is expressible through a semantic
role (size/weight/tracking/spacing/border/target roles were added for exactly the
values components previously reached into the primitive layer for) plus
legitimate per-instance parameters (e.g. `--pl-grid-min` on `.pl-grid`), so the
dedicated component-token count is 0 by correct architecture, not by artificially
preserving the number. No `--receipt-green`/`--card-green`/`--button-green`:
those are the same concept and stay semantic.

## 10. Typography

Roles for display/editorial, heading (h1-h3), body, compact UI, small, label,
mono/data, with tabular-numeric use where it matters. Each role bundles family +
weight + size + line-height; tracking is applied per role. Sizes use `clamp()`
where fluid scaling helps and hold from 320px up. Newsreader for editorial
headings, Manrope for UI/body, the existing mono stack for data/formulas.

## 11. Font metrics and audited-asset integrity

Measured from the real woff2 OS/2 tables (unitsPerEm 2000 for both): Newsreader
typoAsc 1470 / typoDesc -530 / typoGap 0; Manrope typoAsc 2132 / typoDesc -600 /
typoGap 0. Derived fallback overrides: Newsreader ascent 73.50% / descent 26.50%
/ line-gap 0%; Manrope ascent 106.60% / descent 30.00% / line-gap 0%.
`size-adjust` is left neutral (100%) because deriving it needs the OS fallback
face's x-height, which is not deterministically measurable; we do not invent it.

The metadata above was AUDITED on the real font binaries (fonttools) during this
checkpoint and frozen in `src/shared/design-system/fonts/FONT-AUDIT.json`, which
records per file: filename, byte size, SHA-256, family, wght axis (200-800),
typo metrics, and glyph presence (`=` and `×` present; `≤ ≥ →` absent). The F8
contract does NOT re-parse the fonts at test time (no fonttools, no external
process): it re-computes the SHA-256 of the shipped woff2 and requires them to
match the manifest, so the audited metadata is cryptographically bound to the
exact files inspected. The manifest itself distinguishes "metadata audit
performed on the real fonts" from "exact audited assets pinned by SHA-256". A
negative mutation flips a byte of a woff2 and the integrity contract fails.

## 12. Font licensing

Newsreader (Production Type) and Manrope (Mikhail Sharanda), both SIL OFL 1.1,
shipped as `Newsreader-OFL.txt` and `Manrope-OFL.txt` alongside the woff2. OFL
permits embedding and commercial use; the fonts are self-hosted, never remote.

## 13. Glyph coverage

Verified against the real cmaps: the latin + latin-ext subsets cover the Latin
text of en/es/pt/de/fr (accents included) plus `=` and `×`. They do NOT contain
`≤` `≥` `→`. Those operators and the action-link arrow are assigned to the mono/
system stack via `.pl-mathsym` and `.pl-action-link::after`. No claim is made
that the webfonts cover ≤ ≥ →.

## 14. Spacing

A 4px-base scale (0,4,8,12,16,20,24,32,40,48,64,80) exposed as primitives and
mapped to spacing ROLES (micro gap, control gap, control pad, component pad,
layout gap, section rhythm). Arbitrary repeated pixel values are removed; the
scale is deliberate, not forced onto every measurement.

## 15. Layout

Layout primitives: container (+reading/data), stack (+tight/loose/section),
cluster (+between/baseline), split (+editorial/data, collapses < 900px), grid
(auto-fill via `--pl-grid-min`), rail layout (+left), bleed, section. A small,
deliberate set F6/F8/F9/F10 compose with; no 20 helpers.

## 16. Borders / radii / shadows

Hairline and strong border widths; two radii (sm 6px control, md 10px surface)
plus a pill; a "none" shadow and one controlled card shadow. Plumline stays flat
and structural — no glassmorphism, no collection of eight radii.

## 17. Accessibility

Every critical small-text pair is contrast-checked to WCAG AA (>= 4.5:1) by real
computation, not perception (see section 22). One consistent `:focus-visible`
ring, never removed without replacement. Interactive controls use a comfortable
target near 44px (WCAG 2.2). Status is never colour-only (each badge carries a
distinct shape marker). Forms use native controls with real labels, associable
help/error text, discernible disabled state. Tables use real table semantics;
overflow uses an accessible, focusable, labelled local-scroll region; the page
never overflows horizontally at 320/390.

## 18. Components

Buttons (primary/secondary/ghost/disabled), links (inline/action/inverse), status
badges (proven/feasible/incomplete/infeasible/unbounded/neutral), metadata chips
+ difficulty pips, surfaces (flat/raised/sub), example card (standard/featured),
verification receipt (light + inverse), spreadsheet/model surface, technical data
list, capability matrix wrapper, status panels (proven/incomplete/error/info),
form controls, instrument language, CTA surface. See the catalogue in
`docs/design-system-components.md`.

## 19. Component API / classes

Each component is a `.pl-<name>` block with `--<modifier>` variants. Full class
lists, required structure, allowed tokens, a11y and responsive behaviour are in
the component catalogue document; this checkpoint doc summarises, the catalogue
is the stable reference.

## 20. Language stress testing

The showcase includes a 5-language stress matrix (en/es/pt/de/fr, no Italian)
exercising long headings, long buttons, metadata, status, form labels, accented
glyphs, German compound wrapping and French/Portuguese diacritics. It does not
duplicate the whole page five times.

## 21. Responsive

Validated at 1440×1000, 1024×768, 768×1024, 390×844, 320×720 with no zoom. No
clipping, no horizontal page overflow, no two-line illegible buttons, no crushed
metadata/receipt/tables. German strings and long objective values checked.

## 22. Contrast results

All computed >= 4.5:1: text-primary/canvas 16.20, /surface 18.12; text-secondary
9.66; text-muted 5.96; text-faint 4.98; action text on brass 4.93; process-text/
canvas 5.98, /brass-tint 5.45; verified/tint 4.50; warning/tint 4.95; error/tint
7.46; inverse text/inverse ground 14.93.

## 23. Showcase architecture

`design-review/f4b/index.html` is a single component laboratory (not a landing
page). It imports the canonical `index.css` and a small `showcase.css` that only
arranges specimens (it defines no `--pl-*` token and redefines no component). The
showcase proves real reuse.

## 24. Files added

`src/shared/design-system/` (01-primitives, 02-semantic, 03-base, 04-layout,
05-fonts, 06-components, 07-forms, 08-instrument, 09-utilities, index.css, fonts/
with 4 woff2 + 2 OFL + FONT-AUDIT.json), `design-review/f4b/` (index.html,
showcase.css), `engine/tests_f4b_design_system.js`,
`engine/tests_f4b_design_system_negative.js`, `engine/f4b-protected-baseline.json`
(baseline hashes of the protected production/infra files),
`docs/checkpoint-f4b-design-system-components.md`,
`docs/design-system-components.md`.

## 25. Files modified

`engine/suites.js` only, to register the two new suites. No other existing file
is modified.

## 26. Production protected

index/solver/examples/capabilities/guide/about/privacy/terms .html,
assets/plumline.css, assets/i18n.js, assets/examples-data.js,
assets/product-capabilities.js, engine production code, Worker, mirror and the
example catalogue are unchanged and byte-identical to the baseline. vite.config.
mjs, package.json and package-lock.json are untouched; no dependency is added.

This is now ENFORCED by hash, not just asserted in prose. `engine/f4b-protected-
baseline.json` pins the post-F4a SHA-256 of 22 real production/infra files: the
12 core production files (the 8 public HTML pages + assets/plumline.css +
assets/i18n.js + assets/examples-data.js + assets/product-capabilities.js), 3
infra files (vite.config.mjs, package.json, package-lock.json), 2 engine
mirror/worker-client files, and the 5 example-catalogue source files under
src/shared/examples/ (catalogue.js, index.js, projectors.js, schema.js,
serialize.js) — 12 + 3 + 2 + 5 = 22. The PP contract
requires each to EXIST and match its baseline hash, failing with the exact file
that changed ("protected production hash changed? <path>"). Because the check
demands the real files, the F4b suite no longer passes on an overlay-only tree
that lacks the public pages — it fails their existence checks — so it genuinely
protects production.

## 27. Tests

`engine/tests_f4b_design_system.js` validates: canonical source and layer
separation; alias integrity (no nonexistent target, no self-reference, no
cycles); semantic re-theming integrity (no raw hex in semantic; any translucent
colour derived from a primitive colour token via color-mix, never literal
channels); single-canonical-cream enforcement (one --pl-cream-100, no synced RGB
sibling, inverse-muted derived from it via color-mix); REAL primitive-to-semantic
enforcement per consumer file (0 direct primitive references, with the documented
layout-measurement exception); key semantic roles; component discipline (no raw
brand colour, no remote assets/fonts, no third webfont, no ID styling, no
!important, no motion, focus-visible, disabled, form semantics, six
geometrically-distinct status markers); fonts (assets, licenses, family names,
variable metadata, derived fallback overrides, glyph honesty, and SHA-256
integrity against FONT-AUDIT.json); isolation (showcase consumes canonical,
defines no tokens, excluded from dist); protected production as an EXACT set of 22
paths (the 12 core + 3 infra + 2 mirror/worker + 5 catalogue files fixed by the
contract, with no missing, unexpected or duplicated path) each existing and
matching its baseline SHA-256 and byte size; accessibility/responsive
(computed contrast, target size, local scroll, one H1, heading order, landmarks,
truthful links — a "solver" link must reach the real solver.html); copy honesty
(no generic proof language, no over-claim of measurement over estimation, no
implication that solving again resumes a prior search, no generic verification-
proof label — across the showcase and the canonical F4b docs); and roadmap
ownership.

## 28. Negative mutations

`engine/tests_f4b_design_system_negative.js` runs reproducible mutations
against an isolated temp copy that includes the real production files
(fs.cpSync into an mkdtemp path with a space, run via process.execPath, restored
in finally), each passing only when its specific contract fails. The set covers:
nonexistent-alias, alias cycle, raw brand colour in a component, direct primitive
use where a semantic is required, semantic raw hex, inverse-muted via literal
channels, cream-100 re-adding a synced RGB sibling, remote Google Font, third
webfont, missing license, missing subset, unsupported operator claim, WOFF2 byte
tamper (SHA-256 integrity), missing font asset, !important, ID styling, keyframes,
removed focus-visible, sub-AA contrast, tiny target, non-distinct status markers,
removed status markers, fake solver link to a fragment, href="#" placeholder,
missing fragment target, two dishonest-copy reintroductions, a generic
verification-proof label in the doc, broken showcase import, duplicate showcase
tokens, design-review reachable by vite, three REAL protected-production
content mutations (index.html, assets/plumline.css, vite.config.mjs), a
protected-set REDUCTION mutation (a non-core catalogue path removed from the
manifest, which must fail as an expected-protected-path-missing), and two
roadmap-reassignment mutations. The exact mutation count is reported by the suite
run in the final validation.

## 29. Windows portability

Tests and tooling use Node APIs only (fs.cpSync/rmSync/process.execPath), no
cp/rm/mv/sed/grep/bash/sh/cmd/powershell, always clean up in finally, and run
from paths containing spaces.

## 30. Performance

No new production request: the design system lives in source and no public page
imports it, so production ships zero extra bytes, zero new fonts, zero new CLS.
The fonts are preload-ready with a documented strategy (preload the two latin
non-ext woff2) applied by the adopting page later.

## 31. Limitations

The system is production-READY, not production-WIRED: connecting it to public
pages would change their rendering and belongs to F9 (Home) and F10 (the rest).
`size-adjust` is left neutral (not invented). The showcase is a laboratory, not
a shippable page.

## 32. Rollback

Delete `src/shared/design-system/`, `design-review/f4b/`, the two F4b test files
and the two F4b docs; remove the two F4b entries from `engine/suites.js`. That
restores the post-F4a state at 13,608.

## 33. Exact ownership of F4c

F4c owns the motion system: transitions, reveals where meaningful, state
transitions, product-sequence primitives, pause/resume, IntersectionObserver
policy, reduced-motion policy, accessibility, motion performance and lifecycle/
cleanup. F4b introduces NO motion.

## 34. Exact ownership of F9

F9 owns the narrative Home redesign. F4b does not redesign the Home and does not
apply the new look to the Home.

## 35. Exact ownership of F10

F10 owns the redesign of the rest of the public/internal pages (Solver, Examples,
Capabilities, Guide, About, Privacy, Terms) and the shared nav/footer. F4b does
not redesign or re-skin any of them.

## 36. What F5/F6/F8 can reuse

F5 (canonical examples architecture) and F6 (examples library UI) reuse the
example card, metadata chips, difficulty pips, status badges, forms (search/
filter) and grid/cluster layout primitives. F8 (grid personalisation/UX) reuses
the spreadsheet surface, forms, buttons, panels and data list. All of them reuse
tokens, typography, spacing and the receipt.

## Component table

| Component | Purpose | Variants | Used later by |
|-----------|---------|----------|---------------|
| pl-button | Actions | primary / secondary / ghost / disabled | F6 F8 F9 F10 |
| pl-link / pl-action-link | Navigation & inline actions | inline / action / inverse | F6 F8 F9 F10 |
| pl-badge | Solve status | proven / feasible / incomplete / infeasible / unbounded / neutral | F6 F8 |
| pl-chip / pl-difficulty | Metadata | chip / process chip / difficulty pips | F6 F7 |
| pl-surface | Panels | flat / raised / sub | F6 F8 F9 F10 |
| pl-example-card | Example presentation | standard / featured | F6 F7 |
| pl-receipt | Verified result summary | light / inverse | F8 F9 |
| pl-sheet | Spreadsheet/model surface | formula / decision / total | F6 F8 F9 |
| pl-data-list | Technical facts | — | F8 |
| pl-matrix | Capability table | min-width local scroll | F9 F10 |
| pl-panel | Status message | proven / incomplete / error / info | F8 |
| pl-field / pl-input / pl-select / pl-check | Forms | text / search / select / checkbox / radio | F6 F8 |
| instrument language | Identity marks | measure label / calibration / plumb / figure id / annotation | F9 F10 |
| pl-cta | Editorial action | primary + optional secondary + note | F9 F10 |
