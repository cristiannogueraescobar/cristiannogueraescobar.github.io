/**
 * tests_worker_parity.js — Phase 5.2: the Web Worker path and the main-thread
 * fallback must produce the SAME solve for the same model.
 *
 * The app can solve in two places:
 *   - Worker: engine source is extracted, a sheet is rebuilt from raw
 *     formulas/values arrays inside the worker, then detect + solve run there.
 *   - Fallback (runSolve): the live grid builds a sheet on the main thread,
 *     then detect + solve run inline.
 * Both converge at presentResult(out, model). If the two paths ever diverged —
 * different sheet contract, different domains/sense handling — users would get
 * different answers depending on browser support. This pins them together.
 *
 * We reproduce BOTH call sequences against the real engine and compare outputs
 * with NUMERIC TOLERANCE (objective and variable values), plus exact status and
 * model type. No fragile text comparison.
 *
 * Covered, per example: same status, same model type, same objective (±TOL) AND
 * matching the known optimum, same variable count/values (±TOL), same
 * feasibility verdict, and export/display parity (out.modelType, variableDomains
 * presence, export labels) — because both paths converge at presentResult ->
 * renderReceipt, which derives every export and the chart purely from `out`.
 * Bounds/integrality parity is real: dropping the passed domains in the worker
 * makes marketing/project/delivery/supplier diverge (verified by a negative run).
 * Cancellation/stale-result discipline is covered separately in
 * tests_worker_token.js.
 *
 * Run: node engine/tests_worker_parity.js
 */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'solver.html'), 'utf8');

// Load the production engine (inline copy) exactly as the worker would.
const a = html.indexOf('/* ENGINE_START */'), b = html.indexOf('/* ENGINE_END */');
eval(html.slice(a, b));

// Pull the EXAMPLES literal (grids, domains, whole flags, expected values).
const app = html.split('<script>').filter(s => s.includes('var EXAMPLES='))[0].split('</script>')[0];
eval(app.match(/var EXAMPLES=\{[\s\S]*?\n  \};/)[0]);

// variableDomains() lives in the APP (outside the engine markers): the main
// thread computes it and SENDS the result to the worker as payload.domains,
// because the worker only has engine source. Extract it so the test computes
// domains the same way the app does.
eval(app.match(/function variableDomains\([\s\S]*?\n  \}/)[0]);

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }
const TOL = 1e-6;

// Build a sheet from a grid, splitting into formulas/values arrays — the same
// representation sheetToArrays() sends into the worker and mk() uses in tests.
function arraysOf(g) {
  const isF = x => typeof x === 'string' && x.charAt(0) === '=' && !({ '<=':1, '>=':1, '=':1 }[x]);
  const f = [], v = [];
  for (let r = 0; r < g.length; r++) {
    const fr = [], vr = [];
    for (let c = 0; c < g[r].length; c++) {
      const raw = String(g[r][c]);
      if (isF(raw)) { fr.push(raw); vr.push(0); }
      else { fr.push(''); vr.push(raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw); }
    }
    f.push(fr); v.push(vr);
  }
  return { formulas: f, values: v };
}
function sheetFrom(formulas, values) {
  return { getDataRange: () => ({ getRow: () => 1, getColumn: () => 1, getFormulas: () => formulas, getValues: () => values }) };
}

// MAIN-THREAD path (mirrors runSolve): detect, apply sense + wholeNumbers,
// compute domains with the app's variableDomains(), then solve.
function mainThreadSolve(grid, whole, sense) {
  const { formulas, values } = arraysOf(grid);
  const sheet = sheetFrom(formulas, values);
  const model = detectModel_(sheet);
  model.wholeNumbers = whole === true;
  if (sense === 'max' || sense === 'min') model.objective.sense = sense;
  try {
    const cells = expandRange_(loadGrid_(sheet), model.variables);
    model.domains = variableDomains(cells, model.wholeNumbers);
  } catch (e) { model.domains = null; }
  return solveModel_(sheet, model);
}

// WORKER path (mirrors the worker glue): rebuild sheet from the SAME raw arrays,
// detect, apply the domains COMPUTED ON THE MAIN THREAD and passed in, + sense,
// then solve. The worker cannot compute domains itself (variableDomains is app
// code), so it must rely on what the main thread sends — this is the contract.
function workerSolve(grid, whole, sense, passedDomains) {
  const { formulas, values } = arraysOf(grid);
  const sheet = sheetFrom(formulas, values);
  const model = detectModel_(sheet);
  model.wholeNumbers = whole === true;
  if (passedDomains) model.domains = passedDomains;
  if (sense === 'max' || sense === 'min') model.objective.sense = sense;
  return solveModel_(sheet, model);
}

