'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — canonical VALIDATOR.
   ----------------------------------------------------------------------------
   Deterministic, dependency-free validation of the F5 authored metadata and of
   the assembled canonical catalogue. Produces { ok, errors } where each error is
   a human-readable string naming the example key, the exact field path and the
   rule, e.g. "production.content.de.question is missing". Error order is
   deterministic (records in catalogue order, fields in a fixed order).

   This validates the F5 EDITORIAL layer and cross-checks authored vs derived.
   The F1 catalogue keeps its own strict schema (schema.js) for identity/model/
   expected; the engine behavioural suite independently confirms the maths.
   ========================================================================== */

var E = require('./enums.js');
var derive = require('./derive.js');

// primaryCategory membership derives from the frozen canonical authority
// (E.CATEGORY_IDS, derived from CATEGORY_CONTRACT), not a second mutable list.
var CATEGORY_ID_SET = E.CATEGORY_IDS;

var META_KEYS = ['schemaVersion', 'primaryCategory', 'difficulty', 'minutes', 'audiences', 'provenance', 'tags', 'capabilities', 'related', 'result', 'content', 'seo'];
var CONTENT_KEYS = ['question', 'goal'];
var PROVENANCE_KEYS = ['kind', 'source', 'url', 'license'];
var RESULT_KEYS = ['policy', 'decisions'];
var SEO_KEYS = ['title', 'description'];

// Reject anything that looks like markup, script or a dangerous URL in text.
function looksUnsafe(s) {
  return /<[^>]+>/.test(s) ||               // any HTML tag
    /javascript:/i.test(s) ||               // javascript: URL
    /on\w+\s*=/.test(s) ||                  // inline event handler
    /&lt;script/i.test(s);
}
function looksPlaceholder(s) {
  return /\bTODO\b/i.test(s) || /lorem ipsum/i.test(s) || /\bFIXME\b/i.test(s) ||
    /^\s*(title|desc|question|goal)\s*$/i.test(s) ||   // raw field-name placeholder
    /xxx+/i.test(s);
}

function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
function isPlainObject(o) { return o && typeof o === 'object' && !Array.isArray(o); }

