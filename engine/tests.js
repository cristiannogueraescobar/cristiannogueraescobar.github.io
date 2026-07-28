/* Plumline engine test suite.
 * Each case has a hand-computed expected answer. We run the CURRENT engine
 * unchanged and record what it does. This is the regression net: cases that
 * pass get frozen; cases that fail or misclassify become the fix list.
 *
 * The grid format mirrors how the web solver lays a model out:
 *   - decision cells (the "Units"/"Make" column) start at 0
 *   - an objective cell sums a weighted total
 *   - constraint rows carry a formula, a relation (<=, >=, =) and a limit
 * Detection is heuristic, so some shapes may not be detected the way we expect;
 * that itself is useful signal.
 */
const { run, check, approx, report } = require('./harness.js');

/* Helper: a "max c·x s.t. rows" builder using an explicit-coefficient layout
 * that the detector reads unambiguously (the same shape as the canonical case).
 * Decision cells live in column B; profit coefficients as literals in the
 * objective formula; constraints as explicit weighted sums of the B cells.
 *
 * To avoid the single-variable detection ambiguity (where a 1-var range gets
 * read as two columns), every model uses at least two decision rows; callers
 * with one "real" variable add a dummy with profit 0 and a 0-coefficient
 * everywhere, which cannot affect the optimum.
 *
 * Layout:
 *   row1: header
 *   var rows: [name, 0, , , , ]      (decision cell in column B)
 *   objective: [Total,, , =p0*B2 + p1*B3 + ..., , ]
 *   constraint rows: [label,,, =c0*B2 + c1*B3 + ..., rel, limit]
 */
function buildMax(vars, consts) {
  const grid = [['Item', 'Units', 'x', 'Total', 'Rel', 'Limit']];
  const n = vars.length;
  const firstVarRow = 2;
  vars.forEach((v, i) => {
    grid.push([v.name, '0', '', '', '', '']);
  });
  grid.push(['', '', '', '', '', '']);
  const objTerms = vars.map((v, i) => v.profit + '*B' + (firstVarRow + i)).join('+');
  grid.push(['Total', '', '', '=' + objTerms, '', '']);
  consts.forEach(c => {
    const terms = c.coefs.map((co, i) => co + '*B' + (firstVarRow + i)).join('+');
    grid.push([c.label || 'C', '', '', '=' + terms, c.rel, String(c.limit)]);
  });
  return grid;
}

console.log('Running Plumline engine test suite against the CURRENT engine...\n');

/* ---------------------------------------------------------------- */
/* 1. Canonical production (known optimum 1760)                       */
/* ---------------------------------------------------------------- */
{
  const grid = [
    ['Product', 'Units', 'Profit', 'Total', 'Hours', ''],
    ['A', '0', '30', '=B2*C2', '2', ''],
    ['B', '0', '20', '=B3*C3', '1', ''],
    ['C', '0', '48', '=B4*C4', '3', ''],
    ['', '', '', '', '', ''],
    ['Total', '', '', '=SUM(D2:D4)', '', ''],
    ['Hours', '', '', '=SUMPRODUCT(B2:B4,E2:E4)', '<=', '100'],
    ['UpperB', '', '', '=B3', '<=', '40']
  ];
  const r = run(grid);
  check('01 canonical production status optimal', !r.error && r.out.status === 'optimal', r.error || r.out.status);
  check('01 canonical production = 1760', !r.error && r.out.objective === 1760, r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 2. Simple 2-var max with two <= limits                            */
/* max 3a+2b  s.t.  a+b<=4 ; a<=2  -> a=2,b=2 -> 10                    */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }],
    [{ coefs: [1, 1], rel: '<=', limit: 4, label: 'sum' },
     { coefs: [1, 0], rel: '<=', limit: 2, label: 'acap' }]
  );
  const r = run(grid);
  check('02 two-var max status', !r.error && r.out.status === 'optimal', r.error || (r.out && r.out.status));
  check('02 two-var max = 10', !r.error && approx(r.out.objective, 10), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 3. Binding >= constraint (minimisation-style via max of negative)  */
/* We test >= handling: max b s.t. a+b<=10 ; a>=3 ; b<=10             */
/* -> a=3 not forced up; b can be 7 (a>=3 uses 3) -> b=7              */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 0 }, { name: 'B', profit: 1 }],
    [{ coefs: [1, 1], rel: '<=', limit: 10, label: 'cap' },
     { coefs: [1, 0], rel: '>=', limit: 3, label: 'amin' }]
  );
  const r = run(grid);
  check('03 >= constraint status', !r.error && (r.out.status === 'optimal' || r.out.status === 'feasible'), r.error || (r.out && r.out.status));
  check('03 >= constraint b<=7', !r.error && r.out.objective <= 7 + 1e-6, r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 4. Equality constraint: max a s.t. a+b=5 ; b>=2 -> a=3             */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'B', profit: 0 }],
    [{ coefs: [1, 1], rel: '=', limit: 5, label: 'eq' },
     { coefs: [0, 1], rel: '>=', limit: 2, label: 'bmin' }]
  );
  const r = run(grid);
  check('04 equality status', !r.error && (r.out.status === 'optimal' || r.out.status === 'feasible'), r.error || (r.out && r.out.status));
  check('04 equality a=3', !r.error && approx(r.out.objective, 3), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 5. Unbounded: max a s.t. a>=1 (no upper bound) -> unbounded        */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'Dummy', profit: 0 }],
    [{ coefs: [1, 0], rel: '>=', limit: 1, label: 'amin' },
     { coefs: [0, 1], rel: '<=', limit: 5, label: 'dcap' }]
  );
  const r = run(grid);
  check('05 unbounded detected', !r.error && (r.out.status === 'unbounded'),
    r.error || ('status=' + (r.out && r.out.status) + ' obj=' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 6. Infeasible: max a s.t. a<=1 ; a>=3 -> infeasible                */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'Dummy', profit: 0 }],
    [{ coefs: [1, 0], rel: '<=', limit: 1, label: 'cap' },
     { coefs: [1, 0], rel: '>=', limit: 3, label: 'amin' },
     { coefs: [0, 1], rel: '<=', limit: 5, label: 'dcap' }]
  );
  const r = run(grid);
  check('06 infeasible detected', !r.error && r.out.status === 'infeasible',
    r.error || ('status=' + (r.out && r.out.status)));
}

