'use strict';
/* ============================================================================
   F6 NO-JS HEADER TEST (audit blocker 2/3).

   scrollWidth <= clientWidth is NOT sufficient: an element can be clipped or pushed off
   the viewport edge without producing document horizontal overflow. This test loads the
   Examples page with JavaScript FULLY DISABLED at 390 and 320 CSS px and asserts, for each
   required header control (logo, every primary nav link, the language control), a real
   layout rectangle:
     rect.width > 0, display != none, visibility != hidden
     rect.left  >= 0
     rect.right <= viewport width         (not clipped past the right edge)
     rect.top   >= 0
   plus: no document horizontal overflow, and the main library content is intact (9 cards).

   Requires a built dist served over HTTP and Playwright/Chromium. If neither is available
   the suite SKIPS (reported, not failed) so the offline text battery still runs; the
   packaged run always has both. Windows-safe: no shell, no execSync('node'); the server is
   Node's http module.
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
  if (p.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
function serve(root) {
  return http.createServer(function (req, res) {
    var u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
    var fp = path.join(root, u);
    fs.readFile(fp, function (e, data) {
      if (e) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': mime(fp) }); res.end(data);
    });
  });
}

// The header controls that MUST be usable with no JS. Selectors are stable shell classes.
var REQUIRED = [
  { name: 'logo/wordmark', sel: '.lockup' },
  { name: 'primary nav links', sel: '.mast .nav a', all: true },
  { name: 'language control', sel: '.mast .lang' },
];

(async function () {
  if (!chromium || !fs.existsSync(path.join(DIST, 'examples.html'))) {
    skipped = true;
    console.log('F6 NO-JS HEADER  SKIPPED (no ' + (chromium ? 'dist build' : 'playwright') + '); run after `vite build`.');
    return;
  }
  var server = serve(DIST);
  await new Promise(function (r) { server.listen(0, r); });
  var port = server.address().port;
  var base = 'http://localhost:' + port + '/examples.html';
  var browser = await chromium.launch();

  for (var _i = 0; _i < 2; _i++) {
    var vw = [390, 320][_i];
    var ctx = await browser.newContext({ viewport: { width: vw, height: 800 }, javaScriptEnabled: false });
    var page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(250);

    var report = await page.evaluate(function (req) {
      var vw = document.documentElement.clientWidth;
      var out = { vw: vw, docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, cards: document.querySelectorAll('.lib-card').length, items: [] };
      req.forEach(function (spec) {
        var els = spec.all ? Array.prototype.slice.call(document.querySelectorAll(spec.sel)) : [document.querySelector(spec.sel)];
        els.forEach(function (el, idx) {
          if (!el) { out.items.push({ name: spec.name + (spec.all ? '#' + idx : ''), missing: true }); return; }
          var r = el.getBoundingClientRect();
          var cs = getComputedStyle(el);
          // clipping check: nearest scroll/overflow ancestor must not cut the element's right edge.
          var clipped = false, anc = el.parentElement;
          while (anc) {
            var acs = getComputedStyle(anc);
            if (acs.overflowX === 'hidden' || acs.overflow === 'hidden') {
              var ar = anc.getBoundingClientRect();
              if (r.right > ar.right + 0.5 || r.left < ar.left - 0.5) clipped = true;
            }
            anc = anc.parentElement;
          }
          out.items.push({
            name: spec.name + (spec.all ? '#' + idx + ' "' + (el.textContent || '').trim().slice(0, 12) + '"' : ''),
            left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width),
            display: cs.display, visibility: cs.visibility, clipped: clipped
          });
        });
      });
      return out;
    }, REQUIRED);

    ok('NOJS@' + vw + ': no document horizontal overflow', report.docOverflow === false);
    ok('NOJS@' + vw + ': main library content intact (9 cards)', report.cards === 9, String(report.cards));
    ok('NOJS@' + vw + ': found at least logo + several links + lang', report.items.length >= 5, String(report.items.length));
    report.items.forEach(function (it) {
      if (it.missing) { ok('NOJS@' + vw + ': present: ' + it.name, false, 'element missing'); return; }
      ok('NOJS@' + vw + ': visible: ' + it.name, it.width > 0 && it.display !== 'none' && it.visibility !== 'hidden', it.display + '/' + it.visibility + '/w' + it.width);
      ok('NOJS@' + vw + ': within left edge: ' + it.name, it.left >= 0, 'left=' + it.left);
      ok('NOJS@' + vw + ': within right edge: ' + it.name, it.right <= report.vw, 'right=' + it.right + ' vw=' + report.vw);
      ok('NOJS@' + vw + ': within top edge: ' + it.name, it.top >= 0, 'top=' + it.top);
      ok('NOJS@' + vw + ': not clipped by an overflow ancestor: ' + it.name, it.clipped === false);
    });

    await ctx.close();
  }
  await browser.close();
  await new Promise(function (r) { server.close(r); });
})().then(function () {
  if (require.main === module) {
    failures.forEach(function (f) { console.log('  FAIL: ' + f); });
    console.log('F6 NO-JS HEADER  PASSED: ' + pass + '   FAILED: ' + fail + (skipped ? '   (SKIPPED)' : ''));
    process.exit(fail === 0 ? 0 : 1);
  }
}).catch(function (e) {
  console.log('F6 NO-JS HEADER  ERROR: ' + e.message);
  if (require.main === module) process.exit(1);
});

module.exports = { get pass() { return pass; }, get fail() { return fail; } };
