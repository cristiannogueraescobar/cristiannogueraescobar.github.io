# Plumline design system — component catalogue

Stable reference for the F4b design system. Canonical source:
`src/shared/design-system/` (import `index.css`). Namespace `--pl-*` / `.pl-*`.
Components consume semantic roles for brand/system colours and for system-level
typography, spacing, borders and targets; they never reference primitive tokens
directly. Small local geometric values may remain local when tokenising them
would not express a reusable decision. No motion (F4c owns it). A page
opts in by wrapping content in an element with class `pl-root`.

For each component: canonical class/API, required structure, modifiers, allowed
tokens, accessibility, responsive behaviour, usage, and an anti-pattern.

---

## Buttons — `.pl-button`

- **Structure:** a `<button type="button">` (or `<a>` styled as a button).
- **Modifiers:** `--primary` (brass fill), `--secondary` (deep-green fill),
  `--ghost` (outline). Disabled: use the native `disabled` attribute on a
  `<button>`. The `[aria-disabled="true"]` selector only styles the disabled
  look; it does NOT by itself disable an element or block activation. On a
  `<button>`, always use native `disabled`. If a future checkpoint applies the
  disabled look to an actionable element that cannot take native `disabled`
  (e.g. an `<a>`), that checkpoint must also block the action in its own
  behaviour — CSS alone never disables a link. F4b adds no JavaScript for this.
- **Allowed tokens:** `--pl-color-action-*`, `--pl-color-bg-inverse`,
  `--pl-color-text-*`, `--pl-radius-control`, `--pl-tap-min`, `--pl-space-*`.
- **A11y:** min-height `--pl-tap-min` (44px); relies on the global
  `:focus-visible` ring; disabled uses `--pl-disabled-opacity` and
  `cursor:not-allowed`.
- **Responsive:** label wraps within the button; never forced to a fixed width.
- **Usage:** `<button class="pl-button pl-button--primary" type="button">Open the solver</button>`
- **Anti-pattern:** do NOT add a `transition`/`animation` (F4c); do NOT set a
  fixed height below `--pl-tap-min`.

## Links — `.pl-link`, `.pl-action-link`

- **Structure:** `<a href>`; `.pl-action-link` appends a mono arrow via `::after`.
- **Modifiers:** inside `.pl-inverse` both flip to the on-dark action colour.
- **Allowed tokens:** `--pl-color-action-text`, `--pl-color-action-text-inverse`,
  `--pl-font-family-data` (arrow).
- **A11y:** underline on `.pl-link`; the arrow is decorative (font glyph, from the
  mono stack because ≤≥→ and → are not in the webfonts).
- **Anti-pattern:** never `href="#"`; give a real target or a button.

## Status badges — `.pl-badge`

- **Structure:** inline element + text; a `::before` shape marker.
- **Modifiers:** `--proven` (circle), `--feasible` (ring), `--incomplete`
  (triangle), `--infeasible` (rotated square), `--unbounded` (clip triangle),
  `--neutral` (dot).
- **Allowed tokens:** `--pl-color-verified/-tint`, `--pl-color-warning/-tint`,
  `--pl-color-error/-tint`, `--pl-color-process/-tint`, `--pl-color-info/-tint`.
- **A11y:** status is conveyed by SHAPE + text, never colour alone.
- **Anti-pattern:** do not create a colour-only badge variant with no marker.

## Metadata chips — `.pl-chip`, `.pl-difficulty`

- **Structure:** `.pl-chip` inline; `.pl-difficulty` wraps `.pl-difficulty__pip`
  spans (`data-on="true"` for filled).
- **Modifiers:** `.pl-chip--process` for the instrument accent.
- **A11y:** difficulty carries an `aria-label` ("Difficulty 2 of 3"); pips are
  visual.
- **Anti-pattern:** chips must recede — do not use action/brand fills that
  compete with primary content.

## Surfaces — `.pl-surface`

- **Modifiers:** `--flat` (no shadow), `--raised` (one controlled shadow),
  `--sub` (surface-2 ground).
- **Allowed tokens:** `--pl-color-bg-surface/-2`, `--pl-color-border`,
  `--pl-radius-surface`, `--pl-elevation-*`, `--pl-pad-component`.
- **Anti-pattern:** no glassmorphism, no stacking multiple shadows.

## Example card — `.pl-example-card`

- **Structure:** `__meta` (chips + difficulty), `__title`, `__question`,
  optional body (e.g. a `.pl-sheet`), `__foot` (action link).
- **Modifiers:** `--featured` (raised, larger title, subtle gradient ground).
- **A11y:** use a real heading (`<h3 class="pl-example-card__title">`).
- **Responsive:** designed to sit in a `.pl-grid`.
- **Anti-pattern:** do not bind this to a specific Home section; it is a generic
  example presentation (schema migration is F5, not here).

