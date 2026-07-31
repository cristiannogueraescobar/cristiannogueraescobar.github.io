/* validate_lockfile.js — guard against a regenerated lockfile silently dropping
 * platform-specific optional deps (a known npm issue). Without these, `npm ci`
 * on another OS/arch fails. The dev works on Windows, and CI runs on Ubuntu and
 * Windows, but nothing else pins the macOS entries — so assert them explicitly.
 *
 * Fails if package-lock.json is missing any required platform variant, or if
 * package.json and the lock disagree on the core dev deps.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let fail = 0;
function ok(name, cond, detail) { if (!cond) { fail++; console.log('  FAIL:', name, detail || ''); } else { console.log('  ok:', name); } }

const lockPath = path.join(root, 'package-lock.json');
const pkgPath = path.join(root, 'package.json');
ok('package-lock.json exists', fs.existsSync(lockPath));
ok('package.json exists', fs.existsSync(pkgPath));
if (!fs.existsSync(lockPath) || !fs.existsSync(pkgPath)) {
  console.log('VALIDATE LOCKFILE: FAILED (missing files)'); process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const packages = lock.packages || {};

// Required platform variants (Linux, Windows, macOS ARM at minimum).
const REQUIRED_PLATFORM_PKGS = [
  '@esbuild/linux-x64',
  '@esbuild/win32-x64',
  '@esbuild/darwin-arm64',
  '@rollup/rollup-linux-x64-gnu',
  '@rollup/rollup-win32-x64-msvc',
  '@rollup/rollup-darwin-arm64',
];
for (const name of REQUIRED_PLATFORM_PKGS) {
  ok('lock has platform variant: ' + name, !!packages['node_modules/' + name],
     'missing — npm ci will fail on that platform');
}

// package.json <-> lock agreement on the core dev deps.
const dev = pkg.devDependencies || {};
for (const name of ['acorn', 'jsdom', 'vite']) {
  const want = (dev[name] || '').replace(/[^0-9.]/g, '');
  const got = packages['node_modules/' + name] && packages['node_modules/' + name].version;
  ok('package/lock agree on ' + name + ' (' + want + ')', !!got && got === want, 'lock=' + got);
}

// engines must be present and EXACTLY the expected range in BOTH package.json
// and the lockfile's root entry, and the two must match each other. No loose
// substring match — a drift in either file, or an inconsistency between them,
// must fail.
const EXPECTED_NODE_RANGE = '>=24.15.0 <25';
const pkgNode = (pkg.engines && pkg.engines.node) || null;
const lockNode = (packages[''] && packages[''].engines && packages[''].engines.node) || null;
ok('package.json engines.node === "' + EXPECTED_NODE_RANGE + '"',
   pkgNode === EXPECTED_NODE_RANGE, 'package.json engines.node=' + JSON.stringify(pkgNode));
ok('package-lock root engines.node === "' + EXPECTED_NODE_RANGE + '"',
   lockNode === EXPECTED_NODE_RANGE, 'lock engines.node=' + JSON.stringify(lockNode));
ok('package.json and lock engines.node are identical',
   pkgNode !== null && lockNode !== null && pkgNode === lockNode,
   'pkg=' + JSON.stringify(pkgNode) + ' lock=' + JSON.stringify(lockNode));

console.log(fail ? ('VALIDATE LOCKFILE: FAILED (' + fail + ')') : 'VALIDATE LOCKFILE: OK');
process.exit(fail ? 1 : 0);
