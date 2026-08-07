'use strict';

/*
 * Checkpoint F4a — visual direction prototype contracts (hardened for the
 * external-review corrections).
 *
 * Windows-portable: only Node fs/path + a tiny PNG IHDR reader; no external
 * process, no shell tool. Runs from a path with spaces.
 */

const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const protoDir = path.join(siteDir, 'design-review', 'f4a');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

// ---------- WCAG contrast helper -------------------------------------------
function relLum(hex) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  function f(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { const l1 = relLum(a), l2 = relLum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
// Resolve a --token from the :root block of the css.
function token(css, name) {
  const re = new RegExp('--' + name + '\\s*:\\s*(#[0-9A-Fa-f]{6})');
  const m = css.match(re); return m ? m[1] : null;
}

const html = fs.existsSync(path.join(protoDir, 'index.html')) ? read(path.join(protoDir, 'index.html')) : '';
const css = fs.existsSync(path.join(protoDir, 'prototype.css')) ? read(path.join(protoDir, 'prototype.css')) : '';
const js = fs.existsSync(path.join(protoDir, 'sequence.js')) ? read(path.join(protoDir, 'sequence.js')) : '';

// ---- 1. Prototype files exist ---------------------------------------------
const REQUIRED = ['index.html', 'prototype.css', 'sequence.js', 'README.md',
  'fonts/newsreader-latin-wght-normal.woff2', 'fonts/newsreader-latin-ext-wght-normal.woff2',
  'fonts/manrope-latin-wght-normal.woff2', 'fonts/manrope-latin-ext-wght-normal.woff2',
  'fonts/Newsreader-OFL.txt', 'fonts/Manrope-OFL.txt'];
REQUIRED.forEach(function (rel) {
  ok('1: prototype file exists: ' + rel, fs.existsSync(path.join(protoDir, rel)), rel);
});

// ---- 2. Excluded from the public build ------------------------------------
const viteCfg = fs.existsSync(path.join(siteDir, 'vite.config.js')) ? read(path.join(siteDir, 'vite.config.js'))
  : (fs.existsSync(path.join(siteDir, 'vite.config.mjs')) ? read(path.join(siteDir, 'vite.config.mjs')) : '');
ok('2: vite config found', viteCfg.length > 0);
ok('2: vite PAGES list does not include the prototype', /const PAGES\s*=/.test(viteCfg) && viteCfg.indexOf('design-review') === -1, 'design-review referenced in vite config');
ok('2: prototype lives under design-review/', fs.existsSync(protoDir));

// ---- 3. Not present in dist (stable count) --------------------------------
const distDir = path.join(siteDir, 'dist');
const distExists = fs.existsSync(distDir);
ok('3: dist/ has no design-review directory', !distExists || !fs.existsSync(path.join(distDir, 'design-review')));
const leaked = distExists && ['prototype.css', 'sequence.js'].some(function (f) {
  return fs.existsSync(path.join(distDir, f)) || fs.existsSync(path.join(distDir, 'assets', f));
});
ok('3: no prototype asset leaked into dist', !leaked);

// ---- 4. Does not modify production pages ----------------------------------
const PROD = ['index.html', 'solver.html', 'examples.html', 'capabilities.html', 'guide.html', 'about.html', 'privacy.html', 'terms.html'];
PROD.forEach(function (pg) {
  ok('4: prototype does not link to production page ' + pg,
    !new RegExp('href="[^"]*(\\.\\./)+' + pg.replace('.', '\\.')).test(html), pg);
});

// ---- 5. No video / GIF / WebGL --------------------------------------------
ok('5: no <video> element', !/<video[\s>]/i.test(html));
ok('5: no <source ... video', !/<source[^>]+type="video/i.test(html));
ok('5: no .gif reference', !/\.gif\b/i.test(html) && !/\.gif\b/i.test(css));
ok('5: no WebGL context', !/getContext\(\s*['"]webgl/i.test(js) && !/webgl/i.test(html));
ok('5: no <canvas> used for animation', !/<canvas[\s>]/i.test(html));

// ---- 6. No remote images / no stock ---------------------------------------
ok('6: no remote http(s) image in html', !/<img[^>]+src="https?:/i.test(html));
ok('6: no remote background-image in css', !/url\(\s*['"]?https?:/i.test(css));
ok('6: no <img> at all (prototype uses real UI, not stock images)', !/<img[\s>]/i.test(html));

// ---- 7. Fonts: local only, OFL documented, only Newsreader + Manrope ------
const fontFaces = (css.match(/@font-face\s*\{[\s\S]*?\}/g) || []);
ok('7: at least the two webfont families are declared', fontFaces.length >= 2, String(fontFaces.length));
const remoteFont = fontFaces.some(function (f) { return /src\s*:[^;]*url\(\s*['"]?https?:/i.test(f); });
ok('7: no remote font src', !remoteFont);
const badLocal = fontFaces.some(function (f) { return !/url\(\s*['"]?\.\/fonts\//i.test(f); });
ok('7: every @font-face uses a local ./fonts/ src', !badLocal);
const families = Array.from(css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*['"]([^'"]+)['"]/g)).map(function (m) { return m[1]; });
const uniqueFamilies = Array.from(new Set(families));
ok('7: only Newsreader and Manrope declared as webfonts', uniqueFamilies.length === 2 && uniqueFamilies.indexOf('Newsreader') !== -1 && uniqueFamilies.indexOf('Manrope') !== -1, uniqueFamilies.join(','));
ok('7: no third webfont family', uniqueFamilies.every(function (f) { return f === 'Newsreader' || f === 'Manrope'; }), uniqueFamilies.join(','));
ok('7: font-display set on faces', fontFaces.every(function (f) { return /font-display\s*:/.test(f); }));
['Newsreader-OFL.txt', 'Manrope-OFL.txt'].forEach(function (lic) {
  const p = path.join(protoDir, 'fonts', lic);
  ok('7: license documented: ' + lic, fs.existsSync(p) && /SIL Open Font License/i.test(read(p)), lic);
});
const readme = fs.existsSync(path.join(protoDir, 'README.md')) ? read(path.join(protoDir, 'README.md')) : '';
ok('7: README documents SIL OFL', /SIL Open Font License|OFL/i.test(readme));

// ---- 7b. Glyph honesty: maths operators assigned to mono, not webfont -----
// The webfonts do NOT contain <=, >=, ->. The prototype must assign those to the
// mono/system stack deliberately (via .mathsym) rather than relying on fallback.
ok('7b: .mathsym class exists and uses the mono stack',
  /\.mathsym\s*\{[^}]*font-family\s*:\s*var\(--mono\)/.test(css));
// Every <= / >= in a visible context is wrapped in .mathsym (checked structurally:
// no bare U+2264/U+2265 outside a mathsym span or an evidence line).
// Every <= / >= occurrence must be either wrapped in a .mathsym span (mono) or
// sit inside a mono .state__evidence line. Count total vs accounted-for.
const OP = /&#8804;|&#8805;|\u2264|\u2265/g;
const totalLE = (html.match(OP) || []).length;
const wrappedLE = (html.match(/class="mathsym"[^>]*>\s*(?:&#8804;|&#8805;|\u2264|\u2265)/g) || []).length;
// Sum operators inside every state__evidence line (each line may hold several).
let evidenceLE = 0;
(html.match(/class="state__evidence"[^>]*>([\s\S]*?)<\/p>/g) || []).forEach(function (blk) {
  evidenceLE += (blk.match(OP) || []).length;
});
ok('7b: every maths operator is in .mathsym (mono) or a mono evidence line',
  totalLE > 0 && (wrappedLE + evidenceLE) === totalLE,
  'total=' + totalLE + ' wrapped=' + wrappedLE + ' evidence=' + evidenceLE);
ok('7b: card arrow assigned a deliberate font (not accidental fallback)',
  /\.card__action::after\s*\{[^}]*font-family\s*:\s*var\(--mono\)/.test(css));
// The README must not POSITIVELY claim the webfonts cover the maths operators.
// Negations ("do NOT cover", "do not contain ≤ ≥ →") are fine and expected.
// Detect a positive claim: "cover ... ≤/≥/→" NOT preceded by a negation word.
(function () {
  const posClaim = /(?:Newsreader|Manrope|webfonts?|subsets?)[^.]{0,40}\bcover[^.]{0,40}(?:≤|≥|→)/i;
  const hasClaim = posClaim.test(readme);
  const negated = /\b(not|never|don'?t|do not|no)\b[^.]{0,40}(?:cover|contain)[^.]{0,40}(?:≤|≥|→)/i.test(readme);
  ok('7b: README does not positively claim webfonts cover <= >= ->', !hasClaim || negated);
})();

// ---- 8. Reduced motion + pausable autoplay --------------------------------
ok('8: css honours prefers-reduced-motion', /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(css));
ok('8: js checks prefers-reduced-motion', /prefers-reduced-motion/.test(js));
ok('8: js does not autoplay under reduced motion', /reduce/.test(js) && /!reduce/.test(js));
ok('8: autoplay has a pause control', /data-seq-toggle/.test(html) && /pause/i.test(js));
ok('8: sequence does not run off-screen (IntersectionObserver gate)', /IntersectionObserver/.test(js));
ok('8: explicit user pause is respected on re-entry (userPaused gate)',
  /userPaused/.test(js) && /!userPaused/.test(js));

// ---- 9. Progressive enhancement: real static equivalent -------------------
// The five stages must NOT carry `hidden` in the initial HTML (that would make
// them invisible without JS). JS applies .seq--enhanced then hides stages.
const stageEls = html.match(/<div class="seq__stage"[^>]*>/g) || [];
ok('9: five sequence stages present', stageEls.length === 5, String(stageEls.length));
const hiddenInStatic = stageEls.filter(function (s) { return /\shidden(\s|=|>)/.test(s); });
ok('9: no stage carries `hidden` in the static HTML (readable without JS)',
  hiddenInStatic.length === 0, hiddenInStatic.length + ' stage(s) hidden in static markup');
ok('9: JS gates single-stage view behind .seq--enhanced',
  /seq--enhanced/.test(js) && /seq--enhanced/.test(css));
ok('9: sequence marked as preview/demonstration', /Preview|preview|demonstration/.test(html));

// ---- 10. Single H1, landmarks, full heading hierarchy H1-H6 ---------------
const h1s = (html.match(/<h1[\s>]/g) || []).length;
ok('10: exactly one H1', h1s === 1, String(h1s));
ok('10: has <header> landmark', /<header[\s>]/.test(html));
ok('10: has <main> landmark', /<main[\s>]/.test(html));
ok('10: has <footer> landmark', /<footer[\s>]/.test(html));
ok('10: has <nav> with accessible name', /<nav[^>]+aria-label=/.test(html));
// Full H1-H6 order: no level is skipped going down (e.g. H2 -> H4).
const headingSeq = (html.match(/<h([1-6])[\s>]/g) || []).map(function (h) { return Number(h.match(/h([1-6])/)[1]); });
let orderOk = true, prev = 0;
headingSeq.forEach(function (lvl) { if (prev && lvl > prev + 1) orderOk = false; prev = lvl; });
ok('10: heading order H1-H6 never skips a level', orderOk, headingSeq.join(','));
ok('10: no H4-H6 misused as footer labels', !/<h[4-6][\s>]/.test(html), 'found h4-h6');

// ---- 11. Named controls ---------------------------------------------------
const buttons = html.match(/<button[\s\S]*?<\/button>/g) || [];
const unnamed = buttons.filter(function (b) {
  const hasAria = /aria-label="[^"]+"/.test(b);
  const text = b.replace(/<[^>]+>/g, '').trim();
  return !hasAria && text.length === 0;
});
ok('11: every button has a name (text or aria-label)', unnamed.length === 0, unnamed.slice(0, 2).join(' | '));
ok('11: language select has a label', /aria-label="Language"|for="lang"/.test(html));

// ---- 12. Local references + fragment link integrity -----------------------
const refs = [];
(html.match(/(?:href|src)="(\.\/[^"]+)"/g) || []).forEach(function (m) { refs.push(m.match(/"(\.\/[^"]+)"/)[1]); });
(css.match(/url\(\s*['"]?(\.\/[^'")]+)['"]?\s*\)/g) || []).forEach(function (m) { refs.push(m.match(/(\.\/[^'")]+)/)[1]); });
Array.from(new Set(refs)).forEach(function (r) {
  ok('12: local reference resolves: ' + r, fs.existsSync(path.join(protoDir, r.replace(/^\.\//, ''))), r);
});
// No empty fragment links.
ok('12: no href="#" placeholder links', !/href="#"/.test(html));
// Every href="#id" resolves to exactly one existing id.
const fragTargets = (html.match(/href="#([A-Za-z][\w-]*)"/g) || []).map(function (m) { return m.match(/#([\w-]+)/)[1]; });
const ids = (html.match(/\sid="([\w-]+)"/g) || []).map(function (m) { return m.match(/id="([\w-]+)"/)[1]; });
fragTargets.forEach(function (t) {
  const count = ids.filter(function (x) { return x === t; }).length;
  ok('12: fragment #' + t + ' resolves to exactly one id', count === 1, 'matches=' + count);
});

// ---- 13. Real copy / real example, no invented commercial claims ----------
ok('13: uses the real hero headline', html.indexOf('Turn spreadsheet decisions into answers you can check.') !== -1);
ok('13: uses the real production-plan data (=SUMPRODUCT)', html.indexOf('=SUMPRODUCT(B2:B4,E2:E4)') !== -1);
ok('13: no lorem ipsum', !/lorem ipsum/i.test(html));
// Honest copy: the "it can prove" qualifier is present; no competitor swipe.
ok('13: hero uses the honest "it can prove" qualifier', /best allocation it can prove/.test(html));
ok('13: no competitor generalisation ("most tools")', !/most tools/i.test(html));
const INVENTED = [/\btestimonial/i, /\btrusted by\b/i, /\b\d+[,.]?\d*\s*(customers|users|companies)\b/i,
  /\bISO\s?\d{4,}/i, /\bSOC\s?2\b/i, /\bcertified\b/i, /\baward/i, /\b5[- ]star/i];
INVENTED.forEach(function (re) {
  ok('13: no invented commercial claim ' + re, !re.test(html), (html.match(re) || [''])[0]);
});
// Incomplete-state next action must not reference a control the prototype does
// not have. "raise the step limit" is disallowed unless such a control exists.
ok('13: incomplete state does not promise an unavailable "step limit" control',
  !/raise the step limit/i.test(html));

// ---- 14. States carry meaning + next + evidence ---------------------------
ok('14: optimal state present with meaning/next/evidence',
  /Optimal solution proven/.test(html) && /state__meaning/.test(html) && /state__next/.test(html) && /state__evidence/.test(html));
ok('14: incomplete state present (honest, not a red card)', /Search incomplete/.test(html));

// ---- 15. Colour discipline (structural) -----------------------------------
ok('15: primary button is brass, not verification green',
  /\.btn--primary\s*\{[^}]*background\s*:\s*var\(--brass\)/.test(css));
ok('15: verification green reserved (receipt/seal/true tags)',
  /--true/.test(css) && /receipt__check|tag--true|state--ok|matrix .yes|trustbar__check/.test(css));

// ---- 15b. WCAG AA contrast on critical small-text combos ------------------
// Real ratios, not a regex that a colour exists. Threshold 4.5:1 (small text).
const paper = token(css, 'paper'), panel = token(css, 'panel'), surface2 = token(css, 'surface-2');
const deep = token(css, 'deep'), ink = token(css, 'ink'), soft = token(css, 'soft'), faint = token(css, 'faint');
const brassText = token(css, 'brass-text'), brassTint = token(css, 'brass-tint');
const trueC = token(css, 'true'), trueLo = token(css, 'true-lo');
const warnText = token(css, 'warn-text'), warnLo = token(css, 'warn-lo');
const cream = token(css, 'cream');
const AA = 4.5;
const combos = [
  ['ink on paper', ink, paper],
  ['soft on paper', soft, paper],
  ['faint on paper', faint, paper],
  ['faint on surface-2', faint, surface2],
  ['brass-text on paper', brassText, paper],
  ['brass-text on panel', brassText, panel],
  ['brass chip text on tint', brassText, brassTint],
  ['true on true-lo (badge)', trueC, trueLo],
  ['warn-text on warn-lo (incomplete badge)', warnText, warnLo],
  ['cream on deep (nav/footer/receipt head)', cream, deep]
];
combos.forEach(function (c) {
  const ratio = (c[1] && c[2]) ? contrast(c[1], c[2]) : 0;
  ok('15b: AA contrast >= 4.5 — ' + c[0], ratio >= AA, ratio ? ratio.toFixed(2) + ':1' : 'token missing');
});

// ---- 16. Touch target for sequence dots -----------------------------------
// The visual dot may stay ~7px, but a >=24px hit target must be provided via a
// pseudo-element. Assert the ::before 24px box exists.
ok('16: seq dots provide a >=24px hit target via pseudo-element',
  /\.seq__dot::before\s*\{[^}]*width\s*:\s*24px[^}]*height\s*:\s*24px/.test(css.replace(/\n/g, ' ')));

// ---- 17. Sequence semantics: no fake ARIA ---------------------------------
// Strip HTML comments first (explanatory comments may name roles we forbid).
const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
ok('17: sequence steps do not use role="tablist" without a full tab widget',
  !/role="tablist"/.test(htmlNoComments));
ok('17: active stage communicated via aria-current="step"',
  /aria-current="step"/.test(html) && /aria-current/.test(js));
ok('17: no empty aria-live region left in markup', !/id="seq-live"/.test(html) && !/aria-live="polite"[^>]*>\s*<\/[a-z]+>/.test(html));
ok('17: toolbar preview is not exposed as an operable role="toolbar"',
  !/role="toolbar"/.test(htmlNoComments));

// ---- 17b. Active-stage visual state is wired to aria-current="step" --------
// The JS communicates the active stage via aria-current="step"; the CSS must
// style BOTH the active step and the active dot off that same attribute, and must
// NOT depend on a stale data-on selector for the interactive step state.
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok('17b: JS sets aria-current="step" on the active stage',
  /setAttribute\(\s*['"]aria-current['"]\s*,\s*['"]step['"]\s*\)/.test(js));
ok('17b: .seq__step[aria-current="step"] has active styling',
  /\.seq__step\[aria-current="step"\]\s*\{[^}]*(?:border-bottom-color|color)\s*:/.test(cssNoComments));
ok('17b: .seq__dot[aria-current="step"] has active styling',
  /\.seq__dot\[aria-current="step"\]\s*\{[^}]*background\s*:/.test(cssNoComments));
ok('17b: .seq__step does NOT use data-on as its interactive active selector',
  !/\.seq__step\[data-on/.test(cssNoComments));
ok('17b: JS does not write data-on on the sequence steps',
  !/seq__step[\s\S]{0,80}data-on/.test(js) && !/setAttribute\(\s*['"]data-on['"]/.test(js));

// ---- 18. Portability self-check -------------------------------------------
ok('18: suite spawns no external process', (function () {
  const self = read(path.join(__dirname, 'tests_f4a_visual_direction.js'));
  const needle = 'child' + '_process';
  return self.indexOf(needle) === -1 && !/\b(execSync|execFileSync|spawnSync|spawn)\s*\(/.test(self);
})());

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F4A VISUAL DIRECTION TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
