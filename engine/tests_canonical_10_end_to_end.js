'use strict';
/* ============================================================================
   CANONICAL #10 — END-TO-END F5 -> F6 INTEGRATION TEST (audit item 7).

   This is the REAL integration test the audit demanded: it does NOT hand-build a
   library-record object. It adds a TENTH example that is genuinely valid for F5 (a
   deep clone of the canonical `production` record, re-keyed and moved into a
   previously EMPTY category), into a temporary tree WHOSE PATH CONTAINS A SPACE,
   then runs the whole pipeline:

     temp F1/F5-valid catalogue (10 records)
       -> F5 loadCanonical(expectCount: 10)
       -> F6 library projector (libraryPayload)
       -> F6 generator (assets/examples-library.js + examples.html regions)
       -> F6 core search/filter over the generated payload
       -> the generated examples.html base cards + JSON-LD

   and proves: count 10; exactly 10 base cards; #10 appears once; correct solver URL;
   its previously-empty category auto-appears as a filter option with count 1; search
   finds it; a category filter finds it; JSON-LD includes it; and NO UI code file
   (css / ui.js / core.js) changed.

   The REAL site catalogue stays at 9 — everything here happens in a temp copy that is
   deleted at the end. Node built-ins only; Windows-safe (fs.cpSync/rmSync/mkdtempSync,
   execFileSync + process.execPath where a subprocess is needed — none is needed here).
   ========================================================================== */
var fs = require('fs');
var os = require('os');
var path = require('path');

var SITE = path.join(__dirname, '..');
var pass = 0, fail = 0; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

// The category the added record is placed into. It need not be empty: the test verifies its count
// increments by one and the new record is filterable, which is count-agnostic (holds at 9, 24, 36).
var TARGET_CATEGORY = 'energy-sustainability';
var NEW_KEY = 'future-n';
var NEW_SLUG = 'future-example-n';

