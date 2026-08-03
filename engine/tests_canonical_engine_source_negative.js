/* tests_canonical_engine_source_negative.js — Checkpoint E1 negatives (38).
 *
 * Each case copies a minimal tree, applies ONE mutation, runs the OFFICIAL
 * compositor (composeSolverInterface / composeEngineSource) or the OFFICIAL
 * checker (checkCanonicalEngineSource), asserts it trips, checks a SPECIFIC
 * message, and cleans up in finally. Integrity-style mutations (a byte, a
 * newline) may key on a canonical-hash message; every functional mutation
 * (markers, paths, contracts, divergences) keys on its own contract message —
 * never on a global hash alone. tests_e1_needle_audit.js enforces this.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { composeSolverInterface, composeEngineSource } = require('../src/shared/compose-solver.js');
const { checkCanonicalEngineSource } = require('./tests_canonical_engine_source.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}

const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const ENG_DIR = path.join('engine', 'source');
const CANON = 'plumline-engine.js';

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e1-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, ENG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'single-engine'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'solver.html'), path.join(dir, 'solver.html'));
  fs.copyFileSync(path.join(SITE, 'engine', 'engine.js'), path.join(dir, 'engine', 'engine.js'));
  fs.copyFileSync(path.join(SITE, 'engine', 'generate-engine-mirror.js'), path.join(dir, 'engine', 'generate-engine-mirror.js'));
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'engine-platform-adapter.json'), path.join(dir, 'engine', 'source', 'engine-platform-adapter.json'));
  fs.copyFileSync(path.join(SITE, ENG_DIR, CANON), path.join(dir, ENG_DIR, CANON));
  fs.copyFileSync(
    path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e1-source.json'),
    path.join(dir, 'engine', 'fixtures', 'single-engine', 'engine-e1-source.json'));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  return dir;
}
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const wr = (d, f, s) => fs.writeFileSync(path.join(d, f), s);
const solverP = 'solver.html';
const canonP = path.join(ENG_DIR, CANON);
const fixtureP = path.join('engine', 'fixtures', 'single-engine', 'engine-e1-source.json');

// expectThrow: mutate, run the compositor, require it throws mentioning needle.
function expectThrow(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    let threw = false, msg = '';
    try { composeSolverInterface(rd(dir, solverP), dir); }
    catch (e) { threw = true; msg = e.message; }
    ok(label + ' :: compositor throws', threw, 'did not throw');
    ok(label + ' :: message mentions "' + needle + '"', threw && msg.indexOf(needle) !== -1,
      'got: ' + msg);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// expectCheckFail: mutate, run the official checker, require fail>0 + needle.
function expectCheckFail(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    const res = checkCanonicalEngineSource(dir);
    ok(label + ' :: checker trips', res.fail > 0, 'fail=' + res.fail);
    ok(label + ' :: message mentions "' + needle + '"',
      res.failures.some(m => m.indexOf(needle) !== -1), 'got: ' + res.failures.join(' | '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const ESRC_START = '/* SOLVER_ENGINE_SOURCE_START:plumline-engine.js */';
const ESRC_END = '/* SOLVER_ENGINE_SOURCE_END */';

// ---- Marker contracts ---------------------------------------------------------
// 1. Engine source start marker absent.
expectThrow('N1 source start marker absent', dir => {
  wr(dir, solverP, rd(dir, solverP).replace(ESRC_START, '/* NOPE_START */'));
}, 'unbalanced ENGINE_SOURCE markers');
// 2. Engine source end marker absent.
expectThrow('N2 source end marker absent', dir => {
  wr(dir, solverP, rd(dir, solverP).replace(ESRC_END, '/* NOPE_END */'));
}, 'unbalanced ENGINE_SOURCE markers');
// 3. Duplicated source start marker.
expectThrow('N3 source start marker duplicated', dir => {
  // Duplicate ONLY the start marker (leaves one end) -> unbalanced.
  wr(dir, solverP, rd(dir, solverP).replace(ESRC_START, ESRC_START + '\n' + ESRC_START));
}, 'unbalanced ENGINE_SOURCE markers');
// 4. Markers inverted (END before START).
expectThrow('N4 markers inverted', dir => {
  const s = rd(dir, solverP);
  wr(dir, solverP, s.replace(ESRC_START + '\n' + ESRC_END, ESRC_END + '\n' + ESRC_START));
}, 'ENGINE_SOURCE_END before START');
// 5. Residual content between markers.
expectThrow('N5 residual content between markers', dir => {
  wr(dir, solverP, rd(dir, solverP).replace(ESRC_START + '\n' + ESRC_END,
    ESRC_START + '\nLEFTOVER\n' + ESRC_END));
}, 'unexpected content between ENGINE_SOURCE markers');

