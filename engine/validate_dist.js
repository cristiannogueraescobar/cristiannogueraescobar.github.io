/* validate_dist.js — validate the built dist/ before it is published.
 *
 * Checks, all against the ON-DISK build (not the source tree):
 *   1. dist/ exists.
 *   2. dist root contains EXACTLY the 8 public HTML pages (point 7).
 *   3. The 8 built HTML are BYTE-IDENTICAL to source; on any difference, print
 *      the first differing line and both SHA-256 hashes (point 5).
 *   4. Public files present, incl. the Google verification file (point 1).
 *   5. NO internal files leaked (single list from internal-paths.js; point 9).
 *   6. Engine markers intact + Worker source byte-identical to source.
 *   7. Every asset URL referenced by each page resolves in dist/.
 *   8. RECURSIVE asset parity: assets/ (source) vs dist/assets/ — no missing, no
 *      extra, no byte changes, excluding only assets/hashes.txt (point 8).
 *
 * Exit non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PUBLIC_FILES, PUBLIC_PAGES, ROOT_PUBLIC_VERBATIM, DIST_ROOT_ALLOWLIST, FORBIDDEN_AT_DIST_ROOT } = require('./internal-paths.js');
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

let fail = 0;
function ok(name, cond, detail) { if (!cond) { fail++; console.log('  FAIL:', name, detail || ''); } else { console.log('  ok:', name); } }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// 1. dist exists
ok('dist/ exists', fs.existsSync(dist));
if (!fs.existsSync(dist)) { console.log('VALIDATE DIST: FAILED (no dist)'); process.exit(1); }

// 2. EXACTLY the 8 HTML pages at dist root. The Google verification file also
//    ends in .html but is NOT a site page — exclude it from the page census.
const GOOGLE_VERIFY = 'google78ab86ec8c8a0812.html';
const rootHtml = fs.readdirSync(dist)
  .filter(f => f.endsWith('.html') && f !== GOOGLE_VERIFY).sort();
const expected = [...PUBLIC_PAGES].sort();
ok('dist root has exactly 8 HTML pages',
   rootHtml.length === expected.length && rootHtml.every((f, i) => f === expected[i]),
   'found: [' + rootHtml.join(', ') + ']');
const extraHtml = rootHtml.filter(f => !expected.includes(f));
const missingHtml = expected.filter(f => !rootHtml.includes(f));
if (extraHtml.length) ok('no extra HTML at dist root', false, 'extra: ' + extraHtml.join(', '));
if (missingHtml.length) ok('no missing HTML at dist root', false, 'missing: ' + missingHtml.join(', '));

// 2b. EXHAUSTIVE dist-root allowlist: every entry at dist root must be in the
//     allowlist. hashes.txt lives under assets/, not root, so it's not here.
//     This rejects style.css, stray scripts and temp files automatically.
const rootEntries = fs.readdirSync(dist).sort();
const notAllowed = rootEntries.filter(e => !DIST_ROOT_ALLOWLIST.includes(e));
ok('dist root contains only allowlisted entries', notAllowed.length === 0,
   'unexpected at dist root: [' + notAllowed.join(', ') + ']');
const allowedMissing = DIST_ROOT_ALLOWLIST.filter(e => !rootEntries.includes(e));
ok('dist root has all allowlisted entries', allowedMissing.length === 0,
   'missing at dist root: [' + allowedMissing.join(', ') + ']');

// 3. Parity for the 8 pages. Checkpoint B: pages MAY carry PLUMLINE: shell
//    markers in source. The Checkpoint A rule "dist == source byte-for-byte" is
//    REPLACED (not dropped) by an equal-or-stronger rule:
//      - source with markers  -> dist MUST equal composeHtml(source) exactly, and
//        the source markers must be valid (composeHtml throws otherwise), and no
//        PLUMLINE: marker may remain in dist.
//      - source without markers -> dist MUST equal source byte-for-byte (unchanged
//        Checkpoint A guarantee).
//    Either way the dist page is fully determined by the source: nothing
//    hand-injected, no runtime fetch, no unresolved marker.
const { composeHtml } = require('../src/shared/compose-shell.js');
const { composeSolverIfNeeded } = require('../src/shared/compose-solver.js');
for (const p of PUBLIC_PAGES) {
  const srcPath = path.join(root, p);
  const distPath = path.join(dist, p);
  if (!fs.existsSync(srcPath) || !fs.existsSync(distPath)) {
    ok('parity ' + p, false, 'missing source or dist file'); continue;
  }
  const srcBuf = fs.readFileSync(srcPath), distBuf = fs.readFileSync(distPath);
  const srcText = srcBuf.toString('utf8');
  const hasShellMarkers = /<!--\s*PLUMLINE:/.test(srcText);
  const hasSolverMarkers = /\/\* SOLVER_UI_/.test(srcText);
  let expectedBuf;
  if (hasShellMarkers || hasSolverMarkers) {
    let composed = srcText;
    try {
      // Canonical order: shell (B1) first, then solver UI (D). Each step is a
      // no-op when its markers are absent.
      if (hasShellMarkers) composed = composeHtml(composed, p);
      composed = composeSolverIfNeeded(composed, p, root);
    }
    catch (e) { ok('composes cleanly: ' + p, false, e.message); continue; }
    if (/<!--\s*PLUMLINE:/.test(composed) || /\/\* SOLVER_UI_/.test(composed)) { ok('no unresolved marker in dist: ' + p, false); continue; }
    expectedBuf = Buffer.from(composed, 'utf8');
    ok('composed shell resolves: ' + p, true);
  } else {
    expectedBuf = srcBuf;
  }
  if (expectedBuf.equals(distBuf)) { ok('dist matches expected (composed) source: ' + p, true); continue; }
  const s = expectedBuf.toString('utf8').split('\n'), d = distBuf.toString('utf8').split('\n');
  let ln = -1;
  for (let i = 0; i < Math.max(s.length, d.length); i++) { if (s[i] !== d[i]) { ln = i + 1; break; } }
  ok('dist matches expected (composed) source: ' + p, false,
     'first diff at line ' + ln +
     '\n      expected: ' + JSON.stringify((s[ln - 1] || '').slice(0, 120)) +
     '\n      dist:     ' + JSON.stringify((d[ln - 1] || '').slice(0, 120)) +
     '\n      sha256 expected=' + sha(expectedBuf) + ' dist=' + sha(distBuf));
}
// No dist page may contain an unresolved PLUMLINE: marker.
for (const p of PUBLIC_PAGES) {
  const distPath = path.join(dist, p);
  if (fs.existsSync(distPath)) {
    ok('no PLUMLINE marker in dist: ' + p,
       !/<!--\s*PLUMLINE:/.test(fs.readFileSync(distPath, 'utf8')));
  }
}

// 4. Public files present (includes the Google verification file)
for (const f of PUBLIC_FILES) ok('public file present: ' + f, fs.existsSync(path.join(dist, f)));
ok('assets/screenshots/ present', fs.existsSync(path.join(dist, 'assets', 'screenshots')));
ok('assets/capabilities/ present', fs.existsSync(path.join(dist, 'assets', 'capabilities')));

// Root public files must be byte-identical to their repo source (point 7 + the
// A.1-final build-info guard). During `npm run verify` build-info.json is still
// the DEV-LOCAL placeholder — CI stamps the real SHA only AFTER verify — so here
// it must match the source placeholder byte-for-byte. Losing or altering any of
// these (CNAME, robots, sitemap, .nojekyll, google verification, build-info)
// would break the domain, SEO, verification or the deploy provenance, so guard
// them all byte-for-byte.
for (const f of ROOT_PUBLIC_VERBATIM) {
  const s = path.join(root, f), d = path.join(dist, f);
  if (fs.existsSync(s) && fs.existsSync(d)) {
    ok('root public byte-identical: ' + f, fs.readFileSync(s).equals(fs.readFileSync(d)));
  } else {
    ok('root public present in source and dist: ' + f,
       fs.existsSync(s) && fs.existsSync(d),
       'missing in ' + (fs.existsSync(s) ? 'dist' : 'source'));
  }
}

// 5. No internal files leaked at dist root. hashes.txt is written later by CI.
for (const f of FORBIDDEN_AT_DIST_ROOT) {
  ok('internal NOT published: ' + f, !fs.existsSync(path.join(dist, f)), 'leaked into dist');
}
const walk = (d, base = d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full, base, acc); else acc.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return acc;
};
const distRel = walk(dist);
const strayMd = distRel.filter(f => f.endsWith('.md'));
ok('no .md files in dist', strayMd.length === 0, strayMd.join(', '));
const strayTests = distRel.filter(f => /(^|\/)tests_.*\.js$/.test(f) || /(^|\/)run_all\.js$/.test(f));
ok('no test files in dist', strayTests.length === 0, strayTests.join(', '));
const strayPy = distRel.filter(f => f.endsWith('.py'));
ok('no .py files in dist', strayPy.length === 0, strayPy.join(', '));

// 6. Engine markers + Worker source parity. E1: the production engine source is
//    the internal canonical file engine/source/plumline-engine.js (the official
//    slice: includes ENGINE_START, excludes ENGINE_END). dist/solver.html must
//    carry the engine bytes byte-identically to that canonical file.
function engineSlice(file) {
  const s = fs.readFileSync(file, 'utf8');
  const a = s.indexOf('/* ENGINE_START */'), b = s.indexOf('/* ENGINE_END */');
  return (a !== -1 && b !== -1 && b > a) ? s.slice(a, b) : null;
}
const canonicalEngine = fs.readFileSync(path.join(root, 'engine', 'source', 'plumline-engine.js'), 'utf8');
const distEngine = engineSlice(path.join(dist, 'solver.html'));
ok('dist/solver.html has engine markers', distEngine !== null);
ok('engine byte-identical to canonical source (Worker parity)',
   distEngine !== null && canonicalEngine === distEngine,
   distEngine !== null ? ('canonical ' + canonicalEngine.length + ' vs dist ' + distEngine.length) : 'missing');