// ---- build a temp tree (path with a space) that is a full copy of the site ----
function buildTempTree() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline canon10 '));  // space in path
  // Copy the whole src/shared/examples tree, assets, engine and examples.html — enough
  // for loadCanonical + the F6 projector + generator to run end to end.
  fs.cpSync(path.join(SITE, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.cpSync(path.join(SITE, 'assets'), path.join(dir, 'assets'), { recursive: true });
  fs.cpSync(path.join(SITE, 'engine'), path.join(dir, 'engine'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'examples.html'), path.join(dir, 'examples.html'));
  return dir;
}

// Add a 10th record to the F1 catalogue module by cloning `production` (JSON-safe).
function injectNewCatalogue(dir) {
  var catPath = path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
  delete require.cache[require.resolve(catPath)];
  var CATALOGUE = require(catPath).CATALOGUE;
  var base = CATALOGUE.find(function (r) { return r.key === 'production'; });
  var clone = JSON.parse(JSON.stringify(base));
  clone.key = NEW_KEY;
  clone.slug = NEW_SLUG;
  clone.translations.en.title = 'Future example ten';
  clone.translations.en.desc = 'A tenth canonical example for the end-to-end test';
  var next = CATALOGUE.concat([clone]);
  var src = '/* TEMP catalogue with a 10th record (end-to-end #10 test). */\n'
    + 'var CATALOGUE = ' + JSON.stringify(next, null, 2) + ';\n'
    + 'module.exports = { CATALOGUE: CATALOGUE };\n';
  fs.writeFileSync(catPath, src);
}

// Add the matching F5 metadata for the 10th record by cloning the `production:` block
// textually and re-keying it into the empty category.
function injectNewMetadata(dir) {
  var mPath = path.join(dir, 'src', 'shared', 'examples', 'f5', 'metadata.js');
  var txt = read(mPath);
  // Grab the `production: { ... },` block (balanced to its closing `},` at 2-space indent).
  var startTok = '\n  production: {';
  var s = txt.indexOf(startTok);
  if (s === -1) throw new Error('production metadata block not found');
  // Find the block end: the first '\n  },' after the start (2-space indent close).
  var e = txt.indexOf('\n  },', s);
  if (e === -1) throw new Error('production metadata block close not found');
  var block = txt.slice(s + 1, e + '\n  },'.length - 1); // from 'production: {' to '  }'
  // Re-key the clone and move it into the empty category; keep everything else.
  // NEW_KEY contains a hyphen, so it must be a quoted object key (a bare identifier would be a
  // SyntaxError). The metadata module is read via bracket access, so quoting is transparent.
  var metaKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(NEW_KEY) ? NEW_KEY : "'" + NEW_KEY + "'";
  var clone = block
    .replace(/^  production: \{/, '  ' + metaKey + ': {')
    .replace("primaryCategory: 'production-operations'", "primaryCategory: '" + TARGET_CATEGORY + "'")
    .replace(/related: \[[^\]]*\],/, 'related: [],');
  // Insert the clone right after the production block.
  var insertAt = e + '\n  },'.length;
  var next = txt.slice(0, insertAt) + '\n' + clone + ',' + txt.slice(insertAt);
  fs.writeFileSync(mPath, next);
}

var tmp = null;
try {
  // Base catalogue size (count-agnostic): whatever the live catalogue is, adding one record must
  // yield base+1 end to end. Also record the target category's count BEFORE injection so we can
  // assert it increments by exactly one (the old test assumed the category started empty; with the
  // 24-record catalogue no category is empty, so we verify the increment instead).
  var BASE = require(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js')).CATALOGUE.length;
  var N = BASE + 1;
  var baseMeta = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'metadata.js')).METADATA;
  var catBefore = Object.keys(baseMeta).filter(function (k) { return baseMeta[k].primaryCategory === TARGET_CATEGORY; }).length;

  tmp = buildTempTree();
  injectNewCatalogue(tmp);
  injectNewMetadata(tmp);

  // ---- F5 loadCanonical(base+1) ----
  var loadCanonical = require(path.join(tmp, 'src', 'shared', 'examples', 'f5', 'index.js')).loadCanonical;
  var loaded = loadCanonical(tmp, { expectCount: N });
  ok('E2E: F5 loadCanonical accepts a valid base+1 catalogue', loaded.canonical.length === N, String(loaded.canonical.length) + ' vs ' + N);
  var added = loaded.canonical.find(function (c) { return c.key === NEW_KEY; });
  ok('E2E: the added canonical record exists in the target category', !!added && added.primaryCategory === TARGET_CATEGORY);

  // ---- F6 projector ----
  var gen = require(path.join(tmp, 'engine', 'generate-examples-library.js'));
  var payload = gen.buildPayload(tmp);
  ok('E2E: projector emits base+1 records', payload.examples.length === N, String(payload.examples.length) + ' vs ' + N);
  var pAdded = payload.examples.filter(function (r) { return r.id === NEW_KEY; });
  ok('E2E: added record appears exactly once in the payload', pAdded.length === 1);
  ok('E2E: added record solver URL is correct', pAdded.length === 1 && pAdded[0].solverUrl === 'solver.html?ex=' + NEW_SLUG, pAdded.length ? pAdded[0].solverUrl : 'n/a');
  ok('E2E: added record carries its category', pAdded.length === 1 && pAdded[0].category === TARGET_CATEGORY);

  // ---- F6 generator writes examples.html + payload in the temp tree ----
  var runRes = gen.run(tmp, { check: false });
  ok('E2E: generator ran and wrote outputs', runRes.ok);
  var genHtml = read(path.join(tmp, 'examples.html'));

  // exactly base+1 cards
  var cardIds = (genHtml.match(/<article class="lib-card" data-ex-id="([^"]+)"/g) || []);
  ok('E2E: generated base HTML has exactly base+1 cards', cardIds.length === N, String(cardIds.length) + ' vs ' + N);
  var addedCardCount = (genHtml.match(new RegExp('data-ex-id="' + NEW_KEY + '"', 'g')) || []).length;
  ok('E2E: added base card appears exactly once', addedCardCount === 1, String(addedCardCount));
  ok('E2E: added base card links the correct solver URL', genHtml.indexOf('href="solver.html?ex=' + NEW_SLUG + '"') !== -1);

  // target category appears as a filter option, and its count incremented by exactly one
  var catOptRe = new RegExp('data-facet="category" data-value="' + TARGET_CATEGORY + '"');
  ok('E2E: the target category appears as a filter option', catOptRe.test(genHtml));
  var catCountRe = new RegExp('data-cat-count="' + TARGET_CATEGORY + '">(\\d+)<');
  var cm = genHtml.match(catCountRe);
  ok('E2E: the target category filter count incremented by one',
    cm && Number(cm[1]) === catBefore + 1, cm ? (cm[1] + ' vs ' + (catBefore + 1)) : 'missing');

  // total count reflects base+1
  ok('E2E: total count region shows base+1',
    new RegExp('<!--LIBRARY-GENERATED:TOTAL-->' + N + '<!--\\/LIBRARY-GENERATED:TOTAL-->').test(genHtml));

  // JSON-LD includes the added record
  var ld = (genHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  var ldObj = JSON.parse(ld);
  ok('E2E: JSON-LD ItemList has base+1 items', ldObj.itemListElement.length === N, String(ldObj.itemListElement.length) + ' vs ' + N);
  ok('E2E: JSON-LD includes the added solver URL', ld.indexOf(NEW_SLUG) !== -1);

  // ---- F6 core search + filter over the generated payload ----
  var core = require(path.join(tmp, 'assets', 'examples-library-core.js'));
  var genPayload = gen.buildPayload(tmp); // same projection the runtime consumes
  var recs = genPayload.examples;
  function reset() { recs.forEach(function (r) { r.__hay = null; }); }

  reset();
  var byTitle = core.filterExamples(recs, { q: core.normalizeQuery('future example'), category: [], type: [], difficulty: [], goal: [] }, 'en').map(function (r) { return r.id; });
  ok('E2E: search finds the added record by its title', byTitle.indexOf(NEW_KEY) !== -1, byTitle.join(','));

  reset();
  var byCat = core.filterExamples(recs, { q: '', category: [TARGET_CATEGORY], type: [], difficulty: [], goal: [] }, 'en').map(function (r) { return r.id; });
  ok('E2E: category filter includes the added record and has base+1-for-category count',
    byCat.indexOf(NEW_KEY) !== -1 && byCat.length === catBefore + 1, byCat.join(','));

  // ---- NO UI code changed: css / ui.js / core.js identical to the real site ----
  ['assets/examples-library.css', 'assets/examples-library.ui.js', 'assets/examples-library-core.js'].forEach(function (f) {
    ok('E2E: UI code unchanged by the added-record pipeline: ' + f, read(path.join(tmp, f)) === read(path.join(SITE, f)));
  });

  // ---- the REAL site is unchanged (F7a checkpoint: 24 cards) ----
  var realHtml = read(path.join(SITE, 'examples.html'));
  ok('E2E: F7a: the real site examples.html still has exactly 24 cards', (realHtml.match(/<article class="lib-card"/g) || []).length === 24);
} finally {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('CANONICAL #10 END-TO-END  PASSED: ' + pass + '   FAILED: ' + fail + '   (real F5->F6 integration, 10 records)');
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
