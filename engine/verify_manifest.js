/* verify_manifest.js — verify that every entry in a hashes.txt manifest matches
 * the file served at that path over HTTP, AND that every required public path is
 * present in the manifest. Shared logic so the production smoke job and the local
 * dist HTTP test check the manifest the same way.
 *
 * Usage: verifyManifest({ base, cb, fetchImpl, manifestText, requiredPaths })
 *   base          - origin, e.g. http://127.0.0.1:PORT or https://plumline.online
 *   cb            - cache-buster appended as ?cb=... (same for every fetch)
 *   fetchImpl     - a fetch(url,{redirect}) implementation
 *   manifestText  - the text of assets/hashes.txt
 *   requiredPaths - optional list of paths that MUST appear in the manifest.
 *                   Each is normalised to "./<path>". This closes the gap where a
 *                   manifest that simply OMITS a public file would otherwise pass
 *                   (every listed entry matches, but a whole file is missing).
 *
 * Rules enforced (returns {checked} or throws Error):
 *   - each line is "<64-hex>␠␠./<path>"; malformed line -> fail
 *   - hashes.txt must NOT appear in its own manifest (excluded at generation)
 *   - a duplicate path entry -> fail
 *   - empty manifest -> fail
 *   - each requiredPath is non-empty, relative, without ".." -> else fail
 *   - each requiredPath must be present in the manifest -> else
 *       "required file missing from manifest: ./<path>"
 *   - each listed path must return 200 -> else "MISSING ... (HTTP ...)"
 *   - each downloaded file's SHA-256 must equal the manifest hash -> else mismatch
 */
const crypto = require('crypto');

// Normalise a required path to the manifest's "./<path>" form, rejecting unsafe
// or malformed inputs (empty, absolute, or containing a ".." segment).
function normalizeRequired(p) {
  if (typeof p !== 'string' || p.trim() === '') {
    throw new Error('required path is empty');
  }
  if (p.startsWith('/')) {
    throw new Error('required path must be relative, got absolute: ' + p);
  }
  const stripped = p.replace(/^\.\//, '');
  if (stripped.split('/').some(seg => seg === '..')) {
    throw new Error('required path must not contain "..": ' + p);
  }
  return './' + stripped;
}

async function verifyManifest({ base, cb, fetchImpl, manifestText, requiredPaths = [] }) {
  const lines = manifestText.split('\n').filter(l => l.trim().length);
  const expect = new Map();
  for (const line of lines) {
    const m = line.match(/^([0-9a-f]{64})  (\.\/.+)$/);
    if (!m) throw new Error('malformed manifest line: ' + JSON.stringify(line));
    const [, hash, path] = m;
    if (path === './assets/hashes.txt') throw new Error('hashes.txt must not be in its own manifest');
    if (expect.has(path)) throw new Error('duplicate manifest entry: ' + path);
    expect.set(path, hash);
  }
  if (!expect.size) throw new Error('empty manifest');

  // Every required public path must be present in the manifest. Normalise first
  // (this also rejects empty / absolute / "../" required paths).
  for (const req of requiredPaths) {
    const norm = normalizeRequired(req);
    if (!expect.has(norm)) {
      throw new Error('required file missing from manifest: ' + norm);
    }
  }

  let checked = 0;
  for (const [path, hash] of expect) {
    const rel = path.replace(/^\.\//, '');
    const url = base + '/' + rel + '?cb=' + cb;
    const res = await fetchImpl(url, { redirect: 'manual' });
    if (res.status !== 200) throw new Error('MISSING ' + rel + ' (HTTP ' + res.status + ')');
    const buf = Buffer.from(await res.arrayBuffer());
    const actual = crypto.createHash('sha256').update(buf).digest('hex');
    if (actual !== hash) throw new Error('HASH MISMATCH ' + rel + ' (expected ' + hash + ' got ' + actual + ')');
    checked++;
  }
  return { checked };
}

module.exports = { verifyManifest, normalizeRequired };
