/* tests_e6_worker_mirror_positive.js — Checkpoint E6 positives.
 *
 * Positive contracts for the single editable engine source, the generated mirror,
 * the Worker/fallback integration and the parity guarantees. Structural contracts
 * reuse the official checker; equivalence contracts run the generator and compare
 * against the committed mirror. No engine or Worker logic is re-implemented.
 * Dist-independent.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');
const acorn = require('acorn');
const { generateMirror } = require('./generate-engine-mirror.js');
const { checkSingleEngineWorkerAndMirror } = require('./tests_e6_worker_mirror.js');

const SITE = path.join(__dirname, '..');
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); } }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function norm(code) { return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim(); }
function stripElapsed(r) { const c = Object.assign({}, r); delete c.elapsedMs; return c; }

function extractFns(src) {
  const ast = acorn.parse(src, { ecmaVersion: 2022 }); const fns = {};
  function walk(node) { (node.body || []).forEach(function (n) { if (n.type === 'FunctionDeclaration' && n.id) fns[n.id.name] = src.slice(n.start, n.end); if (n.type === 'ExpressionStatement' && n.expression && n.expression.type === 'CallExpression') { const c = n.expression.callee; if (c && (c.type === 'FunctionExpression' || c.type === 'ArrowFunctionExpression') && c.body && c.body.body) walk(c.body); } }); }
  walk(ast); return fns;
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
function loadModule(text) {
  const sb = { module: { exports: {} }, Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.module.exports = {}; vm.createContext(sb); vm.runInContext(text, sb);
  return sb.module.exports.PlumlineEngine || sb.module.exports;
}
function loadCanonProbe() {
  const canonSrc = fs.readFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), 'utf8');
  const sb = { Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.__e = {}; vm.createContext(sb);
  vm.runInContext(canonSrc + '\n;__e.detectModel_=detectModel_;__e.solveModel_=solveModel_;', sb);
  return sb.__e;
}

const canonSrc = fs.readFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), 'utf8');
const mirrorSrc = fs.readFileSync(path.join(SITE, 'engine', 'engine.js'), 'utf8');
const g = JSON.parse(fs.readFileSync(path.join(SITE, 'engine', 'fixtures', 'single-engine', 'engine-e6-worker-mirror-final.json'), 'utf8'));

// 1. Official checker passes.
const chk = checkSingleEngineWorkerAndMirror(SITE);
ok('P1 official E6 checker passes', chk.fail === 0, chk.failures.join('; '));

// 2. Single editable canonical source.
ok('P2 canonical is the single editable source (ENGINE_START)', canonSrc.indexOf('/* ENGINE_START */') === 0);

// 3. Mirror is derived (== generator output).
ok('P3 mirror equals generator output', mirrorSrc === generateMirror(SITE));

// 4. Generation deterministic.
ok('P4 generation deterministic', generateMirror(SITE) === generateMirror(SITE));

// 5. Adaptations limited to two.
ok('P5 exactly two adaptations', g.approved_transformations.length === 2 && eq(g.approved_transformations.map(a => a.target).sort(), ['newContext_', 'readConstraint_']));

// 6-7. canonical/mirror parity: all functions normalized-identical except the two.
const cf = extractFns(canonSrc), mf = extractFns(mirrorSrc);
const diff = Object.keys(cf).filter(n => mf[n] && norm(cf[n]) !== norm(mf[n]));
ok('P6 only two functional divergences', eq(diff.slice().sort(), ['newContext_', 'readConstraint_']));
ok('P7 86 functions normalized-identical', Object.keys(cf).filter(n => mf[n] && norm(cf[n]) === norm(mf[n])).length === 86);

// 8-9. Mirror exports/API preserved, mirror runs.
const api = loadModule(mirrorSrc);
ok('P8 mirror exposes 20 exports', eq(Object.keys(api).sort(), g.mirror_api.exports.slice().sort()));
ok('P9 mirror solveModel_ runs', typeof api.solveModel_ === 'function');

