'use strict';
/* ============================================================================
   F6 — Examples library UI, POSITIVE contracts.
   ----------------------------------------------------------------------------
   Verifies the library is built from the F5 canonical projection (not a parallel
   hand-written catalogue), that the base HTML is semantic and usable with no JS,
   that search/filter/state logic is correct across the five locales, that i18n keys
   exist 5/5, and that scaling to #10 and to 60 records works with no UI code change.
   Node built-ins only; no browser, no dependency. Pure logic is exercised directly.
   ========================================================================== */
var fs = require('fs');
var path = require('path');

var SITE = path.join(__dirname, '..');
var pass = 0, fail = 0; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

// Extract each <article class="lib-card"> ... </article> block from the page HTML.
function extractCards(html) {
  var out = [];
  var re = /<article class="lib-card"[\s\S]*?<\/article>/g;
  var m;
  while ((m = re.exec(html)) !== null) out.push(m[0]);
  return out;
}
// True iff the card markup contains an anchor nested inside another anchor. Walks the
// anchor open/close tags in order and flags any second <a> opened before the first
// closes (a real DOM-invalid nested interactive control, which breaks a11y).
function hasNestedAnchor(cardHtml) {
  var re = /<a\b|<\/a>/gi;
  var depth = 0, m;
  while ((m = re.exec(cardHtml)) !== null) {
    if (m[0].toLowerCase() === '</a>') { if (depth > 0) depth--; }
    else { depth++; if (depth > 1) return true; }
  }
  return false;
}

var core = require(path.join(SITE, 'assets', 'examples-library-core.js'));
var library = require(path.join(SITE, 'src', 'shared', 'examples', 'f6', 'library.js'));
var project = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'project.js'));
var E = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'enums.js'));
var CATS = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'categories.js')).CATEGORIES;
var loadCanonical = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js')).loadCanonical;

var canonical = loadCanonical(SITE, { expectCount: 9 }).canonical;
var payload = library.libraryPayload(canonical);
var records = payload.examples;

// ---------------------------------------------------------------- ARCHITECTURE
(function () {
  ok('ARCH: exactly nine real examples', records.length === 9, String(records.length));
  ok('ARCH: payload locales are the five F5 locales', JSON.stringify(payload.locales) === JSON.stringify(E.LOCALES.slice()));
  ok('ARCH: payload categories are the ten canonical categories', payload.categories.length === CATS.length);
  // The record data equals what the F5 projectors produce (no re-stored parallel data).
  canonical.forEach(function (c) {
    var rec = records.filter(function (r) { return r.id === c.key; })[0];
    var facts = project.facetFacts(c);
    ok('ARCH: ' + c.key + ' category from F5 projection', rec.category === facts.category, rec.category);
    ok('ARCH: ' + c.key + ' modelType from F5 projection', rec.modelType === facts.modelType);
    ok('ARCH: ' + c.key + ' direction from F5 projection', rec.direction === facts.direction);
    ok('ARCH: ' + c.key + ' difficulty from F5 projection', rec.difficulty === facts.difficulty);
    ok('ARCH: ' + c.key + ' minutes from F5 projection', rec.minutes === facts.minutes);
    E.LOCALES.forEach(function (loc) {
      var d = project.searchDocument(c, loc);
      ok('ARCH: ' + c.key + '/' + loc + ' title from F5', rec.locales[loc].title === d.title);
      ok('ARCH: ' + c.key + '/' + loc + ' question from F5', rec.locales[loc].question === d.question);
    });
  });
  // Metadata-only payload: no grids, expected vectors, domains or baselines.
  var json = JSON.stringify(payload);
  ok('ARCH: payload carries no grid/expected/domains/baseline', !/\bgrid\b|expected|domains|baseline/.test(json));
  // Solver URL derives from the canonical slug.
  records.forEach(function (r) {
    ok('ARCH: ' + r.id + ' solver URL derives from slug', r.solverUrl === 'solver.html?ex=' + encodeURIComponent(r.slug));
  });
})();

