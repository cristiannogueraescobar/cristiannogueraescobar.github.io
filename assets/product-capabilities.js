/* product-capabilities.js — SINGLE SOURCE OF TRUTH for Plumline's PUBLIC
 * PRODUCT CAPABILITIES.
 *
 * SCOPE: this is the list of user-facing things Plumline can do, as a customer
 * would describe them — NOT an exhaustive inventory of every internal parser or
 * engine behaviour. Many internal guards, normalisation steps and edge-case
 * handlers exist that are NOT listed here because they are implementation
 * details, not product capabilities. Read this as "what Plumline does for you",
 * not "every code path the engine has". The test suite covers the internals;
 * this file covers the promises.
 *
 * Every public claim about the product (the Home capabilities section, the
 * capabilities page, the guide's feature table, the JSON-LD featureList, the
 * FAQ, the Marketplace listing) should be generated from THIS file, so a
 * capability is described in exactly one place and can never go stale in one
 * surface while being updated in another.
 *
 * Each capability is VERIFIABLE against a specific demonstrating case:
 *   - nameKey / descriptionKey  public name + description strings in i18n.js
 *     (separate, because Home, Guide, SEO and accessibility use them
 *     differently — a short name vs. a full sentence).
 *   - testFile     the test file that protects this capability.
 *   - testMarker   a unique anchor string placed in that test file next to the
 *                  block that exercises this capability (a "CAPABILITY: <id>"
 *                  comment). The validator checks the marker is PRESENT in the
 *                  file AND that the file actually runs in CI (registered in
 *                  run_all.js) — so a capability cannot claim a test that no
 *                  longer covers it, nor one that exists on disk but never runs.
 *   - exampleId    an example key in examples-data.js that demonstrates it, or
 *                  null.
 *   - exampleStatus  'covered' | 'not-applicable' | 'pending':
 *                    covered        -> requires a real exampleId.
 *                    not-applicable -> requires exampleNotApplicable and forbids
 *                                      an exampleId (an infrastructure capability
 *                                      that applies to every model, not one).
 *                    pending        -> no public demonstration exists yet, so it
 *                                      MUST NOT be public until an example is
 *                                      added. It stays in the inventory but out
 *                                      of the public claims and the public page.
 *   - docsPath / docsAnchor  where this capability is documented. When public,
 *                  the validator requires the anchor to exist on that page, so
 *                  a public capability can never be undocumented. These
 *                  currently point at the guide's existing sections; once the
 *                  dedicated capabilities.html page is generated, they will be
 *                  repointed to a per-capability anchor there.
 *   - public       EXPLICIT, per capability — NOT derived. "Available + tested +
 *                  translated" does not by itself mean "should be advertised";
 *                  that is a product decision made here. The validator does not
 *                  choose what is public; it only enforces that anything marked
 *                  public IS available, documented, translated and tested.
 *
 * A companion test (tests_capabilities.js) asserts every nameKey/descriptionKey
 * exists in all five languages, every testFile+testMarker resolves and runs in
 * CI, every exampleId is real or null, and every public capability is available
 * and documented — so this file cannot claim something the codebase does not
 * back up.
 *
 * status: 'available' | 'experimental' | 'planned'.
 * group:  'models' | 'spreadsheet' | 'verification' | 'explanation'.
 *
 * Runs in the browser (window.PL_CAPABILITIES) and in Node (module.exports),
 * exactly like examples-data.js.
 */
