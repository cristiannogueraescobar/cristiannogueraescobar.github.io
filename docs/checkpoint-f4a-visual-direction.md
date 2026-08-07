# Checkpoint F4a — single visual direction and typography prototype

## 1. Objective

Create and validate ONE visual direction for Plumline — the "editorial decision
instrument" — and prove it with an isolated, responsive prototype, a definitive
typography spec (Newsreader + Manrope), a composition/component/motion spec,
reproducible visual evidence, and contracts that keep the prototype out of the
public build. F4a does NOT redesign the public site. No production page, the
Solver, the engine, the catalogue or the i18n is modified.

## 2. Initial state

Baseline is the integrated post-F3c tree provided as the single source of truth.
Confirmed before any change: `npm ci` then `npm run verify` → TOTAL PASSED 13387,
VERIFY ALL GREEN, VALIDATE HTML (. and dist) OK, VALIDATE DIST OK, DIST HTTP TESTS
OK, deterministic build. Recorded baseline hashes (sha-256, first 16):
index.html f55be895…, solver.html b373fa24…, examples.html d9c3909c…,
capabilities.html 4b372fd3…, guide.html d0c76e34…, about.html feb4a30f…,
assets/plumline.css 4c743aed…, assets/i18n.js b2835aea…,
assets/examples-data.js 651ba403…, dist/index.html 4ec4fe2f…,
dist/solver.html 36bfb88d…. Nine examples, five languages (en/es/pt/de/fr),
engine/mirror/Worker protected.

## 3. Audit of Plumline

Rendered pages were captured and reviewed, not just the HTML. Findings:
- A real, coherent design system already exists: cream ground, deep-green
  authority, brass accent, verification-green reserved for trust; a clamp() type
  scale; a 4–64px space scale; hairline borders.
- The main visual problem is repetition: an eyebrow + centred title + centred
  paragraph + three or four equal-weight cards, repeated down the page (the home
  shows nine eyebrows and many identical cards; the solver hero is a centred
  title + centred paragraph).
- Zero webfonts — everything is a system stack, which is the main cause of the
  "rudimentary" feel.
- Zero @keyframes — the page is static; the hero's four-step demo does not move.
- Examples cards all carry the same weight, with no featured/normal hierarchy,
  and the "open in solver" action reused the verification green (a colour meant
  for correctness, not actions).

## 4. References studied

Only principles were extracted; no layout, component, copy, image, animation,
icon or brand identity was copied.
- **Rows** — a template library categorised by real need, with frictionless entry
  ("Use template. No forms").
- **Quadratic** — the real product (sheets and data) as the visual protagonist,
  not generic illustration; "auditable answers you can trust".
- **Linear** — a surface ladder that carries hierarchy without shadow; aggressive
  negative tracking on display type; 12px cards with 1px hairline borders (never
  pill); product UI as the protagonist; no second chromatic colour, no
  atmospheric gradients.
- **Excel Solver / OpenSolver / SolverStudio / Frontline** — powerful but
  utilitarian, expert-facing Excel add-ins. Plumline differentiates by being
  browser-native, accountless, honest about what it verifies, and editorial in
  identity.

## 5. Principles extracted

Product as protagonist (Quadratic); hierarchy through recession, not competition
(Linear); categorise by real need and reduce entry friction (Rows); differentiate
on honesty and craft rather than raw capability (vs the OR add-ins). Each is
reinterpreted specifically for Plumline via the measurement language and the
verification receipt.

## 6. Chosen direction

**Editorial decision instrument.** Plumline should feel like a worksheet, a
precision instrument, a workbench, a technical document, an audit receipt and a
contemporary editorial tool at once. Not a generic SaaS template, not a purple/
blue AI site, not glassmorphism, not purposeless bento, not an icon landing, not
an old industrial tool, not a Linear/Rows/Quadratic clone, not stock/AI imagery.
The bold, memorable element is the measurement language (calibration ticks,
plumb-line thread) plus the verification receipt as the primary proof object —
that is where personality is spent; everything else stays quiet.

## 7. Why Newsreader

An original editorial serif from Production Type intended for on-screen reading in
content-rich contexts. It gives headings genuine narrative personality (the
opposite of a system serif) while remaining highly legible. Variable weight axis,
so a single file covers the display range. SIL OFL 1.1 (embedding and commercial
use permitted). Latin + latin-ext subsets cover the Latin text of en/es/pt/de/fr,
including accents. They do NOT cover the maths operators (≤ ≥) or the arrow (→) —
verified against the real cmaps — so those are assigned deliberately to the
monospace/system stack (see section 10), not to Newsreader. Used ONLY for H1/H2,
important editorial titles, pull quotes, and narrative numbers — never for buttons,
fields, dense tables, navigation, small text or solver controls.

