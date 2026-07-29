/**
 * tests_structure.js — Phase 5.1 structural guarantees for every page:
 *   - no broken internal links or anchors
 *   - referenced local assets exist
 *   - IDs unique within a page (outside <script>)
 *   - exactly one <main>, <h1>, <header>, <footer> per page
 *   - the H1 sits inside <main>; the header sits outside it
 *   - consistent primary nav across the seven pages
 *
 * Run: node engine/tests_structure.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const PAGES = ['index.html', 'solver.html', 'guide.html', 'about.html',
               'privacy.html', 'terms.html', 'examples.html'];
const existing = new Set(PAGES);

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }
function stripScripts(s) { return s.replace(/<script[\s\S]*?<\/script>/g, ''); }
function idsOf(body) { return new Set([...body.matchAll(/id="([^"]+)"/g)].map(m => m[1])); }

const bodies = {}, ids = {};
PAGES.forEach(p => { const raw = fs.readFileSync(path.join(siteDir, p), 'utf8'); bodies[p] = stripScripts(raw); ids[p] = idsOf(bodies[p]); });

// Links and anchors.
PAGES.forEach(function (p) {
  const body = bodies[p];
  [...body.matchAll(/href="([^"#][^"]*)?(#[^"]*)?"/g)]; // no-op to keep regex engine warm
  for (const m of body.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|\/\/)/.test(href)) continue;
    const [pathPart, frag] = href.split('#');
    const clean = pathPart.split('?')[0];
    if (href.startsWith('#')) {
      ok(p + ' anchor ' + href + ' exists', ids[p].has(href.slice(1)));
    } else {
      if (clean && !existing.has(clean) && !/\.(png|css|js|xml|txt|json|svg|ico|webmanifest)$/.test(clean)) {
        ok(p + ' link to ' + clean + ' exists', false);
      }
      if (frag && existing.has(clean)) ok(p + ' ' + href + ' -> #' + frag + ' exists', ids[clean].has(frag));
    }
  }
});

// Referenced local assets exist on disk.
PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  for (const m of raw.matchAll(/(?:src|href)="([^"]+\.(?:css|js|png|svg|ico))(?:\?[^"]*)?"/g)) {
    const rel = m[1];
    if (/^(https?:|\/\/|data:)/.test(rel)) continue;
    ok(p + ' asset ' + rel + ' exists', fs.existsSync(path.join(siteDir, rel)));
  }
});

// Unique IDs (outside <script>).
PAGES.forEach(function (p) {
  const all = [...bodies[p].matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dups = all.filter((x, i) => all.indexOf(x) !== i);
  ok(p + ' has no duplicate IDs', dups.length === 0, dups.join(','));
});

// Exactly one main/h1/header/footer, H1 in main, header out of main.
PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  ['main', 'h1', 'header', 'footer'].forEach(function (tag) {
    const n = (raw.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
    ok(p + ' has exactly one <' + tag + '>', n === 1, 'found ' + n);
  });
  const m0 = raw.indexOf('<main'), m1 = raw.indexOf('</main>'), h1 = raw.indexOf('<h1'), hd = raw.indexOf('<header');
  ok(p + ' H1 is inside <main>', m0 >= 0 && m0 < h1 && h1 < m1);
  ok(p + ' header is outside <main>', hd >= 0 && hd < m0);
});

// Consistent primary nav, validated by a single reusable function so the SAME
// logic guards the real pages AND a set of deliberately-broken fixtures below
// (so the guard code itself is protected, not just the live HTML).
const PRIMARY = ['solver.html', 'index.html#addon', 'guide.html', 'examples.html', 'about.html'];
const CURRENT_OF = { 'solver.html': 'solver.html', 'guide.html': 'guide.html', 'examples.html': 'examples.html', 'about.html': 'about.html' };

// Returns an array of { name, cond, detail } checks for the given page body.
// `opts.onPage` = true means the page is expected to carry the "On this page"
// second landmark (solver only).
function validateNavigation(body, label, opts) {
  const R = [];
  const add = (name, cond, detail) => R.push({ name: label + ' ' + name, cond: !!cond, detail: detail });
  opts = opts || {};
  // Raw HTML (scripts intact) for checks that inspect inline <script>, e.g. the
  // js-class classifier in <head>. Falls back to body when not provided.
  const fullRaw = opts.fullRaw || body;

  const navs = [...body.matchAll(/<nav\b[^>]*aria-label="Primary"[^>]*>[\s\S]*?<\/nav>/g)].map(m => m[0]);
  add('has exactly one primary nav', navs.length === 1, 'found ' + navs.length);
  const nav = navs[0] || '';

  // The lazy match stops at the first </nav>; a nested <nav> both corrupts this
  // extraction and misrepresents the landmark tree. Forbid it outright.
  const innerNavs = (nav.replace(/^<nav\b[^>]*>/, '').match(/<nav\b/g) || []).length;
  add('primary nav contains no nested nav', innerNavs === 0, innerNavs + ' nested');

  // The five core links appear in this exact order.
  const hrefs = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]).filter(h => PRIMARY.indexOf(h) >= 0);
  add('primary nav has the 5 core links in order', hrefs.join('|') === PRIMARY.join('|'), hrefs.join('|'));

  // The nav landmark name is translatable (data-i18n-aria), not hard-wired to
  // English, so a screen reader announces it in the active language.
  add('primary nav has data-i18n-aria', /<nav\b[^>]*data-i18n-aria="ariaPrimary"/.test(nav));

  // aria-current on the page's own link (and only there).
  const currentHrefs = [...nav.matchAll(/<a\b[^>]*aria-current="page"[^>]*href="([^"]+)"|<a\b[^>]*href="([^"]+)"[^>]*aria-current="page"/g)].map(m => m[1] || m[2]);
  if (opts.current) add('aria-current is on ' + opts.current, currentHrefs.length === 1 && currentHrefs[0] === opts.current, currentHrefs.join(','));
  else add('has no aria-current (no own slot)', currentHrefs.length === 0, currentHrefs.join(','));

  // Mobile consistency: locate anchors by their expected href (not data-i18n),
  // so dropping both data-i18n and hide-sm can't slip a link past the check.
  const anchors = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)];
  const coreLinks = PRIMARY.map(href => anchors.find(m => m[1] === href));
  const allHideSm = coreLinks.length === PRIMARY.length && coreLinks.every(m => m && /class="[^"]*\bhide-sm\b/.test(m[0]));
  add('all core nav links carry hide-sm (consistent mobile nav)', allHideSm);

  // A mobile menu toggle exists (with proper button semantics) so the hidden
  // links remain reachable below the breakpoint without scrolling to the footer.
  add('has a menu-toggle button', /<button\b[^>]*class="[^"]*\bmenu-toggle\b/.test(body));
  add('menu-toggle controls mobile-menu', /<button\b[^>]*class="[^"]*\bmenu-toggle\b[^>]*aria-controls="mobile-menu"|<button\b[^>]*aria-controls="mobile-menu"[^>]*class="[^"]*\bmenu-toggle\b/.test(body));

  // Progressive enhancement: the nav collapses into the drawer only once
  // nav-menu.js has built and wired it (it then adds .nav-menu-ready). The CSS
  // that hides the core links must be gated on that class — so if the script
  // fails to load or throws, the links stay visible (no dead Menu button).
  // Solver carries its own inline CSS; verify its hiding rule is gated and no
  // ungated hide-sm:none slips through. (plumline.css is checked once below.)
  if (opts.inlineNavCss) {
    const hideRules = (fullRaw.match(/[^{}\n]*a\.hide-sm\s*\{\s*display:\s*none/g) || []);
    add('inline mobile nav hiding is gated on nav-menu-ready',
        hideRules.length > 0 && hideRules.every(r => /\.nav-menu-ready/.test(r)),
        hideRules.length + ' hide rules');
  }

  // Language switch carries a translatable accessible name.
  add('language select has data-i18n-aria', /<select\b[^>]*data-i18n-aria="ariaLanguage"/.test(body));

  // Second landmark: "On this page" (solver only). It must be exactly one
  // region, hold ONLY #how (exact href), and be a SIBLING of Primary.
  const onPage = [...body.matchAll(/<nav\b[^>]*aria-label="On this page"[^>]*>[\s\S]*?<\/nav>/g)].map(m => m[0]);
  if (opts.onPage) {
    add('has exactly one On this page nav', onPage.length === 1, 'found ' + onPage.length);
    const opHrefs = [...(onPage[0] || '').matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]);
    add('On this page nav holds only #how', opHrefs.length === 1 && opHrefs[0] === '#how', opHrefs.join(','));
    add('On this page nav has data-i18n-aria', /data-i18n-aria="ariaOnPage"/.test(onPage[0] || ''));
    add('On this page nav is outside Primary', !/aria-label="On this page"/.test(nav));
  } else {
    add('has no On this page nav', onPage.length === 0, 'found ' + onPage.length);
  }
  return R;
}

PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  const body = stripScripts(raw);
  validateNavigation(body, p, { current: CURRENT_OF[p], onPage: p === 'solver.html', fullRaw: raw, inlineNavCss: p === 'solver.html' })
    .forEach(r => ok(r.name, r.cond, r.detail));
});

// One-time: the shared stylesheet must gate its mobile nav hiding on
// .nav-menu-ready too, so the six non-solver pages degrade gracefully if
// nav-menu.js fails. Check the file directly.
(function () {
  const css = fs.readFileSync(path.join(siteDir, 'assets', 'plumline.css'), 'utf8');
  const hideRules = (css.match(/[^{}\n]*a\.hide-sm\s*\{\s*display:\s*none/g) || []);
  ok('plumline.css gates mobile nav hiding on nav-menu-ready',
     hideRules.length > 0 && hideRules.every(r => /\.nav-menu-ready/.test(r)),
     hideRules.length + ' hide rules');
})();

// One-time: the solver's solve result must be announced through a DEDICATED,
// concise live region (#solveAnnounce), NOT by making the whole verbose
// receipt (#result) a live region — otherwise a screen reader reads the entire
// receipt aloud on every solve. Guard the structure that keeps announcements
// short: #solveAnnounce is a live region, sits OUTSIDE #result (so innerHTML
// rewrites don't wipe it), and #result itself is not a live region.
(function () {
  const s = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
  const resultTag = (s.match(/<div class="result" id="result"[^>]*>/) || [''])[0];
  ok('solver #result is not itself a live region', !/aria-live/.test(resultTag), resultTag);
  const ann = (s.match(/<[a-z]+ [^>]*id="solveAnnounce"[^>]*>/) || [''])[0];
  ok('solver has a #solveAnnounce live region', /aria-live="polite"/.test(ann) && /role="status"/.test(ann), ann);
  ok('solver #solveAnnounce is visually hidden', /class="sr-only"/.test(ann));
  const iAnn = s.indexOf('id="solveAnnounce"'), iRes = s.indexOf('id="result"');
  ok('solver #solveAnnounce is outside #result (before it)', iAnn >= 0 && iRes >= 0 && iAnn < iRes);
})();

// One-time: both stylesheets must honour prefers-reduced-motion, and the rule
// must neutralise ANIMATIONS (the solve spinner) too, not only transitions —
// otherwise a reduced-motion user still gets a spinning indicator.
(function () {
  const solver = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
  const css = fs.readFileSync(path.join(siteDir, 'assets', 'plumline.css'), 'utf8');
  function reducesMotion(src, label) {
    const block = (src.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/) || [''])[0];
    ok(label + ' has a prefers-reduced-motion block', block.length > 0);
    ok(label + ' reduced-motion neutralises animation', /animation-duration\s*:\s*\.?0/.test(block), block.slice(0, 80));
    ok(label + ' reduced-motion neutralises transition', /transition-duration\s*:\s*\.?0/.test(block));
  }
  reducesMotion(solver, 'solver.html');
  reducesMotion(css, 'plumline.css');

  // Protect the JS side too: the solver must route programmatic scrolling
  // through scrollBehavior() (which consults prefers-reduced-motion), and no
  // scrollIntoView call may hardcode behavior:'smooth'. Strip comments first so
  // an example in a comment can't trip the last check.
  const codeNoComments = solver.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('solver defines scrollBehavior()', /function scrollBehavior\s*\(/.test(solver));
  const helper = (solver.match(/function scrollBehavior\s*\([\s\S]*?\n  \}/) || [''])[0];
  ok('scrollBehavior() checks reduced motion', /prefers-reduced-motion:\s*reduce/.test(helper));
  ok('no scrollIntoView hardcodes behavior:smooth',
     !/scrollIntoView\s*\(\s*\{[^}]*behavior\s*:\s*['"]smooth['"]/.test(codeNoComments));
})();

// There must be exactly ONE production solver.html — the top-level file. A copy
// under engine/ (a stale review snapshot from an earlier delivery) would carry
// the OLD engine and confuse anyone auditing the tree. `tar -xzf` never deletes
// files, so such a copy can survive an update; this guard fails if it exists,
// forcing its removal. The same applies to any other stray HTML under engine/.
(function () {
  const stale = path.join(siteDir, 'engine', 'solver.html');
  ok('no stale engine/solver.html (there is one solver.html, at the root)',
     !fs.existsSync(stale), 'delete engine/solver.html — it is an old snapshot');
  const engineHtml = fs.existsSync(path.join(siteDir, 'engine'))
    ? fs.readdirSync(path.join(siteDir, 'engine')).filter(f => /\.html$/.test(f)) : [];
  ok('no .html files under engine/ at all', engineHtml.length === 0, engineHtml.join(','));
})();

// The optimisation engine exists twice — engine/engine.js (Node/tests) and the
// inline copy in solver.html between the ENGINE markers — and they must not
// drift. A full byte-diff is noisy (the Node build adds a module.exports
// wrapper), so we pin the invariants most likely to diverge silently and most
// dangerous if they do: the strict-inequality handling. Both copies must keep
// "<" and ">" OUT of RELATION_TOKENS, define STRICT_RELATION_TOKENS, and throw
// the STRICT_INEQUALITY marker.
(function () {
  const engineJs = fs.readFileSync(path.join(siteDir, 'engine', 'engine.js'), 'utf8');
  const solverSrc = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
  const a = solverSrc.indexOf('/* ENGINE_START */'), b = solverSrc.indexOf('/* ENGINE_END */');
  const inline = a >= 0 && b > a ? solverSrc.slice(a, b) : '';
  ok('inline engine markers are present', !!inline, a + '/' + b);
  [['engine.js', engineJs], ['inline engine', inline]].forEach(function (pair) {
    const [name, src] = pair;
    // RELATION_TOKENS must NOT map "<" or ">" (no silent widening).
    const relBlock = (src.match(/const RELATION_TOKENS = \{[\s\S]*?\};/) || [''])[0];
    ok(name + ': RELATION_TOKENS does not include strict "<"', relBlock && !/'<':/.test(relBlock), relBlock.slice(0, 60));
    ok(name + ': RELATION_TOKENS does not include strict ">"', relBlock && !/'>':/.test(relBlock));
    ok(name + ': defines STRICT_RELATION_TOKENS', /STRICT_RELATION_TOKENS\s*=\s*\{\s*'<':\s*true,\s*'>':\s*true\s*\}/.test(src));
    ok(name + ': readConstraint_ throws STRICT_INEQUALITY', /throw new Error\('STRICT_INEQUALITY: '/.test(src));
    // matchesCriterion_ must recognise non-canonical numeric criteria in BOTH
    // the operator form (">20.0") and the bare-equality form ("20.0"), via the
    // shared parseCriterionOperand_ helper — not the old String(Number(x))
    // check that made "20.0" compare as text.
    ok(name + ': defines parseCriterionOperand_ with a numeric pattern',
       /function parseCriterionOperand_\([\s\S]*?numericPattern\s*=\s*\/\^\[\+-\]\?/.test(src) &&
       !/String\(numeric\)\s*===\s*operand/.test(src));
    ok(name + ': both criterion paths normalise via parseCriterionOperand_',
       (src.match(/parseCriterionOperand_\(/g) || []).length >= 3);
    // Single-variable detection fallback must be present in both engines and
    // must use the CORRECTED logic: a one-cell candidate needs objective AND
    // constraint evidence (classified per role via readConstraint_().guessed),
    // a weak objective-only block must not out-rank it (bestReach gate), and two
    // eligible cells must be refused as ambiguous. Pinning these strings catches
    // a divergence back to the bare cellReach>=2 count.
    ok(name + ': single-variable fallback uses per-role evidence',
       /eligibleSingles/.test(src) && /bestReach/.test(src) &&
       /readConstraint_\([^)]*\)\.guessed/.test(src) && /hasObjective && hasConstraint/.test(src));
    ok(name + ': single-variable fallback refuses ambiguous multiple cells',
       /Several separate cells look like decision variables/.test(src));
  });
})();

