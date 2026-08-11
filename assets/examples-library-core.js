/* Plumline Examples library (F6) — PURE state/search/filter/URL logic.
 *
 * This module is deliberately free of the DOM so it can be unit-tested in Node and
 * reused by the browser binding (examples-library.ui.js). It exposes:
 *   normalizeQuery(str)        -> lowercased, trimmed, whitespace-collapsed, diacritic-
 *                                 folded search text.
 *   matchesQuery(rec, q, loc)  -> does a record match a normalized query in a locale.
 *   filterExamples(records, state, loc) -> filtered + canonical-ordered records.
 *   parseState(searchParams)   -> read discovery state from URLSearchParams (safe).
 *   serializeState(state)      -> URLSearchParams string (stable order), lang preserved
 *                                 by the caller.
 *   countByCategory / countByModelType / countByDifficulty / countByGoal for facets.
 *
 * No dependency, no network, deterministic. Works the same for 9 or 60 records.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PL_LIB_CORE = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var FACETS = ['category', 'type', 'difficulty', 'goal'];
  var GOAL_TO_DIRECTION = { maximise: 'max', minimise: 'min' };

  // Normalize search text: lowercase, trim, collapse internal whitespace, and fold
  // diacritics using Unicode NFD so "producción" and "produccion" match. This keeps
  // the five Latin-script locales (en/es/pt/de/fr) searchable without a library and
  // without destroying meaning (case and accents are not semantically distinct for a
  // free-text catalogue search). German eszett is left as-is (no false merge).
  function normalizeQuery(str) {
    if (str == null) return '';
    var s = String(str).toLowerCase().replace(/\s+/g, ' ').trim();
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s;
  }

  // The searchable haystack for one record in one locale: title + description +
  // question + localized category label + localized model-type label + F5 machine tags
  // + capabilities + the raw category id, all normalized. Built lazily and cached per
  // (id, locale) on the record's __hay map so repeat queries are cheap. Reset rec.__hay
  // to null after mutating a record's locale text in tests.
  function haystack(rec, locale) {
    if (!rec.__hay) rec.__hay = {};
    if (rec.__hay[locale]) return rec.__hay[locale];
    var loc = rec.locales[locale] || {};
    var parts = [
      loc.title || '',
      loc.description || '',
      loc.question || '',
      loc.categoryLabel || '',   // localized category label the user sees (es/pt/de/fr)
      loc.modelTypeLabel || '',  // localized model type ("kontinuierlich", "continu", ...)
      rec.category || '',        // raw category id (keeps id-based search working too)
    ];
    if (rec.tags) parts = parts.concat(rec.tags);              // real F5 tags (weekly, sourcing, ...)
    if (rec.capabilities) parts = parts.concat(rec.capabilities);
    var hay = normalizeQuery(parts.join(' '));
    rec.__hay[locale] = hay;
    return hay;
  }

  function matchesQuery(rec, normalizedQuery, locale) {
    if (!normalizedQuery) return true;
    return haystack(rec, locale).indexOf(normalizedQuery) !== -1;
  }

  // A record matches the state when it matches the query AND, for each ACTIVE facet,
  // its value is one of the selected values (OR within a facet, AND across facets).
  function matchesFacets(rec, state) {
    if (state.category && state.category.length && state.category.indexOf(rec.category) === -1) return false;
    if (state.type && state.type.length && state.type.indexOf(rec.modelType) === -1) return false;
    if (state.difficulty && state.difficulty.length && state.difficulty.indexOf(rec.difficulty) === -1) return false;
    if (state.goal && state.goal.length) {
      var dirs = state.goal.map(function (g) { return GOAL_TO_DIRECTION[g]; });
      if (dirs.indexOf(rec.direction) === -1) return false;
    }
    return true;
  }

  // Filter + preserve canonical order (records arrive in canonical order and we never
  // reorder them: canonical order is the deterministic default with no sort UI).
  function filterExamples(records, state, locale) {
    var q = normalizeQuery(state && state.q);
    return records.filter(function (rec) {
      return matchesQuery(rec, q, locale) && matchesFacets(rec, state || {});
    });
  }

  // ---- URL state (URLSearchParams). Unknown/malformed values ignored safely. ----
  var VALID_TYPES = ['continuous', 'integer', 'binary', 'mixed'];
  var VALID_DIFFICULTY = ['beginner', 'intermediate', 'advanced'];
  var VALID_GOAL = ['maximise', 'minimise'];

  function readList(params, name, valid) {
    var raw = params.get(name);
    if (!raw) return [];
    var seen = {};
    var out = [];
    raw.split(',').forEach(function (v) {
      var t = v.trim();
      if (!t) return;
      if (valid && valid.indexOf(t) === -1) return;   // ignore unknown values safely
      if (seen[t]) return;
      seen[t] = true;
      out.push(t);
    });
    return out;
  }

  // Parse discovery state from a URLSearchParams. categoryValid (a list of known
  // category ids) is passed in so unknown categories are ignored without hardcoding.
  function parseState(params, categoryValid) {
    return {
      q: (params.get('q') || '').replace(/\s+/g, ' ').trim(),
      category: readList(params, 'category', categoryValid || null),
      type: readList(params, 'type', VALID_TYPES),
      difficulty: readList(params, 'difficulty', VALID_DIFFICULTY),
      goal: readList(params, 'goal', VALID_GOAL),
    };
  }

  // Serialize state into a query string with stable key order. Empty facets/search are
  // omitted so a cleared library has a clean URL. The caller merges lang separately.
  function serializeState(state) {
    var params = new URLSearchParams();
    stateEntries(state).forEach(function (pair) { params.set(pair[0], pair[1]); });
    return params.toString();
  }

  // Return discovery state as raw [key, value] pairs in stable order, with values
  // NOT url-encoded. The caller feeds these straight into a native URLSearchParams
  // (params.set(key, value)), so spaces, '+', '%', accents and '&' survive the
  // state -> URL -> state round-trip exactly. Never rebuild a query string by hand
  // from serializeState(): URLSearchParams encodes spaces as '+', and a manual
  // decodeURIComponent does NOT turn '+' back into a space, corrupting multi-word
  // searches (the audited "a b" -> "a+b" bug).
  function stateEntries(state) {
    var out = [];
    if (state.q) out.push(['q', state.q]);
    ['category', 'type', 'difficulty', 'goal'].forEach(function (name) {
      var list = state[name];
      if (list && list.length) out.push([name, list.join(',')]);
    });
    return out;
  }

  function isEmptyState(state) {
    return !state.q && !(state.category && state.category.length) && !(state.type && state.type.length)
      && !(state.difficulty && state.difficulty.length) && !(state.goal && state.goal.length);
  }

  // ---- Facet counts over a record set (visible/canonical catalogue). ----
  function countBy(records, keyFn) {
    var out = {};
    records.forEach(function (rec) {
      var k = keyFn(rec);
      if (k == null) return;
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }
  function countByCategory(records) { return countBy(records, function (r) { return r.category; }); }
  function countByModelType(records) { return countBy(records, function (r) { return r.modelType; }); }
  function countByDifficulty(records) { return countBy(records, function (r) { return r.difficulty; }); }
  function countByGoal(records) { return countBy(records, function (r) { return r.direction === 'max' ? 'maximise' : 'minimise'; }); }

  return {
    FACETS: FACETS,
    VALID_TYPES: VALID_TYPES,
    VALID_DIFFICULTY: VALID_DIFFICULTY,
    VALID_GOAL: VALID_GOAL,
    normalizeQuery: normalizeQuery,
    matchesQuery: matchesQuery,
    filterExamples: filterExamples,
    parseState: parseState,
    serializeState: serializeState,
    stateEntries: stateEntries,
    isEmptyState: isEmptyState,
    countByCategory: countByCategory,
    countByModelType: countByModelType,
    countByDifficulty: countByDifficulty,
    countByGoal: countByGoal,
  };
});