// variableDomains() reads the app global `varSettings` (the Variable settings
// panel). Loading a bounded/typed example populates it; an empty panel makes
// variableDomains return null. Declare it here and set it per example from
// ex.domains so the parity test exercises the real bounded/typed path.
var varSettings = {};

// Compute the domains the main thread would send to the worker, the app way.
function computeDomains(grid, whole) {
  const { formulas, values } = arraysOf(grid);
  const sheet = sheetFrom(formulas, values);
  try {
    const model = detectModel_(sheet);
    const cells = expandRange_(loadGrid_(sheet), model.variables);
    return variableDomains(cells, whole === true);
  } catch (e) { return null; }
}

function valuesOf(out) {
  // Collect variable values into a stable, comparable shape.
  const vs = (out && out.variables) ? out.variables : [];
  return vs.map(v => (v && typeof v.value === 'number') ? v.value : null);
}

Object.keys(EXAMPLES).forEach(function (key) {
  const ex = EXAMPLES[key];
  const whole = ex.whole === true;
  const sense = (ex.expected && ex.expected.sense) || undefined;

  // Loading an example populates the Variable settings panel; mirror that so
  // variableDomains() produces the same bounds/types the app would.
  varSettings = {};
  if (ex.domains) Object.keys(ex.domains).forEach(function (cell) { varSettings[cell] = ex.domains[cell]; });

  // The main thread computes domains via variableDomains() and SENDS them to
  // the worker. Drive the worker with exactly those domains.
  const passedDomains = computeDomains(ex.grid, whole);

  let mainOut, workOut, mErr = null, wErr = null;
  try { mainOut = mainThreadSolve(ex.grid, whole, sense); } catch (e) { mErr = String(e.message || e); }
  try { workOut = workerSolve(ex.grid, whole, sense, passedDomains); } catch (e) { wErr = String(e.message || e); }

  // Both paths must succeed or fail together.
  ok(key + ': both paths run (no divergent error)', mErr === wErr, 'main=' + mErr + ' worker=' + wErr);
  if (mErr || wErr) return;

  // Same status and model type (exact).
  ok(key + ': same status', mainOut.status === workOut.status, mainOut.status + ' vs ' + workOut.status);
  ok(key + ': same model type', (mainOut.modelType || '') === (workOut.modelType || ''), mainOut.modelType + ' vs ' + workOut.modelType);

  // Same objective (numeric tolerance) — and it must match the example's known
  // optimum, so the two paths can't agree on a WRONG answer.
  if (typeof mainOut.objective === 'number' && typeof workOut.objective === 'number') {
    ok(key + ': same objective (±' + TOL + ')', Math.abs(mainOut.objective - workOut.objective) <= TOL,
       mainOut.objective + ' vs ' + workOut.objective);
    if (ex.expected && typeof ex.expected.objective === 'number') {
      const etol = ex.expected.tolerance || TOL;
      ok(key + ': both paths reach the known optimum ' + ex.expected.objective,
         Math.abs(mainOut.objective - ex.expected.objective) <= etol &&
         Math.abs(workOut.objective - ex.expected.objective) <= etol,
         'main=' + mainOut.objective + ' worker=' + workOut.objective);
    }
  }

  // Same variable values (numeric tolerance, order-stable).
  const mv = valuesOf(mainOut), wv = valuesOf(workOut);
  ok(key + ': same variable count', mv.length === wv.length, mv.length + ' vs ' + wv.length);
  let allClose = mv.length === wv.length;
  for (let i = 0; i < Math.min(mv.length, wv.length); i++) {
    if (mv[i] === null || wv[i] === null) { if (mv[i] !== wv[i]) allClose = false; }
    else if (Math.abs(mv[i] - wv[i]) > TOL) allClose = false;
  }
  ok(key + ': same variable values (±' + TOL + ')', allClose, JSON.stringify(mv) + ' vs ' + JSON.stringify(wv));

  // Same verification verdict (the receipt's whole point).
  ok(key + ': same feasibility verdict',
     (!!mainOut.feasible) === (!!workOut.feasible) || (mainOut.status === workOut.status));

  // EXPORT / DISPLAY parity. Both paths converge at presentResult -> renderReceipt,
  // which sets lastResult = out and derives every export (CSV/Excel/summary) and
  // the chart decision purely from `out` (out.modelType, out.variableDomains,
  // out.variables). The worker sends only a minimal {wholeNumbers} model, so any
  // receipt field must come from `out`, not `model`. Verify the out-derived
  // fields the receipt and exports depend on are identical between paths.
  ok(key + ': same out.modelType for receipt/chart',
     (mainOut.modelType || '') === (workOut.modelType || ''), mainOut.modelType + ' vs ' + workOut.modelType);
  const mHasDom = !!(mainOut.variableDomains && mainOut.variableDomains.length);
  const wHasDom = !!(workOut.variableDomains && workOut.variableDomains.length);
  ok(key + ': same variableDomains presence (chart/export)', mHasDom === wHasDom, mHasDom + ' vs ' + wHasDom);
  // The export rows come from out.variables (labels + values); same count and
  // same labels means CSV/Excel/summary are byte-identical between modes.
  const mLabels = (mainOut.variables || []).map(v => v && v.label);
  const wLabels = (workOut.variables || []).map(v => v && v.label);
  ok(key + ': same export labels', JSON.stringify(mLabels) === JSON.stringify(wLabels),
     mLabels.join(',') + ' vs ' + wLabels.join(','));
});

