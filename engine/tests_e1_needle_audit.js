/* tests_e1_needle_audit.js — statically audits the E1 negative suite.
 *
 * Guarantees each expectThrow/expectCheckFail call in
 * tests_canonical_engine_source_negative.js passes a THIRD argument (a specific
 * needle), that functional mutations do not key on a global-hash needle alone,
 * and that a closed allowlist of integrity-style cases may key on a
 * canonical-hash message. This mirrors the D needle audit.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}

const file = path.join(__dirname, 'tests_canonical_engine_source_negative.js');
const src = fs.readFileSync(file, 'utf8');

// Integrity-style cases allowed to key on a canonical/blob hash message.
const HASH_NEEDLE_ALLOWED = new Set([
  'N14', 'N15', 'N21', 'N32', 'N33', 'N34', 'N38',
]);
const HASH_NEEDLES = [
  'canonical source sha256 == fixture',
  'canonical source is LF only',
  'blob source bytes == 83598',
  'composed solver sha256 == fixture',
  'E1 fixture has no absolute path',
];

// Match each expectThrow/expectCheckFail(...) call and capture label + needle.
const callRe = /expect(?:Throw|CheckFail)\(\s*'((?:N\d+)[^']*)'[\s\S]*?\}\s*,\s*'([^']*)'\s*\)/g;
let m, count = 0;
const seen = new Set();
while ((m = callRe.exec(src)) !== null) {
  count++;
  const label = m[1];
  const needle = m[2];
  const id = (label.match(/^N\d+/) || ['?'])[0];
  seen.add(id);
  ok(label + ' :: has a specific needle', needle && needle.length >= 4, 'needle="' + needle + '"');
  const isHashNeedle = HASH_NEEDLES.some(h => needle.indexOf(h) !== -1);
  if (isHashNeedle) {
    ok(label + ' :: hash-style needle only on allowlisted integrity cases',
      HASH_NEEDLE_ALLOWED.has(id), 'id=' + id + ' needle="' + needle + '"');
  }
}

// The suite manually implements N38 (spaced path) inline, not via expect*, so the
// regex count is 37; N38 is asserted directly. Require at least 37 audited calls.
ok('audited at least 37 expect* negative calls', count >= 37, 'count=' + count);
// Require N1..N37 all present as expect* calls, and N38 present in the source.
let missing = [];
for (let i = 1; i <= 37; i++) { if (!seen.has('N' + i)) missing.push('N' + i); }
ok('N1..N37 all present as expect* calls', missing.length === 0, 'missing ' + missing.join(','));
ok('N38 spaced-path case present', src.indexOf("N38 spaced-path") !== -1);

console.log('E1 NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail + '   (' + count + ' expect* calls)');
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
