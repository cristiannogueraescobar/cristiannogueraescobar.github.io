'use strict';
/* ============================================================================
   Plumline examples library (F6) — PUBLIC LIBRARY PROJECTION.
   ----------------------------------------------------------------------------
   A build-time projection from the F5 canonical examples to the MINIMAL,
   metadata-only payload the browser library needs. It re-uses the existing F5
   projectors (project.searchDocument + project.facetFacts) and the category
   registry; it does NOT re-store any fact and does NOT reinterpret F5 semantics.

   What the browser gets per example (NO grids, NO expected vectors, NO baselines):
     id, slug, category (primary), modelType, direction (max/min), difficulty,
     minutes, decisions (count), limits (constraint count), chartEligible,
     capabilities (selected), solverUrl, and a per-locale { title, description,
     question } search/display block for all five locales.

   The projection is pure and deterministic (stable key order, canonical example
   order). No UI, no HTML, no dependency. Node built-ins only where used by callers.
   ========================================================================== */

var E = require('../f5/enums.js');
var project = require('../f5/project.js');
var CATS = require('../f5/categories.js').CATEGORIES;

// category id -> localized label map, straight from the F5 category registry (single
// source of truth; nothing duplicated here).
var CAT_BY_ID = {};
CATS.forEach(function (c) { CAT_BY_ID[c.id] = c; });

// Build the canonical Solver deep-link for an example. Single source of slug ->
// URL logic for the library (mirrors the public contract solver.html?ex=<slug>).
function solverUrl(slug) {
  return 'solver.html?ex=' + encodeURIComponent(slug);
}

// One public library record for a canonical example, across all five locales.
function libraryRecord(canon) {
  var facts = project.facetFacts(canon);
  var cat = CAT_BY_ID[facts.category];
  var locales = {};
  E.LOCALES.forEach(function (loc) {
    var d = project.searchDocument(canon, loc);
    locales[loc] = {
      title: d.title,
      description: d.description,
      question: d.question,
      // The localized category label the user actually sees on the card and in the
      // filter — taken from the F5 category registry so category search works in every
      // language (es "operaciones", pt "operações", de "Betrieb", ...). Not duplicated.
      categoryLabel: cat ? cat.label[loc] : '',
    };
  });
  return {
    id: canon.key,
    slug: canon.slug,
    category: facts.category,
    modelType: facts.modelType,
    direction: facts.direction,        // 'max' | 'min'
    difficulty: facts.difficulty,
    minutes: facts.minutes,
    decisions: canon.facts.decisionCount,
    limits: canon.facts.constraintCount,
    chartEligible: facts.chartEligible,
    // F5 machine tags (locale-independent) — real searchable terms like "weekly",
    // "sourcing", "network", "loading". Sourced from F5 (project.searchDocument.tags),
    // never invented or duplicated.
    tags: project.searchDocument(canon, E.LOCALES[0]).tags.slice(),
    capabilities: facts.capabilities.slice(),
    solverUrl: solverUrl(canon.slug),
    locales: locales,
  };
}

// The full library payload: the localized category registry (id/slug/order/label/
// short per locale) plus the projected records, in canonical order.
// The full library payload: the localized category registry (id/slug/order/label/
// short per locale) plus the projected records, in canonical order.
//
// opts.modelTypeLabels (optional): { <modelType>: { <locale>: label } } sourced by the
// caller (the F6 generator) from the EXISTING i18n dictionary (mt_continuous, mt_integer,
// mt_binary, mt_mixed) — the single translation source. When provided, each record gets a
// per-locale modelTypeLabel so the localized model type (de "kontinuierlich", fr
// "continu", ...) is searchable, with NO second translation table. When absent, records
// carry no modelTypeLabel and the model type stays available as a facet only.
function libraryPayload(canonicalList, opts) {
  opts = opts || {};
  var mtLabels = opts.modelTypeLabels || null;
  var categories = CATS.map(function (c) {
    var label = {}, short = {};
    E.LOCALES.forEach(function (loc) { label[loc] = c.label[loc]; short[loc] = c.short[loc]; });
    return { id: c.id, slug: c.slug, order: c.order, label: label, short: short };
  });
  var records = canonicalList.map(function (canon) {
    var rec = libraryRecord(canon);
    if (mtLabels && mtLabels[rec.modelType]) {
      E.LOCALES.forEach(function (loc) {
        var lab = mtLabels[rec.modelType][loc];
        if (lab) rec.locales[loc].modelTypeLabel = lab;
      });
    }
    return rec;
  });
  return {
    schemaVersion: E.SCHEMA_VERSION,
    locales: E.LOCALES.slice(),
    categories: categories,
    examples: records,
  };
}

module.exports = {
  solverUrl: solverUrl,
  libraryRecord: libraryRecord,
  libraryPayload: libraryPayload,
};