// Strict-inequality parity: both the main-thread fallback and the worker path
// (both using the inline engine) must REJECT "<" and ">" as constraint
// operators with the same STRICT_INEQUALITY marker — never solve one and reject
// the other.
function strictGrid(rel) {
  return [
    ['Item', 'Units', 'x', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['B', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=3*B2+2*B3', '', ''],
    ['Cap', '', '', '=B2+B3', rel, '4'],
    ['UpperA', '', '', '=B2', '<=', '2'],
  ];
}
['<', '>'].forEach(function (rel) {
  let mErr = null, wErr = null;
  try { mainThreadSolve(strictGrid(rel), false, 'max'); } catch (e) { mErr = String(e.message || e); }
  try { workerSolve(strictGrid(rel), false, 'max', null); } catch (e) { wErr = String(e.message || e); }
  ok('strict "' + rel + '": main-thread rejects with STRICT_INEQUALITY', mErr && /STRICT_INEQUALITY/.test(mErr), mErr);
  ok('strict "' + rel + '": worker rejects with STRICT_INEQUALITY', wErr && /STRICT_INEQUALITY/.test(wErr), wErr);
  ok('strict "' + rel + '": both paths name the same operator',
     mErr && wErr && mErr.indexOf('"' + rel + '"') >= 0 && wErr.indexOf('"' + rel + '"') >= 0, mErr + ' | ' + wErr);
});

// Single-variable parity: a genuine one-variable model must detect and solve
// identically on the worker and the main-thread fallback (both inline engine).
// We assert the EXACT objective and value, not just "optimal", and run the same
// adversarial fixtures the engine.js suite uses so the inline copy is verified
// against the very regressions the auditor found (two-constraints-no-objective,
// two-loose-cells, coefficient-in-neighbour).
{
  varSettings = {};   // clear any panel state left by the EXAMPLES loop above
  const grid = [
    ['Item', 'x', '', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', '5'],
  ];
  let mErr = null, wErr = null, mOut = null, wOut = null;
  try { mOut = mainThreadSolve(grid, false, 'max'); } catch (e) { mErr = String(e.message || e); }
  try { wOut = workerSolve(grid, false, 'max', null); } catch (e) { wErr = String(e.message || e); }
  ok('1-var: main-thread solves to exact optimum (obj 5, x 5)',
     !mErr && mOut && mOut.status === 'optimal' && mOut.objective === 5 &&
     (mOut.variables || []).length === 1 && Math.abs(mOut.values[0] - 5) < 1e-9,
     mErr || JSON.stringify(mOut));
  ok('1-var: worker solves to exact optimum (obj 5, x 5)',
     !wErr && wOut && wOut.status === 'optimal' && wOut.objective === 5 &&
     (wOut.variables || []).length === 1 && Math.abs(wOut.values[0] - 5) < 1e-9,
     wErr || JSON.stringify(wOut));
  ok('1-var: same objective on both paths', mOut && wOut && mOut.objective === wOut.objective,
     (mOut && mOut.objective) + ' vs ' + (wOut && wOut.objective));
}

// Adversarial fixtures against the INLINE engine (both paths). Each must be
// REJECTED at detection on both the main-thread and worker paths, identically.
[
  { name: 'two constraints, no objective', grid: [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit'], ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''], ['Lower', '', '', '=B2', '>=', '1'], ['Upper', '', '', '=B2', '<=', '5'] ] },
  { name: 'two separate decision cells', grid: [
    ['Item', 'x', 'sep', 'y', '', 'Result', 'Rel', 'Limit'], ['V', '0', 'text', '0', '', '', '', ''],
    ['', '', '', '', '', '', '', ''], ['Total', '', '', '', '', '=B2+100*D2', '', ''],
    ['Cap', '', '', '', '', '=B2+D2', '<=', '10'] ] },
].forEach(function (fx) {
  let mErr = null, wErr = null, mOut = null, wOut = null;
  try { mOut = mainThreadSolve(fx.grid, false, 'max'); } catch (e) { mErr = String(e.message || e); }
  try { wOut = workerSolve(fx.grid, false, 'max', null); } catch (e) { wErr = String(e.message || e); }
  ok('inline rejects (' + fx.name + '): main-thread', !!mErr, mOut && JSON.stringify(mOut));
  ok('inline rejects (' + fx.name + '): worker', !!wErr, wOut && JSON.stringify(wOut));
});

// Coefficient-in-neighbour: one variable, objective = B2*C2, constraint on B2.
// Inline engine must pick ONE variable and reach obj 50 on both paths.
{
  const grid = [
    ['Product', 'Units', 'Profit', 'Contribution', 'Rel', 'Limit'],
    ['A', '0', '10', '=B2*C2', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=D2', '', ''],
    ['Capacity', '', '', '=B2', '<=', '5'],
  ];
  let mErr = null, wErr = null, mOut = null, wOut = null;
  try { mOut = mainThreadSolve(grid, false, 'max'); } catch (e) { mErr = String(e.message || e); }
  try { wOut = workerSolve(grid, false, 'max', null); } catch (e) { wErr = String(e.message || e); }
  ok('inline 1-var w/ coefficient: main-thread obj 50, one var',
     !mErr && mOut && mOut.objective === 50 && (mOut.variables || []).length === 1, mErr || JSON.stringify(mOut));
  ok('inline 1-var w/ coefficient: worker obj 50, one var',
     !wErr && wOut && wOut.objective === 50 && (wOut.variables || []).length === 1, wErr || JSON.stringify(wOut));
}

// Symmetric =B2*C2 in objective AND constraint: ambiguous on both inline paths,
// with the SAME marker — never a divergent non-linear error on one path only.
{
  const grid = [
    ['Item', 'x', 'coef', 'Total', 'Rel', 'Limit'],
    ['A', '0', '10', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=B2*C2', '', ''],
    ['Cap', '', '', '=B2*C2', '<=', '50'],
  ];
  let mErr = null, wErr = null;
  try { mainThreadSolve(grid, false, 'max'); } catch (e) { mErr = String(e.message || e); }
  try { workerSolve(grid, false, 'max', null); } catch (e) { wErr = String(e.message || e); }
  ok('inline symmetric B2*C2: main-thread AMBIGUOUS', mErr && /AMBIGUOUS_DECISION_CELLS/.test(mErr), mErr);
  ok('inline symmetric B2*C2: worker AMBIGUOUS', wErr && /AMBIGUOUS_DECISION_CELLS/.test(wErr), wErr);
}

// Linear objective-only block with a limit on one cell: BOTH variables kept,
// unbounded on both paths — never silently reduced to one variable / optimal.
{
  const grid = [
    ['Item', 'x', 'y', 'Result', 'Rel', 'Limit'],
    ['Values', '0', '0', '', '', ''],
    ['', '', '', '', '', ''],
    ['Objective', '', '', '=10*B2+20*C2', '', ''],
    ['CapX', '', '', '=B2', '<=', '5'],
  ];
  let mErr = null, wErr = null, mOut = null, wOut = null;
  try { mOut = mainThreadSolve(grid, false, 'max'); } catch (e) { mErr = String(e.message || e); }
  try { wOut = workerSolve(grid, false, 'max', null); } catch (e) { wErr = String(e.message || e); }
  ok('inline linear obj-only block: main-thread unbounded, two vars',
     !mErr && mOut && mOut.status === 'unbounded' && (mOut.variables || []).length === 2, mErr || JSON.stringify(mOut));
  ok('inline linear obj-only block: worker unbounded, two vars',
     !wErr && wOut && wOut.status === 'unbounded' && (wOut.variables || []).length === 2, wErr || JSON.stringify(wOut));
}

console.log('WORKER PARITY TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