// --- Permanent self-tests: run validateNavigation against deliberately broken
// fixtures so the GUARD ITSELF is protected, not only the live HTML. A mutation
// the auditor could reintroduce must make at least one named check fail here.
const GOOD_NAV = [
  '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Site menu" data-i18n-aria="ariaMobileMenu">Menu</button>',
  '<nav class="nav" aria-label="Primary" data-i18n-aria="ariaPrimary">',
  '<a href="solver.html" class="hide-sm" aria-current="page" data-i18n="navSolver">Solver</a>',
  '<a href="index.html#addon" class="hide-sm" data-i18n="navAddon">Add-on</a>',
  '<a href="guide.html" class="hide-sm" data-i18n="navGuide">Guide</a>',
  '<a href="examples.html" class="hide-sm" data-i18n="navExamples">Examples</a>',
  '<a href="about.html" class="hide-sm" data-i18n="navAbout">About</a>',
  '</nav>',
  '<nav class="nav-onpage" aria-label="On this page" data-i18n-aria="ariaOnPage"><a href="#how" class="nav-context" data-i18n="navHow">How to use</a></nav>',
  '<select id="lang" aria-label="Language" data-i18n-aria="ariaLanguage"></select>'
].join('\n');
const GOOD_OPTS = { current: 'solver.html', onPage: true, fullRaw: GOOD_NAV };

