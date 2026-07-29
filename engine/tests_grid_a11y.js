/**
 * tests_grid_a11y.js — accessibility of the solver's spreadsheet grid:
 *   - every cell input has a localized accessible name ("Cell A1" / "Celda A1")
 *   - switching language updates existing cell names without a full re-render
 *   - the grid provides a visible keyboard focus indicator (focus-visible ring)
 *
 * Requires jsdom (CI installs it). Skips locally without it.
 *
 * Run: node engine/tests_grid_a11y.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('GRID A11Y TESTS  FAILED: jsdom missing under CI'); process.exit(1); }
  console.log('GRID A11Y TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const solverHtml = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Static CSS check: a focus-visible ring on grid inputs (not just a bg tint).
ok('grid inputs have a focus-visible outline',
   /table\.grid input:focus-visible\s*\{[^}]*outline:/.test(solverHtml),
   'focus-visible rule with outline');

function boot(url) {
  const html = solverHtml.replace(/<script src="assets\/[^"]*"[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: url,
    beforeParse(window) {
      window.__PLUMLINE_TEST__ = true;
      window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, addListener() {} }; };
      window.scrollTo = window.scrollTo || function () {};
      if (window.Element) window.Element.prototype.scrollIntoView = function () {};
      window.console.log = function () {}; window.console.warn = function () {};
      window.eval(i18nSrc);
    }
  });
  return dom;
}

const dom = boot('https://plumline.online/solver.html?lang=es');
const { window } = dom;

setTimeout(function () {
  const document = window.document;
  const cells = document.querySelectorAll('#grid input[data-r]');
  ok('grid has cell inputs', cells.length > 0, cells.length + ' cells');

  // Every cell has a non-empty accessible name.
  let allNamed = cells.length > 0;
  cells.forEach(c => { if (!c.getAttribute('aria-label')) allNamed = false; });
  ok('every cell input has an accessible name', allNamed);

  // The name is localized (Spanish "Celda", not English "Cell") and carries the
  // A1-style reference.
  const first = cells[0];
  ok('cell name is localized to Spanish', /^Celda\s+A1$/.test(first.getAttribute('aria-label')),
     first.getAttribute('aria-label'));

  // Switching language updates existing cell names in place.
  const api = window.__plumline;
  if (api && window.applyLang) {
    window.applyLang('de');
    ok('switching language relabels cells (German)', /^Zelle\s+A1$/.test(first.getAttribute('aria-label')),
       first.getAttribute('aria-label'));
    window.applyLang('en');
    ok('switching back relabels cells (English)', /^Cell\s+A1$/.test(first.getAttribute('aria-label')),
       first.getAttribute('aria-label'));
  } else {
    // applyLang is global on the page; call via the language dropdown instead.
    const sel = document.getElementById('lang');
    sel.value = 'de'; sel.dispatchEvent(new window.Event('change'));
    ok('switching language relabels cells (German)', /^Zelle\s+A1$/.test(first.getAttribute('aria-label')),
       first.getAttribute('aria-label'));
  }

  console.log('GRID A11Y TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 120);
