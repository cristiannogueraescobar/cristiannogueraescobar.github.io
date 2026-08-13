/**
 * tests_examples.js — every built-in example must solve to its declared
 * expected result, and pass verification. An example that drifts from its
 * expected value is a real regression in a verifiability product.
 *
 * The EXAMPLES object is parsed out of solver.html so the test always checks
 * exactly what ships. Run: node engine/tests_examples.js
 */
const fs = require('fs');
const path = require('path');
// E1: the engine and the app script live in the COMPOSED solver, not the raw
// source (which now holds the SOLVER_ENGINE_SOURCE marker and UI fragment
// markers). Compose once; this is a functional read via the canonical compositor.
const { composedHtml } = require('./composed-html.js');
const html = composedHtml(path.join(__dirname, '..'), 'solver.html');
const SHARED = require(path.join(__dirname, '..', 'assets', 'examples-data.js'));

// Load the inline engine.
const a = html.indexOf('/* ENGINE_START */'), b = html.indexOf('/* ENGINE_END */');
eval(html.slice(a, b));

// Pull the EXAMPLES literal from the app script.
const app = html.split('<script>').filter(s => s.includes('var EXAMPLES='))[0].split('</script>')[0];
eval(app.match(/var EXAMPLES=\{[\s\S]*?\n  \};/)[0]);

function mk(g) {
  const isF = x => typeof x === 'string' && x.charAt(0) === '=' && !({ '<=':1, '>=':1, '=':1 }[x]);
  const f = [], v = [];
  for (let r = 0; r < g.length; r++) {
    const fr = [], vr = [];
    for (let c = 0; c < g[r].length; c++) {
      const raw = String(g[r][c]);
      if (isF(raw)) { fr.push(raw); vr.push(0); }
      else { fr.push(''); vr.push(raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw); }
    }
    f.push(fr); v.push(vr);
  }
  return { getDataRange: () => ({ getRow: () => 1, getColumn: () => 1, getFormulas: () => f, getValues: () => v }) };
}

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const META_BY_KEY = {};
SHARED.META.forEach(m => META_BY_KEY[m.key] = m);

Object.keys(EXAMPLES).forEach(function (key) {
  const ex = EXAMPLES[key];
  const meta = META_BY_KEY[key] || {};
  const sheet = mk(ex.grid);
  const model = detectModel_(sheet);
  model.objective.sense = meta.sense;   // sense lives in the shared metadata now
  model.wholeNumbers = !!ex.whole;
  let expectedVarCount = null;
  if (ex.domains) {
    const cells = expandRange_(loadGrid_(sheet), model.variables);
    expectedVarCount = cells.length;
    const integer = [], bounds = [];
    cells.forEach(function (cell, i) {
      const d = ex.domains[cell];
      if (!d) return;
      if (d.type === 'binary') { integer.push(i); bounds[i] = { lower: 0, upper: 1 }; }
      else if (d.type === 'integer') { integer.push(i); bounds[i] = { lower: d.min == null ? 0 : d.min, upper: d.max == null ? null : d.max }; }
      else { bounds[i] = { lower: d.min == null ? 0 : d.min, upper: d.max == null ? null : d.max }; }
    });
    model.domains = { integer: ex.whole ? true : (integer.length ? integer : null), bounds: bounds.length ? bounds : null };
  }
  const out = solveModel_(sheet, model);
  const exp = ex.expected || {};
  const tol = exp.tolerance || 1e-6;
  const verified = (out.constraints || []).every(c => c.satisfied) && (out.variableDomains || []).every(d => d.satisfied);
  ok(key + ' status', out.status === exp.status, 'got ' + out.status);
  if (exp.modelType) ok(key + ' modelType', out.modelType === exp.modelType, 'got ' + out.modelType);
  if (exp.objective != null) ok(key + ' objective', typeof out.objective === 'number' && Math.abs(out.objective - exp.objective) <= tol, 'got ' + out.objective + ' expected ' + exp.objective);
  ok(key + ' verified', verified);
  if (out.status === 'optimal') ok(key + ' optimalityProven', out.optimalityProven === true);
  if (expectedVarCount != null) ok(key + ' variable count', (out.values || []).length === expectedVarCount, 'got ' + (out.values || []).length);
  // Every example carries a complete expected block (objective + tolerance for
  // the ones with a numeric optimum).
  ok(key + ' has expected.objective', exp.objective != null || key === '__none__');
});

