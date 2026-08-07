'use strict';

/*
 * Checkpoint F4a — negative mutation suite.
 *
 * Each mutation is applied to an isolated temp COPY of the prototype (+ a copy of
 * the suite pointed at it), run via process.execPath, and checked: file changed
 * (expectedChange), suite exited non-zero, output contains the specific expected
 * contract (expectedFailure), and no SyntaxError / MODULE_NOT_FOUND / infra
 * error. A clean control passes. Windows-portable: fs.cpSync into an mkdtemp path
 * with a space; fs.rmSync cleanup in finally; process.execPath; no shell tool.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

function makeTree() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'f4a neg-'));
  fs.mkdirSync(path.join(base, 'engine'), { recursive: true });
  fs.copyFileSync(path.join(siteDir, 'engine', 'tests_f4a_visual_direction.js'),
    path.join(base, 'engine', 'tests_f4a_visual_direction.js'));
  fs.cpSync(path.join(siteDir, 'design-review'), path.join(base, 'design-review'), { recursive: true });
  const vc = fs.existsSync(path.join(siteDir, 'vite.config.js')) ? path.join(siteDir, 'vite.config.js')
    : path.join(siteDir, 'vite.config.mjs');
  if (fs.existsSync(vc)) fs.copyFileSync(vc, path.join(base, 'vite.config.js'));
  return base;
}
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
function runSuite(dir) {
  try {
    const out = cp.execFileSync(process.execPath, [path.join(dir, 'engine', 'tests_f4a_visual_direction.js')],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: out.toString(), err: '' };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: (e.stdout || '').toString(), err: (e.stderr || '').toString() };
  }
}
function pf(dir, rel) { return path.join(dir, 'design-review', 'f4a', rel); }
function readf(dir, rel) { return fs.readFileSync(pf(dir, rel), 'utf8'); }
function writef(dir, rel, s) { fs.writeFileSync(pf(dir, rel), s); }

const INFRA = /(SyntaxError|MODULE_NOT_FOUND|Cannot find module|ReferenceError|TypeError:)/;

const MUTATIONS = [
  {
    name: 'prototype included in dist',
    expectedFailure: 'dist/ has no design-review directory',
    apply: function (dir) {
      const d = path.join(dir, 'dist', 'design-review', 'f4a');
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'index.html'), '<!doctype html><title>leak</title>');
      return true;
    }
  },
  {
    name: 'video element added',
    file: 'index.html',
    expectedFailure: 'no <video> element',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('</main>', '<video src="x.mp4"></video></main>')); return true; }
  },
  {
    name: 'remote font src',
    file: 'prototype.css',
    expectedFailure: 'no remote font src',
    apply: function (dir) { writef(dir, 'prototype.css', readf(dir, 'prototype.css').replace("url('./fonts/newsreader-latin-wght-normal.woff2')", "url('https://fonts.example.com/newsreader.woff2')")); return true; }
  },
  {
    name: 'third webfont family',
    file: 'prototype.css',
    expectedFailure: 'only Newsreader and Manrope declared as webfonts',
    apply: function (dir) {
      const add = "@font-face{font-family:'Intruder';src:url('./fonts/manrope-latin-wght-normal.woff2') format('woff2');font-display:swap;}";
      writef(dir, 'prototype.css', readf(dir, 'prototype.css') + '\n' + add); return true;
    }
  },
  {
    name: 'reduced-motion removed',
    file: 'prototype.css',
    expectedFailure: 'css honours prefers-reduced-motion',
    apply: function (dir) { writef(dir, 'prototype.css', readf(dir, 'prototype.css').replace(/@media\s*\(prefers-reduced-motion:reduce\)\{[\s\S]*?\}\s*\}/, '')); return true; }
  },
  {
    name: 'autoplay without pause control',
    file: 'index.html',
    expectedFailure: 'autoplay has a pause control',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace(/data-seq-toggle/g, 'data-seq-noop')); return true; }
  },
  {
    name: 'missing asset (broken local reference)',
    file: 'sequence.js',
    expectedFailure: 'prototype file exists: sequence.js',
    apply: function (dir) { fs.rmSync(pf(dir, 'sequence.js')); return true; }
  },
  {
    name: 'two H1 elements',
    file: 'index.html',
    expectedFailure: 'exactly one H1',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('</main>', '<h1>Second heading</h1></main>')); return true; }
  },
  {
    name: 'invented commercial claim (trusted by)',
    file: 'index.html',
    expectedFailure: 'no invented commercial claim',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('</main>', '<p>Trusted by 4,000 companies worldwide.</p></main>')); return true; }
  },
  {
    name: 'remote image added',
    file: 'index.html',
    expectedFailure: 'no remote http(s) image in html',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('</main>', '<img src="https://stock.example.com/photo.jpg" alt="x"></main>')); return true; }
  },
  {
    name: 'primary button turned verification green (colour misuse)',
    file: 'prototype.css',
    expectedFailure: 'primary button is brass, not verification green',
    apply: function (dir) { writef(dir, 'prototype.css', readf(dir, 'prototype.css').replace('.btn--primary { background:var(--brass); color:var(--deep); }', '.btn--primary { background:var(--true); color:var(--deep); }')); return true; }
  },
  {
    name: 'stage hidden in static HTML (breaks no-JS readability)',
    file: 'index.html',
    expectedFailure: 'no stage carries `hidden` in the static HTML',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('<div class="seq__stage" data-stage="1"', '<div class="seq__stage" data-stage="1" hidden')); return true; }
  },
  {
    name: 'broken fragment link (#nowhere)',
    file: 'index.html',
    expectedFailure: 'resolves to exactly one id',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('href="#solver">Open the solver</a>', 'href="#nowhere">Open the solver</a>')); return true; }
  },
  {
    name: 'placeholder href="#"',
    file: 'index.html',
    expectedFailure: 'no href="#" placeholder links',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('<a class="card__action" href="#solver">Open in the solver</a>', '<a class="card__action" href="#">Open in the solver</a>')); return true; }
  },
  {
    name: 'incomplete-badge contrast broken (warn-text too light)',
    file: 'prototype.css',
    expectedFailure: 'AA contrast >= 4.5 — warn-text on warn-lo',
    apply: function (dir) { writef(dir, 'prototype.css', readf(dir, 'prototype.css').replace('--warn:#B6771E; --warn-text:#8E5A14; --warn-lo:#F6ECD9;', '--warn:#B6771E; --warn-text:#B6771E; --warn-lo:#F6ECD9;')); return true; }
  },
  {
    name: 'seq dot touch target removed',
    file: 'prototype.css',
    expectedFailure: 'seq dots provide a >=24px hit target',
    apply: function (dir) { writef(dir, 'prototype.css', readf(dir, 'prototype.css').replace(/\.seq__dot::before \{[^}]*\}/, '.seq__dot::before { content:""; }')); return true; }
  },
  {
    name: 'fake ARIA tablist reintroduced',
    file: 'index.html',
    expectedFailure: 'do not use role="tablist"',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('<div class="seq__steps" role="group" aria-label="Sequence stages">', '<div class="seq__steps" role="tablist" aria-label="Sequence stages">')); return true; }
  },
  {
    name: 'operable role="toolbar" reintroduced on non-interactive preview',
    file: 'index.html',
    expectedFailure: 'not exposed as an operable role="toolbar"',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('<figure class="toolbar" aria-labelledby="tb-fig-cap">', '<figure class="toolbar" role="toolbar" aria-labelledby="tb-fig-cap">')); return true; }
  },
  {
    name: 'competitor swipe copy reintroduced ("most tools")',
    file: 'index.html',
    expectedFailure: 'no competitor generalisation ("most tools")',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('Plumline does not stop at a number.', 'Most tools hand you a number.')); return true; }
  },
  {
    name: 'footer label turned into H4 (heading skip)',
    file: 'index.html',
    expectedFailure: 'no H4-H6 misused as footer labels',
    apply: function (dir) { writef(dir, 'index.html', readf(dir, 'index.html').replace('<p class="foot__label">Use it</p>', '<h4 class="foot__label">Use it</h4>')); return true; }
  },
  {
    name: 'seq step active state reverted to stale data-on selector',
    file: 'prototype.css',
    expectedFailure: '.seq__step does NOT use data-on as its interactive active selector',
    apply: function (dir) { writef(dir, 'prototype.css', readf(dir, 'prototype.css').replace('.seq__step[aria-current="step"] { color:var(--ink); border-bottom-color:var(--brass); }', '.seq__step[data-on="true"] { color:var(--ink); border-bottom-color:var(--brass); }')); return true; }
  }
];

MUTATIONS.forEach(function (m) {
  const dir = makeTree();
  try {
    let before = null;
    if (m.file && fs.existsSync(pf(dir, m.file))) before = readf(dir, m.file);
    const changed = m.apply(dir);
    let reallyChanged = changed === true;
    if (m.file) {
      const stillThere = fs.existsSync(pf(dir, m.file));
      reallyChanged = reallyChanged && (!stillThere || readf(dir, m.file) !== before);
    }
    ok('negative[' + m.name + ']: mutation applied', reallyChanged, 'no change');
    const r = runSuite(dir);
    const combined = r.out + '\n' + r.err;
    ok('negative[' + m.name + ']: suite exits non-zero', r.code === 1, 'code=' + r.code);
    ok('negative[' + m.name + ']: expected contract failed (' + m.expectedFailure + ')',
      combined.indexOf('FAIL: ') !== -1 && combined.indexOf(m.expectedFailure) !== -1, 'expected "' + m.expectedFailure + '"');
    ok('negative[' + m.name + ']: no infrastructure error', !INFRA.test(combined), (combined.match(INFRA) || [''])[0]);
  } catch (e) {
    ok('negative[' + m.name + ']: harness ran', false, 'threw: ' + String(e.message).slice(0, 80));
  } finally { cleanup(dir); }
});

(function () {
  const dir = makeTree();
  try {
    const r = runSuite(dir);
    ok('negative[control]: clean prototype passes', r.code === 0 && (r.out + r.err).indexOf('FAIL: ') === -1, 'code=' + r.code);
    ok('negative[control]: no infrastructure error', !INFRA.test(r.out + r.err));
  } finally { cleanup(dir); }
})();

(function () {
  const self = fs.readFileSync(path.join(__dirname, 'tests_f4a_visual_direction_negative.js'), 'utf8');
  ['cp', 'rm', 'mv', 'sed', 'grep', 'bash', 'sh', 'cmd', 'powershell'].forEach(function (cmd) {
    const re = new RegExp('(?:execFileSync|execSync|spawnSync|spawn)\\s*\\(\\s*[\x27"]' + cmd + '[\x27"]');
    ok('negative: suite does not shell out to "' + cmd + '"', !re.test(self), cmd);
  });
  ok('negative: runs the F4a suite via process.execPath', /execFileSync\(process\.execPath/.test(self) || /cp\.execFileSync\(process\.execPath/.test(self));
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F4A VISUAL DIRECTION NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
