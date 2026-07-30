/* gen_jsonld.js — keep the Home page's SoftwareApplication featureList in sync
 * with the product-capabilities inventory.
 *
 * The Home JSON-LD used to carry a hand-written featureList that duplicated the
 * inventory and could drift from it. This generator regenerates the featureList
 * array in index.html from the public capabilities (English names, inventory
 * order), so the structured data search engines read always matches the
 * capabilities the site documents. capabilities.html gets the same list from
 * gen_capabilities.js (buildHead), so both pages share one source of truth.
 *
 * Run: node engine/gen_jsonld.js         (rewrites the featureList in index.html)
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

function featureList() {
  return caps.CAPABILITIES
    .filter(c => c.public === true && c.status === 'available' && c.exampleStatus !== 'pending')
    .map(c => {
      if (!Object.prototype.hasOwnProperty.call(EN, c.nameKey)) {
        throw new Error('gen_jsonld: missing English name key: ' + c.nameKey);
      }
      return EN[c.nameKey];
    });
}

function rewrite(html) {
  // Replace the JSON array that follows "featureList": in the Home JSON-LD.
  // The block is minified onto one line, so match the array non-greedily.
  const arr = JSON.stringify(featureList());
  const re = /("featureList":)\[[^\]]*\]/;
  if (!re.test(html)) {
    throw new Error('gen_jsonld: no featureList array found in index.html');
  }
  return html.replace(re, '$1' + arr);
}

const idxPath = path.join(siteDir, 'index.html');
const current = fs.readFileSync(idxPath, 'utf8');
const updated = rewrite(current);

if (process.argv.includes('--check')) {
  if (current !== updated) {
    console.error('index.html featureList is out of date — run: node engine/gen_jsonld.js');
    process.exit(1);
  }
  console.log('index.html featureList is up to date with the inventory');
} else {
  fs.writeFileSync(idxPath, updated);
  console.log('synced index.html featureList (' + featureList().length + ' features)');
}
