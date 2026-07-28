/* Shared public metadata for the built-in examples.
 *
 * This is the SINGLE SOURCE OF TRUTH for an example's slug, category, model
 * type and objective direction. Both the solver's Examples drawer and the
 * standalone examples.html read it, so a change here updates both.
 *
 * The full grids, per-variable domains and expected results stay in solver.html
 * (they are only needed where models are actually solved). The internal `key`
 * here must match the key in solver.html's EXAMPLES object; a test asserts that.
 */
(function (root) {
  var META = [
    { key: 'production', slug: 'production-plan',      category: 'start',    type: 'continuous', sense: 'max' },
    { key: 'workshop',   slug: 'workshop-chart',       category: 'start',    type: 'continuous', sense: 'max' },
    { key: 'blend',      slug: 'cheapest-feed-blend',  category: 'start',    type: 'continuous', sense: 'min' },
    { key: 'marketing',  slug: 'marketing-budget',     category: 'business', type: 'continuous', sense: 'max' },
    { key: 'workforce',  slug: 'workforce-scheduling', category: 'business', type: 'integer',    sense: 'min' },
    { key: 'shipping',   slug: 'shipping-plan',        category: 'business', type: 'integer',    sense: 'min' },
    { key: 'project',    slug: 'project-selection',    category: 'binary',   type: 'binary',     sense: 'max' },
    { key: 'delivery',   slug: 'delivery-load',        category: 'binary',   type: 'binary',     sense: 'max' },
    { key: 'supplier',   slug: 'supplier-activation',  category: 'binary',   type: 'mixed',      sense: 'min' }
  ];
  var CATEGORY_ORDER = ['start', 'business', 'binary'];

  root.PL_EXAMPLE_META = META;
  root.PL_CATEGORY_ORDER = CATEGORY_ORDER;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { META: META, CATEGORY_ORDER: CATEGORY_ORDER };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
