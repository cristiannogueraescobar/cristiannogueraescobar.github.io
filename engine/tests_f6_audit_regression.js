'use strict';
/* ============================================================================
   F6 AUDIT REGRESSION SUITE (audit item 16, checks A-L).

   One named assertion per audited bug, so a re-audit can see each fix guarded
   explicitly. These complement (not replace) the deeper suites:
     - tests_f6_examples_library.js (positive + a11y mutation, no ||true)
     - tests_f6_examples_library_negative.js (logic/tree mutations, shell scan)
     - tests_canonical_10_end_to_end.js (real F5->F6 #10 integration)

   Node built-ins only; Windows-safe; no shell/literal-node subprocess.
   ========================================================================== */
var fs = require('fs');
var path = require('path');

var SITE = path.join(__dirname, '..');
var pass = 0, fail = 0; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

var core = require(path.join(SITE, 'assets', 'examples-library-core.js'));
var library = require(path.join(SITE, 'src', 'shared', 'examples', 'f6', 'library.js'));
var gen = require(path.join(SITE, 'engine', 'generate-examples-library.js'));
var loadCanonical = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js')).loadCanonical;

var canonical = loadCanonical(SITE, { expectCount: 9 }).canonical;
var payload = library.libraryPayload(canonical, { modelTypeLabels: gen.modelTypeLabels(SITE) });
var records = payload.examples;
function fresh() { records.forEach(function (r) { r.__hay = null; }); return records; }
function search(q, loc) {
  fresh();
  return core.filterExamples(records, { q: core.normalizeQuery(q), category: [], type: [], difficulty: [], goal: [] }, loc || 'en').map(function (r) { return r.id; });
}

// Simulate writeState()+reload with native URLSearchParams (the shipped ui.js path).
function roundTrip(state, existing) {
  var params = new URLSearchParams(existing || '');
  ['q', 'category', 'type', 'difficulty', 'goal'].forEach(function (k) { params.delete(k); });
  core.stateEntries(state).forEach(function (p) { params.set(p[0], p[1]); });
  var qs = params.toString();
  var back = new URLSearchParams(qs);
  return { qs: qs, parsed: core.parseState(back, payload.categories.map(function (c) { return c.id; })), raw: back };
}

// ---- A. multi-word URL round-trip ----
['a b', 'cheapest feed', 'production plan'].forEach(function (q) {
  var r = roundTrip({ q: q, category: [], type: [], difficulty: [], goal: [] }, 'lang=es&foo=bar');
  ok('A: multi-word round-trip preserves "' + q + '"', r.parsed.q === q);
  ok('A: multi-word round-trip preserves lang for "' + q + '"', r.raw.get('lang') === 'es');
  ok('A: multi-word round-trip preserves unrelated param for "' + q + '"', r.raw.get('foo') === 'bar');
});

// ---- B. plus/space URL correctness ----
(function () {
  var space = roundTrip({ q: 'a b', category: [], type: [], difficulty: [], goal: [] });
  ok('B: a space encodes as "+" in the query', space.qs.indexOf('q=a+b') !== -1, space.qs);
  ok('B: the space survives reload as a space (not "+")', space.parsed.q === 'a b', space.parsed.q);
  var plus = roundTrip({ q: 'a + b', category: [], type: [], difficulty: [], goal: [] });
  ok('B: a literal "+" encodes as %2B', plus.qs.indexOf('%2B') !== -1, plus.qs);
  ok('B: a literal "+" survives reload', plus.parsed.q === 'a + b', plus.parsed.q);
  ['café résumé', 'a & b', '100% done'].forEach(function (q) {
    var r = roundTrip({ q: q, category: [], type: [], difficulty: [], goal: [] });
    ok('B: special chars survive reload for "' + q + '"', r.parsed.q === q, r.parsed.q);
  });
  // Hash preservation: writeState() builds pathname + '?' + qs + location.hash, so the
  // fragment is untouched. Replicate that assembly and confirm the hash survives.
  (function () {
    var params = new URLSearchParams('lang=de');
    ['q', 'category', 'type', 'difficulty', 'goal'].forEach(function (k) { params.delete(k); });
    core.stateEntries({ q: 'a b', category: [], type: [], difficulty: [], goal: [] }).forEach(function (p) { params.set(p[0], p[1]); });
    var hash = '#how';
    var url = '/examples.html' + '?' + params.toString() + hash;
    ok('B: URL assembly preserves the hash fragment', url.slice(-4) === '#how' && url.indexOf('lang=de') !== -1, url);
    var afterQ = new URLSearchParams(url.slice(url.indexOf('?') + 1, url.indexOf('#')));
    ok('B: query still round-trips with a hash present', core.parseState(afterQ, []).q === 'a b');
  })();
})();

