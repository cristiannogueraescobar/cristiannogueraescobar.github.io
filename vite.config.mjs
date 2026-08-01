import { defineConfig } from 'vite';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'fs';
import { createRequire } from 'module';

const root = dirname(fileURLToPath(import.meta.url));
// compose-shell is CommonJS (shared with Node test scripts that use require);
// load it here without converting the whole config to ESM-only.
const { composeHtml } = createRequire(import.meta.url)('./src/shared/compose-shell.js');

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

      // (d) Restore each emitted HTML to its source, THEN compose the shared
      //     shell. Checkpoint A restored the exact source bytes so served HTML
      //     equalled source byte-for-byte. Checkpoint B keeps that restoration
      //     (it still fixes asset URLs, the CSS query string, <link> position and
      //     formatting with nothing hard-coded) but adds one deterministic step:
      //     if the source contains PLUMLINE: shell markers, they are replaced with
      //     the fully-rendered header/footer at BUILD time (never fetched at
      //     runtime). Pages without markers are written through unchanged, so
      //     migration can proceed one page at a time. composeHtml is strict:
      //     missing/duplicate markers, unknown pageType, or a leftover marker all
      //     throw and fail the build.
      for (const p of PAGES) {
        const distFile = join(dist, p + '.html');
        const srcFile = join(root, p + '.html');
        if (!existsSync(srcFile)) continue;
        let html = readFileSync(srcFile, 'utf8');
        if (/<!--\s*PLUMLINE:/.test(html)) {
          html = composeHtml(html, p + '.html');
        }
        writeFileSync(distFile, html);
      }
    },
  };
}

// Compose the shared shell in BOTH dev and build, so `npm run dev` and
// `npm run build` produce identical HTML. transformIndexHtml runs in both modes;
// it replaces the PLUMLINE markers with the rendered shell. In build, closeBundle
// re-derives the final HTML from source (authoritative) — this hook keeps the dev
// server output identical to the built output.
function plumlineComposeShell() {
  return {
    name: 'plumline-compose-shell',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!/<!--\s*PLUMLINE:/.test(html)) return html;
        // composeHtml looks the label up in PAGE_CONTEXT by basename (e.g.
        // "solver.html"), but ctx.filename is an absolute path — normalize it.
        const raw = ctx && ctx.filename ? ctx.filename : 'page';
        const label = raw.replace(/\\/g, '/').split('/').pop();
        return composeHtml(html, label);
      },
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
  plugins: [plumlineComposeShell(), plumlineBuild()],
});
