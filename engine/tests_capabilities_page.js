/* tests_capabilities_page.js — Checkpoint C4 contracts for capabilities.html.
 *
 * Audit result: STATE D — capabilities.html is GENERATED and must never become a
 * second manual source. Canonical sources:
 *   - engine/templates/capabilities.template.html : page chrome + the two region
 *     markers (CAPABILITIES_HEAD / CAPABILITIES_CONTENT) the generator fills.
 *   - assets/product-capabilities.js : the capability inventory (single source of
 *     truth for what is public/available/shown).
 *   - data/media.json : the product imagery (file, width, height, altKey, ...).
 *   - assets/i18n.js : the copy (English inline + data-i18n for the rest).
 *   - engine/gen_capabilities.js : the deterministic generator (has --check).
 * The full inventory honesty (ids, testMarkers, 5-language copy) is already
 * guarded by tests_capabilities.js (1139); the JSON-LD featureList<->inventory
 * sync by tests_jsonld_features.js; Home by tests_home_capabilities.js. C4 does
 * NOT duplicate those; it adds page-level region golden + generator-parity +
 * HTML<->inventory/media sync + lightbox/footer/isolation, and changes NO
 * production.
 *
 * checkCapabilitiesPage(siteDir) is the single official checker; the positive
 * suite, the negatives, and the sync checks all call it. Expected values come
 * from engine/fixtures/pages-golden/capabilities-page.json (captured from the
 * pre-C4 approved output, NOT re-run through the generator here).
 *
 * Static file reads + a require() of the inventory/media; no jsdom, no server.
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

function checkCapabilitiesPage(siteDir) {
  let pass = 0, fail = 0;
  const failures = [];
  function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }

  const exp = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'capabilities-page.json'), 'utf8'));
  const html = fs.readFileSync(path.join(siteDir, 'capabilities.html'), 'utf8');
  const head = region(html, 'head');
  const main = region(html, 'main');

  // Exactly one <main>.
  check('capabilities: exactly one <main>', (html.match(/<main\b/g) || []).length === 1);

  // Region hashes + byte lengths (head, main, template).
  check('capabilities: <head> SHA-256 matches golden', head !== null && sha256(head) === exp.head_sha256);
  check('capabilities: <head> byte length matches golden', head !== null && Buffer.byteLength(head, 'utf8') === exp.head_bytes);
  check('capabilities: <main> SHA-256 matches golden', main !== null && sha256(main) === exp.main_sha256);
  check('capabilities: <main> byte length matches golden', main !== null && Buffer.byteLength(main, 'utf8') === exp.main_bytes);
  const template = fs.readFileSync(path.join(siteDir, 'engine', 'templates', 'capabilities.template.html'), 'utf8');
  check('capabilities: template SHA-256 matches golden', sha256(template) === exp.template_sha256);
  check('capabilities: template byte length matches golden', Buffer.byteLength(template, 'utf8') === exp.template_bytes);

  // Generated-region markers are present exactly once each (delimiters kept in
  // the approved output); the generator's inner placeholders are NOT left behind.
  exp.generated_region_markers.forEach(function (mk) {
    check('capabilities: region marker <!-- ' + mk + ' --> present exactly once',
      (html.split('<!-- ' + mk + ' -->').length - 1) === 1);
  });
  check('capabilities: inner CAPABILITIES_HEAD placeholder is filled (not left raw)',
    html.indexOf('<!-- CAPABILITIES_HEAD -->') === -1);
  check('capabilities: inner CAPABILITIES_CONTENT placeholder is filled (not left raw)',
    html.indexOf('<!-- CAPABILITIES_CONTENT -->') === -1);
  // B1 shell markers are composed away at build; they belong in source only.
  check('capabilities: carries B1 shell markers in source (composed at build)',
    /PLUMLINE:HEADER/.test(html) && /PLUMLINE:FOOTER/.test(html));

  // Section inventory + order, headings, ids, anchors.
  const sections = allMatch(/<section\b[^>]*id="([^"]+)"/g, main || '');
  check('capabilities: section count matches golden (' + exp.section_count + ')', sections.length === exp.section_count);
  check('capabilities: section order matches golden', eqArr(sections, exp.section_order));
  const headings = [];
  const hre = /<(h[1-4])\b([^>]*)>/g; let hm;
  while ((hm = hre.exec(main || '')) !== null) {
    const i18n = hm[2].match(/data-i18n="([^"]+)"/);
    headings.push(hm[1] + ':' + (i18n ? i18n[1] : '(no-i18n)'));
  }
  check('capabilities: heading order matches golden', eqArr(headings, exp.heading_order));
  const rawIds = allMatch(/\bid="([^"]+)"/g, html);
  check('capabilities: id set matches golden', eqArr(rawIds.slice().sort(), exp.ids));
  check('capabilities: no duplicate IDs', rawIds.length === new Set(rawIds).size);
  allMatch(/href="#([^"]+)"/g, html).forEach(function (a) {
    check('capabilities: anchor #' + a + ' resolves to an existing id', rawIds.indexOf(a) !== -1);
  });

  // data-i18n set, scripts, asset versions, canonical, OG/Twitter, JSON-LD.
  const keys = Array.from(new Set(allMatch(/data-i18n="([^"]+)"/g, html))).sort();
  check('capabilities: data-i18n key set matches golden', eqArr(keys, exp.data_i18n_keys));
  const scripts = Array.from(new Set(allMatch(/<script\b[^>]*src="([^"]+)"/g, html))).sort();
  check('capabilities: script src set matches golden', eqArr(scripts, exp.scripts));
  const versions = Array.from(new Set(allMatch(/(assets\/[a-z-]+\.(?:js|css)\?v=\d+)/g, html))).sort();
  check('capabilities: asset versions match golden', eqArr(versions, exp.asset_versions));
  const canon = (html.match(/rel="canonical"\s+href="([^"]+)"/) || [])[1];
  check('capabilities: canonical matches golden', canon === exp.canonical);
  check('capabilities: OG tag count matches golden', (html.match(/property="og:/g) || []).length === exp.og_count);
  check('capabilities: Twitter tag count matches golden', (html.match(/name="twitter:/g) || []).length === exp.twitter_count);
  const jsonld = (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/) || [])[0];
  check('capabilities: JSON-LD present', exp.jsonld_present ? !!jsonld : true);
  check('capabilities: JSON-LD matches golden', !exp.jsonld_present || (jsonld && sha256(jsonld) === exp.jsonld_sha256));

  // Images: full attribute set matches golden (src/alt/width/height/loading).
  const imgs = [];
  const ire = /<img\b([^>]*)>/g; let im;
  while ((im = ire.exec(main || '')) !== null) {
    const at = im[1];
    function a(n) { const mm = at.match(new RegExp(n + '="([^"]*)"')); return mm ? mm[1] : null; }
    imgs.push({ src: a('src'), alt: a('alt'), width: a('width'), height: a('height'),
      loading: a('loading'), data_i18n_alt: a('data-i18n-alt') });
  }
  check('capabilities: image count matches golden (' + exp.image_count + ')', imgs.length === exp.image_count);
  check('capabilities: every image src/alt/width/height/loading matches golden',
    imgs.length === exp.images.length && imgs.every(function (g, i) {
      const e = exp.images[i];
      return g.src === e.src && g.alt === e.alt && g.width === e.width &&
             g.height === e.height && g.loading === e.loading && g.data_i18n_alt === e.data_i18n_alt;
    }));

  // ---- Sync: HTML <-> product-capabilities.js inventory ----
  let caps = null;
  try {
    const capPath = path.join(siteDir, 'assets', 'product-capabilities.js');
    delete require.cache[require.resolve(capPath)];
    caps = require(capPath);
  } catch (e) { /* handled below */ }
  check('capabilities: product-capabilities.js loads', caps !== null && Array.isArray(caps.CAPABILITIES));
  function isShown(c) { return c.public === true && c.status === 'available' && c.exampleStatus !== 'pending'; }
  const shown = (caps ? caps.CAPABILITIES.filter(isShown) : []);
  const shownIds = shown.map(function (c) { return c.id; });
  check('capabilities: shown-capability count matches golden (' + exp.capabilities_shown.count + ')',
    shownIds.length === exp.capabilities_shown.count);
  check('capabilities: shown-capability ids match golden', eqArr(shownIds, exp.capabilities_shown.ids));
  check('capabilities: GROUP_ORDER matches golden',
    caps && eqArr(caps.GROUP_ORDER, exp.capabilities_shown.groupOrder));
  // Every shown capability's id appears as a cap-<id> node in the page exactly
  // once; no hidden/pending capability id leaks in as a cap-<id> node.
  const capNodeIds = allMatch(/id="cap-([a-z0-9-]+)"/g, main || '');
  shownIds.forEach(function (id) {
    check('sync: shown capability ' + id + ' appears once as cap-node',
      capNodeIds.filter(function (n) { return n === id; }).length === 1);
  });
  const hidden = (caps ? caps.CAPABILITIES.filter(function (c) { return !isShown(c); }) : []);
  hidden.forEach(function (c) {
    check('sync: hidden/pending capability ' + c.id + ' does NOT appear as a cap-node',
      capNodeIds.indexOf(c.id) === -1);
  });
  check('sync: no duplicate cap-node ids', capNodeIds.length === new Set(capNodeIds).size);

  // ---- Sync: HTML images <-> data/media.json ----
  let media = null;
  try {
    media = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'media.json'), 'utf8'));
  } catch (e) { /* handled below */ }
  check('capabilities: data/media.json loads', media !== null && media.slots);
  if (media && media.slots) {
    const slotFiles = Object.keys(media.slots).map(function (k) { return media.basePath + media.slots[k].file; });
    const pageSrcs = imgs.map(function (i) { return i.src; });
    // Every published image src corresponds to a media.json slot file.
    check('sync: every page image src is a media.json slot file',
      pageSrcs.every(function (s) { return slotFiles.indexOf(s) !== -1; }));
    // Every media slot's declared width/height matches the published <img>.
    Object.keys(media.slots).forEach(function (k) {
      const m = media.slots[k];
      const src = media.basePath + m.file;
      const pageImg = imgs.find(function (i) { return i.src === src; });
      check('sync: media slot ' + k + ' width/height matches the published image',
        !!pageImg && pageImg.width === String(m.width) && pageImg.height === String(m.height));
      // The referenced image file actually exists on disk.
      check('sync: media slot ' + k + ' file exists on disk', fs.existsSync(path.join(siteDir, src)));
    });
  }

  // ---- Lightbox ----
  check('capabilities: lightbox figure-link hooks match golden (' + exp.lightbox.figure_link_hooks + ')',
    (main || '').split('class="cap-figure-link"').length - 1 === exp.lightbox.figure_link_hooks);
  check('capabilities: lightbox open-aria hooks match golden',
    (main || '').split('data-i18n-aria="capOpenFullImage"').length - 1 === exp.lightbox.open_aria_hooks);
  check('capabilities: loads cap-lightbox.js at the golden version',
    scripts.indexOf(exp.lightbox.script) !== -1);

  // ---- Footer-specific (learnCapabilities) ----
  check('capabilities: carries the learnCapabilities footer marker (page-specific)',
    exp.footer_learn_capabilities ? /PLUMLINE:FOOTER learnCapabilities="true"/.test(html) : true);
  check('capabilities: body data-page matches golden', (html.match(/<body data-page="([^"]+)"/) || [])[1] === exp.body_data_page);

  // ---- Progressive enhancement + isolation ----
  check('pe: page has a <title>', /<title[^>]*>[^<]+<\/title>/.test(html));
  check('pe: <main> is non-empty static content', (main || '').length > 400);
  check('capabilities: does not fetch content', !/fetch\s*\(/.test(html));
  check('capabilities: does not build main via innerHTML', !/innerHTML/.test(html));
  check('capabilities: does not load the engine', !/ENGINE_START|solveModel_|detectModel_|branchAndBound|simplex/i.test(html));
  check('capabilities: does not create a Worker', !/new\s+Worker\s*\(/.test(html));
  check('capabilities: does not carry grid/results/charts/exports markup',
    !/id="grid"|class="[^"]*\b(gridwrap|receipt|plot|vs-row|exports)\b/.test(main || ''));
  check('capabilities: loads exactly one stylesheet', (html.match(/<link[^>]*rel="stylesheet"/g) || []).length === 1);
  check('capabilities: no capabilities source partial directory', !fs.existsSync(path.join(siteDir, 'src', 'pages', 'capabilities')));

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkCapabilitiesPage: checkCapabilitiesPage };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkCapabilitiesPage(siteDir);
  r.failures.forEach(function (f) { console.log('  FAIL:', f); });
  console.log('CAPABILITIES PAGE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
