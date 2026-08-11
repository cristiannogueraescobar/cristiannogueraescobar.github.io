# Design review — F6 Examples library UI

## Before (post-F5, pre-F6)

The Examples page was a flat list of nine models: a title link and a one-line description
each, in reading order, with no way to search, filter, or compare. Model metadata
(type, goal, difficulty, size) was not surfaced. As the library grows toward 60 (F7) the
flat list stops scaling — there is no way to narrow by the decision you are trying to make.
See `before/examples-post-f5-before.png` (a representative reconstruction of that page,
using the real F4 palette).

## After — structure

The page reads top to bottom as: a `lib-head` intro block (eyebrow, H1, lead, model
count) inside `<main>`; a controls strip (search input + a `<details>` filter disclosure
with four facet fieldsets) that is hidden until JS enhances the page; an ARIA-live result
count with a clear-all button; the nine model cards in a responsive grid; an empty state;
and a short “How an example works” three-step explainer.

The shell `<header>`/nav/footer are the shared components, untouched. There is exactly one
`<header>` (the shell), one `<main>`, one `<h1>` (inside `<main>`). Two visually-hidden
`<h2>`s give screen-reader structure to the library section and the results list.

## Hierarchy

- **Primary — search.** A single text field folds diacritics and matches across title,
  description, question, category and capabilities. Search is the fastest path to a model.
- **Secondary — categories.** Ten canonical categories; the six populated ones carry live
  counts. Categories group by the *decision* a model answers, not by mathematical type.
- **Tertiary — technical facets.** Model type, difficulty, goal — for users who already
  think in those terms. Same-facet options OR together; different facets AND together.

## Card anatomy

Each card is an `<article class="lib-card">` carrying `data-ex-id` and the facet data
attributes used by the client filter. Inside: a reference number and category chip; the
model title as a solver deep-link (`solver.html?ex=<slug>`); the one-line question;
a definition list (model type / goal / difficulty); a fact row (decisions · limits ·
minutes, with correct singular/plural); and an “Open in solver” CTA. Titles and CTA use
`--brass-text`, metadata `--faint`, fact values `--ink` — all AA on the white card and the
cream page ground (verified by the real contrast checker).

## Controls

Search and filters live in the `lib-controls lib-enh` block: `display:none` by default,
shown only when the runtime adds the `js-lib` class to the page. The filter set is a
native `<details>`/`<summary>` disclosure, so it works with keyboard and needs no custom
widget. Facets are native checkboxes inside `<fieldset>`/`<legend>` groups. The result
count is `aria-live="polite" role="status"`, so screen-reader users hear the count update
as they type or filter. Clear-all and per-empty-state clear-filters reset the view.

## Mobile

The grid is `repeat(auto-fill, minmax(...))` collapsing to a single column at 640px, so
cards never crowd. At 390px and 320px there is no horizontal overflow (validator:
`overflowX = no` on every mobile shot). Controls stack; the filter disclosure keeps the
long facet list off-screen until opened. Touch targets (search, summary, checkboxes, CTA)
meet the 44px minimum.

## Scaling to 60

Nothing in the UI or the client logic is tied to nine. Cards are rendered from the F5
library projection; the filter/search/count code iterates whatever records exist and
preserves canonical order. Category counts are derived, not hard-coded. Adding records in
F7 changes only the data payload (`examples-library.js`) and `examples.html`’s card list —
never the five files pinned by the F6 protected baseline. The 60-record fixture in the F6
suites exercises this.

## Accessibility

- One `<h1>` in `<main>`; visually-hidden `<h2>`s for section/list structure.
- Real `<label for>` on the search input; `<fieldset>`/`<legend>` for each facet group.
- `aria-live` result count; empty state is `role="status"`.
- No nested interactive elements; every card link is a plain anchor.
- Focus-visible styles inherited from the shared sheet; reduced-motion honoured
  (transitions disabled under `prefers-reduced-motion`).
- Usable with no JavaScript: the nine cards and their links are in the base HTML.

## Screenshot index

- `before/examples-post-f5-before.png` — the pre-F6 flat list (representative).
- `after/desktop-1440-initial.png` · `-category-filtered` (2/9) · `-search` (1/9) ·
  `-no-results` (0/9) · `-reduced-motion`.
- `after/tablet-768-initial.png`.
- `after/mobile-390-initial.png` · `-filters-open` · `-filtered` (2/9).
- `after/mobile-320-initial.png` · `-no-results`.
- `after/mobile-390-no-js.png` — 9/9 cards with JS disabled.
- `languages/desktop-1440-lang-es|de|fr|pt.png` — `<html lang>` = locale, no English fallback.
- `unchanged/home-1440.png` · `solver-1440.png` · `guide-1440.png` — reference pages, 0 console errors.

## Ten visual-review questions

1. Does search feel like the primary action, with categories and facets clearly secondary?
2. Is the card hierarchy (title → question → metadata → facts → CTA) legible at a glance?
3. Are category chips and counts helpful, or noise?
4. Do the four facet groups read as independent filters (OR within, AND across)?
5. Is the empty state clear and recoverable (clear-filters visible)?
6. At 320/390px, do cards and controls stay comfortable with no overflow?
7. Are the AA colours (brass-text titles, faint metadata) legible on cream and white?
8. Does the no-JS page look intentional rather than broken?
9. Do the five languages hold layout without truncation or overflow?
10. Does the page still feel like the same product as Home/Solver/Guide (shared shell,
    palette, type)?
