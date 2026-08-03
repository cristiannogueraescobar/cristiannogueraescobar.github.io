/* tests_e6_needle_audit.js — statically audits the E6 negative suite.
 *
 * Ensures each expect* call passes a SPECIFIC needle; that functional mutations
 * do not key on a pinned-hash message alone (a closed allowlist of integrity /
 * packaging cases may); that the N-cases are present; that no case points the
 * fallback or a common suite at a second editable maths source; that no Worker
 * case is presented as a mirror case and no UI case as an engine case; that no
 * positive checker depends on dist; and that cleanup happens in finally. Mirrors
 * the E1-E5 needle audits.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

const file = path.join(__dirname, 'tests_e6_worker_mirror_negative.js');
const src = fs.readFileSync(file, 'utf8');
const checkerSrc = fs.readFileSync(path.join(__dirname, 'tests_e6_worker_mirror.js'), 'utf8');
const positiveSrc = fs.readFileSync(path.join(__dirname, 'tests_e6_worker_mirror_positive.js'), 'utf8');

// Integrity / packaging cases allowed to key on a pinned-SHA / byte / publication
// message. These are the ONLY cases whose contract IS byte / publication integrity.
const HASH_NEEDLE_ALLOWED = new Set(['N2', 'N41', 'N47', 'N49', 'N50']);
const INTEGRITY_NEEDLES = ['canonical source SHA intact', 'E6 fixture pins do_not_regenerate', 'E6 fixture mirror old/final SHAs recorded'];

const callRe = /expect(?:Fail|GenThrow)\(\s*'((?:N\d+)[^']*)'[\s\S]*?\}\s*,\s*'([^']*)'\s*\)/g;
let m, count = 0; const seen = new Set();
while ((m = callRe.exec(src)) !== null) {
  count++;
  const label = m[1], needle = m[2];
  const id = (label.match(/^N\d+/) || ['?'])[0];
  seen.add(id);
  ok(label + ' :: has a specific needle', needle && needle.length >= 4, 'needle="' + needle + '"');
  const keysOnIntegrity = INTEGRITY_NEEDLES.some(function (n) { return needle.indexOf(n) !== -1; });
  if (keysOnIntegrity) {
    ok(label + ' :: integrity needle only on allowlisted cases', HASH_NEEDLE_ALLOWED.has(id), 'id=' + id + ' needle=' + needle);
  }
}

// Cleanup in finally: both helpers must clean up.
ok('expectFail cleans up in finally', /function expectFail[\s\S]*?finally \{ fs\.rmSync/.test(src));
ok('expectGenThrow cleans up in finally', /function expectGenThrow[\s\S]*?finally \{ fs\.rmSync/.test(src));

// No second editable maths source: the only cases that write a require('...engine.js')
// or point a suite away from the generated mirror are N20 (legacy harness) and N37
// (fallback), and both ASSERT that is wrong.
ok('N20 asserts the legacy harness must target the generated mirror', /N20[\s\S]*?legacy harness targets the generated mirror/.test(src));
ok('N37 asserts the fallback must use the canonical maths', /N37[\s\S]*?fallback runSolve uses detectModel_\/solveModel_/.test(src));

// No Worker case presented as a mirror case, no UI case as an engine case.
ok('no UI translation asserted as an engine contract', !/translat|\bannounce\(|aria-label/.test(src));
ok('Worker cases key on Worker/lifecycle needles, not mirror-equivalence', /N22[\s\S]*?Worker engineSource slices/.test(src));

// Functional mutations must key on a functional assertion (not a bare hash).
const functionalCases = {
  N1: 'canonical source', N3: 'mirror matches the generator output', N4: 'mirror matches the generator output',
  N5: 'fixture records generator deterministic', N6: 'generator does not read solver.html or dist',
  N7: 'fixture records generator deterministic', N8: 'fixture records generator deterministic', N9: 'fixture records generator deterministic', N10: 'fixture records generator deterministic', N11: 'A1.signature', N12: 'A1.fallback',
  N13: 'adapter divergences are newContext_/readConstraint_', N14: 'mirror matches the generator output',
  N15: 'mirror matches the generator output', N16: 'mirror matches the generator output',
  N17: 'mirror matches the generator output', N18: 'mirror matches the generator output',
  N19: 'mirror matches the generator output', N20: 'legacy harness targets the generated mirror',
  N21: 'canonical harness loads canonical source', N22: 'Worker engineSource slices ENGINE_START..ENGINE_END',
  N23: 'Worker engineSource slices ENGINE_START..ENGINE_END', N24: 'Worker glue emits success shape',
  N25: 'separator is a single LF', N26: 'Blob source bytes = engine + 1 + glue',
  N27: 'request contract fields exact', N28: 'request contract fields exact',
  N29: 'response success contract exact', N30: 'response error contract exact',
  N31: 'stale guard on success compares GLOBAL workerToken', N32: 'stale guard on error compares myToken',
  N33: 'token increments per solve', N34: 'lifecycle error terminates the worker',
  N35: 'lifecycle build: Blob + createObjectURL + new Worker + revokeObjectURL', N36: 'cleanup rebuilds by nulling engineWorker',
  N37: 'fallback runSolve uses detectModel_/solveModel_', N38: 'fallback runSolve uses detectModel_/solveModel_',
  N39: 'engine error is a thrown phase-tagged message', N40: 'Worker glue emits error shape',
  N42: 'E2 exports intact (24)', N43: 'E3 exports intact (22)', N44: 'E4 exports intact (8)',
  N45: 'E5 exports intact (9)', N46: 'E6 fixture has no absolute path', N48: 'dist byte',
  N51: 'fixture pins six requests', N52: 'canonical/generator/adapter absent from dist', N53: 'adapter declares exactly two approved divergences',
  N54: 'historical fixture engine-e0-baseline.json keeps the historical mirror SHA, not E6', N55: 'historical fixture engine-e5-verification-statuses.json keeps the historical mirror SHA, not E6',
};
Object.keys(functionalCases).forEach(function (id) {
  const re = new RegExp("'" + id + "[^']*'[\\s\\S]*?\\}, '" + functionalCases[id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
  ok(id + ' :: functional mutation keys on a functional needle', re.test(src), 'expected "' + functionalCases[id] + '"');
});

ok('audited at least 55 expect* negative calls', count >= 55, 'count=' + count);
let missing = [];
for (let i = 1; i <= 55; i++) { if (!seen.has('N' + i)) missing.push('N' + i); }
ok('N1..N53 all present as expect* calls', missing.length === 0, 'missing ' + missing.join(','));

// Packaging negatives (overlay) are audited in the packaging test itself; here we
// confirm the request/publication negatives really exercise the composed output.
ok('N51 exercises the request-count pin', /N51[\s\S]*?fixture pins six requests/.test(src));
ok('N52 exercises the published-source guard', /N52[\s\S]*?canonical\/generator\/adapter absent from dist/.test(src));

// Checker/positive must be dist-independent.
ok('checker does not read dist/solver.html', !/readFileSync\([^)]*dist[^)]*solver/.test(checkerSrc));
ok('checker has no positive existsSync(dist) gate (only !existsSync no-publish checks)', !/[^!]fs\.existsSync\([^)]*dist/.test(checkerSrc.replace(/!fs\.existsSync/g,'NEG')));
ok('positive has no existsSync(dist) branch', !/existsSync\([^)]*dist/.test(positiveSrc));
ok('positive has no skip-as-pass else-true', !/else\s*\{\s*ok\([^,]*,\s*true\s*\)/.test(positiveSrc));

// Canonical actually used; generator is the authority for the mirror.
ok('checker runs the official generator', /generateMirror\(siteDir\)/.test(checkerSrc));
ok('checker reads the canonical source path', checkerSrc.indexOf('plumline-engine.js') !== -1);

console.log('E6 NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail + '   (' + count + ' expect* calls)');
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
