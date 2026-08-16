'use strict';
/* ============================================================================
   Checkpoint F5 — examples BEHAVIOURAL suite (REAL engine verification).
   ----------------------------------------------------------------------------
   Solve every migrated example through the REAL engine and VERIFY it against the
   canonical expected contract with a SINGLE reusable verifier (verifyResult) that
   is stricter than any test-only shortcut and rejects empty/vacuous success:

     - status              : engine status vs the independent baseline.
     - objective           : engine objective vs baseline, within tolerance.
     - constraints          : out.constraints must EXIST, its length must equal
                             canon.facts.constraintCount, and every one satisfied.
                             (0 is valid only when the fact count is 0.)
     - decisions/domains    : out.variables and out.values must exist, be the same
                             length, equal canon.facts.decisionCount, and the
                             variable set must equal the detector's decision cells;
                             then each value respects finite/non-negative/bounds/
                             integer/binary.
     - exact policy         : ALSO the complete decision vector within tolerance —
                             the SAME completeness the validator enforces.

   The verifier serves the current nine, the exact fixture and the future-#10
   dry-run, so there is one verification routine, not three. Deterministic output.
   ========================================================================== */
const path = require('path');
const { run, Engine } = require('./harness.js');
const F5 = path.join(__dirname, '..', 'src', 'shared', 'examples', 'f5');
const { loadCanonical } = require(path.join(F5, 'index.js'));
const derive = require(path.join(F5, 'derive.js'));
const E = require(path.join(F5, 'enums.js'));
const authoring = require(path.join(F5, 'authoring.js'));
const project = require(path.join(F5, 'project.js'));
const baseline = require(path.join(F5, 'baseline.json'));

let pass = 0, fail = 0; const failures = []; const report = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const { canonical } = loadCanonical(path.join(__dirname, '..'));
const baseById = {}; baseline.examples.forEach(function (b) { baseById[b.key] = b; });

// ---- shared REAL-engine solve + verify (single source of truth) ----------
const { variableCells, overrideFromDomains, solveModel, verifyResult } = require('./f5-solve-verify.js');

// ---- current nine ---------------------------------------------------------
canonical.forEach(function (canon) {
  const base = baseById[canon.key];
  ok(canon.key + ': has an independent baseline entry', !!base);
  if (!base) return;
  const r = solveModel(canon.model, canon.sense);
  if (r.error) { ok(canon.key + ': engine solves', false, r.error); return; }
  const expected = { status: base.expected.status, objective: base.expected.objective, tolerance: base.expected.tolerance };
  const v = verifyResult(canon, canon.facts, canon.model, expected, r.out, canon.resultPolicy, canon.resultDecisions);
  ok(canon.key + ': verified against canonical contract', v.ok, v.reasons.join('; '));
  report.push({ id: canon.key, modelType: canon.facts.modelType, policy: canon.resultPolicy, status: r.out.status, objective: r.out.objective, constraints: (r.out.constraints || []).length, decisions: (r.out.variables || []).length, verified: v.ok });
});

// ---- VACUOUS-PASS GUARDS: verifier must reject empty output ----------------
(function () {
  const canon = canonical[0]; const base = baseById[canon.key];
  const expected = { status: base.expected.status, objective: base.expected.objective, tolerance: base.expected.tolerance };
  const good = solveModel(canon.model, canon.sense).out;
  // constraints unexpectedly empty -> must fail
  ok('GUARD: empty constraints output fails', !verifyResult(canon, canon.facts, canon.model, expected, Object.assign({}, good, { constraints: [] }), canon.resultPolicy, null).ok);
  // variables unexpectedly empty -> must fail
  ok('GUARD: empty variables output fails', !verifyResult(canon, canon.facts, canon.model, expected, Object.assign({}, good, { variables: [], values: [] }), canon.resultPolicy, null).ok);
  // values shorter than variables -> must fail
  ok('GUARD: values shorter than variables fails', !verifyResult(canon, canon.facts, canon.model, expected, Object.assign({}, good, { values: good.values.slice(0, 1) }), canon.resultPolicy, null).ok);
  // wrong variable cell identity -> must fail
  ok('GUARD: wrong variable identity fails', !verifyResult(canon, canon.facts, canon.model, expected, Object.assign({}, good, { variables: good.variables.map(function (c, i) { return i === 0 ? 'Z99' : c; }) }), canon.resultPolicy, null).ok);
})();

