/* tests_f7a_examples_search.js — F7a REAL F6 SEARCH (permanent).
 *
 * Exercises the REAL runtime search path (assets/examples-library-core.js: normalizeQuery +
 * matchesQuery / filterExamples), NOT a `field !== ""` stub. For every F7a example it proves the
 * record is findable by a word from its title, its question, and one of its tags, in all 5 locales,
 * and that search is accent-insensitive and honours localized category / model-type labels.
 *
 * The payload is the REAL generator projection (engine/generate-examples-library.js buildPayload),
 * the same data the shipped page consumes.
 */
'use strict';
const path = require('path');
const SITE = path.join(__dirname, '..');
const core = require(path.join(SITE, 'assets', 'examples-library-core.js'));
const gen = require(path.join(SITE, 'engine', 'generate-examples-library.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const LOCALES = ['en', 'es', 'pt', 'de', 'fr'];
const F7A_15 = ['bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split', 'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships', 'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];

const recs = gen.buildPayload(SITE).examples;
function find(q, loc) { return core.filterExamples(recs, { q: core.normalizeQuery(q), category: [], type: [], difficulty: [], goal: [] }, loc).map(function (r) { return r.id; }); }
function firstLongWord(s) { return (s || '').split(/\s+/).filter(function (w) { return w.replace(/[^\p{L}]/gu, '').length > 4; })[0]; }

// ---- per-F7a: findable by title word, question word, and a tag, in every locale ----
F7A_15.forEach(function (id) {
  var r = recs.find(function (x) { return x.id === id; });
  ok('SEARCH: F7a record present: ' + id, !!r);
  if (!r) return;

  // tag (locale-independent)
  var tag = (r.tags || [])[0];
  ok('SEARCH: ' + id + ' findable by tag "' + tag + '"', tag && find(tag, 'en').indexOf(id) !== -1);

  LOCALES.forEach(function (loc) {
    var loc0 = r.locales[loc] || {};
    var tWord = firstLongWord(loc0.title);
    var qWord = firstLongWord(loc0.question);
    ok('SEARCH: ' + id + ' findable by title word (' + loc + ')', tWord && find(tWord, loc).indexOf(id) !== -1, tWord);
    ok('SEARCH: ' + id + ' findable by question word (' + loc + ')', qWord && find(qWord, loc).indexOf(id) !== -1, qWord);
  });
});

// ---- accent-insensitive search --------------------------------------------
(function () {
  ok('SEARCH: normalizeQuery strips accents (operações == operacoes)', core.normalizeQuery('operações') === core.normalizeQuery('operacoes'));
  // energía / energia both find the energy records in es.
  var withAccent = find('energía', 'es');
  var without = find('energia', 'es');
  ok('SEARCH: accented and unaccented queries match the same records', JSON.stringify(withAccent.sort()) === JSON.stringify(without.sort()));
  ok('SEARCH: energy query finds the energy F7a records', without.indexOf('renewable-mix') !== -1 && without.indexOf('microgrid-capacity') !== -1, without.join(','));
})();

// ---- localized category-label search --------------------------------------
(function () {
  // production-operations members must all surface from its localized labels (superset: free text
  // can also match the same word elsewhere).
  var meta = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'metadata.js')).METADATA;
  var members = Object.keys(meta).filter(function (k) { return meta[k].primaryCategory === 'production-operations'; });
  var labelByLocale = { en: 'operations', es: 'operaciones', pt: 'operações', de: 'Betrieb', fr: 'opérations' };
  Object.keys(labelByLocale).forEach(function (loc) {
    var ids = find(labelByLocale[loc], loc);
    ok('SEARCH: category label "' + labelByLocale[loc] + '" (' + loc + ') surfaces all production-operations',
       members.every(function (m) { return ids.indexOf(m) !== -1; }), ids.join(','));
  });
})();

// ---- localized model-type-label search ------------------------------------
(function () {
  // "continuous" label in each locale must find continuous-model records (there are 11).
  var mtLabel = { en: 'continuous', es: 'continuo', pt: 'contínuo', de: 'kontinuierlich', fr: 'continu' };
  Object.keys(mtLabel).forEach(function (loc) {
    var ids = find(mtLabel[loc], loc);
    ok('SEARCH: model-type label "' + mtLabel[loc] + '" (' + loc + ') finds continuous records', ids.length >= 11, String(ids.length));
  });
})();

// ---- empty query returns the full catalogue -------------------------------
ok('SEARCH: empty query returns all records', find('', 'en').length === recs.length);

// ---- NEGATIVE: search must discriminate (title/question/tag failure) ------
(function () {
  // (a) A nonsense token that appears in no title, question or tag finds NOTHING.
  ok('SEARCH-NEG: nonsense token matches no records', find('zzqwxjkvunmatchable', 'en').length === 0);
  // (b) Field discrimination: pick a record, take a long word from another record's title that is
  //     absent from this record's own title, question and tags — this record must NOT be returned
  //     for that word. Proves search indexes real fields, not a match-anything stub.
  var a = recs.find(function (x) { return x.id === 'bakery-mix'; });
  var b = recs.find(function (x) { return x.id === 'microgrid-capacity'; });
  var bWord = firstLongWord((b.locales.en || {}).title);
  var aBlob = ((a.locales.en || {}).title + ' ' + (a.locales.en || {}).question + ' ' + (a.tags || []).join(' ')).toLowerCase();
  if (bWord && aBlob.indexOf(bWord.toLowerCase()) === -1) {
    ok('SEARCH-NEG: bakery-mix NOT found by an unrelated title word ("' + bWord + '")', find(bWord, 'en').indexOf('bakery-mix') === -1);
  } else {
    // fall back to a guaranteed-absent token if the sampled word happens to co-occur
    ok('SEARCH-NEG: bakery-mix NOT found by a guaranteed-absent token', find('microgridzzz', 'en').indexOf('bakery-mix') === -1);
  }
})();

console.log('F7A EXAMPLES SEARCH (REAL F6)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