## 8. Why Manrope

A modern, slightly geometric sans by Mikhail Sharanda that reads cleanly at UI
sizes and pairs with the serif without competing. Variable weight axis; tabular
figures for data. SIL OFL 1.1; latin + latin-ext subsets. Used for navigation,
body, buttons, labels, filters, forms, tables, cards, documentation, solver
controls and metadata.

## 9. Typographic hierarchy

Display (Newsreader) for the hero; H1/H2 (Newsreader) for section titles;
narrative figures (Newsreader) for the result number; body, labels and controls
(Manrope); formulas and data (existing monospace stack). No third webfont. Type
scale uses clamp() so it holds from 320px to desktop.

## 10. Colour system

Existing palette, refined via tokens. Cream is the dominant editorial ground.
Deep green keeps authority and contrast (nav, deep sections, receipt head). Brass
signals process, measurement, selection and orientation (eyebrows, ticks, tags,
primary button, plumb weight). Verification green signals ONLY correct/satisfied/
checked/optimal (receipt checks, the seal, the optimal tag, matrix ticks, trust
checks). A contract asserts the primary button is brass, not verification green,
so green is never spent on generic emphasis. An honest warn tone (amber) marks
"incomplete", not a red alarm.

Small-text tokens are tuned for WCAG AA (>= 4.5:1): brass text is `--brass-text`
`#7A5518` (>= 4.9:1 on paper, panel and the brass chip tint) and the incomplete
badge uses `--warn-text` `#8E5A14` (4.95:1 on `--warn-lo`). The suite computes the
real contrast ratio for every critical small-text pair, not just that a colour
exists.

Maths operators (≤ ≥) and the arrow (→) are not in the webfont subsets, so they
are assigned to the monospace/system stack via `.mathsym` and the
`.card__action::after` rule, never left to an accidental fallback.

## 11. Measurement system

The signature. A fine calibrated rule, small monospace tick numbers, alignment
lines, and a plumb-line thread (a thin vertical rule ending in a brass weight).
It frames content; it does not turn the page into a decorative blueprint. The
sequence steps are numbered 01–05 because the content genuinely is a sequence.

## 12. Surfaces

The prototype demonstrates: navigation; hero; product sequence; trust bar;
featured example card; secondary example cards; verification receipt; capabilities
matrix; solver toolbar; optimal state; incomplete state; CTA; footer; responsive
mobile.
- **Hero** keeps the concept and headline but shows problem → sheet →
  interpretation → answer → verification, not a dashboard screenshot in a box.
- **Example cards** allow hierarchy (featured vs normal, metadata, type,
  difficulty, action) and prepare for growth to ~60 examples.
- **Receipt** is the primary trust object: objective, decisions, constraints,
  status, verification foremost; secondary detail recedes.
- **Solver toolbar** shows grouping by function (structure/import/variables/
  history/view/solve) without implementing new behaviour.
- **States** show "optimal solution proven" and "search incomplete" with meaning,
  next action and evidence — not a single green or red card.

## 13. Composition

Asymmetric and content-driven: the hero is a two-column editorial split; the
sequence is one live panel, not four equal cards; the examples use a featured +
secondary grid; deep and light backgrounds alternate to create rest and rhythm.
No general bento grid, no auto-carousels, no sliders that hide information. Each
size responds to the content's importance.

## 14. Motion

Built in HTML/CSS/JS — no video, GIF, WebGL or externally generated animation. A
small sequence represents: spreadsheet model → model detected → result calculated
→ formulas checked → status reported, using the real production-plan data. It is
pausable, keyboard-operable and does not depend on hover. It has three distinct
states:

1. **No JS (static equivalent):** all five stages are visible and readable as
   static content, so the sequence is understandable without JavaScript.
2. **JS normal:** a single stage is shown at a time, with pausable autoplay.
3. **JS + prefers-reduced-motion:** a single stage is shown with NO autoplay;
   the user navigates stages manually (step buttons, dots, arrow keys).

