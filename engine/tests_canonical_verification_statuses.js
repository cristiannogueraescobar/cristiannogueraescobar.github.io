/* tests_canonical_verification_statuses.js — Checkpoint E5 authority.
 *
 * checkCanonicalVerificationAndStatuses(siteDir) -> { pass, fail, failures }
 *
 * The ONE reusable checker for E5 solution verification, final statuses, stop
 * reasons, optimalityProven, result adaptation, and the status-vs-error
 * separation. It runs the canonical production source through the canonical
 * harness (E5 phase): solveModel_ end-to-end on stub sheets, plus
 * isSatisfied_/feasibleAt_/buildVariableDomains_/isWhole_ probes. It validates
 * E2/E3/E4 intact, closed E5 exports, E6 excluded, clean state, the verification
 * combination, the result schema, statuses, stop reasons, optimalityProven,
 * incumbent / no-incumbent behaviour, technical errors, status-vs-error
 * separation, canonical/mirror parity (direct + observable), the two approved
 * divergences, and engine/mirror/composed-output integrity. It NEVER
 * re-implements verification or status mapping — it runs the canonical functions.
 * It is dist-independent (reads only source/mirror/harness/fixture; the
 * public-output byte-identity is owned by validate_dist).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { createCanonicalEngineHarness, sheetStub } = require('./canonical-engine-harness.js');
const { E5_EXPORTS, FORBIDDEN_E6 } = require('./e5-exports.js');
const { E4_EXPORTS } = require('./e4-exports.js');
const { E3_EXPORTS } = require('./e3-exports.js');
const { E2_EXPORTS } = require('./e2-exports.js');

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function stripElapsed(r) { if (!r || typeof r !== 'object') return r; const c = Object.assign({}, r); delete c.elapsedMs; return c; }

// E6: mirror is a GENERATED artefact; current-state SHA owned by the E6 checker.
// We validate the mirror is the generator's output, not a hardcoded pin.
const ENGINE_SHA = '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf';
const REL = { '<=': 1, '>=': 1, '=': 1 };

// Probe: load the FULL canonical source raw, expose named functions. `dateNow`
// replaces Date.now for deterministic limit tests (no real wait).
function loadProbe(canonSrc, names, dateNow) {
  let DateCtor = Date;
  if (dateNow) {
    DateCtor = function (a, b, c, d, e, f, g) { return new Date(a, b, c, d, e, f, g); };
    DateCtor.now = dateNow; DateCtor.prototype = Date.prototype;
  }
  const sb = { Math: Math, Date: DateCtor, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.__e = {};
  vm.createContext(sb);
  vm.runInContext(canonSrc + '\n;(function(){' + names.map(n => 'if(typeof ' + n + '!=="undefined")__e["' + n + '"]=' + n + ';').join('') + '})();', sb);
  return sb.__e;
}

// Build a stub sheet the way the legacy suites do (formulas hold only "=..."
// cells; relations and numbers live in values).
function mkSheet(grid) {
  const isF = x => typeof x === 'string' && x[0] === '=' && !REL[x];
  const formulas = grid.map(r => r.map(c => (isF(c) ? c : '')));
  const values = grid.map(r => r.map(c => {
    if (isF(c)) return 0;
    if (c === '' || c == null) return '';
    if (REL[c]) return c;
    const n = Number(c);
    return (!isNaN(n) && String(n) === String(c).trim()) ? n : c;
  }));
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

function checkCanonicalVerificationAndStatuses(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  let pass = 0, fail = 0; const failures = [];
  function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }
  function throws(fn, needle) { try { fn(); return false; } catch (e) { return needle ? e.message.indexOf(needle) !== -1 : true; } }

  const canonAbs = path.join(siteDir, 'engine', 'source', 'plumline-engine.js');
  const canonSrc = fs.readFileSync(canonAbs, 'utf8');
  const g = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e5-verification-statuses.json'), 'utf8'));

  // 1. Engine + mirror pinned.
  ok('engine SHA unchanged (pinned)', sha(canonSrc) === ENGINE_SHA, sha(canonSrc));
  const mirrorSrc = fs.readFileSync(path.join(siteDir, 'engine', 'engine.js'), 'utf8');
  // E6: mirror is a generated artefact; assert it equals the generator output
  // (current-state authority is the E6 checker), not a hardcoded pin.
  let genMirror = null; try { genMirror = require('./generate-engine-mirror.js').generateMirror(siteDir); } catch (e) { genMirror = null; }
  ok('mirror engine.js matches the generator output (E6 authority)', genMirror !== null && mirrorSrc === genMirror, sha(mirrorSrc));

  // 2. Harness hygiene.
  const harnessSrc = fs.readFileSync(path.join(siteDir, 'engine', 'canonical-engine-harness.js'), 'utf8');
  ok('harness reads canonical source', harnessSrc.indexOf('plumline-engine.js') !== -1);
  ok('harness does not use engine/engine.js', !/require\([^)]*\/engine\.js/.test(harnessSrc) && !/readFileSync\([^)]*['"]engine\.js/.test(harnessSrc));
  ok('harness does not read solver.html', !/readFileSync\([^)]*solver\.html/.test(harnessSrc));
  ok('harness does not read dist', !/path\.join\([^)]*['"]dist['"]/.test(harnessSrc));

  // 3. Phases: E2=24, E3=22, E4=8, E5 closed.
  const h5 = createCanonicalEngineHarness({ phase: 'e5' });
  const E = h5.load(siteDir).fns;
  ok('E5 phase exposes exactly the closed E5 list', eq(Object.keys(E).sort(), E5_EXPORTS.slice().sort()));
  ok('E5 export count matches fixture', E5_EXPORTS.length === g.exports.e5_count);
  ok('E4 phase still exactly 8', Object.keys(createCanonicalEngineHarness({ phase: 'e4' }).load(siteDir).fns).length === 8 && E4_EXPORTS.length === 8);
  ok('E3 phase still exactly 22', Object.keys(createCanonicalEngineHarness({ phase: 'e3' }).load(siteDir).fns).length === 22 && E3_EXPORTS.length === 22);
  ok('E2 phase still exactly 24', Object.keys(createCanonicalEngineHarness({ phase: 'e2' }).load(siteDir).fns).length === 24 && E2_EXPORTS.length === 24);

  // 4. Forbidden E6 rejected; other-phase names rejected in E5.
  ok('E5 rejects an E6 function', throws(() => h5.load(siteDir, ['buildWorkerSource_']), 'forbidden (E6)'));
  ok('E5 rejects an E4-only function', throws(() => h5.load(siteDir, ['solveIntegerProgram_']), 'not in the closed E5'));
  ok('E5 rejects an E3-only function (optimise_)', throws(() => h5.load(siteDir, ['optimise_']), 'not in the closed E5'));
  ok('E5 forbidden set matches fixture', eq(FORBIDDEN_E6.slice().sort(), g.exports.forbidden_e6.slice().sort()));

  // 5. Clean state per load.
  const A = h5.load(siteDir); const B = h5.load(siteDir);
  ok('each E5 load has a fresh context', A.fns !== B.fns && A.sandbox !== B.sandbox);

  // ---- solveModel_ end-to-end via the probe (needs detectModel_ too) --------
  const probe = loadProbe(canonSrc, ['solveModel_', 'detectModel_', 'isSatisfied_', 'feasibleAt_', 'buildVariableDomains_', 'isWhole_', 'validModelShape_', 'finiteModel_', 'explainStatus_']);
  function solve(grid, integer, sense) {
    const sheet = mkSheet(grid);
    const model = probe.detectModel_(sheet);
    if (integer) model.wholeNumbers = true;
    if (sense) model.objective.sense = sense;
    return probe.solveModel_(sheet, model);
  }
  let r;

  // 6. Continuous optimal — status/optimalityProven/stopReason/nodesExplored/values.
  r = solve(buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]), false);
  ok('continuous optimal status/optProven/stopReason/nodesExplored', r.status === 'optimal' && r.optimalityProven === true && r.stopReason === null && r.nodesExplored === null);
  ok('continuous optimal objective/values/modelType', r.objective === 12 && eq(r.values, [4, 0]) && r.modelType === 'continuous');
  // 7. Result schema — required fields present.
  ['status', 'stopReason', 'optimalityProven', 'nodesExplored', 'modelType', 'sense', 'variables', 'values', 'objective', 'constraints', 'variableDomains'].forEach(function (f) {
    ok('result schema has field: ' + f, Object.prototype.hasOwnProperty.call(r, f));
  });
  ok('constraint report verified (used/slack/binding/satisfied)', Array.isArray(r.constraints) && r.constraints[0] && r.constraints[0].used === 4 && r.constraints[0].satisfied === true && r.constraints[0].binding === true);

  // 8. Minimize continuous.
  r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 1], rel: '>=', limit: 2 }]), false, 'min');
  ok('minimize continuous optimal', r.status === 'optimal' && r.sense === 'min');

  // 9. Continuous unbounded.
  r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 1 }]), false);
  ok('continuous unbounded status', r.status === 'unbounded' && !('values' in r) && typeof r.explanation === 'string');

  // 10. Continuous infeasible.
  r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 5 }, { label: 'C2', coefs: [1, 0], rel: '<=', limit: 1 }]), false);
  ok('continuous infeasible status + explanation', r.status === 'infeasible' && typeof r.explanation === 'string' && !('values' in r));

  // 11. Integer optimal.
  r = solve(buildMax([{ name: 'A', profit: 5 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 1], rel: '<=', limit: 7 }]), true);
  ok('integer optimal status/objective/values/nodesExplored', r.status === 'optimal' && r.objective === 16 && eq(r.values, [3, 1]) && r.nodesExplored === 3 && r.modelType === 'integer' && r.optimalityProven === true);

  // 12. Integer infeasible.
  r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 2 }, { label: 'C2', coefs: [1, 0], rel: '<=', limit: 1 }]), true);
  ok('integer infeasible status', r.status === 'infeasible' && r.optimalityProven === false);

  // ---- Verification functions (independent maths) --------------------------
  // 13-15. isSatisfied_ (<=, >=, =) with the engine's 1e-6 tolerance.
  ok('isSatisfied_ <= within tolerance', probe.isSatisfied_(4.0000005, '<=', 4) === true && probe.isSatisfied_(5, '<=', 4) === false);
  ok('isSatisfied_ >= within tolerance', probe.isSatisfied_(4, '>=', 4) === true && probe.isSatisfied_(3, '>=', 4) === false);
  ok('isSatisfied_ equality within tolerance', probe.isSatisfied_(4, '=', 4) === true && probe.isSatisfied_(4.5, '=', 4) === false);
  // 16. Tolerance boundary.
  ok('isSatisfied_ tolerance boundary (1e-6)', probe.isSatisfied_(4 + 9e-7, '<=', 4) === true && probe.isSatisfied_(4 + 2e-6, '<=', 4) === false);
  // 17-18. feasibleAt_ shape + finiteness.
  const fm = { objective: [1, 1], constraints: [{ coefficients: [1, 1], relation: '<=', rhs: 4 }] };
  ok('feasibleAt_ feasible vs infeasible point', probe.feasibleAt_(fm, fm.constraints, [2, 2]) === true && probe.feasibleAt_(fm, fm.constraints, [3, 3]) === false);
  ok('feasibleAt_ rejects NaN and Infinity', probe.feasibleAt_(fm, fm.constraints, [NaN, 0]) === false && probe.feasibleAt_(fm, fm.constraints, [Infinity, 0]) === false);
  // 19. isWhole_.
  ok('isWhole_ integrality (1e-6)', probe.isWhole_(3) === true && probe.isWhole_(3.0000001) === true && probe.isWhole_(3.5) === false);
  // 20-22. buildVariableDomains_ bound/integer/binary verification.
  let vd = probe.buildVariableDomains_({ integer: [0], bounds: [{ lower: 0, upper: 1 }] }, false, ['B2'], ['x'], [1], 'binary');
  ok('buildVariableDomains_ binary value 1 satisfied', vd[0].type === 'binary' && vd[0].satisfied === true && vd[0].binarySatisfied === true);
  vd = probe.buildVariableDomains_({ integer: [0], bounds: [{ lower: 0, upper: 1 }] }, false, ['B2'], ['x'], [0.5], 'binary');
  ok('buildVariableDomains_ binary 0.5 rejected', vd[0].satisfied === false && vd[0].binarySatisfied === false);
  vd = probe.buildVariableDomains_({ integer: [0], bounds: [{ lower: 2, upper: 10 }] }, false, ['B2'], ['x'], [3], 'integer');
  ok('buildVariableDomains_ integer within bounds satisfied', vd[0].type === 'integer' && vd[0].satisfied === true && vd[0].integralitySatisfied === true);
  vd = probe.buildVariableDomains_({ integer: [0], bounds: [{ lower: 2, upper: 10 }] }, false, ['B2'], ['x'], [1], 'integer');
  ok('buildVariableDomains_ lower-bound violation rejected', vd[0].satisfied === false);
  vd = probe.buildVariableDomains_({ integer: [0], bounds: [{ lower: 0, upper: 10 }] }, false, ['B2'], ['x'], [3.5], 'integer');
  ok('buildVariableDomains_ fractional integer rejected', vd[0].integralitySatisfied === false);
  vd = probe.buildVariableDomains_({ integer: false, bounds: [{ lower: 0, upper: 3 }] }, false, ['B2'], ['x'], [5], 'continuous');
  ok('buildVariableDomains_ upper-bound violation rejected', vd[0].satisfied === false);

  // ---- Limits: incumbent / no-incumbent (deterministic Date stub) ----------
  // 23. time_limit WITHOUT incumbent -> unknown, no values.
  let c1 = 0;
  const stub1 = loadProbe(canonSrc, ['solveModel_', 'detectModel_'], function () { c1++; return c1 <= 2 ? 0 : 1e15; });
  (function () {
    const sheet = mkSheet(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 2], rel: '<=', limit: 5 }]));
    const model = stub1.detectModel_(sheet); model.wholeNumbers = true;
    const rr = stub1.solveModel_(sheet, model);
    ok('time_limit without incumbent -> unknown', rr.status === 'unknown' && rr.optimalityProven === false && !('values' in rr) && typeof rr.explanation === 'string');
  })();
  // 24. time_limit WITH incumbent -> feasible + caveat.
  let c2 = 0;
  const stub2 = loadProbe(canonSrc, ['solveModel_', 'detectModel_'], function () { c2++; return c2 <= 14 ? 0 : 1e15; });
  (function () {
    const sheet = mkSheet(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 2], rel: '<=', limit: 5 }]));
    const model = stub2.detectModel_(sheet); model.wholeNumbers = true;
    const rr = stub2.solveModel_(sheet, model);
    ok('time_limit with incumbent -> feasible + caveat', rr.status === 'feasible' && rr.stopReason === 'time_limit' && rr.optimalityProven === false && 'values' in rr && typeof rr.caveat === 'string');
  })();

  // ---- optimalityProven contract -------------------------------------------
  // 25. Always a boolean.
  r = solve(buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]), false);
  ok('optimalityProven is always a boolean', typeof r.optimalityProven === 'boolean');
  // 25b. optimalityProven is a boolean even on unbounded (internal value is undefined -> coerced false).
  r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 1 }]), false);
  ok('optimalityProven boolean on unbounded (coerced false)', r.status === 'unbounded' && typeof r.optimalityProven === 'boolean' && r.optimalityProven === false);
  // 25c. numerical_failure surfaces as a status field (Infinity bound).
  (function () {
    const sheet = mkSheet(buildMax([{ name: 'A', profit: 1 }], [{ label: 'C1', coefs: [1], rel: '<=', limit: 10 }]));
    const model = probe.detectModel_(sheet); model.domains = { integer: false, bounds: [{ lower: 0, upper: Infinity }] };
    const rr = probe.solveModel_(sheet, model);
    ok('numerical_failure is a status field', rr.status === 'numerical_failure' && typeof rr.explanation === 'string');
  })();

  // ---- Status vs error separation ------------------------------------------
  // 26. A mathematical status is a field, not a throw.
  r = solve(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [1, 0], rel: '>=', limit: 5 }, { label: 'C2', coefs: [1, 0], rel: '<=', limit: 1 }]), false);
  ok('infeasible is a status field, not a thrown error', r && r.status === 'infeasible');
  // 27. A technical error is thrown (unreadable objective).
  ok('unreadable objective throws a technical error', throws(function () {
    const sheet = mkSheet([['Item', 'Units', 'x', 'Total', 'Rel', 'Limit'], ['A', '0', '', '', '', ''], ['', '', '', '', '', ''], ['Total', '', '', '=UNKNOWNFUNC(B2)', '', ''], ['C1', '', '', '=1*B2', '<=', '4']]);
    const model = probe.detectModel_(sheet);
    probe.solveModel_(sheet, model);
  }));
  // 28. explainStatus_ maps a status to text (not to an error).
  ok('explainStatus_ maps infeasible to text', typeof probe.explainStatus_('infeasible', { variables: 'B2:B3' }) === 'string');

  // ---- Characterised defects (D-E5-1, D-E5-2) — NOT fixed ------------------
  // D-E5-1: explainStatus_ carries a branch for a status string the engine's
  // internal solver never produces (dead branch, cosmetic UI text). We pin BOTH
  // sides: the branch still returns its own text, AND no engine return emits that
  // status. This is a characterisation, not an endorsement.
  ok('D-E5-1 explainStatus_ dead branch returns its own text', probe.explainStatus_('no whole-number solution found in time', { variables: 'B2' }).indexOf('whole-number') !== -1);
  ok('D-E5-1 engine never produces that status in a return', !canonSrc.split('\n').some(function (l) { return /status:\s*.no whole-number/.test(l); }));
  // D-E5-2: a time/node limit with NO incumbent yields status 'unknown' with
  // optimalityProven false; solveModel_ preserves the internal stopReason. Pinned
  // as current behaviour (deferred to a later algorithmic phase, not corrected).
  (function () {
    let c = 0;
    const stub = loadProbe(canonSrc, ['solveModel_', 'detectModel_'], function () { c++; return c <= 2 ? 0 : 1e15; });
    const sheet = mkSheet(buildMax([{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 2], rel: '<=', limit: 5 }]));
    const model = stub.detectModel_(sheet); model.wholeNumbers = true;
    const rr = stub.solveModel_(sheet, model);
    ok('D-E5-2 limit without incumbent -> unknown, optProven false', rr.status === 'unknown' && rr.optimalityProven === false);
  })();
  // 28b. A guessed constraint (no explicit operator+limit) throws a technical error, not a status.
  ok('guessed constraint throws a technical error', throws(function () {
    const sheet = mkSheet([['Item', 'Units', 'x', 'Total', 'Rel', 'Limit'], ['A', '0', '', '', '', ''], ['B', '0', '', '', '', ''], ['', '', '', '', '', ''], ['Total', '', '', '=3*B2+2*B3', '', ''], ['C1', '', '', '=1*B2+1*B3', '', '4']]);
    const model = probe.detectModel_(sheet);
    if (model.constraints) model.constraints.forEach(function (c) { c.guessed = true; });
    probe.solveModel_(sheet, model);
  }));

  // ---- Constants intact (verification tolerances) --------------------------
  ok('constraint tolerance 1e-6 in isSatisfied_', /const tolerance = 1e-6/.test(canonSrc));
  ok('EPSILON 1e-9', /EPSILON:\s*1e-9/.test(canonSrc));

  // ---- Parity canonical <-> mirror -----------------------------------------
  const mirrorMod = require(path.join(siteDir, 'engine', 'engine.js'));
  const mapi = mirrorMod.PlumlineEngine || mirrorMod;
  // 29-31. Direct parity: feasibleAt_ / validModelShape_ / finiteModel_.
  ok('direct parity feasibleAt_ canonical == mirror', [[2, 2], [3, 3], [NaN, 0], [Infinity, 0]].every(function (v) { return probe.feasibleAt_(fm, fm.constraints, v) === mapi.feasibleAt_(fm, fm.constraints, v); }));
  ok('direct parity validModelShape_ canonical == mirror', probe.validModelShape_(fm) === mapi.validModelShape_(fm) && probe.validModelShape_({ objective: [1], constraints: [], bounds: [] }) === mapi.validModelShape_({ objective: [1], constraints: [], bounds: [] }));
  ok('direct parity finiteModel_ canonical == mirror', probe.finiteModel_(fm) === mapi.finiteModel_(fm));
  // 32. Observable parity: solveModel_ (elapsedMs excluded).
  (function () {
    const grid = buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]);
    const rc = solve(grid, false);
    const sheetM = mkSheet(grid); const modelM = mapi.detectModel_(sheetM); const rm = mapi.solveModel_(sheetM, modelM);
    ok('observable parity solveModel_ canonical == mirror (elapsedMs excluded)', eq(stripElapsed(rc), stripElapsed(rm)));
  })();
  // 33. Only two approved divergences.
  ok('approved divergences are exactly newContext_/readConstraint_', eq(g.parity.approved_divergences.slice().sort(), ['newContext_', 'readConstraint_']));

  // ---- Fixture hygiene -----------------------------------------------------
  const fx = fs.readFileSync(path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e5-verification-statuses.json'), 'utf8');
  ok('E5 fixture has no absolute path', !/(^|["\s])\/(home|Users|mnt|tmp|usr)\//.test(fx));
  ok('E5 fixture pins engine SHA', g.engine.sha256 === ENGINE_SHA);
  ok('E5 fixture pins the HISTORICAL mirror SHA (its phase state, not E6)', g.mirror.sha256 === '6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa');

  // ---- Public output: owned by validate_dist (dist-independent) ------------
  // The composed public-output byte-identity is a build/composition contract owned
  // by engine/validate_dist.js (run during npm run build). It is deliberately NOT
  // asserted here so this checker returns the same pass count with or without dist.

  return { pass, fail, failures };
}

module.exports = { checkCanonicalVerificationAndStatuses: checkCanonicalVerificationAndStatuses };

if (require.main === module) {
  const r = checkCanonicalVerificationAndStatuses(path.join(__dirname, '..'));
  console.log('CANONICAL VERIFICATION + STATUSES (E5)  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  if (r.fail) { r.failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}
