'use strict';
/* ============================================================================
   F6 — Examples library, BEHAVIOURAL.
   ----------------------------------------------------------------------------
   Exercises the REAL library functions (core state/search/filter/URL/reset) as the
   browser binding uses them, over the current nine, a future #10 temp fixture, and a
   60-record synthetic library, in the five locales. This is the behaviour a user
   drives — not a source regex. A tiny fake "controls + URL" harness mirrors the DOM
   binding's read/write cycle without a real browser.
   ========================================================================== */
var path = require('path');
var fs = require('fs');
var SITE = path.join(__dirname, '..');
var pass = 0, fail = 0; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

var core = require(path.join(SITE, 'assets', 'examples-library-core.js'));
var library = require(path.join(SITE, 'src', 'shared', 'examples', 'f6', 'library.js'));
var E = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'enums.js'));
var loadCanonical = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js')).loadCanonical;

var canonical = loadCanonical(SITE, { expectCount: 9 }).canonical;
var payload = library.libraryPayload(canonical);
var records = payload.examples;
var catIds = payload.categories.map(function (c) { return c.id; });

// A fake harness that mirrors the DOM binding: it holds a URL string, parses state
// from it, applies the filter, and reports the visible ids + count + empty flag. Its
// setState() mirrors the production writeState() in assets/examples-library.ui.js EXACTLY:
// it feeds core.stateEntries(state) straight into a native URLSearchParams via
// params.set(key, rawValue), preserving ?lang=, unrelated params and the URL hash, and
// NEVER rebuilds the query string from serializeState()/split('&')/decodeURIComponent
// (that path round-trips "a b" through "a+b" and corrupts multi-word searches).
function makeHarness(initialUrl, locale) {
  var url = initialUrl || 'examples.html';
  function search() {
    var q = url.indexOf('?'); if (q === -1) return '';
    var h = url.indexOf('#'); return h === -1 ? url.slice(q + 1) : url.slice(q + 1, h);
  }
  function pathname() { var q = url.indexOf('?'), h = url.indexOf('#'); var end = q === -1 ? (h === -1 ? url.length : h) : q; return url.slice(0, end); }
  function hash() { var h = url.indexOf('#'); return h === -1 ? '' : url.slice(h); }
  function state() { return core.parseState(new URLSearchParams(search()), catIds); }
  function apply() {
    var visible = core.filterExamples(records, state(), locale || 'en');
    return { ids: visible.map(function (r) { return r.id; }), count: visible.length, empty: visible.length === 0 };
  }
  function setState(next) {
    var params = new URLSearchParams(search());                                 // preserve lang + unrelated params
    ['q', 'category', 'type', 'difficulty', 'goal'].forEach(function (k) { params.delete(k); });
    core.stateEntries(next).forEach(function (pair) { params.set(pair[0], pair[1]); });  // raw values, native encoding
    var str = params.toString();
    url = pathname() + (str ? '?' + str : '') + hash();                          // preserve the URL hash
  }
  return { getUrl: function () { return url; }, state: state, apply: apply, setState: setState };
}

// ---- current nine: initial render ----
(function () {
  var h = makeHarness('examples.html', 'en');
  var r = h.apply();
  ok('BEH: initial shows all nine', r.count === 9 && !r.empty);
})();

// ---- search cycle ----
(function () {
  var h = makeHarness('examples.html', 'en');
  h.setState({ q: 'supplier', category: [], type: [], difficulty: [], goal: [] });
  var r = h.apply();
  ok('BEH: search supplier -> one', r.count === 1 && r.ids[0] === 'supplier');
  ok('BEH: search writes q to URL', h.getUrl().indexOf('q=supplier') !== -1);
})();

// ---- category filter ----
(function () {
  var h = makeHarness('examples.html', 'en');
  h.setState({ q: '', category: ['production-operations'], type: [], difficulty: [], goal: [] });
  var r = h.apply();
  ok('BEH: category production-operations -> two', r.count === 2);
  ok('BEH: category in URL', h.getUrl().indexOf('category=production-operations') !== -1);
})();

// ---- combined filter ----
(function () {
  var h = makeHarness('examples.html', 'en');
  h.setState({ q: '', category: ['logistics-transport'], type: ['integer'], difficulty: [], goal: [] });
  var r = h.apply();
  ok('BEH: logistics AND integer -> shipping only', r.count === 1 && r.ids[0] === 'shipping');
})();

// ---- no results ----
(function () {
  var h = makeHarness('examples.html', 'en');
  h.setState({ q: 'zzznotathing', category: [], type: [], difficulty: [], goal: [] });
  var r = h.apply();
  ok('BEH: no-match -> empty state', r.count === 0 && r.empty === true);
})();

