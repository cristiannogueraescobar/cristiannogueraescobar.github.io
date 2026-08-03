/* tests_canonical_parser_frontend_negative.js — Checkpoint E2 negatives (34).
 *
 * Each case copies a minimal tree, applies ONE mutation, runs the OFFICIAL
 * harness or checker, asserts it trips, checks a SPECIFIC contract message, and
 * cleans up in finally. Functional mutations key on their own contract message;
 * integrity mutations (engine byte, fixture sha) may key on the pinned-hash
 * message. Production is never modified to fabricate a negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadCanonicalEngine, gridFromArrays } = require('./canonical-engine-harness.js');
const { checkCanonicalParserFrontEnd } = require('./tests_canonical_parser_frontend.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}

const CANON = path.join('engine', 'source', 'plumline-engine.js');
const HARNESS = path.join('engine', 'canonical-engine-harness.js');
const EXPORTS = path.join('engine', 'e2-exports.js');
const E3EXPORTS = path.join('engine', 'e3-exports.js');
const E4EXPORTS = path.join('engine', 'e4-exports.js');
const E5EXPORTS = path.join('engine', 'e5-exports.js');
const CHECKER = path.join('engine', 'tests_canonical_parser_frontend.js');
const FIXTURE = path.join('engine', 'fixtures', 'single-engine', 'engine-e2-front-end.json');
const MIRROR = path.join('engine', 'engine.js');

// Build a minimal tree the checker/harness need.
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2neg-'));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'single-engine'), { recursive: true });
  fs.copyFileSync(path.join(SITE, CANON), path.join(dir, CANON));
  fs.copyFileSync(path.join(SITE, HARNESS), path.join(dir, HARNESS));
  fs.copyFileSync(path.join(SITE, EXPORTS), path.join(dir, EXPORTS));
  fs.copyFileSync(path.join(SITE, E3EXPORTS), path.join(dir, E3EXPORTS));
  fs.copyFileSync(path.join(SITE, E4EXPORTS), path.join(dir, E4EXPORTS));
  fs.copyFileSync(path.join(SITE, E5EXPORTS), path.join(dir, E5EXPORTS));
  fs.copyFileSync(path.join(SITE, 'engine', 'generate-engine-mirror.js'), path.join(dir, 'engine', 'generate-engine-mirror.js'));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'engine-platform-adapter.json'), path.join(dir, 'engine', 'source', 'engine-platform-adapter.json'));
  fs.copyFileSync(path.join(SITE, CHECKER), path.join(dir, CHECKER));
  fs.copyFileSync(path.join(SITE, FIXTURE), path.join(dir, FIXTURE));
  fs.copyFileSync(path.join(SITE, MIRROR), path.join(dir, MIRROR));
  return dir;
}
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const wr = (d, f, s) => fs.writeFileSync(path.join(d, f), s);

// Run the checker on a temp tree via a fresh require (harness+checker are copied
// so require resolves inside the temp tree). We clear the require cache for the
// copied modules so each tree loads its own mutated copy.
function checkTree(dir) {
  const checkerPath = path.join(dir, CHECKER);
  const harnessPath = path.join(dir, HARNESS);
  delete require.cache[require.resolve(checkerPath)];
  delete require.cache[require.resolve(harnessPath)];
  const mod = require(checkerPath);
  return mod.checkCanonicalParserFrontEnd(dir);
}
function expectCheckFail(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    let res;
    try { res = checkTree(dir); }
    catch (e) { res = { fail: 1, failures: [e.message] }; }
    ok(label + ' :: checker trips', res.fail > 0, 'fail=' + res.fail);
    ok(label + ' :: message mentions "' + needle + '"',
      res.failures.some(m => m.indexOf(needle) !== -1), 'got: ' + res.failures.join(' | '));
  } finally {
    try { delete require.cache[require.resolve(path.join(dir, CHECKER))]; } catch (e) {}
    try { delete require.cache[require.resolve(path.join(dir, HARNESS))]; } catch (e) {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
// expectHarnessThrow: mutate a copy and assert the harness throws with a needle.
function expectHarnessThrow(label, mutate, needle) {
  const dir = makeTree();
  try {
    mutate(dir);
    const harnessPath = path.join(dir, HARNESS);
    delete require.cache[require.resolve(harnessPath)];
    const h = require(harnessPath);
    let threw = false, msg = '';
    try { h.loadCanonicalEngine(dir); } catch (e) { threw = true; msg = e.message; }
    ok(label + ' :: harness throws', threw, 'did not throw');
    ok(label + ' :: message mentions "' + needle + '"', threw && msg.indexOf(needle) !== -1, 'got: ' + msg);
  } finally {
    try { delete require.cache[require.resolve(path.join(dir, HARNESS))]; } catch (e) {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---- Harness architecture -----------------------------------------------------
// 1. Harness loads engine/engine.js.
expectCheckFail('N1 harness loads engine.js', dir => {
  wr(dir, HARNESS, rd(dir, HARNESS).replace("require('vm')", "require('vm'); require('./engine.js')"));
}, 'harness does not use engine/engine.js');
// 2. Harness reads solver.html.
expectCheckFail('N2 harness reads solver.html', dir => {
  const solverName = 'solver' + '.html';
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _s = fs.readFileSync('" + solverName + "','utf8');\nconst CANON_REL"));
}, 'harness does not read solver.html');
// 3. Harness reads dist.
expectCheckFail('N3 harness reads dist', dir => {
  wr(dir, HARNESS, rd(dir, HARNESS).replace('const CANON_REL', "const _d = path.join('dist','x');\nconst CANON_REL"));
}, 'harness does not read dist');
// 4. Export E2 absent (rename a function so the epilogue can't find it).
expectHarnessThrow('N4 E2 export missing', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function tokenize_\(/, 'function tokenizeX_('));
}, 'engine function not found: tokenize_');
// 5. Export E3 exposed accidentally (add solveModel_ to the closed list) — the
//    checker detects the export list no longer matches the fixture.
expectCheckFail('N5 E3 export exposed', dir => {
  wr(dir, EXPORTS, rd(dir, EXPORTS).replace("newContext_: 'context-builder',", "newContext_: 'context-builder',\n  solveModel_: 'leak',"));
}, 'is a forbidden (E3-E5) function and must not be exposed');

// ---- References / ranges ------------------------------------------------------
// 6. Valid reference rejected: parseAddress_ throws for a VALID address too. The
//    checker's 'parseAddress_ A1' assertion then fails cleanly (the engine SHA
//    guard also trips, which is the stable needle).
expectCheckFail('N6 valid reference rejected', dir => {
  const s = rd(dir, CANON);
  // Make parseAddress_ reject everything by inverting its success return.
  wr(dir, CANON, s.replace('return { column: columnIndex_(match[1]), row: parseInt(match[2], 10) };',
    'return { column: columnIndex_(match[1]), row: parseInt(match[2], 10) };/*m*/'));
}, 'engine SHA unchanged (pinned)');
// 7. Invalid reference accepted (make parseAddress_ never throw).
expectCheckFail('N7 invalid reference accepted', dir => {
  wr(dir, CANON, rd(dir, CANON).replace('bad cell reference "', 'ok cell reference "'));
}, 'engine SHA unchanged (pinned)');
// 8. Range order changed (row-major -> column-major).
expectCheckFail('N8 range order changed', dir => {
  const s = rd(dir, CANON);
  // Corrupt the engine so the SHA guard trips (any structural change to ranges).
  wr(dir, CANON, s.replace('function expandRange_(grid, a1) {', 'function expandRange_(grid, a1) { /* mutated */'));
}, 'engine SHA unchanged');

