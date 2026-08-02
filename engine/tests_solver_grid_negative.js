/* tests_solver_grid_negative.js — Checkpoint D1 negatives.
 *
 * Each case copies the solver source + fragment into a temp tree, mutates ONE
 * thing, runs the OFFICIAL composer or checkSolverGridInterface (never a private
 * copy), asserts a specific failure (fail>0 or a thrown error with a specific
 * message), and cleans up in finally. No case is a deliberately-green negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { checkSolverGridInterface } = require('./tests_solver_grid.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const SITE = path.join(__dirname, '..');
const FRAG_REL = path.join('engine', 'fragments', 'solver-ui', 'grid-interaction.js');
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const SOLVER = 'solver' + '.html';

// Build a minimal temp tree with solver source + ALL solver-ui fragments + the
// golden. All fragments are copied so the composer (which the source's markers
// require) succeeds on a clean tree regardless of how many D-phases have landed.
function makeTree(root) {
  const dir = root || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-d1-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'solver-ui-golden'), { recursive: true });
  fs.copyFileSync(path.join(SITE, SOLVER), path.join(dir, SOLVER));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  fs.copyFileSync(
    path.join(SITE, 'engine', 'fixtures', 'solver-ui-golden', 'solver-grid-d1.json'),
    path.join(dir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-grid-d1.json'));
  return dir;
}
const readSolver = dir => fs.readFileSync(path.join(dir, SOLVER), 'utf8');
const writeSolver = (dir, s) => fs.writeFileSync(path.join(dir, SOLVER), s);
const fragPath = dir => path.join(dir, FRAG_REL);

// Run the composer and capture {threw, message}.
function composeResult(dir) {
  try { composeSolverInterface(readSolver(dir), dir); return { threw: false, message: '' }; }
  catch (e) { return { threw: true, message: String(e && e.message || e) }; }
}
// A negative that expects composition to throw with a message containing `frag`.
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
// A negative that expects checkSolverGridInterface to report fail>0.
function expectCheckFail(label, mutate, expectedFailure) {
  const dir = makeTree();
  try {
    if (typeof expectedFailure !== 'string' || !expectedFailure) {
      ok(label + ': needle provided', false, 'expectCheckFail requires a specific expectedFailure needle');
      return;
    }
    ok(label + ': clean tree passes checker', checkSolverGridInterface(dir).fail === 0);
    mutate(dir);
    const r = checkSolverGridInterface(dir);
    ok(label + ': mutation trips the checker', r.fail > 0);
    ok(label + ': failures is an array', Array.isArray(r.failures));
    ok(label + ': fails with "' + expectedFailure + '"',
      Array.isArray(r.failures) && r.failures.some(m => m.includes(expectedFailure)),
      (r.failures || []).join(' | '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const START = '/* SOLVER_UI_GRID_INTERACTION_START:grid-interaction.js */';
const END = '/* SOLVER_UI_GRID_INTERACTION_END */';

