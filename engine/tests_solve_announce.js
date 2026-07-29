/**
 * tests_solve_announce.js — the spoken announcement must never contradict the
 * visible receipt. In particular, if the defensive verification fails, the live
 * region must say "verification failed", NOT "optimal/feasible solution found".
 *
 * Drives the real presentResult() from solver.html (via a test-only hook) with
 * crafted engine output, inside jsdom. Requires jsdom (CI installs it).
 *
 * Run: node engine/tests_solve_announce.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('SOLVE ANNOUNCE TESTS  FAILED: jsdom missing under CI'); process.exit(1); }
  console.log('SOLVE ANNOUNCE TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const solverHtml = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// jsdom doesn't fetch external <script src>, so strip them from the HTML and
// inject i18n.js manually before the inline solver script runs.
const htmlNoExternal = solverHtml.replace(/<script src="assets\/[^"]*"[^>]*><\/script>/g, '');

// Boot the real solver page with scripts running inside jsdom. Set the test
// flag BEFORE scripts run so the hook is installed.
const dom = new JSDOM(htmlNoExternal, {
  runScripts: 'dangerously',
  url: 'https://plumline.online/solver.html',
  beforeParse(window) {
    window.__PLUMLINE_TEST__ = true;
    window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, addListener() {} }; };
    window.scrollTo = window.scrollTo || function () {};
    if (window.Element) window.Element.prototype.scrollIntoView = function () {};
    // Quiet the solver's own init logging (examples metadata not injected here).
    window.console.log = function () {};
    window.console.warn = function () {};
    // Provide Plumline.i18n before the inline solver script executes.
    window.eval(i18nSrc);
  }
});
const { window } = dom;

// Give the deferred/inline scripts a tick to run.
setTimeout(function () {
  const api = window.__plumline;
  if (!api) { console.log('SOLVE ANNOUNCE TESTS  FAILED: test hook not installed'); process.exit(1); }
  const document = window.document;
  const announceEl = document.getElementById('solveAnnounce');

  function announceText() { return announceEl ? announceEl.textContent : null; }
  // announce() clears then sets on a 20ms timer; flush it synchronously by
  // reading after advancing. We call presentResult then wait a tick.

  // A helper out that PASSES verification: one satisfied constraint, no domains.
  const goodOut = {
    status: 'optimal', modelType: 'continuous', objective: 1760,
    objectiveLabel: 'Profit', labels: ['x', 'y'], previous: [0, 0], values: [10, 20],
    constraints: [{ label: 'Labour', used: 100, limit: 100, satisfied: true, binding: true }],
    variableDomains: [], optimalityProven: true, plot: null
  };
  // A helper out that FAILS verification: a constraint is not satisfied, even
  // though the engine reported optimal.
  const badOut = {
    status: 'optimal', modelType: 'continuous', objective: 9999,
    objectiveLabel: 'Profit', labels: ['x'], previous: [0], values: [999],
    constraints: [{ label: 'Labour', used: 500, limit: 100, satisfied: false, binding: false }],
    variableDomains: [], optimalityProven: true, plot: null
  };

  function run(out, cb) {
    api.presentResult(out, { wholeNumbers: false });
    setTimeout(cb, 40);   // let announce()'s timer fire
  }

  run(goodOut, function () {
    const txt = announceText();
    ok('valid optimal announces success', /optimal|feasible|Profit|1,760|1760/i.test(txt), JSON.stringify(txt));
    ok('valid optimal does NOT announce failure', !/fail|couldn|not verif/i.test(txt || ''), JSON.stringify(txt));
    ok('valid optimal keeps exportable result', !!window.lastResult || document.getElementById('exp-csv'),
       'exports present');

    run(badOut, function () {
      const txt2 = announceText();
      ok('verification failure does NOT announce optimal',
         !/optimal solution found|feasible solution found/i.test(txt2 || ''), JSON.stringify(txt2));
      ok('verification failure announces a failure message',
         /fail|couldn|not verif|verif/i.test(txt2 || ''), JSON.stringify(txt2));
      // Exports must be gone and the visible receipt must show the failure mark.
      const html = document.getElementById('result').innerHTML;
      ok('verification failure hides exports', !/id="exp-csv"/.test(html));
      ok('verification failure shows failed mark visually', /check bad/.test(html));

      console.log('SOLVE ANNOUNCE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
      process.exit(fail > 0 ? 1 : 0);
    });
  });
}, 100);
