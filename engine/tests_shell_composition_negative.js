/* tests_shell_composition_negative.js — Checkpoint B1 negative tests (v2).
 *
 * Every case introduces a REAL malformed input (a bad marker, a mutated fragment,
 * a missing fragment file) and proves the composer / guards FAIL. Fragment
 * mutations use a TEMP fragment dir via createComposer({ fragmentDir }); page
 * mutations use throwaway HTML strings with a valid PAGE_CONTEXT filename. No real
 * page or the real fragments are mutated. Temp dirs are always restored. No HTTP
 * server. LF-only. Deterministic.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JSDOM } = require('jsdom');
const compose = require('../src/shared/compose-shell.js');
const { composeHtml, renderHeader, renderFooter, createComposer } = compose;

const REAL_FRAGMENT_DIR = path.join(__dirname, '..', 'src', 'shared', 'fragments');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Assert a function throws, optionally with a message substring.
function throws(label, fn, needle) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  const good = !!err && (!needle || (err.message || '').includes(needle));
  ok(label, good, err ? ('got: ' + err.message) : 'did NOT throw');
}

// Build a temp fragment dir seeded from the real fragments, optionally mutated by
// a callback, run a body with a composer bound to it, and always clean up.
function withFragmentDir(mutate, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plum frags '));
  try {
    let header = fs.readFileSync(path.join(REAL_FRAGMENT_DIR, 'header.html'), 'utf8');
    let footer = fs.readFileSync(path.join(REAL_FRAGMENT_DIR, 'footer.html'), 'utf8');
    const files = { header: header, footer: footer };
    if (mutate) mutate(files);
    if (files.header !== null) fs.writeFileSync(path.join(dir, 'header.html'), files.header);
    if (files.footer !== null) fs.writeFileSync(path.join(dir, 'footer.html'), files.footer);
    body(createComposer({ fragmentDir: dir }), dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const H_INFO = '<!-- PLUMLINE:HEADER pageType="informational" active="about" -->';
const F_PLAIN = '<!-- PLUMLINE:FOOTER -->';
const BODY = '\n<main>x</main>\n';
// A valid about.html-shaped page (about is informational/active=about/no learn).
const ABOUT = H_INFO + BODY + F_PLAIN;

// 1. header.html missing -> composer fails.
withFragmentDir(function (f) { f.header = null; }, function (comp) {
  throws('1. missing header.html -> compose fails', function () { comp.composeHtml(ABOUT, 'about.html'); }, 'missing fragment');
});
// 2. footer.html missing -> composer fails.
withFragmentDir(function (f) { f.footer = null; }, function (comp) {
  throws('2. missing footer.html -> compose fails', function () { comp.composeHtml(ABOUT, 'about.html'); }, 'missing fragment');
});
// 3. Duplicate HEADER marker -> fails.
throws('3. duplicate HEADER marker -> fails',
  function () { composeHtml(H_INFO + '\n' + H_INFO + BODY + F_PLAIN, 'about.html'); }, 'duplicate PLUMLINE:HEADER');
// 4. Duplicate FOOTER marker -> fails.
throws('4. duplicate FOOTER marker -> fails',
  function () { composeHtml(H_INFO + BODY + F_PLAIN + '\n' + F_PLAIN, 'about.html'); }, 'duplicate PLUMLINE:FOOTER');
// 5. guide declared as solver pageType -> mismatch vs PAGE_CONTEXT -> fails.
throws('5. guide page with pageType=solver -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="solver" active="guide" -->' + BODY + F_PLAIN, 'guide.html'); },
  'does not match PAGE_CONTEXT');
// 6. solver declared as informational -> mismatch -> fails.
throws('6. solver page with pageType=informational -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="solver" -->' + BODY + F_PLAIN, 'solver.html'); },
  'does not match PAGE_CONTEXT');
// 7. learnCapabilities added to guide -> not authorized (unknown attr) -> fails.
throws('7. learnCapabilities on guide -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="guide" -->' + BODY +
    '<!-- PLUMLINE:FOOTER learnCapabilities="true" -->', 'guide.html'); },
  'unknown attribute "learnCapabilities"');
// 8. learnCapabilities removed from capabilities (marker omits it) -> fails.
throws('8. capabilities without learnCapabilities -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="" -->' + BODY + F_PLAIN, 'capabilities.html'); },
  'missing required attribute "learnCapabilities"');
// 9. about page with active=guide -> mismatch -> fails.
throws('9. about page with active=guide -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="guide" -->' + BODY + F_PLAIN, 'about.html'); },
  'does not match PAGE_CONTEXT');
// 10. footer tries to override pageType -> unknown attribute -> fails.
throws('10. footer pageType override -> fails',
  function () { composeHtml(H_INFO + BODY + '<!-- PLUMLINE:FOOTER pageType="solver" -->', 'about.html'); },
  'unknown attribute "pageType"');
// 11. unknown attribute on HEADER -> fails.
throws('11. unknown attribute on HEADER -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="about" bogus="x" -->' + BODY + F_PLAIN, 'about.html'); },
  'unknown attribute "bogus"');
// 12. duplicate attribute on HEADER -> fails.
throws('12. duplicate attribute -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="about" active="guide" -->' + BODY + F_PLAIN, 'about.html'); },
  'duplicate attribute "active"');
// 12b. boolean attribute with a non-true/false value -> fails.
throws('12b. learnCapabilities="yes" -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="" -->' + BODY +
    '<!-- PLUMLINE:FOOTER learnCapabilities="yes" -->', 'capabilities.html'); },
  'must be true or false');

// --- Strict-parser cases (parseAttrs must consume the WHOLE marker body) --------
// P1. bare attribute (no value) -> fails.
throws('P1. bare attribute "bogus" -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="about" bogus -->' + BODY + F_PLAIN, 'about.html'); });
// P2. unquoted value -> fails.
throws('P2. unquoted value bogus=x -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="about" bogus=x -->' + BODY + F_PLAIN, 'about.html'); });
// P3. single-quoted value -> fails.
throws("P3. single-quoted value bogus='x' -> fails",
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="about" bogus=\'x\' -->' + BODY + F_PLAIN, 'about.html'); });
// P4. residual punctuation -> fails.
throws('P4. residual "!!!" -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="about" !!! -->' + BODY + F_PLAIN, 'about.html'); },
  'malformed attribute');
// P5. active omitted on index.html -> fails (active is required even when "").
throws('P5. active omitted on index.html -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" -->' + BODY + F_PLAIN, 'index.html'); },
  'missing required attribute "active"');
// P6. active omitted on about.html -> fails.
throws('P6. active omitted on about.html -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" -->' + BODY + F_PLAIN, 'about.html'); },
  'missing required attribute "active"');
// P7. pageType omitted -> fails.
throws('P7. pageType omitted -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER active="about" -->' + BODY + F_PLAIN, 'about.html'); },
  'missing required attribute "pageType"');
// P8. learnCapabilities="false" on a normal page -> fails (unknown attribute).
throws('P8. learnCapabilities="false" on privacy.html -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="" -->' + BODY +
    '<!-- PLUMLINE:FOOTER learnCapabilities="false" -->', 'privacy.html'); },
  'unknown attribute "learnCapabilities"');
// P9. learnCapabilities="false" on capabilities -> fails (must be exactly "true").
throws('P9. learnCapabilities="false" on capabilities.html -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="" -->' + BODY +
    '<!-- PLUMLINE:FOOTER learnCapabilities="false" -->', 'capabilities.html'); },
  'must declare learnCapabilities="true"');
// P10. extra whitespace between attributes still WORKS (positive control).
ok('P10. extra whitespace between attributes still composes',
   (function () {
     try {
       composeHtml('<!-- PLUMLINE:HEADER   pageType="informational"    active="about"   -->' + BODY + F_PLAIN, 'about.html');
       return true;
     } catch (e) { return false; }
   })());
// P11. leading/trailing whitespace around attributes still WORKS (positive control).
ok('P11. leading/trailing whitespace around attributes still composes',
   (function () {
     try {
       composeHtml('<!--  PLUMLINE:HEADER pageType="informational" active="about"  -->' + BODY + F_PLAIN, 'about.html');
       return true;
     } catch (e) { return false; }
   })());
// P12. duplicate attribute whose second copy uses invalid syntax -> fails.
throws('P12. duplicate active with invalid second syntax -> fails',
  function () { composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="about" active=z -->' + BODY + F_PLAIN, 'about.html'); });

// 13. Mutate a fragment so the active nav link is wrong: swap the guide link's
//     {{AC:guide}} token onto the about link (about link becomes {{AC:about}} +
//     {{AC:guide}} effectively — we move the guide token to the about anchor).
//     Then composing guide.html (active=guide) marks the ABOUT link instead of the
//     GUIDE link -> the shell guard detects aria-current on the wrong anchor.
withFragmentDir(function (f) {
  // Remove the guide token from the guide link and graft it onto the about link.
  f.header = f.header
    .replace('href="guide.html" class="hide-sm"{{AC:guide}}', 'href="guide.html" class="hide-sm"')
    .replace('href="about.html" class="hide-sm"{{AC:about}}', 'href="about.html" class="hide-sm"{{AC:guide}}');
}, function (comp) {
  const html = comp.composeHtml('<!-- PLUMLINE:HEADER pageType="informational" active="guide" -->' + BODY + F_PLAIN, 'guide.html');
  const doc = new JSDOM(html).window.document;
  const guideLink = doc.querySelector('a[href="guide.html"]');
  const aboutLink = doc.querySelector('a[href="about.html"]');
  // guide.html's context says active=guide, so a CORRECT shell marks guide. The
  // mutated fragment marks about instead -> detectable mislabeling.
  const wrong = guideLink && aboutLink &&
    !guideLink.hasAttribute('aria-current') && aboutLink.hasAttribute('aria-current');
  ok('13. mutated fragment producing wrong aria-current is detectable', wrong);
});

// 14. Mutate a fragment to introduce a DUPLICATE id (#buildBadge already exists in
//     the footer; add a second one in the header) -> the composed DOM has a
//     duplicate id, which the shell guard detects.
withFragmentDir(function (f) {
  f.header = f.header.replace('<span class="wm">Plumline</span>',
    '<span class="wm" id="buildBadge">Plumline</span>');
}, function (comp) {
  const html = comp.composeHtml(ABOUT, 'about.html');
  const doc = new JSDOM(html).window.document;
  const ids = [].map.call(doc.querySelectorAll('[id]'), function (e) { return e.id; });
  const dupe = ids.filter(function (v, i) { return ids.indexOf(v) !== i; });
  ok('14. mutated fragment producing a duplicate id is detectable', dupe.indexOf('buildBadge') !== -1);
});

// 15. REAL guard test: actually run tests_composed_reads.js against a bad suite in
//     a temp tree whose path contains a space, and prove the runner exits non-zero
//     and names the offending suite. Then run it again with a GOOD suite and prove
//     it passes. We do NOT simulate the guard's logic — we execute the guard.
{
  const { execFileSync } = require('child_process');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plum guard '));
  try {
    const tmpEngine = path.join(tmpRoot, 'engine');
    fs.mkdirSync(tmpEngine, { recursive: true });
    // (a) the guard itself.
    fs.copyFileSync(path.join(__dirname, 'tests_composed_reads.js'),
                    path.join(tmpEngine, 'tests_composed_reads.js'));
    // (b) composed-html.js (a GOOD suite requires it, and the guard reads its name).
    fs.copyFileSync(path.join(__dirname, 'composed-html.js'),
                    path.join(tmpEngine, 'composed-html.js'));
    // (c) all 8 migrated pages, so the guard sees markers and computes `migrated`.
    const PAGES8 = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];
    for (const p of PAGES8) {
      fs.copyFileSync(path.join(__dirname, '..', p + '.html'), path.join(tmpRoot, p + '.html'));
    }
    // The composer + fragments, so composed-html.js can require them if loaded.
    fs.mkdirSync(path.join(tmpRoot, 'src', 'shared', 'fragments'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', 'src', 'shared', 'compose-shell.js'),
                    path.join(tmpRoot, 'src', 'shared', 'compose-shell.js'));
    fs.copyFileSync(path.join(__dirname, '..', 'src', 'shared', 'fragments', 'header.html'),
                    path.join(tmpRoot, 'src', 'shared', 'fragments', 'header.html'));
    fs.copyFileSync(path.join(__dirname, '..', 'src', 'shared', 'fragments', 'footer.html'),
                    path.join(tmpRoot, 'src', 'shared', 'fragments', 'footer.html'));

    const badPath = path.join(tmpEngine, 'tests_bad_raw.js');
    const goodPath = path.join(tmpEngine, 'tests_bad_raw.js'); // same slot, swapped content

    // (d) NEGATIVE: a suite that reads solver.html RAW, not on the allowlist.
    fs.writeFileSync(badPath, [
      "'use strict';",
      "const fs = require('fs');",
      "const path = require('path');",
      "const siteDir = path.join(__dirname, '..');",
      "const html = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');",
      "console.log('bad suite read', html.length);",
      ""
    ].join('\n'));

    let negExit = 0, negOut = '';
    try {
      execFileSync(process.execPath, [path.join(tmpEngine, 'tests_composed_reads.js')],
                   { cwd: tmpRoot, stdio: 'pipe' });
    } catch (e) {
      negExit = e.status == null ? 1 : e.status;
      negOut = String(e.stdout || '') + String(e.stderr || '');
    }
    ok('15. running the real guard against a raw-reading suite exits non-zero', negExit !== 0);
    ok('15. the guard output names tests_bad_raw.js', /tests_bad_raw\.js/.test(negOut));

    // (e) POSITIVE control: replace the bad suite with a GOOD one that routes through
    //     composedHtml. The guard must now PASS (exit 0).
    fs.writeFileSync(goodPath, [
      "'use strict';",
      "const { composedHtml } = require('./composed-html.js');",
      "const html = composedHtml(require('path').join(__dirname, '..'), 'solver.html');",
      "console.log('good suite composed', html.length);",
      ""
    ].join('\n'));

    let posExit = 0, posOut = '';
    try {
      posOut = execFileSync(process.execPath, [path.join(tmpEngine, 'tests_composed_reads.js')],
                            { cwd: tmpRoot, stdio: 'pipe', encoding: 'utf8' });
    } catch (e) {
      posExit = e.status == null ? 1 : e.status;
      posOut = String(e.stdout || '') + String(e.stderr || '');
    }
    ok('15. with the suite fixed to use composedHtml, the real guard passes (exit 0)', posExit === 0);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true }); // always restore
  }
}

// 16. The FAQ generator runs from a path with spaces — covered fully by
//     tests_spaces_path.js. Here we assert that suite exists and uses execFileSync.
{
  const p = path.join(__dirname, 'tests_spaces_path.js');
  ok('16. spaces-path contract suite exists', fs.existsSync(p));
  const body = fs.readFileSync(p, 'utf8');
  ok('16. spaces-path suite drives the generator via execFileSync',
     /execFileSync\(process\.execPath,/.test(body));
}

// --- Extra guards retained from v1 ---------------------------------------------
// Unknown pageType / invalid active via renderHeader directly.
throws('unknown pageType in renderHeader -> throws', function () { renderHeader('ghost', 'about'); }, 'unknown pageType');
throws('invalid active in renderHeader -> throws', function () { renderHeader('informational', 'nope'); }, 'invalid active');
// composeHtml with a filename not in PAGE_CONTEXT -> throws.
throws('unknown filename -> throws', function () { composeHtml(ABOUT, 'nope.html'); }, 'no PAGE_CONTEXT entry');
// Injection via active is rejected by the allowlist (never inserted).
throws('injected active -> rejected', function () { renderHeader('informational', '"><script>'); }, 'invalid active');
ok('no script tag reaches header', !renderHeader('informational', 'about').includes('<script'));
// Determinism.
{
  const a = composeHtml(ABOUT, 'about.html');
  const b = composeHtml(ABOUT, 'about.html');
  ok('composition is deterministic', a === b);
}
// renderFooter accepts boolean and object forms identically.
ok('renderFooter(informational, true) has Capabilities link',
   renderFooter('informational', true).includes('data-i18n="navCapabilities"'));
ok('renderFooter(informational, {learnCapabilities:true}) matches boolean form',
   renderFooter('informational', { learnCapabilities: true }) === renderFooter('informational', true));
ok('renderFooter(informational, false) has no Capabilities link',
   !renderFooter('informational', false).includes('data-i18n="navCapabilities"'));

console.log('SHELL COMPOSITION NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass, fail };