/* ---------------------------------------------------------------- */
/* 7. Integer: max 5a+4b s.t. 6a+4b<=24 ; a+2b<=6 (LP opt fractional) */
/* LP opt is a=3,b=1.5 -> 21; integer opt is a=3,b=1 -> 19 or a=4?    */
/* 6a<=24 -> a<=4; a=4 -> 24 used, b=0 -> 20. a=3,b=1 ->19. So 20.    */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 5 }, { name: 'B', profit: 4 }],
    [{ coefs: [6, 4], rel: '<=', limit: 24, label: 'r1' },
     { coefs: [1, 2], rel: '<=', limit: 6, label: 'r2' }]
  );
  const rLP = run(grid);
  check('07 LP relaxation = 21', !rLP.error && approx(rLP.out.objective, 21), rLP.error || ('got ' + (rLP.out && rLP.out.objective)));
  const rINT = run(grid, { integer: true });
  check('07 integer status', !rINT.error && (rINT.out.status === 'optimal' || rINT.out.status === 'feasible'), rINT.error || (rINT.out && rINT.out.status));
  check('07 integer = 20', !rINT.error && approx(rINT.out.objective, 20), rINT.error || ('got ' + (rINT.out && rINT.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 8. Integer infeasible: a<=1.5 style with equality forcing 0.5      */
/* max a s.t. 2a=3 (a=1.5) integer -> infeasible                      */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'Dummy', profit: 0 }],
    [{ coefs: [2, 0], rel: '=', limit: 3, label: 'eq' },
     { coefs: [0, 1], rel: '<=', limit: 5, label: 'dcap' }]
  );
  const rLP = run(grid);
  check('08 LP a=1.5', !rLP.error && approx(rLP.out.objective, 1.5), rLP.error || ('got ' + (rLP.out && rLP.out.objective)));
  const rINT = run(grid, { integer: true });
  check('08 integer infeasible', !rINT.error && rINT.out.status === 'infeasible',
    rINT.error || ('status=' + (rINT.out && rINT.out.status) + ' obj=' + (rINT.out && rINT.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 9. Degenerate: max a+b s.t. a<=2 ; b<=2 ; a+b<=4 (redundant tie)   */
/* -> 4                                                               */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }],
    [{ coefs: [1, 0], rel: '<=', limit: 2, label: 'a' },
     { coefs: [0, 1], rel: '<=', limit: 2, label: 'b' },
     { coefs: [1, 1], rel: '<=', limit: 4, label: 'sum' }]
  );
  const r = run(grid);
  check('09 degenerate = 4', !r.error && approx(r.out.objective, 4), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 10. Redundant constraint: max a s.t. a<=5 ; a<=10 -> 5             */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'Dummy', profit: 0 }],
    [{ coefs: [1, 0], rel: '<=', limit: 5, label: 'tight' },
     { coefs: [1, 0], rel: '<=', limit: 10, label: 'loose' },
     { coefs: [0, 1], rel: '<=', limit: 5, label: 'dcap' }]
  );
  const r = run(grid);
  check('10 redundant = 5', !r.error && approx(r.out.objective, 5), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 11. Large & small coefficients: max 1000a+0.001b                   */
/* s.t. a<=3 ; b<=1000 -> 3000 + 1 = 3001                             */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1000 }, { name: 'B', profit: 0.001 }],
    [{ coefs: [1, 0], rel: '<=', limit: 3, label: 'a' },
     { coefs: [0, 1], rel: '<=', limit: 1000, label: 'b' }]
  );
  const r = run(grid);
  check('11 scale = 3001', !r.error && approx(r.out.objective, 3001, 1e-3), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 12. Zero solution: max a s.t. a<=0 -> 0                            */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'Dummy', profit: 0 }],
    [{ coefs: [1, 0], rel: '<=', limit: 0, label: 'zero' },
     { coefs: [0, 1], rel: '<=', limit: 5, label: 'dcap' }]
  );
  const r = run(grid);
  check('12 zero optimum', !r.error && approx(r.out.objective, 0) && (r.out.status === 'optimal' || r.out.status === 'feasible'),
    r.error || ('status=' + (r.out && r.out.status) + ' obj=' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 13. Knapsack: max 8a+11b+6c+4d s.t. 5a+7b+4c+3d<=14               */
/* enumeration-verified integer optimum: 22 at (0,2,0,0)             */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 8 }, { name: 'B', profit: 11 }, { name: 'C', profit: 6 }, { name: 'D', profit: 4 }],
    [{ coefs: [5, 7, 4, 3], rel: '<=', limit: 14, label: 'weight' }]
  );
  const r = run(grid, { integer: true });
  check('13 knapsack integer status', !r.error && (r.out.status === 'optimal' || r.out.status === 'feasible'), r.error || (r.out && r.out.status));
  check('13 knapsack = 22', !r.error && approx(r.out.objective, 22), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 14. Integer where LP optimum is already integer: max 3a+2b        */
/* s.t. a+b<=4 ; a<=2 -> 10 at (2,2)                                  */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }],
    [{ coefs: [1, 1], rel: '<=', limit: 4, label: 'sum' },
     { coefs: [1, 0], rel: '<=', limit: 2, label: 'acap' }]
  );
  const r = run(grid, { integer: true });
  check('14 integer = 10', !r.error && approx(r.out.objective, 10), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 15. Rounding trap: max 7a+2b s.t. 4a+2b<=9 -> 14 at (2,0)          */
/* LP optimum a=2.25 -> rounding down gives a=2. This one should be   */
/* easy; included to contrast with case 07.                          */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 7 }, { name: 'B', profit: 2 }],
    [{ coefs: [4, 2], rel: '<=', limit: 9, label: 'r' }]
  );
  const r = run(grid, { integer: true });
  check('15 integer = 14', !r.error && approx(r.out.objective, 14), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 16. Case 07 again as an explicit "must round UP" trap             */
/* max 5a+4b s.t. 6a+4b<=24 ; a+2b<=6 -> 20 at (4,0)                  */
/* LP optimum (3,1.5); rounding b down to 1 gives 19 (suboptimal).    */
/* The optimum requires exploring the a=4 branch.                    */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 5 }, { name: 'B', profit: 4 }],
    [{ coefs: [6, 4], rel: '<=', limit: 24, label: 'r1' },
     { coefs: [1, 2], rel: '<=', limit: 6, label: 'r2' }]
  );
  const r = run(grid, { integer: true });
  check('16 round-up trap = 20', !r.error && approx(r.out.objective, 20), r.error || ('got ' + (r.out && r.out.objective)));
}

/* ---------------------------------------------------------------- */
/* 17. Matching: max a+b+c s.t. a+b<=1 ; b+c<=1 ; a+c<=1 -> 1         */
/* ---------------------------------------------------------------- */
{
  const grid = buildMax(
    [{ name: 'A', profit: 1 }, { name: 'B', profit: 1 }, { name: 'C', profit: 1 }],
    [{ coefs: [1, 1, 0], rel: '<=', limit: 1, label: 'ab' },
     { coefs: [0, 1, 1], rel: '<=', limit: 1, label: 'bc' },
     { coefs: [1, 0, 1], rel: '<=', limit: 1, label: 'ac' }]
  );
  const r = run(grid, { integer: true });
  check('17 matching = 1', !r.error && approx(r.out.objective, 1), r.error || ('got ' + (r.out && r.out.objective)));
}

process.exit(report() ? 0 : 1);
