/* tests_solver_detection.js — Checkpoint D2 official checker for the composed
 * solver.html detection + Variable Settings interface.
 *
 * checkSolverDetectionInterface(siteDir) validates the COMPOSED solver.html
 * (shell + solver-UI composition, D1 grid + D2 detection/variable-settings) against
 * the independent golden solver-detection-d2.json. Used by BOTH the positive suite
 * (below) and tests_solver_detection_negative.js — ONE checker, no duplicated logic.
 *
 * It asserts: composed output byte-identical to the pre-D baseline; engine region
 * byte-identical; the D1 fragment is intact; the D2 region is inserted verbatim and
 * in order; no residual markers; D2 functions present exactly once; NO engine
 * detection-math function copied into a solver-ui fragment; no D3-D5 function
 * migrated into D2; the detection→UI and settings→Solve contracts intact; Variable
 * Settings ids/controls/aria intact; external scripts + asset versions + requests
 * unchanged.
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

function checkSolverDetectionInterface(siteDir) {
  let pass = 0, fail = 0; const failures = [];
  const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } };

  const golden = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-detection-d2.json'), 'utf8'));
  const src = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');

  let composed;
  try { composed = composeSolverInterface(src, siteDir); }
  catch (err) { ok('composition succeeds', false, String(err && err.message || err)); return { pass, fail, failures }; }

  // 1-3. Composed byte-identical + deterministic + head/body.
  ok('composed total sha matches golden', sha(composed) === golden.composed_total.sha256);
  ok('composed total bytes match golden', bytesOf(composed) === golden.composed_total.bytes);
  ok('composition deterministic', composeSolverInterface(src, siteDir) === composed);
  const headM = composed.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const bodyM = composed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  ok('composed head matches golden', headM && sha(headM[0]) === golden.head.sha256);
  ok('composed body matches golden', bodyM && sha(bodyM[0]) === golden.body.sha256);

  // 4. Engine region byte-identical + canonical.
  const s = composed.indexOf(ENGINE_START), e = composed.indexOf(ENGINE_END);
  const engine = s >= 0 && e > s ? composed.slice(s, e) : '';
  ok('engine sha canonical', sha(engine) === golden.engine.sha256);
  ok('engine length canonical', engine.length === golden.engine.chars);
  ok('engine bytes canonical', bytesOf(engine) === golden.engine.bytes);

  // 5. Inline script + UI pre/post regions byte-identical.
  const big = bigInlineScript(composed);
  ok('inline script matches golden', big && sha(big[2]) === golden.inline_script.sha256);
  if (big) {
    const uiPre = big[2].slice(0, big[2].indexOf(ENGINE_START));
    const uiPost = big[2].slice(big[2].indexOf(ENGINE_END) + ENGINE_END.length);
    ok('UI pre-engine matches golden', sha(uiPre) === golden.ui_pre_engine.sha256);
    ok('UI post-engine matches golden', sha(uiPost) === golden.ui_post_engine.sha256);
  }

  // 6. Both fragments verbatim, in order; sha + first/last fn.
  golden.fragments.forEach(fr => {
    const p = path.join(siteDir, 'engine', 'fragments', 'solver-ui', fr.file);
    ok('fragment ' + fr.file + ' exists', fs.existsSync(p));
    if (fs.existsSync(p)) {
      const b = fs.readFileSync(p, 'utf8');
      ok('fragment ' + fr.file + ' sha matches golden', sha(b) === fr.sha256);
      ok('fragment ' + fr.file + ' bytes match golden', bytesOf(b) === fr.bytes);
      ok('fragment ' + fr.file + ' inserted verbatim', composed.indexOf(b) !== -1);
      ok('fragment ' + fr.file + ' first fn ' + fr.first_fn, b.indexOf('function ' + fr.first_fn + '(') !== -1);
      ok('fragment ' + fr.file + ' last fn ' + fr.last_fn, b.indexOf('function ' + fr.last_fn + '(') !== -1);
    }
  });
  // Fragment order: GRID_INTERACTION appears before VARIABLE_SETTINGS in source.
  const iGrid = src.indexOf('SOLVER_UI_GRID_INTERACTION_START');
  const iVars = src.indexOf('SOLVER_UI_VARIABLE_SETTINGS_START');
  ok('D1 fragment marker before D2 in source', iGrid !== -1 && iVars !== -1 && iGrid < iVars);

  // 7. No residual SOLVER_UI marker.
  ok('no residual SOLVER_UI marker', !/\/\* SOLVER_UI_[A-Z0-9_]+_(?:START|END)/.test(composed));
  // 8. No fragment path string in composed output.
  golden.fragments.forEach(fr => {
    ok('fragment path ' + fr.file + ' not in composed', composed.indexOf('solver-ui/' + fr.file) === -1);
  });

  // 9. D2 functions present exactly once in composed.
  golden.d2_functions.forEach(fn => {
    ok('D2 fn ' + fn + ' present exactly once', occurrences(composed, 'function ' + fn + '(') === 1);
  });

  // 10. NO engine detection-math function defined inside any solver-ui fragment.
  const fragTexts = golden.fragments.map(fr => {
    const p = path.join(siteDir, 'engine', 'fragments', 'solver-ui', fr.file);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  });
  golden.math_functions_forbidden_in_fragments.forEach(fn => {
    const inFrag = fragTexts.some(t => t.indexOf('function ' + fn + '(') !== -1);
    ok('engine math fn ' + fn + ' NOT defined in any fragment', !inFrag);
  });

  // 11. No D3-D5 function migrated into a fragment.
  golden.not_d2_functions.forEach(fn => {
    const inFrag = fragTexts.some(t => t.indexOf('function ' + fn + '(') !== -1);
    ok('non-D2 fn ' + fn + ' NOT in any fragment', !inFrag);
  });

  // 12. Detection → UI contract intact (entry fn present, engine entry called,
  //     candidate fields + state var referenced in the composed output).
  const dc = golden.detection_contract;
  ok('detection entry fn ' + dc.entry + ' present', composed.indexOf('function ' + dc.entry + '(') !== -1);
  ok('detection calls engine entry ' + dc.engine_entry, composed.indexOf(dc.engine_entry + '(') !== -1);
  ok('detection state var ' + dc.state_var + ' present', composed.indexOf(dc.state_var) !== -1);
  dc.candidate_fields.forEach(f => {
    ok('candidate field "' + f + '" referenced', new RegExp('\\b' + f + '\\s*:').test(composed) || composed.indexOf(f + ':') !== -1);
  });

  // 13. Settings → Solve contract intact.
  const sc = golden.settings_contract;
  ok('settings entry fn ' + sc.entry + ' present', composed.indexOf('function ' + sc.entry + '(') !== -1);
  sc.returns.forEach(r => ok('settings return field "' + r + '" present', composed.indexOf(r + ':') !== -1));
  sc.bound_fields.forEach(b => ok('bound field "' + b + '" present', composed.indexOf(b + ':') !== -1));

  // 13b. D2 contract patterns pinned by exact form/count, so renaming a specific
  //      identifier or reordering a struct trips a precise contract (not just the
  //      fragment hash). Each entry is a literal substring and its expected count.
  if (golden.d2_contract_patterns) {
    Object.keys(golden.d2_contract_patterns).forEach(label => {
      const spec = golden.d2_contract_patterns[label];
      const count = composed.split(spec.literal).length - 1;
      ok('D2 contract "' + label + '" intact', count === spec.count);
    });
  }
  // 13c. No raw user-facing English literal and no direct err.message-to-DOM sink
  //      inside the D2 fragment (both would bypass the i18n/error-formatting path).
  const d2Frag = golden.fragments.find(fr => fr.file === 'variable-settings.js');
  if (d2Frag) {
    const d2p = path.join(siteDir, 'engine', 'fragments', 'solver-ui', d2Frag.file);
    if (fs.existsSync(d2p)) {
      const d2Text = fs.readFileSync(d2p, 'utf8');
      ok('no raw English UI literal in D2 fragment',
        !/"Please enter[^"]*"|"[A-Z][a-z]+ (a |an |the )?[a-z]+ bound"/.test(d2Text));
      ok('no err.message-to-DOM sink in D2 fragment',
        !/(textContent|innerHTML)\s*=\s*[a-z]+\.message/.test(d2Text));
    }
  }

  // 14. Variable Settings ids + type options + controls + aria intact.
  golden.variable_settings_ids.forEach(id => {
    ok('Variable Settings id #' + id + ' present', composed.indexOf('id="' + id + '"') !== -1);
  });
  golden.type_options.forEach(opt => {
    ok('type option "' + opt + '" present', composed.indexOf(opt) !== -1);
  });
  // Type-option select integrity: each option value must appear the pinned number of
  // times, so renaming even one occurrence trips a specific contract (not just the
  // global hash).
  if (golden.type_option_counts) {
    Object.keys(golden.type_option_counts).forEach(opt => {
      const re = new RegExp("'" + opt + "'", 'g');
      ok('type option "' + opt + '" count intact',
        (composed.match(re) || []).length === golden.type_option_counts[opt]);
    });
  }
  // data-i18n coverage: total count pinned; removing one attribute trips this, and a
  // foreign-namespace key (containing a dot) is rejected outright.
  ok('data-i18n attribute count intact',
    (composed.match(/data-i18n="/g) || []).length === golden.data_i18n_count);
  ok('no foreign-namespace data-i18n key',
    !/data-i18n="[a-z]+\.[^"]*"/i.test(composed));
  // detectVars listener registered exactly once (its binding lives in the bootstrap
  // fragment); removing or duplicating it trips this precise count.
  ok('detectVars listener bound exactly once',
    (composed.match(/getElementById\('detectVars'\)\.addEventListener/g) || []).length === 1);
  // Variable-Settings state variable defined exactly once (duplicate declaration trips).
  ok('varSettings state declared at most once',
    (composed.match(/var varSettings=/g) || []).length <= 1);
  // Focus-trap [tabindex] selector intact (tabindex wiring lives in the fragment).
  ok('focusable [tabindex] selector intact', composed.indexOf('[tabindex]') !== -1);
  // Worker glue string intact: the Blob(engineSource + glue) construction pins the glue.
  ok('worker glue Blob construction intact', composed.indexOf("new Blob([src+'\\n'+glue]") !== -1);
  if (bodyM) {
    ok('button count intact', (bodyM[0].match(/<button\b/gi) || []).length === golden.controls.button);
    ok('input count intact', (bodyM[0].match(/<input\b/gi) || []).length === golden.controls.input);
    ok('select count intact', (bodyM[0].match(/<select\b/gi) || []).length === golden.controls.select);
    ok('aria attrs intact', (bodyM[0].match(/\baria-[a-z]+=/gi) || []).length === golden.aria.aria_attrs);
    ok('tabindex intact', (bodyM[0].match(/\btabindex=/gi) || []).length === golden.aria.tabindex);
  }

  // 15. External scripts + asset versions + requests unchanged.
  const ext = [...composed.matchAll(/<script\b[^>]*src="([^"]+)"/gi)].map(m => m[1]);
  ok('exactly the approved external scripts', JSON.stringify(ext) === JSON.stringify(golden.external_scripts));
  ok('four external scripts', ext.length === 4);
  ok('css version intact', (composed.match(/plumline\.css\?v=\d+/) || [])[0] === golden.css_version);
  ok('requests unchanged (6)', 1 + ext.length + 1 === golden.requests);

  // 16. Publication contract: dist/solver.html byte-identity, marker/fragment-path
  //     absence and no-fragment-dir checks live in engine/validate_dist.js (run AFTER
  //     the build). This checker validates the COMPOSED page via the canonical
  //     composer only, so its assertion count is independent of dist/ existence.

  return { pass, fail, failures };
}

module.exports = { checkSolverDetectionInterface: checkSolverDetectionInterface };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkSolverDetectionInterface(siteDir);
  r.failures.forEach(f => console.log('  FAIL:', f));
  console.log('SOLVER DETECTION INTERFACE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
