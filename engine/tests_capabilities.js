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

// The set of test modules that actually RUN in CI, read from run_all.js's
// `suites` array — so a capability cannot point at a file that exists on disk
// but is never executed.
const runAllSrc = fs.readFileSync(path.join(siteDir, 'engine', 'run_all.js'), 'utf8');
const suitesMatch = runAllSrc.match(/const suites\s*=\s*\[([\s\S]*?)\]/);
const RUN_SUITES = new Set(
  suitesMatch ? [...suitesMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : []
);
ok('capabilities: run_all.js suites array was parsed', RUN_SUITES.size > 0);

// Cache page HTML so we can check a docsAnchor actually exists as an id.
const pageCache = {};
function anchorExists(docsPath, anchor) {
  if (!docsPath || !anchor) return false;
  const p = path.join(siteDir, docsPath);
  if (!fs.existsSync(p)) return false;
  if (!(docsPath in pageCache)) pageCache[docsPath] = fs.readFileSync(p, 'utf8');
  return new RegExp('id="' + anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"').test(pageCache[docsPath]);
}

// Running coverage tallies for the explicit report at the end.
const coverage = { total: 0, tested: 0, withExample: 0, notApplicable: 0, documented: 0, translated: 0, publicCount: 0 };

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

  // testFile + testMarker must resolve to a real, marked file that RUNS in CI.
  const testPath = path.join(siteDir, 'engine', c.testFile || '');
  const testExists = c.testFile && fs.existsSync(testPath);
  ok('capability ' + tag + ': testFile exists (' + c.testFile + ')', testExists);
  let markerPresent = false;
  if (testExists) {
    const src = fs.readFileSync(testPath, 'utf8');
    markerPresent = typeof c.testMarker === 'string' && src.includes(c.testMarker);
    ok('capability ' + tag + ': testMarker present in ' + c.testFile, markerPresent, c.testMarker);
  }
  // The test file must be registered to run in CI (not just present on disk).
  const moduleName = (c.testFile || '').replace(/\.js$/, '');
  const runsInCI = RUN_SUITES.has(moduleName);
  ok('capability ' + tag + ': testFile runs in CI (registered in run_all.js)', runsInCI, moduleName);
  const fullyTested = testExists && markerPresent && runsInCI;

  // exampleId is real or explicitly null; if null, exampleNotApplicable is
  // optional but must be a non-empty string when present.
  const exampleOk = c.exampleId === null || exampleKeys.has(c.exampleId);
  ok('capability ' + tag + ': exampleId is a real example or null', exampleOk, String(c.exampleId));
  if (c.exampleId === null && 'exampleNotApplicable' in c) {
    ok('capability ' + tag + ': exampleNotApplicable is a non-empty reason',
       typeof c.exampleNotApplicable === 'string' && c.exampleNotApplicable.length > 0);
  }

  // Public strings exist in every language.
  let translatedAll = true;
  LANGS.forEach(function (lang) {
    const n = hasI18n(lang, c.nameKey), d = hasI18n(lang, c.descriptionKey);
    ok('capability ' + tag + ': nameKey in ' + lang, n, c.nameKey);
    ok('capability ' + tag + ': descriptionKey in ' + lang, d, c.descriptionKey);
    if (!n || !d) translatedAll = false;
  });

  // Documentation anchor must exist on its page.
  const documented = anchorExists(c.docsPath, c.docsAnchor);
  ok('capability ' + tag + ': docsAnchor exists on ' + c.docsPath,
     documented, (c.docsPath || '?') + '#' + (c.docsAnchor || '?'));

  // `public` is EXPLICIT and boolean — never derived.
  ok('capability ' + tag + ': public is an explicit boolean', typeof c.public === 'boolean',
     String(c.public));
  // When public, everything it implies must hold: available, tested, translated,
  // documented. The validator does not decide what is public; it enforces that
  // whatever IS public is fully backed up.
  if (c.public === true) {
    ok('capability ' + tag + ': public => status available', c.status === 'available', c.status);
    ok('capability ' + tag + ': public => fully tested (exists, marked, runs in CI)', fullyTested);
    ok('capability ' + tag + ': public => translated in all languages', translatedAll);
    ok('capability ' + tag + ': public => documented', documented);
  }

  // Coverage tallies.
  coverage.total++;
  if (fullyTested) coverage.tested++;
  if (c.exampleId !== null) coverage.withExample++;
  else if (c.exampleNotApplicable) coverage.notApplicable++;
  if (documented) coverage.documented++;
  if (translatedAll) coverage.translated++;
  if (c.public === true) coverage.publicCount++;
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

// ---- Explicit coverage report ------------------------------------------
// A clear tally, as the audit asked: X/N tested, with-example, documented,
// translated, public. Printed always (not just on failure) so CI logs show it.
const N = coverage.total;
console.log('  coverage: ' + coverage.tested + '/' + N + ' with an executed test');
console.log('  coverage: ' + coverage.withExample + '/' + N + ' with an example (' +
            coverage.notApplicable + ' marked not-applicable, ' +
            (N - coverage.withExample - coverage.notApplicable) + ' example pending)');
console.log('  coverage: ' + coverage.documented + '/' + N + ' with documentation');
console.log('  coverage: ' + coverage.translated + '/' + N + ' translated in all languages');
console.log('  coverage: ' + coverage.publicCount + '/' + N + ' marked public');
// Every capability must be fully tested, documented and translated regardless
// of public flag (those are correctness guarantees, not marketing choices).
ok('coverage: all capabilities have an executed test', coverage.tested === N,
   coverage.tested + '/' + N);
ok('coverage: all capabilities are documented', coverage.documented === N,
   coverage.documented + '/' + N);
ok('coverage: all capabilities are translated', coverage.translated === N,
   coverage.translated + '/' + N);

console.log('CAPABILITIES TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
process.exit(fail > 0 ? 1 : 0);
