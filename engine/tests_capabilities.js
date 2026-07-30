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

// The set of test modules that actually RUN in CI, imported from the shared
// suites module (not parsed from run_all.js text) — so a capability cannot
// point at a file that exists on disk but is never executed.
const RUN_SUITES = new Set(require(path.join(siteDir, 'engine', 'suites.js')));
ok('capabilities: shared suites list is non-empty', RUN_SUITES.size > 0);

// Cache page HTML so we can check a docsAnchor exists as an EXACT id (not a
// substring or partial match). Matches id="x" and id='x'.
const pageCache = {};
function anchorExists(docsPath, anchor) {
  if (!docsPath || !anchor) return false;
  const p = path.join(siteDir, docsPath);
  if (!fs.existsSync(p)) return false;
  if (!(docsPath in pageCache)) pageCache[docsPath] = fs.readFileSync(p, 'utf8');
  const esc = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Exact id value: id="anchor" or id='anchor' with the full attribute value.
  return new RegExp('id=("' + esc + '"|\'' + esc + '\')').test(pageCache[docsPath]);
}

// Count exact occurrences of a marker in a source string.
function countOccurrences(src, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = src.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

// Running coverage tallies for the explicit report at the end.
const coverage = {
  total: 0, tested: 0, covered: 0, notApplicable: 0, pending: 0,
  docTargetValid: 0, translated: 0, publicCount: 0
};
const seenMarkers = new Set();

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
    // Hardening: the marker must appear EXACTLY once (not just at least once).
    const occ = countOccurrences(src, c.testMarker);
    markerPresent = typeof c.testMarker === 'string' && occ === 1;
    ok('capability ' + tag + ': testMarker appears exactly once in ' + c.testFile,
       markerPresent, c.testMarker + ' (found ' + occ + ')');
  }
  // Hardening: every testMarker is globally unique across capabilities.
  ok('capability ' + tag + ': testMarker is globally unique',
     c.testMarker && !seenMarkers.has(c.testMarker), 'duplicate marker');
  if (c.testMarker) seenMarkers.add(c.testMarker);

  // The test file must be registered to run in CI (not just present on disk).
  const moduleName = (c.testFile || '').replace(/\.js$/, '');
  const runsInCI = RUN_SUITES.has(moduleName);
  ok('capability ' + tag + ': testFile runs in CI (in shared suites list)', runsInCI, moduleName);
  const fullyTested = testExists && markerPresent && runsInCI;

  // exampleStatus drives the example rules.
  const st = c.exampleStatus;
  ok('capability ' + tag + ': exampleStatus is covered/not-applicable/pending',
     ['covered', 'not-applicable', 'pending'].includes(st), String(st));
  if (st === 'covered') {
    ok('capability ' + tag + ': covered => real exampleId',
       exampleKeys.has(c.exampleId), String(c.exampleId));
    // Hardening: exampleNotApplicable is forbidden when there is an example.
    ok('capability ' + tag + ': covered => no exampleNotApplicable',
       !('exampleNotApplicable' in c));
  } else if (st === 'not-applicable') {
    ok('capability ' + tag + ': not-applicable => no exampleId', c.exampleId === null, String(c.exampleId));
    ok('capability ' + tag + ': not-applicable => a non-empty reason',
       typeof c.exampleNotApplicable === 'string' && c.exampleNotApplicable.length > 0);
  } else if (st === 'pending') {
    ok('capability ' + tag + ': pending => no exampleId yet', c.exampleId === null, String(c.exampleId));
    // A pending capability has no public demonstration, so it must not be public.
    ok('capability ' + tag + ': pending => not public', c.public !== true, String(c.public));
  }
  // Hardening (belt and braces): exampleNotApplicable never coexists with an id.
  ok('capability ' + tag + ': exampleNotApplicable forbidden alongside exampleId',
     !('exampleNotApplicable' in c) || c.exampleId === null);

  // Public strings exist in every language.
  let translatedAll = true;
  LANGS.forEach(function (lang) {
    const n = hasI18n(lang, c.nameKey), d = hasI18n(lang, c.descriptionKey);
    ok('capability ' + tag + ': nameKey in ' + lang, n, c.nameKey);
    ok('capability ' + tag + ': descriptionKey in ' + lang, d, c.descriptionKey);
    if (!n || !d) translatedAll = false;
  });

  // Documentation TARGET must be a valid, existing anchor. Note: this proves the
  // link is not broken — NOT that the section genuinely documents the capability.
  // Reported below as "valid documentation target", not "documented".
  const docTargetValid = anchorExists(c.docsPath, c.docsAnchor);
  ok('capability ' + tag + ': docsAnchor is a real id on ' + c.docsPath,
     docTargetValid, (c.docsPath || '?') + '#' + (c.docsAnchor || '?'));

  // `public` is EXPLICIT and boolean — never derived.
  ok('capability ' + tag + ': public is an explicit boolean', typeof c.public === 'boolean',
     String(c.public));
  // When public, everything it implies must hold. The validator does not decide
  // what is public; it enforces that whatever IS public is fully backed up:
  // available, fully tested, translated, a valid docs target, and a real example
  // (covered) or a justified not-applicable — never pending.
  if (c.public === true) {
    ok('capability ' + tag + ': public => status available', c.status === 'available', c.status);
    ok('capability ' + tag + ': public => fully tested (exists, marked once, runs in CI)', fullyTested);
    ok('capability ' + tag + ': public => translated in all languages', translatedAll);
    ok('capability ' + tag + ': public => valid documentation target', docTargetValid);
    ok('capability ' + tag + ': public => example covered or not-applicable (not pending)',
       st === 'covered' || st === 'not-applicable', String(st));
  }

  // Coverage tallies.
  coverage.total++;
  if (fullyTested) coverage.tested++;
  if (st === 'covered') coverage.covered++;
  else if (st === 'not-applicable') coverage.notApplicable++;
  else if (st === 'pending') coverage.pending++;
  if (docTargetValid) coverage.docTargetValid++;
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
// A clear tally, as the audit asked. Note the deliberate wording: "valid
// documentation target" (the link resolves to a real anchor) is NOT the same as
// "documented" (the section genuinely explains the capability). We can only
// claim the former until the dedicated capabilities.html page exists.
const N = coverage.total;
console.log('  coverage: ' + coverage.tested + '/' + N + ' with an executed test');
console.log('  coverage: examples — ' + coverage.covered + ' covered, ' +
            coverage.notApplicable + ' not-applicable, ' + coverage.pending + ' pending');
console.log('  coverage: ' + coverage.docTargetValid + '/' + N + ' with a valid documentation target');
console.log('  coverage: ' + coverage.translated + '/' + N + ' translated in all languages');
console.log('  coverage: ' + coverage.publicCount + '/' + N + ' marked public (pending are excluded)');
// Every capability must be fully tested and translated, and have a valid docs
// target, regardless of the public flag (those are correctness guarantees, not
// marketing choices). Example coverage is NOT required for every capability
// (infrastructure ones are legitimately not-applicable, and pending ones are
// simply not public yet).
ok('coverage: all capabilities have an executed test', coverage.tested === N,
   coverage.tested + '/' + N);
ok('coverage: all capabilities have a valid documentation target', coverage.docTargetValid === N,
   coverage.docTargetValid + '/' + N);
ok('coverage: all capabilities are translated', coverage.translated === N,
   coverage.translated + '/' + N);
// Every covered/not-applicable capability accounts for its example; pending
// ones are explicitly tracked, never silently public.
ok('coverage: covered + not-applicable + pending == total',
   coverage.covered + coverage.notApplicable + coverage.pending === N);

console.log('CAPABILITIES TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
process.exit(fail > 0 ? 1 : 0);
