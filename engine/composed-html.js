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

function composedHtml(siteDir, page) {
  const html = fs.readFileSync(path.join(siteDir, page), 'utf8');
  if (/<!--\s*PLUMLINE:/.test(html)) return composeHtml(html, page);
  return html;
}

module.exports = { composedHtml };
