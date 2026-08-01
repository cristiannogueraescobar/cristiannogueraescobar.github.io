# Plumline architecture

Plumline is a multi-page STATIC site on GitHub Pages. No SPA, no framework, no
backend. Vite is a dev/build tool only.

## Layers

- **Public pages** (8): `index`, `solver`, `guide`, `examples`, `capabilities`,
  `about`, `privacy`, `terms` — each a real `.html` URL, unchanged by any refactor.
- **Solver engine**: inlined in `solver.html` between `/* ENGINE_START */` and
  `/* ENGINE_END */`. A Worker is built at runtime by re-reading that inline
  script. OUT OF SCOPE for shell work; must stay byte-for-byte identical.
- **Shared shell** (Checkpoint B1): header/nav/mobile controls/language
  selector/footer/build-badge, composed at build time from
  `src/shared/compose-shell.js`. See `docs/shared-components.md`.
- **i18n**: `assets/i18n.js` holds the 5-language dictionary (en/es/pt/de/fr) and
  the runtime resolver (common → page namespace → authorized extras → English
  fallback). Not restructured by B1.
- **Assets**: `assets/` (CSS, runtime JS, screenshots) copied verbatim into dist.

## Build pipeline (Checkpoint A + B1)

1. Vite emits the 8 HTML entry points.
2. `plumlineComposeShell` (dev + build) composes `PLUMLINE:` shell markers.
3. `plumlineBuild.closeBundle` copies the `assets/` tree verbatim, copies root
   public files (`CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml`,
   `build-info.json`, `google…​.html`), and re-derives each dist page from source
   (composing markers) so dist is fully determined by source.
4. CI stamps `build-info.json`, writes `assets/hashes.txt`, and the production
   smoke verifies every manifest entry by SHA-256. See
   `docs/github-pages-deployment.md`.

## Guarantees preserved across refactors

Public URLs, GitHub Pages hosting, `CNAME`, the exact dist-root allowlist, the 8
HTML pages, manifest/requiredPaths/SHA verification, the inline engine + Worker,
all copy and 5 translations (byte-identical visible values), and the approved
design tokens. Checkpoint B1 changes only HOW the shell markup is stored and
composed, not what the user receives — the 8 dist pages are byte-for-byte
identical to the approved pre-B1 product.
