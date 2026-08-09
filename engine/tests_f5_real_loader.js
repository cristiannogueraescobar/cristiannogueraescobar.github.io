'use strict';
/* ============================================================================
   F5 — REAL canonical loader contract for no-solution records.
   ----------------------------------------------------------------------------
   This suite proves that the SAME path F7 will use — a real F1 catalogue.js entry
   -> f1.loadAndValidateCatalogue -> f5.loadCanonical -> canonical example -> real
   engine solve -> status verification — accepts honest infeasible/unbounded records
   and rejects fake-objective ones. It does NOT mock or bypass the loader; it writes
   a real temp site and calls loadCanonical(tempSite, { expectCount }).

   No public example is added; the temp catalogue lives only under an OS temp dir.
   Node built-ins only (fs.cpSync/mkdtempSync/rmSync), so it is Windows-portable.
   ========================================================================== */
var fs = require('fs');
var os = require('os');
var path = require('path');

var SITE = path.join(__dirname, '..');
var pass = 0, fail = 0; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

// Build a real temp site that mirrors the example architecture, then overwrite the
// F1 catalogue and F5 metadata with a SINGLE record so loadCanonical validates and
// assembles exactly one canonical example through the real F1 loader.
function makeTempSite() {
  var base = fs.mkdtempSync(path.join(os.tmpdir(), 'f5 real ')); // note the space
  var dst = path.join(base, 'site');
  [['src', 'shared', 'examples'], ['src', 'shared', 'examples', 'f5'], ['engine'], ['assets'], ['docs']]
    .forEach(function (d) { fs.mkdirSync(path.join.apply(null, [dst].concat(d)), { recursive: true }); });
  ['catalogue.js', 'schema.js', 'serialize.js', 'projectors.js', 'index.js'].forEach(function (f) {
    fs.cpSync(path.join(SITE, 'src', 'shared', 'examples', f), path.join(dst, 'src', 'shared', 'examples', f));
  });
  ['enums.js', 'categories.js', 'derive.js', 'metadata.js', 'assemble.js', 'validate.js', 'project.js', 'authoring.js', 'index.js', 'baseline.json', 'protected-baseline.json'].forEach(function (f) {
    fs.cpSync(path.join(SITE, 'src', 'shared', 'examples', 'f5', f), path.join(dst, 'src', 'shared', 'examples', 'f5', f));
  });
  ['harness.js', 'engine.js'].forEach(function (f) { fs.cpSync(path.join(SITE, 'engine', f), path.join(dst, 'engine', f)); });
  return { base: base, dst: dst };
}
function rmTemp(base) { try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {} }

// A minimal, real infeasible model (X+Y>=100 but X<=10, Y<=10) and unbounded model
// (maximise X with only a lower bound), authored as F1 catalogue records.
var langs = { en: { title: 'T', desc: 'd' }, es: { title: 'T', desc: 'd' }, pt: { title: 'T', desc: 'd' }, de: { title: 'T', desc: 'd' }, fr: { title: 'T', desc: 'd' } };
var INF_GRID = [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Y', '0', '1', '=B3*C3', '', ''], ['', '', '', '', '', ''], ['Tot', '', '', '=SUM(D2:D3)', '', ''], ['Need', '', '', '=SUM(B2:B3)', '>=', '100'], ['CapX', '', '', '=B2', '<=', '10'], ['CapY', '', '', '=B3', '<=', '10']];
var UNB_GRID = [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Y', '0', '1', '=B3*C3', '', ''], ['', '', '', '', '', ''], ['Tot', '', '', '=SUM(D2:D3)', '', ''], ['Min', '', '', '=B2', '>=', '5']];

function catalogueSource(rec) {
  return "'use strict';\nvar CATALOGUE = [\n" + JSON.stringify(rec, null, 2) + "\n];\nmodule.exports = { CATALOGUE: CATALOGUE };\n";
}
function metadataSource(key, cat, capability) {
  var meta = {};
  meta[key] = {
    schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2,
    audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: [capability],
    related: [], result: { policy: 'status-only' },
    content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } },
  };
  return "'use strict';\nvar METADATA = " + JSON.stringify(meta, null, 2) + ";\nmodule.exports = { METADATA: METADATA };\n";
}

