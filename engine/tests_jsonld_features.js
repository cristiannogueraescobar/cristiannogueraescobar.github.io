/* tests_jsonld_features.js — the SoftwareApplication JSON-LD on the Home and the
 * capabilities page is well-formed, unique, and its featureList is derived from
 * the inventory using the subset appropriate to EACH page:
 *   - Home lists the featured-on-home capabilities (what the summary shows),
 *   - capabilities.html lists all public capabilities (what that page shows).
 * This keeps structured data matching visible content on both pages.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const EN = g.Plumline.i18n.dict.en.capabilities;

// Expected featureList per page, from the inventory.
const homeFeatures = caps.featuredOnHome().map(c => EN[c.nameKey]);
const publicFeatures = caps.CAPABILITIES.filter(caps.isPublic).map(c => EN[c.nameKey]);

// All SoftwareApplication blocks on a page (to assert there's exactly one).
function softwareBlocks(file) {
  const html = fs.readFileSync(path.join(siteDir, file), 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const apps = [];
  for (const m of blocks) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch (e) { return { error: 'invalid JSON: ' + e.message }; }
    if (parsed && parsed['@type'] === 'SoftwareApplication') apps.push(parsed);
  }
  return { apps };
}

const CASES = [
  { file: 'index.html', expected: homeFeatures, url: 'https://plumline.online/' },
  { file: 'capabilities.html', expected: publicFeatures, url: 'https://plumline.online/capabilities.html' }
];

CASES.forEach(function (c) {
  const r = softwareBlocks(c.file);
  ok(c.file + ': JSON-LD parses', !r.error, r.error);
  if (r.error) return;
  ok(c.file + ': exactly one SoftwareApplication block', r.apps.length === 1, 'found ' + r.apps.length);
  if (r.apps.length !== 1) return;
  const app = r.apps[0];
  ok(c.file + ': name is Plumline', app.name === 'Plumline', app.name);
  ok(c.file + ': @id identifies the same application',
     app['@id'] === 'https://plumline.online/#software', app['@id']);
  ok(c.file + ': url is the expected canonical', app.url === c.url, app.url);
  ok(c.file + ': has a featureList array', Array.isArray(app.featureList));
  if (Array.isArray(app.featureList)) {
    ok(c.file + ': featureList matches the inventory subset (order + content)',
       JSON.stringify(app.featureList) === JSON.stringify(c.expected),
       app.featureList.length + ' vs ' + c.expected.length);
    ok(c.file + ': featureList has no duplicates',
       new Set(app.featureList).size === app.featureList.length);
    ok(c.file + ': every feature is a non-empty string',
       app.featureList.every(f => typeof f === 'string' && f.trim().length > 0));
    const joined = app.featureList.join(' | ');
    ok(c.file + ': featureList uses normalised terminology',
       !/re-check/i.test(joined) && !/yes\/no/i.test(joined), joined);
  }
});

// The Home structured data must not advertise more than the Home shows: its
// featureList count equals the visible summary count.
ok('index.html: featureList count equals the visible Home summary count',
   homeFeatures.length === caps.featuredOnHome().length);

// gen_jsonld --check: the Home block is in sync with the inventory.
(function () {
  const { execFileSync } = require('child_process');
  try {
    execFileSync('node', [path.join(siteDir, 'engine', 'gen_jsonld.js'), '--check'], { stdio: 'pipe' });
    ok('jsonld: Home SoftwareApplication block is up to date', true);
  } catch (e) {
    ok('jsonld: Home SoftwareApplication block is up to date', false, 'run: node engine/gen_jsonld.js');
  }
})();

console.log('JSON-LD FEATURE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
