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

  // Names carry the CORRECT A1-style reference per cell (not all "A1"), and are
  // unique across the grid.
  function cellAt(r, c) { return document.querySelector('#grid input[data-r="' + r + '"][data-c="' + c + '"]'); }
  ok('A1 is labelled Celda A1', cellAt(0, 0) && cellAt(0, 0).getAttribute('aria-label') === 'Celda A1',
     cellAt(0, 0) && cellAt(0, 0).getAttribute('aria-label'));
  ok('B1 is labelled Celda B1', cellAt(0, 1) && cellAt(0, 1).getAttribute('aria-label') === 'Celda B1',
     cellAt(0, 1) && cellAt(0, 1).getAttribute('aria-label'));
  ok('A2 is labelled Celda A2', cellAt(1, 0) && cellAt(1, 0).getAttribute('aria-label') === 'Celda A2',
     cellAt(1, 0) && cellAt(1, 0).getAttribute('aria-label'));
  const names = [...cells].map(c => c.getAttribute('aria-label'));
  ok('all cell names are unique', new Set(names).size === names.length,
     names.length + ' cells, ' + new Set(names).size + ' unique');

  // Table semantics: the grid has a localized accessible name, column headers
  // carry scope="col", and row-number headers are <th scope="row">.
  const grid = document.getElementById('grid');
  ok('grid table has an accessible name', grid.getAttribute('aria-label') === 'Cuadrícula del modelo',
     grid.getAttribute('aria-label'));
  const colHeads = grid.querySelectorAll('th[scope="col"]');
  ok('column headers use scope="col"', colHeads.length >= 3, colHeads.length + ' col headers');
  const rowHeads = grid.querySelectorAll('th[scope="row"].rownum');
  ok('row numbers are th scope="row"', rowHeads.length >= 3, rowHeads.length + ' row headers');
  ok('no row number is a plain td', grid.querySelectorAll('td.rownum').length === 0);

  // The REAL user flow: changing the language <select> must relabel existing
  // cells, in every language, while preserving the cell's value and focus.
  const sel = document.getElementById('lang');
  const first = cellAt(0, 0);
  first.value = 'test value';
  first.focus();
  const cases = { de: 'Zelle A1', en: 'Cell A1', pt: 'Célula A1', fr: 'Cellule A1', es: 'Celda A1' };
  const gridLabels = { de: 'Modellraster', en: 'Spreadsheet model grid', pt: 'Grade do modelo', fr: 'Grille du modèle', es: 'Cuadrícula del modelo' };
  Object.keys(cases).forEach(function (lang) {
    sel.value = lang;
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    ok('selector relabels A1 in ' + lang, first.getAttribute('aria-label') === cases[lang],
       first.getAttribute('aria-label'));
    ok('selector relabels the table in ' + lang, grid.getAttribute('aria-label') === gridLabels[lang],
       grid.getAttribute('aria-label'));
    ok('document language is ' + lang, document.documentElement.lang === lang, document.documentElement.lang);
  });
  ok('language change preserved the cell value', first.value === 'test value', first.value);
  ok('language change preserved focus', document.activeElement === first);

  console.log('GRID A11Y TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 120);
