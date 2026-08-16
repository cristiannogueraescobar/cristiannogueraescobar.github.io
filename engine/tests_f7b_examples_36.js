/* tests_f7b_examples_36.js — F7b LIVE checkpoint (permanent).
 *
 * This is THE F7b checkpoint layer: the one place that asserts the live catalogue is exactly 36 and
 * pins the F7b tranche (records 25..36) — keys, slugs, order, categories, model types, directions,
 * result policies and engine-validated objectives. The literal "36" lives here; generic
 * infrastructure stays count-agnostic. When F7c grows the catalogue to 48, the 36-assertions move to
 * an F7c checkpoint and are NOT silently relaxed (mirroring how F7a's 24 moved here).
 *
 * Everything is checked against the REAL loaded catalogue / canonical records and re-solved on the
 * REAL engine — no fixture-only trust. The 12 objectives are cross-checked against the externally
 * approved F7b Phase-1 reserved tranche (engine/fixtures/f7b-tranche/f7b-tranche-reserved.json).
 */
'use strict';
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));
const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));
const { solveModel } = require(path.join(SITE, 'engine', 'f5-solve-verify.js'));
const derive = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'derive.js'));
const RESERVED = require(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-tranche-reserved.json'));
const META = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'metadata.js')).METADATA;

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// ---- the exact F7b tranche (frozen from approved Phase 1) ------------------
const F7B_12 = ['assembly-line-mix', 'machine-shop-jobs', 'warehouse-dispatch', 'container-loading', 'budget-allocation', 'raw-material-buy', 'shift-coverage', 'feed-blend', 'tutoring-hours', 'battery-dispatch', 'menu-planning', 'retail-shelf-space'];
const SLUG_BY_KEY = {
  'assembly-line-mix': 'assembly-line-mix', 'machine-shop-jobs': 'machine-shop-job-plan',
  'warehouse-dispatch': 'warehouse-dispatch-plan', 'container-loading': 'container-loading-plan',
  'budget-allocation': 'budget-allocation-plan', 'raw-material-buy': 'raw-material-purchase-plan',
  'shift-coverage': 'shift-coverage-plan', 'feed-blend': 'animal-feed-blend',
  'tutoring-hours': 'tutoring-hours-plan', 'battery-dispatch': 'battery-dispatch-plan',
  'menu-planning': 'menu-planning-mix', 'retail-shelf-space': 'retail-shelf-space-plan',
};
const LIVE_TOTAL = 36;
const F7A_TRANCHE_SIZE = 24;

const { catalogue } = loadAndValidateCatalogue(SITE);
const { canonical } = loadCanonical(SITE);
const resByKey = {}; RESERVED.records.forEach(function (r) { resByKey[r.key] = r; });

// ---- 1. live count checkpoint ---------------------------------------------
ok('F7b: catalogue length is exactly 36', catalogue.length === LIVE_TOTAL, String(catalogue.length));
ok('F7b: canonical length is exactly 36', canonical.length === LIVE_TOTAL, String(canonical.length));

// ---- 2. tranche position: records 25..36 are the F7b keys in order ---------
const trancheF7b = catalogue.slice(F7A_TRANCHE_SIZE);
ok('F7b: the F7b tranche is exactly 12 records', trancheF7b.length === 12, String(trancheF7b.length));
ok('F7b: records 25..36 are the F7b keys in order', JSON.stringify(trancheF7b.map(function (r) { return r.key; })) === JSON.stringify(F7B_12));

// ---- 3. uniqueness across the whole live catalogue ------------------------
(function () {
  var keys = catalogue.map(function (r) { return r.key; });
  var slugs = catalogue.map(function (r) { return r.slug; });
  ok('F7b: all 36 keys unique', new Set(keys).size === LIVE_TOTAL);
  ok('F7b: all 36 slugs unique', new Set(slugs).size === LIVE_TOTAL);
  // case-insensitive
  ok('F7b: all 36 keys unique case-insensitively', new Set(keys.map(function (k) { return k.toLowerCase(); })).size === LIVE_TOTAL);
  ok('F7b: all 36 slugs unique case-insensitively', new Set(slugs.map(function (s) { return s.toLowerCase(); })).size === LIVE_TOTAL);
})();