// Solve a canonical example on the REAL engine, driven exactly like the behavioural
// suite's solveModel: map the canonical model + sense onto harness.run(). We require
// the harness/engine FROM THE TEMP SITE so the test literally exercises the temp
// tree's own engine, completing the documented pipeline (loadCanonical -> real solve).
function realSolve(dst, ex) {
  var harness = require(path.join(dst, 'engine', 'harness.js'));
  var model = ex.model;
  var opts = {};
  function applySense(m) { if (m.objective) m.objective.sense = ex.sense; }
  if (model.whole) { opts.integer = true; opts.mutate = applySense; }
  else { opts.mutate = applySense; }
  return harness.run(model.grid, opts);
}

// Status-only verification: for a no-solution example the ONLY mathematical claim is
// that the real engine returns the declared status and does NOT emit a fake objective
// or decision vector. (Reused shape of the behavioural verifier's no-solution branch,
// kept local so this stays a test, not runtime production code.)
function verifyStatusOnly(expectedStatus, out) {
  var reasons = [];
  if (out.status !== expectedStatus) reasons.push('status ' + out.status + ' != ' + expectedStatus);
  if (out.objective !== undefined && out.objective !== null) reasons.push('no-solution result must not carry an objective');
  if (Array.isArray(out.values) && out.values.length) reasons.push('no-solution result must not carry a decision vector');
  return { ok: reasons.length === 0, reasons: reasons };
}

// Run loadCanonical against a temp site whose F1 catalogue holds ONE record, then —
// when it loads — solve the canonical example on the temp site's REAL engine.
function loadWith(rec, key, capability) {
  var t = makeTempSite();
  try {
    fs.writeFileSync(path.join(t.dst, 'src', 'shared', 'examples', 'catalogue.js'), catalogueSource(rec));
    fs.writeFileSync(path.join(t.dst, 'src', 'shared', 'examples', 'f5', 'metadata.js'), metadataSource(key, 'learning-engine', capability));
    var idxPath = path.join(t.dst, 'src', 'shared', 'examples', 'f5', 'index.js');
    delete require.cache[idxPath];
    var mod = require(idxPath);
    var res = { ok: true, loaded: null, error: null, solved: null };
    try {
      res.loaded = mod.loadCanonical(t.dst, { expectCount: 1 });
      // Complete the pipeline: real solve of the canonical example on the temp engine.
      try { res.solved = realSolve(t.dst, res.loaded.canonical[0]); }
      catch (se) { res.solved = { error: se.message }; }
    }
    catch (e) { res.ok = false; res.error = e.message; }
    return res;
  } finally { rmTemp(t.base); }
}

// ---- Fixture A: real infeasible + null objective -> loadCanonical PASSES ----
(function () {
  var rec = { key: 'inf', slug: 'inf-x', category: 'start', type: 'continuous', sense: 'min', translations: langs, model: { grid: INF_GRID }, expected: { status: 'infeasible', modelType: 'continuous', objective: null } };
  var r = loadWith(rec, 'inf', 'minimise');
  ok('A: infeasible + null passes the REAL loadCanonical', r.ok, r.error);
  if (r.ok) {
    var ex = r.loaded.canonical[0];
    ok('A: canonical status is infeasible', ex.expected.status === 'infeasible', ex.expected.status);
    ok('A: canonical objective is null/absent', ex.expected.objective === null || ex.expected.objective === undefined, JSON.stringify(ex.expected.objective));
    ok('A: resultPolicy is status-only', ex.resultPolicy === 'status-only', ex.resultPolicy);
    ok('A: canonical example is frozen', Object.isFrozen(ex));
    ok('A: canonical array is frozen', Object.isFrozen(r.loaded.canonical));
    // Real solve completes the pipeline: the engine returns infeasible and the
    // status-only expected verification passes.
    ok('A: real engine solve returns infeasible', !!r.solved && r.solved.out && r.solved.out.status === 'infeasible', r.solved && r.solved.out ? r.solved.out.status : (r.solved && r.solved.error));
    if (r.solved && r.solved.out) {
      var vA = verifyStatusOnly(ex.expected.status, r.solved.out);
      ok('A: status-only expected verification passes', vA.ok, vA.reasons.join('; '));
    }
  }
})();

