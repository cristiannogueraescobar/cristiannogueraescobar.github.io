/**
 * tests_strict.js — strict inequalities (< and >) must be REJECTED as model
 * constraint operators, never silently widened to <= / >=. Silently turning
 * "x < 10" into "x <= 10" changes the model and could report a solution the
 * user explicitly excluded — a verifiability violation. SUMIF criteria
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

// Non-strict operators still solve to a CONCRETE, correct status — not merely
// "no strict error" (which would also pass on an unrelated failure).
const le = run(grid('<='));
check('constraint operator "<=" solves optimally', !le.error && le.out && le.out.status === 'optimal',
  le.error || JSON.stringify(le.out));
// A + B >= 4 with a maximise objective and no upper cap on B is unbounded.
const ge = run(grid('>='));
check('constraint operator ">=" solves without a strict error (unbounded here)',
  !ge.error && ge.out && ge.out.status === 'unbounded', ge.error || JSON.stringify(ge.out));
const eq = run(grid('='));
check('constraint operator "=" solves optimally', !eq.error && eq.out && eq.out.status === 'optimal',
  eq.error || JSON.stringify(eq.out));
// Unicode and alias forms must map to their non-strict relation and solve.
check('constraint operator "\u2264" solves optimally',
  (function () { const r = run(grid('\u2264')); return !r.error && r.out && r.out.status === 'optimal'; })(), 'le unicode');
check('constraint operator "\u2265" solves (unbounded)',
  (function () { const r = run(grid('\u2265')); return !r.error && r.out && r.out.status === 'unbounded'; })(), 'ge unicode');
// Alias forms must never be mis-flagged as strict inequalities. (Whether the
// auto-detector recognises =< / => / == as operators is a separate concern;
// here we only guarantee they are not rejected by the strict-inequality guard.)
check('alias "=<" is not treated as strict', !isStrictError(run(grid('=<'))), 'le alias');
check('alias "=>" is not treated as strict', !isStrictError(run(grid('=>'))), 'ge alias');
check('alias "==" is not treated as strict', !isStrictError(run(grid('=='))), 'eq alias');

// The strict error message carries the marker and names the offending relation,
// for BOTH operators (not just "<").
const errLt = run(grid('<')).error || '';
const errGt = run(grid('>')).error || '';
check('strict "<" error carries the STRICT_INEQUALITY marker', /STRICT_INEQUALITY:/.test(errLt), errLt);
check('strict "<" error names the "<" operator', /"</.test(errLt), errLt);
check('strict ">" error carries the STRICT_INEQUALITY marker', /STRICT_INEQUALITY:/.test(errGt), errGt);
check('strict ">" error names the ">" operator', /">/.test(errGt), errGt);

// Operators with surrounding spaces are trimmed, so " < " / " > " are still
// caught as strict, and " <= " still solves.
check('spaced " < " is rejected', isStrictError(run(grid(' < '))), JSON.stringify(run(grid(' < ')).error));
check('spaced " > " is rejected', isStrictError(run(grid(' > '))), JSON.stringify(run(grid(' > ')).error));
check('spaced " <= " solves optimally',
  (function () { const r = run(grid(' <= ')); return !r.error && r.out && r.out.status === 'optimal'; })(), 'spaced le');

// A strict comparison INSIDE a SUMIF criterion must NOT be rejected — that is a
// legitimate use of "<" / ">" that has nothing to do with constraint operators.
{
  // The ">0" lives inside the SUMIF criterion string, NOT as a constraint
  // operator, so it must never trigger the strict-inequality rejection. We
  // assert precisely that invariant (the row uses "<=" as its real operator).
  const g = [
    ['Item', 'x', 'Data', 'Total', 'Rel', 'Limit'],
    ['A', '0', '5', '', '', ''],
    ['B', '', '5', '', '', ''],
    ['C', '', '1', '', '', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=B2', '', ''],
    ['CountPos', '', '', '=SUMIF(C2:C4,">0",C2:C4)*0+B2', '<=', '3'],
  ];
  const r = run(g);
  check('SUMIF ">0" criterion is never flagged as a strict constraint operator',
    !isStrictError(r), r.error || JSON.stringify(r.out));
}

report('STRICT INEQUALITY TESTS');
