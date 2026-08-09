'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — canonical ENUMS / controlled vocabularies.
   ----------------------------------------------------------------------------
   ONE place for every closed vocabulary the F5 metadata layer uses, so string
   literals are never copied across modules. Plain JavaScript, no dependency.

   These enums extend the F1 catalogue (which already owns key/slug/type/sense/
   grid/expected). F5 does NOT change the F1 catalogue vocabularies; it adds the
   editorial/classification vocabularies the future library (F6), the expansion to
   60 examples (F7) and the SEO projection (F11) will consume.
   ========================================================================== */

// Publishable locales — exactly five, no Italian. Order is the canonical order.
var LOCALES = ['en', 'es', 'pt', 'de', 'fr'];

// The ten canonical roadmap categories (F7 taxonomy). IDs are stable, kebab-case.
// CATEGORY_IDS is DERIVED from CATEGORY_CONTRACT below, so there is no second manual
// list that could drift. Labels are localized in the category registry, not here.

// FROZEN canonical contract for category ID + slug + order, INDEPENDENT of the
// registry's labels/shorts. F5 fixes this now so F6 can rely on it: the registry
// must reproduce exactly these ids, slugs and orders (validated separately).
var CATEGORY_CONTRACT = [
  { id: 'production-operations', slug: 'production-operations', order: 1 },
  { id: 'workforce-scheduling', slug: 'workforce-scheduling', order: 2 },
  { id: 'purchasing-suppliers', slug: 'purchasing-suppliers', order: 3 },
  { id: 'logistics-transport', slug: 'logistics-transport', order: 4 },
  { id: 'marketing-finance', slug: 'marketing-finance', order: 5 },
  { id: 'blending-formulation', slug: 'blending-formulation', order: 6 },
  { id: 'education-social', slug: 'education-social', order: 7 },
  { id: 'energy-sustainability', slug: 'energy-sustainability', order: 8 },
  { id: 'hospitality-retail', slug: 'hospitality-retail', order: 9 },
  { id: 'learning-engine', slug: 'learning-engine', order: 10 },
];

// Editorial difficulty — small closed enum. Difficulty is authored, not derived.
var DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

// Audience vocabulary — small and realistic; an example may list several.
var AUDIENCES = ['general', 'business', 'student'];

// Provenance kinds. `synthetic` = realistic data authored for teaching/demo.
// `sourced` reserved for when a real public source is genuinely used (F7+).
var PROVENANCE_KINDS = ['synthetic', 'sourced'];

// Expected-result verification policies.
//   'exact'               — verify status + objective + specific decision vector.
//   'objective-feasible'  — verify status + objective + feasibility only (used when
//                           multiple decision vectors reach the same optimum).
//   'status-only'         — verify the STATUS only (no objective, no decision vector,
//                           no feasibility). The correct policy for no-solution
//                           statuses (infeasible/unbounded), where the engine
//                           legitimately returns no incumbent.
var RESULT_POLICIES = ['exact', 'objective-feasible', 'status-only'];

// Model types the engine can produce (mirror of the catalogue's VALID_TYPES).
var MODEL_TYPES = ['continuous', 'integer', 'binary', 'mixed'];

// Objective senses.
var SENSES = ['max', 'min'];

// Every status the engine can return.
var ENGINE_STATUSES = ['optimal', 'feasible', 'incomplete', 'unknown', 'infeasible', 'unbounded'];
// Kept as STATUSES for backward compatibility (mirror of the catalogue's VALID_STATUSES).
var STATUSES = ENGINE_STATUSES;

// Statuses an F5/F7 example may PUBLISH as an expected result — only those with a
// reproducible, audited contract. optimal/feasible carry a real incumbent;
// infeasible/unbounded are status-only (verified against the real engine). unknown
// and incomplete are deliberately NOT publishable: the engine does not give them a
// deterministic, reproducible contract, so F5 refuses them as an expected status
// rather than guessing. Revisit only if a deterministic semantics is audited.
var PUBLISHABLE_EXPECTED_STATUSES = ['optimal', 'feasible', 'infeasible', 'unbounded'];

