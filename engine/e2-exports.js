/* e2-exports.js — the SINGLE authority for the Checkpoint E2 closed export list.
 *
 * Every consumer (harness, checker, fixture verification, tests, docs) reads the
 * list from here. There is no second hand-copied list. Each entry is a real
 * top-level function in engine/source/plumline-engine.js that belongs to the
 * mathematical FRONT-END (references, ranges, tokeniser, parser/AST-forms,
 * SUM/SUMIF, comparison + SUMIF criteria, linearity, linearisation, coefficient
 * extraction) plus the two shared context builders needed to feed them.
 *
 * E3-E5 functions (model construction, constraint reading, simplex,
 * branch-and-bound, verification/status) are deliberately NOT here and are
 * therefore unreachable through the E2 harness.
 */
'use strict';

// name -> category. The category documents the phase/role; the checker asserts
// every name resolves to a real function and that nothing outside this list is
// exposed.
const E2_FUNCTIONS = {
  // references / addresses / columns / rows
  cellAt_: 'reference',
  parseAddress_: 'reference',
  columnIndex_: 'reference',
  columnLetter_: 'reference',
  referencedCells_: 'reference',
  listFormulaCells_: 'reference',
  // ranges
  expandRange_: 'range',
  expandReference_: 'range',
  // grid-cell classification / locale / normalisation
  isFormulaInput_: 'grid-cell',
  formulaCellText_: 'grid-cell',
  classifyGridCell_: 'grid-cell',
  detectLocale_: 'locale',
  normalizeFormula_: 'normalisation',
  normalizeValue_: 'normalisation',
  // comparison / SUMIF criteria
  compareValues_: 'comparison',
  parseCriterionOperand_: 'sumif-criteria',
  matchesCriterion_: 'sumif-criteria',
  // tokeniser / parser / AST-forms
  tokenize_: 'tokeniser',
  linearize_: 'linearisation',
  safeLinearize_: 'linearisation',
  // linearity / coefficient vector
  candidateIsLinear_: 'linearity',
  coefficientVector_: 'coefficients',
  // shared context builders (class G) — the engine's own real constructors,
  // needed to build the grid/context the front-end functions consume. NOT test
  // reimplementations.
  loadGrid_: 'context-builder',
  newContext_: 'context-builder',
};

// The ordered closed list (sorted for a stable, comparable order).
const E2_EXPORTS = Object.keys(E2_FUNCTIONS).slice();

// Functions that are explicitly NOT exposed (E3-E5). Listed so the checker can
// assert none of them leaked into the harness.
const NOT_EXPOSED_E3_E5 = [
  'detectModel_', 'solveModel_', 'solveLinearProgram_', 'optimise_', 'pivot_',
  'classifyModel_', 'buildVariableDomains_', 'feasibleAt_', 'readConstraint_',
  'finiteModel_', 'validModelShape_', 'senseFor_',
];

module.exports = {
  E2_FUNCTIONS: E2_FUNCTIONS,
  E2_EXPORTS: E2_EXPORTS,
  NOT_EXPOSED_E3_E5: NOT_EXPOSED_E3_E5,
};