## Verification receipt — `.pl-receipt`

- **Structure:** `__head` (`__status` with `__seal` + `__title`, `__sub`),
  `__body` (`__row` = `__k` / `__v` / `__check`), optional `__foot`.
- **Modifiers:** `--inverse` for a dark ground.
- **Allowed tokens:** bg inverse, verified, text roles, border, `--pl-font-family-data`.
- **A11y:** wrap in `role="group"` + `aria-label`; the seal/checks are
  `aria-hidden` decoration; the values carry the meaning.
- **Responsive:** rows use a 3-column grid that holds on mobile; `__v` is
  tabular-numeric.
- **Anti-pattern:** do not put solver logic here — it is presentation only.

## Spreadsheet / model surface — `.pl-sheet`

- **Structure:** a real `<table>`; cell classes `__num` (right-align), `__formula`
  (process colour), `__decision` (selected cell), row class `__total`.
- **A11y:** real `<thead>`/`<th>`; wrap in `.pl-matrix-scroll` when it can exceed
  the viewport.
- **Anti-pattern:** not a spreadsheet engine; do not wire editing here.

## Technical data list — `.pl-data-list`

- **Structure:** a `<dl>` of `<dt>`/`<dd>` pairs in a 2-column grid.
- **Usage:** quick label/value scanning (objective, variables, timing).

## Capability matrix — `.pl-matrix` + `.pl-matrix-scroll`

- **Structure:** `.pl-matrix-scroll` (focusable `role="region"` with
  `aria-label`) wrapping a `<table class="pl-matrix pl-matrix--min">`.
- **A11y:** local horizontal scroll is keyboard-reachable (tabindex="0") and
  labelled; important columns are never hidden on mobile.
- **Anti-pattern:** do not drop columns on small screens — scroll instead.

## Status panel — `.pl-panel`

- **Structure:** `__band` (colour rail) + `__body` (`__head` with `__name` +
  badge, `__meaning`, `__next`, optional `__evidence`).
- **Modifiers:** `--proven`, `--incomplete`, `--error`, `--info`.
- **A11y:** meaning is in text; the band is decorative.
- **Anti-pattern:** do not invent a "next action" Plumline cannot perform.

## Forms — `.pl-field`, `.pl-input`, `.pl-select`, `.pl-textarea`, `.pl-search`, `.pl-check`

- **Structure:** `.pl-field` groups a `.pl-field__label` (real `<label for>`),
  the control, and `__help` / `__error`.
- **A11y:** associate help/error with `aria-describedby`; error state uses
  `aria-invalid="true"`; controls meet `--pl-tap-min`; native checkbox/radio use
  `accent-color`.
- **Anti-pattern:** do not replace native controls with custom JS widgets.

## Instrument language — `.pl-measure-label`, `.pl-calibration`, `.pl-plumb`, `.pl-figure-id`, `.pl-annotation`

- **Usage:** subtle identity marks. Keep them sparse.
- **A11y:** calibration/plumb marks are decorative (`aria-hidden`).
- **Anti-pattern:** do not turn every section into a technical blueprint.

## CTA surface — `.pl-cta`

- **Structure:** optional eyebrow, `__title`, `__copy`, `__actions` (primary +
  optional secondary), optional `__note` (trust line).
- **Usage:** often inside a `.pl-inverse` block.
- **Anti-pattern:** no invented marketing statistics or testimonials.

---

## Layout primitives

| Class | Purpose | Key modifier / param |
|-------|---------|----------------------|
| `.pl-container` | width cap + gutter | `--reading`, `--data` |
| `.pl-stack` | vertical flow | `--tight`, `--loose`, `--section` |
| `.pl-cluster` | inline wrap | `--between`, `--baseline` |
| `.pl-split` | two related areas | `--editorial`, `--data` (collapses <900px) |
| `.pl-grid` | auto-fit grid | `--pl-grid-min` (per instance) |
| `.pl-rail-layout` | content + rail | `--left` |
| `.pl-bleed` | full-width break | — |
| `.pl-section` | vertical rhythm | `--tight` |

## Typography roles

`.pl-display`, `.pl-h1`, `.pl-h2`, `.pl-h3`, `.pl-body`, `.pl-compact`,
`.pl-small`, `.pl-label`, `.pl-mono`, plus colour helpers `.pl-text-secondary` /
`-muted` / `-faint` / `-inverse` and `.pl-numeric` / `.pl-tnum` for tabular
figures. Technical operators (≤ ≥ →) must be wrapped in `.pl-mathsym` so they
render from the mono/system stack.