// 6a. E1 canonical-engine publication contract: engine/source is internal and
//     must NEVER be published; no SOLVER_ENGINE_SOURCE marker and no reference
//     to the canonical file may appear in the public dist.
{
  const distSolverText = fs.readFileSync(path.join(dist, 'solver.html'), 'utf8');
  ok('dist/solver.html has no SOLVER_ENGINE_SOURCE marker', distSolverText.indexOf('SOLVER_ENGINE_SOURCE') === -1);
  ok('dist/solver.html has no canonical engine path', distSolverText.indexOf('plumline-engine.js') === -1);
  ok('engine/source not published under dist', !fs.existsSync(path.join(dist, 'engine', 'source')));
  ok('canonical engine file not published under dist',
     !fs.existsSync(path.join(dist, 'engine', 'source', 'plumline-engine.js')));
  // structural ENGINE_START/END must remain in the public output (part of the contract)
  ok('dist/solver.html keeps structural ENGINE_START', distSolverText.indexOf('/* ENGINE_START */') !== -1);
  ok('dist/solver.html keeps structural ENGINE_END', distSolverText.indexOf('/* ENGINE_END */') !== -1);
}

// 6b. Solver publication contract: the PUBLIC dist/solver.html must carry no
//     SOLVER_UI composition marker and no reference to the internal fragment
//     directory, and no fragment file may be published under dist. This is the
//     authoritative post-build home for these checks (the per-phase solver
//     checkers validate the COMPOSED page via the canonical composer and never
//     read dist, so their assertion count stays independent of dist state).
{
  const distSolverText = fs.readFileSync(path.join(dist, 'solver.html'), 'utf8');
  ok('dist/solver.html has no SOLVER_UI marker', !/\/\* SOLVER_UI_/.test(distSolverText));
  ok('dist/solver.html has no fragment path', distSolverText.indexOf('solver-ui/') === -1);
  ok('no solver-ui fragment dir published under dist',
     !fs.existsSync(path.join(dist, 'engine', 'fragments')));
}

