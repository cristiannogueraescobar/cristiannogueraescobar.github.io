/* tests_shared_behavior.js — B2 contract tests for the already-shared shell
 * behavior modules (assets/nav-menu.js and the language selector in
 * assets/i18n.js). These formalize the properties the pliego requires and guard
 * the idempotency fixes added in B2:
 *
 *   - double initialization attaches NO duplicate listeners (mobile menu + lang
 *     selector) — regression guard for the data-nav-menu-init / data-lang-init
 *     guards;
 *   - the language selector works across all five languages;
 *   - it survives localStorage being valid, holding an invalid code, being
 *     absent, and THROWING on read/write;
 *   - namespace fallback resolves without an accidental English flash for a key
 *     the active language actually has;
 *   - aria-expanded / aria-hidden and scroll-lock cleanup on the mobile menu.
 *
 * Requires jsdom (pinned; CI runs npm ci). Missing jsdom is a hard FAIL under CI
 * and a graceful skip locally. LF-only, no HTTP server, no open handles.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) {
    console.error('SHARED BEHAVIOR TESTS  FAILED: jsdom could not load under CI');
    console.error(e && e.message || e);
    process.exit(1);
  }
  console.log('SHARED BEHAVIOR TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const navmenu = fs.readFileSync(path.join(siteDir, 'assets', 'nav-menu.js'), 'utf8');
const i18n = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
const badge = fs.readFileSync(path.join(siteDir, 'assets', 'build-badge.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Count how many click listeners get attached to an element after a point in
// time by wrapping addEventListener.
function watchAdds(el, type) {
  var count = 0;
  var orig = el.addEventListener.bind(el);
  el.addEventListener = function (t, f, o) { if (t === type) count++; return orig(t, f, o); };
  return function () { return count; };
}

// --- Mobile menu: idempotency + aria + scroll lock ------------------------------
{
  const html = composedHtml(siteDir, 'index.html');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const { window } = dom;
  window.eval(navmenu);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  const drawer = window.document.getElementById('mobile-menu');
  const toggle = window.document.querySelector('.menu-toggle');
  ok('mobile menu: drawer built on first init', !!drawer && !!toggle);
  ok('mobile menu: starts hidden', drawer.hasAttribute('hidden'));
  ok('mobile menu: toggle starts aria-expanded=false', toggle.getAttribute('aria-expanded') === 'false');

  // Open / close via the toggle.
  toggle.dispatchEvent(new window.Event('click'));
  ok('mobile menu: click opens', !drawer.hasAttribute('hidden'));
  ok('mobile menu: aria-expanded true when open', toggle.getAttribute('aria-expanded') === 'true');
  ok('mobile menu: hidden attribute reflects open state (drawer visible)', !drawer.hasAttribute('hidden'));
  ok('mobile menu: body scroll locked when open', window.document.body.style.overflow === 'hidden');
  toggle.dispatchEvent(new window.Event('click'));
  ok('mobile menu: click closes', drawer.hasAttribute('hidden'));
  ok('mobile menu: aria-expanded false when closed', toggle.getAttribute('aria-expanded') === 'false');
  ok('mobile menu: body scroll restored when closed', window.document.body.style.overflow === '');

  // Double init must NOT attach duplicate listeners or build a second drawer.
  const getAdds = watchAdds(toggle, 'click');
  window.eval(navmenu);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  ok('mobile menu: double init attaches no duplicate toggle listeners', getAdds() === 0, 'added=' + getAdds());
  ok('mobile menu: double init keeps exactly one drawer',
     window.document.querySelectorAll('#mobile-menu').length === 1);

  // After double init, a single click still toggles cleanly (not open+close).
  toggle.dispatchEvent(new window.Event('click'));
  ok('mobile menu: after double init one click opens (no duplicate handler)', !drawer.hasAttribute('hidden'));
  toggle.dispatchEvent(new window.Event('click'));
  ok('mobile menu: after double init one click closes', drawer.hasAttribute('hidden'));
}

// --- Language selector: build a jsdom page, install a storage shim -------------
function bootLang(page, url, storage) {
  const file = page + '.html';
  const html = composedHtml(siteDir, file);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: url });
  const { window } = dom;
  // Install the requested localStorage behavior BEFORE running i18n.
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  window.eval(i18n);
  return dom;
}

// A storage shim factory: 'ok' (works), 'throwing' (throws on both ops),
// 'readonly-throw' (throws on setItem only), backed by a plain object.
function makeStorage(mode, initial) {
  const data = Object.assign({}, initial);
  return {
    getItem: function (k) {
      if (mode === 'throwing') throw new Error('storage blocked');
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem: function (k, v) {
      if (mode === 'throwing' || mode === 'readonly-throw') throw new Error('storage blocked');
      data[k] = String(v);
    }
  };
}

const NS = { index: 'home', privacy: 'legal' };

// Initial-language resolution across scenarios.
{
  // Valid stored language is used.
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('ok', { plumline_lang: 'es' }));
  const lang = dom.window.Plumline.i18n.init('legal');
  ok('lang: valid stored language is used', lang === 'es', 'got ' + lang);
  ok('lang: documentElement.lang follows stored language', dom.window.document.documentElement.lang === 'es');
}
{
  // Invalid stored language falls back (not to the invalid code).
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('ok', { plumline_lang: 'zz' }));
  const lang = dom.window.Plumline.i18n.init('legal');
  ok('lang: invalid stored language falls back to a known language', lang !== 'zz' && !!dom.window.Plumline.i18n.dict[lang]);
}
{
  // No stored language: with navigator 'en' and no ?lang, resolves to en.
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('ok', {}));
  const lang = dom.window.Plumline.i18n.init('legal');
  ok('lang: no stored language resolves to a valid default', !!dom.window.Plumline.i18n.dict[lang]);
}
{
  // localStorage THROWS on read: init must still work (try/catch in saved()).
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('throwing', {}));
  let threw = false, lang = null;
  try { lang = dom.window.Plumline.i18n.init('legal'); } catch (e) { threw = true; }
  ok('lang: init does not throw when localStorage.getItem throws', !threw);
  ok('lang: init still returns a valid language when storage throws', !!lang && !!dom.window.Plumline.i18n.dict[lang]);
}
{
  // localStorage THROWS on write: changing language must not throw (remember()
  // is wrapped in try/catch).
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('readonly-throw', {}));
  dom.window.Plumline.i18n.init('legal');
  const sel = dom.window.document.getElementById('lang');
  let threw = false;
  try {
    sel.value = 'de';
    sel.dispatchEvent(new dom.window.Event('change'));
  } catch (e) { threw = true; }
  ok('lang: changing language does not throw when setItem throws', !threw);
  ok('lang: language still applied when setItem throws', dom.window.document.documentElement.lang === 'de');
}

// All five languages apply and differ from English where the dictionary differs.
{
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('ok', {}));
  const w = dom.window;
  w.Plumline.i18n.init('legal');
  const sel = w.document.getElementById('lang');
  const langs = ['en', 'es', 'pt', 'de', 'fr'];
  langs.forEach(function (L) {
    sel.value = L;
    sel.dispatchEvent(new w.Event('change'));
    ok('lang: selecting ' + L + ' sets documentElement.lang', w.document.documentElement.lang === L);
  });
  // Double init of i18n must not attach a duplicate change listener.
  const getAdds = watchAdds(sel, 'change');
  w.Plumline.i18n.init('legal');
  ok('lang: double init attaches no duplicate change listener', getAdds() === 0, 'added=' + getAdds());
}

// Namespace fallback + no accidental English: use a key whose Spanish and
// English values DIFFER (common.closeMenu = "Cerrar" / "Close"), so a fallback
// to English would be caught. Real checks, no tautology.
{
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('ok', {}));
  const api = dom.window.Plumline.i18n;
  const esValue = api.t('es', 'legal', 'closeMenu');
  const enValue = api.t('en', 'legal', 'closeMenu');
  // 1. Spanish value equals the Spanish dictionary entry.
  ok('lang: closeMenu resolves to the Spanish dictionary value',
     esValue === api.dict.es.common.closeMenu, 'got ' + esValue);
  // 2. Spanish differs from English (proves no fallback to English).
  ok('lang: Spanish closeMenu differs from English', esValue !== enValue, esValue + ' vs ' + enValue);
  // 3. Exact approved value.
  ok('lang: closeMenu Spanish value is the approved "Cerrar"', esValue === 'Cerrar', 'got ' + esValue);
  // 6. A truly missing key returns the key itself (current contract).
  ok('lang: a truly missing key returns the key itself (no crash)',
     api.t('es', 'legal', '__no_such_key__') === '__no_such_key__');
}

// 4 & 5. apply()/init() actually updates a data-i18n="closeMenu" element, and
// the applied text is the Spanish value, NOT the English one. We inject a node
// carrying data-i18n="closeMenu", run init in Spanish, and read it back.
{
  const dom = bootLang('privacy', 'https://plumline.online/privacy.html', makeStorage('ok', { plumline_lang: 'es' }));
  const w = dom.window;
  const node = w.document.createElement('span');
  node.setAttribute('data-i18n', 'closeMenu');
  node.textContent = 'PLACEHOLDER';
  w.document.body.appendChild(node);
  w.Plumline.i18n.init('legal');
  ok('lang: init updates a data-i18n="closeMenu" element', node.innerHTML === 'Cerrar', 'got ' + node.innerHTML);
  ok('lang: the applied closeMenu text is not the English value', node.innerHTML !== 'Close');
}

// NEGATIVE: mutate lookupTranslation to SKIP the active language (jump straight
// to English), then prove the "no accidental English" assertion fails. This
// confirms the check above is real, not vacuous.
{
  // Force the active-language lookup loop to start at English by rewriting the
  // resolution order line. The mutated module resolves every key in English.
  const mutated = i18n.replace(
    "if (!DICT[lang]) lang = 'en';\n    var order = ['common', page].concat(extra || []);",
    "lang = 'en';\n    var order = ['common', page].concat(extra || []);");
  ok('neg-i18n: the lookup line was found and mutated', mutated !== i18n);
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only', url: 'https://plumline.online/privacy.html' });
  const w = dom.window;
  Object.defineProperty(w, 'localStorage', {
    value: { getItem: function () { return null; }, setItem: function () {} }, configurable: true });
  w.eval(mutated);
  const esValueMutated = w.Plumline.i18n.t('es', 'legal', 'closeMenu');
  // With the mutation, Spanish resolves to the English value — so the real
  // assertion (esValue !== enValue) would FAIL. We assert that it DOES equal
  // English here, demonstrating the guard catches a forced-English fallback.
  ok('neg-i18n: forcing English makes Spanish closeMenu equal the English value',
     esValueMutated === 'Close', 'got ' + esValueMutated);
}

// Globals contract: each shared module is checked in isolation.
{
  // nav-menu.js in isolation adds no global.
  const dom1 = new JSDOM(composedHtml(siteDir, 'index.html'),
    { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const w1 = dom1.window;
  const before1 = Object.getOwnPropertyNames(w1);
  w1.eval(navmenu);
  w1.document.dispatchEvent(new w1.Event('DOMContentLoaded'));
  const added1 = Object.getOwnPropertyNames(w1).filter(function (k) { return before1.indexOf(k) === -1; });
  ok('globals: nav-menu.js adds no global', added1.length === 0, 'added=' + added1.join(','));

  // build-badge.js in isolation adds no global.
  const dom2 = new JSDOM('<!DOCTYPE html><html><body><footer><span id="buildBadge"></span></footer></body></html>',
    { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const w2 = dom2.window;
  w2.fetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ commit: 'x' }); } }); };
  const before2 = Object.getOwnPropertyNames(w2);
  w2.eval(badge);
  const added2 = Object.getOwnPropertyNames(w2).filter(function (k) { return before2.indexOf(k) === -1; });
  ok('globals: build-badge.js adds no global', added2.length === 0, 'added=' + added2.join(','));

  // i18n.js adds only Plumline (with .i18n), per existing behavior.
  const dom3 = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const w3 = dom3.window;
  Object.defineProperty(w3, 'localStorage', {
    value: { getItem: function () { return null; }, setItem: function () {} }, configurable: true });
  const before3 = Object.getOwnPropertyNames(w3);
  w3.eval(i18n);
  const added3 = Object.getOwnPropertyNames(w3).filter(function (k) { return before3.indexOf(k) === -1; });
  ok('globals: i18n.js adds only Plumline', added3.length === 1 && added3[0] === 'Plumline', 'added=' + added3.join(','));
  ok('globals: Plumline.i18n exists after i18n.js', !!(w3.Plumline && w3.Plumline.i18n));
}

// The runtime-only data-*-init attributes must NOT appear in the SOURCE HTML
// (they are set by JS at runtime, never authored, never built into dist).
{
  const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
  const ATTRS = ['data-nav-menu-init', 'data-lang-init', 'data-build-badge-init'];
  let leaks = [];
  PAGES.forEach(function (p) {
    const html = fs.readFileSync(path.join(siteDir, p + '.html'), 'utf8');
    ATTRS.forEach(function (a) { if (html.indexOf(a) !== -1) leaks.push(p + '.html:' + a); });
  });
  ok('globals: no data-*-init attribute appears in any source page', leaks.length === 0, 'leaks=' + leaks.join(','));
}

console.log('SHARED BEHAVIOR TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
