/* tests_solver_examples_projection.js — Solver EXAMPLES catalogue projection contract.
 *
 * This is the AUTHORITY for the actual records the solver page projects from the canonical
 * catalogue (serializeSolverExamples). It is deliberately SEPARATE from the canonical UI golden:
 *   - the UI golden (D1-D5, canonicalised) proves the surrounding Solver interface is unchanged and
 *     is count-agnostic (the EXAMPLES region is replaced by a sentinel before hashing);
 *   - THIS contract proves the catalogue-owned region itself carries exactly the right records.
 * Separating them is what lets the UI golden stay stable across catalogue growth while the projected
 * catalogue is still fully pinned.
 *
 * Two layers:
 *   generic()  — count-agnostic invariants that hold for ANY catalogue size (9/24/36/48/60): the
 *                projection reproduces the canonical catalogue exactly, in order, uniquely, with
 *                valid fieldOrder and no manual divergence. Never hardcodes a count.
 *   f7a()      — the F7a CHECKPOINT: pins exactly 24 records, the first 9 historical keys, and the
 *                exact 15 F7a additions. This is the only place a count is asserted.
 */
'use strict';
const path = require('path');
const { loadAndValidateCatalogue } = require('../src/shared/examples/index.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const HISTORICAL_9 = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier'];
const F7A_15 = ['bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split',
  'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships',
  'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];

const VALID_FIELDS = ['grid', 'domains', 'openVarSettings', 'whole', 'expected'];

// Parse the projected `var EXAMPLES={...}` object into an ordered list of keys, and capture the
// per-record body text so we can assert structural facts without eval-ing untrusted text.
function projectedKeys(projected) {
  return [...projected.matchAll(/^    '?([a-zA-Z0-9_-]+)'?:\{/gm)].map(m => m[1]);
}

function run(rootDir) {
  rootDir = rootDir || path.join(__dirname, '..');
  const loaded = loadAndValidateCatalogue(rootDir);
  const catalogue = loaded.catalogue;
  const projected = loaded.serialize.serializeSolverExamples(catalogue);
  const keys = projectedKeys(projected);

  // ---- generic (count-agnostic) ----
  // Projection reproduces the canonical catalogue exactly, in the same order.
  ok('projection key count == catalogue length', keys.length === catalogue.length,
    keys.length + ' vs ' + catalogue.length);
  ok('projection keys == catalogue keys in order',
    JSON.stringify(keys) === JSON.stringify(catalogue.map(r => r.key)));
  // Unique keys and unique slugs.
  ok('projection keys unique', new Set(keys).size === keys.length);
  const slugs = catalogue.map(r => r.slug);
  ok('catalogue slugs unique', new Set(slugs).size === slugs.length);
  // Every record carries a valid, duplicate-free fieldOrder over known serialized fields, and the
  // model still solves-shaped (grid present). This is the serialization-only fieldOrder contract.
  catalogue.forEach(r => {
    const fo = r.model && r.model.fieldOrder;
    ok('record ' + r.key + ' has array fieldOrder', Array.isArray(fo));
    if (Array.isArray(fo)) {
      ok('record ' + r.key + ' fieldOrder has no duplicates', new Set(fo).size === fo.length);
      ok('record ' + r.key + ' fieldOrder fields all known',
        fo.every(f => VALID_FIELDS.indexOf(f) !== -1), fo.join(','));
      ok('record ' + r.key + ' fieldOrder includes grid', fo.indexOf('grid') !== -1);
    }
  });
  // No manual divergence: re-serializing the loaded catalogue is deterministic and identical.
  const projected2 = loaded.serialize.serializeSolverExamples(catalogue);
  ok('projection deterministic', projected === projected2);
  // The projection must not smuggle an unknown top-level field name into any record. We check that
  // every field label that appears at record depth is one of the known fields.
  const fieldLabels = [...projected.matchAll(/^      ([a-zA-Z]+):/gm)].map(m => m[1]);
  const unknown = fieldLabels.filter(f => VALID_FIELDS.indexOf(f) === -1 &&
    ['title', 'sense', 'modelType', 'objective', 'vars', 'lo', 'hi'].indexOf(f) === -1);
  ok('projection introduces no unknown record fields', unknown.length === 0, [...new Set(unknown)].join(','));

  return { pass, fail, failures, keys, catalogueLen: catalogue.length };
}

// ---- F7a checkpoint (the only count assertion) ----
function f7aCheckpoint(rootDir) {
  const loaded = loadAndValidateCatalogue(rootDir || path.join(__dirname, '..'));
  const keys = projectedKeys(loaded.serialize.serializeSolverExamples(loaded.catalogue));
  ok('F7a: exactly 24 projected records', keys.length === 24, 'got ' + keys.length);
  ok('F7a: first 9 are the historical keys in order',
    JSON.stringify(keys.slice(0, 9)) === JSON.stringify(HISTORICAL_9));
  ok('F7a: next 15 are the F7a additions in order',
    JSON.stringify(keys.slice(9)) === JSON.stringify(F7A_15));
}

if (require.main === module) {
  run();
  f7aCheckpoint();
  console.log('SOLVER EXAMPLES PROJECTION CONTRACT  PASSED: ' + pass + '   FAILED: ' + fail);
  if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}

module.exports = { run: run, f7aCheckpoint: f7aCheckpoint, HISTORICAL_9: HISTORICAL_9, F7A_15: F7A_15 };
