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
  // The internal `limits` field is descriptive copy about a capability's
  // boundaries. It is NOT currently rendered: the Home summary and both JSON-LD
  // featureLists use only `nameKey`, and the page bodies use nameKey/description
  // plus the separate limitationsKey. This guard keeps `limits` on the same
  // normalised terminology as the public copy so that when a future generator
  // (a Guide section, an expanded claims manifest, a docs export) does surface
  // it, it will not reintroduce "re-checked", "yes/no" or a vague range.
  if (typeof c.limits === 'string') {
    ok('capability ' + tag + ': limits uses "checked again", not "re-checked"',
       !/re-check/i.test(c.limits), c.limits);
    ok('capability ' + tag + ': limits avoids the "yes/no" shorthand',
       !/yes\/no/i.test(c.limits), c.limits);
    ok('capability ' + tag + ': limits avoids the vague "practical numeric range"',
       !/practical numeric range/i.test(c.limits), c.limits);
  }
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

// ---- Home summary selection is explicit and well-formed ----------------
// homeSummaryRank makes the Home summary a deliberate choice. Rules: it appears
// only on public/available/non-pending capabilities; within a group ranks are
// unique and at most four; each is an integer 1..4.
(function () {
  const featured = caps.CAPABILITIES.filter(c => c.homeSummaryRank !== undefined);
  featured.forEach(function (c) {
    const tag = c.id || '(no id)';
    ok('homeSummaryRank ' + tag + ': is an integer 1..4',
       Number.isInteger(c.homeSummaryRank) && c.homeSummaryRank >= 1 && c.homeSummaryRank <= 4,
       String(c.homeSummaryRank));
    ok('homeSummaryRank ' + tag + ': only on a public, available, non-pending capability',
       c.public === true && c.status === 'available' && c.exampleStatus !== 'pending');
  });
  caps.GROUP_ORDER.forEach(function (grp) {
    const inG = featured.filter(c => c.group === grp);
    ok('homeSummaryRank ' + grp + ': at most four featured', inG.length <= 4, inG.length + ' featured');
    const ranks = inG.map(c => c.homeSummaryRank);
    const uniq = new Set(ranks);
    ok('homeSummaryRank ' + grp + ': ranks are unique within the group',
       uniq.size === ranks.length, ranks.join(','));
  });
})();

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
// Public capabilities now each have their own section on capabilities.html
// (docsPath capabilities.html, anchor cap-<id>): they are documented
// individually, not just pointed at a generic guide section. Pending/internal
// capabilities keep a generic guide.html target until they get their own home.
(function () {
  const pub = caps.CAPABILITIES.filter(c =>
    c.public === true && c.status === 'available' && c.exampleStatus !== 'pending');
  const individually = pub.filter(c =>
    c.docsPath === 'capabilities.html' && c.docsAnchor === 'cap-' + c.id &&
    anchorExists(c.docsPath, c.docsAnchor));
  console.log('  coverage: ' + individually.length + '/' + pub.length +
              ' public capabilities documented individually on capabilities.html');
  const internal = caps.CAPABILITIES.length - pub.length;
  console.log('  coverage: ' + internal + ' internal/pending capabilities not yet published');
})();
// Whether all pending translations are cleared — only then may we say
// "translated", as opposed to "keys present".
const pendingPath = path.join(siteDir, 'data', 'pending-translations.json');
let pendingTotal = 0;
if (fs.existsSync(pendingPath)) {
  try {
    const pd = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    pendingTotal = ((pd.new_keys_placeholder_en) || []).length + ((pd.existing_keys_en_changed) || []).length;
  } catch (e) { pendingTotal = -1; }
}
const translatedWord = pendingTotal === 0
  ? coverage.translated + '/' + N + ' translated in all languages'
  : coverage.translated + '/' + N + ' with i18n keys present in all languages (' +
    pendingTotal + ' still awaiting real translation — see pending-translations.json)';
console.log('  coverage: ' + translatedWord);
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
// Every public capability must be documented on its OWN capabilities.html
// section (not a generic guide anchor) now that the page exists.
(function () {
  const pub = caps.CAPABILITIES.filter(c =>
    c.public === true && c.status === 'available' && c.exampleStatus !== 'pending');
  const notIndividual = pub.filter(c =>
    !(c.docsPath === 'capabilities.html' && c.docsAnchor === 'cap-' + c.id &&
      anchorExists(c.docsPath, c.docsAnchor)));
  ok('coverage: every public capability is documented individually on capabilities.html',
     notIndividual.length === 0, notIndividual.map(c => c.id).join(', '));
})();
ok('coverage: all capabilities have i18n keys present in every language', coverage.translated === N,
   coverage.translated + '/' + N);
// Every covered/not-applicable capability accounts for its example; pending
// ones are explicitly tracked, never silently public.
ok('coverage: covered + not-applicable + pending == total',
   coverage.covered + coverage.notApplicable + coverage.pending === N);

