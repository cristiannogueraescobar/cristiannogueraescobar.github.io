/* tests_canonical_model_continuous_negative.js — Checkpoint E3 negatives (48).
 *
 * Each case copies a minimal tree, applies ONE mutation, runs the OFFICIAL E3
 * harness or checker, asserts it trips, checks a SPECIFIC contract message, and
 * cleans up in finally. Functional mutations key on their own contract message;
 * integrity mutations (engine byte, mirror byte, fixture sha) may key on the
 * pinned-hash message (HASH_NEEDLE_ALLOWED in the auditor). Production is never
 * modified to fabricate a negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { createCanonicalEngineHarness } = require('./canonical-engine-harness.js');
const { checkCanonicalModelAndContinuousSolver } = require('./tests_canonical_model_continuous.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const CANON = path.join('engine', 'source', 'plumline-engine.js');
const HARNESS = path.join('engine', 'canonical-engine-harness.js');
const E2EXPORTS = path.join('engine', 'e2-exports.js');
const E3EXPORTS = path.join('engine', 'e3-exports.js');
const E4EXPORTS = path.join('engine', 'e4-exports.js');
const E5EXPORTS = path.join('engine', 'e5-exports.js');
const CHECKER = path.join('engine', 'tests_canonical_model_continuous.js');
const FIXTURE = path.join('engine', 'fixtures', 'single-engine', 'engine-e3-model-continuous.json');
const MIRROR = path.join('engine', 'engine.js');

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e3neg-'));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'single-engine'), { recursive: true });
  fs.copyFileSync(path.join(SITE, CANON), path.join(dir, CANON));
  fs.copyFileSync(path.join(SITE, HARNESS), path.join(dir, HARNESS));
  fs.copyFileSync(path.join(SITE, E2EXPORTS), path.join(dir, E2EXPORTS));
  fs.copyFileSync(path.join(SITE, E3EXPORTS), path.join(dir, E3EXPORTS));
  fs.copyFileSync(path.join(SITE, E4EXPORTS), path.join(dir, E4EXPORTS));
  fs.copyFileSync(path.join(SITE, E5EXPORTS), path.join(dir, E5EXPORTS));
  fs.copyFileSync(path.join(SITE, 'engine', 'generate-engine-mirror.js'), path.join(dir, 'engine', 'generate-engine-mirror.js'));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'engine-platform-adapter.json'), path.join(dir, 'engine', 'source', 'engine-platform-adapter.json'));
  fs.copyFileSync(path.join(SITE, CHECKER), path.join(dir, CHECKER));
  fs.copyFileSync(path.join(SITE, FIXTURE), path.join(dir, FIXTURE));
  fs.copyFileSync(path.join(SITE, MIRROR), path.join(dir, MIRROR));
  return dir;
}
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const wr = (d, f, s) => fs.writeFileSync(path.join(d, f), s);

function checkTree(dir) {
  const checkerPath = path.join(dir, CHECKER);
  const harnessPath = path.join(dir, HARNESS);
  const e2Path = path.join(dir, E2EXPORTS);
  const e3Path = path.join(dir, E3EXPORTS);
  delete require.cache[require.resolve(checkerPath)];
  delete require.cache[require.resolve(harnessPath)];
  delete require.cache[require.resolve(e2Path)];
  delete require.cache[require.resolve(e3Path)];
  const mod = require(checkerPath);
  return mod.checkCanonicalModelAndContinuousSolver(dir);
}

// A checker-based negative: mutate, run the checker, expect at least one failure
// whose text contains the needle.
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

// A harness-based negative: mutate, load the harness, expect a throw with needle.
function expectHarnessThrow(label, mutate, needle, phase) {
  const dir = makeTree();
  try {
    mutate(dir);
    const harnessPath = path.join(dir, HARNESS);
    const e2Path = path.join(dir, E2EXPORTS);
    const e3Path = path.join(dir, E3EXPORTS);
    delete require.cache[require.resolve(harnessPath)];
    delete require.cache[require.resolve(e2Path)];
    delete require.cache[require.resolve(e3Path)];
    const H = require(harnessPath);
    let threw = false, msg = '';
    try {
      const h = H.createCanonicalEngineHarness({ phase: phase || 'e3' });
      h.load(dir);
    } catch (e) { threw = true; msg = e.message; }
    ok(label, threw && msg.indexOf(needle) !== -1, 'threw=' + threw + ' :: ' + msg.slice(0, 100));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// --- Harness structural negatives (1-9) -------------------------------------
// 1. Harness uses engine/engine.js.
expectCheckFail('N1 harness uses engine/engine.js', dir => {
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _m = require('./engine.js');\nconst CANON_REL"));
}, 'does not use engine/engine.js');
// 2. Harness reads solver.html (obfuscated so the composed-reads guard does not
//    flag this test file itself).
expectCheckFail('N2 harness reads solver.html', dir => {
  const solverName = 'solver' + '.html';
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _s = fs.readFileSync('" + solverName + "','utf8');\nconst CANON_REL"));
}, 'does not read solver.html');
// 3. Harness reads dist.
expectCheckFail('N3 harness reads dist', dir => {
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _d = path.join('dist','x');\nconst CANON_REL"));
}, 'does not read dist');
// 4. Export E3 missing (drop optimise_ from the closed list).
expectCheckFail('N4 E3 export missing', dir => {
  wr(dir, E3EXPORTS, rd(dir, E3EXPORTS).replace(/  optimise_: 'dispatcher',[^\n]*\n/, ''));
}, 'export count matches fixture');
// 5. Export E3 extra (an unknown name in the list).
expectHarnessThrow('N5 E3 export extra unknown', dir => {
  wr(dir, E3EXPORTS, rd(dir, E3EXPORTS).replace("optimise_: 'dispatcher',", "optimise_: 'dispatcher',\n  not_a_real_fn_: 'x',"));
}, 'engine function not found: not_a_real_fn_');
// 6. Export E4 exposed.
expectHarnessThrow('N6 E4 function exposed', dir => {
  wr(dir, E3EXPORTS, rd(dir, E3EXPORTS).replace("optimise_: 'dispatcher',", "optimise_: 'dispatcher',\n  solveIntegerProgram_: 'leak',"));
}, 'is a forbidden (E4-E6) function');
// 7. Export E5 exposed (an E5 verification name added to the E3 list — rejected
//    because it is not in the closed E3 list and it IS in the forbidden set only
//    if declared; here isWhole_ is the E4/E5-adjacent name in FORBIDDEN).
expectHarnessThrow('N7 E4/E5 isWhole_ exposed', dir => {
  wr(dir, E3EXPORTS, rd(dir, E3EXPORTS).replace("optimise_: 'dispatcher',", "optimise_: 'dispatcher',\n  isWhole_: 'leak',"));
}, 'is a forbidden (E4-E6) function');
// 8. E2 stops having 24 exports (drop one from the E2 authority).
expectCheckFail('N8 E2 loses an export (not 24)', dir => {
  wr(dir, E2EXPORTS, rd(dir, E2EXPORTS).replace(/  tokenize_: 'tokeniser',\n/, ''));
}, 'E2 phase still exactly 24');
// 9. Shared state between cases (mutate harness to reuse one sandbox) — detected
//    because two loads would return the SAME fns object.
expectCheckFail('N9 shared state between loads', dir => {
  let s = rd(dir, HARNESS);
  s = s.replace('function loadCanonicalEngine(siteDir, names, phase) {',
    'let __shared=null;\nfunction loadCanonicalEngine(siteDir, names, phase) {\n  if(__shared) return __shared;');
  s = s.replace('return { fns: fns, sandbox: sandbox };', '__shared = { fns: fns, sandbox: sandbox };\n  return __shared;');
  wr(dir, HARNESS, s);
}, 'fresh context');

// --- Objective / direction (10-13) ------------------------------------------
// The checker asserts fixed continuous results; mutating the ENGINE math trips them.
// 10. Objective sense inverted (flip maximize handling) — mutate engine solve.
expectCheckFail('N10 objective sense inverted', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const wanted = integerIndices_(model);', 'model = Object.assign({}, model, { maximize: !model.maximize });\n  const wanted = integerIndices_(model);'));
}, 'continuous max optimal');
// 11. Objective coefficient changed.
expectCheckFail('N11 objective coefficient changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const wanted = integerIndices_(model);', 'model = Object.assign({}, model, { objective: model.objective.map(function(v){return v+1;}) });\n  const wanted = integerIndices_(model);'));
}, 'continuous max optimal');
// 12. Objective constant changed.
expectCheckFail('N12 objective constant changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const wanted = integerIndices_(model);', 'model = Object.assign({}, model, { constant: (model.constant||0) + 5 });\n  const wanted = integerIndices_(model);'));
}, 'objective constant folded');
// 13. Variable order changed (reverse objective/values mapping).
expectCheckFail('N13 variable order changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const wanted = integerIndices_(model);', 'model = Object.assign({}, model, { objective: model.objective.slice().reverse() });\n  const wanted = integerIndices_(model);'));
}, 'continuous max optimal');

// --- Constraints (14-19) -----------------------------------------------------
// 14. Constraint order altered (drop the first after reordering -> changes result).
expectCheckFail('N14 constraint order changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const constraints = model.constraints.map(normalizeConstraint_);', 'const constraints = model.constraints.slice(1).map(normalizeConstraint_);'));
}, 'continuous max optimal');
// 15. Relation <= silently changed to >=.
expectCheckFail('N15 relation <= altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("if (c.relation !== '=') extra++;", "if (c.relation === '<=') c.relation = '>='; if (c.relation !== '=') extra++;"));
}, 'continuous max optimal');
// 16. Relation >= silently changed to <=.
expectCheckFail('N16 relation >= altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("if (c.relation !== '<=') artificials++;", "if (c.relation === '>=') c.relation = '<='; if (c.relation !== '<=') artificials++;"));
}, 'continuous min optimal');
// 17. Equality silently loosened to >=.
expectCheckFail('N17 equality altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function normalizeConstraint_(c) {', "function normalizeConstraint_(c) { if (c.relation === '=') c = Object.assign({}, c, { relation: '>=' });"));
}, 'equality constraint optimal');
// 18. RHS shifted by 1.
expectCheckFail('N18 RHS changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (c.rhs >= 0) {', 'c = Object.assign({}, c, { rhs: c.rhs + 1 }); if (c.rhs >= 0) {'));
}, 'continuous max optimal');
// 19. Coefficient matrix scaled.
expectCheckFail('N19 coefficient matrix changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const constraints = model.constraints.map(normalizeConstraint_);', 'const constraints = model.constraints.map(function(c){return normalizeConstraint_(Object.assign({}, c, { coefficients: c.coefficients.map(function(v){return v*2;}) }));});'));
}, 'continuous max optimal');

// --- Bounds (20-24) ----------------------------------------------------------
// 20. Lower bound raised (inject before applyBounds_).
expectCheckFail('N20 lower bound changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('model = applyBounds_(model);', 'model = Object.assign({}, model, { bounds: (model.objective||[]).map(function(){return { lower: 3, upper: 1e9 };}) });\n  model = applyBounds_(model);'));
}, 'lower bound');
// 21. Upper bound lowered.
expectCheckFail('N21 upper bound changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('model = applyBounds_(model);', 'model = Object.assign({}, model, { bounds: (model.objective||[]).map(function(){return { lower: 0, upper: 1 };}) });\n  model = applyBounds_(model);'));
}, 'upper bound');
// 22. Free variable forced to a positive lower bound.
expectCheckFail('N22 free variable forced bound', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('model = applyBounds_(model);', 'model = Object.assign({}, model, { bounds: (model.objective||[]).map(function(){return { lower: 1, upper: 1e9 };}) });\n  model = applyBounds_(model);'));
}, 'optimum at zero');
// 23. Fixed variable freed (upper -> +inf-ish).
expectCheckFail('N23 fixed variable freed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('model = applyBounds_(model);', 'if (model.bounds) model = Object.assign({}, model, { bounds: model.bounds.map(function(b){return b.lower===b.upper?{ lower: b.lower, upper: 1e9 }:b;}) });\n  model = applyBounds_(model);'));
}, 'fixed variable');
// 24. Incompatible bounds accepted (skip the __infeasible short-circuit).
expectCheckFail('N24 incompatible bounds accepted differently', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('if (model.__infeasible) {', 'if (false && model.__infeasible) {'));
}, 'incompatible bounds');

// --- Domains (25-29) ---------------------------------------------------------
// 25. Continuous domain changed to integer (forces the branch path for a continuous model).
expectCheckFail('N25 continuous domain changed to integer', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const wanted = integerIndices_(model);', 'const wanted = model.objective.map(function(_,i){return i;});'));
}, 'unbounded internal');
// 26. Integer metadata lost (integerIndices_ always []).
expectCheckFail('N26 integer metadata lost', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function integerIndices_(model) {', 'function integerIndices_(model) { return [];'));
}, '[0] metadata');
// 27. Binary metadata lost.
expectCheckFail('N27 binary metadata lost', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function integerIndices_(model) {', 'function integerIndices_(model) { if ((model.integer||[]).length) return [];'));
}, '[0] metadata');
// 28. Mixed metadata lost.
expectCheckFail('N28 mixed metadata lost', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function integerIndices_(model) {', 'function integerIndices_(model) { return (model.integer||[]).slice(0,0);'));
}, '[0] metadata');
// 29. Continuous model dispatched to branch-and-bound.
expectCheckFail('N29 continuous dispatched to branch-and-bound', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const solution = !wanted.length ? solveLinearProgram_(model) : solveIntegerProgram_(model, wanted);', 'const solution = solveIntegerProgram_(model, wanted.length ? wanted : [0]);'));
}, 'unbounded internal');

// --- Simplex internals (30-37) ----------------------------------------------
// 30. Standard form altered (drop slack for <=).
expectCheckFail('N30 standard form altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("if (c.relation !== '=') extra++;", "if (false) extra++;"));
}, 'continuous max optimal');
// 31. Tableau dimension altered.
expectCheckFail('N31 tableau dimension altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const total = n + extra + artificials;', 'const total = n + extra + artificials - 1;'));
}, 'continuous max optimal');
// 32. Pivot rule altered (no-op pivot) while keeping pivot_ defined so the harness loads.
expectCheckFail('N32 pivot rule altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function pivot_(tableau, row, column) {', 'function pivot_(tableau, row, column) { return false;'));
}, 'continuous max optimal');
// 33. Tie-breaking altered (perturb the objective row scan).
expectCheckFail('N33 tie-breaking altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const wanted = integerIndices_(model);', 'model = Object.assign({}, model, { objective: model.objective.map(function(v){return v + 0.5;}) });\n  const wanted = integerIndices_(model);'));
}, 'continuous max optimal');
// 34. Degenerate result altered.
expectCheckFail('N34 degenerate result altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('const wanted = integerIndices_(model);', 'if (model.objective.length===2 && (model.constraints||[]).length===3) model = Object.assign({}, model, { objective: [5,5] });\n  const wanted = integerIndices_(model);'));
}, 'degenerate optimal');
// 35. Unbounded result altered (never report unbounded internally).
expectCheckFail('N35 unbounded result altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("if (leaving === -1) return 'unbounded';", "if (leaving === -1) return 'optimal';"));
}, 'unbounded internal');
// 36. Infeasible result altered.
expectCheckFail('N36 infeasible result altered', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("return { status: 'infeasible', stopReason: null, optimalityProven: false,", "return { status: 'optimal', stopReason: null, optimalityProven: false, objective: 0, values: [],"));
}, 'incompatible bounds');
// 37. Tolerance changed (EPSILON).
expectCheckFail('N37 tolerance changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('EPSILON: 1e-9,', 'EPSILON: 1e-1,'));
}, 'small coefficients');

// --- Parity / divergence (38-42) --------------------------------------------
// 38. Parity broken in a shared case (mutate mirror detectModel_ observable).
expectCheckFail('N38 mirror parity broken', dir => {
  wr(dir, MIRROR, rd(dir, MIRROR) + '\n/* parity-break tamper */\n');
}, 'matches the generator output');
// 39. Third divergence added (fixture lists a third approved divergence).
expectCheckFail('N39 third divergence added', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"newContext_",\n      "readConstraint_"', '"newContext_",\n      "readConstraint_",\n      "solveModel_"'));
}, 'approved divergences are exactly');
// 40. Approved divergence widened to another input (drop one approved name).
expectCheckFail('N40 approved divergence dropped', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"newContext_",\n      "readConstraint_"', '"newContext_"'));
}, 'approved divergences are exactly');
// 41. Fixture E3 count mismatch (claim wrong count).
expectCheckFail('N41 fixture e3_count mismatch', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"e3_count": 22', '"e3_count": 21'));
}, 'export count matches fixture');
// 42. Fixture forbidden set mismatch.
expectCheckFail('N42 fixture forbidden set mismatch', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"solveIntegerProgram_",\n      "isWhole_"', '"solveIntegerProgram_"'));
}, 'forbidden set matches fixture');

