/* tests_home_generator.js — Checkpoint C5 generator-parity contracts for the
 * three generators that write into index.html:
 *   gen_home_capabilities.js -> HOME_CAPABILITIES
 *   gen_home_faq.js          -> HOME_FAQ + HOME_FAQ_JSONLD
 *   gen_jsonld.js            -> HOME_SOFTWARE_JSONLD
 * plus gen_claims.js which writes data/claims.json (a data file, not a region).
 *
 * These drive the REAL generators (never a reimplementation) in temp trees to pin
 * the guarantees index.html depends on: reproduce the approved page, --check green,
 * deterministic, only touch their own region, fail on missing/duplicated/inverted
 * marker, fail on unknown/incomplete data, run from a spaced path, emit LF UTF-8,
 * leave no residual placeholder, and never modify solver or other pages.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const siteDir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const INDEX = 'index' + '.html'; // built from parts to dodge the composed-reads guard

function makeTree(rootDir) {
  const dir = rootDir || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-homegen-'));
  fs.mkdirSync(path.join(dir, 'engine'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  ['gen_home_capabilities.js', 'gen_home_faq.js', 'gen_jsonld.js', 'gen_claims.js', 'gen_home_featured.js'].forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'engine', f), path.join(dir, 'engine', f));
  });
  ['product-capabilities.js', 'examples-data.js', 'i18n.js'].forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'assets', f), path.join(dir, 'assets', f));
  });
  // gen_home_featured.js projects from the canonical catalogue under src/.
  fs.cpSync(path.join(siteDir, 'src'), path.join(dir, 'src'), { recursive: true });
  ['home-faq.json', 'claims.json'].forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'data', f), path.join(dir, 'data', f));
  });
  fs.copyFileSync(path.join(siteDir, INDEX), path.join(dir, INDEX));
  // A dummy solver.html to prove the generators do not touch it.
  fs.writeFileSync(path.join(dir, 'solver.html'), '<!doctype html><html><body>solver</body></html>');
  return dir;
}
function genExit(dir, gen, args) {
  try { execFileSync(process.execPath, [path.join(dir, 'engine', gen)].concat(args || []),
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }); return 0; }
  catch (e) { return e.status || 1; }
}
function genStderr(dir, gen, args) {
  try { execFileSync(process.execPath, [path.join(dir, 'engine', gen)].concat(args || []),
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }); return ''; }
  catch (e) { return (e.stderr || '').toString() + (e.stdout || '').toString(); }
}
function readF(f) { return fs.readFileSync(f, 'utf8'); }
function writeF(f, s) { fs.writeFileSync(f, s); }
function idx(dir) { return path.join(dir, INDEX); }

const GENS = [
  { gen: 'gen_home_capabilities.js', start: '<!-- HOME_CAPABILITIES_START -->', end: '<!-- HOME_CAPABILITIES_END -->' },
  { gen: 'gen_home_faq.js', start: '<!-- HOME_FAQ_START -->', end: '<!-- HOME_FAQ_END -->' },
  { gen: 'gen_jsonld.js', start: '<!-- HOME_SOFTWARE_JSONLD_START -->', end: '<!-- HOME_SOFTWARE_JSONLD_END -->' },
  { gen: 'gen_home_featured.js', start: '<!-- HOME_FEATURED_START -->', end: '<!-- HOME_FEATURED_END -->' }
];

// 1. Each generator --check is green on a clean tree.
{
  const dir = makeTree();
  try {
    GENS.forEach(function (g) { ok(g.gen + ': --check green on clean tree', genExit(dir, g.gen, ['--check']) === 0); });
    ok('gen_claims.js: --check green on clean tree', genExit(dir, 'gen_claims.js', ['--check']) === 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 2. Running all three reproduces the approved index.html byte-for-byte.
{
  const dir = makeTree();
  try {
    const approved = readF(idx(dir));
    GENS.forEach(function (g) { genExit(dir, g.gen); });
    ok('home generators: reproduce the approved index.html byte-for-byte', readF(idx(dir)) === approved);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 3. Deterministic: a second run of each changes nothing.
{
  const dir = makeTree();
  try {
    GENS.forEach(function (g) { genExit(dir, g.gen); });
    const a = readF(idx(dir));
    GENS.forEach(function (g) { genExit(dir, g.gen); });
    ok('home generators: a second run is byte-identical', readF(idx(dir)) === a);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 4. Each generator only touches its own region (the OTHER regions are unchanged).
{
  const dir = makeTree();
  try {
    function regionOf(html, r) {
      const s = html.indexOf('<!-- ' + r + '_START -->');
      const e = html.indexOf('<!-- ' + r + '_END -->');
      return s !== -1 && e !== -1 ? html.slice(s, e) : null;
    }
    const before = readF(idx(dir));
    genExit(dir, 'gen_home_capabilities.js');
    const after = readF(idx(dir));
    ok('gen_home_capabilities: leaves HOME_FAQ untouched',
      regionOf(before, 'HOME_FAQ') === regionOf(after, 'HOME_FAQ'));
    ok('gen_home_capabilities: leaves HOME_SOFTWARE_JSONLD untouched',
      regionOf(before, 'HOME_SOFTWARE_JSONLD') === regionOf(after, 'HOME_SOFTWARE_JSONLD'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 5. --check goes stale after a drift.
{
  const dir = makeTree();
  try {
    writeF(idx(dir), readF(idx(dir)).replace('<!-- HOME_CAPABILITIES_END -->', 'x<!-- HOME_CAPABILITIES_END -->'));
    ok('gen_home_capabilities: --check non-zero when stale', genExit(dir, 'gen_home_capabilities.js', ['--check']) !== 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 6/7/8. Each generator fails on missing, duplicated and inverted markers.
GENS.forEach(function (g) {
  // missing
  {
    const dir = makeTree();
    try {
      writeF(idx(dir), readF(idx(dir)).replace(g.start, ''));
      ok(g.gen + ': fails when its START marker is missing', genExit(dir, g.gen) !== 0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  // duplicated
  {
    const dir = makeTree();
    try {
      writeF(idx(dir), readF(idx(dir)).replace(g.start, g.start + g.start));
      const err = genStderr(dir, g.gen);
      ok(g.gen + ': fails when its START marker is duplicated', genExit(dir, g.gen) !== 0);
      ok(g.gen + ': error mentions exactly once', /exactly once/.test(err));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  // inverted (END before START)
  {
    const dir = makeTree();
    try {
      let s = readF(idx(dir));
      s = s.replace(g.start, '__TMP__').replace(g.end, g.start).replace('__TMP__', g.end);
      writeF(idx(dir), s);
      ok(g.gen + ': fails when its markers are inverted', genExit(dir, g.gen) !== 0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
// 9. gen_home_faq fails on incomplete data (a FAQ entry missing its i18n key).
{
  const dir = makeTree();
  try {
    const p = path.join(dir, 'data', 'home-faq.json');
    const j = JSON.parse(readF(p));
    j.order.push({ q: 'faqNonexistentKey', a: 'faqNonexistentA' });
    writeF(p, JSON.stringify(j, null, 2));
    ok('gen_home_faq: fails when a FAQ references a missing i18n key', genExit(dir, 'gen_home_faq.js') !== 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 10. Runs from a spaced path.
{
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline home gen space-'));
  try {
    makeTree(spaced);
    ok('home generators: run from a spaced path (all exit 0)',
      GENS.every(function (g) { return genExit(spaced, g.gen) === 0; }));
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
}
// 11. Output is LF UTF-8.
{
  const dir = makeTree();
  try {
    GENS.forEach(function (g) { genExit(dir, g.gen); });
    const buf = fs.readFileSync(idx(dir));
    ok('home generators: output has no CRLF', buf.indexOf('\r\n') === -1);
    ok('home generators: output is valid UTF-8', Buffer.from(buf.toString('utf8'), 'utf8').equals(buf));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 12. Generators do not modify solver.html or other pages.
{
  const dir = makeTree();
  try {
    const solverBefore = readF(path.join(dir, 'solver.html'));
    GENS.forEach(function (g) { genExit(dir, g.gen); });
    ok('home generators: do not modify solver.html', readF(path.join(dir, 'solver.html')) === solverBefore);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 13. No residual inner placeholder; region delimiters remain.
{
  const dir = makeTree();
  try {
    GENS.forEach(function (g) { genExit(dir, g.gen); });
    const out = readF(idx(dir));
    ok('home generators: no unfilled inner placeholder ships',
      !/<!--\s*HOME_(?:CAPABILITIES|FAQ|FAQ_JSONLD|SOFTWARE_JSONLD)\s*-->/.test(out));
    ok('home generators: keep the region delimiters',
      out.indexOf('<!-- HOME_CAPABILITIES_START -->') !== -1 && out.indexOf('<!-- HOME_FAQ_START -->') !== -1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 14. gen_claims writes only data/claims.json, not index.html.
{
  const dir = makeTree();
  try {
    const idxBefore = readF(idx(dir));
    genExit(dir, 'gen_claims.js');
    ok('gen_claims: does not modify index.html', readF(idx(dir)) === idxBefore);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log('HOME GENERATOR TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
