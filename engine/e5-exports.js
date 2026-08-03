/* e5-exports.js — the SINGLE authority for the Checkpoint E5 closed export list.
 *
 * E5 covers canonical SOLUTION VERIFICATION, FINAL STATUSES, STOP REASONS,
 * optimalityProven, the final result adaptation, and the status-vs-error
 * separation: independent objective recomputation, constraint / bound /
 * integrality / binary checks, final feasibility, numeric consistency, result
 * shape validation, adaptation of the internal solve result into the final
 * engine result, the final statuses the engine produces, stop reasons,
 * optimalityProven, nodesExplored and the technical-error vs mathematical-status
 * distinction.
 *
 * E5 does NOT touch the Worker (Blob/glue/postMessage/stale/cancel/fallback, E6),
 * the mirror reconciliation (E6), translations, UI, accessible announcements,
 * plot, exports, or algorithms. Those functions are NOT here and are unreachable
 * through the E5 harness.
 *
 * This list is a SEPARATE closed set. It does not copy E2, E3 or E4. The harness
 * serves every phase from one infrastructure but never merges the export sets.
 */
'use strict';

// name -> category (see PHASE_CATEGORIES below).
const E5_FUNCTIONS = {
  // --- B: final result adaptation (internal solve result -> final engine result) ---
  solveModel_: 'result-adaptation',           // builds status/stopReason/optimalityProven/values/objective/constraints/variableDomains
  // --- A: independent mathematical verification ---
  isSatisfied_: 'constraint-verification',    // <=, >=, = with 1e-6 tolerance
  feasibleAt_: 'point-feasibility',           // shape + finiteness + every-constraint re-check
  buildVariableDomains_: 'bound-integer-binary-verification',
  isWhole_: 'integrality-verification',       // 1e-6 tolerance
  dotProduct_: 'objective-recompute',         // recomputes objective / constraint LHS
  // --- C/D/E: status / stop reason / technical error text ---
  explainStatus_: 'status-explanation',       // maps a final status to its explanatory text
  // --- J: shape / finiteness guards used by verification ---
  validModelShape_: 'shape-guard',
  finiteModel_: 'finiteness-guard',
};

const E5_EXPORTS = Object.keys(E5_FUNCTIONS).slice();

// E6 functions: forbidden through the E5 harness. Worker Blob/glue/postMessage,
// stale/cancel/fallback, and mirror reconciliation live in E6.
const FORBIDDEN_E6 = [
  'buildWorkerSource_',   // Worker Blob source assembly (E6) — placeholder name; guard rejects any Worker glue
  'engineSource_',        // engine-source slice for the Worker (E6)
];

// Functions that belong to other phases and must NOT appear in the E5 set.
const E4_ONLY = ['solveIntegerProgram_', 'integerIndices_'];
const E3_ONLY = [
  'detectModel_', 'readConstraint_', 'senseFor_', 'pickObjective_',
  'reachableConstants_', 'dependsOnVariables_', 'applyBounds_',
  'normalizeConstraint_', 'pivot_', 'loadGrid_', 'newContext_',
  'coefficientVector_', 'optimise_', 'solveLinearProgram_', 'classifyModel_',
];
const E2_ONLY = [
  'tokenize_', 'parseAddress_', 'expandRange_', 'linearize_', 'safeLinearize_',
  'compareValues_', 'matchesCriterion_',
];

const PHASE_CATEGORIES = {
  A: 'mathematical verification (E5)',
  B: 'result adaptation (E5)',
  C: 'final status (E5)',
  D: 'stop reason (E5)',
  E: 'technical error (E5)',
  F: 'model construction (E3)',
  G: 'branch-and-bound (E4)',
  H: 'Worker (E6) — forbidden',
  I: 'UI/localisation — outside the engine',
  J: 'shared helper',
};

module.exports = {
  E5_FUNCTIONS: E5_FUNCTIONS,
  E5_EXPORTS: E5_EXPORTS,
  FORBIDDEN_E6: FORBIDDEN_E6,
  E4_ONLY: E4_ONLY,
  E3_ONLY: E3_ONLY,
  E2_ONLY: E2_ONLY,
  PHASE_CATEGORIES: PHASE_CATEGORIES,
};