// ---- Source file contracts ----------------------------------------------------
// 6. Canonical source file missing.
expectThrow('N6 canonical source missing', dir => {
  fs.unlinkSync(path.join(dir, canonP));
}, 'engine source file not found');
// 7. Canonical source empty.
expectThrow('N7 canonical source empty', dir => {
  wr(dir, canonP, '');
}, 'engine source');
// 8. Canonical source does not begin with ENGINE_START.
expectThrow('N8 canonical missing ENGINE_START', dir => {
  wr(dir, canonP, rd(dir, canonP).replace('/* ENGINE_START */', '/* XSTART */'));
}, 'engine source must begin with ENGINE_START');
// 9. Canonical source contains ENGINE_END (wrong representation).
expectThrow('N9 canonical contains ENGINE_END', dir => {
  wr(dir, canonP, rd(dir, canonP) + '\n/* ENGINE_END */');
}, 'engine source must not contain ENGINE_END');

// ---- Path safety (mutate the source marker's declared file) -------------------
// 10. Absolute path in the source marker.
expectThrow('N10 absolute path', dir => {
  wr(dir, solverP, rd(dir, solverP).replace('plumline-engine.js */', '/etc/passwd */'));
}, 'engine source must be plumline-engine.js');
// 11. Path traversal.
expectThrow('N11 path traversal', dir => {
  wr(dir, solverP, rd(dir, solverP).replace('plumline-engine.js */', '../engine.js */'));
}, 'engine source must be plumline-engine.js');
// 12. Subdirectory not allowed.
expectThrow('N12 subdirectory not allowed', dir => {
  wr(dir, solverP, rd(dir, solverP).replace('plumline-engine.js */', 'sub/plumline-engine.js */'));
}, 'engine source must be plumline-engine.js');
// 13. Disallowed file name.
expectThrow('N13 disallowed name', dir => {
  wr(dir, solverP, rd(dir, solverP).replace('plumline-engine.js */', 'other.js */'));
}, 'engine source must be plumline-engine.js');

// ---- Engine byte / newline / include-exclude (checker, hash-keyed OK) ---------
// 14. One byte of the engine changed.
expectCheckFail('N14 engine one-byte change', dir => {
  const s = rd(dir, canonP); wr(dir, canonP, s.slice(0, 200) + ' ' + s.slice(200));
}, 'canonical source sha256 == fixture');
// 15. A newline in the engine changed (CRLF injected).
expectCheckFail('N15 engine newline changed', dir => {
  const s = rd(dir, canonP); wr(dir, canonP, s.replace('\n', '\r\n'));
}, 'canonical source is LF only (no CRLF)');
// 16. Wrong include/exclude convention (append the END marker => representation A/B mix).
expectThrow('N16 wrong include-exclude convention', dir => {
  wr(dir, canonP, rd(dir, canonP) + '/* ENGINE_END */');
}, 'engine source must not contain ENGINE_END');

// ---- Direct path --------------------------------------------------------------
// 17. Direct path loses a function (rename runSolve in a UI fragment).
expectCheckFail('N17 direct path loses runSolve', dir => {
  const f = path.join(FRAG_DIR, 'solve-orchestration.js');
  wr(dir, f, rd(dir, f).replace('function runSolve(', 'function runSolveX('));
}, 'direct path: runSolve present');

