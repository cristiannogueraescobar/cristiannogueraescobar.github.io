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

// True if this expression surfaces the raw error, tracked PER REFERENCE: a
// reference is "raw" only when it is NOT lexically inside a localizeEngineError
// call. A localizer elsewhere in the same argument does not absolve a sibling
// raw reference. `insideLocalizer` is threaded down the recursion.
function containsUnlocalizedRaw(node, aliasErr, aliasMsg, insideLocalizer) {
  if (!node || typeof node.type !== 'string') return false;
  const isLocalizer = node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' && node.callee.name === 'localizeEngineError';
  const localizedHere = insideLocalizer || isLocalizer;
  const rawMember = node.type === 'MemberExpression' && node.property &&
    node.property.name === 'message' && node.object.type === 'Identifier' &&
    aliasErr.has(node.object.name);
  const rawIdent = node.type === 'Identifier' && (aliasErr.has(node.name) || aliasMsg.has(node.name));
  if ((rawMember || rawIdent) && !localizedHere) return true;
  for (const key in node) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      if (child.some(c => c && typeof c.type === 'string' &&
          containsUnlocalizedRaw(c, aliasErr, aliasMsg, localizedHere))) return true;
    } else if (child && typeof child.type === 'string' &&
               containsUnlocalizedRaw(child, aliasErr, aliasMsg, localizedHere)) return true;
  }
  return false;
}

// From an initializer, does it hold the error itself ('err'), its .message
// ('msg'), or neither (null)? aliasErr/aliasMsg are the CURRENT known aliases.
function classifyInit(init, aliasErr, aliasMsg) {
  if (!init) return null;
  if (init.type === 'Identifier' && aliasErr.has(init.name)) return 'err';
  if (init.type === 'Identifier' && aliasMsg.has(init.name)) return 'msg';
  let holdsMsg = false, holdsErr = false;
  walk(init, function (n) {
    if (n.type === 'MemberExpression' && n.property && n.property.name === 'message' &&
        n.object.type === 'Identifier' && aliasErr.has(n.object.name)) holdsMsg = true;
    if (n.type === 'Identifier' && aliasErr.has(n.name)) holdsErr = true;
    if (n.type === 'Identifier' && aliasMsg.has(n.name)) holdsMsg = true;
  });
  if (holdsMsg) return 'msg';
  if (holdsErr) return 'err';
  return null;
}

// Names that a NESTED function re-binds (its own params / declarations) shadow
// the outer error binding, so references inside that function are not the error.
// We stop descending into any function that redeclares one of our alias names.
function rebinds(fnNode, names) {
  let hit = false;
  (fnNode.params || []).forEach(function (p) {
    walk(p, function (n) { if (n.type === 'Identifier' && names.has(n.name)) hit = true; });
  });
  return hit;
}

// Walk a region (any statement/function body), but do NOT descend into nested
// functions that shadow our alias names — their `err` is a different binding.
function walkRegion(node, aliasNames, visit) {
  (function rec(n) {
    if (!n || typeof n.type !== 'string') return;
    if ((n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' ||
         n.type === 'ArrowFunctionExpression') && rebinds(n, aliasNames)) return;
    visit(n);
    for (const key in n) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach(c => c && typeof c.type === 'string' && rec(c));
      else if (child && typeof child.type === 'string') rec(child);
    }
  })(node);
}

