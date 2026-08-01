/* tests_guide_page_negative.js — Checkpoint C2 negative tests.
 *
 * Each case builds a temp tree, applies ONE real mutation, runs the SAME official
 * checkGuidePage() the positive suite uses (never a copy of its logic), asserts
 * fail > 0 with a message identifying the mutation, and removes the tree in
 * finally. Case 25 runs the checker from a temp path containing a space.
 *
 * Static file mutations; no jsdom, no server. LF-only, no open handles.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkGuidePage } = require('./tests_guide_page.js');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

function makeTree(rootDir) {
  const dir = rootDir || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-guide-'));
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'pages-golden'), { recursive: true });
  PAGES.forEach(function (p) { fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html')); });
  fs.copyFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'guide-page.json'),
    path.join(dir, 'engine', 'fixtures', 'pages-golden', 'guide-page.json'));
  return dir;
}

function readF(f) { return fs.readFileSync(f, 'utf8'); }
function writeF(f, s) { fs.writeFileSync(f, s); }
function gp(dir) { return path.join(dir, 'guide.html'); }

function negative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree passes the official checker', checkGuidePage(dir).fail === 0);
    mutate(dir);
    const after = checkGuidePage(dir);
    ok(label + ': mutation trips the checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
      after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
      'failures=' + after.failures.slice(0, 6).join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. Remove a section.
negative('N1 (remove a section)', function (d) {
  writeF(gp(d), readF(gp(d)).replace(/<section\b[\s\S]*?<\/section>/, ''));
}, 'guide: <main> SHA-256');
// 2. Duplicate a section.
negative('N2 (duplicate a section)', function (d) {
  const s = readF(gp(d)); const m = s.match(/<section\b[\s\S]*?<\/section>/);
  writeF(gp(d), s.replace('</main>', m[0] + '</main>'));
}, 'guide: section count');
// 3. Reorder two sections (move first section to end).
negative('N3 (reorder sections)', function (d) {
  let s = readF(gp(d)); const m = s.match(/<section\b[\s\S]*?<\/section>/);
  s = s.replace(m[0], '').replace('</main>', m[0] + '</main>'); writeF(gp(d), s);
}, 'guide: <main> SHA-256');
// 4. Remove a heading.
negative('N4 (remove a heading)', function (d) {
  writeF(gp(d), readF(gp(d)).replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/, ''));
}, 'guide: heading order');
// 5. Change a heading level (h2 -> h3 for the first h2).
negative('N5 (change a heading level)', function (d) {
  const s = readF(gp(d)); const m = s.match(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/);
  writeF(gp(d), s.replace(m[0], '<h3' + m[1] + '>' + m[2] + '</h3>'));
}, 'guide: heading order');
// 6. Change a heading's data-i18n.
negative('N6 (change heading data-i18n)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('data-i18n="statusH"', 'data-i18n="statusChangedH"'));
}, 'guide: heading order');
// 7. Remove an ID.
negative('N7 (remove an id)', function (d) {
  writeF(gp(d), readF(gp(d)).replace(' id="variables"', ''));
}, 'guide: id set');
// 8. Duplicate an ID.
negative('N8 (duplicate an id)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('id="variables"', 'id="variables"><span id="variables"'));
}, 'guide: no duplicate IDs');
// 9. Break an anchor.
negative('N9 (break an anchor)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('</main>', '<a href="#nope-xyz">x</a></main>'));
}, 'resolves to an existing id');
// 10. Change a link.
negative('N10 (change a link)', function (d) {
  const s = readF(gp(d)); const m = s.match(/<a\b[^>]*href="([^"]+)"/);
  writeF(gp(d), s.replace(m[0], m[0].replace(m[1], m[1] + '-changed')));
}, 'guide: link set');
// 11. Remove a data-i18n key.
negative('N11 (remove a data-i18n key)', function (d) {
  writeF(gp(d), readF(gp(d)).replace(' data-i18n="statusOptimalLabel"', ''));
}, 'guide: data-i18n key set');
// 12. Introduce a foreign-namespace key.
negative('N12 (foreign namespace key)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('</main>', '<span data-i18n="pvTitle">x</span></main>'));
}, 'foreign-namespace i18n key');
// 13. Remove an ARIA attribute (if any) — guide has none, so instead remove the
//     namespace init script arg to prove the namespace contract bites.
negative('N13 (namespace changed)', function (d) {
  writeF(gp(d), readF(gp(d)).replace("init('guide')", "init('guide-x')"));
}, 'guide: i18n init namespace');
// 14. Change canonical (the <link rel="canonical"> specifically).
negative('N14 (change canonical)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('<link rel="canonical" href="https://plumline.online/guide.html">',
    '<link rel="canonical" href="https://plumline.online/guide-x.html">'));
}, 'guide: canonical');
// 15. Change metadata (an OG tag count).
negative('N15 (change metadata / OG count)', function (d) {
  writeF(gp(d), readF(gp(d)).replace(/<meta property="og:image"[^>]*>/, ''));
}, 'guide: OG tag count');
// 16. Remove a shared script.
negative('N16 (remove a shared script)', function (d) {
  writeF(gp(d), readF(gp(d)).replace(/<script src="assets\/i18n\.js\?v=82"><\/script>\s*/, ''));
}, 'guide: script src set');
// 17. Change an asset version.
negative('N17 (change asset version)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('nav-menu.js?v=6', 'nav-menu.js?v=5'));
}, 'guide: script src set');
// 18. Add fetch('guide-section.html').
negative('N18 (fetch content)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('</body>', "<script>fetch('guide-section.html')</script></body>"));
}, 'guide: does not fetch content');
// 19. Build main via innerHTML.
negative('N19 (innerHTML main)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('</body>', "<script>document.querySelector('main').innerHTML='x'</script></body>"));
}, 'guide: does not build main via innerHTML');
// 20. Add an engine reference.
negative('N20 (engine reference)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('</body>', '<script>/* ENGINE_START */ solveModel_()</script></body>'));
}, 'guide: does not load the engine');
// 21. Add new Worker.
negative('N21 (new Worker)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('</body>', "<script>new Worker('w.js')</script></body>"));
}, 'guide: does not create a Worker');
// 22. Add grid/charts markup.
negative('N22 (grid/charts markup)', function (d) {
  writeF(gp(d), readF(gp(d)).replace('</main>', '<div id="grid"></div></main>'));
}, 'guide: does not carry grid/results/charts markup');
// 23. Publish a guide source partial.
negative('N23 (guide source partial appears)', function (d) {
  fs.mkdirSync(path.join(d, 'src', 'pages', 'guide'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'pages', 'guide', 'section.html'), '<section></section>');
}, 'guide: no guide source partial directory');
// 24. Modify solver.html — the guide checker must still validate guide and never
//     depend on solver. We mutate guide's main AND touch solver; the checker must
//     fail on the guide mutation, and solver is outside its scope.
negative('N24 (guide mutated while solver touched)', function (d) {
  writeF(path.join(d, 'solver.html'), readF(path.join(d, 'solver.html')) + '\n<!-- stray -->\n');
  writeF(gp(d), readF(gp(d)).replace('data-i18n="statusH"', 'data-i18n="statusHX"'));
}, 'guide: data-i18n key set');

// 25. Run the checker from a temp ROOT whose path contains a space.
{
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline guide space-'));
  try {
    makeTree(spaced);
    const clean = checkGuidePage(spaced);
    ok('N25 (spaced path): clean spaced-path tree passes the checker', clean.fail === 0, 'fail=' + clean.fail);
    writeF(gp(spaced), readF(gp(spaced)).replace('data-i18n="statusH"', 'data-i18n="statusHX"'));
    const after = checkGuidePage(spaced);
    ok('N25 (spaced path): mutation trips the checker from a spaced path', after.fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
}

console.log('GUIDE PAGE NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
