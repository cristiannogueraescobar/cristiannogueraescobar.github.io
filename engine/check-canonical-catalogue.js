/* Checkpoint F1.23 — the ONE reusable checker for the canonical example catalogue.
 *
 * checkCanonicalExampleCatalogue(siteDir) validates, from a single entry point, that
 * the catalogue and all its projections are intact and faithful for the given tree.
 * It reuses the per-gate guards (i18n, examples-data, examples-page, home/caps) and
 * the generator's staleness check rather than re-implementing them, and it never
 * re-implements the engine. Returns { pass, fail, failures }.
 *
 * Designed to run from temp trees and paths with spaces; it loads the catalogue via
 * loadAndValidateCatalogue (schema-validated, per-tree cache) and touches no dist.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function checkCanonicalExampleCatalogue(siteDir) {
  const failures = [];
  let pass = 0;
  function ok(name, cond, detail) { if (cond) pass++; else failures.push(name + (detail ? ' — ' + detail : '')); }

  // 1. Catalogue exists + schema-valid (single validated entry).
  let loaded;
  try {
    loaded = require(path.resolve(siteDir, 'src', 'shared', 'examples', 'index.js')).loadAndValidateCatalogue(siteDir);
    ok('catalogue loads and validates', true);
  } catch (e) {
    return { pass: 0, fail: 1, failures: ['catalogue load/validate threw: ' + e.message] };
  }
  const { catalogue, serialize, schema } = loaded;

  // 2. Unique keys + slugs; historical nine are the immutable canonical PREFIX (in order). This
  //    checker is count-agnostic (generic infra reused by every catalogue size); it does NOT pin a
  //    total — the F7a checkpoint (tests_canonical_catalogue_positive) owns the exact 24.
  ok('at least the historical nine', catalogue.length >= 9, 'count=' + catalogue.length);
  const keys = catalogue.map(r => r.key);
  const slugs = catalogue.map(r => r.slug);
  ok('unique keys', new Set(keys).size === keys.length);
  ok('unique slugs', new Set(slugs).size === slugs.length);
  const HISTORICAL_ORDER = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier'];
  ok('historical nine are the canonical prefix, in order',
    JSON.stringify(keys.slice(0, 9)) === JSON.stringify(HISTORICAL_ORDER));

  // 3. Five languages, non-empty title + desc per record.
  const LANGS = ['en', 'es', 'pt', 'de', 'fr'];
  catalogue.forEach(rec => {
    LANGS.forEach(l => {
      const t = rec.translations[l];
      ok(rec.key + ' has ' + l + ' title/desc', t && t.title && t.desc);
    });
  });

  // 4. Model + expected present; no pinned variable values.
  catalogue.forEach(rec => {
    ok(rec.key + ' has grid', Array.isArray(rec.model.grid) && rec.model.grid.length > 0);
    ok(rec.key + ' expected has status/modelType/objective',
      rec.expected && rec.expected.status && rec.expected.modelType && typeof rec.expected.objective === 'number');
    ok(rec.key + ' expected has no variable values', !('values' in rec.expected) && !('variables' in rec.expected));
  });

  // 5. Solver EXAMPLES projection is a single well-formed object (count-agnostic). The exact byte
  //    total is pinned by the F7a checkpoint, not by this reusable checker.
  const solverEx = serialize.serializeSolverExamples(catalogue);
  ok('solver EXAMPLES projection is a single object',
    (solverEx.match(/var EXAMPLES=\{/g) || []).length === 1, 'bytes=' + Buffer.byteLength(solverEx, 'utf8'));

  // 6. Projection guards (reused, not re-implemented).
  try {
    const i18n = require('../engine/tests_examples_i18n_projection.js');
    ok('i18n projection faithful', i18n.checkI18nProjection(siteDir).ok);
  } catch (e) { ok('i18n projection faithful', false, e.message); }
  try {
    const ed = require('../engine/tests_examples_data_projection.js');
    ok('examples-data projection faithful', ed.checkExamplesDataProjection(siteDir).ok);
  } catch (e) { ok('examples-data projection faithful', false, e.message); }
  try {
    const ep = require('../engine/tests_examples_page_projection.js');
    ok('examples.html projection faithful', ep.checkExamplesPageProjection(siteDir).ok);
  } catch (e) { ok('examples.html projection faithful', false, e.message); }
  try {
    const hc = require('../engine/tests_home_capabilities_refs.js');
    ok('home + capabilities refs faithful', hc.checkHomeAndCapabilities(siteDir).ok);
  } catch (e) { ok('home + capabilities refs faithful', false, e.message); }

  // 7. Generator staleness (no writes).
  try {
    const gen = require('../engine/generate-examples.js');
    const r = gen.run(siteDir, { check: true });
    ok('all projections up to date (generator --check)', r.ok, (r.changed || []).join(', '));
  } catch (e) { ok('all projections up to date (generator --check)', false, e.message); }

  // 8. Internal catalogue NOT published (no dist copy). Only checked when a dist tree
  //    exists next to siteDir; absence of dist is fine (checker is dist-independent).
  const distExamples = path.join(siteDir, 'dist', 'src', 'shared', 'examples');
  ok('catalogue not published to dist', !fs.existsSync(distExamples));

  // 9. Fixture parity: the pinned F1 fixture is the HISTORICAL authority for the original examples
  //    (F1 captured 9). The catalogue grows append-only, so the fixture must still match the live
  //    projection as an immutable PREFIX — the first fx.catalogue.example_count records — never the
  //    whole (grown) catalogue. The checker reads the fixture, never regenerates it.
  const fixturePath = path.join(siteDir, 'engine', 'fixtures', 'product', 'example-catalogue-f1.json');
  if (fs.existsSync(fixturePath)) {
    let fx;
    try { fx = JSON.parse(fs.readFileSync(fixturePath, 'utf8')); } catch (e) { fx = null; }
    if (!fx) { ok('fixture parses', false); }
    else {
      const n = fx.catalogue.example_count;
      ok('fixture count is a historical prefix (<= live count)', n <= catalogue.length, n + ' vs ' + catalogue.length);
      ok('fixture keys/slugs match the live prefix',
        JSON.stringify(fx.examples.map(e => e.key)) === JSON.stringify(keys.slice(0, n)) &&
        JSON.stringify(fx.examples.map(e => e.slug)) === JSON.stringify(slugs.slice(0, n)));
      const expOk = fx.examples.every((e, i) => {
        const r = catalogue[i];
        return e.expected.status === r.expected.status && e.expected.modelType === r.expected.modelType &&
          e.expected.objective === r.expected.objective &&
          (e.expected.tolerance === undefined ? r.expected.tolerance === undefined : e.expected.tolerance === r.expected.tolerance);
      });
      ok('fixture expected contracts match the live prefix', expOk);
      // The fixture's solver projection byte total is the HISTORICAL prefix projection; compare it to
      // the projection of just the first n records, not the grown catalogue.
      const prefixSolverEx = serialize.serializeSolverExamples(catalogue.slice(0, n));
      ok('fixture solver projection bytes match the historical prefix',
        fx.projections.solver_examples.bytes === Buffer.byteLength(prefixSolverEx, 'utf8'),
        fx.projections.solver_examples.bytes + ' vs ' + Buffer.byteLength(prefixSolverEx, 'utf8'));
      ok('fixture public invariants unchanged (requests + languages)', fx.public_output.requests === 6 && fx.public_output.languages === 5);
      ok('fixture policy: catalogue not published', fx.policy.catalogue_published_to_dist === false);
    }
  }

  return { pass: pass, fail: failures.length, failures: failures };
}

module.exports = { checkCanonicalExampleCatalogue: checkCanonicalExampleCatalogue };
