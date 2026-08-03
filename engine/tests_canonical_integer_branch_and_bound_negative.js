/* tests_canonical_integer_branch_and_bound_negative.js — Checkpoint E4 negatives.
 *
 * Each case copies a minimal tree, applies ONE mutation, runs the OFFICIAL E4
 * harness or checker, asserts it trips, checks a SPECIFIC contract message, and
 * cleans up in finally. Functional mutations key on their own contract message;
 * integrity mutations (engine/mirror byte, fixture sha) may key on the pinned-hash
 * message (HASH_NEEDLE_ALLOWED in the auditor). Production is never modified to
 * fabricate a negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createCanonicalEngineHarness } = require('./canonical-engine-harness.js');
const { checkCanonicalIntegerAndBranchAndBound } = require('./tests_canonical_integer_branch_and_bound.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const CANON = path.join('engine', 'source', 'plumline-engine.js');
const HARNESS = path.join('engine', 'canonical-engine-harness.js');
const E2EXPORTS = path.join('engine', 'e2-exports.js');
const E3EXPORTS = path.join('engine', 'e3-exports.js');
const E4EXPORTS = path.join('engine', 'e4-exports.js');
const E5EXPORTS = path.join('engine', 'e5-exports.js');
const CHECKER = path.join('engine', 'tests_canonical_integer_branch_and_bound.js');
const FIXTURE = path.join('engine', 'fixtures', 'single-engine', 'engine-e4-integer-branch-and-bound.json');
const MIRROR = path.join('engine', 'engine.js');
const GENMIR = path.join('engine', 'generate-engine-mirror.js');
const ADAPTER = path.join('engine', 'source', 'engine-platform-adapter.json');

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e4neg-'));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'single-engine'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  [CANON, HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS, E5EXPORTS, CHECKER, FIXTURE, MIRROR, GENMIR, ADAPTER].forEach(f => fs.copyFileSync(path.join(SITE, f), path.join(dir, f)));
  return dir;
}
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const wr = (d, f, s) => fs.writeFileSync(path.join(d, f), s);

function checkTree(dir) {
  [CHECKER, HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS].forEach(f => { try { delete require.cache[require.resolve(path.join(dir, f))]; } catch (e) {} });
  return require(path.join(dir, CHECKER)).checkCanonicalIntegerAndBranchAndBound(dir);
}
function expectCheckFail(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    let r;
    try { r = checkTree(dir); } catch (e) { r = { fail: 1, failures: [e.message] }; }
    const tripped = r.fail > 0;
    const matched = (r.failures || []).some(f => f.indexOf(needle) !== -1);
    ok(label, tripped && matched, 'trip=' + tripped + ' match=' + matched + ' :: ' + (r.failures || []).join(' | ').slice(0, 110));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function expectHarnessThrow(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    [HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS].forEach(f => { try { delete require.cache[require.resolve(path.join(dir, f))]; } catch (e) {} });
    const H = require(path.join(dir, HARNESS));
    let threw = false, msg = '';
    try { H.createCanonicalEngineHarness({ phase: 'e4' }).load(dir); } catch (e) { threw = true; msg = e.message; }
    ok(label, threw && msg.indexOf(needle) !== -1, 'threw=' + threw + ' :: ' + msg.slice(0, 100));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// --- Harness structural (1-9) -----------------------------------------------
expectCheckFail('N1 harness uses engine/engine.js', dir => {
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _m = require('./engine.js');\nconst CANON_REL"));
}, 'does not use engine/engine.js');
expectCheckFail('N2 harness reads solver.html', dir => {
  const solverName = 'solver' + '.html';
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _s = fs.readFileSync('" + solverName + "','utf8');\nconst CANON_REL"));
}, 'does not read solver.html');
expectCheckFail('N3 harness reads dist', dir => {
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _d = path.join('dist','x');\nconst CANON_REL"));
}, 'does not read dist');
expectCheckFail('N4 E4 export missing', dir => {
  wr(dir, E4EXPORTS, rd(dir, E4EXPORTS).replace(/  solveIntegerProgram_: 'branch-and-bound',[^\n]*\n/, ''));
}, 'export count matches fixture');
expectHarnessThrow('N5 E4 export extra unknown', dir => {
  wr(dir, E4EXPORTS, rd(dir, E4EXPORTS).replace("isWhole_: 'integrality',", "isWhole_: 'integrality',\n  not_a_real_fn_: 'x',"));
}, 'engine function not found: not_a_real_fn_');
expectHarnessThrow('N6 E5 function exposed', dir => {
  wr(dir, E4EXPORTS, rd(dir, E4EXPORTS).replace("isWhole_: 'integrality',", "isWhole_: 'integrality',\n  solveModel_: 'leak',"));
}, 'is a forbidden (E5-E6) function');
expectCheckFail('N7 E2 changes (not 24)', dir => {
  wr(dir, E2EXPORTS, rd(dir, E2EXPORTS).replace(/  tokenize_: 'tokeniser',\n/, ''));
}, 'E2 phase still exactly 24');
expectCheckFail('N8 E3 changes (not 22)', dir => {
  wr(dir, E3EXPORTS, rd(dir, E3EXPORTS).replace(/  detectModel_: 'model-construction',\n/, ''));
}, 'E3 phase still exactly 22');
expectCheckFail('N9 shared state between loads', dir => {
  let s = rd(dir, HARNESS);
  s = s.replace('function loadCanonicalEngine(siteDir, names, phase) {', 'let __shared=null;\nfunction loadCanonicalEngine(siteDir, names, phase) {\n  if(__shared) return __shared;');
  s = s.replace('return { fns: fns, sandbox: sandbox };', '__shared = { fns: fns, sandbox: sandbox };\n  return __shared;');
  wr(dir, HARNESS, s);
}, 'fresh context');

// --- Integrality / metadata (10-14) -----------------------------------------
// 10. Integrality tolerance widened -> isWhole_(3.5) wrongly true.
expectCheckFail('N10 integer tolerance changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('return Math.abs(value - Math.round(value)) < 1e-6;', 'return Math.abs(value - Math.round(value)) < 0.9;'));
}, 'isWhole_ outside tolerance');
// 11. Integer index dropped (integerIndices_ ignores metadata) -> continuous result on an integer model.
expectCheckFail('N11 integer index lost', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function integerIndices_(model) {', 'function integerIndices_(model) { return [];'));
}, 'integer single var');
// 12. Binary lower bound changed in classifyModel_ -> misclassifies binary.
expectCheckFail('N12 binary lower bound changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const isBin = isInt && b.lower === 0 && b.upper === 1;', 'const isBin = isInt && b.lower === -1 && b.upper === 1;'));
}, 'classifyModel_ binary');
// 13. Binary upper bound changed.
expectCheckFail('N13 binary upper bound changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const isBin = isInt && b.lower === 0 && b.upper === 1;', 'const isBin = isInt && b.lower === 0 && b.upper === 2;'));
}, 'classifyModel_ binary');
// 14. Mixed classification changed (mixed collapses to integer).
expectCheckFail('N14 mixed classification changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (hasCont) return \'mixed\';', 'if (hasCont) return \'integer\';'));
}, 'classifyModel_ mixed continuous+integer');

// --- Continuous bypass / branch-and-bound mechanics (15-26) ------------------
// 15. Continuous enters branch-and-bound (integerIndices_ forces an index).
expectCheckFail('N15 continuous enters branch-and-bound', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function integerIndices_(model) {', 'function integerIndices_(model) { if(!model.integer||!model.integer.length) return [0];'));
}, 'continuous model bypasses branch-and-bound');
// 16. Root relaxation altered (objective perturbed in node solve) -> wrong integer result.
expectCheckFail('N16 root relaxation altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('constraints: model.constraints.concat(extra),', 'constraints: model.constraints,'));
}, 'integer single var');
// 17. Branch variable selection changed (last fractional instead of first).
expectCheckFail('N17 branch variable changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (!isWhole_(relaxed.values[wanted[i]])) { fractional = wanted[i]; break; }', 'if (!isWhole_(relaxed.values[wanted[i]])) { fractional = wanted[wanted.length-1-i]; break; }'));
}, 'binary knapsack');
// 18. Floor branch changed.
expectCheckFail('N18 floor branch changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("relation: '<=', rhs: Math.floor(value)", "relation: '<=', rhs: Math.floor(value) - 1"));
}, 'integer fractional relaxation');
// 19. Ceil branch changed.
expectCheckFail('N19 ceil branch changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("relation: '>=', rhs: Math.ceil(value)", "relation: '>=', rhs: Math.ceil(value) + 1"));
}, 'integer fractional relaxation');
// 20. Node order swapped (floor first).
expectCheckFail('N20 node order swapped', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(
    "    explore(extra.concat([{ coefficients: unit, relation: '>=', rhs: Math.ceil(value) }]),\n      depth + 1);\n    explore(extra.concat([{ coefficients: unit, relation: '<=', rhs: Math.floor(value) }]),\n      depth + 1);",
    "    explore(extra.concat([{ coefficients: unit, relation: '<=', rhs: Math.floor(value) }]),\n      depth + 1);\n    explore(extra.concat([{ coefficients: unit, relation: '>=', rhs: Math.ceil(value) }]),\n      depth + 1);"));
}, 'integer fractional relaxation');
// 21. Depth counter altered (never increment) -> different traversal / node count.
expectCheckFail('N21 depth counter altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (nodes++ > ENGINE.BRANCH_NODES)', 'if ((nodes+=2) > ENGINE.BRANCH_NODES)'));
}, 'branch traversal deterministic');
// 22. nodesExplored altered (+1).
expectCheckFail('N22 nodesExplored altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('nodesExplored: nodes,\n    values: best.values,', 'nodesExplored: nodes + 1,\n    values: best.values,'));
}, 'integer single var');
// 23. Incumbent never updated.
expectCheckFail('N23 incumbent not updated', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (improves) best = { objective: snappedObjective, values: snapped };', 'if (false) best = { objective: snappedObjective, values: snapped };'));
}, 'integer single var');
// 24. Infeasible pruning removed -> infeasible model becomes unknown.
expectCheckFail('N24 infeasible pruning removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(
    "      if (relaxed.status !== 'infeasible') {\n        exhausted = false;\n        if (!stopReason) stopReason = relaxed.status;\n      }\n      return;",
    "      exhausted = false;\n      if (!stopReason) stopReason = relaxed.status;\n      return;"));
}, 'integer infeasible');
// 25. Bound pruning removed -> more nodes explored.
expectCheckFail('N25 bound pruning inverted', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (!better) return;   // this branch cannot beat what we hold', 'if (better) return;'));
}, 'binary knapsack');
// 26. Integral pruning removed (keep branching after integral) -> different node count.
expectCheckFail('N26 integral acceptance removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (improves) best = { objective: snappedObjective, values: snapped };', 'if (improves && false) best = { objective: snappedObjective, values: snapped };'));
}, 'integer single var');

// --- Comparisons / limits (27-37) -------------------------------------------
// 27. Maximize comparison flipped.
expectCheckFail('N27 maximize comparison changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(
    '? relaxed.objective > best.objective + 1e-9\n        : relaxed.objective < best.objective - 1e-9;',
    '? relaxed.objective < best.objective + 1e-9\n        : relaxed.objective > best.objective - 1e-9;'));
}, 'binary knapsack');
// 28. Minimize comparison changed (snapped improves flipped).
expectCheckFail('N28 minimize comparison changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(
    '? snappedObjective > best.objective + ENGINE.EPSILON\n        : snappedObjective < best.objective - ENGINE.EPSILON);',
    '? snappedObjective < best.objective + ENGINE.EPSILON\n        : snappedObjective > best.objective - ENGINE.EPSILON);'));
}, 'binary knapsack');
// 29. Node limit changed (BRANCH_NODES -> 1).
expectCheckFail('N29 node limit changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('BRANCH_NODES: 4000', 'BRANCH_NODES: 1'));
}, 'BRANCH_NODES 4000');
// 30. Depth limit changed (BRANCH_DEPTH -> 0).
expectCheckFail('N30 depth limit changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('BRANCH_DEPTH: 60', 'BRANCH_DEPTH: 0'));
}, 'BRANCH_DEPTH 60');
// 31. Time limit changed (BRANCH_MILLIS -> 0).
expectCheckFail('N31 time limit changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('BRANCH_MILLIS: 20000', 'BRANCH_MILLIS: 0'));
}, 'BRANCH_MILLIS 20000');
// 32. MAX_ITERATIONS changed.
expectCheckFail('N32 MAX_ITERATIONS changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('MAX_ITERATIONS: 20000', 'MAX_ITERATIONS: 5'));
}, 'MAX_ITERATIONS 20000');
// 33. BRANCH_NODES value changed (4000 -> 4001).
expectCheckFail('N33 BRANCH_NODES value changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('BRANCH_NODES: 4000', 'BRANCH_NODES: 4001'));
}, 'BRANCH_NODES 4000');
// 34. BRANCH_DEPTH value changed (60 -> 61).
expectCheckFail('N34 BRANCH_DEPTH value changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('BRANCH_DEPTH: 60', 'BRANCH_DEPTH: 61'));
}, 'BRANCH_DEPTH 60');
// 35. BRANCH_MILLIS value changed (20000 -> 19999).
expectCheckFail('N35 BRANCH_MILLIS value changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('BRANCH_MILLIS: 20000', 'BRANCH_MILLIS: 19999'));
}, 'BRANCH_MILLIS 20000');
// 36. EPSILON changed.
expectCheckFail('N36 EPSILON changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('EPSILON: 1e-9,', 'EPSILON: 1e-1,'));
}, 'EPSILON 1e-9');
// 37. PIVOT_TOLERANCE changed.
expectCheckFail('N37 PIVOT_TOLERANCE changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('PIVOT_TOLERANCE: 1e-7,', 'PIVOT_TOLERANCE: 1e-1,'));
}, 'PIVOT_TOLERANCE 1e-7');

// --- Result / parity / fixture / integrity (38-52) --------------------------
// 38. Result with incumbent changed (status optimal -> feasible).
expectCheckFail('N38 result with incumbent changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("status: exhausted ? 'optimal' : 'feasible',", "status: exhausted ? 'feasible' : 'feasible',"));
}, 'integer single var');
// 39. Result without incumbent changed (infeasible -> unknown).
expectCheckFail('N39 result without incumbent changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("return { status: 'infeasible', stopReason: null, optimalityProven: false,\n               nodesExplored: nodes, objective: null, values: null };", "return { status: 'unknown', stopReason: null, optimalityProven: false,\n               nodesExplored: nodes, objective: null, values: null };"));
}, 'integer infeasible');
// 40. stopReason internal changed (null -> 'x' on optimal).
expectCheckFail('N40 stopReason internal changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('stopReason: exhausted ? null : (stopReason || \'iteration_limit\'),', "stopReason: exhausted ? 'tampered' : (stopReason || 'iteration_limit'),"));
}, 'normal model hits no limit');
// 41. optimalityProven internal changed.
expectCheckFail('N41 optimalityProven internal changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('optimalityProven: !!exhausted,', 'optimalityProven: !exhausted,'));
}, 'integer single var');
// 42. Mirror parity broken (mutate mirror byte).
expectCheckFail('N42 mirror parity broken', dir => {
  wr(dir, MIRROR, rd(dir, MIRROR) + '\n/* parity-break tamper */\n');
}, 'matches the generator output');
// 43. Third divergence added.
expectCheckFail('N43 third divergence added', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"newContext_",\n      "readConstraint_"', '"newContext_",\n      "readConstraint_",\n      "solveModel_"'));
}, 'approved divergences are exactly');
// 44. Approved divergence dropped.
expectCheckFail('N44 approved divergence dropped', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"newContext_",\n      "readConstraint_"', '"newContext_"'));
}, 'approved divergences are exactly');
// 45. Fixture e4_count mismatch.
expectCheckFail('N45 fixture e4_count mismatch', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"e4_count": 8', '"e4_count": 7'));
}, 'export count matches fixture');
// 46. Fixture forbidden set mismatch.
expectCheckFail('N46 fixture forbidden set mismatch', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"solveModel_",\n      "describeModel_"', '"solveModel_"'));
}, 'forbidden set matches fixture');
// 47. Fixture absolute path.
expectCheckFail('N47 fixture absolute path', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"canonical_path": "engine/source/plumline-engine.js"', '"canonical_path": "/home/x/engine/source/plumline-engine.js"'));
}, 'no absolute path');
// 48. Fixture engine SHA pin wrong (regeneration).
expectCheckFail('N48 fixture engine SHA pin wrong', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"sha256": "5d68ed17', '"sha256": "00000000'));
}, 'fixture pins engine SHA');
// 49. Canonical engine modified.
expectCheckFail('N49 canonical engine modified', dir => {
  wr(dir, CANON, rd(dir, CANON) + '\n/* tamper */\n');
}, 'engine SHA unchanged');
// 50. Mirror modified.
expectCheckFail('N50 mirror modified', dir => {
  wr(dir, MIRROR, rd(dir, MIRROR) + '\n/* tamper */\n');
}, 'matches the generator output');
// 51. Public output integrity anchor (engine tamper the checker catches).
expectCheckFail('N51 integrity anchor enforced', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function optimise_(model) {', 'function optimise_(model) { /* x */'));
}, 'engine SHA unchanged');
// 52. Spaced-path load fails when a required export is missing.
(function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e4 spc-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    [CANON, HARNESS, E2EXPORTS, E3EXPORTS, E4EXPORTS, E5EXPORTS, GENMIR, ADAPTER].forEach(f => fs.copyFileSync(path.join(SITE, f), path.join(base, f)));
    wr(base, E4EXPORTS, rd(base, E4EXPORTS).replace("solveIntegerProgram_: 'branch-and-bound',", "not_a_real_fn_: 'x',"));
    [HARNESS, E4EXPORTS].forEach(f => { try { delete require.cache[require.resolve(path.join(base, f))]; } catch (e) {} });
    const H = require(path.join(base, HARNESS));
    let threw = false;
    try { H.createCanonicalEngineHarness({ phase: 'e4' }).load(base); } catch (e) { threw = true; }
    ok('N52 spaced-path missing export fails loudly', threw);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

console.log('CANONICAL INTEGER + BRANCH-AND-BOUND NEGATIVE (E4)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