function optsFor(fixture) { return { current: 'solver.html', onPage: true, fullRaw: fixture }; }
function failsOn(mutated, checkSubstring) {
  // True if validateNavigation reports a FAILING check whose name contains the
  // substring — i.e. the guard caught the regression.
  return validateNavigation(mutated, 'fixture', optsFor(mutated))
    .some(r => !r.cond && r.name.indexOf(checkSubstring) >= 0);
}
function passesClean(fixture) {
  return validateNavigation(fixture, 'fixture', optsFor(fixture)).every(r => r.cond);
}

// The clean fixture must pass every check (guards aren't vacuously failing).
ok('self-test: clean fixture passes all nav checks', passesClean(GOOD_NAV));

// 1. On this page nested INSIDE Primary → nesting + outside-Primary must fail.
const nested = GOOD_NAV
  .replace('</nav>\n<nav class="nav-onpage"', '<nav class="nav-onpage"')
  .replace('data-i18n="navHow">How to use</a></nav>', 'data-i18n="navHow">How to use</a></nav></nav>');
ok('self-test: nested On this page is caught (nesting)', failsOn(nested, 'contains no nested nav'));
ok('self-test: nested On this page is caught (outside Primary)', failsOn(nested, 'is outside Primary'));

// 2. A core link with neither data-i18n nor hide-sm → mobile check must fail.
const bareLink = GOOD_NAV.replace('<a href="guide.html" class="hide-sm" data-i18n="navGuide">Guide</a>',
                                  '<a href="guide.html">Guide</a>');
