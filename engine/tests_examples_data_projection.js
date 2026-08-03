/* Checkpoint F1 GATE D — assets/examples-data.js META projection guard.
 *
 * assets/examples-data.js owns the public example metadata (key/slug/category/type/
 * sense) plus the single URL builder PL_buildExampleSolverUrl. The metadata is a
 * projection of the canonical catalogue: this guard asserts every META line is
 * exactly what the catalogue projects, and that the URL builder derives URLs from
 * the slug (never a stored full URL, never a per-record field). examples-data.js is
 * a served asset (source == dist), so it is not marked; the guard keeps it a
 * faithful, regenerable projection.
 *
 * Positive: live tree matches. Negatives: a mutated temp copy trips.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

function metaLinesIn(source) {
  return source.split('\n').filter(l => /key: .*slug: .*category:/.test(l));
}

// Core guard: the file's META block equals the catalogue projection, in order.
function checkExamplesDataProjection(dir) {
  const { catalogue, serialize } = loadAndValidateCatalogue(dir);
  const source = fs.readFileSync(path.join(dir, 'assets', 'examples-data.js'), 'utf8');
  const actual = metaLinesIn(source);
  const expected = serialize.examplesDataMetaLines(catalogue);
  const mismatches = [];
  if (actual.length !== expected.length) mismatches.push('count ' + actual.length + ' != ' + expected.length);
  const n = Math.min(actual.length, expected.length);
  for (let i = 0; i < n; i++) if (actual[i] !== expected[i]) mismatches.push('line ' + i);
  // URL builder must derive from slug and not store full URLs per record.
  const buildsFromSlug = /solver\.html\?ex=' \+ [A-Za-z_.]+\.slug/.test(source) || /\?ex=' \+ META\[i\]\.slug/.test(source);
  const noFullUrlField = !/url:\s*'solver\.html\?ex=/.test(source);
  return { ok: mismatches.length === 0 && buildsFromSlug && noFullUrlField, mismatches: mismatches, buildsFromSlug: buildsFromSlug, noFullUrlField: noFullUrlField };
}

// Behavioural check of PL_buildExampleSolverUrl using the live module.
(function () {
  const mod = require(path.join(SITE, 'assets', 'examples-data.js'));
  ok('URL builder produces slug-based URL', mod.buildExampleSolverUrl('production') === 'solver.html?ex=production-plan');
  ok('URL builder returns null for unknown key', mod.buildExampleSolverUrl('nope') === null);
  ok('global API present (META, CATEGORY_ORDER, buildExampleSolverUrl)',
    Array.isArray(mod.META) && Array.isArray(mod.CATEGORY_ORDER) && typeof mod.buildExampleSolverUrl === 'function');
})();

if (require.main === module) {
// Positive: live tree.
(function () {
  const r = checkExamplesDataProjection(SITE);
  ok('live examples-data META is a faithful projection', r.ok, r.mismatches.join('; ') + (r.buildsFromSlug ? '' : ' [url builder not slug-based]'));
})();

// Negatives.
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-exdata-'));
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'shared', 'examples'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'examples-data.js'), fs.readFileSync(path.join(SITE, 'assets', 'examples-data.js')));
  for (const f of ['catalogue.js', 'schema.js', 'serialize.js', 'index.js']) {
    fs.writeFileSync(path.join(dir, 'src', 'shared', 'examples', f), fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', f)));
  }
  return dir;
}
const edPath = dir => path.join(dir, 'assets', 'examples-data.js');
const catPath = dir => path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
const rd = p => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);
function expectTrip(label, mutate) {
  const dir = makeTree();
  try {
    ok(label + ': clean copy passes', checkExamplesDataProjection(dir).ok);
    mutate(dir);
    let tripped;
    try { tripped = !checkExamplesDataProjection(dir).ok; }
    catch (e) { tripped = true; } // validation/throw also counts as tripped
    ok(label + ': mutation trips the guard', tripped);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// N1. Metadata diverges (slug changed in examples-data.js only).
expectTrip('N1 slug changed in file', dir => wr(edPath(dir), rd(edPath(dir)).replace("slug: 'production-plan'", "slug: 'prod-plan'")));
// N2. Order changed in file.
expectTrip('N2 order changed', dir => {
  let s = rd(edPath(dir));
  s = s.replace(/(\{ key: 'production'[^\n]*\n)(\s*\{ key: 'workshop'[^\n]*\n)/, '$2$1');
  wr(edPath(dir), s);
});
// N3. type changed in catalogue only.
expectTrip('N3 type changed in catalogue', dir => wr(catPath(dir), rd(catPath(dir)).replace('"type": "continuous"', '"type": "integer"')));
// N4. sense changed in catalogue only.
expectTrip('N4 sense changed in catalogue', dir => wr(catPath(dir), rd(catPath(dir)).replace('"sense": "max"', '"sense": "min"')));
// N5. URL builder altered (stores a full URL field / not slug-based).
expectTrip('N5 url builder altered', dir => wr(edPath(dir), rd(edPath(dir)).replace("'solver.html?ex=' + META[i].slug", "'solver.html?ex=' + META[i].key")));
// N6. Invalid catalogue (empty title) fails before projecting.
expectTrip('N6 invalid catalogue', dir => wr(catPath(dir), rd(catPath(dir)).replace('"title": "Production plan"', '"title": ""')));

console.log('EXAMPLES DATA PROJECTION TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}

module.exports = { checkExamplesDataProjection: checkExamplesDataProjection };
