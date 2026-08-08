'use strict';

/*
 * Checkpoint F4b — design system contracts (negative mutations).
 *
 * Each mutation copies everything the positive suite reads — the design system,
 * the showcase, the docs, the font binaries, the protected-production baseline
 * manifest AND the real production/infra files it pins — into an isolated temp
 * directory whose path contains a SPACE, applies one breaking change, runs the
 * positive suite against that copy, and asserts it now FAILS naming the expected
 * contract. The temp copy is always removed in finally. Windows-portable: Node
 * fs/path/child_process.execFileSync(process.execPath) only — no Unix commands.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const siteDir = path.join(__dirname, '..');
const suite = path.join(__dirname, 'tests_f4b_design_system.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

function rf(p) { return fs.readFileSync(p, 'utf8'); }
function wf(p, s) { fs.writeFileSync(p, s); }
function rb(p) { return fs.readFileSync(p); }
function wb(p, b) { fs.writeFileSync(p, b); }

function runSuiteIn(tmpSite) {
  const tmpEngine = path.join(tmpSite, 'engine');
  fs.mkdirSync(tmpEngine, { recursive: true });
  fs.copyFileSync(suite, path.join(tmpEngine, 'tests_f4b_design_system.js'));
  try {
    const out = execFileSync(process.execPath, [path.join(tmpEngine, 'tests_f4b_design_system.js')], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status || 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const protectedManifest = (function () {
  try { return JSON.parse(rf(path.join(__dirname, 'f4b-protected-baseline.json'))); } catch (e) { return { files: [] }; }
})();

function makeCopy() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'f4b neg ')); // note the space
  const site = path.join(base, 'site');
  fs.mkdirSync(site, { recursive: true });
  fs.cpSync(path.join(siteDir, 'src'), path.join(site, 'src'), { recursive: true });
  fs.cpSync(path.join(siteDir, 'design-review', 'f4b'), path.join(site, 'design-review', 'f4b'), { recursive: true });
  fs.mkdirSync(path.join(site, 'docs'), { recursive: true });
  fs.copyFileSync(path.join(siteDir, 'docs', 'checkpoint-f4b-design-system-components.md'), path.join(site, 'docs', 'checkpoint-f4b-design-system-components.md'));
  fs.mkdirSync(path.join(site, 'engine'), { recursive: true });
  fs.copyFileSync(path.join(siteDir, 'engine', 'f4b-protected-baseline.json'), path.join(site, 'engine', 'f4b-protected-baseline.json'));
  (protectedManifest.files || []).forEach(entry => {
    const src = path.join(siteDir, entry.path);
    if (!fs.existsSync(src)) return;
    const dst = path.join(site, entry.path);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  });
  return { base, site };
}

const DS = ['src', 'shared', 'design-system'];
function dsFile(site, name) { return path.join(site, ...DS, name); }
function showFile(site, name) { return path.join(site, 'design-review', 'f4b', name); }
function docFile(site) { return path.join(site, 'docs', 'checkpoint-f4b-design-system-components.md'); }

const mutations = [
  { n: 'semantic alias -> nonexistent token', expect: 'nonexistent token',
    mut: s => { const p = dsFile(s, '02-semantic.css'); wf(p, rf(p).replace('var(--pl-cream-100)', 'var(--pl-cream-999)')); } },
  { n: 'alias cycle introduced', expect: 'cycles',
    mut: s => { const p = dsFile(s, '02-semantic.css'); wf(p, rf(p) + '\n:root{--pl-cyc-a:var(--pl-cyc-b);--pl-cyc-b:var(--pl-cyc-a);}\n'); } },
  { n: 'raw brand colour inside a component', expect: 'no raw hex inside component',
    mut: s => { const p = dsFile(s, '06-components.css'); wf(p, rf(p).replace('.pl-button--primary { background:var(--pl-color-action-primary);', '.pl-button--primary { background:#B5822E;')); } },
  { n: 'component uses a PRIMITIVE where a semantic is required', expect: 'direct primitive token use',
    mut: s => { const p = dsFile(s, '06-components.css'); wf(p, rf(p).replace('background:var(--pl-color-bg-surface); border:var(--pl-border-width)', 'background:var(--pl-white); border:var(--pl-border-width)')); } },
  { n: 'semantic reintroduces a raw brand hex', expect: 'semantic layer contains no raw hex',
    mut: s => { const p = dsFile(s, '02-semantic.css'); wf(p, rf(p).replace('--pl-color-bg-canvas:var(--pl-cream-100);', '--pl-color-bg-canvas:#F5F2EB;')); } },
  { n: 'semantic inverse-muted uses literal channels (breaks re-theme)', expect: 'derived from a primitive colour token',
    mut: s => { const p = dsFile(s, '02-semantic.css'); wf(p, rf(p).replace(/--pl-color-text-inverse-muted:color-mix\([^;]*\);/, '--pl-color-text-inverse-muted:rgba(245,242,235,.78);')); } },
  { n: 'cream-100 re-introduces a manually-synced RGB sibling', expect: 'no duplicated --pl-cream-100-rgb sibling',
    mut: s => { const p = dsFile(s, '01-primitives.css'); wf(p, rf(p).replace('--pl-cream-100:#F5F2EB;', '--pl-cream-100:#F5F2EB;\n  --pl-cream-100-rgb:245,242,235; /* keep in sync with --pl-cream-100 */')); const q = dsFile(s, '02-semantic.css'); wf(q, rf(q).replace(/--pl-color-text-inverse-muted:color-mix\([^;]*\);/, '--pl-color-text-inverse-muted:rgba(var(--pl-cream-100-rgb),.78);')); } },
  { n: 'remote Google Font @import', expect: 'remote',
    mut: s => { const p = dsFile(s, '05-fonts.css'); wf(p, "@import url('https://fonts.googleapis.com/css2?family=Inter');\n" + rf(p)); } },
  { n: 'third webfont family declared', expect: 'Newsreader + Manrope',
    mut: s => { const p = dsFile(s, '05-fonts.css'); wf(p, rf(p) + "\n@font-face{font-family:'Inter';src:url('./fonts/inter.woff2') format('woff2');font-weight:200 800;font-display:swap;}\n"); } },
  { n: 'missing font license', expect: 'OFL licenses',
    mut: s => { fs.rmSync(dsFile(s, path.join('fonts', 'Manrope-OFL.txt')), { force: true }); } },
  { n: 'missing accented glyph subset (latin-ext removed)', expect: 'font asset exists: manrope-latin-ext',
    mut: s => { fs.rmSync(dsFile(s, path.join('fonts', 'manrope-latin-ext-wght-normal.woff2')), { force: true }); } },
  { n: 'unsupported claim for maths operators', expect: 'do NOT claim to cover',
    mut: s => { const p = dsFile(s, '05-fonts.css'); wf(p, rf(p).replace('NOT covered:  \u2264  \u2265  \u2192', 'also covers \u2264 \u2265 \u2192')); } },
  { n: 'audited WOFF2 bytes altered (integrity break)', expect: 'SHA-256 matches audited manifest',
    mut: s => { const p = dsFile(s, path.join('fonts', 'manrope-latin-wght-normal.woff2')); const b = Buffer.from(rb(p)); b[b.length - 1] = b[b.length - 1] ^ 0xFF; wb(p, b); } },
  { n: 'nonexistent local font asset', expect: 'font asset exists: newsreader-latin-wght',
    mut: s => { fs.rmSync(dsFile(s, path.join('fonts', 'newsreader-latin-wght-normal.woff2')), { force: true }); } },
  { n: '!important introduced', expect: 'no !important',
    mut: s => { const p = dsFile(s, '06-components.css'); wf(p, rf(p).replace('cursor:pointer; text-decoration:none;', 'cursor:pointer !important; text-decoration:none;')); } },
  { n: 'styling by ID', expect: 'style by ID',
    mut: s => { const p = dsFile(s, '06-components.css'); wf(p, rf(p) + '\n#pl-hero { color:var(--pl-color-text-primary); }\n'); } },
  { n: 'keyframes introduced', expect: 'no @keyframes',
    mut: s => { const p = dsFile(s, '06-components.css'); wf(p, rf(p) + '\n@keyframes pulse{from{opacity:.5}to{opacity:1}}\n'); } },
  { n: 'focus-visible removed', expect: 'focus-visible',
    mut: s => { const p = dsFile(s, '03-base.css'); wf(p, rf(p).replace(/\.pl-root :focus-visible \{[^}]*\}/, '')); } },
  { n: 'contrast token below AA', expect: 'AA contrast',
    mut: s => { const p = dsFile(s, '01-primitives.css'); wf(p, rf(p).replace('--pl-ink-500:#5A5E50;', '--pl-ink-500:#AEB0A6;')); } },
  { n: 'tiny interactive target', expect: 'comfortable tap-min',
    mut: s => { const p = dsFile(s, '06-components.css'); wf(p, rf(p).replace('min-height:var(--pl-target-comfortable); padding:0 var(--pl-pad-inset);', 'min-height:12px; padding:0 var(--pl-pad-inset);')); } },
  { n: 'status markers no longer geometrically distinct', expect: 'geometrically distinct',
    mut: s => { const p = dsFile(s, '06-components.css'); let c = rf(p);
      c = c.replace(/\.pl-badge--unbounded::before \{[^}]*\}/, '.pl-badge--unbounded::before { border-radius:50%; background:var(--pl-color-process); }');
      c = c.replace(/\.pl-badge--neutral::before \{[^}]*\}/, '.pl-badge--neutral::before { border-radius:50%; background:var(--pl-color-text-muted); }');
      wf(p, c); } },
  { n: 'status markers removed entirely (colour-only)', expect: 'shape marker',
    mut: s => { const p = dsFile(s, '06-components.css'); let c = rf(p); c = c.replace(/\.pl-badge--\w+::before \{[^}]*\}\n?/g, ''); c = c.replace(/\.pl-badge::before \{[^}]*\}\n?/g, ''); wf(p, c); } },
  { n: 'fake solver link back to a showcase fragment', expect: 'navigates to the real solver.html',
    mut: s => { const p = showFile(s, 'index.html'); wf(p, rf(p).replace('<a class="pl-action-link" href="../../solver.html">Open solver</a>', '<a class="pl-action-link" href="#s11">Open solver</a>')); } },
  { n: 'fake href="#" placeholder link', expect: 'no href="#" placeholder',
    mut: s => { const p = showFile(s, 'index.html'); wf(p, rf(p).replace('<a class="pl-action-link" href="../../solver.html">Open solver</a>', '<a class="pl-action-link" href="#">Open solver</a>')); } },
  { n: 'fragment target missing', expect: 'resolves to one id',
    mut: s => { const p = showFile(s, 'index.html'); wf(p, rf(p).replace('<h2 class="pl-h2" id="s1">Typography</h2>', '<h2 class="pl-h2">Typography</h2>')); } },
  { n: 'dishonest copy reintroduced ("into a proof")', expect: 'generic "into a proof"',
    mut: s => { const p = showFile(s, 'index.html'); wf(p, rf(p).replace('Turn a spreadsheet into a checked answer', 'Turn a spreadsheet into a proof')); } },
  { n: 'dishonest copy reintroduced ("Measured, not estimated")', expect: '"Measured, not estimated"',
    mut: s => { const p = showFile(s, 'index.html'); wf(p, rf(p).replace('Calculated, then checked', 'Measured, not estimated')); } },
  { n: 'generic "verification proof" reintroduced in the checkpoint doc', expect: 'avoids a generic "verification proof"',
    mut: s => { const p = docFile(s); wf(p, rf(p).replace('| pl-receipt | Verified result summary |', '| pl-receipt | Verification proof |')); } },
  { n: 'broken showcase import', expect: 'imports the canonical',
    mut: s => { const p = showFile(s, 'index.html'); wf(p, rf(p).replace('../../src/shared/design-system/index.css', './local-copy.css')); } },
  { n: 'duplicate tokens inside showcase', expect: 'does not define --pl-*',
    mut: s => { const p = showFile(s, 'showcase.css'); wf(p, ':root{--pl-color-bg-canvas:#fff;}\n' + rf(p)); } },
  { n: 'design-review referenced by vite (would reach dist)', expect: 'PAGES list excludes the showcase',
    mut: s => { const vite = fs.existsSync(path.join(s, 'vite.config.mjs')) ? 'vite.config.mjs' : 'vite.config.js'; const p = path.join(s, vite); wf(p, rf(p) + "\n// design-review/f4b/index.html\n"); } },
  { n: 'protected production file changed (index.html)', expect: 'protected production hash changed? index.html',
    mut: s => { const p = path.join(s, 'index.html'); if (fs.existsSync(p)) wf(p, rf(p).replace('</body>', '<!-- injected -->\n</body>')); } },
  { n: 'protected production file changed (assets/plumline.css)', expect: 'protected production hash changed? assets/plumline.css',
    mut: s => { const p = path.join(s, 'assets', 'plumline.css'); if (fs.existsSync(p)) wf(p, rf(p) + '\n.injected{color:red}\n'); } },
  { n: 'protected infra changed (vite.config.mjs)', expect: 'protected production hash changed? vite.config.mjs',
    mut: s => { const p = path.join(s, 'vite.config.mjs'); if (fs.existsSync(p)) wf(p, rf(p) + '\n// tamper\n'); } },
  { n: 'protected set silently reduced (non-core catalogue path removed from manifest)', expect: 'expected protected path missing: src/shared/examples/serialize.js',
    mut: s => { const p = path.join(s, 'engine', 'f4b-protected-baseline.json'); const m = JSON.parse(rf(p)); m.files = m.files.filter(f => f.path !== 'src/shared/examples/serialize.js'); wf(p, JSON.stringify(m, null, 2)); } },
  { n: 'roadmap says Home belongs to F4b', expect: 'Home belongs to F4b',
    mut: s => { const p = docFile(s); wf(p, rf(p).replace('F9 owns the narrative Home redesign.', 'The Home is F4b. The Home belongs to F4b.')); } },
  { n: 'roadmap says public pages belong to F4c', expect: 'public pages belong to F4c',
    mut: s => { const p = docFile(s); wf(p, rf(p).replace('F10 owns the redesign of the rest', 'The public pages belong to F4c. F4c redesigns the public Solver and Examples. Rest')); } },
];

mutations.forEach((m, i) => {
  const { base, site } = makeCopy();
  try {
    m.mut(site);
    const res = runSuiteIn(site);
    const brokeOverall = res.code !== 0;
    const namedContract = m.expect ? res.out.indexOf(m.expect) !== -1 : true;
    ok('M' + (i + 1) + ': "' + m.n + '" breaks the contract', brokeOverall, 'exit=' + res.code);
    ok('M' + (i + 1) + ': "' + m.n + '" fails for the expected reason', brokeOverall && namedContract, 'expected "' + m.expect + '"');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

if (require.main === module) {
  failures.forEach(f => console.log('  FAIL: ' + f));
  console.log('F4B DESIGN SYSTEM NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail + '   (mutations: ' + mutations.length + ')');
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass, fail, mutations: mutations.length };
