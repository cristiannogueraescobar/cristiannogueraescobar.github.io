/* Checkpoint F1 GATE C — i18n example-translation projection guard.
 *
 * The example title/description translations have a SINGLE authority: the canonical
 * catalogue (src/shared/examples/catalogue.js). assets/i18n.js historically repeats
 * each translation in TWO sub-sections per language ("examples" and "solver"),
 * 9 keys x 2 x 5 languages = 90 exName + 90 exDesc = 180 occurrences.
 *
 * i18n.js is a served asset (source == dist), so it is NOT edited or marked; instead
 * this guard asserts that every one of the 180 occurrences is exactly what the
 * catalogue projects. If a translation is edited in the catalogue but not in i18n.js
 * (or vice-versa), the counts diverge and this trips — that is the stale guard.
 *
 * Positive: the live tree projects all 180 occurrences faithfully.
 * Negatives: on a mutated temp copy, a changed / missing / extra / wrong-language /
 *            wrong-key occurrence is detected.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE = path.join(__dirname, '..');
const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

function loadCatalogue(dir) {
  const p = path.resolve(dir, 'src', 'shared', 'examples', 'catalogue.js');
  delete require.cache[p];
  return require(p).CATALOGUE;
}
function loadSerialize(dir) {
  const p = path.resolve(dir, 'src', 'shared', 'examples', 'serialize.js');
  delete require.cache[p];
  return require(p);
}

// The core guard: returns { ok, mismatches:[{literal,expected,found}] }.
function checkI18nProjection(dir) {
  const catalogue = loadCatalogue(dir);
  const ser = loadSerialize(dir);
  const i18n = fs.readFileSync(path.join(dir, 'assets', 'i18n.js'), 'utf8');
  const occ = ser.i18nExpectedOccurrences(catalogue, LANGS);
  const mismatches = [];
  occ.forEach(function (o) {
    const found = i18n.split(o.literal).length - 1;
    if (found !== o.expected) mismatches.push({ literal: o.literal, expected: o.expected, found: found });
  });
  return { ok: mismatches.length === 0, mismatches: mismatches, total: occ.length };
}

if (require.main === module) {
// ---- Positive: live tree ------------------------------------------------------
(function () {
  const r = checkI18nProjection(SITE);
  const catalogue = loadCatalogue(SITE);
  // Generic (count-agnostic): the projection emits one literal per (record x field x locale), i.e.
  // catalogue.length * 2 fields (exName/exDesc) * 5 locales. Holds for any catalogue size.
  ok('i18n literal count == catalogue.length * 2 * 5', r.total === catalogue.length * 2 * LANGS.length,
    'literals=' + r.total + ' catalogue=' + catalogue.length);
  // F7a checkpoint: 24 * 2 * 5 = 240 distinct literals.
  ok('F7a: i18n literals == 240', r.total === 240, 'literals=' + r.total);
  // Physical occurrences: i18n.js repeats each literal in TWO physical sub-sections (the exName_ and
  // exDesc_ blocks are each emitted once per locale, and the projection writes both), so the total
  // PHYSICAL occurrence count is literals * 2 = catalogue.length * 2 * 5 * 2. Documented separately
  // from the literal count so the two namespaces are not conflated.
  const occ = loadSerialize(SITE).i18nExpectedOccurrences(catalogue, LANGS);
  const physical = occ.reduce((s, o) => s + o.expected, 0);
  ok('i18n physical occurrences == literals * 2 subsections', physical === r.total * 2, 'physical=' + physical);
  ok('F7a: i18n physical occurrences == 480', physical === 480, 'physical=' + physical);
  ok('live i18n.js is a faithful projection of the catalogue', r.ok,
    r.mismatches.slice(0, 3).map(m => m.literal.slice(0, 40) + ' exp ' + m.expected + ' got ' + m.found).join('; '));
})();

// ---- Negatives: mutate a temp copy -------------------------------------------
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-i18n-'));
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'shared', 'examples'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'i18n.js'), fs.readFileSync(path.join(SITE, 'assets', 'i18n.js')));
  for (const f of ['catalogue.js', 'serialize.js']) {
    fs.writeFileSync(path.join(dir, 'src', 'shared', 'examples', f),
      fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', f)));
  }
  return dir;
}
function expectTrip(label, mutate) {
  const dir = makeTree();
  try {
    ok(label + ': clean copy passes', checkI18nProjection(dir).ok);
    mutate(dir);
    ok(label + ': mutation trips the guard', !checkI18nProjection(dir).ok);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const i18nPath = dir => path.join(dir, 'assets', 'i18n.js');
const catPath = dir => path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
const rd = p => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);

// N1. A translation value changed in i18n.js only (one of two occurrences drifts).
expectTrip('N1 i18n value changed', dir => {
  wr(i18nPath(dir), rd(i18nPath(dir)).replace("exName_production:'Production plan'", "exName_production:'Prod plan'"));
});
// N2. A translation value changed in the catalogue only.
expectTrip('N2 catalogue value changed', dir => {
  wr(catPath(dir), rd(catPath(dir)).replace('"title": "Production plan"', '"title": "Prod plan"'));
});
// N3. An occurrence removed from i18n.js (now only one instead of two).
expectTrip('N3 occurrence removed', dir => {
  wr(i18nPath(dir), rd(i18nPath(dir)).replace("        exName_shipping:'Shipping plan',\n", ''));
});
// N4. An extra occurrence added to i18n.js (now three instead of two).
expectTrip('N4 extra occurrence', dir => {
  wr(i18nPath(dir), rd(i18nPath(dir)).replace("        exName_blend:'Cheapest feed blend',\n",
    "        exName_blend:'Cheapest feed blend',\n        exName_blend:'Cheapest feed blend',\n"));
});
// N5. A wrong-language value (catalogue fr title mutated) trips.
expectTrip('N5 wrong-language value', dir => {
  wr(catPath(dir), rd(catPath(dir)).replace('"title": "Plan de production"', '"title": "XXXX"'));
});

console.log('EXAMPLES I18N PROJECTION TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}

module.exports = { checkI18nProjection: checkI18nProjection };
