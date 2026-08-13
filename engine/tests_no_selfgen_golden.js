/* tests_no_selfgen_golden.js — anti-regeneration contract for the D5 FINAL golden.
 *
 * The final golden solver-interface-d5-final.json is the AUTHORITY that
 * checkSolverInterfaceFinal validates the composed page against. Its expected values
 * were DERIVED from independent pre-D / per-phase fixtures (see the golden's
 * `provenance` block), NOT freshly captured from the composer under test. This suite
 * pins the golden's own SHA-256 so that an accidental self-capture (regenerating it
 * from the same composer during verify) changes the file and FAILS the build — the
 * expected can never be silently re-derived from the thing it checks.
 *
 * It also asserts the golden actually declares its independent provenance and its
 * cross-checks against the pre-D baseline still hold.
 *
 * F7a count-agnostic migration: the golden also carries a `canonical` block — the UI
 * authority for catalogue-owned regions (those containing the growing var EXAMPLES={...}
 * object), each SHA taken AFTER the object is replaced by a fixed sentinel. Those SHAs
 * were DERIVED from the independent historical post-F6 (9-example) composed solver text
 * (solver-ui-golden-historical-source-f6.json), NOT from the composer under test. This
 * suite keeps the two provenance paths separate: it proves the AUTHORITY side is
 * independent (D5 canonical == D1/D2 phase-golden canonical; provenance artifact declares
 * the 9-example source) — the CURRENT-implementation comparison (current composer ->
 * canonicalise -> compare) lives in the D1-D5 checkers, never here.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const siteDir = path.join(__dirname, '..');
const goldenPath = path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-interface-d5-final.json');

// PINNED SHA-256 of the D5 final golden. If the golden is regenerated (e.g. an
// accidental self-capture from the composer), this hash changes and the build fails.
// Updated once for the F7a count-agnostic migration: a `canonical` block (UI authority
// for catalogue-owned regions, DERIVED from the independent historical post-F6 text —
// see solver-ui-golden-historical-source-f6.json) and a class_4 provenance note were
// ADDED. The legacy raw SHAs were NOT changed. This is a deliberate, reviewed change, so
// the pin is advanced to the new file SHA; it remains an accidental-self-capture guard.
const PINNED_SHA = 'a303dab5410508ec8298dfcf409fb5f075ed4f0a6d21127b4d21432501c99a91';

const raw = fs.readFileSync(goldenPath);
const actualSha = crypto.createHash('sha256').update(raw).digest('hex');
ok('D5 final golden SHA-256 is pinned (not self-regenerated)', actualSha === PINNED_SHA,
  'expected ' + PINNED_SHA + ' got ' + actualSha);

const golden = JSON.parse(raw.toString('utf8'));

// The golden must declare its independent provenance and its no-regenerate contract.
ok('golden declares provenance', !!golden.provenance && !!golden.provenance.note);
ok('golden lists independent sources', Array.isArray(golden.provenance && golden.provenance.independent_sources) &&
  golden.provenance.independent_sources.indexOf('solver-interface-baseline.json (pre-D)') !== -1);
ok('golden declares do-not-regenerate', !!(golden.provenance && golden.provenance.do_not_regenerate));

// Cross-check the derived fields against the INDEPENDENT pre-D baseline (D0) again,
// so a hand-edit of the golden that breaks provenance is caught here too.
const d0 = JSON.parse(fs.readFileSync(
  path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden', 'solver-interface-baseline.json'), 'utf8'));
ok('golden head == pre-D baseline head', golden.head.sha256 === d0.head.sha256);
ok('golden body == pre-D baseline body', golden.body.sha256 === d0.body.sha256);
ok('golden engine == pre-D baseline engine', golden.engine.sha256 === d0.engine.sha256);
ok('golden style(inner) == pre-D baseline inline_style', golden.style.sha256 === d0.inline_style.sha256);
ok('golden ui_script(no engine) == pre-D baseline ui_script', golden.ui_script_no_engine.sha256 === d0.ui_script.sha256);
ok('golden composed bytes == pre-D baseline bytes (215613)', golden.composed_total.bytes === d0.totals.bytes);

// Fragment SHAs must equal the independent per-phase goldens (bootstrap is D5-only).
const base = path.join(siteDir, 'engine', 'fixtures', 'solver-ui-golden');
const D1 = JSON.parse(fs.readFileSync(path.join(base, 'solver-grid-d1.json'), 'utf8'));
const D2 = JSON.parse(fs.readFileSync(path.join(base, 'solver-detection-d2.json'), 'utf8'));
const D4 = JSON.parse(fs.readFileSync(path.join(base, 'solver-visualization-d4.json'), 'utf8'));
const phaseFrag = {};
['solver-grid-d1.json', 'solver-detection-d2.json', 'solver-execution-d3.json', 'solver-visualization-d4.json'].forEach(f => {
  const g = JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'));
  (g.fragments || []).forEach(fr => { if (!phaseFrag[fr.file]) phaseFrag[fr.file] = fr.sha256; });
});
golden.fragments.forEach(fr => {
  if (fr.file === 'bootstrap-accessibility.js') {
    ok('bootstrap fragment marked D5-provenance', /D5/.test(fr.provenance || ''));
  } else {
    ok('fragment ' + fr.file + ' == independent phase golden', phaseFrag[fr.file] === fr.sha256);
  }
});

// Independent-provenance cross-checks for EVERY field the provenance block claims is
// derived. The D1 phase golden independently carries the whole-page structural fields
// (it was captured pre-D1 from an independent composed baseline); D2/D4 carry the
// aria/i18n contract counts. Comparing the final golden against those historical
// fixtures — not re-deriving from the composer — proves independent provenance, which
// PINNED_SHA alone (accidental-change guard) does not.
ok('composed_total.sha256 == D1 historical', golden.composed_total.sha256 === D1.composed_total.sha256);
ok('composed_total.chars == D1 historical', golden.composed_total.chars === D1.composed_total.chars);
ok('composed_total.bytes == D1 historical', golden.composed_total.bytes === D1.composed_total.bytes);
ok('inline_script.sha256 == D1 historical', golden.inline_script.sha256 === D1.inline_script.sha256);
ok('inline_script.bytes == D1 historical', golden.inline_script.bytes === D1.inline_script.bytes);
ok('ui_pre_engine.sha256 == D1 historical', golden.ui_pre_engine.sha256 === D1.ui_pre_engine.sha256);
ok('ui_pre_engine.bytes == D1 historical', golden.ui_pre_engine.bytes === D1.ui_pre_engine.bytes);
ok('ui_post_engine.sha256 == D1 historical', golden.ui_post_engine.sha256 === D1.ui_post_engine.sha256);
ok('ui_post_engine.bytes == D1 historical', golden.ui_post_engine.bytes === D1.ui_post_engine.bytes);
ok('external_scripts == D1 historical', JSON.stringify(golden.external_scripts) === JSON.stringify(D1.external_scripts));
ok('css_version == D1 historical', golden.css_version === D1.css_version);
ok('requests == D1 historical', golden.requests === D1.requests);
ok('dist_public.sha256 == D1 historical', golden.dist_public.sha256 === D1.dist_public.sha256);
ok('dist_public.bytes == D1 historical', golden.dist_public.bytes === D1.dist_public.bytes);
ok('controls == D1 historical', JSON.stringify(golden.controls) === JSON.stringify(D1.controls));
// aria_attrs + data_i18n_count are pinned independently by the D2 and D4 phase goldens.
ok('aria.aria_attrs == D2 historical', golden.aria.aria_attrs === D2.aria.aria_attrs);
ok('aria.aria_attrs == D4 historical', golden.aria.aria_attrs === D4.aria.aria_attrs);
ok('data_i18n_count == D2 historical', golden.data_i18n_count === D2.data_i18n_count);
ok('data_i18n_count == D4 historical', golden.data_i18n_count === D4.data_i18n_count);

// ---------------------------------------------------------------------------
// Count-agnostic CANONICAL UI authority: independent-provenance guards.
//
// The canonical block (golden.canonical.*) holds the SHA of each catalogue-owned region AFTER the
// EXAMPLES object is replaced by a fixed sentinel. Those SHAs were DERIVED from the independent
// historical post-F6 (9-example) composed solver text — NOT from the F7a composer under test.
// Two separate provenance paths must stay distinct (do not collapse into one):
//   Historical authority: pre-F7a composed source -> canonicalise -> golden.canonical.* SHA.
//   Current implementation: current composer -> canonicalise -> compared against golden.canonical.*
//                           (that comparison lives in the D1-D5 checkers, not here).
// This suite proves the AUTHORITY side is independent: D5's canonical SHAs equal the D1/D2 phase
// goldens' canonical SHAs (each derived from the same historical text), and the provenance artifact
// declares the 9-example source. No expected value is produced from the composer under test here.
ok('golden declares canonical UI authority', !!golden.canonical &&
  !!golden.provenance.class_4_canonical_ui_authority);
ok('canonical block references historical provenance artifact',
  (golden.canonical._provenance || '') === 'solver-ui-golden-historical-source-f6.json');

// D5 canonical regions must equal the independent D1 phase golden's canonical regions (same
// historical derivation), so the authority is cross-checked against an independent fixture.
['composed_total', 'body', 'inline_script', 'ui_post_engine'].forEach(region => {
  ok('canonical.' + region + '.sha256 == D1 historical canonical',
    golden.canonical[region] && D1.canonical && D1.canonical[region] &&
    golden.canonical[region].sha256 === D1.canonical[region].sha256);
  ok('canonical.' + region + '.bytes == D1 historical canonical',
    golden.canonical[region] && D1.canonical && D1.canonical[region] &&
    golden.canonical[region].bytes === D1.canonical[region].bytes);
});
// type_option_counts is the independent D2 detection authority: D2 derives these counts from the
// REAL composed solver text (see tests_solver_detection.js §13, which matches each model-type
// literal against the composed page). Here we PIN that authority to the canonical independent
// values with a genuine deep-equality comparison — not a mere existence check — so a self-
// regenerated D2 that drifted the counts would be caught. The D5 final golden intentionally does
// NOT carry this field (it lives only in D2), so the comparison is D2-authority vs canonical.
const EXPECTED_TYPE_OPTION_COUNTS = { continuous: 13, integer: 9, binary: 17 };
(function () {
  const actual = D2.canonical && D2.canonical.type_option_counts;
  const keysMatch = actual && JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(Object.keys(EXPECTED_TYPE_OPTION_COUNTS).sort());
  const valuesMatch = keysMatch && Object.keys(EXPECTED_TYPE_OPTION_COUNTS).every(function (k) { return actual[k] === EXPECTED_TYPE_OPTION_COUNTS[k]; });
  ok('D2 canonical type_option_counts deep-equals the independent canonical values {continuous:13,integer:9,binary:17}',
     !!valuesMatch, JSON.stringify(actual));
})();

// The provenance artifact must independently declare the 9-example historical source that anchors
// the canonical derivation (catalogue count 9; composed SHA of the historical solver text).
const provArtifactPath = path.join(base, 'solver-ui-golden-historical-source-f6.json');
ok('historical provenance artifact exists', fs.existsSync(provArtifactPath));
if (fs.existsSync(provArtifactPath)) {
  const prov = JSON.parse(fs.readFileSync(provArtifactPath, 'utf8'));
  ok('provenance artifact declares catalogue count 9', prov.catalogueCount === 9);
  ok('provenance artifact records historical composed SHA',
    typeof prov.composedSolverSha256 === 'string' && prov.composedSolverSha256.length === 64);
  ok('provenance artifact proves no F7a files',
    prov.proofNoF7aFiles && prov.proofNoF7aFiles.f7aKeyCount === 0);
  ok('provenance artifact cross-checks against existing golden',
    prov.crossCheckAgainstExistingGolden && prov.crossCheckAgainstExistingGolden.shaMatch === true);
}

console.log('NO-SELFGEN GOLDEN CONTRACT  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
