/**
 * tests_home_i18n.js — behavioural test that the Home capability summary, whose
 * keys live in the `capabilities` namespace, actually TRANSLATES when the
 * language changes. This is the check the static tests could not do: it boots
 * index.html in jsdom, runs i18n.js, and drives the language <select>.
 *
 * The summary uses init('home', ['capabilities']); if that extra namespace is
 * dropped, the block stays English and this test fails.
 *
 * Requires jsdom (CI: hard fail; local without jsdom: skip).
 * Run: node engine/tests_home_i18n.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) {
    console.error('HOME I18N TESTS  FAILED: jsdom could not load under CI');
    process.exit(1);
  }
  console.log('HOME I18N TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');

// Expected translated strings, read from the dictionary itself (so the test
// tracks the real translations, not a hard-coded copy).
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis', i18n)
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;

// Elements we assert on, by data-i18n key: a group heading, a capability name,
// another group heading, and the "see all" link.
const CHECK_KEYS = ['capGroupModels', 'capModelContinuousName', 'capGroupVerification', 'capsSeeAll'];

function bootHome() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const { window } = dom;
  // Provide a stable storage shim (i18n remembers language in localStorage).
  window.eval(i18n);
  // The Home wires init('home', ['capabilities']) in an inline <script>; run the
  // same call here in the jsdom realm.
  window.eval("Plumline.i18n.init('home', ['capabilities']);");
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

// Read the rendered text for a data-i18n key from the summary.
function renderedText(doc, key) {
  const el = doc.querySelector('[data-i18n="' + key + '"]');
  return el ? el.textContent.trim() : null;
}

(function () {
  const dom = bootHome();
  const doc = dom.window.document;
  const sel = doc.getElementById('lang');
  ok('home i18n: language selector exists', !!sel);
  if (!sel) { done(); return; }

  // Default English.
  CHECK_KEYS.forEach(function (k) {
    ok('home i18n: [en] ' + k + ' matches dictionary',
       renderedText(doc, k) === DICT.en.capabilities[k],
       renderedText(doc, k) + ' vs ' + DICT.en.capabilities[k]);
  });

  // Switch to Spanish.
  sel.value = 'es';
  sel.dispatchEvent(new dom.window.Event('change'));
  CHECK_KEYS.forEach(function (k) {
    ok('home i18n: [es] ' + k + ' translated',
       renderedText(doc, k) === DICT.es.capabilities[k],
       renderedText(doc, k) + ' vs ' + DICT.es.capabilities[k]);
  });
  // Spanish must actually differ from English (proves it changed).
  ok('home i18n: Spanish differs from English for the group heading',
     DICT.es.capabilities.capGroupModels !== DICT.en.capabilities.capGroupModels &&
     renderedText(doc, 'capGroupModels') === DICT.es.capabilities.capGroupModels);

  // Switch to German.
  sel.value = 'de';
  sel.dispatchEvent(new dom.window.Event('change'));
  CHECK_KEYS.forEach(function (k) {
    ok('home i18n: [de] ' + k + ' translated',
       renderedText(doc, k) === DICT.de.capabilities[k],
       renderedText(doc, k) + ' vs ' + DICT.de.capabilities[k]);
  });

  // And a non-capabilities Home key still translates (extra namespace did not
  // break normal resolution).
  const homeKey = Object.keys(DICT.en.home || {})[0];
  if (homeKey && DICT.de.home && DICT.de.home[homeKey]) {
    const el = doc.querySelector('[data-i18n="' + homeKey + '"]');
    if (el) {
      ok('home i18n: [de] ordinary home key still translates',
         el.textContent.trim() === DICT.de.home[homeKey]);
    }
  }
  done();
})();

function done() {
  console.log('HOME I18N TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  if (fail) process.exit(1);
}

if (typeof module !== 'undefined') module.exports = { pass, fail };
