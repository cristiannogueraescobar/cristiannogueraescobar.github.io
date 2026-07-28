/**
 * run_all.js — runs the full test battery and exits non-zero if any fails.
 * Intended to run before deploy (e.g. in a git pre-push hook or CI step):
 *   node engine/run_all.js
 */
const { execSync } = require('child_process');
const path = require('path');

const suites = [
  'tests', 'tests_states', 'tests_bounds', 'tests_worker_token', 'tests_panel',
  'tests_safety', 'tests_examples', 'tests_jsonld', 'tests_assets',
  'tests_i18n_pages', 'tests_direction', 'tests_structure'
];

let totalPass = 0, anyFail = false;
suites.forEach(function (s) {
  try {
    const out = execSync('node ' + path.join(__dirname, s + '.js'), { encoding: 'utf8' });
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
console.log('  TOTAL PASSED: ' + totalPass + (anyFail ? '   (SOME FAILED)' : '   (all green)'));
process.exit(anyFail ? 1 : 0);
