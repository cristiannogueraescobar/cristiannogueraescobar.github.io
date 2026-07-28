/**
 * tests_bounds.js — per-variable bounds and domains, tested at the optimise_
 * level (isolating the maths from grid detection).
 *
 * Written BEFORE implementation: these define the intended behaviour. With the
 * current engine, the bounds/domain cases fail (no support yet); after the
 * change they must all pass, and the existing behaviour (no bounds) must be
 * unchanged.
 *
 * Model shape passed to optimise_:
 *   { maximize, objective:[...], constant, constraints:[{coefficients,relation,rhs}],
 *     integer: true | [indices],
 *     bounds: [{lower,upper}, ...]   // optional, per variable
 *   }
 *
 * Run: node engine/tests_bounds.js
 */
const path = require('path');
// Load a fresh copy of the engine (UMD exposes optimise_).
const ENG = require('./engine.js');
const optimise_ = ENG.optimise_ || (typeof global !== 'undefined' && global.optimise_);

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL:', name, detail || ''); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-6); }

// --- Baseline: no bounds, must behave exactly as before -------------------
// maximise 3x + 2y  s.t.  x + y <= 4
// Unbounded-above vars default to x,y >= 0. Optimum: all weight on x -> x=4,y=0 => 12
(function () {
  var r = optimise_({
    maximize: true, objective: [3, 2], constant: 0,
    constraints: [{ coefficients: [1, 1], relation: '<=', rhs: 4 }],
  });
  ok('baseline no bounds', r.status === 'optimal' && approx(r.objective, 12), r.status + '/' + r.objective);
})();

// --- Upper bound on a variable --------------------------------------------
// maximise 3x + 2y  s.t. x + y <= 4,  x <= 2
// Now x capped at 2 -> x=2 (6), remaining y=2 (4) => 10
(function () {
  var r = optimise_({
    maximize: true, objective: [3, 2], constant: 0,
    constraints: [{ coefficients: [1, 1], relation: '<=', rhs: 4 }],
    bounds: [{ lower: 0, upper: 2 }, { lower: 0, upper: null }],
  });
  ok('upper bound caps a variable', r.status === 'optimal' && approx(r.objective, 10),
     r.status + '/' + r.objective + ' x=' + (r.values && r.values[0]));
})();

// --- Lower bound (positive) -----------------------------------------------
// minimise x + y  s.t. x + y >= 3,  with y >= 2
// Optimum: y=2, x=1 => 3 (feasible), or y=2,x=1. Objective 3.
(function () {
  var r = optimise_({
    maximize: false, objective: [1, 1], constant: 0,
    constraints: [{ coefficients: [1, 1], relation: '>=', rhs: 3 }],
    bounds: [{ lower: 0, upper: null }, { lower: 2, upper: null }],
  });
  ok('positive lower bound respected', r.status === 'optimal' && approx(r.objective, 3) && r.values[1] >= 2 - 1e-6,
     r.status + '/' + r.objective + ' y=' + (r.values && r.values[1]));
})();

// --- Incompatible bounds => infeasible ------------------------------------
// x with lower 5, upper 2 -> impossible
(function () {
  var r = optimise_({
    maximize: true, objective: [1, 0], constant: 0,
    constraints: [{ coefficients: [1, 1], relation: '<=', rhs: 10 }],
    bounds: [{ lower: 5, upper: 2 }, { lower: 0, upper: null }],
  });
  ok('incompatible bounds are infeasible', r.status === 'infeasible', r.status);
})();

// --- Strict binary 0/1 (integer + [0,1]) ----------------------------------
// maximise 5a + 4b + 3c  s.t. a+b+c <= 2, all binary => pick two best: a,b => 9
(function () {
  var r = optimise_({
    maximize: true, objective: [5, 4, 3], constant: 0,
    constraints: [{ coefficients: [1, 1, 1], relation: '<=', rhs: 2 }],
    integer: [0, 1, 2],
    bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }, { lower: 0, upper: 1 }],
  });
  var allBinary = r.values && r.values.every(function (v) { return approx(v, 0) || approx(v, 1); });
  ok('strict binary picks best two', r.status === 'optimal' && approx(r.objective, 9) && allBinary,
     r.status + '/' + r.objective + ' vals=' + JSON.stringify(r.values));
})();