// ---- The generated capabilities.html page ------------------------------
// The page is generated from this inventory by engine/gen_capabilities.js.
// Assert it is up to date and that it faithfully shows exactly the public
// capabilities and nothing else — a public claim never silently drops off the
// page, and a non-public one never silently appears.
(function () {
  const { execFileSync } = require('child_process');
  try {
    execFileSync('node', [path.join(siteDir, 'engine', 'gen_capabilities.js'), '--check'], { stdio: 'pipe' });
    ok('capabilities.html: is up to date with the inventory', true);
  } catch (e) {
    ok('capabilities.html: is up to date with the inventory', false,
       'run: node engine/gen_capabilities.js');
  }

  const pagePath = path.join(siteDir, 'capabilities.html');
  if (!fs.existsSync(pagePath)) {
    ok('capabilities.html: exists', false);
    return;
  }
  const html = fs.readFileSync(pagePath, 'utf8');

  const shown = caps.CAPABILITIES.filter(c =>
    c.public === true && c.status === 'available' && c.exampleStatus !== 'pending');
  const hidden = caps.CAPABILITIES.filter(c => !shown.includes(c));

  // Each public capability appears exactly once, by its anchor id.
  shown.forEach(function (c) {
    const anchor = 'id="cap-' + c.id + '"';
    const n = (html.match(new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    ok('capabilities.html: public ' + c.id + ' appears exactly once', n === 1, 'found ' + n);
  });
  // No hidden (pending / non-public / non-available) capability appears at all.
  hidden.forEach(function (c) {
    ok('capabilities.html: hidden ' + c.id + ' does not appear',
       html.indexOf('cap-' + c.id + '"') === -1);
  });

  // No duplicate HTML ids anywhere on the page.
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dupe = ids.filter((v, i) => ids.indexOf(v) !== i);
  ok('capabilities.html: no duplicate HTML ids', dupe.length === 0, dupe.join(', '));

  // No-JavaScript mode: meaningful English text is present inline for every
  // shown capability. Most render with their own nameKey/descriptionKey; the
  // three spreadsheet capabilities render inside the step flow, so their
  // meaningful text comes from the step keys instead. The guarantee is the
  // same — the page says something real about the capability without JS — but
  // the source key differs by composition.
  const EN = DICT.en.capabilities;
  const STEP_TEXT = {
    'sheet-paste': ['capStepPaste', 'capStepPasteDesc'],
    'sheet-formula-limits': ['capStepAdjust', 'capStepAdjustDesc'],
    'sheet-export': ['capStepExport', 'capStepExportDesc']
  };
  shown.forEach(function (c) {
    // Anchor must be present regardless of composition.
    ok('capabilities.html: no-JS anchor for ' + c.id,
       html.indexOf('id="cap-' + c.id + '"') !== -1, c.id);
    if (STEP_TEXT[c.id]) {
      STEP_TEXT[c.id].forEach(function (k) {
        ok('capabilities.html: no-JS step text ' + k + ' for ' + c.id,
           html.indexOf(EN[k]) !== -1, k);
      });
    } else {
      ok('capabilities.html: no-JS name text for ' + c.id,
         html.indexOf(EN[c.nameKey]) !== -1, c.nameKey);
      ok('capabilities.html: no-JS description text for ' + c.id,
         html.indexOf(EN[c.descriptionKey]) !== -1, c.descriptionKey);
    }
  });

  // A solver example link is emitted only for capabilities with an
  // exampleCtaKey (the small set that link to the solver). Those must resolve to
  // a real, solver-recognised URL and appear on the page. Also: the CTA text is
  // unique (no two capabilities show the same link label) and there is no
  // generic repeated "Open this example" link.
  const { buildExampleSolverUrl } = require(path.join(siteDir, 'assets', 'examples-data.js'));
  const ctaCaps = shown.filter(c => c.exampleCtaKey);
  const seenCtaKeys = new Set();
  ctaCaps.forEach(function (c) {
    ok('capabilities.html: ' + c.id + ' has exampleStatus covered for its CTA',
       c.exampleStatus === 'covered', c.exampleStatus);
    ok('capabilities.html: ' + c.id + ' exampleCtaKey is unique',
       !seenCtaKeys.has(c.exampleCtaKey), c.exampleCtaKey);
    seenCtaKeys.add(c.exampleCtaKey);
    const url = buildExampleSolverUrl(c.exampleId);
    ok('capabilities.html: ' + c.id + ' example URL is well-formed',
       typeof url === 'string' && /^solver\.html\?ex=[a-z0-9-]+$/.test(url), String(url));
    ok('capabilities.html: ' + c.id + ' example link appears in the page',
       url && html.indexOf('href="' + url + '"') !== -1, String(url));
  });
  // Exactly five solver example links (decision B, option C).
  const solverLinks = (html.match(/href="solver\.html\?ex=/g) || []).length;
  ok('capabilities.html: exactly five solver example links', solverLinks === 5, 'found ' + solverLinks);
  // The generic "Open this example" label is not repeated across the page.
  const genericLabel = DICT.en.capabilities.capOpenExample;
  ok('capabilities.html: no repeated generic example label',
     (html.split(genericLabel).length - 1) <= 1);

  // Product imagery from data/media.json: every slot's file exists, is embedded,
  // and its alt text is present in all five languages.
  const media = require(path.join(siteDir, 'data', 'media.json'));
  Object.keys(media.slots).forEach(function (slot) {
    const m = media.slots[slot];
    const rel = media.basePath + m.file;
    ok('capabilities.html: media file exists for ' + slot,
       fs.existsSync(path.join(siteDir, rel)), rel);
    ok('capabilities.html: media image embedded for ' + slot,
       html.indexOf('src="' + rel + '"') !== -1, rel);
    LANGS.forEach(function (lang) {
      ok('capabilities.html: alt ' + m.altKey + ' present in ' + lang,
         DICT[lang].capabilities && Object.prototype.hasOwnProperty.call(DICT[lang].capabilities, m.altKey),
         m.altKey);
    });
  });
  // The hero image loads eagerly; the others lazily.
  ok('capabilities.html: hero image loads eagerly',
     new RegExp('src="' + media.basePath + media.slots['hero-model'].file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                '"[^>]*loading="eager"').test(html));

  // Illustrations, not screenshots: media.json marks these as illustrations, so
  // the page and its alt/caption text must NOT claim to be literal screenshots
  // of the solver. Guards against re-introducing "screenshot"/"captura" wording.
  if (media.kind === 'illustration') {
    const banned = /\b(screenshot|screen capture|captura de pantalla|captura real)\b/i;
    ok('capabilities.html: illustrations are not labelled as screenshots',
       !banned.test(html), 'found screenshot wording on an illustration page');
    Object.keys(media.slots).forEach(function (slot) {
      const m = media.slots[slot];
      const alt = DICT.en.capabilities[m.altKey] || '';
      ok('capabilities.html: alt for ' + slot + ' does not claim to be a screenshot',
         !banned.test(alt), alt);
    });
  }

  // SEO head is generated from the page copy and must match i18n exactly, so a
  // no-JS crawler never gets stale metadata.
  const EN2 = DICT.en.capabilities;
  ok('capabilities.html: <title> equals capPageTitle',
     html.indexOf('<title data-i18n="capPageTitle">' + EN2.capPageTitle + '</title>') !== -1);
  ok('capabilities.html: meta description equals capPageMetaDesc',
     html.indexOf('content="' + EN2.capPageMetaDesc.replace(/"/g, '&quot;') + '"') !== -1);
  ok('capabilities.html: og:title matches title',
     html.indexOf('property="og:title" content="' + EN2.capPageTitle + '"') !== -1);
  ok('capabilities.html: og:description matches description',
     html.indexOf('property="og:description" content="' + EN2.capPageMetaDesc + '"') !== -1);
  ok('capabilities.html: twitter:title matches title',
     html.indexOf('name="twitter:title" content="' + EN2.capPageTitle + '"') !== -1);
  ok('capabilities.html: twitter:description matches description',
     html.indexOf('name="twitter:description" content="' + EN2.capPageMetaDesc + '"') !== -1);
  ok('capabilities.html: canonical is correct',
     html.indexOf('rel="canonical" href="https://plumline.online/capabilities.html"') !== -1);
  // The page uses the shared width container.
  ok('capabilities.html: main uses the shared .plumb width container',
     /<main class="plumb">/.test(html));

  // Terminology: we normalised on "checked again", never "re-checked". Guard
  // against it creeping back into the page (alt/caption included).
  ok('capabilities.html: uses "checked again", not "re-checked"',
     !/re-check/i.test(html), 'found "re-check" wording');

  // Exactly one <main> and one <h1>.
  ok('capabilities.html: exactly one <main>', (html.match(/<main[\s>]/g) || []).length === 1);
  ok('capabilities.html: exactly one <h1', (html.match(/<h1[\s>]/g) || []).length === 1);
  // Generated-file notice is present.
  ok('capabilities.html: carries a generated-file notice',
     /GENERATED PAGE/.test(html));
})();

// ---- Production guard: no pending translations before public deploy ----
// Development builds tolerate data/pending-translations.json carrying keys still
// awaiting es/pt/de/fr. A public build must NOT: set PLUMLINE_PUBLIC_BUILD=1 (or
// run under CI with that flag) and this fails while any key remains pending.
(function () {
  const p = path.join(siteDir, 'data', 'pending-translations.json');
  if (!fs.existsSync(p)) { ok('translations: pending file absent is fine', true); return; }
  let doc; try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { doc = null; }
  const pendingCount =
    ((doc && doc.new_keys_placeholder_en) || []).length +
    ((doc && doc.existing_keys_en_changed) || []).length;
  const isPublicBuild = process.env.PLUMLINE_PUBLIC_BUILD === '1';
  if (isPublicBuild) {
    ok('translations: no pending translations in a public build',
       pendingCount === 0, pendingCount + ' keys still pending — translate before public deploy');
  } else {
    // Dev build: just report, do not fail.
    console.log('  translations: ' + pendingCount + ' keys pending (dev build tolerates; ' +
                'public build with PLUMLINE_PUBLIC_BUILD=1 will fail until translated)');
    ok('translations: pending count is tracked', typeof pendingCount === 'number');
  }
})();

console.log('CAPABILITIES TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
process.exit(fail > 0 ? 1 : 0);
