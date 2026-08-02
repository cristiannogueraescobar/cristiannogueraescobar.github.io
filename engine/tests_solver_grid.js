/* tests_solver_grid.js — Checkpoint D1 official checker for the composed
 * solver.html grid + input-interaction interface.
 *
 * checkSolverGridInterface(siteDir) validates the COMPOSED solver.html (shell +
 * solver-UI composition, the same the build serves) against the independent
 * golden engine/fixtures/solver-ui-golden/solver-grid-d1.json. It is used by BOTH
 * the positive suite (below) and the negative suite
 * (tests_solver_grid_negative.js) so there is ONE checker, never duplicated logic.
 *
 * It asserts: composed output byte-identical to the pre-D baseline; engine region
 * byte-identical; the grid fragment is inserted verbatim and in order; no residual
 * markers; the D1 functions are present exactly once; no D2-D5 function migrated
 * into the fragment; grid ids/controls/aria intact; external scripts and asset
 * versions intact; requests unchanged.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');

const sha = t => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const bytesOf = t => Buffer.byteLength(t, 'utf8');
const ENGINE_START = '/* ENGINE_START */';
const ENGINE_END = '/* ENGINE_END */';

function bigInlineScript(html) {
  const s = html.indexOf(ENGINE_START), e = html.indexOf(ENGINE_END);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  return scripts.find(m => !/\bsrc=/.test(m[1]) && m.index < s && m.index + m[0].length > e);
}

function occurrences(hay, needle) {
  let n = 0, i = 0;
  for (;;) { const j = hay.indexOf(needle, i); if (j === -1) break; n++; i = j + needle.length; }
  return n;
}

