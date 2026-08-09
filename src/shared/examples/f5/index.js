'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — canonical loader.
   ----------------------------------------------------------------------------
   loadCanonical(siteDir, opts) loads the F1 catalogue (already schema-validated
   by the F1 index), the F5 authored metadata and the category registry from
   `siteDir`, validates the F5 layer, assembles the canonical catalogue and
   returns it deep-frozen alongside the helpers. It throws before returning if
   anything is invalid, so no consumer ever sees unvalidated canonical data.

   Per-siteDir require-cache clearing mirrors the F1 index so per-test temp trees
   (and paths with spaces) load their own copy and a mutation there is observed.
   ========================================================================== */

var path = require('path');

var F5_REL = ['src', 'shared', 'examples', 'f5'];
function f5Path(siteDir, name) { return path.resolve.apply(null, [siteDir].concat(F5_REL, [name])); }
function catPath(siteDir) { return path.resolve(siteDir, 'src', 'shared', 'examples', 'catalogue.js'); }
function f1Index(siteDir) { return path.resolve(siteDir, 'src', 'shared', 'examples', 'index.js'); }

function loadCanonical(siteDir, opts) {
  opts = opts || {};

  // Clear only this siteDir's F5 modules + catalogue so temp trees are isolated.
  var names = ['enums.js', 'categories.js', 'derive.js', 'metadata.js', 'assemble.js', 'validate.js', 'project.js', 'authoring.js'];
  names.forEach(function (n) { delete require.cache[f5Path(siteDir, n)]; });
  delete require.cache[catPath(siteDir)];
  delete require.cache[f1Index(siteDir)];

  // F1 catalogue (schema-validated by the F1 loader).
  var f1 = require(f1Index(siteDir));
  var f1Loaded = f1.loadAndValidateCatalogue(siteDir, { expectCount: opts.expectCount });
  var catalogue = f1Loaded.catalogue;

  var metadata = require(f5Path(siteDir, 'metadata.js')).METADATA;
  var categories = require(f5Path(siteDir, 'categories.js')).CATEGORIES;
  var validate = require(f5Path(siteDir, 'validate.js'));
  var assemble = require(f5Path(siteDir, 'assemble.js'));
  var project = require(f5Path(siteDir, 'project.js'));
  var authoring = require(f5Path(siteDir, 'authoring.js'));

  var catRes = validate.validateCategories(categories);
  if (!catRes.ok) throw new Error('F5 categories invalid: ' + catRes.errors.join('; '));
  var metaRes = validate.validateMetadataCatalogue(catalogue, metadata, { expectCount: opts.expectCount });
  if (!metaRes.ok) throw new Error('F5 metadata invalid: ' + metaRes.errors.join('; '));

  var canonical = Object.freeze(assemble.assembleCatalogue(catalogue, metadata).map(function (c) { return authoring.deepFreeze(c); }));

  // Return a DEEP-FROZEN OWNED COPY of the registry so a consumer can never corrupt
  // the source module array (or another loadCanonical, or validation state).
  var ownedCategories = authoring.deepFreeze(categories.map(function (c) {
    return {
      id: c.id, slug: c.slug, order: c.order,
      label: Object.assign({}, c.label),
      short: Object.assign({}, c.short),
    };
  }));

  return {
    canonical: canonical,
    categories: ownedCategories,
    validate: validate,
    project: project,
    authoring: authoring,
    serialize: authoring.serializeCanonical,
  };
}

module.exports = { loadCanonical: loadCanonical };