// ---------------------------------------------------------------- BASE HTML (no-JS)
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  // Nine article cards, each with a data-ex-id and a solver link.
  var ids = (html.match(/data-ex-id="([a-z0-9-]+)"/g) || []).map(function (m) { return m.replace(/.*"([^"]+)".*/, '$1'); });
  ok('HTML: nine card entries in base HTML', ids.length === 9, String(ids.length));
  ok('HTML: card ids are the nine keys', JSON.stringify(ids.slice().sort()) === JSON.stringify(records.map(function (r) { return r.id; }).sort()));
  // Nine correct solver links present as anchors in the base HTML.
  records.forEach(function (r) {
    ok('HTML: base has solver link for ' + r.id, html.indexOf('href="' + r.solverUrl + '"') !== -1, r.solverUrl);
  });
  // Enhancement-only controls are gated behind lib-enh (hidden until js-lib).
  ok('HTML: search control is enhancement-gated', /class="lib-controls lib-enh"/.test(html));
  ok('HTML: has a real <label for="libSearch">', /<label[^>]*for="libSearch"/.test(html));
  ok('HTML: search input has search semantics', /<input[^>]*type="search"[^>]*id="libSearch"/.test(html) || /<input[^>]*id="libSearch"[^>]*type="search"/.test(html));
  ok('HTML: result count is an aria-live region', /id="libCount"[^>]*aria-live="polite"/.test(html));
  ok('HTML: empty state present and gated', /id="libEmpty"[^>]*hidden/.test(html) && /class="lib-empty lib-enh"/.test(html));
  ok('HTML: heading hierarchy — one h1', (html.match(/<h1\b/g) || []).length === 1);
  // No inline event handlers.
  ok('HTML: no inline onclick handlers', !/\son[a-z]+\s*=\s*"/.test(html.replace(/data-i18n[^=]*=/g, '')));
  // JSON-LD ItemList preserved (position/name/url for the nine).
  ok('HTML: ItemList JSON-LD preserved', /"@type":"ItemList"/.test(html) && (html.match(/"@type":"ListItem"/g) || []).length === 9);
  // Canonical + title/meta preserved.
  ok('HTML: canonical link preserved', /rel="canonical"[^>]*examples\.html/.test(html));
})();

// ---------------------------------------------------------------- SEARCH
(function () {
  // Normalization: lowercase, trim, whitespace collapse, diacritic fold.
  ok('SEARCH: lowercases + trims + collapses', core.normalizeQuery('  Foo   Bar  ') === 'foo bar');
  ok('SEARCH: folds diacritics (produccion == producción)', core.normalizeQuery('Producción') === core.normalizeQuery('produccion'));
  // Five-locale term matching against title/description/question/category/capabilities.
  function slugsFor(q, loc) { return core.filterExamples(records, { q: q }, loc).map(function (r) { return r.slug; }); }
  ok('SEARCH/en: title term "shipping"', slugsFor('shipping', 'en').indexOf('shipping-plan') !== -1);
  ok('SEARCH/en: question term "budget"', slugsFor('budget', 'en').indexOf('marketing-budget') !== -1);
  ok('SEARCH/es: "proveedores" -> supplier', slugsFor('proveedores', 'es').join(',') === 'supplier-activation');
  ok('SEARCH/es: diacritic "produccion" -> production', slugsFor('produccion', 'es').indexOf('production-plan') !== -1);
  ok('SEARCH/pt: "mistura" -> blend', slugsFor('mistura', 'pt').indexOf('cheapest-feed-blend') !== -1);
  ok('SEARCH/de: "personal" -> workforce', slugsFor('personal', 'de').indexOf('workforce-scheduling') !== -1);
  ok('SEARCH/fr: "fournisseurs" -> supplier', slugsFor('fournisseurs', 'fr').indexOf('supplier-activation') !== -1);
  ok('SEARCH: category id term matches', slugsFor('logistics', 'en').length >= 2);
  ok('SEARCH: no-match query returns none', slugsFor('zzzznotpresent', 'en').length === 0);
  ok('SEARCH: empty query returns all', slugsFor('', 'en').length === 9);
})();

