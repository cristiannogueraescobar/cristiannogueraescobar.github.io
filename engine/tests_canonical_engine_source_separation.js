/* tests_canonical_engine_source_separation.js — E1 separation contract (F7a c-2).
 *
 * Proves the E1 authority was DECOMPOSED, not weakened, by the count-agnostic migration of its one
 * EXAMPLES-owning field (composed_solver). Four scenarios on isolated temp trees:
 *
 *   A. EXAMPLES-only mutation (change a catalogue record the composer projects):
 *        - E1 canonical composed_solver contract stays GREEN (the EXAMPLES region is sentinel-
 *          replaced before hashing), and the engine_slice / canonical_source raw contracts stay
 *          green (untouched);
 *        - the solver catalogue projection contract FAILS (records changed).
 *   B. engine_slice mutation (change the canonical engine source byte-for-byte):
 *        - the E1 raw engine contract FAILS.
 *   C. protected non-catalogue UI mutation inside solver.html (outside the EXAMPLES region):
 *        - the E1 composed contract FAILS (the change survives canonicalisation).
 *   D. combined EXAMPLES + engine_slice mutation:
 *        - the projection contract AND the E1 raw engine contract both FAIL.
 *
 * The E1 verdict comes from checkCanonicalEngineSource; the catalogue verdict from the projection
 * contract's key/order invariants.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkCanonicalEngineSource } = require('./tests_canonical_engine_source.js');
const { copyCatalogueTree, CAT_REL } = require('./copy-catalogue-tree.js');
const { canonicaliseSolverExamplesRegion } = require('../src/shared/solver-ui-canonical.js');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { loadAndValidateCatalogue } = require('../src/shared/examples/index.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const SITE = path.join(__dirname, '..');
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const ENG_DIR = path.join('engine', 'source');
const CANON = 'plumline-engine.js';
const FIX_REL = path.join('engine', 'fixtures', 'single-engine', 'engine-e1-source.json');

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e1-sep-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, ENG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'single-engine'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'solver.html'), path.join(dir, 'solver.html'));
  fs.copyFileSync(path.join(SITE, 'engine', 'engine.js'), path.join(dir, 'engine', 'engine.js'));
  fs.copyFileSync(path.join(SITE, 'engine', 'generate-engine-mirror.js'), path.join(dir, 'engine', 'generate-engine-mirror.js'));
  fs.copyFileSync(path.join(SITE, ENG_DIR, 'engine-platform-adapter.json'), path.join(dir, ENG_DIR, 'engine-platform-adapter.json'));
  fs.copyFileSync(path.join(SITE, ENG_DIR, CANON), path.join(dir, ENG_DIR, CANON));
  fs.copyFileSync(path.join(SITE, FIX_REL), path.join(dir, FIX_REL));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  copyCatalogueTree(SITE, dir);
  return dir;
}

// E1 verdict for the abstracted aggregate (composed_solver) + raw engine fields.
function e1Passes(dir) { return checkCanonicalEngineSource(dir).fail === 0; }
// Narrower verdict: does E1 fail specifically on a composed_solver contract?
function e1FailsOnComposed(dir) {
  return checkCanonicalEngineSource(dir).failures.some(m => /composed solver canonical/.test(m));
}
// Narrower verdict: does E1 fail specifically on the raw engine slice / canonical source?
function e1FailsOnEngine(dir) {
  return checkCanonicalEngineSource(dir).failures.some(m => /engine slice|canonical source/i.test(m));
}

// Catalogue projection intact iff it equals the pristine site projection.
function catalogueProjectionIntact(dir) {
  let loaded;
  try { loaded = loadAndValidateCatalogue(dir); } catch (e) { return false; }
  const projected = loaded.serialize.serializeSolverExamples(loaded.catalogue);
  const site = loadAndValidateCatalogue(SITE);
  return projected === site.serialize.serializeSolverExamples(site.catalogue);
}

function mutateExamplesOnly(dir) {
  const catFile = path.join(dir, CAT_REL, 'catalogue.js');
  const src = fs.readFileSync(catFile, 'utf8');
  const mutated = src.replace('"objective": 1760', '"objective": 1761');
  if (mutated === src) throw new Error('e1-sep: could not find objective 1760');
  fs.writeFileSync(catFile, mutated);
}
function mutateEngineSlice(dir) {
  const engFile = path.join(dir, ENG_DIR, CANON);
  const src = fs.readFileSync(engFile, 'utf8');
  // Append a single harmless comment byte-change to the canonical engine source.
  fs.writeFileSync(engFile, src + '\n/* e1-sep mutation */\n');
}
function mutateUiOutsideExamples(dir) {
  const solverFile = path.join(dir, 'solver.html');
  const src = fs.readFileSync(solverFile, 'utf8');
  const mutated = src.replace('<title>', '<title data-mutated="1">');
  if (mutated === src) throw new Error('e1-sep: could not find <title>');
  fs.writeFileSync(solverFile, mutated);
}

// S0: clean tree — E1 green and projection intact.
(function () {
  const dir = makeTree();
  ok('S0 clean tree: E1 passes', e1Passes(dir));
  ok('S0 clean tree: catalogue projection intact', catalogueProjectionIntact(dir));
})();

// A: EXAMPLES-only mutation.
(function () {
  const dir = makeTree();
  mutateExamplesOnly(dir);
  ok('A EXAMPLES-only: E1 canonical composed contract stays GREEN', e1Passes(dir) === true);
  ok('A EXAMPLES-only: catalogue projection FAILS', catalogueProjectionIntact(dir) === false);
})();

// B: engine_slice mutation.
(function () {
  const dir = makeTree();
  mutateEngineSlice(dir);
  ok('B engine_slice: E1 raw engine contract FAILS', e1FailsOnEngine(dir) === true);
})();

// C: protected non-catalogue UI mutation outside EXAMPLES.
(function () {
  const dir = makeTree();
  mutateUiOutsideExamples(dir);
  ok('C UI-outside-EXAMPLES: E1 composed contract FAILS', e1FailsOnComposed(dir) === true);
  ok('C UI-outside-EXAMPLES: catalogue projection still intact', catalogueProjectionIntact(dir) === true);
})();

// D: combined EXAMPLES + engine_slice mutation.
(function () {
  const dir = makeTree();
  mutateExamplesOnly(dir);
  mutateEngineSlice(dir);
  ok('D both: catalogue projection FAILS', catalogueProjectionIntact(dir) === false);
  ok('D both: E1 raw engine contract FAILS', e1FailsOnEngine(dir) === true);
})();

console.log('CANONICAL ENGINE SOURCE (E1) SEPARATION  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
