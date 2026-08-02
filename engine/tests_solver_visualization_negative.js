/* tests_solver_visualization_negative.js — Checkpoint D4 negatives.
 *
 * Each case copies the solver source + ALL solver-ui fragments into a temp tree,
 * mutates ONE thing, runs the OFFICIAL composer or
 * checkSolverVisualizationInterface (never a private copy), asserts a specific
 * failure (fail>0 or a thrown error with a specific message), and cleans up in
 * finally. No deliberately-green negative. Example MATH is protected externally by
 * tests_examples / tests_ex_drawer (this checker deliberately does not inspect it),
 * so no example-math case is presented here as a D4 negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { checkSolverVisualizationInterface } = require('./tests_solver_visualization.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const SITE = path.join(__dirname, '..');
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const SOLVER = 'solver' + '.html';
const LOADING_FILE = 'examples-loading.js';
const RPE_FILE = 'receipt-plot-exports.js';
const DRAWER_FILE = 'examples-drawer.js';
const D1_FILE = 'grid-interaction.js';
const D2_FILE = 'variable-settings.js';
const D3_FILE = 'solve-orchestration.js';

function makeTree(root) {
  const dir = root || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-d4-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'solver-ui-golden'), { recursive: true });
  fs.copyFileSync(path.join(SITE, SOLVER), path.join(dir, SOLVER));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  fs.copyFileSync(
    path.join(SITE, 'engine', 'fixtures', 'solver-ui-golden', 'solver-visualization-d4.json'),
    path.join(dir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-visualization-d4.json'));
  return dir;
}
const readSolver = dir => fs.readFileSync(path.join(dir, SOLVER), 'utf8');
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
    ok(label + ': clean tree passes checker', checkSolverVisualizationInterface(dir).fail === 0);
    mutate(dir);
    const r = checkSolverVisualizationInterface(dir);
    ok(label + ': mutation trips the checker', r.fail > 0);
    ok(label + ': failures is an array', Array.isArray(r.failures));
    ok(label + ': fails with "' + expectedFailure + '"',
      Array.isArray(r.failures) && r.failures.some(m => m.includes(expectedFailure)),
      (r.failures || []).join(' | '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const RPE_START = '/* SOLVER_UI_RECEIPT_PLOT_EXPORTS_START:receipt-plot-exports.js */';
const RPE_END = '/* SOLVER_UI_RECEIPT_PLOT_EXPORTS_END */';
const LOAD_START = '/* SOLVER_UI_EXAMPLES_LOADING_START:examples-loading.js */';
const DRAWER_START = '/* SOLVER_UI_EXAMPLES_DRAWER_START:examples-drawer.js */';
const DRAWER_END = '/* SOLVER_UI_EXAMPLES_DRAWER_END */';
const D1_START = '/* SOLVER_UI_GRID_INTERACTION_START:grid-interaction.js */';
const D2_START = '/* SOLVER_UI_VARIABLE_SETTINGS_START:variable-settings.js */';
const D3_START = '/* SOLVER_UI_SOLVE_ORCHESTRATION_START:solve-orchestration.js */';