// Analyse a REGION that has one tainted source: either a catch clause (source =
// the caught binding) or the worker onmessage (source = e.data.error). Collect
// alias vars to a FIXED POINT (so out-of-order assignments are caught), then
// check every showTrouble/announce call for an unlocalized raw reference.
// `seedErr`/`seedMsg` seed the alias sets; `taintedMember` optionally marks a
// member expression (e.data.error) as a message source.
function regionLeaks(body, seedErr, seedMsg, taintedMemberTest) {
  const aliasErr = new Set(seedErr || []);
  const aliasMsg = new Set(seedMsg || []);
  const names = new Set([].concat(seedErr || [], seedMsg || []));
  // Fixed-point alias collection: repeat until no set grows.
  let changed = true;
  while (changed) {
    changed = false;
    walkRegion(body, names, function (n) {
      function learn(target, kind) {
        if (!kind) return;
        const set = kind === 'err' ? aliasErr : aliasMsg;
        if (!set.has(target)) { set.add(target); names.add(target); changed = true; }
      }
      if (n.type === 'VariableDeclarator') {
        if (n.id.type === 'Identifier') {
          // A tainted member (e.data.error) assigned into a var makes it a msg alias.
          if (taintedMemberTest && n.init && taintedMemberTest(n.init)) learn(n.id.name, 'msg');
          else learn(n.id.name, classifyInit(n.init, aliasErr, aliasMsg));
        } else if (n.id.type === 'ObjectPattern' && n.init && n.init.type === 'Identifier' && aliasErr.has(n.init.name)) {
          n.id.properties.forEach(function (p) {
            if (p.value && p.value.type === 'Identifier' && p.key && p.key.name === 'message') learn(p.value.name, 'msg');
          });
        }
      }
      if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') {
        if (taintedMemberTest && taintedMemberTest(n.right)) learn(n.left.name, 'msg');
        else learn(n.left.name, classifyInit(n.right, aliasErr, aliasMsg));
      }
    });
  }
  // Check display calls.
  let leaks = false;
  walkRegion(body, names, function (n) {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' &&
        (n.callee.name === 'showTrouble' || n.callee.name === 'announce')) {
      const argRaw = n.arguments.some(function (a) { return containsUnlocalizedRaw(a, aliasErr, aliasMsg, false); });
      // Also flag a tainted member passed straight to a display call.
      const argTainted = taintedMemberTest && n.arguments.some(function (a) {
        let hit = false;
        walk(a, function (m) { if (taintedMemberTest(m)) hit = true; });
        // …unless that tainted member is inside a localizeEngineError call.
        return hit && !n.arguments.some(function (a2) {
          return a2.type === 'CallExpression' && a2.callee.type === 'Identifier' &&
                 a2.callee.name === 'localizeEngineError';
        }) && hit;
      });
      if (argRaw || argTainted) leaks = true;
    }
  });
  return leaks;
}

// A catch clause is a region whose tainted source is its bound parameter.
function catchClauseLeaks(cc) {
  const seedErr = [], seedMsg = [];
  if (cc.param && cc.param.type === 'Identifier') seedErr.push(cc.param.name);
  if (cc.param && cc.param.type === 'ObjectPattern') {
    cc.param.properties.forEach(function (p) {
      if (p.value && p.value.type === 'Identifier' && p.key && p.key.name === 'message') seedMsg.push(p.value.name);
    });
  }
  return regionLeaks(cc.body, seedErr, seedMsg, null);
}

// Is this node the member expression e.data.error (the worker's tainted source)?
function isWorkerErrorMember(n) {
  return n && n.type === 'MemberExpression' && n.property && n.property.name === 'error' &&
    n.object && n.object.type === 'MemberExpression' && n.object.property &&
    n.object.property.name === 'data';
}

// Collect every CatchClause AND the worker onmessage handler across the inline
// scripts. Both are analysed by the SAME regionLeaks() — the worker path is no
// longer a mere presence-regex.
const catchClauses = [];
const workerHandlers = [];   // FunctionExpression bodies assigned to w.onmessage
inlineScripts(solverSrc).forEach(function (src) {
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022 }); }
  catch (e) { return; }   // a non-JS or worker-string fragment; skip
  walk(ast, function (n) {
    if (n.type === 'CatchClause') catchClauses.push(n);
    // w.onmessage = function (e) { ... }
    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' &&
        n.left.property && n.left.property.name === 'onmessage' &&
        (n.right.type === 'FunctionExpression' || n.right.type === 'ArrowFunctionExpression')) {
      workerHandlers.push(n.right);
    }
  });
});
ok('parsed catch clauses from the solver (AST)', catchClauses.length >= 4, catchClauses.length + ' clauses');
ok('found the worker onmessage handler (AST)', workerHandlers.length >= 1, workerHandlers.length + ' handlers');

const leakyClauses = catchClauses.filter(catchClauseLeaks);
ok('no error catch shows a raw engine message (AST; helper presence does not absolve)',
   leakyClauses.length === 0,
   leakyClauses.map(c => solverSrc.slice(c.start, Math.min(c.end, c.start + 70)).replace(/\s+/g, ' ')).join(' | '));

// Worker handler: e.data.error is the tainted source. It must not reach
// showTrouble/announce raw; only through localizeEngineError / showEngineTrouble.
const leakyWorkers = workerHandlers.filter(function (fn) {
  return regionLeaks(fn.body, [], [], isWorkerErrorMember);
});
ok('worker onmessage does not display e.data.error raw (AST)', leakyWorkers.length === 0,
   leakyWorkers.map(f => solverSrc.slice(f.start, f.start + 70).replace(/\s+/g, ' ')).join(' | '));
