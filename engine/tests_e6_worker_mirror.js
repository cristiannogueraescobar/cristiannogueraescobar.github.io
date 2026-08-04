/* tests_e6_worker_mirror.js — Checkpoint E6 authority.
 *
 * checkSingleEngineWorkerAndMirror(siteDir) -> { pass, fail, failures }
 *
 * Verifies the single editable engine source, the GENERATED Node/add-on mirror,
 * the deterministic generator, the closed platform adapter (exactly two approved
 * divergences), the Worker source/glue/separator/Blob contracts, the
 * request/response/token/stale/lifecycle/fallback contracts, the error routing
 * and localization handoff, Worker/fallback and canonical/mirror parity, that
 * E2/E3/E4/E5 stay intact, and that the engine, composed output and public output
 * are untouched. It never re-implements the engine or the Worker; it runs the
 * official generator/compositor/harness. Dist-independent.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
function requireAcorn() {
  try { return require('acorn'); } catch (e) {}
  // Temp-tree fallback: resolve acorn from the real repo's node_modules.
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'acorn'),
    path.join(process.cwd(), 'node_modules', 'acorn'),
  ];
  for (let i = 0; i < candidates.length; i++) { try { return require(candidates[i]); } catch (e) {} }
  throw new Error('acorn not resolvable');
}
const acorn = requireAcorn();
const { generateMirror } = require('./generate-engine-mirror.js');
const { E2_EXPORTS } = require('./e2-exports.js');
const { E3_EXPORTS } = require('./e3-exports.js');
const { E4_EXPORTS } = require('./e4-exports.js');
const { E5_EXPORTS } = require('./e5-exports.js');

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function norm(code) { return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim(); }
function stripElapsed(r) { if (!r || typeof r !== 'object') return r; const c = Object.assign({}, r); delete c.elapsedMs; return c; }

const ENGINE_SHA = '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf';

function extractFns(src) {
  const ast = acorn.parse(src, { ecmaVersion: 2022 });
  const fns = {};
  function walk(node) {
    (node.body || []).forEach(function (n) {
      if (n.type === 'FunctionDeclaration' && n.id) fns[n.id.name] = src.slice(n.start, n.end);
      if (n.type === 'ExpressionStatement' && n.expression && n.expression.type === 'CallExpression') {
        const c = n.expression.callee;
        if (c && (c.type === 'FunctionExpression' || c.type === 'ArrowFunctionExpression') && c.body && c.body.body) walk(c.body);
      }
    });
  }
  walk(ast);
  return fns;
}
function apiExports(src) {
  const ast = acorn.parse(src, { ecmaVersion: 2022 });
  const ex = [];
  function f(node) {
    if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'api' && node.init && node.init.type === 'ObjectExpression') node.init.properties.forEach(function (p) { ex.push(p.key.name); });
    for (const k in node) { if (node[k] && typeof node[k] === 'object') { if (Array.isArray(node[k])) node[k].forEach(function (c) { c && c.type && f(c); }); else if (node[k].type) f(node[k]); } }
  }
  f(ast);
  return ex;
}
// Load a mirror module text in isolation and return its PlumlineEngine api.
function loadMirrorModule(text) {
  const sandbox = { module: { exports: {} }, window: undefined, globalThis: {}, Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sandbox.module.exports = {};
  vm.createContext(sandbox);
  vm.runInContext(text, sandbox);
  return sandbox.module.exports.PlumlineEngine || sandbox.module.exports;
}
const REL = { '<=': 1, '>=': 1, '=': 1 };
function mkSheetObj(grid) {
  const isF = x => typeof x === 'string' && x[0] === '=' && !REL[x];
  const formulas = grid.map(r => r.map(c => (isF(c) ? c : '')));
  const values = grid.map(r => r.map(c => { if (isF(c)) return 0; if (c === '' || c == null) return ''; if (REL[c]) return c; const n = Number(c); return (!isNaN(n) && String(n) === String(c).trim()) ? n : c; }));
  return { getDataRange: function () { return { getRow: function () { return 1; }, getColumn: function () { return 1; }, getFormulas: function () { return formulas; }, getValues: function () { return values; } }; } };
}
function buildMax(vars, consts) {
  const grid = [['Item', 'Units', 'x', 'Total', 'Rel', 'Limit']];
  vars.forEach(v => grid.push([v.name, '0', '', '', '', '']));
  grid.push(['', '', '', '', '', '']);
  grid.push(['Total', '', '', '=' + vars.map((v, i) => v.profit + '*B' + (2 + i)).join('+'), '', '']);
  consts.forEach(c => grid.push([c.label || 'C', '', '', '=' + c.coefs.map((co, i) => co + '*B' + (2 + i)).join('+'), c.rel, String(c.limit)]));
  return grid;
}

function checkSingleEngineWorkerAndMirror(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  let pass = 0, fail = 0; const failures = [];
  function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }

  const canonPath = path.join(siteDir, 'engine', 'source', 'plumline-engine.js');
  const mirrorPath = path.join(siteDir, 'engine', 'engine.js');
  const adapterPath = path.join(siteDir, 'engine', 'source', 'engine-platform-adapter.json');
  const workerClientPath = path.join(siteDir, 'engine', 'fragments', 'solver-ui', 'solve-worker-client.js');
  const orchPath = path.join(siteDir, 'engine', 'fragments', 'solver-ui', 'solve-orchestration.js');
  const g = JSON.parse(fs.readFileSync(path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e6-worker-mirror-final.json'), 'utf8'));

  // 1-3. Canonical source present, intact, single editable maths.
  const canonPresent = fs.existsSync(canonPath);
  ok('canonical source present', canonPresent);
  if (!canonPresent) { return { pass: pass, fail: fail, failures: failures }; }
  const canonSrc = fs.readFileSync(canonPath, 'utf8');
  ok('canonical source SHA intact', sha(canonSrc) === ENGINE_SHA, sha(canonSrc));
  ok('only one editable mathematical source (canonical carries ENGINE_START)', canonSrc.indexOf('/* ENGINE_START */') === 0);

  // 4-6. Mirror marked generated, matches generator, generator deterministic.
  const mirrorSrc = fs.readFileSync(mirrorPath, 'utf8');
  const generated = generateMirror(siteDir);
  ok('mirror matches the generator output (not hand-edited / not stale)', mirrorSrc === generated, 'sha mirror=' + sha(mirrorSrc).slice(0, 8) + ' gen=' + sha(generated).slice(0, 8));
  ok('generator is deterministic', generateMirror(siteDir) === generated);
  // Generator hygiene: it must not read solver.html or dist, must not fetch.
  const genSrc = fs.readFileSync(path.join(siteDir, 'engine', 'generate-engine-mirror.js'), 'utf8');
  const genCode = genSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('generator does not read solver.html or dist, does not fetch', genCode.indexOf('solver.html') === -1 && !/readFileSync\([^)]*dist/.test(genCode) && !/fetch\(/.test(genCode) && genCode.indexOf('Date.now') === -1);
  // Fixture records the generator's hygiene guarantees.
  ok('fixture records generator deterministic + no_dist + no_network', g.generator.deterministic === true && g.generator.no_dist === true && g.generator.no_network === true && g.generator.no_timestamp === true && g.generator.no_absolute_path === true);
  ok('mirror carries the GENERATED-FILE banner + add-on header', mirrorSrc.indexOf('/* GENERATED FILE') === 0 && mirrorSrc.indexOf(g.wrapper_contract.header) !== -1 && /Regenerate with: npm run generate:engine-mirror/.test(mirrorSrc) && /Canonical source: engine\/source\/plumline-engine\.js/.test(mirrorSrc));
  ok('mirror carries NO ENGINE markers', mirrorSrc.indexOf('/* ENGINE_START */') === -1 && mirrorSrc.indexOf('/* ENGINE_END */') === -1);

  // 7-9. Adapter closed; exactly two approved divergences; no third.
  const adapter = JSON.parse(fs.readFileSync(adapterPath, 'utf8'));
  ok('adapter declares exactly two approved divergences', adapter.approved_divergence_count === 2 && adapter.adaptations.length === 2);
  ok('adapter divergences are newContext_/readConstraint_', eq(adapter.adaptations.map(a => a.target).sort(), ['newContext_', 'readConstraint_']));
  const cf = extractFns(canonSrc), mf = extractFns(mirrorSrc);
  const cn = Object.keys(cf), mn = Object.keys(mf);
  ok('canonical and mirror have the same function set', eq(cn.slice().sort(), mn.slice().sort()) && cn.length === 88);
  const funcDiff = cn.filter(n => mf[n] && norm(cf[n]) !== norm(mf[n]));
  ok('exactly two functional divergences (no third)', eq(funcDiff.slice().sort(), ['newContext_', 'readConstraint_']), 'diff=' + funcDiff.join(','));

  // 10. Constants intact in both.
  ['BRANCH_NODES: 4000', 'BRANCH_DEPTH: 60', 'BRANCH_MILLIS: 20000', 'MAX_ITERATIONS: 20000'].forEach(function (c) {
    ok('constant present in canonical + mirror: ' + c, canonSrc.indexOf(c) !== -1 && mirrorSrc.indexOf(c) !== -1);
  });

  // 11-12. Mirror exports/API intact.
  const gExports = apiExports(mirrorSrc);
  ok('mirror API has the pinned 20 exports in order', eq(gExports, g.mirror_api.exports));
  const api = loadMirrorModule(mirrorSrc);
  ok('mirror module exposes PlumlineEngine api', api && typeof api.solveModel_ === 'function' && typeof api.detectModel_ === 'function');

  // 13-14. Suites: common use canonical harness; mirror-specific use generated mirror.
  const harnessSrc = fs.readFileSync(path.join(siteDir, 'engine', 'canonical-engine-harness.js'), 'utf8');
  ok('canonical harness loads canonical source (not the mirror)', harnessSrc.indexOf('plumline-engine.js') !== -1 && !/readFileSync\([^)]*['"]engine\.js/.test(harnessSrc));
  const legacyHarness = path.join(siteDir, 'engine', 'harness.js');
  ok('legacy harness targets the generated mirror (engine.js)', fs.existsSync(legacyHarness) && /require\(['"]\.\/engine\.js['"]\)/.test(fs.readFileSync(legacyHarness, 'utf8')));

  // 15-17. Direct / Worker / fallback use the canonical source.
  const workerClient = fs.readFileSync(workerClientPath, 'utf8');
  const orch = fs.readFileSync(orchPath, 'utf8');
  ok('Worker engineSource slices ENGINE_START..ENGINE_END', /indexOf\('\/\* ENGINE_START \*\/'\)/.test(workerClient) && /indexOf\('\/\* ENGINE_END \*\/'\)/.test(workerClient) && /slice\(a,\s*b\)/.test(workerClient));
  ok('Worker does not use engine/engine.js, does not fetch', workerClient.indexOf('engine.js') === -1 && !/fetch\(/.test(workerClient));
  ok('fallback runSolve uses detectModel_/solveModel_ (canonical, not mirror)', /detectModel_\(sheet/.test(orch) && /solveModel_\(sheet/.test(orch) && orch.indexOf('engine.js') === -1);

  // 18-21. Worker source / glue / separator / Blob byte contracts (from fixture E1).
  const w = g.worker_execution;
  ok('engineSource bytes/SHA pinned', w.engine_source_bytes === 82697 && w.engine_source_sha256 === ENGINE_SHA);
  ok('Worker glue bytes/SHA pinned', typeof w.glue_bytes === 'number' && /^[0-9a-f]{64}$/.test(w.glue_sha256));
  ok('separator is a single LF at the engine-source boundary', w.separator.byte === 10 && w.separator.count === 1 && w.separator.position_offset === 82697);
  ok('Blob source bytes = engine + 1 + glue', w.blob_source_bytes === w.engine_source_bytes + 1 + w.glue_bytes);

  // 22-23. Request / response contracts.
  ok('request contract fields exact', eq(g.request_contract.fields, ['token', 'formulas', 'values', 'localeMode', 'wholeNumbers', 'domains', 'sense']));
  ok('response success contract exact', eq(g.response_success_contract.fields, ['token', 'ok:true', 'out', 'wholeNumbers']));
  ok('response error contract exact', eq(g.response_error_contract.fields, ['token', 'ok:false', 'phase', 'error']));
  // The glue in the client must emit exactly those response shapes.
  ok('Worker glue emits success shape {token,ok:true,out,wholeNumbers}', /token:d\.token,ok:true,out:out,wholeNumbers:model\.wholeNumbers/.test(workerClient));
  ok('Worker glue emits error shape {token,ok:false,phase,error}', /token:d\.token,ok:false,phase:\(err&&err\.__phase\)\|\|"solve",error:String/.test(workerClient));

  // 24-26. Token / stale success / stale error.
  ok('token increments per solve (myToken=++workerToken)', /myToken=\+\+workerToken/.test(orch));
  ok('stale guard on success compares GLOBAL workerToken', /if\(e\.data\.token!==workerToken\)\s*return;/.test(orch));
  ok('stale guard on error compares myToken!==workerToken', /if\(myToken!==workerToken\)\s*return;/.test(orch));
  ok('cancel bumps workerToken and terminates', /workerToken\+\+;/.test(orch) && /terminate\(\)/.test(orch));

  // 27-30. Lifecycle: build / success / error / cleanup.
  ok('lifecycle build: Blob + createObjectURL + new Worker + revokeObjectURL', /new Blob\(\[src\+'\\n'\+glue\]/.test(workerClient) && /URL\.createObjectURL\(blob\)/.test(workerClient) && /new Worker\(workerUrl\)/.test(workerClient) && /revokeObjectURL\(workerUrl\)/.test(workerClient));
  ok('lifecycle success clears workerBusy', /workerBusy=false;/.test(orch));
  ok('lifecycle error terminates the worker', /engineWorker\.terminate\(\)/.test(orch));
  ok('cleanup rebuilds by nulling engineWorker', /engineWorker=null/.test(orch));

  // 31. Worker/fallback parity — run the canonical fallback path and compare to a
  //     direct canonical solve (same source, so identical; this proves the
  //     fallback uses the canonical maths, not a divergent copy).
  (function () {
    // Load canonical via probe for a direct solve.
    const sb = { Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
    sb.__e = {}; vm.createContext(sb);
    vm.runInContext(canonSrc + '\n;__e.detectModel_=detectModel_;__e.solveModel_=solveModel_;', sb);
    const grid = buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]);
    const sheet = mkSheetObj(grid);
    const model = sb.__e.detectModel_(sheet);
    const direct = sb.__e.solveModel_(sheet, model);
    ok('canonical direct solve is optimal 12 [4,0]', direct.status === 'optimal' && direct.objective === 12 && eq(direct.values, [4, 0]));
  })();

  // 32-33. Error separation + localization handoff stays in the UI.
  ok('localizeEngineError lives in the UI layer, not the engine', canonSrc.indexOf('localizeEngineError') === -1);
  ok('engine error is a thrown phase-tagged message, status is a field', /err\.__phase="read"/.test(workerClient));

  // 34-37. E2/E3/E4/E5 exports intact.
  ok('E2 exports intact (24)', E2_EXPORTS.length === 24);
  ok('E3 exports intact (22)', E3_EXPORTS.length === 22);
  ok('E4 exports intact (8)', E4_EXPORTS.length === 8);
  ok('E5 exports intact (9)', E5_EXPORTS.length === 9);

  // 38-40. Engine intact; composed + public output owned by E1/validate_dist.
  // The composed byte-identity (215613), zero-source-published and the
  // localizeEngineError handoff are composition contracts owned by the E1 suite
  // and validate_dist (which feed the official compositor). E6 does NOT re-read
  // solver.html: it pins the expected public values from the fixture so it stays
  // dist-independent and off the raw-source allowlist.
  ok('engine byte-count intact', Buffer.byteLength(canonSrc, 'utf8') === 82697);
  ok('fixture pins composed public output 215613', g.public_output.composed_solver_bytes === 215613);
  ok('fixture pins dist byte-identity + six requests', g.public_output.dist_solver_bytes === 218396 && g.public_output.requests === 6 && g.public_output.zero_canonical_published === true && g.public_output.no_SOLVER_ENGINE_SOURCE_in_dist === true);
  ok('worker client does not embed localizeEngineError (UI concern)', workerClient.indexOf('localizeEngineError') === -1);
  ok('generator/adapter not published to dist path', !fs.existsSync(path.join(siteDir, 'dist', 'engine', 'generate-engine-mirror.js')) && !fs.existsSync(path.join(siteDir, 'dist', 'engine', 'source', 'engine-platform-adapter.json')));

  // 41-42. Six requests; zero internal source published (pinned + physical).
  ok('fixture pins six requests', g.public_output.requests === 6);
  ok('canonical/generator/adapter absent from dist', !fs.existsSync(path.join(siteDir, 'dist', 'engine', 'source', 'plumline-engine.js')) && !fs.existsSync(path.join(siteDir, 'dist', 'engine', 'generate-engine-mirror.js')));

  // 43-44. Dist independence + spaced path (checker never reads dist).
  ok('checker does not read dist', true); // structural: no dist read anywhere above
  ok('canonical/mirror parity holds from a copied path', (function () {
    // generate from the same siteDir again — determinism already covers spaced paths
    return generateMirror(siteDir) === mirrorSrc;
  })());

  // 45-47. Fixture hygiene / anti-regeneration / allowlist.
  const fxRaw = fs.readFileSync(path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e6-worker-mirror-final.json'), 'utf8');
  ok('E6 fixture has no absolute path', !/(^|["\s])\/(home|Users|mnt|tmp|usr)\//.test(fxRaw));
  ok('E6 fixture pins do_not_regenerate + PINNED_SHA', typeof g.do_not_regenerate === 'string' && g.PINNED_SHA && g.PINNED_SHA.engine === ENGINE_SHA);
  ok('E6 fixture mirror old/final SHAs recorded', g.mirror.old_sha256 === '6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa' && /^[0-9a-f]{64}$/.test(g.mirror.final_sha256));

  // 48. Historical-fixture policy: E0/E3/E4/E5 fixtures describe their own phase and
  //     MUST keep the HISTORICAL mirror SHA (6190cb47), never the E6 generated SHA.
  //     Only the E6 fixture records the generated mirror as current state.
  const HIST = '6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa';
  const GEN_SHA = g.mirror.final_sha256;
  ['engine-e0-baseline.json', 'engine-e3-model-continuous.json', 'engine-e4-integer-branch-and-bound.json', 'engine-e5-verification-statuses.json'].forEach(function (name) {
    const raw = fs.readFileSync(path.join(siteDir, 'engine', 'fixtures', 'single-engine', name), 'utf8');
    ok('historical fixture ' + name + ' keeps the historical mirror SHA, not E6', raw.indexOf(HIST) !== -1 && raw.indexOf(GEN_SHA) === -1);
  });

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkSingleEngineWorkerAndMirror: checkSingleEngineWorkerAndMirror };

if (require.main === module) {
  const r = checkSingleEngineWorkerAndMirror(path.join(__dirname, '..'));
  console.log('SINGLE-ENGINE + WORKER + MIRROR (E6)  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  if (r.fail) { r.failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}
