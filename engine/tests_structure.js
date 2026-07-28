/**
 * tests_structure.js — Phase 5.1 structural guarantees for every page:
 *   - no broken internal links or anchors
 *   - referenced local assets exist
 *   - IDs unique within a page (outside <script>)
 *   - exactly one <main>, <h1>, <header>, <footer> per page
 *   - the H1 sits inside <main>; the header sits outside it
 *   - consistent primary nav across the seven pages
 *
 * Run: node engine/tests_structure.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index.html', 'solver.html', 'guide.html', 'about.html',
               'privacy.html', 'terms.html', 'examples.html'];
const existing = new Set(PAGES);

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }
function stripScripts(s) { return s.replace(/<script[\s\S]*?<\/script>/g, ''); }
function idsOf(body) { return new Set([...body.matchAll(/id="([^"]+)"/g)].map(m => m[1])); }

const bodies = {}, ids = {};
PAGES.forEach(p => { const raw = fs.readFileSync(path.join(siteDir, p), 'utf8'); bodies[p] = stripScripts(raw); ids[p] = idsOf(bodies[p]); });

// Links and anchors.
PAGES.forEach(function (p) {
  const body = bodies[p];
  [...body.matchAll(/href="([^"#][^"]*)?(#[^"]*)?"/g)]; // no-op to keep regex engine warm
  for (const m of body.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|\/\/)/.test(href)) continue;
    const [pathPart, frag] = href.split('#');
    const clean = pathPart.split('?')[0];
    if (href.startsWith('#')) {
      ok(p + ' anchor ' + href + ' exists', ids[p].has(href.slice(1)));
    } else {
      if (clean && !existing.has(clean) && !/\.(png|css|js|xml|txt|json|svg|ico|webmanifest)$/.test(clean)) {
        ok(p + ' link to ' + clean + ' exists', false);
      }
      if (frag && existing.has(clean)) ok(p + ' ' + href + ' -> #' + frag + ' exists', ids[clean].has(frag));
    }
  }
});

// Referenced local assets exist on disk.
PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  for (const m of raw.matchAll(/(?:src|href)="([^"]+\.(?:css|js|png|svg|ico))(?:\?[^"]*)?"/g)) {
    const rel = m[1];
    if (/^(https?:|\/\/|data:)/.test(rel)) continue;
    ok(p + ' asset ' + rel + ' exists', fs.existsSync(path.join(siteDir, rel)));
  }
});

// Unique IDs (outside <script>).
PAGES.forEach(function (p) {
  const all = [...bodies[p].matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dups = all.filter((x, i) => all.indexOf(x) !== i);
  ok(p + ' has no duplicate IDs', dups.length === 0, dups.join(','));
});

// Exactly one main/h1/header/footer, H1 in main, header out of main.
PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  ['main', 'h1', 'header', 'footer'].forEach(function (tag) {
    const n = (raw.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
    ok(p + ' has exactly one <' + tag + '>', n === 1, 'found ' + n);
  });
  const m0 = raw.indexOf('<main'), m1 = raw.indexOf('</main>'), h1 = raw.indexOf('<h1'), hd = raw.indexOf('<header');
  ok(p + ' H1 is inside <main>', m0 >= 0 && m0 < h1 && h1 < m1);
  ok(p + ' header is outside <main>', hd >= 0 && hd < m0);
});

// Consistent primary nav: every page links to the other core pages. A page
// need not link to itself (it marks aria-current instead).
const CORE = { 'index.html': null, 'solver.html': 'solver.html', 'guide.html': 'guide.html', 'examples.html': 'examples.html', 'about.html': 'about.html' };
PAGES.forEach(function (p) {
  const nav = (bodies[p].match(/<nav[\s\S]*?<\/nav>/) || [''])[0];
  ['solver.html', 'guide.html', 'examples.html', 'about.html'].forEach(function (target) {
    if (target === p) return; // don't require a self-link on its own page
    ok(p + ' nav links to ' + target, nav.indexOf('href="' + target) >= 0);
  });
});

console.log('STRUCTURE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
