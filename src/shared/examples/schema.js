/* Strict schema validation for the canonical example catalogue.
 *
 * This is SCHEMA validation only: it checks the shape and value ranges of the
 * catalogue data. It does NOT re-implement the parser, detector or solver — model
 * and expected-contract validation against the engine is done separately by the
 * canonical harness in the checker.
 *
 * Returns { ok, errors } where errors is an array of human-readable strings.
 */

'use strict';

var VALID_CATEGORIES = ['start', 'business', 'binary'];
var VALID_TYPES = ['continuous', 'integer', 'binary', 'mixed'];
var VALID_SENSES = ['max', 'min'];
var VALID_STATUSES = ['optimal', 'feasible', 'incomplete', 'unknown', 'infeasible', 'unbounded'];
var VALID_MODEL_TYPES = ['continuous', 'integer', 'binary', 'mixed'];
var LANGS = ['en', 'es', 'pt', 'de', 'fr'];
var VALID_DOMAIN_TYPES = ['continuous', 'integer', 'binary'];

// The only keys a record may carry.
var RECORD_KEYS = ['key', 'slug', 'category', 'type', 'sense', 'translations', 'model', 'expected'];
var MODEL_KEYS = ['grid', 'fieldOrder', 'whole', 'domains', 'openVarSettings'];
var EXPECTED_KEYS = ['status', 'modelType', 'objective', 'tolerance'];
var TRANSLATION_KEYS = ['title', 'desc'];

function isFiniteNumber(n) { return typeof n === 'number' && isFinite(n); }
function isPlainObject(o) { return o && typeof o === 'object' && !Array.isArray(o); }

// Strict lowercase kebab-case grammar for stable identifiers (slugs, tags):
// one or more [a-z0-9] groups joined by single hyphens. Rejects spaces,
// uppercase, underscores, leading/trailing hyphens and double hyphens.
var KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Localized content hygiene for F1 translations.title/desc. These strings are
// consumed by examples.html cards and (in F6) the library/search UI, so they must
// be clean, trimmed plain text — never a placeholder, a raw field name, or markup.
// This is the SAME contract the F5 content.question/goal fields already enforce;
// it lives here because title/desc are F1-owned (F1 must not depend on F5).
var PLACEHOLDER_RE = /\b(?:todo|fixme|lorem\s+ipsum|xxx)\b/i;
var HTML_RE = /<[^>]+>/;                         // any angle-bracket tag
var JS_URI_RE = /javascript:/i;                  // javascript: URIs
var EVENT_HANDLER_RE = /\bon[a-z]+\s*=/i;        // inline event handlers (onclick=, onload=)
function checkContentHygiene(value, label, where, errors) {
  if (typeof value !== 'string' || !value) { errors.push(where + ': empty ' + label); return; }
  if (value !== value.trim()) errors.push(where + ': ' + label + ' must be trimmed (no leading/trailing whitespace)');
  if (HTML_RE.test(value)) errors.push(where + ': ' + label + ' must be plain text (no HTML tags)');
  if (JS_URI_RE.test(value) || EVENT_HANDLER_RE.test(value)) errors.push(where + ': ' + label + ' must not contain script/event content');
  if (PLACEHOLDER_RE.test(value)) errors.push(where + ': ' + label + ' looks like placeholder text (TODO/FIXME/lorem ipsum)');
  var trimmed = value.trim();
  if (trimmed === label || trimmed === 'title' || trimmed === 'desc') errors.push(where + ': ' + label + ' must not be the raw field name "' + trimmed + '"');
}

