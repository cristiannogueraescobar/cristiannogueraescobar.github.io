/* gen_home_capabilities.js — generate the capability SUMMARY block on the Home
 * page (index.html) from the product-capabilities inventory.
 *
 * WHY: the Home used to carry four hand-written capability cards whose text
 * duplicated the inventory and could drift from it. This generator makes the
 * inventory the single source of truth for the Home summary too. It renders a
 * SUMMARY — the four groups, each listing its public capability names — not the
 * full 16-capability page (that is capabilities.html). English is inline (with
 * data-i18n) so the Home stays indexable and complete with JavaScript off.
 *
 * The block is injected into index.html between the HOME_CAPABILITIES markers.
 *
 * Run: node engine/gen_home_capabilities.js         (writes index.html)
 *      node engine/gen_home_capabilities.js --check  (exit non-zero if stale)
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));

// English dictionary as the inline source.
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
new Function('window', 'navigator', 'location', 'document', 'globalThis', i18nSrc)
  .call(g, g, g.navigator, g.location, g.document, g);
const EN = g.Plumline.i18n.dict.en.capabilities;

function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                  .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function en(key) {
  if (!Object.prototype.hasOwnProperty.call(EN, key)) {
    throw new Error('gen_home_capabilities: missing English i18n key: ' + key);
  }
  return EN[key];
}
function span(key) {
  return '<span data-i18n="' + escAttr(key) + '">' + escText(en(key)) + '</span>';
}

const GROUP_KEY = {
  models: 'capGroupModels', spreadsheet: 'capGroupSpreadsheet',
  verification: 'capGroupVerification', explanation: 'capGroupExplanation'
};
const SUMMARY_MAX = 4; // names shown per group on the Home summary

function isShown(c) {
  return c.public === true && c.status === 'available' && c.exampleStatus !== 'pending';
}

function buildBlock() {
  const shown = caps.CAPABILITIES.filter(isShown);
  const groups = caps.GROUP_ORDER.filter(grp => shown.some(c => c.group === grp));
  const L = [];
  L.push('    <div class="grid-2" style="gap:20px">');
  groups.forEach(function (grp) {
    const names = shown.filter(c => c.group === grp).slice(0, SUMMARY_MAX);
    L.push('      <div class="card">');
    L.push('        <h3 data-i18n="' + escAttr(GROUP_KEY[grp]) + '">' + escText(en(GROUP_KEY[grp])) + '</h3>');
    L.push('        <ul class="home-cap-list">');
    names.forEach(function (c) {
      L.push('          <li>' + span(c.nameKey) + '</li>');
    });
    L.push('        </ul>');
    L.push('      </div>');
  });
  L.push('    </div>');
  // Link to the full capabilities page.
  L.push('    <p class="home-cap-more">');
  L.push('      <a href="capabilities.html" data-i18n="capsSeeAll">' + escText(en('capsSeeAll')) + '</a>');
  L.push('    </p>');
  return L.join('\n');
}

function buildPage() {
  const idxPath = path.join(siteDir, 'index.html');
  const html = fs.readFileSync(idxPath, 'utf8');
  const start = '<!-- HOME_CAPABILITIES_START -->';
  const end = '<!-- HOME_CAPABILITIES_END -->';
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  if (s === -1 || e === -1 || e < s) {
    throw new Error('gen_home_capabilities: index.html is missing the HOME_CAPABILITIES markers');
  }
  const before = html.slice(0, s + start.length);
  const after = html.slice(e);
  return before + '\n' + buildBlock() + '\n    ' + after;
}

const outPath = path.join(siteDir, 'index.html');
const page = buildPage();

if (process.argv.includes('--check')) {
  const current = fs.readFileSync(outPath, 'utf8');
  if (current !== page) {
    console.error('index.html Home summary is out of date — run: node engine/gen_home_capabilities.js');
    process.exit(1);
  }
  console.log('index.html Home capability summary is up to date');
} else {
  fs.writeFileSync(outPath, page);
  console.log('wrote Home capability summary into index.html');
}