(function (root) {
  // Languages every currently-available capability is delivered in. Keep in
  // sync with the i18n locales; a test asserts these match.
  var ALL_LANGS = ['en', 'es', 'pt', 'de', 'fr'];

  var CAPABILITIES = [
    {
      id: 'model-continuous',
      group: 'models',
      status: 'available',
      nameKey: 'capModelContinuousName',
      descriptionKey: 'capModelContinuousDesc',
      langs: ALL_LANGS,
      testFile: 'tests.js',
      testMarker: 'CAPABILITY: model-continuous',
      exampleId: 'production',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'Linear relationships only; non-linear formulas are rejected, not approximated.'
    },
    {
      id: 'model-integer',
      group: 'models',
      status: 'available',
      nameKey: 'capModelIntegerName',
      descriptionKey: 'capModelIntegerDesc',
      langs: ALL_LANGS,
      testFile: 'tests_bounds.js',
      testMarker: 'CAPABILITY: model-integer',
      exampleId: 'workforce',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'Whole-number variables; larger integer models take longer to prove optimal.'
    },
    {
      id: 'model-binary',
      group: 'models',
      status: 'available',
      nameKey: 'capModelBinaryName',
      descriptionKey: 'capModelBinaryDesc',
      langs: ALL_LANGS,
      testFile: 'tests_panel.js',
      testMarker: 'CAPABILITY: model-binary',
      exampleId: 'project',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'Each binary decision is 0 or 1 (yes/no).'
    },
    {
      id: 'model-mixed',
      group: 'models',
      status: 'available',
      nameKey: 'capModelMixedName',
      descriptionKey: 'capModelMixedDesc',
      langs: ALL_LANGS,
      testFile: 'tests_bounds.js',
      testMarker: 'CAPABILITY: model-mixed',
      exampleId: 'supplier',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'Mixes continuous and integer/binary variables in one model.'
    },
    {
      id: 'model-direction',
      group: 'models',
      status: 'available',
      nameKey: 'capModelDirectionName',
      descriptionKey: 'capModelDirectionDesc',
      langs: ALL_LANGS,
      testFile: 'tests_direction.js',
      testMarker: 'CAPABILITY: model-direction',
      exampleId: 'production',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'Maximise or minimise; the detected direction can be confirmed manually.'
    },
    {
      id: 'model-single-variable',
      group: 'models',
      status: 'available',
      nameKey: 'capModelSingleVariableName',
      descriptionKey: 'capModelSingleVariableDesc',
      langs: ALL_LANGS,
      testFile: 'tests_single_var.js',
      testMarker: 'CAPABILITY: model-single-variable',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'A genuine one-variable model is detected without needing a second decision.'
    },
    {
      id: 'model-per-variable-bounds',
      group: 'models',
      status: 'available',
      nameKey: 'capModelPerVariableBoundsName',
      descriptionKey: 'capModelPerVariableBoundsDesc',
      langs: ALL_LANGS,
      testFile: 'tests_bounds.js',
      testMarker: 'CAPABILITY: model-per-variable-bounds',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'Individual minimum and maximum per decision variable, set in Variable Settings.'
    },
    {
      id: 'sheet-formula-limits',
      group: 'spreadsheet',
      status: 'available',
      nameKey: 'capSheetFormulaLimitsName',
      descriptionKey: 'capSheetFormulaLimitsDesc',
      langs: ALL_LANGS,
      testFile: 'tests.js',
      testMarker: 'CAPABILITY: sheet-formula-limits',
      exampleId: 'production',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'A constraint limit can be a number or a formula; a limit that depends on a decision variable is rejected.'
    },
    {
      id: 'sheet-sumif',
      group: 'spreadsheet',
      status: 'available',
      nameKey: 'capSheetSumifName',
      descriptionKey: 'capSheetSumifDesc',
      langs: ALL_LANGS,
      testFile: 'tests_sumif_criteria.js',
      testMarker: 'CAPABILITY: sheet-sumif',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'SUM, SUMIF (numeric and text criteria) and other linear formulas; non-linear functions are rejected.'
    },
    {
      id: 'sheet-locale-us',
      group: 'spreadsheet',
      status: 'available',
      nameKey: 'capSheetLocaleUsName',
      descriptionKey: 'capSheetLocaleUsDesc',
      langs: ALL_LANGS,
      testFile: 'tests_locale.js',
      testMarker: 'CAPABILITY: sheet-locale-us',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'US number format: 1.5 decimals and SUM(A,B) argument separators.'
    },
    {
      id: 'sheet-locale-eu',
      group: 'spreadsheet',
      status: 'available',
      nameKey: 'capSheetLocaleEuName',
      descriptionKey: 'capSheetLocaleEuDesc',
      langs: ALL_LANGS,
      testFile: 'tests_locale.js',
      testMarker: 'CAPABILITY: sheet-locale-eu',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'European number format: 1,5 decimals and SUM(A;B) separators; auto-detected or set manually. No thousands grouping.'
    },
    {
      id: 'sheet-paste',
      group: 'spreadsheet',
      status: 'available',
      nameKey: 'capSheetPasteName',
      descriptionKey: 'capSheetPasteDesc',
      langs: ALL_LANGS,
      testFile: 'tests_grid_input.js',
      testMarker: 'CAPABILITY: sheet-paste',
      exampleId: null,
      exampleStatus: 'not-applicable',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      exampleNotApplicable: 'Input capability — demonstrated across every example, not a specific model',
      limits: 'Paste a spreadsheet-shaped range from Excel or Google Sheets, or type into the grid.'
    },
    {
      id: 'sheet-export',
      group: 'spreadsheet',
      status: 'available',
      nameKey: 'capSheetExportName',
      descriptionKey: 'capSheetExportDesc',
      langs: ALL_LANGS,
      testFile: 'tests_worker_parity.js',
      testMarker: 'CAPABILITY: sheet-export',
      exampleId: null,
      exampleStatus: 'not-applicable',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      exampleNotApplicable: 'Infrastructure capability — applies to every solved model',
      limits: 'Export results as CSV or Excel, or copy a plain-text summary.'
    },
    {
      id: 'verify-objective',
      group: 'verification',
      status: 'available',
      nameKey: 'capVerifyObjectiveName',
      descriptionKey: 'capVerifyObjectiveDesc',
      langs: ALL_LANGS,
      testFile: 'tests.js',
      testMarker: 'CAPABILITY: verify-objective',
      exampleId: 'production',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      limits: 'The reported objective is recomputed from your formulas at the solution.'
    },
    {
      id: 'verify-constraints',
      group: 'verification',
      status: 'available',
      nameKey: 'capVerifyConstraintsName',
      descriptionKey: 'capVerifyConstraintsDesc',
      langs: ALL_LANGS,
      testFile: 'tests.js',
      testMarker: 'CAPABILITY: verify-constraints',
      exampleId: 'production',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      limits: 'Every constraint is re-checked against the solved values.'
    },
    {
      id: 'verify-statuses',
      group: 'verification',
      status: 'available',
      nameKey: 'capVerifyStatusesName',
      descriptionKey: 'capVerifyStatusesDesc',
      langs: ALL_LANGS,
      testFile: 'tests_states.js',
      testMarker: 'CAPABILITY: verify-statuses',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      limits: 'Distinguishes proven-optimal, feasible-without-proof, incomplete search, infeasible and unbounded.'
    },
    {
      id: 'verify-reject-unsafe',
      group: 'verification',
      status: 'available',
      nameKey: 'capVerifyRejectUnsafeName',
      descriptionKey: 'capVerifyRejectUnsafeDesc',
      langs: ALL_LANGS,
      testFile: 'tests_strict.js',
      testMarker: 'CAPABILITY: verify-reject-unsafe',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      limits: 'Rejects models it cannot interpret safely (strict inequalities, real non-linearity, variable-dependent limits) instead of guessing.'
    },
    {
      id: 'run-local',
      group: 'verification',
      status: 'available',
      nameKey: 'capRunLocalName',
      descriptionKey: 'capRunLocalDesc',
      langs: ALL_LANGS,
      testFile: 'tests_worker_parity.js',
      testMarker: 'CAPABILITY: run-local',
      exampleId: null,
      exampleStatus: 'not-applicable',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      exampleNotApplicable: 'Infrastructure capability — applies to every solved model',
      limits: 'Solving runs in your browser (a background worker, with a synchronous fallback); the model is not uploaded to a server.'
    },
    {
      id: 'explain-detection',
      group: 'explanation',
      status: 'available',
      nameKey: 'capExplainDetectionName',
      descriptionKey: 'capExplainDetectionDesc',
      langs: ALL_LANGS,
      testFile: 'tests.js',
      testMarker: 'CAPABILITY: explain-detection',
      exampleId: 'production',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      limits: 'Reads the objective, decision cells and constraints from the sheet and shows what it understood before solving.'
    },
    {
      id: 'explain-solve-details',
      group: 'explanation',
      status: 'available',
      nameKey: 'capExplainSolveDetailsName',
      descriptionKey: 'capExplainSolveDetailsDesc',
      langs: ALL_LANGS,
      testFile: 'tests_states.js',
      testMarker: 'CAPABILITY: explain-solve-details',
      exampleId: null,
      exampleStatus: 'pending',
      public: false,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      limits: 'Shows stop reason, nodes explored and solve time.'
    },
    {
      id: 'explain-marginal',
      group: 'explanation',
      status: 'available',
      nameKey: 'capExplainMarginalName',
      descriptionKey: 'capExplainMarginalDesc',
      langs: ALL_LANGS,
      testFile: 'tests.js',
      testMarker: 'CAPABILITY: explain-marginal',
      exampleId: 'production',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      limits: 'For eligible binding constraints in continuous models, estimates how much the objective could improve if the limit increased by one unit.'
    },
    {
      id: 'explain-region-chart',
      group: 'explanation',
      status: 'available',
      nameKey: 'capExplainRegionChartName',
      descriptionKey: 'capExplainRegionChartDesc',
      langs: ALL_LANGS,
      testFile: 'tests_region_plot.js',
      testMarker: 'CAPABILITY: explain-region-chart',
      exampleId: 'workshop',
      exampleStatus: 'covered',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      limits: 'Draws the feasible region for two-variable models, bounded or unbounded, within a practical numeric range.'
    },
    {
      id: 'explain-multilingual',
      group: 'explanation',
      status: 'available',
      nameKey: 'capExplainMultilingualName',
      descriptionKey: 'capExplainMultilingualDesc',
      langs: ALL_LANGS,
      testFile: 'tests_i18n_pages.js',
      testMarker: 'CAPABILITY: explain-multilingual',
      exampleId: null,
      exampleStatus: 'not-applicable',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'limits',
      exampleNotApplicable: 'Infrastructure capability — applies across the whole interface',
      limits: 'Interface and explanations in English, Spanish, Portuguese, German and French.'
    },
    {
      id: 'explain-error-localisation',
      group: 'explanation',
      status: 'available',
      nameKey: 'capExplainErrorLocalisationName',
      descriptionKey: 'capExplainErrorLocalisationDesc',
      langs: ALL_LANGS,
      testFile: 'tests_error_i18n.js',
      testMarker: 'CAPABILITY: explain-error-localisation',
      exampleId: null,
      exampleStatus: 'not-applicable',
      public: true,
      docsPath: 'guide.html',
      docsAnchor: 'status',
      exampleNotApplicable: 'Infrastructure capability — applies to every engine message',
      limits: 'Engine errors are shown in the active language on every display path.'
    }
  ];

  var GROUP_ORDER = ['models', 'spreadsheet', 'verification', 'explanation'];
  var STATUSES = ['available', 'experimental', 'planned'];

  var api = {
    CAPABILITIES: CAPABILITIES,
    GROUP_ORDER: GROUP_ORDER,
    STATUSES: STATUSES,
    ALL_LANGS: ALL_LANGS
  };

  root.PL_CAPABILITIES = CAPABILITIES;
  root.PL_CAPABILITY_GROUPS = GROUP_ORDER;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
