/* GENERATED FILE — DO NOT EDIT MANUALLY.
 * Canonical source: engine/source/plumline-engine.js
 * Regenerate with: npm run generate:engine-mirror
 * This mirror is a deterministic derivation of the canonical engine plus the
 * two approved platform adaptations (newContext_, readConstraint_) and the
 * Node/add-on wrapper. Edit the canonical source, not this file. */
/* === Plumline engine: the exact same code as the Google Sheets add-on === */
/**
 * Engine.gs — model extraction and optimisation
 * ---------------------------------------------
 * Validated on 2026-07-24 against real Google Sheets:
 *   - 200 variables and 50 constraints extracted in 1.58 s, 0 recalculations
 *   - 85% of a realistic formula battery usable; the rest genuinely non-linear
 *   - solutions verified against the value Sheets itself recalculates
 *
 * Nothing in this file talks to the user. It reads a grid, turns cells into
 * linear forms, and solves. Keep it that way.
 */

const ENGINE = {
  MAX_DEPTH: 40,
  BRANCH_NODES: 4000,
  BRANCH_DEPTH: 60,
  BRANCH_MILLIS: 20000,
  EPSILON: 1e-9,
  PIVOT_TOLERANCE: 1e-7,
  MAX_ITERATIONS: 20000,
};


/* ================================================================== */
/* Branch and bound — whole-number solutions                           */
/* ================================================================== */

/**
 * Entry point for the add-on. Solves the relaxation when every quantity may
 * be fractional, and branches when some of them must come out whole.
 */
function optimise_(model) {
  // Reject structurally invalid models before anything else: a shared engine
  // must defend itself. An unknown relation would otherwise slip through
  // feasibleAt_ without triggering any comparison.
  if (!validModelShape_(model)) {
    return { status: 'invalid_model', stopReason: 'invalid_model',
             optimalityProven: false, nodesExplored: 0, objective: null, values: null };
  }
  // Reject non-finite inputs up front: a NaN or Infinity anywhere in the model
  // would silently corrupt the simplex. Fail cleanly instead.
  if (!finiteModel_(model)) {
    return { status: 'numerical_failure', stopReason: 'numerical_failure',
             optimalityProven: false, nodesExplored: 0, objective: null, values: null };
  }
  // Per-variable bounds are translated into ordinary constraints here, so the
  // simplex core never has to know about them. A finite upper bound becomes
  // x_i <= upper; a positive lower bound becomes x_i >= lower (the simplex
  // already assumes x_i >= 0, so lower <= 0 needs nothing). Incompatible
  // bounds (lower > upper) are a proven dead end before we solve.
  model = applyBounds_(model);
  if (model.__infeasible) {
    return { status: 'infeasible', stopReason: null, optimalityProven: false,
             nodesExplored: 0, objective: null, values: null };
  }
  const wanted = integerIndices_(model);
  const solution = !wanted.length ? solveLinearProgram_(model) : solveIntegerProgram_(model, wanted);
  // Final numeric guard: never return an "optimal" whose numbers aren't finite.
  if ((solution.status === 'optimal' || solution.status === 'feasible') &&
      (!isFinite(solution.objective) || (solution.values || []).some(function (v) { return !isFinite(v); }))) {
    return { status: 'numerical_failure', stopReason: 'numerical_failure',
             optimalityProven: false, nodesExplored: solution.nodesExplored || 0,
             objective: null, values: null };
  }
  // Defensive final feasibility check against the FULL applied model (bounds
  // folded in). This covers every variable's non-negativity — including plain
  // continuous ones with no receipt entry — plus all constraints.
  if (solution.status === 'optimal' || solution.status === 'feasible') {
    if (!feasibleAt_(model, model.constraints || [], solution.values || [])) {
      return numericalFailure_(solution.nodesExplored);
    }
    for (let i = 0; i < wanted.length; i++) {
      const v = solution.values[wanted[i]];
      if (Math.abs(v - Math.round(v)) > 1e-6) return numericalFailure_(solution.nodesExplored);
    }
    const recomputed = dotProduct_(model.objective, solution.values) + (model.constant || 0);
    if (!isFinite(recomputed) || Math.abs(recomputed - solution.objective) > 1e-6) {
      return numericalFailure_(solution.nodesExplored);
    }
  }
  return solution;
}

function numericalFailure_(nodes) {
  return { status: 'numerical_failure', stopReason: 'numerical_failure',
           optimalityProven: false, nodesExplored: nodes || 0,
           objective: null, values: null };
}

function validModelShape_(model) {
  if (!model || !Array.isArray(model.objective)) return false;
  const n = model.objective.length;
  if (n < 1) return false;
  if (typeof model.maximize !== 'boolean') return false;
  if (!Array.isArray(model.constraints)) return false;
  for (let i = 0; i < n; i++) {
    if (!(i in model.objective)) return false;
    if (typeof model.objective[i] !== 'number') return false;
  }
  if (model.constant != null && typeof model.constant !== 'number') return false;
  for (let k = 0; k < model.constraints.length; k++) {
    const c = model.constraints[k];
    if (!c) return false;
    if (!Array.isArray(c.coefficients)) return false;
    if (c.coefficients.length !== n) return false;
    for (let i = 0; i < n; i++) {
      if (!(i in c.coefficients)) return false;
      if (typeof c.coefficients[i] !== 'number') return false;
    }
    if (typeof c.rhs !== 'number') return false;
    if (c.relation !== '<=' && c.relation !== '>=' && c.relation !== '=') return false;
  }
  if (model.integer != null && model.integer !== false && model.integer !== true &&
      !Array.isArray(model.integer)) return false;
  if (Array.isArray(model.integer)) {
    const seen = {};
    for (let i = 0; i < model.integer.length; i++) {
      const idx = model.integer[i];
      if (!Number.isInteger(idx) || idx < 0 || idx >= n) return false;
      if (seen[idx]) return false;
      seen[idx] = true;
    }
  }
  if (model.bounds != null && !Array.isArray(model.bounds)) return false;
  const bounds = model.bounds || [];
  if (bounds.length > n) return false;
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    if (b == null) continue;
    if (typeof b !== 'object' || Array.isArray(b)) return false;
    if (b.lower != null && typeof b.lower !== 'number') return false;
    if (b.upper != null && typeof b.upper !== 'number') return false;
    if (b.lower != null && b.lower < 0) return false;
  }
  return true;
}
// Every objective coefficient, constant, constraint coefficient, rhs, and bound
// must be a finite number. Uses Number.isFinite (no coercion).
function finiteModel_(model) {
  if (!model || !model.objective) return false;
  if ((model.objective || []).some(function (c) { return !Number.isFinite(c); })) return false;
  if (model.constant != null && !Number.isFinite(model.constant)) return false;
  const cons = model.constraints || [];
  for (let i = 0; i < cons.length; i++) {
    if (!Number.isFinite(cons[i].rhs)) return false;
    if ((cons[i].coefficients || []).some(function (c) { return !Number.isFinite(c); })) return false;
  }
  const bounds = model.bounds || [];
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i]; if (!b) continue;
    if (b.lower != null && !Number.isFinite(b.lower)) return false;
    if (b.upper != null && !Number.isFinite(b.upper)) return false;
  }
  return true;
}

// Translate model.bounds into extra constraints. Returns a shallow copy with
// the bounds folded in; leaves the input untouched. Sets __infeasible when a
// variable's lower bound exceeds its upper bound.
function applyBounds_(model) {
  const bounds = model.bounds;
  if (!bounds || !bounds.length) return model;
  const n = model.objective.length;
  const extra = [];
  for (let i = 0; i < n; i++) {
    const b = bounds[i];
    if (!b) continue;
    const lower = (typeof b.lower === 'number') ? b.lower : 0;
    const upper = (typeof b.upper === 'number') ? b.upper : null;
    if (upper !== null && lower > upper + 1e-9) {
      return Object.assign({}, model, { __infeasible: true });
    }
    if (upper !== null) {
      const unit = [];
      for (let j = 0; j < n; j++) unit.push(j === i ? 1 : 0);
      extra.push({ coefficients: unit, relation: '<=', rhs: upper });
    }
    if (lower > 1e-9) {
      const unit = [];
      for (let j = 0; j < n; j++) unit.push(j === i ? 1 : 0);
      extra.push({ coefficients: unit, relation: '>=', rhs: lower });
    }
  }
  if (!extra.length) return model;
  return Object.assign({}, model, {
    constraints: (model.constraints || []).concat(extra),
  });
}

// Classify a model for display: 'continuous', 'integer', 'binary', or 'mixed'.
// Uses the per-variable domains when present, else the global whole-numbers flag.
function classifyModel_(domains, wholeToggle, n) {
  if (!domains) return wholeToggle ? 'integer' : 'continuous';
  const bounds = domains.bounds || [];
  const intSpec = domains.integer;
  const isIntIndex = {};
  if (intSpec === true) { for (let i = 0; i < n; i++) isIntIndex[i] = true; }
  else if (Array.isArray(intSpec)) { intSpec.forEach(function (i) { isIntIndex[i] = true; }); }
  let hasCont = false, hasInt = false, hasBinary = false, allBinary = true;
  for (let i = 0; i < n; i++) {
    const isInt = !!isIntIndex[i];
    const b = bounds[i] || {};
    const isBin = isInt && b.lower === 0 && b.upper === 1;
    if (!isInt) { hasCont = true; allBinary = false; }
    else if (isBin) { hasBinary = true; }
    else { hasInt = true; allBinary = false; }
  }
  if (!hasInt && !hasBinary) return 'continuous';
  if (allBinary && hasBinary) return 'binary';
  if (hasCont) return 'mixed';
  if (hasBinary && hasInt) return 'mixed';
  return 'integer';
}

