/**
 * tests_doc_hub_i18n.js — behavioural test that the hub cross-links TRANSLATE
 * when the language changes, and that translating never alters the href.
 *
 * Loads guide.html and capabilities.html in jsdom, runs each page's real inline
 * init, switches language, and checks the rendered link text against the
 * dictionary while asserting the href is unchanged.
 *
 * Requires jsdom (CI: hard fail; local without jsdom: skip).
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('DOC HUB I18N TESTS  FAILED: jsdom could not load under CI'); process.exit(1); }
  console.log('DOC HUB I18N TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
const i18n = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');

// English dictionary for expected values.
const gg = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
gg.window = gg; gg.globalThis = gg;
new Function('window', 'navigator', 'location', 'document', 'globalThis', i18n)
  .call(gg, gg, gg.navigator, gg.location, gg.document, gg);
const DICT = gg.Plumline.i18n.dict;

// Extract a page's real inline init call, so we exercise the true wiring.
function extractInit(html, page) {
  const re = new RegExp("Plumline\\.i18n\\.init\\('" + page + "'[^)]*\\)\\s*;?");
  const m = html.match(re);
  return m ? m[0] : null;
}

function boot(file, page, url) {
  const html = fs.readFileSync(path.join(siteDir, file), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url });
  const { window } = dom;
  window.eval(i18n);
  const init = extractInit(html, page);
  ok(file + ': has an inline init(\'' + page + '\') call', !!init);
  if (init) window.eval(init);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

function linkByKey(doc, key) {
  return doc.querySelector('a[data-i18n="' + key + '"]');
}

// ---- Capabilities: forward links translate, href fixed (switch to German) --
(function () {
  const dom = boot('capabilities.html', 'capabilities', 'https://plumline.online/capabilities.html');
  const doc = dom.window.document;
  const sel = doc.getElementById('lang');
  ok('capabilities: language selector exists', !!sel);
  if (!sel) return;

  // Record hrefs before switching.
  const before = {};
  caps.GROUP_ORDER.forEach(function (grp) {
    const a = linkByKey(doc, caps.GROUP_DOCS[grp].learnKey);
    before[grp] = a ? a.getAttribute('href') : null;
  });

  sel.value = 'de';
  sel.dispatchEvent(new dom.window.Event('change'));

  caps.GROUP_ORDER.forEach(function (grp) {
    const doc2 = caps.GROUP_DOCS[grp];
    const a = linkByKey(doc, doc2.learnKey);
    ok('capabilities [de]: ' + doc2.learnKey + ' translated',
       a && a.textContent.trim() === DICT.de.capabilities[doc2.learnKey],
       a && a.textContent.trim());
    ok('capabilities [de]: ' + doc2.learnKey + ' href unchanged by translation',
       a && a.getAttribute('href') === before[grp], a && a.getAttribute('href'));
  });
})();

// ---- Guide: reverse links translate, href fixed (switch to Spanish) --------
(function () {
  const dom = boot('guide.html', 'guide', 'https://plumline.online/guide.html');
  const doc = dom.window.document;
  const sel = doc.getElementById('lang');
  ok('guide: language selector exists', !!sel);
  if (!sel) return;

  const before = {};
  caps.GROUP_ORDER.forEach(function (grp) {
    const a = linkByKey(doc, caps.GROUP_DOCS[grp].reverseKey);
    before[grp] = a ? a.getAttribute('href') : null;
  });

  sel.value = 'es';
  sel.dispatchEvent(new dom.window.Event('change'));

  caps.GROUP_ORDER.forEach(function (grp) {
    const doc2 = caps.GROUP_DOCS[grp];
    const a = linkByKey(doc, doc2.reverseKey);
    ok('guide [es]: ' + doc2.reverseKey + ' translated',
       a && a.textContent.trim() === DICT.es.guide[doc2.reverseKey],
       a && a.textContent.trim());
    ok('guide [es]: ' + doc2.reverseKey + ' href unchanged by translation',
       a && a.getAttribute('href') === before[grp], a && a.getAttribute('href'));
  });

  // The new explanation section translates too, and the status list now has the
  // unbounded item.
  const eh = doc.querySelector('[data-i18n="explainH"]');
  ok('guide [es]: explanation heading translated',
     eh && eh.textContent.trim() === DICT.es.guide.explainH, eh && eh.textContent.trim());
  const unb = doc.querySelector('[data-i18n="statusUnboundedLabel"]');
  ok('guide [es]: unbounded status present and translated',
     unb && unb.textContent.trim() === DICT.es.guide.statusUnboundedLabel, unb && unb.textContent.trim());

  // CRITICAL: the internal #status link inside #explanation must SURVIVE i18n.
  // apply() sets innerHTML on data-i18n nodes, so a link nested inside a
  // translated parent would be destroyed. The link lives in its own <a> with
  // its own key, so it must still be in the DOM after init AND after switching
  // language, with its href intact.
  const statusLink = doc.querySelector('#explanation a[href="#status"]');
  ok('guide [es]: #status link survives i18n', !!statusLink);
  ok('guide [es]: #status link href unchanged',
     statusLink && statusLink.getAttribute('href') === '#status',
     statusLink && statusLink.getAttribute('href'));
  ok('guide [es]: #status link text translated',
     statusLink && statusLink.textContent.trim() === DICT.es.guide.explainStatusLink,
     statusLink && statusLink.textContent.trim());
})();

console.log('DOC HUB I18N TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) process.exit(1);
if (typeof module !== 'undefined') module.exports = { pass, fail };
