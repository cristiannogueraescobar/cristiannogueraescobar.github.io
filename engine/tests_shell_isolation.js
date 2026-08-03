/* tests_shell_isolation.js — B2 isolation guards + the reusable checker.
 *
 * checkShellIsolation(siteDir) runs the OFFICIAL isolation validation against a
 * site tree and returns { pass, fail, failures }. Both this positive suite and
 * the negative suite (tests_shared_behavior_negative.js) call this SAME function
 * — the negatives mutate a temp tree and assert fail > 0 with a message naming
 * the mutation, so no regex is duplicated across suites.
 *
 * The checks prove:
 *   - only solver.html carries the inline engine (ENGINE_START..ENGINE_END) and
 *     the Worker/solve code; the other seven pages carry NONE of it;
 *   - informational pages carry no solver-only markers;
 *   - the shared behavior modules (nav-menu.js, build-badge.js, i18n.js) contain
 *     no engine/Worker/solver code, fetch no HTML fragment, and never rebuild the
 *     shell via innerHTML;
 *   - shared scripts load on all 8 pages; page-specific scripts load only where
 *     they belong.
 *
 * Static analysis of real page HTML and asset sources. No jsdom, no server.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
const INFORMATIONAL = ['index', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
const SHARED_MODULES = ['nav-menu.js', 'build-badge.js', 'i18n.js'];
const SOLVER_ONLY_MARKERS = [
  'drawFeasibleRegion', 'solve2D', 'exportCSV', 'exportExcel', 'sheetFromGrid',
  'ENGINE_START', 'new Worker'
];

// The single, official isolation checker. Returns a structured result so both
// the positive suite and the negative suite run exactly the same validation.
function checkShellIsolation(siteDir) {
  let pass = 0, fail = 0;
  const failures = [];
  function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }

  function read(p) { return fs.readFileSync(path.join(siteDir, p + '.html'), 'utf8'); }
  function readAsset(name) { return fs.readFileSync(path.join(siteDir, 'assets', name), 'utf8'); }

  // Engine / Worker live only in solver.html. E1: the engine is composed into
  // solver.html from the internal canonical file, so check the COMPOSED solver
  // for the engine; informational pages are still checked raw (they must never
  // carry it, composed or not).
  const { composedHtml } = require('./composed-html.js');
  PAGES.forEach(function (p) {
    const html = p === 'solver' ? composedHtml(siteDir, 'solver.html') : read(p);
    const hasEngine = /\/\*\s*ENGINE_START\s*\*\//.test(html);
    const hasWorker = /new\s+Worker\s*\(|buildWorker|engineSource|solveModel_|detectModel_/.test(html);
    if (p === 'solver') {
      check('solver.html carries the inline engine', hasEngine);
      check('solver.html carries the Worker/solve code', hasWorker);
    } else {
      check(p + '.html has NO inline engine', !hasEngine);
      check(p + '.html has NO Worker/solve code', !hasWorker);
    }
  });

  // Informational pages carry no solver-only markers.
  INFORMATIONAL.forEach(function (p) {
    const html = read(p);
    SOLVER_ONLY_MARKERS.forEach(function (m) {
      check(p + '.html does not contain solver marker "' + m + '"', html.indexOf(m) === -1);
    });
  });

  // Shared modules contain no solver/engine code, no Worker, no fragment fetch,
  // no innerHTML shell rebuild.
  SHARED_MODULES.forEach(function (name) {
    const src = readAsset(name);
    check(name + ': contains no ENGINE_START marker', !/ENGINE_START/.test(src));
    check(name + ': does not create a Worker', !/new\s+Worker\s*\(/.test(src));
    check(name + ': does not import solver/engine functions',
      !/solveModel_|detectModel_|optimise_|solveLinearProgram_/.test(src));
    const fetchesHtml = /fetch\([^)]*\.html/.test(src) || /fetch\([^)]*header|fetch\([^)]*footer/.test(src);
    check(name + ': does not fetch an HTML fragment', !fetchesHtml);
    const rebuildsShell = /(header|footer|\.mast|\.top)\b[^;]*\.innerHTML\s*=/.test(src);
    check(name + ': does not rebuild the shell via innerHTML', !rebuildsShell);
  });

  // build-badge.js fetches build-info.json only (JSON), which is allowed.
  check('build-badge.js: fetches build-info.json (JSON, not a fragment)',
    /fetch\(\s*['"]build-info\.json['"]/.test(readAsset('build-badge.js')));

  // Shared scripts load on all 8 pages; page-specific scripts only where they belong.
  function loaders(scriptSubstr) {
    return PAGES.filter(function (p) { return read(p).indexOf(scriptSubstr) !== -1; }).sort();
  }
  check('i18n.js loads on all 8 pages', loaders('i18n.js').length === 8);
  check('nav-menu.js loads on all 8 pages', loaders('nav-menu.js').length === 8);
  check('build-badge.js loads on all 8 pages', loaders('build-badge.js').length === 8);
  check('examples-data.js loads on exactly solver + examples',
    loaders('examples-data.js').join(',') === ['examples', 'solver'].sort().join(','));
  check('cap-lightbox.js loads on capabilities only',
    loaders('cap-lightbox.js').join(',') === 'capabilities');

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkShellIsolation: checkShellIsolation };

// When run directly, execute the checker against the real tree and report.
if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const result = checkShellIsolation(siteDir);
  result.failures.forEach(function (f) { console.log('  FAIL:', f); });
  console.log('SHELL ISOLATION TESTS  PASSED: ' + result.pass + '   FAILED: ' + result.fail);
  process.exit(result.fail ? 1 : 0);
}
