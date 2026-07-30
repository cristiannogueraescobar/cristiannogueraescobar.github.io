/* gen_claims.js — regenerate data/claims.json from product-capabilities.js.
 *
 * The claims manifest is a DERIVED artifact, never hand-edited: every marketing
 * claim maps to exactly one capability, so it cannot drift from the inventory.
 * A claim is `public: true` only when the capability is 'available' AND has a
 * real test (testFile + testMarker) AND a public name/description key — i.e. it
 * is backed by proof. Run this whenever product-capabilities.js changes; a test
 * asserts the committed file matches what this would generate.
 *
 * Run: node engine/gen_claims.js         (writes data/claims.json)
 *      node engine/gen_claims.js --check (exits non-zero if out of date)
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));

function buildClaims() {
  return {
    generatedFrom: 'assets/product-capabilities.js',
    note: 'DERIVED FILE — do not edit by hand. Run engine/gen_claims.js to regenerate.',
    claims: caps.CAPABILITIES.map(function (c) {
      return {
        id: c.id,
        group: c.group,
        status: c.status,
        nameKey: c.nameKey,
        descriptionKey: c.descriptionKey,
        proof: { testFile: c.testFile, testMarker: c.testMarker },
        example: c.exampleId,
        exampleNotApplicable: c.exampleNotApplicable || null,
        docs: { path: c.docsPath, anchor: c.docsAnchor },
        // `public` is taken verbatim from the inventory — a product decision,
        // not something this generator computes.
        public: c.public === true
      };
    })
  };
}

const json = JSON.stringify(buildClaims(), null, 2) + '\n';
const outPath = path.join(siteDir, 'data', 'claims.json');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current !== json) {
    console.error('data/claims.json is out of date — run: node engine/gen_claims.js');
    process.exit(1);
  }
  console.log('data/claims.json is up to date');
} else {
  fs.writeFileSync(outPath, json);
  console.log('wrote data/claims.json (' + buildClaims().claims.length + ' claims)');
}
