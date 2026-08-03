/* Shared test helper (Checkpoint F1).
 *
 * compose-solver.js projects the historical solver.html EXAMPLES object from the
 * canonical catalogue, so any test that composes the solver inside an isolated
 * temp tree must also place the catalogue module tree there. This helper copies
 * the MINIMAL set that compose-solver.js actually loads:
 *
 *   src/shared/examples/catalogue.js   (data authority)
 *   src/shared/examples/serialize.js   (deterministic serializer)
 *
 * schema.js / projectors.js are NOT copied here: compose-solver.js does not load
 * them (the checker does, and it copies what it needs). This keeps the temp tree a
 * faithful, minimal image of the real composition dependency set.
 *
 * The copy preserves relative structure, byte content (LF, UTF-8), and works from
 * paths containing spaces. It never reads dist. Callers own cleanup (finally).
 */

'use strict';
const fs = require('fs');
const path = require('path');

// Modules the composition path requires: loadAndValidateCatalogue (index.js) pulls
// in catalogue.js (data), schema.js (validation) and serialize.js (projection).
// Closed list — adding to it is a deliberate, reviewed change.
const CATALOGUE_MODULES = ['catalogue.js', 'schema.js', 'serialize.js', 'index.js'];
const CAT_REL = path.join('src', 'shared', 'examples');

// Copy the catalogue module set from `siteDir` into `destRoot`, preserving the
// relative path src/shared/examples/. Byte-for-byte (Buffer copy, no re-encoding).
function copyCatalogueTree(siteDir, destRoot) {
  const srcDir = path.join(siteDir, CAT_REL);
  const outDir = path.join(destRoot, CAT_REL);
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of CATALOGUE_MODULES) {
    const from = path.join(srcDir, name);
    const to = path.join(outDir, name);
    // Buffer copy preserves LF/UTF-8 exactly; no transformation.
    fs.writeFileSync(to, fs.readFileSync(from));
  }
  return outDir;
}

module.exports = { copyCatalogueTree: copyCatalogueTree, CATALOGUE_MODULES: CATALOGUE_MODULES, CAT_REL: CAT_REL };