// ---- C. F5 tag search (tags not present in title/question) ----
(function () {
  var cases = { weekly: 'workforce', sourcing: 'supplier', network: 'shipping', loading: 'delivery' };
  Object.keys(cases).forEach(function (tag) {
    var ids = search(tag);
    ok('C: F5 tag "' + tag + '" finds ' + cases[tag], ids.indexOf(cases[tag]) !== -1, ids.join(','));
  });
  // Prove the tag really comes from F5 (present on the record), not from title text.
  var wf = records.find(function (r) { return r.id === 'workforce'; });
  ok('C: record carries F5 tags array', Array.isArray(wf.tags) && wf.tags.indexOf('weekly') !== -1);
  ok('C: "weekly" is NOT in the workforce title/question (so the hit is via tags)',
     (wf.locales.en.title + ' ' + wf.locales.en.question).toLowerCase().indexOf('weekly') === -1);
})();

// ---- D. localized category-label search 5/5 (ALL members of the category) ----
(function () {
  // production-operations = { production, workshop } in every language.
  var labelByLocale = { en: 'operations', es: 'operaciones', pt: 'operações', de: 'Betrieb', fr: 'opérations' };
  Object.keys(labelByLocale).forEach(function (loc) {
    var ids = search(labelByLocale[loc], loc).sort();
    ok('D: category label "' + labelByLocale[loc] + '" (' + loc + ') returns ALL of production-operations',
       ids.length === 2 && ids.indexOf('production') !== -1 && ids.indexOf('workshop') !== -1, ids.join(','));
  });
})();

// ---- E. model-type free-text (localized) — placeholder promise honoured ----
(function () {
  // Placeholder promises model-type search; the localized labels must be searchable.
  var mt = { de: 'kontinuierlich', fr: 'continu', es: 'continuo', pt: 'contínuo', en: 'continuous' };
  Object.keys(mt).forEach(function (loc) {
    var ids = search(mt[loc], loc);
    // all four continuous models
    ['production', 'workshop', 'blend', 'marketing'].forEach(function (id) {
      ok('E: model-type "' + mt[loc] + '" (' + loc + ') finds ' + id, ids.indexOf(id) !== -1, ids.join(','));
    });
  });
  // The placeholder text still exists (promise kept, option A chosen).
  var html = read(path.join(SITE, 'examples.html'));
  ok('E: search placeholder is present (data-i18n-ph)', /data-i18n-ph="libSearchPlaceholder"/.test(html));
})();

// ---- F. canonical #10 -> generated base HTML (delegated to the e2e suite) ----
(function () {
  var e2e = require(path.join(SITE, 'engine', 'tests_canonical_10_end_to_end.js'));
  ok('F: canonical #10 end-to-end integration suite passed', e2e.fail === 0 && e2e.pass > 0, 'pass=' + e2e.pass + ' fail=' + e2e.fail);
})();

// ---- G. #10 populated category auto-appears (also covered e2e; assert the mechanism) ----
(function () {
  // With the real 9, energy-sustainability is empty and MUST NOT appear as a filter option.
  var html = read(path.join(SITE, 'examples.html'));
  ok('G: an empty category does NOT appear as a filter option in the real 9',
     html.indexOf('data-value="energy-sustainability"') === -1);
  // The generator derives options from populated categories only, so gaining a member makes
  // it appear (proven fully in the e2e suite). Here, assert the derivation is data-driven:
  var counts = {};
  payload.examples.forEach(function (r) { counts[r.category] = (counts[r.category] || 0) + 1; });
  var populated = payload.categories.filter(function (c) { return counts[c.id]; }).map(function (c) { return c.id; });
  var optionValues = (html.match(/data-facet="category" data-value="([^"]+)"/g) || []).map(function (m) { return m.match(/data-value="([^"]+)"/)[1]; });
  ok('G: filter options == populated categories exactly', JSON.stringify(optionValues.slice().sort()) === JSON.stringify(populated.slice().sort()), optionValues.join(','));
})();

// ---- H. no manual card dataset — cards are generator output between markers ----
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  ok('H: examples.html has the LIBRARY-GENERATED card markers', /LIBRARY-GENERATED:CARDS START/.test(html) && /LIBRARY-GENERATED:CARDS END/.test(html));
  ok('H: examples.html has the category-filter markers', /LIBRARY-GENERATED:CATEGORY-FILTERS START/.test(html));
  ok('H: examples.html has the JSON-LD markers', /LIBRARY-GENERATED:JSONLD START/.test(html));
  ok('H: examples.html has the total/count inline markers', /LIBRARY-GENERATED:TOTAL/.test(html) && /LIBRARY-GENERATED:COUNT/.test(html));
  // The generated regions are reproducible: --check must be clean (page in sync w/ canonical).
  var chk = gen.run(SITE, { check: true });
  ok('H: generator --check is clean (page cards/counts/JSON-LD derive from canonical)', chk.ok === true, (chk.changed || []).join(','));
})();

