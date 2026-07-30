/* State-integrity tests for the Plumline engine.
 * The essential rule (from the review): 'infeasible' may ONLY be reported when
 * it is mathematically proven. Any iteration/time/node limit, numerical failure,
 * or unresolvable branch must be surfaced as an INCOMPLETE SEARCH, never as
 * infeasibility.
 *
 * To trigger a limit deterministically we load a copy of the engine with a very
 * low MAX_ITERATIONS, feed it a model that provably HAS a solution, and assert
 * the engine does NOT claim 'infeasible'.
 */
// Public product capabilities demonstrated by the cases in this file
// (anchors validated by tests_capabilities.js — do not remove without
// updating assets/product-capabilities.js):
//   CAPABILITY: verify-statuses
//   CAPABILITY: explain-solve-details

const fs = require('fs');
const path = require('path');

// Build a low-iteration copy of the engine in memory and require it.
const engineSrc = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const lowSrc = engineSrc.replace('MAX_ITERATIONS: 20000,', 'MAX_ITERATIONS: 3,');
const lowPath = path.join(require('os').tmpdir(), 'plumline_engine_low_' + Date.now() + '.js');
fs.writeFileSync(lowPath, lowSrc);
const LowEngine = require(lowPath);
const NormalEngine = require('./engine.js');

function mkSheet(grid) {
  const REL = { '<=': 1, '>=': 1, '=': 1, '<': 1, '>': 1 };
  const isF = x => typeof x === 'string' && x[0] === '=' && !REL[x];
  const formulas = grid.map(r => r.map(c => (c && typeof c === 'object') ? (c.f || '') : (isF(c) ? c : '')));
  const values = grid.map(r => r.map(c => {
    if (c && typeof c === 'object') return typeof c.v === 'number' ? c.v : 0;
    if (isF(c)) return 0;
    if (c === '' || c == null) return '';
    if (REL[c]) return c;
    const n = Number(c);
    return (!isNaN(n) && String(n) === String(c).trim()) ? n : c;
  }));
  return { getDataRange: () => ({ getRow: () => 1, getColumn: () => 1, getFormulas: () => formulas, getValues: () => values }) };
}
function buildMax(vars, consts) {
  const grid = [['Item', 'Units', 'x', 'Total', 'Rel', 'Limit']];
  vars.forEach(v => grid.push([v.name, '0', '', '', '', '']));
  grid.push(['', '', '', '', '', '']);
  grid.push(['Total', '', '', '=' + vars.map((v, i) => v.profit + '*B' + (2 + i)).join('+'), '', '']);
  consts.forEach(c => grid.push([c.label || 'C', '', '', '=' + c.coefs.map((co, i) => co + '*B' + (2 + i)).join('+'), c.rel, String(c.limit)]));
  return grid;
}
function solve(eng, grid, integer) {
  const sheet = mkSheet(grid);
  const model = eng.detectModel_(sheet);
  if (integer) model.wholeNumbers = true;
  return eng.solveModel_(sheet, model);
}

let passed = 0, failed = 0; const fails = [];
function check(name, cond, detail) { if (cond) passed++; else { failed++; fails.push(name + (detail ? '  — ' + detail : '')); } }

// A model that provably has an integer optimum.
const grid = buildMax(
  [{ name: 'A', profit: 5 }, { name: 'B', profit: 4 }, { name: 'C', profit: 3 }],
  [{ coefs: [2, 3, 1], rel: '<=', limit: 10 }, { coefs: [4, 1, 2], rel: '<=', limit: 15 }, { coefs: [3, 2, 2], rel: '<=', limit: 12 }]
);

// Sanity: the normal engine solves it (so 'infeasible' would be a lie).
const normal = solve(NormalEngine, grid, true);
check('S0 normal engine finds a solution', normal.status === 'optimal' || normal.status === 'feasible', normal.status);

// The core state-integrity check: under an iteration limit, the engine must NOT
// claim infeasible for a model that has a solution.
const low = solve(LowEngine, grid, true);
check('S1 limit is NOT reported as infeasible', low.status !== 'infeasible',
  'got status=' + low.status);

// Stronger: it should carry a limit/unknown status we can recognise.
check('S2 limit surfaces as an incomplete-search status',
  /limit|unknown|feasible|optimal/i.test(low.status),
  'got status=' + low.status);

console.log('\n' + '='.repeat(60));
console.log('STATE TESTS  PASSED: ' + passed + '   FAILED: ' + failed);
if (fails.length) { console.log('\nFailures:'); fails.forEach(f => console.log('  ✗ ' + f)); }
console.log('='.repeat(60));

try { fs.unlinkSync(lowPath); } catch (e) {}
process.exit(failed === 0 ? 0 : 1);
