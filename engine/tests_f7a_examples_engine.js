/* tests_f7a_examples_engine.js — F7a CANONICAL ENGINE (permanent).
 *
 * Solves every one of the 24 REAL catalogue records through the REAL engine (harness.run, via the
 * shared f5-solve-verify helper) and verifies the canonical contract end to end:
 *   - detect/classify: the engine-detected decision cells match derive.deriveDecisionCells;
 *   - solve twice: deterministic (same status + objective + vector both runs);
 *   - status/objective: match the independent expected authority (Phase-1 audit for the F7a 15,
 *     the F5 baseline for the historical 9) within the canonical tolerance;
 *   - model type: detected type matches the declared expected.modelType;
 *   - exact policy -> complete decision vector equal to resultDecisions within tolerance;
 *   - objective-feasible policy -> objective present + all constraints satisfied (feasibility).
 *
 * The expected values are NOT taken from the composer under test: the F7a 15 come from
 * docs/f7a-phase1-engine-audit.json (verified independent), the historical 9 from f5/baseline.json.
 */
'use strict';
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));
const derive = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'derive.js'));
const { solveModel, verifyResult } = require('./f5-solve-verify.js');
const baseline = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'baseline.json'));
const audit = require(path.join(SITE, 'docs', 'f7a-phase1-engine-audit.json'));

let pass = 0, fail = 0; const failures = []; const report = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const F7A_15 = ['bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split', 'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships', 'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];

const { canonical } = loadCanonical(SITE);
const baseByKey = {}; baseline.examples.forEach(function (b) { baseByKey[b.key] = b; });
const auditByKey = {}; audit.models.forEach(function (m) { auditByKey[m.key] = m; });

// Independent expected {status, objective, tolerance} for a record.
function expectedFor(rec) {
  if (auditByKey[rec.key]) {
    // F7a: Phase-1 audit is the independent authority.
    var m = auditByKey[rec.key];
    return { status: m.status1, objective: m.objective1, tolerance: rec.expected.tolerance != null ? rec.expected.tolerance : null };
  }
  var b = baseByKey[rec.key];
  return { status: b.expected.status, objective: b.expected.objective, tolerance: b.expected.tolerance };
}

ok('ENGINE: catalogue has 24 records to solve', canonical.length === 24, String(canonical.length));

canonical.forEach(function (rec) {
  var expected = expectedFor(rec);

  // ---- solve twice (determinism) ----
  var r1 = solveModel(rec.model, rec.sense);
  var r2 = solveModel(rec.model, rec.sense);
  if (r1.error || r2.error) { ok('ENGINE: ' + rec.key + ' solves without error', false, r1.error || r2.error); return; }
  var o1 = r1.out, o2 = r2.out;
  ok('ENGINE: ' + rec.key + ' deterministic status', o1.status === o2.status, o1.status + ' vs ' + o2.status);
  ok('ENGINE: ' + rec.key + ' deterministic objective', o1.objective === o2.objective, o1.objective + ' vs ' + o2.objective);
  var v1 = (o1.values || []).join(','), v2 = (o2.values || []).join(',');
  ok('ENGINE: ' + rec.key + ' deterministic decision vector', v1 === v2);

  // ---- status is optimal (all 24 are solvable to optimality) ----
  ok('ENGINE: ' + rec.key + ' status is optimal', o1.status === 'optimal', o1.status);

  // ---- detect/classify: engine decision cells match derive ----
  var detected = null; try { detected = derive.deriveDecisionCells(rec); } catch (e) {}
  ok('ENGINE: ' + rec.key + ' detected decision cells match engine variables',
     detected && (o1.variables || []).slice().sort().join(',') === detected.slice().sort().join(','),
     (o1.variables || []).join(',') + ' vs ' + (detected || []).join(','));

  // ---- model type: REAL detect + classify must equal declared expected.modelType ----
  // deriveModelType classifies the record from its actual model (grid/domains/whole), and deriveFacts
  // re-derives it through the full facts path. Both must equal the declared expected.modelType — this
  // is a real detect/classify assertion, not a "is a non-empty string" stub.
  var detectedType = null; try { detectedType = derive.deriveModelType(rec); } catch (e) {}
  var factsType = null; try { factsType = derive.deriveFacts(rec).modelType; } catch (e) {}
  ok('ENGINE: ' + rec.key + ' deriveModelType == expected.modelType', detectedType === rec.expected.modelType, detectedType + ' vs ' + rec.expected.modelType);
  ok('ENGINE: ' + rec.key + ' deriveFacts.modelType == expected.modelType', factsType === rec.expected.modelType, factsType + ' vs ' + rec.expected.modelType);

  // ---- full canonical verification (objective, constraints, vector, domains, policy) ----
  var v = verifyResult(rec, rec.facts, rec.model, expected, o1, rec.resultPolicy, rec.resultDecisions);
  ok('ENGINE: ' + rec.key + ' verified against independent expected authority', v.ok, v.reasons.join('; '));

  // ---- policy-specific ----
  if (rec.resultPolicy === 'exact') {
    ok('ENGINE: ' + rec.key + ' (exact) has a complete resultDecisions vector', rec.resultDecisions && Object.keys(rec.resultDecisions).length > 0);
    // exact vector already checked inside verifyResult; assert the values land where declared.
    var okVec = true;
    (o1.variables || []).forEach(function (cell, i) {
      if (rec.resultDecisions && rec.resultDecisions[cell] !== undefined) {
        if (Math.abs(o1.values[i] - rec.resultDecisions[cell]) > (expected.tolerance || 1e-6)) okVec = false;
      }
    });
    ok('ENGINE: ' + rec.key + ' (exact) engine vector equals resultDecisions', okVec);
  } else {
    // objective-feasible: objective present + every constraint satisfied.
    ok('ENGINE: ' + rec.key + ' (objective-feasible) has a numeric objective', typeof o1.objective === 'number' && isFinite(o1.objective));
    ok('ENGINE: ' + rec.key + ' (objective-feasible) all constraints satisfied',
       Array.isArray(o1.constraints) && o1.constraints.every(function (c) { return c.satisfied === true; }));
  }

  report.push({ key: rec.key, status: o1.status, objective: o1.objective, policy: rec.resultPolicy, type: rec.expected.modelType, verified: v.ok });
});

if (require.main === module) {
  report.forEach(function (r) { console.log('  ' + r.key.padEnd(20) + ' type=' + String(r.type).padEnd(10) + ' policy=' + String(r.policy).padEnd(18) + ' status=' + r.status + ' obj=' + r.objective + ' verified=' + r.verified); });
}
console.log('F7A EXAMPLES ENGINE (CANONICAL)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
