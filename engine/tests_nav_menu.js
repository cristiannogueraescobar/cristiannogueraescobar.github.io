/**
 * tests_nav_menu.js — behavioral test for the accessible mobile drawer
 * (assets/nav-menu.js). Static structure is covered in tests_structure.js;
 * this exercises the actual keyboard/focus behavior in a simulated DOM.
 *
 * Requires jsdom. If jsdom isn't installed it skips (prints SKIPPED and exits 0)
 * so the core suite never depends on an optional package. Run explicitly with
 * jsdom present to verify the drawer.
 *
 * Run: node engine/tests_nav_menu.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('NAV MENU TESTS  SKIPPED (jsdom not installed)');
  process.exit(0);
}

const navmenu = fs.readFileSync(path.join(__dirname, '..', 'assets', 'nav-menu.js'), 'utf8');
const html = `<!DOCTYPE html><html><body>
<header><div class="header-actions">
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu">Menu</button>
  <nav class="nav" aria-label="Primary" data-i18n-aria="ariaPrimary">
    <a href="solver.html" class="hide-sm" data-i18n="navSolver">Solver</a>
    <a href="index.html#addon" class="hide-sm" data-i18n="navAddon">Add-on</a>
    <a href="guide.html" class="hide-sm" data-i18n="navGuide">Guide</a>
    <a href="examples.html" class="hide-sm" data-i18n="navExamples">Examples</a>
    <a href="about.html" class="hide-sm" data-i18n="navAbout">About</a>
  </nav>
  <select id="lang" aria-label="Language"></select>
</div></header>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'outside-only' });
const { window } = dom;
const document = window.document;
new Function('window', 'document', navmenu)(window, document);
document.dispatchEvent(new window.Event('DOMContentLoaded'));

const toggle = document.querySelector('.menu-toggle');
const drawer = document.getElementById('mobile-menu');
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } }

ok('drawer is created', !!drawer);
ok('drawer starts hidden', drawer.hasAttribute('hidden'));
ok('drawer clones exactly 5 core links', drawer.querySelectorAll('.mobile-menu-panel a').length === 5);
ok('drawer links match Primary order',
   [...drawer.querySelectorAll('a')].map(a => a.getAttribute('href')).join('|') ===
   'solver.html|index.html#addon|guide.html|examples.html|about.html');
ok('drawer panel keeps the Primary label', drawer.querySelector('.mobile-menu-panel').getAttribute('aria-label') === 'Primary');
ok('cloned links drop hide-sm', [...drawer.querySelectorAll('a')].every(a => !a.classList.contains('hide-sm')));

// Open via click (Enter/Space work natively on a <button>).
toggle.dispatchEvent(new window.Event('click'));
ok('opens on trigger click', !drawer.hasAttribute('hidden'));
ok('aria-expanded is true when open', toggle.getAttribute('aria-expanded') === 'true');
ok('focus moves to the first drawer link', document.activeElement === drawer.querySelector('.mobile-menu-panel a'));

// Escape closes and returns focus to the trigger.
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
ok('Escape closes the drawer', drawer.hasAttribute('hidden'));
ok('aria-expanded is false after close', toggle.getAttribute('aria-expanded') === 'false');
ok('focus returns to the trigger', document.activeElement === toggle);

// Backdrop click closes too.
toggle.dispatchEvent(new window.Event('click'));
drawer.querySelector('.mobile-menu-backdrop').dispatchEvent(new window.Event('click'));
ok('backdrop click closes the drawer', drawer.hasAttribute('hidden'));

console.log('NAV MENU TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