function validateRecord(rec, index, errors) {
  var where = 'record[' + index + ']' + (rec && rec.key ? ' (' + rec.key + ')' : '');

  if (!isPlainObject(rec)) { errors.push(where + ': not an object'); return; }

  // no unknown fields
  Object.keys(rec).forEach(function (k) {
    if (RECORD_KEYS.indexOf(k) === -1) errors.push(where + ': unknown field "' + k + '"');
  });
  // no functions anywhere
  (function scan(node, path) {
    if (typeof node === 'function') { errors.push(where + ': function found at ' + path); return; }
    if (Array.isArray(node)) { node.forEach(function (v, i) { scan(v, path + '[' + i + ']'); }); return; }
    if (isPlainObject(node)) { Object.keys(node).forEach(function (k) { scan(node[k], path + '.' + k); }); }
  })(rec, where);

  if (typeof rec.key !== 'string' || !rec.key) {
    errors.push(where + ': key must be a non-empty string');
  } else if (!KEBAB_RE.test(rec.key)) {
    errors.push(where + ': key "' + rec.key + '" must be lowercase kebab-case (^[a-z0-9]+(?:-[a-z0-9]+)*$): stable machine ID, no spaces, uppercase, underscores, leading/trailing or double hyphens');
  }
  if (typeof rec.slug !== 'string' || !rec.slug) {
    errors.push(where + ': slug must be a non-empty string');
  } else if (!KEBAB_RE.test(rec.slug)) {
    errors.push(where + ': slug "' + rec.slug + '" must be lowercase kebab-case (^[a-z0-9]+(?:-[a-z0-9]+)*$): no spaces, uppercase, underscores, leading/trailing or double hyphens');
  }
  if (VALID_CATEGORIES.indexOf(rec.category) === -1) errors.push(where + ': invalid category "' + rec.category + '"');
  if (VALID_TYPES.indexOf(rec.type) === -1) errors.push(where + ': invalid type "' + rec.type + '"');
  if (VALID_SENSES.indexOf(rec.sense) === -1) errors.push(where + ': invalid sense "' + rec.sense + '"');

  // translations: exactly five languages, non-empty title + desc
  if (!isPlainObject(rec.translations)) {
    errors.push(where + ': translations missing');
  } else {
    LANGS.forEach(function (lang) {
      var t = rec.translations[lang];
      if (!isPlainObject(t)) { errors.push(where + ': translation missing for "' + lang + '"'); return; }
      Object.keys(t).forEach(function (k) {
        if (TRANSLATION_KEYS.indexOf(k) === -1) errors.push(where + ': unknown translation field "' + k + '" in ' + lang);
      });
      checkContentHygiene(t.title, 'title', where + ' [' + lang + ']', errors);
      checkContentHygiene(t.desc, 'desc', where + ' [' + lang + ']', errors);
    });
    Object.keys(rec.translations).forEach(function (lang) {
      if (LANGS.indexOf(lang) === -1) errors.push(where + ': extra language "' + lang + '"');
    });
  }

  // model
  if (!isPlainObject(rec.model)) {
    errors.push(where + ': model missing');
  } else {
    Object.keys(rec.model).forEach(function (k) {
      if (MODEL_KEYS.indexOf(k) === -1) errors.push(where + ': unknown model field "' + k + '"');
    });
    if (!Array.isArray(rec.model.grid) || rec.model.grid.length === 0) {
      errors.push(where + ': grid must be a non-empty array');
    } else {
      rec.model.grid.forEach(function (row, r) {
        if (!Array.isArray(row) || row.length === 0) { errors.push(where + ': grid row ' + r + ' invalid'); return; }
        row.forEach(function (cell, c) {
          if (typeof cell !== 'string') errors.push(where + ': grid cell [' + r + '][' + c + '] must be a string');
        });
      });
    }
    if (rec.model.whole !== undefined && typeof rec.model.whole !== 'boolean') errors.push(where + ': whole must be boolean');
    if (rec.model.openVarSettings !== undefined && typeof rec.model.openVarSettings !== 'boolean') errors.push(where + ': openVarSettings must be boolean');
    if (rec.model.domains !== undefined) {
      if (!isPlainObject(rec.model.domains)) {
        errors.push(where + ': domains must be an object');
      } else {
        var gridCells = collectGridCells(rec.model.grid);
        Object.keys(rec.model.domains).forEach(function (cell) {
          if (!/^[A-Z]+[0-9]+$/.test(cell)) errors.push(where + ': invalid domain cell reference "' + cell + '"');
          else if (gridCells.indexOf(cell) === -1) errors.push(where + ': domain references non-existent cell "' + cell + '"');
          var d = rec.model.domains[cell];
          if (!isPlainObject(d)) { errors.push(where + ': domain "' + cell + '" must be an object'); return; }
          if (VALID_DOMAIN_TYPES.indexOf(d.type) === -1) errors.push(where + ': invalid domain type "' + d.type + '" at ' + cell);
          if (d.min !== undefined && d.min !== null && !isFiniteNumber(d.min)) errors.push(where + ': invalid domain min at ' + cell);
          if (d.max !== undefined && d.max !== null && !isFiniteNumber(d.max)) errors.push(where + ': invalid domain max at ' + cell);
        });
      }
    }
    // fieldOrder is a serialization contract; if present it must be a subset of known fields
    if (rec.model.fieldOrder !== undefined) {
      if (!Array.isArray(rec.model.fieldOrder)) errors.push(where + ': fieldOrder must be an array');
      else rec.model.fieldOrder.forEach(function (f) {
        if (['whole', 'grid', 'domains', 'openVarSettings', 'expected'].indexOf(f) === -1) errors.push(where + ': fieldOrder has unknown field "' + f + '"');
      });
    }
  }

  // expected: status/modelType/objective, tolerance when present. No variable values.
  if (!isPlainObject(rec.expected)) {
    errors.push(where + ': expected missing');
  } else {
    Object.keys(rec.expected).forEach(function (k) {
      if (EXPECTED_KEYS.indexOf(k) === -1) errors.push(where + ': unknown/invented expected field "' + k + '" (expected values must not be pinned)');
    });
    if (VALID_STATUSES.indexOf(rec.expected.status) === -1) errors.push(where + ': invalid expected status "' + rec.expected.status + '"');
    if (VALID_MODEL_TYPES.indexOf(rec.expected.modelType) === -1) errors.push(where + ': invalid expected modelType "' + rec.expected.modelType + '"');
    // Expected objective is STATUS-AWARE. Solution-bearing statuses (optimal/feasible)
    // require a finite numeric objective. No-solution statuses (infeasible/unbounded)
    // have no incumbent, so the objective is canonically null or absent — a numeric
    // objective is rejected. The nine existing records are all 'optimal' with finite
    // objectives, so they stay byte-identical.
    var noSolutionStatus = rec.expected.status === 'infeasible' || rec.expected.status === 'unbounded';
    if (noSolutionStatus) {
      if (rec.expected.objective !== null && rec.expected.objective !== undefined) {
        errors.push(where + ': a no-solution status (' + rec.expected.status + ') must not pin an objective (use null or omit it)');
      }
    } else {
      if (!isFiniteNumber(rec.expected.objective)) errors.push(where + ': expected objective must be finite');
    }
    // Tolerance is STATUS-AWARE at the structural level (F1 owns structure only; the
    // F5 layer owns the MIN/MAX quality band). No-solution statuses are status-only:
    // they must not carry a tolerance any more than an objective. Solution-bearing
    // statuses may carry a tolerance, and when present it must be finite and positive.
    if (noSolutionStatus) {
      if (rec.expected.tolerance !== undefined) {
        errors.push(where + ': a no-solution status (' + rec.expected.status + ') must not carry a tolerance (status-only)');
      }
    } else if (rec.expected.tolerance !== undefined && !(isFiniteNumber(rec.expected.tolerance) && rec.expected.tolerance > 0)) {
      errors.push(where + ': tolerance must be finite and positive when present');
    }
  }
}

