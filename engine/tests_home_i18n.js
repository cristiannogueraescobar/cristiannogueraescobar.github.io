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
const { composedHtml } = require('./composed-html.js');

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

const html = composedHtml(siteDir, 'index.html');
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
  // Execute the Home's OWN inline init script, extracted from index.html, so
  // this test exercises the real wiring. If someone changes the real call to
  // init('home') and drops the namespace, the summary will stay English here and
  // the assertions below fail — which is the whole point.
  const inlineInit = extractHomeInit(html);
  if (!inlineInit) throw new Error('could not find the Home init() call in index.html');
  window.eval(inlineInit);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

// Pull the actual "Plumline.i18n.init('home', ...)" statement out of index.html
// so the test runs the real call, not a hand-written copy of it.
function extractHomeInit(src) {
  const m = src.match(/Plumline\.i18n\.init\('home'[^)]*\)\s*;?/);
  return m ? m[0] : null;
}

// Read the rendered text for a data-i18n key from the summary.
function renderedText(doc, key) {
  const el = doc.querySelector('[data-i18n="' + key + '"]');
  return el ? el.textContent.trim() : null;
}

(function () {
  // Static guard: index.html must wire the capabilities namespace. This catches
  // a regression to init('home') even before the behavioural check runs.
  ok('home i18n: index.html initialises the capabilities namespace',
     html.includes("Plumline.i18n.init('home', ['capabilities'])"),
     'expected init(\'home\', [\'capabilities\']) in index.html');

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

  // The t() API must also resolve extra namespaces, so both entry points behave
  // the same. Without the extra arg it cannot see a capabilities key from home.
  const T = dom.window.Plumline.i18n.t;
  ok('home i18n: t() resolves a capabilities key from home with the extra namespace',
     T('es', 'home', 'capGroupModels', ['capabilities']) === DICT.es.capabilities.capGroupModels);
  ok('home i18n: t() without the extra namespace does not reach capabilities',
     T('es', 'home', 'capGroupModels') === 'capGroupModels');
  ok('home i18n: t() still resolves ordinary home keys',
     !homeKey || T('de', 'home', homeKey) === DICT.de.home[homeKey]);

  // Deliberate collision: the SAME key present in common, home and capabilities
  // with different values. apply() (via the DOM) and t() must return the SAME
  // string — proving both use one resolution order. We inject a temp key into
  // the live jsdom dictionary, add a node that uses it, re-apply, then compare.
  (function () {
    const D = dom.window.Plumline.i18n.dict;
    const KEY = '__collisionProbe__';
    D.en.common[KEY] = 'COMMON'; D.en.home[KEY] = 'HOME'; D.en.capabilities[KEY] = 'CAPS';
    // A node carrying the probe key, inside the summary area.
    const probe = doc.createElement('span');
    probe.setAttribute('data-i18n', KEY);
    doc.body.appendChild(probe);
    // Re-run the real init so apply() repaints with the same namespaces.
    dom.window.eval(extractHomeInit(html));
    const domValue = probe.textContent.trim();
    const tValue = T('en', 'home', KEY, ['capabilities']);
    ok('home i18n: apply() and t() agree on a common/home/capabilities collision',
       domValue === tValue, 'DOM=' + domValue + ' t()=' + tValue);
    // Both must resolve to the common value (first in the shared order).
    ok('home i18n: collision resolves to the common namespace for both',
       domValue === 'COMMON' && tValue === 'COMMON', 'DOM=' + domValue + ' t()=' + tValue);
    // Clean up the probe so nothing leaks between test cases.
    delete D.en.common[KEY]; delete D.en.home[KEY]; delete D.en.capabilities[KEY];
    probe.remove();
  })();

  // Image alt translation: both hero and verify screenshots translate through a
  // real EN -> ES -> DE switch, no alt ends up empty, and an unknown key keeps
  // the existing text rather than clearing the attribute.
  (function () {
    // The hero image was replaced in F3a by a semantic HTML/CSS product demo,
    // so the verify-section image is the remaining translated image on Home.
    const verifyImg = doc.querySelector('img[data-i18n-alt="verifyShotAlt"]');
    ok('home i18n: verify image present', !!verifyImg);
    if (!verifyImg) { done(); return; }
    ['es', 'de'].forEach(function (lang) {
      sel.value = lang;
      sel.dispatchEvent(new dom.window.Event('change'));
      ok('home i18n: verify alt translated to ' + lang,
         verifyImg.getAttribute('alt') === DICT[lang].home.verifyShotAlt, verifyImg.getAttribute('alt').slice(0, 30));
      ok('home i18n: verify alt non-empty in ' + lang, verifyImg.getAttribute('alt').length > 0);
    });
    // Unknown key keeps existing alt (apply only writes when lookup returns a value).
    const before = verifyImg.getAttribute('alt');
    verifyImg.setAttribute('data-i18n-alt', '__missingKey__');
    sel.value = 'en'; sel.dispatchEvent(new dom.window.Event('change'));
    ok('home i18n: unknown alt key keeps existing text (attribute not cleared)',
       verifyImg.getAttribute('alt') === before && before.length > 0, verifyImg.getAttribute('alt').slice(0, 30));
    verifyImg.setAttribute('data-i18n-alt', 'verifyShotAlt');
  })();
  done();
})();

function done() {
  console.log('HOME I18N TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  if (fail) process.exit(1);
}

if (typeof module !== 'undefined') module.exports = { pass, fail };
