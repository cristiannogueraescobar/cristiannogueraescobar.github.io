/* tests_solver_detection_negative.js — Checkpoint D2 negatives.
 *
 * Each case copies the solver source + ALL solver-ui fragments into a temp tree,
 * mutates ONE thing, runs the OFFICIAL composer or checkSolverDetectionInterface
 * (never a private copy), asserts a specific failure (fail>0 or a thrown error with
 * a specific message), and cleans up in finally. No deliberately-green negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { checkSolverDetectionInterface } = require('./tests_solver_detection.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const SITE = path.join(__dirname, '..');
const FRAG_DIR = path.join('engine', 'fragments', 'solver-ui');
const D2_FILE = 'variable-settings.js';
const D1_FILE = 'grid-interaction.js';
const SOLVER = 'solver' + '.html';

function makeTree(root) {
  const dir = root || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-d2-'));
  fs.mkdirSync(path.join(dir, FRAG_DIR), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'solver-ui-golden'), { recursive: true });
  fs.copyFileSync(path.join(SITE, SOLVER), path.join(dir, SOLVER));
  fs.mkdirSync(path.join(dir, 'engine', 'source'), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'engine', 'source', 'plumline-engine.js'), path.join(dir, 'engine', 'source', 'plumline-engine.js'));
  for (const f of fs.readdirSync(path.join(SITE, FRAG_DIR))) {
    fs.copyFileSync(path.join(SITE, FRAG_DIR, f), path.join(dir, FRAG_DIR, f));
  }
  fs.copyFileSync(
    path.join(SITE, 'engine', 'fixtures', 'solver-ui-golden', 'solver-detection-d2.json'),
    path.join(dir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-detection-d2.json'));
  return dir;
}
const readSolver = dir => fs.readFileSync(path.join(dir, SOLVER), 'utf8');
const engineSrcPath = dir => path.join(dir, 'engine', 'source', 'plumline-engine.js');
const writeSolver = (dir, s) => fs.writeFileSync(path.join(dir, SOLVER), s);
const d2Path = dir => path.join(dir, FRAG_DIR, D2_FILE);
const d1Path = dir => path.join(dir, FRAG_DIR, D1_FILE);
const readD2 = dir => fs.readFileSync(d2Path(dir), 'utf8');
const writeD2 = (dir, s) => fs.writeFileSync(d2Path(dir), s);

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
    ok(label + ': clean tree passes checker', checkSolverDetectionInterface(dir).fail === 0);
    mutate(dir);
    const r = checkSolverDetectionInterface(dir);
    ok(label + ': mutation trips the checker', r.fail > 0);
    ok(label + ': failures is an array', Array.isArray(r.failures));
    ok(label + ': fails with "' + expectedFailure + '"',
      Array.isArray(r.failures) && r.failures.some(m => m.includes(expectedFailure)),
      (r.failures || []).join(' | '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const D2_START = '/* SOLVER_UI_VARIABLE_SETTINGS_START:variable-settings.js */';
const D2_END = '/* SOLVER_UI_VARIABLE_SETTINGS_END */';
const D1_START = '/* SOLVER_UI_GRID_INTERACTION_START:grid-interaction.js */';
const D1_END = '/* SOLVER_UI_GRID_INTERACTION_END */';

