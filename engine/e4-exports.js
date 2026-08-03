/* e4-exports.js — the SINGLE authority for the Checkpoint E4 closed export list.
 *
 * E4 covers canonical INTEGER / BINARY / MIXED solving and BRANCH-AND-BOUND:
 * integer indices, whole-number detection, binary/mixed domain metadata,
 * integrality, branch-variable selection, node creation, node bounds, the search
 * tree, depth, node count, incumbent, pruning, node/depth/time limits, integer
 * result reconstruction, and the dispatch from optimise_ to the non-continuous
 * path.
 *
 * E4 does NOT redefine public status/stopReason/optimalityProven semantics
 * (E5), independent solution verification (E5), localised messages (E5),
 * accessible announcements (UI), Worker glue/orchestration (E6), or the mirror
 * (E6). Those functions are NOT here and are unreachable through the E4 harness.
 *
 * This list is a SEPARATE closed set. It does not copy E2 or E3. The harness
 * serves E2, E3 and E4 from ONE infrastructure but never merges the phases'
 * export sets.
 */
'use strict';

// name -> category (see PHASE_CATEGORIES below).
const E4_FUNCTIONS = {
  // --- integer / branch-and-bound core (B/C/D/E/F/G/H) ---
  solveIntegerProgram_: 'branch-and-bound',   // DFS node solve + incumbent + pruning + limits
  isWhole_: 'integrality',                    // integrality test (tolerance 1e-6)
  // --- shared integer/binary/mixed metadata (A, shared E3/E4) ---
  integerIndices_: 'integer-indices',
  buildVariableDomains_: 'domain-metadata',
  classifyModel_: 'model-classification',     // continuous/integer/binary/mixed
  // --- continuous relaxation reused per node (E3, needed as a node solver) ---
  solveLinearProgram_: 'node-relaxation',
  feasibleAt_: 'node-feasibility',
  // --- dispatcher (D, mixed E3/E4; the integer path is E4) ---
  optimise_: 'dispatcher',
};

const E4_EXPORTS = Object.keys(E4_FUNCTIONS).slice();

// E5-E6 functions: explicitly forbidden through the E4 harness. These are the
// final-status / verification (E5) and Worker/mirror (E6) surfaces. They are
// named here so the harness can reject any attempt to expose one as E4.
const FORBIDDEN_E5_E6 = [
  'solveModel_',      // E5-adjacent: adapts the internal result to the receipt / final status
  'describeModel_',   // E5/UI: presentation of the model type
];

// Functions that belong to other phases and must NOT appear in the E4 set.
const E2_ONLY = [
  'tokenize_', 'parseAddress_', 'columnIndex_', 'columnLetter_', 'expandRange_',
  'expandReference_', 'cellAt_', 'referencedCells_', 'listFormulaCells_',
  'isFormulaInput_', 'formulaCellText_', 'classifyGridCell_', 'detectLocale_',
  'normalizeFormula_', 'normalizeValue_', 'compareValues_', 'parseCriterionOperand_',
  'matchesCriterion_', 'linearize_', 'safeLinearize_', 'candidateIsLinear_',
];
const E3_ONLY = [
  'detectModel_', 'readConstraint_', 'senseFor_', 'pickObjective_',
  'reachableConstants_', 'dependsOnVariables_', 'applyBounds_',
  'normalizeConstraint_', 'pivot_', 'finiteModel_', 'validModelShape_',
  'loadGrid_', 'newContext_', 'coefficientVector_',
];

const PHASE_CATEGORIES = {
  A: 'integer/binary/mixed metadata shared E3/E4',
  B: 'integrality (E4)',
  C: 'branch selection (E4)',
  D: 'node construction (E4)',
  E: 'node solve (E4)',
  F: 'incumbent/pruning (E4)',
  G: 'limits (E4)',
  H: 'internal integer result (E4, adapted at E5)',
  I: 'verification/status (E5) — forbidden',
  J: 'Worker (E6) — forbidden',
  K: 'shared helper',
};

module.exports = {
  E4_FUNCTIONS: E4_FUNCTIONS,
  E4_EXPORTS: E4_EXPORTS,
  FORBIDDEN_E5_E6: FORBIDDEN_E5_E6,
  E2_ONLY: E2_ONLY,
  E3_ONLY: E3_ONLY,
  PHASE_CATEGORIES: PHASE_CATEGORIES,
};