// Build a per-variable domain report for the receipt. Lists only variables
// whose domain differs from the default (continuous, 0..inf) or whose type was
// set explicitly, so untouched models report nothing. Each entry records the
// resulting value and whether its limits are satisfied and binding.
function buildVariableDomains_(domains, wholeToggle, variables, labels, values, modelType) {
  if (!domains && !wholeToggle) return [];
  const n = variables.length;
  const bounds = (domains && domains.bounds) || [];
  const intSpec = domains ? domains.integer : (wholeToggle ? true : false);
  const isIntIndex = {};
  if (intSpec === true) { for (let i = 0; i < n; i++) isIntIndex[i] = true; }
  else if (Array.isArray(intSpec)) { intSpec.forEach(function (i) { isIntIndex[i] = true; }); }
  const out = [];
  for (let i = 0; i < n; i++) {
    const b = bounds[i] || {};
    const lower = (typeof b.lower === 'number') ? b.lower : 0;
    const upper = (typeof b.upper === 'number') ? b.upper : null;
    const isInt = !!isIntIndex[i];
    const isBinary = isInt && lower === 0 && upper === 1;
    let type = 'continuous';
    if (isBinary) type = 'binary'; else if (isInt) type = 'integer';
    // Skip variables at the plain default (continuous, no bounds) to keep the
    // report focused on what the user actually set.
    const isDefault = (type === 'continuous' && lower === 0 && upper === null);
    if (isDefault) continue;
    const value = round_(values[i]);
    const lowerOk = value >= lower - 1e-6;
    const upperOk = (upper === null) || (value <= upper + 1e-6);
    // Verify the type too: an integer variable must be whole, a binary must be
    // exactly 0 or 1. Without this, a binary reported as 0.5 would sit inside
    // [0,1] and wrongly pass, and the final aggregate check would trust it.
    const integerOk = !isInt || (Math.abs(value - Math.round(value)) < 1e-6);
    const binaryOk = !isBinary || (Math.abs(value) < 1e-6 || Math.abs(value - 1) < 1e-6);
    out.push({
      cell: variables[i],
      label: (labels && labels[i]) || variables[i],
      type: type,
      min: lower,
      max: upper,
      value: value,
      satisfied: lowerOk && upperOk && integerOk && binaryOk,
      integralitySatisfied: integerOk,
      binarySatisfied: binaryOk,
      lowerBinding: Math.abs(value - lower) < 1e-6,
      upperBinding: (upper !== null) && Math.abs(value - upper) < 1e-6,
    });
  }
  return out;
}

function integerIndices_(model) {
  if (!model.integer) return [];
  if (model.integer === true) {
    const all = [];
    for (let i = 0; i < model.objective.length; i++) all.push(i);
    return all;
  }
  return model.integer;
}

function isWhole_(value) {
  return Math.abs(value - Math.round(value)) < 1e-6;
}

/**
 * Depth-first branch and bound. Each branch adds one bound on the variable
 * that came back fractional and re-solves.
 *
 * The search is bounded by node count, depth and elapsed time. When a limit
 * stops it while a whole-number solution has already been found, the result
 * is returned with status "feasible" rather than "optimal": the answer is
 * valid and satisfies every constraint, but it has not been proven best.
 * Saying so is the point — a solver that cannot tell the difference is how
 * users end up trusting a number they should not.
 */
function dotProduct_(coeffs, values) {
  let s = 0;
  for (let i = 0; i < coeffs.length; i++) s += (coeffs[i] || 0) * (values[i] || 0);
  return s;
}
function feasibleAt_(model, constraints, values) {
  const TOL = 1e-6;
  if (!Array.isArray(values)) return false;
  if (model && model.objective && values.length !== model.objective.length) return false;
  for (let i = 0; i < values.length; i++) {
    if (!isFinite(values[i])) return false;   // NaN / Infinity is never feasible
    if (values[i] < -TOL) return false;        // variables are non-negative
  }
  for (let k = 0; k < constraints.length; k++) {
    const c = constraints[k];
    const lhs = dotProduct_(c.coefficients, values);
    if (!isFinite(lhs)) return false;   // Infinity - Infinity = NaN would pass by accident
    if (c.relation === '<=' && lhs > c.rhs + TOL) return false;
    if (c.relation === '>=' && lhs < c.rhs - TOL) return false;
    if (c.relation === '=' && Math.abs(lhs - c.rhs) > TOL) return false;
  }
  return true;
}
function solveIntegerProgram_(model, wanted) {
  const deadline = Date.now() + ENGINE.BRANCH_MILLIS;
  let best = null;
  let nodes = 0;
  let exhausted = true;
  let stopReason = null;   // why the search became incomplete, if it did

  function explore(extra, depth) {
    if (nodes++ > ENGINE.BRANCH_NODES) { exhausted = false; if (!stopReason) stopReason = 'node_limit'; return; }
    if (depth > ENGINE.BRANCH_DEPTH)      { exhausted = false; if (!stopReason) stopReason = 'node_limit'; return; }
    if (Date.now() > deadline)            { exhausted = false; if (!stopReason) stopReason = 'time_limit'; return; }

    const relaxed = solveLinearProgram_({
      maximize: model.maximize,
      objective: model.objective,
      constant: model.constant,
      constraints: model.constraints.concat(extra),
    });
    if (relaxed.status !== 'optimal') {
      // 'infeasible' is a proven dead end: abandoning it keeps the search
      // complete. Anything else (iteration_limit, unbounded, numerical_failure)
      // means this branch could not be resolved, so the overall search is no
      // longer exhaustive and we must not later claim proven infeasibility.
      if (relaxed.status !== 'infeasible') {
        exhausted = false;
        if (!stopReason) stopReason = relaxed.status;
      }
      return;
    }

    if (best) {
      const better = model.maximize
        ? relaxed.objective > best.objective + 1e-9
        : relaxed.objective < best.objective - 1e-9;
      if (!better) return;   // this branch cannot beat what we hold
    }

    let fractional = -1;
    for (let i = 0; i < wanted.length; i++) {
      if (!isWhole_(relaxed.values[wanted[i]])) { fractional = wanted[i]; break; }
    }

    if (fractional === -1) {
      // Snap the integer variables to exact integers, recompute the objective
      // from the snapped point, and re-check every constraint. Only accept it
      // if the exact-integer point is still feasible.
      const snapped = relaxed.values.map(function (v) { return Math.round(v * 1e9) / 1e9; });
      wanted.forEach(function (idx) { snapped[idx] = Math.round(snapped[idx]); });
      if (!feasibleAt_(model, model.constraints.concat(extra), snapped)) {
        exhausted = false;
        if (!stopReason) stopReason = 'numerical_failure';
        return;
      }
      const snappedObjective = round_(dotProduct_(model.objective, snapped) + (model.constant || 0));
      // Only accept if the EXACT-integer objective actually improves on the
      // incumbent. Rounding within tolerance can make the snapped point slightly
      // worse, so re-compare here or we could replace a better solution.
      const improves = !best || (model.maximize
        ? snappedObjective > best.objective + ENGINE.EPSILON
        : snappedObjective < best.objective - ENGINE.EPSILON);
      if (improves) best = { objective: snappedObjective, values: snapped };
      return;
    }

    const value = relaxed.values[fractional];
    const unit = [];
    for (let i = 0; i < model.objective.length; i++) unit.push(i === fractional ? 1 : 0);

    // Ceiling side first: on a maximisation it tends to hold the better
    // solutions, so an incumbent appears sooner and prunes more of the tree.
    explore(extra.concat([{ coefficients: unit, relation: '>=', rhs: Math.ceil(value) }]),
      depth + 1);
    explore(extra.concat([{ coefficients: unit, relation: '<=', rhs: Math.floor(value) }]),
      depth + 1);
  }

  explore([], 0);

  if (!best) {
    // No integer solution found. Only call it infeasible if we truly explored
    // the whole tree; otherwise we simply do not know.
    if (exhausted) {
      return { status: 'infeasible', stopReason: null, optimalityProven: false,
               nodesExplored: nodes, objective: null, values: null };
    }
    return { status: 'unknown', stopReason: stopReason || 'iteration_limit',
             optimalityProven: false, nodesExplored: nodes, objective: null, values: null };
  }
  return {
    status: exhausted ? 'optimal' : 'feasible',
    stopReason: exhausted ? null : (stopReason || 'iteration_limit'),
    optimalityProven: !!exhausted,
    nodesExplored: nodes,
    values: best.values,
    objective: best.objective,
    nodes: nodes,
  };
}

/* ================================================================== */
/* Two-phase simplex                                                   */
/* ================================================================== */

function solveLinearProgram_(model) {
  const n = model.objective.length;
  const constraints = model.constraints.map(normalizeConstraint_);

  let extra = 0;
  let artificials = 0;
  constraints.forEach(function (c) {
    if (c.relation !== '=') extra++;
    if (c.relation !== '<=') artificials++;
  });
  const total = n + extra + artificials;

  const tableau = [];
  const basis = [];
  const isArtificial = [];
  for (let j = 0; j < total; j++) isArtificial.push(false);

  let extraColumn = n;
  let artificialColumn = n + extra;

  constraints.forEach(function (c) {
    const row = [];
    for (let j = 0; j <= total; j++) row.push(0);
    for (let j = 0; j < n; j++) row[j] = c.coefficients[j] || 0;
    row[total] = c.rhs;

    if (c.relation === '<=') {
      row[extraColumn] = 1;
      basis.push(extraColumn);
      extraColumn++;
    } else if (c.relation === '>=') {
      row[extraColumn] = -1;
      extraColumn++;
      row[artificialColumn] = 1;
      isArtificial[artificialColumn] = true;
      basis.push(artificialColumn);
      artificialColumn++;
    } else {
      row[artificialColumn] = 1;
      isArtificial[artificialColumn] = true;
      basis.push(artificialColumn);
      artificialColumn++;
    }
    tableau.push(row);
  });

  if (artificials > 0) {
    const phaseOneCost = [];
    for (let j = 0; j < total; j++) phaseOneCost.push(isArtificial[j] ? 1 : 0);
    const phaseOneStatus = iterate_(tableau, basis, phaseOneCost, total, null);
    // Phase 1 must end 'optimal'. Anything else means we don't know feasibility:
    // 'unbounded' shouldn't happen for the auxiliary problem, so treat it as a
    // numerical anomaly; the rest pass through.
    if (phaseOneStatus !== 'optimal') {
      return { status: phaseOneStatus === 'unbounded' ? 'numerical_failure' : phaseOneStatus };
    }

    let residual = 0;
    for (let i = 0; i < basis.length; i++) {
      if (isArtificial[basis[i]]) residual += tableau[i][total];
    }
    if (!isFinite(residual)) return { status: 'numerical_failure' };
    if (residual < -1e-6) return { status: 'numerical_failure' };
    if (residual > 1e-6) return { status: 'infeasible' };

    // Phase 1 can leave an artificial variable in the basis at value ~0
    // (a degenerate basis). If left there, phase 2 can pivot it back to a
    // positive value and violate the '>=' or '=' constraint it came from.
    // Drive each such artificial out of the basis now: pivot on any
    // non-artificial column with a non-zero entry in that row. If the whole
    // row is zero across non-artificial columns, the constraint is redundant
    // and the artificial can stay pinned at zero (phase 2 forbids it entering).
    for (let i = 0; i < basis.length; i++) {
      if (!isArtificial[basis[i]]) continue;
      let pivotCol = -1;
      for (let j = 0; j < total; j++) {
        if (isArtificial[j]) continue;
        if (Math.abs(tableau[i][j]) > ENGINE.EPSILON) { pivotCol = j; break; }
      }
      if (pivotCol !== -1) {
        if (!pivot_(tableau, i, pivotCol)) return { status: 'numerical_failure' };
        basis[i] = pivotCol;
      }
    }
  }

  const sign = model.maximize ? -1 : 1;
  const phaseTwoCost = [];
  for (let j = 0; j < total; j++) phaseTwoCost.push(0);
  for (let j = 0; j < n; j++) phaseTwoCost[j] = sign * (model.objective[j] || 0);

  const status = iterate_(tableau, basis, phaseTwoCost, total, isArtificial);
  if (status !== 'optimal') return { status: status };

  const values = [];
  for (let j = 0; j < n; j++) values.push(0);
  for (let i = 0; i < basis.length; i++) {
    if (basis[i] < n) values[basis[i]] = tableau[i][total];
  }

  let objective = model.constant || 0;
  for (let j = 0; j < n; j++) objective += (model.objective[j] || 0) * values[j];

  // A simplex optimum is a proven optimum for the continuous LP.
  return { status: 'optimal', values: values, objective: objective,
           optimalityProven: true, stopReason: null };
}

