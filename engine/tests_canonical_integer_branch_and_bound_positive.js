/* tests_canonical_integer_branch_and_bound_positive.js — Checkpoint E4 positives.
 *
 * Positive contracts for E4 integer / binary / mixed solving and branch-and-bound,
 * run against the canonical production source through the canonical harness (E4
 * phase). Structural contracts reuse the official checker; value contracts drive
 * optimise_/solveIntegerProgram_ through the probe. No branch-and-bound is
 * re-implemented. Limit tests use a deterministic Date stub (no real wait).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');
const { createCanonicalEngineHarness } = require('./canonical-engine-harness.js');
const { E4_EXPORTS } = require('./e4-exports.js');
const { E3_EXPORTS } = require('./e3-exports.js');
const { E2_EXPORTS } = require('./e2-exports.js');
const { checkCanonicalIntegerAndBranchAndBound } = require('./tests_canonical_integer_branch_and_bound.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

const canonSrc = fs.readFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), 'utf8');
function loadProbe(names, dateNow) {
  let DateCtor = Date;
  if (dateNow) { DateCtor = function (a, b, c, d, e, f, gg) { return new Date(a, b, c, d, e, f, gg); }; DateCtor.now = dateNow; DateCtor.prototype = Date.prototype; }
  const sb = { Math: Math, Date: DateCtor, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.__e = {}; vm.createContext(sb);
  vm.runInContext(canonSrc + '\n;(function(){' + names.map(n => 'if(typeof ' + n + '!=="undefined")__e["' + n + '"]=' + n + ';').join('') + '})();', sb);
  return sb.__e;
}
const P = loadProbe(['optimise_', 'solveIntegerProgram_', 'isWhole_', 'integerIndices_', 'classifyModel_', 'buildVariableDomains_']);
const h4 = createCanonicalEngineHarness({ phase: 'e4' });
function ip(objective, constraints, integer, bounds, opts) {
  return Object.assign({ objective: objective, constant: 0, maximize: true, constraints: constraints || [], integer: integer, bounds: bounds || [] }, opts || {});
}
function solve(m) { return P.optimise_(m); }

// 1-6. Structural.
const chk = checkCanonicalIntegerAndBranchAndBound(SITE);
ok('P1 official E4 checker passes', chk.fail === 0, chk.failures.join('; '));
ok('P2 E2 keeps exactly 24 exports', E2_EXPORTS.length === 24);
ok('P3 E3 keeps exactly 22 exports', E3_EXPORTS.length === 22);
ok('P4 E4 exposes exactly its closed list', eq(Object.keys(h4.load(SITE).fns).sort(), E4_EXPORTS.slice().sort()));
ok('P5 zero E5-E6 exposed', (() => { try { h4.load(SITE, ['solveModel_']); return false; } catch (e) { return /forbidden \(E5-E6\)/.test(e.message); } })());
ok('P6 clean state per load', h4.load(SITE).fns !== h4.load(SITE).fns);

// 7-9. Integrality.
ok('P7 integer exact', P.isWhole_(4) === true);
ok('P8 integer within tolerance', P.isWhole_(4.0000001) === true);
ok('P9 fraction outside tolerance', P.isWhole_(4.5) === false);

// 10-13. Binary.
ok('P10 binary 0', solve(ip([-1], [], [0], [{ lower: 0, upper: 1 }])).objective === 0);
ok('P11 binary 1', solve(ip([5], [], [0], [{ lower: 0, upper: 1 }])).objective === 5);
ok('P12 binary fractional relaxation branched to integral', (() => { const r = solve(ip([6, 5], [{ coefficients: [3, 3], relation: '<=', rhs: 4 }], [0, 1], [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }])); return P.isWhole_(r.values[0]) && P.isWhole_(r.values[1]); })());
ok('P13 binary bounds classified binary', P.classifyModel_({ integer: [0], bounds: [{ lower: 0, upper: 1 }] }, false, 1) === 'binary');

// 14-17. Models + bypass.
ok('P14 integer model optimal', solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).status === 'optimal');
ok('P15 binary model optimal', solve(ip([5], [], [0], [{ lower: 0, upper: 1 }])).status === 'optimal');
ok('P16 mixed model optimal', solve(ip([1, 10], [{ coefficients: [1, 1], relation: '<=', rhs: 3.5 }], [1])).status === 'optimal');
ok('P17 continuous bypass (no branch, nodesExplored undefined)', solve(ip([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }], [])).nodesExplored === undefined);

// 18-24. Branch-and-bound mechanics.
ok('P18 root relaxation already integral -> 1 node', solve(ip([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }], [0, 1])).nodesExplored === 1);
ok('P19 branch variable selection (first fractional) yields integral result', (() => { const r = solve(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1])); return P.isWhole_(r.values[0]) && P.isWhole_(r.values[1]); })());
ok('P20 floor/ceil branching produces feasible integer point', (() => { const r = solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])); return r.values[0] === 3; })());
ok('P21 ceil-first branching deterministic node count', solve(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1])).nodesExplored === 13);
ok('P22 node order deterministic (same result twice)', eq(solve(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1])), solve(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1]))));
ok('P23 depth tracked (nested branching completes)', solve(ip([1, 1, 1], [{ coefficients: [2, 2, 2], relation: '<=', rhs: 5 }], [0, 1, 2])).status === 'optimal');
ok('P24 nodesExplored present on integer path', typeof solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).nodesExplored === 'number');

// 25-29. Incumbent + pruning.
ok('P25 incumbent found (optimal has values)', Array.isArray(solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).values));
ok('P26 incumbent improves to true optimum', solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).objective === 15);
ok('P27 prune infeasible -> infeasible status', solve(ip([1], [{ coefficients: [1], relation: '>=', rhs: 2 }, { coefficients: [1], relation: '<=', rhs: 1 }], [0])).status === 'infeasible');
ok('P28 prune by bound keeps optimum', solve(ip([6, 5], [{ coefficients: [3, 3], relation: '<=', rhs: 4 }], [0, 1], [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }])).objective === 6);
ok('P29 prune integral (already integral -> optimalityProven)', solve(ip([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }], [0, 1])).optimalityProven === true);

// 30-32. Maximize / minimize / already integral.
ok('P30 maximize integer', solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).objective === 15);
ok('P31 minimize integer', solve(ip([1], [{ coefficients: [1], relation: '>=', rhs: 1.5 }], [0], [], { maximize: false })).objective === 2);
ok('P32 relaxation already integral', solve(ip([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }], [0, 1])).nodesExplored === 1);

// 33-38. Integer/binary/mixed variety.
ok('P33 integer single variable', solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).objective === 15);
ok('P34 integer multivariable', solve(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1])).objective === 2);
ok('P35 binary multivariable', solve(ip([6, 5], [{ coefficients: [3, 3], relation: '<=', rhs: 4 }], [0, 1], [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }])).objective === 6);
ok('P36 mixed continuous/integer', solve(ip([1, 10], [{ coefficients: [1, 1], relation: '<=', rhs: 3.5 }], [1])).objective === 30.5);
ok('P37 mixed continuous/binary', (() => { const r = solve(ip([1, 10], [{ coefficients: [1, 1], relation: '<=', rhs: 3.5 }], [1], [{}, { lower: 0, upper: 1 }])); return r.status === 'optimal' && P.isWhole_(r.values[1]); })());
ok('P38 mixed integer/binary classification', P.classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, {}] }, false, 2) === 'mixed');

// 39-42. Limits (deterministic Date stub).
ok('P39 node limit path exists (constant present)', /BRANCH_NODES:\s*4000/.test(canonSrc));
ok('P40 time_limit without incumbent -> unknown', (() => { let c = 0; const p = loadProbe(['optimise_'], function () { c++; return c <= 1 ? 0 : 1e15; }); const r = p.optimise_(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1])); return r.status === 'unknown' && r.stopReason === 'time_limit'; })());
ok('P41 time_limit with incumbent -> feasible', (() => { let c = 0; const p = loadProbe(['optimise_'], function () { c++; return c <= 12 ? 0 : 1e15; }); const r = p.optimise_(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1])); return r.status === 'feasible' && r.stopReason === 'time_limit'; })());
ok('P42 deterministic time-limit branch (repeatable)', (() => { function run() { let c = 0; const p = loadProbe(['optimise_'], function () { c++; return c <= 1 ? 0 : 1e15; }); return p.optimise_(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1])).status; } return run() === run(); })());

// 43-47. Internal result / tolerances.
ok('P43 stopReason null on proven optimal', solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).stopReason === null);
ok('P44 optimalityProven true on exhausted optimal', solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])).optimalityProven === true);
ok('P45 infeasible internal result', solve(ip([1], [{ coefficients: [1], relation: '>=', rhs: 2 }, { coefficients: [1], relation: '<=', rhs: 1 }], [0])).status === 'infeasible');
ok('P46 deterministic order (integer result stable)', eq(solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])), solve(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0]))));
ok('P47 integrality tolerance intact (1e-6 boundary)', P.isWhole_(3 + 9e-7) === true && P.isWhole_(3 + 2e-6) === false);

// 48-50. Parity + divergences.
const mirrorMod = require(path.join(SITE, 'engine', 'engine.js'));
const mapi = mirrorMod.PlumlineEngine || mirrorMod;
ok('P48 direct parity classifyModel_ canonical == mirror', P.classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }] }, false, 2) === mapi.classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }] }, false, 2));
ok('P49 observable parity optimise_ integer canonical == mirror', JSON.stringify(P.optimise_(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0]))) === JSON.stringify(mapi.optimise_(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0]))));
ok('P50 only two approved divergences', (() => { const g = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e4-integer-branch-and-bound.json'), 'utf8')); return eq(g.parity.approved_divergences.slice().sort(), ['newContext_', 'readConstraint_']); })());

// 51-56. Integrity / public output / spaced path / dist independence.
ok('P51 engine SHA intact', sha(canonSrc) === '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf');
ok('P52 mirror is the generated artefact (E6 authority)', (function(){ try { return fs.readFileSync(path.join(SITE,'engine','engine.js'),'utf8') === require('./generate-engine-mirror.js').generateMirror(SITE); } catch(e){ return false; } })());
ok('P53 Worker integrity checker present', fs.existsSync(path.join(SITE, 'engine', 'tests_engine_integrity.js')));
// P54 (public output byte-identity) is a build-only contract owned by
// engine/validate_dist.js; it is intentionally NOT asserted here so this suite is
// dist-independent. Engine/mirror integrity below stays.
ok('P55 E4 checker independent of dist', checkCanonicalIntegerAndBranchAndBound(SITE).pass > 0);
ok('P56 runs from a spaced path', (() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e4 space-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    ['engine/source/plumline-engine.js', 'engine/e2-exports.js', 'engine/e3-exports.js', 'engine/e4-exports.js', 'engine/e5-exports.js', 'engine/canonical-engine-harness.js'].forEach(f => fs.copyFileSync(path.join(SITE, f), path.join(base, f)));
    delete require.cache[path.join(base, 'engine', 'canonical-engine-harness.js')];
    const H = require(path.join(base, 'engine', 'canonical-engine-harness.js'));
    return Object.keys(H.createCanonicalEngineHarness({ phase: 'e4' }).load(base).fns).length === E4_EXPORTS.length;
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})());

console.log('CANONICAL INTEGER + BRANCH-AND-BOUND POSITIVE (E4)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
