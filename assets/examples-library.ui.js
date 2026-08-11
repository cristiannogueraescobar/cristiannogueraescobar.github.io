/* Plumline Examples library (F6) — browser binding.
 *
 * Progressive enhancement only. The base examples.html already lists all nine
 * examples with correct Solver links and is fully usable with no JS. This module,
 * loaded with `defer`, upgrades the page to a searchable/filterable library:
 *   - marks <html> with class "js-lib" so enhancement-only controls become visible;
 *   - reads the metadata-only payload from window.PL_LIBRARY (generated from F5);
 *   - reads/writes discovery state via URLSearchParams (search + facets), preserving
 *     ?lang= and any unrelated params, using history.replaceState;
 *   - filters with the pure PL_LIB_CORE logic and toggles card visibility;
 *   - keeps an aria-live result count and a real empty state.
 * No dependency, no network, no inline handlers. Reads current locale from
 * <html lang>. Re-renders labels on language change.
 */
(function () {
  'use strict';
  var core = window.PL_LIB_CORE;
  var LIB = window.PL_LIBRARY;
  if (!core || !LIB) return;                     // base HTML stays usable without this

  var root = document.getElementById('libRoot');
  if (!root) return;
  document.documentElement.classList.add('js-lib');

  function t(key) {
    try { return window.Plumline.i18n.t(document.documentElement.lang || 'en', 'examples', key); }
    catch (e) { return key; }
  }
  function locale() { return document.documentElement.lang || 'en'; }
  function categoryIds() { return LIB.categories.map(function (c) { return c.id; }); }

  // Category labels and per-locale example title/question come from the F5 projection
  // (not the shared i18n dict), so repaint them for the current locale.
  var catById = {};
  LIB.categories.forEach(function (c) { catById[c.id] = c; });
  var exById = {};
  LIB.examples.forEach(function (r) { exById[r.id] = r; });
  function paintLocaleText() {
    var loc = locale();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cat-label]'), function (el) {
      var c = catById[el.getAttribute('data-cat-label')];
      if (c && c.label[loc]) el.textContent = c.label[loc];
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ex-title]'), function (el) {
      var r = exById[el.getAttribute('data-ex-title')];
      if (r && r.locales[loc]) el.textContent = r.locales[loc].title;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ex-q]'), function (el) {
      var r = exById[el.getAttribute('data-ex-q')];
      if (r && r.locales[loc]) el.textContent = r.locales[loc].question;
    });
  }

  // ---- state <-> URL ----
  function currentState() {
    var params = new URLSearchParams(location.search);
    return core.parseState(params, categoryIds());
  }
  function writeState(state) {
    var params = new URLSearchParams(location.search);   // preserve lang + unrelated params
    ['q', 'category', 'type', 'difficulty', 'goal'].forEach(function (k) { params.delete(k); });
    // Set each discovery param with its RAW value straight into URLSearchParams, so the
    // browser handles encoding natively. Never rebuild from a serialized query string
    // (that round-trips "a b" through "a+b" and corrupts multi-word searches).
    core.stateEntries(state).forEach(function (pair) { params.set(pair[0], pair[1]); });
    var str = params.toString();
    var url = location.pathname + (str ? '?' + str : '') + location.hash;
    history.replaceState(null, '', url);
  }

  // ---- render ----
  var cards = Array.prototype.slice.call(root.querySelectorAll('[data-ex-id]'));
  var byId = {};
  cards.forEach(function (el) { byId[el.getAttribute('data-ex-id')] = el; });

  var liveCount = document.getElementById('libCount');
  var emptyState = document.getElementById('libEmpty');

  function pluralModels(n) {
    // Localized "<n> <model(s)> shown" style count text with singular/plural.
    var noun = n === 1 ? t('libResultsOne') : t('libResultsMany');
    return n + ' ' + noun;
  }

  function applyState(state) {
    var visible = core.filterExamples(LIB.examples, state, locale());
    var visibleIds = {};
    visible.forEach(function (r) { visibleIds[r.id] = true; });
    cards.forEach(function (el) {
      var show = !!visibleIds[el.getAttribute('data-ex-id')];
      el.hidden = !show;
    });
    if (liveCount) liveCount.textContent = pluralModels(visible.length);
    if (emptyState) emptyState.hidden = visible.length !== 0;
    root.setAttribute('data-visible-count', String(visible.length));
    return visible.length;
  }

  // ---- controls ----
  var searchInput = document.getElementById('libSearch');
  var facetInputs = Array.prototype.slice.call(root.querySelectorAll('[data-facet]'));
  var clearBtn = document.getElementById('libClear');
  // Every clear/reset control on the page: the top-level "Clear all" (#libClear) AND the
  // "Clear filters" button inside the empty state (#libEmpty). Both must run the same reset.
  var clearButtons = Array.prototype.slice.call(root.querySelectorAll('.lib-clear'));

  function readControls() {
    var state = { q: '', category: [], type: [], difficulty: [], goal: [] };
    if (searchInput) state.q = (searchInput.value || '').replace(/\s+/g, ' ').trim();
    facetInputs.forEach(function (inp) {
      if (!inp.checked) return;
      var facet = inp.getAttribute('data-facet');
      var value = inp.getAttribute('data-value');
      if (state[facet]) state[facet].push(value);
    });
    return state;
  }

  function writeControls(state) {
    if (searchInput) searchInput.value = state.q || '';
    facetInputs.forEach(function (inp) {
      var facet = inp.getAttribute('data-facet');
      var value = inp.getAttribute('data-value');
      inp.checked = !!(state[facet] && state[facet].indexOf(value) !== -1);
    });
  }

  function sync(fromControls) {
    var state = fromControls ? readControls() : currentState();
    if (fromControls) writeState(state); else writeControls(state);
    applyState(state);
    if (clearBtn) clearBtn.hidden = core.isEmptyState(state);
  }

  // Single reusable reset, shared by every .lib-clear button. Clears search + all facets,
  // updates the URL (preserving lang / unrelated params / hash via writeState), restores
  // the 9 results in canonical order, hides the empty state, and returns focus to search.
  // Only the top-level #libClear has its own hidden attribute toggled; the empty-state
  // button's visibility is governed by #libEmpty, so it is never hidden individually here.
  function clearAll() {
    var empty = { q: '', category: [], type: [], difficulty: [], goal: [] };
    writeControls(empty);
    writeState(empty);
    applyState(empty);          // re-renders 9 cards in canonical order + hides #libEmpty
    if (clearBtn) clearBtn.hidden = true;
    if (searchInput) searchInput.focus();
  }

  if (searchInput) searchInput.addEventListener('input', function () { sync(true); });
  facetInputs.forEach(function (inp) { inp.addEventListener('change', function () { sync(true); }); });
  clearButtons.forEach(function (btn) { btn.addEventListener('click', clearAll); });

  // Back/forward: re-read from URL.
  window.addEventListener('popstate', function () { sync(false); });

  // Re-render dynamic count text when the language changes (labels via data-i18n are
  // handled by the shared i18n runtime; only the JS-built count needs a repaint).
  var htmlEl = document.documentElement;
  if (window.MutationObserver) {
    new MutationObserver(function () { paintLocaleText(); applyState(readControls()); })
      .observe(htmlEl, { attributes: true, attributeFilter: ['lang'] });
  }

  // Initial paint from the URL (so a shared filtered link restores state).
  paintLocaleText();
  sync(false);
})();
