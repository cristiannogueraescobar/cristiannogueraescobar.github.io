/* tests_f7a_examples_24.js — F7a HISTORICAL TRANCHE checkpoint (permanent).
 *
 * Originally this suite owned the literal "catalogue === 24". F7b grew the live catalogue to 36,
 * so the literal total moved to the F7b checkpoint (tests_f7b_examples_36.js). This suite was NOT
 * relaxed: it still pins the exact F7a tranche — the first 24 canonical records must remain exactly
 * historical-9 + F7a-15, in order, with their frozen slugs, model types, result policies and
 * objectives. It now asserts those properties over the F7a PREFIX of the live catalogue rather than
 * over the whole catalogue, which is the correct historical contract once later tranches exist.
 *
 * Everything here is checked against the REAL loaded catalogue / canonical records, not a fixture
 * captured from the composer under test. Where a result (status/objective) is asserted, it comes from
 * the independent Phase-1 engine audit (docs/f7a-phase1-engine-audit.json), which was verified
 * independently and shown to match the integrated catalogue.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));
const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// ---- the exact F7a tranche (frozen) ---------------------------------------
const HISTORICAL_9 = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier'];
const F7A_15 = ['bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split', 'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships', 'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];
const EXPECTED_24_KEYS = HISTORICAL_9.concat(F7A_15);
const F7A_TRANCHE_SIZE = EXPECTED_24_KEYS.length; // 24 — the F7a tranche size, not the live total
const EXACT_POLICY_KEYS = ['bakery-mix', 'purchase-split', 'fertiliser-blend', 'lp-basics'];
// slug per key (frozen public URL surface)
const SLUG_BY_KEY = {
  production: 'production-plan', workshop: 'workshop-chart', blend: 'cheapest-feed-blend',
  marketing: 'marketing-budget', workforce: 'workforce-scheduling', shipping: 'shipping-plan',
  project: 'project-selection', delivery: 'delivery-load', supplier: 'supplier-activation',
  'bakery-mix': 'bakery-production-mix', 'factory-batches': 'factory-batch-plan',
  'clinic-staffing': 'clinic-staffing-plan', 'call-centre': 'call-centre-shift-plan',
  'purchase-split': 'purchase-order-split', 'ingredient-sourcing': 'ingredient-sourcing-plan',
  'fleet-assignment': 'fleet-assignment-plan', 'media-mix': 'media-channel-mix',
  'fertiliser-blend': 'fertiliser-blend-plan', scholarships: 'scholarship-allocation',
  'food-bank': 'food-bank-allocation', 'renewable-mix': 'renewable-energy-mix',
  'microgrid-capacity': 'microgrid-capacity-plan', 'hotel-rooms': 'hotel-room-allocation',
  'lp-basics': 'linear-optimisation-basics',
};

const { catalogue } = loadAndValidateCatalogue(SITE);
const { canonical } = loadCanonical(SITE);

// The F7a tranche is the first 24 canonical records; assert over that prefix (later tranches append).
const tranche = catalogue.slice(0, F7A_TRANCHE_SIZE);
const trancheCanon = canonical.slice(0, F7A_TRANCHE_SIZE);

// ---- 1. tranche checkpoint -------------------------------------------------
ok('F7a: catalogue has at least the 24-record F7a tranche', catalogue.length >= F7A_TRANCHE_SIZE, String(catalogue.length));
ok('F7a: canonical has at least the 24-record F7a tranche', canonical.length >= F7A_TRANCHE_SIZE, String(canonical.length));
ok('F7a: the F7a tranche is exactly 24 records', tranche.length === 24, String(tranche.length));

// ---- 2. order: historical-9 prefix, then F7a-15 ---------------------------
ok('F7a: tranche order equals historical-9 + F7a-15', JSON.stringify(tranche.map(function (r) { return r.key; })) === JSON.stringify(EXPECTED_24_KEYS));
ok('F7a: first nine are the historical keys in order', JSON.stringify(catalogue.slice(0, 9).map(function (r) { return r.key; })) === JSON.stringify(HISTORICAL_9));
ok('F7a: records 10..24 are the F7a keys in order', JSON.stringify(catalogue.slice(9, 24).map(function (r) { return r.key; })) === JSON.stringify(F7A_15));

// ---- 3. uniqueness (within the tranche) ------------------------------------
(function () {
  var keys = tranche.map(function (r) { return r.key; });
  var slugs = tranche.map(function (r) { return r.slug; });
  ok('F7a: tranche keys are unique', new Set(keys).size === F7A_TRANCHE_SIZE);
  ok('F7a: tranche slugs are unique', new Set(slugs).size === F7A_TRANCHE_SIZE);
})();

// ---- 4. slug per key -------------------------------------------------------
tranche.forEach(function (r) {
  ok('F7a: slug for ' + r.key + ' is ' + SLUG_BY_KEY[r.key], r.slug === SLUG_BY_KEY[r.key], r.slug);
});

// ---- 5. model type distribution within the F7a tranche (11/8/3/2) ----------
(function () {
  var mt = {};
  tranche.forEach(function (r) { mt[r.expected.modelType] = (mt[r.expected.modelType] || 0) + 1; });
  ok('F7a: 11 continuous models in tranche', mt.continuous === 11, String(mt.continuous));
  ok('F7a: 8 integer models in tranche', mt.integer === 8, String(mt.integer));
  ok('F7a: 3 binary models in tranche', mt.binary === 3, String(mt.binary));
  ok('F7a: 2 mixed models in tranche', mt.mixed === 2, String(mt.mixed));
})();

// ---- 6. result policy within the tranche: 4 exact (named), 20 objective-feasible ----
(function () {
  var exact = trancheCanon.filter(function (c) { return c.resultPolicy === 'exact'; }).map(function (c) { return c.key; }).sort();
  var objf = trancheCanon.filter(function (c) { return c.resultPolicy === 'objective-feasible'; });
  ok('F7a: exactly 4 exact-policy records in tranche, the named set', JSON.stringify(exact) === JSON.stringify(EXACT_POLICY_KEYS.slice().sort()), exact.join(','));
  ok('F7a: exactly 20 objective-feasible records in tranche', objf.length === 20, String(objf.length));
  ok('F7a: every tranche record has a valid result policy', trancheCanon.every(function (c) { return c.resultPolicy === 'exact' || c.resultPolicy === 'objective-feasible'; }));
})();

// ---- 7. historical objectives immutable (frozen from Phase 1) --------------
(function () {
  var frozen = { production: 1760, workshop: 900, blend: 27.352941176470587, marketing: 21350, workforce: 23, shipping: 450, project: 125, delivery: 240, supplier: 830 };
  Object.keys(frozen).forEach(function (k) {
    var r = catalogue.find(function (x) { return x.key === k; });
    ok('F7a: historical objective immutable for ' + k, r && Math.abs(r.expected.objective - frozen[k]) < 1e-9, r ? String(r.expected.objective) : 'missing');
  });
})();

// ---- 8. fieldOrder present + valid on every tranche record -----------------
(function () {
  var VALID_FIELDS = ['grid', 'domains', 'openVarSettings', 'whole', 'expected'];
  var src = fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js'), 'utf8');
  var keys = catalogue.map(function (r) { return r.key; });
  tranche.forEach(function (rec, i) {
    var key = rec.key;
    var s = src.indexOf('"key": "' + key + '"');
    var e = i + 1 < keys.length ? src.indexOf('"key": "' + keys[i + 1] + '"') : src.length;
    var block = src.slice(s, e);
    var m = block.match(/"fieldOrder":\s*\[([^\]]*)\]/);
    ok('F7a: fieldOrder present for ' + key, !!m);
    if (m) {
      var fields = m[1].split(',').map(function (x) { return x.trim().replace(/"/g, ''); }).filter(Boolean);
      ok('F7a: fieldOrder fields valid for ' + key, fields.every(function (f) { return VALID_FIELDS.indexOf(f) !== -1; }), fields.join(','));
      ok('F7a: fieldOrder contains grid + expected for ' + key, fields.indexOf('grid') !== -1 && fields.indexOf('expected') !== -1);
    }
  });
})();

// ---- 9. Phase-1 audit cross-check (independent result authority) -----------
(function () {
  var audit = require(path.join(SITE, 'docs', 'f7a-phase1-engine-audit.json'));
  ok('F7a: Phase-1 audit covers the 15 F7a models', audit.models.length === 15);
  ok('F7a: Phase-1 audit was deterministic (status1==status2, obj1==obj2)',
     audit.models.every(function (m) { return m.status1 === m.status2 && Math.abs(m.objective1 - m.objective2) < 1e-12; }));
  audit.models.forEach(function (m) {
    var r = catalogue.find(function (x) { return x.key === m.key; });
    ok('F7a: catalogue objective matches Phase-1 audit for ' + m.key, r && Math.abs(r.expected.objective - m.objective1) < 1e-9, r ? String(r.expected.objective) : 'missing');
  });
})();

console.log('F7A EXAMPLES 24 (HISTORICAL TRANCHE)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
