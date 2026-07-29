/**
 * tests_nav_menu.js — behavioral test for the accessible mobile drawer
 * (assets/nav-menu.js), run against every real page's header in jsdom.
 *
 * Requires jsdom (pinned in package.json; CI runs `npm ci`). Missing jsdom is a
 * hard FAIL under CI (so a broken drawer can't ship) and a graceful skip locally.
 *
 * The script is evaluated with window.eval() inside the jsdom realm, so
 * location, URL, events and other globals are jsdom's — the URL/same-document
 * branch is exercised faithfully.
 *
 * Run: node engine/tests_nav_menu.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) {
    console.error('NAV MENU TESTS  FAILED: jsdom could not load under CI');
    console.error(e && e.message || e);
    process.exit(1);
  }
  console.log('NAV MENU TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const navmenu = fs.readFileSync(path.join(siteDir, 'assets', 'nav-menu.js'), 'utf8');
const EXPECTED = ['solver.html', 'index.html#addon', 'guide.html', 'examples.html', 'about.html'];
const PAGES = ['index.html', 'solver.html', 'guide.html', 'about.html', 'examples.html', 'privacy.html', 'terms.html'];

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } }

// Boot a page's real HTML in jsdom and run nav-menu.js INSIDE the jsdom realm
// (window.eval), so location/URL/events are jsdom's own globals.
function boot(html, url) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: url || 'https://plumline.online/solver.html' });
  const { window } = dom;
  window.eval(navmenu);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

function hasInertAncestor(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.inert === true || p.hasAttribute('inert')) return true;
  }
  return false;
}

// --- Part 1: every REAL page builds a body-level drawer with the 5 core hrefs.
PAGES.forEach(function (p) {
  const html = fs.readFileSync(path.join(siteDir, p), 'utf8');
  const dom = boot(html, 'https://plumline.online/' + p);
  const document = dom.window.document;
  const drawer = document.getElementById('mobile-menu');
  ok(p + ': drawer is built', !!drawer);
  if (!drawer) return;
  ok(p + ': drawer is a direct child of body', drawer.parentElement === document.body);
  const coreLinks = [...drawer.querySelectorAll('.mobile-menu-panel:not(.mobile-menu-onpage) > a')]
    .map(a => a.getAttribute('href'));
  ok(p + ': drawer holds exactly the 5 core links in order', coreLinks.join('|') === EXPECTED.join('|'));
  ok(p + ': drawer has a close button', !!drawer.querySelector('.mobile-menu-close'));
  // Only solver carries the "On this page" section; only #how; others none.
  const onpage = drawer.querySelector('.mobile-menu-onpage');
  if (p === 'solver.html') {
    ok('solver: drawer has On this page section', !!onpage);
    const opHrefs = onpage ? [...onpage.querySelectorAll('a')].map(a => a.getAttribute('href')) : [];
    ok('solver: On this page section holds only #how', opHrefs.length === 1 && opHrefs[0] === '#how');
  } else {
    ok(p + ': drawer has no On this page section', !onpage);
  }
});

// --- Part 2: full keyboard/focus/modal behavior on the real solver page.
const solverHtml = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const dom = boot(solverHtml, 'https://plumline.online/solver.html');
const window = dom.window, document = window.document;
const toggle = document.querySelector('.menu-toggle');
const drawer = document.getElementById('mobile-menu');
const panel = drawer.querySelector('.mobile-menu-panel');

ok('starts hidden', drawer.hasAttribute('hidden'));
ok('cloned links drop hide-sm', [...panel.querySelectorAll('a')].every(a => !a.classList.contains('hide-sm')));
ok('panel is a modal dialog', panel.getAttribute('role') === 'dialog' && panel.getAttribute('aria-modal') === 'true');
ok('drawer has no inert ancestor before open', !hasInertAncestor(drawer));
ok('nav-menu-ready class is set', document.documentElement.classList.contains('nav-menu-ready'));

// Open: focus in, background inert, scroll locked, drawer NOT inert.
toggle.dispatchEvent(new window.Event('click'));
ok('opens on click', !drawer.hasAttribute('hidden'));
ok('aria-expanded true', toggle.getAttribute('aria-expanded') === 'true');
const focusList = [...panel.querySelectorAll('a[href], button:not([disabled])')];
ok('focus moves to first focusable', document.activeElement === focusList[0]);
ok('body scroll locked', document.body.style.overflow === 'hidden');
const header = document.querySelector('header');
ok('background header is inert', header.inert === true);
ok('drawer itself is not inert when open', !hasInertAncestor(drawer) && drawer.inert !== true);

// Tab wrap both directions.
focusList[focusList.length - 1].focus();
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab' }));
ok('Tab from last wraps to first', document.activeElement === focusList[0]);
focusList[0].focus();
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
ok('Shift+Tab from first wraps to last', document.activeElement === focusList[focusList.length - 1]);

// Close button inside the dialog closes and returns focus.
const closeBtn = panel.querySelector('.mobile-menu-close');
closeBtn.dispatchEvent(new window.Event('click'));
ok('close button closes the drawer', drawer.hasAttribute('hidden'));
ok('focus returns to toggle after close button', document.activeElement === toggle);

// Escape closes, restores inert + scroll.
toggle.dispatchEvent(new window.Event('click'));
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
ok('Escape closes', drawer.hasAttribute('hidden'));
ok('body scroll restored', document.body.style.overflow === '');
ok('background header no longer inert', header.inert !== true);

// Same-document #how link: closes and moves focus to the target.
toggle.dispatchEvent(new window.Event('click'));
const howLink = [...panel.querySelectorAll('a')].find(a => a.getAttribute('href') === '#how');
ok('drawer contains the #how link', !!howLink);
if (howLink) {
  howLink.dispatchEvent(new window.Event('click', { bubbles: true }));
  ok('#how click closes the drawer', drawer.hasAttribute('hidden'));
  const howTarget = document.getElementById('how');
  ok('#how target exists on the page', !!howTarget);
  if (howTarget) ok('focus moved to #how target', document.activeElement === howTarget);
}

// Cross-document link closes the drawer.
toggle.dispatchEvent(new window.Event('click'));
const guideLink = [...panel.querySelectorAll('a')].find(a => a.getAttribute('href') === 'guide.html');
guideLink.dispatchEvent(new window.Event('click', { bubbles: true }));
ok('cross-document link click closes drawer', drawer.hasAttribute('hidden'));

// Backdrop closes.
toggle.dispatchEvent(new window.Event('click'));
drawer.querySelector('.mobile-menu-backdrop').dispatchEvent(new window.Event('click'));
ok('backdrop click closes drawer', drawer.hasAttribute('hidden'));

console.log('NAV MENU TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
