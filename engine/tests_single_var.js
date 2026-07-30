/**
 * tests_single_var.js — a genuine ONE-variable model is detected without a
 * "Dummy" second variable, while an isolated cell with no model structure is
 * NOT turned into a variable. Detection accepts a single cell only with real
 * structural evidence (reached by the objective AND a constraint, per role) and
 * refuses ambiguous cases (several separate cells, or a symmetric =B2*C2 where
 * either cell could be the variable). These tests pin the positive cases, the
 * negative guards, and the multi-variable regressions so the single-variable
 * support cannot weaken normal (>=2 variable) detection.
 *
 * Run: node engine/tests_single_var.js
 */
// Public product capabilities demonstrated by the cases in this file
// (anchors validated by tests_capabilities.js — do not remove without
// updating assets/product-capabilities.js):
//   CAPABILITY: model-single-variable

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

// Binary (real domain): Max 10x, x <= 1, with x set to a binary domain the way
// the panel builds it (integer index 0, bounds 0..1). Checks not just the value
// but that the model is classified binary with the right bounds.
{
  const r = run(oneVar('<=', 1, { coef: 10 }), {
    domains: { integer: [0], bounds: [{ lower: 0, upper: 1 }] },
  });
  const dom = r.out && r.out.variableDomains && r.out.variableDomains[0];
  check('1-var binary: modelType binary, domain 0..1, x=1, objective 10',
    !r.error && r.out.status === 'optimal' && r.out.modelType === 'binary' &&
    dom && dom.type === 'binary' && dom.min === 0 && dom.max === 1 &&
    Math.abs(r.out.objective - 10) < 1e-9 && Math.abs(r.out.values[0] - 1) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// Unbounded: Max x with only x >= 0 (no upper limit) -> unbounded.
{
  const r = run(oneVar('>=', 0));
  check('1-var unbounded: Max x, x>=0 only',
    !r.error && r.out.status === 'unbounded', r.error || JSON.stringify(r.out));
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
    !!r.error && /^detect:/.test(r.error), r.error || JSON.stringify(r.out));
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
    !!r.error && /^detect:/.test(r.error), JSON.stringify(r.out && r.out.status));
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
    !!r.error && /^detect:/.test(r.error), JSON.stringify(r.out && r.out.status));
}

// Two constraints and NO free objective: the cell is reached twice, but only by
// constraint outputs. Picking one as the objective would silently drop a limit,
// so detection must refuse rather than invent an objective.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Lower', '', '', '=B2', '>=', '1'],
    ['Upper', '', '', '=B2', '<=', '5'],
  ];
  const r = run(grid);
  check('negative: two constraints, no objective -> rejected at detection',
    !!r.error && /^detect:/.test(r.error), r.error || JSON.stringify(r.out));
}

