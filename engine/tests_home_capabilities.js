/* tests_home_capabilities.js — the Home capability summary is generated from
 * the inventory, carries no stale hand-written duplicates, and links to the
 * full page.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');

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
//    cards; the summary must be inventory-driven, so none may survive.
['capsContH', 'capsIntH', 'capsBinH', 'capsMixH',
 'capsContP', 'capsIntP', 'capsBinP', 'capsMixP', 'capsFoot'].forEach(function (k) {
  ok('home summary: stale manual key ' + k + ' is gone',
     html.indexOf('data-i18n="' + k + '"') === -1, k);
});

// 3. The four groups are present, each summarising its public capabilities from
//    the inventory (name text inline for no-JS).
const GROUP_KEY = {
  models: 'capGroupModels', spreadsheet: 'capGroupSpreadsheet',
  verification: 'capGroupVerification', explanation: 'capGroupExplanation'
};
const shown = caps.CAPABILITIES.filter(c =>
  c.public === true && c.status === 'available' && c.exampleStatus !== 'pending');
caps.GROUP_ORDER.forEach(function (grp) {
  const inG = shown.filter(c => c.group === grp);
  if (!inG.length) return;
  ok('home summary: group ' + grp + ' heading present',
     html.indexOf('data-i18n="' + GROUP_KEY[grp] + '"') !== -1, GROUP_KEY[grp]);
  // At least one of the group's public capability names appears inline.
  const anyName = inG.slice(0, 4).some(c => html.indexOf('>' + EN[c.nameKey] + '<') !== -1);
  ok('home summary: group ' + grp + ' lists inventory capability names', anyName);
});

// 4. Links to the full capabilities page.
ok('home summary: links to capabilities.html',
   html.indexOf('href="capabilities.html"') !== -1);
ok('home summary: uses the capsSeeAll link label',
   html.indexOf('data-i18n="capsSeeAll"') !== -1);

// 5. The summary is a SUMMARY, not the whole page: it must not carry the full
//    descriptions (those live on capabilities.html), only names.
const anyDesc = shown.some(c => html.indexOf(EN[c.descriptionKey]) !== -1);
ok('home summary: does not inline full capability descriptions', !anyDesc);

console.log('HOME CAPABILITIES TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
