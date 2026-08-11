/* Checkpoint F6 (Examples library UI) — protected-baseline guard.
 *
 * F6 owns examples.html and introduced the Examples library UI. This suite pins the
 * F6-OWNED UI / runtime-logic / projector / generator that a later checkpoint (F7,
 * expand 9->60) MUST NOT redesign, so the library's behaviour and look stay stable
 * while F7 only adds DATA. It deliberately does NOT pin examples.html or
 * assets/examples-library.js (both grow with the catalogue and are pinned to their
 * F6 state by the F4b/F5 baselines); this keeps "F7 adds data without touching F6 UI"
 * enforceable.
 *
 * Positive: manifest exists, exactly the expected set, each file matches SHA-256 + bytes.
 * Negative: mutating ANY protected F6 file trips the checker; adding/removing a
 * protected path trips the exact-set contract; the set does not silently include
 * data-bearing outputs (examples.html / examples-library.js).
 *
 * Node built-ins only; Windows-safe (no shell tools). LF.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }
function sha256(p) { return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null; }

// The single official checker: verify a site tree against the F6 baseline manifest.
function checkF6Protected(siteDir) {
  const p = 0; let localPass = 0, localFail = 0; const probs = [];
  function chk(cond, msg) { if (cond) localPass++; else { localFail++; probs.push(msg); } }
  const mPath = path.join(siteDir, 'engine', 'f6-protected-baseline.json');
  if (!fs.existsSync(mPath)) { return { pass: 0, fail: 1, problems: ['manifest missing'] }; }
  let man;
  try { man = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch (e) { return { pass: 0, fail: 1, problems: ['manifest parse: ' + e.message] }; }
  const files = man.files || [];
  // exact count
  chk(files.length === man.expectedCount, 'expectedCount ' + man.expectedCount + ' vs files ' + files.length);
  // no duplicate paths
  const paths = files.map(function (f) { return f.path; });
  chk(new Set(paths).size === paths.length, 'duplicate path');
  // data-bearing outputs must NOT be in the F6 set (they belong to F4b/F5)
  ['examples.html', 'assets/examples-library.js'].forEach(function (dp) {
    chk(paths.indexOf(dp) === -1, 'data-bearing path must not be F6-pinned: ' + dp);
  });
  // each file exists + matches sha + bytes
  files.forEach(function (entry) {
    const fp = path.join(siteDir, entry.path);
    chk(fs.existsSync(fp), 'missing: ' + entry.path);
    if (!fs.existsSync(fp)) return;
    const real = sha256(fp);
    chk(real === entry.sha256, 'sha changed: ' + entry.path);
    chk(fs.statSync(fp).size === entry.bytes, 'bytes changed: ' + entry.path);
  });
  return { pass: localPass, fail: localFail, problems: probs };
}

// ---- Positive ----
function runPositive() {
  const mPath = path.join(SITE, 'engine', 'f6-protected-baseline.json');
  ok('PB1: F6 protected-baseline manifest exists', fs.existsSync(mPath));
  if (!fs.existsSync(mPath)) return;
  let man;
  try { man = JSON.parse(fs.readFileSync(mPath, 'utf8')); ok('PB1: manifest parses', true); }
  catch (e) { ok('PB1: manifest parses', false, e.message); return; }

  const EXPECTED = [
    'assets/examples-library.css',
    'assets/examples-library.ui.js',
    'assets/examples-library-core.js',
    'src/shared/examples/f6/library.js',
    'engine/generate-examples-library.js'
  ];
  const paths = (man.files || []).map(function (f) { return f.path; });
  ok('PB1: exactly ' + EXPECTED.length + ' protected entries', paths.length === EXPECTED.length, String(paths.length));
  ok('PB1: expectedCount matches file list', man.expectedCount === (man.files || []).length);
  ok('PB1: no duplicate protected path', new Set(paths).size === paths.length);
  EXPECTED.forEach(function (p) { ok('PB1: expected F6 path present: ' + p, paths.indexOf(p) !== -1); });
  paths.forEach(function (p) { ok('PB1: manifest path is an expected F6 path: ' + p, EXPECTED.indexOf(p) !== -1, 'unexpected: ' + p); });

  // examples.html / examples-library.js must NOT be in the F6 set (data-bearing).
  ok('PB1: examples.html is NOT F6-pinned (data-bearing, lives in F4b/F5)', paths.indexOf('examples.html') === -1);
  ok('PB1: examples-library.js is NOT F6-pinned (generated data payload)', paths.indexOf('assets/examples-library.js') === -1);

  // Each protected file matches its baseline SHA-256 + byte size.
  (man.files || []).forEach(function (entry) {
    const fp = path.join(SITE, entry.path);
    ok('PB2: protected F6 file exists: ' + entry.path, fs.existsSync(fp));
    if (!fs.existsSync(fp)) return;
    const real = sha256(fp);
    ok('PB2: F6 protected hash unchanged: ' + entry.path, real === entry.sha256, real + ' vs ' + entry.sha256);
    ok('PB2: F6 protected byte size matches: ' + entry.path, fs.statSync(fp).size === entry.bytes, fs.statSync(fp).size + ' vs ' + entry.bytes);
  });

  // The official checker agrees on the live tree.
  const live = checkF6Protected(SITE);
  ok('PB2: official F6 checker passes on the live tree', live.fail === 0, live.problems.slice(0, 4).join('; '));
}

// ---- Negative: mutating any protected F6 file trips the checker ----
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline f6 pb '));
  // Copy the manifest + every protected file (preserving relative paths).
  fs.mkdirSync(path.join(dir, 'engine'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'engine', 'f6-protected-baseline.json'), path.join(dir, 'engine', 'f6-protected-baseline.json'));
  const man = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'f6-protected-baseline.json'), 'utf8'));
  man.files.forEach(function (entry) {
    const src = path.join(SITE, entry.path);
    const dst = path.join(dir, entry.path);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  });
  return { dir: dir, man: man };
}
function negative(label, mutate) {
  const t = makeTree();
  try {
    ok(label + ': clean copy passes the F6 checker', checkF6Protected(t.dir).fail === 0);
    mutate(t.dir, t.man);
    ok(label + ': mutation trips the F6 checker', checkF6Protected(t.dir).fail > 0);
  } finally { fs.rmSync(t.dir, { recursive: true, force: true }); }
}

function runNegatives() {
// Mutate the CSS (a byte change must trip the SHA guard).
negative('N1 (edit examples-library.css)', function (dir) {
  const fp = path.join(dir, 'assets', 'examples-library.css');
  fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8') + '\n/* stray */\n');
});
// Mutate the runtime UI module.
negative('N2 (edit examples-library.ui.js)', function (dir) {
  const fp = path.join(dir, 'assets', 'examples-library.ui.js');
  fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8') + '\n/* stray */\n');
});
// Mutate the pure core logic.
negative('N3 (edit examples-library-core.js)', function (dir) {
  const fp = path.join(dir, 'assets', 'examples-library-core.js');
  fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8') + '\n/* stray */\n');
});
// Mutate the view-model projector.
negative('N4 (edit f6/library.js)', function (dir) {
  const fp = path.join(dir, 'src', 'shared', 'examples', 'f6', 'library.js');
  fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8') + '\n/* stray */\n');
});
// Mutate the generator.
negative('N5 (edit generate-examples-library.js)', function (dir) {
  const fp = path.join(dir, 'engine', 'generate-examples-library.js');
  fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8') + '\n/* stray */\n');
});
// Truncate a protected file (bytes change).
negative('N6 (truncate the CSS)', function (dir) {
  const fp = path.join(dir, 'assets', 'examples-library.css');
  fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8').slice(0, 100));
});
// Remove a protected path from the manifest (exact-set contract).
negative('N7 (drop a protected entry from the manifest)', function (dir, man) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'engine', 'f6-protected-baseline.json'), 'utf8'));
  m.files = m.files.slice(1);
  fs.writeFileSync(path.join(dir, 'engine', 'f6-protected-baseline.json'), JSON.stringify(m, null, 2) + '\n');
});
// Add a data-bearing path to the F6 set (must be rejected).
negative('N8 (add examples.html to the F6 set)', function (dir, man) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'engine', 'f6-protected-baseline.json'), 'utf8'));
  m.files.push({ path: 'examples.html', sha256: 'x'.repeat(64), bytes: 1 });
  m.expectedCount = m.files.length;
  fs.writeFileSync(path.join(dir, 'engine', 'f6-protected-baseline.json'), JSON.stringify(m, null, 2) + '\n');
});
}

if (require.main === module) {
  runPositive();
  runNegatives();
  console.log('F6 PROTECTED BASELINE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  if (failures.length) failures.slice(0, 12).forEach(function (f) { console.log('  FAIL:', f); });
}
if (typeof module !== 'undefined') module.exports = { pass: pass, fail: fail, checkF6Protected: checkF6Protected };
if (require.main === module && fail > 0) process.exit(1);
