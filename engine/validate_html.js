/* validate_html.js — structural HTML validation, for a target directory.
 *
 *   node engine/validate_html.js .        # validate the source pages
 *   node engine/validate_html.js dist     # validate the built pages (after build)
 *
 * jsdom is the structural validator (NOT replaced by regex). A small raw scan is
 * added as extra defence, but jsdom remains authoritative.
 *
 * Asserts (Lote E.1 protections, in BOTH source and dist):
 *   - exactly one <html>, <head>, <body>.
 *   - every <img> has exactly one alt attribute (alt="" allowed for decorative).
 *   - zero junk attributes (optimal / solution / proven) leaked from a broken quote.
 *   - the <img> tag is structurally clean (no stray attribute fragments).
 *   - Home's two image alts equal DICT.en.home.heroShotAlt / verifyShotAlt exactly.
 *
 * Exit non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const targetArg = process.argv[2] || '.';
const targetDir = path.resolve(root, targetArg);
const label = path.relative(root, targetDir) || '.';

const PAGES = ['index', 'solver', 'guide', 'examples', 'capabilities', 'about', 'privacy', 'terms']
  .map(p => p + '.html');

let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('jsdom required under CI'); process.exit(1); }
  console.log('validate_html (' + label + '): skipped (jsdom not installed locally)'); process.exit(0);
}

// Load DICT.en.home from the SOURCE i18n.js (the dictionary is the source of
// truth for the approved alt text, regardless of which dir we validate).
let DICT = null;
try {
  const g = {};
  new Function('window', 'navigator', 'location', 'document', 'globalThis',
    fs.readFileSync(path.join(root, 'assets', 'i18n.js'), 'utf8'))
    .call(g, g, { language: 'en', languages: ['en'] }, { search: '', pathname: '/' }, {}, g);
  DICT = g.Plumline.i18n.dict;
} catch (e) {
  console.log('  note: could not load DICT for alt comparison:', e.message);
}

let fail = 0;
function ok(name, cond, detail) { if (!cond) { fail++; console.log('  FAIL:', name, detail || ''); } }

for (const p of PAGES) {
  const file = path.join(targetDir, p);
  if (!fs.existsSync(file)) { ok(label + '/' + p + ' exists', false, 'file missing'); continue; }
  const html = fs.readFileSync(file, 'utf8');
  let doc;
  try { doc = new JSDOM(html).window.document; }
  catch (e) { ok(p + ' parses', false, e.message); continue; }

  // Structure: count on BOTH the raw HTML text and the jsdom document. jsdom can
  // insert or normalize html/head/body, so a jsdom-only "=== 1" check does not
  // prove the SOURCE has exactly one. Raw count is the structural proof; jsdom
  // count is the interpreted view. Require exactly one OPENING and one CLOSING
  // tag of each in the raw HTML, plus exactly one in the jsdom document.
  // Strip HTML comments first so a tag mentioned in a comment isn't miscounted.
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const openCount = (tag) => (htmlNoComments.match(new RegExp('<' + tag + '(?:\\s|>)', 'gi')) || []).length;
  const closeCount = (tag) => (htmlNoComments.match(new RegExp('</' + tag + '\\s*>', 'gi')) || []).length;
  for (const tag of ['html', 'head', 'body']) {
    ok(p + ': raw one opening <' + tag + '>', openCount(tag) === 1, 'raw open count=' + openCount(tag));
    ok(p + ': raw one closing </' + tag + '>', closeCount(tag) === 1, 'raw close count=' + closeCount(tag));
    ok(p + ': jsdom one <' + tag + '>', doc.querySelectorAll(tag).length === 1);
  }

  // RAW defence (runs on the file text, NOT jsdom's serialization). jsdom
  // silently "repairs" a broken-alt tail like  alt="x.">"Optimal...".">  by
  // closing the tag at the first '>' and turning the rest into text nodes, so a
  // jsdom-only check misses it. Scan the raw <img ...> tags for the tell-tale
  // pattern: a quote-close-then-reopen inside what should be a single tag.
  const rawImgTags = htmlNoComments.match(/<img\b[^>]*(?:"[^"]*"[^>]*)*>/g) || [];
  // Per raw <img> tag: count alt= occurrences (jsdom collapses duplicate alt to
  // one, so duplicates must be counted on the raw tag text).
  for (const tag of rawImgTags) {
    const rawAltCount = (tag.match(/(?:^|\s)alt=/g) || []).length;
    const shortId = (tag.match(/src="[^"]*\/([^"/]+)"/) || [, tag.slice(0, 24)])[1];
    ok(p + ': raw img has <=1 alt (' + shortId + ')', rawAltCount <= 1, 'raw alt count=' + rawAltCount);
  }
  // Also catch the specific malformed sequence across the raw text: an alt that
  // closes with .">" immediately followed by stray words then ".">.
  const brokenTail = /alt="[^"]*\.">"?(?:Optimal|Optimale|Solución|Solução|optimal|solution|proven)/i;
  ok(p + ': no broken-alt tail in raw HTML', !brokenTail.test(htmlNoComments),
     'malformed alt tail detected in source text');
  // Junk bare attributes optimal/solution/proven appearing as attribute names in
  // any raw img tag (defence beyond jsdom's attribute view).
  for (const tag of rawImgTags) {
    if (/\s(optimal|solution|proven)=/i.test(tag) || /">(Optimal|Solución|Solução)/i.test(tag)) {
      ok(p + ': raw img tag clean', false, tag.slice(0, 80));
      break;
    }
  }

  doc.querySelectorAll('img').forEach(img => {
    const serialized = img.outerHTML;
    const shortSrc = (img.getAttribute('src') || '').slice(-30);
    // Exactly one alt attribute. alt="" is allowed (decorative).
    const altCount = (serialized.match(/(?:^|\s)alt=/g) || []).length;
    ok(p + ': img has exactly one alt (' + shortSrc + ')', altCount === 1, altCount + ' alt=');
    ok(p + ': img exposes an alt attribute (' + shortSrc + ')', img.hasAttribute('alt'));
    // Zero junk attributes from a broken quote.
    const junk = Array.from(img.attributes).map(a => a.name).filter(n => /^(optimal|solution|proven)$/i.test(n));
    ok(p + ': img has no junk attrs (' + shortSrc + ')', junk.length === 0, junk.join(','));
    // Raw defence: the tag must not carry the tell-tale broken-alt tail.
    ok(p + ': img tag structurally clean (' + shortSrc + ')',
       !/\.">"/.test(serialized) && !/">Optimal/.test(serialized), 'broken alt tail present');
  });

  // Home: the verify-section image alt must equal the EN dictionary exactly.
  // (The hero image was replaced in F3a by a semantic HTML/CSS product demo.)
  if (p === 'index.html' && DICT && DICT.en && DICT.en.home) {
    const byKey = {};
    doc.querySelectorAll('img[data-i18n-alt]').forEach(img => {
      byKey[img.getAttribute('data-i18n-alt')] = img.getAttribute('alt');
    });
    // F3b replaced the verify-section screenshot with a semantic HTML/CSS flow.
    // The old image hooks must be gone.
    ok('home no longer carries a verifyShotAlt image',
       byKey.verifyShotAlt === undefined, 'verifyShotAlt present');
    // The old hero image must NOT come back.
    ok('home no longer carries a heroShotAlt image',
       byKey.heroShotAlt === undefined, 'heroShotAlt present');

    // ---- F3b verification flow contract (replaces the verify screenshot) ----
    const verifySec = doc.querySelector('section#verify');
    ok('home has exactly one #verify section', doc.querySelectorAll('section#verify').length === 1);
    const vflows = doc.querySelectorAll('section#verify figure.verify-flow');
    ok('home #verify has exactly one verify-flow figure', vflows.length === 1, vflows.length + ' flows');
    const vflow = vflows[0] || null;
    if (vflow) {
      // accessible name (figcaption or aria).
      const vcap = vflow.querySelector('figcaption');
      const vlab = vflow.getAttribute('aria-labelledby');
      ok('verify-flow has an accessible name',
         (vcap && (vcap.textContent || '').trim().length > 0) || (!!vlab && !!doc.getElementById(vlab)));
      // exactly four phases, in the approved order.
      const vkeys = Array.from(vflow.querySelectorAll('[data-i18n]'))
        .map(el => el.getAttribute('data-i18n')).filter(k => /^verFlow[1-4]H$/.test(k));
      ok('verify-flow has exactly four phases in order (verFlow1H..4H)',
         vkeys.length === 4 && vkeys[0] === 'verFlow1H' && vkeys[1] === 'verFlow2H' &&
         vkeys[2] === 'verFlow3H' && vkeys[3] === 'verFlow4H', vkeys.join(','));
      const vsteps = vflow.querySelectorAll('.verify-flow__step').length;
      ok('verify-flow renders four step blocks', vsteps === 4, vsteps + ' steps');
      // Representation of the required concepts (in the #verify section as a whole).
      const vsecHtml = verifySec.innerHTML;
      const need = {
        'decision cells': /decision cell/i.test(vsecHtml) || /verUnderstood|verFlow1/.test(vsecHtml),
        'objective': /objective/i.test(vsecHtml) || /verObjective/.test(vsecHtml),
        'constraints or limits': /constraint|limit/i.test(vsecHtml) || /verConstraints/.test(vsecHtml),
        'result': /result|allocation/i.test(vsecHtml) || /verFlow2/.test(vsecHtml),
        'supported-formula check': /formula/i.test(vsecHtml) || /verFlow3|verConstraints/.test(vsecHtml),
        'honest status': /verFlow4H|verStatusH|optimal, feasible/i.test(vsecHtml)
      };
      Object.keys(need).forEach(function (label) {
        ok('verify section represents: ' + label, need[label]);
      });
      // No heavy/dynamic surface, no old image, no remote asset.
      ok('verify-flow has no <img>', vflow.querySelectorAll('img').length === 0);
      ok('#verify has no verifyShotAlt image', !verifySec.querySelector('img[data-i18n-alt="verifyShotAlt"]'));
      ok('#verify has no old verified-result screenshot', !/verified-result-production/.test(vsecHtml));
      ok('verify-flow has no <canvas>', vflow.querySelectorAll('canvas').length === 0);
      ok('verify-flow has no <iframe>', vflow.querySelectorAll('iframe').length === 0);
      ok('verify-flow has no <video>', vflow.querySelectorAll('video').length === 0);
      ok('verify-flow has no <script>/runtime fetch', vflow.querySelectorAll('script').length === 0 && !/fetch\s*\(/.test(vsecHtml));
      ok('verify-flow references no remote asset', !/(?:src|href)\s*=\s*"https?:\/\//i.test(vflow.innerHTML));
      // No forbidden claims anywhere in the verify section.
      const FORBIDDEN = ['mathematical proof', 'guaranteed', 'always correct', 'perfect answer', 'error-free', 'error free'];
      FORBIDDEN.forEach(function (bad) {
        ok('#verify has no forbidden claim: "' + bad + '"', vsecHtml.toLowerCase().indexOf(bad) === -1, bad);
      });
      // i18n keys present in all five languages.
      ['verFlow1H', 'verFlow2H', 'verFlow3H', 'verFlow4H', 'verFlowTitle', 'verHonest'].forEach(function (k) {
        ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
          const v = DICT[lang] && DICT[lang].home ? DICT[lang].home[k] : undefined;
          ok('verify i18n ' + lang + '.' + k + ' present', typeof v === 'string' && v.trim().length > 0);
        });
      });
    }

    // ---- F3a product demonstration contract (replaces the hero image) ----
    const demos = doc.querySelectorAll('figure.hero-demo');
    // 1. Exactly one figure.hero-demo.
    ok('home has exactly one figure.hero-demo', demos.length === 1, demos.length + ' demos');
    const demo = demos[0] || null;
    const hero = doc.querySelector('section.hero-f3');
    // 2. The demo is inside the hero.
    ok('hero-demo is inside the hero section', !!hero && !!demo && hero.contains(demo));
    if (demo) {
      // 3. Accessible name: a <figcaption>, or aria-label/aria-labelledby.
      const figcap = demo.querySelector('figcaption');
      const labelledby = demo.getAttribute('aria-labelledby');
      const arialabel = demo.getAttribute('aria-label');
      const hasName = (figcap && (figcap.textContent || '').trim().length > 0) ||
                      (!!labelledby && !!doc.getElementById(labelledby)) || !!arialabel;
      ok('hero-demo has an accessible name (figcaption/aria)', hasName);
      // 4. Exactly the four expected phases, in order, via demoStep1..4 keys.
      const stepKeys = Array.from(demo.querySelectorAll('[data-i18n]'))
        .map(el => el.getAttribute('data-i18n'))
        .filter(k => /^demoStep[1-4]$/.test(k));
      ok('hero-demo has exactly four phases (demoStep1..4)',
         stepKeys.length === 4 &&
         stepKeys.indexOf('demoStep1') === 0 && stepKeys.indexOf('demoStep2') === 1 &&
         stepKeys.indexOf('demoStep3') === 2 && stepKeys.indexOf('demoStep4') === 3,
         stepKeys.join(','));
      const stageCount = demo.querySelectorAll('.hero-demo__stage').length;
      ok('hero-demo renders four stage blocks', stageCount === 4, stageCount + ' stages');
      // 5. Pinned authorised data: objective 1,760 / optimal / continuous / max.
      const demoHtml = demo.innerHTML;
      ok('hero-demo shows the pinned objective 1,760', /<b>1,760<\/b>/.test(demoHtml));
      ok('hero-demo status resolves to optimal (en)', /optimal/i.test(DICT.en.home.demoStatus || ''));
      ok('hero-demo model states continuous + maximise (en)',
         /continuous/i.test(DICT.en.home.demoModel || '') && /maximise/i.test(DICT.en.home.demoModel || ''));
      // The pinned values must match the F1 fixture authority (never invented).
      try {
        const fx = require(path.join(root, 'engine', 'fixtures', 'product', 'example-catalogue-f1.json'));
        const prod = (fx.examples || []).find(e => e.slug === 'production-plan');
        ok('pinned demo authority matches F1 fixture (1760/optimal/continuous/max)',
           !!prod && prod.expected && prod.expected.objective === 1760 &&
           prod.expected.status === 'optimal' && prod.expected.modelType === 'continuous' &&
           prod.sense === 'max');
      } catch (e) { ok('pinned demo authority matches F1 fixture (1760/optimal/continuous/max)', false, e.message.slice(0, 40)); }
      // 6. The demo must not contain a heavy/dynamic surface.
      ok('hero-demo has no <img>', demo.querySelectorAll('img').length === 0);
      ok('hero-demo has no <canvas>', demo.querySelectorAll('canvas').length === 0);
      ok('hero-demo has no <iframe>', demo.querySelectorAll('iframe').length === 0);
      ok('hero-demo has no <video>', demo.querySelectorAll('video').length === 0);
      ok('hero-demo has no <script>/runtime fetch', demo.querySelectorAll('script').length === 0 && !/fetch\s*\(/.test(demoHtml));
      ok('hero-demo references no remote asset', !/(?:src|href)\s*=\s*"https?:\/\//i.test(demoHtml));
      // 8. Each language keeps the accessible-name / phase i18n keys populated.
      const NEEDED = ['demoTitle', 'demoStep1', 'demoStep2', 'demoStep3', 'demoStep4', 'demoStatus', 'demoModel'];
      ['en', 'es', 'pt', 'de', 'fr'].forEach(lang => {
        const home = DICT[lang] && DICT[lang].home ? DICT[lang].home : {};
        const okLang = NEEDED.every(k => typeof home[k] === 'string' && home[k].trim().length > 0);
        ok('hero-demo i18n keys present + non-empty in ' + lang, okLang);
      });
    }
  }
}

console.log(fail ? ('VALIDATE HTML (' + label + '): FAILED (' + fail + ')')
                 : ('VALIDATE HTML (' + label + '): OK'));
process.exit(fail ? 1 : 0);