// ---------------------------------------------------------------- FILTERS
(function () {
  function slugs(state) { return core.filterExamples(records, state, 'en').map(function (r) { return r.slug; }); }
  // Model type — subsets derived from the canonical facts, not hardcoded.
  ['continuous', 'integer', 'binary', 'mixed'].forEach(function (mt) {
    var expected = records.filter(function (r) { return r.modelType === mt; }).map(function (r) { return r.slug; });
    ok('FILTER: type ' + mt, JSON.stringify(slugs({ type: [mt] })) === JSON.stringify(expected), expected.join(','));
  });
  ok('FILTER: mixed is exactly supplier-activation', JSON.stringify(slugs({ type: ['mixed'] })) === '["supplier-activation"]');
  // Goal.
  ok('FILTER: maximise subset', JSON.stringify(slugs({ goal: ['maximise'] })) === JSON.stringify(records.filter(function (r) { return r.direction === 'max'; }).map(function (r) { return r.slug; })));
  ok('FILTER: minimise subset', JSON.stringify(slugs({ goal: ['minimise'] })) === JSON.stringify(records.filter(function (r) { return r.direction === 'min'; }).map(function (r) { return r.slug; })));
  // Difficulty.
  ['beginner', 'intermediate', 'advanced'].forEach(function (d) {
    var expected = records.filter(function (r) { return r.difficulty === d; }).map(function (r) { return r.slug; });
    ok('FILTER: difficulty ' + d, JSON.stringify(slugs({ difficulty: [d] })) === JSON.stringify(expected));
  });
  // Category — each populated category returns its members.
  var populated = core.countByCategory(records);
  Object.keys(populated).forEach(function (cat) {
    var expected = records.filter(function (r) { return r.category === cat; }).map(function (r) { return r.slug; });
    ok('FILTER: category ' + cat, JSON.stringify(slugs({ category: [cat] })) === JSON.stringify(expected));
  });
  // OR within a facet, AND across facets.
  ok('FILTER: OR within facet (integer OR binary)', slugs({ type: ['integer', 'binary'] }).length === 4);
  ok('FILTER: AND across facets (logistics AND integer)', JSON.stringify(slugs({ category: ['logistics-transport'], type: ['integer'] })) === '["shipping-plan"]');
  ok('FILTER: combined zero match', slugs({ category: ['blending-formulation'], type: ['binary'] }).length === 0);
})();

// ---------------------------------------------------------------- STATE / URL
(function () {
  var catIds = payload.categories.map(function (c) { return c.id; });
  function parse(qs) { return core.parseState(new URLSearchParams(qs), catIds); }
  // Round-trip.
  var s = { q: 'blend', category: ['logistics-transport'], type: ['integer'], difficulty: ['advanced'], goal: ['minimise'] };
  var qs = core.serializeState(s);
  var back = parse(qs);
  ok('STATE: round-trips q', back.q === 'blend');
  ok('STATE: round-trips facets', JSON.stringify(back.type) === '["integer"]' && JSON.stringify(back.difficulty) === '["advanced"]');
  // Unknown values ignored safely.
  ok('STATE: unknown category ignored', parse('category=not-a-real-category').category.length === 0);
  ok('STATE: unknown type ignored', parse('type=quantum').type.length === 0);
  ok('STATE: unknown difficulty ignored', parse('difficulty=impossible').difficulty.length === 0);
  ok('STATE: unknown goal ignored', parse('goal=satisfice').goal.length === 0);
  // Deterministic order + dedupe.
  ok('STATE: dedupes repeated values', JSON.stringify(parse('type=integer,integer').type) === '["integer"]');
  ok('STATE: mixes valid + invalid, keeps valid', JSON.stringify(parse('type=integer,quantum,binary').type) === '["integer","binary"]');
  // Encoded search survives.
  ok('STATE: encoded search survives', parse('q=' + encodeURIComponent('a b')).q === 'a b');
  // Empty state has empty query string.
  ok('STATE: empty serializes empty', core.serializeState({ q: '', category: [], type: [], difficulty: [], goal: [] }) === '');
  ok('STATE: isEmptyState true for empty', core.isEmptyState(parse('')) === true);
  ok('STATE: isEmptyState false with a facet', core.isEmptyState(parse('type=integer')) === false);
})();

// ---------------------------------------------------------------- i18n (5/5)
(function () {
  var i18n = read(path.join(SITE, 'assets', 'i18n.js'));
  var keys = ['libEyebrow', 'libIntroTitle', 'libIntroLead', 'libLibraryCount', 'libSearchLabel',
    'libSearchPlaceholder', 'libFilters', 'libCategory', 'libModelType', 'libDifficulty', 'libGoal',
    'libClearAll', 'libClearFilters', 'libResultsOne', 'libResultsMany', 'libResultsShown',
    'libNoResultsTitle', 'libNoResultsBody', 'libOpenSolver', 'libReadyToSolve', 'libMinutes',
    'libDecisions', 'libLimits', 'libDecisionsOne', 'libLimitsOne', 'libHowToTitle', 'libHowOpen',
    'libHowSolve', 'libHowChange', 'mt_continuous', 'mt_integer', 'mt_binary', 'mt_mixed',
    'diff_beginner', 'diff_intermediate', 'diff_advanced', 'goal_maximise', 'goal_minimise'];
  keys.forEach(function (k) {
    var occ = (i18n.match(new RegExp('\\b' + k + ':', 'g')) || []).length;
    ok('I18N: key ' + k + ' present 5/5', occ === 5, String(occ));
  });
  // No Italian block sneaked in (five locales only for these keys).
  ok('I18N: no Italian locale key block', i18n.indexOf("it:{") === -1 && !/\bit:\s*\{[^}]*libEyebrow/.test(i18n));
  // Category labels come from F5 (all five locales present per category).
  payload.categories.forEach(function (c) {
    ok('I18N: category ' + c.id + ' labelled 5/5', E.LOCALES.every(function (loc) { return c.label[loc] && c.short[loc]; }));
  });
})();

