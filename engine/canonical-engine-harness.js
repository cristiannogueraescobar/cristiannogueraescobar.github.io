/* canonical-engine-harness.js — Checkpoint E2 test adapter.
 *
 * Loads ONLY engine/source/plumline-engine.js and runs it in a Node vm context,
 * then appends a TEST-ONLY export epilogue that surfaces a CLOSED list of E2
 * front-end functions. It never modifies the source, never copies a function
 * body, never touches engine/engine.js, never reads solver.html or dist, works
 * from spaced paths and on Windows/Linux, and gives each call a fresh context.
 *
 * The epilogue is NOT part of the engine, is never published, never changes the
 * Worker, and duplicates no math. It lists the exported names explicitly and
 * throws if any requested function is missing from the source.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { E2_EXPORTS, NOT_EXPOSED_E3_E5 } = require('./e2-exports.js');
const { E3_EXPORTS, FORBIDDEN_E4_E6, E2_ONLY } = require('./e3-exports.js');
const { E4_EXPORTS, FORBIDDEN_E5_E6 } = require('./e4-exports.js');
const { E5_EXPORTS, FORBIDDEN_E6 } = require('./e5-exports.js');

// Phase registry: each phase has a closed export list and a forbidden set. The
// harness serves all phases from the SAME infrastructure; it never merges the
// phases' export sets. E2 stays exactly its 24 functions; E3 exposes only its 22
// approved functions; E4 exposes only its 8; E5 exposes only its approved list and
// rejects any E6 function.
const PHASES = {
  e2: { exports: E2_EXPORTS, forbidden: NOT_EXPOSED_E3_E5 },
  e3: { exports: E3_EXPORTS, forbidden: FORBIDDEN_E4_E6 },
  e4: { exports: E4_EXPORTS, forbidden: FORBIDDEN_E5_E6 },
  e5: { exports: E5_EXPORTS, forbidden: FORBIDDEN_E6 },
};

// Environment stubs. The source references only Math and Date (both native in a
// vm context) plus no DOM/window/self. We provide console for defensive logging
// paths and Math/Date/JSON explicitly so the sandbox is self-contained. No stub
// changes any tested behaviour: none of them is a math primitive the engine
// depends on for results.
//   - console: some defensive branches may log; tests never assert on logs.
//   - Math, Date, JSON, Number, Array, Object, String, Boolean, isNaN, isFinite,
//     parseFloat, parseInt: standard globals the engine uses for pure computation.
function makeSandbox() {
  return {
    console: { log() {}, warn() {}, error() {} },
    Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array,
    Object: Object, String: String, Boolean: Boolean, RegExp: RegExp,
    isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt,
  };
}

const CANON_REL = path.join('engine', 'source', 'plumline-engine.js');

// Build the export epilogue: it assigns each requested name onto a __exports__
// object and throws (inside the sandbox) if a name is undefined, so a missing
// function fails loudly rather than silently exporting undefined.
function exportEpilogue(names) {
  const lines = ['\n;(function(){', '  var __e = {};'];
  for (const n of names) {
    lines.push('  if (typeof ' + n + ' === "undefined") { throw new Error("harness: engine function not found: ' + n + '"); }');
    lines.push('  __e["' + n + '"] = ' + n + ';');
  }
  lines.push('  __exports__ = __e;');
  lines.push('})();');
  return lines.join('\n');
}

/**
 * loadCanonicalEngine(siteDir, names?) -> { fns, sandbox }
 * Runs the canonical source in a fresh vm context and returns the requested
 * exports. names defaults to the full closed E2 list; passing a subset returns
 * only those (still validated against the source).
 */