// ===== shared metadata is the single source for slug/category/type/sense ==
(function () {
  const meta = {};
  SHARED.META.forEach(m => meta[m.key] = m);
  ok('meta count matches EXAMPLES count', SHARED.META.length === Object.keys(EXAMPLES).length,
     SHARED.META.length + ' vs ' + Object.keys(EXAMPLES).length);
  Object.keys(EXAMPLES).forEach(function (key) {
    const ex = EXAMPLES[key], m = meta[key];
    ok(key + ' has shared metadata', !!m);
    if (!m) return;
    // These fields now live ONLY in the shared meta; EXAMPLES must not duplicate them.
    ok(key + ' slug only in meta', ex.slug === undefined);
    ok(key + ' category only in meta', ex.category === undefined);
    ok(key + ' sense only in meta', ex.sense === undefined);
    // The example's solved model type must still match the meta's declared type.
    if (ex.expected && ex.expected.modelType) ok(key + ' expected type matches meta', ex.expected.modelType === m.type, ex.expected.modelType + ' vs ' + m.type);
  });
  const slugs = SHARED.META.map(m => m.slug);
  ok('shared slugs unique', new Set(slugs).size === slugs.length);
  ok('all categories in order list', SHARED.META.every(m => SHARED.CATEGORY_ORDER.indexOf(m.category) >= 0));
})();

// ===== static SEO content in examples.html matches shared metadata ======
(function () {
  const exHtml = fs.readFileSync(path.join(__dirname, '..', 'examples.html'), 'utf8');
  const metaSlugs = SHARED.META.map(m => m.slug);
  // F6 (Examples library UI): the nine examples are now rendered as visible base-HTML
  // cards that are usable with NO JavaScript (a strict improvement over the old
  // <noscript>-only link list — the links are no longer hidden behind <noscript>).
  // Contract: the nine solver links must be present as real anchors in the base HTML
  // (outside any <script>), each exactly once, and usable without JS.
  const baseHtml = exHtml.replace(/<script[\s\S]*?<\/script>/g, '');
  const baseHrefs = [...baseHtml.matchAll(/solver\.html\?ex=([a-z0-9-]+)/g)].map(m => m[1]);
  metaSlugs.forEach(function (slug) {
    const n = baseHrefs.filter(function (s) { return s === slug; }).length;
    ok('base HTML has a no-JS solver link for ' + slug, n >= 1, 'count ' + n);
  });
  // Each example appears as a semantic card entry exactly once.
  const cardIds = [...exHtml.matchAll(/data-ex-id="([a-z0-9-]+)"/g)].map(m => m[1]);
  ok('base HTML renders one card per catalogue example', cardIds.length === metaSlugs.length, 'got ' + cardIds.length + ' of ' + metaSlugs.length);
  ok('F7a: base HTML renders 24 example cards', cardIds.length === 24, 'got ' + cardIds.length);
  ok('no duplicate example cards', new Set(cardIds).size === cardIds.length);
  const ldMatch = exHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  ok('examples.html has JSON-LD', !!ldMatch);
  if (ldMatch) {
    let ld = null;
    try { ld = JSON.parse(ldMatch[1]); } catch (e) {}
    ok('ItemList parses', ld !== null && ld['@type'] === 'ItemList');
    if (ld && ld.itemListElement) {
      const urlSlugs = ld.itemListElement.map(it => (it.url.match(/ex=([a-z-]+)/) || [])[1]);
      ok('ItemList has one item per catalogue example', ld.itemListElement.length === metaSlugs.length, 'got ' + ld.itemListElement.length + ' of ' + metaSlugs.length);
      ok('F7a: ItemList has 24 items', ld.itemListElement.length === 24, 'got ' + ld.itemListElement.length);
      metaSlugs.forEach(function (slug) { ok('ItemList includes ' + slug, urlSlugs.indexOf(slug) >= 0); });
      const positions = ld.itemListElement.map(it => it.position);
      const expectedPositions = metaSlugs.map((_, i) => i + 1).join(',');
      ok('ItemList positions are 1..N contiguous', positions.join(',') === expectedPositions, positions.join(','));
    }
  }
})();

// ===== slug resolution: canonical slugs and short keys both resolve ======
(function () {
  const bySlug = {};
  Object.keys(EXAMPLES).forEach(function (key) { bySlug[key] = key; });
  SHARED.META.forEach(function (m) { if (EXAMPLES[m.key] && m.slug) bySlug[m.slug] = m.key; });
  const expectSlug = {
    'production-plan': 'production', 'workshop-chart': 'workshop', 'cheapest-feed-blend': 'blend',
    'marketing-budget': 'marketing', 'workforce-scheduling': 'workforce', 'shipping-plan': 'shipping',
    'project-selection': 'project', 'delivery-load': 'delivery', 'supplier-activation': 'supplier'
  };
  Object.keys(expectSlug).forEach(function (slug) {
    ok('slug ' + slug + ' -> ' + expectSlug[slug], bySlug[slug] === expectSlug[slug], 'got ' + bySlug[slug]);
  });
  // Short keys still resolve (back-compat).
  ok('short key project resolves', bySlug['project'] === 'project');
  // Unknown slug resolves to nothing (caller falls back to production).
  ok('unknown slug -> undefined', bySlug['no-such-example'] === undefined);
  // Every example has a unique slug.
  const slugs = SHARED.META.map(m => m.slug);
  ok('all examples have a slug', slugs.every(Boolean));
  ok('slugs are unique', new Set(slugs).size === slugs.length);
})();

console.log('EXAMPLE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
