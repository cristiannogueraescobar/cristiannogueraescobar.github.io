/* tests_canonical_engine_source.js — Checkpoint E1 authority.
 *
 * checkCanonicalEngineSource(siteDir) -> { pass, fail, failures }
 *
 * The ONE reusable checker for the E1 canonical engine source. It validates that
 * the production engine has a single internal physical source
 * (engine/source/plumline-engine.js), that the OFFICIAL compositor rebuilds the
 * historical ENGINE_START..END region byte-identically, that direct execution
 * and the Worker consume the same engine bytes, and that engine/engine.js remains
 * a legacy mirror with exactly the two approved divergences. It uses the official
 * compositor (compose-solver.js) and never re-implements composition.
 *
 * Both the positive suite and the negatives call THIS function.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  composeSolverInterface, composeEngineSource, findEngineRegion,
  ENGINE_SOURCE_DIR, ENGINE_SOURCE_FILE,
} = require('../src/shared/compose-solver.js');
const { WORKER_GLUE } = require('./tests_engine_baseline.js');

const ENGINE_START = '/* ENGINE_START */';
const ENGINE_END = '/* ENGINE_END */';
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// Normalisation may ignore ONLY comments, whitespace and CRLF/LF. It must NOT
// ignore parameters, literals, operators, calls, returns, conditions, branch
// structure or defaults.
function normBody(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    .replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}
function extractFns(s) {
  const out = [];
  const re = /function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    let i = m.index + m[0].length - 1, depth = 0, j = i;
    for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') { depth--; if (depth === 0) { j++; break; } } }
    out.push({ name: m[1], params: m[2].trim(), body: s.slice(m.index, j) });
  }
  return out;
}
function byName(list) {
  const m = Object.create(null);
  for (const f of list) { (m[f.name] = m[f.name] || []).push(f); }
  return m;
}

const APPROVED_DIVERGENCES = ['newContext_', 'readConstraint_'];
const EXPECTED_CONSTANTS = {
  MAX_DEPTH: '40', BRANCH_NODES: '4000', BRANCH_DEPTH: '60', BRANCH_MILLIS: '20000',
  EPSILON: '1e-9', PIVOT_TOLERANCE: '1e-7', MAX_ITERATIONS: '20000',
  MAX_SCAN_COLUMNS: '4', FREE_VARIABLE_LIMIT: '50', FREE_CONSTRAINT_LIMIT: '20',
};
function constMap(s) {
  const m = Object.create(null);
  for (const x of s.matchAll(/\b([A-Z_]{3,})\s*:\s*([0-9][0-9eE.\-]*)/g)) { m[x[1]] = x[2]; }
  return m;
}

