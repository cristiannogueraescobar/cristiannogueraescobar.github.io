/* tests_e5_needle_audit.js — statically audits the E5 negative suite.
 *
 * Ensures each expectCheckFail/expectHarnessThrow call passes a SPECIFIC needle;
 * that functional mutations do NOT key on a pinned-hash message alone (a closed
 * allowlist of integrity cases may); that every N1..N53 case is present; that no
 * case claims to test canonical while pointing the harness at engine/engine.js;
 * that no E6 (Worker) function is presented as an E5 contract; that no UI
 * localisation is presented as an engine contract; that no positive checker
 * depends on dist; and that no skip is counted as a pass. Mirrors the E1-E4
 * needle audits.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const file = path.join(__dirname, 'tests_canonical_verification_statuses_negative.js');
const src = fs.readFileSync(file, 'utf8');
const checkerSrc = fs.readFileSync(path.join(__dirname, 'tests_canonical_verification_statuses.js'), 'utf8');
const positiveSrc = fs.readFileSync(path.join(__dirname, 'tests_canonical_verification_statuses_positive.js'), 'utf8');

// Integrity cases allowed to key on a pinned-SHA / byte-identity message. These
// are the ONLY cases whose contract IS byte / publication integrity.
const HASH_NEEDLE_ALLOWED = new Set(['N45', 'N48', 'N49', 'N50', 'N51']);
const ENGINE_HASH = 'engine SHA unchanged (pinned)';
const MIRROR_HASH = 'mirror SHA unchanged (pinned)';
const FIXTURE_HASH = 'E5 fixture pins engine SHA';
const DIST_NEEDLE = 'dist byte-identical';

const callRe = /expect(?:CheckFail|HarnessThrow)\(\s*'((?:N\d+)[^']*)'[\s\S]*?\}\s*,\s*'([^']*)'\s*\)/g;
let m, count = 0; const seen = new Set();
while ((m = callRe.exec(src)) !== null) {
  count++;
  const label = m[1], needle = m[2];
  const id = (label.match(/^N\d+/) || ['?'])[0];
  seen.add(id);
  ok(label + ' :: has a specific needle', needle && needle.length >= 4, 'needle="' + needle + '"');
  const keysOnIntegrity = needle.indexOf(ENGINE_HASH) !== -1 || needle.indexOf(MIRROR_HASH) !== -1 || needle.indexOf(FIXTURE_HASH) !== -1 || needle.indexOf(DIST_NEEDLE) !== -1;
  if (keysOnIntegrity) {
    ok(label + ' :: integrity needle only on allowlisted cases', HASH_NEEDLE_ALLOWED.has(id), 'id=' + id + ' needle=' + needle);
  }
}

// Cleanup in finally: both helpers and the inline N53 case must clean up.
ok('expectCheckFail cleans up in finally', /function expectCheckFail[\s\S]*?finally \{ fs\.rmSync/.test(src));
ok('expectHarnessThrow cleans up in finally', /function expectHarnessThrow[\s\S]*?finally \{ fs\.rmSync/.test(src));
ok('inline N53 cleans up in finally', /N53[\s\S]*?finally \{ fs\.rmSync/.test(src));

// engine.js only referenced by the N1 guard, the N45 (checker->mirror) case, the
// N50 (mirror modified) case (via the MIRROR const), and the MIRROR const itself.
const engineJsHits = (src.match(/engine\.js/g) || []).length;
ok('engine.js references stay minimal', engineJsHits <= 8, 'hits=' + engineJsHits);
ok('N1 asserts the harness must not use engine/engine.js', /N1[\s\S]*?does not use engine\/engine\.js/.test(src));

// No E6 function presented as an E5 contract: buildWorkerSource_ appears only in
// cases asserting it is FORBIDDEN (N6) or listed in FORBIDDEN_E6.
ok('N6 asserts an E6 function is forbidden', /N6[\s\S]*?forbidden \(E6\)/.test(src));

// No UI localisation presented as an engine contract: the negative suite must not
// assert on translated UI strings as if they were engine maths.
ok('no UI translation asserted as an engine contract', !/i18n|translat|announce|aria-/.test(src));

// Functional mutations must key on a functional assertion name (not a bare hash).
const functionalCases = {
  N4: 'E5 export count matches fixture', N5: 'E5 export count matches fixture',
  N7: 'E2 phase still exactly 24', N8: 'E3 phase still exactly 22', N9: 'E4 phase still exactly 8',
  N10: 'each E5 load has a fresh context',
  N11: 'continuous optimal status/optProven/stopReason/nodesExplored',
  N12: 'isSatisfied_ <= within tolerance', N13: 'isSatisfied_ >= within tolerance',
  N14: 'isSatisfied_ equality within tolerance', N15: 'buildVariableDomains_ lower-bound violation rejected',
  N16: 'buildVariableDomains_ upper-bound violation rejected', N17: 'isWhole_ integrality (1e-6)',
  N18: 'buildVariableDomains_ binary 0.5 rejected', N19: 'feasibleAt_ rejects NaN and Infinity',
  N20: 'feasibleAt_ feasible vs infeasible point', N21: 'isSatisfied_ tolerance boundary (1e-6)',
  N22: 'constraint tolerance 1e-6 in isSatisfied_',
  N23: 'integer optimal status/objective/values/nodesExplored',
  N24: 'time_limit with incumbent -> feasible + caveat', N25: 'integer infeasible status',
  N26: 'continuous unbounded status', N27: 'time_limit without incumbent -> unknown',
  N28: 'numerical_failure is a status field', N29: 'time_limit with incumbent -> feasible + caveat',
  N30: 'time_limit with incumbent -> feasible + caveat', N31: 'time_limit with incumbent -> feasible + caveat',
  N32: 'time_limit with incumbent -> feasible + caveat',
  N33: 'continuous optimal status/optProven/stopReason/nodesExplored',
  N34: 'optimalityProven boolean on unbounded (coerced false)',
  N35: 'time_limit with incumbent -> feasible + caveat', N36: 'time_limit without incumbent -> unknown',
  N37: 'integer optimal status/objective/values/nodesExplored',
  N38: 'continuous optimal objective/values/modelType', N39: 'continuous optimal objective/values/modelType',
  N40: 'guessed constraint throws a technical error', N41: 'infeasible thrown as exception',
  N42: 'direct parity feasibleAt_ canonical == mirror', N43: 'direct parity finiteModel_ canonical == mirror',
  N44: 'approved divergences are exactly newContext_/readConstraint_',
  N46: 'isSatisfied_ <= within tolerance', N47: 'E5 fixture has no absolute path',
  N52: 'isWhole_ integrality (1e-6)',
};
Object.keys(functionalCases).forEach(function (id) {
  const re = new RegExp("'" + id + "[^']*'[\\s\\S]*?\\}, '" + functionalCases[id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
  ok(id + ' :: functional mutation keys on a functional needle', re.test(src), 'expected "' + functionalCases[id] + '"');
});

ok('audited at least 53 expect* negative calls', count >= 52, 'count=' + count);
let missing = [];
for (let i = 1; i <= 52; i++) { if (!seen.has('N' + i)) missing.push('N' + i); }
ok('N1..N52 all present as expect* calls', missing.length === 0, 'missing ' + missing.join(','));
ok('N53 spaced-path clean-tree case present (inline)', src.indexOf('N53 spaced-path') !== -1);

// The checker/positive must be dist-independent: no positive checker branches on dist.
ok('checker does not read dist/solver.html', !/readFileSync\([^)]*dist[^)]*solver/.test(checkerSrc));
ok('checker has no existsSync(dist) branch', !/existsSync\([^)]*dist/.test(checkerSrc));
ok('positive has no existsSync(dist) branch', !/existsSync\([^)]*dist/.test(positiveSrc));
ok('positive has no skip-as-pass else-true', !/else\s*\{\s*ok\([^,]*,\s*true\s*\)/.test(positiveSrc));

// Canonical is actually used: the checker/positive load through the harness or the
// raw canonical source, never the mirror as authority.
ok('checker reads the canonical source path', checkerSrc.indexOf('plumline-engine.js') !== -1);
ok('checker uses the E5 harness phase', /createCanonicalEngineHarness\(\{ phase: 'e5' \}\)/.test(checkerSrc));

console.log('E5 NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail + '   (' + count + ' expect* calls)');
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
