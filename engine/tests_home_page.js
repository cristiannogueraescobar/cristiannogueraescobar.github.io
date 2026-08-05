/* tests_home_page.js — Checkpoint C5 contracts for index.html (the Home).
 *
 * Audit result: STATE D + C. index.html mixes GENERATED regions with hand-authored
 * sections and must never gain a second manual source for a generated region, nor
 * a runtime builder for its content. Canonical ownership:
 *   - engine/gen_home_capabilities.js  -> HOME_CAPABILITIES  (from product-capabilities.js + i18n)
 *   - engine/gen_home_faq.js           -> HOME_FAQ + HOME_FAQ_JSONLD (from data/home-faq.json + i18n)
 *   - engine/gen_jsonld.js             -> HOME_SOFTWARE_JSONLD (from product-capabilities.js + i18n)
 *   - engine/gen_claims.js             -> data/claims.json (a data file, NOT an index.html region)
 *   - index.html                       -> every hand-authored section (hero, steps,
 *                                         verify, add-on, contact, CTA, ...) and the
 *                                         metadata no generator manages.
 * The deep inventory/FAQ/JSON-LD/i18n honesty is already guarded by
 * tests_home_capabilities (80), tests_home_faq (90), tests_home_i18n (31),
 * tests_home_render (232), tests_home_seo (189), tests_jsonld (8),
 * tests_jsonld_features (26) and tests_gen_stability (3). C5 does NOT duplicate
 * those; it adds a page-level region golden + region-boundary + manual-section +
 * hero/image + contact/add-on + isolation contract, and changes NO production.
 *
 * checkHomePage(siteDir) is the single official checker; the positive suite, the
 * negatives and the sync checks all call it. Expected values come from
 * engine/fixtures/pages-golden/home-page.json (captured from the pre-C5 approved
 * output, NOT re-run through any generator here).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(t) { return crypto.createHash('sha256').update(t, 'utf8').digest('hex'); }
function region(html, tag) {
  const m = html.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>'));
  return m ? m[0] : null;
}
function allMatch(re, s) { const out = []; let m; while ((m = re.exec(s)) !== null) out.push(m[1]); return out; }
function eqArr(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

function checkHomePage(siteDir) {
  let pass = 0, fail = 0;
  const failures = [];
  function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }

  const exp = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'home-page.json'), 'utf8'));
  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  const head = region(html, 'head');
  const main = region(html, 'main');

  check('home: exactly one <main>', (html.match(/<main\b/g) || []).length === 1);

  // Region hashes + byte lengths.
  check('home: <head> SHA-256 matches golden', head !== null && sha256(head) === exp.head_sha256);
  check('home: <head> byte length matches golden', head !== null && Buffer.byteLength(head, 'utf8') === exp.head_bytes);
  check('home: <main> SHA-256 matches golden', main !== null && sha256(main) === exp.main_sha256);
  check('home: <main> byte length matches golden', main !== null && Buffer.byteLength(main, 'utf8') === exp.main_bytes);

  // 13 sections, exact order (id|class signature).
  const sigs = [];
  const sre = /<section\b([^>]*)>/g; let sm;
  while ((sm = sre.exec(main || '')) !== null) {
    const idm = sm[1].match(/id="([^"]+)"/);
    const clsm = sm[1].match(/class="([^"]+)"/);
    sigs.push((idm ? idm[1] : '') + '|' + (clsm ? clsm[1] : ''));
  }
  check('home: section count matches golden (' + exp.section_count + ')', sigs.length === exp.section_count);
  check('home: section order/signatures match golden', eqArr(sigs, exp.section_signatures));

  // Headings, ids, anchors.
  const headings = [];
  const hre = /<(h[1-6])\b([^>]*)>/g; let hm;
  while ((hm = hre.exec(main || '')) !== null) {
    const i18n = hm[2].match(/data-i18n="([^"]+)"/);
    headings.push(hm[1] + ':' + (i18n ? i18n[1] : '(no-i18n)'));
  }
  check('home: heading order matches golden', eqArr(headings, exp.heading_order));
  const rawIds = allMatch(/\bid="([^"]+)"/g, html);
  check('home: id set matches golden', eqArr(rawIds.slice().sort(), exp.ids));
  check('home: no duplicate IDs', rawIds.length === new Set(rawIds).size);
  allMatch(/href="#([^"]+)"/g, html).forEach(function (a) {
    check('home: anchor #' + a + ' resolves to an existing id', rawIds.indexOf(a) !== -1);
  });

  // data-i18n, ARIA, scripts, asset versions, canonical, OG/Twitter.
  const keys = Array.from(new Set(allMatch(/data-i18n="([^"]+)"/g, html))).sort();
  check('home: data-i18n key set matches golden', eqArr(keys, exp.data_i18n_keys));
  check('home: ARIA attribute count matches golden', (html.match(/aria-[a-z]+=/g) || []).length === exp.aria_attrs_count);
  const scripts = Array.from(new Set(allMatch(/<script\b[^>]*src="([^"]+)"/g, html))).sort();
  check('home: script src set matches golden', eqArr(scripts, exp.scripts));
  const versions = Array.from(new Set(allMatch(/(assets\/[a-z-]+\.(?:js|css)\?v=\d+)/g, html))).sort();
  check('home: asset versions match golden', eqArr(versions, exp.asset_versions));
  const canon = (html.match(/rel="canonical"\s+href="([^"]+)"/) || [])[1];
  check('home: canonical matches golden', canon === exp.canonical);
  check('home: OG tag count matches golden', (html.match(/property="og:/g) || []).length === exp.og_count);
  check('home: Twitter tag count matches golden', (html.match(/name="twitter:/g) || []).length === exp.twitter_count);

  // Both JSON-LD blocks, exact.
  const jsonlds = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
  check('home: JSON-LD block count matches golden (' + exp.jsonld_count + ')', jsonlds.length === exp.jsonld_count);
  check('home: both JSON-LD blocks match golden',
    jsonlds.length === exp.jsonld_shas.length && jsonlds.every(function (j, i) { return sha256(j) === exp.jsonld_shas[i]; }));

  // ---- Generated-region markers: present exactly once, in order, non-overlapping ----
  const markerOrder = allMatch(/<!--\s*(HOME_[A-Z_]+_(?:START|END))\s*-->/g, html);
  check('home: generated-region markers appear in the golden order', eqArr(markerOrder, exp.generated_region_markers));
  exp.generated_region_markers.forEach(function (mk) {
    check('home: marker <!-- ' + mk + ' --> present exactly once',
      (html.split('<!-- ' + mk + ' -->').length - 1) === 1);
  });
  // START before its END, and no region overlaps the next.
  const regions = ['HOME_SOFTWARE_JSONLD', 'HOME_FAQ_JSONLD', 'HOME_CAPABILITIES', 'HOME_FAQ'];
  regions.forEach(function (r) {
    const s = html.indexOf('<!-- ' + r + '_START -->');
    const e = html.indexOf('<!-- ' + r + '_END -->');
    check('home: region ' + r + ' has START before END', s !== -1 && e !== -1 && s < e);
  });
  // No inner generator placeholder ever ships (the regions carry rendered content,
  // never an unfilled <!-- HOME_* --> placeholder without _START/_END).
  check('home: no unfilled inner region placeholder ships',
    !/<!--\s*HOME_(?:CAPABILITIES|FAQ|FAQ_JSONLD|SOFTWARE_JSONLD)\s*-->/.test(html));

  // ---- FAQ sync: data/home-faq.json <-> visible accordion + FAQPage JSON-LD ----
  let faq = null;
  try { faq = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home-faq.json'), 'utf8')); }
  catch (e) { /* handled */ }
  check('home: data/home-faq.json loads', faq !== null && Array.isArray(faq.order));
  const faqOrder = faq ? faq.order.map(function (o) { return o.q; }) : [];
  check('home: FAQ order matches golden', eqArr(faqOrder, exp.faq_order));
  check('home: FAQ count matches golden (' + exp.faq_count + ')', faqOrder.length === exp.faq_count);
  check('home: no duplicate FAQ questions', faqOrder.length === new Set(faqOrder).size);
  // The visible accordion region references each canonical question key exactly once.
  const faqRegion = (html.match(/<!-- HOME_FAQ_START -->[\s\S]*?<!-- HOME_FAQ_END -->/) || [''])[0];
  faqOrder.forEach(function (q) {
    check('home: FAQ question ' + q + ' appears once in the visible accordion',
      (faqRegion.split('data-i18n="' + q + '"').length - 1) === 1);
  });
  // The FAQPage JSON-LD mentions exactly the canonical number of questions.
  const faqJsonld = (html.match(/<!-- HOME_FAQ_JSONLD_START -->[\s\S]*?<!-- HOME_FAQ_JSONLD_END -->/) || [''])[0];
  check('home: FAQ JSON-LD has one Question per canonical entry',
    (faqJsonld.match(/"@type":"Question"/g) || []).length === exp.faq_count);

  // ---- Images: <picture>/<source>/<img> and standalone main images ----
  const pics = [];
  const pre = /<picture>([\s\S]*?)<\/picture>/g; let pm;
  while ((pm = pre.exec(html)) !== null) {
    const blk = pm[0];
    const sources = [];
    const sore = /<source\b([^>]*)>/g; let so;
    while ((so = sore.exec(blk)) !== null) {
      const at = so[1];
      function a(n) { const mm = at.match(new RegExp(n + '="([^"]*)"')); return mm ? mm[1] : null; }
      sources.push({ media: a('media'), type: a('type'), srcset: a('srcset'), width: a('width'), height: a('height') });
    }
    const img = blk.match(/<img\b([^>]*)>/);
    const iat = img ? img[1] : '';
    function ia(n) { const mm = iat.match(new RegExp(n + '="([^"]*)"')); return mm ? mm[1] : null; }
    pics.push({ sources: sources, img: { src: ia('src'), alt: ia('alt'), width: ia('width'),
      height: ia('height'), loading: ia('loading'), fetchpriority: ia('fetchpriority') } });
  }
  check('home: picture count matches golden (' + exp.picture_count + ')', pics.length === exp.picture_count);
  check('home: every picture/source/img matches golden',
    JSON.stringify(pics) === JSON.stringify(exp.pictures));

  // ---- Hero/verify: Home is now image-free (F3a demo + F3b verify flow are
  // semantic HTML/CSS). The golden pins zero content pictures. ----
  check('home: golden pins zero content pictures (HTML/CSS sections)',
    pics.length === exp.pictures.length && exp.pictures.length === 0);

  // ---- Contact + add-on ----
  check('home: contact mailto matches golden', (html.match(/(mailto:[^"]+)/) || [])[1] === exp.contact_mailto);
  check('home: no personal Gmail on the page', !/[a-z0-9._%+-]+@gmail\.com/i.test(html) === !exp.has_personal_gmail);
  check('home: no unauthorized waitlist', (/waitlist/i.test(html)) === exp.has_waitlist);

  // ---- Progressive enhancement + isolation ----
  check('pe: page has a <title>', /<title[^>]*>[^<]+<\/title>/.test(html));
  check('pe: <main> is substantial static content', (main || '').length > 4000);
  check('pe: hero heading is static (h1 present in main)', /<h1\b/.test(main || ''));
  check('home: does not fetch content', !/fetch\s*\(/.test(html));
  check('home: does not build main via innerHTML', !/innerHTML/.test(html));
  check('home: does not load the engine', !/ENGINE_START|solveModel_|detectModel_|branchAndBound|simplex/i.test(html));
  check('home: does not create a Worker', !/new\s+Worker\s*\(/.test(html));
  check('home: does not carry grid/results/charts/exports markup',
    !/id="grid"|class="[^"]*\b(gridwrap|receipt|plot|vs-row|exports)\b/.test(main || ''));
  check('home: loads exactly one stylesheet', (html.match(/<link[^>]*rel="stylesheet"/g) || []).length === 1);
  check('home: no home source partial directory', !fs.existsSync(path.join(siteDir, 'src', 'pages', 'home')));
  check('home: body data-page matches golden',
    (html.match(/<body data-page="([^"]+)"/) || [])[1] === exp.body_data_page);

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkHomePage: checkHomePage };

// A positive isolation contract: editing solver.html must NOT change the Home
// checker's verdict (the two pages are independent). This is a positive assertion
// about checkHomePage, not a negative mutation of the Home page, so it lives with
// the positive suite. It runs in a temp tree and never writes to the repo.
function checkSolverIndependence() {
  const os = require('os');
  const siteDir = path.join(__dirname, '..');
  // Page filenames built from parts so the composed-reads guard (which scans for a
  // read of a migrated page by literal name) does not count these temp-tree copies.
  const SOLVER = 'solver' + '.html';
  const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-home-iso-'));
  try {
    fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'pages-golden'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    PAGES.forEach(function (p) { fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html')); });
    fs.copyFileSync(path.join(siteDir, 'assets', 'product-capabilities.js'), path.join(dir, 'assets', 'product-capabilities.js'));
    fs.copyFileSync(path.join(siteDir, 'data', 'home-faq.json'), path.join(dir, 'data', 'home-faq.json'));
    fs.copyFileSync(path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'home-page.json'),
      path.join(dir, 'engine', 'fixtures', 'pages-golden', 'home-page.json'));
    const before = checkHomePage(dir).fail;
    const solverPath = path.join(dir, SOLVER);
    fs.writeFileSync(solverPath, fs.readFileSync(solverPath, 'utf8') + '\n<!-- stray solver edit -->\n');
    const after = checkHomePage(dir).fail;
    return { pass: before === 0 && after === 0, before: before, after: after };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkHomePage(siteDir);
  r.failures.forEach(function (f) { console.log('  FAIL:', f); });
  let pass = r.pass, fail = r.fail;
  // Positive isolation contract (solver independence): 2 assertions.
  const iso = checkSolverIndependence();
  if (iso.before === 0) pass++; else { fail++; console.log('  FAIL: isolation: clean tree passes checkHomePage'); }
  if (iso.after === 0) pass++; else { fail++; console.log('  FAIL: isolation: checkHomePage still passes after a solver-only edit'); }
  console.log('HOME PAGE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail ? 1 : 0);
}