function normalizeConstraint_(c) {
  if (c.rhs >= 0) {
    return { coefficients: c.coefficients.slice(), relation: c.relation, rhs: c.rhs };
  }
  const flipped = { '<=': '>=', '>=': '<=', '=': '=' };
  return {
    coefficients: c.coefficients.map(function (v) { return -v; }),
    relation: flipped[c.relation],
    rhs: -c.rhs,
  };
}

function iterate_(tableau, basis, cost, total, forbidden) {
  for (let iteration = 0; iteration < ENGINE.MAX_ITERATIONS; iteration++) {
    let entering = -1;
    for (let j = 0; j < total; j++) {
      if (forbidden && forbidden[j]) continue;
      let reduced = cost[j];
      for (let i = 0; i < tableau.length; i++) {
        reduced -= cost[basis[i]] * tableau[i][j];
      }
      if (!isFinite(reduced)) return 'numerical_failure';
      if (reduced < -ENGINE.PIVOT_TOLERANCE) { entering = j; break; }
    }
    if (entering === -1) return 'optimal';

    let leaving = -1;
    let best = Infinity;
    for (let i = 0; i < tableau.length; i++) {
      const coefficient = tableau[i][entering];
      if (!isFinite(coefficient)) return 'numerical_failure';
      if (coefficient > ENGINE.EPSILON) {
        const ratio = tableau[i][total] / coefficient;
        if (!isFinite(ratio)) return 'numerical_failure';
        const tie = Math.abs(ratio - best) < ENGINE.EPSILON;
        if (ratio < best - ENGINE.EPSILON ||
            (tie && leaving !== -1 && basis[i] < basis[leaving])) {
          best = ratio;
          leaving = i;
        }
      }
    }
    if (leaving === -1) return 'unbounded';

    if (!pivot_(tableau, leaving, entering)) return 'numerical_failure';
    basis[leaving] = entering;
  }
  return 'iteration_limit';
}

function pivot_(tableau, row, column) {
  const pivotValue = tableau[row][column];
  // Guard the pivot value AND the result of every division and subtraction: a
  // tableau that starts finite can still overflow to +/-Infinity mid-pivot, and
  // Infinity - Infinity is NaN. Any non-finite result aborts the pivot.
  if (!isFinite(pivotValue) || Math.abs(pivotValue) <= ENGINE.EPSILON) return false;
  for (let j = 0; j < tableau[row].length; j++) {
    tableau[row][j] /= pivotValue;
    if (!isFinite(tableau[row][j])) return false;
  }
  for (let i = 0; i < tableau.length; i++) {
    if (i === row) continue;
    const factor = tableau[i][column];
    if (!isFinite(factor)) return false;
    if (Math.abs(factor) < ENGINE.EPSILON) continue;
    for (let j = 0; j < tableau[i].length; j++) {
      tableau[i][j] -= factor * tableau[row][j];
      if (!isFinite(tableau[i][j])) return false;
    }
  }
  return true;
}

/* ================================================================== */
/* Grid — the whole sheet read in one call                             */
/* ================================================================== */

// Classify a raw grid cell: is it a FORMULA, or a relation-operator VALUE?
// A formula starts with '=' — but so do the relation operators the grid uses
// in the operator column ('=', '==', '=<', '=>'), which are plain text VALUES,
// not formulas. Treating '=' as a formula turned an equality constraint into a
// formula cell with value 0, silently dropping the relation. This ONE helper is
// the single source of truth used by both the app (sheetFromGrid) and the tests
// so a test copy can never drift from the real converter again.
function isFormulaInput_(raw) {
  var text = String(raw).trim();
  if (text.charAt(0) !== '=') return false;
  var RELATION_TOKENS = {
    '=': true, '==': true, '<=': true, '>=': true,
    '=<': true, '=>': true, '\u2264': true, '\u2265': true, '<': true, '>': true
  };
  return !RELATION_TOKENS[text];
}

// The canonical TEXT to store for a formula cell: the trimmed form. Classifying
// on trimmed text but storing the raw (untrimmed) string left a leading space
// before '=', so the later `replace(/^=/, '')` could not strip it and the
// formula failed to tokenize. Storing the trimmed form keeps classification and
// canonicalisation consistent. Callers use it only when isFormulaInput_ is true.
function formulaCellText_(raw) {
  return String(raw).trim();
}

// Full cell conversion — the SINGLE source of truth for splitting a raw grid
// cell into {formula, value}, shared by the app (sheetFromGrid) and every test
// harness. Centralising the VALUE conversion too (not just the formula
// classification) stops the harness from drifting from the app on inputs like
// "01", "+3" or "3.0". A formula cell stores the trimmed formula and value 0;
// anything else stores '' as the formula and, as its value, the number when the
// raw string is cleanly numeric, else the raw text (operators, labels).
function classifyGridCell_(raw) {
  if (raw == null) return { formula: '', value: '' };
  var text = String(raw);
  if (isFormulaInput_(text)) return { formula: formulaCellText_(text), value: 0 };
  // A whitespace-only cell is EMPTY, not 0: Number('   ') and Number('\t') are
  // both 0, which would silently build a false "<= 0" limit from a blank the
  // user left after an operator. Trim before the emptiness test so spaces/tabs
  // become '' — but keep Number() on the untrimmed text so "01"/"+3"/"3.0"
  // still convert (Number ignores surrounding whitespace anyway).
  if (text.trim() === '') return { formula: '', value: '' };
  var n = Number(text);
  return { formula: '', value: (!isNaN(n)) ? n : text };
}

// Locale (decimal comma / semicolon separator) normalisation. A European sheet
// writes 1,5 and SUM(A;B); the tokenizer and Number() expect '.' decimals and
// ',' separators, so we detect the sheet locale once and normalise formulas and
// values into canonical form. Only European and US are supported (no thousands
// grouping). localeMode may force 'eu'/'us'; default is 'auto'.
//
// SCOPE / KNOWN LIMITS (by design): auto-detect needs a signal (';' or a
// decimal-comma value); a lone "=1,5*B2" stays US under auto and needs the
// manual EU selector. Value detection accepts 7,5 and -3,75 but not +7,5, ,5,
// 7, or 1,5e3. Variable-Settings bound fields still parse with Number().
function isEuropeanDecimal_(raw) {
  return typeof raw === 'string' && /^-?\d+,\d+$/.test(raw.trim());
}
function detectLocale_(formulas, values, mode) {
  if (mode === 'eu') return 'eu';
  if (mode === 'us') return 'us';
  var rows = formulas || [];
  for (var r = 0; r < rows.length; r++) {
    var frow = rows[r] || [];
    for (var c = 0; c < frow.length; c++) {
      var f = frow[c];
      if (!f || typeof f !== 'string') continue;
      var inStr = false;
      for (var i = 0; i < f.length; i++) {
        var ch = f.charAt(i);
        if (ch === '"') inStr = !inStr;
        else if (ch === ';' && !inStr) return 'eu';
      }
    }
  }
  rows = values || [];
  for (var vr = 0; vr < rows.length; vr++) {
    var vrow = rows[vr] || [];
    for (var vc = 0; vc < vrow.length; vc++) {
      if (isEuropeanDecimal_(vrow[vc])) return 'eu';
    }
  }
  return 'us';
}
function normalizeFormula_(formula, locale) {
  if (locale !== 'eu' || typeof formula !== 'string' ||
      (formula.indexOf(',') === -1 && formula.indexOf(';') === -1)) {
    return formula;
  }
  var out = '', inStr = false;
  for (var i = 0; i < formula.length; i++) {
    var ch = formula.charAt(i);
    if (ch === '"') { inStr = !inStr; out += ch; }
    else if (inStr) { out += ch; }
    else if (ch === ';') { out += ','; }
    else if (ch === ',') { out += '.'; }
    else { out += ch; }
  }
  return out;
}
function normalizeValue_(raw, locale) {
  if (locale === 'eu' && isEuropeanDecimal_(raw)) {
    return Number(raw.trim().replace(',', '.'));
  }
  return raw;
}

