/* validate_html.js — structural HTML validation, for a target directory.
 *
 *   node engine/validate_html.js .        # validate the source pages
 *   node engine/validate_html.js dist     # validate the built pages (after build)
 *
 * jsdom is the structural validator (NOT replaced by regex). A small raw scan is
 * added as extra defence, but jsdom remains authoritative.
 *
 * Asserts (Lote E.1 protections, in BOTH source and dist):
 *   - exactly one <html>, <head>, <body>.
 *   - every <img> has exactly one alt attribute (alt="" allowed for decorative).
 *   - zero junk attributes (optimal / solution / proven) leaked from a broken quote.
 *   - the <img> tag is structurally clean (no stray attribute fragments).
 *   - Home's two image alts equal DICT.en.home.heroShotAlt / verifyShotAlt exactly.
 *
 * Exit non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const targetArg = process.argv[2] || '.';
const targetDir = path.resolve(root, targetArg);
const label = path.relative(root, targetDir) || '.';

const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms']
  .map(p => p + '.html');

let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('jsdom required under CI'); process.exit(1); }
  console.log('validate_html (' + label + '): skipped (jsdom not installed locally)'); process.exit(0);
}

// Load DICT.en.home from the SOURCE i18n.js (the dictionary is the source of
// truth for the approved alt text, regardless of which dir we validate).
let DICT = null;
try {
  const g = {};
  new Function('window', 'navigator', 'location', 'document', 'globalThis',
    fs.readFileSync(path.join(root, 'assets', 'i18n.js'), 'utf8'))
    .call(g, g, { language: 'en', languages: ['en'] }, { search: '', pathname: '/' }, {}, g);
  DICT = g.Plumline.i18n.dict;
} catch (e) {
  console.log('  note: could not load DICT for alt comparison:', e.message);
}

let fail = 0;
function ok(name, cond, detail) { if (!cond) { fail++; console.log('  FAIL:', name, detail || ''); } }

for (const p of PAGES) {
  const file = path.join(targetDir, p);
  if (!fs.existsSync(file)) { ok(label + '/' + p + ' exists', false, 'file missing'); continue; }
  const html = fs.readFileSync(file, 'utf8');
  let doc;
  try { doc = new JSDOM(html).window.document; }
  catch (e) { ok(p + ' parses', false, e.message); continue; }

  // Structure: count on BOTH the raw HTML text and the jsdom document. jsdom can
  // insert or normalize html/head/body, so a jsdom-only "=== 1" check does not
  // prove the SOURCE has exactly one. Raw count is the structural proof; jsdom
  // count is the interpreted view. Require exactly one OPENING and one CLOSING
  // tag of each in the raw HTML, plus exactly one in the jsdom document.
  // Strip HTML comments first so a tag mentioned in a comment isn't miscounted.
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const openCount = (tag) => (htmlNoComments.match(new RegExp('<' + tag + '(?:\\s|>)', 'gi')) || []).length;
  const closeCount = (tag) => (htmlNoComments.match(new RegExp('</' + tag + '\\s*>', 'gi')) || []).length;
  for (const tag of ['html', 'head', 'body']) {
    ok(p + ': raw one opening <' + tag + '>', openCount(tag) === 1, 'raw open count=' + openCount(tag));
    ok(p + ': raw one closing </' + tag + '>', closeCount(tag) === 1, 'raw close count=' + closeCount(tag));
    ok(p + ': jsdom one <' + tag + '>', doc.querySelectorAll(tag).length === 1);
  }

  // RAW defence (runs on the file text, NOT jsdom's serialization). jsdom
  // silently "repairs" a broken-alt tail like  alt="x.">"Optimal...".">  by
  // closing the tag at the first '>' and turning the rest into text nodes, so a
  // jsdom-only check misses it. Scan the raw <img ...> tags for the tell-tale
  // pattern: a quote-close-then-reopen inside what should be a single tag.
  const rawImgTags = htmlNoComments.match(/<img\b[^>]*(?:"[^"]*"[^>]*)*>/g) || [];
  // Per raw <img> tag: count alt= occurrences (jsdom collapses duplicate alt to
  // one, so duplicates must be counted on the raw tag text).
  for (const tag of rawImgTags) {
    const rawAltCount = (tag.match(/(?:^|\s)alt=/g) || []).length;
    const shortId = (tag.match(/src="[^"]*\/([^"/]+)"/) || [, tag.slice(0, 24)])[1];
    ok(p + ': raw img has <=1 alt (' + shortId + ')', rawAltCount <= 1, 'raw alt count=' + rawAltCount);
  }
  // Also catch the specific malformed sequence across the raw text: an alt that
  // closes with .">" immediately followed by stray words then ".">.
  const brokenTail = /alt="[^"]*\.">"?(?:Optimal|Optimale|Solución|Solução|optimal|solution|proven)/i;
  ok(p + ': no broken-alt tail in raw HTML', !brokenTail.test(htmlNoComments),
     'malformed alt tail detected in source text');
  // Junk bare attributes optimal/solution/proven appearing as attribute names in
  // any raw img tag (defence beyond jsdom's attribute view).
  for (const tag of rawImgTags) {
    if (/\s(optimal|solution|proven)=/i.test(tag) || /">(Optimal|Solución|Solução)/i.test(tag)) {
      ok(p + ': raw img tag clean', false, tag.slice(0, 80));
      break;
    }
  }

  doc.querySelectorAll('img').forEach(img => {
    const serialized = img.outerHTML;
    const shortSrc = (img.getAttribute('src') || '').slice(-30);
    // Exactly one alt attribute. alt="" is allowed (decorative).
    const altCount = (serialized.match(/(?:^|\s)alt=/g) || []).length;
    ok(p + ': img has exactly one alt (' + shortSrc + ')', altCount === 1, altCount + ' alt=');
    ok(p + ': img exposes an alt attribute (' + shortSrc + ')', img.hasAttribute('alt'));
    // Zero junk attributes from a broken quote.
    const junk = Array.from(img.attributes).map(a => a.name).filter(n => /^(optimal|solution|proven)$/i.test(n));
    ok(p + ': img has no junk attrs (' + shortSrc + ')', junk.length === 0, junk.join(','));
    // Raw defence: the tag must not carry the tell-tale broken-alt tail.
    ok(p + ': img tag structurally clean (' + shortSrc + ')',
       !/\.">"/.test(serialized) && !/">Optimal/.test(serialized), 'broken alt tail present');
  });

  // Home's two image alts must equal the EN dictionary exactly.
  if (p === 'index.html' && DICT && DICT.en && DICT.en.home) {
    const byKey = {};
    doc.querySelectorAll('img[data-i18n-alt]').forEach(img => {
      byKey[img.getAttribute('data-i18n-alt')] = img.getAttribute('alt');
    });
    for (const key of ['heroShotAlt', 'verifyShotAlt']) {
      ok('home img alt == DICT.en.home.' + key,
         byKey[key] !== undefined && byKey[key] === DICT.en.home[key],
         'html=' + JSON.stringify((byKey[key] || '').slice(0, 40)) +
         ' dict=' + JSON.stringify((DICT.en.home[key] || '').slice(0, 40)));
    }
  }
}

console.log(fail ? ('VALIDATE HTML (' + label + '): FAILED (' + fail + ')')
                 : ('VALIDATE HTML (' + label + '): OK'));
process.exit(fail ? 1 : 0);