// 10. Mirror functionally equivalent to canonical (direct solve).
(function () {
  const probe = loadCanonProbe();
  const grid = buildMax([{ name: 'A', profit: 3 }, { name: 'B', profit: 2 }], [{ label: 'C1', coefs: [1, 1], rel: '<=', limit: 4 }]);
  const sheet = mkSheetObj(grid);
  const cRes = probe.solveModel_(sheet, probe.detectModel_(sheet));
  const mSheet = mkSheetObj(grid);
  const mRes = api.solveModel_(mSheet, api.detectModel_(mSheet));
  ok('P10 mirror == canonical solveModel_ (elapsedMs excluded)', eq(stripElapsed(cRes), stripElapsed(mRes)));
})();

// 11-13. Direct / Worker / fallback use the canonical maths.
const workerClient = fs.readFileSync(path.join(SITE, 'engine', 'fragments', 'solver-ui', 'solve-worker-client.js'), 'utf8');
const orch = fs.readFileSync(path.join(SITE, 'engine', 'fragments', 'solver-ui', 'solve-orchestration.js'), 'utf8');
ok('P11 Worker engineSource slices ENGINE_START..END', /slice\(a,\s*b\)/.test(workerClient));
ok('P12 Worker does not use engine.js', workerClient.indexOf('engine.js') === -1);
ok('P13 fallback uses detectModel_/solveModel_', /detectModel_\(sheet/.test(orch) && /solveModel_\(sheet/.test(orch));

// 14-17. Request/response/token/stale contracts present.
ok('P14 request contract', eq(g.request_contract.fields, ['token', 'formulas', 'values', 'localeMode', 'wholeNumbers', 'domains', 'sense']));
ok('P15 response success contract', eq(g.response_success_contract.fields, ['token', 'ok:true', 'out', 'wholeNumbers']));
ok('P16 response error contract', eq(g.response_error_contract.fields, ['token', 'ok:false', 'phase', 'error']));
ok('P17 token stale guard on global workerToken', /if\(e\.data\.token!==workerToken\)\s*return;/.test(orch));

// 18-20. Lifecycle + cleanup.
ok('P18 lifecycle build (Blob/createObjectURL/new Worker/revoke)', /new Blob/.test(workerClient) && /createObjectURL/.test(workerClient) && /new Worker/.test(workerClient) && /revokeObjectURL/.test(workerClient));
ok('P19 error path terminates', /terminate\(\)/.test(orch));
ok('P20 cleanup nulls engineWorker', /engineWorker=null/.test(orch));

// 21-23. Statuses / stopReason / optimalityProven preserved through the mirror.
(function () {
  const grid = buildMax([{ name: 'A', profit: 5 }, { name: 'B', profit: 1 }], [{ label: 'C1', coefs: [2, 1], rel: '<=', limit: 7 }]);
  const s = mkSheetObj(grid); const m = api.detectModel_(s); m.wholeNumbers = true; const r = api.solveModel_(s, m);
  ok('P21 mirror integer optimal status', r.status === 'optimal' && r.objective === 16);
  ok('P22 mirror stopReason null on optimal', r.stopReason === null);
  ok('P23 mirror optimalityProven true', r.optimalityProven === true);
})();

// 24-25. Localization handoff stays in UI + public output pinned (no solver.html
// read: composition byte-identity is owned by E1/validate_dist).
ok('P24 localizeEngineError not in engine or worker client', canonSrc.indexOf('localizeEngineError') === -1 && fs.readFileSync(path.join(SITE, 'engine', 'fragments', 'solver-ui', 'solve-worker-client.js'), 'utf8').indexOf('localizeEngineError') === -1);
ok('P25 fixture pins composed public output 215539', g.public_output.composed_solver_bytes === 215539);

// 26. No dist dependency in this suite.
ok('P26 no dist dependency', !/existsSync\([^)]*dist/.test(fs.readFileSync(__filename, 'utf8')) && !/readFileSync\([^)]*dist[^)]*solver/.test(fs.readFileSync(__filename, 'utf8')));

// 27. Runs from a spaced path.
ok('P27 generator runs from a spaced path', (function () {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e6 space-'));
  try {
    fs.mkdirSync(path.join(base, 'engine', 'source'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), path.join(base, 'engine', 'source', 'plumline-engine.js'));
    fs.copyFileSync(path.join(SITE, 'engine', 'source', 'engine-platform-adapter.json'), path.join(base, 'engine', 'source', 'engine-platform-adapter.json'));
    return generateMirror(base) === mirrorSrc;
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})());

console.log('SINGLE-ENGINE + WORKER + MIRROR POSITIVE (E6)  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
