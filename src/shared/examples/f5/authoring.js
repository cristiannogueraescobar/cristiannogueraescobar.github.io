'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — AUTHORING API + serializer + freeze.
   ----------------------------------------------------------------------------
   defineExample(rec, meta) is the helper F7 will use to add example #10..#60. It
   validates the authored metadata against the model, rejects unknown fields,
   assembles the canonical object, attaches derived facts (only through the
   projector), and deep-freezes the result so a consumer cannot mutate the source.

   serializeCanonical(canon) produces a deterministic, clone-safe string: sorted
   keys, no functions, no Date, no cyclic refs. Two serializations of the same
   canonical object are byte-identical.
   ========================================================================== */

var path = require('path');
var assemble = require('./assemble.js');
var validate = require('./validate.js');
var derive = require('./derive.js');
var f1schema = require(path.join(__dirname, '..', 'schema.js'));

function defineExample(rec, meta) {
  var errors = [];
  // 1. Validate the F1 record with the REAL F1 schema. The F1 schema now owns the
  //    status-aware expected-objective rule (solution-bearing requires a finite
  //    objective; no-solution requires null/absent), so defineExample uses it
  //    normally — no error is suppressed here. The SAME schema runs on the canonical
  //    load path (f1.loadAndValidateCatalogue), so defineExample and loadCanonical
  //    agree on every record.
  var f1res = f1schema.validateCatalogue([rec], {});
  if (!f1res.ok) f1res.errors.forEach(function (e) { errors.push('F1: ' + e); });
  // 2. Cross-layer legacy modelType consistency — the SAME reusable check the
  //    canonical loader runs, not a second copy.
  validate.validateCrossLayer(rec, errors);
  // 3. Validate the F5 metadata against the model (publishability + resultPolicy).
  validate.validateMetaRecord(rec.key, meta, rec, errors);
  if (errors.length) {
    var err = new Error('defineExample(' + rec.key + ') invalid: ' + errors.join('; '));
    err.errors = errors;
    throw err;
  }
  var canon = assemble.assembleExample(rec, meta);
  return deepFreeze(canon);
}

function deepFreeze(o) {
  if (o && typeof o === 'object') {
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    Object.freeze(o);
  }
  return o;
}

// Deterministic serialization: recursively sort object keys, reject non-data.
function serializeCanonical(canon) {
  return JSON.stringify(sortValue(canon, []));
}
function sortValue(v, seen) {
  if (v === null) return null;
  var t = typeof v;
  if (t === 'function') throw new Error('serializeCanonical: function found');
  if (t === 'number' || t === 'string' || t === 'boolean') return v;
  if (v instanceof Date) throw new Error('serializeCanonical: Date found');
  if (Array.isArray(v)) {
    if (seen.indexOf(v) !== -1) throw new Error('serializeCanonical: cyclic structure');
    seen.push(v);
    var arr = v.map(function (x) { return sortValue(x, seen); });
    seen.pop();
    return arr;
  }
  if (t === 'object') {
    if (seen.indexOf(v) !== -1) throw new Error('serializeCanonical: cyclic structure');
    seen.push(v);
    var out = {};
    Object.keys(v).sort().forEach(function (k) { out[k] = sortValue(v[k], seen); });
    seen.pop();
    return out;
  }
  throw new Error('serializeCanonical: unsupported value type ' + t);
}

module.exports = {
  defineExample: defineExample,
  deepFreeze: deepFreeze,
  serializeCanonical: serializeCanonical,
};
