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
  'tests_capabilities', 'tests_home_capabilities', 'tests_jsonld_features', 'tests_home_i18n', 'tests_gen_stability', 'tests_doc_hub', 'tests_doc_hub_i18n', 'tests_status_coverage', 'tests_home_seo', 'tests_site_hygiene', 'tests_home_render', 'tests_home_faq', 'tests_i18n_coverage', 'tests_composed_reads', 'tests_shell_b1', 'tests_shell_composition_negative', 'tests_shell_golden', 'tests_spaces_path', 'tests_build_badge', 'tests_shared_behavior', 'tests_shell_isolation', 'tests_shared_behavior_negative', 'tests_css_golden', 'tests_css_structure', 'tests_css_negative', 'tests_legal_pages', 'tests_legal_pages_negative', 'tests_guide_page', 'tests_guide_page_negative', 'tests_examples_page', 'tests_examples_page_negative', 'tests_capabilities_page', 'tests_capabilities_page_negative', 'tests_capabilities_generator', 'tests_home_page', 'tests_home_page_negative', 'tests_home_generator', 'tests_solver_grid', 'tests_solver_grid_negative', 'tests_solver_detection', 'tests_solver_detection_negative', 'tests_solver_execution', 'tests_solver_execution_negative', 'tests_solver_visualization', 'tests_solver_visualization_negative', 'tests_solver_interface_final', 'tests_solver_interface_final_negative', 'tests_no_selfgen_golden', 'tests_needle_audit', 'tests_engine_integrity', 'tests_engine_baseline', 'tests_engine_baseline_negative', 'tests_canonical_engine_source', 'tests_canonical_engine_source_positive', 'tests_canonical_engine_source_negative', 'tests_e1_needle_audit', 'tests_canonical_parser_frontend', 'tests_canonical_parser_frontend_positive', 'tests_canonical_parser_frontend_negative', 'tests_e2_needle_audit', 'tests_canonical_model_continuous', 'tests_canonical_model_continuous_positive', 'tests_canonical_model_continuous_negative', 'tests_e3_needle_audit', 'tests_canonical_integer_branch_and_bound', 'tests_canonical_integer_branch_and_bound_positive', 'tests_canonical_integer_branch_and_bound_negative', 'tests_e4_needle_audit', 'tests_canonical_verification_statuses', 'tests_canonical_verification_statuses_positive', 'tests_canonical_verification_statuses_negative', 'tests_e5_needle_audit', 'tests_e6_worker_mirror', 'tests_e6_worker_mirror_positive', 'tests_e6_worker_mirror_negative', 'tests_e6_needle_audit',
  'tests_examples_i18n_projection',
  'tests_examples_data_projection',
  'tests_examples_page_projection',
  'tests_home_capabilities_refs',
  'tests_examples_solve_parity',
  'tests_canonical_catalogue_positive',
  'tests_canonical_catalogue_negative',
  'tests_canonical_catalogue_needle_audit',
  'tests_f2_visual_nav',
  'tests_f3a_hero', 'tests_f3b_home_sections', 'tests_f3c_home_sections', 'tests_f3c_home_sections_negative'
];

module.exports = SUITES;
