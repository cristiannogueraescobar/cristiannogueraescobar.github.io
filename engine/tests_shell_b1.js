/* tests_shell_b1.js — Checkpoint B1: shared shell composition.
 *
 * Validates the COMPOSED HTML of all 8 pages (what the build produces and the user
 * receives), plus the two legitimate shell variants (informational vs solver) and
 * their per-page differences. Uses jsdom on the composed output, no network.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { composedHtml } = require('./composed-html.js');
const compose = require('../src/shared/compose-shell.js');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index.html', 'solver.html', 'guide.html', 'about.html',
               'privacy.html', 'terms.html', 'examples.html', 'capabilities.html'];
// Expected active nav link per page (aria-current). null = no active link.
const ACTIVE = {
  'index.html': null, 'solver.html': 'solver.html', 'guide.html': 'guide.html',
  'examples.html': 'examples.html', 'capabilities.html': null, 'about.html': 'about.html',
  'privacy.html': null, 'terms.html': null,
};
const PRIMARY_HREFS = ['solver.html', '/#addon', 'guide.html', 'examples.html', 'about.html'];

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

for (const p of PAGES) {
  const html = composedHtml(siteDir, p);
  const doc = new JSDOM(html).window.document;

  // 6. Exactly one header, one primary nav, one main, one footer.
  ok(p + ': exactly one header', doc.querySelectorAll('header.mast, header.top').length === 1);
  ok(p + ': exactly one primary nav', doc.querySelectorAll('nav.nav[aria-label="Primary"]').length === 1);
  ok(p + ': exactly one main', doc.querySelectorAll('main').length === 1);
  ok(p + ': exactly one footer', doc.querySelectorAll('footer.foot').length === 1);

  // Zero unresolved PLUMLINE markers in the composed output.
  ok(p + ': no unresolved PLUMLINE marker', !/<!--\s*PLUMLINE:/.test(html));

  // Zero duplicate ids.
  const ids = [...doc.querySelectorAll('[id]')].map(e => e.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  ok(p + ': zero duplicate ids', dupes.length === 0, 'dupes: ' + [...new Set(dupes)].join(', '));

  // Primary nav links present, in order, with hide-sm + data-i18n preserved.
  const nav = doc.querySelector('nav.nav[aria-label="Primary"]');
  const links = nav ? [...nav.querySelectorAll('a')] : [];
  ok(p + ': primary nav has the 5 core links in order',
     links.map(a => a.getAttribute('href')).join('|') === PRIMARY_HREFS.join('|'));
  ok(p + ': every core nav link keeps hide-sm', links.every(a => a.classList.contains('hide-sm')));
  ok(p + ': every core nav link keeps data-i18n', links.every(a => a.hasAttribute('data-i18n')));
  ok(p + ': primary nav has data-i18n-aria', nav && nav.getAttribute('data-i18n-aria') === 'ariaPrimary');

  // Active page: exactly zero or one aria-current, on the right link.
  const current = doc.querySelectorAll('nav.nav [aria-current="page"]');
  ok(p + ': at most one aria-current', current.length <= 1);
  const expected = ACTIVE[p];
  if (expected === null) {
    ok(p + ': no active nav link', current.length === 0);
  } else {
    ok(p + ': active nav link is ' + expected,
       current.length === 1 && current[0].getAttribute('href') === expected);
  }

  // ARIA + shell controls preserved.
  const toggle = doc.querySelector('.menu-toggle');
  ok(p + ': menu-toggle present with aria-controls', toggle && toggle.getAttribute('aria-controls') === 'mobile-menu');
  ok(p + ': menu-toggle aria-expanded=false', toggle && toggle.getAttribute('aria-expanded') === 'false');
  const sel = doc.querySelector('select#lang');
  ok(p + ': language select present with 5 options', sel && sel.querySelectorAll('option').length === 5);
  ok(p + ': language select aria-label preserved', sel && sel.getAttribute('data-i18n-aria') === 'ariaLanguage');
  ok(p + ': build badge span present', !!doc.querySelector('#buildBadge'));

  // Progressive enhancement: nav, footer, and links exist in static HTML (no JS).
  ok(p + ': nav links visible without JS', links.length === 5);
  ok(p + ': footer exists without JS', !!doc.querySelector('footer.foot'));

  // No fragment is fetched at runtime.
  ok(p + ': no runtime fragment fetch', !/fetch\((['"]).*?(header|footer)\.html/i.test(html));
}

// --- Two shell variants: informational vs solver -------------------------------
// Informational variant (about): header.mast, logo 24x38, no on-page nav,
// select.lang.
{
  const doc = new JSDOM(composedHtml(siteDir, 'about.html')).window.document;
  const header = doc.querySelector('header.mast');
  ok('informational: header.mast', !!header);
  ok('informational: header is NOT header.top', !doc.querySelector('header.top'));
  const svg = header && header.querySelector('a.lockup svg');
  ok('informational: logo 24x38', svg && svg.getAttribute('width') === '24' && svg.getAttribute('height') === '38');
  ok('informational: no on-page nav', !doc.querySelector('nav.nav-onpage'));
  ok('informational: select has class lang', doc.querySelector('select#lang.lang'));
}
// Solver variant: header.top, logo 20x30, on-page "How to use", select WITHOUT
// class lang.
{
  const doc = new JSDOM(composedHtml(siteDir, 'solver.html')).window.document;
  const header = doc.querySelector('header.top');
  ok('solver: header.top', !!header);
  ok('solver: header is NOT header.mast', !doc.querySelector('header.mast'));
  const svg = header && header.querySelector('a.lockup svg');
  ok('solver: logo 20x30', svg && svg.getAttribute('width') === '20' && svg.getAttribute('height') === '30');
  const onpage = doc.querySelector('nav.nav-onpage');
  ok('solver: on-page nav "How to use" present', onpage && /How to use/.test(onpage.textContent));
  const opLink = onpage && onpage.querySelector('a');
  ok('solver: on-page link is #how with navHow', opLink && opLink.getAttribute('href') === '#how' && opLink.getAttribute('data-i18n') === 'navHow');
  ok('solver: select does NOT have class lang', doc.querySelector('select#lang') && !doc.querySelector('select#lang').classList.contains('lang'));
}

// --- Variant-crossing guards (must fail if the composer is misused) -------------
// Solver page type must NOT produce the informational (mast) header.
ok('compose: solver pageType yields header.top not mast',
   compose.renderHeader('solver', 'solver').includes('<header class="top">') &&
   !compose.renderHeader('solver', 'solver').includes('<header class="mast">'));
// Informational page type must NOT produce solver-only elements.
ok('compose: informational pageType has no on-page nav',
   !compose.renderHeader('informational', 'about').includes('nav-onpage'));
ok('compose: informational logo is 24x38',
   compose.renderHeader('informational', 'about').includes('width="24" height="38"'));
ok('compose: solver logo is 20x30',
   compose.renderHeader('solver', 'solver').includes('width="20" height="30"'));

// --- learnCapabilities is authorized on capabilities.html ONLY ------------------
// The extra "Capabilities" footer link (data-i18n="navCapabilities") predates B1
// and appears on capabilities.html alone. Assert exactly that: the composed footer
// of capabilities has it, and NO other page does.
for (const p of PAGES) {
  const html = composedHtml(siteDir, p);
  const footer = new JSDOM(html).window.document.querySelector('footer.foot');
  const hasCapLink = footer && /data-i18n="navCapabilities"/.test(footer.innerHTML);
  if (p === 'capabilities.html') {
    ok('capabilities.html footer has the Capabilities link (learnCapabilities)', !!hasCapLink);
  } else {
    ok(p + ' footer does NOT have the Capabilities link', !hasCapLink);
  }
}

console.log('SHELL B1 TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass, fail };
