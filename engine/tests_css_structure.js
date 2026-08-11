/* tests_css_structure.js — B3 structural + isolation contracts for CSS.
 *
 * checkCssStructure(siteDir) is the single official checker; both this positive
 * suite and the negative suite call it against a site tree and read
 * { pass, fail, failures }. It protects:
 *   - each of the 8 pages loads exactly one external stylesheet (plumline.css?v=21),
 *     in the same position, and no page adds a second external CSS file;
 *   - only solver.html and examples.html carry an inline <style>; the six
 *     informational pages carry none;
 *   - shared shell selectors are present in plumline.css;
 *   - NO NEW grid/results/charts selectors leak into the shared sheet
 *     (#grid, .gridwrap, .receipt, .plot, .vs-row stay at 0 — the pre-existing
 *     .exports responsive override is frozen by the golden hash, not asserted here);
 *   - no informational page loads solver-only CSS;
 *   - no CSS is fetched, injected via innerHTML, or added as a runtime <style>/<link>;
 *   - no CSS partial is published (there are none — the shell CSS is a single
 *     real stylesheet, not composed from fragments).
 *
 * Static file reads; no jsdom, no server.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
const INFORMATIONAL = ['index', 'guide', 'capabilities', 'about', 'privacy', 'terms'];
// F6 (Examples library UI): examples.html no longer carries an inline <style>; its
// page-specific CSS lives in assets/examples-library.css (owned + protected by F6).
// solver.html keeps its inline <style>.
const PAGES_WITH_INLINE_STYLE = ['solver'];
// examples.html is allowed exactly one extra page-specific stylesheet besides the
// shared sheet: assets/examples-library.css. No other page may load a second CSS.
const PAGE_EXTRA_CSS = { examples: 'assets/examples-library.css' };
// Grid / results / charts / Variable-Settings selectors that must never appear in
// the SHARED stylesheet. (The pre-existing .exports responsive override is part of
// the approved cascade and is frozen by the CSS golden hash instead.)
const SOLVER_ONLY_IN_SHEET = ['#grid', '.gridwrap', '.receipt', '.plot', '.vs-row', '.drawFeasibleRegion'];
// Shell selectors that must remain present in the shared stylesheet.
const SHELL_SELECTORS = ['.mast', '.mobile-menu', '.menu-toggle', '.foot', '.fine', ':focus-visible'];

function checkCssStructure(siteDir) {
  let pass = 0, fail = 0;
  const failures = [];
  function check(name, cond) { if (cond) pass++; else { fail++; failures.push(name); } }

  function read(p) { return fs.readFileSync(path.join(siteDir, p + '.html'), 'utf8'); }
  const css = fs.readFileSync(path.join(siteDir, 'assets', 'plumline.css'), 'utf8');

  // Each page loads the shared stylesheet plumline.css?v=21. Every page loads exactly
  // one stylesheet EXCEPT examples.html, which additionally loads its F6 page-specific
  // sheet (assets/examples-library.css). No page loads any other CSS.
  PAGES.forEach(function (p) {
    const html = read(p);
    const links = html.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || [];
    const extra = PAGE_EXTRA_CSS[p];
    const expectedCount = extra ? 2 : 1;
    check(p + '.html loads the expected number of stylesheets', links.length === expectedCount);
    check(p + '.html loads the shared plumline.css?v=21',
      links.some(function (l) { return /assets\/plumline\.css\?v=21/.test(l); }));
    // Every referenced CSS is either the shared sheet or the page's approved extra.
    const cssHrefs = (html.match(/href="[^"]*\.css[^"]*"/g) || []);
    check(p + '.html references no CSS beyond plumline.css + its approved page CSS',
      cssHrefs.every(function (h) { return h.indexOf('plumline.css') !== -1 || (extra && h.indexOf(extra) !== -1); }));
    if (extra) {
      check(p + '.html loads its approved page-specific CSS (' + extra + ')',
        cssHrefs.some(function (h) { return h.indexOf(extra) !== -1; }));
    }
  });

  // The F6 page-specific CSS must not leak into any other page.
  PAGES.forEach(function (p) {
    if (PAGE_EXTRA_CSS[p]) return;
    check(p + '.html does not load examples-library.css', read(p).indexOf('examples-library.css') === -1);
  });

  // Inline <style>: only solver has one; every other page (incl. examples) has none.
  PAGES.forEach(function (p) {
    const n = (read(p).match(/<style\b/g) || []).length;
    if (PAGES_WITH_INLINE_STYLE.indexOf(p) !== -1) check(p + '.html has exactly one inline <style>', n === 1);
    else check(p + '.html has no inline <style>', n === 0);
  });

  // The link comes before the inline <style> on the page that has both
  // (so the inline variant wins the cascade, as approved).
  PAGES_WITH_INLINE_STYLE.forEach(function (p) {
    const html = read(p);
    const linkIdx = html.indexOf('plumline.css');
    const styleIdx = html.indexOf('<style');
    check(p + '.html loads plumline.css before its inline <style>', linkIdx !== -1 && styleIdx !== -1 && linkIdx < styleIdx);
  });

  // Shell selectors present in the shared sheet.
  SHELL_SELECTORS.forEach(function (sel) {
    check('shared sheet contains shell selector ' + sel, css.indexOf(sel) !== -1);
  });

  // NO grid/results/charts selectors in the shared sheet.
  SOLVER_ONLY_IN_SHEET.forEach(function (sel) {
    check('shared sheet has no solver grid/results/charts selector ' + sel, css.indexOf(sel) === -1);
  });

  // No informational page carries an inline <style> (so it cannot carry
  // solver-only CSS), and none loads a solver-only stylesheet.
  INFORMATIONAL.forEach(function (p) {
    const html = read(p);
    check(p + '.html carries no inline <style> (no solver-only CSS)', (html.match(/<style\b/g) || []).length === 0);
    check(p + '.html loads no solver-only stylesheet',
      !/href="[^"]*(grid|solver|result|chart)[^"]*\.css/.test(html));
  });

  // No runtime CSS injection anywhere: no fetch of a .css, no innerHTML building a
  // <style>/<link>, no document.write of styles, in the shared behavior modules.
  ['nav-menu.js', 'build-badge.js', 'i18n.js'].forEach(function (name) {
    const src = fs.readFileSync(path.join(siteDir, 'assets', name), 'utf8');
    check(name + ': does not fetch a .css file', !/fetch\([^)]*\.css/.test(src));
    check(name + ': does not inject a <style> or <link> via innerHTML',
      !/innerHTML\s*=\s*['"][^'"]*<(style|link)/i.test(src));
    check(name + ': does not create a style/link element for CSS',
      !/createElement\(\s*['"](style|link)['"]\s*\)/.test(src));
  });

  // No CSS partials exist to publish: the shared CSS is one real stylesheet, and
  // there is no src/shared/styles fragment directory feeding a compositor.
  check('no CSS partial directory (shell CSS is a single real stylesheet)',
    !fs.existsSync(path.join(siteDir, 'src', 'shared', 'styles')));

  return { pass: pass, fail: fail, failures: failures };
}

module.exports = { checkCssStructure: checkCssStructure, PAGES: PAGES };

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const r = checkCssStructure(siteDir);
  r.failures.forEach(function (f) { console.log('  FAIL:', f); });
  console.log('CSS STRUCTURE TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail ? 1 : 0);
}
