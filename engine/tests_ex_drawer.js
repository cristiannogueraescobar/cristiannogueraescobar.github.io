/**
 * tests_ex_drawer.js — focus management for the solver's Examples drawer
 * (#exDrawer). It is a modal dialog: opening must move focus INTO it, the
 * background must be inert with scroll locked, Escape/close must return focus to
 * the trigger, and none of the drawer's own controls may sit under an inert
 * ancestor. Mirrors the guarantees the mobile nav drawer already has.
 *
 * Requires jsdom (CI installs it). Skips locally without it.
 *
 * Run: node engine/tests_ex_drawer.js
 */
const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('EX DRAWER TESTS  FAILED: jsdom missing under CI'); process.exit(1); }
  console.log('EX DRAWER TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const solverHtml = composedHtml(siteDir, 'solver.html');  // DOM/drawer test -> composed shell
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
const exSrc = fs.readFileSync(path.join(siteDir, 'assets', 'examples-data.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// jsdom doesn't fetch external <script src>; strip them and inject manually.
const htmlNoExternal = solverHtml.replace(/<script src="assets\/[^"]*"[^>]*><\/script>/g, '');

const dom = new JSDOM(htmlNoExternal, {
  runScripts: 'dangerously',
  url: 'https://plumline.online/solver.html',
  beforeParse(window) {
    window.__PLUMLINE_TEST__ = true;
    window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, addListener() {} }; };
    window.scrollTo = window.scrollTo || function () {};
    if (window.Element) window.Element.prototype.scrollIntoView = function () {};
    window.console.log = function () {}; window.console.warn = function () {};
    window.eval(i18nSrc);
    window.eval(exSrc);   // provides window.PL_EXAMPLE_META → EXAMPLES_OK true
  }
});
const { window } = dom;

function hasInertAncestor(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.inert === true || p.hasAttribute('inert')) return true;
  }
  return false;
}

setTimeout(function () {
  const api = window.__plumline;
  if (!api || !api.openDrawer) { console.log('EX DRAWER TESTS  FAILED: hook not installed'); process.exit(1); }
  const document = window.document;
  const drawer = document.getElementById('exDrawer');
  const openBtn = document.getElementById('openExamples');
  const closeBtn = document.getElementById('closeExamples');

  ok('drawer exists and is a dialog', drawer && drawer.getAttribute('role') === 'dialog' && drawer.getAttribute('aria-modal') === 'true');
  ok('drawer starts hidden', drawer.hidden === true);
  ok('drawer is a direct child of body', drawer.parentElement === document.body);

  // Focus the trigger, then open.
  openBtn.focus();
  api.openDrawer();
  ok('opening reveals the drawer', drawer.hidden === false);
  ok('opening sets aria-expanded on the trigger', openBtn.getAttribute('aria-expanded') === 'true');
  ok('opening moves focus into the drawer (close button)', document.activeElement === closeBtn);
  ok('opening locks body scroll', document.body.style.overflow === 'hidden');
  ok('background is inert while open', document.querySelector('header').inert === true);
  ok('drawer has no inert ancestor while open', !hasInertAncestor(drawer) && drawer.inert !== true);

  // Escape closes and returns focus.
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  ok('Escape closes the drawer', drawer.hidden === true);
  ok('closing returns focus to the trigger', document.activeElement === openBtn);
  ok('closing clears aria-expanded', openBtn.getAttribute('aria-expanded') === 'false');
  ok('closing restores body scroll', document.body.style.overflow === '');
  ok('closing restores background inert', document.querySelector('header').inert !== true);

  // Close button also closes and returns focus.
  api.openDrawer();
  closeBtn.dispatchEvent(new window.Event('click'));
  ok('close button closes the drawer', drawer.hidden === true);
  ok('close button returns focus to trigger', document.activeElement === openBtn);

  // Tab trap: focus wraps within the drawer, both directions. Use the same
  // focusable selector the solver's trap uses.
  api.openDrawer();
  const focusables = drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  ok('drawer has at least two focusables to trap', focusables.length >= 2, focusables.length + ' focusables');
  if (focusables.length >= 2) {
    const first = focusables[0], last = focusables[focusables.length - 1];
    last.focus();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    ok('Tab wraps from last to first', document.activeElement === first);
    first.focus();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    ok('Shift+Tab wraps from first to last', document.activeElement === last);
  }

  // Backdrop click closes and returns focus to the trigger.
  if (!drawer.hidden) { /* still open from the trap test */ }
  else api.openDrawer();
  document.getElementById('exDrawerBackdrop').dispatchEvent(new window.Event('click'));
  ok('backdrop click closes the drawer', drawer.hidden === true);
  ok('backdrop click returns focus to trigger', document.activeElement === openBtn);

  console.log('EX DRAWER TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 100);
