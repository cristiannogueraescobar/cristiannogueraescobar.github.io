/* check_asset_versions.js — the single, official checker for the shared-asset
 * cache-busting query versions. Both tests_assets.js (positive) and
 * tests_shared_behavior_negative.js (negative) call this SAME function, so the
 * validation is defined once. Returns { pass, fail, failures }.
 *
 * B2 modifies assets/i18n.js, assets/nav-menu.js, assets/build-badge.js, so the
 * eight pages (and the capabilities template) must request the NEW versions or a
 * cache could serve pre-B2 assets after deploy. The expected versions are:
 *   i18n.js?v=82, nav-menu.js?v=6, build-badge.js?v=2
 * and NO reference to the old i18n.js?v=81, nav-menu.js?v=5, build-badge.js?v=1
 * may remain.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
// asset base name -> { expected new version, forbidden old version }.
// F6 (Examples library UI) modified assets/i18n.js: it ADDED the 40 Examples-library
// keys (lib*, mt_*, diff_*, goal_*) and removed dead legacy-catalogue keys. Only
// examples.html consumes the added keys, so ONLY examples.html re-references the asset
// at the new ?v=83; every other page keeps ?v=82 and stays byte-identical (a page that
// does not read the new keys must not be forced to re-download, and re-versioning it
// would change a protected non-F6 hash). i18n.js therefore has a per-page expected
// version; nav-menu.js / build-badge.js remain uniform across all pages.
const ASSETS = {
  'i18n.js': { neu: 82, old: 81, perPage: { examples: 83 } },
  'nav-menu.js': { neu: 6, old: 5 },
  'build-badge.js': { neu: 2, old: 1 }
};
// Expected "new" version for a given page + asset (honours per-page overrides).
function expectedNew(name, page) {
  const spec = ASSETS[name];
  if (spec.perPage && Object.prototype.hasOwnProperty.call(spec.perPage, page)) return spec.perPage[page];
  return spec.neu;
}

// Count occurrences of a specific `assets/<name>?v=<n>` reference in a string.
function countRef(html, name, version) {
  const re = new RegExp('assets/' + name.replace('.', '\\.') + '\\?v=' + version + '\\b', 'g');
  return (html.match(re) || []).length;
}

// Run the version validation over a site tree. Checks the eight pages and the
// capabilities template. Returns { pass, fail, failures }.
function checkAssetVersions(siteDir) {
  let pass = 0, fail = 0;
  const failures = [];
  function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }

  function readPage(p) { return fs.readFileSync(path.join(siteDir, p + '.html'), 'utf8'); }

  // 1-5. Each page references its expected version exactly once, and never the old one.
  PAGES.forEach(function (p) {
    const html = readPage(p);
    Object.keys(ASSETS).forEach(function (name) {
      const spec = ASSETS[name];
      const wantNew = expectedNew(name, p);
      const newCount = countRef(html, name, wantNew);
      const oldCount = countRef(html, name, spec.old);
      check(p + '.html references ' + name + '?v=' + wantNew + ' exactly once', newCount === 1);
      check(p + '.html has no reference to ' + name + '?v=' + spec.old + ' (old version)', oldCount === 0);
    });
  });

  // 6-7. capabilities template uses the new versions; capabilities.html matches it.
  const templatePath = path.join(siteDir, 'engine', 'templates', 'capabilities.template.html');
  if (fs.existsSync(templatePath)) {
    const tpl = fs.readFileSync(templatePath, 'utf8');
    Object.keys(ASSETS).forEach(function (name) {
      const spec = ASSETS[name];
      check('capabilities.template.html references ' + name + '?v=' + spec.neu, countRef(tpl, name, spec.neu) === 1);
      check('capabilities.template.html has no ' + name + '?v=' + spec.old, countRef(tpl, name, spec.old) === 0);
    });
    // capabilities.html and its template agree on every shared-asset version.
    const cap = readPage('capabilities');
    Object.keys(ASSETS).forEach(function (name) {
      const spec = ASSETS[name];
      check('capabilities.html and template agree on ' + name + '?v=' + spec.neu,
        countRef(cap, name, spec.neu) === 1 && countRef(tpl, name, spec.neu) === 1);
    });
  }

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkAssetVersions: checkAssetVersions, PAGES: PAGES, ASSETS: ASSETS };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const result = checkAssetVersions(siteDir);
  result.failures.forEach(function (f) { console.log('  FAIL:', f); });
  console.log('ASSET VERSION CHECK  PASSED: ' + result.pass + '   FAILED: ' + result.fail);
  process.exit(result.fail ? 1 : 0);
}