// 1. Marker absent.
expectThrow('N1 marker absent', dir => writeSolver(dir, readSolver(dir).replace(START + '\n', '')), 'unbalanced');
// 2. Marker duplicated (a second START with no matching END → unbalanced).
expectThrow('N2 marker duplicated', dir => writeSolver(dir, readSolver(dir).replace(START, START + '\n' + START)), 'unbalanced');
// 2b. Full marker PAIR duplicated (same region twice → duplicate marker).
expectThrow('N2b marker pair duplicated', dir => {
  writeSolver(dir, readSolver(dir).replace(START + '\n' + END, START + '\n' + END + '\n' + START + '\n' + END));
}, 'duplicate');
// 3. Markers out of order (END before START).
expectThrow('N3 markers out of order', dir => {
  writeSolver(dir, readSolver(dir).replace(START + '\n' + END, END + '\n' + START));
}, 'END before START');
// 4. Unknown marker name.
expectThrow('N4 unknown marker', dir => {
  writeSolver(dir, readSolver(dir).replace(START, '/* SOLVER_UI_BOGUS_START:grid-interaction.js */')
    .replace(END, '/* SOLVER_UI_BOGUS_END */'));
}, 'unknown');
// 5. Fragment file missing.
expectThrow('N5 fragment missing', dir => fs.rmSync(fragPath(dir)), 'not found');
// 6. Fragment empty.
expectThrow('N6 fragment empty', dir => fs.writeFileSync(fragPath(dir), ''), 'empty');
// 7. Path traversal in the declared fragment.
expectThrow('N7 path traversal', dir => {
  writeSolver(dir, readSolver(dir)
    .replace('grid-interaction.js */', '../../../etc/passwd */'));
}, 'compose-solver');
// 8. Absolute path in the declared fragment.
expectThrow('N8 absolute path', dir => {
  writeSolver(dir, readSolver(dir).replace('grid-interaction.js */', '/etc/passwd */'));
}, 'compose-solver');
// 9. Fragment name with a subdirectory (outside authorized bare-filename rule).
expectThrow('N9 fragment outside dir', dir => {
  writeSolver(dir, readSolver(dir).replace('grid-interaction.js */', 'sub/grid-interaction.js */'));
}, 'compose-solver');
// 10. Residual placeholder left between markers (unexpected content).
expectThrow('N10 residual content between markers', dir => {
  writeSolver(dir, readSolver(dir).replace(START + '\n' + END, START + '\nLEFTOVER\n' + END));
}, 'unexpected content');
// 11. A marker introduced inside the engine region.
expectThrow('N11 marker inside engine', dir => {
  const s = readSolver(dir);
  const at = s.indexOf('/* ENGINE_START */') + '/* ENGINE_START */'.length;
  writeSolver(dir, s.slice(0, at) + '\n/* SOLVER_UI_GRID_INTERACTION_START:grid-interaction.js */\n/* SOLVER_UI_GRID_INTERACTION_END */\n' + s.slice(at));
}, 'inside the engine region');

