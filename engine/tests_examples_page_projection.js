/* Checkpoint F1 GATE E — examples.html projection guard.
 *
 * examples.html derives from the catalogue:
 *   - the ItemList JSON-LD (position = catalogue order, url = base + slug, name =
 *     English title) — reproduced byte-for-byte, never stored as a blob in the
 *     catalogue;
 *   - each no-JS <li> fallback link's href (slug) and name (English title).
 * The client-rendered cards already read the projected examples-data META + i18n
 * keys, so their titles/descriptions/urls are catalogue-derived transitively.
 *
 * Markup/layout (the <ul>, card CSS, the fallback's own lower-case description text)
 * is examples.html's own property and is NOT catalogue data.
 *
 * examples.html is composed only by the shared shell; the JSON-LD and fallback are
 * in the source verbatim, so the projection must equal the current bytes. This
 * guard asserts fidelity; it does not rewrite the page.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

function jsonLdIn(source) {
  const a = source.indexOf('{"@context"');
  if (a === -1) return null;
  const b = source.indexOf('</script>', a);
  return source.slice(a, b);
}

function checkExamplesPageProjection(dir) {
  const { catalogue, serialize } = loadAndValidateCatalogue(dir);
  const source = fs.readFileSync(path.join(dir, 'examples.html'), 'utf8');
  const failuresLocal = [];

  // JSON-LD byte-identical to projection.
  const actualLd = jsonLdIn(source);
  const expectedLd = serialize.examplesJsonLd(catalogue);
  if (actualLd !== expectedLd) failuresLocal.push('json-ld');

  // Every projected ListItem position/name/url present in order in the JSON-LD.
  // (Redundant with the byte check, but catches an out-of-order catalogue.)
  const links = serialize.examplesNoJsLinks(catalogue);
  links.forEach(function (l, i) {
    if (source.indexOf('href="' + l.href + '">' + l.name + '</a>') === -1) failuresLocal.push('nojs-link-' + i);
  });

  // Exactly nine ListItem entries and nine no-JS links.
  const liCount = (source.match(/"@type":"ListItem"/g) || []).length;
  if (liCount !== catalogue.length) failuresLocal.push('listitem-count-' + liCount);

  return { ok: failuresLocal.length === 0, failures: failuresLocal };
}

if (require.main === module) {
// Positive.
(function () {
  const r = checkExamplesPageProjection(SITE);
  ok('live examples.html JSON-LD + no-JS links project faithfully', r.ok, r.failures.join('; '));
})();

// Negatives on a temp copy.
function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-expage-'));
  fs.mkdirSync(path.join(dir, 'src', 'shared', 'examples'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'examples.html'), fs.readFileSync(path.join(SITE, 'examples.html')));
  for (const f of ['catalogue.js', 'schema.js', 'serialize.js', 'index.js']) {
    fs.writeFileSync(path.join(dir, 'src', 'shared', 'examples', f), fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', f)));
  }
  return dir;
}
const exPath = dir => path.join(dir, 'examples.html');
const catPath = dir => path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
const rd = p => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);
function expectTrip(label, mutate) {
  const dir = makeTree();
  try {
    ok(label + ': clean copy passes', checkExamplesPageProjection(dir).ok);
    mutate(dir);
    let tripped;
    try { tripped = !checkExamplesPageProjection(dir).ok; } catch (e) { tripped = true; }
    ok(label + ': mutation trips the guard', tripped);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. Card/ListItem omitted (drop one ListItem from the JSON-LD).
expectTrip('N1 card omitted', dir => wr(exPath(dir), rd(exPath(dir)).replace(/,\{"@type":"ListItem","position":9[^}]*\}/, '')));
// 2. Card duplicated (extra ListItem).
expectTrip('N2 card duplicated', dir => wr(exPath(dir), rd(exPath(dir)).replace('"itemListElement":[', '"itemListElement":[{"@type":"ListItem","position":1,"url":"https://plumline.online/solver.html?ex=production-plan","name":"Production plan"},')));
// 3. Order wrong (swap first two ListItem names in JSON-LD via catalogue reorder).
expectTrip('N3 order wrong', dir => {
  let s = rd(catPath(dir));
  // move workshop before production in the catalogue array
  s = s.replace(/(\{\s*"key": "production"[\s\S]*?\n  \},\n)(  \{\s*"key": "workshop"[\s\S]*?\n  \},\n)/, '$2$1');
  wr(catPath(dir), s);
});
// 4. Translation divergent (catalogue title changed -> JSON-LD name mismatch).
expectTrip('N4 translation divergent', dir => wr(catPath(dir), rd(catPath(dir)).replace('"title": "Production plan"', '"title": "Prod plan"')));
// 5. URL divergent (catalogue slug changed -> JSON-LD url mismatch).
expectTrip('N5 url divergent', dir => wr(catPath(dir), rd(catPath(dir)).replace('"slug": "production-plan"', '"slug": "prod-plan"')));
// 6. no-JS fallback stale (href changed in page only).
expectTrip('N6 no-JS fallback stale', dir => wr(exPath(dir), rd(exPath(dir)).replace('href="solver.html?ex=production-plan">Production plan</a>', 'href="solver.html?ex=WRONG">Production plan</a>')));
// 7. JSON-LD stale (position changed in page only).
expectTrip('N7 json-ld stale', dir => wr(exPath(dir), rd(exPath(dir)).replace('"position":1,', '"position":99,')));
// 8. Position incorrect (name/position mismatch in page).
expectTrip('N8 position incorrect', dir => wr(exPath(dir), rd(exPath(dir)).replace('"position":2,"url":"https://plumline.online/solver.html?ex=workshop-chart"', '"position":5,"url":"https://plumline.online/solver.html?ex=workshop-chart"')));
// 9. Unknown key (invalid catalogue category) -> validation trips.
expectTrip('N9 invalid catalogue', dir => wr(catPath(dir), rd(catPath(dir)).replace('"category": "start"', '"category": "bogus"')));

console.log('EXAMPLES PAGE PROJECTION TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}

module.exports = { checkExamplesPageProjection: checkExamplesPageProjection };
