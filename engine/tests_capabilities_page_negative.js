/* tests_capabilities_page_negative.js — Checkpoint C4 negative tests.
 *
 * Each case builds a temp tree, applies ONE real mutation, runs the SAME official
 * checkCapabilitiesPage() (or, for template-marker cases, the REAL generator via
 * tests_capabilities_generator patterns), asserts a specific failure, and cleans
 * up in finally. No reimplementation of the checker's logic.
 *
 * Template-marker / data-key / traversal / spaced-path generator guarantees are
 * covered by tests_capabilities_generator.js and are referenced here only via
 * the generator, never as checker assertions the checker cannot make.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { checkCapabilitiesPage } = require('./tests_capabilities_page.js');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

function makeTree(rootDir) {
  const dir = rootDir || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-cap-'));
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'pages-golden'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'engine', 'templates'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets', 'capabilities'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  PAGES.forEach(function (p) { fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html')); });
  ['product-capabilities.js', 'examples-data.js', 'i18n.js', 'cap-lightbox.js'].forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'assets', f), path.join(dir, 'assets', f));
  });
  fs.copyFileSync(path.join(siteDir, 'data', 'media.json'), path.join(dir, 'data', 'media.json'));
  fs.copyFileSync(path.join(siteDir, 'engine', 'templates', 'capabilities.template.html'),
    path.join(dir, 'engine', 'templates', 'capabilities.template.html'));
  fs.copyFileSync(path.join(siteDir, 'engine', 'gen_capabilities.js'), path.join(dir, 'engine', 'gen_capabilities.js'));
  fs.readdirSync(path.join(siteDir, 'assets', 'capabilities')).forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'assets', 'capabilities', f), path.join(dir, 'assets', 'capabilities', f));
  });
  fs.copyFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'capabilities-page.json'),
    path.join(dir, 'engine', 'fixtures', 'pages-golden', 'capabilities-page.json'));
  return dir;
}
function readF(f) { return fs.readFileSync(f, 'utf8'); }
function writeF(f, s) { fs.writeFileSync(f, s); }
function cp(dir) { return path.join(dir, 'capabilities.html'); }
function cd(dir) { return path.join(dir, 'assets', 'product-capabilities.js'); }
function md(dir) { return path.join(dir, 'data', 'media.json'); }
function tmpl(dir) { return path.join(dir, 'engine', 'templates', 'capabilities.template.html'); }
function mainOf(s) { return s.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0]; }

// Checker-based negative.
function negative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree passes the official checker', checkCapabilitiesPage(dir).fail === 0);
    mutate(dir);
    const after = checkCapabilitiesPage(dir);
    ok(label + ': mutation trips the checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
      after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
      'failures=' + after.failures.slice(0, 6).join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// Generator-based negative (template markers / data keys / traversal).
function genExit(dir, args) {
  try { execFileSync(process.execPath, [path.join(dir, 'engine', 'gen_capabilities.js')].concat(args || []),
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }); return 0; }
  catch (e) { return e.status || 1; }
}
function generatorNegative(label, mutate) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree, generator --check is green', genExit(dir, ['--check']) === 0);
    mutate(dir);
    ok(label + ': the generator fails after the mutation (exit != 0)', genExit(dir) !== 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. Remove a section.
negative('N1 (remove a section)', function (d) {
  writeF(cp(d), readF(cp(d)).replace(/<section\b[\s\S]*?<\/section>/, ''));
}, 'capabilities: <main> SHA-256');
// 2. Duplicate a section.
negative('N2 (duplicate a section)', function (d) {
  const s = readF(cp(d)); const m = s.match(/<section\b[\s\S]*?<\/section>/);
  writeF(cp(d), s.replace('</main>', m[0] + '</main>'));
}, 'capabilities: section count');
// 3. Reorder sections.
negative('N3 (reorder sections)', function (d) {
  let s = readF(cp(d)); const m = s.match(/<section\b[\s\S]*?<\/section>/);
  s = s.replace(m[0], '').replace('</main>', m[0] + '</main>'); writeF(cp(d), s);
}, 'capabilities: <main> SHA-256');
// 4. Remove a heading.
negative('N4 (remove a heading)', function (d) {
  writeF(cp(d), readF(cp(d)).replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/, ''));
}, 'capabilities: heading order');
// 5. Duplicate an ID.
negative('N5 (duplicate an id)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('id="models"', 'id="models"></span><span id="models"'));
}, 'capabilities: no duplicate IDs');
// 6. Break an anchor.
negative('N6 (break an anchor)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('</main>', '<a href="#nope-xyz">x</a></main>'));
}, 'resolves to an existing id');
// 7. Remove a data-i18n.
negative('N7 (remove a data-i18n)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  const m2 = main.match(/ data-i18n="[^"]+"/);
  writeF(cp(d), s.replace(main, main.replace(m2[0], '')));
}, 'capabilities: data-i18n key set');
// 8. Introduce a foreign-namespace key.
negative('N8 (foreign namespace key)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('</main>', '<span data-i18n="pvTitle">x</span></main>'));
}, 'capabilities: data-i18n key set');
// 9. Change canonical.
negative('N9 (change canonical)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('<link rel="canonical" href="https://plumline.online/capabilities.html">',
    '<link rel="canonical" href="https://plumline.online/capabilities-x.html">'));
}, 'capabilities: canonical');
// 10. Change metadata (an OG tag).
negative('N10 (change metadata / OG count)', function (d) {
  writeF(cp(d), readF(cp(d)).replace(/<meta property="og:image:width"[^>]*>/, ''));
}, 'capabilities: OG tag count');
// 11. Change JSON-LD.
negative('N11 (change JSON-LD)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('<script type="application/ld+json">', '<script type="application/ld+json"> '));
}, 'capabilities: JSON-LD matches golden');
// 12. Remove a capability node from the page (a shown capability disappears).
negative('N12 (remove a capability node)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  const newMain = main.replace(/ id="cap-run-local"/, ' id="cap-REMOVED"');
  writeF(cp(d), s.replace(main, newMain));
}, 'shown capability run-local appears once as cap-node');
// 13. Duplicate a capability node.
negative('N13 (duplicate a capability node)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  const m = main.match(/<div class="cap-check" id="cap-run-local">[\s\S]*?<\/div>/);
  writeF(cp(d), s.replace(main, main.replace(m[0], m[0] + m[0])));
}, 'appears once as cap-node');
// 14. Add an internal/hidden capability node into the page.
negative('N14 (hidden capability exposed as node)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace('</main>', '<div id="cap-sheet-sumif"></div></main>')));
}, 'does NOT appear as a cap-node');
// 15. Reorder capabilities (swap two cap-node ids in main).
negative('N15 (reorder capabilities / cap-node)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  let nm = main.replace('id="cap-verify-objective"', 'id="cap-__TMP__"')
               .replace('id="cap-verify-constraints"', 'id="cap-verify-objective"')
               .replace('id="cap-__TMP__"', 'id="cap-verify-constraints"');
  writeF(cp(d), s.replace(main, nm));
}, 'capabilities: <main> SHA-256');
// 16. Change a visible claim (body text of the page).
negative('N16 (change a visible claim)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace(/(<p data-i18n="capPageIntro">)[^<]*/, '$1CHANGED CLAIM')));
}, 'capabilities: <main> SHA-256');
// 17. Desync product-capabilities.js (flip a shown capability to hidden).
negative('N17 (desync product-capabilities.js)', function (d) {
  const s = readF(cd(d));
  // Make run-local hidden: set its public:true -> public:false in its block.
  const block = s.match(/\{[^}]*id: 'run-local'[^}]*\}/)[0];
  writeF(cd(d), s.replace(block, block.replace('public: true', 'public: false')));
}, 'shown-capability count matches golden');
// 18. Remove a media.json entry (a slot the page uses).
negative('N18 (remove a media.json slot)', function (d) {
  const j = JSON.parse(readF(md(d)));
  delete j.slots['hero-model'];
  writeF(md(d), JSON.stringify(j, null, 2));
}, 'every page image src is a media.json slot file');
// 19. Change an image src in the page.
negative('N19 (change an image src)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace('01-production-model-and-variable-settings.png', '01-renamed.png')));
}, 'capabilities: <main> SHA-256');
// 20. Remove an alt attribute.
negative('N20 (remove an alt)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace(/ alt="[^"]*"/, '')));
}, 'capabilities: <main> SHA-256');
// 21. Change an image width/height.
negative('N21 (change image width/height)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace('width="1600"', 'width="800"')));
}, 'capabilities: <main> SHA-256');
// 22. Change an image loading attribute.
negative('N22 (change image loading)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace('loading="lazy"', 'loading="eager"')));
}, 'capabilities: <main> SHA-256');
// 23. Remove cap-lightbox.js.
negative('N23 (remove cap-lightbox.js script)', function (d) {
  writeF(cp(d), readF(cp(d)).replace(/<script src="assets\/cap-lightbox\.js\?v=1"[^>]*><\/script>\s*/, ''));
}, 'loads cap-lightbox.js at the golden version');
// 24. Change cap-lightbox.js version.
negative('N24 (change cap-lightbox.js version)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('cap-lightbox.js?v=1', 'cap-lightbox.js?v=2'));
}, 'loads cap-lightbox.js at the golden version');
// 25. Remove a lightbox hook (cap-figure-link).
negative('N25 (remove a lightbox hook)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace('class="cap-figure-link"', 'class="cap-figure-plain"')));
}, 'lightbox figure-link hooks match golden');
// 26. Remove an ARIA attribute (lightbox open aria hook).
negative('N26 (remove a lightbox ARIA hook)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace('data-i18n-aria="capOpenFullImage"', 'data-x="y"')));
}, 'lightbox open-aria hooks match golden');
// 27. Change the page-specific footer marker.
negative('N27 (change the learnCapabilities footer marker)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('PLUMLINE:FOOTER learnCapabilities="true"', 'PLUMLINE:FOOTER learnCapabilities="false"'));
}, 'learnCapabilities footer marker');
// 28-32. Generator-side: missing/duplicate/reordered marker, unknown data key,
//        traversal — driven through the REAL generator (exit != 0).
generatorNegative('N28 (template missing a marker)', function (d) {
  writeF(tmpl(d), readF(tmpl(d)).replace('<!-- CAPABILITIES_CONTENT -->', ''));
});
generatorNegative('N29 (template duplicate marker)', function (d) {
  writeF(tmpl(d), readF(tmpl(d)).replace('<!-- CAPABILITIES_CONTENT -->', '<!-- CAPABILITIES_CONTENT --><!-- CAPABILITIES_CONTENT -->'));
});
generatorNegative('N30 (required capability id renamed in inventory)', function (d) {
  writeF(cd(d), readF(cd(d)).replace("id: 'model-continuous'", "id: 'model-renamed-xyz'"));
});
generatorNegative('N31 (unknown media file / data key)', function (d) {
  writeF(md(d), readF(md(d)).replace('01-production-model-and-variable-settings.png', 'unknown-nonexistent.png'));
});
generatorNegative('N32 (media slot file traversal)', function (d) {
  writeF(md(d), readF(md(d)).replace('"basePath": "assets/capabilities/"', '"basePath": "../../etc/"'));
});
// 33. Leave a residual inner placeholder in the output.
negative('N33 (residual inner placeholder in output)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('<!-- CAPABILITIES_HEAD_START -->', '<!-- CAPABILITIES_HEAD_START --><!-- CAPABILITIES_HEAD -->'));
}, 'inner CAPABILITIES_HEAD placeholder is filled');
// 34. Add fetch of a section.
negative('N34 (fetch content)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('</body>', "<script>fetch('cap-section.html')</script></body>"));
}, 'capabilities: does not fetch content');
// 35. Build main via innerHTML.
negative('N35 (innerHTML main)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('</body>', "<script>document.querySelector('main').innerHTML='x'</script></body>"));
}, 'does not build main via innerHTML');
// 36. Add an engine reference.
negative('N36 (engine reference)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('</body>', '<script>/* ENGINE_START */ solveModel_()</script></body>'));
}, 'does not load the engine');
// 37. Add new Worker.
negative('N37 (new Worker)', function (d) {
  writeF(cp(d), readF(cp(d)).replace('</body>', "<script>new Worker('w.js')</script></body>"));
}, 'does not create a Worker');
// 38. Add grid/charts/exports markup.
negative('N38 (grid/charts/exports markup)', function (d) {
  const s = readF(cp(d)); const main = mainOf(s);
  writeF(cp(d), s.replace(main, main.replace('</main>', '<div id="grid"></div></main>')));
}, 'does not carry grid/results/charts/exports markup');
// 39. Publish a capabilities source partial.
negative('N39 (capabilities source partial appears)', function (d) {
  fs.mkdirSync(path.join(d, 'src', 'pages', 'capabilities'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'pages', 'capabilities', 'part.html'), '<section></section>');
}, 'no capabilities source partial directory');

// 40. Run the checker from a temp ROOT whose path contains a space.
{
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline cap space-'));
  try {
    makeTree(spaced);
    const clean = checkCapabilitiesPage(spaced);
    ok('N40 (spaced path): clean spaced-path tree passes the checker', clean.fail === 0, 'fail=' + clean.fail);
    const s = readF(cp(spaced)); const main = mainOf(s);
    writeF(cp(spaced), s.replace(main, main.replace(/ id="cap-run-local"/, ' id="cap-REMOVED"')));
    const after = checkCapabilitiesPage(spaced);
    ok('N40 (spaced path): mutation trips the checker from a spaced path', after.fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
}

console.log('CAPABILITIES PAGE NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
