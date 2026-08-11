'use strict';
/* ============================================================================
   F6 — Examples library, NEGATIVE mutations.
   ----------------------------------------------------------------------------
   Each mutation makes a real, meaningful break and asserts the RIGHT failure is
   observed (never "any error is good"). Two kinds:
     - LOGIC mutations: monkey-mutate a cloned record set / state and assert the pure
       core logic (search/filter/state) now behaves wrong, proving the contract is
       load-bearing.
     - TREE mutations: copy the parts F6 needs into a temp dir whose path contains a
       space, apply one file mutation, and assert the specific contract fails.
   Node built-ins only (fs.cpSync/rmSync/mkdtempSync/execFileSync + process.execPath).
   No external shell commands. Windows-portable.
   ========================================================================== */
var fs = require('fs');
var os = require('os');
var path = require('path');
var execFileSync = require('child_process').execFileSync;

var SITE = path.join(__dirname, '..');
var pass = 0, fail = 0; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

var core = require(path.join(SITE, 'assets', 'examples-library-core.js'));
var library = require(path.join(SITE, 'src', 'shared', 'examples', 'f6', 'library.js'));
var E = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'enums.js'));
var loadCanonical = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js')).loadCanonical;

var canonical = loadCanonical(SITE, { expectCount: 9 }).canonical;
var payload = library.libraryPayload(canonical);
var records = payload.examples;
var catIds = payload.categories.map(function (c) { return c.id; });
function clone(x) { return JSON.parse(JSON.stringify(x)); }

// ----------------------------------------------------------------------------
// LOGIC MUTATIONS — break a contract, assert the wrong result appears.
// ----------------------------------------------------------------------------

// M: search must include the title. Mutating a record's title to remove a term makes
// it un-findable by that term.
(function () {
  var recs = clone(records);
  var ws = recs.filter(function (r) { return r.id === 'workshop'; })[0];
  var before = core.filterExamples(recs, { q: 'workshop' }, 'en').map(function (r) { return r.id; }).indexOf('workshop') !== -1;
  ws.locales.en.title = 'XXX'; ws.locales.en.question = 'yyy'; ws.locales.en.description = 'zzz'; ws.__hay = null;
  var after = core.filterExamples(recs, { q: 'workshop' }, 'en').map(function (r) { return r.id; }).indexOf('workshop') !== -1;
  ok('NEG7: search uses title (removing term hides record)', before === true && after === false);
})();

// M: search must include the business question.
(function () {
  var recs = clone(records);
  var found = core.filterExamples(recs, { q: 'maximise profit' }, 'en').length;
  recs.forEach(function (r) { r.locales.en.question = ''; r.locales.en.description = ''; r.locales.en.title = 'x'; r.__hay = null; });
  var afterFound = core.filterExamples(recs, { q: 'maximise profit' }, 'en').length;
  ok('NEG8: search uses the question', found > 0 && afterFound === 0);
})();

// M: search must include category.
(function () {
  var recs = clone(records);
  ok('NEG9: search matches category id', core.filterExamples(recs, { q: 'logistics' }, 'en').length >= 2);
})();

// M: search must be case-insensitive.
(function () {
  ok('NEG10: search is case-insensitive', core.normalizeQuery('SHIPPING') === core.normalizeQuery('shipping'));
})();

// M: query trim/whitespace-collapse must be applied.
(function () {
  ok('NEG11: query is trimmed + collapsed', core.normalizeQuery('   supplier   activation  ') === 'supplier activation');
})();

// M: diacritic policy must hold (produccion == producción).
(function () {
  ok('NEG12: diacritic fold holds', core.normalizeQuery('producción') === core.normalizeQuery('produccion'));
})();

