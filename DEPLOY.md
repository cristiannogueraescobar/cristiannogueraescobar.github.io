# Deployment and verification

Production is plumline.online on GitHub Pages. The deploy pipeline ties the live
site to a known-good commit, so you can state, with evidence:

> "Production corresponds to commit `XXXXXXX`; that commit passed N tests; and
> the served files match `assets/hashes.txt`."

## Pipeline (current — Vite dist)

The site is BUILT with Vite (multipage, no SPA, no framework) into `dist/`, and
`dist/` is what gets published. There is a SINGLE build path: local and CI run
the same `npm run verify`.

Flow on push to `main` (`.github/workflows/deploy.yml`):

1. **`npm ci`** — install pinned dev/build deps (Node 24.15.0).
2. **`npm run verify`** (run once, via `tee verify.log`) —
   - full test battery (public build);
   - HTML validity of source AND built pages (raw + jsdom: one opening AND one
     closing html/head/body, one alt per raw img, no broken-alt tail, Home alts
     == DICT.en.home);
   - JSON-LD validity;
   - lockfile portability (platform variants present, package/lock agreement);
   - `npm run build` → `dist/`;
   - validate `dist/` (exact root allowlist; the 8 HTML byte-identical to source;
     root public files byte-identical; engine markers intact; every asset URL
     resolves; recursive source-vs-dist asset parity; no internal files);
   - serve `dist/` over real HTTP (pages 200, internal paths 404, Worker markers
     served, zero broken links).
   The test count is read from `verify.log` (no second test run).
3. **Stamp `dist/build-info.json`** with `GITHUB_SHA`, branch, timestamp, test
   count, `buildSystem: "vite"`, `hosting: "GitHub Pages"`.
4. **Write `dist/assets/hashes.txt`** — SHA-256 of every file in the final
   `dist/` (excluding hashes.txt itself).
5. **Verify build-info stamped** — fail if `DEV-LOCAL` or commit ≠ `GITHUB_SHA`.
6. **Assert `dist/` has no internal files** — engine, node_modules, package
   manifests, vite.config.mjs, docs, .github, data.
7. **`upload-pages-artifact`** with `path: dist`.
8. **`deploy-pages`**.
9. **Smoke** against https://plumline.online — anti-stale polling until the live
   `build-info.json` reports the deployed SHA; content markers (`#capabilities`,
   `gDirH`, `#cap-model-continuous`); production JSON-LD parses; internal paths
   (`/engine/run_all.js`, `node_modules/...`, `package.json`, `package-lock.json`,
   `.github/workflows/deploy.yml`) return 404 — from the single list in
   `engine/internal-paths.js`; every internal link returns 200; and **full
   manifest verification** (shared `engine/verify_manifest.js`) asserting two
   things: (1) every entry in `assets/hashes.txt` is downloaded from production
   and matches its SHA-256; and (2) every expected public file — the 8 pages, the
   root public files, and every file under `assets/` (from the checkout, minus
   `assets/hashes.txt`), passed as `requiredPaths` — is present in the manifest,
   so a manifest that OMITS a public file fails. It fails on a missing file, a
   missing/duplicate/malformed entry, or a mismatch (`hashes.txt` is not in its
   own manifest).

There is NO `_site/` and NO `rsync` step any more. The old pipeline rsynced the
repo (minus a deny-list) into `_site/`; the current pipeline builds an explicit
`dist/` that contains only public files. See "Public boundary" below.

## PR / branch CI (`.github/workflows/ci.yml`)

On pull requests to `main` and pushes to `refactor/**`: read-only permissions,
`npm ci`, `npm run verify` once, and upload `dist/` as a review artifact. It does
NOT deploy and does not request `pages`/`id-token`.

## Public boundary (what is and isn't served)

`dist/` contains ONLY: the 8 HTML, `assets/` (CSS, the 6 runtime JS, images in
`screenshots/` and `capabilities/`), CNAME, robots.txt, sitemap.xml,
`google78ab86ec8c8a0812.html` (Google Search Console verification),
build-info.json, .nojekyll, and (added by CI) assets/hashes.txt.

Internal/dev files are NOT served and return 404 in production: `engine/` and all
tests, `package.json`, `package-lock.json`, `node_modules/`, `.github/` (including
`.github/workflows/deploy.yml` and `ci.yml`), `docs/`, `vite.config.mjs`, and
`data/` (e.g. `data/claims.json`), `DEPLOY.md`.

The single source of truth for this boundary is `engine/internal-paths.js`
(`PUBLIC_FILES`, `PUBLIC_PAGES`, `INTERNAL_PATHS`, `FORBIDDEN_AT_DIST_ROOT`);
`validate_dist.js`, `test_dist_http.js` and the production smoke job all read it,
so the lists cannot drift.

## GitHub Pages Source setting

Settings → Pages → Build and deployment → Source must be **"GitHub Actions"**,
not "Deploy from a branch". A branch source would publish the committed
`build-info.json` (DEV-LOCAL) and ignore the Actions artifact. The smoke job
detects and explains this failure mode.

## Local commands

- `npm run dev` — Vite dev server (multipage).
- `npm run build` — build into `dist/`.
- `npm run preview` — serve the built `dist/`.
- `npm run test` — the test battery.
- `npm run check` — JSON-LD + i18n pages + i18n.js parse.
- `npm run validate` — validate an existing `dist/`.
- `npm run verify` — the full gate (what CI runs).