// ---- FIXTURES A..F (variable identity / model type) -----------------------
function fx(grid, domains, whole, sense) { return { key: 'fx', slug: 'fx-x', category: 'start', type: 'continuous', sense: sense || 'max', model: { grid: grid, domains: domains, whole: whole }, expected: { status: 'optimal', modelType: 'continuous', objective: 0 } }; }
(function () {
  const gA = [['Item', 'Val', 'Coeff', 'Term'], ['X', '0', '2', '=B2*C2'], ['Y', '0', '3', '=B3*C3'], ['Tot', '', '', '=SUM(D2:D3)', '<=', '10']];
  ok('FIX-A: 2 continuous no domains -> continuous, 2 vars, chart', (function () { var a = derive.deriveFacts(fx(gA, null, false, 'max')); return a.modelType === 'continuous' && a.decisionCount === 2 && a.chartEligible; })());
  ok('FIX-B: 2 continuous one bounded -> continuous, hasBounds', (function () { var b = derive.deriveFacts(fx(gA, { B2: { type: 'continuous', max: 5 } }, false, 'max')); return b.modelType === 'continuous' && b.decisionCount === 2 && b.hasBounds; })());
  ok('FIX-C: binary + default continuous -> mixed', (function () { var c = derive.deriveFacts(fx(gA, { B2: { type: 'binary' } }, false, 'max')); return c.modelType === 'mixed' && c.decisionCount === 2 && c.variableTypes.join(',') === 'binary,continuous'; })());
  const gD = [['Item', 'Val', 'Coeff', 'Term'], ['X', '0', '2', '=B2*C2'], ['Y', '0', '3', '=B3*C3'], ['Z', '0', '1', '=B4*C4'], ['Tot', '', '', '=SUM(D2:D4)', '<=', '10']];
  ok('FIX-D: integer + 2 continuous -> mixed', (function () { var d = derive.deriveFacts(fx(gD, { B2: { type: 'integer' } }, false, 'max')); return d.modelType === 'mixed' && d.decisionCount === 3; })());
  // Chart eligibility LOSS: the 2-variable feasible-region plot must NOT be offered for a
  // 3-variable model. This is the negative of FIX-A (which requires chartEligible for 2 vars).
  ok('FIX-D2: 3-variable model is NOT chart-eligible (feasible-region plot only for 2 vars)',
     (function () { var d = derive.deriveFacts(fx(gD, null, false, 'max')); return d.decisionCount === 3 && d.chartEligible === false; })());
  const gE = [['Item', 'Coeff', 'Val', 'Term'], ['X', '2', '0', '=B2*C2'], ['Y', '3', '0', '=B3*C3'], ['Tot', '', '', '=SUM(D2:D3)', '<=', '10']];
  ok('FIX-E: decisions outside column B detected', derive.deriveFacts(fx(gE, null, false, 'max')).decisionCount === 2);
  ok('FIX-F: nine facts stable (modelType==expected)', canonical.every(function (cc) { return cc.facts.modelType === cc.expected.modelType; }));
})();

// ---- LEGACY MODELTYPE DRIFT (cross-layer) ---------------------------------
(function () {
  const grid = [['Item', 'Val', 'Coeff', 'Term'], ['X', '0', '2', '=B2*C2'], ['Y', '0', '3', '=B3*C3'], ['Tot', '', '', '=SUM(D2:D3)', '<=', '10']];
  const baseRec = { key: 'drift', slug: 'drift-x', category: 'start', type: 'continuous', sense: 'max', translations: { en: { title: 'D', desc: 'd' }, es: { title: 'D', desc: 'd' }, pt: { title: 'D', desc: 'd' }, de: { title: 'D', desc: 'd' }, fr: { title: 'D', desc: 'd' } }, model: { grid: grid }, expected: { status: 'optimal', modelType: 'continuous', objective: 0 } };
  const meta = { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: ['continuous-variables', 'maximise', 'sum'], related: [], result: { policy: 'objective-feasible' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } };
  // correct continuous/continuous passes
  ok('DRIFT: correct continuous passes defineExample', (function () { try { authoring.defineExample(baseRec, meta); return true; } catch (e) { return false; } })());
  // rec.type="binary" on a continuous model -> fail
  ok('DRIFT: rec.type binary on continuous fails', (function () { try { authoring.defineExample(Object.assign({}, baseRec, { type: 'binary' }), meta); return false; } catch (e) { return /rec.type "binary" != derived/.test(e.message); } })());
  // expected.modelType="binary" -> fail
  ok('DRIFT: expected.modelType binary on continuous fails', (function () { try { authoring.defineExample(Object.assign({}, baseRec, { expected: { status: 'optimal', modelType: 'binary', objective: 0 } }), meta); return false; } catch (e) { return /expected.modelType "binary" != derived/.test(e.message); } })());
  // mixed partial-domain fixture + rec.type="mixed" -> pass
  const mixedRec = { key: 'mix', slug: 'mix-x', category: 'start', type: 'mixed', sense: 'max', translations: baseRec.translations, model: { grid: grid, domains: { B2: { type: 'binary' } } }, expected: { status: 'optimal', modelType: 'mixed', objective: 0 } };
  const mixedMeta = Object.assign({}, meta, { capabilities: ['mixed-variables', 'binary-variables', 'continuous-variables', 'maximise', 'sum'] });
  ok('DRIFT: mixed partial-domain + rec.type mixed passes', (function () { try { authoring.defineExample(mixedRec, mixedMeta); return true; } catch (e) { return false; } })());
})();

