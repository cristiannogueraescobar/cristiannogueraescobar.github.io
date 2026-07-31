/* gen_home_faq.js — generate BOTH the visible Home FAQ accordion and the FAQPage
 * JSON-LD from a single ordered source (data/home-faq.json), so the two can never
 * drift. Each entry names an i18n key pair in the 'home' namespace; the English
 * dictionary is the inline/canonical source.
 *
 * WHY: the Home FAQ and its FAQPage JSON-LD were hand-maintained separately and
 * had already drifted (the structured data still carried old wording and an old
 * question order). This makes the ordered key list the one source for both.
 *
 * Injects into index.html between:
 *   <!-- HOME_FAQ_START -->        ... visible <details> accordion (data-i18n)
 *   <!-- HOME_FAQ_JSONLD_START --> ... FAQPage JSON-LD (English canonical)
 *
 * Run: node engine/gen_home_faq.js         (writes index.html)
 *      node engine/gen_home_faq.js --check  (exit non-zero if stale)
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');

// English dictionary as the inline/canonical source.
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const EN = g.Plumline.i18n.dict.en.home;

const faq = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home-faq.json'), 'utf8'));
const ORDER = faq.order;

function en(key) {
  if (!Object.prototype.hasOwnProperty.call(EN, key)) {
    throw new Error('gen_home_faq: missing English i18n key: ' + key);
  }
  return EN[key];
}
function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Visible accordion -------------------------------------------------
function buildAccordion() {
  const L = [];
  ORDER.forEach(function (item, i) {
    const openAttr = i === 0 ? ' open' : '';
    L.push('      <details' + openAttr + '><summary data-i18n="' + item.q + '">' +
           escText(en(item.q)) + '</summary><p data-i18n="' + item.a + '">' +
           escText(en(item.a)) + '</p></details>');
  });
  return L.join('\n');
}

// --- FAQPage JSON-LD (English canonical) -------------------------------
function buildJsonLd() {
  const mainEntity = ORDER.map(function (item) {
    return {
      '@type': 'Question',
      name: en(item.q),
      acceptedAnswer: { '@type': 'Answer', text: en(item.a) }
    };
  });
  const obj = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: mainEntity };
  return '<script type="application/ld+json">\n' + JSON.stringify(obj) + '\n</scr' + 'ipt>';
}

// --- Inject both regions ----------------------------------------------
function replaceRegion(html, startMark, endMark, inner) {
  const s = html.indexOf(startMark);
  const e = html.indexOf(endMark);
  if (s === -1 || e === -1 || e < s) {
    throw new Error('gen_home_faq: index.html is missing markers ' + startMark + ' / ' + endMark);
  }
  return html.slice(0, s + startMark.length) + '\n' + inner + '\n      ' + html.slice(e);
}

function buildPage() {
  const idxPath = path.join(siteDir, 'index.html');
  let html = fs.readFileSync(idxPath, 'utf8');
  html = replaceRegion(html, '<!-- HOME_FAQ_START -->', '<!-- HOME_FAQ_END -->', buildAccordion());
  // JSON-LD region uses no leading indent on the closing marker line.
  const s = html.indexOf('<!-- HOME_FAQ_JSONLD_START -->');
  const e = html.indexOf('<!-- HOME_FAQ_JSONLD_END -->');
  if (s === -1 || e === -1 || e < s) {
    throw new Error('gen_home_faq: index.html is missing the HOME_FAQ_JSONLD markers');
  }
  html = html.slice(0, s + '<!-- HOME_FAQ_JSONLD_START -->'.length) + '\n' +
         buildJsonLd() + '\n' + html.slice(e);
  return html;
}

const outPath = path.join(siteDir, 'index.html');
const page = buildPage();

if (process.argv.includes('--check')) {
  const current = fs.readFileSync(outPath, 'utf8');
  if (current !== page) {
    console.error('index.html Home FAQ is out of date — run: node engine/gen_home_faq.js');
    process.exit(1);
  }
  console.log('index.html Home FAQ is up to date (accordion and JSON-LD in sync)');
} else {
  fs.writeFileSync(outPath, page);
  console.log('wrote Home FAQ accordion and FAQPage JSON-LD into index.html');
}
