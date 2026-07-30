/* Test harness for the Plumline engine.
 * Builds the Google-Sheets-like `sheet` object the engine expects from a plain
 * 2D grid of strings, so tests can be written compactly. Nothing here touches
 * the engine; it only feeds it and reads results.
 */
const Engine = require('./engine.js');

/* Build a sheet object from a 2D array of cell strings.
 * A cell starting with '=' is treated as a formula; otherwise, if it parses as
 * a number it is a numeric value, else a text label. This mirrors how Google
 * Sheets exposes getFormulas() (formula text or '') and getValues() (computed).
 * For values, formula cells report 0 unless a precomputed value is supplied via
 * a {f:'=...', v:number} object.
 */
function mkSheet(grid) {
  // Relation operators are literal text in a sheet, not formulas, even though
  // '<=', '>=', '=' start with or contain '='. The shared engine classifier is
  // the single source of truth — a local reimplementation could drift from the
  // real app converter (that drift once hid a '=' equality bug from CI).
  const isFormula = Engine.isFormulaInput_;
  const formulas = grid.map(row => row.map(cell => {
    if (cell && typeof cell === 'object') return cell.f || '';
    return isFormula(cell) ? cell : '';
  }));
  const values = grid.map(row => row.map(cell => {
    if (cell && typeof cell === 'object') return typeof cell.v === 'number' ? cell.v : 0;
    if (isFormula(cell)) return 0;
    if (cell === '' || cell == null) return '';
    const n = Number(cell);
    // A relation operator ('=', '<=', ...) or any other non-numeric string
    // passes through as text; only a clean numeric string becomes a number.
    return (!isNaN(n) && String(n) === String(cell).trim()) ? n : cell;
  }));
  return {
    getDataRange: () => ({
      getRow: () => 1,
      getColumn: () => 1,
      getFormulas: () => formulas,
      getValues: () => values
    })
  };
}

/* Detect + solve in one step, returning {model, out} or {error}. */
function run(grid, opts) {
  const sheet = mkSheet(grid);
  const localeMode = opts && opts.locale ? opts.locale : undefined;
  let model;
  try {
    model = Engine.detectModel_(sheet, localeMode);
  } catch (e) {
    return { error: 'detect: ' + (e.message || e) };
  }
  if (opts && opts.integer) model.wholeNumbers = true;
  // Allow a test to attach per-variable domains exactly as the panel would
  // (e.g. a real binary: { integer:[0], bounds:[{lower:0,upper:1}] }), so
  // binary/bounded models can be exercised through the engine, not just via the
  // whole-numbers toggle.
  if (opts && opts.domains) model.domains = opts.domains;
  if (opts && typeof opts.mutate === 'function') opts.mutate(model);
  let out;
  try {
    out = Engine.solveModel_(sheet, model, localeMode);
  } catch (e) {
    return { error: 'solve: ' + (e.message || e), model };
  }
  return { model, out };
}

/* ---- tiny assertion framework ---- */
let passed = 0, failed = 0;
const failures = [];
function approx(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-6 : tol); }
function check(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; failures.push(name + (detail ? '  — ' + detail : '')); }
}
function report() {
  console.log('\n' + '='.repeat(60));
  console.log('PASSED: ' + passed + '   FAILED: ' + failed);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  ✗ ' + f));
  }
  console.log('='.repeat(60));
  return failed === 0;
}

module.exports = { mkSheet, run, check, approx, report, Engine };