// Two SEPARATE loose cells (a non-numeric cell between them prevents a block)
// that each feed objective + constraint. A real two-variable model whose cells
// did not form one block: keeping only one would delete the other and change the
// optimum. Must be reported as ambiguous, never silently reduced.
{
  const grid = [
    ['Item', 'x', 'separator', 'y', '', 'Result', 'Rel', 'Limit'],
    ['Values', '0', 'text', '0', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Total', '', '', '', '', '=B2+100*D2', '', ''],
    ['Capacity', '', '', '', '', '=B2+D2', '<=', '10'],
  ];
  const r = run(grid);
  check('negative: two separate decision cells -> ambiguous, rejected',
    !!r.error && /^detect:/.test(r.error) && /AMBIGUOUS_DECISION_CELLS/.test(r.error),
    r.error || JSON.stringify(r.out));
}

// Symmetric =B2*C2 fed to BOTH objective and constraint: either cell could be
// the variable with the other as coefficient, so detection cannot know which is
// which. It must REFUSE (ambiguous) rather than guess and risk a wrong model.
// This is the safe reading of the "prioritise no wrong result" contract.
{
  const grid = [
    ['Item', 'x', 'coef', 'Total', 'Rel', 'Limit'],
    ['A', '0', '10', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=B2*C2', '', ''],
    ['Cap', '', '', '=B2*C2', '<=', '50'],
  ];
  const r = run(grid);
  check('negative: symmetric B2*C2 in objective and constraint -> ambiguous',
    !!r.error && /^detect:/.test(r.error) && /AMBIGUOUS_DECISION_CELLS/.test(r.error),
    r.error || JSON.stringify(r.out));
}

// A very common one-variable layout: the coefficient lives in a NEIGHBOURING
// cell, objective = quantity * unit-profit, constraint on the quantity only.
// B2 is the decision; C2 is a coefficient. The accidental B2:C2 block is formed
// only by the objective, so it must not out-rank the single cell B2. Expect one
// variable, x = 5, objective 50.
{
  const grid = [
    ['Product', 'Units', 'Profit', 'Contribution', 'Rel', 'Limit'],
    ['A', '0', '10', '=B2*C2', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=D2', '', ''],
    ['Capacity', '', '', '=B2', '<=', '5'],
  ];
  const r = run(grid);
  check('1-var with coefficient in a neighbour cell: x=5, objective 50, one var',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 50) < 1e-9 &&
    r.out.values.length === 1 && Math.abs(r.out.values[0] - 5) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// Coefficient inside a block that feeds BOTH objective and constraint is tested
// above ("negative: symmetric B2*C2 ... -> ambiguous").



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

// A LINEAR block reached only by the objective (with a limit on just one of its
// cells) is still a real two-variable model — it must NOT be silently reduced
// to the one cell that also appears in the constraint. Here y is unbounded, so
// the honest answer is unbounded with two variables, never optimal=50 with one.
{
  const grid = [
    ['Item', 'x', 'y', 'Result', 'Rel', 'Limit'],
    ['Values', '0', '0', '', '', ''],
    ['', '', '', '', '', ''],
    ['Objective', '', '', '=10*B2+20*C2', '', ''],
    ['CapX', '', '', '=B2', '<=', '5'],
  ];
  const r = run(grid);
  check('regression: linear objective-only block keeps BOTH variables (unbounded)',
    !r.error && r.out.status === 'unbounded' && (r.out.variables || []).length === 2,
    r.error || JSON.stringify(r.out));
}

// Two variables, two complete constraints, and NO objective (every output has a
// relation). Detection must refuse rather than promote a constraint to the
// objective and silently drop it. Multi-cell version — the single-cell guard
// alone would miss this.
{
  const grid = [
    ['Item', 'x', 'y', 'Result', 'Rel', 'Limit'],
    ['V', '0', '0', '', '', ''],
    ['', '', '', '', '', ''],
    ['Lower', '', '', '=B2+C2', '>=', '1'],
    ['Upper', '', '', '=B2+C2', '<=', '5'],
  ];
  const r = run(grid);
  check('negative: two variables, two constraints, no objective -> NO_OBJECTIVE_CELL',
    !!r.error && /^detect:/.test(r.error) && /NO_OBJECTIVE_CELL/.test(r.error),
    r.error || JSON.stringify(r.out));
}

// A constraint with a relation operator but an EMPTY limit is incomplete. It
// must never be read as a complete constraint (limit 0) or promoted to the
// objective; refuse so the user fills in the limit.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', ''],
  ];
  const r = run(grid);
  check('negative: constraint with operator but no limit -> CONSTRAINT_MISSING_LIMIT',
    !!r.error && /^detect:/.test(r.error) && /CONSTRAINT_MISSING_LIMIT/.test(r.error),
    r.error || JSON.stringify(r.out));
}

// The limit is the FIRST real cell after the operator. A blank cell between the
// operator and a later number must NOT be crossed to grab that number if there
// is intervening text — that would build "B2 <= 100" from "<= | blank | Notes |
// 100" and solve a model the user never wrote.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit', 'Notes', 'Cap'],
    ['A', '0', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', '', '', ''],
    ['Cap', '', '', '=B2', '<=', '', 'Notes', '100'],
  ];
  const r = run(grid);
  check('negative: text between operator and a later number -> CONSTRAINT_MISSING_LIMIT',
    !!r.error && /^detect:/.test(r.error) && /CONSTRAINT_MISSING_LIMIT/.test(r.error),
    r.error || JSON.stringify(r.out));
}

// A blank cell between the operator and the limit IS allowed — the first real
// cell is the number, so this resolves normally to a limit of 100.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit', 'Cap'],
    ['A', '0', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', '', ''],
    ['Cap', '', '', '=B2', '<=', '', '100'],
  ];
  const r = run(grid);
  check('blank cell between operator and limit is allowed (limit 100)',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 100) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// A valid, complete model must still resolve even if an UNRELATED calculation
// elsewhere on the sheet has an operator but no limit. The incomplete-constraint
// check must be scoped to the chosen model, not the whole sheet.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', '5'],
    ['Aside', '', '', '=99', '>=', ''],
  ];
  const r = run(grid);
  check('unrelated incomplete calc does not block a valid model (obj 5)',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 5) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// ---- Formula-valued limits ---------------------------------------------
// On the web the grid caches every formula as 0, so a limit cell holding a
// formula must be evaluated against the decision variables, never read from the
// cached value. A finite constant is accepted; a variable-dependent formula or
// text/empty is refused.

// Limit =100 must give x=100, never x=0.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', { f: '=100', v: 0 }],
  ];
  const r = run(grid);
  check('formula limit =100 resolves to 100 (not the cached 0)',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 100) < 1e-9 &&
    Math.abs(r.out.values[0] - 100) < 1e-9, r.error || JSON.stringify(r.out));
}

// Limit =G2 where G2 holds 100 must give x=100.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit', 'Const'],
    ['A', '0', '', '', '', '', 100],
    ['', '', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', '', ''],
    ['Cap', '', '', '=B2', '<=', { f: '=G2', v: 0 }, ''],
  ];
  const r = run(grid);
  check('formula limit =G2 (G2=100) resolves to 100',
    !r.error && r.out.status === 'optimal' && Math.abs(r.out.objective - 100) < 1e-9,
    r.error || JSON.stringify(r.out));
}

// Limit ="" (formula returning text) reads as a missing limit, even if a number
// sits further right.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', { f: '=""', v: 0 }],
  ];
  const r = run(grid);
  check('formula limit ="" -> CONSTRAINT_MISSING_LIMIT',
    !!r.error && /^detect:/.test(r.error) && /CONSTRAINT_MISSING_LIMIT/.test(r.error),
    r.error || JSON.stringify(r.out));
}

// Limit =2*B2 depends on a decision variable: it is not a fixed right-hand side
// and must be refused, not frozen at the current value.
{
  const grid = [
    ['Item', 'x', '', 'Result', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=1*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', { f: '=2*B2', v: 0 }],
  ];
  const r = run(grid);
  check('formula limit =2*B2 -> LIMIT_DEPENDS_ON_VARIABLE',
    !!r.error && /^detect:/.test(r.error) && /LIMIT_DEPENDS_ON_VARIABLE/.test(r.error),
    r.error || JSON.stringify(r.out));
}

report();
