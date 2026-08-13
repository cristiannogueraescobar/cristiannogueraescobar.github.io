'use strict';
/* Independent Phase-1 feasibility verifier. Recomputes every constraint AND the objective from the
   returned decision vector (does NOT trust the engine status), and checks domain compliance.
   Tolerance 1e-6. */
const TOL = 1e-6;

function recomputeObjective(rec, out) {
  const grid = rec.model.grid.map(function (r) { return r.map(function (c) { return (c && typeof c === 'object') ? c : String(c); }); });
  const vars = out.variables || [], vals = out.values || [];
  const cellVal = {};
  vars.forEach(function (cell, i) { cellVal[cell] = vals[i]; });
  function numAt(a1) {
    const m = a1.match(/([A-Z]+)([0-9]+)/); if (!m) return 0;
    const col = m[1].charCodeAt(0) - 65, row = parseInt(m[2], 10) - 1;
    if (!grid[row] || grid[row][col] === undefined) return 0;
    if (cellVal[a1] !== undefined) return cellVal[a1];
    let raw = grid[row][col]; if (raw && typeof raw === 'object') raw = raw.f || ''; raw = String(raw);
    if (raw.charAt(0) === '=') {
      const mm = raw.replace(/^=/, '').match(/^([A-Z]+[0-9]+)\*([A-Z]+[0-9]+)$/);
      if (mm) return numAt(mm[1]) * numAt(mm[2]);
      return 0;
    }
    const n = parseFloat(raw); return isNaN(n) ? 0 : n;
  }
  const objCell = out.__objectiveCell; if (!objCell) return null;
  const m = objCell.match(/([A-Z]+)([0-9]+)/); if (!m) return null;
  const col = m[1].charCodeAt(0) - 65, row = parseInt(m[2], 10) - 1;
  let f = grid[row] && grid[row][col]; if (f && typeof f === 'object') f = f.f || ''; f = String(f).replace(/^=/, '');
  const sumM = f.match(/^SUM\(([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)\)$/i);
  if (sumM) { const c0 = sumM[1], r0 = parseInt(sumM[2], 10), r1 = parseInt(sumM[4], 10); let s = 0; for (let rr = r0; rr <= r1; rr++) s += numAt(c0 + rr); return s; }
  let expr = f.replace(/\s+/g, '');
  const terms = expr.replace(/-/g, '+-').split('+').filter(Boolean);
  let total = 0;
  for (const t of terms) {
    const mul = t.match(/^(-?\d*\.?\d+)\*([A-Z]+[0-9]+)$/);
    if (mul) { total += parseFloat(mul[1]) * numAt(mul[2]); continue; }
    const bare = t.match(/^(-?)([A-Z]+[0-9]+)$/);
    if (bare) { total += (bare[1] === '-' ? -1 : 1) * numAt(bare[2]); continue; }
    const lit = parseFloat(t); if (!isNaN(lit)) total += lit;
  }
  return total;
}

function verifySolution(out, rec, expectedType) {
  const reasons = [];
  const vars = out.variables || [], vals = out.values || [];
  if (vars.length !== vals.length) reasons.push('variable/value count mismatch');
  vals.forEach(function (v, i) { if (!Number.isFinite(v)) reasons.push('non-finite value at ' + vars[i]); });
  vals.forEach(function (v, i) { if (v < -TOL) reasons.push('negative decision ' + vars[i] + '=' + v); });
  const isWhole = !!rec.model.whole, domains = rec.model.domains || {};
  vars.forEach(function (cell, i) {
    const d = domains[cell], v = vals[i];
    let mustInt = isWhole && (!d || d.type !== 'continuous');
    if (d && (d.type === 'integer' || d.type === 'binary')) mustInt = true;
    if (mustInt && Math.abs(v - Math.round(v)) > TOL) reasons.push('non-integer ' + cell + '=' + v);
    if (d && d.type === 'binary' && !(Math.abs(v) < TOL || Math.abs(v - 1) < TOL)) reasons.push('binary out of {0,1} ' + cell);
    if (d && typeof d.min === 'number' && v < d.min - TOL) reasons.push('below min ' + cell);
    if (d && typeof d.max === 'number' && v > d.max + TOL) reasons.push('above max ' + cell);
  });
  (out.constraints || []).forEach(function (con) {
    if (!con.coefficients) return;
    let lhs = con.constant || 0;
    con.coefficients.forEach(function (c, i) { lhs += c * (vals[i] || 0); });
    let ok = true;
    if (con.relation === '<=') ok = lhs <= con.limit + TOL;
    else if (con.relation === '>=') ok = lhs >= con.limit - TOL;
    else if (con.relation === '=') ok = Math.abs(lhs - con.limit) <= TOL;
    if (!ok) reasons.push('constraint "' + con.label + '" violated: ' + lhs.toFixed(6) + ' ' + con.relation + ' ' + con.limit);
  });
  const objR = recomputeObjective(rec, out);
  if (objR === null) reasons.push('objective not independently recomputable');
  else if (Math.abs(objR - out.objective) > Math.max(TOL, Math.abs(out.objective) * 1e-9)) reasons.push('objective recompute mismatch: ' + objR + ' vs ' + out.objective);
  if (out.modelType !== expectedType) reasons.push('type mismatch: detected ' + out.modelType + ' vs authored ' + expectedType);
  return { verified: reasons.length === 0, reasons: reasons, recomputedObjective: objR };
}
module.exports = { verifySolution, recomputeObjective };
