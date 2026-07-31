/* suites.js — the single, authoritative list of test modules that run in CI.
 *
 * Both run_all.js (the runner) and tests_capabilities.js (which checks that
 * every capability's test actually runs) import this, so the validator never
 * has to parse run_all.js's source text to learn what runs. Add a new test
 * module here and it is both executed and recognised as "runs in CI".
 */
const SUITES = [
  'tests', 'tests_states', 'tests_bounds', 'tests_worker_token', 'tests_panel',
  'tests_safety', 'tests_strict', 'tests_sumif_criteria', 'tests_single_var',
  'tests_examples', 'tests_jsonld', 'tests_assets', 'tests_i18n_pages',
  'tests_direction', 'tests_structure', 'tests_worker_parity', 'tests_nav_menu',
  'tests_solve_announce', 'tests_ex_drawer', 'tests_grid_a11y', 'tests_contrast',
  'tests_error_i18n', 'tests_region_plot', 'tests_locale', 'tests_grid_input',
  'tests_capabilities', 'tests_home_capabilities', 'tests_jsonld_features', 'tests_home_i18n', 'tests_gen_stability', 'tests_doc_hub', 'tests_doc_hub_i18n', 'tests_status_coverage', 'tests_home_seo', 'tests_site_hygiene', 'tests_home_render', 'tests_home_faq'
];

module.exports = SUITES;