// ---- EXACT FIXTURE (partial vector specifically) --------------------------
(function () {
  const grid = [['Item', 'Val', 'Profit', 'Term', 'Used', 'Limit'], ['X', '0', '3', '=B2*C2', '1', '2'], ['Y', '0', '2', '=B3*C3', '1', ''], ['', '', '', '', '', ''], ['Total profit', '', '', '=SUM(D2:D3)', '', ''], ['Total used', '', '', '=SUMPRODUCT(B2:B3,E2:E3)', '<=', '4'], ['X limit', '', '', '=B2', '<=', '2']];
  const rec = { key: 'exactfx', slug: 'exact-fx', category: 'start', type: 'continuous', sense: 'max', translations: { en: { title: 'E', desc: 'd' }, es: { title: 'E', desc: 'd' }, pt: { title: 'E', desc: 'd' }, de: { title: 'E', desc: 'd' }, fr: { title: 'E', desc: 'd' } }, model: { grid: grid }, expected: { status: 'optimal', modelType: 'continuous', objective: 10 } };
  const r = run(grid, { mutate: function (m) { if (m.objective) m.objective.sense = 'max'; } });
  if (r.error) { ok('EXACT: fixture solves', false, r.error); return; }
  const vars = r.out.variables, vals = r.out.values;
  const solved = {}; vars.forEach(function (c, i) { solved[c] = vals[i]; });
  function metaWith(decisions) { return { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct'], related: [], result: { policy: 'exact', decisions: decisions }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } }; }
  const full = {}; vars.forEach(function (c) { full[c] = solved[c]; });
  // complete correct vector passes
  ok('EXACT: complete correct vector passes defineExample', (function () { try { authoring.defineExample(rec, metaWith(full)); return true; } catch (e) { return false; } })());
  // partial vector (only B2) fails with a "missing decision cell" reason
  ok('EXACT: partial vector (only ' + vars[0] + ') fails', (function () { var d = {}; d[vars[0]] = solved[vars[0]]; try { authoring.defineExample(rec, metaWith(d)); return false; } catch (e) { return /is missing decision cell/.test(e.message); } })());
  // only the other variable fails too
  ok('EXACT: partial vector (only ' + vars[1] + ') fails', (function () { var d = {}; d[vars[1]] = solved[vars[1]]; try { authoring.defineExample(rec, metaWith(d)); return false; } catch (e) { return /is missing decision cell/.test(e.message); } })());
  // complete + extra unknown cell fails
  ok('EXACT: vector with extra unknown cell fails', (function () { var d = Object.assign({}, full, { Z9: 1 }); try { authoring.defineExample(rec, metaWith(d)); return false; } catch (e) { return /non-decision cell/.test(e.message); } })());
  // empty vector fails
  ok('EXACT: empty vector fails', (function () { try { authoring.defineExample(rec, metaWith({})); return false; } catch (e) { return /decisions is required/.test(e.message); } })());
  // complete but WRONG value fails behavioural verification (via the shared verifier)
  const facts = derive.deriveFacts(rec);
  const wrongFull = {}; vars.forEach(function (c) { wrongFull[c] = solved[c]; }); wrongFull[vars[0]] = solved[vars[0]] + 1;
  ok('EXACT: complete-but-wrong-value fails behavioural verification', !verifyResult(rec, facts, rec.model, rec.expected, r.out, 'exact', wrongFull).ok);
  ok('EXACT: correct vector passes behavioural verification', verifyResult(rec, facts, rec.model, rec.expected, r.out, 'exact', full).ok);
})();

// ---- FUTURE #10 DRY-RUN: full cycle incl. real solve + verification --------
(function () {
  const rec10 = { key: 'dryrun10', slug: 'dryrun-blend-demo', category: 'start', type: 'continuous', sense: 'min',
    translations: { en: { title: 'Dry-run', desc: 'fixture' }, es: { title: 'Prueba', desc: 'fixture' }, pt: { title: 'Teste', desc: 'fixture' }, de: { title: 'Test', desc: 'fixture' }, fr: { title: 'Essai', desc: 'fixture' } },
    model: { grid: [['Channel', 'Spend', 'Cost/unit', 'Cost', '', ''], ['X', '0', '2', '=B2*C2', '', ''], ['Y', '0', '3', '=B3*C3', '', ''], ['', '', '', '', '', ''], ['Total cost', '', '', '=SUM(D2:D3)', '', ''], ['Total qty', '', '', '=SUM(B2:B3)', '>=', '10']] },
    expected: { status: 'optimal', modelType: 'continuous', objective: 20 } };
  const meta10 = { schemaVersion: 1, primaryCategory: 'blending-formulation', difficulty: 'beginner', minutes: 3, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo', 'blend'], capabilities: ['continuous-variables', 'minimise', 'sum'], related: [], result: { policy: 'objective-feasible' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } };
  // 1-4: define + derive
  let canon10 = null;
  ok('DRY10: defineExample validates + freezes future example', (function () { try { canon10 = authoring.defineExample(rec10, meta10); return Object.isFrozen(canon10); } catch (e) { failures.push('DRY10 define threw: ' + e.message); return false; } })());
  if (!canon10) return;
  const facts10 = canon10.facts;
  // 5: SOLVE via the real supported path
  const r = solveModel(rec10.model, rec10.sense);
  ok('DRY10: model solves on the real engine', !r.error, r.error);
  if (r.error) return;
  // 6-10: verify against the expected contract with the SAME verifier
  const v = verifyResult(rec10, facts10, rec10.model, rec10.expected, r.out, canon10.resultPolicy, canon10.resultDecisions);
  ok('DRY10: real-engine verification passes (status/objective/constraints/domains)', v.ok, v.reasons.join('; '));
  // 11: projections
  ok('DRY10: search projection works (supported locale)', project.searchDocument(canon10, 'es').id === 'dryrun10');
  ok('DRY10: facet projection works', project.facetFacts(canon10).category === 'blending-formulation');
  // 12: deterministic serialization
  ok('DRY10: serialization deterministic', authoring.serializeCanonical(canon10) === authoring.serializeCanonical(canon10));
  // 13: clone safety
  ok('DRY10: clone-safe (canonical unchanged)', (function () { const c = project.clonePayload(canon10); c.grid[0][0] = 'X'; return canon10.model.grid[0][0] !== 'X'; })());
  // malformed future fixture still fails
  ok('DRY10: malformed future fixture rejected', (function () { try { authoring.defineExample(rec10, Object.assign({}, meta10, { difficulty: 'wizard' })); return false; } catch (e) { return /difficulty is invalid/.test(e.message); } })());
  // catalogue still exactly nine
  ok('DRY10: live catalogue still has exactly 36 (dry-run did not mutate it)', canonical.length === 36);
})();

// ---- NO-SOLUTION STATUS FIXTURES: full authoring flow + real engine -------
(function () {
  const langs = { en: { title: 'T', desc: 'd' }, es: { title: 'T', desc: 'd' }, pt: { title: 'T', desc: 'd' }, de: { title: 'T', desc: 'd' }, fr: { title: 'T', desc: 'd' } };
  function metaFor(cat, dir) { return { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: [dir], related: [], result: { policy: 'status-only' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } }; }

  // A. real infeasible: X+Y>=100 but X<=10, Y<=10.
  const infGrid = [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Y', '0', '1', '=B3*C3', '', ''], ['', '', '', '', '', ''], ['Tot', '', '', '=SUM(D2:D3)', '', ''], ['Need', '', '', '=SUM(B2:B3)', '>=', '100'], ['CapX', '', '', '=B2', '<=', '10'], ['CapY', '', '', '=B3', '<=', '10']];
  const infRec = { key: 'inf', slug: 'inf-x', category: 'start', type: 'continuous', sense: 'min', translations: langs, model: { grid: infGrid }, expected: { status: 'infeasible', modelType: 'continuous', objective: null } };
  // FULL authoring flow: F1 schema + F5 metadata + cross-layer + defineExample + freeze.
  let canonInf = null;
  ok('NOSOL-A: infeasible passes defineExample (status-only) + freezes', (function () { try { canonInf = authoring.defineExample(infRec, metaFor('learning-engine', 'minimise')); return Object.isFrozen(canonInf); } catch (e) { failures.push('NOSOL-A define threw: ' + e.message); return false; } })());
  const infR = run(infGrid, { mutate: function (m) { if (m.objective) m.objective.sense = 'min'; } });
  ok('NOSOL-A: real engine returns infeasible', !infR.error && infR.out.status === 'infeasible', infR.error || (infR.out && infR.out.status));
  if (!infR.error && canonInf) {
    const v = verifyResult(infRec, canonInf.facts, infRec.model, { status: 'infeasible', objective: null }, infR.out, 'status-only', null);
    ok('NOSOL-A: status-only verification passes WITHOUT a fake vector', v.ok, v.reasons.join('; '));
  }

  // B. real unbounded: maximise X with only a lower bound.
  const unbGrid = [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Y', '0', '1', '=B3*C3', '', ''], ['', '', '', '', '', ''], ['Tot', '', '', '=SUM(D2:D3)', '', ''], ['Min', '', '', '=B2', '>=', '5']];
  const unbRec = { key: 'unb', slug: 'unb-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: unbGrid }, expected: { status: 'unbounded', modelType: 'continuous', objective: null } };
  let canonUnb = null;
  ok('NOSOL-B: unbounded passes defineExample (status-only) + freezes', (function () { try { canonUnb = authoring.defineExample(unbRec, metaFor('learning-engine', 'maximise')); return Object.isFrozen(canonUnb); } catch (e) { failures.push('NOSOL-B define threw: ' + e.message); return false; } })());
  const unbR = run(unbGrid, { mutate: function (m) { if (m.objective) m.objective.sense = 'max'; } });
  ok('NOSOL-B: real engine returns unbounded', !unbR.error && unbR.out.status === 'unbounded', unbR.error || (unbR.out && unbR.out.status));
  if (!unbR.error && canonUnb) {
    const v = verifyResult(unbRec, canonUnb.facts, unbRec.model, { status: 'unbounded', objective: null }, unbR.out, 'status-only', null);
    ok('NOSOL-B: status-only verification passes WITHOUT a fake vector', v.ok, v.reasons.join('; '));
  }

  // Policy/status matrix (via defineExample): forbidden combinations must fail.
  function tryDefine(rec, meta) { try { authoring.defineExample(rec, meta); return null; } catch (e) { return e.message; } }
  ok('MATRIX: infeasible + objective-feasible fails', /must use policy "status-only"/.test(tryDefine(infRec, Object.assign({}, metaFor('x', 'minimise'), { result: { policy: 'objective-feasible' } })) || ''));
  ok('MATRIX: infeasible + exact fails', /must use policy "status-only"/.test(tryDefine(infRec, Object.assign({}, metaFor('x', 'minimise'), { result: { policy: 'exact', decisions: { B2: 0 } } })) || ''));
  ok('MATRIX: unbounded + objective-feasible fails', /must use policy "status-only"/.test(tryDefine(unbRec, Object.assign({}, metaFor('x', 'maximise'), { result: { policy: 'objective-feasible' } })) || ''));
  ok('MATRIX: optimal + status-only fails', (function () { const prod = canonical[0]; const rec = { key: 'o', slug: 'o-x', category: 'start', type: 'continuous', sense: prod.sense, translations: langs, model: prod.model, expected: prod.expected }; return /cannot use policy "status-only"/.test(tryDefine(rec, Object.assign({}, metaFor('x', prod.sense === 'max' ? 'maximise' : 'minimise'), { result: { policy: 'status-only' } })) || ''); })());
  // I. unknown/incomplete cannot enter the solution-bearing branch: not publishable.
  ok('MATRIX: unknown expected status is not publishable', /not publishable/.test(tryDefine(Object.assign({}, infRec, { expected: { status: 'unknown', modelType: 'continuous', objective: null } }), metaFor('x', 'minimise')) || ''));
  ok('MATRIX: incomplete expected status is not publishable', /not publishable/.test(tryDefine(Object.assign({}, infRec, { expected: { status: 'incomplete', modelType: 'continuous', objective: null } }), metaFor('x', 'minimise')) || ''));
  // Verifier guard: an unknown status never silently enters the solution branch.
  ok('MATRIX: verifier rejects unknown expected status', !verifyResult(infRec, derive.deriveFacts(infRec), infRec.model, { status: 'unknown', objective: null }, infR.out, 'status-only', null).ok);

  // Negative: expected no-solution but actual optimal -> fail.
  const prod = canonical[0];
  const goodProd = solveModel(prod.model, prod.sense).out;
  ok('NOSOL-neg: expected infeasible but actual optimal fails', !verifyResult(prod, prod.facts, prod.model, { status: 'infeasible', objective: null }, goodProd, 'status-only', null).ok);
  ok('NOSOL-neg: expected unbounded but actual optimal fails', !verifyResult(prod, prod.facts, prod.model, { status: 'unbounded', objective: null }, goodProd, 'status-only', null).ok);
})();

// ---- TOLERANCE BOUNDARY (exact decisions use the canonical tolerance) -------
(function () {
  const prod = canonical[0];
  const out = solveModel(prod.model, prod.sense).out;
  const vars = out.variables, vals = out.values;
  const facts = prod.facts;
  function exactWith(delta, tol) {
    const dec = {}; vars.forEach(function (c, i) { dec[c] = vals[i]; }); dec[vars[0]] = vals[0] + delta;
    return verifyResult(prod, facts, prod.model, { status: prod.expected.status, objective: prod.expected.objective, tolerance: tol }, out, 'exact', dec);
  }
  ok('TOL: exact diff 5e-7 within default 1e-6 passes', exactWith(5e-7, 1e-6).ok);
  ok('TOL: exact diff 2e-6 above default 1e-6 fails', !exactWith(2e-6, 1e-6).ok);
  ok('TOL: exact diff 5e-7 with tight 1e-8 tolerance fails', !exactWith(5e-7, 1e-8).ok);
  ok('TOL: exact diff 5e-9 within tight 1e-8 passes', exactWith(5e-9, 1e-8).ok);
})();

// ---- EFFECTIVE DOMAIN (whole + explicit continuous bounds) -----------------
(function () {
  const grid = [['Item', 'Val', 'Coeff', 'Term'], ['X', '0', '2', '=B2*C2'], ['Y', '0', '3', '=B3*C3'], ['Tot', '', '', '=SUM(D2:D3)', '<=', '10']];
  const rec = { key: 'wf', slug: 'wf-x', category: 'start', type: 'integer', sense: 'max', model: { grid: grid, whole: true, domains: { B2: { type: 'continuous', min: 0, max: 10 } } }, expected: { status: 'optimal', modelType: 'integer', objective: 0 } };
  const eff = derive.deriveEffectiveDomains(rec);
  const b2 = eff.filter(function (e) { return e.cell === 'B2'; })[0];
  ok('EFFDOM: whole + continuous-declared B2 is effectively integer', b2 && b2.effectiveType === 'integer', b2 && b2.effectiveType);
  const facts = derive.deriveFacts(rec);
  const cells = derive.deriveDecisionCells(rec);
  const fakeOut = { status: 'optimal', objective: 0, constraints: [{ satisfied: true }], variables: cells, values: cells.map(function (c) { return c === 'B2' ? 0.5 : 0; }) };
  const v = verifyResult(rec, Object.assign({}, facts, { constraintCount: 1, decisionCount: cells.length }), rec.model, { status: 'optimal', objective: 0 }, fakeOut, 'objective-feasible', null);
  ok('EFFDOM: fractional value on effective-integer cell FAILS', !v.ok && v.reasons.join(';').indexOf('B2 not integer') !== -1, v.reasons.join('; '));
})();

if (require.main === module) {
  report.forEach(function (r) { console.log('  ' + r.id.padEnd(11) + ' type=' + r.modelType.padEnd(10) + ' policy=' + r.policy + ' status=' + r.status + ' obj=' + r.objective + ' constraints=' + r.constraints + ' decisions=' + r.decisions + ' verified=' + r.verified); });
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F5 EXAMPLES BEHAVIOURAL  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail, report: report };
