# Architecture baseline — Plumline (pre-refactor)

Captured before any refactoring, on branch `home-redesign` (i18n v81), suite green.
This documents the REAL architecture as it exists today, not a target design.

> Starting-point note: the working tree is branch `home-redesign` (not yet merged
> to `main`). It is the most recent green state (6742 tests, dev == public). The
> refactor branch `refactor/modular-architecture` should be cut from whatever
> commit is chosen as the merge base; this baseline describes that content.

## Baseline status

- Test battery: `node engine/run_all.js` → **6742 passed**, dev and public parity.
- `PLUMLINE_PUBLIC_BUILD=1 node engine/run_all.js` → **6742 passed**.
- Generators idempotent (`--check` clean): gen_capabilities, gen_home_capabilities,
  gen_jsonld, gen_home_faq.
- No `node_modules` shipped at runtime; the only npm deps are dev-only
  (`acorn`, `jsdom`).

## Public URLs (must be preserved exactly)

`/` · `/solver.html` · `/guide.html` · `/examples.html` · `/capabilities.html` ·
`/about.html` · `/privacy.html` · `/terms.html` · `/robots.txt` · `/sitemap.xml` ·
`/build-info.json` · `/assets/hashes.txt`

## Page sizes (HTML)

| Page | Bytes | Lines |
|------|------:|------:|
| index.html | 27362 | 330 |
| solver.html | 218349 | 4607 |
| guide.html | 17957 | 193 |
| examples.html | 11417 | 167 |
| capabilities.html | 18624 | 237 |
| about.html | 7683 | 102 |
| privacy.html | 8976 | 106 |
| terms.html | 7381 | 100 |

`solver.html` dominates: it inlines the whole engine and the solver UI.

## Assets

| File | Bytes | Role |
|------|------:|------|
| assets/i18n.js | 273508 | Full dictionary, 5 languages, all namespaces |
| assets/product-capabilities.js | 23079 | Capabilities inventory (source of truth) |
| assets/nav-menu.js | 10624 | Nav + mobile menu + language selector |
| assets/cap-lightbox.js | 3917 | Capabilities lightbox |
| assets/examples-data.js | 2644 | Shared example metadata (solver drawer + examples page) |
| assets/build-badge.js | 1552 | Build badge (reads build-info.json) |
| **JS total** | **315324** | |
| assets/plumline.css | 35459 | Single global stylesheet |
| **CSS total** | **35459** | |
| Images (screenshots + capabilities) | 927930 | PNG/WebP |

## Inline scripts and styles

Every page has exactly one inline `<script>`:

- index.html: `Plumline.i18n.init('home', ['capabilities'])`
- solver.html: the engine + solver UI + Worker builder (huge; see below)
- guide/about/privacy/terms/capabilities: `Plumline.i18n.init('<ns>')`
- examples.html: catalog logic driven by `assets/examples-data.js`

Inline `<style>` blocks:

- solver.html: **18059 bytes** (solver-specific grid/panel styling)
- examples.html: 885 bytes

All other pages carry no inline style; they use `assets/plumline.css`.

## Per-page resource loading

Every page loads, in order:
`plumline.css` → `build-badge.js` → `i18n.js` → `nav-menu.js` → inline i18n init.

- **Home (index.html)** additionally loads two hero screenshots. It pulls the
  FULL `i18n.js` (273 KB, all 5 languages) though it only needs
  `common` + `home` + `capabilities`. **Performance opportunity, not for
  Checkpoint A.**
- **Solver (solver.html)** additionally loads `examples-data.js`, then runs the
  inline engine and builds the Worker from its own source.
- **Examples** additionally loads `examples-data.js` and the inline catalog.
- **Home / Capabilities** call `i18n.init` with `extras=['capabilities']`.

## Globals

Only two:

- `window.__plumline` — the single app namespace (clean).
- `window.matchMedia` — browser API, referenced not defined.

No sprawl of ad-hoc globals. `Plumline` is the one namespace the app hangs off.

## Engine (the delicate part — Checkpoint E)

- The math engine is **inlined in solver.html**, lines **468–2621**, delimited by
  `/* ENGINE_START */` and `/* ENGINE_END */` = **2153 lines**.
- The **Worker is built from the page's own source**: solver.html re-fetches its
  own HTML, slices the text between `ENGINE_START`/`ENGINE_END`, wraps it with a
  small message handler, and spins up a Blob Worker (lines ~3151–3172:
  `buildWorker`, `engineWorker`, `workerBusy`, `workerToken`).
- This is a **single-source engine↔Worker pattern**: direct execution and the
  Worker run the exact same source. Any build step (Vite) MUST keep the markers
  intact and must not break the runtime re-fetch of the served HTML. **High risk
  for Checkpoint A** — verify the markers survive and the Worker still builds.

