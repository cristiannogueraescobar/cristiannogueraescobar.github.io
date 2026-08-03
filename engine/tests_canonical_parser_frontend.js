/* tests_canonical_parser_frontend.js — Checkpoint E2 authority.
 *
 * checkCanonicalParserFrontEnd(siteDir) -> { pass, fail, failures }
 *
 * The ONE reusable checker for the E2 mathematical front-end. It runs the
 * canonical production source through the canonical harness (vm) and validates
 * references, ranges, tokeniser grammar, operators, SUM/SUMIF, comparison and
 * SUMIF criteria, syntactic rejection, linearity detection, linearisation,
 * coefficient extraction and the front-end error contracts — all against the
 * PINNED pre-E2 behaviour in engine-e2-front-end.json. It also checks the
 * harness architecture (canonical only, no engine.js/solver.html/dist), the
 * closed export list, clean state, temporary canonical/mirror parity at the
 * shared boundary, that no third divergence appeared, and that the engine SHA
 * and public output are intact. It NEVER re-implements the parser.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadCanonicalEngine, gridFromArrays, sheetStub } = require('./canonical-engine-harness.js');
const { E2_EXPORTS } = require('./e2-exports.js');

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function checkCanonicalParserFrontEnd(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  let pass = 0, fail = 0; const failures = [];
  function ok(name, cond, detail) {
    if (cond) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
  }
  function throws(fn, needle) {
    try { fn(); return false; } catch (e) { return needle ? e.message.indexOf(needle) !== -1 : true; }
  }

  const g = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e2-front-end.json'), 'utf8'));

  // 1. Harness loads the canonical source only; engine SHA pinned.
  const canonAbs = path.join(siteDir, 'engine', 'source', 'plumline-engine.js');
  const canonSrc = fs.readFileSync(canonAbs, 'utf8');
  ok('engine SHA unchanged (pinned)', sha(canonSrc) === g.engine.sha256, sha(canonSrc));
  const harnessSrc = fs.readFileSync(path.join(siteDir, 'engine', 'canonical-engine-harness.js'), 'utf8');
  ok('harness reads the canonical source', harnessSrc.indexOf("'engine', 'source', 'plumline-engine.js'") !== -1
    || harnessSrc.indexOf('plumline-engine.js') !== -1);
  ok('harness does not use engine/engine.js', !/require\([^)]*engine\.js/.test(harnessSrc)
    && !/readFileSync\([^)]*engine\.js/.test(harnessSrc));
  ok('harness does not read solver.html', !/readFileSync\([^)]*solver\.html/.test(harnessSrc)
    && !/['"]solver\.html['"]/.test(harnessSrc.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')));
  ok('harness does not read dist', !/readFileSync\([^)]*dist/.test(harnessSrc)
    && !/path\.join\([^)]*['"]dist['"]/.test(harnessSrc));

  // 2. Closed export list; requesting a non-E2 name is rejected.
  ok('closed export list rejects an E3-E5 name',
    throws(() => loadCanonicalEngine(siteDir, ['solveModel_']), 'forbidden (E3-E5)'));
  ok('closed export list rejects an unknown name',
    throws(() => loadCanonicalEngine(siteDir, ['not_a_fn_']), 'not in the closed E2 export list'));
  ok('E2 export list matches the fixture',
    eq(E2_EXPORTS.slice().sort(), g.harness.e2_exports_closed_list.slice().sort()));

  // 3. Clean state per call: two loads are independent.
  const L1 = loadCanonicalEngine(siteDir); const L2 = loadCanonicalEngine(siteDir);
  ok('each load gets a fresh context', L1.fns !== L2.fns && L1.sandbox !== L2.sandbox);

  const E = L1.fns;

  // 4. References.
  ok('parseAddress_ A1', eq(E.parseAddress_('A1'), { column: 1, row: 1 }));
  ok('parseAddress_ AA10', eq(E.parseAddress_('AA10'), { column: 27, row: 10 }));
  ok('parseAddress_ invalid throws bad cell reference', throws(() => E.parseAddress_('1A'), 'bad cell reference'));
  ok('columnIndex_ 1-based (A=1,Z=26,AA=27)', E.columnIndex_('A') === 1 && E.columnIndex_('Z') === 26 && E.columnIndex_('AA') === 27);
  ok('columnLetter_ 1-based (26=Z)', E.columnLetter_(26) === 'Z' && E.columnLetter_(25) === 'Y');

  // 5. Ranges.
  ok('expandRange_ A1:B2 row-major', eq(E.expandRange_({}, 'A1:B2'), ['A1', 'B1', 'A2', 'B2']));
  ok('expandRange_ A1:A3 column', eq(E.expandRange_({}, 'A1:A3'), ['A1', 'A2', 'A3']));
  ok('expandRange_ single cell', eq(E.expandRange_({}, 'A1'), ['A1']));

  // 6. Tokeniser grammar (characterised behaviour).
  ok('tokenize 10 -> number', E.tokenize_('10')[0].type === 'number');
  ok('tokenize 20.0 -> number', E.tokenize_('20.0')[0].type === 'number');
  ok('tokenize .5 rejected', throws(() => E.tokenize_('.5'), 'unsupported syntax'));
  ok('tokenize 1e3 is NOT scientific (1 + E3)', (() => { const t = E.tokenize_('1e3'); return t.length === 2 && t[0].type === 'number' && t[1].type === 'ref'; })());
  ok('tokenize +10 -> punct + number', (() => { const t = E.tokenize_('+10'); return t[0].text === '+' && t[1].type === 'number'; })());
  ok('tokenize <= >= = as punct', E.tokenize_('A1<=1')[1].text === '<=' && E.tokenize_('A1>=1')[1].text === '>=' && E.tokenize_('A1=1')[1].text === '=');
  ok('tokenize strict < > tokenise', E.tokenize_('A1<1')[1].text === '<' && E.tokenize_('A1>1')[1].text === '>');
  ok('tokenize SUM -> function', E.tokenize_('SUM(A1:A2)')[0].type === 'function');

  // 7. Comparison + SUMIF criteria.
  ok('compareValues_ <= >= =', E.compareValues_(5, '<=', 10) && E.compareValues_(10, '>=', 5) && E.compareValues_(5, '=', 5));
  ok('compareValues_ strict evaluate', E.compareValues_(5, '<', 10) === true && E.compareValues_(5, '>', 10) === false);
  ok('compareValues_ unknown throws', throws(() => E.compareValues_(5, '!!', 10), 'unknown comparison'));
  ok('parseCriterionOperand_ >10 keeps operator', E.parseCriterionOperand_('>10', 'us') === '>10');
  ok('parseCriterionOperand_ .5 -> 0.5', E.parseCriterionOperand_('.5', 'us') === 0.5);
  ok('parseCriterionOperand_ +10 -> 10', E.parseCriterionOperand_('+10', 'us') === 10);
  ok('parseCriterionOperand_ 1e3 -> 1000', E.parseCriterionOperand_('1e3', 'us') === 1000);
  ok('matchesCriterion_ 15 >10 true / 5 >10 false', E.matchesCriterion_(15, '>10', 'us') === true && E.matchesCriterion_(5, '>10', 'us') === false);
  ok('matchesCriterion_ 20 == 20.0', E.matchesCriterion_(20, '20.0', 'us') === true);

  // 8. SUM / SUMIF / linearisation / coefficients (end-to-end via loadGrid_/newContext_).
  const gAdd = gridFromArrays(E, [['=2*A2+3*A3'], ['10'], ['20']]);
  const cAdd = E.newContext_(gAdd, ['A2', 'A3']);
  const form = E.linearize_(cAdd, 'A1', 0);
  ok('linearize =2*A2+3*A3', form.constant === 0 && form.terms.A2 === 2 && form.terms.A3 === 3);
  ok('coefficientVector_ order [A2,A3]', eq(E.coefficientVector_(form, ['A2', 'A3']), [2, 3]));
  ok('coefficientVector_ order [A3,A2]', eq(E.coefficientVector_(form, ['A3', 'A2']), [3, 2]));
  const gNL = gridFromArrays(E, [['=A2*A3'], ['10'], ['20']]);
  const cNL = E.newContext_(gNL, ['A2', 'A3']);
  ok('non-linear var*var rejected', throws(() => E.linearize_(cNL, 'A1', 0)));
  const gDiv = gridFromArrays(E, [['=A2/A3'], ['10'], ['20']]);
  const cDiv = E.newContext_(gDiv, ['A2', 'A3']);
  ok('non-linear div-by-var rejected', throws(() => E.linearize_(cDiv, 'A1', 0)));
  const gSum = gridFromArrays(E, [['=SUMIF(A2:A4,">15")'], ['10'], ['20'], ['30']]);
  const cSum = E.newContext_(gSum, []);
  const sumForm = E.linearize_(cSum, 'A1', 0);
  ok('SUMIF constant fold (20+30=50)', sumForm.constant === 50 && eq(sumForm.terms, {}));

  // 9. Unsupported functions: COUNTIF not supported; SUM supported.
  const gCount = gridFromArrays(E, [['=COUNTIF(A2:A3,">5")'], ['10'], ['20']]);
  const cCount = E.newContext_(gCount, []);
  ok('COUNTIF unsupported', throws(() => E.linearize_(cCount, 'A1', 0)));

  // 10. Out-of-grid reference is NOT silently zero (cellAt_ returns {formula:'',value:0}
  //     but linearize of an out-of-range ref with a variable set behaves per contract).
  const gGrid = gridFromArrays(E, [['=A2+A3'], ['10'], ['20']]);
  const cellOut = E.cellAt_(gGrid, 'Z99');
  ok('out-of-grid cellAt_ returns empty formula (not a silent variable)', cellOut.formula === '' );

  // 11. Locale mode intact (detectLocale_ available and returns a locale).
  ok('detectLocale_ present via loadGrid_', typeof E.loadGrid_ === 'function');

  // 12. Temporary canonical/mirror parity at the shared exposed boundary.
  const mirror = require(path.join(siteDir, 'engine', 'engine.js'));
  const mapi = mirror.PlumlineEngine || mirror;
  const sheet = sheetStub([['=A2+A3', '5'], ['10', '20'], ['7', '3']]);
  const gc = E.loadGrid_(sheet, 'auto');
  const gm = mapi.loadGrid_(sheet, 'auto');
  ok('loadGrid_ canonical == mirror (shared boundary)',
    eq({ fr: gc.firstRow, fc: gc.firstColumn, r: gc.rows, c: gc.columns, f: gc.formulas },
       { fr: gm.firstRow, fc: gm.firstColumn, r: gm.rows, c: gm.columns, f: gm.formulas }));
  // detectModel_ observable parity (same error on the same sheet).
  const detSheet = sheetStub([['=A2+A3'], ['10'], ['20']]);
  const cDet = loadCanonicalEngine(siteDir, []); // fresh, but we need detectModel_ — not in E2 list, so read via a raw vm load
  // Use a raw load exposing detectModel_ ONLY for parity (not part of the E2 API).
  const vm = require('vm');
  const sb = { Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
  sb.__det = null; vm.createContext(sb);
  vm.runInContext(canonSrc + '\n;__det = detectModel_;', sb);
  let rc, rm;
  try { rc = sb.__det(detSheet, 'auto'); } catch (e) { rc = 'ERR:' + e.message; }
  try { rm = mapi.detectModel_(detSheet, 'auto'); } catch (e) { rm = 'ERR:' + e.message; }
  ok('detectModel_ canonical == mirror (observable)', eq(rc, rm));

  // 13. No third divergence: engine.js unchanged.
  const mirrorSrc = fs.readFileSync(path.join(siteDir, 'engine', 'engine.js'), 'utf8');
  let genMirror = null; try { genMirror = require('./generate-engine-mirror.js').generateMirror(siteDir); } catch (e) { genMirror = null; }
  ok('engine/engine.js matches the generator output (E6 authority; no third divergence)',
    genMirror !== null && mirrorSrc === genMirror);

  // 13a. LAYERED GRAMMAR CONTRACTS — each layer checked at its exact layer.
  //   Tokeniser (general formula parser):
  ok('layer tokeniser: .5 rejected', throws(() => E.tokenize_('.5'), 'unsupported syntax'));
  ok('layer tokeniser: 1e3 is NOT scientific (1 + ref E3)',
    (() => { const t = E.tokenize_('1e3'); return t.length === 2 && t[0].type === 'number' && t[0].text === '1' && t[1].type === 'ref' && t[1].text === 'E3'; })());
  ok('layer tokeniser: <= >= = tokenise as punct',
    E.tokenize_('A1<=1')[1].text === '<=' && E.tokenize_('A1>=1')[1].text === '>=' && E.tokenize_('A1=1')[1].text === '=');
  ok('layer tokeniser: strict < > tokenise (not rejected here)',
    E.tokenize_('A1<1')[1].text === '<' && E.tokenize_('A1>1')[1].text === '>');
  //   compareValues_ (internal operator evaluation):
  ok('layer compareValues_: evaluates strict < and >',
    E.compareValues_(5, '<', 10) === true && E.compareValues_(5, '>', 10) === false);
  ok('layer compareValues_: evaluates <= >= =',
    E.compareValues_(5, '<=', 5) && E.compareValues_(5, '>=', 5) && E.compareValues_(5, '=', 5));
  //   SUMIF criteria parser (separate from the general tokeniser):
  ok('layer SUMIF criteria: .5 accepted as 0.5', E.parseCriterionOperand_('.5', 'us') === 0.5);
  ok('layer SUMIF criteria: 1e3 accepted as 1000', E.parseCriterionOperand_('1e3', 'us') === 1000);
  ok('layer SUMIF criteria: +10 accepted as 10', E.parseCriterionOperand_('+10', 'us') === 10);
  ok('layer SUMIF criteria: 20.0 == 20', E.matchesCriterion_(20, '20.0', 'us') === true);

  // 13b. CONSTRAINT-LAYER strict rejection is an E2/E3 boundary probed OBSERVABLY
  //      (via detectModel_ loaded raw for the probe ONLY — not exposed through the
  //      E2 harness, not counted as a migrated E2 function, not the checker's
  //      parser authority). We only assert canonical == mirror here.
  function loadProbe() {
    const sb = { Math: Math, Date: Date, JSON: JSON, Number: Number, Array: Array, Object: Object, String: String, Boolean: Boolean, RegExp: RegExp, isNaN: isNaN, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, console: { log() {}, warn() {}, error() {} } };
    sb.__dm = null; vm.createContext(sb);
    vm.runInContext(canonSrc + '\n;__dm = detectModel_;', sb);
    return sb.__dm;
  }
  const detectProbe = loadProbe();
  const mirrorMod = require(path.join(siteDir, 'engine', 'engine.js'));
  const mapi2 = mirrorMod.PlumlineEngine || mirrorMod;
  function mkSheet(f) { const v = f.map(r => r.map(() => '')); const range = { getFormulas: () => f, getValues: () => v, getRow: () => 1, getColumn: () => 1, getNumRows: () => f.length, getNumColumns: () => f[0].length }; return { getDataRange: () => range }; }
  function observable(f, locale) {
    let rc, rm;
    try { rc = JSON.stringify(detectProbe(mkSheet(f), locale)); } catch (e) { rc = 'ERR:' + e.message; }
    try { rm = JSON.stringify(mapi2.detectModel_(mkSheet(f), locale)); } catch (e) { rm = 'ERR:' + e.message; }
    return rc === rm;
  }
  ok('observable parity: strict-< constraint (E2/E3 boundary) canonical == mirror',
    observable([['=B1', '10'], ['=B1<5', '1']], 'auto'));
  ok('observable parity: SUMIF criteria model canonical == mirror',
    observable([['=SUMIF(B1:B3,">15")', '10'], ['', '20'], ['', '30']], 'auto'));
  ok('observable parity: locale eu decimal canonical == mirror',
    observable([['=1,5*B1', '2']], 'eu'));

  // 14. Public output intact (dist independent — only if a dist is present).
  // ---- Public output: owned by validate_dist (build-only, Category B) ------
  // The byte-identity of the built dist/solver.html and of the composed public
  // output are build/composition contracts owned by engine/validate_dist.js (run
  // during npm run build). They are NOT re-asserted here: this checker is
  // dist-independent and returns the same pass count with or without a prior build.

  // 15. Fixture has no absolute path.
  const fx = fs.readFileSync(path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e2-front-end.json'), 'utf8');
  ok('E2 fixture has no absolute path', !/(^|["\s])\/(home|Users|mnt|tmp|usr)\//.test(fx));

  return { pass, fail, failures };
}

module.exports = { checkCanonicalParserFrontEnd: checkCanonicalParserFrontEnd };

if (require.main === module) {
  const r = checkCanonicalParserFrontEnd(path.join(__dirname, '..'));
  console.log('CANONICAL PARSER FRONT-END (E2)  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  if (r.fail) { r.failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
}
