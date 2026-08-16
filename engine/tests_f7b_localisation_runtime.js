/* tests_f7b_localisation_runtime.js — F7b LOCALISATION RUNTIME contract (permanent).
 *
 * Phase 2 makes the approved F7b localisation LIVE. This suite exercises the REAL product projection
 * paths (not fixture inspection) and proves that, for every one of the 12 F7b examples and every
 * supported non-English locale (es, pt, de, fr), the runtime returns the correct localised value and
 * does NOT silently fall back to English:
 *
 *   - library.libraryPayload(canonical) -> examples[].locales[loc] {title, description, question}
 *     (the F6 Examples Library runtime payload, i.e. window.PL_LIBRARY),
 *   - project.searchDocument(record, loc) {title, description, question}
 *     (the real F5 search projection used by the library filter/search path),
 *   - project.legacyMeta / metadata.content goal projection for the localde goal string.
 *
 * The approved localisation plan (engine/fixtures/f7b-tranche/f7b-localisation-plan.json) is the
 * expected-value authority; the runtime is the path under test. A silent English fallback would make
 * a non-English value equal to English (or wrong) — that is exactly what this fails on.
 */
'use strict';
const path = require('path');

const SITE = path.join(__dirname, '..');
const library = require(path.join(SITE, 'src', 'shared', 'examples', 'f6', 'library.js'));
const project = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'project.js'));
const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));
const META = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'metadata.js')).METADATA;
const ENUMS = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'enums.js'));
const LOCPLAN = require(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-localisation-plan.json'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const F7B_KEYS = Object.keys(LOCPLAN.examples);
const NON_EN = ENUMS.LOCALES.filter(function (l) { return l !== 'en'; });

const canonical = loadCanonical(SITE).canonical;
const payload = library.libraryPayload(canonical);
const byKey = {}; payload.examples.forEach(function (e) { byKey[e.id || e.key] = e; });
const canonByKey = {}; canonical.forEach(function (c) { canonByKey[c.key] = c; });

ok('RUNTIME: all 12 F7b examples present in the live library payload',
   F7B_KEYS.every(function (k) { return !!byKey[k]; }), F7B_KEYS.filter(function (k) { return !byKey[k]; }).join(','));

F7B_KEYS.forEach(function (key) {
  const plan = LOCPLAN.examples[key];
  const libEx = byKey[key];
  const canonEx = canonByKey[key];

  NON_EN.forEach(function (loc) {
    // ---- 1. Library payload runtime: title / description / question ----
    if (libEx && libEx.locales && libEx.locales[loc]) {
      const L = libEx.locales[loc];
      ok('RUNTIME lib ' + key + '/' + loc + ': title matches approved localisation',
         L.title === plan.title[loc], 'got ' + JSON.stringify(L.title));
      ok('RUNTIME lib ' + key + '/' + loc + ': description matches approved localisation',
         L.description === plan.desc[loc], 'got ' + JSON.stringify(L.description));
      ok('RUNTIME lib ' + key + '/' + loc + ': question matches approved localisation',
         L.question === plan.question[loc], 'got ' + JSON.stringify(L.question));
      // no silent English fallback: the localised values differ from the English payload values
      const EN = libEx.locales.en;
      ok('RUNTIME lib ' + key + '/' + loc + ': title is NOT an English fallback',
         L.title !== EN.title, 'both = ' + JSON.stringify(L.title));
      ok('RUNTIME lib ' + key + '/' + loc + ': question is NOT an English fallback',
         L.question !== EN.question, 'both = ' + JSON.stringify(L.question));
    } else {
      ok('RUNTIME lib ' + key + '/' + loc + ': locale block present in payload', false, 'missing locale block');
    }

    // ---- 2. Search projection runtime: title / description / question ----
    if (canonEx) {
      const sd = project.searchDocument(canonEx, loc);
      ok('RUNTIME search ' + key + '/' + loc + ': title matches approved localisation',
         sd.title === plan.title[loc], 'got ' + JSON.stringify(sd.title));
      ok('RUNTIME search ' + key + '/' + loc + ': description matches approved localisation',
         sd.description === plan.desc[loc], 'got ' + JSON.stringify(sd.description));
      ok('RUNTIME search ' + key + '/' + loc + ': question matches approved localisation',
         sd.question === plan.question[loc], 'got ' + JSON.stringify(sd.question));
      const sdEn = project.searchDocument(canonEx, 'en');
      ok('RUNTIME search ' + key + '/' + loc + ': title is NOT an English fallback',
         sd.title !== sdEn.title, 'both = ' + JSON.stringify(sd.title));
      ok('RUNTIME search ' + key + '/' + loc + ': description is NOT an English fallback',
         sd.description !== sdEn.description, 'both = ' + JSON.stringify(sd.description));
      ok('RUNTIME search ' + key + '/' + loc + ': question is NOT an English fallback',
         sd.question !== sdEn.question, 'both = ' + JSON.stringify(sd.question));
    }

    // ---- 3. metadata.content goal projection (the localised goal string) ----
    const m = META[key];
    if (m && m.content && m.content.goal) {
      ok('RUNTIME goal ' + key + '/' + loc + ': matches approved localisation',
         m.content.goal[loc] === plan.goal[loc], 'got ' + JSON.stringify(m.content.goal[loc]));
      ok('RUNTIME goal ' + key + '/' + loc + ': is NOT an English fallback',
         m.content.goal[loc] !== m.content.goal.en, 'both = ' + JSON.stringify(m.content.goal[loc]));
    } else {
      ok('RUNTIME goal ' + key + '/' + loc + ': content.goal present', false, 'missing content.goal');
    }
  });
});

console.log('F7B LOCALISATION RUNTIME  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