// ---- engineSource / glue / separator / Blob -----------------------------------
// 18. engineSource uses different boundaries.
expectCheckFail('N18 engineSource boundaries changed', dir => {
  const f = path.join(FRAG_DIR, 'solve-worker-client.js');
  wr(dir, f, rd(dir, f).replace("txt.indexOf('/* ENGINE_START */')", "txt.indexOf('/* NOPE */')"));
}, 'worker engineSource() slices ENGINE_START..END');
// 19. Worker glue changed (onmessage contract).
expectCheckFail('N19 worker glue changed', dir => {
  const f = path.join(FRAG_DIR, 'solve-worker-client.js');
  wr(dir, f, rd(dir, f).replace(
    'self.postMessage({token:d.token,ok:true,out:out,wholeNumbers:model.wholeNumbers});',
    'self.postMessage({token:d.token,ok:true,out:out});'));
}, 'worker onmessage contract pinned');
// 20. Blob separator changed in the fixture (declares 2 instead of 1).
expectCheckFail('N20 blob separator changed', dir => {
  const j = JSON.parse(rd(dir, fixtureP)); j.worker.separator.position_offset = 99999;
  wr(dir, fixtureP, JSON.stringify(j, null, 2));
}, 'blob separator is a single LF at offset 82697');
// 21. Blob total size wrong in fixture.
expectCheckFail('N21 blob total wrong', dir => {
  const j = JSON.parse(rd(dir, fixtureP)); j.worker.blob_source_bytes = 83599;
  wr(dir, fixtureP, JSON.stringify(j, null, 2));
}, 'blob source bytes == 83598');

// ---- request / response / token / fallback ------------------------------------
// 22. Request contract field removed from the fragment.
expectCheckFail('N22 request contract changed', dir => {
  // Remove the request 'formulas'/'token' fields from the worker client fragment.
  const f = path.join(FRAG_DIR, 'solve-worker-client.js');
  wr(dir, f, rd(dir, f).replace(/formulas/g, 'formulaz').replace(/\btoken\b/g, 'tok3n'));
}, 'worker request contract carries the pinned fields');
// 23. Response contract changed (ok:true payload).
expectCheckFail('N23 response contract changed', dir => {
  const f = path.join(FRAG_DIR, 'solve-worker-client.js');
  wr(dir, f, rd(dir, f).replace('ok:true,out:out,wholeNumbers:model.wholeNumbers', 'ok:true,out:out'));
}, 'worker onmessage contract pinned');
// 24. Token guard removed.
expectCheckFail('N24 token guard removed', dir => {
  const f = path.join(FRAG_DIR, 'solve-worker-client.js');
  wr(dir, f, rd(dir, f).replace(/workerToken/g, 'wtoken'));
}, 'worker token stale guard present');
// 25. Fallback removed (solveMainThread renamed).
expectCheckFail('N25 fallback removed', dir => {
  const f = path.join(FRAG_DIR, 'solve-orchestration.js');
  wr(dir, f, rd(dir, f).replace('function solveMainThread(', 'function solveMainThreadX('));
}, 'direct path: solveMainThread fallback present');

// ---- Publication --------------------------------------------------------------
// 26. A SOLVER_UI marker inside the engine (canonical file).
expectThrow('N26 UI marker inside engine', dir => {
  const s = rd(dir, canonP);
  wr(dir, canonP, s.slice(0, 100) + '\n/* SOLVER_UI_GRID_INTERACTION_START:x.js */\n/* SOLVER_UI_GRID_INTERACTION_END */\n' + s.slice(100));
}, 'inside the engine region');
// 27. Canonical published under assets (checker: internal-path contract).
expectCheckFail('N27 canonical source removed from internal dir', dir => {
  // The internal canonical file is gone (e.g. moved to a public dir): the checker
  // must report the canonical source is not present at its internal path.
  fs.unlinkSync(path.join(dir, canonP));
}, 'canonical source present');

// ---- Mirror inventory ---------------------------------------------------------
// 28. engine/engine.js modified accidentally (byte change).
expectCheckFail('N28 mirror engine.js modified', dir => {
  const f = path.join('engine', 'engine.js');
  wr(dir, f, rd(dir, f) + '\n/* stray */\n');
}, 'mirror engine.js matches the generator output (E6 authority)');
// 29. A third divergence introduced in the canonical (change a shared fn body).
expectCheckFail('N29 third divergence', dir => {
  const s = rd(dir, canonP);
  // change a literal inside a shared, currently-equivalent function (EPSILON use in isWhole_)
  wr(dir, canonP, s.replace('function toSet_(', 'function toSet_(/*x*/').replace('return set;', 'return (set);'));
}, 'exactly the two approved divergences');
// 30. A shared function vanished from the canonical.
expectCheckFail('N30 shared function vanished', dir => {
  const s = rd(dir, canonP);
  wr(dir, canonP, s.replace('function senseFor_', 'function senseForX_'));
}, 'no production-only functions');
// 31. Constant changed in the canonical (divergent constant).
expectCheckFail('N31 constant divergent', dir => {
  wr(dir, canonP, rd(dir, canonP).replace('EPSILON: 1e-9', 'EPSILON: 1e-8'));
}, 'engine constants intact and non-divergent');

