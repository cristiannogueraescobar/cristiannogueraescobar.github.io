/* internal-paths.js — the SINGLE source of truth for the public/internal boundary.
 *
 * One list, consumed by validate_dist.js (on-disk), test_dist_http.js (local
 * HTTP) and the production smoke job (via the workflow reading this file), so the
 * three can never drift.
 *
 * PUBLIC_FILES:        files that MUST be present in dist and served (200).
 * PUBLIC_PAGES:        the 8 site HTML pages (dist root must contain exactly these).
 * DIST_ROOT_ALLOWLIST: the EXHAUSTIVE set of entries allowed at dist root. Anything
 *                      else at dist root fails the build (catches style.css,
 *                      forgotten scripts, temp files, etc.).
 * INTERNAL_PATHS:      repo/dev files that must NEVER be in dist and must 404 in prod.
 * FORBIDDEN_AT_DIST_ROOT: paths that must not appear at dist root at all.
 *
 * Paths are relative to the site root, forward-slash, no leading slash.
 */

// The 8 public HTML pages (exhaustive).
const PUBLIC_PAGES = [
  'about.html', 'capabilities.html', 'examples.html', 'guide.html',
  'index.html', 'privacy.html', 'solver.html', 'terms.html',
];

// Files that must exist in dist and be served publicly.
const PUBLIC_FILES = [
  'CNAME',
  'robots.txt',
  'sitemap.xml',
  'build-info.json',
  '.nojekyll',
  'google78ab86ec8c8a0812.html',        // Google Search Console verification
  'assets/plumline.css',
  'assets/i18n.js',
  'assets/nav-menu.js',
  'assets/build-badge.js',
  'assets/examples-data.js',
  'assets/cap-lightbox.js',
  'assets/product-capabilities.js',
];

// Root-level public files that must be byte-identical to their repo source at
// `npm run verify` time. build-info.json IS included: during verify it is still
// the DEV-LOCAL placeholder (CI stamps the real SHA only AFTER verify), so before
// the stamp it must match the source placeholder byte-for-byte. The CI flow
// after verify is: stamp SHA -> verify SHA -> write hashes.
const ROOT_PUBLIC_VERBATIM = [
  'CNAME', 'robots.txt', 'sitemap.xml', '.nojekyll',
  'google78ab86ec8c8a0812.html', 'build-info.json',
];

// EXHAUSTIVE allowlist of entries permitted at the dist ROOT (files + dirs).
// Anything at dist root not in this set fails validate_dist. This is the strong
// guard: it rejects style.css, stray scripts and temp files without needing to
// enumerate them.
const DIST_ROOT_ALLOWLIST = [
  '.nojekyll',
  'CNAME',
  'about.html',
  'assets',                              // directory
  'build-info.json',
  'capabilities.html',
  'examples.html',
  'google78ab86ec8c8a0812.html',
  'guide.html',
  'index.html',
  'privacy.html',
  'robots.txt',
  'sitemap.xml',
  'solver.html',
  'terms.html',
];

// Repo/dev files that must never be published. These must 404 in production and
// be absent from dist. Concrete file paths so the smoke test can fetch each and
// assert 404. NOTE: real path is .github/workflows/deploy.yml (not workflows/…).
const INTERNAL_PATHS = [
  'engine/run_all.js',
  'package.json',
  'package-lock.json',
  'node_modules/vite/package.json',
  'vite.config.mjs',
  '.github/workflows/deploy.yml',
  '.github/workflows/ci.yml',
  'data/claims.json',
  'docs/architecture-baseline.md',
  'DEPLOY.md',
  'style.css',                           // legacy, superseded by assets/plumline.css
  'build_solver.py',                     // legacy dev tool
];

// Top-level directories/files that must not appear at dist root at all.
const FORBIDDEN_AT_DIST_ROOT = [
  'engine', 'node_modules', 'package.json', 'package-lock.json',
  '.github', 'docs', 'vite.config.mjs', 'data', 'DEPLOY.md',
  '.gitignore', '.node-version', 'verify.log',
  'style.css', 'build_solver.py',
];

module.exports = {
  PUBLIC_PAGES, PUBLIC_FILES, ROOT_PUBLIC_VERBATIM,
  DIST_ROOT_ALLOWLIST, INTERNAL_PATHS, FORBIDDEN_AT_DIST_ROOT,
};