function loadGrid_(sheet, localeMode) {
  const range = sheet.getDataRange();
  const rawFormulas = range.getFormulas();
  const rawValues = range.getValues();
  const columns = rawFormulas.length ? rawFormulas[0].length : 0;
  const locale = detectLocale_(rawFormulas, rawValues, localeMode || 'auto');
  const formulas = rawFormulas.map(function (row) {
    return row.map(function (f) { return normalizeFormula_(f, locale); });
  });
  const values = rawValues.map(function (row) {
    return row.map(function (v) { return normalizeValue_(v, locale); });
  });
  return {
    firstRow: range.getRow(),
    firstColumn: range.getColumn(),
    rows: formulas.length,
    columns: columns,
    cellCount: formulas.length * columns,
    formulas: formulas,
    values: values,
    locale: locale,
  };
}

function cellAt_(grid, a1) {
  const address = parseAddress_(a1);
  const r = address.row - grid.firstRow;
  const c = address.column - grid.firstColumn;
  if (r < 0 || c < 0 || r >= grid.rows || c >= grid.columns) {
    return { formula: '', value: 0 };
  }
  return { formula: grid.formulas[r][c], value: grid.values[r][c] };
}

function parseAddress_(a1) {
  const match = /^([A-Z]+)(\d+)$/.exec(a1.replace(/\$/g, '').toUpperCase());
  if (!match) throw new Error('bad cell reference "' + a1 + '"');
  return { column: columnIndex_(match[1]), row: parseInt(match[2], 10) };
}

function columnIndex_(letters) {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index;
}

function columnLetter_(index) {
  let letter = '';
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function expandRange_(grid, a1) {
  const clean = a1.replace(/\$/g, '').toUpperCase();
  const parts = clean.split(':');
  const start = parseAddress_(parts[0]);
  const end = parts.length > 1 ? parseAddress_(parts[1]) : start;
  const cells = [];
  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.column; c <= end.column; c++) {
      cells.push(columnLetter_(c) + r);
    }
  }
  return cells;
}

function toSet_(list) {
  const set = {};
  list.forEach(function (item) { set[item] = true; });
  return set;
}

function newContext_(grid, variables, options) {
  return {
    grid: grid,
    variables: toSet_(variables),
    memo: {},
    dependsMemo: {},
    constantFallbacks: [],
    // In Google Sheets a formula's cached value is exact, so an unsupported but
    // variable-independent formula can safely fold to its value. On the web the
    // grid stores 0 for every formula, so that fallback would inject a false 0.
    // Callers pass false to forbid it (web) or true/undefined to allow it (add-on).
    allowCachedFormulaFallback: !(options && options.allowCachedFormulaFallback === false),
  };
}

/* ================================================================== */
/* Dependency analysis — does this cell lead back to a variable?       */
/* ================================================================== */

/**
 * Extracts the cell and range references from a formula. String literals are
 * blanked first so that text like "A2" inside SUMIF is not mistaken for a
 * reference, and matches preceded by a letter are skipped so that the "G10"
 * inside a name like LOG10 is not either.
 */
function referencedCells_(formula) {
  const source = formula.replace(/"[^"]*"/g, '""');
  const pattern = /\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?/gi;
  const references = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const previous = match.index > 0 ? source.charAt(match.index - 1) : '';
    if (/[A-Za-z_]/.test(previous)) continue;
    references.push(match[0].replace(/\$/g, '').toUpperCase());
  }
  return references;
}

function dependsOnVariables_(context, a1, seen) {
  const cell = a1.replace(/\$/g, '').toUpperCase();
  if (context.variables[cell]) return true;
  if (context.dependsMemo[cell] !== undefined) return context.dependsMemo[cell];
  if (seen[cell]) return false;
  seen[cell] = true;

  const entry = cellAt_(context.grid, cell);
  if (!entry.formula) {
    context.dependsMemo[cell] = false;
    return false;
  }

  let result = false;
  const references = referencedCells_(entry.formula);
  for (let i = 0; i < references.length && !result; i++) {
    const targets = references[i].indexOf(':') !== -1
      ? expandRange_(context.grid, references[i])
      : [references[i]];
    for (let j = 0; j < targets.length; j++) {
      if (dependsOnVariables_(context, targets[j], seen)) { result = true; break; }
    }
  }

  context.dependsMemo[cell] = result;
  return result;
}

/* ================================================================== */
/* Linear form: { constant, terms }                                    */
/* ================================================================== */

function constantForm_(value) {
  return { constant: value, terms: {} };
}

/** Text constants ride along in `text`; arithmetically they count as zero. */
function stringForm_(text) {
  return { constant: 0, terms: {}, text: text };
}

/** The raw comparable value of a constant form: its text if any, else a number. */
function rawValue_(form) {
  return form.text !== undefined ? form.text : form.constant;
}

function compareValues_(left, operator, right) {
  const bothNumbers = typeof left === 'number' && typeof right === 'number';
  const a = bothNumbers ? left : String(left).toLowerCase();
  const b = bothNumbers ? right : String(right).toLowerCase();
  switch (operator) {
    case '=': return a === b;
    case '<>': return a !== b;
    case '<': return a < b;
    case '>': return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    default: throw new Error('unknown comparison "' + operator + '"');
  }
}

