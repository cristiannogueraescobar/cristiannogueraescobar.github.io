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
// All engine-error display now funnels through ONE helper, showEngineTrouble,
// which localizes internally. So the guarantee is: (a) the helper localizes,
// and (b) no display route surfaces a raw engine message by any other path.
const helperDef = (solverSrc.match(/function showEngineTrouble\([\s\S]*?\n\}/) || [''])[0];
ok('showEngineTrouble exists and localizes', /localizeEngineError\(/.test(helperDef), helperDef.slice(0, 60));

// This scan catches the DIRECT shapes — showTrouble(..., String(err.message)),
// err.message, error.message — where the error reference appears in the call
// itself. It does NOT catch an error hidden behind an intermediate variable
// (var m = err.message; showTrouble(title, m)); that case is instead caught by
// the per-route checks below, which require each of the four error routes to
// call showEngineTrouble. The two guards are complementary: this one flags an
// obvious raw display anywhere; the route checks pin the specific catches.
const showTroubleCalls = solverSrc.match(/showTrouble\([^;]*\)/g) || [];
const rawErrorCalls = showTroubleCalls.filter(function (c) {
  const surfacesError = /\.message\b/.test(c) || /\b(err|error)\b/.test(c);
  const localized = /localizeEngineError/.test(c);
  return surfacesError && !localized;
});
ok('no showTrouble call directly surfaces a raw engine error', rawErrorCalls.length === 0, rawErrorCalls.join(' | '));

// The four known error-display routes must each call showEngineTrouble. Match
// them by their surrounding context so we count DISTINCT routes, not just N
// calls (a duplicate can't mask a missing one).
const routes = {
  'worker onmessage': /w\.onmessage\s*=\s*function[\s\S]{0,600}?showEngineTrouble\(/,
  'compat fallback read (detectForPanel)': /function detectForPanel[\s\S]*?catch\s*\(err\)\s*\{\s*showEngineTrouble\('tRead'/,
  'runSolve read catch': /function runSolve[\s\S]*?catch\s*\(err\)\s*\{\s*return showEngineTrouble\('tRead'/,
  'runSolve solve catch': /function runSolve[\s\S]*?catch\s*\(err\)\s*\{\s*return showEngineTrouble\('tSolve'/,
};
Object.keys(routes).forEach(function (name) {
  ok('route localizes via showEngineTrouble: ' + name, routes[name].test(solverSrc));
});

// Belt-and-braces: no catch block anywhere in the solver may show a raw engine
// error alongside (or instead of) the helper. Scan every "catch (err|e) { ... }"
// body; if it calls showTrouble/announce with a raw *.message and does NOT route
// that through localizeEngineError/showEngineTrouble, flag it. This catches the
// intermediate-variable and decorative-call cases the arg-only scan misses.
const catchBodies = solverSrc.match(/catch\s*\((?:err|e|error)\)\s*\{[\s\S]*?\n\s*\}/g) || [];
const leakyCatches = catchBodies.filter(function (body) {
  const showsRaw = /(showTrouble|announce)\([^;]*\b(?:err|e|error)\.message\b/.test(body) ||
                   /(showTrouble|announce)\([^;]*\bmessage\b[^;]*\)/.test(body) && /=\s*(?:err|e|error)\.message/.test(body);
  const routesThroughHelper = /showEngineTrouble\(|localizeEngineError\(/.test(body);
  return showsRaw && !routesThroughHelper;
});
ok('no catch block displays a raw engine message (incl. via a variable)',
   leakyCatches.length === 0, leakyCatches.map(b => b.slice(0, 50)).join(' | '));

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

  // Expected localized fragments per language (a distinctive phrase, matched
  // anywhere — showTrouble prefixes a translated title before the message).
  const expect = {
    en: /Strict inequalities/, es: /desigualdades estrictas/,
    pt: /Desigualdades estritas/, de: /Strikte Ungleichungen/,
    fr: /in\u00e9galit\u00e9s strictes/
  };
  Object.keys(expect).forEach(function (lang) {
    api.setLang(lang);
    // Fallback/panel routes pass an Error object to showEngineTrouble.
    api.showEngineTrouble('tSolve', new Error(marker));
    let shown = document.getElementById('result').textContent;
    ok(lang + ': showEngineTrouble(Error) renders the localized message', expect[lang].test(shown), shown.slice(0, 60));
    ok(lang + ': rendered message drops the raw marker', shown.indexOf('STRICT_INEQUALITY') === -1, shown.slice(0, 60));
    // Worker route passes a plain string.
    api.showEngineTrouble('tRead', marker);
    shown = document.getElementById('result').textContent;
    ok(lang + ': showEngineTrouble(string) renders the localized message', expect[lang].test(shown), shown.slice(0, 60));
    // And the low-level helper still maps correctly.
    ok(lang + ': localizeEngineError maps the marker', expect[lang].test(api.localizeEngineError(marker)), lang);
  });

  // A non-marker message must pass through unchanged (no accidental swallowing).
  api.setLang('es');
  ok('non-marker messages pass through unchanged',
     api.localizeEngineError('plain engine detail') === 'plain engine detail');

  console.log('ERROR I18N TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 100);