/* Validate one authored metadata record against its F1 catalogue record. */
function validateMetaRecord(key, meta, rec, errors) {
  var w = key;
  if (!isPlainObject(meta)) { errors.push(w + ': metadata is not an object'); return; }

  // Unknown top-level fields are an error (catches typos like `dificulty`).
  Object.keys(meta).forEach(function (k) {
    if (META_KEYS.indexOf(k) === -1) errors.push(w + ': unknown field "' + k + '"');
  });

  // schemaVersion
  if (meta.schemaVersion !== E.SCHEMA_VERSION) errors.push(w + '.schemaVersion must be ' + E.SCHEMA_VERSION + ' (got ' + JSON.stringify(meta.schemaVersion) + ')');

  // primaryCategory
  if (typeof meta.primaryCategory !== 'string' || CATEGORY_ID_SET.indexOf(meta.primaryCategory) === -1) {
    errors.push(w + '.primaryCategory is not a canonical category: ' + JSON.stringify(meta.primaryCategory));
  }

  // difficulty
  if (E.DIFFICULTIES.indexOf(meta.difficulty) === -1) errors.push(w + '.difficulty is invalid: ' + JSON.stringify(meta.difficulty));

  // minutes
  if (!isInt(meta.minutes) || meta.minutes < E.MIN_MINUTES || meta.minutes > E.MAX_MINUTES) {
    errors.push(w + '.minutes must be an integer in [' + E.MIN_MINUTES + ',' + E.MAX_MINUTES + '] (got ' + JSON.stringify(meta.minutes) + ')');
  }

  // audiences
  if (!Array.isArray(meta.audiences) || meta.audiences.length === 0) errors.push(w + '.audiences must be a non-empty array');
  else {
    var seenAud = {};
    meta.audiences.forEach(function (a) {
      if (E.AUDIENCES.indexOf(a) === -1) errors.push(w + '.audiences has invalid audience "' + a + '"');
      if (seenAud[a]) errors.push(w + '.audiences has duplicate "' + a + '"');
      seenAud[a] = true;
    });
  }

  // provenance
  if (!isPlainObject(meta.provenance)) errors.push(w + '.provenance must be an object');
  else {
    Object.keys(meta.provenance).forEach(function (k) { if (PROVENANCE_KEYS.indexOf(k) === -1) errors.push(w + '.provenance unknown field "' + k + '"'); });
    if (E.PROVENANCE_KINDS.indexOf(meta.provenance.kind) === -1) errors.push(w + '.provenance.kind is invalid: ' + JSON.stringify(meta.provenance.kind));
    if (meta.provenance.kind === 'synthetic') {
      if (meta.provenance.source !== undefined || meta.provenance.url !== undefined) errors.push(w + '.provenance is synthetic but names a source/url (no fake sources)');
    } else if (meta.provenance.kind === 'sourced') {
      if (typeof meta.provenance.source !== 'string' || !meta.provenance.source) errors.push(w + '.provenance.source required when sourced');
      if (typeof meta.provenance.url !== 'string' || !/^https?:\/\//.test(meta.provenance.url || '')) errors.push(w + '.provenance.url must be a real http(s) url when sourced');
    }
  }

  // tags
  if (!Array.isArray(meta.tags)) errors.push(w + '.tags must be an array');
  else {
    var seenTag = {};
    meta.tags.forEach(function (t) {
      if (typeof t !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t)) errors.push(w + '.tags has invalid tag "' + t + '" (strict lowercase kebab-case: no leading/trailing or double hyphens, no underscores)');
      if (seenTag[t]) errors.push(w + '.tags has duplicate "' + t + '"');
      seenTag[t] = true;
    });
  }

  // capabilities — must be supported AND consistent with derived facts.
  if (!Array.isArray(meta.capabilities) || meta.capabilities.length === 0) errors.push(w + '.capabilities must be a non-empty array');
  else {
    var facts = rec ? derive.deriveFacts(rec) : null;
    var seenCap = {};
    meta.capabilities.forEach(function (cap) {
      if (E.CAPABILITY_IDS.indexOf(cap) === -1) errors.push(w + '.capabilities claims unsupported capability "' + cap + '"');
      if (seenCap[cap]) errors.push(w + '.capabilities has duplicate "' + cap + '"');
      seenCap[cap] = true;
    });
    if (facts) {
      // Every claimed capability must be consistent with the real model facts.
      var vt = facts.variableTypes;
      if (meta.capabilities.indexOf('continuous-variables') !== -1 && vt.indexOf('continuous') === -1) errors.push(w + '.capabilities claims continuous-variables but none are present');
      if (meta.capabilities.indexOf('integer-variables') !== -1 && vt.indexOf('integer') === -1) errors.push(w + '.capabilities claims integer-variables but none are present');
      if (meta.capabilities.indexOf('binary-variables') !== -1 && vt.indexOf('binary') === -1) errors.push(w + '.capabilities claims binary-variables but none are present');
      if (meta.capabilities.indexOf('mixed-variables') !== -1 && facts.modelType !== 'mixed') errors.push(w + '.capabilities claims mixed-variables but the model type is ' + facts.modelType);
      if (meta.capabilities.indexOf('chart-eligible') !== -1 && !facts.chartEligible) errors.push(w + '.capabilities claims chart-eligible but the model is not (needs two continuous variables)');
      if (meta.capabilities.indexOf('bounds') !== -1 && !facts.hasBounds) errors.push(w + '.capabilities claims bounds but the model has none');
      if (meta.capabilities.indexOf('maximise') !== -1 && facts.objectiveDirection !== 'max') errors.push(w + '.capabilities claims maximise but the model minimises');
      if (meta.capabilities.indexOf('minimise') !== -1 && facts.objectiveDirection !== 'min') errors.push(w + '.capabilities claims minimise but the model maximises');
      // Function-backed capabilities must appear in the model.
      if (meta.capabilities.indexOf('sumproduct') !== -1 && facts.functionsUsed.indexOf('SUMPRODUCT') === -1) errors.push(w + '.capabilities claims sumproduct but the model uses none');
      if (meta.capabilities.indexOf('sum') !== -1 && facts.functionsUsed.indexOf('SUM') === -1) errors.push(w + '.capabilities claims sum but the model uses none');
      // Number-format capabilities must match the derived format exactly. 'unknown'
      // (integer-only) proves neither, so neither may be claimed.
      if (meta.capabilities.indexOf('eu-number-format') !== -1 && facts.numberFormat !== 'eu') errors.push(w + '.capabilities claims eu-number-format but the model format is ' + facts.numberFormat);
      if (meta.capabilities.indexOf('us-number-format') !== -1 && facts.numberFormat !== 'us') errors.push(w + '.capabilities claims us-number-format but the model format is ' + facts.numberFormat);
    }
  }

  // related — stable keys, no self, no dup, must exist (checked at catalogue level).
  if (!Array.isArray(meta.related)) errors.push(w + '.related must be an array');
  else {
    var seenRel = {};
    meta.related.forEach(function (r) {
      if (typeof r !== 'string') errors.push(w + '.related has a non-string id');
      if (r === key) errors.push(w + '.related contains a self-reference');
      if (seenRel[r]) errors.push(w + '.related has duplicate "' + r + '"');
      seenRel[r] = true;
    });
  }

  // result policy — conditional schema + policy/status cross-check.
  //   'exact'              REQUIRES a complete decision vector; solution-bearing only.
  //   'objective-feasible' NO decision vector; solution-bearing only.
  //   'status-only'        NO objective/vector; no-solution statuses only.
  if (!isPlainObject(meta.result)) errors.push(w + '.result must be an object');
  else {
    Object.keys(meta.result).forEach(function (k) { if (RESULT_KEYS.indexOf(k) === -1) errors.push(w + '.result unknown field "' + k + '"'); });
    if (E.RESULT_POLICIES.indexOf(meta.result.policy) === -1) errors.push(w + '.result.policy is invalid: ' + JSON.stringify(meta.result.policy));

    // Cross-check the expected STATUS (from the F1 record) against the policy.
    if (rec && rec.expected) {
      var status = rec.expected.status;
      if (E.PUBLISHABLE_EXPECTED_STATUSES.indexOf(status) === -1) {
        // unknown/incomplete have no audited deterministic contract -> not publishable.
        errors.push(w + ': expected status "' + status + '" is not publishable (no deterministic policy; only ' + E.PUBLISHABLE_EXPECTED_STATUSES.join('/') + ' are allowed)');
      } else {
        var solutionBearing = E.SOLUTION_BEARING_STATUSES.indexOf(status) !== -1;
        var noSolution = E.NO_SOLUTION_STATUSES.indexOf(status) !== -1;
        if (solutionBearing && meta.result.policy === 'status-only') errors.push(w + ': a solution-bearing status ("' + status + '") cannot use policy "status-only"');
        if (noSolution && (meta.result.policy === 'exact' || meta.result.policy === 'objective-feasible')) errors.push(w + ': a no-solution status ("' + status + '") must use policy "status-only", not "' + meta.result.policy + '"');

        // TOLERANCE POLICY (F5 owns the quality band; F1 owns the structure). For a
        // solution-bearing status the EFFECTIVE tolerance — the authored value, or
        // E.DEFAULT_TOLERANCE when absent — must lie within [MIN_TOLERANCE, MAX_TOLERANCE].
        // This runs on the generic authoring flow (defineExample/loadCanonical), so a
        // FUTURE record with tolerance out of band is rejected, not just baseline drift.
        if (solutionBearing) {
          var authored = rec.expected.tolerance;
          var effectiveTolerance = (authored === undefined || authored === null) ? E.DEFAULT_TOLERANCE : authored;
          if (typeof effectiveTolerance !== 'number' || !isFinite(effectiveTolerance)) {
            errors.push(w + ': effective tolerance must be a finite number');
          } else if (effectiveTolerance < E.MIN_TOLERANCE) {
            errors.push(w + ': tolerance ' + effectiveTolerance + ' is below MIN_TOLERANCE (' + E.MIN_TOLERANCE + ')');
          } else if (effectiveTolerance > E.MAX_TOLERANCE) {
            errors.push(w + ': tolerance ' + effectiveTolerance + ' exceeds MAX_TOLERANCE (' + E.MAX_TOLERANCE + ')');
          }
        }
      }
    }

    if (meta.result.policy === 'exact') {
      var dec = meta.result.decisions;
      if (!isPlainObject(dec) || Object.keys(dec).length === 0) {
        errors.push(w + '.result.decisions is required and non-empty when policy is "exact"');
      } else {
        var seenCell = {};
        Object.keys(dec).forEach(function (cell) {
          if (!/^[A-Z]+[0-9]+$/.test(cell)) errors.push(w + '.result.decisions has invalid cell reference "' + cell + '"');
          if (seenCell[cell]) errors.push(w + '.result.decisions has duplicate cell "' + cell + '"');
          seenCell[cell] = true;
          if (typeof dec[cell] !== 'number' || !isFinite(dec[cell])) errors.push(w + '.result.decisions.' + cell + ' must be a finite number');
        });
        // COMPLETE vector: provided cells must equal the real decision-variable set
        // exactly (no missing, no extra, no unknown), independent of order.
        if (rec) {
          var expected;
          try { expected = derive.deriveDecisionCells(rec); } catch (e) { expected = null; }
          if (expected) {
            var provided = Object.keys(dec);
            var expSet = {}; expected.forEach(function (c) { expSet[c] = true; });
            var provSet = {}; provided.forEach(function (c) { provSet[c] = true; });
            expected.forEach(function (c) { if (!provSet[c]) errors.push(w + '.result.decisions is missing decision cell "' + c + '"'); });
            provided.forEach(function (c) { if (!expSet[c]) errors.push(w + '.result.decisions references non-decision cell "' + c + '"'); });
          }
        }
      }
    } else if (meta.result.policy === 'objective-feasible') {
      if (meta.result.decisions !== undefined) errors.push(w + '.result.decisions must be omitted when policy is "objective-feasible"');
    } else if (meta.result.policy === 'status-only') {
      if (meta.result.decisions !== undefined) errors.push(w + '.result.decisions must be omitted when policy is "status-only"');
    }
  }

  // content — required localized editorial fields, all five locales, plain text.
  if (!isPlainObject(meta.content)) errors.push(w + '.content must be an object');
  else {
    Object.keys(meta.content).forEach(function (f) { if (CONTENT_KEYS.indexOf(f) === -1) errors.push(w + '.content unknown field "' + f + '"'); });
    CONTENT_KEYS.forEach(function (field) {
      var loc = meta.content[field];
      if (!isPlainObject(loc)) { errors.push(w + '.content.' + field + ' is missing'); return; }
      // exactly the five locales, no extras
      Object.keys(loc).forEach(function (lang) { if (E.LOCALES.indexOf(lang) === -1) errors.push(w + '.content.' + field + ' has unsupported locale "' + lang + '"'); });
      E.LOCALES.forEach(function (lang) {
        var v = loc[lang];
        if (typeof v !== 'string' || v.trim() === '') { errors.push(w + '.content.' + field + '.' + lang + ' is missing'); return; }
        if (v !== v.trim()) errors.push(w + '.content.' + field + '.' + lang + ' has untrimmed whitespace');
        if (looksUnsafe(v)) errors.push(w + '.content.' + field + '.' + lang + ' contains HTML/script/unsafe content');
        if (looksPlaceholder(v)) errors.push(w + '.content.' + field + '.' + lang + ' looks like a placeholder/TODO');
      });
    });
  }

  // seo (optional) — localized overrides, plain text.
  if (meta.seo !== null && meta.seo !== undefined) {
    if (!isPlainObject(meta.seo)) errors.push(w + '.seo must be an object or null');
    else {
      Object.keys(meta.seo).forEach(function (f) { if (SEO_KEYS.indexOf(f) === -1) errors.push(w + '.seo unknown field "' + f + '"'); });
      Object.keys(meta.seo).forEach(function (f) {
        var loc = meta.seo[f];
        if (!isPlainObject(loc)) { errors.push(w + '.seo.' + f + ' must be a localized object'); return; }
        Object.keys(loc).forEach(function (lang) {
          if (E.LOCALES.indexOf(lang) === -1) errors.push(w + '.seo.' + f + ' has unsupported locale "' + lang + '"');
          var v = loc[lang];
          if (typeof v !== 'string' || v.trim() === '') errors.push(w + '.seo.' + f + '.' + lang + ' is empty');
          else if (looksUnsafe(v)) errors.push(w + '.seo.' + f + '.' + lang + ' contains HTML/script/unsafe content');
        });
      });
    }
  }
}

