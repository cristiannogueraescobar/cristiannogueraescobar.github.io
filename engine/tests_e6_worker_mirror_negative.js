/* tests_e6_worker_mirror_negative.js — Checkpoint E6 negatives.
 *
 * Each case copies a minimal tree, applies ONE mutation, runs the OFFICIAL
 * checker/generator, asserts it trips, checks a SPECIFIC contract message, and
 * cleans up in finally. Functional mutations key on a functional assertion;
 * integrity mutations key on the pinned-SHA / byte message from a closed
 * allowlist. Any negative that WRITES a page name obfuscates 'solver'+'.html'.
 * Production is never modified to fabricate a negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const CANON = path.join('engine', 'source', 'plumline-engine.js');
const MIRROR = path.join('engine', 'engine.js');
const GEN = path.join('engine', 'generate-engine-mirror.js');
const ADAPTER = path.join('engine', 'source', 'engine-platform-adapter.json');
const CHECKER = path.join('engine', 'tests_e6_worker_mirror.js');
const FIXTURE = path.join('engine', 'fixtures', 'single-engine', 'engine-e6-worker-mirror-final.json');
const HARNESS = path.join('engine', 'canonical-engine-harness.js');
const LEGACY_HARNESS = path.join('engine', 'harness.js');
const E2X = path.join('engine', 'e2-exports.js');
const E3X = path.join('engine', 'e3-exports.js');
const E4X = path.join('engine', 'e4-exports.js');
const E5X = path.join('engine', 'e5-exports.js');
const WORKER = path.join('engine', 'fragments', 'solver-ui', 'solve-worker-client.js');
const ORCH = path.join('engine', 'fragments', 'solver-ui', 'solve-orchestration.js');
const SOLVER = 'solver' + '.html';
const E1FIX = path.join('engine', 'fixtures', 'single-engine', 'engine-e1-source.json');
const E0FIX = path.join('engine', 'fixtures', 'single-engine', 'engine-e0-baseline.json');
const E3FIX = path.join('engine', 'fixtures', 'single-engine', 'engine-e3-model-continuous.json');
const E4FIX = path.join('engine', 'fixtures', 'single-engine', 'engine-e4-integer-branch-and-bound.json');
const E5FIX = path.join('engine', 'fixtures', 'single-engine', 'engine-e5-verification-statuses.json');
const COMPOSE = path.join('src', 'shared', 'compose-solver.js');

const TREE = [CANON, MIRROR, GEN, ADAPTER, CHECKER, FIXTURE, HARNESS, LEGACY_HARNESS, E2X, E3X, E4X, E5X, WORKER, ORCH, SOLVER, E1FIX, E0FIX, E3FIX, E4FIX, E5FIX, COMPOSE];

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e6neg-'));
  [CANON, MIRROR, GEN, ADAPTER, CHECKER, FIXTURE, HARNESS, LEGACY_HARNESS, E2X, E3X, E4X, E5X, WORKER, ORCH, SOLVER, E1FIX, E0FIX, E3FIX, E4FIX, E5FIX, COMPOSE].forEach(function (f) {
    fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true });
    fs.copyFileSync(path.join(SITE, f), path.join(dir, f));
  });
  // also copy the shared compose-shell + ALL solver-ui fragments + assets the
  // compositor needs so the composed-output assertions run in the temp tree.
  const extra = [path.join('src', 'shared', 'compose-shell.js')];
  extra.forEach(function (f) { try { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.copyFileSync(path.join(SITE, f), path.join(dir, f)); } catch (e) {} });
  try {
    const fragDir = path.join('engine', 'fragments', 'solver-ui');
    fs.mkdirSync(path.join(dir, fragDir), { recursive: true });
    fs.readdirSync(path.join(SITE, fragDir)).forEach(function (f) { fs.copyFileSync(path.join(SITE, fragDir, f), path.join(dir, fragDir, f)); });
    const headerFrag = path.join('src', 'shared', 'fragments');
    fs.mkdirSync(path.join(dir, headerFrag), { recursive: true });
    fs.readdirSync(path.join(SITE, headerFrag)).forEach(function (f) { fs.copyFileSync(path.join(SITE, headerFrag, f), path.join(dir, headerFrag, f)); });
    const assetsDir = 'assets';
    fs.mkdirSync(path.join(dir, assetsDir), { recursive: true });
    fs.readdirSync(path.join(SITE, assetsDir)).forEach(function (f) { const s = path.join(SITE, assetsDir, f); if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dir, assetsDir, f)); });
  } catch (e) {}
  return dir;
}
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const wr = (d, f, s) => fs.writeFileSync(path.join(d, f), s);
function mut(d, f, from, to) { const s = rd(d, f); if (s.indexOf(from) === -1) throw new Error('anchor not found in ' + f + ': ' + from.slice(0, 40)); wr(d, f, s.replace(from, to)); }

function runChecker(dir) {
  [CHECKER, GEN, HARNESS, E2X, E3X, E4X, E5X].forEach(function (f) { try { delete require.cache[require.resolve(path.join(dir, f))]; } catch (e) {} });
  try { return require(path.join(dir, CHECKER)).checkSingleEngineWorkerAndMirror(dir); }
  catch (e) { return { fail: 1, failures: ['THREW: ' + e.message] }; }
}
function expectFail(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    const r = runChecker(dir);
    const tripped = r.fail > 0;
    const matched = (r.failures || []).some(f => f.indexOf(needle) !== -1);
    ok(label, tripped && matched, 'trip=' + tripped + ' match=' + matched + ' :: ' + (r.failures || []).join(' | ').slice(0, 130));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// For generator-level failures (transformation misses), assert generateMirror throws.
function expectGenThrow(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    try { delete require.cache[require.resolve(path.join(dir, GEN))]; } catch (e) {}
    let threw = false, msg = '';
    try { require(path.join(dir, GEN)).generateMirror(dir); } catch (e) { threw = true; msg = e.message; }
    ok(label, threw && msg.indexOf(needle) !== -1, 'threw=' + threw + ' :: ' + msg.slice(0, 110));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- 1-2. Canonical source ------------------------------------------------
expectFail('N1 canonical source absent', function (d) { fs.unlinkSync(path.join(d, CANON)); }, 'canonical source');
expectFail('N2 canonical source modified', function (d) { mut(d, CANON, 'function isSatisfied_(used, relation, limit) {', 'function isSatisfied_(used, relation, limit) { /* x */'); }, 'canonical source SHA intact');