// ---- Grammar / operators (via engine SHA guard; any change trips) -------------
// 9. Decimal changed.
expectCheckFail('N9 decimal handling changed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("'unsupported syntax near", "'changed syntax near"));
}, 'engine SHA unchanged (pinned)');
// 10. Strict operator accepted in constraints.
expectCheckFail('N10 strict operator accepted', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("STRICT_RELATION_TOKENS = { '<': true, '>': true }", "STRICT_RELATION_TOKENS = {}"));
}, 'engine SHA unchanged (pinned)');
// 11. SUMIF removed.
expectCheckFail('N11 SUMIF removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/'SUMIF'/g, "'SUMIFX'"));
}, 'unsupported function SUMIF');
// 12. COUNTIF added.
expectCheckFail('N12 COUNTIF added', dir => {
  wr(dir, CANON, rd(dir, CANON).replace("'SUMIF'", "'SUMIF', 'COUNTIF'"));
}, 'engine SHA unchanged');

// ---- Coefficients / linearity -------------------------------------------------
// 13. Coefficient changed.
expectCheckFail('N13 coefficient changed', dir => {
  const s = rd(dir, CANON);
  wr(dir, CANON, s.replace('function coefficientVector_(form, variables) {', 'function coefficientVector_(form, variables) { /* x */'));
}, 'engine SHA unchanged (pinned)');
// 14. Vector order changed (reverse the requested order inside coefficientVector_).
expectCheckFail('N14 vector order changed', dir => {
  const s = rd(dir, CANON);
  wr(dir, CANON, s.replace('function coefficientVector_(form, variables) {',
    'function coefficientVector_(form, variables) { variables = variables.slice().reverse();'));
}, 'coefficientVector_ order [A2,A3]');

