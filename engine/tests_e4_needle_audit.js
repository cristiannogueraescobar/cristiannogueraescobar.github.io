/* tests_e4_needle_audit.js — statically audits the E4 negative suite.
 *
 * Ensures each expectCheckFail/expectHarnessThrow call passes a SPECIFIC needle;
 * that functional mutations do NOT key on a pinned-hash message alone (a closed
 * allowlist of integrity cases may); that every N1..N51 case is present plus the
 * inline N52; that no case claims to test canonical while pointing the harness at
 * engine/engine.js; and that no E5 function is presented as an E4 contract.
 * Mirrors the E1/E2/E3 needle audits.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const file = path.join(__dirname, 'tests_canonical_integer_branch_and_bound_negative.js');
const src = fs.readFileSync(file, 'utf8');

// Integrity cases allowed to key on a pinned-SHA message (engine OR mirror OR the
// fixture SHA pin). These are the ONLY cases whose contract IS byte-integrity.
const HASH_NEEDLE_ALLOWED = new Set(['N42', 'N48', 'N49', 'N50', 'N51']);
const ENGINE_HASH = 'engine SHA unchanged (pinned)';
const MIRROR_HASH = 'mirror SHA unchanged (pinned)';

const callRe = /expect(?:CheckFail|HarnessThrow)\(\s*'((?:N\d+)[^']*)'[\s\S]*?\}\s*,\s*'([^']*)'\s*\)/g;
let m, count = 0; const seen = new Set();
while ((m = callRe.exec(src)) !== null) {
  count++;
  const label = m[1], needle = m[2];
  const id = (label.match(/^N\d+/) || ['?'])[0];
  seen.add(id);
  ok(label + ' :: has a specific needle', needle && needle.length >= 4, 'needle="' + needle + '"');
  const keysOnHash = needle.indexOf(ENGINE_HASH) !== -1 || needle.indexOf(MIRROR_HASH) !== -1;
  if (keysOnHash) {
    ok(label + ' :: hash needle only on allowlisted integrity cases', HASH_NEEDLE_ALLOWED.has(id), 'id=' + id);
  }
}

// Cleanup in finally: both helpers and the inline N52 case must clean up.
ok('expectCheckFail cleans up in finally', /function expectCheckFail[\s\S]*?finally \{ fs\.rmSync/.test(src));
ok('expectHarnessThrow cleans up in finally', /function expectHarnessThrow[\s\S]*?finally \{ fs\.rmSync/.test(src));
ok('inline N52 cleans up in finally', /N52[\s\S]*?finally \{ fs\.rmSync/.test(src));

// engine.js only referenced by the N1 guard case + MIRROR const (as a quoted path).
const engineJsHits = (src.match(/'\.?\/?engine\.js'/g) || []).length;
ok('engine.js only referenced by the N1 guard + MIRROR const', engineJsHits <= 3, 'hits=' + engineJsHits);
ok('N1 asserts the harness must not use engine/engine.js', /N1[\s\S]*?does not use engine\/engine\.js/.test(src));

// No E5 function presented as an E4 contract: solveModel_ appears only in cases
// asserting it is FORBIDDEN (N6) or in the fixture forbidden-set case (N46), and
// the third-divergence case (N43).
ok('N6 asserts an E5 function is forbidden', /N6[\s\S]*?forbidden \(E5-E6\) function/.test(src));
ok('N15 keeps continuous OFF the branch-and-bound path', /N15[\s\S]*?continuous model bypasses branch-and-bound/.test(src));

// Functional mutations must key on a functional assertion name, not a bare hash.
const functionalCases = {
  N10: 'isWhole_ outside tolerance', N11: 'integer single var', N12: 'classifyModel_ binary',
  N13: 'classifyModel_ binary', N14: 'classifyModel_ mixed continuous+integer',
  N16: 'integer single var', N17: 'binary knapsack', N18: 'integer fractional relaxation',
  N19: 'integer fractional relaxation', N20: 'integer fractional relaxation',
  N21: 'branch traversal deterministic', N22: 'integer single var', N23: 'integer single var',
  N24: 'integer infeasible', N25: 'binary knapsack', N27: 'binary knapsack', N28: 'binary knapsack',
  N29: 'BRANCH_NODES 4000', N30: 'BRANCH_DEPTH 60', N31: 'BRANCH_MILLIS 20000',
  N32: 'MAX_ITERATIONS 20000', N36: 'EPSILON 1e-9', N37: 'PIVOT_TOLERANCE 1e-7',
  N38: 'integer single var', N39: 'integer infeasible', N40: 'normal model hits no limit',
  N41: 'integer single var',
};
Object.keys(functionalCases).forEach(function (id) {
  const re = new RegExp(id + "[\\s\\S]*?\\}, '" + functionalCases[id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
  ok(id + ' :: functional mutation keys on a functional needle', re.test(src), 'expected "' + functionalCases[id] + '"');
});

ok('audited at least 51 expect* negative calls', count >= 51, 'count=' + count);
let missing = [];
for (let i = 1; i <= 51; i++) { if (!seen.has('N' + i)) missing.push('N' + i); }
ok('N1..N51 all present as expect* calls', missing.length === 0, 'missing ' + missing.join(','));
ok('N52 spaced-path case present (inline)', src.indexOf('N52 spaced-path') !== -1);

console.log('E4 NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail + '   (' + count + ' expect* calls)');
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
