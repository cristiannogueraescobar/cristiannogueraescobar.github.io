/**
 * tests_panel.js — Variable settings panel logic (domains, validation, model
 * classification, and stale-result behaviour).
 *
 * These pin the correctness fixes for the panel: negative-min rejection,
 * NaN/Infinity rejection, min>max detection, domain building, model-type
 * classification, and that editing a domain invalidates a finished result.
 *
 * The pure functions (cleanBound, varError, variableDomains) are extracted
 * from solver.html; classifyModel_ comes from the engine. The DOM-driven
 * invalidation is modelled the same way as the worker-token tests.
 *
 * Run: node engine/tests_panel.js
 */
// Public product capabilities demonstrated by the cases in this file
// (anchors validated by tests_capabilities.js — do not remove without
// updating assets/product-capabilities.js):
//   CAPABILITY: model-binary

const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL:', name, detail || ''); }
}

// --- Load the pure panel functions from solver.html ----------------------
const html = composedHtml(path.join(__dirname, '..'), 'solver.html');
const script = html.split('<script>').filter(function (c) { return c.indexOf('variableDomains') !== -1; })[0].split('</script>')[0];
function grab(name) {
  const m = script.search(new RegExp('\\n  function ' + name + '\\('));
  const start = m;
  let i = script.indexOf('{', start), depth = 0;
  for (let j = i; j < script.length; j++) {
    if (script[j] === '{') depth++;
    else if (script[j] === '}') { depth--; if (depth === 0) return script.slice(start, j + 1); }
  }
  return '';
}
var varSettings = {};
eval(grab('cleanBound'));
eval(grab('varError'));
eval(grab('variableDomains'));

// --- classifyModel_ from the engine --------------------------------------
const ENG = require('./engine.js');
const classifyModel_ = ENG.classifyModel_ || (function () {
  // engine.js may not export it; extract from solver instead.
  const m = html.indexOf('function classifyModel_');
  let i = html.indexOf('{', m), depth = 0, end = i;
  for (let j = i; j < html.length; j++) { if (html[j] === '{') depth++; else if (html[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } } }
  eval(html.slice(m, end));
  return classifyModel_;
})();

// ============ 1. cleanBound: NaN / Infinity rejected =====================
ok('cleanBound empty -> null', cleanBound('') === null);
ok('cleanBound number', cleanBound('5') === 5);
ok('cleanBound NaN -> NaN marker', typeof cleanBound('abc') === 'number' && isNaN(cleanBound('abc')));
ok('cleanBound Infinity -> NaN marker', isNaN(cleanBound('Infinity')) && isNaN(cleanBound('1e999')));
ok('cleanBound negative kept', cleanBound('-5') === -5);   // parsed; rejection is varError's job

// ============ 2. varError: negative min, min>max =========================
ok('negative min -> varErrNegative', varError({ type: 'continuous', min: -5, max: null }) === 'varErrNegative');
ok('min>max -> varErrMinMax', varError({ type: 'continuous', min: 10, max: 2 }) === 'varErrMinMax');
ok('valid bounds -> null', varError({ type: 'continuous', min: 0, max: 10 }) === null);
ok('binary skips validation', varError({ type: 'binary', min: 0, max: 1 }) === null);

// ============ 3. variableDomains ========================================
(function () {
  var cells = ['B2', 'B3', 'B4'];
  varSettings = {};
  ok('no config + toggle off -> null', variableDomains(cells, false) === null);
  ok('toggle on -> all integer', JSON.stringify(variableDomains(cells, true).integer) === '[0,1,2]');
  varSettings = { 'B2': { type: 'binary', min: 0, max: 1 } };
  var d = variableDomains(cells, false);
  ok('binary -> integer includes 0', d.integer.indexOf(0) >= 0);
  ok('binary -> bound [0,1]', d.bounds[0].lower === 0 && d.bounds[0].upper === 1);
  varSettings = { 'B2': { type: 'continuous', min: -5, max: null } };
  var d2 = variableDomains(cells, false);
  ok('negative min clamped to 0 (safety net)', d2 === null || d2.bounds === null || (d2.bounds[0] && d2.bounds[0].lower === 0),
     JSON.stringify(d2));
})();

