/* Checkpoint F1.16 — detection + solve parity for the nine catalogue examples.
 *
 * Run each catalogue grid through the CANONICAL engine (via the shared harness
 * run(), which uses detectModel_ + solveModel_) and compare against the HISTORICAL
 * expected contract in the catalogue (status, modelType, objective, tolerance when
 * present). A divergence blocks the migration.
 *
 * No new expected value is pinned: only status/modelType/objective/tolerance
 * (already historical) are compared; variable-value vectors are never checked or
 * introduced. Actual comes from the engine, expected from the catalogue — two
 * independent sources, never the same function.
 *
 * Examples that auto-open Variable Settings carry per-cell domains in the catalogue.
 * Those are applied through the SAME model.integer/model.bounds override the panel's
 * variableDomains() builds, addressed by the engine's own variable-cell order — so
 * the parity check exercises the real detect+solve path with the real domains.
 */
'use strict';
const path = require('path');
const { run, mkSheet, Engine } = require('./harness.js');
const { loadAndValidateCatalogue } = require(path.join(__dirname, '..', 'src', 'shared', 'examples', 'index.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const { catalogue } = loadAndValidateCatalogue(path.join(__dirname, '..'));

// The engine's variable-cell order for a grid (['B2','B3',...]).
function variableCells(grid) {
  const first = run(grid);
  return (first.out && first.out.variables) || [];
}

// Build { integer:[idx...], bounds:[{lower,upper}...] } from catalogue domains,
// addressed by the engine's variable-cell order. Mirrors panel variableDomains().
function overrideFromDomains(rec, cells) {
  const dom = rec.model.domains;
  const whole = !!rec.model.whole;
  const integer = []; const bounds = [];
  let anyInt = false, anyBound = false;
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

catalogue.forEach(function (rec) {
  const opts = {};
  const needsDomains = !!rec.model.domains;
  const needsWhole = !!rec.model.whole;

  // The solver UI has the user confirm the optimisation sense (senseSel); the engine
  // does not always auto-detect it. The catalogue records each example's sense, so
  // apply it exactly as the confirmed panel would. This is catalogue metadata, not a
  // new pinned variable value.
  function applySense(model) {
    if (model.objective) model.objective.sense = rec.sense;
  }

  if (needsDomains) {
    const cells = variableCells(rec.model.grid);
    const ov = overrideFromDomains(rec, cells);
    opts.mutate = function (model) {
      applySense(model);
      // The engine reads per-variable domains from model.domains in the
      // { integer:[idx...], bounds:[{lower,upper}...] } shape the panel builds.
      model.domains = { integer: ov.integer, bounds: ov.bounds };
      if (needsWhole) model.wholeNumbers = true;
    };
  } else if (needsWhole) {
    opts.integer = true;
    opts.mutate = applySense;
  } else {
    opts.mutate = applySense;
  }

  const r = run(rec.model.grid, opts);
  if (r.error) { ok(rec.key + ': engine runs', false, r.error); return; }

  const exp = rec.expected;
  ok(rec.key + ': status parity (' + exp.status + ')', r.out.status === exp.status, 'engine=' + r.out.status);
  const detectedType = r.out.modelType || (r.model && (r.model.modelType || r.model.type));
  ok(rec.key + ': modelType parity (' + exp.modelType + ')', detectedType === exp.modelType, 'engine=' + detectedType);
  const tol = exp.tolerance !== undefined ? exp.tolerance : 1e-9;
  const objOk = typeof r.out.objective === 'number' && Math.abs(r.out.objective - exp.objective) <= tol;
  ok(rec.key + ': objective parity (' + exp.objective + ')', objOk, 'engine=' + r.out.objective);
});

console.log('EXAMPLES DETECTION/SOLVE PARITY TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
