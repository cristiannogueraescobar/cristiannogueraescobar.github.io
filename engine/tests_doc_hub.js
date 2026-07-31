/* tests_doc_hub.js — the Guide<->Capabilities documentation hub has no broken
 * anchors in either direction, and its cross-links translate.
 *
 * Forward:  capabilities.html -> guide.html#<section>   (one "learn" link per group)
 * Reverse:  guide.html        -> capabilities.html#cap-<id>  (one back link per group)
 * Internal: guide.html #explanation links to #status.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const guide = fs.readFileSync(path.join(siteDir, 'guide.html'), 'utf8');
const cap = fs.readFileSync(path.join(siteDir, 'capabilities.html'), 'utf8');
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));

function hasId(html, id) { return new RegExp('id="' + id + '"').test(html); }

// Every capabilities.html -> guide.html#anchor resolves.
let fwd = 0;
for (const m of cap.matchAll(/guide\.html#([a-z-]+)/g)) {
  fwd++;
  ok('doc hub: guide anchor #' + m[1] + ' exists (from capabilities.html)', hasId(guide, m[1]), m[1]);
}
ok('doc hub: capabilities.html has a learn link for every group',
   fwd >= caps.GROUP_ORDER.length, fwd + ' forward links');

// Every guide.html -> capabilities.html#cap-<id> resolves.
let rev = 0;
for (const m of guide.matchAll(/capabilities\.html#(cap-[a-z-]+)/g)) {
  rev++;
  ok('doc hub: capability anchor #' + m[1] + ' exists (from guide.html)', hasId(cap, m[1]), m[1]);
}
ok('doc hub: guide.html has a back link for every group',
   rev >= caps.GROUP_ORDER.length, rev + ' reverse links');

// Guide internal anchors (e.g. #explanation -> #status) resolve.
for (const m of guide.matchAll(/href="#([a-z-]+)"/g)) {
  ok('doc hub: guide internal anchor #' + m[1] + ' exists', hasId(guide, m[1]), m[1]);
}

// The four new/used Guide anchors that GROUP_DOCS depends on are present.
['variables', 'direction', 'status', 'limits', 'explanation'].forEach(function (id) {
  ok('doc hub: guide.html has #' + id, hasId(guide, id));
});

// Cross-link texts translate (present in all five languages).
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;
caps.GROUP_ORDER.forEach(function (grp) {
  const doc = caps.GROUP_DOCS[grp];
  ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
    const learn = DICT[lang].capabilities[doc.learnKey];
    const back = DICT[lang].guide[doc.reverseKey];
    ok('doc hub: ' + doc.learnKey + ' [' + lang + ']', typeof learn === 'string' && learn.trim().length > 0);
    ok('doc hub: ' + doc.reverseKey + ' [' + lang + ']', typeof back === 'string' && back.trim().length > 0);
  });
});

console.log('DOC HUB TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
