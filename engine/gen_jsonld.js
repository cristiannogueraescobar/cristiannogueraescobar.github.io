/* gen_jsonld.js — keep the Home page's SoftwareApplication featureList in sync
 * with the inventory, using the SAME subset the Home summary shows.
 *
 * Two rules matter here:
 *  1. The Home featureList must list exactly the capabilities VISIBLE in the
 *     Home summary (featuredOnHome — those with homeSummaryRank), not all 16
 *     public ones. Google requires structured data to reflect visible content;
 *     capabilities.html lists all 16 because it shows all 16.
 *  2. The replacement targets ONLY the Plumline SoftwareApplication block,
 *     located by explicit HTML markers, so a future JSON-LD entity on the page
 *     can never be clobbered by a loose regex.
 *
 * Run: node engine/gen_jsonld.js         (rewrites the Home SoftwareApplication block)
 *      node engine/gen_jsonld.js --check  (exit non-zero if stale)
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));

const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const EN = g.Plumline.i18n.dict.en.capabilities;

const START = '<!-- HOME_SOFTWARE_JSONLD_START -->';
const END = '<!-- HOME_SOFTWARE_JSONLD_END -->';

// The Home featureList: names of the capabilities the Home summary shows, in the
// same order they render.
function homeFeatureList() {
  return caps.featuredOnHome().map(function (c) {
    if (!Object.prototype.hasOwnProperty.call(EN, c.nameKey)) {
      throw new Error('gen_jsonld: missing English name key: ' + c.nameKey);
    }
    return EN[c.nameKey];
  });
}

// The canonical Plumline SoftwareApplication object for the Home page.
function softwareBlock() {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://plumline.online/#software',
    name: 'Plumline',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://plumline.online/',
    description: 'A free online optimisation solver for continuous, integer, binary and mixed-integer models. It finds the best way to split limited resources and verifies the result against your own numbers. Build a model in a spreadsheet-style grid or paste one from Excel or Google Sheets.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    inLanguage: caps.ALL_LANGS,
    featureList: homeFeatureList()
  };
  return START + '\n<script type="application/ld+json">\n' +
         JSON.stringify(obj) + '\n</script>\n' + END;
}

function rewrite(html) {
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if (s === -1 || e === -1 || e < s) {
    throw new Error('gen_jsonld: index.html is missing the HOME_SOFTWARE_JSONLD markers');
  }
  return html.slice(0, s) + softwareBlock() + html.slice(e + END.length);
}

const idxPath = path.join(siteDir, 'index.html');
const current = fs.readFileSync(idxPath, 'utf8');
const updated = rewrite(current);

if (process.argv.includes('--check')) {
  if (current !== updated) {
    console.error('index.html SoftwareApplication JSON-LD is out of date — run: node engine/gen_jsonld.js');
    process.exit(1);
  }
  console.log('index.html SoftwareApplication JSON-LD is up to date with the inventory');
} else {
  fs.writeFileSync(idxPath, updated);
  console.log('synced Home SoftwareApplication featureList (' + homeFeatureList().length + ' features)');
}