// ---- Fixture safety -----------------------------------------------------------
// 32. Fixture contains an absolute path.
expectCheckFail('N32 fixture absolute path', dir => {
  const j = JSON.parse(rd(dir, fixtureP)); j.provenance.leak = '/home/user/secret/path';
  wr(dir, fixtureP, JSON.stringify(j, null, 2));
}, 'E1 fixture has no absolute path');
// 33. Fixture engine sha tampered (self-generation guard proxy).
expectCheckFail('N33 fixture engine sha tampered', dir => {
  const j = JSON.parse(rd(dir, fixtureP)); j.canonical_source.sha256 = 'deadbeef';
  wr(dir, fixtureP, JSON.stringify(j, null, 2));
}, 'canonical source sha256 == fixture');
// 34. Fixture composed sha tampered.
expectCheckFail('N34 fixture composed sha tampered', dir => {
  const j = JSON.parse(rd(dir, fixtureP)); j.composed.composed_solver_sha256 = 'deadbeef';
  wr(dir, fixtureP, JSON.stringify(j, null, 2));
}, 'composed solver sha256 == fixture');

// ---- Engine markers in composed output ----------------------------------------
// 35. Composed output loses ENGINE_END (canonical gains a stray END so region breaks).
expectThrow('N35 engine markers break composition', dir => {
  // put an ENGINE_END inside the canonical -> composer rejects
  const s = rd(dir, canonP);
  wr(dir, canonP, s.slice(0, 500) + '/* ENGINE_END */' + s.slice(500));
}, 'engine source must not contain ENGINE_END');

// ---- inline engine in source (double engine) ----------------------------------
// 36. Source carries BOTH an ENGINE_START marker AND the source markers.
expectThrow('N36 source has inline engine and markers', dir => {
  const s = rd(dir, solverP);
  wr(dir, solverP, s.replace(ESRC_START, '/* ENGINE_START */ var leak=1; ' + ESRC_START));
}, 'source carries an ENGINE_SOURCE marker AND an inline engine region');

// ---- dist / requests (checker over a built tree not available in temp) --------
// 37. Fixture requests count wrong.
expectCheckFail('N37 requests count wrong', dir => {
  const j = JSON.parse(rd(dir, fixtureP)); j.requests = 7;
  wr(dir, fixtureP, JSON.stringify(j, null, 2));
}, 'six requests (fixture)');

// ---- spaced path --------------------------------------------------------------
// 38. Run the checker from a spaced-path tree with a mutated engine (must still trip correctly).
(function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e1 spc-'));
  try {
    fs.mkdirSync(path.join(base, ENG_DIR), { recursive: true });
    fs.mkdirSync(path.join(base, FRAG_DIR), { recursive: true });
    fs.mkdirSync(path.join(base, 'engine', 'fixtures', 'single-engine'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'solver.html'), path.join(base, 'solver.html'));
    fs.copyFileSync(path.join(SITE, 'engine', 'engine.js'), path.join(base, 'engine', 'engine.js'));
    fs.copyFileSync(path.join(SITE, 'engine', 'generate-engine-mirror.js'), path.join(base, 'engine', 'generate-engine-mirror.js'));
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'engine-platform-adapter.json'), path.join(base, 'engine', 'source', 'engine-platform-adapter.json'));
    fs.copyFileSync(path.join(SITE, ENG_DIR, CANON), path.join(base, ENG_DIR, CANON));
    fs.copyFileSync(path.join(SITE, fixtureP), path.join(base, fixtureP));
    for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
      fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(base, FRAG_DIR, f));
    }
    // clean tree passes:
    const clean = checkCanonicalEngineSource(base);
    ok('N38 spaced-path clean tree passes', clean.fail === 0, clean.failures.join('; '));
    // mutate engine -> trips:
    const cp = path.join(base, canonP);
    const s = fs.readFileSync(cp, 'utf8');
    fs.writeFileSync(cp, s.slice(0, 200) + ' ' + s.slice(200));
    const bad = checkCanonicalEngineSource(base);
    ok('N38 spaced-path mutation trips', bad.fail > 0 &&
      bad.failures.some(m => m.indexOf('canonical source sha256 == fixture') !== -1));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

console.log('CANONICAL ENGINE SOURCE NEGATIVE (E1)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
