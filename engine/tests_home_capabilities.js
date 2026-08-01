/* tests_home_capabilities.js — the Home capability summary is generated from
 * the inventory, carries no stale hand-written duplicates, and links to the
 * full page.
 */
const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
const html = composedHtml(siteDir, 'index.html');

// Load EN dict.
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const EN = g.Plumline.i18n.dict.en.capabilities;

// 1. The Home summary is up to date with the inventory (generator --check).
(function () {
  const { execFileSync } = require('child_process');
  try {
    execFileSync('node', [path.join(siteDir, 'engine', 'gen_home_capabilities.js'), '--check'], { stdio: 'pipe' });
    ok('home summary: is up to date with the inventory', true);
  } catch (e) {
    ok('home summary: is up to date with the inventory', false,
       'run: node engine/gen_home_capabilities.js');
  }
})();

// 2. No stale hand-written capability keys remain. These were the old manual
//    cards; the summary must be inventory-driven, so none may survive — neither
//    in the HTML nor in the i18n dictionary (a dead key is a maintenance trap).
const MANUAL_KEYS = ['capsContH', 'capsIntH', 'capsBinH', 'capsMixH',
  'capsContP', 'capsIntP', 'capsBinP', 'capsMixP', 'capsFoot'];
MANUAL_KEYS.forEach(function (k) {
  ok('home summary: stale manual key ' + k + ' is gone from index.html',
     html.indexOf('data-i18n="' + k + '"') === -1, k);
  ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
    const L = g.Plumline.i18n.dict[lang];
    const inHome = L.home && Object.prototype.hasOwnProperty.call(L.home, k);
    const inCaps = L.capabilities && Object.prototype.hasOwnProperty.call(L.capabilities, k);
    ok('home summary: stale manual key ' + k + ' is gone from ' + lang + ' dictionary',
       !inHome && !inCaps, k);
  });
});

// 3. The four groups are present, each summarising its FEATURED public
//    capabilities from the inventory — exact names, in homeSummaryRank order,
//    with no extra or missing entries (a weak "some name appears" check would
//    miss three of four going wrong).
const GROUP_KEY = {
  models: 'capGroupModels', spreadsheet: 'capGroupSpreadsheet',
  verification: 'capGroupVerification', explanation: 'capGroupExplanation'
};
function featuredInGroup(grp) {
  return caps.CAPABILITIES
    .filter(c => c.homeSummaryRank !== undefined && c.group === grp &&
                 c.public === true && c.status === 'available' && c.exampleStatus !== 'pending')
    .sort((a, b) => a.homeSummaryRank - b.homeSummaryRank);
}
// Pull the <li> names rendered under a group's card, in document order.
function renderedNames(groupKey) {
  // Find the card whose <h3> uses this group key, then read its list items.
  const cardRe = new RegExp(
    '<h3 data-i18n="' + groupKey + '">[\\s\\S]*?<ul class="home-cap-list">([\\s\\S]*?)</ul>');
  const m = html.match(cardRe);
  if (!m) return null;
  return [...m[1].matchAll(/<li><span data-i18n="([^"]+)"/g)].map(x => x[1]);
}
caps.GROUP_ORDER.forEach(function (grp) {
  const feat = featuredInGroup(grp);
  if (!feat.length) return;
  ok('home summary: group ' + grp + ' heading present',
     html.indexOf('data-i18n="' + GROUP_KEY[grp] + '"') !== -1, GROUP_KEY[grp]);
  const rendered = renderedNames(GROUP_KEY[grp]);
  const expectedKeys = feat.map(c => c.nameKey);
  ok('home summary: group ' + grp + ' lists exactly the featured names, in rank order',
     rendered !== null && JSON.stringify(rendered) === JSON.stringify(expectedKeys),
     'rendered ' + JSON.stringify(rendered) + ' vs expected ' + JSON.stringify(expectedKeys));
  // And the English name text is inline for no-JS.
  feat.forEach(function (c) {
    ok('home summary: ' + c.id + ' name text inline',
       html.indexOf('>' + EN[c.nameKey] + '<') !== -1, c.nameKey);
  });
});

// 4. Links to the full capabilities page.
ok('home summary: links to capabilities.html',
   html.indexOf('href="capabilities.html"') !== -1);
ok('home summary: uses the capsSeeAll link label',
   html.indexOf('data-i18n="capsSeeAll"') !== -1);

// 5. The summary is a SUMMARY, not the whole page: it must not carry the full
//    descriptions (those live on capabilities.html), only names.
const shown = caps.CAPABILITIES.filter(c =>
  c.public === true && c.status === 'available' && c.exampleStatus !== 'pending');
const anyDesc = shown.some(c => html.indexOf(EN[c.descriptionKey]) !== -1);
ok('home summary: does not inline full capability descriptions', !anyDesc);

console.log('HOME CAPABILITIES TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
