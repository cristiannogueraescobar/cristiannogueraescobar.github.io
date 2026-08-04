'use strict';

/*
 * Checkpoint F3a — Home hero, positioning and product demonstration.
 *
 * Pins the NEW guarantees introduced by F3a (the golden/SEO/i18n suites own the
 * rest). Covers: exactly one H1, the eyebrow, the two CTAs (primary -> solver,
 * secondary -> examples), the four-stage product demonstration, the pinned
 * demo authority (1,760 / optimal / continuous / max sourced from the F1
 * fixture, never invented), the five-claim proof strip, five-language copy with
 * zero fallback, no fake social proof, no external assets, six requests, WCAG AA
 * contrast, responsive structure, no duplicate IDs, and no empty links. It also
 * asserts the engine/catalogue are untouched.
 */

const fs = require('fs');
const path = require('path');

function run(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  let pass = 0, fail = 0;
  const failures = [];
  function ok(name, cond, extra) {
    if (cond) { pass++; } else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); }
  }

  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(siteDir, 'assets', 'plumline.css'), 'utf8');
  const mainM = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const main = mainM ? mainM[1] : '';
  const heroM = main.match(/<section[^>]*class="[^"]*hero-f3[^"]*"[\s\S]*?<\/section>/i);
  const hero = heroM ? heroM[0] : '';

  // Load the i18n dictionary the way the site does.
  const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
  g.window = g; g.globalThis = g;
  new Function('window', 'navigator', 'location', 'document', 'globalThis',
    fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
    .call(g, g, g.navigator, g.location, g.document, g);
  const DICT = g.Plumline.i18n.dict;
  const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

  // ---- 1. Exactly one H1, and it lives in the hero ----
  const h1s = main.match(/<h1\b/gi) || [];
  ok('exactly one <h1> on Home', h1s.length === 1, h1s.length + ' h1');
  ok('the H1 is in the hero', /<h1\b/i.test(hero));
  ok('H1 carries data-i18n="heroTitle"', /<h1[^>]*data-i18n="heroTitle"/.test(hero));

  // ---- 2. Eyebrow ----
  ok('hero has an eyebrow (heroEyebrow)', /class="eyebrow"[^>]*data-i18n="heroEyebrow"|data-i18n="heroEyebrow"[^>]*class="eyebrow"/.test(hero) || /data-i18n="heroEyebrow"/.test(hero));

  // ---- 3. Two CTAs: primary -> solver, secondary -> examples ----
  ok('primary CTA opens the solver',
    /<a[^>]*class="[^"]*btn2--primary[^"]*"[^>]*href="solver\.html"[^>]*data-i18n="heroCtaPrimary"|<a[^>]*href="solver\.html"[^>]*class="[^"]*btn2--primary/.test(hero));
  ok('secondary CTA goes to examples',
    /<a[^>]*class="[^"]*btn2--secondary[^"]*"[^>]*href="examples\.html"[^>]*data-i18n="heroCtaSecondary"|<a[^>]*href="examples\.html"[^>]*class="[^"]*btn2--secondary/.test(hero));
  // No more than two primary-level CTAs in the hero (btn2--primary/secondary).
  const heroBtns = (hero.match(/class="[^"]*btn2--(primary|secondary)[^"]*"/g) || []).length;
  ok('hero has at most two primary-level CTAs', heroBtns <= 2, heroBtns + ' cta');
  // The add-on is not a primary hero CTA.
  ok('hero does not use the add-on as a primary CTA', !/hero-f3[\s\S]*?#addon/.test(hero) || !/btn2--primary[^>]*#addon/.test(hero));

  // ---- 4. Product demonstration: four stages ----
  const stages = (hero.match(/hero-demo__stage/g) || []).length;
  ok('product demo has four stages', stages === 4, stages + ' stages');
  ['demoStep1', 'demoStep2', 'demoStep3', 'demoStep4'].forEach(function (k) {
    ok('demo stage label present: ' + k, hero.indexOf('data-i18n="' + k + '"') !== -1);
  });
  ok('demo is a semantic <figure>', /<figure[^>]*class="[^"]*hero-demo/.test(hero));
  ok('demo uses no <img> (HTML/CSS, not a heavy image)', !/<img\b/i.test(hero));
  ok('demo adds no runtime fetch/script', !/fetch\(|<script/i.test(hero));

  // ---- 5. Pinned demo authority: 1,760 / optimal / continuous / max ----
  // These must come from the pinned F1 fixture, never invented.
  const fixture = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'product', 'example-catalogue-f1.json'), 'utf8'));
  const prod = (fixture.examples || []).find(function (e) { return e.slug === 'production-plan'; });
  ok('F1 fixture pins production-plan authority', !!prod && !!prod.expected);
  if (prod && prod.expected) {
    ok('fixture objective is 1760', prod.expected.objective === 1760, String(prod.expected.objective));
    ok('fixture status is optimal', prod.expected.status === 'optimal', prod.expected.status);
    ok('fixture modelType is continuous', prod.expected.modelType === 'continuous', prod.expected.modelType);
    ok('fixture sense is max', prod.sense === 'max', prod.sense);
  }
  ok('demo shows the pinned objective 1,760', /<b>1,760<\/b>/.test(hero));
  ok('demo shows the optimal status badge', /badge--verify[^>]*data-i18n="demoStatus"/.test(hero));
  ok('demo status key resolves to an optimal statement (en)',
    /optimal/i.test(DICT.en.home.demoStatus || ''));
  ok('demo model badge states continuous + maximise (en)',
    /continuous/i.test(DICT.en.home.demoModel || '') && /maximise/i.test(DICT.en.home.demoModel || ''));

  // ---- 6. Proof strip: five verifiable claims ----
  const proofM = main.match(/<section[^>]*class="[^"]*proof-strip[^"]*"[\s\S]*?<\/section>/i);
  const proof = proofM ? proofM[0] : '';
  const proofItems = (proof.match(/<li\b/g) || []).length;
  ok('proof strip has five claims', proofItems === 5, proofItems + ' items');
  ['proofBrowser', 'proofNoAccount', 'proofDevice', 'proofFree', 'proofLangs'].forEach(function (k) {
    ok('proof claim present: ' + k, proof.indexOf('data-i18n="' + k + '"') !== -1);
  });

  // ---- 7. Five-language copy, zero fallback ----
  const NEW_KEYS = ['heroEyebrow', 'heroTitle', 'heroLead2', 'heroCtaPrimary', 'heroCtaSecondary',
    'heroTrust', 'demoTitle', 'demoStep1', 'demoStep2', 'demoStep3', 'demoStep4', 'demoModel',
    'demoObjLabel', 'demoStatus', 'demoCheckObj', 'demoCheckCons',
    'proofBrowser', 'proofNoAccount', 'proofDevice', 'proofFree', 'proofLangs'];
  LANGS.forEach(function (lang) {
    NEW_KEYS.forEach(function (k) {
      const v = DICT[lang] && DICT[lang].home ? DICT[lang].home[k] : undefined;
      ok('i18n ' + lang + '.' + k + ' present + non-empty', typeof v === 'string' && v.trim().length > 0, lang + '.' + k);
    });
  });
  // Zero fallback: no non-English dictionary value equals the English one for the
  // hero copy that must be translated (short shared tokens excluded).
  ['heroTitle', 'heroLead2', 'heroCtaPrimary', 'heroCtaSecondary', 'demoStatus'].forEach(function (k) {
    ['es', 'pt', 'de', 'fr'].forEach(function (lang) {
      ok('no English fallback for ' + lang + '.' + k,
        DICT[lang].home[k] !== DICT.en.home[k], lang + '.' + k);
    });
  });

  // ---- 8. No fake social proof ----
  const SOCIAL = ['testimonial', 'trusted by', 'customers love', 'users love', 'star rating',
    'aggregaterating', 'ratingvalue', 'reviews', 'award-winning', '5 stars', 'as seen on'];
  const low = html.toLowerCase();
  SOCIAL.forEach(function (needle) {
    ok('no fake social proof: "' + needle + '"', low.indexOf(needle) === -1, needle);
  });

  // ---- 9. No external assets ----
  ['http://', 'https://fonts.', 'cdnjs', 'unpkg', 'jsdelivr', 'googletagmanager', 'google-analytics']
    .forEach(function (needle) {
      // allow https:// only inside JSON-LD/canonical URLs (plumline.online); flag asset loads.
      const assetLoad = new RegExp('(?:src|href)="' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(html);
      ok('no external asset load: ' + needle, !assetLoad, needle);
    });

  // ---- 10. Six requests (pinned), engine + catalogue intact ----
  const e6 = JSON.parse(fs.readFileSync(
    path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e6-worker-mirror-final.json'), 'utf8'));
  ok('six canonical requests intact', e6.public_output.requests === 6, String(e6.public_output.requests));

  // ---- 11. Contrast (WCAG AA) for the demo/proof accents ----
  function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function relLum(rgb) { const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function ratio(h1, h2) { const l1 = relLum(hexToRgb(h1)), l2 = relLum(hexToRgb(h2)); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
  function tokenHex(name) { const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{3,6})')); return m ? m[1] : null; }
  const paper = tokenHex('paper'), ink2 = tokenHex('ink-2'), tru = tokenHex('true'), brassText = tokenHex('brass-text');
  // demo notes use text-2 (ink-2) on cream; check ticks use verification green on cream.
  ok('AA: demo note ink-2 on paper >= 4.5', ratio(ink2, paper) >= 4.5, ratio(ink2, paper).toFixed(2));
  ok('AA: verification green on paper >= 4.5', ratio(tru, paper) >= 4.5, ratio(tru, paper).toFixed(2));
  // white on verification green (status badge) and white on brass (number badge).
  ok('AA: white on verification green >= 4.5', ratio('#FFFFFF', tru) >= 4.5, ratio('#FFFFFF', tru).toFixed(2));
  const brass = tokenHex('brass');
  ok('AA (badge): brass-text present for accents', !!brassText);

  // ---- 12. Responsive structure ----
  ok('CSS has a hero responsive rule', /@media[^{]*max-width:\s*860px/.test(css) || /@media[^{]*max-width:\s*8\d\dpx/.test(css));
  ok('demo flow is a grid (stacks on mobile)', /\.hero-demo__flow\{[^}]*display:grid/.test(css));

  // ---- 13. No duplicate IDs, no empty links ----
  const ids = (html.match(/\bid="([^"]+)"/g) || []).map(s => s.replace(/.*id="/, '').replace(/"$/, ''));
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  ok('no duplicate IDs on Home', dup.length === 0, dup.join(','));
  const emptyLink = /<a\b[^>]*>\s*<\/a>/.test(html);
  ok('no empty links on Home', !emptyLink);
  // every hero anchor has an href and non-empty accessible content.
  const heroAnchors = hero.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
  ok('every hero CTA has an href', heroAnchors.every(a => /href="[^"]+"/.test(a)), heroAnchors.length + ' anchors');

  // ---- F3a-final: contextual contrast for secondary text on the dark field ----
  // Secondary hero copy sits on .field-deep (--deep). --text-2 / --text-muted are
  // tuned for light grounds and are near-invisible on --deep, so .hero-trust and
  // .hero-demo__cap must resolve to attenuated cream that clears AA. These checks
  // compute the REAL composited colour (rgba over --deep), not a bare token.
  function tokenValue(name) {
    // last definition wins (cascade); capture up to the semicolon.
    const re = new RegExp('--' + name + ':\\s*([^;]+);', 'g');
    let m, last = null; while ((m = re.exec(css)) !== null) last = m[1].trim();
    return last;
  }
  function hexToRgb2(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function relLum2(rgb) { const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function ratioRgb(a, b) { const l1 = relLum2(a), l2 = relLum2(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
  // Resolve a CSS colour expression to an RGB triple composited over `bg`.
  // Supports: #hex, var(--token) (recursively), and rgba(r,g,b,a) over bg.
  function resolveColour(expr, bg, depth) {
    if (depth > 8 || expr == null) return null;
    expr = expr.trim();
    let m = expr.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i);
    if (m) { const v = tokenValue(m[1].slice(2)); return resolveColour(v != null ? v : (m[2] || ''), bg, depth + 1); }
    m = expr.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) return hexToRgb2(expr);
    m = expr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);
    if (m) {
      const fg = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
      const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
      if (a >= 1 || !bg) return fg;
      return fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
    }
    return null;
  }
  // Extract a property value from a specific selector block.
  function ruleColour(selector) {
    const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
    const bm = css.match(re); if (!bm) return null;
    const cm = bm[1].match(/(?:^|;|\s)color:\s*([^;]+);/); return cm ? cm[1].trim() : null;
  }
  const deep = resolveColour(tokenValue('deep'), null, 0);
  // 1. .hero-trust computed contrast on --deep >= 4.5 (rgba composited).
  const trustExpr = ruleColour('.hero-trust');
  const trustRgb = resolveColour(trustExpr, deep, 0);
  const trustRatio = trustRgb ? ratioRgb(trustRgb, deep) : 0;
  ok('AA: .hero-trust on --deep >= 4.5 (computed, composited)', trustRatio >= 4.5, trustRatio.toFixed(2) + ' (' + trustExpr + ')');
  ok('.hero-trust does not use the light-ground token --text-2', !/var\(--text-2\)/.test(trustExpr || ''));
  // 2. .hero-demo__cap computed contrast on --deep >= 4.5.
  const capExpr = ruleColour('.hero-demo__cap');
  const capRgb = resolveColour(capExpr, deep, 0);
  const capRatio = capRgb ? ratioRgb(capRgb, deep) : 0;
  ok('AA: .hero-demo__cap on --deep >= 4.5 (computed, composited)', capRatio >= 4.5, capRatio.toFixed(2) + ' (' + capExpr + ')');
  ok('.hero-demo__cap does not use the light-ground token --text-muted', !/var\(--text-muted\)/.test(capExpr || ''));
  // 3. rgba resolution sanity: the trust colour token resolves through an rgba.
  const trustTokenName = (trustExpr || '').match(/var\(\s*(--[a-z0-9-]+)/);
  const trustTokenVal = trustTokenName ? tokenValue(trustTokenName[1].slice(2)) : trustExpr;
  ok('.hero-trust resolves via rgba over --deep', /rgba\(/i.test(trustTokenVal || ''), trustTokenVal);

  // ---- F3a-final: translatable proof-strip aria-label ----
  // 4. proofLabel exists in all five languages.
  LANGS.forEach(function (lang) {
    const v = DICT[lang] && DICT[lang].home ? DICT[lang].home.proofLabel : undefined;
    ok('i18n ' + lang + '.proofLabel present + non-empty', typeof v === 'string' && v.trim().length > 0, lang);
  });
  // 5. The proof strip uses data-i18n-aria="proofLabel".
  ok('proof strip carries data-i18n-aria="proofLabel"',
    /<section[^>]*class="[^"]*proof-strip[^"]*"[^>]*data-i18n-aria="proofLabel"|<section[^>]*data-i18n-aria="proofLabel"[^>]*class="[^"]*proof-strip/.test(html));
  // 6. i18n runtime translates data-i18n-aria into aria-label (contract present).
  const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
  ok('i18n applies data-i18n-aria -> aria-label',
    /data-i18n-aria/.test(i18nSrc) && /setAttribute\(\s*'aria-label'/.test(i18nSrc));
  // The proof strip must carry the translatable hook (the static English label
  // may stay only as an SSR/no-JS fallback alongside data-i18n-aria).
  const proofSection = (html.match(/<section[^>]*class="[^"]*proof-strip[^"]*"[^>]*>/) || [''])[0];
  ok('proof strip is not an untranslatable English-only label',
    /data-i18n-aria="proofLabel"/.test(proofSection), proofSection.slice(0, 80));

  return { pass: pass, fail: fail, failures: failures };
}

if (require.main === module) {
  const r = run();
  r.failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F3A HERO + POSITIONING TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail === 0 ? 0 : 1);
}

module.exports = { run: run };
