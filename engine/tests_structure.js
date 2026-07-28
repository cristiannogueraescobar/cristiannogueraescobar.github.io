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

// Consistent primary nav: exactly one nav[aria-label="Primary"] per page, the
// five core links in order, and aria-current on the page's own link.
const PRIMARY = ['solver.html', 'index.html#addon', 'guide.html', 'examples.html', 'about.html'];
const CURRENT_OF = { 'solver.html': 'solver.html', 'guide.html': 'guide.html', 'examples.html': 'examples.html', 'about.html': 'about.html' };
PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  const navs = [...stripScripts(raw).matchAll(/<nav\b[^>]*aria-label="Primary"[^>]*>[\s\S]*?<\/nav>/g)].map(m => m[0]);
  ok(p + ' has exactly one primary nav', navs.length === 1, 'found ' + navs.length);
  const nav = navs[0] || '';
  // The five core links appear in order (extra page-specific links like
  // "How to use" are allowed but must not break the core order).
  const hrefs = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]).filter(h => PRIMARY.indexOf(h) >= 0);
  ok(p + ' primary nav has the 5 core links in order', hrefs.join('|') === PRIMARY.join('|'), hrefs.join('|'));
  // aria-current sits on the page's own link (and only there).
  const currentHrefs = [...nav.matchAll(/<a\b[^>]*aria-current="page"[^>]*href="([^"]+)"|<a\b[^>]*href="([^"]+)"[^>]*aria-current="page"/g)].map(m => m[1] || m[2]);
  const expectCurrent = CURRENT_OF[p];
  if (expectCurrent) {
    ok(p + ' aria-current is on ' + expectCurrent, currentHrefs.length === 1 && currentHrefs[0] === expectCurrent, currentHrefs.join(','));
  } else {
    ok(p + ' has no aria-current (no own slot)', currentHrefs.length === 0, currentHrefs.join(','));
  }
});

// Exactly one canonical per page, pointing to the right URL.
const CANONICALS = {
  'index.html': 'https://plumline.online/',
  'solver.html': 'https://plumline.online/solver.html',
  'guide.html': 'https://plumline.online/guide.html',
  'examples.html': 'https://plumline.online/examples.html',
  'about.html': 'https://plumline.online/about.html',
  'privacy.html': 'https://plumline.online/privacy.html',
  'terms.html': 'https://plumline.online/terms.html'
};
PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  const canons = [...raw.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m => m[1]);
  ok(p + ' has exactly one canonical', canons.length === 1, 'found ' + canons.length);
  ok(p + ' canonical is ' + CANONICALS[p], canons[0] === CANONICALS[p], canons[0]);
});

console.log('STRUCTURE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
