/**
 * tests_direction.js — pins the two promises the Guide makes about the
 * maximise/minimise confirmation:
 *   "It asks once per model and remembers your choice."
 *   "If you change the goal formula or its label, Plumline asks again."
 *
 * The decision rests entirely on sameObjective(confirmed, current): the
 * direction stays confirmed only while cell + label + formula are unchanged.
 * This test extracts that pure function from solver.html and exercises the
 * six scenarios from the audit.
 *
 * Run: node engine/tests_direction.js
 */
// Public product capabilities demonstrated by the cases in this file
// (anchors validated by tests_capabilities.js — do not remove without
// updating assets/product-capabilities.js):
//   CAPABILITY: model-direction

const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Extract sameObjective from solver.html.
const html = composedHtml(path.join(__dirname, '..'), 'solver.html');
const m = html.match(/function sameObjective\(a,b\)\{[\s\S]*?\n  \}/);
if (!m) { console.log('  FAIL: could not find sameObjective in solver.html'); console.log('DIRECTION TESTS  PASSED: 0   FAILED: 1'); process.exit(1); }
eval(m[0]);

// A confirmed signature: objective in D5, label "Total profit", a SUM formula,
// direction maximise.
const confirmed = { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D4)', detected: 'max' };

// 1. First solve in Auto then confirm -> a fresh identical signature stays confirmed.
ok('same objective stays confirmed',
   sameObjective(confirmed, { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D4)', detected: 'max' }) === true);

// 2. Second solve with no changes -> still confirmed (does not re-ask).
ok('re-solve with no change is confirmed',
   sameObjective(confirmed, { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D4)' }) === true);

// 3. Changing only a constraint (objective cell/label/formula untouched) -> confirmed.
//    The signature does not include constraints, so an identical objective stays confirmed.
ok('changing a constraint keeps direction',
   sameObjective(confirmed, { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D4)' }) === true);

// 4. Changing the objective FORMULA -> re-ask (not the same objective).
ok('changed formula re-asks',
   sameObjective(confirmed, { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D5)' }) === false);

// 5. Changing the objective LABEL -> re-ask.
ok('changed label re-asks',
   sameObjective(confirmed, { cell: 'D5', label: 'Total cost', formula: '=SUM(D2:D4)' }) === false);

// 6. In a MANUAL model, a different objective cell means a different objective,
//    so the direction must be re-confirmed (it is not inherited).
ok('different cell in a manual model re-asks',
   sameObjective(confirmed, { cell: 'D9', label: 'Total profit', formula: '=SUM(D2:D4)' }) === false);

// 6b. Loading a BUILT-IN example is a separate flow: loadExample sets the
//     selector from the example's declared sense and stores that as the
//     confirmed signature for the example's own objective. It therefore uses
//     the example's declared direction and does NOT inherit the previous
//     model's confirmation (the signature is rebuilt for the new objective).
//     Model this: a confirmation carried over from a prior model does not match
//     the example's own objective signature, so it cannot leak in.
const priorModel = { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D4)', detected: 'max' };
const exampleObjective = { cell: 'D6', label: 'Total cost', formula: '=SUM(D2:D5)', detected: 'min' };
ok('built-in example does not inherit prior confirmation',
   sameObjective(priorModel, exampleObjective) === false);
// After loadExample stores the example's own signature as confirmed, it matches.
const exampleConfirmed = { cell: 'D6', label: 'Total cost', formula: '=SUM(D2:D5)', detected: 'min' };
ok('built-in example is confirmed for its own objective',
   sameObjective(exampleConfirmed, exampleObjective) === true);

// Guard: changing a referenced coefficient VALUE does not change the formula,
// so the objective signature is unchanged and the direction stays confirmed.
ok('changing a coefficient value keeps direction',
   sameObjective(confirmed, { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D4)' }) === true);

// Null-safety: no confirmed signature -> never counts as confirmed.
ok('null confirmed is not confirmed',
   !sameObjective(null, { cell: 'D5', label: 'Total profit', formula: '=SUM(D2:D4)' }));

console.log('DIRECTION TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
