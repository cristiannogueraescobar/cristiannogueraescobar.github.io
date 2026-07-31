/* tests_i18n_coverage.js — two site-wide i18n guards:
 *   1. Coverage: every key referenced from HTML (data-i18n*) exists in all five
 *      languages, so no element can fall back to English at runtime.
 *   2. No orphans: every key DEFINED in the dictionary is actually referenced
 *      somewhere — statically (data-i18n, t('key'), t(LANG,'ns','key')),
 *      dynamically (t('prefix'+var) / tt('prefix'+var)), via the capabilities
 *      inventory (nameKey/descKey/...), or by a bare string literal used in a
 *      lookup map. This keeps the dictionary from accumulating dead keys.
 *
 * The orphan check mirrors every access pattern the codebase actually uses; when
 * a new dynamic pattern is introduced, extend collectUsed() rather than
 * whitelisting keys.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;
const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

const PAGES = ['index.html', 'solver.html', 'guide.html', 'capabilities.html',
               'examples.html', 'about.html', 'privacy.html', 'terms.html'];

// ---- 1. Coverage: HTML data-i18n keys exist in all five languages ----
function hasKey(lang, key) {
  return Object.keys(DICT[lang]).some(function (ns) { return key in DICT[lang][ns]; });
}
const htmlKeys = new Set();
PAGES.forEach(function (p) {
  const h = fs.readFileSync(path.join(siteDir, p), 'utf8');
  for (const m of h.matchAll(/data-i18n[a-z-]*="([^"]+)"/g)) htmlKeys.add(m[1]);
});
htmlKeys.forEach(function (key) {
  const absent = LANGS.filter(function (l) { return !hasKey(l, key); });
  ok('i18n coverage: "' + key + '" present in all five languages', absent.length === 0, absent.join(','));
});

// ---- 2. No orphan keys in the dictionary -----------------------------
// Gather every source file that can reference a key (pages, runtime JS, engine
// scripts, AND test files — a key a test asserts on is not an orphan).
const files = PAGES
  .concat(fs.readdirSync(path.join(siteDir, 'assets')).filter(f => f.endsWith('.js')).map(f => 'assets/' + f))
  .concat(fs.readdirSync(path.join(siteDir, 'engine')).filter(f => f.endsWith('.js')).map(f => 'engine/' + f));
const src = files.map(function (f) { return fs.readFileSync(path.join(siteDir, f), 'utf8'); }).join('\n');

// Every key defined in English (the canonical namespace set).
const definedByNs = {};
Object.keys(DICT.en).forEach(function (ns) {
  Object.keys(DICT.en[ns]).forEach(function (k) { definedByNs[k] = ns; });
});
const ALL_KEYS = new Set(Object.keys(definedByNs));

const used = new Set();
// a) any data-i18n* attribute
for (const m of src.matchAll(/data-i18n[a-z-]*="([^"]+)"/g)) used.add(m[1]);
// b) t('key') / tt('key')
for (const m of src.matchAll(/\btt?\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) used.add(m[1]);
// c) t(LANG,'ns','key') style
for (const m of src.matchAll(/\.t\([^,]+,\s*['"][a-z]+['"]\s*,\s*['"]([a-zA-Z0-9_]+)['"]/g)) used.add(m[1]);
// d) generator helper t('tag', key) — second arg is the key
for (const m of src.matchAll(/\bt\(\s*['"][a-z0-9]+['"]\s*,\s*['"]([a-zA-Z0-9_]+)['"]/g)) used.add(m[1]);
// e) any bare string literal that exactly equals a known key (lookup maps, returns,
//    showEngineTrouble('code'), {time_limit:'feasibleTimeLimit'}, etc.)
for (const m of src.matchAll(/['"]([a-zA-Z0-9_]+)['"]/g)) if (ALL_KEYS.has(m[1])) used.add(m[1]);
// e2) property access on a dict namespace: DICT.en.capabilities.capOpenExample
for (const m of src.matchAll(/\.([a-zA-Z0-9_]+)\b/g)) if (ALL_KEYS.has(m[1])) used.add(m[1]);
// f) capabilities inventory *Key references
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  Object.keys(o).forEach(function (k) {
    if (/Key$/.test(k) && typeof o[k] === 'string') used.add(o[k]);
    if (typeof o[k] === 'object') walk(o[k]);
  });
})(caps);
// g) dynamic prefixes: t('prefix'+ ...) / tt('prefix'+ ...)
const dynPrefixes = new Set();
for (const m of src.matchAll(/\btt?\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\+/g)) dynPrefixes.add(m[1]);

function isUsed(key) {
  if (used.has(key)) return true;
  for (const p of dynPrefixes) if (key.startsWith(p)) return true;
  return false;
}

const orphans = [...ALL_KEYS].filter(function (k) { return !isUsed(k); });
ok('i18n orphans: dictionary has no unused keys', orphans.length === 0,
   orphans.length ? orphans.slice(0, 20).join(', ') : '');

// The five languages define the same set of keys (no per-language drift).
const enKeys = new Set();
Object.keys(DICT.en).forEach(function (ns) { Object.keys(DICT.en[ns]).forEach(function (k) { enKeys.add(ns + '.' + k); }); });
LANGS.slice(1).forEach(function (lang) {
  const langKeys = new Set();
  Object.keys(DICT[lang]).forEach(function (ns) { Object.keys(DICT[lang][ns]).forEach(function (k) { langKeys.add(ns + '.' + k); }); });
  const missing = [...enKeys].filter(function (k) { return !langKeys.has(k); });
  const extra = [...langKeys].filter(function (k) { return !enKeys.has(k); });
  ok('i18n parity: ' + lang + ' has exactly the English key set', missing.length === 0 && extra.length === 0,
     'missing ' + missing.length + ', extra ' + extra.length);
});

console.log('I18N COVERAGE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
