'use strict';
/* ============================================================================
   F6 PAYLOAD CACHE-BUST TESTS (audit blocker 1, checks A-H).

   assets/examples-library.js is data-bearing: it changes when F7 adds examples or edits
   metadata. Its <script> reference in examples.html must carry a DETERMINISTIC, content-
   derived cache-bust version, owned by the generator, so a stale browser-cached payload
   can never mismatch the regenerated HTML. Version = sha256(payloadSource).slice(0,12).

     A current payload has a deterministic cache version, and the HTML uses exactly it
     B generator --check verifies the HTML reference is up to date
     C unchanged payload -> same version
     D modified canonical record (same count) -> new version
     E canonical #10 (new record) -> new version, automatically
     F generated HTML references that exact version
     G a deliberately stale version in the HTML makes generator --check FAIL
     H no manual hardcoded ?v=1 contract remains for the payload script

   Node built-ins only; Windows-safe (fs.cpSync/rmSync/mkdtempSync; no shell; no
   execSync('node'); paths with spaces OK).
   ========================================================================== */
var fs = require('fs');
var os = require('os');
var path = require('path');

var SITE = path.join(__dirname, '..');
var pass = 0, fail = 0; var failures = [];
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

var gen = require(path.join(SITE, 'engine', 'generate-examples-library.js'));

// ---- A / F: current payload has a deterministic version, and the HTML uses exactly it.
(function () {
  var v = gen.payloadVersion(gen.buildPayloadSource(SITE));
  ok('A: payload version is 12 lowercase hex chars', /^[0-9a-f]{12}$/.test(v), v);
  var html = read(path.join(SITE, 'examples.html'));
  ok('F: examples.html references the payload script at exactly ?v=' + v,
     html.indexOf('assets/examples-library.js?v=' + v) !== -1);
  ok('A: the payload script sits inside the PAYLOAD-SCRIPT marker',
     /LIBRARY-GENERATED:PAYLOAD-SCRIPT[\s\S]*?examples-library\.js\?v=[0-9a-f]{12}[\s\S]*?\/LIBRARY-GENERATED:PAYLOAD-SCRIPT/.test(html));
})();

// ---- B: generator --check is clean when the reference is current.
(function () {
  var chk = gen.run(SITE, { check: true });
  ok('B: generator --check clean (payload script reference in sync)', chk.ok === true, (chk.changed || []).join(','));
})();

// ---- C: unchanged payload -> same version (pure determinism).
(function () {
  var a = gen.payloadVersion(gen.buildPayloadSource(SITE));
  var b = gen.payloadVersion(gen.buildPayloadSource(SITE));
  ok('C: unchanged payload yields the same version twice', a === b, a + ' vs ' + b);
  // And it is NOT derived from count alone: the version string must not equal the count.
  ok('C: version is a content digest, not the record count', a !== '9' && a.length === 12);
})();

// ---- H: no manual ?v=1 payload contract remains.
(function () {
  var html = read(path.join(SITE, 'examples.html'));
  ok('H: no hardcoded examples-library.js?v=1 remains', !/examples-library\.js\?v=1\b/.test(html));
})();

