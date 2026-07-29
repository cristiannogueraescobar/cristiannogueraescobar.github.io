/**
 * tests_contrast.js — WCAG AA contrast guard for the colour palette.
 *
 * Parses the CSS custom properties from the stylesheets, then checks a CURATED
 * set of the critical text/background pairs the UI renders against WCAG 2.1 AA
 * (4.5:1 normal text, 3:1 large text or non-text focus indicators). It is not a
 * full audit of every possible pairing; it targets the pairs that have failed
 * or are most at risk, plus rule-level guards on the specific fixes. Pure
 * computation — no jsdom needed.
 *
 * Run: node engine/tests_contrast.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const solver = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const css = fs.readFileSync(path.join(siteDir, 'assets', 'plumline.css'), 'utf8');
const examples = fs.readFileSync(path.join(siteDir, 'examples.html'), 'utf8');
const PAGE_NAMES = ['index.html', 'solver.html', 'guide.html', 'about.html', 'privacy.html', 'terms.html', 'examples.html'];
const allPages = PAGE_NAMES.map(p => fs.readFileSync(path.join(siteDir, p), 'utf8')).join('\n');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Pull "--name:#RRGGBB" definitions from either file.
function palette(src) {
  const p = {};
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g;
  let m; while ((m = re.exec(src))) p[m[1]] = m[2];
  return p;
}
const P = Object.assign({}, palette(css), palette(solver));

function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }

// The palette must expose the tokens we depend on.
['ink', 'ink-2', 'soft', 'faint', 'paper', 'panel', 'deep', 'deep-2', 'cream', 'brass', 'brass-text', 'true', 'true-lo', 'wrong'].forEach(function (k) {
  ok('palette defines --' + k, !!P[k], Object.keys(P).join(','));
});

// Compose an rgba text colour over an opaque background, returning the
// effective hex — needed for the footer's translucent cream text.
function over(fgHex, alpha, bgHex) {
  const f = fgHex.replace('#', '').match(/../g).map(h => parseInt(h, 16));
  const b = bgHex.replace('#', '').match(/../g).map(h => parseInt(h, 16));
  const c = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// A curated set of the CRITICAL text/background pairs the UI renders. Not an
// exhaustive audit of every possible combination — it targets the ones that
// have failed or are most at risk (accent grounds, hover states, translucent
// footer text, hardcoded literals). Each entry: [fg, bg, minRatio, label].
const LIT = { errText: '#b4432f' };   // hardcoded error text used in the receipt
const checks = [
  ['ink', 'paper', 4.5, 'body text on paper'],
  ['ink-2', 'paper', 4.5, 'secondary text on paper'],
  ['soft', 'paper', 4.5, 'soft text on paper (status-list)'],
  ['faint', 'paper', 4.5, 'grid headers / notes on paper'],
  ['faint', 'panel', 4.5, 'faint text on white panel'],
  ['brass-text', 'paper', 4.5, 'brass text (tags, eyebrow) on paper'],
  ['brass-text', 'panel', 4.5, 'brass text on white panel'],
  ['true', 'paper', 4.5, 'success text on paper'],
  ['true', 'true-lo', 4.5, 'success text on its own tint row'],
  ['wrong', 'paper', 4.5, 'error text on paper'],
  ['wrong', 'wrong-lo', 4.5, 'error text on its own tint'],
  ['cream', 'deep', 4.5, 'hero/footer text on dark'],
  ['brass-hi', 'deep', 4.5, 'eyebrow (brass-hi) on dark ground'],
  ['ink', 'brass-tint', 4.5, 'focused cell input text on brass tint'],
  // Button grounds: 15px semibold is NOT "large text", so needs 4.5:1.
  ['ink', 'brass', 4.5, 'primary .btn text (ink on brass)'],
  ['ink', 'brass-hi', 4.5, 'primary .btn:hover text (ink on brass-hi)'],
  ['cream', 'true', 4.5, 'solve button text on true (normal AND hover)'],
  // Hardcoded error literal used in the solver receipt.
  [LIT.errText, 'paper', 4.5, 'receipt error literal (#b4432f) on paper'],
  ['ink', 'paper', 3.0, 'focus ring (ink) vs paper — non-text 3:1'],
];
checks.forEach(function (c) {
  const [fg, bg, need, label] = c;
  const fgHex = fg[0] === '#' ? fg : P[fg];
  const bgHex = bg[0] === '#' ? bg : P[bg];
  if (!fgHex || !bgHex) { ok('contrast: ' + label, false, 'missing token ' + fg + '/' + bg); return; }
  const r = ratio(fgHex, bgHex);
  ok('contrast >= ' + need + ': ' + label, r >= need, r.toFixed(2) + ':1 (' + fgHex + ' on ' + bgHex + ')');
});

// Footer translucent text: cream at low alpha over the dark --deep-2 ground.
// Pull the actual alpha from the .foot .fine rule so the test tracks the CSS.
const footAlpha = (css.match(/\.foot \.fine\{[^}]*?color:rgba\(245,242,235,\.(\d+)\)/) || [])[1];
ok('footer .fine alpha is present', !!footAlpha, String(footAlpha));
if (footAlpha && P['deep-2']) {
  const eff = over('#F5F2EB', Number('0.' + footAlpha), P['deep-2']);
  ok('contrast >= 4.5: footer fine text over deep-2', ratio(eff, P['deep-2']) >= 4.5,
     ratio(eff, P['deep-2']).toFixed(2) + ':1 (alpha .' + footAlpha + ')');
}

// Rule-level guards: the pair checks above prove the tokens are AA, but not
// that the CSS actually USES the safe token. Pin the specific rules that were
// fixed so a regression to the unsafe colour is caught.
ok('primary .btn uses ink text (not #fff)',
   /\.btn\{[^}]*background:var\(--brass\);color:var\(--ink\)/.test(css),
   'btn should be ink on brass');
ok('primary .btn:hover keeps ink text',
   /\.btn:hover\{[^}]*color:var\(--ink\)/.test(css));
ok('solve button hover does not lighten to --true-hi (plumline)',
   !/\.btn\.solve:hover\{[^}]*background:var\(--true-hi\)/.test(css));
ok('solve button hover does not lighten to --true-hi (solver)',
   !/button\.solve:hover\{[^}]*background:var\(--true-hi\)/.test(solver));
ok('status-list uses a defined token (--soft, not --muted)',
   /\.status-list span\{color:var\(--soft\)\}/.test(css) && !/var\(--muted\)/.test(css));

// examples.html uses inline styles the stylesheet guards above don't see. Its
// card tags and open-link must use the AA-safe tokens (small text on white).
ok('example card tags use --brass-text',
   /\.xcard \.xtags\{[^}]*color:var\(--brass-text\)/.test(examples),
   'xtags should be brass-text');
ok('example open link uses --true',
   /\.xcard \.xopen\{[^}]*color:var\(--true\)/.test(examples),
   'xopen should be --true');
ok('examples.html no longer references the undefined --green token',
   !/var\(--green/.test(examples));
// Confirm those tokens actually clear AA on the white card ground.
ok('contrast >= 4.5: example tags (brass-text) on white', ratio(P['brass-text'], '#FFFFFF') >= 4.5,
   ratio(P['brass-text'], '#FFFFFF').toFixed(2) + ':1');
ok('contrast >= 4.5: example open link (true) on white', ratio(P['true'], '#FFFFFF') >= 4.5,
   ratio(P['true'], '#FFFFFF').toFixed(2) + ':1');

// The build badge must not carry a reduced opacity: it already inherits the
// footer's translucent cream (.62), so an extra opacity:.6 would compound the
// alpha and drop it below AA. Check every page.
ok('build badges have no reduced opacity',
   !/id="buildBadge"[^>]*opacity\s*:\s*(?:0?\.\d+|0)(?![0-9])/.test(allPages),
   'a buildBadge still has opacity < 1');
// Also guard a future .build-badge CSS rule: if one is ever added, it must not
// re-introduce a reduced opacity that would drop the badge below AA.
ok('no .build-badge CSS rule sets reduced opacity',
   !/\.build-badge\b[^{]*\{[^}]*opacity\s*:\s*(?:0?\.\d+|0)(?![0-9])/i.test(css) &&
   !/\.build-badge\b[^{]*\{[^}]*opacity\s*:\s*(?:0?\.\d+|0)(?![0-9])/i.test(solver),
   'a .build-badge rule sets opacity < 1');

console.log('CONTRAST TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