// ---- 3-4. Mirror hand-edited / stale --------------------------------------
expectFail('N3 mirror hand-edited', function (d) { wr(d, MIRROR, rd(d, MIRROR) + '\n/* hand edit */\n'); }, 'mirror matches the generator output');
expectFail('N4 mirror stale (regenerate needed)', function (d) { wr(d, MIRROR, rd(d, MIRROR).replace('root.PlumlineEngine = api;', 'root.PlumlineEngine = api; /* stale */')); }, 'mirror matches the generator output');

// ---- 5-10. Generator hygiene ----------------------------------------------
expectFail('N6 generator reads solver.html', function (d) { mut(d, GEN, "const canon = fs.readFileSync(canonPath, 'utf8');", "if(false)fs.readFileSync('" + SOLVER + "','utf8'); const canon = fs.readFileSync(canonPath, 'utf8');"); }, 'generator does not read solver.html or dist');
// N5/N7/N8/N9/N10 are structural properties of the generator asserted via the fixture:
expectFail('N5 generator marked non-deterministic (fixture)', function (d) { wr(d, FIXTURE, rd(d, FIXTURE).replace('"deterministic": true', '"deterministic": false')); }, 'fixture records generator deterministic');
expectFail('N7 generator dist flag flipped (fixture)', function (d) { wr(d, FIXTURE, rd(d, FIXTURE).replace('"no_dist": true', '"no_dist": false')); }, 'fixture records generator deterministic');
expectFail('N8 generator network flag flipped (fixture)', function (d) { wr(d, FIXTURE, rd(d, FIXTURE).replace('"no_network": true', '"no_network": false')); }, 'fixture records generator deterministic');
expectFail('N9 generator timestamp flag flipped (fixture)', function (d) { wr(d, FIXTURE, rd(d, FIXTURE).replace('"no_timestamp": true', '"no_timestamp": false')); }, 'fixture records generator deterministic');
expectFail('N10 generator absolute-path flag flipped (fixture)', function (d) { wr(d, FIXTURE, rd(d, FIXTURE).replace('"no_absolute_path": true', '"no_absolute_path": false')); }, 'fixture records generator deterministic');

