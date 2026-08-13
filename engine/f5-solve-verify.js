/* f5-solve-verify.js — shared REAL-engine solve + status-aware verify for F5/F6/F7a suites.
 *
 * Extracted verbatim from the F5 behavioural suite so multiple suites resolve catalogue records
 * through the SAME real engine (harness.run) and the SAME verifier, with no re-implementation and
 * no test-run side effects on import. Pure functions; all dependencies are required here.
 */
'use strict';
const path = require('path');
const { run } = require('./harness.js');
const F5 = path.join(__dirname, '..', 'src', 'shared', 'examples', 'f5');
const derive = require(path.join(F5, 'derive.js'));
const E = require(path.join(F5, 'enums.js'));

function variableCells(grid) { const f = run(grid); return (f.out && f.out.variables) || []; }
function overrideFromDomains(model, cells) {
  const dom = model.domains; const whole = !!model.whole;
  const integer = []; const bounds = []; let anyInt = false, anyBound = false;
  cells.forEach(function (cell, i) {
    const d = dom ? dom[cell] : null;
    let isInt = false, lo = 0, hi = null;
    if (d) {
      if (d.type === 'binary') { isInt = true; lo = 0; hi = 1; }
      else if (d.type === 'integer') { isInt = true; lo = d.min == null ? 0 : d.min; hi = d.max == null ? null : d.max; }
      else { lo = d.min == null ? 0 : d.min; hi = d.max == null ? null : d.max; }
    }
    if (whole && (!d || d.type !== 'binary')) isInt = true;
    if (isInt) { integer.push(i); anyInt = true; }
    bounds.push({ lower: lo, upper: hi });
    if (lo > 1e-9 || hi != null) anyBound = true;
  });
  return { integer: anyInt ? integer : false, bounds: anyBound ? bounds : null };
}
function solveModel(model, sense) {
  const opts = {};
  function applySense(m) { if (m.objective) m.objective.sense = sense; }
  if (model.domains) {
    const cells = variableCells(model.grid);
    const ov = overrideFromDomains(model, cells);
    opts.mutate = function (m) { applySense(m); m.domains = { integer: ov.integer, bounds: ov.bounds }; if (model.whole) m.wholeNumbers = true; };
  } else if (model.whole) { opts.integer = true; opts.mutate = applySense; }
  else { opts.mutate = applySense; }
  return run(model.grid, opts);
}

function verifyResult(rec, facts, model, expected, out, policy, exactDecisions) {
  const reasons = []; const DEFAULT_TOL = 1e-6;
  const tol = expected.tolerance || DEFAULT_TOL;   // canonical effective tolerance
  if (!out) { reasons.push('no engine output'); return { ok: false, reasons: reasons }; }

  // status is always checked.
  if (out.status !== expected.status) reasons.push('status ' + out.status + ' != ' + expected.status);

  // EXPLICIT status classification — no implicit "not no-solution => has solution".
  const solutionBearing = E.SOLUTION_BEARING_STATUSES.indexOf(expected.status) !== -1;
  const noSolution = E.NO_SOLUTION_STATUSES.indexOf(expected.status) !== -1;
  if (!solutionBearing && !noSolution) {
    reasons.push('unsupported expected-result status policy for status "' + expected.status + '"');
    return { ok: false, reasons: reasons };
  }

  if (noSolution) {
    // No-solution statuses: status only. Do NOT require objective/vector/constraints.
    // A defensive check: the engine must NOT have returned a feasible incumbent.
    if (Array.isArray(out.values) && out.values.length > 0) reasons.push('no-solution status but engine returned a decision vector');
    return { ok: reasons.length === 0, reasons: reasons };
  }

  // Solution-bearing statuses from here on.
  if (!(typeof out.objective === 'number' && Math.abs(out.objective - expected.objective) <= tol)) reasons.push('objective ' + out.objective + ' != ' + expected.objective + ' ±' + tol);

  const cons = out.constraints;
  if (!Array.isArray(cons)) reasons.push('constraints output missing');
  else {
    if (cons.length !== facts.constraintCount) reasons.push('constraint count ' + cons.length + ' != fact ' + facts.constraintCount);
    if (!cons.every(function (c) { return c.satisfied === true; })) reasons.push('some constraint not satisfied');
  }

  const vars = out.variables, vals = out.values;
  if (!Array.isArray(vars) || !Array.isArray(vals)) reasons.push('variables/values output missing');
  else {
    if (vars.length !== vals.length) reasons.push('variables/values length mismatch');
    if (vars.length !== facts.decisionCount) reasons.push('variable count ' + vars.length + ' != fact ' + facts.decisionCount);
    let detected = null; try { detected = derive.deriveDecisionCells(rec); } catch (e) { reasons.push('detect failed: ' + e.message); }
    if (detected) {
      const a = vars.slice().sort().join(','); const b = detected.slice().sort().join(',');
      if (a !== b) reasons.push('variable set ' + a + ' != detected ' + b);
    }
    // CANONICAL effective domains — one representation, same semantics as derive.
    const eff = derive.deriveEffectiveDomains(rec);
    const effByCell = {}; eff.forEach(function (e) { effByCell[e.cell] = e; });
    vars.forEach(function (cell, i) {
      const v = vals[i];
      if (!(typeof v === 'number' && isFinite(v))) { reasons.push(cell + ' non-finite'); return; }
      const e = effByCell[cell];
      if (!e) { reasons.push(cell + ' has no effective domain'); return; }
      // Lower bound is the effective lower (default 0). Only flag negative when the
      // effective lower bound is >= 0; an explicit negative lower is honoured.
      if (v < e.lower - tol) reasons.push(cell + ' < lower ' + e.lower);
      if (e.upper != null && v > e.upper + tol) reasons.push(cell + ' > upper ' + e.upper);
      if (e.effectiveType === 'binary') { if (Math.abs(v - Math.round(v)) > tol || v < -tol || v > 1 + tol) reasons.push(cell + ' not binary'); }
      else if (e.effectiveType === 'integer') { if (Math.abs(v - Math.round(v)) > tol) reasons.push(cell + ' not integer'); }
    });

    // exact policy: complete decision vector within the canonical tolerance.
    if (policy === 'exact') {
      if (!exactDecisions) reasons.push('exact policy without a decision vector');
      else {
        const provided = Object.keys(exactDecisions).sort().join(',');
        const detectedSet = (detected || []).slice().sort().join(',');
        if (provided !== detectedSet) reasons.push('exact vector incomplete: ' + provided + ' != ' + detectedSet);
        vars.forEach(function (cell, i) {
          if (exactDecisions[cell] === undefined) return;
          if (Math.abs(vals[i] - exactDecisions[cell]) > tol) reasons.push('exact ' + cell + ' ' + vals[i] + ' != ' + exactDecisions[cell] + ' (±' + tol + ')');
        });
      }
    }
  }
  return { ok: reasons.length === 0, reasons: reasons };
}

module.exports = { variableCells: variableCells, overrideFromDomains: overrideFromDomains, solveModel: solveModel, verifyResult: verifyResult };
