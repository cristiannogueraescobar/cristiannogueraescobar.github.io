# Checkpoint B — shared-shell baseline

Audit captured BEFORE any extraction, on branch `refactor/shared-components`
(cut from the current `origin/main`). Records real duplication and sizes so the
refactor can be proven to preserve the product exactly. No production file is
modified by this document.

> Base green check: `npm run verify` on the audited tree = `VERIFY: ALL GREEN`,
> `TOTAL PASSED: 6742`, `dist` = 37 files. (The exact base SHA must be recorded by
> the operator from `git rev-parse origin/main` — the assistant cannot fetch it.)

## Page sizes (source)

| Page | bytes | lines |
| --- | --- | --- |
| index.html | 27362 | 330 |
| solver.html | 218349 | 4607 |
| guide.html | 17957 | 193 |
| examples.html | 11417 | 167 |
| capabilities.html | 18624 | 237 |
| about.html | 7683 | 102 |
| privacy.html | 8976 | 106 |
| terms.html | 7381 | 100 |

`solver.html` is dominated by the inline engine (`/* ENGINE_START */ … /* ENGINE_END */`),
which is OUT OF SCOPE and must stay byte-for-byte identical.

## Duplication counts (the shared shell)

Every one of the 8 pages carries its own copy of the shell:

| Shell element | copies | notes |
| --- | --- | --- |
| `<header class="mast">` | 8 | logo lockup + primary nav + menu-toggle + language select |
| `<footer class="foot">` | 8 | footer copy + `#buildBadge` span |
| `.menu-toggle` (mobile control) | 8 | opens the JS-built drawer |
| `<select class="lang" id="lang">` | 8 | EN/ES/PT/DE/FR options |
| `#buildBadge` | 8 | build-badge target span |
| `<script src="assets/build-badge.js">` | 8 | build badge loader |

The header shell is **byte-identical across pages except for two legitimate
per-page differences**:

1. `aria-current="page"` on the active nav link (see the active-nav map below).
2. `solver.html` differs only in whitespace/formatting of `.header-actions` and
   uses `</div></header>` on one line; its shell CONTENT (logo, the same 5 nav
   links in the same order, the same select) is otherwise the same.

The footer is byte-identical across the informational pages checked
(about == privacy == guide).

Approx. duplicated shell markup: header (~24 lines) + footer (~11 lines) ≈ 35
lines × 8 pages ≈ **280 lines of repeated shell markup** (excluding the per-page
`aria-current`).

## Active navigation map (must be preserved exactly)

| Page | active nav (`aria-current="page"`) |
| --- | --- |
| index.html | none (home; logo only) |
| solver.html | `solver.html` |
| guide.html | `guide.html` |
| examples.html | `examples.html` |
| capabilities.html | none |
| about.html | `about.html` |
| privacy.html | none |
| terms.html | none |

So the fragment's page context must set exactly zero-or-one `aria-current="page"`.
Pages index/capabilities/privacy/terms have NO active nav link — that is correct
and must be reproduced (not "fixed").

Primary nav link set and order (identical everywhere):
`solver.html`, `index.html#addon` (Add-on), `guide.html`, `examples.html`,
`about.html`. Note the Add-on link is an ANCHOR into the Home page
(`index.html#addon`) and its `data-i18n="navAddon"` — both must be preserved.

## Shared JavaScript (current behavior — the extraction target)

- `assets/nav-menu.js` (10624 bytes): builds the mobile drawer in runtime with
  `createElement`, cloning every direct anchor child of the Primary nav, so the
  drawer link set cannot drift. Adds `nav-menu-ready` class only after wiring.
  Handles open/close, Escape, backdrop, focus restore, `aria-expanded`. The
  Primary nav itself exists in the static HTML (`.hide-sm` links), so **navigation
  exists without JavaScript** — the drawer is pure enhancement. `#mobile-menu` is
  NOT in the source HTML; it is created by JS. This progressive-enhancement shape
  must be preserved.
- `assets/build-badge.js` (1552 bytes): fills `#buildBadge` from `build-info.json`;
  must not block the page and must tolerate network/JSON errors.
- `assets/i18n.js` (273508 bytes): the 5-language dictionary + runtime; resolves
  common → page namespace → authorized extras → English fallback. OUT OF SCOPE to
  restructure unless a real duplication is removed with proof of identical visible
  values.

