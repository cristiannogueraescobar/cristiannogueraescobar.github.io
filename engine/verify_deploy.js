/**
 * verify_deploy.js — closes the deployment diagnosis from any machine, without
 * CI. It fetches the live site and reports whether production matches the
 * committed source.
 *
 *   node engine/verify_deploy.js [baseUrl]
 *   (default baseUrl: https://plumline.online)
 *
 * It checks:
 *   1. build-info.json on production — which commit is live, and how many tests
 *      that commit passed.
 *   2. That live index.html / i18n.js / examples.html contain the current
 *      build's content markers (#capabilities, gDirH, JSON-LD).
 *   3. That the live files match the local source (same bytes) for a few key
 *      files, flagging any that differ — that difference IS the deploy gap.
 *
 * Exit code is non-zero if production is stale or a marker is missing, so it
 * can gate work in a script.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const BASE = (process.argv[2] || 'https://plumline.online').replace(/\/$/, '');
const siteDir = path.join(__dirname, '..');

function get(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, function (res) {
      if (res.statusCode !== 200) { reject(new Error(url + ' -> HTTP ' + res.statusCode)); res.resume(); return; }
      let body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () { resolve(body); });
    }).on('error', reject);
  });
}
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

let problems = 0;
function check(name, cond, detail) {
  console.log((cond ? '  OK   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) problems++;
}

(async function () {
  console.log('Verifying deployment at ' + BASE + '\n');

  // 1. build-info.json
  let info = null;
  try { info = JSON.parse(await get(BASE + '/build-info.json')); }
  catch (e) { console.log('  (no build-info.json on production: ' + e.message + ')'); }
  if (info) {
    check('production reports a real commit', info.commit && info.commit !== 'DEV-LOCAL', 'commit=' + info.commit);
    check('production reports a passing test count', typeof info.testsPassed === 'number' && info.testsPassed > 0, 'tests=' + info.testsPassed);
    console.log('       built at: ' + info.builtAt);
  } else {
    check('build-info.json present on production', false, 'add it so production states its commit');
  }

  // 2. content markers + 3. byte-for-byte vs local source
  const files = [
    { url: '/index.html', local: 'index.html', markers: ['id="capabilities"'] },
    { url: '/assets/i18n.js', local: 'assets/i18n.js', markers: ['gDirH', 'gDirP'] },
    { url: '/examples.html', local: 'examples.html', markers: ['application/ld+json'] },
    { url: '/guide.html', local: 'guide.html', markers: ['gDirH'] }
  ];
  for (const f of files) {
    let live = null;
    try { live = await get(BASE + f.url); } catch (e) { check(f.url + ' reachable', false, e.message); continue; }
    f.markers.forEach(function (m) {
      check(f.url + ' contains "' + m + '"', live.indexOf(m) >= 0, 'marker missing from production');
    });
    const localPath = path.join(siteDir, f.local);
    if (fs.existsSync(localPath)) {
      const localSrc = fs.readFileSync(localPath, 'utf8');
      const same = sha(live) === sha(localSrc);
      check(f.url + ' matches local source', same,
        same ? '' : 'live sha ' + sha(live).slice(0, 12) + ' != local ' + sha(localSrc).slice(0, 12) + ' (this is the deploy gap)');
    }
  }

  console.log('');
  if (problems === 0) {
    console.log('RESULT: production matches this source' + (info ? ' at commit ' + info.commit : '') + '.');
    process.exit(0);
  } else {
    console.log('RESULT: ' + problems + ' problem(s). Production is not serving this build.');
    console.log('If markers are missing or files differ, the delivered files were not committed/deployed.');
    process.exit(1);
  }
})();
