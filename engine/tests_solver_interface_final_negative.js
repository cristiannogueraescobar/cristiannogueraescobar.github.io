/* tests_solver_interface_final_negative.js — Checkpoint D5 final integration negatives.
 *
 * These do NOT repeat every D1–D4 negative; they cover the INTEGRATION gaps that
 * only the cumulative checker owns: global region order, the D5 bootstrap fragment,
 * and the publication contract. Each copies the source + ALL fragments + the D5
 * golden into a temp tree, mutates ONE thing, runs the OFFICIAL composer or
 * checkSolverInterfaceFinal, asserts a specific failure, and cleans up in finally.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { checkSolverInterfaceFinal } = require('./tests_solver_interface_final.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const SITE = path.join(__dirname, '..');
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const FIX_REL = path.join('engine', 'fixtures', 'solver-ui-golden');
const SOLVER = 'solver' + '.html';
const BOOT_FILE = 'bootstrap-accessibility.js';
const D1_FILE = 'grid-interaction.js';

function makeTree(root) {
  const dir = root || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-d5-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, FIX_REL), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'shared'), { recursive: true });
  fs.copyFileSync(path.join(SITE, SOLVER), path.join(dir, SOLVER));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  for (const f of fs.readdirSync(path.join(SITE, FIX_REL))) {
    fs.copyFileSync(path.join(SITE, FIX_REL, f), path.join(dir, FIX_REL, f));
  }
  fs.copyFileSync(path.join(SITE, 'src', 'shared', 'compose-solver.js'), path.join(dir, 'src', 'shared', 'compose-solver.js'));
  return dir;
}
const readSolver = dir => fs.readFileSync(path.join(dir, SOLVER), 'utf8');
const writeSolver = (dir, s) => fs.writeFileSync(path.join(dir, SOLVER), s);
const bootPath = dir => path.join(dir, FRAG_DIR, BOOT_FILE);
const readBoot = dir => fs.readFileSync(bootPath(dir), 'utf8');
const writeBoot = (dir, s) => fs.writeFileSync(bootPath(dir), s);

function composeResult(dir) {
  // Load the composer FROM THE TEMP TREE with a fresh require, so registry
  // mutations (N2/N4) are exercised against the mutated compose-solver.js.
  const composerAbs = path.join(dir, 'src', 'shared', 'compose-solver.js');
  try {
    delete require.cache[require.resolve(composerAbs)];
    const compose = require(composerAbs).composeSolverInterface;
    compose(readSolver(dir), dir);
    return { threw: false, message: '' };
  } catch (e) { return { threw: true, message: String(e && e.message || e) }; }
}
function expectThrow(label, mutate, needle) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree composes', !composeResult(dir).threw);
    mutate(dir);
    const r = composeResult(dir);
    ok(label + ': mutation makes composition throw', r.threw, 'did not throw');
    ok(label + ': error mentions "' + needle + '"', r.threw && r.message.indexOf(needle) !== -1, r.message);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function expectCheckFail(label, mutate, expectedFailure) {
  const dir = makeTree();
  try {
    if (typeof expectedFailure !== 'string' || !expectedFailure) {
      ok(label + ': needle provided', false, 'expectCheckFail requires a specific expectedFailure needle');
      return;
    }
    ok(label + ': clean tree passes checker', checkSolverInterfaceFinal(dir).fail === 0);
    mutate(dir);
    const r = checkSolverInterfaceFinal(dir);
    ok(label + ': mutation trips the checker', r.fail > 0);
    ok(label + ': failures is an array', Array.isArray(r.failures));
    ok(label + ': fails with "' + expectedFailure + '"',
      Array.isArray(r.failures) && r.failures.some(m => m.includes(expectedFailure)),
      (r.failures || []).join(' | '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const BOOT_START = '/* SOLVER_UI_BOOTSTRAP_ACCESSIBILITY_START:bootstrap-accessibility.js */';
const BOOT_END = '/* SOLVER_UI_BOOTSTRAP_ACCESSIBILITY_END */';
const LOAD_START = '/* SOLVER_UI_EXAMPLES_LOADING_START:examples-loading.js */';
const GRID_START = '/* SOLVER_UI_GRID_INTERACTION_START:grid-interaction.js */';
const composerPath = dir => path.join(dir, 'src', 'shared', 'compose-solver.js');

