/* tests_spaces_path.js — Windows-portability contract.
 *
 * Proves the FAQ generator (and, by the same mechanism, any generator invoked via
 * execFileSync) runs correctly when the repo path CONTAINS A SPACE, e.g.
 *   C:\...\UNIVERSIDAD CRISTIAN\YEAR 1\...
 * A concatenated shell string (`execSync('node ' + path)`) would break there; the
 * argv-array form (`execFileSync(process.execPath, [scriptPath, '--check'])`) does
 * not. We copy the minimal files gen_home_faq.js needs into a temp dir whose path
 * contains a space, run the generator two ways, and assert the argv form succeeds.
 *
 * Temp dirs are always removed. No HTTP server. No open handles.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const siteDir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Build a temp working tree under a path WITH A SPACE, containing exactly what
// gen_home_faq.js --check reads: engine/gen_home_faq.js, index.html, assets/i18n.js.
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'plum spaces ')); // has a space
try {
  ok('temp base path contains a space', / /.test(base));
  fs.mkdirSync(path.join(base, 'engine'), { recursive: true });
  fs.mkdirSync(path.join(base, 'assets'), { recursive: true });
  // Copy the generator and any engine helper it requires (best-effort: copy the
  // whole engine dir so relative requires resolve).
  for (const f of fs.readdirSync(path.join(siteDir, 'engine'))) {
    const src = path.join(siteDir, 'engine', f);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(base, 'engine', f));
  }
  fs.copyFileSync(path.join(siteDir, 'index.html'), path.join(base, 'index.html'));
  fs.copyFileSync(path.join(siteDir, 'assets', 'i18n.js'), path.join(base, 'assets', 'i18n.js'));
  // Copy any other assets the generator may read.
  for (const f of fs.readdirSync(path.join(siteDir, 'assets'))) {
    const src = path.join(siteDir, 'assets', f);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(base, 'assets', f));
  }
  // Copy data/ (gen_home_faq.js reads data/home-faq.json).
  const dataDir = path.join(siteDir, 'data');
  if (fs.existsSync(dataDir)) {
    fs.mkdirSync(path.join(base, 'data'), { recursive: true });
    for (const f of fs.readdirSync(dataDir)) {
      const src = path.join(dataDir, f);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(base, 'data', f));
    }
  }

  const gen = path.join(base, 'engine', 'gen_home_faq.js');

  // 1. The argv-array form (what the suites now use) must succeed from a spaced path.
  let argvOk = true, argvErr = '';
  try {
    execFileSync(process.execPath, [gen, '--check'], { cwd: base, stdio: 'pipe' });
  } catch (e) {
    // A non-zero exit here would mean either drift OR a path failure. Distinguish:
    // "up to date" checks compare against the copied index.html, which was copied
    // AFTER generation, so --check should pass. Any error is a real failure.
    argvOk = false; argvErr = String(e.stderr || e.message || '');
  }
  ok('gen_home_faq --check succeeds via execFileSync from a path with spaces', argvOk, argvErr.slice(0, 200));

  // 2. Demonstrate the OLD concatenated form is the unsafe one: build the exact
  //    shell string the regression used and show it does NOT cleanly resolve the
  //    spaced path. We do this with shell:true so the space splits the argv the
  //    way a naive execSync('node ' + path) would. We assert it throws.
  const { execSync } = require('child_process');
  let concatFailed = false;
  try {
    // Note: no quoting — this is the buggy pattern we are guarding against.
    execSync('node ' + gen + ' --check', { cwd: base, stdio: 'pipe' });
  } catch (e) {
    concatFailed = true; // expected: the unquoted spaced path breaks
  }
  ok('the old concatenated execSync form breaks on a spaced path (why the fix matters)',
     concatFailed);
} finally {
  fs.rmSync(base, { recursive: true, force: true }); // always restore
}

// 3. Confirm the shipped suites use the safe form (guard against future regression).
{
  const stripComments = s => s.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const faq = stripComments(fs.readFileSync(path.join(siteDir, 'engine', 'tests_home_faq.js'), 'utf8'));
  ok('tests_home_faq.js uses execFileSync (not execSync node+path)',
     /execFileSync\(process\.execPath,/.test(faq) && !/execSync\('node ' \+/.test(faq));
  const runAll = stripComments(fs.readFileSync(path.join(siteDir, 'engine', 'run_all.js'), 'utf8'));
  ok('run_all.js uses execFileSync (not execSync node+path)',
     /execFileSync\(process\.execPath,/.test(runAll) && !/execSync\('node ' \+/.test(runAll));
}

console.log('SPACES-PATH CONTRACT TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass, fail };
