/* Compatibility harness for the generated engine mirror.
 *
 * This harness is NOT the mathematical authority. It requires engine/engine.js —
 * the GENERATED Node/add-on mirror (a deterministic derivation of the single
 * editable canonical source engine/source/plumline-engine.js, produced by
 * engine/generate-engine-mirror.js). Its purpose is to exercise the standalone
 * add-on artefact and confirm it stays behaviour-compatible with the canonical
 * engine, which the canonical-engine-harness validates directly.
 *
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
  // The shared engine converter (classifyGridCell_) is the single source of
  // truth for splitting a cell into {formula, value} — the same code the app's
  // sheetFromGrid uses. A {f,v} object carries an explicit formula + cached
  // value (used to reproduce the web grid caching formulas as 0); everything
  // else goes through the shared converter so the harness can never drift from
  // the app on formula classification OR value conversion.
  const formulas = grid.map(row => row.map(cell => {
    if (cell && typeof cell === 'object') return cell.f || '';
    return Engine.classifyGridCell_(cell).formula;
  }));
  const values = grid.map(row => row.map(cell => {
    if (cell && typeof cell === 'object') return typeof cell.v === 'number' ? cell.v : 0;
    return Engine.classifyGridCell_(cell).value;
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
