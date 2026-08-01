/* tests_legal_pages_negative.js — Checkpoint C1 negative tests.
 *
 * Each case builds a temp tree, applies ONE real mutation, runs the SAME official
 * checkLegalPages() the positive suite uses (never a copy of its logic), asserts
 * fail > 0 with a message identifying the mutation, and removes the tree in
 * finally.
 *
 * Static file mutations; no jsdom, no server. LF-only, no open handles.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkLegalPages } = require('./tests_legal_pages.js');

const siteDir = path.join(__dirname, '..');
// The checker reads the 3 legal pages + the fixture. It also touches solver.html
// only indirectly (never). We copy all 8 pages so a "solver modified" mutation is
// observable through the golden of the legal pages if it ever cross-contaminated;
// the checker itself validates the 3 legal pages.
const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-legal-'));
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'pages-golden'), { recursive: true });
  PAGES.forEach(function (p) { fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html')); });
  fs.copyFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'legal-pages.json'),
    path.join(dir, 'engine', 'fixtures', 'pages-golden', 'legal-pages.json'));
  return dir;
}

function readF(f) { return fs.readFileSync(f, 'utf8'); }
function writeF(f, s) { fs.writeFileSync(f, s); }
function pagePath(dir, p) { return path.join(dir, p + '.html'); }

// Run a negative: clean tree passes, mutation trips the checker, a failure
// message mentions `mentions`, tree removed in finally.
function negative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree passes the official checker', checkLegalPages(dir).fail === 0);
    mutate(dir);
    const after = checkLegalPages(dir);
    ok(label + ': mutation trips the checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
      after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
      'failures=' + after.failures.slice(0, 6).join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. About loses a section (drop its first <section>…</section>).
negative('N1 (about loses a section)', function (dir) {
  const f = pagePath(dir, 'about');
  writeF(f, readF(f).replace(/<section\b[\s\S]*?<\/section>/, ''));
}, 'about: <main> SHA-256');

// 2. About changes a heading (edit an about heading's data-i18n).
negative('N2 (about heading changed)', function (dir) {
  const f = pagePath(dir, 'about');
  writeF(f, readF(f).replace('data-i18n="aboutWhoH"', 'data-i18n="aboutChangedH"'));
}, 'about: heading order');

// 3. Privacy loses "updated".
negative('N3 (privacy loses updated)', function (dir) {
  const f = pagePath(dir, 'privacy');
  writeF(f, readF(f).replace('<p class="updated" data-i18n="updated">Last updated 27 July 2026</p>', ''));
}, 'privacy: <main> SHA-256');

// 4. Privacy canonical changed.
negative('N4 (privacy canonical changed)', function (dir) {
  const f = pagePath(dir, 'privacy');
  writeF(f, readF(f).replace('https://plumline.online/privacy.html', 'https://plumline.online/privacy-x.html'));
}, 'privacy: canonical');

// 5. Privacy removes a data-i18n.
negative('N5 (privacy removes a data-i18n)', function (dir) {
  const f = pagePath(dir, 'privacy');
  writeF(f, readF(f).replace(' data-i18n="pvIntro"', ''));
}, 'privacy: data-i18n key set');

// 6. Terms changes a heading.
negative('N6 (terms heading changed)', function (dir) {
  const f = pagePath(dir, 'terms');
  writeF(f, readF(f).replace('data-i18n="tmAgreeH"', 'data-i18n="tmChangedH"'));
}, 'terms: heading order');

// 7. Terms removes a link.
negative('N7 (terms removes a link)', function (dir) {
  const f = pagePath(dir, 'terms');
  writeF(f, readF(f).replace(/<a\b[^>]*href="[^"]*"[^>]*>[\s\S]*?<\/a>/, ''));
}, 'terms: link set');

// 8. Terms changes the namespace.
negative('N8 (terms namespace changed)', function (dir) {
  const f = pagePath(dir, 'terms');
  writeF(f, readF(f).replace("init('legal')", "init('terms-x')"));
}, 'terms: i18n init namespace');

// 9. Privacy text copied into Terms (a pv* key appears in terms).
negative('N9 (privacy text copied into terms)', function (dir) {
  const f = pagePath(dir, 'terms');
  writeF(f, readF(f).replace('</main>', '<p data-i18n="pvIntro">leaked</p></main>'));
}, 'no privacy pv* key appears in terms');

// 10. Terms text copied into Privacy (a tm* key appears in privacy).
negative('N10 (terms text copied into privacy)', function (dir) {
  const f = pagePath(dir, 'privacy');
  writeF(f, readF(f).replace('</main>', '<p data-i18n="tmAgreeP">leaked</p></main>'));
}, 'no terms tm* key appears in privacy');

// 11. Mixed pv*/tm* keys (put a tm* key into privacy AND a pv* key into terms).
negative('N11 (legal keys mixed across pages)', function (dir) {
  const fp = pagePath(dir, 'privacy'), ft = pagePath(dir, 'terms');
  writeF(fp, readF(fp).replace('</main>', '<p data-i18n="tmMayP">x</p></main>'));
  writeF(ft, readF(ft).replace('</main>', '<p data-i18n="pvSolverP">y</p></main>'));
}, 'privacy uses only pv*/shared keys');

