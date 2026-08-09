'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — DERIVED FACTS.
   ----------------------------------------------------------------------------
   author once, derive whenever possible. Facts are computed DETERMINISTICALLY
   from the F1 catalogue record using the REAL Plumline detection infrastructure,
   never a bespoke heuristic and never by running the solver:

     - Decision-variable IDENTITY comes from the engine's own detector
       (Engine.detectModel_ -> model.variables), expanded to individual cells.
       This is exactly how Plumline decides what a variable is, so it handles
       all-default continuous, partial domains, integer/binary/mixed, multi-cell
       decision blocks and variables outside column B.
     - Model TYPE comes from the engine's own classifier (Engine.classifyModel_),
       fed the per-variable domains in the { integer:[idx], bounds:[{lower,upper}] }
       shape the Variable Settings panel builds — the SAME inputs the engine uses.
     - variableTypes / decisionCount / chartEligible are derived from that same
       variable set, so they can never disagree with modelType.

   detectModel_ is DETECTION only (no solve), so building metadata never runs the
   optimiser. If detection cannot read a model, deriveFacts throws — metadata is
   never silently wrong.
   ========================================================================== */

var path = require('path');
var Engine = require(path.join(__dirname, '..', '..', '..', '..', 'engine', 'engine.js'));

// Minimal sheet adapter (mirrors engine/harness.js mkSheet) so detectModel_ can
// read a catalogue grid. Detection only; never solved here. Uses the shared
// converter classifyGridCell_ so it can never drift from the app on cell parsing.
function mkSheet(grid) {
  var formulas = grid.map(function (row) { return row.map(function (cell) { return Engine.classifyGridCell_(cell).formula; }); });
  var values = grid.map(function (row) { return row.map(function (cell) { return Engine.classifyGridCell_(cell).value; }); });
  return {
    getDataRange: function () {
      return {
        getRow: function () { return 1; },
        getColumn: function () { return 1; },
        getFormulas: function () { return formulas; },
        getValues: function () { return values; },
      };
    },
  };
}

// Pure range expansion (mirrors engine expandRange_; not exported by the engine).
function expandRange(a1) {
  var clean = String(a1).replace(/\$/g, '').toUpperCase();
  var parts = clean.split(':');
  var start = parseAddr(parts[0]);
  var end = parts.length > 1 ? parseAddr(parts[1]) : start;
  var cells = [];
  for (var r = start.row; r <= end.row; r++) {
    for (var c = start.column; c <= end.column; c++) { cells.push(colLetter(c) + r); }
  }
  return cells;
}
function parseAddr(a) {
  var m = /^([A-Z]+)([0-9]+)$/.exec(a);
  if (!m) throw new Error('bad address ' + a);
  return { column: colIndex(m[1]), row: parseInt(m[2], 10) };
}
function colIndex(letters) { var n = 0; for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64); return n; }
function colLetter(index) { var s = ''; while (index > 0) { var m = (index - 1) % 26; s = String.fromCharCode(65 + m) + s; index = Math.floor((index - 1) / 26); } return s; }

// Detect the model ONCE and derive everything detection-backed from that single
// result: decision cells, per-cell effective domains, and constraint count. Callers
// that need several facts should call detectInfo once and reuse it.
function detectInfo(rec) {
  var sheet = mkSheet(rec.model.grid);
  var model = Engine.detectModel_(sheet);   // detection only, never solved
  var cells = expandRange(model.variables);
  return { model: model, cells: cells };
}

// Standalone helpers keep their public API but delegate to a shared detection when
// given one, so deriveFacts never detects twice.
function deriveDecisionCells(rec, info) {
  return (info || detectInfo(rec)).cells;
}
function deriveConstraintCount(rec, info) {
  var model = (info || detectInfo(rec)).model;
  var cons = model.constraints || [];
  return cons.filter(function (c) { return c.isCompleteConstraint; }).length;
}

// CANONICAL effective decision domains, one record per decision cell, using the SAME
// semantics as classifyModel_ / the Variable Settings panel: model.whole promotes a
// cell to integer unless it is explicitly binary; an explicit binary domain is
// integer with [0,1]; an explicit integer domain is integer with its bounds; an
// explicit continuous domain keeps its bounds. This is the ONE representation the
// verifier consumes — it never re-interprets model.whole + model.domains separately.
function deriveEffectiveDomains(rec, info) {
  info = info || detectInfo(rec);
  var cells = info.cells;
  var dom = rec.model.domains || null;
  var whole = !!rec.model.whole;
  return cells.map(function (cell) {
    var d = dom ? dom[cell] : null;
    var effectiveType = 'continuous', lower = 0, upper = null;
    if (d) {
      if (d.type === 'binary') { effectiveType = 'binary'; lower = 0; upper = 1; }
      else if (d.type === 'integer') { effectiveType = 'integer'; lower = d.min == null ? 0 : d.min; upper = d.max == null ? null : d.max; }
      else { effectiveType = 'continuous'; lower = d.min == null ? 0 : d.min; upper = d.max == null ? null : d.max; }
    }
    // model.whole promotes non-binary cells to integer (engine semantics).
    if (whole && effectiveType !== 'binary') effectiveType = 'integer';
    return { cell: cell, effectiveType: effectiveType, lower: lower, upper: upper };
  });
}

