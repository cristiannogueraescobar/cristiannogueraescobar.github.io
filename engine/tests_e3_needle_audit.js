/* tests_e3_needle_audit.js — statically audits the E3 negative suite.
 *
 * Ensures each expectCheckFail/expectHarnessThrow call passes a SPECIFIC needle;
 * that functional mutations do NOT key on the pinned-hash message alone (a closed
 * allowlist of integrity cases may); that every N1..N48 case is present; that no
 * case claims to test canonical while pointing the harness at engine/engine.js;
 * and that no E4 function is presented as an E3 contract. Mirrors the E1/E2
 * needle audits.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const file = path.join(__dirname, 'tests_canonical_model_continuous_negative.js');
const src = fs.readFileSync(file, 'utf8');

// Integrity cases allowed to key on a pinned-SHA message (engine OR mirror). These
// are the ONLY cases whose contract IS the byte-integrity of a pinned artefact.
const HASH_NEEDLE_ALLOWED = new Set(['N38', 'N44', 'N45', 'N46', 'N47']);
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

// Every expect* body must clean up in finally (the two helpers both use finally;
// assert the helpers keep their finally blocks and the inline N48 case does too).
ok('expectCheckFail cleans up in finally', /function expectCheckFail[\s\S]*?finally \{ fs\.rmSync/.test(src));
ok('expectHarnessThrow cleans up in finally', /function expectHarnessThrow[\s\S]*?finally \{ fs\.rmSync/.test(src));
ok('inline N48 cleans up in finally', /N48[\s\S]*?finally \{ fs\.rmSync/.test(src));

// No case may claim to test canonical while pointing the harness at engine.js:
// the ONLY mention of engine.js in a mutation is N1 (which deliberately injects a
// require of ./engine.js and asserts the checker CATCHES it).
const engineJsHits = (src.match(/'\.?\/?engine\.js'/g) || []).length;
ok('engine.js only referenced by the N1 guard + MIRROR const', engineJsHits <= 3, 'hits=' + engineJsHits);
ok('N1 asserts the harness must not use engine/engine.js', /N1[\s\S]*?does not use engine\/engine\.js/.test(src));

// No E4 function may be presented as an E3 contract: the only E4 names allowed to
// appear are in cases that assert they are FORBIDDEN (N6 solveIntegerProgram_, N7
// isWhole_, N29 dispatch), plus the fixture forbidden-set case N42.
ok('N6 asserts an E4 function is forbidden', /N6[\s\S]*?forbidden \(E4-E6\)/.test(src));
ok('N7 asserts isWhole_ is forbidden', /N7[\s\S]*?forbidden \(E4-E6\)/.test(src));
ok('N29 keeps continuous OFF the branch-and-bound path', /N29[\s\S]*?unbounded internal/.test(src));

// Functional mutations must key on a functional assertion name, not a bare hash.
// Spot-check a representative set.
const functionalCases = {
  N10: 'continuous max optimal', N11: 'continuous max optimal', N12: 'objective constant folded',
  N15: 'continuous max optimal', N16: 'continuous min optimal', N17: 'equality constraint optimal',
  N20: 'lower bound', N21: 'upper bound', N23: 'fixed variable', N24: 'incompatible bounds',
  N34: 'degenerate optimal', N35: 'unbounded internal', N36: 'incompatible bounds', N37: 'small coefficients',
};
Object.keys(functionalCases).forEach(function (id) {
  const re = new RegExp(id + "[\\s\\S]*?\\}, '" + functionalCases[id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
  ok(id + ' :: functional mutation keys on a functional needle', re.test(src), 'expected "' + functionalCases[id] + '"');
});

ok('audited at least 47 expect* negative calls', count >= 47, 'count=' + count);
let missing = [];
for (let i = 1; i <= 47; i++) { if (!seen.has('N' + i)) missing.push('N' + i); }
ok('N1..N47 all present as expect* calls', missing.length === 0, 'missing ' + missing.join(','));
ok('N48 spaced-path case present (inline)', src.indexOf('N48 spaced-path') !== -1);

console.log('E3 NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail + '   (' + count + ' expect* calls)');
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
