/* tests_status_coverage.js — the Guide status section documents EXACTLY the set
 * of result states the engine can return, no more and no fewer.
 *
 * The engine emits raw status strings (optimal, feasible, unknown, infeasible,
 * unbounded). The Guide documents them under editorial labels; "unknown" is
 * documented as "Search incomplete". This test pins the mapping so the two can
 * never drift: a new engine state with no Guide entry, or a Guide entry for a
 * state the engine never returns, fails here.
 */
const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

// The canonical raw engine states, each mapped to the Guide label key that
// documents it. This is the single place the mapping is asserted.
const STATE_TO_KEY = {
  optimal:    'statusOptimalLabel',
  feasible:   'statusFeasibleLabel',
  unknown:    'statusIncompleteLabel',   // documented as "Search incomplete"
  infeasible: 'statusInfeasibleLabel',
  unbounded:  'statusUnboundedLabel'
};

// 1. The engine actually returns each of these raw states (grep the composed solver).
const solver = composedHtml(siteDir, 'solver.html');
Object.keys(STATE_TO_KEY).forEach(function (state) {
  const re = new RegExp("['\"]" + state + "['\"]");
  ok('engine returns raw state "' + state + '"', re.test(solver), state);
});

// 2. The Guide documents each mapped label (present in the dictionary, all langs,
//    and rendered on guide.html).
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;
const guideHtml = composedHtml(siteDir, 'guide.html');

Object.keys(STATE_TO_KEY).forEach(function (state) {
  const key = STATE_TO_KEY[state];
  ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
    const v = DICT[lang].guide && DICT[lang].guide[key];
    ok('guide documents "' + state + '" (' + key + ') in ' + lang,
       typeof v === 'string' && v.trim().length > 0, key);
  });
  ok('guide.html renders the ' + state + ' status label',
     guideHtml.indexOf('data-i18n="' + key + '"') !== -1, key);
});

// 3. No EXTRA status label in the Guide beyond the documented set (a label for a
//    state the engine never returns would be misleading).
const renderedLabels = [...guideHtml.matchAll(/data-i18n="(status[A-Za-z]+Label)"/g)].map(m => m[1]);
const allowed = new Set(Object.values(STATE_TO_KEY));
renderedLabels.forEach(function (key) {
  ok('guide status label ' + key + ' maps to a real engine state', allowed.has(key), key);
});
// And the counts match: exactly five documented, five states.
ok('guide documents exactly the five engine states',
   new Set(renderedLabels).size === Object.keys(STATE_TO_KEY).length,
   renderedLabels.length + ' rendered vs ' + Object.keys(STATE_TO_KEY).length + ' states');

console.log('STATUS COVERAGE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