// Build { integer:[idx...], bounds:[{lower,upper}...] } from the record's domains,
// addressed by the detected variable order. Mirrors panel variableDomains() and is
// exactly what Engine.classifyModel_ consumes.
function buildDomainSpec(rec, info) {
  var eff = deriveEffectiveDomains(rec, info);
  var integer = []; var bounds = []; var anyInt = false;
  eff.forEach(function (e, i) {
    if (e.effectiveType === 'binary' || e.effectiveType === 'integer') { integer.push(i); anyInt = true; }
    bounds.push({ lower: e.lower, upper: e.upper == null ? null : e.upper });
  });
  return { integer: anyInt ? integer : [], bounds: bounds, n: eff.length, effective: eff };
}

function deriveModelType(rec, info) {
  info = info || detectInfo(rec);
  var spec = buildDomainSpec(rec, info);
  // Engine's own classifier — the single source of truth for model type.
  return Engine.classifyModel_({ integer: spec.integer, bounds: spec.bounds }, !!rec.model.whole, spec.n);
}

// Per-variable type list, derived from the effective domains (same semantics).
function variableTypes(spec) {
  var kinds = {};
  spec.effective.forEach(function (e) { kinds[e.effectiveType] = true; });
  return Object.keys(kinds).sort();
}

// Functions used: scan formulas, normalise names to UPPERCASE (the engine accepts
// function names case-insensitively, so =sum(...) counts as SUM).
function deriveFunctionsUsed(rec) {
  var grid = rec.model.grid; var found = {};
  var re = /([A-Za-z]+)\s*\(/g;
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      var v = grid[r][c];
      if (typeof v === 'string' && v.charAt(0) === '=') {
        var m; while ((m = re.exec(v))) { found[m[1].toUpperCase()] = true; }
      }
    }
  }
  return Object.keys(found).sort();
}

function deriveHasBounds(rec) {
  var domains = rec.model.domains || {};
  return Object.keys(domains).some(function (k) {
    var d = domains[k];
    return (d.min !== undefined && d.min !== null) || (d.max !== undefined && d.max !== null) || d.type === 'binary';
  });
}

function deriveChartEligible(rec, cells, modelType) {
  return modelType === 'continuous' && cells.length === 2;
}

// Number format: EU only if a decimal COMMA literal is present; US only if a
// decimal DOT literal is present; otherwise 'unknown' (integers alone prove
// neither). No "no comma => US" inference.
function deriveNumberFormat(rec) {
  var grid = rec.model.grid; var sawEu = false, sawUs = false;
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      var v = grid[r][c];
      if (typeof v !== 'string' || v.charAt(0) === '=') continue;
      if (/^-?\d+,\d+$/.test(v)) sawEu = true;
      if (/^-?\d+\.\d+$/.test(v)) sawUs = true;
    }
  }
  if (sawEu && !sawUs) return 'eu';
  if (sawUs && !sawEu) return 'us';
  if (sawEu && sawUs) return 'mixed';   // contradictory literals; caller can reject
  return 'unknown';                     // integer-only or empty: neither proven
}

function deriveFacts(rec) {
  // ONE detection for the whole fact set (decision cells + constraints + domains).
  var info = detectInfo(rec);
  var cells = info.cells;
  var spec = buildDomainSpec(rec, info);
  var modelType = Engine.classifyModel_({ integer: spec.integer, bounds: spec.bounds }, !!rec.model.whole, spec.n);
  return {
    modelType: modelType,
    objectiveDirection: rec.sense,
    decisionCount: cells.length,
    constraintCount: deriveConstraintCount(rec, info),
    variableTypes: variableTypes(spec),
    hasBounds: deriveHasBounds(rec),
    functionsUsed: deriveFunctionsUsed(rec),
    chartEligible: deriveChartEligible(rec, cells, modelType),
    numberFormat: deriveNumberFormat(rec),
    gridCells: rec.model.grid.reduce(function (a, row) { return a + row.length; }, 0),
  };
}

module.exports = {
  deriveFacts: deriveFacts,
  deriveModelType: deriveModelType,
  deriveDecisionCells: deriveDecisionCells,
  deriveConstraintCount: deriveConstraintCount,
  deriveEffectiveDomains: deriveEffectiveDomains,
  detectInfo: detectInfo,
  deriveFunctionsUsed: deriveFunctionsUsed,
  deriveHasBounds: deriveHasBounds,
  deriveChartEligible: deriveChartEligible,
  deriveNumberFormat: deriveNumberFormat,
  expandRange: expandRange,
};