/** Matches a SUMIF criterion such as "standard", ">10" or "<>0". */
// Normalise a SUMIF criterion operand: any finite numeric literal (20, 20.0,
// 020, +20, 2e1, .5) becomes a Number so it compares numerically; otherwise it
// stays text. Used for BOTH the operator form (">20.0") and the bare-equality
// form ("20.0"), which Excel treats as "=20".
function parseCriterionOperand_(operand, locale) {
  let text = String(operand).trim();
  // On a European sheet the criterion string is preserved verbatim by the
  // normaliser (it's a string literal), so a decimal-comma literal like "10,0"
  // arrives here unchanged. Convert it to canonical form so it compares
  // numerically instead of falling back to a (wrong) textual comparison.
  if (locale === 'eu' && /^[+-]?(?:\d+,\d*|,\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
    text = text.replace(',', '.');
  }
  const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  const parsed = Number(text);
  return (text !== '' && numericPattern.test(text) && Number.isFinite(parsed)) ? parsed : text;
}

function matchesCriterion_(value, criterion, locale) {
  if (typeof criterion === 'number') return compareValues_(value, '=', criterion);
  const text = String(criterion).trim();
  const match = /^(<=|>=|<>|<|>|=)\s*(.*)$/.exec(text);
  // A criterion with no leading operator is an equality test — Excel accepts a
  // number or its textual form ("20", "20.0"). Normalise it too, not only the
  // explicit-operator operand, so "20.0" matches the number 20.
  if (!match) return compareValues_(value, '=', parseCriterionOperand_(text, locale));
  return compareValues_(value, match[1], parseCriterionOperand_(match[2], locale));
}

function variableForm_(cell) {
  const terms = {};
  terms[cell] = 1;
  return { constant: 0, terms: terms };
}

function isConstant_(form) {
  for (const key in form.terms) if (form.terms[key]) return false;
  return true;
}

function addForms_(a, b, sign) {
  const result = { constant: a.constant + sign * b.constant, terms: {} };
  for (const k in a.terms) result.terms[k] = a.terms[k];
  for (const k in b.terms) {
    result.terms[k] = (result.terms[k] || 0) + sign * b.terms[k];
  }
  return result;
}

function multiplyForms_(a, b) {
  if (!isConstant_(a) && !isConstant_(b)) {
    throw new Error('non-linear: a variable is multiplied by another variable');
  }
  const scalar = isConstant_(a) ? a.constant : b.constant;
  const other = isConstant_(a) ? b : a;
  const result = { constant: other.constant * scalar, terms: {} };
  for (const k in other.terms) result.terms[k] = other.terms[k] * scalar;
  return result;
}

function divideForms_(a, b) {
  if (!isConstant_(b)) throw new Error('non-linear: division by a variable');
  if (b.constant === 0) throw new Error('division by zero');
  return multiplyForms_(a, constantForm_(1 / b.constant));
}


/* ================================================================== */
/* Cell -> linear form                                                 */
/* ================================================================== */

function linearize_(context, a1, depth) {
  if (depth > ENGINE.MAX_DEPTH) throw new Error('reference cycle or too deep');
  const cell = a1.replace(/\$/g, '').toUpperCase();

  if (context.variables[cell]) return variableForm_(cell);
  if (context.memo[cell]) return context.memo[cell];

  const entry = cellAt_(context.grid, cell);

  let form;
  if (!entry.formula) {
    if (typeof entry.value === 'number') form = constantForm_(entry.value);
    else if (typeof entry.value === 'string' && entry.value !== '') {
      form = stringForm_(entry.value);
    } else form = constantForm_(0);
  } else {
    try {
      const tokens = tokenize_(entry.formula.replace(/^=/, ''));
      const parser = { tokens: tokens, position: 0, context: context, depth: depth };
      form = parseComparison_(parser);
      if (parser.position < parser.tokens.length) {
        throw new Error('unexpected token "' +
          parser.tokens[parser.position].text + '"');
      }
    } catch (err) {
      // Anything the parser cannot handle is still usable as long as it does
      // not lead back to a decision variable AND the caller allows folding a
      // cached value. On the web this is off, so an unsupported formula fails.
      if (context.allowCachedFormulaFallback && !dependsOnVariables_(context, cell, {})) {
        const cached = entry.value;
        if (typeof cached !== 'number') {
          throw new Error(cell + ' has no numeric value to fall back on');
        }
        context.constantFallbacks.push(cell);
        form = constantForm_(cached);
      } else {
        throw new Error(cell + ' could not be read as a number or a linear ' +
          'expression of the decision variables (' + err.message + ')');
      }
    }
  }

  context.memo[cell] = form;
  return form;
}

/* ================================================================== */
/* Tokenizer                                                           */
/* ================================================================== */

function tokenize_(source) {
  const tokens = [];
  const pattern = /\s*("[^"]*"|\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?|[A-Z][A-Z0-9._]*\s*\(|\d+(?:\.\d+)?|<=|>=|<>|[()+\-*/,<>=])/gi;
  let match;
  let consumed = 0;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index !== consumed) {
      throw new Error('unsupported syntax near "' +
        source.substring(consumed, match.index + 1).trim() + '"');
    }
    consumed = pattern.lastIndex;
    const text = match[1].trim();

    if (text.charAt(0) === '"') {
      tokens.push({ type: 'string', text: text.substring(1, text.length - 1) });
    } else if (/\($/.test(text) && !/^\($/.test(text)) {
      tokens.push({ type: 'function', text: text.replace(/\s*\($/, '').toUpperCase() });
      tokens.push({ type: 'punct', text: '(' });
    } else if (/^\d/.test(text)) {
      tokens.push({ type: 'number', text: text });
    } else if (/\d/.test(text) && /^[$A-Z]/i.test(text)) {
      tokens.push({ type: 'ref', text: text.replace(/\$/g, '').toUpperCase() });
    } else {
      tokens.push({ type: 'punct', text: text });
    }
  }

  if (consumed < source.trim().length) {
    throw new Error('unsupported syntax near "' + source.substring(consumed).trim() + '"');
  }
  return tokens;
}

/* ================================================================== */
/* Recursive descent parser                                            */
/* ================================================================== */

function peek_(parser) {
  return parser.position < parser.tokens.length ? parser.tokens[parser.position] : null;
}

function consume_(parser, text) {
  const token = peek_(parser);
  if (!token || (text && token.text !== text)) {
    throw new Error('expected "' + text + '"');
  }
  parser.position++;
  return token;
}

/**
 * A comparison yields 1 or 0. Both sides must be constant: comparing a
 * decision variable would make the model non-linear, and that is reported
 * rather than silently approximated.
 */
function parseComparison_(parser) {
  const left = parseExpression_(parser);
  const token = peek_(parser);
  const operators = ['=', '<>', '<', '>', '<=', '>='];
  if (!token || token.type !== 'punct' || operators.indexOf(token.text) === -1) {
    return left;
  }
  parser.position++;
  const right = parseExpression_(parser);
  if (!isConstant_(left) || !isConstant_(right)) {
    throw new Error('a comparison involves a decision variable');
  }
  return constantForm_(
    compareValues_(rawValue_(left), token.text, rawValue_(right)) ? 1 : 0);
}

/** Advances past one function argument, respecting nested parentheses. */
function skipArgument_(parser) {
  let depth = 0;
  while (parser.position < parser.tokens.length) {
    const token = parser.tokens[parser.position];
    if (token.type === 'punct') {
      if (token.text === '(') depth++;
      else if (token.text === ')') {
        if (depth === 0) return;
        depth--;
      } else if (token.text === ',' && depth === 0) return;
    }
    parser.position++;
  }
}

function parseExpression_(parser) {
  let form = parseTerm_(parser);
  for (;;) {
    const token = peek_(parser);
    if (!token || (token.text !== '+' && token.text !== '-')) return form;
    parser.position++;
    form = addForms_(form, parseTerm_(parser), token.text === '+' ? 1 : -1);
  }
}

function parseTerm_(parser) {
  let form = parseFactor_(parser);
  for (;;) {
    const token = peek_(parser);
    if (!token || (token.text !== '*' && token.text !== '/')) return form;
    parser.position++;
    const right = parseFactor_(parser);
    form = token.text === '*' ? multiplyForms_(form, right) : divideForms_(form, right);
  }
}

function parseFactor_(parser) {
  const token = peek_(parser);
  if (!token) throw new Error('unexpected end of formula');

  if (token.text === '-') {
    parser.position++;
    return multiplyForms_(parseFactor_(parser), constantForm_(-1));
  }
  if (token.text === '+') {
    parser.position++;
    return parseFactor_(parser);
  }
  if (token.text === '(') {
    parser.position++;
    const form = parseComparison_(parser);
    consume_(parser, ')');
    return form;
  }
  if (token.type === 'number') {
    parser.position++;
    return constantForm_(parseFloat(token.text));
  }
  if (token.type === 'string') {
    parser.position++;
    return stringForm_(token.text);
  }
  if (token.type === 'function') {
    return parseFunction_(parser);
  }
  if (token.type === 'ref') {
    parser.position++;
    if (token.text.indexOf(':') !== -1) {
      throw new Error('a range is only valid inside SUM or SUMPRODUCT');
    }
    return linearize_(parser.context, token.text, parser.depth + 1);
  }
  throw new Error('unexpected token "' + token.text + '"');
}

function parseFunction_(parser) {
  const name = consume_(parser).text;
  consume_(parser, '(');

  if (name === 'SUM') {
    let total = constantForm_(0);
    do {
      total = addForms_(total, parseArgumentAsSum_(parser), 1);
    } while (peek_(parser) && peek_(parser).text === ',' && consume_(parser, ','));
    consume_(parser, ')');
    return total;
  }

  if (name === 'SUMPRODUCT') {
    const left = collectCells_(parser);
    consume_(parser, ',');
    const right = collectCells_(parser);
    consume_(parser, ')');
    if (left.length !== right.length) {
      throw new Error('SUMPRODUCT ranges have different sizes');
    }
    let total = constantForm_(0);
    for (let i = 0; i < left.length; i++) {
      const a = linearize_(parser.context, left[i], parser.depth + 1);
      const b = linearize_(parser.context, right[i], parser.depth + 1);
      total = addForms_(total, multiplyForms_(a, b), 1);
    }
    return total;
  }

  if (name === 'IF') {
    const condition = parseComparison_(parser);
    if (!isConstant_(condition)) {
      throw new Error('IF() tests a decision variable');
    }
    consume_(parser, ',');
    let result;
    if (rawValue_(condition)) {
      result = parseComparison_(parser);
      if (peek_(parser) && peek_(parser).text === ',') {
        consume_(parser, ',');
        skipArgument_(parser);
      }
    } else {
      skipArgument_(parser);
      if (peek_(parser) && peek_(parser).text === ',') {
        consume_(parser, ',');
        result = parseComparison_(parser);
      } else {
        result = constantForm_(0);
      }
    }
    consume_(parser, ')');
    return result;
  }

  if (name === 'SUMIF') {
    const criteriaCells = collectCells_(parser);
    consume_(parser, ',');
    const criterionForm = parseComparison_(parser);
    if (!isConstant_(criterionForm)) {
      throw new Error('the SUMIF criterion depends on a decision variable');
    }
    const criterion = rawValue_(criterionForm);

    let sumCells = criteriaCells;
    if (peek_(parser) && peek_(parser).text === ',') {
      consume_(parser, ',');
      sumCells = collectCells_(parser);
    }
    consume_(parser, ')');
    if (sumCells.length !== criteriaCells.length) {
      throw new Error('SUMIF ranges have different sizes');
    }

    let total = constantForm_(0);
    for (let i = 0; i < criteriaCells.length; i++) {
      const probe = linearize_(parser.context, criteriaCells[i], parser.depth + 1);
      if (!isConstant_(probe)) {
        throw new Error('the SUMIF criteria range depends on a decision variable');
      }
      if (matchesCriterion_(rawValue_(probe), criterion, parser.context.grid.locale)) {
        total = addForms_(total,
          linearize_(parser.context, sumCells[i], parser.depth + 1), 1);
      }
    }
    return total;
  }

  const handler = CONSTANT_FUNCTIONS[name];
  if (handler) {
    const args = collectConstantArguments_(parser);
    consume_(parser, ')');
    return constantForm_(handler(args));
  }

  throw new Error('unsupported function ' + name + '()');
}

/**
 * Functions evaluated directly, provided none of their arguments touch a
 * decision variable. MIN over variables, for instance, is genuinely
 * non-linear and is refused rather than approximated.
 */
const CONSTANT_FUNCTIONS = {
  MIN: function (values) { return Math.min.apply(null, numbersOnly_(values)); },
  MAX: function (values) { return Math.max.apply(null, numbersOnly_(values)); },
  ABS: function (values) { return Math.abs(Number(values[0])); },
  SQRT: function (values) { return Math.sqrt(Number(values[0])); },
  INT: function (values) { return Math.floor(Number(values[0])); },
  ROUND: function (values) { return roundTo_(values[0], values[1]); },
  ROUNDUP: function (values) { return directedRound_(values[0], values[1], Math.ceil); },
  ROUNDDOWN: function (values) { return directedRound_(values[0], values[1], Math.floor); },
  AVERAGE: function (values) {
    const numbers = numbersOnly_(values);
    if (!numbers.length) return 0;
    let total = 0;
    numbers.forEach(function (v) { total += v; });
    return total / numbers.length;
  },
  COUNT: function (values) { return numbersOnly_(values).length; },
  AND: function (values) { return values.every(truthy_) ? 1 : 0; },
  OR: function (values) { return values.some(truthy_) ? 1 : 0; },
  NOT: function (values) { return truthy_(values[0]) ? 0 : 1; },
};

function numbersOnly_(values) {
  return values.filter(function (v) { return typeof v === 'number' && !isNaN(v); });
}

function truthy_(value) {
  return typeof value === 'number' ? value !== 0 : Boolean(value);
}

function roundTo_(value, digits) {
  const factor = Math.pow(10, Number(digits) || 0);
  return Math.round(Number(value) * factor) / factor;
}

function directedRound_(value, digits, operation) {
  const factor = Math.pow(10, Number(digits) || 0);
  const scaled = Number(value) * factor;
  return (scaled < 0 ? -operation(-scaled) : operation(scaled)) / factor;
}

/** Reads function arguments that must all evaluate to constants. */
function collectConstantArguments_(parser) {
  const values = [];
  for (;;) {
    const token = peek_(parser);
    if (token && token.type === 'ref' && token.text.indexOf(':') !== -1) {
      parser.position++;
      expandRange_(parser.context.grid, token.text).forEach(function (cell) {
        const form = linearize_(parser.context, cell, parser.depth + 1);
        if (!isConstant_(form)) {
          throw new Error('an argument depends on a decision variable');
        }
        values.push(rawValue_(form));
      });
    } else {
      const form = parseComparison_(parser);
      if (!isConstant_(form)) {
        throw new Error('an argument depends on a decision variable');
      }
      values.push(rawValue_(form));
    }
    const next = peek_(parser);
    if (next && next.text === ',') { parser.position++; continue; }
    break;
  }
  return values;
}

function parseArgumentAsSum_(parser) {
  const token = peek_(parser);
  if (token && token.type === 'ref' && token.text.indexOf(':') !== -1) {
    parser.position++;
    let total = constantForm_(0);
    expandRange_(parser.context.grid, token.text).forEach(function (cell) {
      total = addForms_(total, linearize_(parser.context, cell, parser.depth + 1), 1);
    });
    return total;
  }
  return parseExpression_(parser);
}

function collectCells_(parser) {
  const token = consume_(parser);
  if (token.type !== 'ref') throw new Error('SUMPRODUCT expects ranges');
  return token.text.indexOf(':') !== -1
    ? expandRange_(parser.context.grid, token.text)
    : [token.text];
}


const MAXIMISE_HINTS = [
  'profit', 'revenue', 'margin', 'income', 'contribution', 'return', 'value',
  'benefit', 'output', 'yield', 'sales',
  'beneficio', 'ingreso', 'ingresos', 'margen', 'ganancia', 'ventas', 'valor',
];
const MINIMISE_HINTS = [
  'cost', 'costs', 'expense', 'spend', 'waste', 'time', 'distance', 'loss',
  'coste', 'costo', 'costes', 'gasto', 'gastos', 'tiempo', 'perdida', 'merma',
];
const RELATION_TOKENS = {
  '<=': '<=', '=<': '<=', '≤': '<=',
  '>=': '>=', '=>': '>=', '≥': '>=',
  '=': '=', '==': '=',
};
// Strict inequalities are intentionally NOT normalized here: silently treating
// "x < 10" as "x <= 10" changes the model and could report a solution the user
// excluded. They are rejected as constraint operators (see readConstraint_),
// which does not affect SUMIF criteria or strict comparisons inside formulas.
const STRICT_RELATION_TOKENS = { '<': true, '>': true };
const APP = {
  NAME: 'Solver',
  SIDEBAR_TITLE: 'Solver',
  MODEL_KEY: 'model:',
  UNDO_KEY: 'undo:',
  REVIEW_KEY: 'reviewPrompt',   // per-user: 'done' once shown, so we never nag
  MAX_SCAN_COLUMNS: 4,      // how far right to look for a relation and a limit
  FREE_VARIABLE_LIMIT: 50,  // matches the paid competitor's published ceiling
  FREE_CONSTRAINT_LIMIT: 20,
};



function solveModel_(sheet, model, localeMode) {
  const started = Date.now();
  const grid = loadGrid_(sheet, localeMode);
  const variables = expandRange_(grid, model.variables);
  const context = newContext_(grid, variables);

  const objectiveForm = safeLinearize_(context, model.objective.cell,
    'the objective');

  const constraints = [];
  (model.constraints || []).forEach(function (item, index) {
    // A "guessed" constraint had no explicit operator and limit. On the web the
    // stored value is 0, so accepting it would invent "cell <= 0" the user never
    // wrote. Fail clearly instead of solving a model they didn't build.
    if (item.guessed) {
      throw new Error(item.cell + ' looks like a constraint but has no explicit ' +
        'operator and limit. Add one (for example <= 100), or remove the row.');
    }
    const form = safeLinearize_(context, item.cell,
      'constraint ' + (index + 1));
    constraints.push({
      coefficients: coefficientVector_(form, variables),
      relation: item.relation,
      rhs: Number(item.limit) - form.constant,
      constant: form.constant,
      cell: item.cell,
      label: labelFor_(grid, item.cell),
      limit: Number(item.limit),
    });
  });

  // Per-variable domains (from the Variable settings panel) override the simple
  // whole-numbers flag when present. Otherwise fall back to the global toggle.
  const domains = model.domains || null;
  const solution = optimise_({
    maximize: model.objective.sense !== 'min',
    objective: coefficientVector_(objectiveForm, variables),
    constant: objectiveForm.constant,
    constraints: constraints,
    integer: domains ? domains.integer : (model.wholeNumbers === true),
    bounds: domains ? domains.bounds : null,
  });

  // Real integer-variable check (not just the global toggle): a panel-set
  // integer or binary variable makes this a discrete model too.
  const integerSpec = domains ? domains.integer : (model.wholeNumbers === true);
  const hasIntegerVariables = integerSpec === true ||
    (Array.isArray(integerSpec) && integerSpec.length > 0);
  // Classify the model for display: continuous / integer / binary / mixed.
  const modelType = classifyModel_(domains, model.wholeNumbers === true, variables.length);

  const result = {
    status: solution.status,
    stopReason: solution.stopReason || null,
    optimalityProven: solution.optimalityProven === true,
    nodesExplored: typeof solution.nodesExplored === 'number' ? solution.nodesExplored : null,
    objectiveLabel: labelFor_(grid, model.objective.cell),
    elapsedMs: Date.now() - started,
    variables: variables,
    modelType: modelType,
    sense: model.objective.sense === 'min' ? 'min' : 'max',
    labels: readLabels_(grid, model.variables, variables),
    previous: variables.map(function (cell) {
      const value = cellAt_(grid, cell).value;
      return typeof value === 'number' ? value : 0;
    }),
    foldedConstants: context.constantFallbacks.length,
  };

  if (solution.status !== 'optimal' && solution.status !== 'feasible') {
    result.explanation = explainStatus_(solution.status, model);
    return result;
  }
  if (solution.status === 'feasible') {
    // Explain WHY optimality wasn't proven, from the actual stop reason, rather
    // than always blaming time.
    var reasonText = {
      time_limit: 'stopped at the time limit',
      node_limit: 'stopped at the node limit',
      iteration_limit: 'stopped at the iteration limit',
      numerical_failure: 'stopped after a numerical problem'
    }[solution.stopReason] || 'stopped before the whole search finished';
    result.caveat = 'This answer satisfies every limit, but the search ' +
      reasonText + ', so it is not proven to be the best one. A slightly ' +
      'better whole-number combination may exist.';
  }

  result.values = solution.values.map(round_);
  result.objective = round_(solution.objective);
  result.objectiveBefore = round_(Number(cellAt_(grid, model.objective.cell).value) || 0);
  result.constraints = constraints.map(function (c, i) {
    const used = round_(dotProduct_(c.coefficients, solution.values) + c.constant);
    const slack = round_(c.limit - used);
    const reported = {
      label: c.label,
      cell: c.cell,
      relation: c.relation,
      used: used,
      limit: c.limit,
      slack: slack,
      binding: Math.abs(slack) < 1e-6,
      satisfied: isSatisfied_(used, c.relation, c.limit),
    };
    // For a two-variable model, expose the line so a client can draw the
    // feasible region. Kept off larger models to keep the payload lean.
    if (variables.length === 2) {
      reported.coefficients = c.coefficients;
      reported.constant = c.constant;
    }
    return reported;
  });

  if (variables.length === 2) {
    result.plot = {
      objective: coefficientVector_(objectiveForm, variables),
      variableLabels: result.labels,
    };
  }

  // Per-variable domains for the receipt: type, min, max, the resulting value,
  // and whether each limit is satisfied/binding. This makes the bounds part of
  // the verification, not just something applied silently during the solve.
  result.variableDomains = buildVariableDomains_(domains, model.wholeNumbers === true,
    variables, result.labels, solution.values, modelType);

  // Sensitivity: for each binding limit, what would one more unit of it be
  // worth? We answer it the honest way — re-solve with that single limit
  // relaxed by one and measure the change in the objective. This is the
  // "shadow price", the number the paid tools call a sensitivity report.
  // Only meaningful for the continuous relaxation, so we skip it for integer
  // models, and we cap the extra solves so a large model stays responsive.
  if (solution.status === 'optimal' && !hasIntegerVariables) {
    addShadowPrices_(result.constraints, constraints, {
      maximize: model.objective.sense !== 'min',
      objective: coefficientVector_(objectiveForm, variables),
      constant: objectiveForm.constant,
      bounds: domains ? domains.bounds : null,
    }, result.objective);
  }

  return result;
}

function addShadowPrices_(reported, constraints, base, baseObjective) {
  const MAX_PROBES = 20;             // keep large models snappy
  let probes = 0;
  for (let i = 0; i < reported.length; i++) {
    if (!reported[i].binding) continue;
    // Equality limits have no single "relax by one unit" direction (raising vs
    // lowering the RHS are different questions), so we don't report a marginal
    // value for them in the beta rather than describe it wrongly.
    if (reported[i].relation === '=') continue;
    if (probes++ >= MAX_PROBES) break;

    const perturbed = constraints.map(function (c) {
      return {
        coefficients: c.coefficients,
        relation: c.relation,
        rhs: c.rhs,
      };
    });
    // Relax this limit by one unit in the direction that loosens it: a '<=' cap
    // goes up by one, a '>=' floor goes down by one.
    const rhsChange = reported[i].relation === '>=' ? -1 : 1;
    perturbed[i].rhs += rhsChange;

    const probe = optimise_({
      maximize: base.maximize,
      objective: base.objective,
      constant: base.constant,
      constraints: perturbed,
      bounds: base.bounds || null,
    });
    if (probe.status !== 'optimal') continue;

    // Signed change in the objective from that one-unit relaxation. Positive
    // means the objective went up, negative means down — the UI describes it
    // neutrally ("improvement from relaxing by one unit") using the sign and
    // the optimisation direction, so it reads correctly for min and max, and
    // for '<=' and '>=' alike.
    const delta = round_(probe.objective - baseObjective);
    reported[i].objectiveDelta = Math.abs(delta) < 1e-6 ? 0 : delta;
    reported[i].rhsChange = rhsChange;
  }
}

function safeLinearize_(context, cell, role) {
  try {
    return linearize_(context, cell, 0);
  } catch (err) {
    throw new Error(capitalise_(role) + ' (' + cell + ') could not be read. ' +
      String(err.message || err));
  }
}

// Would treating `varCells` as the decision variables yield a LINEAR model?
// Probes every output the variables feed; if any is non-linear in those cells
// (e.g. B2*C2 when BOTH are variables), the candidate is non-linear. Never
// throws — returns a boolean. Used to prefer a single-cell candidate over a
// contiguous block that only looks like two variables (=B2*C2, C2 a coefficient).
function candidateIsLinear_(grid, varCells, outputs, options) {
  const context = newContext_(grid, varCells, options);
  const varSet = toSet_(varCells);
  const fed = outputs.filter(function (output) {
    return reachableConstants_(grid, output, {}).some(function (cell) { return varSet[cell]; });
  });
  for (let i = 0; i < fed.length; i++) {
    try { linearize_(context, fed[i], 0); }
    catch (e) { return false; }
  }
  return true;
}

function explainStatus_(status, model) {
  if (status === 'infeasible') {
    return 'No combination of values satisfies every constraint at once. ' +
      'Two or more limits contradict each other. Try relaxing the tightest one.';
  }
  if (status === 'no whole-number solution found in time') {
    return 'No whole-number combination was found within the time available. ' +
      'Try relaxing a limit, or turn off "whole numbers only" to see the ' +
      'fractional answer.';
  }
  if (status === 'unbounded') {
    return 'The model appears unbounded: the objective can grow without limit. ' +
      'Add a constraint on ' + model.variables + ' or on a total that uses it.';
  }
  if (status === 'numerical_failure') {
    return 'A numerical problem prevented a reliable result. The model may have ' +
      'very large or very small coefficients; try rescaling them.';
  }
  // 'unknown' and any limit-based stop: honest incomplete-search message.
  return 'The search stopped before a conclusion could be reached. ' +
    'The model may be too large for the in-browser solver; try a smaller model.';
}

function isSatisfied_(used, relation, limit) {
  const tolerance = 1e-6;
  if (relation === '<=') return used <= limit + tolerance;
  if (relation === '>=') return used >= limit - tolerance;
  return Math.abs(used - limit) < tolerance;
}

function dotProduct_(coefficients, values) {
  let total = 0;
  for (let i = 0; i < coefficients.length; i++) {
    total += (coefficients[i] || 0) * (values[i] || 0);
  }
  return total;
}

function coefficientVector_(form, variables) {
  return variables.map(function (cell) { return form.terms[cell] || 0; });
}

function round_(value) {
  const rounded = Math.round(Number(value) * 1e9) / 1e9;
  return Math.abs(rounded) < 1e-9 ? 0 : rounded;
}

function reshape_(values, rows, columns) {
  const block = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < columns; c++) row.push(values[index++] || 0);
    block.push(row);
  }
  return block;
}

