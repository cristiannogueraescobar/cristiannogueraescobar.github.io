/* tests_f7a_examples_browser.js — F7a BROWSER / PLAYWRIGHT (permanent, HARDENED).
 *
 * End-to-end in a real Chromium against the built dist:
 *   - examples.html renders exactly 24 cards in all 5 locales;
 *   - no horizontal overflow at 320px and 390px;
 *   - EXACT grid identity: each of the 15 F7a slugs loads via solver.html?ex=<slug> and the rendered
 *     #grid contains the record's canonical grid cell-for-cell (every non-empty canonical cell equals
 *     the rendered cell at the aligned offset) — not merely "different from the fallback";
 *   - one solve per model type (continuous, integer, binary, mixed) plus lp-basics, each reaching the
 *     expected status (optimal);
 *   - lp-basics renders a feasible-region chart (an SVG becomes visible after solving).
 *
 * Static files served with Node http (no shell). SKIPS cleanly when Playwright or dist is absent.
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');

var SITE = path.join(__dirname, '..');
var DIST = path.join(SITE, 'dist');
var GRIDS = require(path.join(SITE, 'engine', 'fixtures', 'f7a-tranche', 'f7a-grids.json'));
var pass = 0, fail = 0, skipped = false; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

var chromium = null;
try { chromium = require('playwright').chromium; } catch (e) { chromium = null; }

var LOCALES = ['en', 'es', 'pt', 'de', 'fr'];
var F7A_SLUGS = Object.keys(GRIDS.gridBySlug);
// one representative per model type + lp-basics. Each carries its expected VISIBLE status
// and canonical objective — the browser asserts against the rendered solve-details Status
// row and the rendered objective value, not merely a non-empty result.
var SOLVE_CASES = [
  { slug: 'bakery-production-mix', type: 'continuous', status: 'optimal', objective: 375 },
  { slug: 'factory-batch-plan', type: 'integer', status: 'optimal', objective: 2370 },
  { slug: 'fleet-assignment-plan', type: 'binary', status: 'optimal', objective: 355 },
  { slug: 'ingredient-sourcing-plan', type: 'mixed', status: 'optimal', objective: 5135 },
  { slug: 'linear-optimisation-basics', type: 'continuous(lp)', status: 'optimal', objective: 430 },
];

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

// Verify every non-empty canonical cell appears at the aligned offset in the rendered grid.
function gridMatches(rendered, canonical) {
  // find the row offset where canonical[0] (first 3 cells) appears in rendered.
  var c0 = JSON.stringify(canonical[0].slice(0, 3));
  var rowOff = -1;
  for (var i = 0; i < rendered.length; i++) { if (JSON.stringify(rendered[i].slice(0, 3)) === c0) { rowOff = i; break; } }
  if (rowOff === -1) return { ok: false, reason: 'header row not found' };
  var checked = 0;
  for (var r = 0; r < canonical.length; r++) {
    for (var c = 0; c < canonical[r].length; c++) {
      var val = canonical[r][c];
      if (val === '') continue;
      var rr = rendered[rowOff + r];
      if (!rr || rr[c] !== val) return { ok: false, reason: 'mismatch [' + r + '][' + c + '] canonical=' + JSON.stringify(val) + ' rendered=' + JSON.stringify(rr ? rr[c] : 'no-row') };
      checked++;
    }
  }
  return { ok: checked > 0, reason: checked + ' cells' };
}

(async function () {
  if (!chromium || !fs.existsSync(path.join(DIST, 'examples.html')) || !fs.existsSync(path.join(DIST, 'solver.html'))) {
    skipped = true;
    console.log('F7A EXAMPLES BROWSER  SKIPPED (no ' + (chromium ? 'dist build' : 'playwright') + '); run after `vite build`.');
    return;
  }
  var server = serve(DIST);
  await new Promise(function (r) { server.listen(0, r); });
  var port = server.address().port;
  var base = 'http://localhost:' + port;
  var browser = await chromium.launch();
  try {
    // ---- examples.html: 24 cards in every locale ----
    for (var i = 0; i < LOCALES.length; i++) {
      var loc = LOCALES[i];
      var ctx = await browser.newContext();
      var page = await ctx.newPage();
      await page.goto(base + '/examples.html?lang=' + loc, { waitUntil: 'load' });
      var cardCount = await page.evaluate(function () { return document.querySelectorAll('.lib-card').length; });
      ok('BROWSER: examples.html shows 24 cards (' + loc + ')', cardCount === 24, String(cardCount));
      await ctx.close();
    }

    // ---- mobile viewports: no horizontal overflow ----
    var widths = [320, 390];
    for (var w = 0; w < widths.length; w++) {
      var ctxM = await browser.newContext({ viewport: { width: widths[w], height: 800 } });
      var pageM = await ctxM.newPage();
      await pageM.goto(base + '/examples.html', { waitUntil: 'load' });
      var overflow = await pageM.evaluate(function () { return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
      ok('BROWSER: examples.html no horizontal overflow @' + widths[w] + 'px', overflow <= 1, 'overflow=' + overflow);
      await ctxM.close();
    }

    // ---- EXACT grid identity for all 15 F7a slugs ----
    for (var s = 0; s < F7A_SLUGS.length; s++) {
      var slug = F7A_SLUGS[s];
      var ctxS = await browser.newContext();
      var pageS = await ctxS.newPage();
      var consoleErr = [];
      pageS.on('console', function (msg) { if (msg.type() === 'error') consoleErr.push(msg.text()); });
      await pageS.goto(base + '/solver.html?ex=' + slug, { waitUntil: 'load' });
      var rendered = await pageS.evaluate(function () {
        var rows = Array.prototype.slice.call(document.querySelectorAll('#grid tr'));
        return rows.map(function (tr) { return Array.prototype.slice.call(tr.querySelectorAll('input')).map(function (inp) { return inp.value; }); });
      });
      var res = gridMatches(rendered, GRIDS.gridBySlug[slug]);
      ok('BROWSER: exact canonical grid identity for ' + slug, res.ok, res.reason);
      ok('BROWSER: ' + slug + ' no console errors', consoleErr.length === 0, consoleErr.join(' | '));
      await ctxS.close();
    }

    // ---- one solve per model type (+ lp-basics), each reaching expected status ----
    for (var k = 0; k < SOLVE_CASES.length; k++) {
      var cse = SOLVE_CASES[k];
      var ctxV = await browser.newContext();
      var pageV = await ctxV.newPage();
      await pageV.goto(base + '/solver.html?ex=' + cse.slug, { waitUntil: 'load' });
      await pageV.click('#solve');
      // Wait until the solve has actually COMPLETED (a real status is shown, not "Solving…").
      await pageV.waitForFunction(function () {
        var r = document.querySelector('#result');
        if (!r) return false;
        var t = r.textContent || '';
        return /optimal|feasible|infeasible|unbounded|proven/i.test(t) && !/Solving/i.test(t);
      }, { timeout: 15000 }).catch(function () {});
      var solved = await pageV.evaluate(function () {
        var r = document.querySelector('#result');
        // Read the actual visible solve-details Status row (sd-k "Status" -> its sd-v value).
        var statusValue = null;
        var keys = Array.prototype.slice.call(document.querySelectorAll('.sd-k'));
        for (var i = 0; i < keys.length; i++) {
          if (/^status$/i.test(keys[i].textContent.trim())) {
            var v = keys[i].nextElementSibling;
            var el = keys[i].parentElement;
            // only count it if the row is actually visible
            var visible = el ? el.getBoundingClientRect().height > 0 : true;
            if (v && visible) { statusValue = v.textContent.trim(); }
            break;
          }
        }
        var svgs = Array.prototype.slice.call(document.querySelectorAll('svg')).filter(function (sv) { return sv.getBoundingClientRect().width > 0; });
        // All integers appearing in the visible result region (used to confirm the objective).
        var nums = (r ? r.textContent : '').replace(/[,\u00a0]/g, '').match(/\d+(?:\.\d+)?/g) || [];
        return { text: r ? r.textContent.trim() : '', statusValue: statusValue, svgVisible: svgs.length, nums: nums.map(Number) };
      });
      // (1) The visible Status row must actually read Optimal — not merely be non-empty/non-error.
      ok('BROWSER: solve ' + cse.type + ' (' + cse.slug + ') visible Status row reads Optimal',
         !!solved.statusValue && /optimal/i.test(solved.statusValue), 'statusValue=' + JSON.stringify(solved.statusValue));
      // (2) The canonical objective value must appear in the visible result (numeric, tolerant).
      var objSeen = solved.nums.some(function (n) { return Math.abs(n - cse.objective) < 1e-6; });
      ok('BROWSER: solve ' + cse.type + ' (' + cse.slug + ') visible objective == ' + cse.objective,
         objSeen, 'nums=' + JSON.stringify(solved.nums.slice(0, 12)));
      // lp-basics: a feasible-region chart (SVG) must be visible after solving.
      if (cse.slug === 'linear-optimisation-basics') {
        ok('BROWSER: lp-basics renders a visible feasible-region chart', solved.svgVisible > 0, 'svgVisible=' + solved.svgVisible);
      }
      await ctxV.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().then(function () {
  if (!skipped) {
    console.log('F7A EXAMPLES BROWSER  PASSED: ' + pass + '   FAILED: ' + fail);
    if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
  }
}).catch(function (e) {
  console.log('F7A EXAMPLES BROWSER  ERROR:', e.message);
  process.exit(1);
});