// ---- 4. slug per F7b key (frozen public URL surface) ----------------------
trancheF7b.forEach(function (r) {
  ok('F7b: slug for ' + r.key + ' is ' + SLUG_BY_KEY[r.key], r.slug === SLUG_BY_KEY[r.key], r.slug);
});

// ---- 5. each F7b record matches the approved reserved contract -------------
trancheF7b.forEach(function (r) {
  var res = resByKey[r.key];
  ok('F7b: ' + r.key + ' has an approved reserved contract', !!res);
  if (!res) return;
  ok('F7b: ' + r.key + ' direction matches approved', r.sense === res.direction, r.sense);
  ok('F7b: ' + r.key + ' modelType matches approved', r.expected.modelType === res.modelType, r.expected.modelType);
  ok('F7b: ' + r.key + ' objective matches approved', Math.abs(r.expected.objective - res.objective) < 1e-6, String(r.expected.objective));
  ok('F7b: ' + r.key + ' status is optimal', r.expected.status === 'optimal', r.expected.status);
  // taxonomic category lives in metadata.primaryCategory
  var m = META[r.key];
  ok('F7b: ' + r.key + ' metadata primaryCategory matches approved', m && m.primaryCategory === res.category, m ? m.primaryCategory : 'missing');
  ok('F7b: ' + r.key + ' metadata difficulty matches approved', m && m.difficulty === res.difficulty, m ? m.difficulty : 'missing');
  ok('F7b: ' + r.key + ' metadata minutes matches approved', m && m.minutes === res.minutes, m ? String(m.minutes) : 'missing');
});

// ---- 6. real-engine re-solve of every F7b live record ---------------------
trancheF7b.forEach(function (r) {
  var res = resByKey[r.key];
  var out, facts;
  try { out = solveModel(r.model, r.sense).out; facts = derive.deriveFacts(r); }
  catch (e) { ok('F7b: ' + r.key + ' solves on the real engine', false, e.message); return; }
  ok('F7b: ' + r.key + ' real engine status optimal', out.status === 'optimal', out.status);
  ok('F7b: ' + r.key + ' real engine objective matches contract', res && Math.abs(out.objective - res.objective) < 1e-6, String(out.objective));
  ok('F7b: ' + r.key + ' real engine modelType matches record', facts.modelType === r.expected.modelType, facts.modelType);
});

// ---- 7. F7b tranche does not disturb the F7a tranche prefix ----------------
(function () {
  var F7A_PREFIX = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier', 'bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split', 'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships', 'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];
  ok('F7b: the first 24 records are still the F7a tranche unchanged', JSON.stringify(catalogue.slice(0, 24).map(function (r) { return r.key; })) === JSON.stringify(F7A_PREFIX));
})();

// ---- 8. projected model-type + direction distribution at 36 ----------------
(function () {
  var mt = {}, dir = {};
  catalogue.forEach(function (r) { mt[r.expected.modelType] = (mt[r.expected.modelType] || 0) + 1; dir[r.sense] = (dir[r.sense] || 0) + 1; });
  ok('F7b: 19 continuous models at 36', mt.continuous === 19, String(mt.continuous));
  ok('F7b: 12 integer models at 36', mt.integer === 12, String(mt.integer));
  ok('F7b: 3 binary models at 36', mt.binary === 3, String(mt.binary));
  ok('F7b: 2 mixed models at 36', mt.mixed === 2, String(mt.mixed));
  ok('F7b: 20 max-direction models at 36', dir.max === 20, String(dir.max));
  ok('F7b: 16 min-direction models at 36', dir.min === 16, String(dir.min));
})();

console.log('F7B EXAMPLES 36 (LIVE CHECKPOINT)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