// --- Mixed: continuous + integer + binary ---------------------------------
// maximise 2x + 3y + 10z
//   x continuous [0,inf), y integer [0,inf), z binary [0,1]
//   s.t. x + y + 5z <= 8
// z=0: all budget to y (coef 3) -> y=8 => 24.  z=1: uses 5, leftover 3 -> y=3
//   => 10+9=19.  24 > 19, so the optimum is z=0, y=8 => 24 (y integer, z binary
//   both satisfied). Verifies mixed domains are honoured without forcing a
//   worse corner.
(function () {
  var r = optimise_({
    maximize: true, objective: [2, 3, 10], constant: 0,
    constraints: [{ coefficients: [1, 1, 5], relation: '<=', rhs: 8 }],
    integer: [1, 2],   // y and z are integer; z also bounded [0,1] => binary
    bounds: [{ lower: 0, upper: null }, { lower: 0, upper: null }, { lower: 0, upper: 1 }],
  });
  var zBinary = r.values && (approx(r.values[2], 0) || approx(r.values[2], 1));
  var yInteger = r.values && approx(r.values[1], Math.round(r.values[1]));
  ok('mixed continuous/integer/binary', r.status === 'optimal' && approx(r.objective, 24) && zBinary && yInteger,
     r.status + '/' + r.objective + ' vals=' + JSON.stringify(r.values));
})();

// --- Relaxation proposes fractional in [0,1], integer forces a corner ------
// maximise x  s.t. 2x <= 1  (relaxation x=0.5), x binary => x must be 0 => 0
(function () {
  var r = optimise_({
    maximize: true, objective: [1, 0], constant: 0,
    constraints: [{ coefficients: [2, 0], relation: '<=', rhs: 1 }],
    integer: [0],
    bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: null }],
  });
  ok('binary forces corner from fractional relaxation', r.status === 'optimal' && approx(r.values[0], 0),
     r.status + '/' + r.objective + ' x=' + (r.values && r.values[0]));
})();

// --- Compatibility: integer:true still means ALL integer ------------------
// maximise 3x+2y s.t. 2x+2y<=5, all integer => x=2,y=0 =>6 (since 2*2=4<=5)
(function () {
  var r = optimise_({
    maximize: true, objective: [3, 2], constant: 0,
    constraints: [{ coefficients: [2, 2], relation: '<=', rhs: 5 }],
    integer: true,
  });
  ok('integer:true unchanged', r.status === 'optimal' && approx(r.objective, 6), r.status + '/' + r.objective);
})();


// --- Sensitivity probe must include bounds (shadow price correctness) -----
// maximise 3x + 2y  s.t. x + y <= 4 (C1),  x <= 2 (bound on x).
// Optimum x=2,y=2 => 10, C1 binding. Relaxing C1 by 1 with the bound still
// active gives x=2,y=3 => 12, so the true shadow price of C1 is 2. Without the
// bound in the probe it would wrongly compute 5 (x=5,y=0 => 15).
(function () {
  const solveModelLike = function (rhs) {
    return optimise_({
      maximize: true, objective: [3, 2], constant: 0,
      constraints: [{ coefficients: [1, 1], relation: '<=', rhs: rhs }],
      bounds: [{ lower: 0, upper: 2 }, { lower: 0, upper: null }],
    });
  };
  var base = solveModelLike(4);
  var probe = solveModelLike(5);
  var shadow = probe.objective - base.objective;
  ok('shadow price honours bounds (=2 not 5)', approx(base.objective, 10) && approx(shadow, 2),
     'base=' + base.objective + ' shadow=' + shadow);
})();

function round6(x){return Math.round(x*1e6)/1e6;}

// --- Sensitivity sign: minimisation + '>=' constraint ---------------------
// minimise x + y  s.t. x + y >= 10 (C1, a floor). Optimum: x+y=10 => cost 10.
// Relaxing the FLOOR by one unit means x+y >= 9, so the RHS change is -1 and
// the new optimum is 9 => the objective DROPS by 1 (a cost improvement). The
// signed delta must be negative here; describing it as "raises the result"
// would be wrong. We check the probe direction and signed delta.
(function () {
  function solveFloor(rhs) {
    return optimise_({
      maximize: false, objective: [1, 1], constant: 0,
      constraints: [{ coefficients: [1, 1], relation: '>=', rhs: rhs }],
    });
  }
  var base = solveFloor(10);
  var probe = solveFloor(9);   // '>=' loosens by lowering the floor (rhsChange -1)
  var delta = round6(probe.objective - base.objective);
  ok('min + >= : relaxing floor lowers cost (delta -1)', approx(base.objective, 10) && approx(delta, -1),
     'base=' + base.objective + ' delta=' + delta);
  // The improvement MAGNITUDE (what the UI shows) is 1, and it is an
  // improvement (cost went down), so |delta| = 1 is the right number to show.
  ok('improvement magnitude is 1', approx(Math.abs(delta), 1));
})();

// --- Sensitivity sign: maximisation + '<=' (classic) ----------------------
// maximise 3x + 2y s.t. x + y <= 4. Relaxing cap to 5 raises objective by 3.
(function () {
  function solveCap(rhs) {
    return optimise_({ maximize: true, objective: [3, 2], constant: 0,
      constraints: [{ coefficients: [1, 1], relation: '<=', rhs: rhs }] });
  }
  var base = solveCap(4), probe = solveCap(5);
  var delta = round6(probe.objective - base.objective);
  ok('max + <= : relaxing cap raises objective (delta +3)', approx(delta, 3), 'delta=' + delta);
})();

console.log('BOUNDS TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
