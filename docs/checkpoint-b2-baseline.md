# Checkpoint B2 — shared behavior baseline

This document captures the REAL state of the site's JavaScript behavior before any
B2 change, measured against the working tree (base SHA: pending user verification;
the assistant works from a snapshot and cannot fetch origin/main). Node used for
this baseline: v22.22.2 (the repo pins `>=24.15.0 <25`; 24.15.0 was not available
in this environment). `npm run verify`: ALL GREEN. Baseline test total: 7000.

## Headline finding

**The shared shell behavior is already centralized in external modules.** There is
no inline duplication of the mobile-menu, language-selector, or build-badge logic
across the eight pages to extract. B1 centralized the shell *markup* at build time;
the shell *behavior* was already in shared modules before B2. This changes what B2
can honestly do (see "Scope implication" at the end).

## JavaScript loaded per page (real data)

Every page loads scripts by `<script src>`; loading attributes shown in brackets.

| Page | Scripts (in order) |
| --- | --- |
| index.html | i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking] |
| solver.html | examples-data.js [blocking], i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking] |
| guide.html | i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking] |
| examples.html | examples-data.js [blocking], i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking] |
| capabilities.html | i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking], cap-lightbox.js [defer] |
| about.html | i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking] |
| privacy.html | i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking] |
| terms.html | i18n.js [blocking], nav-menu.js [defer], build-badge.js [blocking] |

Shared by all 8: `i18n.js`, `nav-menu.js`, `build-badge.js`.
Page-specific: `examples-data.js` (solver + examples — shared example metadata),
`cap-lightbox.js` (capabilities only).

## Inline `<script>` blocks per page (real data)

Each page has exactly ONE inline JS block (excluding `application/ld+json`).

| Page | Inline block content |
| --- | --- |
| index.html | `var LANG = Plumline.i18n.init('home', ['capabilities']);` |
| guide.html | `Plumline.i18n.init('guide');` |
| capabilities.html | `Plumline.i18n.init('capabilities');` |
| about.html | `Plumline.i18n.init('about');` |
| privacy.html | `Plumline.i18n.init('legal');` |
| terms.html | `Plumline.i18n.init('legal');` |
| examples.html | catalog rendering (page-specific) + `Plumline.i18n.init('examples')` |
| solver.html | the inline engine + the whole grid/solver app (page-specific) |

The six informational pages' inline block is a SINGLE line: the per-page i18n
namespace init. There is no duplicated mobile-menu, language-selector, or
build-badge code inline anywhere — it is a namespace argument, not shared logic.

## Shared behavior — where it already lives

### Mobile menu — `assets/nav-menu.js` (216 lines, 10624 bytes)
Self-initializing IIFE (`ready()` on DOMContentLoaded). Builds the drawer once by
cloning every direct anchor of the Primary nav, so the drawer link set equals the
Primary link set and cannot drift. Provides: open/close, backdrop, Escape, the
drawer's `hidden` attribute and the toggle's `aria-expanded`, scroll lock
(`document.body.style.overflow`), focus move-in and restore, a Tab/Shift+Tab focus
trap inside the panel, `inert` on background elements (saved/restored), a
same-document `#hash` link closing and moving focus to the target, and a
`matchMedia` resize/breakpoint cleanup. No
accidental globals. Idempotent guard: builds the drawer only if `#mobile-menu`
doesn't already exist.

### Language selector — `assets/i18n.js` (logic ~lines 3023-3123)
Self-contained under the `Plumline.i18n` namespace. `pick()` resolves the initial
language: URL `?lang=xx` first, then `localStorage['plumline_lang']`, then
`navigator.language` (2 chars), then English; unknown codes fall back to English.
`saved()`/`remember()` wrap localStorage in try/catch (safe when it throws).
`lookupTranslation()` is the ONE resolution used by both the DOM applier and the
public `t()` API — order: `common` → page namespace → extra authorized namespaces,
each tried in the active language then English. `apply()` updates `[data-i18n]`
(innerHTML), `[data-i18n-aria]` (aria-label), `[data-i18n-alt]` (alt), and
`document.documentElement.lang`. `init(page, extra)` applies once, wires the
`<select id="lang">` change handler (apply + remember + preserve other query params
and hash via `history.replaceState`), and returns the active language. The only
global it defines is `Plumline`.

