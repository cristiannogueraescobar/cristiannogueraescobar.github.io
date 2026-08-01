# Checkpoint B2 — shared shell behavior

Where B1 centralized the shell *markup* at build time, this document describes the
shell *behavior*: the JavaScript already shared across all eight pages. B2 did NOT
rewrite or move these modules — the audit (see `checkpoint-b2-baseline.md`) found
the behavior was already centralized with no inline duplication. B2 formalized it
with contract, isolation, and negative tests, and made three minimal idempotency
fixes that a test proved were needed. This document is the reference for what is
shared, how it initializes, and how to extend it safely.

## Modules and what they implement

| Behavior | Module | Consumers (real) |
| --- | --- | --- |
| Mobile menu (drawer) | `assets/nav-menu.js` | all 8 pages |
| Language selector + i18n | `assets/i18n.js` | all 8 pages |
| Build badge | `assets/build-badge.js` | all 8 pages (footer) |
| Shell init | inline `Plumline.i18n.init('<ns>')` per page + the two self-initializing IIFEs above | all 8 pages |

There is no separate `init-shell.js`: the shared behavior self-initializes. Each
module is a self-contained IIFE that wires itself on DOM-ready, and each page's
one-line inline block calls `Plumline.i18n.init` with its namespace. Adding an
`init-shell.js` wrapper was considered and rejected in B2 — it would be a
single-purpose indirection over three modules that already initialize correctly,
which the pliego explicitly discourages.

## API per module

### `assets/nav-menu.js`
- Public API: none (self-initializing IIFE). No exported functions, no global.
- Init: `ready(fn)` runs `fn` immediately if the document is already parsed, else
  on `DOMContentLoaded`.
- Behavior: builds `#mobile-menu` once by cloning every direct anchor of the
  Primary nav; wires the toggle (open/close), backdrop (close), close button,
  Escape, a Tab/Shift+Tab focus trap, `inert` on background elements
  (saved/restored), scroll lock via `document.body.style.overflow`, focus move-in
  and restore, same-document `#hash` handling, and a `matchMedia('(min-width:
  821px)')` cleanup that closes the drawer if the viewport grows past the mobile
  breakpoint. Adds the `nav-menu-ready` class to `<html>` only after wiring
  completes (the CSS collapses the nav into the drawer only when this class is
  present, so a load failure leaves the links visible).
- Optional elements: returns early if `.menu-toggle` or the Primary nav is absent;
  the close button is wired only if present.
- Globals: none.
- Idempotency: the drawer is built once (`if (!drawer)`); a `data-nav-menu-init`
  attribute guard (added in B2) makes a second evaluation a safe no-op so no
  duplicate listeners are attached. The attribute is runtime-only (never in source
  HTML or dist).

### `assets/i18n.js` (language selector portion)
- Public API: `Plumline.i18n = { dict, t(lang, page, key, extra), init(page, extra) }`.
  - `t()` resolves a key and returns the key itself if unresolved (never throws).
  - `init(page, extra)` applies translations once, wires `<select id="lang">`, and
    returns the active language.
- Resolution order (`lookupTranslation`, used by BOTH `apply()` and `t()`):
  `common` → page namespace → extra authorized namespaces, each tried in the
  active language then English. This is the single source of truth, so the DOM
  applier and the public `t()` can never disagree.
- Initial language (`pick()`): URL `?lang=xx` → `localStorage['plumline_lang']` →
  `navigator.language` (2 chars) → English; an unknown code falls back to English.
- Persistence: `saved()` / `remember()` wrap localStorage in try/catch, so a
  throwing or absent storage never breaks init or a language change.
- Applies: `[data-i18n]` (innerHTML), `[data-i18n-aria]` (aria-label),
  `[data-i18n-alt]` (alt), and `document.documentElement.lang`.
- Optional elements: if `<select id="lang">` is absent, init still applies
  translations and returns the language (no throw).
- Globals: `Plumline` only.
- Idempotency: a `data-lang-init` attribute guard (added in B2) ensures the change
  listener is attached only once; `apply()` itself is safe to repeat. Runtime-only
  attribute.

### `assets/build-badge.js`
- Public API: none (self-initializing IIFE). No global.
- Init: runs on `DOMContentLoaded` (or immediately if already parsed).
- Behavior: returns early if `#buildBadge` is absent (no fetch). Otherwise
  `fetch('build-info.json', {cache:'no-store'})`; shows nothing on a non-ok
  response, a missing or `DEV-LOCAL` commit, invalid JSON, or any error (silent
  catch). Formats `build <sha7> · <date> · <n> tests` and a `title` with the full
  commit. Non-blocking: the fetch is asynchronous, so it never delays first paint,
  and a failure cannot break the page or the solver.
- Optional elements: no `#buildBadge` → no fetch, no throw.
- Globals: none.
- Idempotency: a `data-build-badge-init` attribute guard (added in B2), set on
  `#buildBadge` after the element check and before the fetch, makes a double
  evaluation issue exactly ONE fetch. Runtime-only attribute; it does not change
  content, style, endpoint, cache policy, or error handling.