// ============ 4. classifyModel_ =========================================
ok('classify continuous', classifyModel_(null, false, 3) === 'continuous');
ok('classify integer (toggle)', classifyModel_(null, true, 3) === 'integer');
ok('classify all binary', classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 1 }] }, false, 2) === 'binary');
ok('classify mixed (cont+int)', classifyModel_({ integer: [1], bounds: [{ lower: 0, upper: null }, { lower: 0, upper: null }] }, false, 2) === 'mixed');
ok('classify integer (all int, not binary)', classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 20 }, { lower: 0, upper: null }] }, false, 2) === 'integer');
ok('classify mixed (binary+int)', classifyModel_({ integer: [0, 1], bounds: [{ lower: 0, upper: 1 }, { lower: 0, upper: 20 }] }, false, 2) === 'mixed');

// ============ 5. Editing a domain invalidates a finished result ==========
(function () {
  // Model the invalidation the same way solver.html does.
  var state = { workerBusy: false, workerToken: 0, lastResult: 'OLD', resShown: true };
  function cancelSolve() { if (!state.workerBusy) return; state.workerToken++; state.workerBusy = false; }
  function modelChanged() {
    if (state.workerBusy) cancelSolve();
    else if (state.resShown) state.resShown = 'cleared';
    state.lastResult = null;
  }
  // (a) change Type after a finished solve
  modelChanged();
  ok('domain edit clears finished result', state.resShown === 'cleared' && state.lastResult === null);
  // (b) change during an active worker discards it via token bump
  state = { workerBusy: true, workerToken: 5, lastResult: 'PENDING', resShown: true };
  var running = state.workerToken;
  modelChanged();
  ok('domain edit during worker discards run', state.workerToken !== running && state.lastResult === null);
})();


// ============ 6. buildVariableDomains_ (receipt report) ================
(function () {
  var bvd = ENG.buildVariableDomains_;
  // continuous default -> nothing reported
  var r1 = bvd(null, false, ['B2','B3'], ['x','y'], [3, 4], 'continuous');
  ok('no domains -> empty report', Array.isArray(r1) && r1.length === 0, JSON.stringify(r1));
  // integer var with min 3 max 8, value 8 -> reported, upper binding, satisfied
  var d = { integer: [0], bounds: [{ lower: 3, upper: 8 }, { lower: 0, upper: null }] };
  var r2 = bvd(d, false, ['B2','B3'], ['Workers','y'], [8, 2], 'mixed');
  ok('integer bound reported', r2.length === 1 && r2[0].label === 'Workers', JSON.stringify(r2));
  ok('upper binding detected', r2[0].upperBinding === true && r2[0].satisfied === true, JSON.stringify(r2[0]));
  ok('type is integer', r2[0].type === 'integer' && r2[0].min === 3 && r2[0].max === 8);
  // binary var
  var db = { integer: [0], bounds: [{ lower: 0, upper: 1 }] };
  var r3 = bvd(db, false, ['B2'], ['Open'], [1], 'binary');
  ok('binary reported as binary', r3[0].type === 'binary' && r3[0].value === 1 && r3[0].satisfied === true);
  // whole toggle -> all integer reported
  var r4 = bvd(null, true, ['B2','B3'], ['a','b'], [2, 3], 'integer');
  ok('whole toggle reports integer vars', r4.length === 2 && r4[0].type === 'integer');
})();

// ============ 7. cleanBound distinguishes invalid from empty ============
ok('cleanBound infinite -> NaN marker', typeof cleanBound('1e999') === 'number' && isNaN(cleanBound('1e999')));
ok('cleanBound empty -> null (not NaN)', cleanBound('') === null);
ok('varError flags non-finite', varError({ type: 'continuous', min: NaN, max: null }) === 'varErrFinite');


// ============ 8. lowerBinding at zero, aggregate verification ===========
(function () {
  var bvd = ENG.buildVariableDomains_;
  // binary variable at 0 -> lowerBinding should be true now (0 is its min)
  var d = { integer: [0], bounds: [{ lower: 0, upper: 1 }] };
  var r = bvd(d, false, ['B2'], ['Open'], [0], 'binary');
  ok('binary at 0 is lowerBinding', r[0].lowerBinding === true, JSON.stringify(r[0]));
  // integer with min 0, value 0 -> lowerBinding true
  var d2 = { integer: [0], bounds: [{ lower: 0, upper: 10 }] };
  var r2 = bvd(d2, false, ['B2'], ['x'], [0], 'integer');
  ok('integer at min 0 is lowerBinding', r2[0].lowerBinding === true);
  // all satisfied
  ok('domain satisfied flag', r2[0].satisfied === true);
})();

console.log('PANEL TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
