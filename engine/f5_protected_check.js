'use strict';
/* Reusable protected-set contract checker, shared by the positive and negative F5
   suites so there is ONE implementation. The EXPECTED PATHS are CODE-OWNED here
   (frozen), NOT read from the protected-baseline JSON, so co-editing sets + a
   duplicated path list inside that JSON cannot bypass the contract: the code owns
   the authority for WHICH files must exist. The JSON supplies only hashes/bytes/
   manifest entries. Node built-ins only. */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// CODE-OWNED canonical expected path authority. These are the final audited sets:
// public 12, infra 3, f4 27 (design-system + motion + the two F4 reference docs),
// engine_core 6 (canonical engine source, mirror, generator, adapter, worker client,
// solver composer). NOT derived from the manifest JSON.
var EXPECTED_PATHS = {
  public: [
    'about.html',
    'assets/examples-data.js',
    'assets/i18n.js',
    'assets/plumline.css',
    'assets/product-capabilities.js',
    'capabilities.html',
    'examples.html',
    'guide.html',
    'index.html',
    'privacy.html',
    'solver.html',
    'terms.html',
  ],
  infra: [
    'package-lock.json',
    'package.json',
    'vite.config.mjs',
  ],
  f4: [
    'docs/design-system-components.md',
    'docs/motion-system.md',
    'src/shared/design-system/01-primitives.css',
    'src/shared/design-system/02-semantic.css',
    'src/shared/design-system/03-base.css',
    'src/shared/design-system/04-layout.css',
    'src/shared/design-system/05-fonts.css',
    'src/shared/design-system/06-components.css',
    'src/shared/design-system/07-forms.css',
    'src/shared/design-system/08-instrument.css',
    'src/shared/design-system/09-utilities.css',
    'src/shared/design-system/fonts/FONT-AUDIT.json',
    'src/shared/design-system/fonts/Manrope-OFL.txt',
    'src/shared/design-system/fonts/Newsreader-OFL.txt',
    'src/shared/design-system/fonts/manrope-latin-ext-wght-normal.woff2',
    'src/shared/design-system/fonts/manrope-latin-wght-normal.woff2',
    'src/shared/design-system/fonts/newsreader-latin-ext-wght-normal.woff2',
    'src/shared/design-system/fonts/newsreader-latin-wght-normal.woff2',
    'src/shared/design-system/index.css',
    'src/shared/motion/index.css',
    'src/shared/motion/index.js',
    'src/shared/motion/lifecycle.js',
    'src/shared/motion/preference.js',
    'src/shared/motion/primitives.css',
    'src/shared/motion/reveal.js',
    'src/shared/motion/sequence.js',
    'src/shared/motion/tokens.css',
  ],
  engine_core: [
    'engine/engine.js',
    'engine/fragments/solver-ui/solve-worker-client.js',
    'engine/generate-engine-mirror.js',
    'engine/source/engine-platform-adapter.json',
    'engine/source/plumline-engine.js',
    'src/shared/compose-solver.js',
  ],
};
var EXPECTED_COUNTS = {
  public: EXPECTED_PATHS.public.length,
  infra: EXPECTED_PATHS.infra.length,
  f4: EXPECTED_PATHS.f4.length,
  engine_core: EXPECTED_PATHS.engine_core.length,
};

// Deep-freeze the code-owned contract so it cannot be mutated at runtime.
function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); } return o; }
deepFreeze(EXPECTED_PATHS); deepFreeze(EXPECTED_COUNTS);

function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

function checkProtectedSet(siteRoot, protectedBaseline) {
  var problems = [];
  Object.keys(EXPECTED_PATHS).forEach(function (setName) {
    var pinned = EXPECTED_PATHS[setName].slice().sort();               // CODE-OWNED
    var set = (protectedBaseline.sets && protectedBaseline.sets[setName]) || [];
    // count contract (code-owned)
    if (set.length !== EXPECTED_COUNTS[setName]) problems.push(setName + ': manifest has ' + set.length + ' entries, expected ' + EXPECTED_COUNTS[setName]);
    // exact-set contract: manifest paths must equal the CODE-OWNED pinned paths.
    var manifestPaths = set.map(function (e) { return e.path; }).sort();
    if (JSON.stringify(manifestPaths) !== JSON.stringify(pinned)) problems.push(setName + ': manifest paths != code-owned expected paths (missing/extra)');
    var seen = {}; manifestPaths.forEach(function (p) { if (seen[p]) problems.push(setName + ': duplicate entry ' + p); seen[p] = true; });
    // byte identity for every code-owned path.
    EXPECTED_PATHS[setName].forEach(function (rel) {
      var entry = set.filter(function (e) { return e.path === rel; })[0];
      if (!entry) { problems.push(setName + ': manifest is missing ' + rel); return; }
      var p = path.join(siteRoot, rel);
      if (!fs.existsSync(p)) { problems.push('protected file missing: ' + rel); return; }
      if (sha(p) !== entry.sha256) problems.push('protected hash changed: ' + rel);
    });
  });
  return { ok: problems.length === 0, problems: problems };
}

module.exports = { checkProtectedSet: checkProtectedSet, EXPECTED_COUNTS: EXPECTED_COUNTS, EXPECTED_PATHS: EXPECTED_PATHS };
