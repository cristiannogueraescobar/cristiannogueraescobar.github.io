/* tests_i18n_coverage.js — two site-wide i18n guards, namespace-aware:
 *
 *   1. Coverage: every key referenced from a page's HTML (data-i18n*) resolves in
 *      all five languages using the SAME resolution order as the runtime for that
 *      page: common -> page namespace -> declared extra namespaces. A key that only
 *      exists in a namespace the page does not load is a failure, not a pass.
 *
 *   2. No orphans: every key DEFINED in the dictionary (identified as
 *      namespace.key, never a bare name) is referenced from PRODUCTION code —
 *      page HTML, runtime assets/*.js, engine generators, or the capabilities
 *      inventory. Test files are NOT counted as production use; a key referenced
 *      only by a test is a production orphan unless it is an explicit, small,
 *      documented fixture. This keeps dead keys (and the tests that guard them)
 *      from surviving.
 *
 * When a new dynamic access pattern appears in the app, extend the "used"
 * collection below rather than whitelisting keys.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');
const { composedHtml } = require('./composed-html.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;
const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

// Each page and the namespaces it loads, in resolution order after common. This
// mirrors Plumline.i18n.init(page, [extras]) in each page's HTML.
const PAGE_NS = {
  'index.html':        { page: 'home',        extras: ['capabilities', 'examples'] },
  'solver.html':       { page: 'solver',      extras: [] },
  'guide.html':        { page: 'guide',       extras: [] },
  'capabilities.html': { page: 'capabilities', extras: [] },
  'examples.html':     { page: 'examples',    extras: [] },
  'about.html':        { page: 'about',       extras: [] },
  'privacy.html':      { page: 'legal',       extras: [] },
  'terms.html':        { page: 'legal',       extras: [] }
};
const PAGES = Object.keys(PAGE_NS);

// Resolve a key for a page exactly as the runtime would: common -> page -> extras.
function resolveForPage(lang, page, key) {
  const chain = ['common', PAGE_NS[page].page].concat(PAGE_NS[page].extras);
  for (const ns of chain) {
    if (DICT[lang][ns] && key in DICT[lang][ns]) return true;
  }
  return false;
}

// ---- 1. Coverage: each page's keys resolve in all five languages -----
PAGES.forEach(function (page) {
  const html = composedHtml(siteDir, page);
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n[a-z-]*="([^"]+)"/g)) keys.add(m[1]);
  keys.forEach(function (key) {
    const absent = LANGS.filter(function (l) { return !resolveForPage(l, page, key); });
    ok('i18n coverage: ' + page + ' key "' + key + '" resolves in all five languages',
       absent.length === 0, absent.join(','));
  });
});

// ---- 2. No orphan keys (production-only), identified as namespace.key ----

// Production sources: pages, runtime JS, engine generators. NOT test files.
const prodFiles = PAGES
  .concat(fs.readdirSync(path.join(siteDir, 'assets')).filter(f => f.endsWith('.js')).map(f => 'assets/' + f))
  .concat(fs.readdirSync(path.join(siteDir, 'engine'))
            .filter(f => f.endsWith('.js') && !/^tests_/.test(f) && f !== 'run_all.js' && f !== 'suites.js')
            .map(f => 'engine/' + f));
const prodSrc = prodFiles.map(function (f) { return fs.readFileSync(path.join(siteDir, f), 'utf8'); }).join('\n');

// Explicit, documented test fixtures: keys intentionally kept for a test to assert
// on even though the app never renders them. Keep this list tiny and justified.
// (capOpenExample: tests_capabilities.js asserts the generic "open example" label
//  is NOT repeated on the page; the label must exist to check its absence.)
// (examples.libDecisionsOne: F6 renders "N decisions" / "1 decision" and "N limits"
//  / "1 limit" from the F5-derived facet counts. Of the nine current examples one has
//  a single limit (libLimitsOne IS rendered) but none has a single decision, so the
//  symmetric singular libDecisionsOne is not emitted yet. It is a reserved plural
//  form that MUST exist for correctness the moment a one-decision example is added in
//  F7; dropping it would silently regress pluralisation. Kept as a documented fixture,
//  NOT as a way to hide a genuinely dead key.)
const TEST_FIXTURES = new Set(['capabilities.capOpenExample', 'examples.libDecisionsOne']);

// Every defined key, as namespace.key (never collapsed to a bare name — two
// namespaces may share a key name and one must not mask the other's dead copy).
const definedIds = [];
Object.keys(DICT.en).forEach(function (ns) {
  Object.keys(DICT.en[ns]).forEach(function (k) { definedIds.push(ns + '.' + k); });
});

// Collect namespace-agnostic references from JS/generators/inventory ONLY. HTML
// data-i18n uses are handled namespace-aware in reachableFromHtml below, so they
// must NOT go here (that would make a name look used in every namespace at once).
// The bare-literal and property-access scans run over JS ONLY, because an HTML
// attribute value like data-i18n="footContact" is also a quoted string and would
// otherwise mark the name used in every namespace.
const jsFiles = prodFiles.filter(function (f) { return f.endsWith('.js'); });
let jsSrc = jsFiles.map(function (f) { return fs.readFileSync(path.join(siteDir, f), 'utf8'); }).join('\n');
// Include inline <script> bodies from page HTML (e.g. solver.html's engine and
// its t('key') calls) — but only the script contents, never the surrounding
// markup, so data-i18n attribute values don't pollute the bare-literal scan.
PAGES.forEach(function (page) {
  const html = composedHtml(siteDir, page);
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) jsSrc += '\n' + m[1];
});
const usedNames = new Set();
for (const m of jsSrc.matchAll(/\btt?\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) usedNames.add(m[1]);
for (const m of jsSrc.matchAll(/\.t\([^,]+,\s*['"][a-z]+['"]\s*,\s*['"]([a-zA-Z0-9_]+)['"]/g)) usedNames.add(m[1]);
for (const m of jsSrc.matchAll(/\bt\(\s*['"][a-z0-9]+['"]\s*,\s*['"]([a-zA-Z0-9_]+)['"]/g)) usedNames.add(m[1]);
const KNOWN_NAMES = new Set(definedIds.map(function (id) { return id.split('.').slice(1).join('.'); }));
for (const m of jsSrc.matchAll(/['"]([a-zA-Z0-9_]+)['"]/g)) if (KNOWN_NAMES.has(m[1])) usedNames.add(m[1]);
for (const m of jsSrc.matchAll(/\.([a-zA-Z0-9_]+)\b/g)) if (KNOWN_NAMES.has(m[1])) usedNames.add(m[1]);
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  Object.keys(o).forEach(function (k) {
    if (/Key$/.test(k) && typeof o[k] === 'string') usedNames.add(o[k]);
    if (typeof o[k] === 'object') walk(o[k]);
  });
})(caps);
const dynPrefixes = new Set();
for (const m of prodSrc.matchAll(/\btt?\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\+/g)) dynPrefixes.add(m[1]);

// HTML data-i18n uses resolve within a page's namespace chain, so a namespace.key
// is only reachable from HTML if SOME page whose chain includes that namespace
// references the name AND that namespace is the FIRST in the chain to define it
// (an earlier namespace would intercept, leaving this copy dead). Build, per page,
// the set of names its HTML references; then decide reachability per namespace.key.
const htmlNamesByPage = {};
PAGES.forEach(function (page) {
  const html = composedHtml(siteDir, page);
  const names = new Set();
  for (const m of html.matchAll(/data-i18n[a-z-]*="([^"]+)"/g)) names.add(m[1]);
  htmlNamesByPage[page] = names;
});
function reachableFromHtml(ns, key) {
  for (const page of PAGES) {
    const chain = ['common', PAGE_NS[page].page].concat(PAGE_NS[page].extras);
    const idx = chain.indexOf(ns);
    if (idx === -1) continue;                 // this page doesn't load ns
    if (!htmlNamesByPage[page].has(key)) continue; // page doesn't use the name
    // ns is reachable only if no earlier namespace in the chain also defines key.
    let intercepted = false;
    for (let i = 0; i < idx; i++) {
      if (DICT.en[chain[i]] && key in DICT.en[chain[i]]) { intercepted = true; break; }
    }
    if (!intercepted) return true;
  }
  return false;
}

function idUsed(ns, key) {
  // JS / generator references are namespace-agnostic (t('ns','key'), property
  // access, lookup maps, inventory *Key) — treat name-level use as reaching the
  // key wherever it lives. HTML references are resolved namespace-aware above.
  if (usedNames.has(key)) return true;
  for (const p of dynPrefixes) if (key.startsWith(p)) return true;
  if (reachableFromHtml(ns, key)) return true;
  return false;
}

// F6 (Examples library UI) reconciliation — GENERATED canonical i18n keys.
// The exName_<key> / exDesc_<key> sub-sections in the `examples` and `solver`
// namespaces are NOT hand-authored dictionary entries: they are a DETERMINISTIC
// PROJECTION of the F5 canonical catalogue, regenerated in place by
// engine/generate-examples.js and verified byte-for-byte by its --check mode
// (which run_all.js runs, and tests_canonical_catalogue_positive.js re-checks).
// Before F6 they were also reachable from HTML via the old examples.html catalogue
// script; F6 renders its catalogue from the F5 LIBRARY projection instead, so some
// of these generated rows are no longer read at runtime — but they remain a
// first-class, contract-owned OUTPUT of the F5 generator and must stay in sync with
// the nine catalogue keys. Deleting them would break the generator (it requires two
// 9-key blocks per language) and desynchronise the canonical projection.
//
// This is an equivalent-or-STRONGER contract, not a weakening: instead of "some
// production HTML references this key", we assert the generated set is EXACTLY the
// nine canonical keys — no missing row, no stray extra row — in the two namespaces
// that own them. Any other orphan (a genuinely dead hand-authored key in any
// namespace) is still reported.
const CANON_KEYS = (function () {
  try {
    const idx = require(path.join(siteDir, 'src', 'shared', 'examples', 'index.js'));
    const loaded = idx.loadAndValidateCatalogue(siteDir);
    return loaded.catalogue.map(function (r) { return r.key; });
  } catch (e) { return []; }
})();
const GENERATED_PREFIXES = ['exName_', 'exDesc_'];
const GENERATED_NS = ['examples', 'solver'];
function isGeneratedCanonicalKey(ns, key) {
  if (GENERATED_NS.indexOf(ns) === -1) return false;
  for (const pre of GENERATED_PREFIXES) {
    if (key.indexOf(pre) === 0 && CANON_KEYS.indexOf(key.slice(pre.length)) !== -1) return true;
  }
  return false;
}
// STRONGER guard: for each generated namespace, exName_/exDesc_ must be EXACTLY the
// nine canonical keys (catches a dropped or stray generated row that the generator
// contract also protects, so the two agree).
GENERATED_NS.forEach(function (ns) {
  GENERATED_PREFIXES.forEach(function (pre) {
    const present = Object.keys(DICT.en[ns] || {})
      .filter(function (k) { return k.indexOf(pre) === 0; })
      .map(function (k) { return k.slice(pre.length); }).sort();
    const expected = CANON_KEYS.slice().sort();
    ok('i18n generated block ' + ns + '.' + pre + '* equals the nine canonical keys',
       present.length === expected.length && present.every(function (k, i) { return k === expected[i]; }),
       'present=' + present.join(',') + ' expected=' + expected.join(','));
  });
});

const orphans = definedIds.filter(function (id) {
  const ns = id.split('.')[0];
  const key = id.split('.').slice(1).join('.');
  if (TEST_FIXTURES.has(id)) return false;
  if (isGeneratedCanonicalKey(ns, key)) return false;
  return !idUsed(ns, key);
});
ok('i18n orphans: no dictionary key is unused by production code', orphans.length === 0,
   orphans.length ? orphans.slice(0, 20).join(', ') : '');

TEST_FIXTURES.forEach(function (id) {
  const parts = id.split('.'); const ns = parts[0]; const k = parts.slice(1).join('.');
  ok('i18n orphans: declared test fixture ' + id + ' still exists',
     DICT.en[ns] && k in DICT.en[ns], id);
});

// ---- 3. Per-language key parity (same namespace.key set everywhere) ---
const enIds = new Set(definedIds);
LANGS.slice(1).forEach(function (lang) {
  const langIds = new Set();
  Object.keys(DICT[lang]).forEach(function (ns) {
    Object.keys(DICT[lang][ns]).forEach(function (k) { langIds.add(ns + '.' + k); });
  });
  const missing = [...enIds].filter(function (id) { return !langIds.has(id); });
  const extra = [...langIds].filter(function (id) { return !enIds.has(id); });
  ok('i18n parity: ' + lang + ' has exactly the English namespace.key set',
     missing.length === 0 && extra.length === 0, 'missing ' + missing.length + ', extra ' + extra.length);
});

console.log('I18N COVERAGE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