## Initialization order and dependencies
1. `i18n.js` (blocking) defines `Plumline.i18n` before any inline init runs.
2. `nav-menu.js` (defer) self-initializes the drawer on `DOMContentLoaded`.
3. `build-badge.js` (blocking) self-initializes the badge.
4. the page's inline block calls `Plumline.i18n.init('<namespace>')`.

`nav-menu.js` reads translations through `Plumline.i18n` when present and falls
back to literals otherwise, so its ordering relative to `i18n.js` is not
load-bearing for correctness.

## Error handling and the optional-element contract
Every shared module treats its target elements as optional: a missing toggle,
select, or badge element makes the module a safe no-op rather than a thrown error.
localStorage is treated as unreliable (try/catch on both read and write). The build
badge swallows every fetch/parse failure silently. None of these failures blocks
the rest of the shell or the solver.

## Isolation from the engine and Worker
The inline engine (`ENGINE_START..ENGINE_END`) and the Worker/solve code live ONLY
in `solver.html`. The seven other pages contain none of it. The shared behavior
modules contain no engine/Worker/solver code, never create a Worker, never fetch an
HTML fragment (build-badge fetches only `build-info.json`, which is JSON), and
never rebuild the shell via innerHTML. `tests_shell_isolation.js` enforces all of
this; `tests_shared_behavior_negative.js` proves the guards bite by mutating copies
and confirming detection.

## What changed in the eight HTML pages (honest metrics)
B2 v3 changes the eight pages in exactly one way: the cache-busting query version
on the three shared-asset URLs. Concretely:
- visible content: identical;
- functional DOM: identical except the three versioned asset URLs
  (`i18n.js?v=81→82`, `nav-menu.js?v=5→6`, `build-badge.js?v=1→2`);
- intended visual differences: none;
- three query parameters changed for explicit cache invalidation after deploy;
- production assets modified: three (`i18n.js`, `nav-menu.js`, `build-badge.js`);
- requests per page: the same number (same scripts, new query strings);
- payload: the same files, updated;
- engine and Worker: intact (82657 chars / SHA 5d68ed17…, Worker parity green);
- metadata, JSON-LD, shell structure, CSS, and public page URLs: unchanged.

The pages are therefore NOT byte-for-byte identical to B1 anymore — the only
difference is those three version strings, which exist precisely so a browser or
CDN cannot serve the pre-B2 asset bodies after deploy. `engine/templates/
capabilities.template.html` carries the same new versions so `gen_capabilities.js`
regenerates `capabilities.html` in sync.

## How to add a new shared behavior
1. Confirm it is genuinely shared by two or more pages and is shell behavior (not
   page-specific logic).
2. Add a self-contained IIFE under `assets/` that: reads its target elements as
   optional (no throw if absent), attaches no accidental global, is idempotent
   (guard against double-wiring), and does not touch the engine/Worker.
3. Reference it with a `<script src>` in exactly the pages that need it, matching
   the existing blocking/defer convention.
4. Add contract tests (jsdom) and an isolation assertion, plus a negative test that
   mutates and proves the guard bites.

## What must NOT go into shared
- solver-only logic: grid, Variable Settings, paste/undo, results, charts,
  exports, feasible-region geometry, the examples drawer, `?ex=` handling;
- the engine or Worker;
- page-specific rendering (examples catalog, capabilities lightbox);
- any framework, SPA machinery, or CSS framework;
- an abstraction used by only one page.

## How to test it
`node engine/run_all.js` runs the whole battery. The B2 suites are:
- `tests_build_badge.js` — build badge executed in jsdom with a mocked fetch;
- `tests_shared_behavior.js` — mobile menu + language selector contracts and
  idempotency;
- `tests_shell_isolation.js` — engine/Worker isolation and shared-script loading;
- `tests_shared_behavior_negative.js` — real mutations proving the guards bite.
The pre-existing `tests_nav_menu.js` and `tests_home_i18n.js` cover the drawer and
the home i18n wiring in depth and remain the primary behavioral suites.

## How to revert B2 without reverting B1
B2 changed only: `assets/nav-menu.js`, `assets/i18n.js`, and `assets/build-badge.js`
(each gained one idempotency guard), the four new test files above,
`engine/suites.js` (registering them), and docs. To revert B2 while keeping B1:
1. Remove the `data-nav-menu-init` guard block in `assets/nav-menu.js`, the
   `data-lang-init` guard block in `assets/i18n.js`, and the `data-build-badge-init`
   guard block in `assets/build-badge.js` (restoring the original wiring).
2. Delete the four `engine/tests_*` files listed above and remove their names from
   `engine/suites.js`. Note that `tests_shell_isolation.js` exports the shared
   `checkShellIsolation()` checker used by the negative suite, so remove both
   together.
3. Delete the B2 docs.
B1's shell composition, fragments, PAGE_CONTEXT, golden fixtures, and the engine
are untouched by B2 and need no change.
