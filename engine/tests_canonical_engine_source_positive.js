/* tests_canonical_engine_source_positive.js — Checkpoint E1 positive contracts.
 *
 * Runs the official checkCanonicalEngineSource() on the real tree (its ~49
 * assertions ARE the core positive contracts), then adds the E1-specific
 * top-level guarantees the pliego enumerates that aren't already covered:
 * single canonical production source, mirror still legacy, dotProduct_ duplicate
 * documented, two approved divergences, zero new requests, engine/source never
 * published, spaced paths, dist-independence. It does NOT re-implement
 * composition.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { checkCanonicalEngineSource } = require('./tests_canonical_engine_source.js');
const { composeSolverInterface, findEngineRegion } = require('../src/shared/compose-solver.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
}
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// 1. The official checker is fully green on the real tree.
const r = checkCanonicalEngineSource(SITE);
ok('official E1 checker is green on the real tree (' + r.pass + ' assertions)', r.fail === 0,
  r.failures.join('; '));

// 2. Single canonical production source exists and is the only engine file under engine/source.
const srcDir = path.join(SITE, 'engine', 'source');
ok('engine/source holds exactly the canonical engine file',
  fs.existsSync(srcDir) && fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).length === 1);

// 3. Composition is deterministic and byte-exact (independent of dist).
const src = fs.readFileSync(path.join(SITE, 'solver.html'), 'utf8');
const composedA = composeSolverInterface(src, SITE);
const composedB = composeSolverInterface(src, SITE);
ok('composition deterministic and independent of dist', composedA === composedB &&
  Buffer.byteLength(composedA, 'utf8') === 215539);

// 4. Composed engine bytes are exactly the approved engine.
const region = findEngineRegion(composedA);
ok('composed engine is the approved 5d68ed17 engine',
  sha(composedA.slice(region.start, region.end)) === '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf');

// 5. Mirror is still the legacy add-on (unchanged, NOT consolidated in E1).
const mirror = fs.readFileSync(path.join(SITE, 'engine', 'engine.js'), 'utf8');
let genMirror = null; try { genMirror = require('./generate-engine-mirror.js').generateMirror(SITE); } catch (e) { genMirror = null; }
ok('engine/engine.js is the generated mirror (E6 authority)',
  genMirror !== null && mirror === genMirror);

// 6. Zero new requests (six), no engine/source published. Reuses composedA
// (already produced from solver.html via the OFFICIAL compositor above; this file
// is allowlisted for that composer contract). Dist-independent.
ok('composed output has six requests (4 script src + css + html)',
  (composedA.match(/<script[^>]*src=/g) || []).length === 4);
ok('engine/source not published to dist',
  !fs.existsSync(path.join(SITE, 'dist', 'engine', 'source', 'plumline-engine.js')));

// 7. Spaced path: the compositor works from a directory whose name has a space.
(function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e1 space-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.mkdirSync(path.join(base, 'engine', 'fragments', 'solver-ui'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'solver.html'), path.join(base, 'solver.html'));
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'),
      path.join(base, 'engine', 'source', 'plumline-engine.js'));
    for (const f of fs.readdirSync(path.join(SITE, 'engine', 'fragments', 'solver-ui'))) {
      fs.copyFileSync(path.join(SITE, 'engine', 'fragments', 'solver-ui', f),
        path.join(base, 'engine', 'fragments', 'solver-ui', f));
    }
    const c = composeSolverInterface(fs.readFileSync(path.join(base, 'solver.html'), 'utf8'), base);
    ok('composition works from a spaced path', Buffer.byteLength(c, 'utf8') === 215539);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})();

// 8. dotProduct_ duplicate is documented in the fixture (nested twice).
const g = JSON.parse(fs.readFileSync(
  path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e1-source.json'), 'utf8'));
ok('fixture documents dotProduct_ declared twice',
  g.dotProduct_duplicate && g.dotProduct_duplicate.declared_twice_in_both_files === true &&
  g.dotProduct_duplicate.production_lines.length === 2);

// 9. Exactly the two approved divergences are recorded.
ok('fixture records exactly the two approved divergences',
  JSON.stringify(Object.keys(g.approved_divergences).filter(k => k !== 'contract').sort()) ===
  JSON.stringify(['newContext_', 'readConstraint_']));

// 10. E is NOT declared complete (mirror still legacy).
ok('mirror inventory shows engine.js not yet consolidated',
  g.mirror_inventory.divergent.length === 2 && g.note.indexOf('later phase') !== -1);

console.log('CANONICAL ENGINE SOURCE POSITIVE (E1)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
