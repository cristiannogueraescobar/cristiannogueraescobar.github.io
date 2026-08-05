/* gen_home_featured.js — generate the FEATURED EXAMPLES preview on the Home page
 * (index.html) from the canonical example catalogue.
 *
 * WHY: the Home used to hand-write example cards whose title/slug/type/sense
 * duplicated the catalogue and could drift from it. This generator makes the
 * catalogue the single source of truth: Home keeps only a closed, ordered list
 * of FEATURED KEYS; every visible field (title, description, category, model
 * type, maximise/minimise, URL) is projected from the catalogue. English text is
 * inline (with data-i18n) so the Home stays indexable with JavaScript off.
 *
 * The block is injected into index.html between the HOME_FEATURED markers.
 *
 * Guards (all fatal):
 *   - a featured key that is not in the catalogue,
 *   - a duplicated featured key,
 *   - a featured example that is not public,
 *   - missing/duplicated markers.
 *
 * Run: node engine/gen_home_featured.js         (writes index.html)
 *      node engine/gen_home_featured.js --check  (exit non-zero if stale)
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');

// Closed, ordered list of featured example keys (editorial choice). 3–4 items.
// These are KEYS into the canonical catalogue; no metadata is copied here.
const FEATURED_KEYS = ['production', 'workforce', 'project', 'blend'];

const catMod = require(path.join(siteDir, 'src', 'shared', 'examples', 'index.js'));
const catalogue = catMod.loadAndValidateCatalogue(siteDir).catalogue;

// English dictionary for the section chrome (title/lead/CTAs), inline source.
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
new Function('window', 'navigator', 'location', 'document', 'globalThis', i18nSrc)
  .call(g, g, g.navigator, g.location, g.document, g);
const EN = g.Plumline.i18n.dict.en.home;

function escText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function en(key) {
  if (!Object.prototype.hasOwnProperty.call(EN, key)) {
    throw new Error('gen_home_featured: missing English i18n key: home.' + key);
  }
  return EN[key];
}

// Resolve a featured key to its catalogue entry, with all guards. The lookup
// runs over the ENTIRE catalogue (any valid length), independent of the current
// nine-example count — that count is a separate published-catalogue contract.
function resolve(key) {
  const matches = catalogue.filter(function (entry) { return entry && entry.key === key; });
  if (matches.length === 0) throw new Error('gen_home_featured: featured key not in catalogue: ' + key);
  if (matches.length > 1) throw new Error('gen_home_featured: featured key duplicated in catalogue: ' + key);
  const ex = matches[0];
  if (ex.public === false) throw new Error('gen_home_featured: featured example is not public: ' + key);
  return ex;
}

// maximise/minimise label from canonical sense.
function senseKey(sense) { return sense === 'max' ? 'exSenseMax' : 'exSenseMin'; }
// model-type label from canonical type.
function typeKey(type) {
  return { continuous: 'exTypeContinuous', integer: 'exTypeInteger', binary: 'exTypeBinary', mixed: 'exTypeMixed' }[type];
}

function buildBlock() {
  // Guard duplicated featured keys in the Home list itself.
  const seen = {};
  FEATURED_KEYS.forEach(function (k) {
    if (seen[k]) throw new Error('gen_home_featured: duplicated featured key in Home list: ' + k);
    seen[k] = true;
  });
  const items = FEATURED_KEYS.map(resolve);
  const L = [];
  L.push('    <ul class="featured-grid">');
  items.forEach(function (ex) {
    const title = ex.translations.en.title;
    const desc = ex.translations.en.desc;
    const url = 'solver.html?ex=' + ex.slug;
    const tKey = typeKey(ex.type);
    const sKey = senseKey(ex.sense);
    L.push('      <li class="featured-card card2">');
    L.push('        <a class="featured-link" href="' + escAttr(url) + '">');
    L.push('          <h3 class="featured-title" data-i18n="exName_' + escAttr(ex.key) + '">' + escText(title) + '</h3>');
    L.push('          <p class="featured-desc" data-i18n="exDesc_' + escAttr(ex.key) + '">' + escText(desc) + '</p>');
    L.push('          <p class="featured-meta">');
    L.push('            <span class="badge badge--accent" data-i18n="' + escAttr(tKey) + '">' + escText(en(tKey)) + '</span>');
    L.push('            <span class="badge" data-i18n="' + escAttr(sKey) + '">' + escText(en(sKey)) + '</span>');
    L.push('          </p>');
    L.push('          <span class="featured-open" data-i18n="exOpenCta">' + escText(en('exOpenCta')) + '</span>');
    L.push('        </a>');
    L.push('      </li>');
  });
  L.push('    </ul>');
  L.push('    <p class="featured-all">');
  L.push('      <a href="examples.html" class="btn2 btn2--secondary" data-i18n="exSeeAll">' + escText(en('exSeeAll')) + '</a>');
  L.push('    </p>');
  return L.join('\n');
}

function buildPage() {
  const idxPath = path.join(siteDir, 'index.html');
  const html = fs.readFileSync(idxPath, 'utf8');
  const start = '<!-- HOME_FEATURED_START -->';
  const end = '<!-- HOME_FEATURED_END -->';
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  if (s === -1 || e === -1 || e < s) {
    throw new Error('gen_home_featured: index.html is missing the HOME_FEATURED markers');
  }
  if (html.indexOf(start) !== html.lastIndexOf(start) || html.indexOf(end) !== html.lastIndexOf(end)) {
    throw new Error('gen_home_featured: HOME_FEATURED markers must appear exactly once');
  }
  const before = html.slice(0, s + start.length);
  const after = html.slice(e);
  return before + '\n' + buildBlock() + '\n    ' + after;
}

const outPath = path.join(siteDir, 'index.html');

if (require.main === module) {
  const page = buildPage();
  if (process.argv.includes('--check')) {
    const current = fs.readFileSync(outPath, 'utf8');
    if (current !== page) {
      console.error('index.html Home featured examples are out of date — run: node engine/gen_home_featured.js');
      process.exit(1);
    }
    console.log('index.html Home featured examples are up to date');
  } else {
    fs.writeFileSync(outPath, page);
    console.log('wrote Home featured examples into index.html');
  }
}

module.exports = { FEATURED_KEYS: FEATURED_KEYS, buildBlock: buildBlock, resolve: resolve };