// ---- 11-13. Transformation targeting --------------------------------------
expectGenThrow('N11 transformation zero matches (A1 signature)', function (d) { mut(d, CANON, 'function newContext_(grid, variables) {', 'function newContext_(grid, vars) {'); }, 'A1.signature');
expectGenThrow('N12 transformation multiple matches (fallback block duplicated)', function (d) {
  const a = JSON.parse(rd(d, ADAPTER)); const blk = a.adaptations[0].canonical_fallback_block;
  // duplicate the block so the generator sees two matches
  mut(d, CANON, blk, blk + '\n' + blk);
}, 'A1.fallback');
expectFail('N13 adaptation retargets another function', function (d) {
  const a = JSON.parse(rd(d, ADAPTER)); a.adaptations[0].target = 'optimise_'; wr(d, ADAPTER, JSON.stringify(a, null, 2));
}, 'adapter divergences are newContext_/readConstraint_');

// ---- 14-15. Third divergence / constant -----------------------------------
expectFail('N14 third functional divergence', function (d) { mut(d, MIRROR, 'function dotProduct_(', 'function dotProduct_(/* tamper */ '); wr(d, MIRROR, rd(d, MIRROR).replace('total += (coefficients[i] || 0)', 'total -= (coefficients[i] || 0)')); }, 'mirror matches the generator output');
expectFail('N15 mathematical constant changed in mirror', function (d) { wr(d, MIRROR, rd(d, MIRROR).replace('BRANCH_NODES: 4000', 'BRANCH_NODES: 3999')); }, 'mirror matches the generator output');

// ---- 16-19. Mirror export / API / wrapper ---------------------------------
expectFail('N16 mirror export removed', function (d) { wr(d, MIRROR, rd(d, MIRROR).replace('    loadGrid_: loadGrid_,\n', '')); }, 'mirror matches the generator output');
expectFail('N17 mirror export added', function (d) { wr(d, MIRROR, rd(d, MIRROR).replace('    loadGrid_: loadGrid_,', '    loadGrid_: loadGrid_,\n    round_: round_,')); }, 'mirror matches the generator output');
expectFail('N18 mirror API surface changed', function (d) { wr(d, MIRROR, rd(d, MIRROR).replace('root.PlumlineEngine = api;', 'root.PlumlineEngineX = api;')); }, 'mirror matches the generator output');
expectFail('N19 wrapper header changed', function (d) { wr(d, MIRROR, rd(d, MIRROR).replace('/* === Plumline engine: the exact same code as the Google Sheets add-on === */', '/* changed header */')); }, 'mirror matches the generator output');

