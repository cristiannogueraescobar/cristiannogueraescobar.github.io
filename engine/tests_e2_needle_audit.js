/* tests_e2_needle_audit.js — statically audits the E2 negative suite.
 *
 * Ensures each expectCheckFail/expectHarnessThrow call passes a specific needle,
 * that functional mutations do not key on a bare global hash alone (a closed
 * allowlist of integrity cases may key on the pinned-engine-SHA message), and
 * that every N1..N33 case is present plus the inline N34. Mirrors the D/E1
 * needle audits.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}

const file = path.join(__dirname, 'tests_canonical_parser_frontend_negative.js');
const src = fs.readFileSync(file, 'utf8');

// Integrity cases allowed to key on the pinned engine-SHA message.
const HASH_NEEDLE_ALLOWED = new Set([
  'N6', 'N7', 'N8', 'N9', 'N10', 'N12', 'N13', 'N14', 'N15', 'N32', 'N33',
]);
const HASH_NEEDLE = 'engine SHA unchanged (pinned)';

const callRe = /expect(?:CheckFail|HarnessThrow)\(\s*'((?:N\d+)[^']*)'[\s\S]*?\}\s*,\s*'([^']*)'\s*\)/g;
let m, count = 0; const seen = new Set();
while ((m = callRe.exec(src)) !== null) {
  count++;
  const label = m[1], needle = m[2];
  const id = (label.match(/^N\d+/) || ['?'])[0];
  seen.add(id);
  ok(label + ' :: has a specific needle', needle && needle.length >= 4, 'needle="' + needle + '"');
  if (needle.indexOf(HASH_NEEDLE) !== -1) {
    ok(label + ' :: hash needle only on allowlisted integrity cases', HASH_NEEDLE_ALLOWED.has(id),
      'id=' + id);
  }
}

ok('audited at least 33 expect* negative calls', count >= 33, 'count=' + count);
let missing = [];
for (let i = 1; i <= 33; i++) { if (!seen.has('N' + i)) missing.push('N' + i); }
ok('N1..N33 all present as expect* calls', missing.length === 0, 'missing ' + missing.join(','));
ok('N34 spaced-path case present', src.indexOf('N34 spaced-path') !== -1);

console.log('E2 NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail + '   (' + count + ' expect* calls)');
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
