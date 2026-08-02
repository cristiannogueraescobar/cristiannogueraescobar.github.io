/* tests_solver_execution.js — Checkpoint D3 official checker for the composed
 * solver.html execution + errors + results interface.
 *
 * checkSolverExecutionInterface(siteDir) validates the COMPOSED solver.html
 * (shell + solver-UI composition, D1 grid + D2 detection/variable-settings + D3
 * execution/worker-client/results) against the independent golden
 * solver-execution-d3.json. Used by BOTH the positive suite (below) and
 * tests_solver_execution_negative.js — ONE checker, no duplicated composer logic.
 *
 * It asserts: composed output byte-identical to the pre-D baseline; engine region
 * byte-identical; the D1/D2 fragments intact; the three D3 regions inserted verbatim
 * and in order; no residual markers; D3 functions present exactly once; NO engine
 * math copied into any solver-ui fragment; no D4 (plot/export) function migrated
 * into D3; the Worker request/response contract intact; token + stale rejection +
 * cancellation + fallback intact; localized errors (no raw err.message); result
 * structure (status codes, receipt, details) intact; ids/aria/live regions intact;
 * external scripts + asset versions + requests unchanged.
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

function checkSolverExecutionInterface(siteDir) {
  let pass = 0, fail = 0; const failures = [];
  const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } };

  const golden = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-execution-d3.json'), 'utf8'));
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

  // 4. Engine region byte-identical.
  const s = composed.indexOf(ENGINE_START), e = composed.indexOf(ENGINE_END);
  const engine = s >= 0 && e > s ? composed.slice(s, e) : '';
  ok('engine sha canonical', sha(engine) === golden.engine.sha256);
  ok('engine length canonical', engine.length === golden.engine.chars);
  ok('engine bytes canonical', bytesOf(engine) === golden.engine.bytes);

  // 5. Inline script + UI pre/post byte-identical.
  const big = bigInlineScript(composed);
  ok('inline script matches golden', big && sha(big[2]) === golden.inline_script.sha256);
  if (big) {
    const uiPre = big[2].slice(0, big[2].indexOf(ENGINE_START));
    const uiPost = big[2].slice(big[2].indexOf(ENGINE_END) + ENGINE_END.length);
    ok('UI pre-engine matches golden', sha(uiPre) === golden.ui_pre_engine.sha256);
    ok('UI post-engine matches golden', sha(uiPost) === golden.ui_post_engine.sha256);
  }

  // 6. All five fragments verbatim, in order; sha + first/last fn.
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
      ok('fragment ' + fr.file + ' first fn ' + fr.first_fn, b.indexOf('function ' + fr.first_fn + '(') !== -1);
      ok('fragment ' + fr.file + ' last fn ' + fr.last_fn, b.indexOf('function ' + fr.last_fn + '(') !== -1);
    }
  });
  // Marker order in source matches the canonical fragment order.
  // The D3 regions must appear in the source in their canonical relative order.
  // (Later phases may add regions before/after; we check D3's own order as a
  // subsequence rather than pinning the full marker list.)
  const orderInSrc = [...src.matchAll(/SOLVER_UI_([A-Z_]+)_START/g)].map(m => m[1]);
  const d3Only = orderInSrc.filter(n => golden.fragment_order.indexOf(n) !== -1);
  ok('D3 regions appear in canonical relative order', JSON.stringify(d3Only) === JSON.stringify(golden.fragment_order));

  // 7-8. No residual marker; no fragment path in composed output.
  ok('no residual SOLVER_UI marker', !/\/\* SOLVER_UI_[A-Z0-9_]+_(?:START|END)/.test(composed));
  golden.fragments.forEach(fr => {
    ok('fragment path ' + fr.file + ' not in composed', composed.indexOf('solver-ui/' + fr.file) === -1);
  });

  // 9. D3 functions present exactly once in composed.
  golden.d3_functions.forEach(fn => {
    ok('D3 fn ' + fn + ' present exactly once', occurrences(composed, 'function ' + fn + '(') === 1);
  });

  // 10. No engine math defined inside any solver-ui fragment.
  const allFrag = Object.values(fragTexts);
  golden.math_functions_forbidden_in_fragments.forEach(fn => {
    ok('engine math fn ' + fn + ' NOT in any fragment', !allFrag.some(t => t.indexOf('function ' + fn + '(') !== -1));
  });
  // 11. No D4 function migrated into a D3 fragment.
  const d3Files = ['solve-worker-client.js', 'solve-orchestration.js', 'errors-results.js'];
  golden.not_d3_functions.forEach(fn => {
    const inD3 = d3Files.some(f => fragTexts[f] && fragTexts[f].indexOf('function ' + fn + '(') !== -1);
    ok('D4 fn ' + fn + ' NOT in any D3 fragment', !inD3);
  });

  // 12. Worker request/response contract intact (signals present in composed).
  const wc = golden.worker_contract;
  wc.worker_state_vars.forEach(v => ok('worker state var ' + v + ' present', composed.indexOf(v) !== -1));
  ok('worker builder ' + wc.worker_builder + ' present', composed.indexOf('function ' + wc.worker_builder + '(') !== -1);
  ok('engineSource fn present', composed.indexOf('function ' + wc.engine_source_fn + '(') !== -1);
  ok('Blob construction intact', composed.indexOf(wc.blob_construction) !== -1);
  ok('createObjectURL intact', composed.indexOf(wc.create_object_url) !== -1);
  ok('fallback fn ' + wc.fallback_fn + ' present', composed.indexOf('function ' + wc.fallback_fn + '(') !== -1);
  ok('orchestrator ' + wc.orchestrator + ' present', composed.indexOf('function ' + wc.orchestrator + '(') !== -1);
  ok('canceller ' + wc.canceller + ' present', composed.indexOf('function ' + wc.canceller + '(') !== -1);
  ok('present fn intact', composed.indexOf('function ' + wc.present + '(') !== -1);
  ok('trouble fn intact', composed.indexOf('function ' + wc.trouble + '(') !== -1);
  ok('engine trouble fn intact', composed.indexOf('function ' + wc.engine_trouble + '(') !== -1);
  ok('solve details fn intact', composed.indexOf('function ' + wc.details + '(') !== -1);
  // 13. Token correlation + stale rejection intact (workerToken referenced by the
  //     worker message handler; a stale response is rejected by token mismatch).
  ok('token referenced in worker path', composed.indexOf('workerToken') !== -1);
  ok('revokeObjectURL present (cleanup)', composed.indexOf('revokeObjectURL') !== -1);

  // 14. Localized errors: err.message not shown directly by a D3 fragment.
  ok('no raw err.message rendered into DOM (D3 fragments)',
    !d3Files.some(f => fragTexts[f] && /innerHTML\s*=\s*[^;]*err\.message/.test(fragTexts[f])));

  // 15. Result structure: status codes present in composed.
  golden.status_codes.forEach(code => {
    ok('status code "' + code + '" present', composed.indexOf(code) !== -1);
  });
  golden.result_ids.forEach(id => {
    ok('result id/name "' + id + '" present', composed.indexOf(id) !== -1);
  });
  // Precise id integrity: the #result container id must appear as a delimited id
  // attribute, so renaming id="result" to id="resultX" trips this (not just the hash).
  ok('result container id="result" intact', composed.indexOf('id="result"') !== -1);
  // solve click listener registered exactly once (binding lives in the bootstrap
  // fragment); removing or duplicating it trips this precise count.
  ok('solve listener bound exactly once',
    (composed.match(/getElementById\('solve'\)\.addEventListener\('click'/g) || []).length === 1);
  // Worker token state defined exactly once (N21 duplicates it with a second var).
  ok('workerToken state defined exactly once', (composed.match(/workerToken=/g) || []).length === 1);
  // No foreign-namespace data-i18n key (a dotted key from another page's namespace).
  ok('no foreign-namespace data-i18n key', !/data-i18n="[a-z]+\.[^"]*"/i.test(composed));

  // 15b. D3 contract patterns pinned by exact literal count, so renaming a worker
  //       state var, a message/response handler, the engineSource locator, the
  //       fallback criterion, a status/i18n key, or a render call trips a precise
  //       contract (not just the fragment hash).
  if (golden.d3_contract_patterns) {
    Object.keys(golden.d3_contract_patterns).forEach(label => {
      const spec = golden.d3_contract_patterns[label];
      const count = spec.word
        ? (composed.match(new RegExp('\\b' + spec.literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')) || []).length
        : composed.split(spec.literal).length - 1;
      ok('D3 contract "' + label + '" intact', count === spec.count);
    });
  }
  // 15c. No raw user-facing English literal in the results fragment (would bypass i18n).
  const resFrag = golden.fragments.find(fr => fr.file === 'errors-results.js');
  if (resFrag) {
    const rp = path.join(siteDir, 'engine', 'fragments', 'solver-ui', resFrag.file);
    if (fs.existsSync(rp)) {
      ok('no raw English UI literal in results fragment',
        !/"[A-Z][a-z]+ (completed|successfully|failed|valid|invalid)[^"]*"|"Solve completed[^"]*"/.test(fs.readFileSync(rp, 'utf8')));
    }
  }
  // 15d. Result-details DOM order: the solve-details rows are emitted in a fixed
  //       order (status → model type → optimality proven). Reordering two rows
  //       trips this specific contract.
  {
    const iStatus = composed.indexOf("rows.push([t('sdStatus')");
    const iModel = composed.indexOf("rows.push([t('sdModelType')");
    const iProven = composed.indexOf("rows.push([t('sdProven')");
    ok('result details row order (status < modelType < proven)',
      iStatus !== -1 && iModel !== -1 && iProven !== -1 && iStatus < iModel && iModel < iProven);
  }

  // 16. External scripts + asset versions + requests + aria/live + controls.
  const ext = [...composed.matchAll(/<script\b[^>]*src="([^"]+)"/gi)].map(m => m[1]);
  ok('exactly the approved external scripts', JSON.stringify(ext) === JSON.stringify(golden.external_scripts));
  ok('four external scripts', ext.length === 4);
  ok('css version intact', (composed.match(/plumline\.css\?v=\d+/) || [])[0] === golden.css_version);
  ok('requests unchanged (6)', 1 + ext.length + 1 === golden.requests);
  if (bodyM) {
    ok('button count intact', (bodyM[0].match(/<button\b/gi) || []).length === golden.controls.button);
    ok('input count intact', (bodyM[0].match(/<input\b/gi) || []).length === golden.controls.input);
    ok('select count intact', (bodyM[0].match(/<select\b/gi) || []).length === golden.controls.select);
    ok('aria attrs intact', (bodyM[0].match(/\baria-[a-z]+=/gi) || []).length === golden.aria.aria_attrs);
    ok('tabindex intact', (bodyM[0].match(/\btabindex=/gi) || []).length === golden.aria.tabindex);
  }
  ok('aria-live regions intact', (composed.match(/aria-live=/gi) || []).length === golden.aria.live_regions);

  // 17. Publication contract: dist/solver.html byte-identity, marker/fragment-path
  //     absence and no-fragment-dir checks live in engine/validate_dist.js (run AFTER
  //     the build). This checker validates the COMPOSED page via the canonical
  //     composer only, so its assertion count is independent of dist/ existence.

  return { pass, fail, failures };
}

module.exports = { checkSolverExecutionInterface: checkSolverExecutionInterface };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkSolverExecutionInterface(siteDir);
  r.failures.forEach(f => console.log('  FAIL:', f));
  console.log('SOLVER EXECUTION INTERFACE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