## Engine / tooling (repo-only, never served)

- `engine/` holds 48 `.js` files: the test battery (`run_all.js`, `suites.js`,
  `tests_*.js`) and generators (`gen_capabilities`, `gen_claims`,
  `gen_home_capabilities`, `gen_home_faq`, `gen_jsonld`) plus templates.
- Generators inject content into HTML between markers and have `--check` modes.

## Data (separated from presentation)

`data/` holds JSON consumed by generators:
`claims.json`, `home-faq.json`, `home-screenshots.json`, `media.json`,
`pending-translations.json`. Presentation is generated from these.

## i18n

- `assets/i18n.js` — one dictionary, namespaces: `common`, `home`, `solver`,
  `guide`, `capabilities`, `examples`, `about`, `legal`.
- Resolution order (runtime): `common → page namespace → declared extras →
  English fallback`. `apply()` and `t()` share a single `lookupTranslation`.
- Page → namespaces loaded:
  - index.html → home + [capabilities]
  - solver.html → solver
  - guide.html → guide
  - capabilities.html → capabilities
  - examples.html → examples
  - about.html → about
  - privacy.html / terms.html → legal
- Coverage + orphan guards are namespace-aware (`namespace.key`), production-only
  (test files excluded), with a tiny explicit fixture allowlist.

## Current deploy workflow (`.github/workflows/deploy.yml`)

Trigger: push to `main` + manual. Node **24.15.0**. Steps:

1. `npm ci`; verify jsdom loads.
2. Run tests (`CI=true`, `PLUMLINE_PUBLIC_BUILD=1`), capture the pass count.
3. Validate assets: `node --check assets/i18n.js`, `tests_jsonld.js`,
   `tests_i18n_pages.js`.
4. Stamp `build-info.json` with `GITHUB_SHA`, timestamp, test count.
5. Prepare `_site/` via `rsync`, EXCLUDING `.git`, `.github`, `_site`, `engine`,
   `DEPLOY.md`, `hashes.txt`, `node_modules`, `package.json`, `package-lock.json`,
   `workflows`.
6. Write `_site/assets/hashes.txt` = SHA-256 of every served file (excluding
   hashes.txt itself).
7. Fail the build if `build-info.json` is unstamped (`DEV-LOCAL`) or its commit
   ≠ `GITHUB_SHA`.
8. `upload-pages-artifact` → `deploy-pages`.
9. **Smoke** against `https://plumline.online`: wait until production reports the
   deployed SHA (anti-stale polling), verify content markers (`#capabilities`,
   `gDirH`, `#cap-model-continuous`), parse production JSON-LD, assert
   `/engine/run_all.js`, `node_modules/...`, `package.json`, `package-lock.json`,
   `.github/workflows/deploy.yml` all return **404**, and crawl every internal
   href/src requiring **200**.

Current `build-info.json` in the tree is the `DEV-LOCAL` placeholder (overwritten
by CI). **CNAME:** the custom domain lives in `CNAME` at the repo root, which
already exists in `main`. The delivery does NOT add a CNAME file; the build reads
the existing repo-root `CNAME` and Vite copies it verbatim into `dist/`. Confirm
the repo-root `CNAME` still reads `plumline.online` before the first dist deploy.

## What the refactor must not break (engine/Worker/i18n invariants)

- The `ENGINE_START`/`ENGINE_END` markers and the Worker's runtime re-fetch of
  the served HTML.
- The single-source engine↔Worker parity.
- The full public URL set and `.html` extensions.
- The five languages and the namespace-aware resolution order.
- The generators and their `--check` idempotence.
- The deploy guards: build-info stamped with the real SHA, hashes.txt of served
  files, anti-stale smoke, 404s for repo-only files, zero broken links.

## Risks going into Checkpoint A

1. **Worker source slicing.** Vite may rewrite/minify the solver's inline script.
   If the `ENGINE_START/END` markers or the exact inline text change, the Worker
   build (which slices the served HTML) breaks. Mitigation: keep the engine as a
   real module bundled predictably, or preserve the markers verbatim in the built
   output and keep the re-fetch working. **Must be verified before shipping A.**
2. **Inline i18n init scripts** must survive Vite processing on every page.
3. **build-info.json / hashes.txt** are produced in CI, not by the local Vite
   build — the pipeline must keep generating them into `dist/` at deploy time.
4. **CNAME** already exists in `main` at the repo root; Vite copies it verbatim
   into `dist/`. Confirm it still reads `plumline.online` before deploy.
5. **Node pinned to 24.15.0** (the workflow's version), not the assistant's local
   Node.
