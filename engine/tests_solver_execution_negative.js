/* tests_solver_execution_negative.js — Checkpoint D3 negatives.
 *
 * Each case copies the solver source + ALL solver-ui fragments into a temp tree,
 * mutates ONE thing, runs the OFFICIAL composer or checkSolverExecutionInterface
 * (never a private copy), asserts a specific failure (fail>0 or a thrown error with
 * a specific message), and cleans up in finally. No deliberately-green negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { checkSolverExecutionInterface } = require('./tests_solver_execution.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const SITE = path.join(__dirname, '..');
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const SOLVER = 'solver' + '.html';
const WORKER_FILE = 'solve-worker-client.js';
const ORCH_FILE = 'solve-orchestration.js';
const RESULTS_FILE = 'errors-results.js';
const D1_FILE = 'grid-interaction.js';
const D2_FILE = 'variable-settings.js';

function makeTree(root) {
  const dir = root || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-d3-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'solver-ui-golden'), { recursive: true });
  fs.copyFileSync(path.join(SITE, SOLVER), path.join(dir, SOLVER));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), path.join(dir, 'engine', 'source', 'plumline-engine.js'));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  fs.copyFileSync(
    path.join(SITE, 'engine', 'fixtures', 'solver-ui-golden', 'solver-execution-d3.json'),
    path.join(dir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-execution-d3.json'));
  return dir;
}
const readSolver = dir => fs.readFileSync(path.join(dir, SOLVER), 'utf8');
const engineSrcPath = dir => path.join(dir, 'engine', 'source', 'plumline-engine.js');
const writeSolver = (dir, s) => fs.writeFileSync(path.join(dir, SOLVER), s);
const fragPath = (dir, f) => path.join(dir, FRAG_DIR, f);
const readFrag = (dir, f) => fs.readFileSync(fragPath(dir, f), 'utf8');
const writeFrag = (dir, f, s) => fs.writeFileSync(fragPath(dir, f), s);

function composeResult(dir) {
  try { composeSolverInterface(readSolver(dir), dir); return { threw: false, message: '' }; }
  catch (e) { return { threw: true, message: String(e && e.message || e) }; }
}
function expectThrow(label, mutate, frag) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree composes', !composeResult(dir).threw);
    mutate(dir);
    const r = composeResult(dir);
    ok(label + ': mutation makes composition throw', r.threw, 'did not throw');
    ok(label + ': error mentions "' + frag + '"', r.threw && r.message.indexOf(frag) !== -1, r.message);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function expectCheckFail(label, mutate, expectedFailure) {
  const dir = makeTree();
  try {
    if (typeof expectedFailure !== 'string' || !expectedFailure) {
      ok(label + ': needle provided', false, 'expectCheckFail requires a specific expectedFailure needle');
      return;
    }
    ok(label + ': clean tree passes checker', checkSolverExecutionInterface(dir).fail === 0);
    mutate(dir);
    const r = checkSolverExecutionInterface(dir);
    ok(label + ': mutation trips the checker', r.fail > 0);
    ok(label + ': failures is an array', Array.isArray(r.failures));
    ok(label + ': fails with "' + expectedFailure + '"',
      Array.isArray(r.failures) && r.failures.some(m => m.includes(expectedFailure)),
      (r.failures || []).join(' | '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const W_START = '/* SOLVER_UI_SOLVE_WORKER_CLIENT_START:solve-worker-client.js */';
const W_END = '/* SOLVER_UI_SOLVE_WORKER_CLIENT_END */';
const O_START = '/* SOLVER_UI_SOLVE_ORCHESTRATION_START:solve-orchestration.js */';
const O_END = '/* SOLVER_UI_SOLVE_ORCHESTRATION_END */';
const R_START = '/* SOLVER_UI_SOLVE_RESULTS_START:errors-results.js */';
const R_END = '/* SOLVER_UI_SOLVE_RESULTS_END */';
const D1_START = '/* SOLVER_UI_GRID_INTERACTION_START:grid-interaction.js */';
const D2_START = '/* SOLVER_UI_VARIABLE_SETTINGS_START:variable-settings.js */';
const D2_END = '/* SOLVER_UI_VARIABLE_SETTINGS_END */';