/* Validate the full assembled catalogue: metadata records + catalogue-wide rules.
   opts.expectCount (default undefined) pins the checkpoint count SEPARATELY from
   the generic architecture; pass 9 only in the F5 checkpoint assertion. */
// Reusable cross-layer consistency check: the F1 legacy fields rec.type and
// rec.expected.modelType must equal the DERIVED model type, so they can never become
// a contradictory second source of truth. Used by BOTH defineExample and the
// canonical loader (validateMetadataCatalogue), never duplicated.
function validateCrossLayer(rec, errors) {
  var derived;
  try { derived = derive.deriveFacts(rec).modelType; } catch (e) { errors.push(rec.key + ': derive failed: ' + e.message); return; }
  if (rec.type !== derived) errors.push(rec.key + ': cross-layer rec.type "' + rec.type + '" != derived modelType "' + derived + '"');
  if (rec.expected && rec.expected.modelType !== derived) errors.push(rec.key + ': cross-layer rec.expected.modelType "' + (rec.expected && rec.expected.modelType) + '" != derived modelType "' + derived + '"');
}

function validateMetadataCatalogue(catalogue, metadataMap, opts) {
  opts = opts || {};
  var errors = [];
  var keys = catalogue.map(function (r) { return r.key; });
  var keySet = {}; keys.forEach(function (k) { keySet[k] = true; });

  catalogue.forEach(function (rec) {
    var meta = metadataMap[rec.key];
    if (!meta) { errors.push(rec.key + ': F5 metadata missing'); return; }
    validateMetaRecord(rec.key, meta, rec, errors);
    // Cross-layer legacy modelType consistency on the CANONICAL load path.
    validateCrossLayer(rec, errors);
    // related references must exist in the catalogue.
    if (Array.isArray(meta.related)) {
      meta.related.forEach(function (r) {
        if (!keySet[r]) errors.push(rec.key + '.related references unknown example "' + r + '"');
      });
    }
  });

  // No metadata for a non-existent key.
  Object.keys(metadataMap).forEach(function (k) {
    if (!keySet[k]) errors.push('metadata has an entry for unknown example "' + k + '"');
  });

  // Checkpoint count (kept separate from architecture).
  if (opts.expectCount !== undefined && catalogue.length !== opts.expectCount) {
    errors.push('checkpoint expects exactly ' + opts.expectCount + ' examples but found ' + catalogue.length);
  }

  return { ok: errors.length === 0, errors: errors };
}