function loadCanonicalEngine(siteDir, names, phase) {
  siteDir = siteDir || path.join(__dirname, '..');
  // Phase selection: default 'e2' for backward compatibility. The phase decides
  // the closed list and the forbidden set; names (if given) must be a subset of
  // the phase's list.
  phase = phase || 'e2';
  const spec = PHASES[phase];
  if (!spec) throw new Error('harness: unknown phase "' + phase + '"');
  const allowed = spec.exports;
  const forbidden = spec.forbidden;
  const requested = names || allowed;
  // Guard: reject a forbidden (next-phase) name and a name outside this phase.
  const forbiddenLabel = phase === 'e2' ? 'E3-E5' : (phase === 'e3' ? 'E4-E6' : (phase === 'e4' ? 'E5-E6' : 'E6'));
  for (const n of requested) {
    if (forbidden.indexOf(n) !== -1) {
      throw new Error('harness: "' + n + '" is a forbidden (' + forbiddenLabel + ') function and must not be exposed');
    }
    if (allowed.indexOf(n) === -1) {
      throw new Error('harness: "' + n + '" is not in the closed ' + phase.toUpperCase() + ' export list');
    }
  }
  const canonAbs = path.join(siteDir, CANON_REL);
  const source = fs.readFileSync(canonAbs, 'utf8');
  const sandbox = makeSandbox();
  sandbox.__exports__ = null;
  const context = vm.createContext(sandbox);
  const code = source + exportEpilogue(requested);
  vm.runInContext(code, context, { filename: CANON_REL, displayErrors: true });
  const fns = sandbox.__exports__;
  // Guard: every export must be a real function.
  for (const n of requested) {
    if (typeof fns[n] !== 'function') {
      throw new Error('harness: export "' + n + '" is not a function (got ' + typeof fns[n] + ')');
    }
  }
  // Guard: no two DISTINCT names may resolve to the SAME function object unless
  // that alias is declared (none are declared), which would silently collapse
  // two contracts into one.
  const byRef = new Map();
  for (const n of requested) {
    const f = fns[n];
    if (byRef.has(f)) {
      throw new Error('harness: undeclared alias — "' + n + '" and "' + byRef.get(f) + '" are the same function');
    }
    byRef.set(f, n);
  }
  return { fns: fns, sandbox: sandbox };
}

// createCanonicalEngineHarness({ phase }) — convenience factory returning a
// bound loader/fresh pair for a phase. E2 callers can keep using
// loadCanonicalEngine/freshEngine unchanged.
function createCanonicalEngineHarness(opts) {
  const phase = (opts && opts.phase) || 'e2';
  return {
    phase: phase,
    load: function (siteDir, names) { return loadCanonicalEngine(siteDir, names, phase); },
    fresh: function (siteDir, names) { return loadCanonicalEngine(siteDir, names, phase).fns; },
  };
}

// Convenience: a fresh set of E2 functions with a clean context each call.
function freshEngine(siteDir, names) {
  return loadCanonicalEngine(siteDir, names).fns;
}

// sheetStub(formulas, values) — a minimal object implementing ONLY the tiny
// slice of the Google-Sheets-like reader interface that loadGrid_ calls
// (getDataRange().getFormulas()/getValues()/getRow()/getColumn()). Documented
// environment stub:
//   name:   sheetStub
//   reason: loadGrid_ reads its grid through a sheet reader; tests must supply
//           formulas/values as 2-D string arrays without a real spreadsheet.
//   value:  formulas/values verbatim; getRow()/getColumn() return 1 (A1 origin).
//   impact: NONE on tested behaviour — loadGrid_ only reads these arrays; it is
//           the engine's own loader that normalises and shapes the grid.
//   why safe: the stub adds no math, no parsing, no normalisation; every
//           transformation is done by the engine's loadGrid_, not the stub.
function sheetStub(formulas, values) {
  const f = formulas || [[]];
  const v = values || f.map(row => row.map(() => ''));
  const range = {
    getFormulas: () => f,
    getValues: () => v,
    getRow: () => 1,
    getColumn: () => 1,
    getNumRows: () => f.length,
    getNumColumns: () => (f.length ? f[0].length : 0),
  };
  return { getDataRange: () => range };
}

// gridFromArrays(fns, formulas, values, localeMode?) — build the real grid object
// via the engine's own loadGrid_ (no duplication).
function gridFromArrays(fns, formulas, values, localeMode) {
  return fns.loadGrid_(sheetStub(formulas, values), localeMode || 'auto');
}

module.exports = {
  E2_EXPORTS: E2_EXPORTS,
  E3_EXPORTS: E3_EXPORTS,
  E4_EXPORTS: E4_EXPORTS,
  E5_EXPORTS: E5_EXPORTS,
  loadCanonicalEngine: loadCanonicalEngine,
  createCanonicalEngineHarness: createCanonicalEngineHarness,
  freshEngine: freshEngine,
  sheetStub: sheetStub,
  gridFromArrays: gridFromArrays,
  CANON_REL: CANON_REL,
};

if (require.main === module) {
  const { fns } = loadCanonicalEngine(path.join(__dirname, '..'));
  console.log('canonical-engine-harness: loaded ' + Object.keys(fns).length + ' E2 functions');
  console.log('  ' + Object.keys(fns).join(', '));
}
