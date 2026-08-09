'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — CANONICAL ASSEMBLER.
   ----------------------------------------------------------------------------
   The single, unambiguous assembly point. It combines the three physical layers
   into one canonical example object per key:

     F1 catalogue record   (identity, slug, model, expected, base translations)
       + F5 authored metadata  (classification, editorial content, policy, SEO)
       + derived facts         (computed from the model; never authored)
     => canonical example

   Consumers NEVER read the three layers separately; they call assembleCatalogue()
   (or loadCanonical() from index in the checker) and get validated canonical
   objects. There is exactly one source per fact:
     - identity/model/expected/base title+desc  -> F1 catalogue
     - classification/editorial/policy/SEO       -> F5 metadata
     - modelType/counts/functions/bounds/format  -> derived facts
   Nothing is stored twice.

   The assembler is pure and deterministic: same inputs -> deep-equal output.
   ========================================================================== */

var derive = require('./derive.js');

// Deep clone of a plain-data value so the canonical object owns its own structures
// and deep-freezing it never freezes the caller's rec/meta inputs.
function clone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(clone);
  var out = {};
  Object.keys(v).forEach(function (k) { out[k] = clone(v[k]); });
  return out;
}

function assembleExample(rec, meta) {
  var facts = derive.deriveFacts(rec);
  return {
    schemaVersion: meta.schemaVersion,
    // Identity (from F1 — never re-stored elsewhere).
    key: rec.key,
    slug: rec.slug,
    // Base localized title/desc come from F1 translations; editorial content from F5.
    // All cloned so the canonical object owns its data (assembler is pure).
    translations: clone(rec.translations),
    content: clone(meta.content),
    // Classification (authored).
    primaryCategory: meta.primaryCategory,
    difficulty: meta.difficulty,
    minutes: meta.minutes,
    audiences: clone(meta.audiences),
    provenance: clone(meta.provenance),
    tags: clone(meta.tags || []),
    capabilities: clone(meta.capabilities || []),
    related: clone(meta.related || []),
    // Model (from F1) — cloned.
    model: clone(rec.model),
    sense: rec.sense,
    legacyCategory: rec.category,   // F1 'start'/'business'/'binary' UI grouping
    // Expected contract (from F1) + policy (from F5).
    expected: clone(rec.expected),
    resultPolicy: meta.result ? meta.result.policy : 'objective-feasible',
    resultDecisions: (meta.result && meta.result.decisions) ? clone(meta.result.decisions) : null,
    // SEO overrides (optional, authored). F5 emits no public SEO output.
    seo: meta.seo ? clone(meta.seo) : null,
    // Derived facts (never authored).
    facts: facts,
  };
}

function assembleCatalogue(catalogue, metadataMap) {
  return catalogue.map(function (rec) {
    var meta = metadataMap[rec.key];
    if (!meta) throw new Error('F5 metadata missing for example key "' + rec.key + '"');
    return assembleExample(rec, meta);
  });
}

module.exports = {
  assembleExample: assembleExample,
  assembleCatalogue: assembleCatalogue,
};
