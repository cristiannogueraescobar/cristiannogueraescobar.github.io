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

// [fg, bg, minRatio, label] — the real combinations the UI renders.
const checks = [
  ['ink', 'paper', 4.5, 'body text on paper'],
  ['ink-2', 'paper', 4.5, 'secondary text on paper'],
  ['soft', 'paper', 4.5, 'soft text on paper'],
  ['faint', 'paper', 4.5, 'grid headers / notes on paper'],
  ['faint', 'panel', 4.5, 'faint text on white panel'],
  ['brass-text', 'paper', 4.5, 'brass text (tags, eyebrow) on paper'],
  ['brass-text', 'panel', 4.5, 'brass text on white panel'],
  ['true', 'paper', 4.5, 'success text on paper'],
  ['true', 'true-lo', 4.5, 'success text on its own tint row'],
  ['wrong', 'paper', 4.5, 'error text on paper'],
  ['cream', 'deep', 4.5, 'hero/footer text on dark'],
  ['ink', 'brass-tint', 4.5, 'focused cell input text on brass tint'],
  ['ink', 'paper', 3.0, 'focus ring (ink) vs paper — non-text 3:1'],
];
checks.forEach(function (c) {
  const [fg, bg, need, label] = c;
  if (!P[fg] || !P[bg]) { ok('contrast: ' + label, false, 'missing token'); return; }
  const r = ratio(P[fg], P[bg]);
  ok('contrast >= ' + need + ': ' + label, r >= need, r.toFixed(2) + ':1 (' + P[fg] + ' on ' + P[bg] + ')');
});

console.log('CONTRAST TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
