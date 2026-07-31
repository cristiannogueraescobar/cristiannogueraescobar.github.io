/* test_dist_http.js — serve dist/ over real HTTP and verify by HTTP, not disk.
 *
 * Starts a tiny static server rooted at dist/, then checks:
 *   - The 8 pages return 200.
 *   - Public assets (CSS, the 6 JS, a screenshot, a capabilities image) return 200.
 *   - Internal paths return 404 (they must never be in dist): engine/run_all.js,
 *     package.json, node_modules/..., vite.config.mjs, .github/... — these 404
 *     because they are NOT copied into dist (this test serves dist ONLY).
 *   - Every internal href/src across the 8 pages returns 200 (zero broken links).
 *
 * No external deps: uses Node's http + a minimal file server.
 * Exit non-zero on any failure.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { PUBLIC_FILES, INTERNAL_PATHS } = require('./internal-paths.js');
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(dist, rel);
  // Prevent path traversal; only serve within dist.
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; res.end('not found'); return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ code: res.statusCode, body }));
    }).on('error', () => resolve({ code: 0, body: '' }));
  });
}

let fail = 0;
function ok(name, cond, detail) { if (!cond) { fail++; console.log('  FAIL:', name, detail || ''); } }

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const BASE = 'http://127.0.0.1:' + port;

  const PAGES = ['/', '/solver.html', '/guide.html', '/examples.html',
                 '/capabilities.html', '/about.html', '/privacy.html', '/terms.html'];
  for (const p of PAGES) {
    const r = await get(BASE + p);
    ok('page 200: ' + p, r.code === 200, 'got ' + r.code);
  }

  // Public files (from the single source of truth), plus a couple of images to
  // prove the subfolders are served, and the Google verification file (point 1).
  const PUBLIC = [
    ...PUBLIC_FILES.map(f => '/' + f),
    '/assets/screenshots/hero-production-desktop.png',
    '/assets/capabilities/01-production-model-and-variable-settings.png',
  ];
  for (const p of PUBLIC) {
    const r = await get(BASE + p);
    ok('public 200: ' + p, r.code === 200, 'got ' + r.code);
  }

  // Internal / dev-only paths must 404 (never in dist). Single source of truth,
  // shared with validate_dist and the production smoke job.
  for (const rel of INTERNAL_PATHS) {
    const r = await get(BASE + '/' + rel);
    ok('internal 404: /' + rel, r.code === 404, 'got ' + r.code);
  }

  // Worker: the served solver.html must let engineSource() find the engine.
  const solver = await get(BASE + '/solver.html');
  ok('solver.html served 200', solver.code === 200);
  ok('served solver.html has engine markers',
     solver.body.includes('/* ENGINE_START */') && solver.body.includes('/* ENGINE_END */'));

  // Zero broken internal links across all pages (HTTP 200 for each href/src).
  const seen = new Set();
  for (const p of PAGES) {
    const r = await get(BASE + (p === '/' ? '/index.html' : p));
    // Strip <script> and <style> bodies first, so dynamically-built URL literals
    // inside inline JS (e.g. href="'+href+'") are never crawled as real links.
    const markup = r.body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
    const urls = [...markup.matchAll(/(?:src|href|srcset)="([^"]+)"/g)].map(m => m[1]);
    for (let u of urls) {
      if (/^(https?:|mailto:|tel:|\/\/|data:|#)/.test(u)) continue;
      // Skip anything that looks like a JS/template literal, not a real path.
      if (/[+'`${}]/.test(u)) continue;
      u = u.replace(/^\.\//, '').split('#')[0].split('?')[0];
      if (!u || seen.has(u)) continue;
      seen.add(u);
      const rr = await get(BASE + '/' + u);
      ok('link 200: ' + u, rr.code === 200, 'got ' + rr.code);
    }
  }

  // Manifest verification over HTTP, using the SAME shared module the production
  // smoke job uses (engine/verify_manifest.js). We generate a hashes.txt over the
  // built dist exactly as CI would (SHA-256 of every file except hashes.txt
  // itself), then verify every listed entry is served with a matching hash AND
  // that every real dist file is present in the manifest (requiredPaths). This
  // exercises the shared logic on every `npm run verify`, so the production check
  // can never silently drift from what is tested locally.
  const { verifyManifest } = require('./verify_manifest.js');
  const crypto = require('crypto');
  // Walk every real file in dist (excluding only assets/hashes.txt) → both the
  // manifest lines and the requiredPaths list come from the same walk.
  function distFilesRel() {
    const rels = [];
    (function rec(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { rec(full); continue; }
        const rel = './' + path.relative(dist, full).split(path.sep).join('/');
        if (rel === './assets/hashes.txt') continue;      // never self-list
        rels.push(rel);
      }
    })(dist);
    return rels;
  }
  const rels = distFilesRel();
  const requiredPaths = rels.slice();                     // every dist file must be listed
  const manifestText = rels
    .map(rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, rel.replace(/^\.\//, '')))).digest('hex') + '  ' + rel)
    .join('\n') + '\n';
  try {
    const { checked } = await verifyManifest({
      base: BASE, cb: String(Date.now()), fetchImpl: fetch, manifestText, requiredPaths,
    });
    ok('manifest: every dist file listed and served with matching SHA-256',
       checked === requiredPaths.length,
       'checked ' + checked + ' of ' + requiredPaths.length);
    if (!fail) console.log('  manifest: ' + checked + ' entries served with matching SHA-256 (all ' + requiredPaths.length + ' dist files required and present)');
  } catch (e) {
    ok('manifest verification', false, e.message);
  }

  server.close();
  console.log(fail ? ('DIST HTTP TESTS: FAILED (' + fail + ')') : 'DIST HTTP TESTS: OK (' + seen.size + ' links crawled)');
  process.exit(fail ? 1 : 0);
})();
