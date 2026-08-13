/* tests_f7a_portability.js — F7a WINDOWS PORTABILITY audit (permanent).
 *
 * Two guarantees for the F7a tooling added in Phase 3:
 *   1. Static audit: none of the new F7a suites (or the shared solve/verify helper) use shell-based
 *      process execution or POSIX shell utilities (cp/rm/mv/sed/grep/bash/sh), and none uses
 *      execSync/exec with a shell string — only Node built-ins. This keeps them runnable on Windows
 *      PowerShell where those utilities and shell semantics differ.
 *   2. Spaced-path execution: the pure F7a suites run correctly when the whole project tree lives
 *      under a directory whose name contains spaces (a classic Windows breakage). The catalogue is
 *      loaded and the positive/engine/search/negative/tranche suites are executed against the copy.
 *
 * All file operations use fs.* built-ins (cpSync/mkdtempSync/rmSync) and execFileSync(process.execPath)
 * — never a shell string.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// ---- 1. static audit of the new F7a tooling -------------------------------
const NEW_TOOLING = [
  'tests_f7a_examples_24.js', 'tests_f7a_examples_engine.js', 'tests_f7a_examples_search.js',
  'tests_f7a_examples_browser.js', 'tests_f7a_tranche_baseline.js', 'tests_f7a_tranche_baseline_negative.js',
  'tests_f7a_examples_negative.js', 'f5-solve-verify.js', 'tests_canonical_engine_source_separation.js',
];
// NB: this suite (tests_f7a_portability.js) is intentionally NOT self-scanned — its FORBIDDEN list
// contains the very literals it searches for, which would be false positives.
const FORBIDDEN = [
  { re: /\bexecSync\s*\(/, name: 'execSync' },
  { re: /\.exec\s*\(/, name: 'child_process.exec' },
  { re: /shell\s*:\s*true/, name: 'shell:true' },
  { re: /(['"`])(?:cp|rm|mv|sed|grep|bash|sh|awk)\s/, name: 'POSIX shell utility literal' },
];
NEW_TOOLING.forEach(function (f) {
  var fp = path.join(SITE, 'engine', f);
  if (!fs.existsSync(fp)) { ok('PORT: tooling present ' + f, false); return; }
  var t = fs.readFileSync(fp, 'utf8');
  FORBIDDEN.forEach(function (rule) {
    ok('PORT: ' + f + ' free of ' + rule.name, !rule.re.test(t));
  });
  // execFileSync is allowed ONLY with process.execPath (never a shell string).
  var execFileCalls = t.match(/execFileSync\s*\(([^,]+),/g) || [];
  var allProcessExec = execFileCalls.every(function (c) { return c.indexOf('process.execPath') !== -1; });
  ok('PORT: ' + f + ' any execFileSync uses process.execPath', allProcessExec, execFileCalls.join(' | '));
});

// ---- 2. spaced-path execution ---------------------------------------------
(function () {
  var base = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline port '));  // note the spaces
  ok('PORT: temp base path contains a space', base.indexOf(' ') !== -1, base);
  try {
    // Copy the minimum tree the pure F7a suites need: src, engine, assets, docs.
    ['src', 'engine', 'assets', 'docs'].forEach(function (d) {
      fs.cpSync(path.join(SITE, d), path.join(base, d), { recursive: true });
    });
    // Copy solver.html + examples.html so any HTML reads resolve.
    ['solver.html', 'examples.html'].forEach(function (f) {
      if (fs.existsSync(path.join(SITE, f))) fs.cpSync(path.join(SITE, f), path.join(base, f));
    });

    // Catalogue loads from the spaced path.
    var loadPath = path.join(base, 'src', 'shared', 'examples', 'index.js');
    var spaced = require(loadPath).loadAndValidateCatalogue(base);
    ok('PORT: catalogue loads from a spaced path', spaced.catalogue.length === 24, String(spaced.catalogue.length));

    // Run the pure F7a suites (no browser) from the spaced copy via execFileSync(process.execPath).
    ['tests_f7a_examples_24', 'tests_f7a_examples_engine', 'tests_f7a_examples_search', 'tests_f7a_examples_negative', 'tests_f7a_tranche_baseline', 'tests_f7a_tranche_baseline_negative'].forEach(function (s) {
      var out = '';
      var code = 0;
      try { out = execFileSync(process.execPath, [path.join(base, 'engine', s + '.js')], { encoding: 'utf8' }); }
      catch (e) { out = (e.stdout || '') + (e.stderr || ''); code = 1; }
      var m = out.match(/PASSED:\s*(\d+)\s+FAILED:\s*(\d+)/);
      ok('PORT: ' + s + ' passes from a spaced path', !!m && Number(m[2]) === 0 && code === 0, m ? ('F:' + m[2]) : out.split('\n').slice(-2).join(' '));
    });
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
})();

console.log('F7A PORTABILITY  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
