/**
 * tests_assets.js — guards against two classes of "looks fine locally but
 * breaks in production" bug:
 *   1. assets/i18n.js must be syntactically valid JavaScript. A single stray
 *      multiline string would throw a SyntaxError before window.Plumline.i18n
 *      is defined, taking down the language selector and every page's init.
 *   2. examples-data.js must be valid and export exactly 9 examples.
 *
 * JSON-LD validity lives in tests_jsonld.js. Run: node engine/tests_assets.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const siteDir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// 1. i18n.js parses as JS (node --check throws on a syntax error).
(function () {
  let good = true, err = '';
  try { execSync('node --check ' + JSON.stringify(path.join(siteDir, 'assets', 'i18n.js')), { stdio: 'pipe' }); }
  catch (e) { good = false; err = String(e.stderr || e.message); }
  ok('assets/i18n.js is valid JavaScript', good, err.split('\n')[0]);
})();

// 2. i18n.js actually defines the Plumline.i18n API when evaluated.
(function () {
  let hasApi = false, err = '';
  try {
    const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
    g.window = g; g.globalThis = g;
    const src = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
    const fn = new Function('window', 'navigator', 'location', 'document', 'globalThis', src + '\nreturn (this.Plumline||window.Plumline);');
    const Plumline = fn.call(g, g, g.navigator, g.location, g.document, g);
    hasApi = !!(Plumline && Plumline.i18n && typeof Plumline.i18n.t === 'function');
  } catch (e) { err = String(e.message); }
  ok('i18n.js defines Plumline.i18n.t', hasApi, err);
})();

// 3. examples-data.js is valid and exports 9 unique examples.
(function () {
  let meta = null, err = '';
  try { meta = require(path.join(siteDir, 'assets', 'examples-data.js')); }
  catch (e) { err = String(e.message); }
  ok('examples-data.js loads', meta !== null, err);
  if (meta) {
    ok('exports 9 examples', Array.isArray(meta.META) && meta.META.length === 9, meta.META && meta.META.length);
    const keys = (meta.META || []).map(m => m.key);
    ok('example keys unique', new Set(keys).size === keys.length);
    ok('every example has slug/category/type/sense',
       (meta.META || []).every(m => m.slug && m.category && m.type && m.sense));
  }
})();

// 4. The build badge appears exactly once per page, inside the <footer>'s
//    <p class="fine"> line — never stranded in body content.
(function () {
  const pages = ['index.html', 'solver.html', 'guide.html', 'about.html',
                 'privacy.html', 'terms.html', 'examples.html'];
  pages.forEach(function (page) {
    const html = fs.readFileSync(path.join(siteDir, page), 'utf8');
    const footerMatch = html.match(/<footer\b[\s\S]*?<\/footer>/i);
    const footer = footerMatch ? footerMatch[0] : '';
    const totalBadges = (html.match(/id="buildBadge"/g) || []).length;
    const footerBadges = (footer.match(/id="buildBadge"/g) || []).length;
    ok(page + ' has exactly one build badge', totalBadges === 1, 'found ' + totalBadges);
    ok(page + ' badge is inside <footer>', footerBadges === 1, 'found ' + footerBadges + ' in footer');
    // Extract each <p class="fine">...</p> block individually (the inner regex
    // refuses to cross a </p>), so a badge in a SEPARATE <p> can't satisfy this.
    const fineParagraphs = [...footer.matchAll(/<p\b[^>]*class="[^"]*\bfine\b[^"]*"[^>]*>(?:(?!<\/p>)[\s\S])*<\/p>/gi)].map(m => m[0]);
    const fineBadges = fineParagraphs.reduce((n, p) => n + (p.match(/id="buildBadge"/g) || []).length, 0);
    ok(page + ' footer has one .fine paragraph containing the badge', fineBadges === 1, 'found ' + fineBadges);
    ok(page + ' includes build-badge.js', /build-badge\.js/.test(html));
  });
})();

console.log('ASSET TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
