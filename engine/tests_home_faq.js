/* tests_home_faq.js — the Home FAQ accordion and the FAQPage JSON-LD are BOTH
 * generated from data/home-faq.json, so they must always agree: same questions,
 * same answers, same order. This catches any drift (the exact failure the Lote D
 * generator was built to prevent) and confirms the generator output is current.
 */
const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const html = composedHtml(siteDir, 'index.html');
const faq = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home-faq.json'), 'utf8'));
const ORDER = faq.order;

// English dictionary (the canonical source both regions render from).
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;
const EN = DICT.en.home;

// 1. Every FAQ key pair exists in all five languages (so the visible accordion
//    translates fully).
ORDER.forEach(function (item) {
  ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
    ok('home faq: ' + item.q + ' present in ' + lang, typeof DICT[lang].home[item.q] === 'string' && DICT[lang].home[item.q].length > 0, item.q);
    ok('home faq: ' + item.a + ' present in ' + lang, typeof DICT[lang].home[item.a] === 'string' && DICT[lang].home[item.a].length > 0, item.a);
  });
});

// 2. Parse the FAQPage JSON-LD from the generated region.
const ldM = html.match(/<!-- HOME_FAQ_JSONLD_START -->\s*<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
ok('home faq: FAQPage JSON-LD block present', !!ldM);
let ld = null;
if (ldM) { try { ld = JSON.parse(ldM[1]); } catch (e) { ok('home faq: JSON-LD parses', false, e.message); } }
if (ld) {
  ok('home faq: JSON-LD is a FAQPage', ld['@type'] === 'FAQPage');
  ok('home faq: JSON-LD has the right number of questions',
     Array.isArray(ld.mainEntity) && ld.mainEntity.length === ORDER.length,
     (ld.mainEntity ? ld.mainEntity.length : 'none') + ' vs ' + ORDER.length);

  // 3. JSON-LD questions/answers match the dictionary in the source order.
  ORDER.forEach(function (item, i) {
    const entry = ld.mainEntity[i];
    if (!entry) { ok('home faq: JSON-LD has entry ' + i, false); return; }
    ok('home faq: JSON-LD question ' + i + ' matches dict', entry.name === EN[item.q], entry.name);
    ok('home faq: JSON-LD answer ' + i + ' matches dict',
       entry.acceptedAnswer && entry.acceptedAnswer.text === EN[item.a], item.a);
  });
}

// 4. The visible accordion lists exactly the same questions in the same order.
const accM = html.match(/<!-- HOME_FAQ_START -->([\s\S]*?)<!-- HOME_FAQ_END -->/);
ok('home faq: accordion region present', !!accM);
if (accM) {
  const summaryKeys = [...accM[1].matchAll(/<summary data-i18n="([^"]+)"/g)].map(m => m[1]);
  ok('home faq: accordion has the right number of questions',
     summaryKeys.length === ORDER.length, summaryKeys.length + ' vs ' + ORDER.length);
  ORDER.forEach(function (item, i) {
    ok('home faq: accordion question ' + i + ' is ' + item.q, summaryKeys[i] === item.q, summaryKeys[i]);
  });
  // Visible answers match the dictionary (inline English == source).
  const answerKeys = [...accM[1].matchAll(/<p data-i18n="([^"]+)">([\s\S]*?)<\/p>/g)];
  answerKeys.forEach(function (m) {
    const key = m[1], inline = m[2];
    ok('home faq: inline answer ' + key + ' matches dict',
       inline === EN[key].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), key);
  });
}

// 5. The FAQ generator output is current (no uncommitted drift).
// execFileSync + argv array (NOT a concatenated shell string) so a repo path with
// spaces (e.g. "C:\...\UNIVERSIDAD CRISTIAN\...") works on Windows. This mirrors
// the Checkpoint A fix; do not regress it back to execSync('node ' + path).
const { execFileSync } = require('child_process');
try {
  execFileSync(process.execPath,
               [path.join(siteDir, 'engine', 'gen_home_faq.js'), '--check'],
               { cwd: siteDir, stdio: 'pipe' });
  ok('home faq: generator output is up to date', true);
} catch (e) {
  ok('home faq: generator output is up to date', false, 'run gen_home_faq.js');
}

console.log('HOME FAQ TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