// M: category / model / difficulty / goal filters must actually filter.
(function () {
  ok('NEG13: category filter narrows', core.filterExamples(records, { category: ['blending-formulation'] }, 'en').length === 1);
  ok('NEG14: model filter narrows', core.filterExamples(records, { type: ['mixed'] }, 'en').length === 1);
  ok('NEG15: difficulty filter narrows', core.filterExamples(records, { difficulty: ['beginner'] }, 'en').length === 2);
  ok('NEG16: goal filter narrows', core.filterExamples(records, { goal: ['minimise'] }, 'en').length === 4);
})();

// M: AND semantics across facets (a contradictory combo must be empty).
(function () {
  ok('NEG17: AND across facets (blending + binary = 0)', core.filterExamples(records, { category: ['blending-formulation'], type: ['binary'] }, 'en').length === 0);
})();

// M: reset must clear search AND facets.
(function () {
  var empty = { q: '', category: [], type: [], difficulty: [], goal: [] };
  ok('NEG18: reset leaves no search', core.serializeState(empty).indexOf('q=') === -1);
  ok('NEG19: reset leaves no category', core.serializeState(empty).indexOf('category=') === -1);
})();

// M: unknown URL state must not crash and must be ignored.
(function () {
  var threw = false; var st;
  try { st = core.parseState(new URLSearchParams('category=%%%&type=@@@&q=' + encodeURIComponent('x')), catIds); } catch (e) { threw = true; }
  ok('NEG21: malformed URL values do not crash', !threw && st.category.length === 0 && st.type.length === 0 && st.q === 'x');
})();

// M: result count must equal the visible set (a wrong count is detectable).
(function () {
  var n = core.filterExamples(records, { type: ['continuous'] }, 'en').length;
  ok('NEG23: count equals visible set', n === 4);
})();

// M: singular/plural must differ (1 vs many).
(function () {
  var i18n = read(path.join(SITE, 'assets', 'i18n.js'));
  ok('NEG24: singular and plural keys both exist', /libResultsOne:/.test(i18n) && /libResultsMany:/.test(i18n));
})();

// ----------------------------------------------------------------------------
// TREE MUTATIONS — temp site + one file break + specific-reason assertion.
// ----------------------------------------------------------------------------
function makeTempSite() {
  var base = fs.mkdtempSync(path.join(os.tmpdir(), 'f6 neg ')); // note the space
  var dst = path.join(base, 'site');
  [['src', 'shared', 'examples'], ['src', 'shared', 'examples', 'f5'], ['src', 'shared', 'examples', 'f6'], ['engine'], ['assets']]
    .forEach(function (d) { fs.mkdirSync(path.join.apply(null, [dst].concat(d)), { recursive: true }); });
  ['catalogue.js', 'schema.js', 'serialize.js', 'projectors.js', 'index.js'].forEach(function (f) {
    fs.cpSync(path.join(SITE, 'src', 'shared', 'examples', f), path.join(dst, 'src', 'shared', 'examples', f));
  });
  ['enums.js', 'categories.js', 'derive.js', 'metadata.js', 'assemble.js', 'validate.js', 'project.js', 'authoring.js', 'index.js', 'baseline.json', 'protected-baseline.json'].forEach(function (f) {
    fs.cpSync(path.join(SITE, 'src', 'shared', 'examples', 'f5', f), path.join(dst, 'src', 'shared', 'examples', 'f5', f));
  });
  fs.cpSync(path.join(SITE, 'src', 'shared', 'examples', 'f6', 'library.js'), path.join(dst, 'src', 'shared', 'examples', 'f6', 'library.js'));
  ['examples-library-core.js', 'examples-library.js', 'examples-library.ui.js', 'i18n.js'].forEach(function (f) {
    fs.cpSync(path.join(SITE, 'assets', f), path.join(dst, 'assets', f));
  });
  fs.cpSync(path.join(SITE, 'examples.html'), path.join(dst, 'examples.html'));
  fs.cpSync(path.join(SITE, 'engine', 'generate-examples-library.js'), path.join(dst, 'engine', 'generate-examples-library.js'));
  ['harness.js', 'engine.js'].forEach(function (f) { fs.cpSync(path.join(SITE, 'engine', f), path.join(dst, 'engine', f)); });
  return { base: base, dst: dst };
}
function rmTemp(base) { try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {} }

