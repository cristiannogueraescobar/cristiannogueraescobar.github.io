/**
 * tests_i18n_pages.js — every data-i18n / data-i18n-aria key used in the HTML
 * must be PRESENT in every language's dictionary (en, es, pt, de, fr).
 *
 * Critical: this checks direct presence in DICT[lang][page] or DICT[lang].common
 * via hasOwnProperty. It must NOT use Plumline.i18n.t(), because t() falls back
 * to English when a translation is missing and would report a missing Spanish
 * key as present — a false positive. This test catches the silent-fallback bug
 * that init() not throwing cannot catch.
 *
 * Run: node engine/tests_i18n_pages.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
const src = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
new Function('window', 'navigator', 'location', 'document', 'globalThis', src).call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;

const PAGE_OF = {
  'index.html': 'home', 'solver.html': 'solver', 'guide.html': 'guide',
  'about.html': 'about', 'examples.html': 'examples',
  'privacy.html': 'legal', 'terms.html': 'legal'
};

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Direct presence: defined in this language's page table OR common table.
// No English fallback — a key present only in EN counts as MISSING for others.
function has(lang, page, key) {
  const L = DICT[lang];
  if (!L) return false;
  const inPage = L[page] && Object.prototype.hasOwnProperty.call(L[page], key);
  const inCommon = L.common && Object.prototype.hasOwnProperty.call(L.common, key);
  return !!(inPage || inCommon);
}

Object.keys(PAGE_OF).forEach(function (file) {
  const page = PAGE_OF[file];
  const html = fs.readFileSync(path.join(siteDir, file), 'utf8');
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) keys.add(m[1]);
  keys.forEach(function (key) {
    LANGS.forEach(function (lang) {
      ok(file + ' [' + lang + '] ' + key, has(lang, page, key), 'missing from ' + lang + '.' + page + ' / ' + lang + '.common');
    });
  });
});

// Self-check: prove the test detects a missing es key rather than passing
// everything via an English fallback.
(function () {
  const sampleKey = Object.keys(DICT.en.home || {})[0];
  if (!sampleKey) return;
  const esHome = DICT.es.home || (DICT.es.home = {});
  const had = Object.prototype.hasOwnProperty.call(esHome, sampleKey);
  const saved = esHome[sampleKey];
  if (had) delete esHome[sampleKey];
  const inEsCommon = DICT.es.common && Object.prototype.hasOwnProperty.call(DICT.es.common, sampleKey);
  const detectsMissing = has('en', 'home', sampleKey) === true && has('es', 'home', sampleKey) === false && !inEsCommon;
  if (had) esHome[sampleKey] = saved;
  ok('self-check: detects a missing es key (no en fallback)', detectsMissing);
})();

console.log('I18N PAGE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