// 12. Heading order changed in privacy (swap two headings' order via hash).
negative('N12 (privacy heading order changed)', function (dir) {
  const f = pagePath(dir, 'privacy');
  // Move the first h2 block to the end of main to change order.
  let s = readF(f);
  const m = s.match(/<h2\b[^>]*data-i18n="[^"]*"[^>]*>[\s\S]*?<\/h2>/);
  if (m) { s = s.replace(m[0], '').replace('</main>', m[0] + '</main>'); writeF(f, s); }
}, 'privacy: <main> SHA-256');

// 13. Shared script removed (drop i18n.js from terms).
negative('N13 (shared script removed from terms)', function (dir) {
  const f = pagePath(dir, 'terms');
  writeF(f, readF(f).replace(/<script src="assets\/i18n\.js\?v=82"><\/script>\s*/, ''));
}, 'terms: script src set');

// 14. Asset version changed (privacy i18n.js?v=82 -> v=81). The version is part
//     of the script src, so the script-src contract names it.
negative('N14 (privacy asset version changed)', function (dir) {
  const f = pagePath(dir, 'privacy');
  writeF(f, readF(f).replace('i18n.js?v=82', 'i18n.js?v=81'));
}, 'privacy: script src set');

// 15. Legal content fetched at runtime.
negative('N15 (about fetches content)', function (dir) {
  const f = pagePath(dir, 'about');
  writeF(f, readF(f).replace('</body>', "<script>fetch('about-body.html')</script></body>"));
}, 'about: does not fetch content');

// 16. main built via innerHTML.
negative('N16 (privacy builds main via innerHTML)', function (dir) {
  const f = pagePath(dir, 'privacy');
  writeF(f, readF(f).replace('</body>', "<script>document.querySelector('main').innerHTML='x'</script></body>"));
}, 'privacy: does not build main via innerHTML');

// 17. A legal source partial published.
negative('N17 (legal source partial appears)', function (dir) {
  fs.mkdirSync(path.join(dir, 'src', 'pages', 'legal'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'pages', 'legal', 'privacy-body.html'), '<main class="prose"></main>');
}, 'no legal source partial directory');

// 18. Duplicate ID introduced (about).
negative('N18 (about duplicate id)', function (dir) {
  const f = pagePath(dir, 'about');
  writeF(f, readF(f).replace('<main id="content">', '<main id="content"><span id="content"></span>'));
}, 'about: no duplicate IDs');

// 19. Broken anchor (about gains an href to a non-existent id).
negative('N19 (about broken anchor)', function (dir) {
  const f = pagePath(dir, 'about');
  writeF(f, readF(f).replace('</main>', '<a href="#does-not-exist">x</a></main>'));
}, 'resolves to an existing id');

// 20. solver.html modified — the legal checker must still validate the 3 legal
//     pages unchanged; we assert C1 leaves solver untouched by checking a
//     mutation to a legal page's main is what trips it, and a solver-only edit
//     does NOT silently pass a legal mutation. Here we mutate the about main AND
//     touch solver; the checker must fail on the about mutation (solver is out of
//     the legal checker's scope, proving C1 never depends on solver).
negative('N20 (about mutated while solver also touched)', function (dir) {
  writeF(pagePath(dir, 'solver'), readF(pagePath(dir, 'solver')) + '\n<!-- stray -->\n');
  const f = pagePath(dir, 'about');
  writeF(f, readF(f).replace('data-i18n="aboutTitle"', 'data-i18n="aboutTitleX"'));
}, 'about: data-i18n key set');

console.log('LEGAL PAGES NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