// ---- Fixture B: real unbounded + null objective -> loadCanonical PASSES ------
(function () {
  var rec = { key: 'unb', slug: 'unb-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: UNB_GRID }, expected: { status: 'unbounded', modelType: 'continuous', objective: null } };
  var r = loadWith(rec, 'unb', 'maximise');
  ok('B: unbounded + null passes the REAL loadCanonical', r.ok, r.error);
  if (r.ok) {
    var ex = r.loaded.canonical[0];
    ok('B: canonical status is unbounded', ex.expected.status === 'unbounded', ex.expected.status);
    ok('B: canonical objective is null/absent', ex.expected.objective === null || ex.expected.objective === undefined, JSON.stringify(ex.expected.objective));
    ok('B: resultPolicy is status-only', ex.resultPolicy === 'status-only', ex.resultPolicy);
    ok('B: canonical example is frozen', Object.isFrozen(ex));
    ok('B: real engine solve returns unbounded', !!r.solved && r.solved.out && r.solved.out.status === 'unbounded', r.solved && r.solved.out ? r.solved.out.status : (r.solved && r.solved.error));
    if (r.solved && r.solved.out) {
      var vB = verifyStatusOnly(ex.expected.status, r.solved.out);
      ok('B: status-only expected verification passes', vB.ok, vB.reasons.join('; '));
    }
  }
})();

// ---- Fixture B2: unbounded with the objective KEY ABSENT (not null) ---------
(function () {
  var rec = { key: 'unb', slug: 'unb-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: UNB_GRID }, expected: { status: 'unbounded', modelType: 'continuous' } };
  var r = loadWith(rec, 'unb', 'maximise');
  ok('B2: unbounded with ABSENT objective also passes loadCanonical', r.ok, r.error);
})();

// ---- Fixture C: infeasible + fake numeric objective -> FAILS via F1 schema ---
(function () {
  var rec = { key: 'inf', slug: 'inf-x', category: 'start', type: 'continuous', sense: 'min', translations: langs, model: { grid: INF_GRID }, expected: { status: 'infeasible', modelType: 'continuous', objective: 123 } };
  var r = loadWith(rec, 'inf', 'minimise');
  ok('C: infeasible + fake objective FAILS the loader', !r.ok, 'unexpectedly loaded');
  ok('C: failure is the F1 no-solution objective rule', !!r.error && /must not pin an objective/.test(r.error), r.error);
})();

// ---- Fixture D: unbounded + fake numeric objective -> FAILS via F1 schema ----
(function () {
  var rec = { key: 'unb', slug: 'unb-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: UNB_GRID }, expected: { status: 'unbounded', modelType: 'continuous', objective: 999 } };
  var r = loadWith(rec, 'unb', 'maximise');
  ok('D: unbounded + fake objective FAILS the loader', !r.ok, 'unexpectedly loaded');
  ok('D: failure is the F1 no-solution objective rule', !!r.error && /must not pin an objective/.test(r.error), r.error);
})();

// ---- Fixture E: optimal WITHOUT a finite objective -> FAILS via F1 schema ----
(function () {
  var rec = { key: 'opt', slug: 'opt-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: UNB_GRID }, expected: { status: 'optimal', modelType: 'continuous', objective: null } };
  var r = loadWith(rec, 'opt', 'maximise');
  ok('E: optimal + null objective FAILS the loader', !r.ok, 'unexpectedly loaded');
  ok('E: failure is the F1 finite-objective rule', !!r.error && /objective must be finite/.test(r.error), r.error);
})();

// ---- defineExample and loadCanonical AGREE on the same record ----------------
(function () {
  var authoring = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'authoring.js'));
  var rec = { key: 'inf', slug: 'inf-x', category: 'start', type: 'continuous', sense: 'min', translations: langs, model: { grid: INF_GRID }, expected: { status: 'infeasible', modelType: 'continuous', objective: null } };
  var meta = { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: ['minimise'], related: [], result: { policy: 'status-only' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } };
  var defineOk = true; try { authoring.defineExample(rec, meta); } catch (e) { defineOk = false; }
  var loadOk = loadWith(rec, 'inf', 'minimise').ok;
  ok('AGREE: defineExample and loadCanonical agree (both accept infeasible+null)', defineOk === true && loadOk === true, 'define=' + defineOk + ' load=' + loadOk);
  // And both reject the fake-objective version.
  var bad = { key: 'inf', slug: 'inf-x', category: 'start', type: 'continuous', sense: 'min', translations: langs, model: { grid: INF_GRID }, expected: { status: 'infeasible', modelType: 'continuous', objective: 5 } };
  var defineBad = false; try { authoring.defineExample(bad, meta); } catch (e) { defineBad = true; }
  var loadBad = !loadWith(bad, 'inf', 'minimise').ok;
  ok('AGREE: defineExample and loadCanonical agree (both reject infeasible+numeric)', defineBad === true && loadBad === true, 'define=' + defineBad + ' load=' + loadBad);
})();

// ---- Machine-id key grammar + tolerance policy through the REAL loader -------
// A solution-bearing catalogue with a valid (optionally tolerance-bearing) record and
// matching objective-feasible metadata, loaded through the real loadCanonical.
var SOL_GRID = [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Tot', '', '', '=SUM(D2:D2)', '', ''], ['Cap', '', '', '=B2', '<=', '5']];
function metaObjFeasible(key) {
  var meta = {};
  meta[key] = { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: ['maximise'], related: [], result: { policy: 'objective-feasible' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } };
  return "'use strict';\nvar METADATA = " + JSON.stringify(meta, null, 2) + ";\nmodule.exports = { METADATA: METADATA };\n";
}
function loadSolutionBearing(recOver) {
  var t = makeTempSite();
  try {
    var rec = { key: 'fut', slug: 'future-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: SOL_GRID }, expected: { status: 'optimal', modelType: 'continuous', objective: 5 } };
    recOver(rec);
    fs.writeFileSync(path.join(t.dst, 'src', 'shared', 'examples', 'catalogue.js'), catalogueSource(rec));
    fs.writeFileSync(path.join(t.dst, 'src', 'shared', 'examples', 'f5', 'metadata.js'), metaObjFeasible(rec.key));
    var idxPath = path.join(t.dst, 'src', 'shared', 'examples', 'f5', 'index.js');
    delete require.cache[idxPath];
    var mod = require(idxPath);
    var res = { ok: true, error: null };
    try { mod.loadCanonical(t.dst, { expectCount: 1 }); } catch (e) { res.ok = false; res.error = e.message; }
    return res;
  } finally { rmTemp(t.base); }
}

(function () {
  // Valid future key + in-band (absent) tolerance passes.
  ok('F: valid future key + default tolerance passes loadCanonical', loadSolutionBearing(function (r) { r.key = 'example-10'; }).ok);
  // Bad machine-id key fails via the F1 grammar on the real loader.
  var badKey = loadSolutionBearing(function (r) { r.key = 'Bad Key'; });
  ok('F: bad machine-id key fails loadCanonical', !badKey.ok && /machine ID/.test(badKey.error || ''), badKey.error);
  // tolerance = 5 (> MAX) fails via the F5 policy on the real loader.
  var tolHi = loadSolutionBearing(function (r) { r.expected.tolerance = 5; });
  ok('G: tolerance=5 fails loadCanonical (exceeds MAX)', !tolHi.ok && /exceeds MAX_TOLERANCE/.test(tolHi.error || ''), tolHi.error);
  // tolerance = 1e-20 (< MIN) fails via the F5 policy on the real loader.
  var tolLo = loadSolutionBearing(function (r) { r.expected.tolerance = 1e-20; });
  ok('G: tolerance=1e-20 fails loadCanonical (below MIN)', !tolLo.ok && /below MIN_TOLERANCE/.test(tolLo.error || ''), tolLo.error);
  // tolerance = MIN and MAX both pass.
  var E = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'enums.js'));
  ok('G: tolerance=MIN passes loadCanonical', loadSolutionBearing(function (r) { r.expected.tolerance = E.MIN_TOLERANCE; }).ok);
  ok('G: tolerance=MAX passes loadCanonical', loadSolutionBearing(function (r) { r.expected.tolerance = E.MAX_TOLERANCE; }).ok);
})();

// ---- GUARD: authoring.js must NOT suppress the F1 objective error ------------
(function () {
  var src = fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'authoring.js'), 'utf8');
  ok('GUARD: authoring.js has no "expected objective must be finite" suppression', src.indexOf('expected objective must be finite') === -1);
  ok('GUARD: authoring.js has no regex error-return workaround', !/\/expected objective[^/]*\/\.test\(e\)/.test(src));
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F5 REAL LOADER (no-solution)  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { run: function () { return { pass: pass, fail: fail, failures: failures }; } };