// ---- reset ----
(function () {
  var h = makeHarness('examples.html?q=foo&type=integer&lang=es', 'en');
  h.setState({ q: '', category: [], type: [], difficulty: [], goal: [] });
  var r = h.apply();
  ok('BEH: reset restores all nine', r.count === 9);
  ok('BEH: reset preserves lang', h.getUrl().indexOf('lang=es') !== -1);
  ok('BEH: reset removes q + facets', h.getUrl().indexOf('q=') === -1 && h.getUrl().indexOf('type=') === -1);
})();

// ---- initial URL -> state (shared filtered link) ----
(function () {
  var h = makeHarness('examples.html?category=marketing-finance&type=binary&lang=de', 'de');
  var r = h.apply();
  ok('BEH: shared link restores filtered view', r.count === 1 && r.ids[0] === 'project');
  ok('BEH: shared link keeps lang param', h.getUrl().indexOf('lang=de') !== -1);
})();

// ---- unrelated params preserved ----
(function () {
  var h = makeHarness('examples.html?utm=abc&lang=fr', 'fr');
  h.setState({ q: 'blend', category: [], type: [], difficulty: [], goal: [] });
  ok('BEH: unrelated params preserved', h.getUrl().indexOf('utm=abc') !== -1 && h.getUrl().indexOf('lang=fr') !== -1);
})();

// ---- five-locale search ----
(function () {
  var terms = {
    en: ['shipping', 'shipping-plan'], es: ['proveedores', 'supplier-activation'],
    pt: ['mistura', 'cheapest-feed-blend'], de: ['personal', 'workforce-scheduling'],
    fr: ['fournisseurs', 'supplier-activation'],
  };
  E.LOCALES.forEach(function (loc) {
    var h = makeHarness('examples.html', loc);
    h.setState({ q: terms[loc][0], category: [], type: [], difficulty: [], goal: [] });
    var r = h.apply();
    ok('BEH/' + loc + ': search "' + terms[loc][0] + '"', r.ids.map(function (id) { return records.filter(function (x) { return x.id === id; })[0].slug; }).indexOf(terms[loc][1]) !== -1);
  });
})();

// ---- future #10 temp fixture: full cycle ----
(function () {
  var tenth = {
    id: 'future10', slug: 'future-example-10', category: 'hospitality-retail',
    modelType: 'integer', direction: 'max', difficulty: 'intermediate', minutes: 5,
    decisions: 3, limits: 2, chartEligible: false, capabilities: ['maximise'],
    solverUrl: 'solver.html?ex=future-example-10',
    locales: (function () { var o = {}; E.LOCALES.forEach(function (l) { o[l] = { title: 'Table mix', description: 'x', question: 'Which tables to seat?' }; }); return o; })(),
  };
  var withTen = records.concat([tenth]);
  ok('BEH/#10: filter finds it in a previously-empty category', core.filterExamples(withTen, { category: ['hospitality-retail'] }, 'en').map(function (r) { return r.id; }).join(',') === 'future10');
  ok('BEH/#10: search finds it', core.filterExamples(withTen, { q: 'tables' }, 'en').map(function (r) { return r.id; }).indexOf('future10') !== -1);
  ok('BEH/#10: counted in category counts', core.countByCategory(withTen)['hospitality-retail'] === 1);
})();

// ---- 60-record library: full behaviour ----
(function () {
  var mts = core.VALID_TYPES, diffs = core.VALID_DIFFICULTY, cats = catIds;
  var big = [];
  for (var i = 0; i < 60; i++) {
    var base = records[i % records.length];
    big.push({ id: 'syn-' + i, slug: 'syn-' + i, category: cats[i % cats.length], modelType: mts[i % mts.length], direction: i % 2 ? 'max' : 'min', difficulty: diffs[i % diffs.length], minutes: 3 + (i % 10), decisions: 1 + (i % 8), limits: 1 + (i % 5), chartEligible: false, capabilities: base.capabilities.slice(), solverUrl: 'solver.html?ex=syn-' + i, locales: base.locales });
  }
  ok('BEH/60: all render with empty state', core.filterExamples(big, {}, 'en').length === 60);
  ok('BEH/60: type filter subset correct', core.filterExamples(big, { type: ['binary'] }, 'en').every(function (r) { return r.modelType === 'binary'; }));
  ok('BEH/60: category filter subset correct', core.filterExamples(big, { category: [cats[2]] }, 'en').every(function (r) { return r.category === cats[2]; }));
  ok('BEH/60: combined facets AND', core.filterExamples(big, { type: ['integer'], difficulty: ['advanced'] }, 'en').every(function (r) { return r.modelType === 'integer' && r.difficulty === 'advanced'; }));
  var order = core.filterExamples(big, {}, 'en').map(function (r) { return r.id; });
  ok('BEH/60: deterministic order', JSON.stringify(order) === JSON.stringify(big.map(function (r) { return r.id; })));
})();

