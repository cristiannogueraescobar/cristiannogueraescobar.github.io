/* composed-html.js — return the EFFECTIVE HTML of a source page for tests.
 *
 * After Checkpoint B1, source pages may contain PLUMLINE: shell markers instead
 * of the literal header/footer. Structural guards must validate the HTML the user
 * actually receives (the composed dist output), not the marker source. This helper
 * returns exactly what the build's compose step produces:
 *   - if the source has PLUMLINE: markers -> compose them (same code the build uses)
 *   - otherwise -> the source unchanged (pages not yet migrated)
 *
 * So a guard that did `readFileSync(page)` becomes `composedHtml(siteDir, page)`
 * and keeps asserting the same things, now against the real composed shell.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { composeHtml } = require('../src/shared/compose-shell.js');
const { composeSolverIfNeeded } = require('../src/shared/compose-solver.js');

// Effective (composed) HTML of a source page, in the SAME order the build uses:
// shell (B1) first, then solver UI (D). Each step is a no-op when its markers are
// absent, so unmigrated pages and non-solver pages pass through unchanged.
function composedHtml(siteDir, page) {
  let html = fs.readFileSync(path.join(siteDir, page), 'utf8');
  if (/<!--\s*PLUMLINE:/.test(html)) html = composeHtml(html, page);
  html = composeSolverIfNeeded(html, page, siteDir);
  return html;
}

module.exports = { composedHtml };
