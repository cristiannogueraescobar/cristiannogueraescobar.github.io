/**
 * tests_region_plot.js — the 2-variable feasible-region plot must tell the
 * truth about unbounded regions. solve2D() detects whether the region recedes
 * to infinity; drawFeasibleRegion() then draws an OPEN band (never a closed
 * polygon that misrepresents an infinite region as finite).
 *
 * This drives the real inline solve2D() from solver.html (exposed via the
 * test-only hook) inside jsdom. Requires jsdom (CI installs it).
 *
 * Run: node engine/tests_region_plot.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('REGION PLOT TESTS  FAILED: jsdom missing under CI'); process.exit(1); }
  console.log('REGION PLOT TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const solverHtml = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const htmlNoExternal = solverHtml.replace(/<script src="assets\/[^"]*"[^>]*><\/script>/g, '');

const dom = new JSDOM(htmlNoExternal, {
  runScripts: 'dangerously',
  url: 'https://plumline.online/solver.html',
  beforeParse(window) {
    window.__PLUMLINE_TEST__ = true;
    window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, addListener() {} }; };
    window.scrollTo = window.scrollTo || function () {};
    if (window.Element) window.Element.prototype.scrollIntoView = function () {};
    window.console.log = function () {};
    window.console.warn = function () {};
    window.eval(i18nSrc);
  }
});
const { window } = dom;

setTimeout(function () {
  const api = window.__plumline;
  if (!api || !api.solve2D) { console.log('REGION PLOT TESTS  FAILED: test hook not installed'); process.exit(1); }
  const solve2D = api.solve2D;
  const obj = { x: 1, y: 1 };

  // BOUNDED region: x <= 4, y <= 3 (plus x,y >= 0). A closed quadrilateral, no
  // recession direction — must NOT be flagged unbounded.
  {
    const cons = [
      { x: 1, y: 0, op: '<=', b: 4 },
      { x: 0, y: 1, op: '<=', b: 3 },
    ];
    const geo = solve2D(obj, cons);
    ok('bounded region: has vertices', geo.vertices.length >= 3, JSON.stringify(geo.vertices));
    ok('bounded region: NOT flagged unbounded', geo.unbounded === false, String(geo.unbounded));
  }

  // UNBOUNDED region: only x <= 5 (y free upward), plus x,y >= 0. The region
  // extends to infinity along +y, so a recession direction exists and the flag
  // must be set. (The objective may still be bounded; that's a separate fact —
  // this is about the SHAPE of the feasible set.)
  {
    const cons = [
      { x: 1, y: 0, op: '<=', b: 5 },
    ];
    const geo = solve2D(obj, cons);
    ok('unbounded region: flagged unbounded', geo.unbounded === true, String(geo.unbounded));
    ok('unbounded region: has a recession direction', !!geo.recession &&
       (geo.recession.x > 1e-9 || geo.recession.y > 1e-9), JSON.stringify(geo.recession));
  }

  // UNBOUNDED with a bounded optimum: minimise-style feasible set x + y >= 2
  // (plus x,y >= 0) is unbounded above, yet a minimum exists. The region SHAPE
  // is still unbounded and must be flagged so the plot never closes it.
  {
    const cons = [
      { x: 1, y: 1, op: '>=', b: 2 },
    ];
    const geo = solve2D(obj, cons);
    ok('half-plane region: flagged unbounded', geo.unbounded === true, String(geo.unbounded));
  }

  console.log('REGION PLOT TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 120);
