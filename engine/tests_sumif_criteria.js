/**
 * tests_sumif_criteria.js — SUMIF numeric criteria must be recognised in ANY
 * finite numeric form (10.0, .5, 01, 1e3, +10), not only the canonical
 * String(Number(x)) form. Treating "10.0" as text made ">10.0" compare
 * lexicographically, so SUMIF summed the wrong cells; when that SUMIF feeds a
 * constraint or objective, the solver's ANSWER changes silently. These tests
 * use a NON-zero SUMIF weight and assert the full known optimum, so a wrong sum
 * is caught end to end.
 *
 * Run: node engine/tests_sumif_criteria.js
 */
const { run, check, report } = require('./harness.js');

// Data cells H2=2, H3=20 (constant, not decision variables).
// Model: maximise B2  s.t.  B2 + SUMIF(H2:H3, <crit>, H2:H3) <= 25 ;  B2+B3 <= 100
// => B2_max = 25 - SUMIF(H2:H3, <crit>).
function model(crit) {
  return [
    ['Item', 'Units', 'x', 'Total', 'Rel', 'Limit', '', 'Data'],
    ['A', '0', '', '', '', '', '', '2'],
    ['B', '0', '', '', '', '', '', '20'],
    ['', '', '', '', '', '', '', ''],
    ['Total', '', '', '=1*B2+0*B3', '', '', '', ''],
    ['Cap', '', '', '=1*B2+SUMIF(H2:H3,"' + crit + '",H2:H3)', '<=', '25', '', ''],
    ['CapAB', '', '', '=1*B2+1*B3', '<=', '100', '', ''],
  ];
}

// [criterion, expected SUMIF sum over {2,20}] -> expected B2 = 25 - sum.
const cases = [
  ['>10',    20],   // canonical: only 20
  ['>10.0',  20],   // decimal form: only 20 (the bug summed both -> 22)
  ['>=20',   20],   // only 20
  ['>=20.0', 20],
  ['<10',     2],   // only 2
  ['<=10.0',  2],
  ['<>0.0',  22],   // both non-zero
  ['<>2',    20],   // exclude 2
  ['>.5',    22],   // .5 form: both > 0.5
  ['>01',    22],   // 01 == 1: both > 1
  ['>1e3',    0],   // 1e3 == 1000: neither
  ['>+10',   20],   // +10 == 10: only 20
  ['=20',    20],   // exact match
  ['=20.0',  20],
  // Operator-LESS equality criteria: Excel treats "20" / "20.0" as "=20". These
  // must normalise too — the bare-equality path was the one that still failed.
  ['20',     20],
  ['20.0',   20],
  ['020',    20],
  ['+20',    20],
  ['2e1',    20],   // 2e1 == 20
  ['2',       2],   // only the H2=2 cell
];

cases.forEach(function (c) {
  const [crit, sum] = c;
  const expectedB2 = 25 - sum;
  const r = run(model(crit));
  const okStatus = !r.error && r.out && r.out.status === 'optimal';
  const okValue = okStatus && Math.abs(r.out.objective - expectedB2) < 1e-6;
  check('SUMIF "' + crit + '" sums to ' + sum + ' -> B2 = ' + expectedB2,
    okValue, r.error || ('status ' + (r.out && r.out.status) + ' obj ' + (r.out && r.out.objective)));
});

// A genuinely non-numeric equality criterion must NOT match the numbers, so the
// SUMIF sums nothing and B2 can reach the full 25.
{
  const r = run(model('hello'));
  check('operator-less text criterion "hello" matches nothing (B2 = 25)',
    !r.error && r.out && r.out.status === 'optimal' && Math.abs(r.out.objective - 25) < 1e-6,
    r.error || JSON.stringify(r.out));
}

// Text criteria must still work as equality/inequality on strings.
{
  // H column has labels; SUMIF over a numeric weight column with a text match.
  const g = [
    ['Item', 'Units', 'x', 'Total', 'Rel', 'Limit', '', 'Tag', 'Wt'],
    ['A', '0', '', '', '', '', '', 'yes', '4'],
    ['B', '0', '', '', '', '', '', 'no', '9'],
    ['', '', '', '', '', '', '', '', ''],
    ['Total', '', '', '=1*B2+0*B3', '', '', '', '', ''],
    ['Cap', '', '', '=1*B2+SUMIF(H2:H3,"yes",I2:I3)', '<=', '10', '', '', ''],
    ['CapAB', '', '', '=1*B2+1*B3', '<=', '100', '', '', ''],
  ];
  const r = run(g);  // SUMIF = 4 (only the "yes" row) -> B2 <= 6
  check('SUMIF text criterion "yes" still matches (B2 = 6)',
    !r.error && r.out && r.out.status === 'optimal' && Math.abs(r.out.objective - 6) < 1e-6,
    r.error || JSON.stringify(r.out));
}

report();
