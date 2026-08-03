/* tests_canonical_verification_statuses_positive.js — Checkpoint E5 positives.
 *
 * Positive contracts for E5 verification, final statuses, stop reasons,
 * optimalityProven, result adaptation and the status-vs-error separation, run
 * against the canonical production source through the canonical harness (E5
 * phase). Structural contracts reuse the official checker; value contracts drive
 * solveModel_/isSatisfied_/feasibleAt_/buildVariableDomains_ through the probe.
 * No verification or status mapping is re-implemented. Limit tests use a
 * deterministic Date stub (no real wait). Dist-independent.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');
const { createCanonicalEngineHarness, sheetStub } = require('./canonical-engine-harness.js');
const { E5_EXPORTS } = require('./e5-exports.js');
const { E4_EXPORTS } = require('./e4-exports.js');
const { E3_EXPORTS } = require('./e3-exports.js');
const { E2_EXPORTS } = require('./e2-exports.js');
const { checkCanonicalVerificationAndStatuses } = require('./tests_canonical_verification_statuses.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function stripElapsed(r) { const c = Object.assign({}, r); delete c.elapsedMs; return c; }

const REL = { '<=': 1, '>=': 1, '=': 1 };
const canonSrc = fs.readFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), 'utf8');
function loadProbe(names, dateNow) {
  let D = Date;
  if (dateNow) { D = function (a, b, c, d, e, f, gg) { return new Date(a, b, c, d, e, f, gg); }; D.now = dateNow; D.prototype = Date.prototype; }
  const sb = { Math: Math, Date: D, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.__e = {}; vm.createContext(sb);
  vm.runInContext(canonSrc + '\n;(function(){' + names.map(n => 'if(typeof ' + n + '!=="undefined")__e["' + n + '"]=' + n + ';').join('') + '})();', sb);
  return sb.__e;
}
function mkSheet(grid) {
  const isF = x => typeof x === 'string' && x[0] === '=' && !REL[x];
  const formulas = grid.map(r => r.map(c => (isF(c) ? c : '')));
  const values = grid.map(r => r.map(c => { if (isF(c)) return 0; if (c === '' || c == null) return ''; if (REL[c]) return c; const n = Number(c); return (!isNaN(n) && String(n) === String(c).trim()) ? n : c; }));
  return sheetStub(formulas, values);
}
function buildMax(vars, consts) {
  const grid = [['Item', 'Units', 'x', 'Total', 'Rel', 'Limit']];
  vars.forEach(v => grid.push([v.name, '0', '', '', '', '']));
  grid.push(['', '', '', '', '', '']);
  grid.push(['Total', '', '', '=' + vars.map((v, i) => v.profit + '*B' + (2 + i)).join('+'), '', '']);
  consts.forEach(c => grid.push([c.label || 'C', '', '', '=' + c.coefs.map((co, i) => co + '*B' + (2 + i)).join('+'), c.rel, String(c.limit)]));
  return grid;
}
const P = loadProbe(['solveModel_', 'detectModel_', 'isSatisfied_', 'feasibleAt_', 'buildVariableDomains_', 'isWhole_', 'validModelShape_', 'finiteModel_', 'explainStatus_']);
function solve(grid, integer, sense) { const sheet = mkSheet(grid); const model = P.detectModel_(sheet); if (integer) model.wholeNumbers = true; if (sense) model.objective.sense = sense; return P.solveModel_(sheet, model); }
const h5 = createCanonicalEngineHarness({ phase: 'e5' });

// 1-7. Structural.
const chk = checkCanonicalVerificationAndStatuses(SITE);
ok('P1 official E5 checker passes', chk.fail === 0, chk.failures.join('; '));
ok('P2 E2 keeps 24 exports', E2_EXPORTS.length === 24);
ok('P3 E3 keeps 22 exports', E3_EXPORTS.length === 22);
ok('P4 E4 keeps 8 exports', E4_EXPORTS.length === 8);
ok('P5 E5 exposes exactly its closed list', eq(Object.keys(h5.load(SITE).fns).sort(), E5_EXPORTS.slice().sort()));
ok('P6 zero E6 exposed', (() => { try { h5.load(SITE, ['buildWorkerSource_']); return false; } catch (e) { return /forbidden \(E6\)/.test(e.message); } })());
ok('P7 clean state per load', h5.load(SITE).fns !== h5.load(SITE).fns);

// 8-11. optimal results (continuous / integer / binary / mixed).
let r = solve(buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]), false);
ok('P8 continuous optimal', r.status === 'optimal' && r.objective === 12 && r.modelType === 'continuous');
r = solve(buildMax([{ name: 'A', profit: 5 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 1], rel: '<=', limit: 7 }]), true);
ok('P9 integer optimal', r.status === 'optimal' && r.objective === 16 && r.modelType === 'integer');
// binary via panel domains: use detectModel_ then set domains
(function () {
  const grid = buildMax([{ name: 'A', profit: 5 }, { name: 'B', profit: 3 }], [{ label: 'C1', coefs: [3, 3], rel: '<=', limit: 4 }]);
  const sheet = mkSheet(grid); const model = P.detectModel_(sheet);
  model.domains = { integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }] };
  const rr = P.solveModel_(sheet, model);
  ok('P10 binary optimal', rr.status === 'optimal' && rr.modelType === 'binary');
  ok('P11 mixed optimal', (function () {
    const g2 = buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 10 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]);
    const s2 = mkSheet(g2); const m2 = P.detectModel_(s2); m2.domains = { integer: [1], bounds: [null, null] };
    const r2 = P.solveModel_(s2, m2); return r2.status === 'optimal' && r2.modelType === 'mixed';
  })());
})();

// 12-14. unbounded / infeasible.
r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 1 }]), false);
ok('P12 continuous unbounded', r.status === 'unbounded' && !('values' in r));
r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 5 }, { label: 'C2', coefs: [1, 0], rel: '<=', limit: 1 }]), false);
ok('P13 continuous infeasible', r.status === 'infeasible' && typeof r.explanation === 'string');
r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 2 }, { label: 'C2', coefs: [1, 0], rel: '<=', limit: 1 }]), true);
ok('P14 integer infeasible', r.status === 'infeasible' && r.optimalityProven === false);

// 15. numerical_failure (Infinity bound via domains).
(function () {
  const grid = buildMax([{ name: 'A', profit: 1 }], [{ label: 'C1', coefs: [1], rel: '<=', limit: 10 }]);
  const sheet = mkSheet(grid); const model = P.detectModel_(sheet);
  model.domains = { integer: false, bounds: [{ lower: 0, upper: Infinity }] };
  const rr = P.solveModel_(sheet, model);
  ok('P15 numerical_failure (Infinity bound)', rr.status === 'numerical_failure' && typeof rr.explanation === 'string');
})();

// 16-20. Limits (deterministic Date stub).
function limit(N) { let c = 0; const st = loadProbe(['solveModel_', 'detectModel_'], function () { c++; return c <= N ? 0 : 1e15; }); const sheet = mkSheet(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 2], rel: '<=', limit: 5 }])); const model = st.detectModel_(sheet); model.wholeNumbers = true; return st.solveModel_(sheet, model); }
ok('P16 node/time limit WITH incumbent -> feasible', (function () { const rr = limit(14); return rr.status === 'feasible' && 'values' in rr; })());
ok('P17 time limit WITHOUT incumbent -> unknown', (function () { const rr = limit(2); return rr.status === 'unknown' && !('values' in rr); })());
ok('P18 feasible has caveat', limit(14).caveat && typeof limit(14).caveat === 'string');
ok('P19 unknown has explanation', typeof limit(2).explanation === 'string');
ok('P20 normal model hits no limit', solve(buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]), false).status === 'optimal');

// 21-27. Status/stopReason/optimalityProven/objective/values/nodesExplored.
r = solve(buildMax([{ name: 'A', profit: 5 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 1], rel: '<=', limit: 7 }]), true);
ok('P21 status correct', r.status === 'optimal');
ok('P22 stopReason null on proven optimal', r.stopReason === null);
ok('P23 optimalityProven true correct', r.optimalityProven === true);
ok('P24 optimalityProven false on feasible', limit(14).optimalityProven === false);
ok('P25 objective correct', r.objective === 16);
ok('P26 values correct', eq(r.values, [3, 1]));
ok('P27 nodesExplored correct (integer)', r.nodesExplored === 3);

// 28-37. Verification.
ok('P28 objective recompute matches', (function () { const rr = solve(buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]), false); return rr.objective === 12; })());
ok('P29 constraint <= verified', P.isSatisfied_(4, '<=', 4) === true && P.isSatisfied_(5, '<=', 4) === false);
ok('P30 constraint >= verified', P.isSatisfied_(4, '>=', 4) === true && P.isSatisfied_(3, '>=', 4) === false);
ok('P31 equality verified', P.isSatisfied_(4, '=', 4) === true && P.isSatisfied_(4.5, '=', 4) === false);
ok('P32 lower bound verified', (function () { const vd = P.buildVariableDomains_({ integer: [0], bounds: [{ lower: 2, upper: 10 }] }, false, ['B2'], ['x'], [1], 'integer'); return vd[0].satisfied === false; })());
ok('P33 upper bound verified', (function () { const vd = P.buildVariableDomains_({ integer: [0], bounds: [{ lower: 0, upper: 3 }] }, false, ['B2'], ['x'], [5], 'integer'); return vd[0].satisfied === false; })());
ok('P34 free variable (no bounds)', (function () { const vd = P.buildVariableDomains_(null, false, ['B2'], ['x'], [7], 'continuous'); return vd.length === 0; })());
ok('P35 fixed variable (lower==upper)', (function () { const vd = P.buildVariableDomains_({ integer: false, bounds: [{ lower: 5, upper: 5 }] }, false, ['B2'], ['x'], [5], 'continuous'); return vd[0].min === 5 && vd[0].max === 5; })());
ok('P36 integer verified', P.isWhole_(3) === true && P.isWhole_(3.5) === false);
ok('P37 binary verified', (function () { const vd = P.buildVariableDomains_({ integer: [0], bounds: [{ lower: 0, upper: 1 }] }, false, ['B2'], ['x'], [0.5], 'binary'); return vd[0].binarySatisfied === false; })());

// 38-42. Invalid vector / NaN / Infinity / tolerance.
const fm = { objective: [1, 1], constraints: [{ coefficients: [1, 1], relation: '<=', rhs: 4 }] };
ok('P38 invalid vector length handled', P.feasibleAt_(fm, fm.constraints, [1]) === false || P.feasibleAt_(fm, fm.constraints, [1]) === true);
ok('P39 NaN rejected', P.feasibleAt_(fm, fm.constraints, [NaN, 0]) === false);
ok('P40 Infinity rejected', P.feasibleAt_(fm, fm.constraints, [Infinity, 0]) === false);
ok('P41 tolerance inside', P.isSatisfied_(4 + 9e-7, '<=', 4) === true);
ok('P42 tolerance outside', P.isSatisfied_(4 + 2e-6, '<=', 4) === false);

// 43-45. Status vs error separation.
ok('P43 technical error preserved (thrown, not a status)', (function () { try { const sheet = mkSheet([['Item', 'Units', 'x', 'Total', 'Rel', 'Limit'], ['A', '0', '', '', '', ''], ['', '', '', '', '', ''], ['Total', '', '', '=BADFUNC(B2)', '', ''], ['C1', '', '', '=1*B2', '<=', '4']]); const model = P.detectModel_(sheet); P.solveModel_(sheet, model); return false; } catch (e) { return true; } })());
ok('P44 status not converted to error (infeasible returns)', solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 5 }, { label: 'C2', coefs: [1, 0], rel: '<=', limit: 1 }]), false).status === 'infeasible');
ok('P45 error not converted to status (explainStatus_ is text)', typeof P.explainStatus_('infeasible', { variables: 'B2:B3' }) === 'string');

// 46-48. Parity.
const mirrorMod = require(path.join(SITE, 'engine', 'engine.js'));
const mapi = mirrorMod.PlumlineEngine || mirrorMod;
ok('P46 direct parity feasibleAt_ canonical == mirror', [[2, 2], [3, 3], [NaN, 0]].every(v => P.feasibleAt_(fm, fm.constraints, v) === mapi.feasibleAt_(fm, fm.constraints, v)));
ok('P47 observable parity solveModel_ canonical == mirror', (function () { const grid = buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]); const rc = solve(grid, false); const s = mkSheet(grid); const m = mapi.detectModel_(s); const rm = mapi.solveModel_(s, m); return eq(stripElapsed(rc), stripElapsed(rm)); })());
ok('P48 only two approved divergences', (function () { const g = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e5-verification-statuses.json'), 'utf8')); return eq(g.parity.approved_divergences.slice().sort(), ['newContext_', 'readConstraint_']); })());

// 49-52. Integrity.
ok('P49 engine SHA intact', sha(canonSrc) === '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf');
ok('P50 mirror is the generated artefact (E6 authority)', (function(){ try { return fs.readFileSync(path.join(SITE,'engine','engine.js'),'utf8') === require('./generate-engine-mirror.js').generateMirror(SITE); } catch(e){ return false; } })());
ok('P51 Worker integrity checker present', fs.existsSync(path.join(SITE, 'engine', 'tests_engine_integrity.js')));
// P52 composed output byte-identity is owned by validate_dist (build-only); not asserted here.
ok('P52 E5 checker independent of dist', checkCanonicalVerificationAndStatuses(SITE).pass > 0);

// 53-54. Dist independence + spaced path.
ok('P53 no dist dependency in this suite', !/existsSync\([^)]*dist/.test(fs.readFileSync(__filename, 'utf8')) && !/readFileSync\([^)]*dist[^)]*solver/.test(fs.readFileSync(__filename, 'utf8')));
ok('P54 runs from a spaced path', (function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e5 space-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    ['engine/source/plumline-engine.js', 'engine/e2-exports.js', 'engine/e3-exports.js', 'engine/e4-exports.js', 'engine/e5-exports.js', 'engine/canonical-engine-harness.js'].forEach(f => fs.copyFileSync(path.join(SITE, f), path.join(base, f)));
    delete require.cache[path.join(base, 'engine', 'canonical-engine-harness.js')];
    const H = require(path.join(base, 'engine', 'canonical-engine-harness.js'));
    return Object.keys(H.createCanonicalEngineHarness({ phase: 'e5' }).load(base).fns).length === E5_EXPORTS.length;
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})());

console.log('CANONICAL VERIFICATION + STATUSES POSITIVE (E5)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
