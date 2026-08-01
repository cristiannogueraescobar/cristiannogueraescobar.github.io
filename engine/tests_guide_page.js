/* tests_guide_page.js — Checkpoint C2 contracts for guide.html.
 *
 * Audit result: STATE B. Guide's 12 sections are 10 unique skeletons + one
 * wrapper pattern repeated 3x; the only repeated lines are trivial wrappers
 * (~265 bytes of <div class="sec-head">/<section> in a 12 921-byte main).
 * Extracting them would need a second section compositor and would risk the 6
 * ids, 2 anchors, and 63 i18n keys, to remove 265 bytes — criteria 1/6/7 fail.
 * So C2 changes NO production: it protects Guide with contracts + golden + docs.
 *
 * checkGuidePage(siteDir) is the single official checker; the positive suite and
 * the negatives call it against a site tree and read { pass, fail, failures }.
 * Expected values come from engine/fixtures/pages-golden/guide-page.json
 * (captured from the pre-C2 source, NOT compositor-generated).
 *
 * Static file reads; no jsdom, no server. LF-only, no open handles.
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

function checkGuidePage(siteDir) {
  let pass = 0, fail = 0;
  const failures = [];
  function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }

  const exp = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'guide-page.json'), 'utf8'));
  const html = fs.readFileSync(path.join(siteDir, 'guide.html'), 'utf8');
  const head = region(html, 'head');
  const main = region(html, 'main');

  // Exactly one <main>.
  check('guide: exactly one <main>', (html.match(/<main\b/g) || []).length === 1);

  // Region hashes + byte lengths.
  check('guide: <head> SHA-256 matches golden', head !== null && sha256(head) === exp.head_sha256);
  check('guide: <head> byte length matches golden', head !== null && Buffer.byteLength(head, 'utf8') === exp.head_bytes);
  check('guide: <main> SHA-256 matches golden', main !== null && sha256(main) === exp.main_sha256);
  check('guide: <main> byte length matches golden', main !== null && Buffer.byteLength(main, 'utf8') === exp.main_bytes);

  // Section inventory + order.
  const sections = [];
  const sre = /<section\b([^>]*)>/g; let sm; let si = 0;
  while ((sm = sre.exec(main || '')) !== null) {
    const idm = sm[1].match(/id="([^"]+)"/);
    sections.push(idm ? idm[1] : 'section' + (++si === si ? sections.length + 1 : sections.length + 1));
    if (!idm) si = sections.length;
  }
  // Rebuild deterministically to match the fixture's "section<N>" fallback.
  const sections2 = [];
  let idx = 0; let sm2; const sre2 = /<section\b([^>]*)>/g;
  while ((sm2 = sre2.exec(main || '')) !== null) {
    idx++;
    const idm = sm2[1].match(/id="([^"]+)"/);
    sections2.push(idm ? idm[1] : 'section' + idx);
  }
  check('guide: section count matches golden (' + exp.section_count + ')', sections2.length === exp.section_count);
  check('guide: section order matches golden', eqArr(sections2, exp.section_order));

  // Heading order (tag:i18n-key-or-no-i18n).
  const headings = [];
  const hre = /<(h[1-3])\b([^>]*)>/g; let hm;
  while ((hm = hre.exec(main || '')) !== null) {
    const i18n = hm[2].match(/data-i18n="([^"]+)"/);
    headings.push(hm[1] + ':' + (i18n ? i18n[1] : '(no-i18n)'));
  }
  check('guide: heading order matches golden', eqArr(headings, exp.heading_order));

  // IDs (exact set, no duplicates), anchors resolve.
  const rawIds = allMatch(/\bid="([^"]+)"/g, html);
  check('guide: id set matches golden', eqArr(rawIds.slice().sort(), exp.ids));
  check('guide: no duplicate IDs', rawIds.length === new Set(rawIds).size);
  allMatch(/href="#([^"]+)"/g, html).forEach(function (a) {
    check('guide: anchor #' + a + ' resolves to an existing id', rawIds.indexOf(a) !== -1);
  });

  // Links, data-i18n set, scripts, asset versions, canonical.
  const links = Array.from(new Set(allMatch(/<a\b[^>]*href="([^"]+)"/g, html))).sort();
  check('guide: link set matches golden', eqArr(links, exp.links));
  const keys = allMatch(/data-i18n="([^"]+)"/g, html).slice().sort();
  check('guide: data-i18n key set matches golden', eqArr(keys, exp.data_i18n_keys));
  check('guide: data-i18n count matches golden (' + exp.data_i18n_count + ')', keys.length === exp.data_i18n_count);
  const scripts = Array.from(new Set(allMatch(/<script\b[^>]*src="([^"]+)"/g, html))).sort();
  check('guide: script src set matches golden', eqArr(scripts, exp.scripts));
  const versions = Array.from(new Set(allMatch(/(assets\/[a-z-]+\.(?:js|css)\?v=\d+)/g, html))).sort();
  check('guide: asset versions match golden', eqArr(versions, exp.asset_versions));
  const canon = (html.match(/rel="canonical"\s+href="([^"]+)"/) || [])[1];
  check('guide: canonical matches golden', canon === exp.canonical);

  // i18n namespace + no cross-namespace key. The exact key set (above) already
  // catches any foreign key; this adds a targeted guard against the OTHER pages'
  // unambiguous prefixes leaking in (guide legitimately uses explain*, so we do
  // NOT treat the ambiguous "ex" prefix as foreign here — examples' real keys are
  // exGrid/exCat/exCard, checked explicitly).
  const ns = (html.match(/init\('([^']+)'/) || [])[1];
  check('guide: i18n init namespace is "' + exp.namespace + '"', ns === exp.namespace);
  const foreignExact = ['pvTitle', 'tmTitle', 'aboutTitle', 'exGrid', 'exCat', 'exCard'];
  const foreignPrefix = ['pv', 'tm', 'about', 'cap', 'home'];
  check('guide: no foreign-namespace i18n key present',
    keys.every(function (k) {
      if (foreignExact.indexOf(k) !== -1) return false;
      return !foreignPrefix.some(function (p) { return k.indexOf(p) === 0; });
    }));

  // Status terminology preserved (the published state keys).
  check('guide: status terminology keys present',
    exp.status_terminology_keys.every(function (k) { return keys.indexOf(k) !== -1; }));

  // OG/Twitter counts preserved.
  check('guide: OG tag count matches golden', (html.match(/property="og:/g) || []).length === exp.og_count);
  check('guide: Twitter tag count matches golden', (html.match(/name="twitter:/g) || []).length === exp.twitter_count);

  // Isolation: no engine/Worker/grid/charts/exports; no CSS/HTML fetch; no
  // innerHTML; one stylesheet.
  check('guide: does not load the engine', !/ENGINE_START|solveModel_|detectModel_/.test(html));
  check('guide: does not create a Worker', !/new\s+Worker\s*\(/.test(html));
  check('guide: does not carry grid/results/charts markup', !/id="grid"|class="[^"]*\b(gridwrap|receipt|plot|vs-row|exports)\b/.test(html));
  check('guide: does not fetch content', !/fetch\s*\(/.test(html));
  check('guide: does not build main via innerHTML', !/innerHTML/.test(html));
  check('guide: loads exactly one stylesheet', (html.match(/<link[^>]*rel="stylesheet"/g) || []).length === 1);

  // No guide source partial exists to be published.
  check('guide: no guide source partial directory', !fs.existsSync(path.join(siteDir, 'src', 'pages', 'guide')));

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkGuidePage: checkGuidePage };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkGuidePage(siteDir);
  r.failures.forEach(function (f) { console.log('  FAIL:', f); });
  console.log('GUIDE PAGE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
