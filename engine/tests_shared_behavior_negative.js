/* tests_shared_behavior_negative.js — B2 negative tests.
 *
 * Each case introduces a REAL mutation and proves a guard FAILS on it, so the
 * guards are known to bite (not vacuously green).
 *
 *   N1. Removing the mobile-menu idempotency guard → double init DOES duplicate
 *       toggle listeners.
 *   N2. Removing the language-selector idempotency guard → double init DOES
 *       attach a duplicate change listener.
 *   N3-N8. Six isolation mutations, each applied to a fresh TEMP TREE, validated
 *       by the OFFICIAL checkShellIsolation() exported from tests_shell_isolation.js
 *       (the same function the positive suite runs). Each asserts fail > 0 and a
 *       failure message identifying the mutation, and removes the tree in finally.
 *
 * Requires jsdom for N1/N2. LF-only, no server, no open handles.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { composedHtml } = require('./composed-html.js');
const { checkShellIsolation } = require('./tests_shell_isolation.js');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) {
    console.error('SHARED BEHAVIOR NEGATIVE TESTS  FAILED: jsdom could not load under CI');
    process.exit(1);
  }
  console.log('SHARED BEHAVIOR NEGATIVE TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const navmenu = fs.readFileSync(path.join(siteDir, 'assets', 'nav-menu.js'), 'utf8');
const i18n = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

function watchAdds(el, type) {
  var count = 0;
  var orig = el.addEventListener.bind(el);
  el.addEventListener = function (t, f, o) { if (t === type) count++; return orig(t, f, o); };
  return function () { return count; };
}

// --- N1. Strip the nav-menu guard → double init duplicates toggle listeners ----
{
  const stripped = navmenu.replace(
    /if \(drawer\.getAttribute\('data-nav-menu-init'\) === 'true'\) return;\s*\n\s*drawer\.setAttribute\('data-nav-menu-init', 'true'\);/,
    '/* guard removed for negative test */');
  ok('N1. the nav-menu guard string was found and removed', stripped !== navmenu);
  const html = composedHtml(siteDir, 'index.html');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const { window } = dom;
  window.eval(stripped);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const toggle = window.document.querySelector('.menu-toggle');
  const getAdds = watchAdds(toggle, 'click');
  window.eval(stripped);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  ok('N1. WITHOUT the guard, double init duplicates toggle listeners', getAdds() > 0, 'added=' + getAdds());
}

// --- N2. Strip the i18n guard → double init duplicates the change listener -----
{
  const stripped = i18n.replace(
    /if \(sel\.getAttribute\('data-lang-init'\) !== 'true'\) \{\s*\n\s*sel\.setAttribute\('data-lang-init', 'true'\);/,
    'if (true) {');
  ok('N2. the i18n guard string was found and removed', stripped !== i18n);
  const html = composedHtml(siteDir, 'privacy.html');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://plumline.online/privacy.html' });
  const { window } = dom;
  Object.defineProperty(window, 'localStorage', {
    value: { getItem: function () { return null; }, setItem: function () {} }, configurable: true });
  window.eval(stripped);
  window.Plumline.i18n.init('legal');
  const sel = window.document.getElementById('lang');
  const getAdds = watchAdds(sel, 'change');
  window.Plumline.i18n.init('legal');
  ok('N2. WITHOUT the guard, double init duplicates the change listener', getAdds() > 0, 'added=' + getAdds());
}

// --- Isolation negatives via the OFFICIAL checker on a temp tree ---------------
// Copy the minimal tree the checker reads (8 pages + assets) into a temp dir,
// apply one mutation, run checkShellIsolation() on it, assert fail > 0 with a
// message naming the mutation, and remove the tree in finally.
const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-iso-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  PAGES.forEach(function (p) {
    fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html'));
  });
  fs.readdirSync(path.join(siteDir, 'assets')).forEach(function (f) {
    const src = path.join(siteDir, 'assets', f);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(dir, 'assets', f));
  });
  // Include the capabilities template so the version checker validates it too.
  fs.mkdirSync(path.join(dir, 'engine', 'templates'), { recursive: true });
  const tpl = path.join(siteDir, 'engine', 'templates', 'capabilities.template.html');
  if (fs.existsSync(tpl)) fs.copyFileSync(tpl, path.join(dir, 'engine', 'templates', 'capabilities.template.html'));
  // E1: checkShellIsolation composes solver.html, which needs the solver-UI
  // fragments and the internal canonical engine file. Copy both.
  const fragDir = path.join('engine', 'fragments', 'solver-ui');
  fs.mkdirSync(path.join(dir, fragDir), { recursive: true });
  fs.readdirSync(path.join(siteDir, fragDir)).forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, fragDir, f), path.join(dir, fragDir, f));
  });
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(siteDir, 'engine', 'source', 'plumline-engine.js'),
    path.join(dir, 'engine', 'source', 'plumline-engine.js'));
  return dir;
}

