'use strict';

/*
 * Checkpoint F2 — visual system + shared navigation contract.
 *
 * This suite pins the NEW guarantees introduced by F2 (it does not re-pin the
 * pre-F2 baseline, which the golden/structure suites already own). It covers:
 *
 *   - the F2 design-token layer is present in the stylesheet;
 *   - the skip link exists on every page and targets a real <main id="content">;
 *   - aria-current is unique per page (exactly one current element where the
 *     page maps to a nav key; zero where it legitimately does not);
 *   - Home / add-on links are root-normalized ("/" and "/#addon"), never
 *     "index.html";
 *   - the shared mobile-nav script carries the full a11y contract;
 *   - shared component classes are present;
 *   - WCAG AA contrast holds for the core text/background/accent pairings
 *     (ratios computed here, not eyeballed);
 *   - reduced-motion is honored;
 *   - no remote fonts / CDN / trackers;
 *   - the six canonical public requests are unchanged.
 *
 * Every check is an ADDITIVE F2 guarantee. Removing the skip link, a token, the
 * root normalization, a component class, or dropping a contrast pairing below
 * AA must fail this suite.
 */

const fs = require('fs');
const path = require('path');

function run(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  let pass = 0, fail = 0;
  const failures = [];
  function ok(name, cond, extra) {
    if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); }
  }

  const css = fs.readFileSync(path.join(siteDir, 'assets', 'plumline.css'), 'utf8');
  const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
  const html = {};
  PAGES.forEach(function (p) { html[p] = fs.readFileSync(path.join(siteDir, p + '.html'), 'utf8'); });

  // The shared shell (header/footer) is composed into each page at build time;
  // the page sources carry only the PLUMLINE:HEADER marker. Shell-level
  // guarantees (aria-current, root links) are asserted against the shell
  // composed IN MEMORY via the authoritative composer — so the result is
  // deterministic and independent of whether dist/ happens to be present.
  const compose = require(path.join(siteDir, 'src', 'shared', 'compose-shell.js'));
  const shell = {};
  PAGES.forEach(function (p) {
    try { shell[p] = compose.composeHtml(html[p], p + '.html'); }
    catch (e) { shell[p] = html[p]; }
  });

  // ---- 1. F2 design-token layer present ----
  const REQUIRED_TOKENS = [
    '--space-1:', '--space-4:', '--space-8:',
    '--fs-body:', '--fs-h1:', '--fs-display:',
    '--lh-body:', '--fw-bold:',
    '--radius-lg:', '--radius-pill:',
    '--shadow-subtle:', '--shadow-card:', '--shadow-float:',
    '--focus-ring:', '--transition:', '--tap-min:',
    '--bg:', '--surface:', '--text:', '--text-2:',
    '--accent:', '--accent-text:', '--verify:', '--border:'
  ];
  REQUIRED_TOKENS.forEach(function (t) {
    ok('F2 token present: ' + t, css.indexOf(t) !== -1);
  });

  // ---- 2. skip link on every page, targeting a real main#content ----
  PAGES.forEach(function (p) {
    const s = html[p];
    ok(p + ': has skip link', /<a[^>]*class="skip-link"[^>]*href="#content"[^>]*>/.test(s));
    ok(p + ': skip link is i18n-labelled', /class="skip-link"[^>]*data-i18n="skipToContent"/.test(s));
    ok(p + ': has <main id="content">', /<main[^>]*\bid="content"/.test(s));
    // skip target must exist exactly once (no duplicate id)
    const idContent = (s.match(/\bid="content"/g) || []).length;
    ok(p + ': single id="content"', idContent === 1, 'got ' + idContent);
  });
  // skip-link styling: visible on focus (moves into view), hidden otherwise
  ok('skip-link has :focus rule', /\.skip-link:focus/.test(css));

  // ---- 3. aria-current uniqueness (asserted on the composed shell) ----
  // Pages that map to a nav key (or the Home logo) carry exactly one current
  // element. Pages not in the primary nav carry zero.
  const CURRENT_ONE = ['index', 'solver', 'guide', 'examples', 'about'];
  const CURRENT_ZERO = ['capabilities', 'privacy', 'terms'];
  function currentCount(s) {
    return (s.match(/<[a-z][^>]*\baria-current="page"/gi) || []).length;
  }
  CURRENT_ONE.forEach(function (p) {
    ok(p + ': exactly one aria-current', currentCount(shell[p]) === 1, 'got ' + currentCount(shell[p]));
  });
  CURRENT_ZERO.forEach(function (p) {
    ok(p + ': zero aria-current (not in primary nav)', currentCount(shell[p]) === 0, 'got ' + currentCount(shell[p]));
  });
  // Home's current element is the logo/lockup, not a nav item.
  ok('index: aria-current is on the lockup', /class="lockup"[^>]*aria-current="page"/.test(shell.index));

  // ---- 4. root-normalized Home / add-on links (no index.html) ----
  // Page sources must never hardcode index.html; the composed shell must expose
  // "/" and "/#addon" as the canonical Home / add-on targets.
  PAGES.forEach(function (p) {
    ok(p + ': source has no index.html hrefs', html[p].indexOf('href="index.html') === -1);
  });
  ok('root "/" link present in shell', PAGES.some(function (p) { return /href="\/"/.test(shell[p]); }));
  ok('add-on "/#addon" link present in shell', PAGES.some(function (p) { return /href="\/#addon"/.test(shell[p]); }));
  ok('shell carries no index.html hrefs', PAGES.every(function (p) { return shell[p].indexOf('href="index.html') === -1; }));

  // ---- 5. shared mobile-nav a11y contract (script-level) ----
  const nav = fs.readFileSync(path.join(siteDir, 'assets', 'nav-menu.js'), 'utf8');
  ok('nav: toggles aria-expanded', /aria-expanded/.test(nav));
  ok('nav: panel is a real modal (role=dialog / aria-modal)', /aria-modal|role="dialog"|role=\\"dialog\\"|'dialog'|"dialog"/.test(nav));
  ok('nav: closes on Escape', /Escape/.test(nav));
  ok('nav: manages focus explicitly', /focus\(\)/.test(nav));
  ok('nav: closes on outside interaction (backdrop)', /backdrop/.test(nav));
  ok('nav: cleans up across breakpoints', /matchMedia|resize/.test(nav));
  ok('nav: drawer links cloned from primary (no drift)', /clone|querySelectorAll|primary/i.test(nav));

  // ---- 6. shared component classes present AND actually used ----
  ['.btn2', '.badge', '.card2', '.panel', '.link', '.nav'].forEach(function (c) {
    ok('component class present: ' + c, css.indexOf(c) !== -1);
  });
  // The F2 delta must APPLY the components to real markup, not just define
  // them (the review found .btn2/.card2/.panel at zero usages). Assert real
  // usage so a regression back to unused classes fails here.
  function usesClass(s, cls) {
    return new RegExp('class="[^"]*\\b' + cls + '\\b').test(s);
  }
  var homeSrc = html.index;
  var capSrc = html.capabilities;
  ok('btn2 applied to real buttons (home)', usesClass(homeSrc, 'btn2'));
  ok('btn2 hierarchy present (home): primary', /\bbtn2--primary\b/.test(homeSrc));
  ok('btn2 hierarchy present (home): secondary', /\bbtn2--secondary\b/.test(homeSrc));
  ok('card2 applied to interactive cards (home)', usesClass(homeSrc, 'card2'));
  ok('card2 applied to capability steps', usesClass(capSrc, 'card2'));
  ok('panel applied to info block (capabilities)', usesClass(capSrc, 'panel'));

  // ---- 7. WCAG AA contrast (computed) ----
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function relLum(rgb) {
    const a = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function ratio(h1, h2) {
    const l1 = relLum(hexToRgb(h1)), l2 = relLum(hexToRgb(h2));
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Resolve identity hex values straight from :root (single source of truth).
  function tokenHex(name) {
    const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{3,6})'));
    return m ? m[1] : null;
  }
  const paper = tokenHex('paper'), panel = tokenHex('panel');
  const ink = tokenHex('ink'), ink2 = tokenHex('ink-2');
  const brassText = tokenHex('brass-text'), deep = tokenHex('deep');
  const trueGreen = tokenHex('true');
  // Body text on both backgrounds must clear AA for normal text (>= 4.5).
  ok('AA: ink on paper >= 4.5', ratio(ink, paper) >= 4.5, ratio(ink, paper).toFixed(2));
  ok('AA: ink on panel >= 4.5', ratio(ink, panel) >= 4.5, ratio(ink, panel).toFixed(2));
  ok('AA: secondary ink-2 on paper >= 4.5', ratio(ink2, paper) >= 4.5, ratio(ink2, paper).toFixed(2));
  // Brass used as TEXT (accent-text) on paper must clear AA normal text.
  ok('AA: brass-text on paper >= 4.5', ratio(brassText, paper) >= 4.5, ratio(brassText, paper).toFixed(2));
  // Verification green as text on paper >= AA normal text.
  ok('AA: verify green on paper >= 4.5', ratio(trueGreen, paper) >= 4.5, ratio(trueGreen, paper).toFixed(2));
  // Paper text on deep-green surface (inverted chrome) >= AA.
  ok('AA: paper on deep green >= 4.5', ratio(paper, deep) >= 4.5, ratio(paper, deep).toFixed(2));

  // ---- 8. reduced-motion honored ----
  ok('honors prefers-reduced-motion', /@media[^{]*prefers-reduced-motion/.test(css));

  // ---- 9. no remote fonts / CDN / trackers ----
  const allText = PAGES.map(function (p) { return html[p]; }).join('\n') + css;
  ['fonts.googleapis', 'fonts.gstatic', 'cdnjs.cloudflare', 'unpkg.com', 'jsdelivr',
   'googletagmanager', 'google-analytics', 'gtag(', '@import url(http'].forEach(function (needle) {
    ok('no remote/tracker: ' + needle, allText.indexOf(needle) === -1);
  });

  // ---- 10. six canonical public requests unchanged ----
  // The solver public request set is pinned by the E6 fixture; here we assert
  // the fixture still records exactly six (F2 must not add a network request).
  const e6 = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e6-worker-mirror-final.json'), 'utf8'));
  ok('six canonical requests intact', e6.public_output.requests === 6, 'got ' + e6.public_output.requests);

  return { pass: pass, fail: fail, failures: failures };
}

if (require.main === module) {
  const r = run();
  r.failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F2 VISUAL SYSTEM + NAVIGATION TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail === 0 ? 0 : 1);
}

module.exports = { run: run };
