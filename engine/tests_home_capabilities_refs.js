/* Checkpoint F1 GATE F — Home + capabilities example-reference guard.
 *
 * Ownership decision (documented in docs/checkpoint-f1-*.md):
 *   - Home (index.html) keeps ONLY a selection/order/placement of example keys via
 *     slug URLs, plus its own use-case copy (uc* i18n keys). It does NOT store
 *     example titles, descriptions or model metadata; the uc* copy is Home's own,
 *     distinct from the canonical exName_/exDesc_. Every solver.html?ex=<slug> in
 *     Home must resolve to a catalogue slug.
 *   - Capabilities: assets/product-capabilities.js is the SINGLE owner of the
 *     capability<->example relationship, referencing examples by `exampleId` (a
 *     catalogue key). It stores no example metadata and no full example URLs; every
 *     exampleId must be a catalogue key.
 *
 * This guard fails on an unknown Home slug or an unknown capability exampleId, and
 * on Home accidentally re-storing a canonical example title/description.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

function checkHomeAndCapabilities(dir) {
  const { catalogue } = loadAndValidateCatalogue(dir);
  const validSlugs = catalogue.map(r => r.slug);
  const validKeys = catalogue.map(r => r.key);
  const home = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const pc = fs.readFileSync(path.join(dir, 'assets', 'product-capabilities.js'), 'utf8');
  const problems = [];

  // Home slugs must all be catalogue slugs.
  const homeSlugs = [...home.matchAll(/solver\.html\?ex=([a-z-]+)/g)].map(m => m[1]);
  [...new Set(homeSlugs)].forEach(s => { if (validSlugs.indexOf(s) === -1) problems.push('home-unknown-slug:' + s); });

  // Home must not re-store canonical example titles/descriptions.
  catalogue.forEach(rec => {
    const t = rec.translations.en;
    if (home.indexOf('exName_' + rec.key) !== -1) problems.push('home-restores-title-key:' + rec.key);
    if (home.indexOf('exDesc_' + rec.key) !== -1) problems.push('home-restores-desc-key:' + rec.key);
  });

  // Capability exampleIds must all be catalogue keys.
  const ids = [...pc.matchAll(/exampleId:\s*'([a-z]+)'/g)].map(m => m[1]);
  [...new Set(ids)].forEach(k => { if (validKeys.indexOf(k) === -1) problems.push('capability-unknown-exampleId:' + k); });

  // Capabilities must not store full example URLs.
  catalogue.forEach(rec => { if (pc.indexOf('solver.html?ex=' + rec.slug) !== -1) problems.push('capability-stores-full-url:' + rec.slug); });

  return { ok: problems.length === 0, problems: problems };
}

if (require.main === module) {
// Positive.
(function () {
  const r = checkHomeAndCapabilities(SITE);
  ok('Home slugs + capability exampleIds all resolve to the catalogue', r.ok, r.problems.join('; '));
})();

// Negatives (in-memory: mutate copies of the two files against the live catalogue).
const os = require('os');
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-homecap-'));
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'shared', 'examples'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), fs.readFileSync(path.join(SITE, 'index.html')));
  fs.writeFileSync(path.join(dir, 'assets', 'product-capabilities.js'), fs.readFileSync(path.join(SITE, 'assets', 'product-capabilities.js')));
  for (const f of ['catalogue.js', 'schema.js', 'serialize.js', 'index.js']) {
    fs.writeFileSync(path.join(dir, 'src', 'shared', 'examples', f), fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', f)));
  }
  return dir;
}
const homePath = dir => path.join(dir, 'index.html');
const pcPath = dir => path.join(dir, 'assets', 'product-capabilities.js');
const rd = p => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);
function expectTrip(label, mutate) {
  const dir = makeTree();
  try {
    ok(label + ': clean copy passes', checkHomeAndCapabilities(dir).ok);
    mutate(dir);
    ok(label + ': mutation trips the guard', !checkHomeAndCapabilities(dir).ok);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. Home references an unknown slug.
expectTrip('N1 home unknown slug', dir => wr(homePath(dir), rd(homePath(dir)).replace('solver.html?ex=production-plan', 'solver.html?ex=nonexistent-slug')));
// 2. Home re-stores a canonical example title key.
expectTrip('N2 home restores example title key', dir => wr(homePath(dir), rd(homePath(dir)).replace('data-i18n="heroCtaExample"', 'data-i18n="exName_production"')));
// 3. Capability references an unknown exampleId.
expectTrip('N3 capability unknown exampleId', dir => wr(pcPath(dir), rd(pcPath(dir)).replace(/exampleId:\s*'production'/, "exampleId: 'ghostexample'")));
// 4. Capability stores a full example URL.
expectTrip('N4 capability stores full url', dir => wr(pcPath(dir), rd(pcPath(dir)).replace(/(\* CI, every exampleId is real or null)/, "* url: 'solver.html?ex=production-plan'\n$1")));

console.log('HOME + CAPABILITIES EXAMPLE REFERENCE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}

module.exports = { checkHomeAndCapabilities: checkHomeAndCapabilities };