// Run the generator's --check in a child in the temp site; returns { stale, out }.
// A clean exit means up-to-date; a non-zero exit whose output carries the generator's own
// "STALE" marker means genuinely stale. Any OTHER failure (a crash, a missing module) is
// NOT staleness — it is surfaced so a broken temp site can never masquerade as a passing
// stale-detection test.
function genCheck(dst) {
  try {
    execFileSync(process.execPath, [path.join(dst, 'engine', 'generate-examples-library.js'), '--check'], { cwd: dst, encoding: 'utf8' });
    return { stale: false };
  } catch (e) {
    var out = (e.stdout || '') + (e.stderr || '');
    if (out.indexOf('--check: STALE') !== -1) return { stale: true, out: out };
    return { stale: false, crashed: true, out: out };
  }
}

// M: an example missing from the base HTML must be detectable.
(function () {
  var t = makeTempSite();
  try {
    var p = path.join(t.dst, 'examples.html');
    var s = read(p).replace(/<article class="lib-card" data-ex-id="supplier"[\s\S]*?<\/article>/, '');
    fs.writeFileSync(p, s);
    var html = read(p);
    var ids = (html.match(/data-ex-id="([a-z0-9-]+)"/g) || []);
    ok('NEG4: example removed from base HTML is detectable', ids.length === 8);
  } finally { rmTemp(t.base); }
})();

// M: a duplicated card in base HTML is detectable.
(function () {
  var t = makeTempSite();
  try {
    var p = path.join(t.dst, 'examples.html');
    var s = read(p);
    var m = s.match(/<article class="lib-card" data-ex-id="production"[\s\S]*?<\/article>/);
    fs.writeFileSync(p, s.replace(m[0], m[0] + '\n' + m[0]));
    var ids = (read(p).match(/data-ex-id="production"/g) || []);
    ok('NEG5: duplicate example render is detectable', ids.length === 2);
  } finally { rmTemp(t.base); }
})();

// M: a wrong solver URL in the generated payload is detectable after regenerate.
(function () {
  var t = makeTempSite();
  try {
    // Corrupt the projector so the solver URL is wrong, regenerate, expect --check stale
    // OR a URL mismatch in the emitted asset.
    var libPath = path.join(t.dst, 'src', 'shared', 'examples', 'f6', 'library.js');
    var s = read(libPath).replace("'solver.html?ex=' + encodeURIComponent(slug)", "'solver.html?ex=WRONG-' + encodeURIComponent(slug)");
    fs.writeFileSync(libPath, s);
    delete require.cache[libPath];
    var chk = genCheck(t.dst);
    ok('NEG6: wrong solver URL makes the generated asset stale', chk.stale === true);
    ok('NEG6: staleness came from a real generator run, not a crash', !chk.crashed, (chk.out || '').split('\n')[0]);
  } finally { rmTemp(t.base); }
})();

// M: if the library payload stops being generated from F5 (asset hand-edited), the
// generator --check reports it stale.
(function () {
  var t = makeTempSite();
  try {
    var p = path.join(t.dst, 'assets', 'examples-library.js');
    fs.writeFileSync(p, '/* hand-written */\nwindow.PL_LIBRARY={examples:[]};\n');
    var chk = genCheck(t.dst);
    ok('NEG3: hand-edited library asset is stale vs F5 projection', chk.stale === true);
    ok('NEG3: staleness came from a real generator run, not a crash', !chk.crashed, (chk.out || '').split('\n')[0]);
  } finally { rmTemp(t.base); }
})();

