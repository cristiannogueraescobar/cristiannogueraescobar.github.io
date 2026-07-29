/**
 * tests_error_i18n.js — engine errors carrying the STRICT_INEQUALITY marker
 * must be shown to the user in the active language on EVERY display route, not
 * only the Web Worker path.
 *
 * Two layers:
 *   1. Static (AST via acorn): each of the four display routes must localize,
 *      and NO catch clause may surface its caught error through showTrouble/
 *      announce without localizeEngineError — even alongside a helper call.
 *      Using a real parser (not brace-counting) makes this robust to braces in
 *      strings/comments/regex and to alias variables.
 *   2. Functional (jsdom): localizeEngineError maps the marker to the localized
 *      string in all five languages, and showEngineTrouble renders it.
 *
 * Requires acorn + jsdom (CI installs both via npm ci). Skips locally without.
 * Run: node engine/tests_error_i18n.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const solverSrc = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// ---- Layer 1: static route coverage -------------------------------------
// All engine-error display funnels through ONE helper, showEngineTrouble, which
// localizes internally. Guarantee: (a) the helper localizes, (b) no catch shows
// a raw engine message by any other path.
const helperDef = (solverSrc.match(/function showEngineTrouble\([\s\S]*?\n\}/) || [''])[0];
ok('showEngineTrouble exists and localizes', /localizeEngineError\(/.test(helperDef), helperDef.slice(0, 60));

let acorn;
try { acorn = require('acorn'); }
catch (e) {
  if (process.env.CI) { console.error('ERROR I18N TESTS  FAILED: acorn missing under CI'); process.exit(1); }
  console.log('  (skipping AST layer — acorn not installed)');
}
if (acorn) {

// Pull the inline engine+app script. The solver has one big inline <script>;
// parse each inline script and collect CatchClause nodes across all of them.
function inlineScripts(html) {
  const scripts = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) scripts.push(m[1]);
  return scripts;
}

// Walk an AST calling visit(node) on every node.
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key in node) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach(c => c && typeof c.type === 'string' && walk(c, visit));
    else if (child && typeof child.type === 'string') walk(child, visit);
  }
}

// Does an expression reference the caught-error binding, directly or through an
// alias variable? aliasErr = names that ARE the error; aliasMsg = names that
// hold <err>.message. Returns true if the expression surfaces the raw error and
// is NOT wrapped in localizeEngineError.
function surfacesRawError(node, aliasErr, aliasMsg) {
  let raw = false, sawLocalizer = false;
  walk(node, function (n) {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' &&
        n.callee.name === 'localizeEngineError') sawLocalizer = true;
    // <errName>.message  or  <errName>?.message
    if (n.type === 'MemberExpression' && n.property && n.property.name === 'message' &&
        n.object.type === 'Identifier' && aliasErr.has(n.object.name)) raw = true;
    // a bare reference to the error binding (e.g. String(err), err passed along)
    if (n.type === 'Identifier' && aliasErr.has(n.name)) raw = true;
    // a reference to a variable that holds <err>.message
    if (n.type === 'Identifier' && aliasMsg.has(n.name)) raw = true;
  });
  return raw && !sawLocalizer;
}

// From an initializer expression, decide whether it aliases the error itself
// (returns 'err'), the error's .message (returns 'msg'), or neither (null).
function classifyInit(init, aliasErr) {
  if (!init) return null;
  if (init.type === 'Identifier' && aliasErr.has(init.name)) return 'err';
  // <err>.message, <err>?.message, String(<err>.message), (<err> && <err>.message)
  let holdsMsg = false, holdsErr = false;
  walk(init, function (n) {
    if (n.type === 'MemberExpression' && n.property && n.property.name === 'message' &&
        n.object.type === 'Identifier' && aliasErr.has(n.object.name)) holdsMsg = true;
    if (n.type === 'Identifier' && aliasErr.has(n.name)) holdsErr = true;
  });
  if (holdsMsg) return 'msg';
  if (holdsErr) return 'err';
  return null;
}

// Analyse one catch clause: returns true if it displays the raw error via
// showTrouble/announce (directly or through any alias) without localizing.
function catchClauseLeaks(cc) {
  const aliasErr = new Set();
  const aliasMsg = new Set();
  if (cc.param && cc.param.type === 'Identifier') aliasErr.add(cc.param.name);
  // Destructuring: catch ({ message }) — treat `message` as a message alias.
  if (cc.param && cc.param.type === 'ObjectPattern') {
    cc.param.properties.forEach(function (p) {
      if (p.value && p.value.type === 'Identifier' && p.key && p.key.name === 'message') aliasMsg.add(p.value.name);
    });
  }
  // First pass: collect alias variables (const/let/var and plain assignments),
  // including `const { message } = err`.
  walk(cc.body, function (n) {
    if (n.type === 'VariableDeclarator') {
      if (n.id.type === 'Identifier') {
        const kind = classifyInit(n.init, aliasErr);
        if (kind === 'err') aliasErr.add(n.id.name);
        else if (kind === 'msg') aliasMsg.add(n.id.name);
      } else if (n.id.type === 'ObjectPattern' && n.init && n.init.type === 'Identifier' && aliasErr.has(n.init.name)) {
        n.id.properties.forEach(function (p) {
          if (p.value && p.value.type === 'Identifier' && p.key && p.key.name === 'message') aliasMsg.add(p.value.name);
        });
      }
    }
    if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') {
      const kind = classifyInit(n.right, aliasErr);
      if (kind === 'err') aliasErr.add(n.left.name);
      else if (kind === 'msg') aliasMsg.add(n.left.name);
    }
  });
  // Second pass: any showTrouble/announce call surfacing the raw error?
  let leaks = false;
  walk(cc.body, function (n) {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' &&
        (n.callee.name === 'showTrouble' || n.callee.name === 'announce')) {
      if (n.arguments.some(function (a) { return surfacesRawError(a, aliasErr, aliasMsg); })) leaks = true;
    }
  });
  return leaks;
}

// Collect every CatchClause across the inline scripts.
const catchClauses = [];
inlineScripts(solverSrc).forEach(function (src) {
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022 }); }
  catch (e) { return; }   // a non-JS or worker-string fragment; skip
  walk(ast, function (n) { if (n.type === 'CatchClause') catchClauses.push(n); });
});
ok('parsed catch clauses from the solver (AST)', catchClauses.length >= 4, catchClauses.length + ' clauses');

const leakyClauses = catchClauses.filter(catchClauseLeaks);
ok('no error catch shows a raw engine message (AST; helper presence does not absolve)',
   leakyClauses.length === 0,
   leakyClauses.map(c => solverSrc.slice(c.start, Math.min(c.end, c.start + 70)).replace(/\s+/g, ' ')).join(' | '));

// The four known error-display routes must each call showEngineTrouble.
const routes = {
  'worker onmessage': /w\.onmessage\s*=\s*function[\s\S]{0,600}?showEngineTrouble\(/,
  'compat fallback read (detectForPanel)': /function detectForPanel[\s\S]*?catch\s*\(err\)\s*\{\s*showEngineTrouble\('tRead'/,
  'runSolve read catch': /function runSolve[\s\S]*?catch\s*\(err\)\s*\{\s*return showEngineTrouble\('tRead'/,
  'runSolve solve catch': /function runSolve[\s\S]*?catch\s*\(err\)\s*\{\s*return showEngineTrouble\('tSolve'/,
};
Object.keys(routes).forEach(function (name) {
  ok('route localizes via showEngineTrouble: ' + name, routes[name].test(solverSrc));
});

// Negative fixtures — parse each snippet, take its (single) catch clause, run
// the SAME analyser. Covers every alias shape the auditor named.
function fixtureLeaks(snippet) {
  const ast = acorn.parse('function _f(){try{}' + snippet + '}', { ecmaVersion: 2022 });
  let cc = null;
  walk(ast, function (n) { if (n.type === 'CatchClause' && !cc) cc = n; });
  return cc ? catchClauseLeaks(cc) : null;
}
const LEAK_FIXTURES = {
  'decorative helper + direct raw': "catch(err){ showEngineTrouble('tRead', err); showTrouble(t('tRead'), err.message); }",
  'decorative helper + variable': "catch(err){ showEngineTrouble('tRead', err); const m = err.message; showTrouble(t('tRead'), m); }",
  'String(err.message) via variable': "catch(err){ const m = String(err.message); showTrouble(t('tRead'), m); }",
  'destructured { message }': "catch(err){ const { message } = err; showTrouble(t('tRead'), message); }",
  'catch-param destructuring': "catch({ message }){ showTrouble(t('tRead'), message); }",
  'let then assign': "catch(err){ let m; m = err.message; showTrouble(t('tRead'), m); }",
  'aliased error object': "catch(err){ const copy = err; showTrouble(t('tRead'), copy.message); }",
  'optional chaining': "catch(err){ const m = err?.message; showTrouble(t('tRead'), m); }",
  'string with semicolon + raw': "catch(err){ showTrouble(t('tRead'), 'Error; ' + err.message); }",
  'alternate binding ex': "catch(ex){ const m = ex.message; showTrouble(t('tRead'), m); }",
  'announce raw': "catch(err){ announce(err.message); }"
};
Object.keys(LEAK_FIXTURES).forEach(function (name) {
  ok('guard fixture LEAKS: ' + name, fixtureLeaks(LEAK_FIXTURES[name]) === true);
});
const SAFE_FIXTURES = {
  'sole showEngineTrouble': "catch(err){ return showEngineTrouble('tRead', err); }",
  'explicit localizeEngineError': "catch(err){ showTrouble(t('tRead'), localizeEngineError(err.message)); }",
  'non-error message shown': "catch(err){ showTrouble(t('tCsvEmpty'), t('tCsvEmptyBody')); }",
  'string with brace, no leak': "catch(err){ const irrelevant = '}'; return showEngineTrouble('tRead', err); }"
};
Object.keys(SAFE_FIXTURES).forEach(function (name) {
  ok('guard fixture SAFE: ' + name, fixtureLeaks(SAFE_FIXTURES[name]) === false);
});
}  // end if (acorn)

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
