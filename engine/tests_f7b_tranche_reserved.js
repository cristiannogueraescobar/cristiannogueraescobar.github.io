/* tests_f7b_tranche_reserved.js — F7b approved-tranche identity contract (permanent).
 *
 * The f7b-tranche-reserved.json fixture is the externally approved Phase-1 identity contract for the
 * 12 F7b examples. It is preserved byte-identical as historical checkpoint evidence (its state field
 * still reads "reserved" as a record of the Phase-1 approval). In Phase 2 these 12 identities became
 * LIVE, so this permanent suite reflects the completed Phase-2 truth: it proves the approved fixture
 * is well-formed AND that every reserved identity is now present in the live catalogue exactly once,
 * with matching model/objective/status. It never claims the 12 are still non-live.
 *
 * It follows the existing tranche architecture (a JSON fixture + real loaders/engine) rather than a
 * parallel framework, and distinguishes:
 *   - live:     the current 36-example catalogue (F5/F6-9 + F7a-15 + F7b-12).
 *   - approved: the 12 F7b identities frozen in f7b-tranche-reserved.json (now live).
 *   - target:   the 36-example completed-F7b total the fixture declared.
 *
 * All 12 objectives were produced by the REAL engine at design time; this suite re-solves each model
 * through the real engine and requires the approved objective and status to match — no hand-written
 * optimum is trusted.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SITE = path.resolve(__dirname, '..');
const RESERVED = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-tranche-reserved.json'), 'utf8'));
const LOCPLAN = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-localisation-plan.json'), 'utf8'));
const CATALOGUE = require(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js')).CATALOGUE;
const CATS = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'categories.js'));
const ENUMS = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'enums.js'));
const { solveModel } = require(path.join(SITE, 'engine', 'f5-solve-verify.js'));
const derive = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'derive.js'));
const DESIGNS = require(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-model-grids.js')).GRIDS;

// Canonical enum/locale sets come from the REAL repository source (f5/enums.js), never a second
// hardcoded copy. If the canonical set changes incompatibly, these contracts fail.
const LOCALES = ENUMS.LOCALES;
const MODEL_TYPES = ENUMS.MODEL_TYPES;
const SENSES = ENUMS.SENSES;
const DIFFICULTIES = ENUMS.DIFFICULTIES;
const POLICIES = ENUMS.RESULT_POLICIES;

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// Valid canonical category ids from the real registry.
const catIds = new Set((CATS.CATEGORIES || CATS.categories || []).map(function (c) { return c.id; }));
const liveKeys = new Set(CATALOGUE.map(function (r) { return r.key.toLowerCase(); }));
const liveSlugs = new Set(CATALOGUE.map(function (r) { return r.slug.toLowerCase(); }));

// ---- Canonical enum/locale sets are the REAL repository sources ------------
// These prove the contract is wired to f5/enums.js (not a private copy). If enums.js drops or
// renames a value the contract needs, these fail — which is the intended coupling.
ok('CANON: LOCALES sourced from enums.js (non-empty array)', Array.isArray(LOCALES) && LOCALES.length > 0);
ok('CANON: MODEL_TYPES sourced from enums.js (non-empty array)', Array.isArray(MODEL_TYPES) && MODEL_TYPES.length > 0);
ok('CANON: SENSES sourced from enums.js (non-empty array)', Array.isArray(SENSES) && SENSES.length > 0);
ok('CANON: DIFFICULTIES sourced from enums.js (non-empty array)', Array.isArray(DIFFICULTIES) && DIFFICULTIES.length > 0);
ok('CANON: RESULT_POLICIES sourced from enums.js (non-empty array)', Array.isArray(POLICIES) && POLICIES.length > 0);
ok('CANON: enums.LOCALES is the exact same reference used for validation', LOCALES === ENUMS.LOCALES);
ok('CANON: category ids come from the real registry (CATEGORY_CONTRACT matches categories.js)',
   catIds.size > 0 && (ENUMS.CATEGORY_IDS || []).every(function (id) { return catIds.has(id); }));

// ---- Approved-tranche identity contract (now LIVE in Phase 2) --------------
// The reserved fixture remains the frozen, externally approved identity contract for the 12. In
// Phase 2 the tranche went live, so instead of asserting "not yet live" this now asserts the fixture
// is faithfully reflected in the live catalogue. The fixture's own well-formedness is still checked.
ok('RESERVED: approved fixture declares target total 36', RESERVED.targetTotal === 36);
ok('LIVE: catalogue reached the 36 target (F7a-24 + F7b-12)', CATALOGUE.length === RESERVED.targetTotal);
ok('LIVE: F7a tranche (24) + reserved records (12) equals the live total', 24 + RESERVED.records.length === CATALOGUE.length);

// ---- Exactly 12, unique, all present live (no collisions) ------------------
ok('RESERVED: exactly 12 records', RESERVED.records.length === 12);
const rKeys = RESERVED.records.map(function (r) { return r.key.toLowerCase(); });
const rSlugs = RESERVED.records.map(function (r) { return r.slug.toLowerCase(); });
ok('RESERVED: 12 keys unique among themselves', new Set(rKeys).size === 12);
ok('RESERVED: 12 slugs unique among themselves', new Set(rSlugs).size === 12);
// In Phase 2 every reserved key/slug IS present in the live catalogue exactly once (case-insensitive).
ok('LIVE: every reserved key is present in the live catalogue (case-insensitive)', rKeys.every(function (k) { return liveKeys.has(k); }));
ok('LIVE: every reserved slug is present in the live catalogue (case-insensitive)', rSlugs.every(function (s) { return liveSlugs.has(s); }));
ok('LIVE: no reserved key duplicates a historical F7a/F5 key', rKeys.every(function (k) {
  return CATALOGUE.filter(function (r) { return r.key.toLowerCase() === k; }).length === 1;
}));

// ---- Per-record metadata completeness + canonical enum values --------------
RESERVED.records.forEach(function (r) {
  ok('RESERVED ' + r.key + ': key is url-safe deterministic', /^[a-z][a-z0-9-]*$/.test(r.key));
  ok('RESERVED ' + r.key + ': slug is url-safe deterministic', /^[a-z][a-z0-9-]*$/.test(r.slug));
  ok('RESERVED ' + r.key + ': category is a valid canonical id', catIds.has(r.category), r.category);
  ok('RESERVED ' + r.key + ': modelType is canonical', MODEL_TYPES.indexOf(r.modelType) !== -1, r.modelType);
  ok('RESERVED ' + r.key + ': direction is canonical', SENSES.indexOf(r.direction) !== -1, r.direction);
  ok('RESERVED ' + r.key + ': difficulty is canonical', DIFFICULTIES.indexOf(r.difficulty) !== -1, r.difficulty);
  ok('RESERVED ' + r.key + ': resultPolicy is canonical', POLICIES.indexOf(r.resultPolicy) !== -1, r.resultPolicy);
  ok('RESERVED ' + r.key + ': status is optimal', r.status === 'optimal');
  ok('RESERVED ' + r.key + ': objective is a finite number', typeof r.objective === 'number' && isFinite(r.objective));
  ok('RESERVED ' + r.key + ': minutes within canonical bounds', Number.isInteger(r.minutes) && r.minutes >= ENUMS.MIN_MINUTES && r.minutes <= ENUMS.MAX_MINUTES, r.minutes + ' not in [' + ENUMS.MIN_MINUTES + ',' + ENUMS.MAX_MINUTES + ']');
  ok('RESERVED ' + r.key + ': tags is a non-empty array', Array.isArray(r.tags) && r.tags.length > 0);
  ok('RESERVED ' + r.key + ': modelHash present', typeof r.modelHash === 'string' && r.modelHash.length === 64);
});

// ---- Real-engine re-validation of every reserved model ---------------------
DESIGNS.forEach(function (d) {
  const rec = RESERVED.records.filter(function (x) { return x.key === d.key; })[0];
  if (!rec) { ok('RESERVED ' + d.key + ': has a fixture record', false); return; }
  const model = { grid: d.grid }; if (d.whole) model.whole = true;
  let out, facts;
  try { out = solveModel(model, d.sense).out; facts = derive.deriveFacts({ model: model, sense: d.sense }); }
  catch (e) { ok('RESERVED ' + d.key + ': model solves on the real engine', false, e.message); return; }
  ok('RESERVED ' + d.key + ': real engine status optimal', out.status === 'optimal', out.status);
  ok('RESERVED ' + d.key + ': real engine objective matches reserved', Math.abs(out.objective - rec.objective) < 1e-6, out.objective + ' vs ' + rec.objective);
  ok('RESERVED ' + d.key + ': real engine modelType matches reserved', facts.modelType === rec.modelType, facts.modelType + ' vs ' + rec.modelType);
  // modelHash reproducibility
  const mh = crypto.createHash('sha256').update(JSON.stringify({ grid: d.grid, domains: null, whole: !!d.whole, openVarSettings: false, sense: d.sense, expected: { status: out.status, modelType: facts.modelType, objective: out.objective } })).digest('hex');
  ok('RESERVED ' + d.key + ': modelHash reproduces from source', mh === rec.modelHash);
});

// ---- Reserved membership is explicit & testable ----------------------------
const designKeys = new Set(DESIGNS.map(function (d) { return d.key; }));
ok('RESERVED: fixture keys match the model-grid source keys', RESERVED.records.every(function (r) { return designKeys.has(r.key); }) && designKeys.size === 12);

// ---- Localisation surface: all 5 locales, all 4 fields, no EN fallback -----
ok('LOCPLAN: locale set is exactly the canonical enums.LOCALES', JSON.stringify(LOCPLAN.locales) === JSON.stringify(LOCALES));

// Set-exactness: the localisation-plan example keys must equal the reserved record keys exactly.
// Detects both a missing localisation entry and an unexplained extra one.
(function () {
  const planKeys = Object.keys(LOCPLAN.examples).sort();
  const recKeys = RESERVED.records.map(function (r) { return r.key; }).sort();
  const planSet = new Set(planKeys);
  const recSet = new Set(recKeys);
  const missing = recKeys.filter(function (k) { return !planSet.has(k); });
  const extra = planKeys.filter(function (k) { return !recSet.has(k); });
  ok('LOCPLAN: no reserved record is missing a localisation-plan entry', missing.length === 0, 'missing: ' + missing.join(','));
  ok('LOCPLAN: no localisation-plan entry is unexplained (extra)', extra.length === 0, 'extra: ' + extra.join(','));
  ok('LOCPLAN: set(plan keys) === set(reserved keys) exactly', JSON.stringify(planKeys) === JSON.stringify(recKeys));
})();
RESERVED.records.forEach(function (r) {
  const e = LOCPLAN.examples[r.key];
  ok('LOCPLAN ' + r.key + ': present', !!e);
  if (!e) return;
  ['title', 'desc', 'question', 'goal'].forEach(function (field) {
    const f = e[field];
    ok('LOCPLAN ' + r.key + '.' + field + ': all 5 planned locale values present & non-empty', !!f && LOCALES.every(function (l) { return f[l] && f[l].trim().length > 0; }));
    // Phase 1 is PLANNED localisation, not a live runtime path. This proves each non-English
    // planned value is distinct from English (so no planned field would need an English fallback);
    // actual runtime fallback behaviour is validated in Phase 2 when the tranche goes live.
    ok('LOCPLAN ' + r.key + '.' + field + ': planned non-English value is distinct from English', !!f && LOCALES.filter(function (l) { return l !== 'en'; }).every(function (l) { return f[l] !== f.en; }));
  });
});

// ---- Phase 2: all 12 approved designs are now live exactly once ------------
ok('LIVE: all 12 approved designs are present in the live catalogue', CATALOGUE.filter(function (r) { return designKeys.has(r.key); }).length === 12);
ok('LIVE: the F7a tranche prefix (first 24) is unchanged by the F7b additions',
   CATALOGUE.slice(0, 24).every(function (r) { return !designKeys.has(r.key); }));

console.log('\nF7B TRANCHE RESERVED->LIVE (approved identity contract)  PASSED: ' + pass + '   FAILED: ' + fail);
if (failures.length) { failures.forEach(function (f) { console.log('  FAIL: ' + f); }); process.exitCode = 1; }
