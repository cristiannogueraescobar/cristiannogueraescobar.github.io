/* Checkpoint F1.25 — canonical example catalogue NEGATIVE suite.
 *
 * Each case copies the relevant files into a temp tree, applies ONE mutation, and
 * asserts the official checker / generator / composer trips with a SPECIFIC failure.
 * Cleanup runs in finally. Temp trees are self-sufficient (they copy the catalogue
 * module set), so a mutation is never masked by the main repo. Semantic mutations
 * are caught by contract, not by a bare SHA compare.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE = path.join(__dirname, '..');
const { checkCanonicalExampleCatalogue } = require('./check-canonical-catalogue.js');
const gen = require('./generate-examples.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const CAT_MODULES = ['catalogue.js', 'schema.js', 'serialize.js', 'projectors.js', 'index.js'];
const PUBLIC_FILES = ['assets/i18n.js', 'assets/examples-data.js', 'assets/product-capabilities.js', 'examples.html', 'index.html', 'solver.html'];
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');

// Build a temp tree carrying everything the checker/generator/composer may touch.
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-catneg-'));
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'shared', 'examples'), { recursive: true });
  PUBLIC_FILES.forEach(f => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), fs.readFileSync(path.join(SITE, f)));
  });
  CAT_MODULES.forEach(f => fs.writeFileSync(path.join(dir, 'src', 'shared', 'examples', f), fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', f))));
  // Copy the F1 fixture so the checker's fixture-parity block runs in the temp tree.
  const fxRel = path.join('engine', 'fixtures', 'product', 'example-catalogue-f1.json');
  fs.mkdirSync(path.join(dir, path.dirname(fxRel)), { recursive: true });
  fs.writeFileSync(path.join(dir, fxRel), fs.readFileSync(path.join(SITE, fxRel)));
  return dir;
}
const P = (dir, f) => path.join(dir, f);
const CAT = dir => path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
const rd = p => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);

// Assert that the checker reports a failure whose text contains `needle`.
function expectCheckerTrips(label, mutate, needle) {
  const dir = makeTree();
  try {
    const clean = checkCanonicalExampleCatalogue(dir);
    ok(label + ': clean tree passes', clean.fail === 0, clean.failures.slice(0, 2).join('; '));
    mutate(dir);
    let r;
    try { r = checkCanonicalExampleCatalogue(dir); } catch (e) { r = { fail: 1, failures: [e.message] }; }
    const tripped = r.fail > 0 && (!needle || r.failures.some(m => m.indexOf(needle) !== -1));
    ok(label + ': mutation trips checker' + (needle ? ' (needle "' + needle + '")' : ''), tripped,
      'failures=' + (r.failures || []).slice(0, 2).join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Assert the generator --check reports staleness for a changed projection.
function expectGeneratorStale(label, mutate) {
  const dir = makeTree();
  try {
    ok(label + ': clean generator up to date', gen.run(dir, { check: true }).ok);
    mutate(dir);
    let stale;
    try { stale = !gen.run(dir, { check: true }).ok; } catch (e) { stale = true; }
    ok(label + ': mutation makes generator stale', stale);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- Catalogue integrity (schema) --------------------------------------------
expectCheckerTrips('N1 catalogue missing', dir => fs.rmSync(CAT(dir)), 'threw');
expectCheckerTrips('N2 duplicate key', dir => wr(CAT(dir), rd(CAT(dir)).replace('"key": "workshop"', '"key": "production"')), 'duplicate');
expectCheckerTrips('N3 duplicate slug', dir => wr(CAT(dir), rd(CAT(dir)).replace('"slug": "workshop-chart"', '"slug": "production-plan"')), 'duplicate');
expectCheckerTrips('N4 unknown record field', dir => wr(CAT(dir), rd(CAT(dir)).replace('"key": "production",', '"key": "production", "bogus": 1,')), 'unknown field');
expectCheckerTrips('N5 missing language', dir => wr(CAT(dir), rd(CAT(dir)).replace(/,\s*"fr": \{[^}]*"title": "Plan de production"[^}]*\}/, '')), 'validation');
expectCheckerTrips('N6 empty title', dir => wr(CAT(dir), rd(CAT(dir)).replace('"title": "Production plan"', '"title": ""')), 'empty title');
expectCheckerTrips('N7 empty description', dir => wr(CAT(dir), rd(CAT(dir)).replace('"desc": "Maximise profit within available production hours"', '"desc": ""')), 'empty');
expectCheckerTrips('N8 invalid category', dir => wr(CAT(dir), rd(CAT(dir)).replace('"category": "start"', '"category": "bogus"')), 'category');
expectCheckerTrips('N9 invalid type', dir => wr(CAT(dir), rd(CAT(dir)).replace('"type": "continuous"', '"type": "bogus"')), 'type');
expectCheckerTrips('N10 invalid sense', dir => wr(CAT(dir), rd(CAT(dir)).replace('"sense": "max"', '"sense": "sideways"')), 'sense');
expectCheckerTrips('N11 invalid grid cell (non-string)', dir => wr(CAT(dir), rd(CAT(dir)).replace('"Product",', '12345,')), 'grid');
expectCheckerTrips('N12 invalid domain type', dir => wr(CAT(dir), rd(CAT(dir)).replace('"type": "binary"', '"type": "quantum"')), 'validation');
expectCheckerTrips('N13 pinned variable value (unknown expected field)', dir => wr(CAT(dir), rd(CAT(dir)).replace('"objective": 1760', '"objective": 1760,\n        "values": [10, 20, 30]')), 'invented');
expectCheckerTrips('N14 wrong expected count (extra example)', dir => {
  let s = rd(CAT(dir));
  // duplicate the production record block to make 10
  s = s.replace(/(\{\s*"key": "production"[\s\S]*?\n  \},\n)/, '$1$1');
  wr(CAT(dir), s);
}, 'expected 9');

// ---- Projection staleness (each served projection) ----------------------------
expectGeneratorStale('N15 i18n value changed in file', dir => wr(P(dir, 'assets/i18n.js'), rd(P(dir, 'assets/i18n.js')).replace("exName_production:'Production plan'", "exName_production:'X'")));
expectGeneratorStale('N16 examples-data META changed in file', dir => wr(P(dir, 'assets/examples-data.js'), rd(P(dir, 'assets/examples-data.js')).replace("slug: 'production-plan'", "slug: 'prod-plan'")));
expectGeneratorStale('N17 JSON-LD changed in file', dir => wr(P(dir, 'examples.html'), rd(P(dir, 'examples.html')).replace('"position":1,', '"position":42,')));
expectGeneratorStale('N18 catalogue title changed makes i18n stale', dir => wr(CAT(dir), rd(CAT(dir)).replace('"title": "Production plan"', '"title": "Prod plan"')));
expectGeneratorStale('N19 catalogue slug changed makes META + JSON-LD stale', dir => wr(CAT(dir), rd(CAT(dir)).replace('"slug": "production-plan"', '"slug": "prod-plan"')));
expectGeneratorStale('N20 catalogue type changed makes META stale', dir => wr(CAT(dir), rd(CAT(dir)).replace('"type": "continuous"', '"type": "integer"')));

// ---- Projection fidelity via the checker --------------------------------------
expectCheckerTrips('N21 i18n occurrence removed', dir => wr(P(dir, 'assets/i18n.js'), rd(P(dir, 'assets/i18n.js')).replace("        exName_shipping:'Shipping plan',\n", '')), 'i18n');
expectCheckerTrips('N22 i18n extra occurrence', dir => wr(P(dir, 'assets/i18n.js'), rd(P(dir, 'assets/i18n.js')).replace("        exName_blend:'Cheapest feed blend',\n", "        exName_blend:'Cheapest feed blend',\n        exName_blend:'Cheapest feed blend',\n")), 'i18n');
expectCheckerTrips('N23 examples-data slug diverges', dir => wr(P(dir, 'assets/examples-data.js'), rd(P(dir, 'assets/examples-data.js')).replace("slug: 'workshop-chart'", "slug: 'ws'")), 'examples-data');
expectCheckerTrips('N24 examples-data order changed', dir => {
  let s = rd(P(dir, 'assets/examples-data.js'));
  s = s.replace(/(\{ key: 'production'[^\n]*\n)(\s*\{ key: 'workshop'[^\n]*\n)/, '$2$1');
  wr(P(dir, 'assets/examples-data.js'), s);
}, 'examples-data');
expectCheckerTrips('N25 examples.html card omitted', dir => wr(P(dir, 'examples.html'), rd(P(dir, 'examples.html')).replace(/,\{"@type":"ListItem","position":9[^}]*\}/, '')), 'examples.html');
expectCheckerTrips('N26 examples.html no-JS link stale', dir => wr(P(dir, 'examples.html'), rd(P(dir, 'examples.html')).replace('href="solver.html?ex=production-plan">Production plan</a>', 'href="solver.html?ex=WRONG">Production plan</a>')), 'examples.html');
expectCheckerTrips('N27 home unknown slug', dir => wr(P(dir, 'index.html'), rd(P(dir, 'index.html')).replace('solver.html?ex=production-plan', 'solver.html?ex=ghost-slug')), 'home');
expectCheckerTrips('N28 home restores canonical title key', dir => wr(P(dir, 'index.html'), rd(P(dir, 'index.html')).replace('data-i18n="heroCtaPrimary"', 'data-i18n="exName_production"')), 'home');
expectCheckerTrips('N29 capability unknown exampleId', dir => wr(P(dir, 'assets/product-capabilities.js'), rd(P(dir, 'assets/product-capabilities.js')).replace(/exampleId:\s*'production'/, "exampleId: 'ghost'")), 'home + capabilities');
expectCheckerTrips('N30 capability stores full url', dir => wr(P(dir, 'assets/product-capabilities.js'), rd(P(dir, 'assets/product-capabilities.js')).replace(/(\* CI, every exampleId is real or null)/, "* url: 'solver.html?ex=production-plan'\n$1")), 'home + capabilities');

// ---- Serializer / order contracts --------------------------------------------
expectCheckerTrips('N31 catalogue order changed trips projections', dir => {
  let s = rd(CAT(dir));
  s = s.replace(/(\{\s*"key": "production"[\s\S]*?\n  \},\n)(  \{\s*"key": "workshop"[\s\S]*?\n  \},\n)/, '$2$1');
  wr(CAT(dir), s);
}, 'order');
// N32: an objective change is caught by the detection/solve parity check (the
// projections themselves don't carry the objective, so parity is the guard).
(function () {
  const dir = makeTree();
  try {
    wr(CAT(dir), rd(CAT(dir)).replace('"objective": 1760', '"objective": 9999'));
    const { run } = require('./harness.js');
    const { loadAndValidateCatalogue } = require('../src/shared/examples/index.js');
    const { catalogue } = loadAndValidateCatalogue(dir);
    const prod = catalogue.find(r => r.key === 'production');
    const r = run(prod.model.grid, { mutate: m => { if (m.objective) m.objective.sense = prod.sense; } });
    const matches = !r.error && Math.abs(r.out.objective - prod.expected.objective) <= 1e-9;
    ok('N32 objective mismatch caught by solve parity', !matches, 'engine=' + (r.out && r.out.objective) + ' expected=' + prod.expected.objective);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// ---- Composer contracts (solver EXAMPLES marker) ------------------------------
function expectComposerThrows(label, mutate, needle) {
  const dir = makeTree();
  try {
    // copy solver-ui fragments + engine source so the composer can run end to end
    fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
    for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
    fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), path.join(dir, 'engine', 'source', 'plumline-engine.js'));
    const { composeSolverInterface } = require('../src/shared/compose-solver.js');
    // clean composes:
    let threwClean = false; try { composeSolverInterface(rd(P(dir, 'solver.html')), dir); } catch (e) { threwClean = true; }
    ok(label + ': clean tree composes', !threwClean);
    mutate(dir);
    let threw = false, msg = '';
    try { composeSolverInterface(rd(P(dir, 'solver.html')), dir); } catch (e) { threw = true; msg = e.message; }
    ok(label + ': mutation makes composition throw' + (needle ? ' (needle "' + needle + '")' : ''), threw && (!needle || msg.indexOf(needle) !== -1), msg);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
expectComposerThrows('N33 solver marker removed (unbalanced)', dir => wr(P(dir, 'solver.html'), rd(P(dir, 'solver.html')).replace('/* SOLVER_EXAMPLES_CATALOGUE_START */\n', '')), 'unbalanced');
expectComposerThrows('N34 duplicate solver start marker', dir => wr(P(dir, 'solver.html'), rd(P(dir, 'solver.html')).replace('/* SOLVER_EXAMPLES_CATALOGUE_START */', '/* SOLVER_EXAMPLES_CATALOGUE_START */\n/* SOLVER_EXAMPLES_CATALOGUE_START */')), 'more than one');
expectComposerThrows('N35 inline EXAMPLES AND marker', dir => wr(P(dir, 'solver.html'), rd(P(dir, 'solver.html')).replace('/* SOLVER_EXAMPLES_CATALOGUE_END */', '/* SOLVER_EXAMPLES_CATALOGUE_END */\n  var EXAMPLES={};')), 'inline EXAMPLES');
expectComposerThrows('N36 catalogue absent in tree (no fallback to main repo)', dir => fs.rmSync(CAT(dir)), 'catalogue.js');
expectComposerThrows('N37 content between markers', dir => wr(P(dir, 'solver.html'), rd(P(dir, 'solver.html')).replace('/* SOLVER_EXAMPLES_CATALOGUE_START */\n/* SOLVER_EXAMPLES_CATALOGUE_END */', '/* SOLVER_EXAMPLES_CATALOGUE_START */\nvar X=1;\n/* SOLVER_EXAMPLES_CATALOGUE_END */')), 'unexpected content');

