/**
 * tests_error_i18n.js — engine errors carrying the STRICT_INEQUALITY marker
 * must be shown to the user in the active language on EVERY display route, not
 * only the Web Worker path.
 *
 * Two layers:
 *   1. Static: each of the four display routes (worker onmessage, compat
 *      fallback read, solve error, Variable Settings) must pass the raw message
 *      through localizeEngineError — so accidentally dropping it in one route
 *      fails CI.
 *   2. Functional: localizeEngineError maps the marker to the localized string
 *      in all five languages, and showTrouble renders that string into #result.
 *
 * Requires jsdom (CI installs it). Skips locally without it.
 * Run: node engine/tests_error_i18n.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const solverSrc = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// ---- Layer 1: static route coverage -------------------------------------
// Every showTrouble call that surfaces an engine error message must wrap it in
// localizeEngineError. Count the raw ones that don't.
const rawErrorDisplays = (solverSrc.match(/showTrouble\([^;]*String\(err\.message[^;]*\)/g) || [])
  .filter(s => !/localizeEngineError/.test(s));
ok('no showTrouble surfaces a raw engine error message', rawErrorDisplays.length === 0,
   rawErrorDisplays.join(' | '));
// The worker route surfaces e.data.error — it too must be localized.
ok('worker error route uses localizeEngineError',
   /showTrouble\(t\([^)]*\),\s*localizeEngineError\(e\.data\.error/.test(solverSrc));
// At least four distinct localized display routes exist (worker + 3 fallbacks).
const localizedRoutes = (solverSrc.match(/showTrouble\([^;]*localizeEngineError/g) || []).length;
ok('at least four display routes localize engine errors', localizedRoutes >= 4, localizedRoutes + ' routes');

// ---- Layer 2: functional localization -----------------------------------
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('ERROR I18N TESTS  FAILED: jsdom missing under CI'); process.exit(1); }
  console.log('  (skipping functional layer — jsdom not installed)');
  console.log('ERROR I18N TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}

const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
const html = solverSrc.replace(/<script src="assets\/[^"]*"[^>]*><\/script>/g, '');
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://plumline.online/solver.html',
  beforeParse(window) {
    window.__PLUMLINE_TEST__ = true;
    window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, addListener() {} }; };
    window.scrollTo = window.scrollTo || function () {};
    if (window.Element) window.Element.prototype.scrollIntoView = function () {};
    window.console.log = function () {}; window.console.warn = function () {};
    window.eval(i18nSrc);
  }
});
const { window } = dom;

setTimeout(function () {
  const api = window.__plumline;
  if (!api || !api.localizeEngineError) { console.log('ERROR I18N TESTS  FAILED: hook missing'); process.exit(1); }
  const document = window.document;
  const marker = 'STRICT_INEQUALITY: Cap uses "<". ...';

  // Expected localized prefixes per language (first word is enough to tell them
  // apart and confirms the right dictionary entry is used).
  const expect = {
    en: /^Strict inequalities/, es: /^Las desigualdades estrictas/,
    pt: /^Desigualdades estritas/, de: /^Strikte Ungleichungen/,
    fr: /^Les in\u00e9galit\u00e9s strictes/
  };
  Object.keys(expect).forEach(function (lang) {
    api.setLang(lang);
    const localized = api.localizeEngineError(marker);
    ok('localizes strict-inequality error in ' + lang, expect[lang].test(localized), localized.slice(0, 40));
    ok(lang + ': localized message drops the raw marker', localized.indexOf('STRICT_INEQUALITY') === -1, localized.slice(0, 40));
    // And showTrouble must render that localized text into #result.
    api.showTrouble('T', api.localizeEngineError(marker));
    const shown = document.getElementById('result').textContent;
    ok(lang + ': showTrouble renders the localized message', expect[lang].test(shown.replace(/^T\.?\s*/, '')) || expect[lang].test(shown),
       shown.slice(0, 60));
  });

  // A non-marker message must pass through unchanged (no accidental swallowing).
  api.setLang('es');
  ok('non-marker messages pass through unchanged',
     api.localizeEngineError('plain engine detail') === 'plain engine detail');

  console.log('ERROR I18N TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 100);
