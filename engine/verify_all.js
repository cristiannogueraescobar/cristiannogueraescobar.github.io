/* verify_all.js — the full pre-publish gate (`npm run verify`).
 *
 * Runs, in order, and FAILS on the first error. This is the SAME command CI runs,
 * so local and CI builds are identical.
 *
 *   1-2. Full test battery (engine/run_all.js) in public-build mode. Includes the
 *        translation and i18n-coverage guards.
 *   3.   HTML validity of SOURCE pages (raw + jsdom structural + Lote E.1 alt).
 *   4.   JSON-LD validity (tests_jsonld.js).
 *   5.   Lockfile portability (engine/validate_lockfile.js): platform variants +
 *        package/lock agreement.
 *   6.   Build via `npm run build` (the declared script, not npx).
 *   7.   HTML validity of the BUILT pages in dist (must also pass).
 *   8.   Validate dist (engine/validate_dist.js): exact root allowlist, 8 pages
 *        byte-identical, root public files byte-identical, engine markers, asset
 *        URLs resolve, recursive asset parity, no internal files.
 *   9.   Internal links + assets over real HTTP (engine/test_dist_http.js): pages
 *        200, internals 404, zero broken links, Worker markers served.
 *   10.  build-info.json present in dist (CI stamps the real SHA later).
 *   11.  No premature hashes.txt (CI generates it after dist is final).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function step(label, cmd, env) {
  console.log('\n=== ' + label + ' ===');
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...(env || {}) } });
  } catch (e) {
    console.error('\nVERIFY FAILED at: ' + label);
    process.exit(1);
  }
}

// 1-2. Full battery (includes translation + i18n coverage guards) in public mode.
step('1-2. Test battery (public build)', 'node engine/run_all.js',
     { CI: 'true', PLUMLINE_PUBLIC_BUILD: '1' });

// 3. HTML validity of the SOURCE pages.
step('3. HTML validity (source)', 'node engine/validate_html.js .');

// 4. JSON-LD validity.
step('4. JSON-LD validity', 'node engine/tests_jsonld.js');

// 4b. Canonical example catalogue: schema + projection staleness (never regenerates;
//     --check writes nothing and fails if any projection is stale).
step('4b. Example catalogue projections up to date', 'node engine/generate-examples.js --check');
step('4c. Home featured examples projection up to date', 'node engine/gen_home_featured.js --check');

// 5. Lockfile portability.
step('5. Lockfile portability', 'node engine/validate_lockfile.js');

// 5b. Manifest verification logic (shared with the production smoke) — negative
//     tests that each guard bites: missing file, wrong SHA, duplicate, self-ref,
//     malformed line, required-file-absent.
step('5b. Manifest guard negative tests', 'node engine/tests_manifest_negative.js');

// 6. Build via the declared npm script.
step('6. Build (npm run build)', 'npm run build');

// 7. HTML validity of the BUILT pages.
step('7. HTML validity (dist)', 'node engine/validate_html.js dist');

// 8. Validate dist.
step('8. Validate dist', 'node engine/validate_dist.js');

// 9. Links + assets over real HTTP.
step('9. Dist over HTTP (links, assets, 404s, Worker)', 'node engine/test_dist_http.js');

// 10. build-info present in dist.
console.log('\n=== 10. build-info present ===');
if (!fs.existsSync(path.join(root, 'dist', 'build-info.json'))) {
  console.error('dist/build-info.json missing'); process.exit(1);
}
console.log('  ok: dist/build-info.json present (CI stamps the real SHA)');

// 11. hashes.txt must NOT be in dist yet (CI writes it after dist is final).
console.log('\n=== 11. hashes.txt not premature ===');
if (fs.existsSync(path.join(root, 'dist', 'assets', 'hashes.txt'))) {
  console.error('dist/assets/hashes.txt present before CI hashing step (stale)'); process.exit(1);
}
console.log('  ok: no premature hashes.txt (CI generates it after dist is final)');

console.log('\nVERIFY: ALL GREEN');