function collectGridCells(grid) {
  // Column letters A.. by index; row number is 1-based row index.
  var cells = [];
  if (!Array.isArray(grid)) return cells;
  for (var r = 0; r < grid.length; r++) {
    var row = grid[r];
    if (!Array.isArray(row)) continue;
    for (var c = 0; c < row.length; c++) {
      cells.push(colLetter(c) + (r + 1));
    }
  }
  return cells;
}

function colLetter(index) {
  var s = '';
  index += 1;
  while (index > 0) { var m = (index - 1) % 26; s = String.fromCharCode(65 + m) + s; index = Math.floor((index - 1) / 26); }
  return s;
}

function validateCatalogue(catalogue, opts) {
  opts = opts || {};
  var errors = [];
  if (!Array.isArray(catalogue)) { return { ok: false, errors: ['catalogue is not an array'] }; }

  // during F1 there are exactly nine examples
  if (opts.expectCount !== undefined && catalogue.length !== opts.expectCount) {
    errors.push('expected ' + opts.expectCount + ' examples, got ' + catalogue.length);
  }

  var seenKeys = {};
  var seenSlugs = {};
  catalogue.forEach(function (rec, i) {
    validateRecord(rec, i, errors);
    if (rec && rec.key) {
      if (seenKeys[rec.key]) errors.push('duplicate key "' + rec.key + '"');
      seenKeys[rec.key] = true;
    }
    if (rec && rec.slug) {
      if (seenSlugs[rec.slug]) errors.push('duplicate slug "' + rec.slug + '"');
      seenSlugs[rec.slug] = true;
    }
  });

  return { ok: errors.length === 0, errors: errors };
}

module.exports = {
  validateCatalogue: validateCatalogue,
  collectGridCells: collectGridCells,
  colLetter: colLetter,
  LANGS: LANGS,
  VALID_CATEGORIES: VALID_CATEGORIES,
  VALID_TYPES: VALID_TYPES,
  VALID_SENSES: VALID_SENSES
};
