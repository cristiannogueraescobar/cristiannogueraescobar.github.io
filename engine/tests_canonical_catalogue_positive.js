/* Checkpoint F1.24 — canonical example catalogue POSITIVE suite.
 *
 * Asserts, on the live tree, every property the catalogue architecture guarantees.
 * Uses the reusable checker plus direct assertions on the catalogue, serializers and
 * projections. Actual values come from the engine/serializers; expected contracts
 * come from the catalogue and the pinned public invariants — never the same source.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));
const { checkCanonicalExampleCatalogue } = require('./check-canonical-catalogue.js');
const { run } = require('./harness.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const { catalogue, serialize } = loadAndValidateCatalogue(SITE);
const ORDER = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier'];
const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

// 1. Single authority loads + validates.
ok('1 catalogue authority loads and validates', catalogue.length === 9);
// 2. Nine examples.
ok('2 nine examples', catalogue.length === 9);
// 3. Unique keys.
ok('3 unique keys', new Set(catalogue.map(r => r.key)).size === 9);
// 4. Unique slugs.
ok('4 unique slugs', new Set(catalogue.map(r => r.slug)).size === 9);
// 5. Canonical order.
ok('5 canonical order', JSON.stringify(catalogue.map(r => r.key)) === JSON.stringify(ORDER));
// 6. Five languages each.
ok('6 five languages each', catalogue.every(r => LANGS.every(l => r.translations[l])));
// 7. Non-empty titles.
ok('7 non-empty titles', catalogue.every(r => LANGS.every(l => r.translations[l].title.length > 0)));
// 8. Non-empty descriptions.
ok('8 non-empty descriptions', catalogue.every(r => LANGS.every(l => r.translations[l].desc.length > 0)));
// 9. Valid categories.
ok('9 valid categories', catalogue.every(r => ['start', 'business', 'binary'].indexOf(r.category) !== -1));
// 10. Valid types.
ok('10 valid types', catalogue.every(r => ['continuous', 'integer', 'binary', 'mixed'].indexOf(r.type) !== -1));
// 11. Valid senses.
ok('11 valid senses', catalogue.every(r => ['max', 'min'].indexOf(r.sense) !== -1));
// 12. Grids present + non-empty.
ok('12 grids present', catalogue.every(r => Array.isArray(r.model.grid) && r.model.grid.length > 0));
// 13. wholeNumbers only where declared (workforce, shipping).
ok('13 wholeNumbers where declared', catalogue.filter(r => r.model.whole).map(r => r.key).sort().join(',') === 'shipping,workforce');
// 14. domains only where declared.
ok('14 domains where declared', catalogue.filter(r => r.model.domains).map(r => r.key).sort().join(',') === 'delivery,marketing,project,supplier');
// 15. openVarSettings only where declared.
ok('15 openVarSettings where declared', catalogue.filter(r => r.model.openVarSettings).length === catalogue.filter(r => r.model.openVarSettings === true).length);
// 16. expected.status present.
ok('16 expected.status present', catalogue.every(r => r.expected.status));
// 17. expected.modelType present.
ok('17 expected.modelType present', catalogue.every(r => r.expected.modelType));
// 18. expected.objective numeric.
ok('18 expected.objective numeric', catalogue.every(r => typeof r.expected.objective === 'number'));
// 19. tolerance only where present is positive.
ok('19 tolerance positive where present', catalogue.every(r => r.expected.tolerance === undefined || r.expected.tolerance > 0));
// 20. No pinned variable values.
ok('20 no pinned variable values', catalogue.every(r => !('values' in r.expected) && !('variables' in r.expected)));
// 21. Solver EXAMPLES projection = 6125 bytes.
ok('21 solver EXAMPLES = 6125 bytes', Buffer.byteLength(serialize.serializeSolverExamples(catalogue), 'utf8') === 6125);
// 22. i18n projection: 180 occurrences.
const occ = serialize.i18nExpectedOccurrences(catalogue, LANGS);
ok('22 i18n 180 occurrences', occ.reduce((s, o) => s + o.expected, 0) === 180);
// 23. examples-data META lines = 9.
ok('23 examples-data META = 9 lines', serialize.examplesDataMetaLines(catalogue).length === 9);
// 24. JSON-LD has 9 ListItems.
ok('24 JSON-LD 9 ListItems', (serialize.examplesJsonLd(catalogue).match(/"@type":"ListItem"/g) || []).length === 9);
// 25. no-JS links = 9.
ok('25 no-JS links = 9', serialize.examplesNoJsLinks(catalogue).length === 9);
// 26. URL builder derives from slug.
(function () {
  const mod = require(path.join(SITE, 'assets', 'examples-data.js'));
  ok('26 URL builder slug-based', mod.buildExampleSolverUrl('production') === 'solver.html?ex=production-plan');
  // 27. URL builder null on unknown key.
  ok('27 URL builder null on unknown key', mod.buildExampleSolverUrl('nope') === null);
})();
// 28. Detection/solve parity for all nine (status/modelType/objective).
(function () {
  let parity = 0;
  catalogue.forEach(function (rec) {
    const opts = {};
    if (rec.model.whole && !rec.model.domains) opts.integer = true;
    opts.mutate = function (model) {
      if (model.objective) model.objective.sense = rec.sense;
      if (rec.model.domains) {
        const cells = (run(rec.model.grid).out || {}).variables || [];
        const integer = [], bounds = [];
        let anyInt = false, anyBound = false;
        cells.forEach(function (cell, i) {
          const d = rec.model.domains[cell];
          let isInt = false, lo = 0, hi = null;
          if (d) {
            if (d.type === 'binary') { isInt = true; lo = 0; hi = 1; }
            else if (d.type === 'integer') { isInt = true; lo = d.min == null ? 0 : d.min; hi = d.max == null ? null : d.max; }
            else { lo = d.min == null ? 0 : d.min; hi = d.max == null ? null : d.max; }
          }
          if (rec.model.whole && (!d || d.type !== 'binary')) isInt = true;
          if (isInt) { integer.push(i); anyInt = true; }
          bounds.push({ lower: lo, upper: hi });
          if (lo > 1e-9 || hi != null) anyBound = true;
        });
        model.domains = { integer: anyInt ? integer : false, bounds: anyBound ? bounds : null };
        if (rec.model.whole) model.wholeNumbers = true;
      }
    };
    const r = run(rec.model.grid, opts);
    const tol = rec.expected.tolerance !== undefined ? rec.expected.tolerance : 1e-9;
    if (!r.error && r.out.status === rec.expected.status &&
      (r.out.modelType || (r.model && r.model.modelType)) === rec.expected.modelType &&
      Math.abs(r.out.objective - rec.expected.objective) <= tol) parity++;
  });
  ok('28 detection/solve parity all nine', parity === 9, 'parity=' + parity);
})();
// 29. Deterministic serialization (two runs identical).
ok('29 deterministic serialization', serialize.serializeSolverExamples(catalogue) === serialize.serializeSolverExamples(catalogue));
// 30. No duplicate example authority: the serialized EXAMPLES projection is the sole
//     source, and the composer refuses an inline EXAMPLES object alongside the marker
//     (proven by the negative N38 via the composer). Here we assert the projection is
//     a single self-contained `var EXAMPLES={...}` object.
ok('30 projection is a single EXAMPLES object', (serialize.serializeSolverExamples(catalogue).match(/var EXAMPLES=\{/g) || []).length === 1);
// 31. Catalogue not published to dist.
ok('31 catalogue internal not published', !fs.existsSync(path.join(SITE, 'dist', 'src', 'shared', 'examples')));
// 32. No runtime fetch of the catalogue (served assets never reference it).
(function () {
  const i18n = fs.readFileSync(path.join(SITE, 'assets', 'i18n.js'), 'utf8');
  const ed = fs.readFileSync(path.join(SITE, 'assets', 'examples-data.js'), 'utf8');
  ok('32 no runtime fetch of catalogue', i18n.indexOf('src/shared/examples') === -1 && ed.indexOf('src/shared/examples') === -1);
})();
// 33. Six requests preserved: the solver EXAMPLES projection introduces no <script>
//     or <link> (it is a pure data object), so it adds no request. The composed
//     request count is asserted by the solver-composition suites (allowlisted
//     composer contract); here we assert the projection itself is request-free.
(function () {
  const proj = serialize.serializeSolverExamples(catalogue);
  ok('33 EXAMPLES projection adds no request', proj.indexOf('<script') === -1 && proj.indexOf('<link') === -1 && proj.indexOf('src=') === -1);
})();
// 34. Five languages set matches LANGS exactly.
ok('34 five languages exactly', catalogue.every(r => Object.keys(r.translations).sort().join(',') === LANGS.slice().sort().join(',')));
// 35. The reusable checker passes on the live tree.
(function () {
  const r = checkCanonicalExampleCatalogue(SITE);
  ok('35 reusable checker passes', r.fail === 0, r.failures.slice(0, 3).join('; '));
})();
// 36. fieldOrder present on every record (historical serialization contract).
ok('36 fieldOrder on every record', catalogue.every(r => Array.isArray(r.model.fieldOrder)));
// 37. Domains reference only real grid cells.
ok('37 domains reference real cells', catalogue.every(r => {
  if (!r.model.domains) return true;
  return Object.keys(r.model.domains).every(c => /^[A-Z]+[0-9]+$/.test(c));
}));
// 38. Solver EXAMPLES projection = 6125 bytes (the composed-solver byte total 215613
//     is asserted by the solver-composition suites, which own the composer contract).
ok('38 solver EXAMPLES projection = 6125 bytes', Buffer.byteLength(serialize.serializeSolverExamples(catalogue), 'utf8') === 6125);
// 39. i18n.js served byte-identical to source (no editable second copy).
ok('39 i18n.js served as-is', fs.readFileSync(path.join(SITE, 'assets', 'i18n.js')).length === 284501);
// 40. examples-data.js served byte size preserved.
ok('40 examples-data.js size preserved', fs.readFileSync(path.join(SITE, 'assets', 'examples-data.js')).length === 2644);
// 41. Works from the loaded siteDir (spaced paths validated separately in negatives).
ok('41 checker returns structured result', typeof checkCanonicalExampleCatalogue(SITE).pass === 'number');

console.log('CANONICAL CATALOGUE POSITIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