// 1. D3 marker absent.
expectThrow('N1 D3 marker absent', dir => writeSolver(dir, readSolver(dir).replace(O_START + '\n', '')), 'unbalanced');
// 2. D3 marker duplicated.
expectThrow('N2 D3 marker duplicated', dir => writeSolver(dir, readSolver(dir).replace(O_START, O_START + '\n' + O_START)), 'unbalanced');
// 3. D3 markers inverted.
expectThrow('N3 D3 markers inverted', dir => writeSolver(dir, readSolver(dir).replace(O_START + '\n' + O_END, O_END + '\n' + O_START)), 'END before START');
// 4. D3 region overlapping D1 (extra START inside D1 block).
expectThrow('N4 D3 overlaps D1', dir => writeSolver(dir, readSolver(dir).replace(D1_START, D1_START + '\n' + O_START)), 'unbalanced');
// 5. D3 region overlapping D2 (extra START inside D2 block).
expectThrow('N5 D3 overlaps D2', dir => writeSolver(dir, readSolver(dir).replace(D2_START, D2_START + '\n' + O_START)), 'unbalanced');
// 6. Marker inside the engine region.
expectThrow('N6 marker inside engine', dir => {
  const ep = engineSrcPath(dir);
  const e = fs.readFileSync(ep, 'utf8');
  fs.writeFileSync(ep, e.slice(0, 100) + '\n/* SOLVER_UI_SOLVE_ORCHESTRATION_START:x.js */\n/* SOLVER_UI_SOLVE_ORCHESTRATION_END */\n' + e.slice(100));
}, 'inside the engine region');
// 7. Unknown fragment name.
expectThrow('N7 unknown fragment name', dir => writeSolver(dir, readSolver(dir).replace(O_START, '/* SOLVER_UI_NOPE_START:solve-orchestration.js */').replace(O_END, '/* SOLVER_UI_NOPE_END */')), 'unknown');
// 8. Fragment missing.
expectThrow('N8 fragment missing', dir => fs.rmSync(fragPath(dir, ORCH_FILE)), 'not found');
// 9. Fragment empty.
expectThrow('N9 fragment empty', dir => writeFrag(dir, ORCH_FILE, ''), 'empty');
// 10. Path traversal.
expectThrow('N10 path traversal', dir => writeSolver(dir, readSolver(dir).replace('solve-orchestration.js */', '../../../etc/passwd */')), 'compose-solver');
// 11. Absolute path.
expectThrow('N11 absolute path', dir => writeSolver(dir, readSolver(dir).replace('solve-orchestration.js */', '/etc/passwd */')), 'compose-solver');
// 12. Unauthorized subdirectory.
expectThrow('N12 subdirectory', dir => writeSolver(dir, readSolver(dir).replace('solve-orchestration.js */', 'sub/solve-orchestration.js */')), 'compose-solver');
// 13. Residual content between markers.
expectThrow('N13 residual content', dir => writeSolver(dir, readSolver(dir).replace(O_START + '\n' + O_END, O_START + '\nLEFTOVER\n' + O_END)), 'unexpected content');
// 14. Fragment published (bytes drift stand-in).
expectCheckFail('N14 fragment bytes drift', dir => fs.appendFileSync(fragPath(dir, ORCH_FILE), '\n/* stray */\n'), 'fragment solve-orchestration.js bytes match golden');
// 15. Script src added.
expectCheckFail('N15 new script src', dir => writeSolver(dir, readSolver(dir).replace('</head>', '<script src="assets/solve.js"></script></head>')), 'requests unchanged (6)');
// 16. D3 function removed.
expectCheckFail('N16 D3 fn removed', dir => writeFrag(dir, ORCH_FILE, readFrag(dir, ORCH_FILE).replace('function runSolve(', 'function runSolveX(')), 'orchestrator runSolve present');
// 17. D3 function duplicated.
expectCheckFail('N17 D3 fn duplicated', dir => writeSolver(dir, readSolver(dir).replace(O_END, O_END + '\n  function runSolve(){}')), 'D3 fn runSolve present exactly once');
// 18. D4 function copied into a D3 fragment.
expectCheckFail('N18 D4 fn in D3 fragment', dir => fs.appendFileSync(fragPath(dir, RESULTS_FILE), '\n  function renderReceipt(){}\n'), 'D4 fn renderReceipt NOT in any D3 fragment');
// 19. Engine math copied into a D3 fragment.
expectCheckFail('N19 math fn in D3 fragment', dir => fs.appendFileSync(fragPath(dir, ORCH_FILE), '\n  function solveLinearProgram_(){}\n'), 'engine math fn solveLinearProgram_ NOT in any fragment');
// 20. Global solving/worker state renamed.
expectCheckFail('N20 worker state renamed', dir => writeFrag(dir, WORKER_FILE, readFrag(dir, WORKER_FILE).replace(/\bworkerBusy\b/g, 'workerBusyX')), 'D3 contract "worker state workerBusy" intact');
// 21. Pending/worker token state duplicated.
expectCheckFail('N21 worker state duplicated', dir => writeSolver(dir, readSolver(dir).replace(W_END, W_END + '\n  var workerToken=0;')), 'workerToken state defined exactly once');
// 22. Token removed.
expectCheckFail('N22 token removed', dir => writeFrag(dir, WORKER_FILE, readFrag(dir, WORKER_FILE).replace(/\bworkerToken\b/g, 'wtX')), 'workerToken state defined exactly once');
// 23. Token not incremented (change ++ to no-op in orchestration).
expectCheckFail('N23 token not incremented', dir => writeFrag(dir, ORCH_FILE, readFrag(dir, ORCH_FILE).replace(/workerToken\+\+/g, 'workerToken')), 'D3 contract "token increment" intact');
// 24. Stale-response check removed (token comparison in worker message handler).
expectCheckFail('N24 stale check removed', dir => writeFrag(dir, ORCH_FILE, readFrag(dir, ORCH_FILE).replace('if(e.data.token!==workerToken) return;', '')), 'D3 contract "stale-response token guard" intact');
// 25. Worker message contract changed (postMessage payload key).
expectCheckFail('N25 worker message contract changed', dir => writeFrag(dir, WORKER_FILE, readFrag(dir, WORKER_FILE).replace('postMessage', 'postMsgX')), 'D3 contract "worker postMessage" intact');
// 26. Worker response contract changed (onmessage handler).
expectCheckFail('N26 worker response contract changed', dir => writeFrag(dir, WORKER_FILE, readFrag(dir, WORKER_FILE).replace('onmessage', 'onmsgX')), 'D3 contract "worker onmessage" intact');
// 27. Worker glue modified (Blob construction).
expectCheckFail('N27 worker glue modified', dir => writeFrag(dir, WORKER_FILE, readFrag(dir, WORKER_FILE).replace("new Blob([src+'\\n'+glue]", "new Blob([src+'\\n\\n'+glue]")), 'Blob construction intact');
// 28. engineSource modified (the marker-string it searches for).
expectCheckFail('N28 engineSource modified', dir => writeFrag(dir, WORKER_FILE, readFrag(dir, WORKER_FILE).replace("indexOf('/* ENGINE_START */')", "indexOf('/* ENGINE_BEGIN */')")), 'D3 contract "engineSource ENGINE_START locator" intact');
// 29. Fallback removed.
expectCheckFail('N29 fallback removed', dir => writeFrag(dir, ORCH_FILE, readFrag(dir, ORCH_FILE).replace('function solveMainThread(', 'function solveMainThreadX(')), 'fallback fn solveMainThread present');
// 30. Fallback criterion changed (typeof Worker guard).
expectCheckFail('N30 fallback criterion changed', dir => writeFrag(dir, WORKER_FILE, readFrag(dir, WORKER_FILE).replace("typeof Worker==='undefined'", "typeof Worker==='object'")), 'D3 contract "fallback criterion typeof Worker" intact');
// 31. Cancellation removed.
expectCheckFail('N31 cancellation removed', dir => writeFrag(dir, ORCH_FILE, readFrag(dir, ORCH_FILE).replace('function cancelSolve(', 'function cancelSolveX(')), 'canceller cancelSolve present');
// 32. revokeObjectURL removed/reordered.
expectCheckFail('N32 revokeObjectURL removed', dir => {
  for (const f of [WORKER_FILE, ORCH_FILE]) {
    const t = readFrag(dir, f);
    if (t.indexOf('revokeObjectURL') !== -1) { writeFrag(dir, f, t.replace(/revokeObjectURL/g, 'revokeX')); return; }
  }
  writeSolver(dir, readSolver(dir).replace(/revokeObjectURL/, 'revokeX'));
}, 'D3 contract "revokeObjectURL cleanup" intact');
// 33. Solve listener removed.
expectCheckFail('N33 solve listener removed', dir => {
  const p = path.join(dir, FRAG_DIR, 'bootstrap-accessibility.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/getElementById\('solve'\)[^;]*addEventListener\('click'[^;]*;/, ''));
}, 'solve listener bound exactly once');
// 34. Solve listener duplicated.
expectCheckFail('N34 solve listener duplicated', dir => {
  writeSolver(dir, readSolver(dir).replace('</body>', "<script>document.getElementById('solve').addEventListener('click',function(){});</script></body>"));
}, 'solve listener bound exactly once');
// 35. Cancel listener removed (the cancelSolve binding lives in the orchestration
//     fragment, added when the solving UI is shown).
expectCheckFail('N35 cancel listener removed', dir => {
  writeFrag(dir, ORCH_FILE, readFrag(dir, ORCH_FILE).replace(/cancelBtn\.addEventListener\('click',function\(\)\{ cancelSolve\(\); \}\);/, ''));
}, 'D3 contract "cancel listener" intact');
// 36. Status/result ID changed.
expectCheckFail('N36 result id changed', dir => writeSolver(dir, readSolver(dir).replace('id="result"', 'id="resultX"')), 'result container id="result" intact');
// 37. Live region removed.
expectCheckFail('N37 live region removed', dir => writeSolver(dir, readSolver(dir).replace(/\saria-live="[^"]*"/, '')), 'aria-live regions intact');
// 38. ARIA removed.
expectCheckFail('N38 aria removed', dir => writeSolver(dir, readSolver(dir).replace(/\saria-[a-z]+="[^"]*"/, '')), 'aria attrs intact');
// 39. err.message shown directly (added in a D3 fragment).
expectCheckFail('N39 err.message shown directly', dir => fs.appendFileSync(fragPath(dir, RESULTS_FILE), '\n  function showRaw(e){ document.getElementById("result").innerHTML=err.message; }\n'), 'no raw err.message rendered into DOM (D3 fragments)');
// 40. Raw English string added in a D3 fragment.
expectCheckFail('N40 raw English string added', dir => fs.appendFileSync(fragPath(dir, RESULTS_FILE), '\n  var msg="Solve completed successfully";\n'), 'no raw English UI literal in results fragment');
// 41. i18n key removed (a t('...') key in a D3 fragment).
expectCheckFail('N41 i18n key removed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace(/t\('tInfeasible'\)/, "t('tInfeasibleX')")), 'D3 contract "i18n key tInfeasible" intact');
// 42. Foreign-namespace i18n data key introduced (change a solver data-i18n in body).
expectCheckFail('N42 foreign namespace key', dir => writeSolver(dir, readSolver(dir).replace('data-i18n="heroTitle"', 'data-i18n="guide.heroTitle"')), 'no foreign-namespace data-i18n key');
// 43. Status code changed.
expectCheckFail('N43 status code changed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace(/'infeasible'/, "'infeasibleX'")), 'D3 contract "status code infeasible" intact');
// 44. stopReason / status-body key changed.
expectCheckFail('N44 stopReason changed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace(/statusUnboundedBody/, 'statusUnboundedBodyX')), 'D3 contract "stopReason statusUnboundedBody" intact');
// 45. Optimality/announce flag removed (announceOptimal key).
expectCheckFail('N45 optimality announce removed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace(/announceOptimal/, 'announceOptimalX')), 'D3 contract "optimality announceOptimal" intact');
// 46. Objective rendering removed (fmt call in presentResult).
expectCheckFail('N46 objective rendering removed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace(/fmt\(out\.objective\)/, 'out.objective')), 'D3 contract "objective rendering fmt" intact');
// 47. Variables/receipt render removed — receipt lives in the NON-extracted
//     renderReceipt (source). Removing its call in presentResult trips the golden.
expectCheckFail('N47 receipt call removed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace('renderReceipt(out,model)', 'null')), 'D3 contract "receipt call" intact');
// 48. presentResult removed.
expectCheckFail('N48 presentResult removed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace('function presentResult(', 'function presentResultX(')), 'present fn intact');
// 49. Solve details removed.
expectCheckFail('N49 solve details removed', dir => writeFrag(dir, RESULTS_FILE, readFrag(dir, RESULTS_FILE).replace('function solveDetailsHTML(', 'function solveDetailsHTMLX(')), 'solve details fn intact');
// 50. Result DOM order changed — reorder two functions in the results fragment.
expectCheckFail('N50 result DOM order changed', dir => {
  const t = readFrag(dir, RESULTS_FILE);
  // Actually reorder two generated result rows: move the model-type row before the
  // status row, breaking the fixed status -> modelType -> proven DOM order.
  const statusLine = "    rows.push([t('sdStatus'), statusName]);\n";
  const modelLine = "    rows.push([t('sdModelType'), typeNames[mt]||typeNames.continuous]);\n";
  let s = t.replace(modelLine, '');
  s = s.replace(statusLine, modelLine + statusLine);
  writeFrag(dir, RESULTS_FILE, s);
}, 'result details row order (status < modelType < proven)');
// 51. Asset version changed.
expectCheckFail('N51 asset version changed', dir => writeSolver(dir, readSolver(dir).replace('plumline.css?v=21', 'plumline.css?v=777')), 'css version intact');
// 52. Request added.
expectCheckFail('N52 request added', dir => writeSolver(dir, readSolver(dir).replace('</body>', '<script src="assets/extra.js"></script></body>')), 'requests unchanged (6)');
// 53. Residual placeholder (marker-shaped token in a fragment).
expectCheckFail('N53 residual placeholder', dir => fs.appendFileSync(fragPath(dir, ORCH_FILE), '\n  /* SOLVER_UI_SOLVE_ORCHESTRATION_START:x */\n'), 'residual SOLVER_UI marker after composition');
// 54. Engine modified by one byte.
expectCheckFail('N54 engine one-byte change', dir => {
  const ep = engineSrcPath(dir);
  const e = fs.readFileSync(ep, 'utf8');
  fs.writeFileSync(ep, e.slice(0, 200) + ' ' + e.slice(200));
}, 'engine bytes canonical');
// 55. D1 fragment modified.
expectCheckFail('N55 D1 fragment modified', dir => fs.appendFileSync(fragPath(dir, D1_FILE), '\n/* stray */\n'), 'fragment grid-interaction.js bytes match golden');
// 56. D2 fragment modified.
expectCheckFail('N56 D2 fragment modified', dir => fs.appendFileSync(fragPath(dir, D2_FILE), '\n/* stray */\n'), 'fragment variable-settings.js bytes match golden');

// 57. Runs from a path containing a space.
(function () {
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline d3 space-'));
  try {
    makeTree(spaced);
    ok('N57 spaced path: clean tree passes', checkSolverExecutionInterface(spaced).fail === 0,
      'fail=' + checkSolverExecutionInterface(spaced).fail);
    writeFrag(spaced, ORCH_FILE, readFrag(spaced, ORCH_FILE).replace('function runSolve(', 'function runSolveX('));
    ok('N57 spaced path: mutation trips the checker', checkSolverExecutionInterface(spaced).fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
})();

console.log('SOLVER EXECUTION NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