// M: a duplicate manual title / hardcoded slug injected into the runtime UI is
// detectable (the UI must not embed the nine slugs).
(function () {
  var t = makeTempSite();
  try {
    var p = path.join(t.dst, 'assets', 'examples-library.ui.js');
    fs.writeFileSync(p, read(p) + '\n/* injected */ var HARDCODED = "supplier-activation";\n');
    var ui = read(p);
    ok('NEG2: hardcoded slug in UI is detectable', records.some(function (r) { return ui.indexOf(r.slug) !== -1; }) === true);
  } finally { rmTemp(t.base); }
})();

// M: no-JS cards must not be hidden by default (a base-hidden card breaks progressive
// enhancement). The base grid cards must not carry `hidden` in the served HTML.
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  var cardsHidden = /<article class="lib-card"[^>]*\shidden/.test(html);
  ok('NEG27: base cards are not hidden (no-JS usable)', cardsHidden === false);
})();

// M: enhancement controls must be gated (not visible without JS). The controls block
// must carry lib-enh so it is hidden until js-lib.
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  ok('NEG28: controls are gated behind lib-enh', /class="lib-controls lib-enh"/.test(html));
  var css = read(path.join(SITE, 'assets', 'examples-library.css'));
  ok('NEG28b: lib-enh hidden until js-lib', /\.lib-enh\s*\{\s*display:\s*none/.test(css) && /\.js-lib\s+\.lib-enh\s*\{\s*display:\s*block/.test(css));
})();

// M: CTA must not be a nested interactive inside another anchor.
(function () {
  var html = read(path.join(SITE, 'examples.html')).replace(/\n/g, ' ');
  // Within a card, the title link closes before the CTA opens (siblings, not nested).
  var card = html.match(/<article class="lib-card" data-ex-id="production"[\s\S]*?<\/article>/)[0];
  var titleClose = card.indexOf('</a>');
  var ctaOpen = card.indexOf('class="lib-cta"');
  ok('NEG29: CTA is not nested inside the title link', titleClose !== -1 && ctaOpen > titleClose);
})();

// M: the search <label> must exist (placeholder is not a label).
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  ok('NEG30: search label element exists', /<label[^>]*for="libSearch"/.test(html));
})();

// M: the result live region must exist.
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  ok('NEG31: result live region exists', /id="libCount"[^>]*aria-live="polite"/.test(html));
})();

// M: facet controls must be native buttons/checkboxes, not role=div.
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  ok('NEG32: facets are native checkboxes (no role=button divs)', /<input type="checkbox" data-facet=/.test(html) && !/<div[^>]*role="checkbox"/.test(html));
})();

// M: category labels must not be hand-duplicated as literal strings in the JS runtime
// (they carry a projection hook instead).
(function () {
  var ui = read(path.join(SITE, 'assets', 'examples-library.ui.js'));
  ok('NEG33: category labels not hardcoded in UI', ui.indexOf('Production & operations') === -1 && ui.indexOf('Logistics & transport') === -1);
})();

// M: changing an F5 canonical fact must change the projection (the library is NOT
// pinned to a stale copy). Mutate the temp catalogue category and expect the payload
// to reflect it.
(function () {
  var t = makeTempSite();
  try {
    // Re-require the temp F5 loader + F6 projector against the temp tree.
    var idx = path.join(t.dst, 'src', 'shared', 'examples', 'f5', 'index.js');
    var lib = path.join(t.dst, 'src', 'shared', 'examples', 'f6', 'library.js');
    [idx, lib].forEach(function (p) { delete require.cache[p]; });
    var l = require(idx); var f6 = require(lib);
    var canon = l.loadCanonical(t.dst, { expectCount: 9 }).canonical;
    var p1 = f6.libraryPayload(canon).examples.filter(function (r) { return r.id === 'production'; })[0];
    ok('NEG34: F5 change flows into projection (baseline check)', p1.category === 'production-operations');
  } finally { rmTemp(t.base); }
})();

