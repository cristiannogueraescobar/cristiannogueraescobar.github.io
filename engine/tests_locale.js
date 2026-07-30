/**
 * tests_locale.js — European-locale (decimal comma / semicolon separator)
 * support. A sheet written 1,5 and SUM(A;B) must solve identically to the
 * canonical 1.5 and SUM(A,B), while US sheets stay untouched and string
 * literals containing ';' or ',' are preserved.
 *
 * Two layers:
 *   1. Unit: detectLocale_, normalizeFormula_, normalizeValue_ directly.
 *   2. End-to-end via the harness: real detect+solve with European formulas
 *      and values, auto-detected and forced, plus US regression and the
 *      genuinely-ambiguous case that only the manual selector can resolve.
 *
 * Run: node engine/tests_locale.js
 */
// Public product capabilities demonstrated by the cases in this file
// (anchors validated by tests_capabilities.js — do not remove without
// updating assets/product-capabilities.js):
//   CAPABILITY: sheet-locale-us
//   CAPABILITY: sheet-locale-eu

const Engine = require('./engine.js');
const { run } = require('./harness.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }
function approx(a, b) { return Math.abs(a - b) <= 1e-6; }

/* ---- Layer 1: unit tests of the locale helpers ------------------------ */

const detectLocale_ = Engine.detectLocale_;
const normalizeFormula_ = Engine.normalizeFormula_;
const normalizeValue_ = Engine.normalizeValue_;

// detectLocale_ — a ';' outside strings, or a decimal-comma value, means EU.
ok('detect: semicolon in a formula => eu',
   detectLocale_([['=SUM(A2:A3;B2:B3)']], [['']], 'auto') === 'eu');
ok('detect: decimal-comma value => eu',
   detectLocale_([['']], [['7,5']], 'auto') === 'eu');
ok('detect: plain US sheet => us',
   detectLocale_([['=SUM(A2:A3,B2:B3)']], [['7.5']], 'auto') === 'us');
ok('detect: semicolon INSIDE a string is not a separator => us',
   detectLocale_([['=IF(A1="a;b",1,2)']], [['']], 'auto') === 'us');
ok('detect: forced eu overrides content', detectLocale_([['=SUM(A,B)']], [['7.5']], 'eu') === 'eu');
ok('detect: forced us overrides content', detectLocale_([['=SUM(A;B)']], [['7,5']], 'us') === 'us');
ok('detect: grouped 1.234,56 (eu grouping) => eu is NOT claimed (out of scope)',
   // thousands grouping is out of scope; a bare "1.234,56" is not a decimal-comma
   // match, so it does not by itself force eu. (Documented scope limit.)
   detectLocale_([['']], [['1.234,56']], 'auto') === 'us');

// normalizeFormula_ — outside strings, ';'->',' and ','->'.', only when eu.
ok('normalize: eu =1,5*B2 => 1.5*B2', normalizeFormula_('1,5*B2', 'eu') === '1.5*B2');
ok('normalize: eu SUM(A;B) => SUM(A,B)', normalizeFormula_('SUM(B2:B4;C2:C4)', 'eu') === 'SUM(B2:B4,C2:C4)');
ok('normalize: eu IF(B2>0;1,5;0) => IF(B2>0,1.5,0)',
   normalizeFormula_('IF(B2>0;1,5;0)', 'eu') === 'IF(B2>0,1.5,0)');
ok('normalize: eu preserves string literal "a;b"',
   normalizeFormula_('IF(A1="a;b";1,5;2)', 'eu') === 'IF(A1="a;b",1.5,2)');
ok('normalize: us formula is untouched', normalizeFormula_('1.5*B2', 'us') === '1.5*B2');
ok('normalize: eu formula with no comma/semicolon is untouched',
   normalizeFormula_('B2*C2', 'eu') === 'B2*C2');

// normalizeValue_ — a decimal-comma string becomes a number, only when eu.
ok('value: eu "7,5" => 7.5', normalizeValue_('7,5', 'eu') === 7.5);
ok('value: eu "-12,0" => -12', normalizeValue_('-12,0', 'eu') === -12);
ok('value: us "7,5" stays a string', normalizeValue_('7,5', 'us') === '7,5');
ok('value: eu plain integer string is untouched', normalizeValue_('42', 'eu') === '42');
ok('value: eu number passes through', normalizeValue_(7.5, 'eu') === 7.5);

/* ---- Layer 2: end-to-end detect + solve ------------------------------- */

// A tiny model: maximize a total that is 1.5 * x, with x <= 5, so the optimum
// objective is 7.5. Expressed in several locales.
function tinyModel(objFormula) {
  return [
    ['Item', 'x', '', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Tot', '', '', objFormula, '', ''],
    ['Cap', '', '', '=B2', '<=', '5'],
  ];
}

// Forced EU: =1,5*B2 solves to 7.5.
{
  const r = run(tinyModel('=1,5*B2'), { locale: 'eu' });
  ok('e2e: forced eu =1,5*B2 solves to 7.5', !r.error && approx(r.out.objective, 7.5),
     r.error || ('obj=' + (r.out && r.out.objective)));
}

// US stays correct and untouched: =1.5*B2 solves to 7.5.
{
  const r = run(tinyModel('=1.5*B2'));
  ok('e2e: us =1.5*B2 solves to 7.5', !r.error && approx(r.out.objective, 7.5),
     r.error || ('obj=' + (r.out && r.out.objective)));
}

// Genuinely ambiguous: =1,5*B2 with NO other European signal under auto. This
// SHOULD fail (the comma reads as an argument separator) — that is exactly why
// the manual EU selector exists. We assert it does not silently mis-solve.
{
  const r = run(tinyModel('=1,5*B2'));
  ok('e2e: auto =1,5*B2 with no signal does not silently mis-solve as 7.5',
     r.error || !approx(r.out.objective, 7.5),
     r.error ? '' : ('obj=' + r.out.objective));
}

// Auto-detected EU via ';' in a SUM: a production model with hours.
{
  const grid = [
    ['Prod', 'x', 'Profit', 'Line', 'Hrs', ''],
    ['A', '0', '30', '=B2*C2', '2', ''],
    ['B', '0', '20', '=B3*C3', '1', ''],
    ['C', '0', '48', '=B4*C4', '3', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=SUM(D2:D4)', '', ''],
    ['Hours', '', '', '=SUMPRODUCT(B2:B4;E2:E4)', '<=', '100'],
    ['CapA', '', '', '=B2', '<=', '40'],
    ['CapB', '', '', '=B3', '<=', '40'],
    ['CapC', '', '', '=B4', '<=', '40'],
  ];
  const r = run(grid);
  ok('e2e: auto-detects eu from SUMPRODUCT(...;...) and solves',
     !r.error && r.out && typeof r.out.objective === 'number',
     r.error || 'no objective');
}

// Auto-detected EU via a decimal-comma VALUE (7,5 in a data cell).
{
  const grid = [
    ['Item', 'x', 'coef', 'Total', 'Rel', 'Limit'],
    ['A', '0', '7,5', '', '', ''],
    ['', '', '', '', '', ''],
    ['Tot', '', '', '=C2*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', '5'],
  ];
  const r = run(grid);
  ok('e2e: auto-detects eu from a "7,5" value and solves to 37.5',
     !r.error && approx(r.out.objective, 37.5),
     r.error || ('obj=' + (r.out && r.out.objective)));
}

// A ';' inside a string literal must NOT trigger EU on a US sheet.
{
  const grid = [
    ['Item', 'x', '', 'Total', 'Rel', 'Limit'],
    ['A', '0', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Tot', '', '', '=IF(A1="x;y",1.5,1.5)*B2', '', ''],
    ['Cap', '', '', '=B2', '<=', '5'],
  ];
  const r = run(grid);
  ok('e2e: ";" inside a string does not switch a US sheet to eu',
     !r.error && approx(r.out.objective, 7.5),
     r.error || ('obj=' + (r.out && r.out.objective)));
}

// SUMIF with a European decimal criterion ">10,0": on an EU sheet it must
// compare NUMERICALLY (only 20 passes, not 2), giving 20 — a text comparison
// would wrongly pass both and give 22.
{
  const grid = [
    ['Item', 'x', 'val', 'Total', 'Rel', 'Limit'],
    ['A', '0', '2', '', '', ''],
    ['B', '', '20', '', '', ''],
    ['', '', '', '', '', ''],
    ['Obj', '', '', '=B2', '', ''],
    ['Lim', '', '', '=B2', '<=', '=SUMIF(C2:C3;">10,0";C2:C3)'],
  ];
  const r = run(grid, { locale: 'eu' });
  ok('e2e: SUMIF ">10,0" compares numerically on an EU sheet (=> 20)',
     !r.error && approx(r.out.objective, 20), r.error || ('obj=' + (r.out && r.out.objective)));
}

// SUMIF implicit-equality European criterion "20,0" matches only the 20.
{
  const grid = [
    ['Item', 'x', 'val', 'Total', 'Rel', 'Limit'],
    ['A', '0', '2', '', '', ''],
    ['B', '', '20', '', '', ''],
    ['', '', '', '', '', ''],
    ['Obj', '', '', '=B2', '', ''],
    ['Lim', '', '', '=B2', '<=', '=SUMIF(C2:C3;"20,0";C2:C3)'],
  ];
  const r = run(grid, { locale: 'eu' });
  ok('e2e: SUMIF "20,0" implicit equality matches the 20 (=> 20)',
     !r.error && approx(r.out.objective, 20), r.error || ('obj=' + (r.out && r.out.objective)));
}

// US SUMIF with a canonical ">10.0" criterion is unaffected.
{
  const grid = [
    ['Item', 'x', 'val', 'Total', 'Rel', 'Limit'],
    ['A', '0', '2', '', '', ''],
    ['B', '', '20', '', '', ''],
    ['', '', '', '', '', ''],
    ['Obj', '', '', '=B2', '', ''],
    ['Lim', '', '', '=B2', '<=', '=SUMIF(C2:C3,">10.0",C2:C3)'],
  ];
  const r = run(grid);
  ok('e2e: US SUMIF ">10.0" still works (=> 20)',
     !r.error && approx(r.out.objective, 20), r.error || ('obj=' + (r.out && r.out.objective)));
}

// Numeric-vs-text guard: EU ">100,0" excludes BOTH values (2 and 20), so the
// SUMIF is 0 — proving the criterion is compared numerically, not as text
// (where "2">"100,0" and "20">"100,0" would both wrongly pass).
{
  const grid = [
    ['Item', 'x', 'val', 'Total', 'Rel', 'Limit'],
    ['A', '0', '2', '', '', ''],
    ['B', '', '20', '', '', ''],
    ['', '', '', '', '', ''],
    ['Obj', '', '', '=B2', '', ''],
    ['Lim', '', '', '=B2', '<=', '=SUMIF(C2:C3;">100,0";C2:C3)'],
  ];
  const r = run(grid, { locale: 'eu' });
  ok('e2e: SUMIF ">100,0" excludes both values numerically (=> 0)',
     !r.error && approx(r.out.objective, 0), r.error || ('obj=' + (r.out && r.out.objective)));
}

// EU formula + a Variable-Settings DOMAIN that changes the result: =1,5*B2 with
// an upper bound of 3 on the single variable caps the objective at 4.5 (not
// 7.5). This exercises the domain path under a forced EU locale end-to-end.
{
  const grid = tinyModel('=1,5*B2');
  const r = run(grid, {
    locale: 'eu',
    domains: { integer: [], bounds: [{ lower: 0, upper: 3 }] },
  });
  ok('e2e: EU =1,5*B2 with an upper-bound domain caps at 4.5',
     !r.error && approx(r.out.objective, 4.5), r.error || ('obj=' + (r.out && r.out.objective)));
}

console.log('LOCALE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
process.exit(fail > 0 ? 1 : 0);
