/* tests_canonical_parser_frontend_positive.js — Checkpoint E2 positive contracts.
 *
 * Runs the official checkCanonicalParserFrontEnd() (its ~47 assertions ARE the
 * core E2 contracts: references, ranges, grammar, operators, SUM/SUMIF, criteria,
 * linearisation, coefficients, parity, engine SHA, public output), then adds the
 * architecture-level guarantees the pliego enumerates: canonical-only load,
 * spaced paths, dist independence, closed exports, clean state. It does NOT
 * re-implement the parser.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkCanonicalParserFrontEnd } = require('./tests_canonical_parser_frontend.js');
const { loadCanonicalEngine, freshEngine, gridFromArrays, E2_EXPORTS } = require('./canonical-engine-harness.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}

// 1. The official checker is fully green.
const r = checkCanonicalParserFrontEnd(SITE);
ok('official E2 checker green on real tree (' + r.pass + ' assertions)', r.fail === 0, r.failures.join('; '));

// 2. Harness loads canonical only and is dist-independent.
ok('harness loads canonical without a dist', (() => {
  const { fns } = loadCanonicalEngine(SITE);
  return typeof fns.tokenize_ === 'function' && typeof fns.linearize_ === 'function';
})());

// 3. Closed exports: E3-E5 functions are not reachable.
ok('E3 function not reachable through harness', (() => {
  try { loadCanonicalEngine(SITE, ['pivot_']); return false; } catch (e) { return /forbidden \(E3-E5\)/.test(e.message); }
})());

// 4. Missing engine function fails loudly (epilogue guard). Simulate by mutating a copy.
(function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2pos-'));
  try {
    fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
    const canon = fs.readFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), 'utf8');
    // rename tokenize_ so the epilogue can't find it
    fs.writeFileSync(path.join(dir, 'engine', 'source', 'plumline-engine.js'),
      canon.replace(/function tokenize_\(/, 'function tokenizeX_('));
    let threw = false;
    try { loadCanonicalEngine(dir, ['tokenize_']); } catch (e) { threw = /engine function not found: tokenize_/.test(e.message); }
    ok('epilogue fails loudly when a requested function is missing', threw);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// 5. Clean state per run: mutating one instance's function set does not affect another.
(function () {
  const a = loadCanonicalEngine(SITE);
  const b = loadCanonicalEngine(SITE);
  a.fns.tokenize_ = null;
  ok('state is isolated per load', typeof b.fns.tokenize_ === 'function');
})();

// 6. Spaced-path load.
(function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e2 space-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'),
      path.join(base, 'engine', 'source', 'plumline-engine.js'));
    const E = freshEngine(base);
    const grid = gridFromArrays(E, [['=A2+A3'], ['10'], ['20']]);
    const ctx = E.newContext_(grid, ['A2', 'A3']);
    const form = E.linearize_(ctx, 'A1', 0);
    ok('linearisation works from a spaced path', form.terms.A2 === 1 && form.terms.A3 === 1);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

// 7. E2 export list is exactly the fixture's closed list.
const g = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e2-front-end.json'), 'utf8'));
ok('E2 export list matches fixture', JSON.stringify(E2_EXPORTS.slice().sort()) === JSON.stringify(g.harness.e2_exports_closed_list.slice().sort()));

// 8. COUNTIF documented unsupported, SUM/SUMIF supported.
ok('grammar: COUNTIF unsupported, SUM/SUMIF supported',
  g.grammar.countif.supported === false && g.grammar.functions_supported.indexOf('SUM') !== -1 && g.grammar.functions_supported.indexOf('SUMIF') !== -1);

// 9. Two approved divergences only (parity rule).
ok('parity approved divergences are exactly newContext_/readConstraint_',
  JSON.stringify(g.parity_matrix.approved_divergences.slice().sort()) === JSON.stringify(['newContext_', 'readConstraint_']));

console.log('CANONICAL PARSER FRONT-END POSITIVE (E2)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
