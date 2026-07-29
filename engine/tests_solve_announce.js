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

  function run(out, cb, model) {
    api.presentResult(out, model || { wholeNumbers: false });
    setTimeout(cb, 40);   // let announce()'s timer fire
  }

  // Domain-failure variants: engine says optimal, but a variable domain/bound
  // is violated. Verification must fail for each.
  const badBinary = {
    status: 'optimal', modelType: 'binary', objective: 5, objectiveLabel: 'Value',
    labels: ['a'], previous: [0], values: [1], constraints: [],
    variableDomains: [{ label: 'a', type: 'binary', value: 2, min: 0, max: 1, satisfied: false }],
    optimalityProven: true, plot: null
  };
  const badBounds = {
    status: 'optimal', modelType: 'continuous', objective: 50, objectiveLabel: 'Cost',
    labels: ['q'], previous: [0], values: [80], constraints: [],
    variableDomains: [{ label: 'q', type: 'continuous', value: 80, min: 0, max: 40, satisfied: false }],
    optimalityProven: true, plot: null
  };
  const feasibleOut = {
    status: 'feasible', modelType: 'integer', objective: 23, objectiveLabel: 'Crew',
    labels: ['n'], previous: [0], values: [23], stopReason: 'time_limit',
    constraints: [{ label: 'Coverage', used: 23, limit: 20, satisfied: true, binding: true }],
    variableDomains: [], optimalityProven: false, plot: null
  };

  run(goodOut, function () {
    ok('valid optimal announces exact summary',
       announceText() === 'Optimal solution found. Profit: 1,760', JSON.stringify(announceText()));
    ok('valid optimal keeps exportable result', !!document.getElementById('exp-csv'));

    run(feasibleOut, function () {
      ok('valid feasible announces the feasible summary',
         announceText() === 'Feasible solution found. Crew: 23', JSON.stringify(announceText()));

      run(badOut, function () {
        const t2 = announceText();
        ok('constraint breach does not announce success',
           !/solution found/i.test(t2 || ''), JSON.stringify(t2));
        ok('constraint breach announces the verify-failed message',
           /verification did not pass|do not rely/i.test(t2 || ''), JSON.stringify(t2));
        const html = document.getElementById('result').innerHTML;
        ok('constraint breach hides exports', !/id="exp-csv"/.test(html));
        ok('constraint breach shows failed mark', /check bad/.test(html));

        run(badBinary, function () {
          ok('binary-domain breach does not announce success',
             !/solution found/i.test(announceText() || ''), JSON.stringify(announceText()));
          ok('binary-domain breach announces verify-failed',
             /verification did not pass|do not rely/i.test(announceText() || ''));

          run(badBounds, function () {
            ok('bounds breach does not announce success',
               !/solution found/i.test(announceText() || ''), JSON.stringify(announceText()));
            ok('bounds breach announces verify-failed',
               /verification did not pass|do not rely/i.test(announceText() || ''));

            // Repeat the SAME successful result twice: the region must clear
            // between announcements so a screen reader re-announces it.
            run(goodOut, function () {
              ok('first repeat announces the summary',
                 announceText() === 'Optimal solution found. Profit: 1,760');
              api.presentResult(goodOut, { wholeNumbers: false });
              // Immediately after the call, announce() has cleared the region.
              ok('identical repeat clears the region before re-setting',
                 announceText() === '', JSON.stringify(announceText()));
              setTimeout(function () {
                ok('identical repeat re-sets the summary',
                   announceText() === 'Optimal solution found. Profit: 1,760');

                // Locale-aware number formatting across the five languages.
                ok('EN formats 1760 as 1,760', (api.setLang('en'), api.fmt(1760)) === '1,760');
                ok('DE formats 1760 as 1.760', (api.setLang('de'), api.fmt(1760)) === '1.760');
                ok('ES formats 12345 as 12.345', (api.setLang('es'), api.fmt(12345)) === '12.345');
                ok('PT formats 12345 with a non-comma group separator', (function () {
                  api.setLang('pt'); const f = api.fmt(12345);
                  return f.indexOf(',') === -1 && /12.?345/.test(f);
                })(), (api.setLang('pt'), api.fmt(12345)));
                ok('FR formats 12345 with a non-comma group separator', (function () {
                  api.setLang('fr'); const f = api.fmt(12345);
                  return f.indexOf(',') === -1 && /12.?345/.test(f);
                })(), (api.setLang('fr'), api.fmt(12345)));
                api.setLang('en');

                console.log('SOLVE ANNOUNCE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
                process.exit(fail > 0 ? 1 : 0);
              }, 40);
            });
          });
        });
      });
    });
  });
}, 100);
