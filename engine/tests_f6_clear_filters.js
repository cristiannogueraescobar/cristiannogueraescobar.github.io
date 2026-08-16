'use strict';
/* ============================================================================
   F6 CLEAR-FILTERS BROWSER TEST (audit microfix: empty-state button binding).

   The bug lived in DOM binding, not in the pure core: examples.html has TWO .lib-clear
   buttons — the top-level #libClear ("Clear all") and one inside #libEmpty
   ("Clear filters") — but the ui.js only bound #libClear, leaving the empty-state button
   dead. A source-only or pure-function test cannot catch this; it needs a real browser
   click. This suite:

     1. opens Examples (with lang + an unrelated param + a hash in the URL)
     2. types a query that yields 0 results
     3. asserts visible_count == 0, #libEmpty visible, its "Clear filters" button visible
     4. performs a REAL click on THAT button
     5. asserts search == "", all facets unchecked, 36 cards visible, #libEmpty hidden,
        q/category/type/difficulty/goal removed from the URL, lang + unrelated param + hash
        preserved, and focus back on #libSearch
     6. NEGATIVE: strips the empty-state button's binding (mimicking the original bug) and
        asserts the click then FAILS to clear — proving the test really guards the binding.

   Requires a built dist + Playwright/Chromium; SKIPS (reported, not failed) if absent.
   Node built-ins for the static server (http); no shell.
   ========================================================================== */
var http = require('http');
var fs = require('fs');
var path = require('path');

var SITE = path.join(__dirname, '..');
var DIST = path.join(SITE, 'dist');
var pass = 0, fail = 0, skipped = false; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

var chromium = null;
try { chromium = require('playwright').chromium; } catch (e) { chromium = null; }