// Status classification for the behavioural verifier. SOLUTION-BEARING statuses
// carry a real incumbent (objective + decision vector + constraints); NO-SOLUTION
// statuses legitimately do not, so the verifier must not demand a fake objective or
// feasible vector for them. Verified against the REAL engine output:
//   infeasible -> status only, objective undefined, values undefined, no constraints
//   unbounded  -> status only, objective undefined, values undefined, no constraints
var SOLUTION_BEARING_STATUSES = ['optimal', 'feasible'];
var NO_SOLUTION_STATUSES = ['infeasible', 'unbounded'];

// Capability IDs an example may claim to DEMONSTRATE. Every entry here must be a
// feature the Plumline engine actually supports; unsupported claims (e.g. COUNTIF,
// nonlinear) are rejected by the validator. Kept deliberately small and true.
var CAPABILITY_IDS = [
  'continuous-variables',
  'integer-variables',
  'binary-variables',
  'mixed-variables',
  'bounds',
  'maximise',
  'minimise',
  'sum',            // SUM()
  'sumproduct',     // SUMPRODUCT()
  'chart-eligible', // two-variable continuous model -> feasible-region chart
  'eu-number-format',
  'us-number-format',
  'verification',   // result checked back against the sheet formulas
];

// Default numeric tolerance for expected-objective comparison. An example may
// override with a justified tighter/looser value, floor-checked by the validator.
var DEFAULT_TOLERANCE = 1e-6;
var MIN_TOLERANCE = 1e-12;   // tighter than this is meaningless at double precision
var MAX_TOLERANCE = 1e-2;    // looser than this could hide a wrong result

// Estimated exploration time (minutes) — authored integer, sane bounds. This is
// time to UNDERSTAND/EXPLORE the example, never the solver's run time.
var MIN_MINUTES = 1;
var MAX_MINUTES = 120;

// The current schema version for an F5 canonical metadata record.
var SCHEMA_VERSION = 1;

// CATEGORY_IDS is DERIVED from the frozen contract — no second manual list.
var CATEGORY_IDS = CATEGORY_CONTRACT.map(function (c) { return c.id; });

// Deep-freeze every closed canonical vocabulary so no consumer can mutate a
// contract at runtime (and a coupled mutation cannot bypass validation). Small,
// dependency-free — not a framework.
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    Object.freeze(o);
  }
  return o;
}
[LOCALES, CATEGORY_CONTRACT, CATEGORY_IDS, DIFFICULTIES, AUDIENCES, PROVENANCE_KINDS,
 RESULT_POLICIES, MODEL_TYPES, SENSES, STATUSES, ENGINE_STATUSES, PUBLISHABLE_EXPECTED_STATUSES,
 SOLUTION_BEARING_STATUSES, NO_SOLUTION_STATUSES, CAPABILITY_IDS].forEach(deepFreeze);

module.exports = {
  LOCALES: LOCALES,
  CATEGORY_IDS: CATEGORY_IDS,
  CATEGORY_CONTRACT: CATEGORY_CONTRACT,
  DIFFICULTIES: DIFFICULTIES,
  AUDIENCES: AUDIENCES,
  PROVENANCE_KINDS: PROVENANCE_KINDS,
  RESULT_POLICIES: RESULT_POLICIES,
  MODEL_TYPES: MODEL_TYPES,
  SENSES: SENSES,
  STATUSES: STATUSES,
  ENGINE_STATUSES: ENGINE_STATUSES,
  PUBLISHABLE_EXPECTED_STATUSES: PUBLISHABLE_EXPECTED_STATUSES,
  SOLUTION_BEARING_STATUSES: SOLUTION_BEARING_STATUSES,
  NO_SOLUTION_STATUSES: NO_SOLUTION_STATUSES,
  CAPABILITY_IDS: CAPABILITY_IDS,
  DEFAULT_TOLERANCE: DEFAULT_TOLERANCE,
  MIN_TOLERANCE: MIN_TOLERANCE,
  MAX_TOLERANCE: MAX_TOLERANCE,
  MIN_MINUTES: MIN_MINUTES,
  MAX_MINUTES: MAX_MINUTES,
  SCHEMA_VERSION: SCHEMA_VERSION,
};
