/* tests_engine_baseline_negative.js — Checkpoint E0 baseline negatives.
 *
 * Minimal negative coverage for the E0 guard: it must TRIP on an engine-byte
 * change, a missing/duplicated marker, a Worker-source/glue change, a request or
 * response contract change, an absolute path in the fixture, or a self-generated
 * fixture. NO parser/simplex/branch-and-bound negatives here (later phases).
 *
 * Each case copies the minimal tree to a temp dir, mutates it, runs the official
 * checkEngineBaseline(), asserts fail>0 AND a SPECIFIC failure message, then
 * cleans up. The checker is the same one the positive suite uses.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkEngineBaseline } = require('./tests_engine_baseline.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}

// Build a minimal tree with exactly what checkEngineBaseline reads.
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e0-'));
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'single-engine'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fragments', 'solver-ui'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'solver.html'), path.join(dir, 'solver.html'));
  fs.copyFileSync(path.join(SITE, 'engine', 'engine.js'), path.join(dir, 'engine', 'engine.js'));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'engine', 'generate-engine-mirror.js'), path.join(dir, 'engine', 'generate-engine-mirror.js'));
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'engine-platform-adapter.json'), path.join(dir, 'engine', 'source', 'engine-platform-adapter.json'));
  fs.copyFileSync(
    path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e0-baseline.json'),
    path.join(dir, 'engine', 'fixtures', 'single-engine', 'engine-e0-baseline.json'));
  // E1: checkEngineBaseline composes solver.html — copy ALL solver-UI fragments
  // and the internal canonical engine file so composition succeeds on the tree.
  for (const f of fs.readdirSync(path.join(SITE, 'engine', 'fragments', 'solver-ui'))) {
    fs.copyFileSync(path.join(SITE, 'engine', 'fragments', 'solver-ui', f),
      path.join(dir, 'engine', 'fragments', 'solver-ui', f));
  }
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'),
    path.join(dir, 'engine', 'source', 'plumline-engine.js'));
  return dir;
}
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const wr = (d, f, s) => fs.writeFileSync(path.join(d, f), s);

// expectCheckFail(label, mutate, needle): mutate the temp tree, run the checker
// ONCE, require fail>0 AND a failure containing the needle.
function expectCheckFail(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    const r = checkEngineBaseline(dir);
    const tripped = r.fail > 0;
    const matched = needle ? r.failures.some(m => m.includes(needle)) : false;
    ok(label + ' :: trips the guard', tripped, 'fail=' + r.fail);
    ok(label + ' :: specific message', matched, needle ? ('needle "' + needle + '" not in: ' + r.failures.join(' | ')) : 'no needle');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. Engine byte change (insert one space in the canonical engine file).
expectCheckFail('N1 engine one-byte change', dir => {
  const f = 'engine/source/plumline-engine.js';
  const s = rd(dir, f);
  wr(dir, f, s.slice(0, 200) + ' ' + s.slice(200));
}, 'engine sha256 == baseline canonical');

// 2. Missing START marker in the canonical file (composition must reject it).
expectCheckFail('N2 missing ENGINE_START marker', dir => {
  const f = 'engine/source/plumline-engine.js';
  wr(dir, f, rd(dir, f).replace('/* ENGINE_START */', '/* ENGINE_XSTART */'));
}, 'solver composes (engine source valid)');

// 3. Duplicated START marker in the canonical file (changes the engine bytes).
expectCheckFail('N3 duplicated ENGINE_START marker', dir => {
  const f = 'engine/source/plumline-engine.js';
  const s = rd(dir, f);
  wr(dir, f, s.replace('/* ENGINE_START */', '/* ENGINE_START */\n/* ENGINE_START */'));
}, 'engine sha256 == baseline canonical');

// 4. Worker glue changed in the fragment (contract drift).
expectCheckFail('N4 worker onmessage contract changed', dir => {
  const f = path.join('engine', 'fragments', 'solver-ui', 'solve-worker-client.js');
  wr(dir, f, rd(dir, f).replace(
    'self.postMessage({token:d.token,ok:true,out:out,wholeNumbers:model.wholeNumbers});',
    'self.postMessage({token:d.token,ok:true,out:out});'));
}, 'worker fragment contains the pinned onmessage contract');

// 5. engineSource slice removed from fragment (Worker no longer slices the engine).
expectCheckFail('N5 worker engineSource slice removed', dir => {
  const f = path.join('engine', 'fragments', 'solver-ui', 'solve-worker-client.js');
  wr(dir, f, rd(dir, f).replace("txt.indexOf('/* ENGINE_START */')", "txt.indexOf('/* NOPE */')"));
}, 'worker fragment slices ENGINE_START..END for engineSource');

// 6. Add-on twin engine.js changed by one byte.
expectCheckFail('N6 engine.js twin one-byte change', dir => {
  const f = path.join('engine', 'engine.js');
  wr(dir, f, rd(dir, f) + '\n/* stray */\n');
}, 'live engine.js is the generated mirror (current-state authority: E6)');

// 7. Fixture contains an absolute path.
expectCheckFail('N7 fixture absolute path', dir => {
  const f = path.join('engine', 'fixtures', 'single-engine', 'engine-e0-baseline.json');
  const j = JSON.parse(rd(dir, f));
  j.provenance.leak = '/home/user/secret/path';
  wr(dir, f, JSON.stringify(j, null, 2) + '\n');
}, 'E0 fixture has no absolute path');

// 8. Fixture self-generated / tampered (sha pin broken).
expectCheckFail('N8 fixture tampered (self-generation guard)', dir => {
  const f = path.join('engine', 'fixtures', 'single-engine', 'engine-e0-baseline.json');
  const j = JSON.parse(rd(dir, f));
  j.note = j.note + ' (tampered)';
  wr(dir, f, JSON.stringify(j, null, 2) + '\n');
}, 'E0 fixture sha256 matches pin (no self-generation)');

console.log('ENGINE BASELINE NEGATIVE (E0)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
