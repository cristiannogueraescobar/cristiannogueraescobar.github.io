/* tests_site_hygiene.js — site-wide guards that must hold on EVERY public page,
 * not just the Home:
 *   1. No retired social image (assets/og-image.png) anywhere.
 *   2. No personal email / mailto / waitlist remnants in any HTML or in the
 *      dictionary, in any language.
 *   3. Footer Contact points at about.html#contact (the interim contact route).
 * The Home-only checks live in tests_home_seo.js; this covers the whole site so a
 * remnant on solver.html or a legal page can never slip through.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');
const { composedHtml } = require('./composed-html.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const PAGES = ['index.html', 'solver.html', 'guide.html', 'capabilities.html',
               'examples.html', 'about.html', 'privacy.html', 'terms.html'];

// Strings that must not appear in any page's HTML.
const FORBIDDEN_HTML = [
  'assets/og-image.png',            // retired social image
  'gmail.com',                       // no personal address
  'getAddon', 'addonWaitlist',       // renamed / removed keys
  'Get notified', 'Leave your email' // waitlist copy
];
// The only contact address allowed to appear anywhere.
const APPROVED_DOMAINS = ['plumline.online'];
const PERSONAL_PROVIDERS = /@(gmail|googlemail|yahoo|hotmail|outlook|proton|protonmail|icloud|me)\.com$/i;

PAGES.forEach(function (page) {
  const p = path.join(siteDir, page);
  if (!fs.existsSync(p)) { ok('site hygiene: ' + page + ' exists', false); return; }
  const html = composedHtml(siteDir, page);
  FORBIDDEN_HTML.forEach(function (needle) {
    ok('site hygiene: ' + page + ' has no "' + needle + '"', html.indexOf(needle) === -1, needle);
  });
  // Every mailto on the page must use the approved domain and not a personal one.
  [...html.matchAll(/mailto:([^"'?&\s]+@[^"'?&\s]+)/g)].forEach(function (m) {
    const addr = m[1];
    ok('site hygiene: ' + page + ' mailto ' + addr + ' is not a personal provider',
       !PERSONAL_PROVIDERS.test(addr), addr);
    ok('site hygiene: ' + page + ' mailto ' + addr + ' uses an approved domain',
       APPROVED_DOMAINS.indexOf(addr.split('@')[1]) !== -1, addr);
  });
  // Footer Contact link resolves to the approved contact address or the About anchor.
  if (html.indexOf('data-i18n="footContact"') !== -1) {
    ok('site hygiene: ' + page + ' footer Contact points at the approved contact',
       html.indexOf('mailto:contact@plumline.online') !== -1 || html.indexOf('about.html#contact') !== -1, page);
  }
});

// about.html#contact anchor must exist (the About page contact section).
const about = composedHtml(siteDir, 'about.html');
ok('site hygiene: about.html has an #contact anchor', /id="contact"/.test(about));

// Dictionary: none of the removed keys survive, in any namespace or language.
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;
const REMOVED_KEYS = ['getAddon', 'addonWaitlist', 'addonEmailSubject', 'addonEmailBody'];
Object.keys(DICT).forEach(function (lang) {
  Object.keys(DICT[lang]).forEach(function (ns) {
    REMOVED_KEYS.forEach(function (key) {
      ok('site hygiene: dict[' + lang + '][' + ns + '] has no ' + key,
         !(key in DICT[lang][ns]), key);
    });
    // No dictionary VALUE contains a personal address.
    Object.keys(DICT[lang][ns]).forEach(function (k) {
      const v = DICT[lang][ns][k];
      if (typeof v === 'string' && /gmail\.com|mailto:/.test(v)) {
        ok('site hygiene: dict[' + lang + '][' + ns + '].' + k + ' has no personal address', false, v.slice(0, 40));
      }
    });
  });
});
ok('site hygiene: dictionary scanned for personal addresses', true);

console.log('SITE HYGIENE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
