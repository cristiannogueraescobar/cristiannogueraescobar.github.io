/**
 * tests_capabilities.js — the product-capabilities.js inventory is the single
 * source of truth for Plumline's PUBLIC capabilities, and it must stay honest:
 * every capability has to point at a real demonstrating case and real public
 * strings, or the build fails. This turns the inventory from "a file that can
 * drift" into "a file that cannot claim something the codebase does not back
 * up".
 *
 * For each capability this asserts:
 *   - id is unique; group and status are from the allowed sets; langs == ALL_LANGS
 *   - testFile exists under engine/
 *   - testMarker is PRESENT in that file (a "CAPABILITY: <id>" anchor next to
 *     the block that exercises it) — so deleting the demonstrating block (and
 *     its marker) fails here
 *   - exampleId is a real key in examples-data.js, or null
 *   - nameKey and descriptionKey exist in ALL five languages under the
 *     `capabilities` table (no English-only fallback)
 *
 * Run: node engine/tests_capabilities.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
const { META } = require(path.join(siteDir, 'assets', 'examples-data.js'));

// Load the i18n dictionary the same way tests_i18n_pages.js does.
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
new Function('window', 'navigator', 'location', 'document', 'globalThis', i18nSrc)
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;

const LANGS = caps.ALL_LANGS;
const exampleKeys = new Set(META.map(m => m.key));

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// A capability's public strings live under DICT[lang].capabilities[key].
function hasI18n(lang, key) {
  const L = DICT[lang];
  return !!(L && L.capabilities && Object.prototype.hasOwnProperty.call(L.capabilities, key));
}

// ---- Shape of the file itself ------------------------------------------
ok('capabilities: file exports a non-empty array', Array.isArray(caps.CAPABILITIES) && caps.CAPABILITIES.length > 0);
ok('capabilities: GROUP_ORDER is a non-empty array', Array.isArray(caps.GROUP_ORDER) && caps.GROUP_ORDER.length > 0);
ok('capabilities: STATUSES includes available/experimental/planned',
   ['available', 'experimental', 'planned'].every(s => caps.STATUSES.includes(s)));
ok('capabilities: ALL_LANGS is the five supported languages',
   JSON.stringify(caps.ALL_LANGS) === JSON.stringify(['en', 'es', 'pt', 'de', 'fr']));

const GROUPS = new Set(caps.GROUP_ORDER);
const STATUSES = new Set(caps.STATUSES);

// ---- Per-capability integrity ------------------------------------------
const seenIds = new Set();
const seenNameKeys = new Set();
const seenDescKeys = new Set();

caps.CAPABILITIES.forEach(function (c) {
  const tag = c.id || '(no id)';

  ok('capability ' + tag + ': has a string id', typeof c.id === 'string' && c.id.length > 0);
  ok('capability ' + tag + ': id is unique', c.id && !seenIds.has(c.id), 'duplicate');
  if (c.id) seenIds.add(c.id);

  ok('capability ' + tag + ': group is known', GROUPS.has(c.group), c.group);
  ok('capability ' + tag + ': status is known', STATUSES.has(c.status), c.status);
  ok('capability ' + tag + ': langs == ALL_LANGS',
     JSON.stringify(c.langs) === JSON.stringify(LANGS), JSON.stringify(c.langs));

  // Distinct name/description keys.
  ok('capability ' + tag + ': has nameKey', typeof c.nameKey === 'string' && c.nameKey.length > 0);
  ok('capability ' + tag + ': has descriptionKey', typeof c.descriptionKey === 'string' && c.descriptionKey.length > 0);
  ok('capability ' + tag + ': nameKey != descriptionKey', c.nameKey !== c.descriptionKey);
  ok('capability ' + tag + ': nameKey is unique', c.nameKey && !seenNameKeys.has(c.nameKey), 'duplicate');
  ok('capability ' + tag + ': descriptionKey is unique', c.descriptionKey && !seenDescKeys.has(c.descriptionKey), 'duplicate');
  if (c.nameKey) seenNameKeys.add(c.nameKey);
  if (c.descriptionKey) seenDescKeys.add(c.descriptionKey);

  // testFile + testMarker must resolve to a real, marked file.
  const testPath = path.join(siteDir, 'engine', c.testFile || '');
  const testExists = c.testFile && fs.existsSync(testPath);
  ok('capability ' + tag + ': testFile exists (' + c.testFile + ')', testExists);
  if (testExists) {
    const src = fs.readFileSync(testPath, 'utf8');
    ok('capability ' + tag + ': testMarker present in ' + c.testFile,
       typeof c.testMarker === 'string' && src.includes(c.testMarker), c.testMarker);
  }

  // exampleId is real or explicitly null.
  ok('capability ' + tag + ': exampleId is a real example or null',
     c.exampleId === null || exampleKeys.has(c.exampleId), String(c.exampleId));

  // Public strings exist in every language.
  LANGS.forEach(function (lang) {
    ok('capability ' + tag + ': nameKey in ' + lang, hasI18n(lang, c.nameKey), c.nameKey);
    ok('capability ' + tag + ': descriptionKey in ' + lang, hasI18n(lang, c.descriptionKey), c.descriptionKey);
  });
});

// ---- Every group is represented (no empty buckets in the UI) -----------
caps.GROUP_ORDER.forEach(function (grp) {
  ok('group ' + grp + ' has at least one capability',
     caps.CAPABILITIES.some(c => c.group === grp));
});

// ---- The derived claims manifest must be up to date --------------------
// data/claims.json is generated from this inventory by engine/gen_claims.js.
// If the inventory changed without regenerating, the manifest is stale — catch
// it here so a public claim can never fall out of sync with its proof.
(function () {
  const { execFileSync } = require('child_process');
  try {
    execFileSync('node', [path.join(siteDir, 'engine', 'gen_claims.js'), '--check'], { stdio: 'pipe' });
    ok('claims: data/claims.json is up to date with the inventory', true);
  } catch (e) {
    ok('claims: data/claims.json is up to date with the inventory', false,
       'run: node engine/gen_claims.js');
  }
})();

console.log('CAPABILITIES TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
process.exit(fail > 0 ? 1 : 0);
