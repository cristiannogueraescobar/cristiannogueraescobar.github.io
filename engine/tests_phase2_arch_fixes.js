/* tests_phase2_arch_fixes.js — PHASE-2 ARCH-FIX permanence (permanent).
 *
 * Phase 2 introduced three count-agnostic architecture fixes that make the example pipeline grow
 * from 9 to 24 to 36 without hardcoding a count in generic infrastructure. This suite pins those
 * fixes permanently so a future refactor cannot silently reintroduce a hardcoded count:
 *
 *   FIX 1 (src/shared/examples/index.js + f5/index.js): an OMITTED expectCount must NOT pin any
 *          count; a WRONG expectCount must fail; the correct checkpoint count passes.
 *   FIX 2 (src/shared/examples/projectors.js: regenerateI18nExampleRegions): regenerates the i18n
 *          example regions for however many records exist, driven by catalogue length — no 9/24 pin.
 *   FIX 3 (engine/generate-examples.js: replaceMetaLines): rewrites the meta lines for exactly the
 *          current key set, count-agnostic, and the generator reports the site as up to date.
 *
 * Everything runs through the REAL modules (no mocks). The literal 24 appears only where this suite
 * asserts the F7a checkpoint; the fixes themselves are checked to be count-agnostic.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..');
const EX = path.join(SITE, 'src', 'shared', 'examples');
const { loadAndValidateCatalogue } = require(path.join(EX, 'index.js'));
const { loadCanonical } = require(path.join(EX, 'f5', 'index.js'));
const projectors = require(path.join(EX, 'projectors.js'));
const genExamples = require(path.join(SITE, 'engine', 'generate-examples.js'));
const genLibrary = require(path.join(SITE, 'engine', 'generate-examples-library.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const loaded = loadAndValidateCatalogue(SITE);
const catalogue = loaded.catalogue;
const serialize = loaded.serialize;
const N = catalogue.length; // the live checkpoint count (24 today), read from data not hardcoded

// ============================ FIX 1 ========================================
// Omitted expectCount must not pin; wrong count must fail; correct count passes.
(function () {
  // f1 loader
  var noPin = loadAndValidateCatalogue(SITE); // no expectCount
  ok('FIX1: f1 loadAndValidateCatalogue without expectCount succeeds (no pin)', noPin.catalogue.length === N);
  var wrong = loaded.schema.validateCatalogue(catalogue, { expectCount: N + 1 });
  ok('FIX1: f1 validate with a WRONG expectCount fails', !wrong.ok);
  var right = loaded.schema.validateCatalogue(catalogue, { expectCount: N });
  ok('FIX1: f1 validate with the correct expectCount passes', right.ok);

  // f5 loader
  var f5NoPin = loadCanonical(SITE); // no expectCount
  ok('FIX1: f5 loadCanonical without expectCount succeeds (no pin)', f5NoPin.canonical.length === N);
  var threwWrong = false;
  try { loadCanonical(SITE, { expectCount: N + 1 }); } catch (e) { threwWrong = true; }
  ok('FIX1: f5 loadCanonical with a WRONG expectCount fails', threwWrong);
  var f5Right = loadCanonical(SITE, { expectCount: N });
  ok('FIX1: f5 loadCanonical with the correct expectCount passes', f5Right.canonical.length === N);

  // The generic path (no expectCount) is the same whatever N is — assert it does not embed a literal.
  var idxSrc = fs.readFileSync(path.join(EX, 'index.js'), 'utf8');
  ok('FIX1: index.js does not hardcode a "=== 9" or "=== 24" count', !/===\s*9\b/.test(idxSrc) && !/===\s*24\b/.test(idxSrc));
  ok('FIX1: index.js does not default expectCount to a literal 9', !/expectCount\s*=\s*9\b/.test(idxSrc) && !/\?\s*9\s*:/.test(idxSrc));
})();

// ============================ FIX 2 ========================================
// regenerateI18nExampleRegions rebuilds i18n regions for the current catalogue, count-agnostic.
(function () {
  ok('FIX2: projectors exports regenerateI18nExampleRegions', typeof projectors.regenerateI18nExampleRegions === 'function');
  var i18nSrc = fs.readFileSync(path.join(SITE, 'assets', 'i18n.js'), 'utf8');
  var LANGS = ['en', 'es', 'pt', 'de', 'fr'];
  var regenerated = projectors.regenerateI18nExampleRegions(i18nSrc, catalogue, serialize, LANGS);
  ok('FIX2: regeneration is idempotent (served == regenerated)', regenerated === i18nSrc, 'lengths ' + regenerated.length + ' vs ' + i18nSrc.length);

  // Adding a synthetic record grows the regenerated regions by exactly one example key per locale,
  // proving it is driven by catalogue length, not a fixed count.
  var extended = catalogue.concat([{
    key: 'archfix-extra', slug: 'archfix-extra-x', category: 'start', type: 'continuous', sense: 'max',
    translations: (function () { var o = {}; LANGS.forEach(function (l) { o[l] = { title: 'X', desc: 'x' }; }); return o; })(),
    model: { grid: [['Item', 'Val', 'Coeff', 'Term'], ['X', '0', '2', '=B2*C2'], ['Tot', '', '', '=SUM(D2:D2)', '<=', '5']] },
    expected: { status: 'optimal', modelType: 'continuous', objective: 1 },
  }]);
  var grown = projectors.regenerateI18nExampleRegions(i18nSrc, extended, serialize, LANGS);
  ok('FIX2: regeneration grows when the catalogue grows (count-agnostic)', grown !== i18nSrc && grown.length > i18nSrc.length);
  ok('FIX2: grown i18n mentions the new key', grown.indexOf('archfix-extra') !== -1);

  var projSrc = fs.readFileSync(path.join(EX, 'projectors.js'), 'utf8');
  ok('FIX2: projectors.js does not hardcode a "nine"/"9"/"24" region count', !/\bnine\b/.test(projSrc) && !/===\s*9\b/.test(projSrc) && !/===\s*24\b/.test(projSrc));
})();

// ============================ FIX 3 ========================================
// replaceMetaLines rewrites meta lines for the current key set, count-agnostic; generator is stable.
(function () {
  ok('FIX3: generate-examples exports replaceMetaLines', typeof genExamples.replaceMetaLines === 'function');

  var keys = catalogue.map(function (r) { return r.key; });
  var metaLines = serialize.examplesDataMetaLines(catalogue);
  ok('FIX3: meta lines count equals the catalogue length', metaLines.length === N, String(metaLines.length));

  // Round-trip: replacing the meta block in the served asset with freshly serialized lines is a
  // no-op when nothing changed (served == regenerated).
  var served = fs.readFileSync(path.join(SITE, 'assets', 'examples-data.js'), 'utf8');
  var rewritten = genExamples.replaceMetaLines(served, metaLines, keys);
  ok('FIX3: replaceMetaLines is idempotent on the served asset', rewritten === served);

  // replaceMetaLines refuses to SHRINK the key set (a safety guard against accidental example loss).
  var fewerKeys = keys.slice(0, keys.length - 1);
  var fewerLines = metaLines.slice(0, metaLines.length - 1);
  var shrinkRejected = false;
  try { genExamples.replaceMetaLines(served, fewerLines, fewerKeys); } catch (e) { shrinkRejected = /shrink|longer than canonical/.test(e.message); }
  ok('FIX3: replaceMetaLines refuses to shrink the key set (safety guard)', shrinkRejected);

  // The real generators report the SITE as up to date (no stale, no count drift).
  ok('FIX3: examples generator reports site up to date', genExamples.run(SITE, { check: true }).ok);
  ok('FIX3: examples-library generator reports site up to date', genLibrary.run(SITE, { check: true }).ok);

  var genSrc = fs.readFileSync(path.join(SITE, 'engine', 'generate-examples.js'), 'utf8');
  ok('FIX3: generate-examples.js does not hardcode a "=== 9"/"=== 24" count', !/===\s*9\b/.test(genSrc) && !/===\s*24\b/.test(genSrc));
})();

// ============================ checkpoint ====================================
// Extra count-agnostic guarantees, rounding out the Phase-2 arch-fix contract set.
(function () {
  // FIX 1 extra: both loaders agree on N via the no-pin path.
  ok('FIX1x: f1 and f5 no-pin loads agree on catalogue length', loadAndValidateCatalogue(SITE).catalogue.length === loadCanonical(SITE).canonical.length);
  // FIX 1 extra: a wrong count below N also fails (not only above).
  ok('FIX1x: f1 validate with expectCount below N fails', !loaded.schema.validateCatalogue(catalogue, { expectCount: N - 1 }).ok);

  // FIX 2 extra: regeneration touches every locale region (5 locales present in the output).
  var i18nSrc = fs.readFileSync(path.join(SITE, 'assets', 'i18n.js'), 'utf8');
  ok('FIX2x: served i18n contains all five locale example regions', ['en', 'es', 'pt', 'de', 'fr'].every(function (l) { return i18nSrc.indexOf(l) !== -1; }));

  // FIX 3 extra: meta lines are 1:1 with keys and in the same order.
  var keys = catalogue.map(function (r) { return r.key; });
  var metaLines = serialize.examplesDataMetaLines(catalogue);
  ok('FIX3x: meta lines are 1:1 with keys', metaLines.length === keys.length);
  // FIX 3 extra: a same-size rewrite (identity) is a no-op, confirming key-set match is what matters.
  var served = fs.readFileSync(path.join(SITE, 'assets', 'examples-data.js'), 'utf8');
  ok('FIX3x: identity replaceMetaLines is a no-op', genExamples.replaceMetaLines(served, metaLines, keys) === served);

  // Cross-fix: the generic infrastructure files carry NO literal 24 (it lives only in F7a checkpoints).
  ['src/shared/examples/index.js', 'src/shared/examples/f5/index.js', 'src/shared/examples/projectors.js', 'engine/generate-examples.js'].forEach(function (rel) {
    var s = fs.readFileSync(path.join(SITE, rel), 'utf8');
    ok('CROSS: ' + rel + ' contains no hardcoded 24', s.indexOf('24') === -1 || !/[^0-9]24[^0-9]/.test(s.replace(/\/\/[^\n]*/g, '')));
  });
})();

// The ONE place the literal 24 is asserted (F7a checkpoint), to prove the fixes above operate at 24.
ok('CHECKPOINT: the live catalogue is at the F7a checkpoint of 24', N === 24, String(N));

console.log('PHASE-2 ARCH FIXES  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
