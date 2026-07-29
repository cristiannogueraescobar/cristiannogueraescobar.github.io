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

// Extract every catch block by BRACE MATCHING (not regex), so nested braces
// inside the body don't truncate it. Returns { binding, body } for each. The
// binding name is captured (err, e, error, ex, anything) so a future route with
// a different name is still scanned.
function catchBlocks(src) {
  const blocks = [];
  const head = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/g;
  let m;
  while ((m = head.exec(src))) {
    const binding = m[1];
    let i = head.lastIndex, depth = 1;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    blocks.push({ binding: binding, body: src.slice(head.lastIndex, i - 1) });
  }
  return blocks;
}
const blocks = catchBlocks(solverSrc);
ok('found the catch blocks to scan', blocks.length >= 4, blocks.length + ' blocks');

// POLICY: engine errors are shown ONLY through showEngineTrouble. So inside any
// catch that surfaces its caught error, calling showTrouble or announce with
// that error (directly OR via a variable assigned from <binding>.message) is
// forbidden — EVEN IF showEngineTrouble is also present. A decorative helper
// call must not launder a second raw display. One shared predicate is used for
// the real scan AND the negative fixtures, so they can't drift apart.
function catchLeaks(binding, body) {
  const bind = binding.replace(/[$]/g, '\\$&');
  // Names of variables assigned from <binding>.message, so a later raw display
  // of that variable is caught too.
  const msgVars = []; let vm;
  const va = new RegExp('(?:var|let|const)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*' + bind + '\\s*(?:&&[^;]*)?\\.\\s*message', 'g');
  while ((vm = va.exec(body))) msgVars.push(vm[1]);
  const calls = body.match(/(?:showTrouble|announce)\s*\([^;]*\)/g) || [];
  return calls.some(function (call) {
    const usesBindingMessage = new RegExp('\\b' + bind + '\\b[^;]*\\.\\s*message').test(call) ||
                               new RegExp('String\\(\\s*' + bind + '\\b').test(call) ||
                               (new RegExp('\\b' + bind + '\\b(?!\\s*\\.)').test(call) && /message/.test(call));
    const usesMsgVar = msgVars.some(function (v) { return new RegExp('\\b' + v.replace(/[$]/g, '\\$&') + '\\b').test(call); });
    const wrapped = /localizeEngineError\s*\(/.test(call);
    return (usesBindingMessage || usesMsgVar) && !wrapped;
  });
}
const leaky = blocks.filter(function (b) { return catchLeaks(b.binding, b.body); });
ok('no error catch shows a raw engine message (helper presence does not absolve)',
   leaky.length === 0, leaky.map(b => b.body.slice(0, 60).replace(/\s+/g, ' ')).join(' | '));

// The four known error-display routes must each call showEngineTrouble. Match
// them by surrounding context so we count DISTINCT routes (a duplicate can't
// mask a missing one).
const routes = {
  'worker onmessage': /w\.onmessage\s*=\s*function[\s\S]{0,600}?showEngineTrouble\(/,
  'compat fallback read (detectForPanel)': /function detectForPanel[\s\S]*?catch\s*\(err\)\s*\{\s*showEngineTrouble\('tRead'/,
  'runSolve read catch': /function runSolve[\s\S]*?catch\s*\(err\)\s*\{\s*return showEngineTrouble\('tRead'/,
  'runSolve solve catch': /function runSolve[\s\S]*?catch\s*\(err\)\s*\{\s*return showEngineTrouble\('tSolve'/,
};
Object.keys(routes).forEach(function (name) {
  ok('route localizes via showEngineTrouble: ' + name, routes[name].test(solverSrc));
});

// Negative fixtures — prove the SAME predicate bites the exact regressions the
// auditor named, and doesn't fire on the correct pattern.
ok('guard fixture: decorative helper + direct raw display is leaky',
   catchLeaks('err', "showEngineTrouble('tRead', err); showTrouble(t('tRead'), err.message);"));
ok('guard fixture: decorative helper + variable raw display is leaky',
   catchLeaks('err', "showEngineTrouble('tRead', err); const message = err.message; showTrouble(t('tRead'), message);"));
ok('guard fixture: sole showEngineTrouble is NOT leaky',
   !catchLeaks('err', "return showEngineTrouble('tRead', err);"));
ok('guard fixture: alternate binding name (ex) is scanned',
   catchLeaks('ex', "const message = ex.message; showTrouble(t('tRead'), message);"));

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