// ---- I. nested-anchor mutation (delegated: exercised in the positive suite) ----
(function () {
  // Re-assert the detector here independently so this suite fails if it regresses.
  function extractCards(html) { var out = [], re = /<article class="lib-card"[\s\S]*?<\/article>/g, m; while ((m = re.exec(html)) !== null) out.push(m[0]); return out; }
  function hasNested(card) { var re = /<a\b|<\/a>/gi, d = 0, m; while ((m = re.exec(card)) !== null) { if (m[0].toLowerCase() === '</a>') { if (d > 0) d--; } else { d++; if (d > 1) return true; } } return false; }
  var html = read(path.join(SITE, 'examples.html'));
  var cards = extractCards(html);
  ok('I: real cards have no nested anchors', cards.every(function (c) { return !hasNested(c); }));
  var mutated = cards[0].replace(/(<a class="lib-title-link"[^>]*>)([\s\S]*?)(<\/a>)/, '$1<a href="x">$2</a>$3');
  ok('I: deliberately nested anchor is detected', hasNested(mutated) === true);
})();

// ---- J. no always-true escape ("|| true") in the F6 test suites ----
(function () {
  var suites = ['tests_f6_examples_library.js', 'tests_f6_examples_library_behavioural.js',
    'tests_f6_examples_library_negative.js', 'tests_f6_protected_baseline.js',
    'tests_canonical_10_end_to_end.js', 'tests_f6_audit_regression.js'];
  var needle = '|| ' + 'true'; // built at runtime so this detector line is not a self-match
  suites.forEach(function (s) {
    var src = read(path.join(SITE, 'engine', s));
    var code = src.split('\n').map(function (ln) { var i = ln.indexOf('//'); return i === -1 ? ln : ln.slice(0, i); }).join('\n');
    ok('J: no always-true escape in ' + s, code.indexOf(needle) === -1);
  });
})();

// ---- K. no shell / literal-node subprocess in F6-changed tests/tooling ----
(function () {
  var files = ['assets/examples-library-core.js', 'assets/examples-library.ui.js',
    'src/shared/examples/f6/library.js', 'engine/generate-examples-library.js',
    'engine/tests_assets.js', 'engine/tests_f6_examples_library.js',
    'engine/tests_f6_examples_library_negative.js', 'engine/tests_f6_protected_baseline.js',
    'engine/tests_canonical_10_end_to_end.js', 'engine/tests_f6_audit_regression.js'];
  function offends(src) {
    return src.split('\n').some(function (ln) {
      var s = ln.trim();
      if (s.indexOf('//') === 0 || s.indexOf('*') === 0 || s.indexOf('/*') === 0) return false;
      if (/\.test\(|\.match\(|\.replace\(|filter\(function|indexOf\(|split\(/.test(ln)) return false;
      if (/\bexecSync\s*\(\s*['"`]\s*node\b/.test(ln)) return true;
      if (/\b(exec|execSync|spawnSync|spawn)\s*\(\s*['"`]\s*(cp|rm|mv|sed|grep|bash|sh|cmd|powershell)\b/.test(ln)) return true;
      return false;
    });
  }
  var bad = files.filter(function (f) { return fs.existsSync(path.join(SITE, f)) && offends(read(path.join(SITE, f))); });
  ok('K: no shell-string / literal-node subprocess in any F6-changed file', bad.length === 0, bad.join(','));
  var ta = read(path.join(SITE, 'engine', 'tests_assets.js'));
  ok('K: tests_assets.js uses execFileSync(process.execPath, ...)', /execFileSync\(\s*process\.execPath/.test(ta));
})();

// ---- L. documentation / baseline hashes match actual bytes ----
(function () {
  var crypto = require('crypto');
  function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
  // Every entry in each protected baseline that pins a path must match the real bytes.
  [['engine/f4b-protected-baseline.json', function (m) { return m.files; }],
   ['engine/f6-protected-baseline.json', function (m) { return m.files; }],
   ['src/shared/examples/f5/protected-baseline.json', function (m) { return null; }]].forEach(function (pair) {
    var mp = path.join(SITE, pair[0]);
    if (!fs.existsSync(mp)) return;
    var m = JSON.parse(read(mp));
    var entries = [];
    (function collect(o) {
      if (Array.isArray(o)) { o.forEach(collect); return; }
      if (o && typeof o === 'object') { if (o.path && o.sha256) entries.push(o); Object.values(o).forEach(collect); }
    })(m);
    entries.forEach(function (e) {
      var fp = path.join(SITE, e.path);
      if (!fs.existsSync(fp)) { ok('L: baseline path exists: ' + pair[0] + ' -> ' + e.path, false); return; }
      ok('L: ' + pair[0] + ' hash matches bytes for ' + e.path, sha(fp) === e.sha256, sha(fp).slice(0, 10) + ' vs ' + String(e.sha256).slice(0, 10));
      ok('L: ' + pair[0] + ' byte size matches for ' + e.path, fs.statSync(fp).size === e.bytes, fs.statSync(fp).size + ' vs ' + e.bytes);
    });
  });
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F6 AUDIT REGRESSION (A-L)  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
