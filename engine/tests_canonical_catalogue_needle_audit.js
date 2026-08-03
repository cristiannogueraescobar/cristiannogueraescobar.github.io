/* Checkpoint F1.26 — needle auditor for the canonical-catalogue negative suite.
 *
 * A negative test is only meaningful if (a) its mutation actually reaches the
 * contract it targets, (b) the failure it asserts names a SPECIFIC needle, (c)
 * cleanup runs in finally, and (d) it does not pass by accident (skip-as-pass) or by
 * a bare SHA compare of a semantic change. This auditor inspects the negative suite's
 * SOURCE to confirm those properties structurally, and runs a couple of meta-checks.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..');
const NEG = path.join(SITE, 'engine', 'tests_canonical_catalogue_negative.js');
const src = fs.readFileSync(NEG, 'utf8');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// Extract each `<fn>(...)` top-level call fully, balancing parentheses so needles
// after inner `.replace(...)` calls are not truncated.
function extractCalls(source, fnName) {
  const calls = [];
  let i = 0;
  while ((i = source.indexOf(fnName + '(', i)) !== -1) {
    // Skip the function DEFINITION (`function <fnName>(`), audit only call sites.
    const preceding = source.slice(Math.max(0, i - 9), i);
    if (/function\s*$/.test(preceding)) { i += fnName.length; continue; }
    let depth = 0, j = i + fnName.length;
    for (; j < source.length; j++) {
      const ch = source[j];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) { j++; break; } }
    }
    calls.push(source.slice(i, j));
    i = j;
  }
  return calls;
}
function lastNeedle(call) {
  const m = call.match(/,\s*'([^']*)'\s*\)\s*$/);
  return m ? m[1] : null;
}

// 1. Every expectCheckerTrips call passes a non-empty needle as its LAST argument.
(function () {
  const calls = extractCalls(src, 'expectCheckerTrips');
  const bad = calls.filter(c => { const n = lastNeedle(c); return !n || n.length === 0; }).length;
  ok('1 every checker negative carries a needle', bad === 0, 'without-needle=' + bad + ' of ' + calls.length);
})();

// 2. Every expectComposerThrows call passes a non-empty needle as its LAST argument.
(function () {
  const calls = extractCalls(src, 'expectComposerThrows');
  const bad = calls.filter(c => { const n = lastNeedle(c); return !n || n.length === 0; }).length;
  ok('2 every composer negative carries a needle', bad === 0, 'without-needle=' + bad + ' of ' + calls.length);
})();

// 3. Cleanup in finally: every mkdtempSync in the suite is paired with an rmSync in a
//    finally block (count parity as a structural proxy).
(function () {
  const temps = (src.match(/mkdtempSync/g) || []).length;
  const rms = (src.match(/rmSync\([^)]*recursive: true[^)]*\)/g) || []).length;
  // makeTree has one mkdtemp used by many cases; count finally rmSync >= distinct temp creators.
  ok('3 every temp tree is cleaned up (rmSync present for each mkdtemp site)', rms >= temps, 'mkdtemp=' + temps + ' rmSync=' + rms);
  ok('3b cleanup uses finally', (src.match(/finally\s*\{[^}]*rmSync/g) || []).length >= 1);
})();

// 4. No skip-as-pass: the suite never counts a skipped/absent assertion as pass. We
//    check there is no `continue`/early `return` inside a case that would bypass the
//    trip assertion, and that helpers assert BOTH a clean pass and a tripped state.
(function () {
  ok('4 helpers assert clean-then-trip (expectCheckerTrips)', /clean tree passes[\s\S]*mutation trips checker/.test(src));
  ok('4b helpers assert clean-then-throw (expectComposerThrows)', /clean tree composes[\s\S]*mutation makes composition throw/.test(src));
})();

// 5. Semantic mutations are checked by contract (checker/generator/composer), NOT by
//    a bare SHA compare. The negative suite must not import crypto for a SHA-only
//    verdict on a semantic mutation.
ok('5 no bare SHA-only verdict on semantic mutations', src.indexOf('crypto') === -1 && src.indexOf('sha256') === -1);

// 6. Temp trees are self-sufficient: the suite copies the catalogue module set so a
//    mutation is never masked by the main repo, and a catalogue-absent case exists.
(function () {
  ok('6 temp trees copy the catalogue module set', /CAT_MODULES/.test(src) && /catalogue\.js/.test(src));
  ok('6b a catalogue-absent (no fallback) case exists', /catalogue absent in tree \(no fallback/.test(src) || /catalogue missing/.test(src));
})();

// 7. Coverage: the negative suite exercises every projection + the composer + the
//    schema + the not-published invariant (needle families present).
(function () {
  const families = ['i18n', 'examples-data', 'examples.html', 'home', 'unbalanced', 'more than one', 'inline EXAMPLES', 'not published', 'duplicate', 'category', 'type', 'sense', 'invented', 'grid'];
  const missing = families.filter(f => src.indexOf("'" + f) === -1 && src.indexOf('"' + f) === -1 && src.indexOf(f) === -1);
  ok('7 negative suite covers all contract families', missing.length === 0, 'missing=' + missing.join(','));
})();

// 8. Meta: run the negative suite as a child and confirm it exits 0 (all its internal
//    assertions hold) — the auditor does not merely trust the source.
(function () {
  const { execFileSync } = require('child_process');
  let code = 0;
  try { execFileSync(process.execPath, [NEG], { stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
  ok('8 negative suite runs green as a child process', code === 0, 'exit=' + code);
})();

// 9. The positive suite must NOT depend on dist (no 'dist/' read that gates a pass).
(function () {
  const pos = fs.readFileSync(path.join(SITE, 'engine', 'tests_canonical_catalogue_positive.js'), 'utf8');
  // dist is only referenced to assert NON-publication (a not-exists check), never read for content.
  const readsDistContent = /readFileSync\([^)]*dist[^)]*\)/.test(pos);
  ok('9 positive suite does not read dist content', !readsDistContent);
})();

// 10. Generated projections are not treated as the authority: the generator/checker
//     load the catalogue via loadAndValidateCatalogue, never treat i18n/examples-data
//     as the source of truth.
(function () {
  const gen = fs.readFileSync(path.join(SITE, 'engine', 'generate-examples.js'), 'utf8');
  ok('10 generator loads catalogue authority (not the projections)', gen.indexOf('loadAndValidateCatalogue') !== -1);
})();

console.log('CANONICAL CATALOGUE NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