function checkSolverGridInterface(siteDir) {
  let pass = 0, fail = 0; const failures = [];
  const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } };

  const golden = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-grid-d1.json'), 'utf8'));
  const src = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');

  // Compose (shell may or may not be present in this repo's solver source; the
  // solver-UI composer is what D1 owns). Composition itself must not throw.
  let composed;
  try { composed = composeSolverInterface(src, siteDir); }
  catch (err) { ok('composition succeeds', false, String(err && err.message || err)); return { pass, fail, failures }; }

  // 1. Composed output byte-identical to the golden baseline.
  ok('composed total sha matches golden', sha(composed) === golden.composed_total.sha256);
  ok('composed total bytes match golden', bytesOf(composed) === golden.composed_total.bytes);

  // 2. Deterministic.
  ok('composition deterministic', composeSolverInterface(src, siteDir) === composed);

  // 3. head / body byte-identical.
  const headM = composed.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const bodyM = composed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  ok('composed head matches golden', headM && sha(headM[0]) === golden.head.sha256);
  ok('composed body matches golden', bodyM && sha(bodyM[0]) === golden.body.sha256);

  // 4. Engine region byte-identical + canonical length/sha.
  const s = composed.indexOf(ENGINE_START), e = composed.indexOf(ENGINE_END);
  const engine = s >= 0 && e > s ? composed.slice(s, e) : '';
  ok('engine region present', s >= 0 && e > s);
  ok('engine sha canonical', sha(engine) === golden.engine.sha256);
  ok('engine length canonical', engine.length === golden.engine.chars);
  ok('engine bytes canonical', bytesOf(engine) === golden.engine.bytes);

  // 5. Inline script + UI pre/post regions byte-identical.
  const big = bigInlineScript(composed);
  ok('inline script matches golden', big && sha(big[2]) === golden.inline_script.sha256);
  if (big) {
    const uiPre = big[2].slice(0, big[2].indexOf(ENGINE_START));
    const uiPost = big[2].slice(big[2].indexOf(ENGINE_END) + ENGINE_END.length);
    ok('UI pre-engine region matches golden', sha(uiPre) === golden.ui_pre_engine.sha256);
    ok('UI post-engine region matches golden', sha(uiPost) === golden.ui_post_engine.sha256);
  }

  // 6. Each fragment inserted verbatim, in order; fragment bytes match golden.
  golden.fragments.forEach(fr => {
    const p = path.join(siteDir, 'engine', 'fragments', 'solver-ui', fr.file);
    ok('fragment ' + fr.file + ' exists', fs.existsSync(p));
    if (fs.existsSync(p)) {
      const b = fs.readFileSync(p, 'utf8');
      ok('fragment ' + fr.file + ' sha matches golden', sha(b) === fr.sha256);
      ok('fragment ' + fr.file + ' bytes match golden', bytesOf(b) === fr.bytes);
      // fragment content is present verbatim in the composed output.
      ok('fragment ' + fr.file + ' inserted verbatim', composed.indexOf(b) !== -1);
      ok('fragment ' + fr.file + ' first fn is ' + fr.first_fn, b.indexOf('function ' + fr.first_fn + '(') !== -1);
      ok('fragment ' + fr.file + ' last fn is ' + fr.last_fn, b.indexOf('function ' + fr.last_fn + '(') !== -1);
    }
  });

  // 7. No residual SOLVER_UI marker after composition.
  ok('no residual SOLVER_UI marker', !/\/\* SOLVER_UI_[A-Z0-9_]+_(?:START|END)/.test(composed));

  // 8. No fragment path string appears in the composed output.
  golden.fragments.forEach(fr => {
    ok('fragment path ' + fr.file + ' not in composed output', composed.indexOf('solver-ui/' + fr.file) === -1);
  });

  // 9. D1 functions present exactly once in the composed inline script.
  golden.d1_functions.forEach(fn => {
    ok('D1 fn ' + fn + ' present exactly once', occurrences(composed, 'function ' + fn + '(') === 1);
  });

  // 10. No D2-D5 function migrated into a fragment (still in the post-engine UI,
  //     not inside any fragment file).
  golden.not_d1_functions.forEach(fn => {
    const inFragment = golden.fragments.some(fr => {
      const p = path.join(siteDir, 'engine', 'fragments', 'solver-ui', fr.file);
      return fs.existsSync(p) && fs.readFileSync(p, 'utf8').indexOf('function ' + fn + '(') !== -1;
    });
    ok('non-D1 fn ' + fn + ' NOT in any fragment', !inFragment);
  });

  // 11. Grid ids present.
  golden.grid_ids.forEach(id => {
    ok('grid id #' + id + ' present', composed.indexOf('id="' + id + '"') !== -1);
  });
  // 11b. Grid state globals intact: the grid functions read the shared ROWS/COLS
  //      state; renaming a reference (e.g. ROWS->ROWZ) drops the pinned count.
  if (golden.grid_state_globals) {
    Object.keys(golden.grid_state_globals).forEach(name => {
      const re = new RegExp('\\b' + name + '\\b', 'g');
      ok('grid state global ' + name + ' reference count intact',
        (composed.match(re) || []).length === golden.grid_state_globals[name]);
    });
  }

  // 12. External scripts + asset versions intact; requests unchanged.
  const ext = [...composed.matchAll(/<script\b[^>]*src="([^"]+)"/gi)].map(m => m[1]);
  ok('exactly the approved external scripts', JSON.stringify(ext) === JSON.stringify(golden.external_scripts));
  ok('four external scripts', ext.length === 4);
  ok('css version intact', (composed.match(/plumline\.css\?v=\d+/) || [])[0] === golden.css_version);
  ok('no new script src added', ext.length === golden.external_scripts.length);
  const requests = 1 /*html*/ + ext.length + 1 /*css*/;
  ok('requests unchanged (6)', requests === golden.requests);

  // 13. Controls + grid aria/tabindex intact.
  if (bodyM) {
    ok('button count intact', (bodyM[0].match(/<button\b/gi) || []).length === golden.controls.button);
    ok('input count intact', (bodyM[0].match(/<input\b/gi) || []).length === golden.controls.input);
    ok('select count intact', (bodyM[0].match(/<select\b/gi) || []).length === golden.controls.select);
    ok('aria attrs intact', (bodyM[0].match(/\baria-[a-z]+=/gi) || []).length === golden.grid_aria.aria_attrs);
    ok('tabindex intact', (bodyM[0].match(/\btabindex=/gi) || []).length === golden.grid_aria.tabindex);
  }
  // 13b. Grid keyboard + focusable-selector contracts (these live in the composed
  //      script, not the body markup): the focus-trap's [tabindex] selector and the
  //      grid keydown binding must both be present intact.
  ok('focusable [tabindex] selector intact', composed.indexOf('[tabindex]') !== -1);
  // Two keydown bindings exist by contract: the grid cell-navigation handler and the
  // drawer Escape handler. Changing either event type drops the count.
  ok('grid keydown handler intact', (composed.match(/addEventListener\(.keydown./g) || []).length === 2);

  // 14. Publication contract: the public dist/solver.html byte-identity, marker
  //     absence, fragment-path absence and no-fragment-dir checks live in
  //     engine/validate_dist.js (run AFTER the build). This checker validates the
  //     COMPOSED page via the canonical composer only, so its assertion count is
  //     independent of whether dist/ exists.

  return { pass, fail, failures };
}

module.exports = { checkSolverGridInterface: checkSolverGridInterface };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkSolverGridInterface(siteDir);
  r.failures.forEach(f => console.log('  FAIL:', f));
  console.log('SOLVER GRID INTERFACE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