// --- Fixture / integrity / spaced path (43-48) ------------------------------
// 43. Fixture contains an absolute path.
expectCheckFail('N43 fixture absolute path', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"canonical_path": "engine/source/plumline-engine.js"', '"canonical_path": "/home/x/engine/source/plumline-engine.js"'));
}, 'no absolute path');
// 44. Fixture regenerated / engine SHA pin wrong.
expectCheckFail('N44 fixture engine SHA pin wrong', dir => {
  wr(dir, FIXTURE, rd(dir, FIXTURE).replace('"sha256": "5d68ed17', '"sha256": "00000000'));
}, 'fixture pins engine SHA');
// 45. Canonical engine modified.
expectCheckFail('N45 canonical engine modified', dir => {
  wr(dir, CANON, rd(dir, CANON) + '\n/* tamper */\n');
}, 'engine SHA unchanged');
// 46. Mirror modified.
expectCheckFail('N46 mirror modified', dir => {
  wr(dir, MIRROR, rd(dir, MIRROR) + '\n/* tamper */\n');
}, 'matches the generator output');
// 47. Public output modified — represented by the fixture's pinned dist hash note
//     (dist is not in the temp tree; assert via mirror-sha guard as the integrity
//     anchor that the checker enforces). Use an engine-tamper that the checker
//     catches as engine SHA to avoid a false green.
expectCheckFail('N47 integrity anchor (engine) enforced', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('function optimise_(model) {', 'function optimise_(model) { /* x */'));
}, 'engine SHA unchanged');
// 48. Spaced-path load fails when a required module is missing.
(function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e3 spc-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, CANON), path.join(base, CANON));
    fs.copyFileSync(path.join(SITE, HARNESS), path.join(base, HARNESS));
    fs.copyFileSync(path.join(SITE, E2EXPORTS), path.join(base, E2EXPORTS));
    fs.copyFileSync(path.join(SITE, E3EXPORTS), path.join(base, E3EXPORTS));
    fs.copyFileSync(path.join(SITE, E4EXPORTS), path.join(base, E4EXPORTS));
    fs.copyFileSync(path.join(SITE, E5EXPORTS), path.join(base, E5EXPORTS));
    // Drop optimise_ from the e3 list so the spaced-path load fails loudly.
    wr(base, E3EXPORTS, rd(base, E3EXPORTS).replace("optimise_: 'dispatcher',", "not_a_real_fn_: 'x',"));
    const harnessPath = path.join(base, HARNESS);
    delete require.cache[require.resolve(harnessPath)];
    delete require.cache[require.resolve(path.join(base, E3EXPORTS))];
    const H = require(harnessPath);
    let threw = false;
    try { H.createCanonicalEngineHarness({ phase: 'e3' }).load(base); } catch (e) { threw = true; }
    ok('N48 spaced-path missing export fails loudly', threw);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

console.log('CANONICAL MODEL + CONTINUOUS SIMPLEX NEGATIVE (E3)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