// 1. Global region order altered (swap two region markers in the source).
expectCheckFail('N1 global order altered', dir => {
  let h = readSolver(dir);
  h = h.replace(LOAD_START, '\u0000TMP\u0000').replace(GRID_START, LOAD_START).replace('\u0000TMP\u0000', GRID_START);
  writeSolver(dir, h);
}, 'markers must be in order');
// 2. A region omitted from the registry (remove BOOTSTRAP_ACCESSIBILITY from REGIONS).
expectThrow('N2 region omitted from registry', dir => {
  const c = fs.readFileSync(composerPath(dir), 'utf8');
  fs.writeFileSync(composerPath(dir), c.replace(/\n\s*\{ name: 'BOOTSTRAP_ACCESSIBILITY'[^}]*\},/, ''));
}, 'BOOTSTRAP_ACCESSIBILITY');
// 3. Fragment declared in registry but its marker not used in source.
expectThrow('N3 declared but unused', dir => {
  writeSolver(dir, readSolver(dir).replace(BOOT_START + '\n' + BOOT_END + '\n', ''));
}, 'BOOTSTRAP_ACCESSIBILITY');
// 4. Marker used in source but not declared in registry.
expectThrow('N4 used but not declared', dir => {
  const c = fs.readFileSync(composerPath(dir), 'utf8');
  fs.writeFileSync(composerPath(dir), c.replace(/\n\s*\{ name: 'BOOTSTRAP_ACCESSIBILITY'[^}]*\},/, ''));
  // leave the source marker present -> unknown/undeclared region
}, 'BOOTSTRAP_ACCESSIBILITY');
// 5. Bootstrap removed (empty fragment).
expectThrow('N5 bootstrap empty', dir => writeBoot(dir, ''), 'empty');
// 6. Initialization reordered (move the ?ex= init before the listeners).
expectCheckFail('N6 init reordered', dir => {
  const b = readBoot(dir);
  const line = "  loadExample(EXAMPLE_BY_SLUG[_ex] || 'production');";
  writeBoot(dir, b.replace(line, '').replace(BOOT_START, '')); // structural drift -> byte mismatch
  writeBoot(dir, readBoot(dir) + '\n' + line + '\n');
}, 'D5 contract "init order _ex before loadExample" intact');
// 7. Listener duplicated (add a second solve click binding).
expectCheckFail('N7 listener duplicated', dir => writeBoot(dir, readBoot(dir) + "\n  document.getElementById('solve').addEventListener('click',solve);\n"), 'listener "solve" click bound exactly once');
// 8. Drawer listener removed.
expectCheckFail('N8 drawer listener removed', dir => writeBoot(dir, readBoot(dir).replace(/var openEx=[^\n]*\n/, '')), 'bootstrap drawer listener id "openExamples"');
// 9. Escape removed.
expectCheckFail('N9 escape removed', dir => writeBoot(dir, readBoot(dir).replace(/e\.key===.Escape./, 'false')), 'bootstrap Escape keydown');
// 10. Backdrop removed.
expectCheckFail('N10 backdrop removed', dir => writeBoot(dir, readBoot(dir).replace(/var backdrop=[^\n]*\n/, '')), 'bootstrap drawer listener id "exDrawerBackdrop"');
// 11. Focus return removed (openBtn.focus in the drawer fragment's closeDrawer).
expectCheckFail('N11 focus return removed', dir => {
  const p = path.join(dir, FRAG_DIR, 'examples-drawer.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/openBtn\.focus\(\);/, ''));
}, 'D5 contract "focus return openBtn.focus" intact');
// 12. aria-live removed.
expectCheckFail('N12 aria-live removed', dir => writeSolver(dir, readSolver(dir).replace(/\saria-live="[^"]*"/, '')), 'aria attrs intact');
// 13. role=status removed.
expectCheckFail('N13 role=status removed', dir => writeSolver(dir, readSolver(dir).replace(/\srole="status"/, '')), 'role=status intact');
// 14. tabindex changed.
expectCheckFail('N14 tabindex changed', dir => writeBoot(dir, readBoot(dir).replace(/\[tabindex\]/, '[tabindexX]')), 'D5 contract "focusable [tabindex] selector" intact');
// 15. disabled/busy changed (aria-busy in a fragment) — mutate the solve orchestration.
expectCheckFail('N15 busy state changed', dir => {
  const p = path.join(dir, FRAG_DIR, 'solve-orchestration.js');
  const t = fs.readFileSync(p, 'utf8');
  if (/aria-busy|disabled/.test(t)) fs.writeFileSync(p, t.replace(/disabled/, 'disabledX'));
  else writeBoot(dir, readBoot(dir) + '\n/* x */\n');
}, 'D5 contract "busy disabled state" intact');
// 16. Shared id changed (#result).
expectCheckFail('N16 shared id changed', dir => writeSolver(dir, readSolver(dir).replace('id="result"', 'id="resultX"')), 'shared id="result" intact');
// 17. data-i18n removed.
expectCheckFail('N17 data-i18n removed', dir => writeSolver(dir, readSolver(dir).replace(/\sdata-i18n="[^"]*"/, '')), 'data-i18n attribute count intact');
// 18. Foreign-namespace key introduced.
expectCheckFail('N18 foreign namespace key', dir => writeSolver(dir, readSolver(dir).replace('data-i18n="heroTitle"', 'data-i18n="guide.heroTitle"')), 'no foreign-namespace data-i18n key');
// 19. Residual marker (a marker-shaped token left in the bootstrap fragment).
expectCheckFail('N19 residual marker', dir => fs.appendFileSync(bootPath(dir), '\n  /* SOLVER_UI_BOOTSTRAP_ACCESSIBILITY_START:x */\n'), 'residual SOLVER_UI marker after composition');
// 20. Fragment published (bytes drift stand-in).
expectCheckFail('N20 fragment bytes drift', dir => fs.appendFileSync(bootPath(dir), '\n/* stray */\n'), 'fragment bootstrap-accessibility.js bytes match golden');
// 21. Request added.
expectCheckFail('N21 request added', dir => writeSolver(dir, readSolver(dir).replace('</body>', '<script src="assets/extra.js"></script></body>')), 'requests unchanged (6)');
// 22. External script changed.
expectCheckFail('N22 external script changed', dir => writeSolver(dir, readSolver(dir).replace('i18n.js?v=82', 'i18n.js?v=999')), 'exactly the approved external scripts');
// 23. Asset version changed.
expectCheckFail('N23 asset version changed', dir => writeSolver(dir, readSolver(dir).replace('plumline.css?v=21', 'plumline.css?v=555')), 'css version intact');
// 24. Engine modified by one byte.
expectCheckFail('N24 engine one-byte change', dir => {
  const s = readSolver(dir); const at = s.indexOf('/* ENGINE_START */') + 40;
  writeSolver(dir, s.slice(0, at) + ' ' + s.slice(at));
}, 'engine bytes canonical');
// 25. Worker glue modified (in the solve-worker-client fragment).
expectCheckFail('N25 worker glue modified', dir => {
  const p = path.join(dir, FRAG_DIR, 'solve-worker-client.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace("new Blob([src+'\\n'+glue]", "new Blob([src+'\\n\\n'+glue]"));
}, 'D5 contract "worker glue Blob construction" intact');
// 26. Golden fixture with an absolute path (tampered golden must not silently pass).
expectCheckFail('N26 golden tampered', dir => {
  const gp = path.join(dir, FIX_REL, 'solver-interface-d5-final.json');
  const g = JSON.parse(fs.readFileSync(gp, 'utf8'));
  g.composed_total.sha256 = '0'.repeat(64);
  fs.writeFileSync(gp, JSON.stringify(g, null, 2) + '\n');
}, 'composed total sha matches golden');

// 27. Runs from a path containing a space.
(function () {
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline d5 space-'));
  try {
    makeTree(spaced);
    ok('N27 spaced path: clean tree passes', checkSolverInterfaceFinal(spaced).fail === 0,
      'fail=' + checkSolverInterfaceFinal(spaced).fail);
    writeBoot(spaced, readBoot(spaced).replace(/var openEx=[^\n]*\n/, ''));
    const rSpaced = checkSolverInterfaceFinal(spaced);
    ok('N27 spaced path: mutation trips the checker', rSpaced.fail > 0);
    ok('N27 spaced path: fails with specific drawer-listener message',
      Array.isArray(rSpaced.failures) && rSpaced.failures.some(m => m.includes('bootstrap drawer listener id "openExamples"')),
      (rSpaced.failures || []).join(' | '));
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
})();

console.log('SOLVER INTERFACE FINAL NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
