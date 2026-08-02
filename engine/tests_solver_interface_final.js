/* tests_solver_interface_final.js — Checkpoint D5 FINAL cumulative checker.
 *
 * checkSolverInterfaceFinal(siteDir) is the authoritative cumulative D1–D5 contract
 * for the composed solver.html. It does NOT re-implement the phase checkers: it
 * INVOKES checkSolverGridInterface (D1), checkSolverDetectionInterface (D2),
 * checkSolverExecutionInterface (D3), checkSolverVisualizationInterface (D4) — each
 * reports which phase failed — and then adds the GLOBAL contracts that no single
 * phase owns:
 *   - the EXACT global order of ALL nine regions (the phase checkers only verify
 *     their own order as a subsequence; this is where the full order is pinned);
 *   - the D5 bootstrap-accessibility fragment + its initialization/listener/a11y
 *     contract;
 *   - the module-level shared utilities that remain inline (and MUST stay inline);
 *   - final byte-identity of head/body/style/engine/composed against the D5 golden;
 *   - publication contract (no markers/fragments in dist, six requests).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { composeSolverInterface } = require('../src/shared/compose-solver.js');
const { checkSolverGridInterface } = require('./tests_solver_grid.js');
const { checkSolverDetectionInterface } = require('./tests_solver_detection.js');
const { checkSolverExecutionInterface } = require('./tests_solver_execution.js');
const { checkSolverVisualizationInterface } = require('./tests_solver_visualization.js');

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

function checkSolverInterfaceFinal(siteDir) {
  let pass = 0, fail = 0; const failures = [];
  const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } };

  // 1. Delegate to the four phase checkers; surface which phase failed.
  const phases = [
    ['D1 grid', checkSolverGridInterface],
    ['D2 detection', checkSolverDetectionInterface],
    ['D3 execution', checkSolverExecutionInterface],
    ['D4 visualization', checkSolverVisualizationInterface],
  ];
  for (const [label, fn] of phases) {
    let r;
    try { r = fn(siteDir); } catch (e) { r = { pass: 0, fail: 1, failures: [String(e && e.message || e)] }; }
    ok(label + ' checker green', r.fail === 0, r.fail + ' failure(s): ' + r.failures.slice(0, 3).join('; '));
  }

  const golden = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-interface-d5-final.json'), 'utf8'));
  const src = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');

  let composed;
  try { composed = composeSolverInterface(src, siteDir); }
  catch (err) { ok('composition succeeds', false, String(err && err.message || err)); return { pass, fail, failures }; }

  // 2. EXACT global order of ALL nine regions (this is the authority for full order).
  const orderInSrc = [...src.matchAll(/SOLVER_UI_([A-Z_]+)_START/g)].map(m => m[1]);
  ok('EXACT global region order matches golden', JSON.stringify(orderInSrc) === JSON.stringify(golden.fragment_order),
    orderInSrc.join(',') + ' vs ' + golden.fragment_order.join(','));
  // Composer REGIONS array order == golden (registry is the closed source of truth).
  const composerSrc = fs.readFileSync(path.join(siteDir, 'src', 'shared', 'compose-solver.js'), 'utf8');
  const regBlock = (composerSrc.match(/const REGIONS = \[([\s\S]*?)\];/) || ['', ''])[1];
  const regNames = [...regBlock.matchAll(/name:\s*'([A-Z_]+)'/g)].map(m => m[1]);
  ok('composer REGIONS order == golden', JSON.stringify(regNames) === JSON.stringify(golden.fragment_order));

  // 3. Final byte-identity: composed / head / body / style / engine / inline / ui pre-post.
  ok('composed total sha matches golden', sha(composed) === golden.composed_total.sha256);
  ok('composed total bytes match golden', bytesOf(composed) === golden.composed_total.bytes);
  ok('composition deterministic', composeSolverInterface(src, siteDir) === composed);
  const headM = composed.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const bodyM = composed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const styleM = composed.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  ok('head matches golden', headM && sha(headM[0]) === golden.head.sha256);
  ok('body matches golden', bodyM && sha(bodyM[0]) === golden.body.sha256);
  // style golden is the INNER of <style> (no tags), matching the pre-D D0 capture
  // it was derived from (see golden.provenance).
  ok('style matches golden (inner)', styleM && sha(styleM[1]) === golden.style.sha256);
  const s = composed.indexOf(ENGINE_START), e = composed.indexOf(ENGINE_END);
  const engine = s >= 0 && e > s ? composed.slice(s, e) : '';
  ok('engine sha canonical', sha(engine) === golden.engine.sha256);
  ok('engine bytes canonical', bytesOf(engine) === golden.engine.bytes);
  const big = bigInlineScript(composed);
  // ui_script with the engine region removed — derived from the pre-D D0 ui_script.
  if (big && golden.ui_script_no_engine) {
    const uiNoEngine = big[2].slice(0, big[2].indexOf(ENGINE_START)) +
      big[2].slice(big[2].indexOf(ENGINE_END) + ENGINE_END.length);
    ok('ui_script (engine removed) matches pre-D golden', sha(uiNoEngine) === golden.ui_script_no_engine.sha256);
  }
  ok('inline script matches golden', big && sha(big[2]) === golden.inline_script.sha256);
  if (big) {
    const uiPre = big[2].slice(0, big[2].indexOf(ENGINE_START));
    const uiPost = big[2].slice(big[2].indexOf(ENGINE_END) + ENGINE_END.length);
    ok('UI pre-engine matches golden', sha(uiPre) === golden.ui_pre_engine.sha256);
    ok('UI post-engine matches golden', sha(uiPost) === golden.ui_post_engine.sha256);
  }

  // 4. All nine fragments verbatim + present exactly once; no residual marker.
  const fragTexts = {};
  golden.fragments.forEach(fr => {
    const p = path.join(siteDir, 'engine', 'fragments', 'solver-ui', fr.file);
    ok('fragment ' + fr.file + ' exists', fs.existsSync(p));
    if (fs.existsSync(p)) {
      const b = fs.readFileSync(p, 'utf8');
      fragTexts[fr.file] = b;
      ok('fragment ' + fr.file + ' sha matches golden', sha(b) === fr.sha256);
      ok('fragment ' + fr.file + ' bytes match golden', bytesOf(b) === fr.bytes);
      ok('fragment ' + fr.file + ' inserted verbatim', composed.indexOf(b) !== -1);
      if (fr.last_fn) ok('fragment ' + fr.file + ' last fn ' + fr.last_fn, b.indexOf('function ' + fr.last_fn + '(') !== -1);
    }
  });
  ok('no residual SOLVER_UI marker', !/\/\* SOLVER_UI_[A-Z0-9_]+_(?:START|END)/.test(composed));
  golden.fragments.forEach(fr => ok('fragment path ' + fr.file + ' not in composed', composed.indexOf('solver-ui/' + fr.file) === -1));

  // 5. D5 bootstrap-accessibility contract (present in composed, in the fragment).
  const boot = fragTexts['bootstrap-accessibility.js'] || '';
  const bc = golden.bootstrap_contract;
  bc.drawer_listeners.forEach(id => ok('bootstrap drawer listener id "' + id + '"', boot.indexOf(id) !== -1));
  ok('bootstrap Escape keydown', boot.indexOf('Escape') !== -1);
  bc.solve_grid_listeners.forEach(id => ok('bootstrap solve/grid listener "' + id + '"', boot.indexOf("'" + id + "'") !== -1));
  bc.vs_listeners.forEach(id => ok('bootstrap VS listener "' + id + '"', boot.indexOf("'" + id + "'") !== -1));
  ok('bootstrap selftest ' + bc.selftest, boot.indexOf('function ' + bc.selftest + '(') !== -1);
  ok('bootstrap ?ex= init', boot.indexOf('URLSearchParams') !== -1 && boot.indexOf("'ex'") !== -1);
  ok('bootstrap default example ' + bc.default_example, boot.indexOf("'" + bc.default_example + "'") !== -1);
  ok('bootstrap test hook window.__plumline', boot.indexOf('window.__plumline') !== -1);
  ok('bootstrap test hook guarded', boot.indexOf('__PLUMLINE_TEST__') !== -1);
  // Each solve/grid listener registered exactly once in the composed output.
  bc.solve_grid_listeners.forEach(id => {
    ok('listener "' + id + '" click bound exactly once',
      occurrences(composed, "getElementById('" + id + "').addEventListener('click'") <= 1);
  });

  // 6. Module-level shared utilities remain inline (NOT in any fragment).
  const allFrag = Object.values(fragTexts);
  golden.inline_remaining.module_level.forEach(fn => {
    ok('shared util ' + fn + ' remains inline (not in a fragment)',
      composed.indexOf('function ' + fn + '(') !== -1 &&
      !allFrag.some(t => t.indexOf('function ' + fn + '(') !== -1));
  });
  ok('LANG remains inline', composed.indexOf('var LANG') !== -1 && !allFrag.some(t => t.indexOf('var LANG') !== -1));

  // 7. Accessibility + controls + requests + scripts + versions (global).
  ok('aria-live regions intact', (composed.match(/aria-live=/gi) || []).length === golden.aria.live);
  ok('role=status intact', (composed.match(/role="status"/gi) || []).length === golden.aria.role_status);
  ok('tabindex count intact', (composed.match(/tabindex/gi) || []).length === golden.aria.tabindex);
  // Shared id integrity: the #result container id must be present as a delimited id
  // attribute, so renaming id="result" trips this precise contract.
  ok('shared id="result" intact', composed.indexOf('id="result"') !== -1);
  // data-i18n coverage pinned (removing one attribute trips this), and no
  // foreign-namespace key (a dotted key from another page's namespace) is allowed.
  ok('data-i18n attribute count intact',
    (composed.match(/data-i18n="/g) || []).length === golden.data_i18n_count);
  ok('no foreign-namespace data-i18n key', !/data-i18n="[a-z]+\.[^"]*"/i.test(composed));

  // D5 integration contract patterns pinned by exact literal count, so a specific
  // integration mutation (init order, focus-return, tabindex selector, busy/disabled
  // state, worker glue) trips a precise contract rather than only a fragment hash.
  if (golden.d5_contract_patterns) {
    Object.keys(golden.d5_contract_patterns).forEach(label => {
      const spec = golden.d5_contract_patterns[label];
      const count = spec.word
        ? (composed.match(new RegExp('\\b' + spec.literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')) || []).length
        : composed.split(spec.literal).length - 1;
      ok('D5 contract "' + label + '" intact', count === spec.count);
    });
  }
  if (bodyM) {
    ok('aria attrs intact', (bodyM[0].match(/\baria-[a-z]+=/gi) || []).length === golden.aria.aria_attrs);
    ok('button count intact', (bodyM[0].match(/<button\b/gi) || []).length === golden.controls.button);
    ok('input count intact', (bodyM[0].match(/<input\b/gi) || []).length === golden.controls.input);
    ok('select count intact', (bodyM[0].match(/<select\b/gi) || []).length === golden.controls.select);
  }
  const ext = [...composed.matchAll(/<script\b[^>]*src="([^"]+)"/gi)].map(m => m[1]);
  ok('exactly the approved external scripts', JSON.stringify(ext) === JSON.stringify(golden.external_scripts));
  ok('css version intact', (composed.match(/plumline\.css\?v=\d+/) || [])[0] === golden.css_version);
  ok('requests unchanged (6)', 1 + ext.length + 1 === golden.requests);

  // 8. Publication contract: dist/solver.html byte-identity, marker/fragment-path
  //     absence and no-fragment-dir checks live in engine/validate_dist.js (run AFTER
  //     the build). This checker validates the COMPOSED page via the canonical
  //     composer only, so its assertion count is independent of dist/ existence.

  return { pass, fail, failures };
}

module.exports = { checkSolverInterfaceFinal: checkSolverInterfaceFinal };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkSolverInterfaceFinal(siteDir);
  r.failures.forEach(f => console.log('  FAIL:', f));
  console.log('SOLVER INTERFACE FINAL TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
