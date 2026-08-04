/* tests_home_page_negative.js — Checkpoint C5 negative tests for index.html.
 *
 * Each case builds a temp tree, applies ONE real mutation, runs the SAME official
 * checkHomePage() (or, for generator-marker/data cases, the REAL generator), asserts
 * a specific failure, and cleans up in finally. No reimplementation of the checker.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { checkHomePage } = require('./tests_home_page.js');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms'];

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

function makeTree(rootDir) {
  const dir = rootDir || fs.mkdtempSync(path.join(os.tmpdir(), 'plumline-home-'));
  fs.mkdirSync(path.join(dir, 'engine', 'fixtures', 'pages-golden'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  PAGES.forEach(function (p) { fs.copyFileSync(path.join(siteDir, p + '.html'), path.join(dir, p + '.html')); });
  ['product-capabilities.js', 'examples-data.js', 'i18n.js'].forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'assets', f), path.join(dir, 'assets', f));
  });
  ['home-faq.json', 'claims.json', 'media.json'].forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'data', f), path.join(dir, 'data', f));
  });
  ['gen_home_capabilities.js', 'gen_home_faq.js', 'gen_jsonld.js', 'gen_claims.js'].forEach(function (f) {
    fs.copyFileSync(path.join(siteDir, 'engine', f), path.join(dir, 'engine', f));
  });
  fs.copyFileSync(path.join(siteDir, 'engine', 'fixtures', 'pages-golden', 'home-page.json'),
    path.join(dir, 'engine', 'fixtures', 'pages-golden', 'home-page.json'));
  return dir;
}
function readF(f) { return fs.readFileSync(f, 'utf8'); }
function writeF(f, s) { fs.writeFileSync(f, s); }
function ix(dir) { return path.join(dir, 'index.html'); }
function cd(dir) { return path.join(dir, 'assets', 'product-capabilities.js'); }
function fq(dir) { return path.join(dir, 'data', 'home-faq.json'); }
function mainOf(s) { return s.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0]; }
function headOf(s) { return s.match(/<head\b[^>]*>[\s\S]*?<\/head>/)[0]; }

function negative(label, mutate, mentions) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree passes the official checker', checkHomePage(dir).fail === 0);
    mutate(dir);
    const after = checkHomePage(dir);
    ok(label + ': mutation trips the checker (fail > 0)', after.fail > 0);
    ok(label + ': a failure message identifies the mutation',
      after.failures.some(function (m) { return m.indexOf(mentions) !== -1; }),
      'failures=' + after.failures.slice(0, 6).join('; '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function genExit(dir, gen) {
  try { execFileSync(process.execPath, [path.join(dir, 'engine', gen)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }); return 0; }
  catch (e) { return e.status || 1; }
}
function generatorNegative(label, gen, mutate) {
  const dir = makeTree();
  try {
    ok(label + ': clean tree, generator --check green', (function () {
      try { execFileSync(process.execPath, [path.join(dir, 'engine', gen), '--check'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }); return true; }
      catch (e) { return false; }
    })());
    mutate(dir);
    ok(label + ': the generator fails after the mutation (exit != 0)', genExit(dir, gen) !== 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// 1. Remove a section.
negative('N1 (remove a section)', function (d) {
  writeF(ix(d), readF(ix(d)).replace(/<section\b[\s\S]*?<\/section>/, ''));
}, 'home: <main> SHA-256');
// 2. Duplicate a section.
negative('N2 (duplicate a section)', function (d) {
  const s = readF(ix(d)); const m = s.match(/<section\b[\s\S]*?<\/section>/);
  writeF(ix(d), s.replace('</main>', m[0] + '</main>'));
}, 'home: section count');
// 3. Reorder two sections.
negative('N3 (reorder sections)', function (d) {
  let s = readF(ix(d)); const m = s.match(/<section\b[\s\S]*?<\/section>/);
  s = s.replace(m[0], '').replace('</main>', m[0] + '</main>'); writeF(ix(d), s);
}, 'home: <main> SHA-256');
// 4. Remove a heading.
negative('N4 (remove a heading)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/, '')));
}, 'home: heading order');
// 5. Change a heading level.
negative('N5 (change a heading level)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace(/<h2\b/, '<h3').replace(/<\/h2>/, '</h3>')));
}, 'home: <main> SHA-256');
// 6. Duplicate an id.
negative('N6 (duplicate an id)', function (d) {
  writeF(ix(d), readF(ix(d)).replace('id="how"', 'id="how"></span><span id="how"'));
}, 'home: no duplicate IDs');
// 7. Break an anchor.
negative('N7 (break an anchor)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('</main>', '<a href="#nope-xyz">x</a></main>')));
}, 'resolves to an existing id');
// 8. Change a CTA (a main link).
negative('N8 (change a CTA target)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('href="solver.html"', 'href="solver-x.html"')));
}, 'home: <main> SHA-256');
// 9. Change a link.
negative('N9 (change a link)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('href="capabilities.html"', 'href="capabilities-x.html"')));
}, 'home: <main> SHA-256');
// 10. Remove a data-i18n.
negative('N10 (remove a data-i18n)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  const m2 = main.match(/ data-i18n="[^"]+"/);
  writeF(ix(d), s.replace(main, main.replace(m2[0], '')));
}, 'home: data-i18n key set');
// 11. Foreign-namespace key.
negative('N11 (foreign namespace key)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('</main>', '<span data-i18n="pvTitle">x</span></main>')));
}, 'home: data-i18n key set');
// 12. Remove ARIA.
negative('N12 (remove an ARIA attribute)', function (d) {
  const s = readF(ix(d));
  writeF(ix(d), s.replace(/ aria-[a-z]+="[^"]*"/, ''));
}, 'home: ARIA attribute count');
// 13. Change canonical.
negative('N13 (change canonical)', function (d) {
  writeF(ix(d), readF(ix(d)).replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="https://plumline.online/x.html">'));
}, 'home: canonical');
// 14. Change metadata (og count).
negative('N14 (change metadata / OG count)', function (d) {
  writeF(ix(d), readF(ix(d)).replace(/<meta property="og:type"[^>]*>/, ''));
}, 'home: OG tag count');
// 15. Change Open Graph value (head hash).
negative('N15 (change an OG value)', function (d) {
  const s = readF(ix(d)); const head = headOf(s);
  writeF(ix(d), s.replace(head, head.replace(/(<meta property="og:title" content=")[^"]*/, '$1CHANGED')));
}, 'home: <head> SHA-256');
// 16. Change the main JSON-LD.
negative('N16 (change the SoftwareApplication JSON-LD)', function (d) {
  const s = readF(ix(d));
  const block = s.match(/<!-- HOME_SOFTWARE_JSONLD_START -->[\s\S]*?<!-- HOME_SOFTWARE_JSONLD_END -->/)[0];
  writeF(ix(d), s.replace(block, block.replace('"@type":"SoftwareApplication"', '"@type":"WebSite"')));
}, 'home: both JSON-LD blocks match golden');
// 17. Change the FAQ JSON-LD.
negative('N17 (change the FAQ JSON-LD)', function (d) {
  const s = readF(ix(d));
  const block = s.match(/<!-- HOME_FAQ_JSONLD_START -->[\s\S]*?<!-- HOME_FAQ_JSONLD_END -->/)[0];
  writeF(ix(d), s.replace(block, block.replace('"@type":"Question"', '"@type":"Answer"')));
}, 'home: both JSON-LD blocks match golden');
// 18. Remove a FAQ (from the data source).
negative('N18 (remove a FAQ from data)', function (d) {
  const j = JSON.parse(readF(fq(d))); j.order.pop(); writeF(fq(d), JSON.stringify(j, null, 2));
}, 'home: FAQ order matches golden');
// 19. Duplicate a FAQ.
negative('N19 (duplicate a FAQ)', function (d) {
  const j = JSON.parse(readF(fq(d))); j.order.push(j.order[0]); writeF(fq(d), JSON.stringify(j, null, 2));
}, 'home: FAQ order matches golden');
// 20. Reorder FAQ.
negative('N20 (reorder FAQ)', function (d) {
  const j = JSON.parse(readF(fq(d))); const t = j.order[0]; j.order[0] = j.order[1]; j.order[1] = t;
  writeF(fq(d), JSON.stringify(j, null, 2));
}, 'home: FAQ order matches golden');
// 21. Desync a visible FAQ answer (remove a question key from the accordion).
negative('N21 (desync FAQ accordion)', function (d) {
  const s = readF(ix(d)); const j = JSON.parse(readF(fq(d)));
  const firstQ = j.order[0].q;
  const faqRegion = s.match(/<!-- HOME_FAQ_START -->[\s\S]*?<!-- HOME_FAQ_END -->/)[0];
  writeF(ix(d), s.replace(faqRegion, faqRegion.replace('data-i18n="' + firstQ + '"', 'data-i18n="faqRemoved"')));
}, 'appears once in the visible accordion');
// 22. Add an internal/unpublished FAQ to data (a key with no i18n) -> generator side.
generatorNegative('N22 (unpublished FAQ data)', 'gen_home_faq.js', function (d) {
  const j = JSON.parse(readF(fq(d))); j.order.push({ q: 'faqInternalUnpublished', a: 'faqInternalUnpublishedA' });
  writeF(fq(d), JSON.stringify(j, null, 2));
});
// 23. Remove a capability from the Home region (breaks main hash).
negative('N23 (remove a capability from Home)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  const region = main.match(/<!-- HOME_CAPABILITIES_START -->[\s\S]*?<!-- HOME_CAPABILITIES_END -->/)[0];
  writeF(ix(d), s.replace(main, main.replace(region, region.replace(/<li>[\s\S]*?<\/li>/, ''))));
}, 'home: <main> SHA-256');
// 24. Duplicate a capability in the Home region.
negative('N24 (duplicate a capability in Home)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  const region = main.match(/<!-- HOME_CAPABILITIES_START -->[\s\S]*?<!-- HOME_CAPABILITIES_END -->/)[0];
  const li = region.match(/<li>[\s\S]*?<\/li>/)[0];
  writeF(ix(d), s.replace(main, main.replace(region, region.replace(li, li + li))));
}, 'home: <main> SHA-256');
// 25. Expose a hidden/pending capability key in the Home region.
negative('N25 (expose a hidden capability)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('<!-- HOME_CAPABILITIES_END -->', '<li data-i18n="capSheetSumifName">x</li><!-- HOME_CAPABILITIES_END -->')));
}, 'home: <main> SHA-256');
// 26. Reorder capabilities in the Home region.
negative('N26 (reorder capabilities)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  const region = main.match(/<!-- HOME_CAPABILITIES_START -->[\s\S]*?<!-- HOME_CAPABILITIES_END -->/)[0];
  const lis = region.match(/<li>[\s\S]*?<\/li>/g);
  if (lis && lis.length >= 2) {
    let nr = region.replace(lis[0], '__A__').replace(lis[1], lis[0]).replace('__A__', lis[1]);
    writeF(ix(d), s.replace(main, main.replace(region, nr)));
  }
}, 'home: <main> SHA-256');
// 27. Change a claim (visible copy in main).
negative('N27 (change a visible claim)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace(/(<h1[^>]*>)[^<]*/, '$1CHANGED CLAIM')));
}, 'home: <main> SHA-256');
// 28. Desync product-capabilities.js -> gen_home_capabilities side.
generatorNegative('N28 (desync product-capabilities.js)', 'gen_home_capabilities.js', function (d) {
  writeF(cd(d), readF(cd(d)).replace("nameKey: 'capModelContinuousName'", "nameKey: 'capRenamedKeyXYZ'"));
});
// 29. Remove an image.
negative('N29 (remove an image)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace(/<picture>[\s\S]*?<\/picture>/, '')));
}, 'home: picture count');
// 30. Change src/srcset.
negative('N30 (change an image srcset)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('verified-result-production.webp', 'verified-x.webp')));
}, 'home: every picture/source/img matches golden');
// 31. Remove alt.
negative('N31 (remove an alt)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace(/ alt="[^"]*"/, '')));
}, 'home: <main> SHA-256');
// 32. Change width/height.
negative('N32 (change image width/height)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('width="1200"', 'width="640"')));
}, 'home: <main> SHA-256');
// 33. Change loading (the verify image now carries loading="lazy").
negative('N33 (change image loading)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('loading="lazy"', 'loading="eager"')));
}, 'home: <main> SHA-256');
// 34. Change the demo objective value (pinned historical authority 1,760).
negative('N34 (change the pinned demo objective)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('<b>1,760</b>', '<b>9,999</b>')));
}, 'home: <main> SHA-256');
// 35. Remove a mobile/desktop <source>.
negative('N35 (remove a picture source)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace(/<source\b[^>]*>/, '')));
}, 'home: every picture/source/img matches golden');
// 36. Change the hero CTA.
negative('N36 (change the hero CTA)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  // The hero is the first section; change the first solver.html CTA.
  writeF(ix(d), s.replace(main, main.replace('href="solver.html"', 'href="#')));
}, 'home: <main> SHA-256');
// 37. Change the contact link.
negative('N37 (change contact mailto)', function (d) {
  writeF(ix(d), readF(ix(d)).replace('mailto:contact@plumline.online', 'mailto:other@plumline.online'));
}, 'home: contact mailto');
// 38. Introduce a personal Gmail.
negative('N38 (introduce a personal Gmail)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('</main>', '<a href="mailto:someone@gmail.com">x</a></main>')));
}, 'home: no personal Gmail');
// 39. Change the add-on published state (introduce a waitlist).
negative('N39 (introduce an add-on waitlist)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('</main>', '<div>Join the waitlist</div></main>')));
}, 'home: no unauthorized waitlist');
// 40. Remove a script.
negative('N40 (remove a script)', function (d) {
  writeF(ix(d), readF(ix(d)).replace(/<script src="assets\/build-badge\.js\?v=2"[^>]*><\/script>\s*/, ''));
}, 'home: script src set');
// 41. Change an asset version.
negative('N41 (change an asset version)', function (d) {
  writeF(ix(d), readF(ix(d)).replace('plumline.css?v=21', 'plumline.css?v=999'));
}, 'home: asset versions');
// 42-45. Generator marker cases: missing / duplicated / inverted (overlapping).
generatorNegative('N42 (marker missing)', 'gen_home_capabilities.js', function (d) {
  writeF(ix(d), readF(ix(d)).replace('<!-- HOME_CAPABILITIES_START -->', ''));
});
generatorNegative('N43 (marker duplicated)', 'gen_home_capabilities.js', function (d) {
  writeF(ix(d), readF(ix(d)).replace('<!-- HOME_CAPABILITIES_START -->', '<!-- HOME_CAPABILITIES_START --><!-- HOME_CAPABILITIES_START -->'));
});
generatorNegative('N44 (markers inverted)', 'gen_home_capabilities.js', function (d) {
  let s = readF(ix(d));
  s = s.replace('<!-- HOME_CAPABILITIES_START -->', '__T__').replace('<!-- HOME_CAPABILITIES_END -->', '<!-- HOME_CAPABILITIES_START -->').replace('__T__', '<!-- HOME_CAPABILITIES_END -->');
  writeF(ix(d), s);
});
generatorNegative('N45 (regions overlap via duplicated END)', 'gen_home_faq.js', function (d) {
  writeF(ix(d), readF(ix(d)).replace('<!-- HOME_FAQ_END -->', '<!-- HOME_FAQ_END --><!-- HOME_FAQ_END -->'));
});
// 46. Unknown data (a capability id renamed so gen_jsonld cannot resolve a name).
generatorNegative('N46 (unknown data key)', 'gen_jsonld.js', function (d) {
  writeF(cd(d), readF(cd(d)).replace(/nameKey: '(cap[A-Za-z]+)'/, "nameKey: 'capUNKNOWNXYZ'"));
});
// 47. Path traversal via a data path is not accepted (FAQ data made a traversal string).
generatorNegative('N47 (FAQ data with a bad/incomplete entry)', 'gen_home_faq.js', function (d) {
  const j = JSON.parse(readF(fq(d))); j.order.push({ q: '../../etc/passwd', a: '../../etc/passwd' });
  writeF(fq(d), JSON.stringify(j, null, 2));
});
// 48. Residual placeholder left in the page.
negative('N48 (residual inner placeholder)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('<!-- HOME_CAPABILITIES_START -->', '<!-- HOME_CAPABILITIES_START --><!-- HOME_CAPABILITIES -->')));
}, 'no unfilled inner region placeholder ships');
// 49. Add fetch of a section.
negative('N49 (fetch content)', function (d) {
  writeF(ix(d), readF(ix(d)).replace('</body>', "<script>fetch('home-section.html')</script></body>"));
}, 'home: does not fetch content');
// 50. Build main via innerHTML.
negative('N50 (innerHTML main)', function (d) {
  writeF(ix(d), readF(ix(d)).replace('</body>', "<script>document.querySelector('main').innerHTML='x'</script></body>"));
}, 'does not build main via innerHTML');
// 51. Add an engine reference.
negative('N51 (engine reference)', function (d) {
  writeF(ix(d), readF(ix(d)).replace('</body>', '<script>/* ENGINE_START */ solveModel_()</script></body>'));
}, 'does not load the engine');
// 52. Add new Worker.
negative('N52 (new Worker)', function (d) {
  writeF(ix(d), readF(ix(d)).replace('</body>', "<script>new Worker('w.js')</script></body>"));
}, 'does not create a Worker');
// 53. Add grid/charts/exports markup.
negative('N53 (grid/charts/exports markup)', function (d) {
  const s = readF(ix(d)); const main = mainOf(s);
  writeF(ix(d), s.replace(main, main.replace('</main>', '<div id="grid"></div></main>')));
}, 'does not carry grid/results/charts/exports markup');
// 54. Publish an internal source in dist tree.
negative('N54 (home source partial appears)', function (d) {
  fs.mkdirSync(path.join(d, 'src', 'pages', 'home'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'pages', 'home', 'part.html'), '<section></section>');
}, 'no home source partial directory');
// 55. Run the checker from a temp ROOT whose path contains a space.
{
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'plumline home space-'));
  try {
    makeTree(spaced);
    ok('N55 (spaced path): clean spaced-path tree passes', checkHomePage(spaced).fail === 0, 'fail=' + checkHomePage(spaced).fail);
    const s = readF(ix(spaced)); const main = mainOf(s);
    writeF(ix(spaced), s.replace(main, main.replace(/<section\b[\s\S]*?<\/section>/, '')));
    ok('N55 (spaced path): mutation trips the checker from a spaced path', checkHomePage(spaced).fail > 0);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
}

console.log('HOME PAGE NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass: pass, fail: fail };
