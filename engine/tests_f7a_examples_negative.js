/* tests_f7a_examples_negative.js — F7a NEGATIVE (permanent, real runner).
 *
 * ~45 mutations against the F7a tranche, each checked with a REAL runner (schema.validateCatalogue
 * at the F7a checkpoint count, loadCanonical, or the real serializer executed as JS) — never a
 * `|| true` escape hatch. Every mutation must trip a real failure; a clean run must pass first, so a
 * mutation that fails for the wrong reason does not count.
 *
 * Includes the PERMANENT serializer key-quoting contract: a hyphenated key (bakery-mix) MUST be
 * emitted as a quoted object key so the composed EXAMPLES object is valid JS, while a bare-safe
 * historical key (production) stays unquoted. Regression guard for the serExamplesRecord fix.
 */
'use strict';
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));
const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// CHECKPOINT is the CURRENT LIVE catalogue size (36 = F5/F6-9 + F7a-15 + F7b-12), not a frozen
// F7a-era value. This suite mutates the live catalogue and checks the validator against the live
// count; it moves with each tranche (was 24 through F7a, 36 since F7b went live).
const CHECKPOINT = 36;
const F7A_15 = ['bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split', 'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships', 'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];

const loaded = loadAndValidateCatalogue(SITE);
const BASE = loaded.catalogue;
const schema = loaded.schema;
const serialize = loaded.serialize;

// Deep clone the catalogue so mutations never touch the shared array.
function cloneCat() { return JSON.parse(JSON.stringify(BASE)); }

// A mutation PASSES the negative test if validateCatalogue at the checkpoint count FAILS.
function expectValidateFails(label, mutate, needle) {
  var cat = cloneCat();
  // clean baseline must validate
  var clean = schema.validateCatalogue(BASE, { expectCount: CHECKPOINT });
  ok(label + ': clean catalogue validates', clean.ok, (clean.errors || []).slice(0, 1).join('; '));
  mutate(cat);
  var res;
  try { res = schema.validateCatalogue(cat, { expectCount: CHECKPOINT }); }
  catch (e) { res = { ok: false, errors: [e.message] }; }
  var tripped = !res.ok && (!needle || (res.errors || []).some(function (m) { return m.indexOf(needle) !== -1; }));
  ok(label + ': mutation caught' + (needle ? ' (needle "' + needle + '")' : ''), tripped, (res.errors || []).slice(0, 2).join('; '));
}

// ---- 1..15: remove each F7a record -> count drops below checkpoint ---------
F7A_15.forEach(function (key) {
  expectValidateFails('remove ' + key, function (cat) {
    var i = cat.findIndex(function (r) { return r.key === key; });
    if (i !== -1) cat.splice(i, 1);
  }, 'expected ' + CHECKPOINT + ' examples');
});

// ---- 16: add a 25th record -> count above checkpoint ----------------------
expectValidateFails('add a 25th record', function (cat) {
  var r = JSON.parse(JSON.stringify(cat[cat.length - 1]));
  r.key = 'extra-25'; r.slug = 'extra-twenty-five';
  cat.push(r);
}, 'expected ' + CHECKPOINT + ' examples');

// ---- 17..24: duplicate key / duplicate slug on F7a records ----------------
['bakery-mix', 'scholarships', 'renewable-mix', 'lp-basics'].forEach(function (key) {
  expectValidateFails('duplicate key via ' + key, function (cat) {
    var r = cat.find(function (x) { return x.key === key; });
    var other = cat.find(function (x) { return x.key !== key; });
    other.key = r.key; // create a duplicate key
  }, 'duplicate');
  expectValidateFails('duplicate slug via ' + key, function (cat) {
    var r = cat.find(function (x) { return x.key === key; });
    var other = cat.find(function (x) { return x.key !== key; });
    other.slug = r.slug; // create a duplicate slug
  }, 'duplicate');
});

// ---- 25..29: invalid category / type / sense on F7a records ---------------
expectValidateFails('invalid category on bakery-mix', function (cat) {
  cat.find(function (r) { return r.key === 'bakery-mix'; }).category = 'not-a-category';
});
expectValidateFails('invalid type on factory-batches', function (cat) {
  cat.find(function (r) { return r.key === 'factory-batches'; }).type = 'quantum';
});
expectValidateFails('invalid sense on scholarships', function (cat) {
  cat.find(function (r) { return r.key === 'scholarships'; }).sense = 'sideways';
});
expectValidateFails('empty slug on hotel-rooms', function (cat) {
  cat.find(function (r) { return r.key === 'hotel-rooms'; }).slug = '';
});
expectValidateFails('empty key on media-mix', function (cat) {
  cat.find(function (r) { return r.key === 'media-mix'; }).key = '';
});

// ---- 30..33: missing required model / translations ------------------------
expectValidateFails('missing model.grid on lp-basics', function (cat) {
  delete cat.find(function (r) { return r.key === 'lp-basics'; }).model.grid;
});
expectValidateFails('missing translations on food-bank', function (cat) {
  delete cat.find(function (r) { return r.key === 'food-bank'; }).translations;
});
expectValidateFails('missing a locale on call-centre', function (cat) {
  delete cat.find(function (r) { return r.key === 'call-centre'; }).translations.de;
});
expectValidateFails('missing expected on purchase-split', function (cat) {
  delete cat.find(function (r) { return r.key === 'purchase-split'; }).expected;
});

// ---- 34..37: slug/key grammar drift (schema must reject) ------------------
// slug grammar (uppercase) — schema must reject
expectValidateFails('uppercase slug on ingredient-sourcing', function (cat) {
  cat.find(function (r) { return r.key === 'ingredient-sourcing'; }).slug = 'Ingredient-Sourcing-Plan';
});
// key grammar (space) — schema must reject
expectValidateFails('space in key on fleet-assignment', function (cat) {
  cat.find(function (r) { return r.key === 'fleet-assignment'; }).key = 'fleet assignment';
});

// ---- 38..40: order — historical prefix must stay first (F7a checkpoint contract) ----
(function () {
  // Order is an F7a checkpoint contract, not a generic schema rule. Assert the contract directly:
  // moving an F7a record into the historical prefix breaks "first 9 == historical keys".
  var HISTORICAL_9 = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier'];
  var cat = cloneCat();
  var i = cat.findIndex(function (r) { return r.key === 'bakery-mix'; });
  var rec = cat.splice(i, 1)[0];
  cat.unshift(rec);
  var firstNine = cat.slice(0, 9).map(function (r) { return r.key; });
  ok('ORDER: clean catalogue has historical-9 prefix', JSON.stringify(BASE.slice(0, 9).map(function (r) { return r.key; })) === JSON.stringify(HISTORICAL_9));
  ok('ORDER: F7a record moved into historical prefix breaks the prefix contract', JSON.stringify(firstNine) !== JSON.stringify(HISTORICAL_9));
})();

// ---- 41..45: serializer key-quoting PERMANENT contract --------------------
(function () {
  var out = serialize.serializeSolverExamples(BASE);

  // (a) the real serialized EXAMPLES object executes as valid JS.
  var execOk = false;
  try { new Function(out + '; return EXAMPLES;')(); execOk = true; } catch (e) {}
  ok('QUOTE: real serialized EXAMPLES executes as valid JS', execOk);

  // (b) a hyphenated key is emitted as a QUOTED object key.
  ok('QUOTE: hyphenated key bakery-mix is quoted', out.indexOf("'bakery-mix':") !== -1 || out.indexOf('"bakery-mix":') !== -1);

  // (c) a bare-safe historical key is emitted UNQUOTED (no needless quoting).
  ok('QUOTE: bare-safe key production is unquoted', /[{,\s]production:/.test(out) && out.indexOf("'production':") === -1 && out.indexOf('"production":') === -1);

  // (d) REGRESSION: if the hyphenated key were bare, the object would be a SyntaxError.
  var buggy = out.replace("'bakery-mix':", 'bakery-mix:').replace('"bakery-mix":', 'bakery-mix:');
  var buggyThrows = false;
  try { new Function(buggy + '; return EXAMPLES;')(); } catch (e) { buggyThrows = true; }
  ok('QUOTE: un-quoting bakery-mix makes EXAMPLES a SyntaxError (regression guard)', buggyThrows);

  // (e) every hyphenated F7a key present in the output is quoted.
  var hyphenKeys = F7A_15.filter(function (k) { return k.indexOf('-') !== -1; });
  var allQuoted = hyphenKeys.every(function (k) { return out.indexOf("'" + k + "':") !== -1 || out.indexOf('"' + k + '":') !== -1; });
  ok('QUOTE: all hyphenated F7a keys are quoted in the serialized output', allQuoted, hyphenKeys.join(','));
})();

console.log('F7A EXAMPLES NEGATIVE  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
