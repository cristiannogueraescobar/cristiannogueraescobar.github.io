/**
 * run_all.js — runs the full test battery and exits non-zero if any fails.
 * Intended to run before deploy (e.g. in a git pre-push hook or CI step):
 *   node engine/run_all.js
 */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = require('./suites.js');

let totalPass = 0, anyFail = false, anySkip = false;
suites.forEach(function (s) {
  try {
    // execFileSync + argv array (NOT a concatenated shell string) so a repo path
    // with spaces works on Windows. process.execPath is the current Node binary.
    const out = execFileSync(process.execPath, [path.join(__dirname, s + '.js')], { encoding: 'utf8' });
    if (/SKIPPED/.test(out)) {
      anySkip = true;
      console.log('  ' + s.padEnd(20) + ' SKIPPED');
      process.stdout.write('    ' + out.trim().split('\n').pop() + '\n');
      return;
    }
    const m = out.match(/PASSED: (\d+)\s+FAILED: (\d+)/);
    const p = m ? +m[1] : 0, f = m ? +m[2] : 0;
    totalPass += p;
    if (f > 0) { anyFail = true; process.stdout.write(out); }
    console.log('  ' + s.padEnd(20) + ' PASSED: ' + p + (f ? '  FAILED: ' + f : ''));
  } catch (e) {
    anyFail = true;
    console.log('  ' + s.padEnd(20) + ' ERROR');
    process.stdout.write(String(e.stdout || '') + String(e.stderr || ''));
  }
});
console.log('  ' + '-'.repeat(40));
console.log('  TOTAL PASSED: ' + totalPass +
  (anyFail ? '   (SOME FAILED)' : (anySkip ? '   (all green, SOME SKIPPED — install deps with npm ci)' : '   (all green)')));
process.exit(anyFail ? 1 : 0);