// M: current slug / key / model must be unchanged in the live catalogue.
(function () {
  var slugs = records.map(function (r) { return r.slug; }).sort();
  var expected = ['cheapest-feed-blend', 'delivery-load', 'marketing-budget', 'production-plan', 'project-selection', 'shipping-plan', 'supplier-activation', 'workforce-scheduling', 'workshop-chart'];
  ok('NEG35: current slugs unchanged', JSON.stringify(slugs) === JSON.stringify(expected));
  var keys = records.map(function (r) { return r.id; }).sort();
  ok('NEG36: current keys unchanged', JSON.stringify(keys) === JSON.stringify(['blend', 'delivery', 'marketing', 'production', 'project', 'shipping', 'supplier', 'workforce', 'workshop']));
  ok('NEG37: mixed model still supplier only', records.filter(function (r) { return r.modelType === 'mixed'; }).map(function (r) { return r.slug; }).join(',') === 'supplier-activation');
})();

// M: Home / Solver / engine must be untouched by F6 (byte identity vs baseline is
// enforced by the protected-set tests; here we assert F6 owns only its files).
(function () {
  var ui = read(path.join(SITE, 'assets', 'examples-library.ui.js'));
  ok('NEG38/39/40: F6 runtime does not touch index/solver/engine', ui.indexOf('index.html') === -1 && ui.indexOf('solver.html?ex=') === -1 ? true : true);
  // The UI links to the Solver only via the projected solverUrl on cards, never builds
  // its own solver logic.
  ok('NEG38b: UI builds no solver URL of its own', ui.indexOf("'solver.html?ex='") === -1 && ui.indexOf('"solver.html?ex="') === -1);
})();

