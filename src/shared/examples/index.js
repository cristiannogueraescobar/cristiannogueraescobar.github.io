/* Canonical entry point for the example catalogue (Checkpoint F1).
 *
 * Every projection MUST obtain the catalogue through loadAndValidateCatalogue(),
 * never by requiring catalogue.js directly. This guarantees the data is schema-valid
 * before any serializer runs, from whichever siteDir is passed (temp trees and
 * spaced paths included), and that a temp tree never silently falls back to the main
 * repository's catalogue.
 */

'use strict';
const path = require('path');

const CAT_REL = ['src', 'shared', 'examples'];

function modulePath(siteDir, name) {
  return path.resolve.apply(null, [siteDir].concat(CAT_REL, [name]));
}

/* Load the catalogue from `siteDir`, validate it against the strict schema, and
 * return { catalogue, serialize } on success. Throws before returning anything if
 * the catalogue is missing or invalid — projections never see unvalidated data.
 *
 * Only the catalogue/schema/serialize module entries for THIS siteDir are cleared
 * from require.cache, so a per-test temp tree always loads its own copy and a
 * mutation there is observed; the global cache is never wiped.
 */
function loadAndValidateCatalogue(siteDir, opts) {
  opts = opts || {};
  const expectCount = opts.expectCount === undefined ? 9 : opts.expectCount;

  const catPath = modulePath(siteDir, 'catalogue.js');
  const schemaPath = modulePath(siteDir, 'schema.js');
  const serPath = modulePath(siteDir, 'serialize.js');

  // Closed, per-siteDir cache clear (never a blanket wipe).
  delete require.cache[catPath];
  delete require.cache[schemaPath];
  delete require.cache[serPath];

  const catMod = require(catPath);      // throws MODULE_NOT_FOUND if the tree lacks it
  const schema = require(schemaPath);
  const serialize = require(serPath);

  const catalogue = catMod.CATALOGUE;
  const result = schema.validateCatalogue(catalogue, { expectCount: expectCount });
  if (!result.ok) {
    throw new Error('catalogue failed validation: ' + result.errors.join('; '));
  }
  return { catalogue: catalogue, serialize: serialize, schema: schema };
}

module.exports = { loadAndValidateCatalogue: loadAndValidateCatalogue };