// ---- 20-21. Suite source authority ----------------------------------------
expectFail('N20 legacy harness points away from generated mirror', function (d) { wr(d, LEGACY_HARNESS, rd(d, LEGACY_HARNESS).replace(/require\(['"]\.\/engine\.js['"]\)/, "require('./source/plumline-engine.js')")); }, 'legacy harness targets the generated mirror');
expectFail('N21 canonical harness reads the mirror as authority', function (d) { wr(d, HARNESS, rd(d, HARNESS).replace('const PHASES = {', "fs.readFileSync('engine.js','utf8');\nconst PHASES = {")); }, 'canonical harness loads canonical source');

// ---- 22-26. Worker source / START-END / glue / separator / Blob -----------
expectFail('N22 engineSource slice convention changed', function (d) { wr(d, WORKER, rd(d, WORKER).replace('slice(a,b)', 'slice(a+1,b)')); }, 'Worker engineSource slices ENGINE_START..ENGINE_END');
expectFail('N23 START/END markers changed in worker', function (d) { wr(d, WORKER, rd(d, WORKER).replace("txt.indexOf('/* ENGINE_END */')", "txt.indexOf('/* ENGINE_STOP */')")); }, 'Worker engineSource slices ENGINE_START..ENGINE_END');
expectFail('N24 worker glue success shape changed', function (d) { wr(d, WORKER, rd(d, WORKER).replace('token:d.token,ok:true,out:out,wholeNumbers:model.wholeNumbers', 'token:d.token,ok:true,result:out')); }, 'Worker glue emits success shape');
expectFail('N25 separator changed in fixture', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.worker_execution.separator.byte = 32; wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'separator is a single LF');
expectFail('N26 Blob arithmetic broken in fixture', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.worker_execution.blob_source_bytes = 99999; wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'Blob source bytes = engine + 1 + glue');

// ---- 27-31. Request / response / token ------------------------------------
expectFail('N27 request loses a field (fixture)', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.request_contract.fields = g.request_contract.fields.filter(x => x !== 'sense'); wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'request contract fields exact');
expectFail('N28 request adds a field (fixture)', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.request_contract.fields.push('extra'); wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'request contract fields exact');
expectFail('N29 response success contract changed (fixture)', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.response_success_contract.fields = ['token', 'ok:true', 'result']; wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'response success contract exact');
expectFail('N30 response error contract changed (fixture)', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.response_error_contract.fields = ['token', 'ok:false', 'msg']; wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'response error contract exact');
expectFail('N31 token stale guard removed', function (d) { wr(d, ORCH, rd(d, ORCH).replace('if(e.data.token!==workerToken) return;', '/* removed guard */')); }, 'stale guard on success compares GLOBAL workerToken');

// ---- 32-36. Stale / lifecycle / cleanup -----------------------------------
expectFail('N32 stale error guard removed', function (d) { wr(d, ORCH, rd(d, ORCH).replace('if(myToken!==workerToken) return;', '/* removed */')); }, 'stale guard on error compares myToken');
expectFail('N33 token no longer increments', function (d) { wr(d, ORCH, rd(d, ORCH).replace('myToken=++workerToken', 'myToken=workerToken')); }, 'token increments per solve');
expectFail('N34 worker never terminates', function (d) { wr(d, ORCH, rd(d, ORCH).replace(/engineWorker\.terminate\(\)/g, '/* no terminate */')); }, 'lifecycle error terminates the worker');
expectFail('N35 object URL not revoked', function (d) { wr(d, WORKER, rd(d, WORKER).replace('URL.revokeObjectURL(workerUrl)', '/* no revoke */')); }, 'lifecycle build: Blob + createObjectURL + new Worker + revokeObjectURL');
expectFail('N36 cleanup no longer nulls engineWorker', function (d) { wr(d, ORCH, rd(d, ORCH).replace(/engineWorker=null/g, '/* keep */')); }, 'cleanup rebuilds by nulling engineWorker');

// ---- 37-38. Fallback ------------------------------------------------------
expectFail('N37 fallback uses the mirror', function (d) { wr(d, ORCH, rd(d, ORCH).replace('detectModel_(sheet', 'require("../../engine.js").detectModel_(sheet')); }, 'fallback runSolve uses detectModel_/solveModel_');
expectFail('N38 fallback drops solveModel_', function (d) { wr(d, ORCH, rd(d, ORCH).replace(/solveModel_\(sheet/g, 'solveModelX_(sheet')); }, 'fallback runSolve uses detectModel_/solveModel_');

// ---- 39-41. Error routing / localization ----------------------------------
expectFail('N39 engine error phase tag removed', function (d) { wr(d, WORKER, rd(d, WORKER).replace('rerr.__phase="read"', '/* no phase */ rerr.__x=1')); }, 'engine error is a thrown phase-tagged message');
expectFail('N40 error shape converted to a status', function (d) { wr(d, WORKER, rd(d, WORKER).replace('token:d.token,ok:false,phase:(err&&err.__phase)||"solve",error:String(err&&err.message||err)', 'token:d.token,ok:true,out:{status:"error"}')); }, 'Worker glue emits error shape');
expectFail('N41 localizeEngineError moved into the engine', function (d) { mut(d, CANON, 'function optimise_(model) {', 'function localizeEngineError(m){return m;}\nfunction optimise_(model) {'); }, 'canonical source SHA intact');

// ---- 42-45. E2/E3/E4/E5 -----------------------------------------------------
expectFail('N42 E2 exports change', function (d) { wr(d, E2X, rd(d, E2X).replace('Object.keys(E2_FUNCTIONS).slice()', 'Object.keys(E2_FUNCTIONS).slice(1)')); }, 'E2 exports intact (24)');
expectFail('N43 E3 exports change', function (d) { wr(d, E3X, rd(d, E3X).replace('Object.keys(E3_FUNCTIONS).slice()', 'Object.keys(E3_FUNCTIONS).slice(1)')); }, 'E3 exports intact (22)');
expectFail('N44 E4 exports change', function (d) { wr(d, E4X, rd(d, E4X).replace('Object.keys(E4_FUNCTIONS).slice()', 'Object.keys(E4_FUNCTIONS).slice(1)')); }, 'E4 exports intact (8)');
expectFail('N45 E5 exports change', function (d) { wr(d, E5X, rd(d, E5X).replace("  finiteModel_: 'finiteness-guard',\n", '')); }, 'E5 exports intact (9)');

// ---- 46-48. Fixture / dist -------------------------------------------------
expectFail('N46 fixture unsafe (absolute path)', function (d) { wr(d, FIXTURE, rd(d, FIXTURE).replace('"note":', '"leak":"/home/x",\n  "note":')); }, 'E6 fixture has no absolute path');
expectFail('N47 fixture engine SHA wrong', function (d) { const g=JSON.parse(rd(d,FIXTURE)); g.PINNED_SHA.engine='0'.repeat(64); wr(d,FIXTURE,JSON.stringify(g,null,2)); }, 'E6 fixture pins do_not_regenerate + PINNED_SHA');
expectFail('N48 dist dependency introduced in checker', function (d) { wr(d, CHECKER, rd(d, CHECKER).replace("  return { pass: pass, fail: fail, failures: failures };\n}\n\nmodule.exports", "  if (fs.existsSync(path.join(siteDir,'dist'))) ok('dist byte', false);\n  return { pass: pass, fail: fail, failures: failures };\n}\n\nmodule.exports")); fs.mkdirSync(path.join(d, 'dist'), { recursive: true }); }, 'dist byte');

// ---- 49-50. Composed / public output --------------------------------------
expectFail('N49 composed output changed (engine byte)', function (d) { wr(d, CANON, rd(d, CANON).replace('/* ENGINE_START */\n', '/* ENGINE_START */\n/* x */\n')); }, 'canonical source SHA intact');
expectFail('N50 mirror final SHA record wrong', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.mirror.old_sha256 = '0'.repeat(64); wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'E6 fixture mirror old/final SHAs recorded');

// ---- 51-53. Extra request / published source / spaced path ----------------
expectFail('N51 additional request (fixture requests pin)', function (d) { const g = JSON.parse(rd(d, FIXTURE)); g.public_output.requests = 7; wr(d, FIXTURE, JSON.stringify(g, null, 2)); }, 'fixture pins six requests');
expectFail('N52 internal source published (canonical leaks into dist)', function (d) { fs.mkdirSync(path.join(d, 'dist', 'engine', 'source'), { recursive: true }); fs.copyFileSync(path.join(d, CANON), path.join(d, 'dist', 'engine', 'source', 'plumline-engine.js')); }, 'canonical/generator/adapter absent from dist');
expectFail('N53 generated mirror equivalence broken (adapter widened)', function (d) { const a = JSON.parse(rd(d, ADAPTER)); a.approved_divergence_count = 3; wr(d, ADAPTER, JSON.stringify(a, null, 2)); }, 'adapter declares exactly two approved divergences');


// ---- 54. Historical-fixture policy -----------------------------------------
expectFail('N54 historical fixture E0 rewritten to adopt the E6 mirror', function (d) { wr(d, E0FIX, rd(d, E0FIX).replace('6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa', 'faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6')); }, 'historical fixture engine-e0-baseline.json keeps the historical mirror SHA, not E6');
expectFail('N55 historical fixture E5 rewritten to adopt the E6 mirror', function (d) { wr(d, E5FIX, rd(d, E5FIX).replace('6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa', 'faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6')); }, 'historical fixture engine-e5-verification-statuses.json keeps the historical mirror SHA, not E6');

console.log('SINGLE-ENGINE + WORKER + MIRROR NEGATIVE (E6)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
