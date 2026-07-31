/* Negative tests for verify_manifest.js — exercise each guard with an
 * in-memory fetch implementation. No real sockets are opened, so the suite is
 * deterministic on Windows and cannot leave libuv HTTP handles closing when
 * the process exits. Every assertion goes THROUGH verifyManifest. */
const crypto = require('crypto');
const { verifyManifest } = require('./verify_manifest.js');

const served = {
  '/index.html': Buffer.from('<html>index</html>'),
  '/assets/app.js': Buffer.from('console.log(1)'),
};
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

/* Minimal fetch-compatible response used only by these guard tests.
 * test_dist_http.js separately exercises verifyManifest over a real HTTP server. */
async function mockFetch(url) {
  const pathname = new URL(url).pathname;
  const body = served[pathname];
  if (!body) {
    return {
      status: 404,
      arrayBuffer: async () => Buffer.from('nf'),
    };
  }
  return {
    status: 200,
    arrayBuffer: async () => body,
  };
}

const BASE = 'http://manifest.test';

async function run(label, opts, expectError, errIncludes) {
  let err = null;
  try {
    await verifyManifest({ base: BASE, cb: 'x', fetchImpl: mockFetch, ...opts });
  } catch (e) {
    err = e.message;
  }
  const bit = err ? 'FAILS' : 'PASSES';
  let good = expectError ? !!err : !err;
  if (good && expectError && errIncludes && !(err || '').includes(errIncludes)) {
    good = false;
  }
  console.log((good ? 'OK  ' : 'BAD ') + label + ' -> ' + bit + (err ? (' (' + err + ')') : ''));
  return good;
}

async function main() {
  const goodManifest =
    sha(served['/index.html']) + '  ./index.html\n' +
    sha(served['/assets/app.js']) + '  ./assets/app.js\n';
  const manifestNoIndex = sha(served['/assets/app.js']) + '  ./assets/app.js\n';

  let ok = true;

  // Baseline: a correct manifest passes.
  ok &= await run('NEG-M0 baseline correct manifest', { manifestText: goodManifest }, false);

  // 1. Entry points to a nonexistent file.
  ok &= await run('NEG-M1 entry -> nonexistent file',
    { manifestText: goodManifest + sha(Buffer.from('x')) + '  ./assets/missing.js\n' }, true, 'MISSING');

  // 2. A served file has a different SHA (wrong hash in manifest).
  ok &= await run('NEG-M2 served file wrong SHA',
    { manifestText: sha(Buffer.from('WRONG')) + '  ./index.html\n' + sha(served['/assets/app.js']) + '  ./assets/app.js\n' },
    true, 'HASH MISMATCH');

  // 3. Duplicate entry.
  ok &= await run('NEG-M3 duplicate entry',
    { manifestText: goodManifest + sha(served['/index.html']) + '  ./index.html\n' }, true, 'duplicate');

  // 4. hashes.txt listed in its own manifest.
  ok &= await run('NEG-M4 hashes.txt in its own manifest',
    { manifestText: goodManifest + sha(Buffer.from('m')) + '  ./assets/hashes.txt\n' }, true, 'own manifest');

  // 5. Malformed line.
  ok &= await run('NEG-M5 malformed manifest line',
    { manifestText: goodManifest + 'not-a-hash ./index.html\n' }, true, 'malformed');

  // 6. REAL required-path test THROUGH the module: a valid manifest that OMITS
  //    index.html, with requiredPaths demanding it -> must fail inside verifyManifest.
  ok &= await run('NEG-M6 required file omitted from manifest',
    { manifestText: manifestNoIndex, requiredPaths: ['./index.html', './assets/app.js'] },
    true, 'required file missing from manifest: ./index.html');

  // 7. requiredPath absolute -> rejected.
  ok &= await run('NEG-M7 required path absolute',
    { manifestText: goodManifest, requiredPaths: ['/index.html'] }, true, 'absolute');

  // 8. requiredPath with ".." -> rejected.
  ok &= await run('NEG-M8 required path with ..',
    { manifestText: goodManifest, requiredPaths: ['./../secret'] }, true, '".."');

  // 9. requiredPath empty -> rejected.
  ok &= await run('NEG-M9 required path empty',
    { manifestText: goodManifest, requiredPaths: [''] }, true, 'empty');

  // 10. Sanity: correct manifest WITH satisfied requiredPaths passes.
  ok &= await run('NEG-M10 required paths all present',
    { manifestText: goodManifest, requiredPaths: ['./index.html', './assets/app.js'] }, false);

  console.log(ok ? '\nALL MANIFEST NEGATIVE TESTS OK' : '\nSOME NEGATIVE TESTS BAD');
  process.exitCode = ok ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
