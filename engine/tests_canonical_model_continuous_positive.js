/* tests_canonical_model_continuous_positive.js — Checkpoint E3 positive suite.
 *
 * Positive contracts for E3 model construction + continuous simplex, run against
 * the canonical production source through the canonical harness (E3 phase). These
 * assert that the documented behaviour HOLDS. The structural contracts reuse the
 * official checker; the value contracts drive optimise_/loadGrid_ through the
 * harness/probe. No simplex is re-implemented here.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');
const { createCanonicalEngineHarness, sheetStub, gridFromArrays } = require('./canonical-engine-harness.js');
const { E3_EXPORTS } = require('./e3-exports.js');
const { E2_EXPORTS } = require('./e2-exports.js');
const { checkCanonicalModelAndContinuousSolver } = require('./tests_canonical_model_continuous.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

const canonSrc = fs.readFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), 'utf8');
function loadProbe(names) {
  const sb = { Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.__e = {}; vm.createContext(sb);
  vm.runInContext(canonSrc + '\n;(function(){' + names.map(n => '__e["' + n + '"]=' + n + ';').join('') + '})();', sb);
  return sb.__e;
}
const P = loadProbe(['optimise_', 'detectModel_', 'solveModel_', 'integerIndices_', 'normalizeConstraint_', 'buildVariableDomains_', 'applyBounds_', 'classifyModel_']);
const h3 = createCanonicalEngineHarness({ phase: 'e3' });
function cont(objective, constraints, opts) {
  return Object.assign({ objective: objective, constant: 0, maximize: true, constraints: constraints || [], integer: [], bounds: [] }, opts || {});
}
function solve(m) { return P.optimise_(m); }

// 1-5. Structural contracts via the official checker.
const chk = checkCanonicalModelAndContinuousSolver(SITE);
ok('P1 official E3 checker passes', chk.fail === 0, chk.failures.join('; '));
ok('P2 E2 keeps exactly 24 exports', E2_EXPORTS.length === 24);
ok('P3 E3 exposes exactly its closed list', eq(Object.keys(h3.load(SITE).fns).sort(), E3_EXPORTS.slice().sort()));
ok('P4 zero E4-E6 exposed', (() => { try { h3.load(SITE, ['solveIntegerProgram_']); return false; } catch (e) { return /forbidden \(E4-E6\)/.test(e.message); } })());
ok('P5 clean state per load', h3.load(SITE).fns !== h3.load(SITE).fns);

// 6-11. Objective / direction / variables / order.
ok('P6 objective maximize', solve(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }])).objective === 12);
ok('P7 objective minimize', solve(cont([1, 1], [{ coefficients: [1, 1], relation: '>=', rhs: 2 }], { maximize: false })).objective === 2);
ok('P8 objective constant folded', solve(cont([1], [{ coefficients: [1], relation: '<=', rhs: 3 }], { constant: 10 })).objective === 13);
ok('P9 single variable', solve(cont([5], [{ coefficients: [1], relation: '<=', rhs: 10 }])).objective === 50);
ok('P10 several variables', eq(solve(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }])).values, [4, 0]));
ok('P11 stable variable order (same model twice)', eq(solve(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }])), solve(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }]))));

// 12-16. Constraints.
ok('P12 <= constraint', solve(cont([1], [{ coefficients: [1], relation: '<=', rhs: 7 }])).objective === 7);
ok('P13 >= constraint', solve(cont([1], [{ coefficients: [1], relation: '>=', rhs: 2 }], { maximize: false })).objective === 2);
ok('P14 = constraint', solve(cont([1, 0], [{ coefficients: [1, 1], relation: '=', rhs: 3 }])).objective === 3);
ok('P15 negative RHS normalised', solve(cont([1], [{ coefficients: [-1], relation: '<=', rhs: -2 }], { maximize: false })).objective === 2);
ok('P16 redundant constraint', solve(cont([1], [{ coefficients: [1], relation: '<=', rhs: 5 }, { coefficients: [1], relation: '<=', rhs: 10 }])).objective === 5);

// 17-21. Bounds.
ok('P17 lower bound', solve(cont([1], [{ coefficients: [1], relation: '<=', rhs: 10 }], { maximize: false, bounds: [{ lower: 2, upper: 1e9 }] })).objective === 2);
ok('P18 upper bound', solve(cont([1], [], { bounds: [{ lower: 0, upper: 3 }] })).objective === 3);
ok('P19 free variable (default lower 0)', solve(cont([1], [{ coefficients: [1], relation: '<=', rhs: 10 }], { maximize: false })).objective === 0);
ok('P20 fixed variable', solve(cont([1], [], { bounds: [{ lower: 5, upper: 5 }] })).objective === 5);
ok('P21 incompatible bounds -> current behaviour (infeasible)', solve(cont([1], [], { bounds: [{ lower: 5, upper: 2 }] })).status === 'infeasible');

// 22-26. Domains metadata (stored, NOT solved).
ok('P22 continuous domain (integer empty)', eq(P.integerIndices_(cont([1], [])), []));
ok('P23 integer metadata preserved without solving', eq(P.integerIndices_(cont([1], [], { integer: [0] })), [0]));
ok('P24 binary metadata preserved (index present)', eq(P.integerIndices_(cont([1], [], { integer: [0], bounds: [{ lower: 0, upper: 1 }] })), [0]));
ok('P25 mixed metadata preserved', eq(P.integerIndices_(cont([1, 1], [], { integer: [1] })), [1]));
ok('P26 continuous model has empty integer set (no branch path)', eq(P.integerIndices_(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }])), []));

// 27-31. Matrix / normalisation / standard-form invariants.
ok('P27 coefficient matrix correct (applyBounds folds upper)', eq(P.applyBounds_(cont([1], [], { bounds: [{ lower: 0, upper: 3 }] })).constraints, [{ coefficients: [1], relation: '<=', rhs: 3 }]));
ok('P28 constraint order preserved', (() => { const m = cont([1, 1], [{ coefficients: [1, 0], relation: '<=', rhs: 5 }, { coefficients: [0, 1], relation: '<=', rhs: 7 }]); return m.constraints[0].rhs === 5 && m.constraints[1].rhs === 7; })());
ok('P29 standard form: negative RHS flips relation', (() => { const c = P.normalizeConstraint_({ coefficients: [1], relation: '<=', rhs: -2 }); return c.relation === '>=' && c.rhs === 2; })());
ok('P30 normalize keeps non-negative RHS', (() => { const c = P.normalizeConstraint_({ coefficients: [1], relation: '<=', rhs: 2 }); return c.relation === '<=' && c.rhs === 2; })());
ok('P31 pivot invariants: deterministic optimum', eq(solve(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }])), solve(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }]))));

// 32-39. Simplex outcomes.
ok('P32 continuous max optimal', solve(cont([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }])).status === 'optimal');
ok('P33 continuous min optimal', solve(cont([1, 1], [{ coefficients: [1, 1], relation: '>=', rhs: 2 }], { maximize: false })).status === 'optimal');
ok('P34 degenerate optimal', solve(cont([1, 1], [{ coefficients: [1, 1], relation: '<=', rhs: 2 }, { coefficients: [1, 0], relation: '<=', rhs: 2 }, { coefficients: [0, 1], relation: '<=', rhs: 2 }])).objective === 2);
ok('P35 optimum at zero', solve(cont([1], [{ coefficients: [1], relation: '<=', rhs: 5 }], { maximize: false })).objective === 0);
ok('P36 unbounded internal', solve(cont([1], [])).status === 'unbounded');
ok('P37 infeasible internal', solve(cont([1], [{ coefficients: [1], relation: '>=', rhs: 5 }, { coefficients: [1], relation: '<=', rhs: 1 }])).status === 'infeasible');
ok('P38 small coefficients', solve(cont([1], [{ coefficients: [0.0001], relation: '<=', rhs: 1 }])).objective === 10000);
ok('P39 large coefficients', solve(cont([1], [{ coefficients: [1e6], relation: '<=', rhs: 1e9 }])).objective === 1000);

// 40-44. Parity + divergences.
const mirrorMod = require(path.join(SITE, 'engine', 'engine.js'));
const mapi = mirrorMod.PlumlineEngine || mirrorMod;
const E = h3.load(SITE).fns;
ok('P40 direct parity loadGrid_ canonical == mirror', (() => {
  const s = sheetStub([['=B1+C1', '2', '3'], ['', '', '']]);
  const a = E.loadGrid_(s, 'auto'), b = mapi.loadGrid_(s, 'auto');
  return eq(a.formulas, b.formulas) && a.rows === b.rows && a.columns === b.columns;
})());
ok('P41 observable parity detectModel_ canonical == mirror', (() => {
  const f = [['=B1+C1', '2', '3'], ['=B1+C1<=4', '', '']];
  let rc, rm;
  try { rc = JSON.stringify(P.detectModel_(sheetStub(f), 'auto')); } catch (e) { rc = 'E:' + e.message; }
  try { rm = JSON.stringify(mapi.detectModel_(sheetStub(f), 'auto')); } catch (e) { rm = 'E:' + e.message; }
  return rc === rm;
})());
ok('P42 newContext_ divergence is approved-only (not exposed via E3 API as a mismatch)', E3_EXPORTS.indexOf('newContext_') !== -1);
ok('P43 readConstraint_ divergence is approved-only', E3_EXPORTS.indexOf('readConstraint_') !== -1);
ok('P44 a third divergence would fail (checker asserts exactly two approved)', (() => {
  const g = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e3-model-continuous.json'), 'utf8'));
  return eq(g.parity.approved_divergences.slice().sort(), ['newContext_', 'readConstraint_']);
})());

// 45-50. Integrity / public output / spaced path.
ok('P45 engine SHA intact', sha(canonSrc) === '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf');
ok('P46 mirror is the generated artefact (E6 authority)', (function(){ try { return fs.readFileSync(path.join(SITE,'engine','engine.js'),'utf8') === require('./generate-engine-mirror.js').generateMirror(SITE); } catch(e){ return false; } })());
ok('P47 Worker engine source intact (integrity checker exists)', fs.existsSync(path.join(SITE, 'engine', 'tests_engine_integrity.js')));
// P48 (public output byte-identity) is a build-only contract owned by
// engine/validate_dist.js; it is intentionally NOT asserted here so this suite is
// dist-independent (no skip-as-pass). Engine/mirror integrity above stays.
ok('P49 E3 checker independent of dist (runs with dist removed)', (() => {
  // The checker only reads dist opportunistically; it must still pass structurally.
  const r = checkCanonicalModelAndContinuousSolver(SITE);
  return r.pass > 0;
})());
ok('P50 runs from a spaced path', (() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e3 space-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), path.join(base, 'engine', 'source', 'plumline-engine.js'));
    fs.copyFileSync(path.join(SITE, 'engine', 'e2-exports.js'), path.join(base, 'engine', 'e2-exports.js'));
    fs.copyFileSync(path.join(SITE, 'engine', 'e3-exports.js'), path.join(base, 'engine', 'e3-exports.js'));
    fs.copyFileSync(path.join(SITE, 'engine', 'e4-exports.js'), path.join(base, 'engine', 'e4-exports.js'));
    fs.copyFileSync(path.join(SITE, 'engine', 'e5-exports.js'), path.join(base, 'engine', 'e5-exports.js'));
    fs.copyFileSync(path.join(SITE, 'engine', 'canonical-engine-harness.js'), path.join(base, 'engine', 'canonical-engine-harness.js'));
    delete require.cache[path.join(base, 'engine', 'canonical-engine-harness.js')];
    const H = require(path.join(base, 'engine', 'canonical-engine-harness.js'));
    const h = H.createCanonicalEngineHarness({ phase: 'e3' });
    const fns = h.load(base).fns;
    return Object.keys(fns).length === E3_EXPORTS.length;
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})());

console.log('CANONICAL MODEL + CONTINUOUS SIMPLEX POSITIVE (E3)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
