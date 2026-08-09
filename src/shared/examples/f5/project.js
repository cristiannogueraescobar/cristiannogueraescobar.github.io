'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — PROJECTORS.
   ----------------------------------------------------------------------------
   Pure, deterministic projections FROM the canonical assembled example. F5 ships:
     - legacyMeta()       : the public examples-data META shape (key/slug/category/
                            type/sense) so the current public output is derived, not
                            re-stored. Uses the F1 legacy UI category.
     - searchDocument()   : a flat search doc for one locale (F6 will build UI on
                            top; F5 only proves the projection is possible).
     - facetFacts()       : the filterable facts F6 will use (category, model type,
                            direction, difficulty, chart, number format, capabilities,
                            student-friendly).
     - clonePayload()     : a deep clone of the model for a consumer to mutate,
                            NEVER handing out the canonical object.
   No UI, no HTML, no dependency. Deterministic key order.
   ========================================================================== */

var E = require('./enums.js');

// Legacy public META row (matches assets/examples-data.js META entries).
function legacyMeta(canon) {
  return {
    key: canon.key,
    slug: canon.slug,
    category: canon.legacyCategory,   // 'start' | 'business' | 'binary' (F1 UI grouping)
    type: canon.facts.modelType,      // derived, equals F1 type
    sense: canon.sense,
  };
}

// One search document for a locale. Only supported locales are accepted; there is
// NO silent English fallback (the validator already guarantees all five locales,
// so a supported locale is always present). An unsupported locale throws.
function searchDocument(canon, locale) {
  if (E.LOCALES.indexOf(locale) === -1) {
    throw new Error('searchDocument: unsupported locale "' + locale + '" (supported: ' + E.LOCALES.join(', ') + ')');
  }
  var t = canon.translations[locale];
  var content = canon.content;
  return {
    id: canon.key,
    slug: canon.slug,
    locale: locale,
    title: t.title,
    description: t.desc,
    question: content.question[locale],
    category: canon.primaryCategory,
    tags: canon.tags.slice(),
    capabilities: canon.capabilities.slice(),
  };
}

// Facts a filter UI (F6) can facet on — all derived/authored, none duplicated.
function facetFacts(canon) {
  return {
    id: canon.key,
    category: canon.primaryCategory,
    modelType: canon.facts.modelType,
    direction: canon.sense,
    difficulty: canon.difficulty,
    chartEligible: canon.facts.chartEligible,
    numberFormat: canon.facts.numberFormat,
    capabilities: canon.capabilities.slice(),
    studentFriendly: canon.audiences.indexOf('student') !== -1,
    minutes: canon.minutes,
  };
}

// Deep clone of the model so a consumer (e.g. the Solver) can mutate a copy while
// the canonical source stays frozen/untouched.
function clonePayload(canon) {
  return JSON.parse(JSON.stringify(canon.model));
}

module.exports = {
  legacyMeta: legacyMeta,
  searchDocument: searchDocument,
  facetFacts: facetFacts,
  clonePayload: clonePayload,
};
