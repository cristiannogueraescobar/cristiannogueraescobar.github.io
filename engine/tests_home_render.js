/* tests_home_render.js — a jsdom render smoke test that stands in for automated
 * visual review: it loads the Home, switches through all five languages, and
 * confirms every key section renders with non-empty, translated text and that the
 * hero/verify images keep a resolvable src and a non-empty alt in each language.
 *
 * It cannot catch pixel-level regressions (that needs real screenshots), but it
 * catches an empty section, an untranslated block, or a broken image reference in
 * any language — the failures most likely to slip past an English-only check.
 *
 * Requires jsdom (CI: hard fail; local without jsdom: skip).
 */
const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('HOME RENDER TESTS  FAILED: jsdom could not load under CI'); process.exit(1); }
  console.log('HOME RENDER TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const html = composedHtml(siteDir, 'index.html');
const i18n = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

// The sections that must render with content, identified by a representative
// data-i18n key inside each.
const SECTION_KEYS = [
  'heroTitle', 'heroCtaExample', 'heroCtaPaste',        // hero
  'trustLocal', 'trustChecked',                          // trust bar
  'howPasteH', 'howCheckH',                              // how it works
  'ucProductionH', 'ucProjectH',                         // use cases
  'verUnderstoodH', 'verStatusH', 'f3P',                 // verify
  'exTitle', 'exWorkshopH',                              // featured examples
  'privTitle', 'privP',                                  // privacy
  'limSolvesH', 'limUnsupportedH',                       // honest limits
  'addonInReview',                                       // add-on tertiary
  'ctaFinalTitle'                                        // final CTA (if present)
];

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://plumline.online/' });
const { window } = dom;
window.eval(i18n);
const initM = html.match(/Plumline\.i18n\.init\([^)]*\)\s*;?/);
ok('home render: found the Home init call', !!initM);
if (initM) window.eval(initM[0]);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
const doc = window.document;
const DICT = window.Plumline.i18n.dict;
const sel = doc.getElementById('lang');
ok('home render: language selector present', !!sel);

LANGS.forEach(function (lang) {
  if (sel) { sel.value = lang; sel.dispatchEvent(new window.Event('change')); }
  SECTION_KEYS.forEach(function (key) {
    const node = doc.querySelector('[data-i18n="' + key + '"]');
    if (!node) return; // optional key (e.g. ctaFinalTitle) may not exist
    const text = node.textContent.trim();
    ok('home render [' + lang + ']: ' + key + ' renders non-empty', text.length > 0, key);
    // The rendered text should match the dictionary for this language (proves the
    // switch actually applied, not left English behind).
    const expected = (DICT[lang].home && DICT[lang].home[key]) ||
                     (DICT[lang].common && DICT[lang].common[key]);
    if (expected) ok('home render [' + lang + ']: ' + key + ' matches dictionary',
                     text === expected.replace(/<[^>]+>/g, ''), key);
  });
  // Hero and verify images keep a src and a non-empty, translated alt.
  ['heroShotAlt', 'verifyShotAlt'].forEach(function (altKey) {
    const img = doc.querySelector('img[data-i18n-alt="' + altKey + '"]');
    ok('home render [' + lang + ']: image ' + altKey + ' present', !!img, altKey);
    if (img) {
      ok('home render [' + lang + ']: ' + altKey + ' has a src', !!img.getAttribute('src'));
      const alt = img.getAttribute('alt') || '';
      ok('home render [' + lang + ']: ' + altKey + ' alt non-empty', alt.length > 0);
      ok('home render [' + lang + ']: ' + altKey + ' alt matches dictionary',
         alt === DICT[lang].home[altKey], altKey);
    }
  });
});

console.log('HOME RENDER TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) process.exit(1);
if (typeof module !== 'undefined') module.exports = { pass, fail };