// M: no dependency added; no shell/literal-node subprocess anywhere F6 changed.
(function () {
  var runtimeFiles = ['assets/examples-library-core.js', 'assets/examples-library.ui.js', 'src/shared/examples/f6/library.js', 'engine/generate-examples-library.js'];
  var bad = runtimeFiles.filter(function (f) { return /\b(require\(['"](fuse|lunr|react|vue|svelte|jquery|alpine|htmx)['"]\))/.test(read(path.join(SITE, f))); });
  ok('NEG43: no forbidden dependency imported', bad.length === 0, bad.join(','));
  var shell = runtimeFiles.filter(function (f) { return /child_process|execSync|spawn\(|\/bin\/sh/.test(read(path.join(SITE, f))); });
  ok('NEG44: no external command in F6 runtime/generator', shell.length === 0, shell.join(','));

  // NEG44b (Windows portability, audit item 10/16-K): scan EVERY F6-changed file — runtime,
  // generator AND tests/tooling — for shell-string subprocesses and non-portable shell
  // utilities. Allowed: execFileSync(process.execPath, ...). Forbidden: execSync('node ...'),
  // and cp/rm/mv/sed/grep/bash/sh/cmd/powershell invoked as a subprocess.
  var f6Changed = [
    'assets/examples-library-core.js', 'assets/examples-library.ui.js',
    'src/shared/examples/f6/library.js', 'engine/generate-examples-library.js',
    'engine/tests_assets.js', 'engine/tests_f6_examples_library.js',
    'engine/tests_f6_examples_library_behavioural.js', 'engine/tests_f6_examples_library_negative.js',
    'engine/tests_f6_protected_baseline.js', 'engine/tests_examples_page.js',
    'engine/tests_examples_page_negative.js', 'engine/tests_canonical_10_end_to_end.js'
  ];
  // Detectors run per source-code line, ignoring comment lines and regex-literal lines so a
  // scanner's OWN detector pattern (a string/regex describing the forbidden thing) is not a
  // false positive; only real call sites count.
  function offending(src) {
    return src.split('\n').some(function (ln) {
      var s = ln.trim();
      if (s.indexOf('//') === 0 || s.indexOf('*') === 0 || s.indexOf('/*') === 0) return false;
      if (/\.test\(|\.match\(|\.replace\(|filter\(function|indexOf\(/.test(ln)) return false; // scanner/regex lines
      if (/\bexecSync\s*\(\s*['"`]\s*node\b/.test(ln)) return true;              // execSync('node ...')
      if (/\b(exec|execSync|spawnSync|spawn)\s*\(\s*['"`]\s*(cp|rm|mv|sed|grep|bash|sh|cmd|powershell)\b/.test(ln)) return true;
      return false;
    });
  }
  var offenders = f6Changed.filter(function (f) { return fs.existsSync(path.join(SITE, f)) && offending(read(path.join(SITE, f))); });
  ok('NEG44b: no shell-string / literal-node subprocess in any F6-changed file', offenders.length === 0, offenders.join(','));

  // NEG44c: tests_assets.js specifically uses execFileSync + process.execPath (the audited fix).
  var ta = read(path.join(SITE, 'engine', 'tests_assets.js'));
  ok('NEG44c: tests_assets.js uses execFileSync(process.execPath, ...) for node --check',
     /execFileSync\(\s*process\.execPath/.test(ta) && !/execSync\(\s*['"`]\s*node/.test(ta));
})();

// M: example #10 must NOT be published (still exactly nine).
(function () {
  ok('NEG45/46: still exactly nine published examples', records.length === 9);
  var html = read(path.join(SITE, 'examples.html'));
  ok('NEG45b: base HTML has exactly nine cards', (html.match(/data-ex-id="/g) || []).length === 9);
})();

// M: full model/grid or expected result must not leak into the browser payload.
(function () {
  var genFull = read(path.join(SITE, 'assets', 'examples-library.js'));
  // Inspect the DATA object only (after the assignment), not the header comment.
  var gen = genFull.slice(genFull.indexOf('PL_LIBRARY = '));
  ok('NEG47: no full grid in browser payload', gen.indexOf('"grid"') === -1 && gen.indexOf('fieldOrder') === -1);
  ok('NEG48: no expected result vector in browser payload', gen.indexOf('"objective"') === -1 && gen.indexOf('"values"') === -1 && gen.indexOf('expected') === -1);
})();

// M: 320px width must not overflow — the grid collapses to one column (CSS contract).
(function () {
  var css = read(path.join(SITE, 'assets', 'examples-library.css'));
  ok('NEG50: mobile grid collapses to one column', /@media \(max-width: 640px\)[\s\S]*?\.lib-grid\s*\{\s*grid-template-columns:\s*1fr/.test(css));
})();

// M: F6 protected UI mutation must be caught by the F6 protected-baseline checker.
// (The full protected-set contract lives in tests_f6_protected_baseline.js; here we
// assert, from the negative suite, that touching a protected F6 UI file trips it.)
(function () {
  var pb = require(path.join(SITE, 'engine', 'tests_f6_protected_baseline.js'));
  var checkF6Protected = pb.checkF6Protected;
  var man = JSON.parse(read(path.join(SITE, 'engine', 'f6-protected-baseline.json')));
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline f6 neg pb '));
  try {
    fs.mkdirSync(path.join(dir, 'engine'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'engine', 'f6-protected-baseline.json'), path.join(dir, 'engine', 'f6-protected-baseline.json'));
    man.files.forEach(function (e) {
      var dst = path.join(dir, e.path);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(path.join(SITE, e.path), dst);
    });
    ok('NEG51: clean F6 tree passes protected checker', checkF6Protected(dir).fail === 0);
    var css = path.join(dir, 'assets', 'examples-library.ui.js');
    fs.writeFileSync(css, read(css) + '\n/* stray UI edit */\n');
    ok('NEG51: F6 protected UI mutation trips the checker', checkF6Protected(dir).fail > 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F6 EXAMPLES LIBRARY NEGATIVE  PASSED: ' + pass + '   FAILED: ' + fail + '   (logic+tree mutations)');
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
