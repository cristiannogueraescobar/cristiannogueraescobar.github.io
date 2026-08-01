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
// asset base name -> { expected new version, forbidden old version }
const ASSETS = {
  'i18n.js': { neu: 82, old: 81 },
  'nav-menu.js': { neu: 6, old: 5 },
  'build-badge.js': { neu: 2, old: 1 }
};

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

  // 1-5. Each page references exactly the new version once, and never the old one.
  PAGES.forEach(function (p) {
    const html = readPage(p);
    Object.keys(ASSETS).forEach(function (name) {
      const spec = ASSETS[name];
      const newCount = countRef(html, name, spec.neu);
      const oldCount = countRef(html, name, spec.old);
      check(p + '.html references ' + name + '?v=' + spec.neu + ' exactly once', newCount === 1);
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
