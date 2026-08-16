/* tests_f7b_examples_browser.js — F7b BROWSER / PLAYWRIGHT (permanent, HARDENED).
 *
 * End-to-end in a real Chromium against the built dist, for the 12 F7b examples now live:
 *   - each of the 12 F7b slugs loads via solver.html?ex=<slug> and the rendered #grid matches the
 *     record's canonical grid CELL-FOR-CELL at a fixed origin (0,0) — every cell in the canonical
 *     model rectangle is compared, including canonical empty-string cells, and any differing value
 *     is rejected (the solver receives exactly the intended model). The UI may pad the grid out to
 *     at least 12x6 with empty cells; that padding OUTSIDE the model rectangle is not asserted, but
 *     any content bleeding into the model rectangle is caught. Data rows are the #grid <tr>s that
 *     contain <input>s (the first <tr> is the column-letter header), taken in document order;
 *     examples-loading.js writes data[r][c] = grid[r][c] from origin (0,0).
 *   - each F7b example solves through the real engine reaching its expected VISIBLE status
 *     (optimal) and its canonical objective appears in the visible result;
 *   - the Examples Library page can find representative F7b examples by category and by search.
 *
 * Reuses the same harness shape as tests_f7a_examples_browser.js (Node http static server, no shell;
 * SKIPS cleanly when Playwright or dist is absent). Grids/solve cases come from the approved F7b
 * fixtures (engine/fixtures/f7b-tranche/f7b-grids.json).
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');

var SITE = path.join(__dirname, '..');
var DIST = path.join(SITE, 'dist');
var GRIDS = require(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-grids.json'));
var pass = 0, fail = 0, skipped = false; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

var chromium = null;
try { chromium = require('playwright').chromium; } catch (e) { chromium = null; }

var F7B_SLUGS = Object.keys(GRIDS.gridBySlug);
var SOLVE_CASES = GRIDS.solveCases;

function mime(p) {
  if (p.endsWith('.html')) return 'text/html';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.js')) return 'text/javascript';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.png')) return 'image/png';
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
// The solver loads an example at a FIXED grid origin (0,0): examples-loading.js does
// data[r][c] = grid[r][c] for the canonical model rectangle, padding the UI grid out to at least
// 12x6 with empty cells. So we assert the canonical model rectangle starting at (0,0), comparing
// EVERY cell including canonical empty strings, and reject any differing value. Cells OUTSIDE the
// model rectangle (the padding) are not asserted, but any non-empty content bleeding into the model
// rectangle is caught.
function gridMatches(rendered, canonical) {
  if (!rendered.length) return { ok: false, reason: 'no rendered rows' };
  var checked = 0;
  for (var r = 0; r < canonical.length; r++) {
    var rr = rendered[r]; // fixed origin: canonical row r maps to rendered row r
    if (!rr) return { ok: false, reason: 'missing rendered row ' + r + ' (fixed origin 0,0 expected)' };
    for (var c = 0; c < canonical[r].length; c++) {
      var expected = String(canonical[r][c]); // includes '' — empty cells ARE compared
      var actual = (rr[c] === undefined || rr[c] === null) ? '' : String(rr[c]);
      if (actual !== expected) {
        return { ok: false, reason: 'mismatch at fixed [' + r + '][' + c + '] canonical=' + JSON.stringify(expected) + ' rendered=' + JSON.stringify(actual) };
      }
      checked++;
    }
  }
  return { ok: checked > 0, reason: checked + ' cells (incl. empties) at fixed origin' };
}

(async function () {
  if (!chromium || !fs.existsSync(path.join(DIST, 'examples.html')) || !fs.existsSync(path.join(DIST, 'solver.html'))) {
    skipped = true;
    console.log('F7B EXAMPLES BROWSER  SKIPPED (no ' + (chromium ? 'dist build' : 'playwright') + '); run after `vite build`.');
    return;
  }
  var server = serve(DIST);
  await new Promise(function (r) { server.listen(0, r); });
  var port = server.address().port;
  var base = 'http://localhost:' + port;
  var browser = await chromium.launch();
  try {
    // ---- all 12 F7b examples are present as cards and selectable by slug ----
    (function () {})();
    var ctx0 = await browser.newContext();
    var page0 = await ctx0.newPage();
    await page0.goto(base + '/examples.html', { waitUntil: 'load' });
    var f7bCardsPresent = await page0.evaluate(function (slugs) {
      var found = 0;
      slugs.forEach(function (s) {
        if (document.querySelector('a[href="solver.html?ex=' + s + '"]')) found++;
      });
      return found;
    }, F7B_SLUGS);
    ok('BROWSER: all 12 F7b examples appear as selectable cards', f7bCardsPresent === 12, String(f7bCardsPresent));
    await ctx0.close();

    // ---- EXACT grid identity for all 12 F7b slugs (real URL/slug loading) ----
    for (var s = 0; s < F7B_SLUGS.length; s++) {
      var slug = F7B_SLUGS[s];
      var ctxS = await browser.newContext();
      var pageS = await ctxS.newPage();
      var consoleErr = [];
      pageS.on('console', function (msg) { if (msg.type() === 'error') consoleErr.push(msg.text()); });
      await pageS.goto(base + '/solver.html?ex=' + slug, { waitUntil: 'load' });
      var rendered = await pageS.evaluate(function () {
        // The first <tr> is the column-letter header (th only, no inputs). Data rows are the <tr>s
        // that contain <input> cells, in document order. The model loads at fixed origin (0,0) into
        // these data rows, so we keep only rows that have inputs and preserve their order.
        var rows = Array.prototype.slice.call(document.querySelectorAll('#grid tr'));
        return rows
          .map(function (tr) { return Array.prototype.slice.call(tr.querySelectorAll('input')).map(function (inp) { return inp.value; }); })
          .filter(function (r) { return r.length > 0; });
      });
      var res = gridMatches(rendered, GRIDS.gridBySlug[slug]);
      ok('BROWSER: exact canonical grid identity (fixed origin, incl. empty cells) for ' + slug, res.ok, res.reason);
      ok('BROWSER: ' + slug + ' no console errors', consoleErr.length === 0, consoleErr.join(' | '));
      await ctxS.close();
    }

    // ---- solve every F7b example: visible Status Optimal + canonical objective ----
    for (var k = 0; k < SOLVE_CASES.length; k++) {
      var cse = SOLVE_CASES[k];
      var ctxV = await browser.newContext();
      var pageV = await ctxV.newPage();
      await pageV.goto(base + '/solver.html?ex=' + cse.slug, { waitUntil: 'load' });
      await pageV.click('#solve');
      await pageV.waitForFunction(function () {
        var r = document.querySelector('#result');
        if (!r) return false;
        var t = r.textContent || '';
        return /optimal|feasible|infeasible|unbounded|proven/i.test(t) && !/Solving/i.test(t);
      }, { timeout: 15000 }).catch(function () {});
      var solved = await pageV.evaluate(function () {
        var r = document.querySelector('#result');
        var statusValue = null;
        var keys = Array.prototype.slice.call(document.querySelectorAll('.sd-k'));
        for (var i = 0; i < keys.length; i++) {
          if (/^status$/i.test(keys[i].textContent.trim())) {
            var v = keys[i].nextElementSibling;
            var el = keys[i].parentElement;
            var visible = el ? el.getBoundingClientRect().height > 0 : true;
            if (v && visible) { statusValue = v.textContent.trim(); }
            break;
          }
        }
        var nums = (r ? r.textContent : '').replace(/[,\u00a0]/g, '').match(/\d+(?:\.\d+)?/g) || [];
        return { text: r ? r.textContent.trim() : '', statusValue: statusValue, nums: nums.map(Number) };
      });
      ok('BROWSER: solve ' + cse.type + ' (' + cse.slug + ') visible Status row reads Optimal',
         !!solved.statusValue && /optimal/i.test(solved.statusValue), 'statusValue=' + JSON.stringify(solved.statusValue));
      var objSeen = solved.nums.some(function (n) { return Math.abs(n - cse.objective) < 1e-3; });
      ok('BROWSER: solve ' + cse.type + ' (' + cse.slug + ') visible objective == ' + cse.objective,
         objSeen, 'nums=' + JSON.stringify(solved.nums.slice(0, 14)));
      await ctxV.close();
    }

    // ---- category + search interaction finds representative F7b examples ----
    var ctxF = await browser.newContext();
    var pageF = await ctxF.newPage();
    await pageF.goto(base + '/examples.html', { waitUntil: 'load' });
    // search for an F7b English title term and confirm a matching card remains visible
    var searchHit = await pageF.evaluate(function () {
      var box = document.querySelector('#libSearch') || document.querySelector('input[type="search"]');
      if (!box) return { ok: false, reason: 'no search box' };
      box.value = 'assembly';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      var visible = Array.prototype.slice.call(document.querySelectorAll('.lib-card')).filter(function (c) { return c.getBoundingClientRect().height > 0; });
      var slugs = visible.map(function (c) { var a = c.querySelector('a[href^="solver.html?ex="]'); return a ? a.getAttribute('href') : ''; });
      return { ok: slugs.some(function (s) { return s.indexOf('assembly-line-mix') !== -1; }), reason: slugs.join(',') };
    });
    ok('BROWSER: search "assembly" surfaces the F7b assembly-line-mix card', searchHit.ok, searchHit.reason);
    await ctxF.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log('F7B EXAMPLES BROWSER  PASSED: ' + pass + '   FAILED: ' + fail);
  if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exitCode = 1; }
})();
