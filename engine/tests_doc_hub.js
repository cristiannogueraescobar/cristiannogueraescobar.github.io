/* tests_doc_hub.js — the Guide<->Capabilities documentation hub has EXACTLY one
 * link per group in each direction, each with the correct href and i18n key on
 * the SAME anchor, no broken targets, and no duplicates.
 *
 * Forward:  capabilities.html -> guide.html#<guideAnchor>       (learnKey)
 * Reverse:  guide.html        -> capabilities.html#cap-<reverseCapabilityId> (reverseKey)
 * Internal: guide.html #explanation links to #status; #variables links to #direction.
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

// Count and capture <a ...> tags matching both an href and a data-i18n key on
// the SAME element (order-independent), so we never accept an href on one anchor
// and the key on a different one.
function anchorsWith(html, href, key) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*>/g)) {
    const tag = m[0];
    if (tag.indexOf('href="' + href + '"') !== -1 && tag.indexOf('data-i18n="' + key + '"') !== -1) {
      out.push(tag);
    }
  }
  return out;
}
// Any anchor carrying this href (to detect duplicates pointing at the same target).
function anchorsHref(html, href) {
  return [...html.matchAll(/<a\b[^>]*>/g)].map(m => m[0]).filter(t => t.indexOf('href="' + href + '"') !== -1);
}

// ---- Exactly one link per group in each direction ----------------------
caps.GROUP_ORDER.forEach(function (grp) {
  const doc = caps.GROUP_DOCS[grp];

  // Forward: capabilities.html -> guide.html#guideAnchor with learnKey.
  const fwdHref = doc.guidePath + '#' + doc.guideAnchor;
  const fwd = anchorsWith(cap, fwdHref, doc.learnKey);
  ok('doc hub [' + grp + ']: exactly one forward link with correct href+key on one anchor',
     fwd.length === 1, fwd.length + ' matching anchors for ' + fwdHref + ' / ' + doc.learnKey);
  ok('doc hub [' + grp + ']: forward target #' + doc.guideAnchor + ' exists on guide.html',
     hasId(guide, doc.guideAnchor), doc.guideAnchor);
  ok('doc hub [' + grp + ']: no duplicate forward anchors to ' + fwdHref,
     anchorsHref(cap, fwdHref).length === 1, anchorsHref(cap, fwdHref).length + ' anchors');

  // Reverse: guide.html -> capabilities.html#cap-<reverseCapabilityId> with reverseKey.
  const revHref = 'capabilities.html#cap-' + doc.reverseCapabilityId;
  const rev = anchorsWith(guide, revHref, doc.reverseKey);
  ok('doc hub [' + grp + ']: exactly one reverse link with correct href+key on one anchor',
     rev.length === 1, rev.length + ' matching anchors for ' + revHref + ' / ' + doc.reverseKey);
  ok('doc hub [' + grp + ']: reverse target #cap-' + doc.reverseCapabilityId + ' exists on capabilities.html',
     hasId(cap, 'cap-' + doc.reverseCapabilityId), doc.reverseCapabilityId);
  ok('doc hub [' + grp + ']: no duplicate reverse anchors to ' + revHref,
     anchorsHref(guide, revHref).length === 1, anchorsHref(guide, revHref).length + ' anchors');
});

// ---- Exactly four links in each direction, no more --------------------
const totalForward = caps.GROUP_ORDER.reduce(function (n, grp) {
  const doc = caps.GROUP_DOCS[grp];
  return n + anchorsHref(cap, doc.guidePath + '#' + doc.guideAnchor).length;
}, 0);
ok('doc hub: exactly four forward links total', totalForward === 4, totalForward + ' forward links');
const totalReverse = caps.GROUP_ORDER.reduce(function (n, grp) {
  const doc = caps.GROUP_DOCS[grp];
  return n + anchorsHref(guide, 'capabilities.html#cap-' + doc.reverseCapabilityId).length;
}, 0);
ok('doc hub: exactly four reverse links total', totalReverse === 4, totalReverse + ' reverse links');

// ---- Internal Guide anchors resolve -----------------------------------
for (const m of guide.matchAll(/href="#([a-z-]+)"/g)) {
  ok('doc hub: guide internal anchor #' + m[1] + ' exists', hasId(guide, m[1]), m[1]);
}
['variables', 'direction', 'status', 'limits', 'explanation'].forEach(function (id) {
  ok('doc hub: guide.html has #' + id, hasId(guide, id));
});
// #variables must link to #direction (the Models trail), and #explanation to #status.
ok('doc hub: #variables links to #direction',
   /id="variables"[\s\S]*?href="#direction"[\s\S]*?<\/section>/.test(guide));
ok('doc hub: #explanation links to #status',
   /id="explanation"[\s\S]*?href="#status"[\s\S]*?<\/section>/.test(guide));

// ---- Cross-link texts translate in all five languages -----------------
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
