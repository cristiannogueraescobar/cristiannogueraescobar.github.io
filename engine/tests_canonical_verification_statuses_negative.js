/* tests_canonical_verification_statuses_negative.js — Checkpoint E5 negatives.
 *
 * Each case copies a minimal tree, applies ONE mutation, runs the OFFICIAL E5
 * checker or harness, asserts it trips, checks a SPECIFIC contract message, and
 * cleans up in finally. Functional mutations key on their own functional contract
 * message (never on SHA alone); integrity mutations (engine/mirror byte, fixture
 * sha) key on the pinned-hash message (HASH_NEEDLE_ALLOWED in the auditor). Any
 * negative that WRITES a page name obfuscates 'solver'+'.html'. Production is
 * never modified to fabricate a negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createCanonicalEngineHarness } = require('./canonical-engine-harness.js');
const { checkCanonicalVerificationAndStatuses } = require('./tests_canonical_verification_statuses.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const CANON = path.join('engine', 'source', 'plumline-engine.js');
const HARNESS = path.join('engine', 'canonical-engine-harness.js');
const E2EXPORTS = path.join('engine', 'e2-exports.js');
const E3EXPORTS = path.join('engine', 'e3-exports.js');
const E4EXPORTS = path.join('engine', 'e4-exports.js');
const E5EXPORTS = path.join('engine', 'e5-exports.js');
const CHECKER = path.join('engine', 'tests_canonical_verification_statuses.js');
const FIXTURE = path.join('engine', 'fixtures', 'single-engine', 'engine-e5-verification-statuses.json');
const MIRROR = path.join('engine', 'engine.js');
const GENMIR = path.join('engine', 'generate-engine-mirror.js');
const ADAPTER = path.join('engine', 'source', 'engine-platform-adapter.json');

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e5neg-'));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'single-engine'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  [CANON, HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS, E5EXPORTS, CHECKER, FIXTURE, MIRROR, GENMIR, ADAPTER].forEach(f => fs.copyFileSync(path.join(SITE, f), path.join(dir, f)));
  return dir;
}
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const wr = (d, f, s) => fs.writeFileSync(path.join(d, f), s);
function mutateCanon(dir, from, to) { const s = rd(dir, CANON); if (s.indexOf(from) === -1) throw new Error('mutation anchor not found: ' + from.slice(0, 40)); wr(dir, CANON, s.replace(from, to)); }

function checkTree(dir) {
  [CHECKER, HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS, E5EXPORTS].forEach(f => { try { delete require.cache[require.resolve(path.join(dir, f))]; } catch (e) {} });
  return require(path.join(dir, CHECKER)).checkCanonicalVerificationAndStatuses(dir);
}
function expectCheckFail(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    let r;
    try { r = checkTree(dir); } catch (e) { r = { fail: 1, failures: [e.message] }; }
    const tripped = r.fail > 0;
    const matched = (r.failures || []).some(f => f.indexOf(needle) !== -1);
    ok(label, tripped && matched, 'trip=' + tripped + ' match=' + matched + ' :: ' + (r.failures || []).join(' | ').slice(0, 120));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function expectHarnessThrow(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    [HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS, E5EXPORTS].forEach(f => { try { delete require.cache[require.resolve(path.join(dir, f))]; } catch (e) {} });
    let threw = false, msg = '';
    try {
      const H = require(path.join(dir, HARNESS));
      H.createCanonicalEngineHarness({ phase: 'e5' }).load(dir);
    } catch (e) { threw = true; msg = e.message; }
    ok(label, threw && msg.indexOf(needle) !== -1, 'threw=' + threw + ' :: ' + msg.slice(0, 100));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- 1-3. Harness hygiene (mirror / solver.html / dist) --------------------
expectCheckFail('N1 harness uses mirror engine.js', function (dir) {
  const s = rd(dir, HARNESS);
  wr(dir, HARNESS, s.replace("require('./e5-exports.js')", "require('./e5-exports.js'); require('./engine.js')"));
}, 'harness does not use engine/engine.js');
expectCheckFail('N2 harness reads solver.html', function (dir) {
  const s = rd(dir, HARNESS);
  wr(dir, HARNESS, s.replace('const PHASES = {', "if(false)fs.readFileSync('" + 'solver' + '.html' + "','utf8');\nconst PHASES = {"));
}, 'harness does not read solver.html');
expectCheckFail('N3 harness reads dist', function (dir) {
  const s = rd(dir, HARNESS);
  wr(dir, HARNESS, s.replace('const PHASES = {', "path.join('dist','x');\nconst PHASES = {"));
}, 'harness does not read dist');

// ---- 4-6. E5 export set (missing / extra / E6 exposed) ---------------------
expectCheckFail('N4 E5 export missing', function (dir) {
  const s = rd(dir, E5EXPORTS);
  wr(dir, E5EXPORTS, s.replace("  isWhole_: 'integrality-verification',       // 1e-6 tolerance\n", ''));
}, 'E5 export count matches fixture');
expectCheckFail('N5 E5 export extra', function (dir) {
  const s = rd(dir, E5EXPORTS);
  wr(dir, E5EXPORTS, s.replace("  finiteModel_: 'finiteness-guard',\n", "  finiteModel_: 'finiteness-guard',\n  round_: 'extra',\n"));
}, 'E5 export count matches fixture');
expectHarnessThrow('N6 E6 function exposed via E5 list', function (dir) {
  const s = rd(dir, E5EXPORTS);
  wr(dir, E5EXPORTS, s.replace("  finiteModel_: 'finiteness-guard',\n", "  finiteModel_: 'finiteness-guard',\n  buildWorkerSource_: 'worker',\n"));
}, 'forbidden (E6)');

// ---- 7-9. E2/E3/E4 changes -------------------------------------------------
expectCheckFail('N7 E2 export set changes', function (dir) {
  const s = rd(dir, E2EXPORTS);
  wr(dir, E2EXPORTS, s.replace('const E2_EXPORTS = Object.keys(E2_FUNCTIONS).slice();', 'const E2_EXPORTS = Object.keys(E2_FUNCTIONS).slice(1);'));
}, 'E2 phase still exactly 24');
expectCheckFail('N8 E3 export set changes', function (dir) {
  const s = rd(dir, E3EXPORTS);
  wr(dir, E3EXPORTS, s.replace('const E3_EXPORTS = Object.keys(E3_FUNCTIONS).slice();', 'const E3_EXPORTS = Object.keys(E3_FUNCTIONS).slice(1);'));
}, 'E3 phase still exactly 22');
expectCheckFail('N9 E4 export set changes', function (dir) {
  const s = rd(dir, E4EXPORTS);
  wr(dir, E4EXPORTS, s.replace('const E4_EXPORTS = Object.keys(E4_FUNCTIONS).slice();', 'const E4_EXPORTS = Object.keys(E4_FUNCTIONS).slice(1);'));
}, 'E4 phase still exactly 8');

// ---- 10. Shared state ------------------------------------------------------
expectCheckFail('N10 shared state across loads', function (dir) {
  const s = rd(dir, HARNESS);
  // Break freshness: cache the first result and return it for every subsequent load.
  const marker = 'function loadCanonicalEngine(siteDir, names, phase) {';
  if (s.indexOf(marker) === -1) throw new Error('N10 anchor not found');
  wr(dir, HARNESS, s.replace(marker, 'let __cache=null;\nfunction loadCanonicalEngine(siteDir, names, phase) {\n  if (__cache) return __cache;'));
  // and cache the return value
  const s2 = rd(dir, HARNESS);
  wr(dir, HARNESS, s2.replace('  return { fns: fns, sandbox: sandbox };', '  __cache = { fns: fns, sandbox: sandbox };\n  return __cache;'));
}, 'each E5 load has a fresh context');

// ---- 11-18. Verification broken --------------------------------------------
expectCheckFail('N11 objective recompute broken (dotProduct sign)', function (dir) {
  mutateCanon(dir, 'total += (coefficients[i] || 0) * (values[i] || 0);', 'total -= (coefficients[i] || 0) * (values[i] || 0);');
}, 'continuous optimal status/optProven/stopReason/nodesExplored');
expectCheckFail('N12 constraint <= verification broken', function (dir) {
  mutateCanon(dir, "if (relation === '<=') return used <= limit + tolerance;", "if (relation === '<=') return used <= limit + 100;");
}, 'isSatisfied_ <= within tolerance');
expectCheckFail('N13 constraint >= verification broken', function (dir) {
  mutateCanon(dir, "if (relation === '>=') return used >= limit - tolerance;", "if (relation === '>=') return true;");
}, 'isSatisfied_ >= within tolerance');
expectCheckFail('N14 equality verification broken', function (dir) {
  mutateCanon(dir, "  return Math.abs(used - limit) < tolerance;\n}", "  return true;\n}");
}, 'isSatisfied_ equality within tolerance');
expectCheckFail('N15 lower-bound verification broken', function (dir) {
  mutateCanon(dir, 'const lowerOk = value >= lower - 1e-6;', 'const lowerOk = true;');
}, 'buildVariableDomains_ lower-bound violation rejected');
expectCheckFail('N16 upper-bound verification broken', function (dir) {
  mutateCanon(dir, 'const upperOk = (upper === null) || (value <= upper + 1e-6);', 'const upperOk = true;');
}, 'buildVariableDomains_ upper-bound violation rejected');
expectCheckFail('N17 integer verification broken', function (dir) {
  mutateCanon(dir, 'return Math.abs(value - Math.round(value)) < 1e-6;', 'return true;');
}, 'isWhole_ integrality (1e-6)');
expectCheckFail('N18 binary verification broken', function (dir) {
  mutateCanon(dir, 'const binaryOk = !isBinary || (Math.abs(value) < 1e-6 || Math.abs(value - 1) < 1e-6);', 'const binaryOk = !isBinary || true;');
}, 'buildVariableDomains_ binary 0.5 rejected');

// ---- 19-21. NaN / Infinity / vector shape accepted -------------------------
expectCheckFail('N19 NaN accepted (feasibleAt_)', function (dir) {
  mutateCanon(dir, 'function feasibleAt_(model, constraints, values) {', 'function feasibleAt_(model, constraints, values) { if (values.some(function(v){return typeof v==="number";})) return true;');
}, 'feasibleAt_ rejects NaN and Infinity');
expectCheckFail('N20 Infinity accepted', function (dir) {
  mutateCanon(dir, 'function feasibleAt_(model, constraints, values) {', 'function feasibleAt_(model, constraints, values) { return true;');
}, 'feasibleAt_ feasible vs infeasible point');
expectCheckFail('N21 tolerance changed (constraint)', function (dir) {
  mutateCanon(dir, '  const tolerance = 1e-6;\n  if (relation', '  const tolerance = 0.9;\n  if (relation');
}, 'isSatisfied_ tolerance boundary (1e-6)');

// ---- 22. tolerance constant textual ----------------------------------------
expectCheckFail('N22 tolerance constant 1e-6 removed from isSatisfied_', function (dir) {
  mutateCanon(dir, '  const tolerance = 1e-6;\n  if (relation', '  const tolerance = 2e-6;\n  if (relation');
}, 'constraint tolerance 1e-6 in isSatisfied_');

// ---- 23-28. Status changed -------------------------------------------------
expectCheckFail('N23 status optimal->feasible (integer)', function (dir) {
  mutateCanon(dir, "status: exhausted ? 'optimal' : 'feasible',", "status: exhausted ? 'feasible' : 'feasible',");
}, 'integer optimal status/objective/values/nodesExplored');
expectCheckFail('N24 feasible status changed', function (dir) {
  mutateCanon(dir, "status: exhausted ? 'optimal' : 'feasible',", "status: exhausted ? 'optimal' : 'optimal',");
}, 'time_limit with incumbent -> feasible + caveat');
expectCheckFail('N25 infeasible status changed', function (dir) {
  mutateCanon(dir, "return { status: 'infeasible', stopReason: null, optimalityProven: false,\n               nodesExplored: nodes", "return { status: 'unknown', stopReason: null, optimalityProven: false,\n               nodesExplored: nodes");
}, 'integer infeasible status');
expectCheckFail('N26 unbounded status changed', function (dir) {
  mutateCanon(dir, "if (leaving === -1) return 'unbounded';", "if (leaving === -1) return 'unknown';");
}, 'continuous unbounded status');
expectCheckFail('N27 unknown status changed', function (dir) {
  mutateCanon(dir, "return { status: 'unknown', stopReason: stopReason || 'iteration_limit',", "return { status: 'infeasible', stopReason: stopReason || 'iteration_limit',");
}, 'time_limit without incumbent -> unknown');
expectCheckFail('N28 numerical_failure changed', function (dir) {
  mutateCanon(dir, "return { status: 'numerical_failure', stopReason: 'numerical_failure',\n             optimalityProven: false, nodesExplored: 0, objective: null, values: null };", "return { status: 'unknown', stopReason: 'numerical_failure',\n             optimalityProven: false, nodesExplored: 0, objective: null, values: null };");
}, 'numerical_failure is a status field');

// ---- 29-32. stopReason changed ---------------------------------------------
expectCheckFail('N29 stopReason node changed', function (dir) {
  mutateCanon(dir, "stopReason: exhausted ? null : (stopReason || 'iteration_limit'),", "stopReason: exhausted ? null : 'node_limit',");
}, 'time_limit with incumbent -> feasible + caveat');
expectCheckFail('N30 stopReason time changed', function (dir) {
  mutateCanon(dir, "if (!stopReason) stopReason = 'time_limit'; return; }", "if (!stopReason) stopReason = 'node_limit'; return; }");
}, 'time_limit with incumbent -> feasible + caveat');
expectCheckFail('N31 stopReason preserved-copy broken', function (dir) {
  mutateCanon(dir, 'stopReason: solution.stopReason || null,', 'stopReason: null,');
}, 'time_limit with incumbent -> feasible + caveat');
expectCheckFail('N32 stopReason numerical changed', function (dir) {
  mutateCanon(dir, "if (Date.now() > deadline)            { exhausted = false; if (!stopReason) stopReason = 'time_limit'; return; }", "if (Date.now() > deadline)            { exhausted = false; if (!stopReason) stopReason = 'numerical_failure'; return; }");
}, 'time_limit with incumbent -> feasible + caveat');

// ---- 33-34. optimalityProven changed ---------------------------------------
expectCheckFail('N33 optimalityProven true->false (flip)', function (dir) {
  mutateCanon(dir, 'optimalityProven: solution.optimalityProven === true,', 'optimalityProven: solution.optimalityProven !== true,');
}, 'continuous optimal status/optProven/stopReason/nodesExplored');
expectCheckFail('N34 optimalityProven not boolean', function (dir) {
  mutateCanon(dir, 'optimalityProven: solution.optimalityProven === true,', 'optimalityProven: solution.optimalityProven,');
}, 'optimalityProven boolean on unbounded (coerced false)');

// ---- 35-37. incumbent / no-incumbent / nodesExplored -----------------------
expectCheckFail('N35 partial incumbent lost (values dropped on feasible)', function (dir) {
  mutateCanon(dir, 'result.values = solution.values.map(round_);', 'if (solution.status === "feasible") { } else result.values = solution.values.map(round_);');
}, 'time_limit with incumbent -> feasible + caveat');
expectCheckFail('N36 no-incumbent result changed (explanation dropped)', function (dir) {
  mutateCanon(dir, 'result.explanation = explainStatus_(solution.status, model);', 'result.explanation = undefined;');
}, 'time_limit without incumbent -> unknown');
expectCheckFail('N37 nodesExplored changed', function (dir) {
  mutateCanon(dir, "nodesExplored: typeof solution.nodesExplored === 'number' ? solution.nodesExplored : null,", 'nodesExplored: 999,');
}, 'integer optimal status/objective/values/nodesExplored');

// ---- 38-39. objective final / values order ---------------------------------
expectCheckFail('N38 objective final changed', function (dir) {
  mutateCanon(dir, 'result.objective = round_(solution.objective);', 'result.objective = round_(solution.objective) + 1;');
}, 'continuous optimal objective/values/modelType');
expectCheckFail('N39 values order changed', function (dir) {
  mutateCanon(dir, 'result.values = solution.values.map(round_);', 'result.values = solution.values.map(round_).reverse();');
}, 'continuous optimal objective/values/modelType');

// ---- 40-41. error<->status conversions -------------------------------------
expectCheckFail('N40 technical error converted to status', function (dir) {
  mutateCanon(dir, "      throw new Error(item.cell + ' looks like a constraint but has no explicit ' +", "      return; throw new Error(item.cell + ' looks like a constraint but has no explicit ' +");
}, 'guessed constraint throws a technical error');
expectCheckFail('N41 status converted to exception (infeasible throws)', function (dir) {
  mutateCanon(dir, "return { status: 'infeasible', stopReason: null, optimalityProven: false,\n               nodesExplored: nodes, objective: null, values: null };", "throw new Error('infeasible thrown as exception');");
}, 'infeasible thrown as exception');

// ---- 42-44. parity / divergences -------------------------------------------
expectCheckFail('N42 mirror parity broken (feasibleAt_ diverges)', function (dir) {
  // mutate the CANONICAL feasibleAt_ so it disagrees with the (untouched) mirror
  mutateCanon(dir, 'function feasibleAt_(model, constraints, values) {', 'function feasibleAt_(model, constraints, values) { if (values && values[0] === 2) return false;');
}, 'direct parity feasibleAt_ canonical == mirror');
expectCheckFail('N43 third divergence appears (finiteModel_ diverges)', function (dir) {
  mutateCanon(dir, 'function finiteModel_(model) {', 'function finiteModel_(model) { if (model && model.objective) return false;');
}, 'direct parity finiteModel_ canonical == mirror');
expectCheckFail('N44 approved divergence widened (fixture lists a third)', function (dir) {
  const s = rd(dir, FIXTURE);
  wr(dir, FIXTURE, s.replace('"newContext_",\n      "readConstraint_"', '"newContext_",\n      "readConstraint_",\n      "solveModel_"'));
}, 'approved divergences are exactly newContext_/readConstraint_');

// ---- 45-46. suite regression / lost pass -----------------------------------
expectCheckFail('N45 checker points at mirror as authority', function (dir) {
  const s = rd(dir, CHECKER);
  wr(dir, CHECKER, s.replace("const canonSrc = fs.readFileSync(canonAbs, 'utf8');", "const canonSrc = fs.readFileSync(path.join(siteDir,'engine','engine.js'), 'utf8');"));
}, 'engine SHA unchanged (pinned)');
expectCheckFail('N46 checker loses a verification pass (isSatisfied stub)', function (dir) {
  mutateCanon(dir, "  if (relation === '<=') return used <= limit + tolerance;\n  if (relation === '>=') return used >= limit - tolerance;", "  if (relation === '<=') return true;\n  if (relation === '>=') return used >= limit - tolerance;");
}, 'isSatisfied_ <= within tolerance');

// ---- 47-48. fixture hygiene ------------------------------------------------
expectCheckFail('N47 fixture contains an absolute path', function (dir) {
  const s = rd(dir, FIXTURE);
  wr(dir, FIXTURE, s.replace('"note":', '"leak": "/home/user/x",\n  "note":'));
}, 'E5 fixture has no absolute path');
expectCheckFail('N48 fixture engine SHA autogenerated/wrong', function (dir) {
  const s = rd(dir, FIXTURE);
  wr(dir, FIXTURE, s.replace('5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf', '0'.repeat(64)));
}, 'E5 fixture pins engine SHA');

// ---- 49-51. engine / mirror / composed modified ----------------------------
expectCheckFail('N49 engine modified', function (dir) {
  mutateCanon(dir, 'function isSatisfied_(used, relation, limit) {', 'function isSatisfied_(used, relation, limit) { /* tampered */');
}, 'engine SHA unchanged (pinned)');
expectCheckFail('N50 mirror modified', function (dir) {
  const s = rd(dir, MIRROR);
  wr(dir, MIRROR, s + '\n/* tampered */\n');
}, 'mirror engine.js matches the generator output (E6 authority)');
expectCheckFail('N51 dist dependency introduced in checker', function (dir) {
  const s = rd(dir, CHECKER);
  wr(dir, CHECKER, s.replace('return { pass, fail, failures };', "if (fs.existsSync(path.join(siteDir,'dist'))) { ok('dist byte-identical', false); }\n  return { pass, fail, failures };"));
  // create a dist so the conditional fires and proves the dependency
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
}, 'dist byte-identical');

// ---- 52-53. spaced-path clean tree must pass; broken-spaced must fail -------
expectCheckFail('N52 spaced-path clean tree passes (control: mutation still trips)', function (dir) {
  mutateCanon(dir, 'function isWhole_(value) {', 'function isWhole_(value) { return true;');
}, 'isWhole_ integrality (1e-6)');
(function () {
  // A genuinely clean tree at a spaced path must produce zero failures.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e5 clean-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.mkdirSync(path.join(base, 'engine', 'fixtures', 'single-engine'), { recursive: true });
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    [CANON, HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS, E5EXPORTS, CHECKER, FIXTURE, MIRROR, GENMIR, ADAPTER].forEach(f => fs.copyFileSync(path.join(SITE, f), path.join(base, f)));
    [CHECKER, HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS, E5EXPORTS].forEach(f => { try { delete require.cache[require.resolve(path.join(base, f))]; } catch (e) {} });
    const r = require(path.join(base, CHECKER)).checkCanonicalVerificationAndStatuses(base);
    ok('N53 spaced-path clean tree passes', r.fail === 0, 'unexpected failures: ' + (r.failures || []).join(' | ').slice(0, 100));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

console.log('CANONICAL VERIFICATION + STATUSES NEGATIVE (E5)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