// ---- Alternative-authority / duplication --------------------------------------
// N38: a second inline EXAMPLES authority in the solver source is caught by the
// composer (the checker doesn't read solver source; the composer does).
(function () {
  const dir = makeTree();
  try {
    fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
    for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
    fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), path.join(dir, 'engine', 'source', 'plumline-engine.js'));
    wr(P(dir, 'solver.html'), rd(P(dir, 'solver.html')).replace('/* SOLVER_EXAMPLES_CATALOGUE_END */', '/* SOLVER_EXAMPLES_CATALOGUE_END */\n  var EXAMPLES={dup:1};'));
    const { composeSolverInterface } = require('../src/shared/compose-solver.js');
    let threw = false, msg = '';
    try { composeSolverInterface(rd(P(dir, 'solver.html')), dir); } catch (e) { threw = true; msg = e.message; }
    ok('N38 second inline EXAMPLES authority caught by composer', threw && msg.indexOf('inline EXAMPLES') !== -1, msg);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// ---- Generator determinism / hygiene ------------------------------------------
(function () {
  const dir = makeTree();
  try {
    const a = gen.run(dir, { check: true });
    const b = gen.run(dir, { check: true });
    ok('N39 generator deterministic (two --check runs identical)', a.ok === b.ok && a.ok === true);
    // generator writes nothing under --check:
    const before = fs.readFileSync(P(dir, 'assets/i18n.js'), 'utf8');
    gen.run(dir, { check: true });
    ok('N40 generator --check writes nothing', fs.readFileSync(P(dir, 'assets/i18n.js'), 'utf8') === before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// ---- Spaced-path self-sufficiency ---------------------------------------------
(function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cat neg spc-'));
  try {
    fs.mkdirSync(path.join(base, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(base, 'src', 'shared', 'examples'), { recursive: true });
    PUBLIC_FILES.forEach(f => { fs.mkdirSync(path.dirname(path.join(base, f)), { recursive: true }); fs.writeFileSync(path.join(base, f), fs.readFileSync(path.join(SITE, f))); });
    CAT_MODULES.forEach(f => fs.writeFileSync(path.join(base, 'src', 'shared', 'examples', f), fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', f))));
    ok('N41 spaced-path clean tree passes checker', checkCanonicalExampleCatalogue(base).fail === 0);
    wr(CAT(base), rd(CAT(base)).replace('"title": "Production plan"', '"title": "Prod plan"'));
    ok('N42 spaced-path mutation trips checker', checkCanonicalExampleCatalogue(base).fail > 0);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

// ---- Not-published invariant --------------------------------------------------
(function () {
  const dir = makeTree();
  try {
    fs.mkdirSync(path.join(dir, 'dist', 'src', 'shared', 'examples'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist', 'src', 'shared', 'examples', 'catalogue.js'), 'leak');
    const r = checkCanonicalExampleCatalogue(dir);
    ok('N43 catalogue published to dist trips checker', r.fail > 0 && r.failures.some(m => m.indexOf('not published') !== -1));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// ---- Fixture parity -----------------------------------------------------------
expectCheckerTrips('N44 fixture slug diverges from catalogue', dir => {
  const fx = path.join(dir, 'engine', 'fixtures', 'product', 'example-catalogue-f1.json');
  wr(fx, rd(fx).replace('"production-plan"', '"prod-plan"'));
}, 'fixture');
expectCheckerTrips('N45 fixture expected objective diverges', dir => {
  const fx = path.join(dir, 'engine', 'fixtures', 'product', 'example-catalogue-f1.json');
  wr(fx, rd(fx).replace('"objective": 1760', '"objective": 1761'));
}, 'fixture');

console.log('CANONICAL CATALOGUE NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
