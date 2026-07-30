/**
 * tests_grid_input.js — the '=' relation operator must survive the grid→sheet
 * conversion as a VALUE, not be swallowed as a formula.
 *
 * A cell that is just '=' (or '==', '=<', '=>') is the equality/relation
 * operator the grid uses in its operator column — a text value, not a formula.
 * The real app converter (sheetFromGrid) once classified anything starting with
 * '=' as a formula, turning "=B2 = 3" into a formula cell with value 0 and
 * silently dropping the equality. CI stayed green because the TEST converter had
 * the right exception while the APP did not. Both now share ONE classifier
 * (Engine.isFormulaInput_), and these tests run through the REAL converter
 * (harness mkSheet uses that shared helper) so a copy can never drift again.
 *
 * Run: node engine/tests_grid_input.js
 */
const Engine = require('./engine.js');
const { run } = require('./harness.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }
function approx(a, b) { return Math.abs(a - b) <= 1e-6; }

/* ---- Unit: the shared classifier ------------------------------------- */

const isF = Engine.isFormulaInput_;
ok('classify: "=" is a VALUE (relation), not a formula', isF('=') === false);
ok('classify: "==" is a VALUE', isF('==') === false);
ok('classify: "=<" is a VALUE', isF('=<') === false);
ok('classify: "=>" is a VALUE', isF('=>') === false);
ok('classify: "<=" is a VALUE', isF('<=') === false);
ok('classify: ">=" is a VALUE', isF('>=') === false);
ok('classify: "<" is a VALUE', isF('<') === false);
ok('classify: ">" is a VALUE', isF('>') === false);
ok('classify: "\u2264" is a VALUE', isF('\u2264') === false);
ok('classify: "\u2265" is a VALUE', isF('\u2265') === false);
ok('classify: "=B2" IS a formula', isF('=B2') === true);
ok('classify: "=1,5*B2" IS a formula', isF('=1,5*B2') === true);
ok('classify: "=SUM(A1:A3)" IS a formula', isF('=SUM(A1:A3)') === true);
ok('classify: a plain number is not a formula', isF('42') === false);
ok('classify: empty is not a formula', isF('') === false);

/* ---- Behavioural: the '=' operator makes an equality constraint ------- */
// These run through the REAL converter (harness mkSheet → Engine.isFormulaInput_).

// Max x with x = 3 (operator "="): the optimum is exactly 3.
{
  const grid = [
    ['Item', 'x', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', ''],
    ['', '', '', '', ''],
    ['Obj', '', '=B2', '', ''],
    ['Con', '', '=B2', '=', '3'],
  ];
  const r = run(grid);
  ok('e2e: "=" makes an equality constraint (Max x, x=3 => 3)',
     !r.error && approx(r.out.objective, 3), r.error || ('obj=' + (r.out && r.out.objective)));
}

// The "==" variant behaves identically.
{
  const grid = [
    ['Item', 'x', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', ''],
    ['', '', '', '', ''],
    ['Obj', '', '=B2', '', ''],
    ['Con', '', '=B2', '==', '3'],
  ];
  const r = run(grid);
  ok('e2e: "==" is an equality constraint (=> 3)',
     !r.error && approx(r.out.objective, 3), r.error || ('obj=' + (r.out && r.out.objective)));
}

// "=<" means <=: Max x with x <= 3 gives 3.
{
  const grid = [
    ['Item', 'x', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', ''],
    ['', '', '', '', ''],
    ['Obj', '', '=B2', '', ''],
    ['Con', '', '=B2', '=<', '3'],
  ];
  const r = run(grid);
  ok('e2e: "=<" means <= (Max x, x<=3 => 3)',
     !r.error && approx(r.out.objective, 3), r.error || ('obj=' + (r.out && r.out.objective)));
}

// "=>" means >=: Min x with x >= 3 gives 3.
{
  const grid = [
    ['Item', 'x', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', ''],
    ['', '', '', '', ''],
    ['Obj', '', '=B2', '', ''],
    ['Con', '', '=B2', '=>', '3'],
  ];
  const r = run(grid, { mutate: function (m) { m.objective.sense = 'min'; } });
  ok('e2e: "=>" means >= (Min x, x>=3 => 3)',
     !r.error && approx(r.out.objective, 3), r.error || ('obj=' + (r.out && r.out.objective)));
}

// A real formula in the operator-adjacent cell is still a formula: "=B2" as the
// total stays a formula (the model solves), proving we didn't over-correct.
{
  const grid = [
    ['Item', 'x', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', ''],
    ['', '', '', '', ''],
    ['Obj', '', '=B2', '', ''],
    ['Con', '', '=B2', '<=', '5'],
  ];
  const r = run(grid);
  ok('e2e: "=B2" is still a formula (model solves, Max x<=5 => 5)',
     !r.error && approx(r.out.objective, 5), r.error || ('obj=' + (r.out && r.out.objective)));
}

/* ---- Layer 3: the REAL app converter (sheetFromGrid via jsdom) -------- */
// The unit + harness layers use the shared classifier; this layer proves the
// ACTUAL app function sheetFromGrid classifies the same way, so the two can
// never diverge again (the original bug was exactly such a divergence).
(function () {
  let JSDOM;
  try { JSDOM = require('jsdom').JSDOM; }
  catch (e) {
    if (process.env.CI) { console.log('  FAIL: jsdom missing under CI'); fail++; }
    return; // skip locally without jsdom
  }
  const fs = require('fs');
  const path = require('path');
  const solverHtml = fs.readFileSync(path.join(__dirname, '..', 'solver.html'), 'utf8')
    .replace(/<script src="assets\/[^"]*"[^>]*><\/script>/g, '');
  const i18nSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'i18n.js'), 'utf8');
  const dom = new JSDOM(solverHtml, {
    runScripts: 'dangerously', url: 'https://plumline.online/solver.html',
    beforeParse(w) {
      w.__PLUMLINE_TEST__ = true;
      w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
      w.scrollTo = () => {};
      if (w.Element) w.Element.prototype.scrollIntoView = () => {};
      w.console.log = () => {}; w.console.warn = () => {};
      w.eval(i18nSrc);
    }
  });
  // jsdom scripts run synchronously here; __plumline is ready.
  const api = dom.window.__plumline;
  if (!api || !api.classifyGridRow_) { fail++; console.log('  FAIL: real converter not exposed'); return; }

  // The operator column value '=' must land in VALUES, not FORMULAS.
  const row = api.classifyGridRow_(['=B2', '=', '3']);
  ok('real app: "=B2" is a formula in sheetFromGrid',
     row.formulas[0] === '=B2' && row.values[0] === 0, JSON.stringify(row));
  ok('real app: "=" is a VALUE (not swallowed as a formula)',
     row.formulas[1] === '' && row.values[1] === '=', JSON.stringify(row));
  ok('real app: "3" is a numeric value', row.values[2] === 3, JSON.stringify(row));

  const row2 = api.classifyGridRow_(['=<', '=>', '==']);
  ok('real app: "=<" is a value', row2.formulas[0] === '' && row2.values[0] === '=<', JSON.stringify(row2));
  ok('real app: "=>" is a value', row2.formulas[1] === '' && row2.values[1] === '=>', JSON.stringify(row2));
  ok('real app: "==" is a value', row2.formulas[2] === '' && row2.values[2] === '==', JSON.stringify(row2));
})();

console.log('GRID INPUT TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
process.exit(fail > 0 ? 1 : 0);