// And it must actually localize somewhere (route is covered, not just absent).
const workerLocalizes = workerHandlers.some(function (fn) {
  let ok2 = false;
  walk(fn, function (n) {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' &&
        (n.callee.name === 'showEngineTrouble' || n.callee.name === 'localizeEngineError')) ok2 = true;
  });
  return ok2;
});
ok('worker onmessage routes errors through the localizing helper', workerLocalizes);

// The three catch-based routes must each call showEngineTrouble.
const routes = {
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
  'announce raw': "catch(err){ announce(err.message); }",
  // Issue 1: a localizer NEXT TO a raw reference in the SAME argument must not
  // absolve the raw one.
  'localizer + raw in same arg': "catch(err){ showTrouble(t('tRead'), localizeEngineError(err.message) + err.message); }",
  'localizer(fixed) + raw in same arg': "catch(err){ showTrouble(t('tRead'), localizeEngineError('fixed') + err.message); }",
  // Issue 3: aliases assigned out of order must still be caught (fixed point).
  'reverse-order alias (2 links)': "catch(err){ let first; let second; second = first; first = err.message; showTrouble(t('tRead'), second); }",
  'reverse-order alias (3 links)': "catch(err){ let a; let b; let c; c = b; b = a; a = err.message; showTrouble(t('tRead'), c); }"
};
Object.keys(LEAK_FIXTURES).forEach(function (name) {
  ok('guard fixture LEAKS: ' + name, fixtureLeaks(LEAK_FIXTURES[name]) === true);
});
const SAFE_FIXTURES = {
  'sole showEngineTrouble': "catch(err){ return showEngineTrouble('tRead', err); }",
  'explicit localizeEngineError': "catch(err){ showTrouble(t('tRead'), localizeEngineError(err.message)); }",
  'non-error message shown': "catch(err){ showTrouble(t('tCsvEmpty'), t('tCsvEmptyBody')); }",
  'string with brace, no leak': "catch(err){ const irrelevant = '}'; return showEngineTrouble('tRead', err); }",
  // Issue 1 safe counterpart: two localizer calls, no raw sibling.
  'two localizers, no raw': "catch(err){ showTrouble(t('tRead'), localizeEngineError(err.message) + localizeEngineError(err.message)); }",
  // Issue 4: a nested function that re-binds `err` is a different scope; a raw
  // display inside it must NOT be attributed to the outer catch binding.
  'nested fn shadows err': "catch(err){ function unrelated(err){ showTrouble('x', err.message); } return showEngineTrouble('tRead', err); }"
};
Object.keys(SAFE_FIXTURES).forEach(function (name) {
  ok('guard fixture SAFE: ' + name, fixtureLeaks(SAFE_FIXTURES[name]) === false);
});

// Worker-handler fixtures — analysed by regionLeaks with e.data.error taint.
function workerFixtureLeaks(snippet) {
  const ast = acorn.parse('var w={}; ' + snippet, { ecmaVersion: 2022 });
  let fn = null;
  walk(ast, function (n) {
    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' &&
        n.left.property && n.left.property.name === 'onmessage' && !fn) fn = n.right;
  });
  return fn ? regionLeaks(fn.body, [], [], isWorkerErrorMember) : null;
}
ok('guard fixture LEAKS: worker decorative helper + raw e.data.error',
   workerFixtureLeaks("w.onmessage = function(e){ showEngineTrouble('tSolve', e.data.error); showTrouble(t('tSolve'), e.data.error); };") === true);
ok('guard fixture LEAKS: worker raw e.data.error via variable',
   workerFixtureLeaks("w.onmessage = function(e){ var m = e.data.error; showTrouble(t('tSolve'), m); };") === true);
ok('guard fixture SAFE: worker localized e.data.error',
   workerFixtureLeaks("w.onmessage = function(e){ showEngineTrouble('tSolve', e.data.error||''); };") === false);
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

  // The AMBIGUOUS_DECISION_CELLS marker (single-variable detection) must also
  // localize in every language and drop the raw marker from the shown text.
  const ambExpect = {
    en: /Several separate cells/, es: /Varias celdas separadas/,
    pt: /V\u00e1rias c\u00e9lulas separadas/, de: /Mehrere separate Zellen/,
    fr: /Plusieurs cellules distinctes/
  };
  Object.keys(ambExpect).forEach(function (lang) {
    api.setLang(lang);
    const out = api.localizeEngineError('AMBIGUOUS_DECISION_CELLS');
    ok('localizes AMBIGUOUS_DECISION_CELLS in ' + lang, ambExpect[lang].test(out), out.slice(0, 40));
    ok(lang + ': ambiguity message drops the raw marker', out.indexOf('AMBIGUOUS_DECISION_CELLS') === -1, out.slice(0, 40));
  });

  console.log('ERROR I18N TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 100);
