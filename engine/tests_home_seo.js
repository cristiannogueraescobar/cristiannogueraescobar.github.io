/* tests_home_seo.js — protects the Home head/SEO invariants (Lote A) and the
 * rule that the public build must not ship a personal or unconfigured contact
 * address in the add-on call to action.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
const isPublicBuild = process.env.PLUMLINE_PUBLIC_BUILD === '1';

// ---- Title ------------------------------------------------------------
const titleM = html.match(/<title>([^<]*)<\/title>/);
ok('home seo: has a <title>', !!titleM);
if (titleM) {
  const title = titleM[1];
  ok('home seo: title is the approved concise title',
     title === 'Plumline | Free Spreadsheet Optimisation Solver', title);
  // Descriptive and not overlong; and no "coming soon" marketing in the title.
  ok('home seo: title is not overlong', title.length <= 65, title.length + ' chars');
  ok('home seo: title has no "coming soon"', !/coming soon/i.test(title), title);
}

// ---- Meta description -------------------------------------------------
const descM = html.match(/<meta name="description" content="([^"]*)"/);
ok('home seo: has a meta description', !!descM);
if (descM) {
  const desc = descM[1];
  ok('home seo: description is the approved copy',
     desc === 'Solve continuous, integer, binary and mixed spreadsheet models in your browser. Paste from Excel or Google Sheets, verify every constraint and keep your data local.',
     desc);
  ok('home seo: description length is reasonable', desc.length >= 70 && desc.length <= 200, desc.length + ' chars');
}

// ---- No meta keywords -------------------------------------------------
ok('home seo: no <meta name="keywords"> (not a supported Search signal)',
   html.indexOf('name="keywords"') === -1);

// ---- f3P shadow-price copy is a complete sentence, normalised ---------
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;

['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
  const v = DICT[lang].home.f3P;
  ok('home seo: f3P present in ' + lang, typeof v === 'string' && v.length > 0);
  if (v) {
    ok('home seo: f3P [' + lang + '] avoids "binding limit"', !/binding limit/i.test(v), v);
    ok('home seo: f3P [' + lang + '] avoids "yes/no"', !/yes\/no/i.test(v), v);
  }
});
// English f3P is the approved complete sentence, and the inline HTML matches it.
ok('home seo: f3P EN is the approved sentence',
   DICT.en.home.f3P === 'For eligible continuous models, Plumline estimates how the result may change when a binding constraint is relaxed by one unit. This sensitivity insight is often called a shadow price.',
   DICT.en.home.f3P);
const inlineF3 = html.match(/data-i18n="f3P">([\s\S]*?)<\/(?:p|em)>/);
ok('home seo: inline f3P equals the EN dictionary', inlineF3 && inlineF3[1] === DICT.en.home.f3P);

// ---- Hero screenshot guard (same assertion in both modes) ------------
// The hero must show an authentic screenshot before it ships. The assertion runs
// in BOTH modes for a stable count; only the condition differs: dev tolerates the
// placeholder while building, public rejects it so a placeholder can never ship.
const hasPlaceholder = html.indexOf('data-hero-placeholder="1"') !== -1;
ok('home seo: hero has no dev placeholder (enforced in public build)',
   isPublicBuild ? !hasPlaceholder : true,
   hasPlaceholder ? 'placeholder present' + (isPublicBuild ? '' : ' (dev: tolerated)') : 'real screenshot');

// ---- Every referenced image file exists, and matches the manifest ----
// Covers all <img src> AND <source srcset> (PNG and WebP), verifies each file is
// non-empty with the exact declared dimensions in both formats, reads the OG
// image as exactly 1200x630, and cross-checks against data/home-screenshots.json
// so a future swap for an illustration or a wrongly sized file fails here.
function pngSize(buf) {
  if (buf.length < 24 || buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function webpSize(buf) {
  if (buf.length < 30 || buf.slice(0, 4).toString('ascii') !== 'RIFF' ||
      buf.slice(8, 12).toString('ascii') !== 'WEBP') return null;
  const fmt = buf.slice(12, 16).toString('ascii');
  if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (fmt === 'VP8L') {
    const b = buf.slice(21, 25);
    const bits = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fmt === 'VP8X') {
    return { w: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
             h: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1 };
  }
  return null;
}
function imgSize(rel) {
  const p = path.join(siteDir, rel);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  return rel.endsWith('.webp') ? webpSize(buf) : pngSize(buf);
}

// 1. Every image the Home references (src or srcset) exists and is non-empty.
const imgRefs = [];
for (const m of html.matchAll(/(?:src|srcset)="(assets\/[^"]+\.(?:png|webp|jpg|jpeg|svg))"/g)) imgRefs.push(m[1]);
const uniqueRefs = [...new Set(imgRefs)];
ok('home seo: Home references the hero, mobile and verify screenshots (png+webp)',
   uniqueRefs.length >= 5, uniqueRefs.length + ' image refs');
uniqueRefs.forEach(function (ref) {
  const p = path.join(siteDir, ref);
  const exists = fs.existsSync(p);
  ok('home seo: referenced image exists: ' + ref, exists, ref);
  if (exists) ok('home seo: referenced image is non-empty: ' + ref, fs.statSync(p).size > 0);
});

// 2. Manifest: each screenshot exists in every declared format with EXACT dims.
const manifest = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home-screenshots.json'), 'utf8'));
manifest.screenshots.forEach(function (s) {
  ok('home seo: manifest entry ' + s.id + ' is an authentic product screenshot',
     s.kind === 'authentic-product-screenshot', s.kind);
  s.formats.forEach(function (ext) {
    const rel = 'assets/screenshots/' + s.file + '.' + ext;
    const p = path.join(siteDir, rel);
    const exists = fs.existsSync(p);
    ok('home seo: manifest file exists: ' + rel, exists);
    if (!exists) return;
    ok('home seo: manifest file non-empty: ' + rel, fs.statSync(p).size > 0);
    const dim = imgSize(rel);
    ok('home seo: ' + rel + ' is ' + s.width + 'x' + s.height,
       dim && dim.w === s.width && dim.h === s.height, dim ? dim.w + 'x' + dim.h : 'unreadable');
  });
});

// 3. The OG image is referenced and is EXACTLY 1200x630 on disk.
const ogRef = 'assets/screenshots/plumline-home-og.png';
const ogDim = imgSize(ogRef);
ok('home seo: OG image is exactly 1200x630', ogDim && ogDim.w === 1200 && ogDim.h === 630,
   ogDim ? ogDim.w + 'x' + ogDim.h : 'missing');

// 4. Every informative <img> under assets/screenshots carries a translatable alt
//    (data-i18n-alt) whose key exists in all five languages and whose inline
//    English matches the dictionary.
const imgTags = [...html.matchAll(/<img\b[^>]*assets\/screenshots\/[^>]*>/g)].map(m => m[0]);
ok('home seo: found the hero and verify <img> tags', imgTags.length >= 2, imgTags.length + ' screenshot imgs');
imgTags.forEach(function (tag) {
  const keyM = tag.match(/data-i18n-alt="([^"]+)"/);
  ok('home seo: screenshot img has data-i18n-alt', !!keyM, tag.slice(0, 60));
  const altM = tag.match(/\salt="([^"]*)"/);
  ok('home seo: screenshot img has non-empty inline alt', altM && altM[1].length >= 20);
  if (keyM) {
    const key = keyM[1];
    ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
      const v = DICT[lang].home[key];
      ok('home seo: alt key ' + key + ' present in ' + lang, typeof v === 'string' && v.length > 0, key);
    });
    if (altM) ok('home seo: inline EN alt for ' + key + ' matches the dictionary',
                 altM[1] === DICT.en.home[key], key);
  }
});

// ---- Contact address guard -------------------------------------------
// The public build must not ship a personal address or an unconfigured domain
// address in the Home. Only approved domain addresses are allowed. During
// development the personal Gmail may remain elsewhere, but the Home add-on CTA
// must not carry it once the redesign lands. We scan the WHOLE Home for
// personal-provider mailto links and fail the PUBLIC build on any hit.
// ---- Contact address guard (same assertion count in both modes) ------
// The Home must not ship a personal or unapproved mailto. The assertion runs in
// BOTH dev and public so the test count is stable (build-info.json publishes it);
// only the pass condition differs: dev tolerates a personal Gmail while building,
// public rejects it. There are currently no mailto links on the Home, so this is
// a single stable assertion either way.
const APPROVED_DOMAINS = ['plumline.online'];
const mailtos = [...html.matchAll(/mailto:([^"'?&\s]+@[^"'?&\s]+)/g)].map(m => m[1]);
const personalProviders = /@(gmail|googlemail|yahoo|hotmail|outlook|proton|protonmail|icloud|me)\.com$/i;
const isPublic = isPublicBuild;
const badMailtos = mailtos.filter(function (addr) {
  const domain = addr.split('@')[1];
  return personalProviders.test(addr) || APPROVED_DOMAINS.indexOf(domain) === -1;
});
// Public: any bad mailto fails. Dev: allowed, so this passes regardless.
ok('home seo: Home has no personal/unapproved mailto (enforced in public build)',
   isPublic ? badMailtos.length === 0 : true,
   badMailtos.join(', ') + (isPublic ? '' : ' (dev: tolerated)'));

// ---- No waitlist / personal-email remnants anywhere on the Home ------
// The redesign removed the add-on waitlist. Guard against any remnant in the
// Home HTML, its inline JS, and the generated FAQ regions, in every language via
// the dictionary. These strings must not reappear.
const remnants = ['addonWaitlist', 'addonEmailSubject', 'addonEmailBody',
                  'Get notified', 'Leave your email', 'mailto:', 'gmail.com'];
remnants.forEach(function (needle) {
  ok('home seo: Home HTML has no "' + needle + '"', html.indexOf(needle) === -1, needle);
});
// And the home dictionary carries none of the removed keys, in any language.
['addonWaitlist', 'addonEmailSubject', 'addonEmailBody'].forEach(function (key) {
  ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
    ok('home seo: dict has no removed key ' + key + ' [' + lang + ']',
       !(DICT[lang].home && DICT[lang].home[key]), key);
  });
});

// ---- OG / Twitter image metadata is complete -------------------------
const OG_URL = 'https://plumline.online/assets/screenshots/plumline-home-og.png';
[
  ['og:image', OG_URL],
  ['og:image:type', 'image/png'],
  ['og:image:width', '1200'],
  ['og:image:height', '630']
].forEach(function (pair) {
  const re = new RegExp('<meta property="' + pair[0].replace(/:/g, ':') + '" content="' + pair[1].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '"');
  ok('home seo: has ' + pair[0] + ' = ' + pair[1], re.test(html));
});
ok('home seo: has og:image:alt', /<meta property="og:image:alt" content="[^"]{20,}"/.test(html));
ok('home seo: twitter:image points at the Home OG image',
   html.indexOf('<meta name="twitter:image" content="' + OG_URL + '"') !== -1);
ok('home seo: has twitter:image:alt', /<meta name="twitter:image:alt" content="[^"]{20,}"/.test(html));
ok('home seo: no stale og-image.png reference', html.indexOf('assets/og-image.png') === -1);

console.log('HOME SEO TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
