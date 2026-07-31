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

// ---- Hero screenshot guard -------------------------------------------
// The hero must show an authentic screenshot before it ships. While the dev
// placeholder is present (data-hero-placeholder="1"), the PUBLIC build fails, so
// a placeholder can never be deployed as the final hero. Dev build only records.
const hasPlaceholder = html.indexOf('data-hero-placeholder="1"') !== -1;
if (process.env.PLUMLINE_PUBLIC_BUILD === '1') {
  ok('home seo (public): hero has no dev placeholder (real screenshot required)',
     !hasPlaceholder);
} else {
  ok('home seo (dev): hero placeholder scan ran', true,
     hasPlaceholder ? 'placeholder present (dev only)' : 'real screenshot present');
}

// ---- Every referenced image file exists ------------------------------
// A broken <img src> or <source srcset> ships a broken hero. Check that every
// local image path referenced on the Home resolves to a real file.
const imgRefs = [];
for (const m of html.matchAll(/(?:src|srcset)="(assets\/[^"]+\.(?:png|webp|jpg|jpeg|svg))"/g)) {
  imgRefs.push(m[1]);
}
const uniqueRefs = [...new Set(imgRefs)];
ok('home seo: Home references at least the hero and verify screenshots',
   uniqueRefs.length >= 4, uniqueRefs.length + ' image refs');
uniqueRefs.forEach(function (ref) {
  ok('home seo: referenced image exists on disk: ' + ref,
     fs.existsSync(path.join(siteDir, ref)), ref);
});
// The hero <img> must carry alt text (accessibility + no text-only-in-image).
const heroImg = html.match(/<img[^>]*hero-production-desktop\.png[^>]*>/);
ok('home seo: hero image has non-empty alt text',
   heroImg && /alt="[^"]{20,}"/.test(heroImg[0]));

// ---- Contact address guard -------------------------------------------
// The public build must not ship a personal address or an unconfigured domain
// address in the Home. Only approved domain addresses are allowed. During
// development the personal Gmail may remain elsewhere, but the Home add-on CTA
// must not carry it once the redesign lands. We scan the WHOLE Home for
// personal-provider mailto links and fail the PUBLIC build on any hit.
const APPROVED_DOMAINS = ['plumline.online'];
const mailtos = [...html.matchAll(/mailto:([^"'?&\s]+@[^"'?&\s]+)/g)].map(m => m[1]);
const personalProviders = /@(gmail|googlemail|yahoo|hotmail|outlook|proton|protonmail|icloud|me)\.com$/i;
if (process.env.PLUMLINE_PUBLIC_BUILD === '1') {
  mailtos.forEach(function (addr) {
    ok('home seo (public): Home mailto is not a personal-provider address',
       !personalProviders.test(addr), addr);
    const domain = addr.split('@')[1];
    ok('home seo (public): Home mailto uses an approved domain',
       APPROVED_DOMAINS.indexOf(domain) !== -1, addr);
  });
} else {
  // Dev build: record the count, do not fail (personal Gmail allowed while building).
  ok('home seo (dev): mailto scan ran', true, mailtos.length + ' mailto(s) on Home');
}

console.log('HOME SEO TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