## i18n keys used by the shell (shared, resolved from common today)

Shell nav/labels use `data-i18n` keys: `navSolver`, `navAddon`, `navGuide`,
`navExamples`, `navAbout`, `menuLabel`, plus `data-i18n-aria`: `ariaMobileMenu`,
`ariaPrimary`, `ariaLanguage`. Footer: `footBuilt`, `footFine`. These resolve from
`common` today and must keep resolving from `common`. Do NOT reintroduce
`examples.navExamples`, `solver.navHow`, `solver.navAddon`.

## IDs present in the shell (must stay unique after composition)

`#lang` (language select), `#buildBadge` (badge span), and the JS-created
`#mobile-menu` (drawer, one per page at runtime). After build composition the 8
dist pages must each contain exactly one of `#lang` and `#buildBadge` and zero
`#mobile-menu` in the static HTML.

## What is legitimately per-page (allowed to vary)

- `aria-current="page"` on the active nav link (0 or 1 per page, per the map).
- `solver.html` header whitespace/formatting (content identical).
- Page `<main>` content, `<title>`, meta, and JSON-LD — all OUT OF SCOPE for B and
  must remain byte-for-byte identical.

## CRITICAL: there are TWO shell variants, not one

The audit found that `solver.html` does NOT share the informational-page shell.
This is a legitimate, approved design difference that Checkpoint B must PRESERVE,
not flatten (non-negotiable rules #4 design and #7 solver):

Informational shell (index, guide, examples, capabilities, about, privacy, terms):
- `<header class="mast">`, logo SVG **24×38**, nav + `<select class="lang" id="lang">`.

Solver shell (`solver.html`):
- `<header class="top"><div class="wrap">`, logo SVG **20×30**, and an EXTRA
  `<nav class="nav-onpage" aria-label="On this page">` with a "How to use"
  (`data-i18n="navHow"`) context link that exists ONLY on solver. The language
  `<select>` here has NO `class="lang"`. The primary nav link set/order is the same.

Footers: same visible content, same `data-i18n`, same links and `#buildBadge` on
all 8 pages, but solver's footer differs in WHITESPACE/formatting only
(`<footer class="foot"><div class="plumb">` inlined vs. expanded).

Design consequence for B1: a single header fragment cannot serve both variants
without changing solver's approved markup. Options are (a) two header fragments
(`header.html` for the informational shell + `header-solver.html` for solver), or
(b) one fragment with a solver-specific context that adds the on-page nav and uses
the solver logo size. Either way, the solver's on-page nav, logo size, and select
markup must come out byte-for-byte identical. This is a design decision to confirm
with the operator before writing the composition, because it sets how many
fragments exist. Until confirmed, B1 migrates only the 7 informational pages that
share the `header.mast` shell; solver is migrated separately once the approach is
chosen.

> **FINAL DECISION (recorded after the analysis above).** The text above this note
> is the HISTORICAL baseline analysis written before the approach was fixed; it is
> kept for context. The approach actually implemented in B1 is option (b), the
> **contextual variant**: a single `header.html` fragment (and a single
> `footer.html`) with two explicit `@section` blocks — one per `pageType`
> (`informational`, `solver`) — rather than separate `header-solver.html` files.
> **solver.html was migrated** in B1 along with the 7 informational pages: it now
> carries `<!-- PLUMLINE:HEADER pageType="solver" active="solver" -->` and
> `<!-- PLUMLINE:FOOTER -->`, and its composed output is byte-for-byte identical to
> the approved pre-B1 solver (SHA-256 verified). All 8 pages are migrated. The
> per-page context is fixed authoritatively in `PAGE_CONTEXT` inside
> `compose-shell.js`; see `docs/shared-components.md`.


## Out of scope for Checkpoint B (must not change)

Engine block, Worker, parser/simplex/branch-and-bound, math verification, states,
stop reasons, model detection, Variable Settings, grid, paste, undo, results,
charts, exports, the Home hero/use-cases/FAQ, Examples, Capabilities, all page
`<main>` content, all copy and all 5 translations (byte-identical visible values),
design tokens (colors, type, spacing, breakpoints, shadows, borders, focus).

## dist / manifest invariants to keep

Exact dist-root allowlist, exactly 8 HTML, root public files (CNAME, .nojekyll,
robots, sitemap, build-info, `google78ab86ec8c8a0812.html`), full manifest
verification (all requiredPaths present + every entry SHA-256-matched), internal
paths 404, GitHub Pages hosting, Node 24.15.0, portable lockfile (Linux/Windows/
macOS). Any new generated bundle MUST appear in hashes.txt and requiredPaths.

## The byte-identical bridge changes here (planned)

Checkpoint A guaranteed `source HTML == dist HTML` byte-for-byte. Once source
pages use `<!-- PLUMLINE:HEADER -->` / `<!-- PLUMLINE:FOOTER -->` placeholders,
that exact equality no longer applies. It must be REPLACED (not dropped) by a
structural/visible-equality check against an approved baseline: placeholder
validation, full HTML in dist, DOM/structure comparison, exact visible-text,
metadata, JSON-LD, links, `data-i18n`, and aria comparison, with an explicit
allowed-difference list (only: generated module paths, internal build markers,
structural changes with no visible effect). No generic difference list.

---

## B1 RESULTS — real metrics (after migration)

Measured, not estimated. All 8 dist pages are byte-for-byte identical to the
approved pre-B1 product (verified by SHA-256), so dist size and runtime payload
are UNCHANGED. B1 is a maintainability change in the SOURCE, not a payload change.

### Duplication (shell markup)

| | lines |
| --- | --- |
| Shell duplicated across 8 pages BEFORE | 282 |
| Markers in the 8 pages AFTER (2 each) | 16 |
| Centralized composer (single source) | 206 |
| **Repeated lines eliminated** | **266** |
| **Reduction in repeated shell** | **94%** |

### Source HTML size (bytes)

| page | before | after | delta |
| --- | ---: | ---: | ---: |
| index.html | 27362 | 24622 | -2740 |
| solver.html | 218349 | 215557 | -2792 |
| guide.html | 17957 | 15202 | -2755 |
| examples.html | 11417 | 8665 | -2752 |
| capabilities.html | 18624 | 15837 | -2787 |
| about.html | 7683 | 4928 | -2755 |
| privacy.html | 8976 | 6236 | -2740 |
| terms.html | 7381 | 4641 | -2740 |
| **TOTAL source** | **317749** | **295688** | **-22061** |

### dist HTML size (bytes)

Unchanged. The 8 dist pages total 317749 bytes both before and after (same SHA-256
per page). No payload improvement is claimed — dist did not change.

### Counts

- Fragments (real files, read by build and tests): `src/shared/fragments/header.html`
  with two `@section` variants (`header:informational`, `header:solver`), and
  `src/shared/fragments/footer.html` with two variants (`footer:informational`,
  `footer:solver`). The composer holds no hard-coded shell markup.
- Markers: 2 per page × 8 pages = 16, plus 2 in `capabilities.template.html` = 18.
- Modules added: `src/shared/compose-shell.js` (composer, reads the fragments),
  `engine/composed-html.js` (test helper).
- Test suites added: `tests_shell_b1`, `tests_shell_composition_negative` (real
  negative mutations), `tests_shell_golden` (independent golden fixtures),
  `tests_spaces_path` (Windows spaced-path contract), `tests_composed_reads`.
- Runtime requests: unchanged (dist identical; no fragment is fetched).
- Runtime globals: unchanged (`window.__plumline` only; the composer runs in Node
  at build time, adds no browser global).

### capabilities.html — the one legitimate footer difference

`capabilities.html` (and its generator template) carry
`learnCapabilities="true"`, which adds one footer link:
`<a href="capabilities.html" data-i18n="navCapabilities">Capabilities</a>` in the
"Learn" column. This difference EXISTED BEFORE B1 (the pre-B1 capabilities.html
had exactly this extra link; no other page did) — it is NOT a new design decision.
`engine/templates/capabilities.template.html` and `capabilities.html` stay in sync
(`node engine/gen_capabilities.js --check` is green), and `tests_shell_b1.js`
asserts no page other than capabilities.html carries the link.

### Intentional visual differences

None. All 8 dist pages are byte-for-byte identical to the approved product.