// 1. D2 marker absent.
expectThrow('N1 D2 marker absent', dir => writeSolver(dir, readSolver(dir).replace(D2_START + '\n', '')), 'unbalanced');
// 2. D2 marker duplicated (extra START).
expectThrow('N2 D2 marker duplicated', dir => writeSolver(dir, readSolver(dir).replace(D2_START, D2_START + '\n' + D2_START)), 'unbalanced');
// 3. D2 markers inverted (END before START).
expectThrow('N3 D2 markers inverted', dir => writeSolver(dir, readSolver(dir).replace(D2_START + '\n' + D2_END, D2_END + '\n' + D2_START)), 'END before START');
// 4. D2 region overlapping D1 (place a D2 START inside the D1 marker block →
//    an unmatched extra START).
expectThrow('N4 D2 overlaps D1', dir => {
  writeSolver(dir, readSolver(dir).replace(D1_END, D2_START + '\n' + D1_END));
}, 'unbalanced');
// 5. Fragment name not allowed (unknown region).
expectThrow('N5 unknown fragment name', dir => {
  writeSolver(dir, readSolver(dir).replace(D2_START, '/* SOLVER_UI_NOPE_START:variable-settings.js */').replace(D2_END, '/* SOLVER_UI_NOPE_END */'));
}, 'unknown');
// 6. D2 fragment missing.
expectThrow('N6 D2 fragment missing', dir => fs.rmSync(d2Path(dir)), 'not found');
// 7. D2 fragment empty.
expectThrow('N7 D2 fragment empty', dir => fs.writeFileSync(d2Path(dir), ''), 'empty');
// 8. Path traversal.
expectThrow('N8 path traversal', dir => writeSolver(dir, readSolver(dir).replace('variable-settings.js */', '../../../etc/passwd */')), 'compose-solver');
// 9. Absolute path.
expectThrow('N9 absolute path', dir => writeSolver(dir, readSolver(dir).replace('variable-settings.js */', '/etc/passwd */')), 'compose-solver');
// 10. Unauthorized subdirectory.
expectThrow('N10 subdirectory', dir => writeSolver(dir, readSolver(dir).replace('variable-settings.js */', 'sub/variable-settings.js */')), 'compose-solver');
// 11. Residual content between D2 markers.
expectThrow('N11 residual content', dir => writeSolver(dir, readSolver(dir).replace(D2_START + '\n' + D2_END, D2_START + '\nLEFTOVER\n' + D2_END)), 'unexpected content');
// 12. D2 marker inside the engine region.
expectThrow('N12 D2 marker inside engine', dir => {
  const ep = engineSrcPath(dir);
  const e = fs.readFileSync(ep, 'utf8');
  fs.writeFileSync(ep, e.slice(0, 100) + '\n/* SOLVER_UI_VARIABLE_SETTINGS_START:x.js */\n/* SOLVER_UI_VARIABLE_SETTINGS_END */\n' + e.slice(100));
}, 'inside the engine region');
// 13. D1 START marker inside the D2 region (an unmatched extra START).
expectThrow('N13 D1 marker in D2 region', dir => {
  writeSolver(dir, readSolver(dir).replace(D2_END, D1_START + '\n' + D2_END));
}, 'unbalanced');
// 14. D2 fragment bytes drift (stand-in for republished/changed fragment).
expectCheckFail('N14 D2 fragment bytes drift', dir => fs.appendFileSync(d2Path(dir), '\n/* stray */\n'), 'fragment variable-settings.js bytes match golden');
// 15. New script src added for D2.
expectCheckFail('N15 new D2 script src', dir => writeSolver(dir, readSolver(dir).replace('</head>', '<script src="assets/varsettings.js"></script></head>')), 'requests unchanged (6)');
// 16. D2 function removed.
expectCheckFail('N16 D2 fn removed', dir => writeD2(dir, readD2(dir).replace('function detectForPanel(', 'function detectForPanelX(')), 'detection entry fn detectForPanel present');
// 17. D2 function duplicated in composed output.
expectCheckFail('N17 D2 fn duplicated', dir => writeSolver(dir, readSolver(dir).replace(D2_END, D2_END + '\n  function detectForPanel(){}')), 'D2 fn detectForPanel present exactly once');
// 18. Engine detection-math copied into the D2 fragment.
expectCheckFail('N18 math fn copied to D2', dir => fs.appendFileSync(d2Path(dir), '\n  function detectModel_(){}\n'), 'engine math fn detectModel_ NOT defined in any fragment');
// 19. A D3 function moved into the D2 fragment.
expectCheckFail('N19 D3 fn in D2 fragment', dir => fs.appendFileSync(d2Path(dir), '\n  function solve(){}\n'), 'non-D2 fn solve NOT in any fragment');
// 20. D2 global renamed (breaks byte-identity).
expectCheckFail('N20 D2 global renamed', dir => writeD2(dir, readD2(dir).replace(/\bconfirmedObjectiveSig\b/g, 'confirmedObjSigX')), 'D2 contract "confirmedObjectiveSig state var" intact');
// 21. Settings state duplicated (a second varSettings declaration in composed).
expectCheckFail('N21 settings state duplicated', dir => writeSolver(dir, readSolver(dir).replace(D2_END, D2_END + '\n  var varSettings={};')), 'varSettings state declared at most once');
// 22. detectVars listener removed (the bootstrap binding).
expectCheckFail('N22 detectVars listener removed', dir => {
  const p = path.join(dir, FRAG_DIR, 'bootstrap-accessibility.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/getElementById\('detectVars'\)[^;]*addEventListener\('click'[^;]*;/, ''));
}, 'detectVars listener bound exactly once');
// 23. detectVars listener duplicated.
expectCheckFail('N23 detectVars listener duplicated', dir => {
  const s = readSolver(dir);
  const m = s.match(/var\s+\w+\s*=\s*document\.getElementById\('detectVars'\);[^\n]*\n/);
  if (m) writeSolver(dir, s.replace(m[0], m[0] + m[0]));
  else writeSolver(dir, s.replace('</body>', "<script>document.getElementById('detectVars').addEventListener('click',function(){});</script></body>"));
}, 'detectVars listener bound exactly once');
// 24. Variable Settings id changed.
expectCheckFail('N24 VS id changed', dir => writeSolver(dir, readSolver(dir).replace('id="varSettings"', 'id="varSettingsX"')), 'Variable Settings id #varSettings present');
// 25. A variable row helper removed (renderVarPanel).
expectCheckFail('N25 renderVarPanel removed', dir => writeD2(dir, readD2(dir).replace('function renderVarPanel(', 'function renderVarPanelX(')), 'D2 fn renderVarPanel present exactly once');
// 26. Variable order changed — approximated by mutating the settings->bounds order
//     in variableDomains (byte change trips the golden).
expectCheckFail('N26 bounds property order changed', dir => writeD2(dir, readD2(dir).replace('bounds.push({ lower:lo, upper:hi })', 'bounds.push({ upper:hi, lower:lo })')), 'D2 contract "bounds order lower-first" intact');
// 27. continuous option removed.
expectCheckFail('N27 continuous option removed', dir => writeD2(dir, readD2(dir).replace(/'continuous'/, "'continuousX'")), 'type option "continuous" count intact');
// 28. integer option removed.
expectCheckFail('N28 integer option removed', dir => writeD2(dir, readD2(dir).replace(/'integer'/, "'integerX'")), 'type option "integer" count intact');
// 29. binary option removed.
expectCheckFail('N29 binary option removed', dir => writeD2(dir, readD2(dir).replace(/'binary'/, "'binaryX'")), 'type option "binary" count intact');
// 30. A default value changed (cleanBound default).
expectCheckFail('N30 variable default changed', dir => writeD2(dir, readD2(dir).replace("{ type:'continuous', min:0, max:null }", "{ type:'continuous', min:1, max:null }")), 'D2 contract "variable default continuous/0/inf" intact');
// 31. Lower bound field renamed.
expectCheckFail('N31 lower bound renamed', dir => writeD2(dir, readD2(dir).replace(/lower:lo/, 'low:lo')), 'D2 contract "bound lower field" intact');
// 32. Upper bound field renamed.
expectCheckFail('N32 upper bound renamed', dir => writeD2(dir, readD2(dir).replace(/upper:hi/, 'up:hi')), 'D2 contract "bound upper field" intact');
// 33. Bounds validation removed (varError).
expectCheckFail('N33 bounds validation removed', dir => writeD2(dir, readD2(dir).replace('function varError(', 'function varErrorX(')), 'D2 fn varError present exactly once');
// 34. Settings application removed (variableDomains).
expectCheckFail('N34 settings apply removed', dir => writeD2(dir, readD2(dir).replace('function variableDomains(', 'function variableDomainsX(')), 'settings entry fn variableDomains present');
// 35. data-i18n removed from a control.
expectCheckFail('N35 data-i18n removed', dir => writeSolver(dir, readSolver(dir).replace(/\sdata-i18n="[^"]*"/, '')), 'data-i18n attribute count intact');
// 36. Foreign-namespace i18n key introduced (change a real solver data-i18n key to
//     a guide-namespaced one; the body-sha golden catches it).
expectCheckFail('N36 foreign namespace key', dir => writeSolver(dir, readSolver(dir).replace('data-i18n="heroTitle"', 'data-i18n="guide.heroTitle"')), 'no foreign-namespace data-i18n key');
// 37. Raw English string added in the D2 fragment.
expectCheckFail('N37 raw English string added', dir => fs.appendFileSync(d2Path(dir), '\n  var x="Please enter a valid bound";\n'), 'no raw English UI literal in D2 fragment');
// 38. err.message shown directly (added in fragment).
expectCheckFail('N38 err.message shown directly', dir => fs.appendFileSync(d2Path(dir), '\n  function showRaw(e){ document.body.textContent=e.message; }\n'), 'no err.message-to-DOM sink in D2 fragment');
// 39. ARIA removed.
expectCheckFail('N39 aria removed', dir => writeSolver(dir, readSolver(dir).replace(/\saria-[a-z]+="[^"]*"/, '')), 'aria attrs intact');
// 40. tabindex changed.
expectCheckFail('N40 tabindex changed', dir => {
  const p = path.join(dir, FRAG_DIR, 'bootstrap-accessibility.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\[tabindex\]/, '[tabindexX]'));
}, 'focusable [tabindex] selector intact');
// 41. Candidate contract changed (detectedVars field renamed in the fragment).
expectCheckFail('N41 candidate contract changed', dir => writeD2(dir, readD2(dir).replace(/label:labelFor_/, 'name:labelFor_')), 'D2 contract "candidate label field" intact');
// 42. Settings contract property renamed (integer -> intFlag in the return).
expectCheckFail('N42 settings contract renamed', dir => writeD2(dir, readD2(dir).replace('integer: anyInteger', 'intFlag: anyInteger')), 'D2 contract "settings integer return" intact');
// 43. Detector call order changed (detectModel_ call removed/renamed in fragment).
expectCheckFail('N43 detector call renamed', dir => writeD2(dir, readD2(dir).replace('detectModel_(sheet', 'detectModelX_(sheet')), 'D2 contract "detector call detectModel_" intact');
// 44. Engine modified by one byte.
expectCheckFail('N44 engine one-byte change', dir => {
  const ep = engineSrcPath(dir);
  const e = fs.readFileSync(ep, 'utf8');
  fs.writeFileSync(ep, e.slice(0, 200) + ' ' + e.slice(200));
}, 'engine bytes canonical');
// 45. Worker glue modified (buildWorker in post-engine UI).
// 45. Worker glue modified (now in the D3 solve-worker-client fragment; the D2
//     checker still catches it via composed byte-identity).
expectCheckFail('N45 worker glue modified', dir => {
  const p = path.join(dir, FRAG_DIR, 'solve-worker-client.js');
  if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace("new Blob([src+'\\n'+glue]", "new Blob([src+'\\n\\n'+glue]"));
  else writeSolver(dir, readSolver(dir).replace('</body>', '<!--x--></body>'));
}, 'worker glue Blob construction intact');
// 46. D1 fragment modified.
expectCheckFail('N46 D1 fragment modified', dir => fs.appendFileSync(d1Path(dir), '\n/* stray */\n'), 'fragment grid-interaction.js bytes match golden');
// 47. Asset version changed.
expectCheckFail('N47 asset version changed', dir => writeSolver(dir, readSolver(dir).replace('plumline.css?v=21', 'plumline.css?v=888')), 'css version intact');
// 48. Request added.
expectCheckFail('N48 request added', dir => writeSolver(dir, readSolver(dir).replace('</body>', '<script src="assets/extra.js"></script></body>')), 'requests unchanged (6)');
// 49. Residual placeholder after compose (marker-shaped token left in fragment).
expectCheckFail('N49 residual placeholder', dir => fs.appendFileSync(d2Path(dir), '\n  /* SOLVER_UI_VARIABLE_SETTINGS_START:x */\n'), 'residual SOLVER_UI marker after composition');

// 50. Runs from a path containing a space.
(function () {
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline d2 space-'));
  try {
    makeTree(spaced);
    ok('N50 spaced path: clean tree passes', checkSolverDetectionInterface(spaced).fail === 0,
      'fail=' + checkSolverDetectionInterface(spaced).fail);
    writeD2(spaced, readD2(spaced).replace('function detectForPanel(', 'function detectForPanelX('));
    ok('N50 spaced path: mutation trips the checker', checkSolverDetectionInterface(spaced).fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
})();

console.log('SOLVER DETECTION NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
