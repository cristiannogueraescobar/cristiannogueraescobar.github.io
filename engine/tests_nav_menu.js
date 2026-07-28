/**
 * tests_nav_menu.js — behavioral test for the accessible mobile drawer
 * (assets/nav-menu.js), plus a check against every real page's header.
 *
 * Requires jsdom (pinned in package.json; CI runs `npm ci`). If jsdom is
 * missing it prints SKIPPED and exits 0; run_all.js surfaces the skip in its
 * summary so "all green" is never silently incomplete.
 *
 * Run: node engine/tests_nav_menu.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('NAV MENU TESTS  SKIPPED (jsdom not installed — run npm ci)'); process.exit(0); }

const siteDir = path.join(__dirname, '..');
const navmenu = fs.readFileSync(path.join(siteDir, 'assets', 'nav-menu.js'), 'utf8');
const EXPECTED = ['solver.html', 'index.html#addon', 'guide.html', 'examples.html', 'about.html'];
const PAGES = ['index.html', 'solver.html', 'guide.html', 'about.html', 'examples.html', 'privacy.html', 'terms.html'];

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } }

// Boot a page's real HTML in jsdom, run nav-menu.js, return { window, document }.
function boot(html) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const { window } = dom;
  const document = window.document;
  new Function('window', 'document', navmenu)(window, document);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { window, document };
}

// --- Part 1: every REAL page builds a drawer with exactly the five core hrefs.
PAGES.forEach(function (p) {
  const html = fs.readFileSync(path.join(siteDir, p), 'utf8');
  const { document } = boot(html);
  const drawer = document.getElementById('mobile-menu');
  ok(p + ': drawer is built', !!drawer);
  if (!drawer) return;
  const primaryLinks = [...drawer.querySelectorAll('.mobile-menu-panel:not(.mobile-menu-onpage) > a')]
    .map(a => a.getAttribute('href'));
  ok(p + ': drawer holds exactly the 5 core links in order',
     primaryLinks.join('|') === EXPECTED.join('|'));
});

// --- Part 2: full keyboard/focus behavior, driven on the real solver page.
const solverHtml = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const { window, document } = boot(solverHtml);
const toggle = document.querySelector('.menu-toggle');
const drawer = document.getElementById('mobile-menu');
const panel = drawer.querySelector('.mobile-menu-panel');

ok('starts hidden', drawer.hasAttribute('hidden'));
ok('cloned links drop hide-sm', [...panel.querySelectorAll('a')].every(a => !a.classList.contains('hide-sm')));
ok('panel is a modal dialog', panel.getAttribute('role') === 'dialog' && panel.getAttribute('aria-modal') === 'true');

// Open on click; focus moves in; background is inert; scroll locked.
toggle.dispatchEvent(new window.Event('click'));
ok('opens on click', !drawer.hasAttribute('hidden'));
ok('aria-expanded true', toggle.getAttribute('aria-expanded') === 'true');
const focusList = [...panel.querySelectorAll('a[href]')];
ok('focus moves to first link', document.activeElement === focusList[0]);
ok('body scroll locked', document.body.style.overflow === 'hidden');
const header = document.querySelector('header');
ok('background header is inert', header.inert === true);

// Tab from last wraps to first; Shift+Tab from first wraps to last.
focusList[focusList.length - 1].focus();
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab' }));
ok('Tab from last wraps to first', document.activeElement === focusList[0]);
focusList[0].focus();
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
ok('Shift+Tab from first wraps to last', document.activeElement === focusList[focusList.length - 1]);

// Escape closes, returns focus, restores inert + scroll.
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
ok('Escape closes', drawer.hasAttribute('hidden'));
ok('focus returns to toggle', document.activeElement === toggle);
ok('body scroll restored', document.body.style.overflow === '');
ok('background header no longer inert', header.inert !== true);

// Second click on Menu reopens then closes (toggle behavior).
toggle.dispatchEvent(new window.Event('click'));
ok('reopens on second click', !drawer.hasAttribute('hidden'));
toggle.dispatchEvent(new window.Event('click'));
ok('closes on toggle click', drawer.hasAttribute('hidden'));

// Click a cross-document link closes the drawer.
toggle.dispatchEvent(new window.Event('click'));
const guideLink = [...panel.querySelectorAll('a')].find(a => a.getAttribute('href') === 'guide.html');
guideLink.dispatchEvent(new window.Event('click', { bubbles: true }));
ok('cross-document link click closes drawer', drawer.hasAttribute('hidden'));

// Backdrop click closes.
toggle.dispatchEvent(new window.Event('click'));
drawer.querySelector('.mobile-menu-backdrop').dispatchEvent(new window.Event('click'));
ok('backdrop click closes drawer', drawer.hasAttribute('hidden'));

console.log('NAV MENU TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