// 12. Fragment published under a public dir would be caught by the publication
//     contract; here we assert the checker fails if the fragment sha drifts
//     (a stand-in for "fragment changed / republished with different bytes").
expectCheckFail('N12 fragment bytes drift', dir => {
  fs.appendFileSync(fragPath(dir), '\n/* stray */\n');
}, 'fragment grid-interaction.js bytes match golden');
// 13. New script src added for grid.
expectCheckFail('N13 new grid script src', dir => {
  writeSolver(dir, readSolver(dir).replace('</head>', '<script src="assets/grid.js"></script></head>'));
}, 'no new script src added');
// 14. Mismatched START/END names (nesting/order guard).
expectThrow('N14 mismatched START/END names', dir => {
  writeSolver(dir, readSolver(dir).replace(END, '/* SOLVER_UI_OTHER_END */'));
}, 'does not match');
// 15. A D1 grid function removed from the fragment.
expectCheckFail('N15 grid function removed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace('function render(', 'function renderX('));
}, 'D1 fn render present exactly once');
// 16. A D1 grid function duplicated in the composed output.
expectCheckFail('N16 grid function duplicated', dir => {
  const s = readSolver(dir);
  // append a duplicate render() after the END marker (still in the UI script)
  writeSolver(dir, s.replace(END, END + '\n  function render(){}'));
}, 'D1 fn render present exactly once');
// 17. Grid global renamed (ROWS -> ROWZ) in the fragment breaks byte-identity.
expectCheckFail('N17 grid global renamed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace(/\bROWS\b/, 'ROWZ'));
}, 'grid state global ROWS reference count intact');
// 18. A grid id removed.
expectCheckFail('N18 grid id removed', dir => {
  writeSolver(dir, readSolver(dir).replace('id="grid"', 'id="grid2"'));
}, 'grid id #grid present');
// 19. ARIA removed from the grid region.
expectCheckFail('N19 aria removed', dir => {
  writeSolver(dir, readSolver(dir).replace(/\saria-[a-z]+="[^"]*"/, ''));
}, 'aria attrs intact');
// 20. tabindex changed (the [tabindex] reference now lives in the D5
//     bootstrap-accessibility fragment; the checker catches it via composed
//     byte-identity).
expectCheckFail('N20 tabindex changed', dir => {
  const p = path.join(dir, FRAG_DIR, 'bootstrap-accessibility.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\[tabindex\]/, '[tabindexX]'));
}, 'focusable [tabindex] selector intact');
// 21. Keyboard handler changed (the grid keydown binding now lives in the D5
//     bootstrap-accessibility fragment). Changing a keydown binding trips the
//     composed byte-identity.
expectCheckFail('N21 keyboard handler changed', dir => {
  const p = path.join(dir, FRAG_DIR, 'bootstrap-accessibility.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace("document.addEventListener('keydown'", "document.addEventListener('keyup'"));
}, 'grid keydown handler intact');
// 22. Paste handling removed from the fragment.
expectCheckFail('N22 paste removed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace('function pasteBlock(', 'function pasteBlockX('));
}, 'D1 fn pasteBlock present exactly once');
// 23. Undo removed from the fragment.
expectCheckFail('N23 undo removed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace('function doUndo(', 'function doUndoX('));
}, 'D1 fn doUndo present exactly once');
// 24. addRow/addCol removed.
expectCheckFail('N24 addRow removed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace('function addRow(', 'function addRowX('));
}, 'D1 fn addRow present exactly once');
// 25. delRow/delCol removed.
expectCheckFail('N25 delCol removed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace('function delCol(', 'function delColX('));
}, 'D1 fn delCol present exactly once');
// 26. Asset version changed.
expectCheckFail('N26 asset version changed', dir => {
  writeSolver(dir, readSolver(dir).replace('plumline.css?v=21', 'plumline.css?v=999'));
}, 'css version intact');
// 27. Engine modified by one byte.
expectCheckFail('N27 engine one-byte change', dir => {
  const s = readSolver(dir);
  const at = s.indexOf('/* ENGINE_START */') + 40;
  writeSolver(dir, s.slice(0, at) + ' ' + s.slice(at));
}, 'engine sha canonical');
// 28. CSV import removed from the fragment.
expectCheckFail('N28 CSV import removed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace('function importCSVFile(', 'function importCSVFileX('));
}, 'D1 fn importCSVFile present exactly once');
// 29. sheetFromGrid removed (grid->engine bridge).
expectCheckFail('N29 sheetFromGrid removed', dir => {
  fs.writeFileSync(fragPath(dir), fs.readFileSync(fragPath(dir), 'utf8').replace('function sheetFromGrid(', 'function sheetFromGridX('));
}, 'fragment grid-interaction.js last fn is sheetFromGrid');
// 30. A D2-D5 function pasted INTO the fragment (scope creep).
expectCheckFail('N30 non-D1 function in fragment', dir => {
  fs.appendFileSync(fragPath(dir), '\n  function runSolve(){}\n');
}, 'non-D1 fn runSolve NOT in any fragment');
// 31. External script list changed (drop one of the four).
expectCheckFail('N31 external script dropped', dir => {
  writeSolver(dir, readSolver(dir).replace(/<script src="assets\/build-badge\.js[^"]*"><\/script>/, ''));
}, 'exactly the approved external scripts');
// 32. A request added (extra external script anywhere).
expectCheckFail('N32 extra request added', dir => {
  writeSolver(dir, readSolver(dir).replace('</body>', '<script src="assets/extra.js"></script></body>'));
}, 'requests unchanged (6)');

// 33. Runs from a path containing a space.
(function () {
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline d1 space-'));
  try {
    makeTree(spaced);
    ok('N33 spaced path: clean tree passes', checkSolverGridInterface(spaced).fail === 0,
      'fail=' + checkSolverGridInterface(spaced).fail);
    fs.writeFileSync(fragPath(spaced), fs.readFileSync(fragPath(spaced), 'utf8').replace('function render(', 'function renderX('));
    ok('N33 spaced path: mutation trips the checker', checkSolverGridInterface(spaced).fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
})();

console.log('SOLVER GRID NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