// 1. D4 marker absent.
expectThrow('N1 D4 marker absent', dir => writeSolver(dir, readSolver(dir).replace(RPE_START + '\n', '')), 'unbalanced');
// 2. D4 marker duplicated.
expectThrow('N2 D4 marker duplicated', dir => writeSolver(dir, readSolver(dir).replace(RPE_START, RPE_START + '\n' + RPE_START)), 'unbalanced');
// 3. D4 markers inverted.
expectThrow('N3 D4 markers inverted', dir => writeSolver(dir, readSolver(dir).replace(RPE_START + '\n' + RPE_END, RPE_END + '\n' + RPE_START)), 'END before START');
// 4. D4 overlaps D1.
expectThrow('N4 D4 overlaps D1', dir => writeSolver(dir, readSolver(dir).replace(D1_START, D1_START + '\n' + RPE_START)), 'unbalanced');
// 5. D4 overlaps D2.
expectThrow('N5 D4 overlaps D2', dir => writeSolver(dir, readSolver(dir).replace(D2_START, D2_START + '\n' + RPE_START)), 'unbalanced');
// 6. D4 overlaps D3.
expectThrow('N6 D4 overlaps D3', dir => writeSolver(dir, readSolver(dir).replace(D3_START, D3_START + '\n' + RPE_START)), 'unbalanced');
// 7. Marker inside the engine region.
expectThrow('N7 marker inside engine', dir => {
  const s = readSolver(dir); const at = s.indexOf('/* ENGINE_START */') + '/* ENGINE_START */'.length;
  writeSolver(dir, s.slice(0, at) + '\n' + RPE_START + '\n' + RPE_END + '\n' + s.slice(at));
}, 'inside the engine region');
// 8. Unknown fragment name.
expectThrow('N8 unknown fragment name', dir => writeSolver(dir, readSolver(dir).replace(RPE_START, '/* SOLVER_UI_NOPE_START:receipt-plot-exports.js */').replace(RPE_END, '/* SOLVER_UI_NOPE_END */')), 'unknown');
// 9. Fragment missing.
expectThrow('N9 fragment missing', dir => fs.rmSync(fragPath(dir, RPE_FILE)), 'not found');
// 10. Fragment empty.
expectThrow('N10 fragment empty', dir => writeFrag(dir, RPE_FILE, ''), 'empty');
// 11. Path traversal.
expectThrow('N11 path traversal', dir => writeSolver(dir, readSolver(dir).replace('receipt-plot-exports.js */', '../../../etc/passwd */')), 'compose-solver');
// 12. Absolute path.
expectThrow('N12 absolute path', dir => writeSolver(dir, readSolver(dir).replace('receipt-plot-exports.js */', '/etc/passwd */')), 'compose-solver');
// 13. Unauthorized subdirectory.
expectThrow('N13 subdirectory', dir => writeSolver(dir, readSolver(dir).replace('receipt-plot-exports.js */', 'sub/receipt-plot-exports.js */')), 'compose-solver');
// 14. Residual content between markers.
expectThrow('N14 residual content', dir => writeSolver(dir, readSolver(dir).replace(RPE_START + '\n' + RPE_END, RPE_START + '\nLEFTOVER\n' + RPE_END)), 'unexpected content');
// 15. Fragment published (bytes drift stand-in).
expectCheckFail('N15 fragment bytes drift', dir => fs.appendFileSync(fragPath(dir, RPE_FILE), '\n/* stray */\n'), 'fragment receipt-plot-exports.js bytes match golden');
// 16. Script src added.
expectCheckFail('N16 new script src', dir => writeSolver(dir, readSolver(dir).replace('</head>', '<script src="assets/plot.js"></script></head>')), 'requests unchanged (6)');
// 17. D4 function removed.
expectCheckFail('N17 D4 fn removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function drawFeasibleRegion(', 'function drawFeasibleRegionX(')), 'D4 fn drawFeasibleRegion present exactly once');
// 18. D4 function duplicated.
expectCheckFail('N18 D4 fn duplicated', dir => writeSolver(dir, readSolver(dir).replace(RPE_END, RPE_END + '\n  function exportCSV(){}')), 'D4 fn exportCSV present exactly once');
// 19. D5/shared util (esc) moved into a D4 fragment.
expectCheckFail('N19 shared util in D4 fragment', dir => fs.appendFileSync(fragPath(dir, RPE_FILE), '\n  function esc(s){return s;}\n'), 'shared util esc NOT in any D4 fragment');
// 20. Engine math copied into a D4 fragment.
expectCheckFail('N20 math fn in D4 fragment', dir => fs.appendFileSync(fragPath(dir, RPE_FILE), '\n  function solveLinearProgram_(){}\n'), 'engine math fn solveLinearProgram_ NOT in any fragment');
// 21. renderReceipt removed.
expectCheckFail('N21 renderReceipt removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function renderReceipt(', 'function renderReceiptX(')), 'renderReceipt present');
// 22. Plot integration removed (drawFeasibleRegion call in renderReceipt).
expectCheckFail('N22 plot integration removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('drawFeasibleRegion(out)', 'void 0')), 'D4 contract "plot drawFeasibleRegion(out)" intact');
// 23. Export integration removed (exp-csv wiring).
expectCheckFail('N23 export integration removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/exp-csv/g, 'exp-csvX')), 'exp-csv export listener bound exactly once');
// 24. Geometry helper removed.
expectCheckFail('N24 geometry helper removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function clipFeasibleToBox_(', 'function clipFeasibleToBox_X(')), 'D4 fn clipFeasibleToBox_ present exactly once');
// 25. Geometry constant changed.
expectCheckFail('N25 geometry constant changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/ANGULAR_EPS/g, 'ANGULAR_EPSX')), 'D4 contract "geometry ANGULAR_EPS" intact');
// 26. SVG changed (a byte in the plot SVG output).
expectCheckFail('N26 SVG changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/viewBox/, 'viewbox')), 'D4 contract "SVG viewBox" intact');
// 27. viewBox changed (numeric).
expectCheckFail('N27 viewBox changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('viewBox="0 0 \'+W+\' \'+H+\'"', 'viewBox="0 0 100 100"')), 'D4 contract "SVG viewBox attribute value" intact');
// 28. Clipping removed.
expectCheckFail('N28 clipping removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('var clip = clipFeasibleToBox_(cons, maxX, maxY)', 'var clip = cons')), 'D4 contract "clipping pipeline call" intact');
// 29. unbounded/open state changed (solve2D geometry).
expectCheckFail('N29 unbounded state changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('var openClass = geo.unbounded', 'var openClass = false')), 'D4 contract "open/unbounded state control" intact');
// 30. Optimal point removed (addWorkedSteps).
expectCheckFail('N30 optimal point marker removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace("&larr; '+t('best')", "''")), 'D4 contract "optimal point marker (worked steps)" intact');
// 31. Drawer removed.
expectCheckFail('N31 drawer removed', dir => writeFrag(dir, DRAWER_FILE, readFrag(dir, DRAWER_FILE).replace('function renderExamplesDrawer(', 'function renderExamplesDrawerX(')), 'drawer render fn renderExamplesDrawer present');
// 32. Open listener removed (openDrawer fn).
expectCheckFail('N32 open fn removed', dir => writeFrag(dir, DRAWER_FILE, readFrag(dir, DRAWER_FILE).replace('function openDrawer(', 'function openDrawerX(')), 'drawer open fn openDrawer present');
// 33. Close listener removed (closeDrawer fn).
expectCheckFail('N33 close fn removed', dir => writeFrag(dir, DRAWER_FILE, readFrag(dir, DRAWER_FILE).replace('function closeDrawer(', 'function closeDrawerX(')), 'drawer close fn closeDrawer present');
// 34. Escape handling removed (keydown Escape in source bootstrap).
// 34. Escape handling removed (the drawer keydown/Escape handler now lives in the
//     D5 bootstrap-accessibility fragment).
expectCheckFail('N34 escape removed', dir => {
  const p = fragPath(dir, 'bootstrap-accessibility.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/e\.key===.Escape./, 'false'));
}, 'drawer Escape handler intact');
// 35. Focus altered (backgroundEls focus management).
expectCheckFail('N35 focus altered', dir => writeFrag(dir, DRAWER_FILE, readFrag(dir, DRAWER_FILE).replace('function backgroundEls(', 'function backgroundElsX(')), 'D4 fn backgroundEls present exactly once');
// 36. Category order changed (CATEGORY_ORDER reference in drawer).
expectCheckFail('N36 category order changed', dir => writeFrag(dir, DRAWER_FILE, readFrag(dir, DRAWER_FILE).replace(/CATEGORY_ORDER/g, 'CATEGORY_ORDERX')), 'D4 contract "category order CATEGORY_ORDER" intact');
// 37. Slug resolver changed (EXAMPLE_BY_SLUG in loading fragment).
expectCheckFail('N37 slug resolver changed', dir => writeFrag(dir, LOADING_FILE, readFrag(dir, LOADING_FILE).replace(/EXAMPLE_BY_SLUG/g, 'EXAMPLE_BY_SLUGX')), 'D4 contract "slug resolver EXAMPLE_BY_SLUG" intact');
// 38. ?ex= format changed (updateExampleUrl).
expectCheckFail('N38 ex param changed', dir => writeFrag(dir, LOADING_FILE, readFrag(dir, LOADING_FILE).replace(/\?ex=/g, '?example=')), 'url param ?ex= present');
// 39. Example loader removed.
expectCheckFail('N39 loadExample removed', dir => writeFrag(dir, LOADING_FILE, readFrag(dir, LOADING_FILE).replace('function loadExample(', 'function loadExampleX(')), 'example loader loadExample present');
// 40. updateExampleUrl removed.
expectCheckFail('N40 updateExampleUrl removed', dir => writeFrag(dir, LOADING_FILE, readFrag(dir, LOADING_FILE).replace('function updateExampleUrl(', 'function updateExampleUrlX(')), 'example url fn updateExampleUrl present');
// 41. examples-data.js reference removed.
expectCheckFail('N41 examples-data ref removed', dir => writeSolver(dir, readSolver(dir).replace(/examples-data\.js/g, 'examples-dataX.js')), 'exactly the approved external scripts');
// 42. CSV export removed.
expectCheckFail('N42 CSV export removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function exportCSV(', 'function exportCSVX(')), 'export CSV fn present');
// 43. CSV mime changed.
expectCheckFail('N43 CSV mime changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('text/csv', 'text/plainX')), 'D4 contract "CSV mime text/csv" intact');
// 44. CSV escaping removed (safeCsvText_).
expectCheckFail('N44 CSV escaping removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function safeCsvText_(', 'function safeCsvText_X(')), 'D4 fn safeCsvText_ present exactly once');
// 45. XLS export removed.
expectCheckFail('N45 XLS export removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function exportExcel(', 'function exportExcelX(')), 'export XLS fn present');
// 46. XLS mime changed.
expectCheckFail('N46 XLS mime changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('application/vnd', 'application/vndX')), 'D4 contract "XLS mime application/vnd" intact');
// 47. TXT export removed (copySummary).
expectCheckFail('N47 TXT export removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function copySummary(', 'function copySummaryX(')), 'export TXT fn present');
// 48. File extension changed (download filename).
expectCheckFail('N48 file extension changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/plumline-solution\.txt/, 'plumline-solution.text')), 'D4 contract "file ext plumline-solution.txt" intact');
// 49. Filename changed.
expectCheckFail('N49 filename changed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/plumline-solution/, 'plumline-resultX')), 'D4 contract "filename plumline-solution" intact');
// 50. download fn removed.
expectCheckFail('N50 download fn removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace('function download(', 'function downloadX(')), 'download fn present');
// 51. Blob removed (in download).
expectCheckFail('N51 Blob removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/new Blob/, 'newBlobX')), 'D4 contract "export Blob" intact');
// 52. revokeObjectURL removed.
expectCheckFail('N52 revokeObjectURL removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/revokeObjectURL/g, 'revokeX')), 'D4 contract "export revokeObjectURL" intact');
// 53. download attribute removed.
expectCheckFail('N53 download attribute removed', dir => writeFrag(dir, RPE_FILE, readFrag(dir, RPE_FILE).replace(/\.download\s*=/, '.downloadX=')), 'D4 contract "download attribute assignment" intact');
// 54. Export listener duplicated (a second exportCSV binding).
expectCheckFail('N54 export listener duplicated', dir => writeSolver(dir, readSolver(dir).replace('</body>', "<script>document.getElementById('exp-csv')&&document.getElementById('exp-csv').addEventListener('click',function(){});</script></body>")), 'exp-csv export listener bound exactly once');
// 55. data-i18n removed.
expectCheckFail('N55 data-i18n removed', dir => writeSolver(dir, readSolver(dir).replace(/\sdata-i18n="[^"]*"/, '')), 'data-i18n attribute count intact');
// 56. ARIA removed.
expectCheckFail('N56 aria removed', dir => writeSolver(dir, readSolver(dir).replace(/\saria-[a-z]+="[^"]*"/, '')), 'aria attrs intact');
// 57. Asset version changed.
expectCheckFail('N57 asset version changed', dir => writeSolver(dir, readSolver(dir).replace('plumline.css?v=21', 'plumline.css?v=666')), 'css version intact');
// 58. Request added.
expectCheckFail('N58 request added', dir => writeSolver(dir, readSolver(dir).replace('</body>', '<script src="assets/extra.js"></script></body>')), 'requests unchanged (6)');
// 59. Residual placeholder (marker-shaped token in fragment).
expectCheckFail('N59 residual placeholder', dir => fs.appendFileSync(fragPath(dir, RPE_FILE), '\n  /* SOLVER_UI_RECEIPT_PLOT_EXPORTS_START:x */\n'), 'residual SOLVER_UI marker after composition');
// 60. Engine modified by one byte.
expectCheckFail('N60 engine one-byte change', dir => {
  const s = readSolver(dir); const at = s.indexOf('/* ENGINE_START */') + 40;
  writeSolver(dir, s.slice(0, at) + ' ' + s.slice(at));
}, 'engine bytes canonical');
// 61. D1 fragment modified.
expectCheckFail('N61 D1 fragment modified', dir => fs.appendFileSync(fragPath(dir, D1_FILE), '\n/* stray */\n'), 'fragment grid-interaction.js bytes match golden');
// 62. D2 fragment modified.
expectCheckFail('N62 D2 fragment modified', dir => fs.appendFileSync(fragPath(dir, D2_FILE), '\n/* stray */\n'), 'fragment variable-settings.js bytes match golden');
// 63. D3 fragment modified.
expectCheckFail('N63 D3 fragment modified', dir => fs.appendFileSync(fragPath(dir, D3_FILE), '\n/* stray */\n'), 'fragment solve-orchestration.js bytes match golden');

// 64. Runs from a path containing a space.
(function () {
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline d4 space-'));
  try {
    makeTree(spaced);
    ok('N64 spaced path: clean tree passes', checkSolverVisualizationInterface(spaced).fail === 0,
      'fail=' + checkSolverVisualizationInterface(spaced).fail);
    writeFrag(spaced, RPE_FILE, readFrag(spaced, RPE_FILE).replace('function exportCSV(', 'function exportCSVX('));
    ok('N64 spaced path: mutation trips the checker', checkSolverVisualizationInterface(spaced).fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
})();

console.log('SOLVER VISUALIZATION NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