ok('self-test: core link without hide-sm/data-i18n is caught', failsOn(bareLink, 'carry hide-sm'));

// 3. On this page with two links → only-#how check must fail.
const twoLinks = GOOD_NAV.replace('data-i18n="navHow">How to use</a></nav>',
                                  'data-i18n="navHow">How to use</a><a href="#other">Other</a></nav>');
ok('self-test: On this page with a second link is caught', failsOn(twoLinks, 'holds only #how'));

// 4. Missing menu-toggle → mobile reachability check must fail.
const noToggle = GOOD_NAV.replace(/<button class="menu-toggle"[\s\S]*?<\/button>\n/, '');
ok('self-test: missing menu-toggle is caught', failsOn(noToggle, 'has a menu-toggle button'));

// 5. Hard-wired (non-translatable) landmark name → i18n-aria check must fail.
const noAria = GOOD_NAV.replace(' data-i18n-aria="ariaPrimary"', '');
ok('self-test: non-translatable Primary label is caught', failsOn(noAria, 'has data-i18n-aria'));


// Exactly one canonical per page, pointing to the right URL.
const CANONICALS = {
  'index.html': 'https://plumline.online/',
  'solver.html': 'https://plumline.online/solver.html',
  'guide.html': 'https://plumline.online/guide.html',
  'examples.html': 'https://plumline.online/examples.html',
  'about.html': 'https://plumline.online/about.html',
  'privacy.html': 'https://plumline.online/privacy.html',
  'terms.html': 'https://plumline.online/terms.html'
};
PAGES.forEach(function (p) {
  const raw = fs.readFileSync(path.join(siteDir, p), 'utf8');
  const canons = [...raw.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m => m[1]);
  ok(p + ' has exactly one canonical', canons.length === 1, 'found ' + canons.length);
  ok(p + ' canonical is ' + CANONICALS[p], canons[0] === CANONICALS[p], canons[0]);
});

console.log('STRUCTURE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