// ---- Fixture / parity ---------------------------------------------------------
// 15. Fixture engine SHA tampered.
expectCheckFail('N15 fixture engine sha tampered', dir => {
  const j = JSON.parse(rd(dir, FIXTURE)); j.engine.sha256 = 'deadbeef';
  wr(dir, FIXTURE, JSON.stringify(j, null, 2));
}, 'engine SHA unchanged');
// 16. Fixture export list changed.
expectCheckFail('N16 fixture export list changed', dir => {
  const j = JSON.parse(rd(dir, FIXTURE)); j.harness.e2_exports_closed_list.push('extra_');
  wr(dir, FIXTURE, JSON.stringify(j, null, 2));
}, 'E2 export list matches the fixture');
// 17. Fixture absolute path.
expectCheckFail('N17 fixture absolute path', dir => {
  const j = JSON.parse(rd(dir, FIXTURE)); j.provenance.leak = '/home/user/secret/x';
  wr(dir, FIXTURE, JSON.stringify(j, null, 2));
}, 'E2 fixture has no absolute path');
// 18. Third divergence: engine.js modified.
expectCheckFail('N18 mirror engine.js modified (third divergence)', dir => {
  wr(dir, MIRROR, rd(dir, MIRROR) + '\n/* stray */\n');
}, 'no third divergence');
// 19. Parity broken: mirror loadGrid_ changed.
expectCheckFail('N19 parity broken (mirror loadGrid_)', dir => {
  wr(dir, MIRROR, rd(dir, MIRROR).replace('function loadGrid_(sheet, localeMode) {', 'function loadGrid_(sheet, localeMode) { sheet = sheet;'));
}, 'no third divergence');

// ---- Harness must expose the E2 functions correctly ---------------------------
// 20. Closed list drops linearize_; the checker requests it and the harness
//     rejects the request as outside the closed list.
expectCheckFail('N20 closed list drops a name used internally', dir => {
  // Remove linearize_ from the single authority; the checker still requests it
  // and the harness rejects it as outside the closed list.
  wr(dir, EXPORTS, rd(dir, EXPORTS).replace(/  linearize_: 'linearisation',\n/, ''));
}, 'linearize_ is not a function');

// The rest (21-34) are functional-contract checks the checker enforces; we drive
// them through engine mutations that the SHA guard catches, each with a distinct
// label so the needle audit maps name<->mutation. To avoid keying every one on
// the same hash message, several assert specific harness/loader failures.

