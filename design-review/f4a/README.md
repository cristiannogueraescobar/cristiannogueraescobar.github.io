# F4a — Visual direction prototype (isolated, NOT published)

This directory holds the **F4a** single visual-direction prototype for Plumline.
It is a design-review artifact only. It is **excluded from the public build**:
the Vite config emits a fixed list of 8 pages (`index, solver, guide, examples,
capabilities, about, privacy, terms`), copies the `assets/` tree and a fixed
`ROOT_PUBLIC` list — `design-review/` is none of those, so nothing here reaches
`dist/`.

## Contents

- `index.html` — the single self-contained prototype page (all 13 surfaces +
  responsive mobile). Uses real Plumline copy and the real `production-plan`
  example. No production file is modified.
- `prototype.css` — the F4a visual system (tokens, typography, measurement
  language, components, motion). Self-contained; does not import
  `assets/plumline.css`.
- `sequence.js` — the pausable, keyboard-operable product sequence
  (spreadsheet → detected → result → checked → status). It has three states:
  (1) **without JS** the five stages are all visible as static content (real
  no-JS equivalent); (2) **JS normal** shows a single stage at a time with
  pausable autoplay; (3) **JS + prefers-reduced-motion** shows a single stage
  with no autoplay and manual stage navigation. Reduced-motion does NOT show all
  five stages at once.
- `fonts/` — Newsreader and Manrope (variable, latin + latin-ext subsets),
  self-hosted **inside the prototype only**, plus their SIL OFL 1.1 licenses.

## Fonts and licenses

- **Newsreader** — Production Type. SIL Open Font License 1.1 (`Newsreader-OFL.txt`).
  Variable weight axis, latin + latin-ext subsets. Editorial headings only.
- **Manrope** — Mikhail Sharanda. SIL Open Font License 1.1 (`Manrope-OFL.txt`).
  Variable weight axis, latin + latin-ext subsets. UI and body.
- Monospace stays the existing system stack (no third webfont).

### Glyph coverage (verified against the real cmaps)

Newsreader and Manrope (these latin + latin-ext subsets) cover the Latin text of
en/es/pt/de/fr, including accents and diacritics. They do **not** contain the
maths operators `≤` `≥` or the arrow `→` (they do contain `=` and `×`). Those
symbols are therefore assigned deliberately to the monospace/system stack via the
`.mathsym` class and the `.card__action::after` rule — never left to an accidental
fallback. Do not claim these webfonts cover `≤ ≥ →`.

OFL 1.1 permits embedding and commercial use, so these can be self-hosted in F4b.
In F4a they are referenced **only** from this prototype, never from production,
and never over the network.

## What this prototype is NOT

It is not a final production page. It demonstrates the visual system that later
checkpoints reuse: F4b (tokens and components), F4c (motion system), F6 (new
examples library), F8 (grid customisation), F9 (Home narrative redesign) and F10
(redesign of the rest of the site). F4b builds the reusable token/component system
and prepares self-hosting for the fonts; it is not the Home redesign (that is F9).
F4c builds the reusable motion system; it does not roll the design out across the
public pages (that is F10).