function capitalise_(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function detectModel_(sheet, localeMode) {
  const grid = loadGrid_(sheet, localeMode);
  const formulaCells = listFormulaCells_(grid);
  if (!formulaCells.length) {
    throw new Error('This sheet has no formulas, so there is no model to read. ' +
      'Build the calculation first, then come back.');
  }

  const referenced = {};
  formulaCells.forEach(function (cell) {
    referencedCells_(cellAt_(grid, cell).formula).forEach(function (reference) {
      expandReference_(grid, reference).forEach(function (target) {
        referenced[target] = true;
      });
    });
  });

  const outputs = formulaCells.filter(function (cell) { return !referenced[cell]; });
  if (!outputs.length) {
    throw new Error('Every formula on this sheet feeds another one, so none of ' +
      'them looks like a final total. Pick the objective yourself.');
  }

  // Constant cells reachable from each output, grouped into contiguous blocks.
  const blockReach = {};
  const blockCells = {};
  outputs.forEach(function (output) {
    const constants = reachableConstants_(grid, output, {});
    contiguousBlocks_(grid, constants).forEach(function (block) {
      blockReach[block] = (blockReach[block] || 0) + 1;
      blockCells[block] = expandRange_(grid, block);
    });
  });

  // Prefer multi-cell blocks exactly as before, with one refinement: a block
  // formed ONLY by the objective (never by a constraint) is weak evidence — it
  // can be an accidental pairing like =B2*C2 where C2 is a coefficient — and
  // must not out-rank a genuine single-cell variable with objective+constraint
  // evidence.
  let variables = null;
  let bestScore = -1;
  Object.keys(blockCells).forEach(function (block) {
    const size = blockCells[block].length;
    if (size < 2) return;
    const score = blockReach[block] * 1000 + size;
    if (score > bestScore) { bestScore = score; variables = block; }
  });

  // Single-cell candidates: reached by the objective AND by at least one
  // constraint (proven per role — two constraints and no objective must not
  // qualify, or picking one as the objective would drop a real limit).
  const eligibleSingles = [];
  {
    const cellReach = {};
    outputs.forEach(function (output) {
      reachableConstants_(grid, output, {}).forEach(function (cell) {
        cellReach[cell] = (cellReach[cell] || 0) + 1;
      });
    });
    Object.keys(cellReach).forEach(function (cell) {
      if (cellReach[cell] < 2) return;
      const reached = outputs.filter(function (output) {
        return reachableConstants_(grid, output, {}).indexOf(cell) !== -1;
      });
      let hasObjective = false, hasConstraint = false;
      reached.forEach(function (output) {
        const role = readConstraint_(grid, output);
        if (role.isObjective) hasObjective = true;
        else if (role.isCompleteConstraint) hasConstraint = true;
        else if (role.hasRelation && role.limitFormula) hasConstraint = true;
      });
      if (hasObjective && hasConstraint) eligibleSingles.push(cell);
    });
  }

  // Priority (independent of how many outputs reach the block — a linear block
  // reached only by the objective, e.g. =10*B2+20*C2 with a limit on B2 alone,
  // is still a real multi-variable model and must NOT be reduced to one cell):
  //  - A LINEAR multi-cell block always wins.
  //  - A NON-LINEAR block (=B2*C2 with C2 a coefficient) yields to exactly one
  //    linear single cell; several linear singles => ambiguous.
  //  - No block: one linear single is the model; several are ambiguous.
  const opts = { allowCachedFormulaFallback: false };
  const linearSingles = eligibleSingles.filter(function (cell) {
    return candidateIsLinear_(grid, expandRange_(grid, cell), outputs, opts);
  });
  const blockLinear = variables
    ? candidateIsLinear_(grid, blockCells[variables] || expandRange_(grid, variables), outputs, opts)
    : false;

  if (variables && blockLinear) {
    // keep the linear multi-cell block
  } else if (variables && !blockLinear && linearSingles.length === 1) {
    variables = linearSingles[0];
  } else if (variables && !blockLinear && linearSingles.length > 1) {
    throw new Error('AMBIGUOUS_DECISION_CELLS');
  } else if (variables && !blockLinear) {
    // non-linear block, no linear single: keep block so solve reports it.
  } else if (!variables && linearSingles.length === 1) {
    variables = linearSingles[0];
  } else if (!variables && linearSingles.length > 1) {
    throw new Error('AMBIGUOUS_DECISION_CELLS');
  }

  if (!variables) {
    // A plausible single decision cell blocked only by an INCOMPLETE constraint
    // on it gets the specific marker, not the vague fallback. Scoped to cells
    // reached by an objective so an unrelated incomplete calc elsewhere on the
    // sheet does not trigger it.
    const cellReach2 = {};
    outputs.forEach(function (output) {
      reachableConstants_(grid, output, {}).forEach(function (cell) {
        cellReach2[cell] = (cellReach2[cell] || 0) + 1;
      });
    });
    const blockedByIncomplete = Object.keys(cellReach2).some(function (cell) {
      if (cellReach2[cell] < 2) return false;
      const reached = outputs.filter(function (output) {
        return reachableConstants_(grid, output, {}).indexOf(cell) !== -1;
      });
      let sawObjective = false, sawIncomplete = false;
      reached.forEach(function (output) {
        const role = readConstraint_(grid, output);
        if (role.isObjective) sawObjective = true;
        else if (role.isIncompleteConstraint) sawIncomplete = true;
      });
      return sawObjective && sawIncomplete;
    });
    if (blockedByIncomplete) {
      throw new Error('CONSTRAINT_MISSING_LIMIT');
    }
    throw new Error('No block of input cells feeds several totals, so the ' +
      'quantities to decide are not obvious. Select them yourself.');
  }

  // variableCells is the set of decision cells. For a multi-cell block it comes
  // from blockCells; for the single-cell fallback, `variables` is one cell not
  // in blockCells, so build the set from it directly.
  const variableCells = toSet_(blockCells[variables] || expandRange_(grid, variables));
  const dependent = outputs.filter(function (output) {
    return reachableConstants_(grid, output, {}).some(function (cell) {
      return variableCells[cell];
    });
  });

  // Classify dependent outputs by role. Pass the decision variables so a
  // FORMULA limit (=100) resolves to its constant instead of reading as
  // incomplete from the web's cached 0. Refuse a variable-dependent limit, an
  // incomplete constraint, or a sheet with no genuine objective.
  const variableList = expandRange_(grid, variables);
  const roles = dependent.map(function (cell) { return readConstraint_(grid, cell, variableList); });
  if (roles.some(function (r) { return r.limitDependsOnVariable; })) {
    throw new Error('LIMIT_DEPENDS_ON_VARIABLE');
  }
  if (roles.some(function (r) { return r.isIncompleteConstraint; })) {
    throw new Error('CONSTRAINT_MISSING_LIMIT');
  }
  const objectiveCandidates = dependent.filter(function (cell) {
    return readConstraint_(grid, cell, variableList).isObjective;
  });
  if (!objectiveCandidates.length) {
    throw new Error('NO_OBJECTIVE_CELL');
  }

  const objectiveCell = pickObjective_(grid, objectiveCandidates);
  const label = labelFor_(grid, objectiveCell);

  const constraints = [];
  dependent.forEach(function (cell) {
    if (cell === objectiveCell) return;
    const parsed = readConstraint_(grid, cell, variableList);
    if (parsed.limitDependsOnVariable) { throw new Error('LIMIT_DEPENDS_ON_VARIABLE'); }
    if (parsed.isIncompleteConstraint) { throw new Error('CONSTRAINT_MISSING_LIMIT'); }
    constraints.push(parsed);
  });
  // Never silently drop constraints: a model with more limits than we support
  // must fail loudly, or we'd "verify" a smaller model than the user built and
  // could return a false optimum.
  if (constraints.length > APP.FREE_CONSTRAINT_LIMIT) {
    throw new Error('This model has ' + constraints.length + ' constraints. ' +
      'Plumline currently supports up to ' + APP.FREE_CONSTRAINT_LIMIT + '.');
  }

  return {
    variables: variables,
    objective: {
      cell: objectiveCell,
      sense: senseFor_(label),
      label: label,
    },
    constraints: constraints,
  };
}

function listFormulaCells_(grid) {
  const cells = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.columns; c++) {
      if (grid.formulas[r][c]) {
        cells.push(columnLetter_(grid.firstColumn + c) + (grid.firstRow + r));
      }
    }
  }
  return cells;
}

