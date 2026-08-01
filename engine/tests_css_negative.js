/* tests_css_negative.js — B3 negative tests.
 *
 * Each case builds a temp tree, applies ONE real mutation, and runs the SAME
 * official checker (checkCssGolden / checkCssStructure) the positive suites use —
 * never a copy of its logic — then asserts fail > 0 with a message identifying
 * the mutation. The tree is removed in finally.
 *
 * Static file mutations; no jsdom, no server. LF-only, no open handles.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkCssGolden } = require('./tests_css_golden.js');
const { checkCssStructure } = require('./tests_css_structure.js');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Copy the tree the CSS checkers read: 8 pages, assets/, and the css-golden fixture.
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-css-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'css-golden'), { recursive: true });
  PAGES.forEach(function (p) { fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html')); });
  fs.readdirSync(path.join(siteDir, 'assets')).forEach(function (f) {
    const s = path.join(siteDir, 'assets', f);
    if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dir, 'assets', f));
  });
  fs.copyFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'css-golden', 'shell-css-golden.json'),
    path.join(dir, 'engine', 'fixtures', 'css-golden', 'shell-css-golden.json'));
  return dir;
}

function readF(f) { return fs.readFileSync(f, 'utf8'); }
function writeF(f, s) { fs.writeFileSync(f, s); }

// Run a negative against the golden checker: clean tree passes, mutation trips it,
// a failure message mentions `mentions`, tree removed in finally.
function goldenNegative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree passes the official golden checker', checkCssGolden(dir).fail === 0);
    mutate(dir);
    const after = checkCssGolden(dir);
    ok(label + ': mutation trips the golden checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
      after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
      'failures=' + after.failures.join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Run a negative against the structure checker.
function structureNegative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree passes the official structure checker', checkCssStructure(dir).fail === 0);
    mutate(dir);
    const after = checkCssStructure(dir);
    ok(label + ': mutation trips the structure checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
      after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
      'failures=' + after.failures.join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function cssPath(dir) { return path.join(dir, 'assets', 'plumline.css'); }

// --- Golden negatives: value/selector/property/media/specificity/!important ----

// 7. Color changed.
goldenNegative('N-color (changed a color value)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f).replace('outline:2px solid var(--true)', 'outline:2px solid #ff0000'));
}, ':focus-visible');

// 8. Padding changed.
goldenNegative('N-padding (changed .mast padding)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f).replace('padding:22px 0 18px', 'padding:20px 0 18px'));
}, '.mast');

// 9. Breakpoint changed. The whole-sheet hash is the detector for a media-query
//    edit (the breakpoint token may still appear elsewhere), so we assert the
//    hash check names it.
goldenNegative('N-breakpoint (changed a media-query width)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f).replace('@media(max-width:820px)', '@media(max-width:830px)'));
}, 'SHA-256');

// 6. Header selector removed.
goldenNegative('N-selector-removed (.mast rule removed)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f).replace(/\.mast\{[^}]*\}/, ''));
}, '.mast');

// 12. Specificity altered: prefix .mast with a descendant combinator, changing
//     its specificity. The whole-sheet hash is the detector (the `.mast{` token
//     still appears inside `header .mast{`), so we assert the hash names it.
goldenNegative('N-specificity (.mast scope narrowed)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f).replace('.mast{display:flex', 'header .mast{display:flex'));
}, 'SHA-256');

// 13. !important added.
goldenNegative('N-important (added !important to .foot)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f).replace('.foot{background:var(--deep-2)', '.foot{background:var(--deep-2)!important'));
}, '!important count');

// 14. Focus state removed.
goldenNegative('N-focus-removed (:focus-visible rule removed)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f).replace(/:focus-visible\{[^}]*\}/, ''));
}, ':focus-visible');

// 5b. Solver variant <style> mutated.
goldenNegative('N-variant (solver variant style changed)', function (dir) {
  const f = path.join(dir, 'solver.html');
  writeF(f, readF(f).replace('font-size:16px', 'font-size:15px'));
}, 'solver variant');

// --- Structure negatives: isolation / leakage / injection ----------------------

// 15/16. Grid selector added to the shared sheet.
structureNegative('N-grid-in-shell (added #grid to shared sheet)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f) + '\n#grid{display:block}\n');
}, '#grid');

structureNegative('N-receipt-in-shell (added .receipt to shared sheet)', function (dir) {
  const f = cssPath(dir);
  writeF(f, readF(f) + '\n.receipt{color:red}\n');
}, '.receipt');

// 17. Informational page loads solver-only CSS (gains an inline <style>).
structureNegative('N-informational-style (about.html gains an inline <style>)', function (dir) {
  const f = path.join(dir, 'about.html');
  writeF(f, readF(f).replace('</head>', '<style>.grid{display:none}</style></head>'));
}, 'about.html has no inline <style>');

// 18. New external stylesheet added.
structureNegative('N-new-sheet (index.html adds a second external CSS)', function (dir) {
  const f = path.join(dir, 'index.html');
  writeF(f, readF(f).replace('</head>', '<link rel="stylesheet" href="assets/extra.css"></head>'));
}, 'index.html loads exactly one external stylesheet');

// 20. CSS fetched at runtime (in a shared module).
structureNegative('N-css-fetch (nav-menu.js fetches a .css)', function (dir) {
  const f = path.join(dir, 'assets', 'nav-menu.js');
  writeF(f, "fetch('extra.css');\n" + readF(f));
}, 'nav-menu.js: does not fetch a .css file');

// 21. CSS injected via innerHTML (in a shared module).
structureNegative('N-css-innerHTML (i18n.js injects a <style> via innerHTML)', function (dir) {
  const f = path.join(dir, 'assets', 'i18n.js');
  writeF(f, "var x={}; x.innerHTML = '<style>.a{}</style>';\n" + readF(f));
}, 'i18n.js: does not inject a <style> or <link> via innerHTML');

// 19. A CSS partial directory appears (would imply a published/composed partial).
structureNegative('N-partial-dir (a src/shared/styles partial dir appears)', function (dir) {
  fs.mkdirSync(path.join(dir, 'src', 'shared', 'styles'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'shared', 'styles', 'shell.css'), '.mast{}');
}, 'no CSS partial directory');

console.log('CSS NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
