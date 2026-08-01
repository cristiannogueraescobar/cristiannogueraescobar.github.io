/* tests_examples_page.js — Checkpoint C3 contracts for examples.html.
 *
 * Audit result: STATE B/D — correctly organized. There are two LEGITIMATE
 * representations, not eliminable duplication:
 *   - examples.html: the visible, accessible catalog (9 literal <a
 *     href="solver.html?ex=<slug>"> cards in <main>, present without JS).
 *   - assets/examples-data.js: the SINGLE SOURCE OF TRUTH for each example's
 *     slug, category, model type and objective direction (META[] + CATEGORY_ORDER
 *     + buildExampleSolverUrl). The solver's Examples drawer and examples.html
 *     both read it.
 * The full grids/domains/expected results live in solver.html's EXAMPLES object
 * and are already protected by tests_examples.js (each example solves to its
 * declared result). C3 does NOT duplicate that; it adds an HTML<->data slug/
 * category SYNC contract + region golden + isolation, and changes NO production.
 *
 * The slug appearing in BOTH the HTML link and examples-data.js is deliberate
 * progressive enhancement (the catalog must work without JS), NOT a defect.
 *
 * checkExamplesPage(siteDir) is the single official checker; the positive suite
 * and the negatives call it against a site tree and read { pass, fail, failures }.
 * Expected values come from engine/fixtures/pages-golden/examples-page.json
 * (captured from the pre-C3 source, NOT compositor-generated). Solver slug
 * compatibility is checked via examples-data.js's module.exports, never via the
 * full solver HTML.
 *
 * Static file reads + a require() of examples-data.js; no jsdom, no server.
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
function innerRegion(html, tag) {
  const m = html.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>'));
  return m ? m[1] : null;
}
function allMatch(re, s) { const out = []; let m; while ((m = re.exec(s)) !== null) out.push(m[1]); return out; }
function eqArr(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

function checkExamplesPage(siteDir) {
  let pass = 0, fail = 0;
  const failures = [];
  function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }

  const exp = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'examples-page.json'), 'utf8'));
  const html = fs.readFileSync(path.join(siteDir, 'examples.html'), 'utf8');
  const head = region(html, 'head');
  const main = region(html, 'main');

  // Exactly one <main>.
  check('examples: exactly one <main>', (html.match(/<main\b/g) || []).length === 1);

  // Region hashes + byte lengths (head, main).
  check('examples: <head> SHA-256 matches golden', head !== null && sha256(head) === exp.head_sha256);
  check('examples: <head> byte length matches golden', head !== null && Buffer.byteLength(head, 'utf8') === exp.head_bytes);
  check('examples: <main> SHA-256 matches golden', main !== null && sha256(main) === exp.main_sha256);
  check('examples: <main> byte length matches golden', main !== null && Buffer.byteLength(main, 'utf8') === exp.main_bytes);

  // Inline <style> matches the B3 golden (inner content). B3 owns the CSS; here
  // we only assert it has NOT drifted (SHA + bytes), we do not re-freeze it.
  const styleInner = innerRegion(html, 'style');
  check('examples: inline <style> SHA-256 matches golden (B3)', styleInner !== null && sha256(styleInner) === exp.style_sha256);
  check('examples: inline <style> byte length matches golden (B3)', styleInner !== null && Buffer.byteLength(styleInner, 'utf8') === exp.style_bytes);

  // JSON-LD present + unchanged.
  const jsonld = (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/) || [])[0];
  check('examples: JSON-LD present', exp.jsonld_present ? !!jsonld : true);
  check('examples: JSON-LD matches golden', !exp.jsonld_present || (jsonld && sha256(jsonld) === exp.jsonld_sha256));

  // Card catalog: order + count of solver links in <main>.
  const cardSlugs = allMatch(/href="solver\.html\?ex=([^"]+)"/g, main || '');
  check('examples: card count matches golden (' + exp.card_count + ')', cardSlugs.length === exp.card_count);
  check('examples: card slug order matches golden', eqArr(cardSlugs, exp.card_slugs_in_order));

  // No duplicate slugs in the HTML catalog.
  check('examples: no duplicate slugs in HTML', cardSlugs.length === new Set(cardSlugs).size);

  // Every solver link uses the approved format solver.html?ex=<slug>.
  const solverLinks = allMatch(/href="(solver\.html[^"]*)"/g, main || '');
  check('examples: every solver link uses the approved ?ex=<slug> format',
    solverLinks.every(function (l) { return /^solver\.html\?ex=[a-z-]+$/.test(l); }));

  // IDs (exact set, no duplicates).
  const rawIds = allMatch(/\bid="([^"]+)"/g, html);
  check('examples: id set matches golden', eqArr(rawIds.slice().sort(), exp.ids));
  check('examples: no duplicate IDs', rawIds.length === new Set(rawIds).size);

  // data-i18n set, scripts, asset versions, canonical, OG/Twitter.
  const keys = allMatch(/data-i18n="([^"]+)"/g, html).slice().sort();
  check('examples: data-i18n key set matches golden', eqArr(keys, exp.data_i18n_keys));
  const scripts = Array.from(new Set(allMatch(/<script\b[^>]*src="([^"]+)"/g, html))).sort();
  check('examples: script src set matches golden', eqArr(scripts, exp.scripts));
  const versions = Array.from(new Set(allMatch(/(assets\/[a-z-]+\.(?:js|css)\?v=\d+)/g, html))).sort();
  check('examples: asset versions match golden', eqArr(versions, exp.asset_versions));
  const canon = (html.match(/rel="canonical"\s+href="([^"]+)"/) || [])[1];
  check('examples: canonical matches golden', canon === exp.canonical);
  check('examples: OG tag count matches golden', (html.match(/property="og:/g) || []).length === exp.og_count);
  check('examples: Twitter tag count matches golden', (html.match(/name="twitter:/g) || []).length === exp.twitter_count);

  // ---- examples-data.js inventory + HTML<->data SYNC ----
  const dataPath = path.join(siteDir, 'assets', 'examples-data.js');
  const dataSrc = fs.readFileSync(dataPath, 'utf8');
  check('examples-data.js: file SHA-256 matches golden', sha256(dataSrc) === exp.examples_data.file_sha256);
  check('examples-data.js: file byte length matches golden', Buffer.byteLength(dataSrc, 'utf8') === exp.examples_data.file_bytes);

  // Load the module (its data, not the engine).
  let META = null, CATEGORY_ORDER = null, buildUrl = null;
  try {
    delete require.cache[require.resolve(dataPath)];
    const mod = require(dataPath);
    META = mod.META; CATEGORY_ORDER = mod.CATEGORY_ORDER; buildUrl = mod.buildExampleSolverUrl;
  } catch (e) { /* handled by the null checks below */ }
  check('examples-data.js: exports META/CATEGORY_ORDER/buildExampleSolverUrl',
    Array.isArray(META) && Array.isArray(CATEGORY_ORDER) && typeof buildUrl === 'function');

  const dataSlugs = (META || []).map(function (m) { return m.slug; });
  const dataCats = (META || []).map(function (m) { return m.category; });
  check('examples-data.js: slug list matches golden', eqArr(dataSlugs, exp.examples_data.slugs));
  check('examples-data.js: category list matches golden', eqArr(dataCats, exp.examples_data.categories));
  check('examples-data.js: CATEGORY_ORDER matches golden', eqArr(CATEGORY_ORDER || [], exp.examples_data.category_order));
  check('examples-data.js: example count matches golden (' + exp.examples_data.count + ')', dataSlugs.length === exp.examples_data.count);

  // No duplicate slugs in the data.
  check('examples-data.js: no duplicate slugs', dataSlugs.length === new Set(dataSlugs).size);

  // SYNC: every visible HTML slug exists exactly once in the data, and every data
  // slug is visible in the HTML (public examples appear in the catalog).
  check('sync: every HTML card slug exists exactly once in examples-data.js',
    cardSlugs.every(function (s) { return dataSlugs.filter(function (d) { return d === s; }).length === 1; }));
  check('sync: every examples-data.js slug appears in the HTML catalog',
    dataSlugs.every(function (s) { return cardSlugs.indexOf(s) !== -1; }));
  check('sync: HTML card order equals examples-data.js META order',
    eqArr(cardSlugs, dataSlugs));

  // SYNC: each visible example's category is a known CATEGORY_ORDER value (no
  // internal/pending category leaks into the catalog).
  check('sync: every data category is in CATEGORY_ORDER (no internal/pending leak)',
    dataCats.every(function (c) { return (CATEGORY_ORDER || []).indexOf(c) !== -1; }));

  // SYNC: the solver can resolve the same slugs — buildExampleSolverUrl(key)
  // yields exactly the approved solver.html?ex=<slug> link for each META entry.
  // Uses examples-data.js only, NOT the full solver HTML.
  check('sync: buildExampleSolverUrl yields the approved link for every example',
    (META || []).every(function (m) { return buildUrl && buildUrl(m.key) === 'solver.html?ex=' + m.slug; }));
  check('sync: buildExampleSolverUrl returns null for an unknown key',
    buildUrl ? buildUrl('nonexistent-key-xyz') === null : false);

  // ---- Progressive enhancement: catalog exists without JS ----
  check('pe: page has a <title>', /<title>[^<]+<\/title>/.test(html));
  check('pe: the 9 catalog cards are literal in <main> (not JS-built)', cardSlugs.length === exp.card_count);
  check('pe: <main> is non-empty static content', (main || '').length > 200);
  // The inline script may ENHANCE (renderCatalog into #exCatalog), but the static
  // cards must already be present; it must NOT fetch, and must guard its target.
  check('examples: does not fetch content', !/fetch\s*\(/.test(html));

  // ---- Isolation ----
  check('examples: does not load the engine', !/ENGINE_START|solveModel_|detectModel_|branchAndBound|simplex/i.test(html));
  check('examples: does not create a Worker', !/new\s+Worker\s*\(/.test(html));
  check('examples: does not carry grid/results/charts/exports markup',
    !/id="grid"|class="[^"]*\b(gridwrap|receipt|plot|vs-row|exports)\b/.test(main || ''));
  check('examples-data.js: contains data, not the engine',
    !/ENGINE_START|solveModel_|branchAndBound|simplex/i.test(dataSrc));

  // No examples source partial to be published.
  check('examples: no examples source partial directory', !fs.existsSync(path.join(siteDir, 'src', 'pages', 'examples')));

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkExamplesPage: checkExamplesPage };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkExamplesPage(siteDir);
  r.failures.forEach(function (f) { console.log('  FAIL:', f); });
  console.log('EXAMPLES PAGE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