function expandReference_(grid, reference) {
  return reference.indexOf(':') !== -1
    ? expandRange_(grid, reference)
    : [reference];
}

function reachableConstants_(grid, a1, seen) {
  const cell = a1.replace(/\$/g, '').toUpperCase();
  if (seen[cell]) return [];
  seen[cell] = true;

  const entry = cellAt_(grid, cell);
  if (!entry.formula) {
    return typeof entry.value === 'number' ? [cell] : [];
  }

  let found = [];
  referencedCells_(entry.formula).forEach(function (reference) {
    expandReference_(grid, reference).forEach(function (target) {
      found = found.concat(reachableConstants_(grid, target, seen));
    });
  });
  return found;
}

function contiguousBlocks_(grid, cells) {
  const lines = { column: {}, row: {} };
  cells.forEach(function (cell) {
    const address = parseAddress_(cell);
    push_(lines.column, address.column, address.row);
    push_(lines.row, address.row, address.column);
  });

  const blocks = [];
  Object.keys(lines.column).forEach(function (column) {
    runs_(grid, lines.column[column], function (row) {
      return columnLetter_(Number(column)) + row;
    }).forEach(function (run) { blocks.push(run); });
  });
  Object.keys(lines.row).forEach(function (row) {
    runs_(grid, lines.row[row], function (column) {
      return columnLetter_(column) + row;
    }).forEach(function (run) { blocks.push(run); });
  });
  return blocks;
}

