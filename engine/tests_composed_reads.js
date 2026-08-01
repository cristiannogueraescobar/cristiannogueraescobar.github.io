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
  'tests_structure.js': 'inspects the inline engine block, result region, reduced-motion CSS, and locale fns in raw source (regions the composer never touches)',
  'tests_worker_parity.js': 'extracts the inline engine block from raw source for Worker parity',
  'tests_grid_input.js': 'reads the inline engine/grid source for input-classification logic',
  'tests_direction.js': 'reads inline solver source for direction/RTL logic',
  'tests_examples.js': 'reads inline solver + examples source logic',
  'tests_panel.js': 'reads inline solver panel source logic',
  'tests_region_plot.js': 'reads inline solver region-plot source logic',
  'tests_solve_announce.js': 'reads inline solver announce source logic',
  'tests_error_i18n.js': 'reads inline solver error-string source logic',
  'tests_status_coverage.js': 'reads inline solver + guide status-key source coverage',
  'tests_engine_integrity.js': 'reads solver.html raw to hash the inline engine block (ENGINE_START..ENGINE_END), a region the composer never touches',
  'tests_shell_composition_negative.js': 'case 15 deliberately reads solver.html raw to prove the raw-read guard: it runs tests_composed_reads.js against a seeded bad suite and asserts a non-zero exit naming it',
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

// Sanity: the guard actually saw the migrated set.
ok('guard observed migrated pages', migrated.length >= 1, 'migrated=' + migrated.join(','));

console.log('COMPOSED-READS GUARD  PASSED: ' + pass + '   FAILED: ' + fail + '   (migrated: ' + migrated.join(', ') + ')');
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass, fail };