function mime(p) {
  if (p.endsWith('.html')) return 'text/html';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.js')) return 'text/javascript';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}
function serve(root) {
  return http.createServer(function (req, res) {
    var u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
    fs.readFile(path.join(root, u), function (e, data) {
      if (e) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': mime(path.join(root, u)) }); res.end(data);
    });
  });
}

(async function () {
  if (!chromium || !fs.existsSync(path.join(DIST, 'examples.html'))) {
    skipped = true;
    console.log('F6 CLEAR-FILTERS  SKIPPED (no ' + (chromium ? 'dist build' : 'playwright') + '); run after `vite build`.');
    return;
  }
  var server = serve(DIST);
  await new Promise(function (r) { server.listen(0, r); });
  var port = server.address().port;
  var url = 'http://localhost:' + port + '/examples.html?lang=es&foo=bar#how';
  var browser = await chromium.launch();

  // ---- POSITIVE: the empty-state "Clear filters" button really clears. ----
  await (async function positive() {
    var ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    var page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(400);

    await page.fill('#libSearch', 'zzzzznomatch');
    await page.waitForTimeout(250);

    var empty = await page.evaluate(function () {
      var cards = Array.prototype.slice.call(document.querySelectorAll('[data-ex-id]'));
      var e = document.getElementById('libEmpty');
      var btn = e ? e.querySelector('.lib-clear') : null;
      var br = btn ? btn.getBoundingClientRect() : { width: 0 };
      return {
        visible: cards.filter(function (c) { return !c.hidden; }).length,
        emptyVisible: e ? !e.hidden : false,
        btnVisible: !!btn && br.width > 0 && getComputedStyle(btn).display !== 'none' && getComputedStyle(btn).visibility !== 'hidden',
      };
    });
    ok('CLEAR/empty: query yields 0 visible cards', empty.visible === 0, String(empty.visible));
    ok('CLEAR/empty: #libEmpty is visible', empty.emptyVisible);
    ok('CLEAR/empty: the "Clear filters" button is visible', empty.btnVisible);

    // REAL click on the empty-state button (not #libClear).
    await page.click('#libEmpty .lib-clear');
    await page.waitForTimeout(250);

    var after = await page.evaluate(function () {
      var cards = Array.prototype.slice.call(document.querySelectorAll('[data-ex-id]'));
      return {
        search: document.getElementById('libSearch').value,
        facetsChecked: Array.prototype.slice.call(document.querySelectorAll('[data-facet]')).filter(function (i) { return i.checked; }).length,
        visible: cards.filter(function (c) { return !c.hidden; }).length,
        emptyHidden: document.getElementById('libEmpty').hidden,
        href: location.href,
        focusId: document.activeElement ? document.activeElement.id : '',
      };
    });
    ok('CLEAR/empty: search input cleared', after.search === '', JSON.stringify(after.search));
    ok('CLEAR/empty: all facets unchecked', after.facetsChecked === 0, String(after.facetsChecked));
    ok('CLEAR/empty: LIVE: 36 cards visible again', after.visible === 36, String(after.visible));
    ok('CLEAR/empty: #libEmpty hidden', after.emptyHidden === true);
    ok('CLEAR/empty: q removed from URL', !/[?&]q=/.test(after.href), after.href);
    ok('CLEAR/empty: category removed from URL', after.href.indexOf('category=') === -1, after.href);
    ok('CLEAR/empty: type removed from URL', after.href.indexOf('type=') === -1);
    ok('CLEAR/empty: difficulty removed from URL', after.href.indexOf('difficulty=') === -1);
    ok('CLEAR/empty: goal removed from URL', after.href.indexOf('goal=') === -1);
    ok('CLEAR/empty: lang preserved', after.href.indexOf('lang=es') !== -1, after.href);
    ok('CLEAR/empty: unrelated param preserved', after.href.indexOf('foo=bar') !== -1, after.href);
    ok('CLEAR/empty: hash preserved', after.href.slice(-4) === '#how', after.href);
    ok('CLEAR/empty: focus returned to #libSearch', after.focusId === 'libSearch', after.focusId);

    await ctx.close();
  })();

  // ---- top-level "Clear all" (#libClear) still works. ----
  {
    var ctxP = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    var pageP = await ctxP.newPage();
    await pageP.goto(url, { waitUntil: 'load' });
    await pageP.waitForTimeout(400);
    // top-level "Clear all" still works.
    await pageP.evaluate(function () { document.getElementById('libSearch').value = 'x'; });
    await pageP.fill('#libSearch', 'blend');
    await pageP.waitForTimeout(200);
    await pageP.click('#libClear');
    await pageP.waitForTimeout(200);
    var top = await pageP.evaluate(function () {
      return {
        search: document.getElementById('libSearch').value,
        visible: Array.prototype.slice.call(document.querySelectorAll('[data-ex-id]')).filter(function (c) { return !c.hidden; }).length,
        focusId: document.activeElement ? document.activeElement.id : '',
      };
    });
    ok('CLEAR/top: #libClear ("Clear all") still clears search', top.search === '');
    ok('CLEAR/top: LIVE: #libClear restores 36 cards', top.visible === 36, String(top.visible));
    ok('CLEAR/top: #libClear returns focus to search', top.focusId === 'libSearch');
    await ctxP.close();
  }

  // ---- NEGATIVE: remove the empty-state button's binding; the click must NOT clear. ----
  {
    var ctxN = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    var pageN = await ctxN.newPage();
    // Break the binding the way the original bug did: neutralise the empty-state button so
    // it carries no click handler, then confirm clicking it leaves the empty state up.
    await pageN.addInitScript(function () {
      document.addEventListener('DOMContentLoaded', function () {
        var e = document.getElementById('libEmpty');
        if (!e) return;
        var btn = e.querySelector('.lib-clear');
        if (btn) { var clone = btn.cloneNode(true); btn.parentNode.replaceChild(clone, btn); } // drops listeners
      });
    });
    await pageN.goto(url, { waitUntil: 'load' });
    await pageN.waitForTimeout(400);
    await pageN.fill('#libSearch', 'zzzzznomatch');
    await pageN.waitForTimeout(250);
    await pageN.click('#libEmpty .lib-clear');
    await pageN.waitForTimeout(250);
    var neg = await pageN.evaluate(function () {
      return {
        search: document.getElementById('libSearch').value,
        emptyHidden: document.getElementById('libEmpty').hidden,
        visible: Array.prototype.slice.call(document.querySelectorAll('[data-ex-id]')).filter(function (c) { return !c.hidden; }).length,
      };
    });
    // With the binding removed, the button is dead: search stays, empty state stays up.
    ok('CLEAR/neg: with binding removed, search is NOT cleared (bug reproduced)', neg.search === 'zzzzznomatch', JSON.stringify(neg.search));
    ok('CLEAR/neg: with binding removed, #libEmpty stays visible', neg.emptyHidden === false);
    ok('CLEAR/neg: with binding removed, 0 cards visible (still filtered)', neg.visible === 0, String(neg.visible));
    await ctxN.close();
  }

  await browser.close();
  await new Promise(function (r) { server.close(r); });
})().then(function () {
  if (require.main === module) {
    failures.forEach(function (f) { console.log('  FAIL: ' + f); });
    console.log('F6 CLEAR-FILTERS  PASSED: ' + pass + '   FAILED: ' + fail + (skipped ? '   (SKIPPED)' : ''));
    process.exit(fail === 0 ? 0 : 1);
  }
}).catch(function (e) {
  console.log('F6 CLEAR-FILTERS  ERROR: ' + e.message);
  if (require.main === module) process.exit(1);
});

module.exports = { get pass() { return pass; }, get fail() { return fail; } };