Reduced-motion does not display all five stages simultaneously — it is the
single-stage interactive view with autoplay disabled. The sequence causes no CLS,
never moves focus, does not re-announce to screen readers, and does not run
off-screen (IntersectionObserver gate, respecting an explicit user pause). It is
labelled a DEMONSTRATION/preview and does not run the engine.

## 15. Responsive

Reviewed at 1440×1000, 1024×768, 390×844 and 320×720. The hero split collapses to
one column; the sequence stacks under the copy; the examples grid goes featured-
full-width then single column; the states stack; the nav collapses to the primary
CTA. Newsreader headlines, buttons, German words, metadata, the capabilities
table, the toolbar, the receipt, the sequence, navigation and footer all hold
down to 320px without artificial zoom.

## 16. Accessibility

Semantic HTML; exactly one H1; correct heading order; header/main/footer/nav
landmarks with accessible names; keyboard operation of the sequence; visible focus
ring; WCAG-AA contrast on the palette; touch targets; content readable without
motion; prefers-reduced-motion honoured; a drag-free alternative (no drag is
required anywhere); states not conveyed by colour alone (each has a name, a mark
and text); every control named (text or aria-label); no aria-hidden on
informative content; no tiny text as essential content.

## 17. Performance

Two webfonts (Newsreader, Manrope), variable weight, latin + latin-ext subsets:
newsreader-latin 58KB + latin-ext 36KB, manrope-latin 25KB + latin-ext 15KB
(~134KB total for four woff2 files), served locally. No images (the UI is the
visual), one small CSS file, one small JS file. Subsetting is already applied via
unicode-range; F4b can preload the latin subset and add fallback metrics. FOIT
risk is mitigated by font-display: swap. No CLS from the sequence (stages occupy
reserved space). Nothing here affects production performance — the prototype is
not published.

## 18. Files added and modified

Added:
- design-review/f4a/index.html
- design-review/f4a/prototype.css
- design-review/f4a/sequence.js
- design-review/f4a/README.md
- design-review/f4a/fonts/newsreader-latin-wght-normal.woff2
- design-review/f4a/fonts/newsreader-latin-ext-wght-normal.woff2
- design-review/f4a/fonts/manrope-latin-wght-normal.woff2
- design-review/f4a/fonts/manrope-latin-ext-wght-normal.woff2
- design-review/f4a/fonts/Newsreader-OFL.txt
- design-review/f4a/fonts/Manrope-OFL.txt
- engine/tests_f4a_visual_direction.js
- engine/tests_f4a_visual_direction_negative.js
- docs/checkpoint-f4a-visual-direction.md

Modified:
- engine/suites.js (registers both F4a suites)

Deleted: none.

## 19. Protected production

index.html, solver.html, examples.html, capabilities.html, guide.html, about.html,
privacy.html, terms.html, assets/plumline.css, assets/i18n.js,
assets/examples-data.js, assets/product-capabilities.js, the public nav/footer,
engine, mirror, Worker, catalogue, existing examples and production generators are
byte-identical to the baseline. Verified by re-checking the 12 protected file
hashes after the checkpoint (all match) and by the deterministic build producing
the baseline dist hashes (index 4ec4fe2f…, solver 36bfb88d…).

## 20. Tests

engine/tests_f4a_visual_direction.js (120 assertions): prototype files exist;
excluded from the public build (Vite PAGES list does not include it); not present
in dist (dist-presence-stable count); does not link to production pages; no
video/GIF/WebGL/canvas-animation; no remote images or stock; fonts local-only with
OFL documented and only Newsreader + Manrope as webfonts (no third), font-display
set; maths operators and the arrow assigned to the mono stack via .mathsym (glyph
honesty), README does not claim webfont coverage of ≤ ≥ →; reduced-motion in CSS
and JS; pausable autoplay with an off-screen gate that respects an explicit user
pause; real static equivalent (no stage carries `hidden` in the initial HTML, the
single-stage view is gated behind .seq--enhanced); single H1, landmarks, full
heading order H1–H6 with no skipped level and no H4–H6 misused as footer labels;
every control named; local references resolve; no href="#" and every href="#id"
resolves to exactly one id; real copy and the real production-plan data with the
honest "it can prove" qualifier, no "most tools" competitor swipe, no invented
commercial claims, no promise of an unavailable "step limit" control; states carry
meaning/next/evidence; colour discipline; real WCAG-AA contrast (>= 4.5:1) computed
for every critical small-text pair; a >= 24px touch target for the sequence dots; no
role="tablist" and no operable role="toolbar" on non-interactive previews;
aria-current="step" for the active stage; no empty aria-live region.