// ---------------------------------------------------------------- ACCESSIBILITY (static)
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  ok('A11Y: search has an explicit label element', /<label[^>]*for="libSearch"[^>]*>/.test(html));
  ok('A11Y: facet groups use fieldset/legend', (html.match(/<fieldset class="lib-facet-group">/g) || []).length >= 4);
  ok('A11Y: facet legends are labelled', (html.match(/class="lib-facet-legend"/g) || []).length >= 4);
  ok('A11Y: CTA is a real anchor with accessible text', /class="lib-cta"[^>]*href="solver\.html\?ex=/.test(html));
  ok('A11Y: clear is a real <button>', /<button[^>]*id="libClear"/.test(html));
  ok('A11Y: facet controls are native checkboxes', (html.match(/<input type="checkbox" data-facet=/g) || []).length >= 9);
  // Real per-card nested-anchor check (no always-true escape hatch): extract every card
  // and assert no anchor is nested inside another. A shared helper so the mutation test
  var cardsForA11y = extractCards(html);
  ok('A11Y: at least the 9 cards were extracted for the nested-anchor check', cardsForA11y.length >= 9, String(cardsForA11y.length));
  var nestedFound = cardsForA11y.some(function (card) { return hasNestedAnchor(card); });
  ok('A11Y: no nested anchors in any card', nestedFound === false);
  // No nested interactive: the title link and the CTA are siblings, not nested.
  ok('A11Y: title link and CTA are separate anchors', /class="lib-title-link"/.test(html) && /class="lib-cta"/.test(html));
})();

// A11Y mutation: the detector must FAIL for the RIGHT reason when a nested anchor is
// deliberately introduced into a card, and PASS on the same card unmutated.
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  var cards = extractCards(html);
  ok('A11Y-mut: a card is available to mutate', cards.length >= 1);
  if (!cards.length) return;
  var clean = cards[0];
  ok('A11Y-mut: unmutated card has no nested anchor', hasNestedAnchor(clean) === false);
  // Wrap the existing title link's inner text in a second anchor -> nested <a><a>.
  var mutated = clean.replace(
    /(<a class="lib-title-link"[^>]*>)([\s\S]*?)(<\/a>)/,
    '$1<a href="solver.html?ex=x">$2</a>$3'
  );
  ok('A11Y-mut: mutation actually introduced a nested anchor', mutated !== clean);
  ok('A11Y-mut: detector flags the deliberately nested anchor', hasNestedAnchor(mutated) === true);
})();