// ---- G: a deliberately stale version in the HTML makes --check FAIL (in a temp copy).
(function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f6 cachebust g '));  // space in path
  try {
    ['assets', 'src', 'engine'].forEach(function (d) { fs.cpSync(path.join(SITE, d), path.join(dir, d), { recursive: true }); });
    fs.copyFileSync(path.join(SITE, 'examples.html'), path.join(dir, 'examples.html'));
    var v = gen.payloadVersion(gen.buildPayloadSource(dir));
    var html = read(path.join(dir, 'examples.html'));
    fs.writeFileSync(path.join(dir, 'examples.html'), html.replace('examples-library.js?v=' + v, 'examples-library.js?v=deadbeef0000'));
    var chk = gen.run(dir, { check: true });
    ok('G: stale payload version makes --check report examples.html stale', chk.ok === false && chk.changed.indexOf('examples.html') !== -1, JSON.stringify(chk.changed));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// ---- D: a modified canonical record (same count) yields a NEW version.
(function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f6 cachebust d '));
  try {
    ['assets', 'src', 'engine'].forEach(function (d) { fs.cpSync(path.join(SITE, d), path.join(dir, d), { recursive: true }); });
    fs.copyFileSync(path.join(SITE, 'examples.html'), path.join(dir, 'examples.html'));
    var before = gen.payloadVersion(gen.buildPayloadSource(dir));
    var catP = path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
    delete require.cache[require.resolve(catP)];
    var CAT = require(catP).CATALOGUE;
    var clone = JSON.parse(JSON.stringify(CAT));
    clone[0].translations.en.title = clone[0].translations.en.title + ' (edited)';
    fs.writeFileSync(catP, 'var CATALOGUE = ' + JSON.stringify(clone, null, 2) + ';\nmodule.exports = { CATALOGUE: CATALOGUE };\n');
    delete require.cache[require.resolve(catP)];
    var after = gen.payloadVersion(gen.buildPayloadSource(dir));
    ok('D: same count (9) but edited metadata yields a new version', before !== after, before + ' -> ' + after);
    ok('D: both versions are valid digests', /^[0-9a-f]{12}$/.test(before) && /^[0-9a-f]{12}$/.test(after));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// ---- E: a canonical #10 (new record) yields a NEW version automatically, and the
//         regenerated HTML references it (full pipeline, in a spaced temp path).
(function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f6 cachebust e '));
  try {
    ['assets', 'src', 'engine'].forEach(function (d) { fs.cpSync(path.join(SITE, d), path.join(dir, d), { recursive: true }); });
    fs.copyFileSync(path.join(SITE, 'examples.html'), path.join(dir, 'examples.html'));
    var before = gen.payloadVersion(gen.buildPayloadSource(dir));

    // add a genuinely F5-valid 10th record (clone of production, re-keyed).
    var catP = path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
    delete require.cache[require.resolve(catP)];
    var CAT = require(catP).CATALOGUE;
    var clone = JSON.parse(JSON.stringify(CAT.find(function (r) { return r.key === 'production'; })));
    clone.key = 'future10'; clone.slug = 'future-example-10';
    clone.translations.en.title = 'Future example ten';
    fs.writeFileSync(catP, 'var CATALOGUE = ' + JSON.stringify(CAT.concat([clone]), null, 2) + ';\nmodule.exports = { CATALOGUE: CATALOGUE };\n');

    var mP = path.join(dir, 'src', 'shared', 'examples', 'f5', 'metadata.js');
    var mtxt = read(mP);
    var s = mtxt.indexOf('\n  production: {');
    var e = mtxt.indexOf('\n  },', s);
    var block = mtxt.slice(s + 1, e + '\n  },'.length - 1);
    var cloneMeta = block.replace(/^  production: \{/, '  future10: {')
      .replace("primaryCategory: 'production-operations'", "primaryCategory: 'energy-sustainability'")
      .replace(/related: \[[^\]]*\],/, 'related: [],');
    fs.writeFileSync(mP, mtxt.slice(0, e + '\n  },'.length) + '\n' + cloneMeta + ',' + mtxt.slice(e + '\n  },'.length));

    var after = gen.payloadVersion(gen.buildPayloadSource(dir));
    ok('E: adding canonical #10 changes the payload version automatically', before !== after, before + ' -> ' + after);

    // regenerate and confirm the HTML now references the NEW version.
    gen.run(dir, { check: false });
    var html2 = read(path.join(dir, 'examples.html'));
    ok('E: regenerated HTML references the new version', html2.indexOf('examples-library.js?v=' + after) !== -1);
    ok('E: regenerated HTML no longer references the old version', html2.indexOf('examples-library.js?v=' + before) === -1);
    ok('E: real site payload is untouched (still the original 9-record version)', gen.payloadVersion(gen.buildPayloadSource(SITE)) === before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F6 PAYLOAD CACHE-BUST (A-H)  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
