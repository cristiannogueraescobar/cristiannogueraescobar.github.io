/**
 * tests_worker_token.js — regression tests for the Web Worker stale-result guard.
 *
 * These test the PRESENTATION-layer token logic (not the engine maths):
 * a result that arrives after the model was edited or the solve cancelled
 * must be discarded. The bug this pins: onmessage compared against the
 * captured myToken instead of the global workerToken, so a message already
 * queued before terminate() could slip through and present a stale result.
 *
 * Run: node engine/tests_worker_token.js
 */

var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL:', name, detail || ''); }
}

// Minimal reimplementation of the guard exactly as it runs in solver.html.
function makeHarness() {
  var state = { workerBusy: false, workerToken: 0, presented: null, lastResult: null };
  function cancelSolve() {
    if (!state.workerBusy) return;
    state.workerToken++;      // any in-flight result is now stale
    state.workerBusy = false;
  }
  function modelChanged() {
    if (state.workerBusy) cancelSolve();
    state.lastResult = null;
  }
  function presentResult(out) { state.presented = out; state.lastResult = out; }
  // The FIXED handler: compare against the GLOBAL workerToken.
  function onmessage(e) {
    if (e.data.token !== state.workerToken) return;
    state.workerBusy = false;
    if (e.data.ok) presentResult(e.data.out);
  }
  function startSolve() {
    state.workerBusy = true;
    state.lastResult = null;
    return ++state.workerToken;   // this run's token
  }
  return { state: state, cancelSolve: cancelSolve, modelChanged: modelChanged,
           onmessage: onmessage, startSolve: startSolve };
}

// 1. Stale result after cancel/edit is discarded.
(function () {
  var h = makeHarness();
  var tok = h.startSolve();               // token 1
  h.modelChanged();                        // workerToken -> 2
  h.onmessage({ data: { token: tok, ok: true, out: 'STALE' } });
  ok('stale result after edit is discarded', h.state.presented === null,
     'presented=' + h.state.presented);
})();

// 2. A legitimate result (current token) is still presented.
(function () {
  var h = makeHarness();
  var tok = h.startSolve();               // token 1
  h.onmessage({ data: { token: tok, ok: true, out: 'GOOD' } });
  ok('current result is presented', h.state.presented === 'GOOD',
     'presented=' + h.state.presented);
})();

// 3. Stale result after cancel then a NEW solve: old token must not present,
//    even though a new run is in flight.
(function () {
  var h = makeHarness();
  var t1 = h.startSolve();                // token 1
  h.modelChanged();                        // -> 2
  var t2 = h.startSolve();                // token 3 (new run)
  h.onmessage({ data: { token: t1, ok: true, out: 'OLD' } });
  ok('old-run result ignored during a new run', h.state.presented === null,
     'presented=' + h.state.presented);
  h.onmessage({ data: { token: t2, ok: true, out: 'NEW' } });
  ok('new-run result is presented', h.state.presented === 'NEW',
     'presented=' + h.state.presented);
})();

// 4. modelChanged() clears lastResult so exports can't emit a stale answer.
(function () {
  var h = makeHarness();
  h.startSolve();
  h.onmessage({ data: { token: h.state.workerToken, ok: true, out: 'ANS' } });
  ok('lastResult set after solve', h.state.lastResult === 'ANS');
  h.modelChanged();
  ok('lastResult cleared on edit', h.state.lastResult === null);
})();

console.log('WORKER TOKEN TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
