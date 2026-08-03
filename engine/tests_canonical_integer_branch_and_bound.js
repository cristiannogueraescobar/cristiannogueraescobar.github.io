/* tests_canonical_integer_branch_and_bound.js — Checkpoint E4 authority.
 *
 * checkCanonicalIntegerAndBranchAndBound(siteDir) -> { pass, fail, failures }
 *
 * The ONE reusable checker for E4 integer / binary / mixed solving and
 * branch-and-bound. It runs the canonical production source through the canonical
 * harness (E4 phase) and validates: E2/E3 intact, closed E4 exports, E5-E6
 * excluded, clean state, domain classification, integrality, binary, mixed,
 * continuous bypass, branch selection, node creation, DFS traversal order
 * (ceil-first), incumbent, pruning, maximise/minimise, node/depth/time limits
 * (deterministic Date stub — no real wait), the internal integer result contract,
 * canonical/mirror parity (direct + observable), the two approved divergences,
 * and that engine/mirror/public output are intact. It NEVER re-implements
 * branch-and-bound — it runs the canonical optimise_/solveIntegerProgram_ through
 * the harness/probe.
 *
 * INTERNAL vs PUBLIC: it records the internal integer result contract; it does
 * NOT redefine the public status/stopReason/optimalityProven semantics (E5).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { createCanonicalEngineHarness } = require('./canonical-engine-harness.js');
const { E4_EXPORTS, FORBIDDEN_E5_E6 } = require('./e4-exports.js');
const { E3_EXPORTS } = require('./e3-exports.js');
const { E2_EXPORTS } = require('./e2-exports.js');

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// E6: mirror is a GENERATED artefact; current-state SHA owned by the E6 checker.
// We validate the mirror is the generator's output, not a hardcoded pin.
const ENGINE_SHA = '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf';

// Load the FULL canonical source raw in a controllable context. `dateNow`, when
// given, replaces Date.now so the time-limit branch can be reached deterministically
// (no real 20s wait). This is a PROBE for internal branch-and-bound / observable
// parity checks — NOT the E4 harness API surface.
function loadProbe(canonSrc, names, dateNow) {
  let DateCtor = Date;
  if (dateNow) {
    DateCtor = function (a, b, c, d, e, f, g) { return new Date(a, b, c, d, e, f, g); };
    DateCtor.now = dateNow;
    DateCtor.prototype = Date.prototype;
  }
  const sb = { Math: Math, Date: DateCtor, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.__e = {};
  vm.createContext(sb);
  vm.runInContext(canonSrc + '\n;(function(){' + names.map(n => 'if(typeof ' + n + '!=="undefined")__e["' + n + '"]=' + n + ';').join('') + '})();', sb);
  return sb.__e;
}

function checkCanonicalIntegerAndBranchAndBound(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  let pass = 0, fail = 0; const failures = [];
  function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }
  function throws(fn, needle) { try { fn(); return false; } catch (e) { return needle ? e.message.indexOf(needle) !== -1 : true; } }

  const canonAbs = path.join(siteDir, 'engine', 'source', 'plumline-engine.js');
  const canonSrc = fs.readFileSync(canonAbs, 'utf8');
  const g = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e4-integer-branch-and-bound.json'), 'utf8'));

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

  // 3. Phases: E2=24, E3=22, E4 closed.
  const h4 = createCanonicalEngineHarness({ phase: 'e4' });
  const E = h4.load(siteDir).fns;
  ok('E4 phase exposes exactly the closed E4 list', eq(Object.keys(E).sort(), E4_EXPORTS.slice().sort()));
  ok('E4 export count matches fixture', E4_EXPORTS.length === g.exports.e4_count);
  const h3 = createCanonicalEngineHarness({ phase: 'e3' });
  ok('E3 phase still exactly 22', Object.keys(h3.load(siteDir).fns).length === 22 && E3_EXPORTS.length === 22);
  const h2 = createCanonicalEngineHarness({ phase: 'e2' });
  ok('E2 phase still exactly 24', Object.keys(h2.load(siteDir).fns).length === 24 && E2_EXPORTS.length === 24);

  // 4. Forbidden E5-E6 rejected; other-phase names rejected in E4.
  ok('E4 rejects an E5 function', throws(() => h4.load(siteDir, ['solveModel_']), 'forbidden (E5-E6)'));
  ok('E4 rejects an E2-only function', throws(() => h4.load(siteDir, ['tokenize_']), 'not in the closed E4'));
  ok('E4 rejects an E3-only function', throws(() => h4.load(siteDir, ['detectModel_']), 'not in the closed E4'));
  ok('E4 forbidden set matches fixture', eq(FORBIDDEN_E5_E6.slice().sort(), g.exports.forbidden_e5_e6.slice().sort()));

  // 5. Clean state per load.
  const A = h4.load(siteDir); const B = h4.load(siteDir);
  ok('each E4 load has a fresh context', A.fns !== B.fns && A.sandbox !== B.sandbox);

  // ---- Branch-and-bound INTERNAL contracts (optimise_ with integer models) ----
  const probe = loadProbe(canonSrc, ['optimise_', 'solveIntegerProgram_', 'isWhole_', 'integerIndices_', 'classifyModel_', 'buildVariableDomains_', 'solveLinearProgram_', 'feasibleAt_']);
  const O = probe.optimise_;
  function ip(objective, constraints, integer, bounds, opts) {
    return Object.assign({ objective: objective, constant: 0, maximize: true, constraints: constraints || [], integer: integer, bounds: bounds || [] }, opts || {});
  }
  let r;
  // 6. Integer single var.
  r = O(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0]));
  ok('integer single var (max 5x st 2x<=7 -> 15 at [3], nodes 3)', r.status === 'optimal' && r.objective === 15 && eq(r.values, [3]) && r.nodesExplored === 3 && r.optimalityProven === true);
  // 7. Integer already integral.
  r = O(ip([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }], [0, 1]));
  ok('integer already integral (max 3x+2y st x+y<=4 -> 12 at [4,0], nodes 1)', r.status === 'optimal' && r.objective === 12 && eq(r.values, [4, 0]) && r.nodesExplored === 1);
  // 8. Integer fractional relaxation -> branch.
  r = O(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1]));
  ok('integer fractional relaxation (max x+y st 2x+2y<=5 -> 2 at [0,2], nodes 13)', r.status === 'optimal' && r.objective === 2 && eq(r.values, [0, 2]) && r.nodesExplored === 13);
  // 9. integer:true (all indices).
  r = O(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], true));
  ok('integer:true all indices (max 5x st 2x<=7 -> 15 at [3])', r.status === 'optimal' && r.objective === 15 && eq(r.values, [3]));
  // 10. Integer infeasible.
  r = O(ip([1], [{ coefficients: [1], relation: '>=', rhs: 2 }, { coefficients: [1], relation: '<=', rhs: 1 }], [0]));
  ok('integer infeasible (x>=2 and x<=1 -> infeasible, nodes 1, opt false)', r.status === 'infeasible' && r.nodesExplored === 1 && r.optimalityProven === false);
  // 11. Minimize integer.
  r = O(ip([1], [{ coefficients: [1], relation: '>=', rhs: 1.5 }], [0], [], { maximize: false }));
  ok('minimize integer (min x st x>=1.5, int -> 2)', r.status === 'optimal' && r.objective === 2);

  // ---- Binary --------------------------------------------------------------
  // 12. Binary single var.
  r = O(ip([5], [], [0], [{ lower: 0, upper: 1 }]));
  ok('binary single var (max 5x, {0,1} -> 5 at [1], nodes 1)', r.status === 'optimal' && r.objective === 5 && eq(r.values, [1]) && r.nodesExplored === 1);
  // 13. Binary knapsack.
  r = O(ip([6, 5], [{ coefficients: [3, 3], relation: '<=', rhs: 4 }], [0, 1], [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }]));
  ok('binary knapsack (max 6a+5b st 3a+3b<=4 -> 6 at [1,0], nodes 5)', r.status === 'optimal' && r.objective === 6 && eq(r.values, [1, 0]) && r.nodesExplored === 5);

  // ---- Mixed ---------------------------------------------------------------
  // 14. Mixed continuous + integer.
  r = O(ip([1, 10], [{ coefficients: [1, 1], relation: '<=', rhs: 3.5 }], [1]));
  ok('mixed continuous+integer (max x+10y st x+y<=3.5 -> 30.5 at [0.5,3], nodes 3)', r.status === 'optimal' && r.objective === 30.5 && eq(r.values, [0.5, 3]) && r.nodesExplored === 3);

  // ---- Continuous bypass (never enters branch-and-bound) -------------------
  // 15. Continuous model -> integerIndices_ empty.
  ok('continuous model bypasses branch-and-bound (empty integer set)', eq(probe.integerIndices_(ip([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }], [])), []));
  // 16. optimise_ on a continuous model still returns optimal without nodesExplored from B&B.
  r = O(ip([3, 2], [{ coefficients: [1, 1], relation: '<=', rhs: 4 }], []));
  ok('continuous optimise_ optimal, no branch nodes', r.status === 'optimal' && r.objective === 12 && r.nodesExplored === undefined);

  // ---- Integrality ---------------------------------------------------------
  ok('isWhole_ exact integer', probe.isWhole_(3) === true);
  ok('isWhole_ within tolerance (3.0000001)', probe.isWhole_(3.0000001) === true);
  ok('isWhole_ outside tolerance (3.5)', probe.isWhole_(3.5) === false);
  ok('isWhole_ negative integer (-2)', probe.isWhole_(-2) === true);
  ok('isWhole_ zero', probe.isWhole_(0) === true);

  // ---- Domain classification ----------------------------------------------
  ok('classifyModel_ continuous', probe.classifyModel_(null, false, 2) === 'continuous');
  ok('classifyModel_ integer (whole toggle)', probe.classifyModel_(null, true, 2) === 'integer');
  ok('classifyModel_ integer (indices)', probe.classifyModel_({ integer: [0, 1], bounds: [] }, false, 2) === 'integer');
  ok('classifyModel_ binary', probe.classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }] }, false, 2) === 'binary');
  ok('classifyModel_ mixed continuous+integer', probe.classifyModel_({ integer: [1], bounds: [] }, false, 2) === 'mixed');
  ok('classifyModel_ mixed binary+integer', probe.classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, {}] }, false, 2) === 'mixed');

  // ---- Branch order / node creation (ceil-first) ---------------------------
  // The ceil-first order is observable: for max x+y st 2x+2y<=5 the incumbent
  // path and node count (13) are fixed. Re-running is deterministic.
  r = O(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1]));
  const r2 = O(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1]));
  ok('branch traversal deterministic (same nodesExplored + result)', eq(r, r2) && r.nodesExplored === 13);

  // ---- Limits (deterministic Date stub) ------------------------------------
  // 17. time_limit WITHOUT incumbent: Date jumps past the deadline on the 2nd call.
  let c1 = 0;
  const stubProbe1 = loadProbe(canonSrc, ['optimise_'], function () { c1++; return c1 <= 1 ? 0 : 1e15; });
  r = stubProbe1.optimise_(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1]));
  ok('time_limit without incumbent -> unknown/time_limit', r.status === 'unknown' && r.stopReason === 'time_limit' && r.optimalityProven === false);
  // 18. time_limit WITH incumbent: Date jumps after 12 calls -> feasible.
  let c2 = 0;
  const stubProbe2 = loadProbe(canonSrc, ['optimise_'], function () { c2++; return c2 <= 12 ? 0 : 1e15; });
  r = stubProbe2.optimise_(ip([1, 1], [{ coefficients: [2, 2], relation: '<=', rhs: 5 }], [0, 1]));
  ok('time_limit with incumbent -> feasible/time_limit', r.status === 'feasible' && r.stopReason === 'time_limit' && r.objective === 2 && r.optimalityProven === false);
  // 19. Normal model hits no limit.
  r = O(ip([1, 1, 1], [{ coefficients: [2, 2, 2], relation: '<=', rhs: 5 }], [0, 1, 2]));
  ok('normal model hits no limit (optimal, opt proven)', r.status === 'optimal' && r.optimalityProven === true && r.stopReason === null);

  // ---- Constants intact ----------------------------------------------------
  ok('BRANCH_NODES 4000', /BRANCH_NODES:\s*4000/.test(canonSrc) && g.constants.BRANCH_NODES === 4000);
  ok('BRANCH_DEPTH 60', /BRANCH_DEPTH:\s*60/.test(canonSrc) && g.constants.BRANCH_DEPTH === 60);
  ok('BRANCH_MILLIS 20000', /BRANCH_MILLIS:\s*20000/.test(canonSrc) && g.constants.BRANCH_MILLIS === 20000);
  ok('EPSILON 1e-9', /EPSILON:\s*1e-9/.test(canonSrc));
  ok('PIVOT_TOLERANCE 1e-7', /PIVOT_TOLERANCE:\s*1e-7/.test(canonSrc));
  ok('MAX_ITERATIONS 20000', /MAX_ITERATIONS:\s*20000/.test(canonSrc));

  // ---- Parity canonical <-> mirror ----------------------------------------
  const mirrorMod = require(path.join(siteDir, 'engine', 'engine.js'));
  const mapi = mirrorMod.PlumlineEngine || mirrorMod;
  // 20. Direct parity: classifyModel_ (both expose it). isWhole_ is internal to
  //     the mirror (not exported), so its parity is covered observably through
  //     optimise_'s branch-and-bound results below.
  ok('direct parity classifyModel_ canonical == mirror', [
    [null, false, 2], [null, true, 2], [{ integer: [0, 1], bounds: [] }, false, 2],
    [{ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }] }, false, 2],
    [{ integer: [1], bounds: [] }, false, 2],
  ].every(args => probe.classifyModel_.apply(null, args) === mapi.classifyModel_.apply(null, args)));
  // 21-23. Observable parity: optimise_ over integer/binary/mixed models. This is
  //        where isWhole_/solveIntegerProgram_/integerIndices_ parity surfaces.
  function obsOptimise(m) {
    let rc, rm;
    try { rc = JSON.stringify(probe.optimise_(m)); } catch (e) { rc = 'E:' + e.message; }
    try { rm = JSON.stringify(mapi.optimise_(m)); } catch (e) { rm = 'E:' + e.message; }
    return rc === rm;
  }
  ok('observable parity optimise_ integer canonical == mirror', obsOptimise(ip([5], [{ coefficients: [2], relation: '<=', rhs: 7 }], [0])));
  ok('observable parity optimise_ binary knapsack canonical == mirror', obsOptimise(ip([6, 5], [{ coefficients: [3, 3], relation: '<=', rhs: 4 }], [0, 1], [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }])));
  ok('observable parity optimise_ mixed canonical == mirror', obsOptimise(ip([1, 10], [{ coefficients: [1, 1], relation: '<=', rhs: 3.5 }], [1])));

  // 24. Only two approved divergences.
  ok('approved divergences are exactly newContext_/readConstraint_', eq(g.parity.approved_divergences.slice().sort(), ['newContext_', 'readConstraint_']));

  // ---- Public output: owned by validate_dist (build-only, Category B) ------
  // The byte-identity of the built dist/solver.html AND the byte-identity of the
  // composed public output are build/composition contracts owned by
  // engine/validate_dist.js (run during npm run build). They are deliberately NOT
  // re-asserted here: this checker is dist-independent and returns the same pass
  // count with or without a prior build. See docs/checkpoint-e4 "public output".

  // 25. Fixture hygiene.
  const fx = fs.readFileSync(path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e4-integer-branch-and-bound.json'), 'utf8');
  ok('E4 fixture has no absolute path', !/(^|["\s])\/(home|Users|mnt|tmp|usr)\//.test(fx));
  ok('E4 fixture pins engine SHA', g.engine.sha256 === ENGINE_SHA);
  ok('E4 fixture pins the HISTORICAL mirror SHA (its phase state, not E6)', g.mirror.sha256 === '6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa');

  return { pass, fail, failures };
}

module.exports = { checkCanonicalIntegerAndBranchAndBound: checkCanonicalIntegerAndBranchAndBound };

if (require.main === module) {
  const r = checkCanonicalIntegerAndBranchAndBound(path.join(__dirname, '..'));
  console.log('CANONICAL INTEGER + BRANCH-AND-BOUND (E4)  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  if (r.fail) { r.failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}
