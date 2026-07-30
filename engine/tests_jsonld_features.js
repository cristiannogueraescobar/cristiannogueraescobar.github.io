/* tests_jsonld_features.js — the SoftwareApplication featureList on both the
 * Home and the capabilities page is derived from the inventory (public
 * capability names), parses as JSON, and stays in sync.
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

// Expected featureList: public capability English names, inventory order.
const expected = caps.CAPABILITIES
  .filter(c => c.public === true && c.status === 'available' && c.exampleStatus !== 'pending')
  .map(c => EN[c.nameKey]);

// Extract the SoftwareApplication featureList from a page.
function featureListOf(file) {
  const html = fs.readFileSync(path.join(siteDir, file), 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const m of blocks) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch (e) { return { error: 'invalid JSON: ' + e.message }; }
    if (parsed && parsed['@type'] === 'SoftwareApplication' && Array.isArray(parsed.featureList)) {
      return { list: parsed.featureList };
    }
  }
  return { error: 'no SoftwareApplication featureList found' };
}

['index.html', 'capabilities.html'].forEach(function (file) {
  const r = featureListOf(file);
  ok(file + ': has a SoftwareApplication featureList', !r.error, r.error);
  if (r.list) {
    ok(file + ': featureList matches the inventory (order + content)',
       JSON.stringify(r.list) === JSON.stringify(expected),
       r.list.length + ' items vs ' + expected.length);
    // Terminology guard: the structured data must not carry stale wording.
    const joined = r.list.join(' | ');
    ok(file + ': featureList uses normalised terminology',
       !/re-check/i.test(joined) && !/yes\/no/i.test(joined), joined);
  }
});

// Both generators are up to date (featureList not hand-edited out of sync).
(function () {
  const { execFileSync } = require('child_process');
  try {
    execFileSync('node', [path.join(siteDir, 'engine', 'gen_jsonld.js'), '--check'], { stdio: 'pipe' });
    ok('jsonld: index.html featureList is up to date', true);
  } catch (e) {
    ok('jsonld: index.html featureList is up to date', false, 'run: node engine/gen_jsonld.js');
  }
})();

console.log('JSON-LD FEATURE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
