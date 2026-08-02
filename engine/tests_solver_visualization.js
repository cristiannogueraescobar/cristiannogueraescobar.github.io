/* tests_solver_visualization.js — Checkpoint D4 official checker for the composed
 * solver.html visualization + examples + exports interface.
 *
 * checkSolverVisualizationInterface(siteDir) validates the COMPOSED solver.html
 * (shell + solver-UI composition, D1 grid + D2 detection/variable-settings + D3
 * execution/worker-client/results + D4 receipt/plot/exports + examples) against the
 * independent golden solver-visualization-d4.json. Used by BOTH the positive suite
 * (below) and tests_solver_visualization_negative.js — ONE checker, no duplicated
 * composer logic.
 *
 * It asserts: composed output byte-identical to the pre-D baseline; engine region
 * byte-identical; the D1/D2/D3 fragments intact; the three D4 regions inserted
 * verbatim and in canonical order; no residual markers; D4 functions present exactly
 * once; NO engine math copied into any fragment; no shared util (esc) migrated into
 * a D4 fragment; geometry constants intact; the drawer/examples/exports contracts
 * intact; ids/aria intact; external scripts + asset versions + requests unchanged.
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

function checkSolverVisualizationInterface(siteDir) {
  let pass = 0, fail = 0; const failures = [];
  const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } };

  const golden = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-visualization-d4.json'), 'utf8'));
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

  // 6. All eight fragments verbatim, in order; sha + first/last fn.
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
  // Full canonical marker order in source matches golden (D4 pins the full set).
  // The D4 regions must appear in the source in their canonical relative order.
  // (D5 adds a bootstrap region after them; the exact GLOBAL order of all regions
  // is pinned by checkSolverInterfaceFinal, so here we check D4's own order as a
  // subsequence rather than the full marker list.)
  const orderInSrc = [...src.matchAll(/SOLVER_UI_([A-Z_]+)_START/g)].map(m => m[1]);
  const d4Only = orderInSrc.filter(n => golden.fragment_order.indexOf(n) !== -1);
  ok('D4 regions appear in canonical relative order', JSON.stringify(d4Only) === JSON.stringify(golden.fragment_order));

  // 7-8. No residual marker; no fragment path in composed output.
  ok('no residual SOLVER_UI marker', !/\/\* SOLVER_UI_[A-Z0-9_]+_(?:START|END)/.test(composed));
  golden.fragments.forEach(fr => {
    ok('fragment path ' + fr.file + ' not in composed', composed.indexOf('solver-ui/' + fr.file) === -1);
  });

  // 9. D4 functions present exactly once in composed.
  golden.d4_functions.forEach(fn => {
    ok('D4 fn ' + fn + ' present exactly once', occurrences(composed, 'function ' + fn + '(') === 1);
  });

  // 10. No engine math defined inside any solver-ui fragment.
  const allFrag = Object.values(fragTexts);
  golden.math_functions_forbidden_in_fragments.forEach(fn => {
    ok('engine math fn ' + fn + ' NOT in any fragment', !allFrag.some(t => t.indexOf('function ' + fn + '(') !== -1));
  });
  // 11. Shared util (esc) NOT migrated into a D4 fragment (stays in source scope).
  const d4Files = ['examples-loading.js', 'receipt-plot-exports.js', 'examples-drawer.js'];
  golden.not_d4_functions.forEach(fn => {
    const inD4 = d4Files.some(f => fragTexts[f] && fragTexts[f].indexOf('function ' + fn + '(') !== -1);
    ok('shared util ' + fn + ' NOT in any D4 fragment', !inD4);
  });

  // 12. Geometry constants intact (present exactly once in composed).
  golden.geometry_constants.forEach(c => {
    ok('geometry constant ' + c + ' present', composed.indexOf(c) !== -1);
  });
  // 12b. Plot-fragment-scoped helpers that legitimately share a name with a frozen
  //      engine function (e.g. normalizeConstraint_): present in the plot fragment
  //      AND appear the expected two times in composed (engine + plot).
  (golden.plot_fragment_scoped || []).forEach(fn => {
    ok('plot-scoped ' + fn + ' in receipt-plot-exports fragment',
      fragTexts['receipt-plot-exports.js'] && fragTexts['receipt-plot-exports.js'].indexOf('function ' + fn + '(') !== -1);
    ok('plot-scoped ' + fn + ' appears twice in composed (engine + plot)',
      occurrences(composed, 'function ' + fn + '(') === 2);
  });

  // 13. renderReceipt intact + its plot/export integration present in composed.
  ok('renderReceipt present', composed.indexOf('function renderReceipt(') !== -1);
  ok('receipt→plot integration (drawFeasibleRegion call)', composed.indexOf('drawFeasibleRegion(') !== -1);
  ok('receipt→export integration (exp-csv wiring)', composed.indexOf('exp-csv') !== -1);

  // 14. Drawer contract.
  const dc = golden.drawer_contract;
  ok('drawer open fn ' + dc.open + ' present', composed.indexOf('function ' + dc.open + '(') !== -1);
  ok('drawer close fn ' + dc.close + ' present', composed.indexOf('function ' + dc.close + '(') !== -1);
  ok('drawer render fn ' + dc.render + ' present', composed.indexOf('function ' + dc.render + '(') !== -1);
  ok('drawer category order ' + dc.category_order + ' present', composed.indexOf(dc.category_order) !== -1);
  dc.ids.forEach(id => ok('drawer id "' + id + '" present', composed.indexOf(id) !== -1));
  // Drawer Escape-to-close handler intact (lives in the bootstrap fragment).
  ok('drawer Escape handler intact', composed.indexOf("e.key==='Escape'") !== -1);
  // Export click listener registered exactly once for exp-csv (a duplicate binding
  // in an injected script trips this precise count).
  ok('exp-csv export listener bound exactly once',
    (composed.match(/getElementById\('exp-csv'\)\.addEventListener\('click'/g) || []).length === 1);
  // data-i18n coverage pinned (removing one attribute trips this).
  ok('data-i18n attribute count intact',
    (composed.match(/data-i18n="/g) || []).length === golden.data_i18n_count);

  // 14c. D4 contract patterns pinned by exact literal count (with optional word
  //       boundary), so renaming a geometry constant, SVG attribute, category/slug
  //       resolver, export MIME, filename/extension, Blob/download/revoke call trips
  //       a precise contract instead of only the fragment hash.
  if (golden.d4_contract_patterns) {
    Object.keys(golden.d4_contract_patterns).forEach(label => {
      const spec = golden.d4_contract_patterns[label];
      const count = spec.word
        ? (composed.match(new RegExp('\\b' + spec.literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')) || []).length
        : composed.split(spec.literal).length - 1;
      ok('D4 contract "' + label + '" intact', count === spec.count);
    });
  }

  // 15. Examples contract.
  const ec = golden.examples_contract;
  ok('example loader ' + ec.loader + ' present', composed.indexOf('function ' + ec.loader + '(') !== -1);
  ok('example slug resolver ' + ec.slug_resolver + ' present', composed.indexOf(ec.slug_resolver) !== -1);
  ok('example url fn ' + ec.url + ' present', composed.indexOf('function ' + ec.url + '(') !== -1);
  ok('examples-data.js referenced', composed.indexOf(ec.data_source) !== -1);
  ok('url param ' + ec.url_param + ' present', composed.indexOf(ec.url_param) !== -1);

  // 16. Exports contract.
  const xc = golden.exports_contract;
  ok('export CSV fn present', composed.indexOf('function ' + xc.csv + '(') !== -1);
  ok('export XLS fn present', composed.indexOf('function ' + xc.xls + '(') !== -1);
  ok('export TXT fn present', composed.indexOf('function ' + xc.txt + '(') !== -1);
  ok('download fn present', composed.indexOf('function ' + xc.download + '(') !== -1);
  ok('CSV mime present', composed.indexOf(xc.mime_csv) !== -1);
  ok('XLS mime present', composed.indexOf(xc.mime_xls) !== -1);
  ok('TXT mime present', composed.indexOf(xc.mime_txt) !== -1);
  ok('Blob present', composed.indexOf(xc.blob) !== -1);
  ok('createObjectURL present', composed.indexOf(xc.object_url) !== -1);
  ok('revokeObjectURL present', composed.indexOf(xc.revoke) !== -1);
  ok('download attribute present', composed.indexOf(xc.download_attr) !== -1);

  // 17. External scripts + asset versions + requests + controls + aria.
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

  // 18. Publication contract: dist/solver.html byte-identity, marker/fragment-path
  //     absence and no-fragment-dir checks live in engine/validate_dist.js (run AFTER
  //     the build). This checker validates the COMPOSED page via the canonical
  //     composer only, so its assertion count is independent of dist/ existence.

  return { pass, fail, failures };
}

module.exports = { checkSolverVisualizationInterface: checkSolverVisualizationInterface };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkSolverVisualizationInterface(siteDir);
  r.failures.forEach(f => console.log('  FAIL:', f));
  console.log('SOLVER VISUALIZATION INTERFACE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