/* Validate the category registry itself, including the FROZEN ID/slug/order
   contract (E.CATEGORY_CONTRACT), independent of labels/shorts. */
function validateCategories(categories) {
  var errors = [];
  if (categories.length !== 10) errors.push('category registry must have exactly 10 categories (got ' + categories.length + ')');
  var CATEGORY_FIELD_KEYS = ['id', 'slug', 'order', 'label', 'short'];
  var contract = E.CATEGORY_CONTRACT;
  var ids = {}, slugs = {}, orders = {};
  categories.forEach(function (c, i) {
    var w = 'category[' + i + ']' + (c && c.id ? ' (' + c.id + ')' : '');
    if (!isPlainObject(c)) { errors.push(w + ': not an object'); return; }
    Object.keys(c).forEach(function (k) { if (CATEGORY_FIELD_KEYS.indexOf(k) === -1) errors.push(w + ' unknown field "' + k + '"'); });
    if (typeof c.id !== 'string' || !/^[a-z0-9-]+$/.test(c.id)) errors.push(w + '.id must be lowercase kebab-case');
    if (ids[c.id]) errors.push(w + '.id is duplicated'); ids[c.id] = true;
    if (typeof c.slug !== 'string' || !/^[a-z0-9-]+$/.test(c.slug)) errors.push(w + '.slug invalid');
    if (slugs[c.slug]) errors.push(w + '.slug is duplicated'); slugs[c.slug] = true;
    if (!isInt(c.order)) errors.push(w + '.order must be an integer');
    if (orders[c.order]) errors.push(w + '.order is duplicated'); orders[c.order] = true;
    // FROZEN contract: this position must match the canonical id/slug/order exactly.
    var expect = contract[i];
    if (expect) {
      if (c.id !== expect.id) errors.push(w + '.id must be "' + expect.id + '" (frozen contract) but is "' + c.id + '"');
      if (c.slug !== expect.slug) errors.push(w + '.slug must be "' + expect.slug + '" (frozen contract) but is "' + c.slug + '"');
      if (c.order !== expect.order) errors.push(w + '.order must be ' + expect.order + ' (frozen contract) but is ' + c.order);
    }
    // label AND short: exactly the five locales, non-empty, trimmed, plain text.
    ['label', 'short'].forEach(function (field) {
      var loc = c[field];
      if (!isPlainObject(loc)) { errors.push(w + '.' + field + ' is missing'); return; }
      Object.keys(loc).forEach(function (l) { if (E.LOCALES.indexOf(l) === -1) errors.push(w + '.' + field + ' has unsupported locale "' + l + '"'); });
      E.LOCALES.forEach(function (l) {
        var v = loc[l];
        if (typeof v !== 'string' || v.trim() === '') { errors.push(w + '.' + field + '.' + l + ' is missing'); return; }
        if (v !== v.trim()) errors.push(w + '.' + field + '.' + l + ' has untrimmed whitespace');
        if (looksUnsafe(v)) errors.push(w + '.' + field + '.' + l + ' contains HTML/script/unsafe content');
        if (looksPlaceholder(v)) errors.push(w + '.' + field + '.' + l + ' looks like a placeholder/TODO');
      });
    });
  });
  // Contract set as a whole: ids/orders must match (no missing/extra/reorder).
  var contractIds = contract.map(function (x) { return x.id; }).sort().join(',');
  var actualIds = categories.map(function (c) { return c.id; }).sort().join(',');
  if (contractIds !== actualIds) errors.push('category ids do not match the frozen contract set');
  var contractOrders = contract.map(function (x) { return x.order; }).sort(function (a, b) { return a - b; }).join(',');
  var actualOrders = categories.map(function (c) { return c.order; }).sort(function (a, b) { return a - b; }).join(',');
  if (contractOrders !== actualOrders) errors.push('category orders do not match the frozen 1..10 sequence');
  return { ok: errors.length === 0, errors: errors };
}

module.exports = {
  validateMetaRecord: validateMetaRecord,
  validateMetadataCatalogue: validateMetadataCatalogue,
  validateCrossLayer: validateCrossLayer,
  validateCategories: validateCategories,
};