// -------------------------------------------------------------------------------------
// SCALABILITY (view-model only). NOTE ON TEST KINDS (audit item 8):
//   * The REAL canonical #10 END-TO-END INTEGRATION test lives in
//     engine/tests_canonical_10_end_to_end.js: it adds a genuinely F5-valid 10th record
//     to a temp catalogue and runs F5 loadCanonical -> F6 projector -> F6 generator ->
//     generated examples.html/JSON-LD -> F6 core. That is the test that proves the
//     data-bearing page is F7-ready.
//   * The two blocks BELOW are SYNTHETIC VIEW-MODEL SCALABILITY checks only. They feed
//     hand-made view-model records straight into the pure core to prove the filter/search/
//     count logic is not tied to exactly nine records. They deliberately do NOT exercise
//     F5, the projector, the generator, or the page. They are NOT equivalent to, and are
//     not a substitute for, the end-to-end integration test above.
// -------------------------------------------------------------------------------------
(function () {
  // SYNTHETIC view-model #10: a single hand-made record in an empty category, fed to the
  // core directly (NOT the canonical pipeline — see tests_canonical_10_end_to_end.js for
  // that). Proves the core counts/filters/searches a 10th record with no UI code change.
  var tenth = {
    id: 'future10', slug: 'future-example-10', category: 'energy-sustainability',
    modelType: 'continuous', direction: 'max', difficulty: 'beginner', minutes: 4,
    decisions: 2, limits: 1, chartEligible: false, capabilities: ['maximise'],
    solverUrl: 'solver.html?ex=future-example-10',
    locales: (function () { var o = {}; E.LOCALES.forEach(function (l) { o[l] = { title: 'Solar sizing', description: 'x', question: 'How much solar to install?' }; }); return o; })(),
  };
  var withTen = records.concat([tenth]);
  ok('SCALE/#10 (synthetic view-model): appears in an empty category filter', core.filterExamples(withTen, { category: ['energy-sustainability'] }, 'en').length === 1);
  ok('SCALE/#10 (synthetic view-model): category count updates', core.countByCategory(withTen)['energy-sustainability'] === 1);
  ok('SCALE/#10 (synthetic view-model): search finds it', core.filterExamples(withTen, { q: 'solar' }, 'en').map(function (r) { return r.id; }).indexOf('future10') !== -1);
  ok('SCALE/#10 (synthetic view-model): solver URL derived', tenth.solverUrl === 'solver.html?ex=' + tenth.slug);

  // SYNTHETIC 60-record view-model fixture — deformations of the nine, fed to the core.
  // A performance/scalability probe of the pure logic, NOT a canonical or engine-run set.
  var big = [];
  var mts = core.VALID_TYPES, diffs = core.VALID_DIFFICULTY, cats = payload.categories.map(function (c) { return c.id; });
  for (var i = 0; i < 60; i++) {
    var base = records[i % records.length];
    big.push({
      id: 'syn-' + i, slug: 'syn-' + i, category: cats[i % cats.length],
      modelType: mts[i % mts.length], direction: i % 2 ? 'max' : 'min',
      difficulty: diffs[i % diffs.length], minutes: 3 + (i % 10), decisions: 1 + (i % 8),
      limits: 1 + (i % 5), chartEligible: false, capabilities: base.capabilities.slice(),
      solverUrl: 'solver.html?ex=syn-' + i,
      locales: base.locales,
    });
  }
  ok('SCALE/60 (synthetic view-model): projection size is 60', big.length === 60);
  var seen = {}; var dup = false;
  big.forEach(function (r) { if (seen[r.id]) dup = true; seen[r.id] = true; });
  ok('SCALE/60 (synthetic view-model): no duplicate ids', !dup);
  ok('SCALE/60 (synthetic view-model): category filtering works', core.filterExamples(big, { category: [cats[0]] }, 'en').length === big.filter(function (r) { return r.category === cats[0]; }).length);
  ok('SCALE/60 (synthetic view-model): combined facets work', core.filterExamples(big, { type: ['integer'], goal: ['maximise'] }, 'en').every(function (r) { return r.modelType === 'integer' && r.direction === 'max'; }));
  var filtered = core.filterExamples(big, {}, 'en').map(function (r) { return r.id; });
  ok('SCALE/60 (synthetic view-model): order is deterministic (canonical input order)', JSON.stringify(filtered) === JSON.stringify(big.map(function (r) { return r.id; })));
  var t0 = Date.now(); core.filterExamples(big, { q: 'x' }, 'en'); var elapsed = Date.now() - t0;
  ok('SCALE/60 (synthetic view-model): filter is synchronous', typeof core.filterExamples(big, {}, 'en').length === 'number' && elapsed < 1000);
})();

// ---------------------------------------------------------------- PROTECTION (references)
(function () {
  // F6 does not re-store the nine slugs/keys as a parallel hand-written catalogue in
  // the runtime; the payload asset is generated from F5.
  var gen = read(path.join(SITE, 'assets', 'examples-library.js'));
  ok('PROT: library asset is marked generated', /GENERATED by/.test(gen) && /PL_LIBRARY/.test(gen));
  // The UI reads window.PL_LIBRARY, not an inline catalogue.
  var ui = read(path.join(SITE, 'assets', 'examples-library.ui.js'));
  ok('PROT: UI consumes PL_LIBRARY projection', /window\.PL_LIBRARY/.test(ui));
  ok('PROT: UI has no hardcoded nine slugs', !records.some(function (r) { return ui.indexOf(r.slug) !== -1; }));
  // Category labels are not hand-duplicated in examples.html (they carry a data-cat-label
  // hook and the F5 label; the runtime repaints from the projection).
  var htmlF6 = read(path.join(SITE, 'examples.html'));
  ok('PROT: category labels carry a projection hook', /data-cat-label="/.test(htmlF6));
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F6 EXAMPLES LIBRARY  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
