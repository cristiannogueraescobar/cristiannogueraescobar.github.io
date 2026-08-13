'use strict';
/* Phase-1 canonical solve adapter. Mirrors tests_canonical_catalogue_positive.js #28 exactly.
   Validated to reproduce all 9 existing catalogue objectives. Surfaces the objective cell so the
   independent verifier can recompute the objective from the decision vector. */
const path = require('path');
const { run } = require(path.join(__dirname, '..', '..', 'engine', 'harness.js'));

function solveRecord(rec) {
  const opts = {};
  if (rec.model.whole && !rec.model.domains) opts.integer = true;
  opts.mutate = function (model) {
    if (model.objective) model.objective.sense = rec.sense;
    if (rec.model.domains) {
      const cells = (run(rec.model.grid).out || {}).variables || [];
      const integer = [], bounds = [];
      let anyInt = false, anyBound = false;
      cells.forEach(function (cell, i) {
        const d = rec.model.domains[cell];
        let isInt = false, lo = 0, hi = null;
        if (d) {
          if (d.type === 'binary') { isInt = true; lo = 0; hi = 1; }
          else if (d.type === 'integer') { isInt = true; lo = d.min == null ? 0 : d.min; hi = d.max == null ? null : d.max; }
          else { lo = d.min == null ? 0 : d.min; hi = d.max == null ? null : d.max; }
        }
        if (rec.model.whole && (!d || d.type !== 'binary')) isInt = true;
        if (isInt) { integer.push(i); anyInt = true; }
        bounds.push({ lower: lo, upper: hi });
        if (lo > 1e-9 || hi != null) anyBound = true;
      });
      model.domains = { integer: anyInt ? integer : false, bounds: anyBound ? bounds : null };
      if (rec.model.whole) model.wholeNumbers = true;
    }
  };
  const r = run(rec.model.grid, opts);
  if (r.error) return { error: r.error };
  const vars = r.out.variables || [], vals = r.out.values || [], labels = r.out.labels || [];
  const vector = {};
  vars.forEach(function (cell, i) { vector[(labels[i] || cell)] = vals[i]; });
  r.out.__objectiveCell = r.model && r.model.objective && r.model.objective.cell;
  return {
    status: r.out.status, modelType: r.out.modelType || (r.model && r.model.modelType),
    objective: r.out.objective, sense: r.out.sense, variables: vars, values: vals, labels: labels,
    vector: vector, optimalityProven: r.out.optimalityProven, constraints: (r.out.constraints || []).length,
    out: r.out
  };
}
module.exports = { solveRecord };
