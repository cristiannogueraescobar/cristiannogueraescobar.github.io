# GitHub Pages deployment (Vite dist pipeline)

How plumline.online is built and published after Checkpoint A.

## Summary

- Hosting: **GitHub Pages** (custom domain `plumline.online` via CNAME). Unchanged.
- Build tool: **Vite 6.4.3**, multipage (MPA), 8 explicit HTML entry points.
- Node: **24.15.0** (pinned in `.node-version` and `engines.node`).
- Build command: `npm run build` (`vite build`).
- Publish directory: **`dist/`**.
- The site is NOT a SPA. No framework. No rewrite to index.html. URLs unchanged.

## What the build does

`vite build` runs `vite.config.mjs`:

1. Emits the 8 HTML entry points to `dist/` keeping their exact names
   (`index.html`, `solver.html`, `guide.html`, `examples.html`,
   `capabilities.html`, `about.html`, `privacy.html`, `terms.html`).
2. The `plumline-build` plugin, in `closeBundle`:
   - Removes any image Vite flattened into `dist/assets/` root that belongs in a
     subfolder.
   - Copies the whole `assets/` tree verbatim into `dist/assets/` (stable names,
     `screenshots/` and `capabilities/` subfolders preserved, the CSS and the 6
     runtime JS copied byte-for-byte — the manual `?v=N` cache-busting is kept).
   - Copies root public files into `dist/`: `CNAME`, `robots.txt`, `sitemap.xml`,
     `.nojekyll`, `build-info.json`, and `google78ab86ec8c8a0812.html` (Google
     Search Console verification).
   - Restores every asset URL Vite rewrote back to the exact source form (the CSS
     link restored with the exact query string present in source, the flattened
     subfolders, the `<link>` position before inline `<style>` so the CSS cascade
     is unchanged, and strips Vite's `crossorigin`).
   - Composes the shared shell (Checkpoint B1): source pages carry
     `<!-- PLUMLINE:HEADER … -->` / `<!-- PLUMLINE:FOOTER … -->` markers, which are
     replaced with the fully-rendered header/footer at BUILD time (via
     `src/shared/compose-shell.js`, the same module the dev server uses). No
     fragment is fetched at runtime; dist contains complete HTML with no residual
     marker. `validate_dist.js` requires each migrated dist page to equal
     `composeHtml(source)` exactly.

Result: **the 8 built pages are byte-for-byte identical to the approved product**
(and, for pages carrying markers, exactly equal to `composeHtml(source)`), and
every served JS/CSS is byte-for-byte identical. The engine stays inline in
`solver.html` with `ENGINE_START/END` intact, so the Worker (built at runtime by
re-reading the page's own inline script) is preserved and verified.

## The `npm run verify` gate (local == CI)

`npm run verify` (`engine/verify_all.js`) runs, failing on the first error:

1-2. Full test battery (`engine/run_all.js`) in public-build mode (6742 tests).
3.  HTML validity of SOURCE pages (`engine/validate_html.js .` — raw + jsdom: one
    opening AND one closing html/head/body, one alt per raw `<img>`, no broken-alt
    tail, Home alts == `DICT.en.home`).
4.  JSON-LD validity (`engine/tests_jsonld.js`).
5.  Lockfile portability (`engine/validate_lockfile.js` — platform variants
    present; `package.json` and lock `engines.node` both exactly `>=24.15.0 <25`
    and identical).
5b. Manifest guard negative tests (`engine/tests_manifest_negative.js` — proves
    each hashes.txt guard bites: missing file, wrong SHA, duplicate, self-ref,
    malformed line, required-file-absent).
6.  Build via `npm run build`.
7.  HTML validity of the BUILT pages (`engine/validate_html.js dist`).
8.  `engine/validate_dist.js`: exact dist-root allowlist; the 8 pages
    byte-identical to source; root public files byte-identical (CNAME, robots,
    sitemap, .nojekyll, google verification, build-info placeholder); engine
    markers intact; every asset URL resolves; recursive source-vs-dist asset
    parity; no internal files.
9.  `engine/test_dist_http.js`: serves `dist/` over real HTTP — 8 pages 200,
    public assets 200, internal paths 404, Worker markers served, zero broken
    links, AND full manifest verification via the shared
    `engine/verify_manifest.js`, which asserts BOTH claims: (a) every manifest
    entry is served with a matching SHA-256, and (b) every expected file — here,
    every real file in the built `dist/` except `assets/hashes.txt`, passed as
    `requiredPaths` — is present in the manifest (`checked === requiredPaths.length`),
    so a manifest that merely OMITS a file fails.
10. `dist/build-info.json` present.
11. no premature `dist/assets/hashes.txt` (CI writes it after dist is final).

## The deploy workflow (`.github/workflows/deploy.yml`)

Trigger: push to `main` + manual. Node 24.15.0.

Build job:
1. `npm ci`; verify jsdom loads.
2. **Verify**: capture the test count, then `npm run verify` (tests + build +
   dist validation + over-HTTP checks). Same command as local.
3. **Stamp** `dist/build-info.json` with `GITHUB_SHA`, branch, timestamp, test
   count, `buildSystem: "vite"`, `hosting: "GitHub Pages"`.
4. **Write hashes**: SHA-256 of every file in the final `dist/` into
   `dist/assets/hashes.txt` (excluding hashes.txt itself).
5. **Verify build-info stamped**: fail if `DEV-LOCAL` or commit != `GITHUB_SHA`.
6. **Assert dist has no internal files**: fail if `engine`, `node_modules`,
   `package.json`, `package-lock.json`, `vite.config.mjs`, `docs`, `.github`,
   `data` are in `dist/`.
7. `upload-pages-artifact` with `path: dist`.

Deploy job: `actions/deploy-pages@v4`.

Smoke job (against `https://plumline.online`): anti-stale polling until
production reports the deployed SHA; content markers (`#capabilities`, `gDirH`,
`#cap-model-continuous`); production JSON-LD parses; the Google verification file
is served byte-identical; internal paths return 404 — the list comes from the
single source of truth `engine/internal-paths.js` (`INTERNAL_PATHS`), so the smoke
uses the SAME list as `validate_dist` and `test_dist_http` and includes the real
path `.github/workflows/deploy.yml` (not `workflows/deploy.yml`); it crawls every
internal href/src requiring 200; and it verifies the FULL manifest via the shared
`engine/verify_manifest.js`, asserting two distinct things:

1. **Every manifest entry matches by SHA-256.** It downloads each path listed in
   `assets/hashes.txt` with the same cache-buster, computes SHA-256, and requires
   equality — failing on a missing file, a missing/duplicate/malformed entry, or a
   mismatch (`hashes.txt` is not in its own manifest).
2. **Every expected public file is present in the manifest.** The expected list is
   built from the CHECKOUT — `PUBLIC_PAGES` and `PUBLIC_FILES` from
   `engine/internal-paths.js` plus a recursive walk of `assets/`, minus
   `assets/hashes.txt` — and passed as `requiredPaths`. Since Checkpoint A requires
   exact source↔dist asset parity, the checkout's recursive list is the correct
   source of truth for what the published manifest must contain, so a manifest that
   simply OMITS a public file fails.

After the smoke, both provenance claims hold: (1) every served file listed in
`hashes.txt` was downloaded from production and matched its expected SHA-256, and
(2) every public file the checkout expects is present in that manifest. Production
corresponds to `GITHUB_SHA`, and that commit passed the test battery.

## GitHub Pages Source setting (must be correct)

Settings → Pages → Build and deployment → **Source must be "GitHub Actions"**,
NOT "Deploy from a branch". A branch source would publish the committed
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

## Public boundary change vs the previous deploy (Checkpoint A)

The previous pipeline published `_site/` — an `rsync` of the repo minus a
deny-list. The new pipeline publishes an explicit `dist/` that is BUILT and
validated. This is a deliberate hardening of the public boundary. Be precise
about what is and isn't identical:

- **Identical:** the 8 HTML pages and every asset they use (CSS, the 6 runtime
  JS, images) are byte-for-byte identical to source, and to what the old pipeline
  served. The engine and Worker are unchanged. URLs are unchanged. The Google
  Search Console verification file `google78ab86ec8c8a0812.html` is preserved and
  served byte-for-byte.
- **No longer served (now 404):** internal/dev paths the old rsync could
  theoretically expose are excluded from `dist/` by construction —
  `vite.config.mjs`, `docs/`, `data/` (e.g. `/data/claims.json`), `DEPLOY.md`,
  plus the always-excluded `engine/`, `node_modules/`, `package.json`,
  `package-lock.json`, `.github/` (`.github/workflows/deploy.yml`, `ci.yml`).

So the correct statement is NOT "the whole published artifact is identical to
before". It is: "the eight pages, their assets, and the Google verification file
are identical; internal files are no longer published." Both `validate_dist.js`
(on disk, incl. recursive asset parity) and `test_dist_http.js` (over HTTP, 404
assertions) enforce this boundary, using the single list in
`engine/internal-paths.js`.