// 7. Every asset URL each page references resolves in dist
for (const p of PUBLIC_PAGES) {
  const html = fs.readFileSync(path.join(dist, p), 'utf8');
  const urls = [...html.matchAll(/(?:src|href|srcset)="((?:\.\/)?assets\/[^"]+)"/g)]
    .map(m => m[1].replace(/^\.\//, '').split('?')[0]);
  for (const u of new Set(urls)) {
    ok(p + ' -> ' + u + ' exists', fs.existsSync(path.join(dist, u)), 'missing asset');
  }
}

// 8. RECURSIVE asset parity: source assets/ vs dist/assets/ (exclude hashes.txt).
function relFiles(dir) {
  const out = new Set();
  if (!fs.existsSync(dir)) return out;
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) rec(full);
      else out.add(path.relative(dir, full).split(path.sep).join('/'));
    }
  })(dir);
  return out;
}
const srcAssets = relFiles(path.join(root, 'assets'));
const distAssets = relFiles(path.join(dist, 'assets'));
distAssets.delete('hashes.txt');           // generated later by CI
srcAssets.delete('hashes.txt');
const missingAssets = [...srcAssets].filter(f => !distAssets.has(f));
const extraAssets = [...distAssets].filter(f => !srcAssets.has(f));
ok('no missing assets in dist', missingAssets.length === 0, missingAssets.join(', '));
ok('no extra assets in dist', extraAssets.length === 0, extraAssets.join(', '));
let byteDiffs = 0;
for (const f of srcAssets) {
  if (!distAssets.has(f)) continue;
  const a = fs.readFileSync(path.join(root, 'assets', f));
  const b = fs.readFileSync(path.join(dist, 'assets', f));
  if (!a.equals(b)) { byteDiffs++; ok('asset byte-identical: ' + f, false, 'differs'); }
}
ok('all assets byte-identical (source vs dist)', byteDiffs === 0, byteDiffs + ' differ');

console.log(fail ? ('VALIDATE DIST: FAILED (' + fail + ')') : 'VALIDATE DIST: OK');
process.exit(fail ? 1 : 0);