function checkCanonicalEngineSource(siteDir) {
  let pass = 0, fail = 0; const failures = [];
  function ok(name, cond, detail) {
    if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
  }

  const g = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e1-source.json'), 'utf8'));
  const fixtureRaw = fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e1-source.json'), 'utf8');
  ok('E1 fixture has no absolute path', !/(^|["\s])\/(home|Users|mnt|tmp|usr)\//.test(fixtureRaw));

  // 1. Canonical source present, internal path, LF, UTF-8, exact bytes/SHA.
  const canonRel = path.join(ENGINE_SOURCE_DIR, ENGINE_SOURCE_FILE);
  const canonAbs = path.join(siteDir, canonRel);
  ok('canonical source present', fs.existsSync(canonAbs), canonRel);
  ok('canonical source path is internal (not assets/public/dist)',
    canonRel.indexOf('assets') === -1 && canonRel.indexOf('public') === -1 &&
    canonRel.indexOf('dist') === -1 && canonRel.indexOf('..') === -1);
  let canon = fs.existsSync(canonAbs) ? fs.readFileSync(canonAbs, 'utf8') : '';
  const canonRaw = fs.existsSync(canonAbs) ? fs.readFileSync(canonAbs) : Buffer.alloc(0);
  ok('canonical source is LF only (no CRLF)', canonRaw.indexOf(Buffer.from('\r\n')) === -1);
  ok('canonical source chars == fixture', canon.length === g.canonical_source.chars, 'got ' + canon.length);
  ok('canonical source bytes == fixture', Buffer.byteLength(canon, 'utf8') === g.canonical_source.bytes_utf8,
    'got ' + Buffer.byteLength(canon, 'utf8'));
  ok('canonical source sha256 == fixture', sha(canon) === g.canonical_source.sha256, 'got ' + sha(canon));
  ok('canonical source sha256 == approved engine', sha(canon) === '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf');

  // 2. Representation B: begins with ENGINE_START, does not contain ENGINE_END.
  ok('canonical begins with ENGINE_START (representation B)', canon.indexOf(ENGINE_START) === 0);
  ok('canonical excludes ENGINE_END', canon.indexOf(ENGINE_END) === -1);

  // 3. Source markers present exactly once in solver.html SOURCE.
  const src = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
  ok('source has SOLVER_ENGINE_SOURCE_START exactly once',
    (src.split(g.source_markers.start).length - 1) === 1);
  ok('source has SOLVER_ENGINE_SOURCE_END exactly once',
    (src.split(g.source_markers.end).length - 1) === 1);
  ok('source no longer holds an inline engine region',
    src.indexOf(ENGINE_START) === -1 && src.indexOf(ENGINE_END) === -1);

  // 4. Deterministic composition via the OFFICIAL compositor.
  let composed = null, composeErr = null;
  try { composed = composeSolverInterface(src, siteDir); }
  catch (e) { composeErr = e; }
  ok('solver composes via official compositor', composeErr === null, composeErr ? composeErr.message : '');
  if (composed !== null) {
    ok('composition deterministic', composeSolverInterface(src, siteDir) === composed);
    ok('composed solver bytes == fixture', Buffer.byteLength(composed, 'utf8') === g.composed.composed_solver_bytes,
      'got ' + Buffer.byteLength(composed, 'utf8'));
    ok('composed solver sha256 == fixture', sha(composed) === g.composed.composed_solver_sha256);
  }

  // 5. findEngineRegion locates exactly one STRUCTURAL region; slice is verbatim.
  let region = null, regionErr = null;
  if (composed !== null) { try { region = findEngineRegion(composed); } catch (e) { regionErr = e; } }
  ok('findEngineRegion returns one structural region', region !== null && region.end > region.start,
    regionErr ? regionErr.message : '');
  const engine = (composed && region) ? composed.slice(region.start, region.end) : '';
  ok('composed engine slice inserted verbatim (== canonical)', engine === canon);
  ok('composed engine slice chars == 82657', engine.length === 82657, 'got ' + engine.length);
  ok('composed engine slice bytes == 82697', Buffer.byteLength(engine, 'utf8') === 82697);
  ok('composed engine slice sha256 canonical', sha(engine) === g.engine_slice.sha256);
  ok('ENGINE_START/END structural markers present in composed output',
    composed !== null && composed.indexOf(ENGINE_START) !== -1 && composed.indexOf(ENGINE_END) !== -1);

  // 6. composeEngineSource alone is a no-op-preserving step reproducing the region.
  if (composeErr === null) {
    const engineOnly = composeEngineSource(src, siteDir);
    const r2 = findEngineRegion(engineOnly);
    ok('composeEngineSource restores the engine region', r2 !== null && engineOnly.slice(r2.start, r2.end) === canon);
  }

  // 7. Direct path: the composed inline script calls detectModel_/solveModel_ in
  //    the same scope, and defines runSolve/solve/solveMainThread.
  if (composed !== null) {
    ok('direct path: runSolve present', /function runSolve\s*\(/.test(composed));
    ok('direct path: solve present', /function solve\s*\(/.test(composed));
    ok('direct path: solveMainThread fallback present', /function solveMainThread\s*\(/.test(composed));
    ok('direct path: calls detectModel_ and solveModel_', /detectModel_\s*\(/.test(composed) && /solveModel_\s*\(/.test(composed));
  }

  // 8. Worker path: engineSource slices ENGINE_START..END; glue + separator + Blob.
  const frag = fs.readFileSync(path.join(siteDir, 'engine', 'fragments', 'solver-ui', 'solve-worker-client.js'), 'utf8');
  ok('worker engineSource() slices ENGINE_START..END',
    frag.indexOf("txt.indexOf('/* ENGINE_START */')") !== -1 && frag.indexOf("txt.indexOf('/* ENGINE_END */')") !== -1);
  ok('worker glue bytes == fixture', Buffer.byteLength(WORKER_GLUE, 'utf8') === g.worker.glue_bytes);
  ok('worker glue sha256 == fixture', sha(WORKER_GLUE) === g.worker.glue_sha256);
  // Blob = engineSource + single LF + glue.
  const blob = canon + '\n' + WORKER_GLUE;
  ok('blob separator is a single LF at offset 82697',
    g.worker.separator.value === '\n' && g.worker.separator.byte === 10 &&
    g.worker.separator.position_offset === Buffer.byteLength(canon, 'utf8'));
  ok('blob source bytes == 83598 (82697 + 1 + 900)', Buffer.byteLength(blob, 'utf8') === g.worker.blob_source_bytes);
  ok('blob source sha256 == fixture', sha(blob) === g.worker.blob_source_sha256);
  ok('worker onmessage contract pinned',
    frag.indexOf('self.postMessage({token:d.token,ok:true,out:out,wholeNumbers:model.wholeNumbers});') !== -1);
  ok('worker request contract carries the pinned fields',
    frag.indexOf('formulas') !== -1 && frag.indexOf('token') !== -1);
  // token + fallback contracts (in the fragment).
  ok('worker token stale guard present', /workerToken/.test(frag));

  // 9. Mirror inventory (engine/engine.js unchanged; two approved divergences).
  const mirror = fs.readFileSync(path.join(siteDir, 'engine', 'engine.js'), 'utf8');
  // E6: engine.js is now a GENERATED artefact. Its current-state SHA is owned by
  // the E6 checker; here we assert only that it is the generator's output (i.e.
  // not hand-edited / stale), so the E1 inventory runs against the real mirror.
  let genMirror = null;
  try { genMirror = require('./generate-engine-mirror.js').generateMirror(siteDir); } catch (e) { genMirror = null; }
  ok('mirror engine.js matches the generator output (E6 authority)', genMirror !== null && mirror === genMirror,
    'got ' + sha(mirror));
  const A = byName(extractFns(canon)), B = byName(extractFns(mirror));
  const aNames = Object.keys(A).sort(), bNames = Object.keys(B).sort();
  const onlyProd = aNames.filter(n => !(n in B));
  const onlyMirror = bNames.filter(n => !(n in A));
  const shared = aNames.filter(n => n in B);
  ok('mirror: no production-only functions', onlyProd.length === 0, onlyProd.join(','));
  ok('mirror: no mirror-only functions', onlyMirror.length === 0, onlyMirror.join(','));
  ok('mirror: 89 shared unique names', shared.length === 89, 'got ' + shared.length);
  const divergent = [];
  for (const n of shared) {
    const a = A[n], b = B[n];
    let eq = a.length === b.length;
    if (eq) { for (let i = 0; i < a.length; i++) { if (normBody(a[i].body) !== normBody(b[i].body)) { eq = false; break; } } }
    if (!eq) divergent.push(n);
  }
  divergent.sort();
  ok('mirror: exactly the two approved divergences',
    divergent.length === APPROVED_DIVERGENCES.length && divergent.every((d, i) => d === APPROVED_DIVERGENCES.slice().sort()[i]),
    'got ' + JSON.stringify(divergent));
  // no third divergence, no vanished shared, no mis-classified exclusive => covered above.

  // 10. dotProduct_ declared twice (nested), documented.
  ok('dotProduct_ declared twice in production', (A['dotProduct_'] || []).length === 2);
  ok('dotProduct_ declared twice in mirror', (B['dotProduct_'] || []).length === 2);

  // 11. Constants: all shared, none divergent, values intact.
  const ca = constMap(canon), cb = constMap(mirror);
  let constDiverge = false, constMissing = false;
  for (const k in EXPECTED_CONSTANTS) {
    if (ca[k] !== EXPECTED_CONSTANTS[k]) constMissing = true;
    if (ca[k] !== cb[k]) constDiverge = true;
  }
  ok('engine constants intact and non-divergent', !constMissing && !constDiverge);

  // 12. Publication: canonical source not published; no source marker / path in dist.
  // Deterministic composition contract (official compositor, no dist). Reuses the
  // `composed` output already produced above from solver.html via the OFFICIAL
  // compositor (this file is allowlisted for that composer contract). The built
  // dist/solver.html byte-identity is a build-only contract owned by validate_dist.
  ok('composed output carries structural ENGINE_START/END', composed !== null && composed.indexOf(ENGINE_START) !== -1 && composed.indexOf(ENGINE_END) !== -1);
  ok('composed output has NO SOLVER_ENGINE_SOURCE marker', composed !== null && composed.indexOf('SOLVER_ENGINE_SOURCE') === -1);
  ok('composed output has NO canonical path reference', composed !== null && composed.indexOf('plumline-engine.js') === -1);
  ok('canonical source NOT copied into dist', !fs.existsSync(path.join(siteDir, 'dist', 'engine', 'source', 'plumline-engine.js')));

  // 13. Requests unchanged (six).
  ok('six requests (fixture)', g.requests === 6);

  return { pass, fail, failures };
}

module.exports = { checkCanonicalEngineSource: checkCanonicalEngineSource };

if (require.main === module) {
  const r = checkCanonicalEngineSource(path.join(__dirname, '..'));
  console.log('CANONICAL ENGINE SOURCE (E1)  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  if (r.fail) { r.failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}