// Run one isolation negative: baseline must be clean, mutation must trip the
// checker, and a failure message must mention `mentions` (identifying the spot).
function isolationNegative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    const before = checkShellIsolation(dir);
    ok(label + ': clean temp tree passes the official checker', before.fail === 0,
       'failures=' + before.failures.join('; '));
    mutate(dir);
    const after = checkShellIsolation(dir);
    ok(label + ': mutation trips the official checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
       after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
       'failures=' + after.failures.join('; '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function readFile(f) { return fs.readFileSync(f, 'utf8'); }
function writeFile(f, s) { fs.writeFileSync(f, s); }

// N3. Inject the inline engine into about.html.
isolationNegative('N3 (engine in about.html)', function (dir) {
  const f = path.join(dir, 'about.html');
  writeFile(f, readFile(f).replace('</body>',
    '<script>/* ENGINE_START */ var x=1; /* ENGINE_END */</script></body>'));
}, 'about.html has NO inline engine');

// N4. fetch('header.html') in nav-menu.js.
isolationNegative('N4 (fragment fetch in nav-menu.js)', function (dir) {
  const f = path.join(dir, 'assets', 'nav-menu.js');
  writeFile(f, "fetch('header.html');\n" + readFile(f));
}, "nav-menu.js: does not fetch an HTML fragment");

// N5. innerHTML rebuild of the header in a shared module (i18n.js).
isolationNegative('N5 (innerHTML shell rebuild in i18n.js)', function (dir) {
  const f = path.join(dir, 'assets', 'i18n.js');
  writeFile(f, "var header = {}; header.innerHTML = '<nav>x</nav>';\n" + readFile(f));
}, "i18n.js: does not rebuild the shell via innerHTML");

// N6. new Worker(...) in build-badge.js.
isolationNegative('N6 (Worker in build-badge.js)', function (dir) {
  const f = path.join(dir, 'assets', 'build-badge.js');
  writeFile(f, "var w = new Worker('x.js');\n" + readFile(f));
}, "build-badge.js: does not create a Worker");

// N7. Reference to solveModel_ in i18n.js.
isolationNegative('N7 (solveModel_ in i18n.js)', function (dir) {
  const f = path.join(dir, 'assets', 'i18n.js');
  writeFile(f, "function leak(){ return solveModel_(null, null); }\n" + readFile(f));
}, "i18n.js: does not import solver/engine functions");

// N8. Solver-only script (examples-data.js) loaded by index.html — breaks the
//     "examples-data.js loads on exactly solver + examples" invariant.
isolationNegative('N8 (solver-only script in index.html)', function (dir) {
  const f = path.join(dir, 'index.html');
  writeFile(f, readFile(f).replace('</head>',
    '<script src="assets/examples-data.js?v=1"></script></head>'));
}, 'examples-data.js loads on exactly solver + examples');

// N9. Cache-busting version: revert one page to an OLD asset version and prove
//     the OFFICIAL checkAssetVersions() checker fails, naming the page and asset.
//     Uses the same makeTree()/finally pattern; no duplicated validation.
{
  const { checkAssetVersions } = require('./check_asset_versions.js');
  const dir = makeTree();
  try {
    const before = checkAssetVersions(dir);
    ok('N9: clean temp tree passes the official version checker', before.fail === 0,
       'failures=' + before.failures.join('; '));
    // Revert guide.html's i18n version from ?v=82 back to the old ?v=81.
    const f = path.join(dir, 'guide.html');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('assets/i18n.js?v=82', 'assets/i18n.js?v=81'));
    const after = checkAssetVersions(dir);
    ok('N9: reverting a page to an old version trips the checker (fail > 0)', after.fail > 0);
    ok('N9: a failure message identifies the page and asset',
       after.failures.some(function (m) { return m.indexOf('guide.html') !== -1 && m.indexOf('i18n.js') !== -1; }),
       'failures=' + after.failures.join('; '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('SHARED BEHAVIOR NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
