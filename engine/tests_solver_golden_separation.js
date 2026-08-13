/* tests_solver_golden_separation.js — separation contract for the F7a count-agnostic migration.
 *
 * Proves the catalogue-owned region and the surrounding Solver UI are scoped SEPARATELY, not that
 * the UI golden was weakened. Three scenarios, each on an isolated temp tree:
 *
 *   1. EXAMPLES-only mutation  (change a catalogue record the solver projects):
 *        - the catalogue projection contract MUST FAIL (the projected records changed);
 *        - the canonicalised UI golden MUST PASS (the EXAMPLES region is sentinel-replaced).
 *   2. Protected-UI mutation outside EXAMPLES (change solver.html markup around the catalogue):
 *        - the canonicalised UI golden MUST FAIL.
 *   3. Both mutated:
 *        - both contracts MUST FAIL.
 *
 * The UI golden verdict comes from checkSolverGridInterface (canonical comparison). The catalogue
 * verdict comes from the projection contract's key/order invariants.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkSolverGridInterface } = require('./tests_solver_grid.js');
const { copyCatalogueTree, CAT_REL } = require('./copy-catalogue-tree.js');
const { canonicaliseSolverExamplesRegion } = require('../src/shared/solver-ui-canonical.js');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { loadAndValidateCatalogue } = require('../src/shared/examples/index.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const SITE = path.join(__dirname, '..');
const SOLVER = 'solver' + '.html';
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const GOLD_DIR = path.join('engine', 'fixtures', 'solver-ui-golden');

// Build a minimal composable tree: solver source + all fragments + engine source + catalogue tree
// + the D1 golden. Same shape the D1 negative suite uses, so checkSolverGridInterface runs on it.
function makeTree(root) {
  const dir = root || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-sep-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, GOLD_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(SITE, SOLVER), path.join(dir, SOLVER));
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'),
    path.join(dir, 'engine', 'source', 'plumline-engine.js'));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  copyCatalogueTree(SITE, dir);
  fs.copyFileSync(path.join(SITE, GOLD_DIR, 'solver-grid-d1.json'),
    path.join(dir, GOLD_DIR, 'solver-grid-d1.json'));
  return dir;
}

// The catalogue projection verdict: keys+order of the projected EXAMPLES must equal the canonical
// catalogue AND match the pristine site projection. Returns true when INTACT (contract passes).
// A catalogue that no longer loads/validates is, a fortiori, not intact.
function catalogueProjectionIntact(dir) {
  let loaded;
  try { loaded = loadAndValidateCatalogue(dir); }
  catch (e) { return false; }
  const projected = loaded.serialize.serializeSolverExamples(loaded.catalogue);
  const keys = [...projected.matchAll(/^    '?([a-zA-Z0-9_-]+)'?:\{/gm)].map(m => m[1]);
  const expected = loaded.catalogue.map(r => r.key);
  const site = loadAndValidateCatalogue(SITE);
  const siteProjected = site.serialize.serializeSolverExamples(site.catalogue);
  return projected === siteProjected && JSON.stringify(keys) === JSON.stringify(expected);
}

// The canonicalised UI verdict: compose from the temp tree, canonicalise, compare to golden.canonical.
function uiGoldenPasses(dir) {
  return checkSolverGridInterface(dir).fail === 0;
}

// Mutate a catalogue record the solver projects (an objective value inside a historical record).
function mutateExamplesOnly(dir) {
  const catFile = path.join(dir, CAT_REL, 'catalogue.js');
  const src = fs.readFileSync(catFile, 'utf8');
  // Change the first historical objective (production = 1760) to a different value. This changes the
  // projected EXAMPLES object but nothing in the surrounding UI. Whether the loader accepts or
  // rejects the change, catalogueProjectionIntact() reports it as not-intact.
  const mutated = src.replace('"objective": 1760', '"objective": 1761');
  if (mutated === src) throw new Error('separation: could not find objective 1760 to mutate');
  fs.writeFileSync(catFile, mutated);
}

// Mutate protected UI outside the EXAMPLES region (a class attribute in solver.html markup).
function mutateUiOutsideExamples(dir) {
  const solverFile = path.join(dir, SOLVER);
  const src = fs.readFileSync(solverFile, 'utf8');
  const mutated = src.replace('<title>', '<title data-mutated="1">');
  if (mutated === src) throw new Error('separation: could not find <title> to mutate');
  fs.writeFileSync(solverFile, mutated);
}

// --- Scenario 0: clean tree — both contracts pass (baseline sanity). ---
(function () {
  const dir = makeTree();
  ok('S0 clean tree: catalogue projection intact', catalogueProjectionIntact(dir));
  ok('S0 clean tree: UI golden passes', uiGoldenPasses(dir));
})();

// --- Scenario 1: EXAMPLES-only mutation. ---
(function () {
  const dir = makeTree();
  mutateExamplesOnly(dir);
  ok('S1 EXAMPLES-only: catalogue projection FAILS', catalogueProjectionIntact(dir) === false);
  ok('S1 EXAMPLES-only: canonical UI golden PASSES', uiGoldenPasses(dir) === true);
})();

// --- Scenario 2: protected-UI mutation outside EXAMPLES. ---
(function () {
  const dir = makeTree();
  mutateUiOutsideExamples(dir);
  ok('S2 UI-outside-EXAMPLES: canonical UI golden FAILS', uiGoldenPasses(dir) === false);
  // Sanity: the catalogue itself is untouched, so its projection stays intact.
  ok('S2 UI-outside-EXAMPLES: catalogue projection still intact', catalogueProjectionIntact(dir) === true);
})();

// --- Scenario 3: both mutated. ---
(function () {
  const dir = makeTree();
  mutateExamplesOnly(dir);
  mutateUiOutsideExamples(dir);
  ok('S3 both: catalogue projection FAILS', catalogueProjectionIntact(dir) === false);
  ok('S3 both: canonical UI golden FAILS', uiGoldenPasses(dir) === false);
})();

// --- Scenario 4: the canonicaliser genuinely isolates the region (direct check). ---
(function () {
  const composed = composeSolverInterface(fs.readFileSync(path.join(SITE, SOLVER), 'utf8'), SITE);
  const s = composed.indexOf('var EXAMPLES={');
  const e = composed.indexOf('\n  };', s);
  const region = composed.slice(s, e);
  // A change INSIDE the region vanishes after canonicalisation; a change OUTSIDE survives.
  const insideMut = composed.slice(0, s) + region.replace(/objective:\d+/, 'objective:0') + composed.slice(e);
  const outsideMut = composed.replace('<title>', '<title data-x="1">');
  const base = canonicaliseSolverExamplesRegion(composed);
  ok('S4 inside-region change is absorbed by canonicaliser',
    canonicaliseSolverExamplesRegion(insideMut) === base);
  ok('S4 outside-region change survives canonicaliser',
    canonicaliseSolverExamplesRegion(outsideMut) !== base);
})();

console.log('SOLVER GOLDEN SEPARATION CONTRACT  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