## 21. Negative mutations

engine/tests_f4a_visual_direction_negative.js (92 assertions, 20 reproducible
mutations): prototype leaked into dist; a video element added; a remote font src;
a third webfont family; reduced-motion removed; autoplay without a pause control;
a missing asset; two H1 elements; an invented "trusted by" claim; a remote image;
the primary button turned verification green; a stage marked `hidden` in the static
HTML; a broken fragment link; a placeholder href="#"; the incomplete-badge contrast
broken; the sequence-dot touch target removed; a fake ARIA tablist reintroduced; an
operable role="toolbar" reintroduced; a "most tools" competitor swipe reintroduced;
and a footer label turned into an H4 (heading skip). Each mutation runs the F4a
suite against an isolated temp copy (fs.cpSync into an mkdtemp path with a space,
run via process.execPath, cleaned in finally) and passes only when the file
changed, the suite exited non-zero, the specific expected contract appears in the
output, and there is no SyntaxError/MODULE_NOT_FOUND/infra error. A clean control
passes.

## 21b. External-review corrections applied

This checkpoint was re-issued after an external review approved the visual
direction but found implementation defects. The direction, Newsreader + Manrope,
the palette, the "editorial decision instrument" concept, the hierarchy and the
approved components are unchanged. Corrected: mobile responsive of the receipt
(structural .receipt-split, single column on 390/320, copy first) and the
capabilities matrix (accessible horizontal scroll wrapper); screenshot manifests
now separate viewport from real PNG (IHDR) dimensions and record
scroll/client width; real no-JS static equivalent; sequence semantics
(aria-current="step", no fake tablist, no empty aria-live, explicit pause
respected); sequence-dot touch target >= 24px; internal fragment links all resolve
(no href="#"); toolbar preview is a figure, not an operable toolbar; WCAG-AA token
fixes for the incomplete badge and brass chip with a real contrast computation in
the suite; honest glyph coverage (mono for ≤ ≥ →); honest copy ("it can prove", no
competitor swipe, no unavailable "step limit"); footer labels are not headings; and
the heading contract now checks H1–H6.

## 22. Limitations

- The prototype is a single design-review page, not a production page; it
  demonstrates the system, it does not ship it.
- Fonts are referenced only inside the prototype; preparing the self-hosting
  infrastructure and fallback metrics is F4b, and applying them to the public
  pages happens later (Home in F9, the rest in F10).
- The sequence is a scripted demonstration of the production-plan flow; it does
  not run the engine.
- This environment is Linux; the suites are Windows-portable (Node APIs only, run
  from a path with spaces) but the final Windows Node 24.15.0 run is to be done
  locally.
- No real git in this environment; the overlay applies onto the integrated
  post-F3c tree, validated on a clean copy.

## 23. Expressly deferred to F4b (tokens and components)

F4b builds and hardens the reusable system: design tokens, typography, layout
primitives, components, page primitives, utilities and accessibility primitives.
It also prepares the correct infrastructure for self-hosting Newsreader + Manrope
and their fallback metrics. F4b is NOT the narrative redesign of the Home — the
full Home reconstruction belongs to F9. No production HTML/CSS/i18n is redesigned
in F4a itself.

## 24. Expressly deferred to F4c (motion system)

F4c builds the reusable motion system: transitions, reveals where they carry
meaning, state transitions, product-sequence primitives, pause/resume, the
IntersectionObserver policy, the reduced-motion policy, accessibility, motion
performance, and lifecycle/cleanup. F4c is NOT the rollout of the new design across
Solver, Examples, Capabilities, Guide and About — redesigning those pages belongs
to F10.

## 24b. Roadmap ownership (canonical)

F4a produces the single visual direction. Its system is reused later by F4b
(tokens and components), F4c (motion system), F6 (new examples library), F8 (grid
customisation and UX), F9 (Home narrative redesign) and F10 (redesign of the rest
of the site). F4a does not take on the scope of any of those checkpoints.

## 25. Rollback

Delete design-review/f4a/ (the whole prototype, fonts and licenses),
engine/tests_f4a_visual_direction.js, engine/tests_f4a_visual_direction_negative.js
and docs/checkpoint-f4a-visual-direction.md; in engine/suites.js remove both F4a
entries from the registration list. That restores the integrated post-F3c state at
13387. There are no production content changes and no deletions of existing files
to undo.