### Build badge — `assets/build-badge.js` (30 lines, 1552 bytes)
Self-initializing IIFE. `run()` returns early if `#buildBadge` is absent; otherwise
`fetch('build-info.json', {cache:'no-store'})`, shows nothing on a non-ok response,
missing/DEV-LOCAL commit, or any error (silent catch). Formats `build <sha7> ·
<date> · <n> tests` and a `title`. Non-blocking; a failure cannot break the page.
Present in every page footer (the `#buildBadge` span is part of the shared footer
fragment from B1), so the badge already runs on all 8 pages — B2 must not change
which pages carry it.

## Behavior classification

### A — shared, already centralized (no inline duplication to extract)
- mobile menu open/close, Escape, backdrop, focus restore, aria-expanded/hidden,
  scroll lock, focus trap → `nav-menu.js`
- language selection, persistence (`plumline_lang`), fallback, namespace
  resolution, data-i18n/aria/alt application, `<select id="lang">` wiring →
  `i18n.js`
- build badge fetch + render + error handling → `build-badge.js`

### B — page-specific, MUST NOT move into shared (B2 scope forbids it)
- the inline solver engine, grid, Variable Settings, paste/undo, results, charts,
  exports, feasible-region geometry, self-test → `solver.html`
- the solver's examples drawer and its `?ex=` handling → `solver.html`
- the examples catalog rendering → `examples.html`
- the capabilities lightbox → `cap-lightbox.js`
- shared EXAMPLE METADATA (`examples-data.js`) is shared DATA, not behavior, and is
  already a shared file; it is not shell behavior and stays as-is.

### Legitimate per-page differences
- solver loads `examples-data.js` (its drawer needs the metadata); examples loads
  it too; the other six do not.
- capabilities loads `cap-lightbox.js`; no other page does.
- index's i18n init passes an extra `['capabilities']` namespace; others pass only
  their own page namespace. This is authorized namespace reuse, not a bug.
- solver's inline block is the engine+app; the six informational pages' inline
  block is a single i18n init line; examples' is catalog rendering + init.

## Initialization order and dependencies (real)
1. `i18n.js` (blocking) defines `Plumline.i18n` before any inline init runs.
2. `nav-menu.js` (defer) self-initializes the drawer on DOMContentLoaded.
3. `build-badge.js` (blocking) self-initializes the badge (DOM-ready aware).
4. the page's inline block calls `Plumline.i18n.init('<namespace>')`.

`nav-menu.js` reads translations through `Plumline.i18n` when present and falls
back to literals when not, so its `defer` ordering after the blocking `i18n.js` is
not load-bearing for correctness. No script writes an accidental global; the only
shared global is `Plumline`.

## Globals defined (real)
- `Plumline` (namespace, from `i18n.js`; extended by the solver's test hook
  `window.__plumline` only under `window.__PLUMLINE_TEST__`).
- No other page defines a new global for shell behavior. `nav-menu.js` and
  `build-badge.js` define none.

## Progressive enhancement (already true today)
Before JS runs, B1 composes the full header/nav/footer/main into the served HTML,
the links work, and the `<select id="lang">` is present with a visible default.
If JS fails: content stays, navigation works, footer stays, no overlay blocks the
page, scroll is not locked (the drawer starts `hidden`), and the solver still fails
in its current controlled way.

## Scope implication for B2 (to confirm with the operator)
Because the three shared behaviors are ALREADY centralized with no inline
duplication, the "extract duplicated behavior" work item is effectively already
done. Reworking the proven IIFE modules into `src/shared/behavior/` ES modules
would be a pure re-organization that risks the one thing B2 must not touch —
observable behavior — for no maintainability gain, and would flirt with the pliego's
own bans ("no crear módulos de una sola línea sin valor", "no construir un framework
interno", "no abstraigas lógica utilizada una sola vez"). The honest, low-risk B2
therefore focuses on what is genuinely missing:
- a small, documented shared shell-initialization entry point that WRAPS the
  existing modules without rewriting their tested logic;
- contract/isolation/idempotency TESTS that don't exist yet (double-init doesn't
  duplicate listeners; optional elements absent don't throw; the shell never
  imports the engine/Worker; no fetch of fragments; no innerHTML shell rebuild;
  informational pages never load the engine/Worker);
- documentation of what is shared, what stays page-specific, and how to add new
  shared behavior safely.
This is recorded here so the reviewer can see the baseline drove the scope, not the
other way around.
