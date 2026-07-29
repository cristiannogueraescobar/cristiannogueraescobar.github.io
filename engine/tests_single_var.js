/**
 * tests_single_var.js — a genuine ONE-variable model must be detected without a
 * "Dummy" second variable, while an isolated cell with no model structure must
 * NOT be turned into a variable. The detector currently rejects any single-cell
 * block (`if (size < 2) return`), so these tests fail until single-variable
 * detection lands. They pin both the positive cases and the negative guards so
 * the fix cannot weaken normal (>=2 variable) detection.
 *
 * Run: node engine/tests_single_var.js
 */
const { run, check, report } = require('./harness.js');

// A single variable B2 that feeds the objective (Total = B2) AND a constraint.
// This is the minimal structural evidence a one-cell block needs: it is used by
// the objective and by at least one limit, so it is clearly a decision, not a
// stray constant.
function oneVar(rel, limit, opts) {
  opts = opts || {};
  const grid = [
    ['Item', 'x', '', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    [opts.objLabel || 'Total', '', '', '=' + (opts.coef || 1) + '*B2', '', ''],
  ];
  if (rel) grid.push(['Cap', '', '', '=B2', rel, String(limit)]);
  return grid;
}

// ---- Required positive cases -------------------------------------------

// LP continuous maximise: Max x, x <= 5 -> x = 5.
{
  const r = run(oneVar('<=', 5));
  check('1-var LP max: detected, optimal, x=5',
    !r.error && r.out.status === 'optimal' && r.out.objective === 5 &&
    r.out.values.length === 1 && Math.abs(r.out.values[0] - 5) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// LP continuous minimise: Min x, x >= 3 -> x = 3. The objective label drives the
// sense; "Cost" is a minimise hint.
{
  const r = run(oneVar('>=', 3, { objLabel: 'Cost' }));
  check('1-var LP min: detected, optimal, x=3',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 3) < 1e-9 &&
    r.out.values.length === 1 && Math.abs(r.out.values[0] - 3) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// Integer: Max 2x, x <= 4.7, x integer -> x = 4, objective 8.
{
  const r = run(oneVar('<=', 4.7, { coef: 2 }), { integer: true });
  check('1-var integer: x=4, objective 8',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 8) < 1e-9 &&
    r.out.values.length === 1 && Math.abs(r.out.values[0] - 4) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// Binary (with an explicit constraint x <= 1, since variable config is not
// visible at detection time — the agreed P1 rule requires objective + at least
// one constraint). Max 10x, x <= 1, x integer -> x = 1, objective 10.
{
  const r = run(oneVar('<=', 1, { coef: 10 }), { integer: true });
  check('1-var binary-like: x=1, objective 10',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 10) < 1e-9 &&
    r.out.values.length === 1 && Math.abs(r.out.values[0] - 1) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// Unbounded: Max x with only x >= 0 (no upper limit) -> unbounded.
{
  const r = run(oneVar('>=', 0));
  check('1-var unbounded: Max x, x>=0 only',
    !r.error && r.out.status === 'unbounded', r.error || JSON.stringify(r.out));
}

// Binary: Max 10x with a structural constraint present so detection has grid
// evidence (x <= 1), then x set binary. Detection runs on the grid first, so a
// lone cell needs a constraint row to be recognised; the binary config is then
// applied on top. Expected x = 1, objective 10.
{
  const grid = [
    ['Item', 'x', '', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=10*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', '1'],
  ];
  // integer flag stands in for the binary domain in this harness path.
  const r = run(grid, { integer: true });
  check('1-var binary-ish: Max 10x, x<=1 integer -> x=1, objective 10',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 10) < 1e-9 &&
    r.out.values.length === 1 && Math.abs(r.out.values[0] - 1) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// Infeasible: x >= 5 and x <= 3.
{
  const grid = [
    ['Item', 'x', '', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=B2', '', ''],
    ['Lo', '', '', '=B2', '>=', '5'],
    ['Hi', '', '', '=B2', '<=', '3'],
  ];
  const r = run(grid);
  check('1-var infeasible: x>=5 and x<=3',
    !r.error && r.out.status === 'infeasible', r.error || JSON.stringify(r.out));
}

// ---- Negative guards: an isolated cell must NOT become a variable ------

// A lone numeric cell with a formula that does NOT reference any decision, and
// no constraint: there is no model. Must fail to detect (not invent a variable).
{
  const grid = [
    ['Note', '', ''],
    ['42', '', ''],
    ['Total', '', '=A2'],   // references a constant, not a decision cell
  ];
  const r = run(grid);
  check('negative: lone constant feeding an info formula is not a variable',
    !!r.error, JSON.stringify(r.out));
}

// A single cell that appears ONLY in the objective, never in a constraint or
// variable setting. Without a limit it is not a decision the solver can bound;
// detection must not fabricate an unbounded 1-var model from a bare total.
{
  const grid = [
    ['Item', 'x', '', 'Total'],
    ['A', '0', '', '=B2'],   // B2 feeds only the objective; no constraint at all
  ];
  const r = run(grid);
  check('negative: cell in objective only (no constraint) is not detected',
    !!r.error, JSON.stringify(r.out));
}

// A single cell that feeds a constraint but NOT the objective is not a decision
// the objective optimises over; it must not be picked as the sole variable.
{
  const grid = [
    ['Item', 'k', '', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=7', '', ''],   // objective is a constant, no variable
    ['Cap', '', '', '=B2', '<=', '5'],  // B2 only in a constraint
  ];
  const r = run(grid);
  check('negative: cell in a constraint only (not objective) is not detected',
    !!r.error || (r.out && r.out.status !== 'optimal'), JSON.stringify(r.out && r.out.status));
}

// A text cell must never be read as a variable.
{
  const grid = [
    ['Item', 'x', '', 'Total', 'Rel', 'Limit'],
    ['A', 'hello', '', '', '', ''],
    ['Total', '', '', '=B2', '', ''],
    ['Cap', '', '', '=B2', '<=', '5'],
  ];
  const r = run(grid);
  // B2 is text; linearizing =B2 as a decision must not yield a clean 1-var LP.
  check('negative: text cell is not turned into a variable',
    !!r.error || (r.out && r.out.status !== 'optimal'), JSON.stringify(r.out && r.out.status));
}

// ---- Regression: multi-variable detection is unchanged -----------------
{
  const grid = [
    ['Product', 'Units', 'Profit', 'Total', 'Hours', ''],
    ['A', '0', '30', '=B2*C2', '2', ''],
    ['B', '0', '20', '=B3*C3', '1', ''],
    ['C', '0', '48', '=B4*C4', '3', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=SUM(D2:D4)', '', ''],
    ['Hours', '', '', '=SUMPRODUCT(B2:B4,E2:E4)', '<=', '100'],
    ['UpperB', '', '', '=B3', '<=', '40'],
  ];
  const r = run(grid);
  check('regression: canonical 3-var model still 1760',
    !r.error && r.out.status === 'optimal' && r.out.objective === 1760 &&
    r.out.values.length === 3, r.error || JSON.stringify(r.out));
}

report();
