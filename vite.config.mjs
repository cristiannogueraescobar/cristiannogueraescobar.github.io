import { defineConfig } from 'vite';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'fs';

const root = dirname(fileURLToPath(import.meta.url));

// Plumline is a multi-page STATIC site on GitHub Pages. Vite is a dev/build tool
// only; the site is NOT a SPA and no framework is introduced.
//
// Hard constraints that shape this config:
//  1. Public URLs and asset names/paths must stay EXACTLY as today, including the
//     assets/screenshots/ and assets/capabilities/ subfolders and the manual ?v=N
//     cache-busting. Vite must NOT rewrite, flatten, or hash any asset URL.
//  2. The solver inlines the engine and builds its Worker by re-reading its own
//     inline <script> at runtime (ENGINE_START/END). Vite leaves non-module inline
//     scripts untouched, so this survives (verified byte-for-byte).
//
// IMPORTANT — TEMPORARY BRIDGE:
//   The `restore-asset-urls` step below is a Checkpoint A bridge, NOT the final
//   module architecture. Its whole job is to make the built HTML byte-identical
//   to source while Vite is introduced as a build tool. When real modularization
//   lands (Checkpoints B+), assets become proper module imports and this
//   restoration is removed. Do not build new behaviour on top of it.
//
// Vite emits the 8 HTML entry points; in closeBundle (after everything is
// written) we (a) delete images Vite flattened into dist/assets root, (b) copy
// the assets/ tree verbatim, (c) copy root public files, and (d) restore each
// emitted HTML to its exact source bytes (which also restores every asset URL,
// the CSS query string, and the <link> position — no hard-coded ?v=).

const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
const ROOT_PUBLIC = ['CNAME', 'robots.txt', 'sitemap.xml', '.nojekyll', 'build-info.json',
                     'google78ab86ec8c8a0812.html'];

// Recursive map of every file under assets/, keyed by basename, to its FULL
// relative path(s) from assets/. If a basename is ambiguous (same name in two
// subfolders) we record all paths and fail the build rather than guess.
function buildAssetIndex() {
  const byBasename = new Map();   // basename -> [relPath, ...]
  const assetsDir = join(root, 'assets');
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const rel = relative(assetsDir, full).split('\\').join('/'); // relative path from assets/
      const base = entry.name;
      if (!byBasename.has(base)) byBasename.set(base, []);
      byBasename.get(base).push(rel);
    }
  })(assetsDir);
  return byBasename;
}

// Which asset basenames are referenced by the HTML with NO subfolder (i.e. Vite
// might flatten them). If any such basename is ambiguous in the asset tree, we
// cannot restore it unambiguously -> fail the build.
function assertNoAmbiguousFlattening(index) {
  const problems = [];
  for (const [base, paths] of index.entries()) {
    // Only a concern when the file lives in a subfolder (path has a "/") AND the
    // basename is duplicated across locations.
    const inSubfolder = paths.some(p => p.includes('/'));
    if (inSubfolder && paths.length > 1) {
      problems.push(base + ' -> [' + paths.join(', ') + ']');
    }
  }
  if (problems.length) {
    throw new Error(
      'Ambiguous asset basenames (same filename in multiple locations); the ' +
      'Checkpoint A URL-restoration bridge cannot resolve these unambiguously:\n  ' +
      problems.join('\n  ') +
      '\nRename so basenames are unique, or land real module imports (Checkpoint B+).'
    );
  }
}

function plumlineBuild() {
  const index = buildAssetIndex();
  assertNoAmbiguousFlattening(index);
  return {
    name: 'plumline-build',
    apply: 'build',
    closeBundle() {
      const dist = join(root, 'dist');
      const distAssets = join(dist, 'assets');

      // (a) Remove any file Vite flattened into dist/assets root that actually
      //     lives in a subfolder in source (we restore the subfolder copy in b).
      if (existsSync(distAssets)) {
        for (const f of readdirSync(distAssets)) {
          const paths = index.get(f);
          if (paths && paths.some(p => p.includes('/'))) {
            const flat = join(distAssets, f);
            if (statSync(flat).isFile()) rmSync(flat, { force: true });
          }
        }
      }

      // (b) Copy the whole assets/ tree verbatim (structure + stable names).
      cpSync(join(root, 'assets'), distAssets, { recursive: true });

      // (c) Copy root public files.
      for (const f of ROOT_PUBLIC) {
        const s = join(root, f);
        if (existsSync(s)) cpSync(s, join(dist, f));
      }

      // (d) Restore each emitted HTML to its EXACT source bytes. During
      //     Checkpoint A the served HTML must equal source byte-for-byte, so the
      //     authoritative restoration is simply the source file itself. This also
      //     restores every asset URL, the CSS query string (whatever it is), the
      //     <link> position and formatting — with nothing hard-coded.
      for (const p of PAGES) {
        const distFile = join(dist, p + '.html');
        const srcFile = join(root, p + '.html');
        if (existsSync(srcFile)) writeFileSync(distFile, readFileSync(srcFile));
      }
    },
  };
}

export default defineConfig({
  base: '',
  appType: 'mpa',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: false,
    rollupOptions: {
      input: Object.fromEntries(PAGES.map(p => [p, resolve(root, p + '.html')])),
      output: {
        assetFileNames: 'assets/[name][extname]',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
      },
    },
  },
  plugins: [plumlineBuild()],
});
