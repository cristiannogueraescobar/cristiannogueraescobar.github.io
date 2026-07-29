/**
 * tests_contrast.js — WCAG AA contrast guard for the colour palette.
 *
 * Parses the CSS custom properties straight from solver.html and plumline.css,
 * then checks that every text/background pair the UI actually uses meets WCAG
 * 2.1 AA: 4.5:1 for normal text, 3:1 for large text (>=18px, or >=14px bold)
 * and for non-text focus indicators. Pure computation — no jsdom needed.
 *
 * Run: node engine/tests_contrast.js
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const solver = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const css = fs.readFileSync(path.join(siteDir, 'assets', 'plumline.css'), 'utf8');

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
['ink', 'ink-2', 'soft', 'faint', 'paper', 'panel', 'deep', 'cream', 'brass', 'brass-text', 'true', 'true-lo', 'wrong'].forEach(function (k) {
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

console.log('CONTRAST TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
