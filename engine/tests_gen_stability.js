/* tests_gen_stability.js — the two generators that both write to index.html
 * (gen_home_capabilities.js and gen_jsonld.js) touch disjoint regions, so
 * running them in either order must produce byte-identical output. A future
 * change to a marker that made one generator clobber the other's region would
 * fail here.
 *
 * The generators resolve their own paths from __dirname/.. and write to the real
 * index.html, so this test snapshots the real file's bytes up front, drives the
 * generators against it, compares the results, and ALWAYS restores the original
 * bytes in a finally block. It never leaves index.html modified, even on failure.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const siteDir = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

// Snapshot the real index.html up front; every run below works against it and
// the finally block restores these exact bytes.
const idxPath = path.join(siteDir, 'index.html');
const original = fs.readFileSync(idxPath, 'utf8');

function run(script) {
  execFileSync('node', [path.join(siteDir, 'engine', script)], { stdio: 'pipe' });
}

try {
  // Order A: home summary, then JSON-LD.
  fs.writeFileSync(idxPath, original);
  run('gen_home_capabilities.js');
  run('gen_jsonld.js');
  const orderA = fs.readFileSync(idxPath, 'utf8');

  // Order B: JSON-LD, then home summary.
  fs.writeFileSync(idxPath, original);
  run('gen_jsonld.js');
  run('gen_home_capabilities.js');
  const orderB = fs.readFileSync(idxPath, 'utf8');

  ok('gen stability: both orders produce byte-identical index.html', orderA === orderB);

  // And a second pass is a no-op (idempotent): running both again does not change bytes.
  run('gen_home_capabilities.js');
  run('gen_jsonld.js');
  const twice = fs.readFileSync(idxPath, 'utf8');
  ok('gen stability: a second pass is idempotent', twice === orderB);

  // Both --check pass on the settled file.
  let checkOk = true;
  try {
    execFileSync('node', [path.join(siteDir, 'engine', 'gen_home_capabilities.js'), '--check'], { stdio: 'pipe' });
    execFileSync('node', [path.join(siteDir, 'engine', 'gen_jsonld.js'), '--check'], { stdio: 'pipe' });
  } catch (e) { checkOk = false; }
  ok('gen stability: both --check pass on the settled file', checkOk);
} finally {
  // Always restore the real file to its committed content.
  fs.writeFileSync(idxPath, original);
}

console.log('GEN STABILITY TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
