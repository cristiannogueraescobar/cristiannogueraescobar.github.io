/* e3-exports.js — the SINGLE authority for the Checkpoint E3 closed export list.
 *
 * E3 covers canonical MODEL CONSTRUCTION and CONTINUOUS solving (context, grid,
 * variable selection/order, objective, direction, constraints, operators, RHS,
 * coefficient vectors/matrices, constraint normalisation, bounds, free/fixed
 * variables, domain metadata, continuous model classification, standard form,
 * tableau, continuous simplex, pivot, continuous optimal/unbounded/infeasible at
 * the INTERNAL level).
 *
 * E3 does NOT cover branch-and-bound, integer/binary/mixed solving, node/time
 * limits, Worker orchestration, final public status semantics, error
 * translation, UI, or engine/engine.js reconciliation. Those functions are NOT
 * here and are unreachable through the E3 harness phase.
 *
 * This list is NOT a copy of the E2 list. It is a separate closed set. The
 * harness serves E2 and E3 from the same infrastructure but never mixes the two
 * phases' export sets.
 */
'use strict';

// name -> category (see PHASE_CATEGORIES below).
const E3_FUNCTIONS = {
  // --- model construction (A) ---
  detectModel_: 'model-construction',
  solveModel_: 'model-construction',      // builds the model then calls optimise_ (continuous path is E3)
  readConstraint_: 'model-construction',  // APPROVED DIVERGENCE with the mirror
  senseFor_: 'model-construction',
  pickObjective_: 'model-construction',
  describeModel_: 'model-construction',
  reachableConstants_: 'model-construction',
  dependsOnVariables_: 'model-construction',
  // --- bounds + domain metadata (B) ---
  applyBounds_: 'bounds',
  buildVariableDomains_: 'domains',
  integerIndices_: 'domains-metadata',    // reads integer metadata; does NOT branch
  classifyModel_: 'model-classification',
  // --- continuous simplex (C) ---
  optimise_: 'dispatcher',                // continuous path (solveLinearProgram_) is E3; integer path is E4
  solveLinearProgram_: 'continuous-simplex',
  normalizeConstraint_: 'continuous-simplex',
  pivot_: 'continuous-simplex',
  feasibleAt_: 'continuous-feasibility',
  finiteModel_: 'model-guard',
  validModelShape_: 'model-guard',
  // --- shared context builders / front-end reused by model construction (I) ---
  loadGrid_: 'context-builder',
  newContext_: 'context-builder',         // APPROVED DIVERGENCE with the mirror
  coefficientVector_: 'coefficients',
};

const E3_EXPORTS = Object.keys(E3_FUNCTIONS).slice();

// E4-E6 functions: explicitly forbidden through the E3 harness.
const FORBIDDEN_E4_E6 = [
  'solveIntegerProgram_', // E4 branch-and-bound
  'isWhole_',             // E4 integer feasibility test
];

// Functions that are E2-only and must NOT appear in the E3 set (parser/tokeniser
// front-end). Listed so the checker can assert the two phases stay distinct.
const E2_ONLY = [
  'tokenize_', 'parseAddress_', 'columnIndex_', 'columnLetter_', 'expandRange_',
  'expandReference_', 'cellAt_', 'referencedCells_', 'listFormulaCells_',
  'isFormulaInput_', 'formulaCellText_', 'classifyGridCell_', 'detectLocale_',
  'normalizeFormula_', 'normalizeValue_', 'compareValues_', 'parseCriterionOperand_',
  'matchesCriterion_', 'linearize_', 'safeLinearize_', 'candidateIsLinear_',
];

const PHASE_CATEGORIES = {
  A: 'model construction (E3)',
  B: 'bounds + domain metadata (E3)',
  C: 'continuous simplex (E3)',
  D: 'mixed E3/E4 (dispatcher; continuous path only is E3)',
  E: 'branch-and-bound (E4) — forbidden',
  F: 'verification/status (E5) — forbidden',
  G: 'Worker/integration (E6) — forbidden',
  H: 'UI/plot — not engine',
  I: 'shared helper',
};

module.exports = {
  E3_FUNCTIONS: E3_FUNCTIONS,
  E3_EXPORTS: E3_EXPORTS,
  FORBIDDEN_E4_E6: FORBIDDEN_E4_E6,
  E2_ONLY: E2_ONLY,
  PHASE_CATEGORIES: PHASE_CATEGORIES,
};
