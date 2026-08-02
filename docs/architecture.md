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

## Generated pages (State D)

Some pages are generated from canonical data, not hand-authored. capabilities.html
(Checkpoint C4) is produced by `engine/gen_capabilities.js` from
`engine/templates/capabilities.template.html` (chrome + two region markers), the
capability inventory `assets/product-capabilities.js` (24 entries, 16 shown), the
imagery in `data/media.json`, and the copy in `assets/i18n.js`. The generator is
deterministic, has a `--check` mode (the CI gate), fills the two markers exactly
once, validates each image file and its five-language alt text, and derives the
JSON-LD featureList from the shown inventory. `index.html` (Checkpoint C5) also
carries generated regions: HOME_CAPABILITIES (gen_home_capabilities.js), HOME_FAQ +
HOME_FAQ_JSONLD (gen_home_faq.js from data/home-faq.json), and HOME_SOFTWARE_JSONLD
(gen_jsonld.js); gen_claims.js writes data/claims.json (a data file, NOT an
index.html region). Those three index.html generators touch disjoint regions
(tests_gen_stability), locate their regions by `_START`/`_END` markers, and each
requires its markers exactly once. index.html has 13 `<section>` elements: 11 are
hand-authored (hero-split, trust-bar, how, use-cases, verify, example, privacy,
limits, add-on, help, final CTA) and 2 host a generated region (`#capabilities`,
`#faq`); two more generated regions sit in `<head>` and are not sections. Generated
pages are never edited by hand — edit the source data or template and regenerate.

## Guarantees preserved across refactors

Public URLs, GitHub Pages hosting, `CNAME`, the exact dist-root allowlist, the 8
HTML pages, manifest/requiredPaths/SHA verification, the inline engine + Worker,
all copy and 5 translations (byte-identical visible values), and the approved
design tokens. Checkpoint B1 changes only HOW the shell markup is stored and
composed, not what the user receives — the 8 dist pages are byte-for-byte
identical to the approved pre-B1 product.

## Solver interface composition (Checkpoint D)

`solver.html` is assembled the same way the shell is (B1): the source page carries
nine `SOLVER_UI_*` marker blocks, and `src/shared/compose-solver.js` — the single
composer used by Vite dev, Vite build, `engine/composed-html.js`, and
`engine/validate_dist.js` — replaces each block with the verbatim bytes of an internal
fragment under `engine/fragments/solver-ui/`. The composed inline script is
byte-identical to the pre-D baseline, and `dist/solver.html` is byte-identical to the
pre-D public artifact; the fragments are NEVER published. The nine regions, in
canonical order, are EXAMPLES_LOADING, GRID_INTERACTION, SOLVE_WORKER_CLIENT,
VARIABLE_SETTINGS, SOLVE_ORCHESTRATION, SOLVE_RESULTS, RECEIPT_PLOT_EXPORTS,
EXAMPLES_DRAWER, and BOOTSTRAP_ACCESSIBILITY. The engine region
(`/* ENGINE_START */`…`/* ENGINE_END */`, 82657 chars) and the Worker are frozen
throughout D and are the province of Checkpoint E. Module-level i18n utilities and the
IIFE-head example data/state remain inline by design. See
docs/checkpoint-d5-integration.md for the full account.