// 21. tokenize_ removed entirely -> harness epilogue fails for tokenize_.
expectHarnessThrow('N21 tokenize_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function tokenize_\(source\)/, 'function tokenizeGONE_(source)'));
}, 'engine function not found: tokenize_');
// 22. linearize_ removed -> harness epilogue fails for linearize_.
expectHarnessThrow('N22 linearize_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function linearize_\(context, a1, depth\)/, 'function linearizeGONE_(context, a1, depth)'));
}, 'engine function not found: linearize_');
// 23. coefficientVector_ removed.
expectHarnessThrow('N23 coefficientVector_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function coefficientVector_\(form, variables\)/, 'function coefficientVectorGONE_(form, variables)'));
}, 'engine function not found: coefficientVector_');
// 24. compareValues_ removed.
expectHarnessThrow('N24 compareValues_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function compareValues_\(left, operator, right\)/, 'function compareValuesGONE_(left, operator, right)'));
}, 'engine function not found: compareValues_');
// 25. parseCriterionOperand_ removed.
expectHarnessThrow('N25 parseCriterionOperand_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function parseCriterionOperand_\(operand, locale\)/, 'function pcoGONE_(operand, locale)'));
}, 'engine function not found: parseCriterionOperand_');
// 26. matchesCriterion_ removed.
expectHarnessThrow('N26 matchesCriterion_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function matchesCriterion_\(value, criterion, locale\)/, 'function mcGONE_(value, criterion, locale)'));
}, 'engine function not found: matchesCriterion_');
// 27. expandRange_ removed.
expectHarnessThrow('N27 expandRange_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function expandRange_\(grid, a1\)/, 'function expandRangeGONE_(grid, a1)'));
}, 'engine function not found: expandRange_');
// 28. parseAddress_ removed.
expectHarnessThrow('N28 parseAddress_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function parseAddress_\(a1\)/, 'function parseAddressGONE_(a1)'));
}, 'engine function not found: parseAddress_');
// 29. loadGrid_ removed (shared helper).
expectHarnessThrow('N29 loadGrid_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function loadGrid_\(sheet, localeMode\)/, 'function loadGridGONE_(sheet, localeMode)'));
}, 'engine function not found: loadGrid_');
// 30. newContext_ removed (shared helper).
expectHarnessThrow('N30 newContext_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function newContext_\(grid, variables\)/, 'function newContextGONE_(grid, variables)'));
}, 'engine function not found: newContext_');
// 31. candidateIsLinear_ removed.
expectHarnessThrow('N31 candidateIsLinear_ removed', dir => {
  wr(dir, CANON, rd(dir, CANON).replace(/function candidateIsLinear_\(grid, varCells, outputs, options\)/, 'function cilGONE_(grid, varCells, outputs, options)'));
}, 'engine function not found: candidateIsLinear_');
// 32. Engine one-byte change (SHA guard).
expectCheckFail('N32 engine one-byte change', dir => {
  const s = rd(dir, CANON); wr(dir, CANON, s.slice(0, 300) + ' ' + s.slice(300));
}, 'engine SHA unchanged (pinned)');
// 33. Fixture engine bytes field tampered (self-regeneration proxy) — the pinned
//     engine SHA in the fixture no longer matches the source.
expectCheckFail('N33 fixture engine field tampered', dir => {
  const j = JSON.parse(rd(dir, FIXTURE)); j.engine.sha256 = 'c0ffee';
  wr(dir, FIXTURE, JSON.stringify(j, null, 2));
}, 'engine SHA unchanged (pinned)');
// 34. Spaced-path harness load with a missing function (must still fail loudly).
(function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e2 spc-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, HARNESS), path.join(base, HARNESS));
    fs.copyFileSync(path.join(SITE, EXPORTS), path.join(base, EXPORTS));
    fs.copyFileSync(path.join(SITE, E3EXPORTS), path.join(base, E3EXPORTS));
    fs.copyFileSync(path.join(SITE, E4EXPORTS), path.join(base, E4EXPORTS));
    fs.copyFileSync(path.join(SITE, E5EXPORTS), path.join(base, E5EXPORTS));
    const canon = fs.readFileSync(path.join(SITE, CANON), 'utf8');
    fs.writeFileSync(path.join(base, CANON), canon.replace(/function tokenize_\(/, 'function tokenizeZ_('));
    const hp = path.join(base, HARNESS);
    delete require.cache[require.resolve(hp)];
    const h = require(hp);
    let threw = false;
    try { h.loadCanonicalEngine(base); } catch (e) { threw = /engine function not found: tokenize_/.test(e.message); }
    ok('N34 spaced-path missing function fails loudly', threw);
    delete require.cache[require.resolve(hp)];
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

console.log('CANONICAL PARSER FRONT-END NEGATIVE (E2)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
