/**
 * tests_strict.js — strict inequalities (< and >) must be REJECTED as model
 * constraint operators, never silently widened to <= / >=. Silently turning
 * "x < 10" into "x <= 10" changes the model and could report a solution the
 * user explicitly excluded — a verifiability violation. SUMIF/COUNTIF criteria
 * that legitimately use < or > inside a formula must still work.
 *
 * Run: node engine/tests_strict.js
 */
const { run, check, report } = require('./harness.js');

function isStrictError(r) {
  return !!r.error && /STRICT_INEQUALITY/.test(r.error);
}

// Proven layout (mirrors tests.js buildMax): objective on the Total row, one
// constraint row per limit with [label,,, =terms, rel, limit].
function buildMax(vars, consts) {
  const grid = [['Item', 'Units', 'x', 'Total', 'Rel', 'Limit']];
  const firstVarRow = 2;
  vars.forEach(v => grid.push([v.name, '0', '', '', '', '']));
  grid.push(['', '', '', '', '', '']);
  const objTerms = vars.map((v, i) => v.profit + '*B' + (firstVarRow + i)).join('+');
  grid.push(['Total', '', '', '=' + objTerms, '', '']);
  consts.forEach(c => {
    const terms = c.coefs.map((co, i) => co + '*B' + (firstVarRow + i)).join('+');
    grid.push([c.label || 'C', '', '', '=' + terms, c.rel, String(c.limit)]);
  });
  return grid;
}

// max 3A + 2B  s.t.  A + B (rel) 4 ;  A <= 2
function grid(rel) {
  return buildMax(
    [{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }],
    [{ label: 'Cap', coefs: [1, 1], rel: rel, limit: 4 },
     { label: 'UpperA', coefs: [1, 0], rel: '<=', limit: 2 }]
  );
}

// Strict operators are rejected.
check('constraint operator "<" is rejected', isStrictError(run(grid('<'))), JSON.stringify(run(grid('<')).error));
check('constraint operator ">" is rejected', isStrictError(run(grid('>'))), JSON.stringify(run(grid('>')).error));

// Non-strict operators still solve.
const le = run(grid('<='));
check('constraint operator "<=" still solves', !le.error && le.out.status === 'optimal', le.error || le.out.status);
const ge = run(grid('>='));
check('constraint operator ">=" still solves (may be unbounded/optimal, not a strict error)',
  !isStrictError(ge), ge.error || ge.out.status);
const eq = run(grid('='));
check('constraint operator "=" still solves', !isStrictError(eq), eq.error || (eq.out && eq.out.status));
// Unicode forms still accepted.
check('constraint operator "\u2264" still solves', !isStrictError(run(grid('\u2264'))), 'le unicode');
check('constraint operator "\u2265" still solves', !isStrictError(run(grid('\u2265'))), 'ge unicode');

// The strict error message carries the marker so the UI can localize it, and
// names the offending relation.
const errMsg = run(grid('<')).error || '';
check('strict error carries the STRICT_INEQUALITY marker', /STRICT_INEQUALITY:/.test(errMsg), errMsg);
check('strict error mentions the operator', /"</.test(errMsg), errMsg);

// A strict comparison INSIDE a SUMIF criterion must NOT be rejected — that is a
// legitimate use of "<" / ">" that has nothing to do with constraint operators.
// max B2  s.t.  (count of cells > 0 via SUMIF) <= 5, B2 <= 3
{
  const g = [
    ['Item', 'Units', 'x', 'Total', 'Rel', 'Limit'],
    ['A', '2', '1', '=B2', '', ''],
    ['B', '5', '', '', '', ''],
    ['C', '1', '', '', '', ''],
    ['Total', '', '', '=B2', '', ''],
    ['CountPos', '', '', '=SUMIF(B2:B4,">0",B2:B4)', '<=', '100'],
    ['Cap', '', '', '=B2', '<=', '3'],
  ];
  const r = run(g);
  check('SUMIF with ">0" criterion is not rejected as a strict constraint',
    !isStrictError(r), r.error || (r.out && r.out.status));
}

report('STRICT INEQUALITY TESTS');
