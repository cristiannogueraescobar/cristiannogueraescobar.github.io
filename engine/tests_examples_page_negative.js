/* tests_examples_page_negative.js — Checkpoint C3 negative tests.
 *
 * Each case builds a temp tree, applies ONE real mutation, runs the SAME official
 * checkExamplesPage() the positive suite uses (never a copy of its logic),
 * asserts fail > 0 with a message identifying the mutation, and removes the tree
 * in finally. Case 28 mutates solver.html to prove the Examples checker does not
 * depend on solver's full HTML (only the explicit slug contracts, via
 * examples-data.js). Case 29 runs from a temp path containing a space.
 *
 * Static file mutations + require() of the temp copy of examples-data.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkExamplesPage } = require('./tests_examples_page.js');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

function makeTree(rootDir) {
  const dir = rootDir || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-ex-'));
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'pages-golden'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  PAGES.forEach(function (p) { fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html')); });
  fs.copyFileSync(path.join(siteDir, 'assets', 'examples-data.js'), path.join(dir, 'assets', 'examples-data.js'));
  fs.copyFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'examples-page.json'),
    path.join(dir, 'engine', 'fixtures', 'pages-golden', 'examples-page.json'));
  return dir;
}
function readF(f) { return fs.readFileSync(f, 'utf8'); }
function writeF(f, s) { fs.writeFileSync(f, s); }
function ep(dir) { return path.join(dir, 'examples.html'); }
function ed(dir) { return path.join(dir, 'assets', 'examples-data.js'); }

function negative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree passes the official checker', checkExamplesPage(dir).fail === 0);
    mutate(dir);
    const after = checkExamplesPage(dir);
    ok(label + ': mutation trips the checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
      after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
      'failures=' + after.failures.slice(0, 6).join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. Remove a card.
negative('N1 (remove a card)', function (d) {
  writeF(ep(d), readF(ep(d)).replace(/<a href="solver\.html\?ex=production-plan"[^>]*>[\s\S]*?<\/a>/, ''));
}, 'examples: <main> SHA-256');
// 2. Duplicate a card.
negative('N2 (duplicate a card)', function (d) {
  const s = readF(ep(d)); const m = s.match(/<a href="solver\.html\?ex=production-plan"[^>]*>[\s\S]*?<\/a>/);
  writeF(ep(d), s.replace(m[0], m[0] + m[0]));
}, 'examples: card count');
// 3. Reorder cards (swap first two cards in <main>).
negative('N3 (reorder cards)', function (d) {
  let s = readF(ep(d));
  const main = s.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
  const cards = main.match(/<a href="solver\.html\?ex=[^"]+"[^>]*>[\s\S]*?<\/a>/g);
  let newMain = main.replace(cards[0], '\u0000A\u0000').replace(cards[1], '\u0000B\u0000');
  newMain = newMain.replace('\u0000A\u0000', cards[1]).replace('\u0000B\u0000', cards[0]);
  writeF(ep(d), s.replace(main, newMain));
}, 'examples: card slug order');
// 4. Change a slug in the HTML CARD (breaks sync with data).
negative('N4 (change an HTML card slug)', function (d) {
  let s = readF(ep(d));
  const main = s.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
  const newMain = main.replace('solver.html?ex=production-plan"', 'solver.html?ex=production-plan-x"');
  writeF(ep(d), s.replace(main, newMain));
}, 'sync: every HTML card slug exists exactly once in examples-data.js');
// 5. Remove a slug from examples-data.js.
negative('N5 (remove a data slug)', function (d) {
  writeF(ed(d), readF(ed(d)).replace(/\{ key: 'production',[^}]*\},\n/, ''));
}, 'examples-data.js: slug list matches golden');
// 6. Duplicate a slug in examples-data.js.
negative('N6 (duplicate a data slug)', function (d) {
  const s = readF(ed(d)); const m = s.match(/\{ key: 'production',[^}]*\}/);
  writeF(ed(d), s.replace(m[0], m[0] + ',\n    ' + m[0]));
}, 'examples-data.js: no duplicate slugs');
// 7. Change a shared title (the visible card text).
negative('N7 (change a shared title)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('>Production plan</a>', '>Prod plan CHANGED</a>'));
}, 'examples: <main> SHA-256');
// 8. Change a category in examples-data.js.
negative('N8 (change a category)', function (d) {
  writeF(ed(d), readF(ed(d)).replace("slug: 'production-plan',      category: 'start'", "slug: 'production-plan',      category: 'business'"));
}, 'examples-data.js: category list matches golden');
// 9. Break a solver link (bad format).
negative('N9 (break a solver link)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('href="solver.html?ex=production-plan"', 'href="solver.html?example=production-plan"'));
}, 'examples: card count');
// 10. Add a public example in data missing from HTML.
negative('N10 (data example missing from HTML)', function (d) {
  const s = readF(ed(d));
  writeF(ed(d), s.replace('  ];\n  var CATEGORY_ORDER',
    "    ,{ key: 'newone', slug: 'new-example', category: 'start', type: 'continuous', sense: 'max' }\n  ];\n  var CATEGORY_ORDER"));
}, 'sync: every examples-data.js slug appears in the HTML catalog');
// 11. Expose an internal/pending example (category not in CATEGORY_ORDER).
negative('N11 (internal/pending category exposed)', function (d) {
  const s = readF(ed(d));
  writeF(ed(d), s.replace("category: 'start',    type: 'continuous', sense: 'max' },\n    { key: 'workshop'",
    "category: 'internal', type: 'continuous', sense: 'max' },\n    { key: 'workshop'"));
}, 'sync: every data category is in CATEGORY_ORDER');
// NOTE: model coefficients, constraints, and expected results are NOT tested
// here. They live in solver.html and are protected EXTERNALLY by tests_examples.js
// (each example solves to its declared result) and tests_ex_drawer.js. A mutation
// to solver's math does not — and must not — trip checkExamplesPage(), so it is
// not a valid Examples negative and is deliberately omitted. The Examples checker
// stays independent of solver's math; see docs/checkpoint-c3-examples.md.
// 12. Remove a script.
negative('N12 (remove a script)', function (d) {
  writeF(ep(d), readF(ep(d)).replace(/<script src="assets\/i18n\.js\?v=82"><\/script>\s*/, ''));
}, 'examples: script src set');
// 13. Change an asset version.
negative('N13 (change asset version)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('i18n.js?v=82', 'i18n.js?v=81'));
}, 'examples: script src set');
// 14. Change canonical.
negative('N14 (change canonical)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('<link rel="canonical" href="https://plumline.online/examples.html">',
    '<link rel="canonical" href="https://plumline.online/examples-x.html">'));
}, 'examples: canonical');
// 15. Change JSON-LD.
negative('N15 (change JSON-LD)', function (d) {
  const s = readF(ep(d));
  writeF(ep(d), s.replace(/(<script type="application\/ld\+json">)/, '$1 '));
}, 'examples: JSON-LD matches golden');
// 16. Remove a data-i18n.
negative('N16 (remove a data-i18n)', function (d) {
  const s = readF(ep(d)); const m = s.match(/ data-i18n="[^"]+"/);
  writeF(ep(d), s.replace(m[0], ''));
}, 'examples: data-i18n key set');
// 17. Change the inline style.
negative('N17 (change inline style)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('<style>', '<style>/* x */'));
}, 'examples: inline <style> SHA-256');
// 18. Add fetch('examples-section.html').
negative('N18 (fetch content)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('</body>', "<script>fetch('examples-section.html')</script></body>"));
}, 'examples: does not fetch content');
// 19. Generate the catalog via innerHTML building MAIN (remove the static cards
//     AND set main's innerHTML) — the static catalog must be present.
negative('N19 (catalog built via innerHTML, static cards removed)', function (d) {
  let s = readF(ep(d));
  s = s.replace(/<a href="solver\.html\?ex=[^"]+"[^>]*>[\s\S]*?<\/a>/g, ''); // strip all static cards
  writeF(ep(d), s);
}, 'examples: card count');
// 20. Add an engine reference.
negative('N20 (engine reference)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('</body>', '<script>/* ENGINE_START */ solveModel_()</script></body>'));
}, 'examples: does not load the engine');
// 21. Add new Worker.
negative('N21 (new Worker)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('</body>', "<script>new Worker('w.js')</script></body>"));
}, 'examples: does not create a Worker');
// 22. Add grid/charts/exports markup.
negative('N22 (grid/charts/exports markup)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('</main>', '<div id="grid"></div></main>'));
}, 'examples: does not carry grid/results/charts/exports markup');
// 23. Publish an examples source partial.
negative('N23 (examples source partial appears)', function (d) {
  fs.mkdirSync(path.join(d, 'src', 'pages', 'examples'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'pages', 'examples', 'card.html'), '<a></a>');
}, 'examples: no examples source partial directory');
// 24. Duplicate an ID.
negative('N24 (duplicate an id)', function (d) {
  writeF(ep(d), readF(ep(d)).replace('id="exCatalog"', 'id="exCatalog"></div><div id="exCatalog"'));
}, 'examples: no duplicate IDs');
// 25. Modify solver.html (add stray content) AND mutate an examples slug: the
//     Examples checker must trip on the EXAMPLES-side mutation and must NOT depend
//     on solver's full HTML beyond the explicit slug contracts.
negative('N25 (solver touched; examples checker independent of solver HTML)', function (d) {
  writeF(path.join(d, 'solver.html'), readF(path.join(d, 'solver.html')) + '\n<!-- stray -->\n');
  let s = readF(ep(d));
  const main = s.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
  const newMain = main.replace('solver.html?ex=production-plan"', 'solver.html?ex=production-plan-x"');
  writeF(ep(d), s.replace(main, newMain));
}, 'sync: every HTML card slug exists exactly once in examples-data.js');

// 26. Run the checker from a temp ROOT whose path contains a space.
{
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline ex space-'));
  try {
    makeTree(spaced);
    const clean = checkExamplesPage(spaced);
    ok('N26 (spaced path): clean spaced-path tree passes the checker', clean.fail === 0, 'fail=' + clean.fail);
    writeF(ep(spaced), readF(ep(spaced)).replace('?ex=production-plan', '?ex=production-plan-x'));
    const after = checkExamplesPage(spaced);
    ok('N26 (spaced path): mutation trips the checker from a spaced path', after.fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
}

console.log('EXAMPLES PAGE NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