function push_(map, key, value) {
  if (!map[key]) map[key] = [];
  map[key].push(value);
}

function runs_(grid, positions, addressAt) {
  const sorted = positions.slice().sort(function (a, b) { return a - b; });
  const found = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const position = sorted[i];
    const bridged = position !== undefined && position > previous &&
      gapIsEmpty_(grid, addressAt, previous, position);
    if (!bridged) {
      if (previous !== start) {
        found.push(addressAt(start) + ':' + addressAt(previous));
      }
      start = position;
    }
    previous = position;
  }
  return found;
}

function labelFor_(grid, a1) {
  const address = parseAddress_(a1);
  for (let column = address.column - 1; column >= grid.firstColumn; column--) {
    const value = cellAt_(grid, columnLetter_(column) + address.row).value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return a1;
}

function describeModel_(sheet, model, localeMode) {
  const grid = loadGrid_(sheet, localeMode);
  const variables = expandRange_(grid, model.variables);
  const context = newContext_(grid, variables);

  const summary = {
    variableCount: variables.length,
    variableLabels: readLabels_(grid, model.variables, variables).slice(0, 6),
    objective: { cell: model.objective.cell,
      label: labelFor_(grid, model.objective.cell),
      sense: model.objective.sense },
    constraints: [],
    problems: [],
    wholeNumbers: model.wholeNumbers === true,
    overFreeLimit: variables.length > APP.FREE_VARIABLE_LIMIT ||
      (model.constraints || []).length > APP.FREE_CONSTRAINT_LIMIT,
  };

  try {
    const form = linearize_(context, model.objective.cell, 0);
    summary.objective.terms = countTerms_(form);
    if (summary.objective.terms === 0) {
      summary.problems.push({
        cell: model.objective.cell,
        role: 'objective',
        message: inertMessage_('This total', model.variables),
      });
    }
  } catch (err) {
    summary.problems.push({
      cell: model.objective.cell,
      role: 'objective',
      message: String(err.message || err),
    });
  }

  (model.constraints || []).forEach(function (item) {
    const entry = {
      cell: item.cell, label: labelFor_(grid, item.cell),
      relation: item.relation, limit: item.limit, guessed: item.guessed,
    };
    try {
      const form = linearize_(context, item.cell, 0);
      if (countTerms_(form) === 0) {
        entry.problem = inertMessage_('This limit', model.variables);
        summary.problems.push({
          cell: item.cell, role: 'constraint', message: entry.problem,
        });
      }
    } catch (err) {
      entry.problem = String(err.message || err);
      summary.problems.push({
        cell: item.cell, role: 'constraint', message: entry.problem,
      });
    }
    summary.constraints.push(entry);
  });

  summary.foldedConstants = context.constantFallbacks.length;
  return summary;
}

function readLabels_(grid, rangeA1, variables) {
  const cells = expandRange_(grid, rangeA1);
  return variables.map(function (variable, index) {
    return labelFor_(grid, cells[index] || variable);
  });
}

function readConstraint_(grid, a1, variables) {
  const address = parseAddress_(a1);
  const label = labelFor_(grid, a1);
  let relation = null;
  let limit = null;
  let limitFormula = null;
  let limitCell = null;

  for (let step = 1; step <= APP.MAX_SCAN_COLUMNS; step++) {
    // Stop at the grid's right edge: cellAt_ returns {value:0} out of bounds,
    // and reading that would turn an EMPTY limit into 0 (incomplete looking
    // complete). Only scan real cells.
    if (address.column + step - grid.firstColumn >= grid.columns) break;
    const addr = columnLetter_(address.column + step) + address.row;
    const entry = cellAt_(grid, addr);
    const value = entry.value;
    if (relation === null && typeof value === 'string') {
      const trimmed = value.trim();
      if (STRICT_RELATION_TOKENS[trimmed]) {
        throw new Error('STRICT_INEQUALITY: ' + label + ' uses "' + trimmed +
          '". Strict inequalities (< and >) are not supported as constraint ' +
          'operators. Use <= or >= (equality at the limit is allowed).');
      }
      const token = RELATION_TOKENS[trimmed];
      if (token) { relation = token; continue; }
    }
    if (relation !== null) {
      // Limit is the FIRST real cell after the operator: skip blanks, accept the
      // first number, and STOP on any other content. A FORMULA limit must never
      // be read from its cached value (0 on the web): record it and evaluate it
      // against the decision variables below.
      if (entry.formula) { limitFormula = entry.formula; limitCell = addr; break; }
      if (value === '' || value === null || value === undefined) continue;
      if (typeof value === 'number') { limit = value; limitCell = addr; }
      break;
    }
  }

  // A formula limit is valid ONLY if it reduces to a finite numeric constant
  // with no decision-variable terms (=100, =50+50, =H1). It is rejected if it
  // depends on a variable (=2*B2) or resolves to text/empty (="").
  let limitDependsOnVariable = false;
  if (limitFormula !== null) {
  if (variables) {
    const context = {
      grid: grid,
      variables: toSet_(variables),
      memo: {},
      constantFallbacks: [],
      allowCachedFormulaFallback: false,
    };
    try {
      const form = linearize_(context, limitCell, 0);
      if (form.text !== undefined) {
        // formula resolves to text (e.g. =""): treated as a missing limit
      } else if (!isConstant_(form)) {
        limitDependsOnVariable = true;
      } else if (Number.isFinite(form.constant)) {
        limit = form.constant;
      }
    } catch (err) {
      // Unparseable or cyclic: leave the limit unresolved (incomplete).
    }
    }
  }

  const current = cellAt_(grid, a1).value;
  return {
    cell: a1,
    label: label,
    relation: relation === null ? '<=' : relation,
    limit: limit === null ? (typeof current === 'number' ? round_(current) : 0) : limit,
    guessed: relation === null || limit === null,
    hasRelation: relation !== null,
    hasLimit: limit !== null,
    isObjective: relation === null,
    isCompleteConstraint: relation !== null && limit !== null,
    isIncompleteConstraint: relation !== null && limit === null,
    limitFormula: limitFormula,
    limitDependsOnVariable: limitDependsOnVariable,
  };
}

function inertMessage_(subject, variables) {
  return subject + ' does not change when ' + variables + ' change, ' +
    'so there is nothing to optimise. The usual cause is a number stored as ' +
    'text in one of the columns it multiplies. Check for values that sit on ' +
    'the left of their cell.';
}

function senseFor_(label) {
  const text = String(label).toLowerCase();
  if (matchesAnyHint_(text, MINIMISE_HINTS)) return 'min';
  return 'max';
}

function gapIsEmpty_(grid, addressAt, from, to) {
  if (to - from > 3) return false;
  for (let position = from + 1; position < to; position++) {
    const entry = cellAt_(grid, addressAt(position));
    if (entry.formula) return false;
    if (entry.value !== '' && entry.value !== null && entry.value !== undefined) {
      return false;
    }
  }
  return true;
}

function pickObjective_(grid, candidates) {
  const unlimited = candidates.filter(function (cell) {
    return readConstraint_(grid, cell).guessed;
  });
  const pool = unlimited.length ? unlimited : candidates;

  let best = pool[0];
  let bestScore = -1;
  pool.forEach(function (cell) {
    const label = labelFor_(grid, cell).toLowerCase();
    let score = 0;
    if (matchesAnyHint_(label, MAXIMISE_HINTS)) score += 10;
    if (matchesAnyHint_(label, MINIMISE_HINTS)) score += 10;
    if (label.indexOf('total') !== -1) score += 3;
    if (score > bestScore) { bestScore = score; best = cell; }
  });
  return best;
}

function countTerms_(form) {
  let count = 0;
  for (const key in form.terms) if (form.terms[key]) count++;
  return count;
}

function matchesAnyHint_(label, hints) {
  for (let i = 0; i < hints.length; i++) {
    if (label.indexOf(hints[i]) !== -1) return true;
  }
  return false;
}

(function (root) {
var api = {
    ENGINE: ENGINE,
    detectModel_: detectModel_,
    solveModel_: solveModel_,
    detectLocale_: detectLocale_,
    normalizeFormula_: normalizeFormula_,
    normalizeValue_: normalizeValue_,
    isFormulaInput_: isFormulaInput_,
    formulaCellText_: formulaCellText_,
    classifyGridCell_: classifyGridCell_,
    optimise_: optimise_,
    classifyModel_: classifyModel_,
    buildVariableDomains_: buildVariableDomains_,
    feasibleAt_: feasibleAt_,
    dotProduct_: dotProduct_,
    pivot_: pivot_,
    finiteModel_: finiteModel_,
    validModelShape_: validModelShape_,
    senseFor_: senseFor_,
    loadGrid_: loadGrid_,
    readConstraint_: readConstraint_
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PlumlineEngine = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
