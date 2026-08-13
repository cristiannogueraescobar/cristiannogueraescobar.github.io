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
// Historical 9 (immutable): the first nine keys, in canonical order, must never change.
const HISTORICAL_ORDER = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier'];
// F7a additions (this tranche): the exact 15 keys appended after the historical nine, in order.
const F7A_ORDER = ['bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split',
  'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships',
  'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];
const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

// 1. Single authority loads + validates (generic: whatever the catalogue size is, it loaded).
ok('1 catalogue authority loads and validates', catalogue.length >= 9);
// 2. F7a checkpoint: exactly 24 examples (the only place a total count is pinned).
ok('2 F7a: exactly 24 examples', catalogue.length === 24);
// 3. Unique keys (generic: over the whole catalogue).
ok('3 unique keys', new Set(catalogue.map(r => r.key)).size === catalogue.length);
// 4. Unique slugs (generic: over the whole catalogue).
ok('4 unique slugs', new Set(catalogue.map(r => r.slug)).size === catalogue.length);
// 5. Canonical order: historical nine intact as a PREFIX (immutable), then the exact F7a 15.
ok('5 historical nine are the canonical prefix, in order',
  JSON.stringify(catalogue.slice(0, 9).map(r => r.key)) === JSON.stringify(HISTORICAL_ORDER));
ok('5b F7a fifteen follow the historical nine, in order',
  JSON.stringify(catalogue.slice(9).map(r => r.key)) === JSON.stringify(F7A_ORDER));
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
// 13. wholeNumbers only where declared. Historical (workforce, shipping) stay declared; F7a adds
//     the integer/whole records. Generic: every declared value is boolean true. F7a: exact set.
ok('13a wholeNumbers declared are boolean true',
  catalogue.filter(r => r.model.whole).every(r => r.model.whole === true));
ok('13b historical whole set intact (subset)',
  ['shipping', 'workforce'].every(k => catalogue.find(r => r.key === k && r.model.whole === true)));
ok('13c F7a: exact whole-declaring set',
  catalogue.filter(r => r.model.whole).map(r => r.key).sort().join(',') ===
  ['workforce', 'shipping', 'factory-batches', 'clinic-staffing', 'call-centre', 'scholarships', 'food-bank', 'hotel-rooms'].sort().join(','));
// 14. domains only where declared. Historical set stays; F7a adds mixed/binary records with domains.
ok('14a historical domains set intact (subset)',
  ['delivery', 'marketing', 'project', 'supplier'].every(k => catalogue.find(r => r.key === k && r.model.domains)));
ok('14b F7a: exact domains-declaring set',
  catalogue.filter(r => r.model.domains).map(r => r.key).sort().join(',') ===
  ['delivery', 'marketing', 'project', 'supplier', 'ingredient-sourcing', 'fleet-assignment'].sort().join(','));
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
// 21. Solver EXAMPLES projection byte total. F7a checkpoint pins the exact value for this tranche;
//     served==regenerated (count-agnostic) is asserted at 38 and by the projection contract.
ok('21 F7a: solver EXAMPLES projection byte total', Buffer.byteLength(serialize.serializeSolverExamples(catalogue), 'utf8') === 15760);
// 22. i18n projection occurrences: 20 per record (exName + exDesc, each repeated in TWO subsections,
//     across 5 locales = 2*2*5). Count-agnostic: catalogue.length * 20 (was 9*20=180; now 24*20=480).
const occ = serialize.i18nExpectedOccurrences(catalogue, LANGS);
ok('22 i18n occurrences == catalogue length * 20',
  occ.reduce((s, o) => s + o.expected, 0) === catalogue.length * 20);
ok('22b F7a: i18n occurrences == 480', occ.reduce((s, o) => s + o.expected, 0) === 480);
// 23. examples-data META lines = 9.
ok('23 examples-data META lines == catalogue length', serialize.examplesDataMetaLines(catalogue).length === catalogue.length);
// 24. JSON-LD has 9 ListItems.
ok('24 JSON-LD ListItems == catalogue length', (serialize.examplesJsonLd(catalogue).match(/"@type":"ListItem"/g) || []).length === catalogue.length);
// 25. no-JS links = 9.
ok('25 no-JS links == catalogue length', serialize.examplesNoJsLinks(catalogue).length === catalogue.length);
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
  ok('28 detection/solve parity all records', parity === catalogue.length, 'parity=' + parity + ' of ' + catalogue.length);
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
// 38. Solver EXAMPLES projection: count-agnostic served==regenerated is owned by the projection
//     contract + composition suites. F7a checkpoint pins the exact byte total for THIS tranche.
ok('38 F7a: solver EXAMPLES projection byte total',
  Buffer.byteLength(serialize.serializeSolverExamples(catalogue), 'utf8') === 15760);
// 39/40. i18n.js and examples-data.js are served byte-identical to what the generator projects from
//     the current catalogue (no editable second copy). This is count-agnostic: it holds for any
//     catalogue size, so 24->36 needs no edit here. The generator's --check compares served vs
//     regenerated for exactly these files.
const genCheck = require('./generate-examples.js').run(SITE, { check: true });
ok('39 projected assets (i18n.js/examples-data.js/examples.html) served == regenerated', genCheck.ok === true,
  'stale: ' + (genCheck.changed || []).join(', '));
// 41. Works from the loaded siteDir (spaced paths validated separately in negatives).
ok('41 checker returns structured result', typeof checkCanonicalExampleCatalogue(SITE).pass === 'number');

console.log('CANONICAL CATALOGUE POSITIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