// ---- URL round-trip regression (audit fix): the harness mirrors production writeState,
//      so a multi-word search survives state -> URL -> state exactly, and the space stays
//      a space (never "+"). Also proves lang / unrelated params / hash are preserved. ----
(function () {
  function roundTrip(q, initial) {
    var h = makeHarness(initial || 'examples.html', 'en');
    h.setState({ q: q, category: [], type: [], difficulty: [], goal: [] });
    return { url: h.getUrl(), q: h.state().q };
  }
  // THE audit case: q = "a b" must round-trip to "a b", and the space must serialize as
  // "+" in the query but decode back to a real space (not the literal "a+b").
  var ab = roundTrip('a b');
  ok('BEH/URL: q="a b" round-trips to exactly "a b"', ab.q === 'a b', JSON.stringify(ab.q));
  ok('BEH/URL: q="a b" serializes the space as "+" in the query', ab.url.indexOf('q=a+b') !== -1, ab.url);
  ok('BEH/URL: q="a b" is NOT corrupted into "a+b" on reload', ab.q !== 'a+b');

  // Reinforcing cases that share the same contract (no scope creep beyond URL fidelity).
  [['cheapest feed', 'cheapest feed'], ['production plan', 'production plan'],
   ['café résumé', 'café résumé'], ['a + b', 'a + b'], ['100% done', '100% done'],
   ['a & b', 'a & b']].forEach(function (pair) {
    var r = roundTrip(pair[0]);
    ok('BEH/URL: q="' + pair[0] + '" round-trips exactly', r.q === pair[1], JSON.stringify(r.q));
  });
  // A literal "+" must encode as %2B (so it is distinguishable from a space).
  ok('BEH/URL: a literal "+" encodes as %2B', roundTrip('a + b').url.indexOf('%2B') !== -1);

  // lang + unrelated param + hash are preserved through setState.
  var pre = roundTrip('a b', 'examples.html?lang=de&foo=bar#how');
  ok('BEH/URL: lang preserved', pre.url.indexOf('lang=de') !== -1, pre.url);
  ok('BEH/URL: unrelated param preserved', pre.url.indexOf('foo=bar') !== -1, pre.url);
  ok('BEH/URL: hash preserved', pre.url.slice(-4) === '#how', pre.url);
  ok('BEH/URL: q still exact with lang+unrelated+hash present', pre.q === 'a b', JSON.stringify(pre.q));
})();

// ---- structural guard: neither the behavioural harness nor the production binding may
//      reconstruct the query string by hand. This fails specifically if anyone reintroduces
//      serializeState()+split / manual decode parsing incompatible with URLSearchParams.
//      Needles are assembled at runtime so this guard's own lines never self-match; and we
//      scan only the makeHarness/setState region of this file plus the runtime, not the
//      guard block. ---------------------------------------------------------------------
(function () {
  function codeOnly(src) {
    return src.split('\n').map(function (ln) { var i = ln.indexOf('//'); return i === -1 ? ln : ln.slice(0, i); }).join('\n');
  }
  var behavSrc = codeOnly(read(path.join(SITE, 'engine', 'tests_f6_examples_library_behavioural.js')));
  // Restrict the harness scan to the makeHarness(...) function body, so the guard block
  // itself (which necessarily names the forbidden tokens) is never scanned.
  var mhStart = behavSrc.indexOf('function makeHarness(');
  var mhEnd = behavSrc.indexOf('\n}', mhStart);
  var harness = mhStart !== -1 && mhEnd !== -1 ? behavSrc.slice(mhStart, mhEnd) : behavSrc;
  var runtime = codeOnly(read(path.join(SITE, 'assets', 'examples-library.ui.js')));

  var decodeTok = 'decode' + 'URIComponent';                 // assembled so this line is safe
  var splitRebuild = /serializeState\([^)]*\)[\s\S]{0,40}\.split\(/;

  // The write path must use core.stateEntries into URLSearchParams...
  ok('BEH/GUARD: harness setState uses core.stateEntries', /core\.stateEntries\(/.test(harness));
  ok('BEH/GUARD: runtime writeState uses core.stateEntries', /core\.stateEntries\(/.test(runtime));
  // ...and must NOT rebuild it from a serialized string or hand-decode params.
  ok('BEH/GUARD: harness setState has no serialized-string reconstruction', !splitRebuild.test(harness));
  ok('BEH/GUARD: harness setState has no manual param decoding', harness.indexOf(decodeTok) === -1);
  ok('BEH/GUARD: runtime write path has no manual param decoding', runtime.indexOf(decodeTok) === -1);
})();


if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F6 EXAMPLES LIBRARY BEHAVIOURAL  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
