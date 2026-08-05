/* tests_composed_reads.js — regression guard for Checkpoint B.
 *
 * After B1, source pages may contain PLUMLINE: shell markers. A DOM/structure
 * suite that reads such a page's SOURCE directly (fs.readFileSync) instead of the
 * composed HTML would silently see markers instead of the header/footer and either
 * crash or drop assertions. This guard fails if an engine test file reads a
 * MIGRATED page's source directly, UNLESS it is on the explicit allowlist of
 * suites that legitimately inspect raw source (markers, the inline engine block,
 * composition itself, or untransformed regions the composer never touches).
 *
 * It does NOT forbid all direct reads — only direct reads of pages that currently
 * carry markers, from files not on the allowlist. When a new page is migrated, any
 * DOM suite still reading it raw will trip this guard.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const engineDir = __dirname;
const siteDir = path.join(engineDir, '..');
const PAGES = ['index.html', 'solver.html', 'guide.html', 'about.html',
               'privacy.html', 'terms.html', 'examples.html', 'capabilities.html'];

// Which pages currently carry PLUMLINE markers (i.e. are migrated).
const migrated = PAGES.filter(p => /<!--\s*PLUMLINE:/.test(fs.readFileSync(path.join(siteDir, p), 'utf8')));

// Allowlist: files permitted to read a migrated page's SOURCE directly, each with
// the reason. These inspect raw source on purpose and do NOT depend on the shell.
const RAW_SOURCE_ALLOWLIST = {
  'compose-shell.test-note': 'n/a — module, not a suite',
  'tests_structure.js': 'inspects the inline engine block, result region, and reduced-motion CSS in raw source (regions the composer never touches); the D1 grid/locale checks now use composedHtml',
  'tests_canonical_engine_source.js': 'reads solver.html raw ONLY to feed the OFFICIAL compositor (composeSolverInterface) and validate the COMPOSED engine + Worker parity against the E1 fixture; composer contract, not a bypass — the E1 negative suite copies to temp trees and is NOT allowlisted',
  'tests_canonical_engine_source_positive.js': 'reads solver.html raw ONLY to feed the OFFICIAL compositor and assert byte-exact E1 composition (deterministic, spaced-path); composer contract, not a bypass',
  'tests_solver_grid.js': 'reads solver.html raw ONLY to feed the OFFICIAL solver-UI composer (composeSolverInterface) and validate the COMPOSED result against the D1 golden; this is the composer contract itself, not a bypass — the D1 negative suite copies to temp trees and is NOT allowlisted',
  'tests_solver_detection.js': 'reads solver.html raw ONLY to feed the OFFICIAL solver-UI composer and validate the COMPOSED result against the D2 golden (detection + Variable Settings); composer contract, not a bypass — the D2 negative suite copies to temp trees and is NOT allowlisted',
  'tests_solver_execution.js': 'reads solver.html raw ONLY to feed the OFFICIAL solver-UI composer and validate the COMPOSED result against the D3 golden (execution + worker client + errors + results); composer contract, not a bypass — the D3 negative suite copies to temp trees and is NOT allowlisted',
  'tests_solver_visualization.js': 'reads solver.html raw ONLY to feed the OFFICIAL solver-UI composer and validate the COMPOSED result against the D4 golden (receipt + plot + exports + examples); composer contract, not a bypass — the D4 negative suite copies to temp trees and is NOT allowlisted',
  'tests_solver_interface_final.js': 'reads solver.html raw ONLY to feed the OFFICIAL solver-UI composer and validate the COMPOSED result against the D5 FINAL cumulative golden (global region order + bootstrap + inline-remaining); composer contract, not a bypass — the D5 negative suite copies to temp trees and is NOT allowlisted',
  'tests_examples.js': 'reads examples.html raw for the catalog; the solver-side checks now use composedHtml',
  'tests_css_golden.js': 'inspects the inline <style> of solver.html and examples.html in raw source (a region the composer never touches) to freeze the CSS golden; the shell fragments come from assets/plumline.css, not the page shell',
  'tests_css_structure.js': 'inspects each page raw for its stylesheet link and inline <style> count (CSS structure), regions independent of the composed shell',
  'tests_legal_pages.js': 'inspects the <head> and <main> of about/privacy/terms raw — regions the shell composer never touches (it only replaces the header/footer markers, which sit OUTSIDE <main>); verified head+main byte-identical source vs dist',
  'tests_guide_page.js': 'inspects guide.html <head> and <main> raw — regions the shell composer never touches (verified byte-identical source vs dist); the guide negative suite copies to temp trees and is NOT allowlisted',
  'tests_examples_page.js': 'inspects examples.html <head>/<main>/<style> raw and require()s assets/examples-data.js for the HTML<->data slug sync — regions the shell composer never touches (verified byte-identical source vs dist); the examples negative suite copies to temp trees and is NOT allowlisted',
  'tests_capabilities_page.js': 'inspects capabilities.html <head>/<main> raw + the capabilities.template.html raw + require()s product-capabilities.js/media.json for the HTML<->inventory/media sync (State D generated page); regions the shell composer never touches (verified byte-identical source vs dist); the negative suite copies to temp trees and the generator suite drives the real generator, neither is allowlisted',
  'tests_home_page.js': 'inspects index.html <head>/<main> raw + require()s product-capabilities.js and reads data/home-faq.json for the FAQ/capabilities/image sync (State D+C: generated regions + hand-authored sections); head/main are regions the shell composer never touches (verified byte-identical source vs dist); the negative suite copies to temp trees and the generator suite drives the real generators, neither is allowlisted',
  'tests_f3a_hero.js': 'inspects index.html <main>/hero raw to pin the F3a hero, positioning, product demo and proof strip; the hero and <main> body are regions the shell composer never touches (only header/footer are composed); reads source on purpose and does not depend on the shell',
  'tests_f3b_home_sections.js': 'inspects index.html <main> raw to pin the F3b core sections (how it works, use cases, verification flow, featured examples) and their catalogue-projected HOME_FEATURED region; the <main> body is a region the shell composer never touches (only header/footer are composed), and the featured region is filled by gen_home_featured.js, not the shell; reads source on purpose and does not depend on the shell',
  'tests_shell_composition_negative.js': 'case 15 deliberately reads solver.html raw to prove the raw-read guard: it runs tests_composed_reads.js against a seeded bad suite and asserts a non-zero exit naming it',
  'tests_examples_page_projection.js': 'reads examples.html raw ONLY to assert the ItemList JSON-LD + no-JS links are a byte-faithful projection of the canonical catalogue (a region the shell composer never touches; verified byte-identical source vs dist); the negatives copy to temp trees and are NOT allowlisted',
  'tests_home_capabilities_refs.js': 'reads index.html raw ONLY to assert Home example slug references resolve to catalogue slugs and Home does not re-store canonical example titles/descriptions (regions the shell composer never touches); the negatives copy to temp trees and are NOT allowlisted',
  'composed-html.js': 'the composer helper itself',
};

// Suites that MUST use composedHtml for migrated pages (DOM/shell/nav/i18n-visible).
// This guard only checks that they do not read a migrated page RAW.

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const files = fs.readdirSync(engineDir).filter(f => f.startsWith('tests_') && f.endsWith('.js') && f !== 'tests_composed_reads.js');
// Build a regex that matches a direct source read of any migrated page.
const migratedAlt = migrated.map(p => p.replace('.', '\\.')).join('|');
const rawReadRe = migratedAlt
  ? new RegExp("readFileSync\\([^)]*?['\"](?:" + migratedAlt + ")['\"]", 'g')
  : null;
// Also catch the generic `readFileSync(path.join(siteDir, page))` form: only unsafe
// if the file does NOT import composed-html (a suite using the generic loop should
// route through composedHtml). We treat generic loops as safe only if the file
// requires composed-html.js.

for (const f of files) {
  const src = fs.readFileSync(path.join(engineDir, f), 'utf8');
  const usesComposed = /require\(['"]\.\/composed-html\.js['"]\)/.test(src);
  const allowed = Object.prototype.hasOwnProperty.call(RAW_SOURCE_ALLOWLIST, f);

  if (rawReadRe) {
    // Find raw reads of migrated pages that are NOT annotated as composed.
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      rawReadRe.lastIndex = 0;
      if (rawReadRe.test(line) && !/composedHtml/.test(line)) {
        // A raw read of a migrated page on this line.
        ok(f + ':' + (i + 1) + ' does not read a migrated page raw',
           allowed,
           'reads migrated source directly: ' + line.trim().slice(0, 90) +
           (allowed ? '' : ' — route through composedHtml or add to allowlist with a reason'));
      }
    }
  }

  // A generic per-page loop that reads source but never imports composedHtml is a
  // smell once any page is migrated (it would read markers for migrated pages).
  const genericRaw = /readFileSync\(path\.join\(siteDir,\s*(?:p|page|file)\)/.test(src);
  if (genericRaw && !usesComposed && !allowed && migrated.length) {
    ok(f + ' generic per-page read routes through composedHtml', false,
       'reads siteDir/<page> directly without composed-html import');
  }
}

// Explicit contract: tests_css_negative.js does NOT need a raw-source allowlist
// entry. It builds temp trees with copyFileSync and mutates those, so it performs
// no direct raw read of a migrated page. Confirm it is absent from the allowlist
// AND that scanning it produced no failure above (it copies, never readFileSync's
// a migrated page by name). Skipped when the file is not present in the scanned
// engine dir (e.g. a minimal temp tree used by the composition-negative guard run).
if (fs.existsSync(path.join(engineDir, 'tests_css_negative.js'))) {
  const cssNegSrc = fs.readFileSync(path.join(engineDir, 'tests_css_negative.js'), 'utf8');
  const inAllowlist = Object.prototype.hasOwnProperty.call(RAW_SOURCE_ALLOWLIST, 'tests_css_negative.js');
  ok('tests_css_negative.js is NOT in the raw-source allowlist', !inAllowlist);
  // It must not readFileSync a migrated page by name (it uses copyFileSync into a temp tree).
  const rawReadOfMigrated = rawReadRe
    ? cssNegSrc.split('\n').some(function (line) { rawReadRe.lastIndex = 0; return rawReadRe.test(line) && !/composedHtml/.test(line); })
    : false;
  ok('tests_css_negative.js performs no raw read of a migrated page (needs no permission)', !rawReadOfMigrated);
}

// Sanity: the guard actually saw the migrated set.
ok('guard observed migrated pages', migrated.length >= 1, 'migrated=' + migrated.join(','));

console.log('COMPOSED-READS GUARD  PASSED: ' + pass + '   FAILED: ' + fail + '   (migrated: ' + migrated.join(', ') + ')');
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass, fail };
