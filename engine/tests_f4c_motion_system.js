'use strict';
/* ============================================================================
   Checkpoint F4c — motion system contracts (positive).
   Validates the motion system for real: baseline/protection, architecture,
   tokens, CSS policy, progressive enhancement, preference, observer, timers,
   pause-state, sequence, accessibility, roadmap ownership.
   Windows-portable: Node fs/path/crypto only, no external commands.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const siteDir = path.join(__dirname, '..');
const motionDir = path.join(siteDir, 'src', 'shared', 'motion');
const dsDir = path.join(siteDir, 'src', 'shared', 'design-system');
const labDir = path.join(siteDir, 'design-review', 'f4c');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }
function sha256(p) { return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null; }
function strip(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
function stripJs(js) { return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); }

const tokens = read(path.join(motionDir, 'tokens.css'));
const primitives = read(path.join(motionDir, 'primitives.css'));
const motionCss = tokens + '\n' + primitives;
const preferenceJs = read(path.join(motionDir, 'preference.js'));
const lifecycleJs = read(path.join(motionDir, 'lifecycle.js'));
const revealJs = read(path.join(motionDir, 'reveal.js'));
const sequenceJs = read(path.join(motionDir, 'sequence.js'));
const allJs = preferenceJs + '\n' + lifecycleJs + '\n' + revealJs + '\n' + sequenceJs;
const labHtml = read(path.join(labDir, 'index.html'));
const labCss = read(path.join(labDir, 'lab.css'));
const labJs = read(path.join(labDir, 'lab.js'));

// ======================================================================
// BASELINE / INTEGRITY — protected production (exact set of 22)
// ======================================================================
// The expected protected set is fixed HERE (independently of any manifest), so a
// manifest cannot silently drop a path. F4c reuses the F4b baseline manifest for
// the SHA-256 values but the authoritative list lives in the contract.
(function () {
  const EXPECTED = [
    'index.html', 'solver.html', 'examples.html', 'capabilities.html', 'guide.html',
    'about.html', 'privacy.html', 'terms.html',
    'assets/plumline.css', 'assets/i18n.js', 'assets/examples-data.js', 'assets/product-capabilities.js',
    'vite.config.mjs', 'package.json', 'package-lock.json',
    'engine/fragments/solver-ui/solve-worker-client.js', 'engine/generate-engine-mirror.js',
    'src/shared/examples/catalogue.js', 'src/shared/examples/index.js',
    'src/shared/examples/projectors.js', 'src/shared/examples/schema.js', 'src/shared/examples/serialize.js',
  ];
  ok('PP0: expected protected production set is exactly 22 paths', EXPECTED.length === 22, String(EXPECTED.length));
  const mPath = path.join(__dirname, 'f4b-protected-baseline.json');
  ok('PP1: protected-baseline manifest exists', fs.existsSync(mPath));
  if (!fs.existsSync(mPath)) return;
  let man; try { man = JSON.parse(read(mPath)); } catch (e) { ok('PP1: manifest parses', false, e.message); return; }
  const files = man.files || [];
  const mp = files.map(f => f.path); const mset = new Set(mp); const eset = new Set(EXPECTED);
  ok('PP1: manifest has exactly 22 entries', files.length === 22, String(files.length));
  ok('PP1: manifest has no duplicate path', mset.size === mp.length);
  EXPECTED.forEach(p => ok('PP1: expected protected path present: ' + p, mset.has(p), 'expected protected path missing: ' + p));
  mp.forEach(p => ok('PP1: manifest path is expected: ' + p, eset.has(p), 'unexpected protected path: ' + p));
  EXPECTED.forEach(p => {
    const entry = files.find(f => f.path === p); const fp = path.join(siteDir, p);
    ok('PP2: protected production file exists: ' + p, fs.existsSync(fp));
    if (!fs.existsSync(fp) || !entry) return;
    ok('PP2: protected production hash changed? ' + p, sha256(fp) === entry.sha256);
    ok('PP2: protected production byte size matches: ' + p, fs.statSync(fp).size === entry.bytes);
  });
})();

// ======================================================================
// BASELINE / INTEGRITY — protected F4b static system (exact set)
// ======================================================================
// F4c must be ADDITIVE. It promises not to modify the F4b static design system.
// The expected F4b static set is fixed HERE; the F4c baseline manifest supplies
// the SHA-256, and the contract requires exact membership + hash match.
(function () {
  const EXPECTED = [
    'src/shared/design-system/01-primitives.css', 'src/shared/design-system/02-semantic.css',
    'src/shared/design-system/03-base.css', 'src/shared/design-system/04-layout.css',
    'src/shared/design-system/05-fonts.css', 'src/shared/design-system/06-components.css',
    'src/shared/design-system/07-forms.css', 'src/shared/design-system/08-instrument.css',
    'src/shared/design-system/09-utilities.css', 'src/shared/design-system/index.css',
    'src/shared/design-system/fonts/FONT-AUDIT.json',
    'src/shared/design-system/fonts/Manrope-OFL.txt', 'src/shared/design-system/fonts/Newsreader-OFL.txt',
    'src/shared/design-system/fonts/manrope-latin-ext-wght-normal.woff2',
    'src/shared/design-system/fonts/manrope-latin-wght-normal.woff2',
    'src/shared/design-system/fonts/newsreader-latin-ext-wght-normal.woff2',
    'src/shared/design-system/fonts/newsreader-latin-wght-normal.woff2',
    // F4b stable component reference (created in F4b as the stable reference for
    // future checkpoints) — protected by F4c.
    'docs/design-system-components.md',
    // Historical design-review artifacts F4c must not disturb.
    'design-review/f4a/index.html', 'design-review/f4a/prototype.css', 'design-review/f4a/sequence.js',
    'design-review/f4b/index.html', 'design-review/f4b/showcase.css',
  ];
  ok('PF0: expected F4b/F4a static set is exactly 23 paths', EXPECTED.length === 23, String(EXPECTED.length));
  const mPath = path.join(__dirname, 'f4c-protected-baseline.json');
  ok('PF1: F4c protected-baseline manifest exists', fs.existsSync(mPath));
  if (!fs.existsSync(mPath)) return;
  let man; try { man = JSON.parse(read(mPath)); } catch (e) { ok('PF1: manifest parses', false, e.message); return; }
  const files = man.files || [];
  const mp = files.map(f => f.path); const mset = new Set(mp); const eset = new Set(EXPECTED);
  ok('PF1: F4c manifest has exactly 23 entries', files.length === 23, String(files.length));
  ok('PF1: F4c manifest has no duplicate path', mset.size === mp.length);
  EXPECTED.forEach(p => ok('PF1: expected F4b-static path present: ' + p, mset.has(p), 'expected protected path missing: ' + p));
  mp.forEach(p => ok('PF1: F4c manifest path is expected: ' + p, eset.has(p), 'unexpected protected path: ' + p));
  EXPECTED.forEach(p => {
    const entry = files.find(f => f.path === p); const fp = path.join(siteDir, p);
    ok('PF2: protected F4b-static file exists: ' + p, fs.existsSync(fp));
    if (!fs.existsSync(fp) || !entry) return;
    ok('PF2: protected F4b-static hash changed? ' + p, sha256(fp) === entry.sha256);
  });
})();

// Font integrity vs FONT-AUDIT (unchanged by F4c).
(function () {
  const auditPath = path.join(dsDir, 'fonts', 'FONT-AUDIT.json');
  if (!fs.existsSync(auditPath)) { ok('F8: FONT-AUDIT.json exists', false); return; }
  const audit = JSON.parse(read(auditPath));
  (audit.fonts || []).forEach(entry => {
    const fp = path.join(dsDir, 'fonts', entry.filename);
    ok('F8: font asset unchanged by F4c: ' + entry.filename, sha256(fp) === entry.sha256);
  });
})();

// ======================================================================
// ARCHITECTURE
// ======================================================================
ok('A1: canonical motion source exists', fs.existsSync(path.join(motionDir, 'index.css')) && fs.existsSync(path.join(motionDir, 'index.js')));
ok('A1: motion tokens file exists', fs.existsSync(path.join(motionDir, 'tokens.css')));
ok('A1: motion primitives file exists', fs.existsSync(path.join(motionDir, 'primitives.css')));
ok('A2: motion lives outside the F4b design system', !fs.existsSync(path.join(dsDir, 'motion')));
// No duplicated motion-token definitions: --pl-motion-* defined ONLY in tokens.css.
(function () {
  const defsInPrimitives = (strip(primitives).match(/--pl-motion-[a-z0-9-]+\s*:/g) || []);
  ok('A3: motion tokens are defined only in tokens.css (none in primitives)', defsInPrimitives.length === 0, defsInPrimitives.join(','));
  const defsInLab = (strip(labCss).match(/--pl-motion-[a-z0-9-]+\s*:/g) || []);
  ok('A3: lab does not define motion tokens', defsInLab.length === 0, defsInLab.join(','));
})();
// Lab consumes canonical F4b + F4c sources; does not copy component/token CSS.
ok('A4: lab imports canonical design system', /href="\.\.\/\.\.\/src\/shared\/design-system\/index\.css"/.test(labHtml));
ok('A4: lab imports canonical motion system', /href="\.\.\/\.\.\/src\/shared\/motion\/index\.css"/.test(labHtml));
ok('A4: lab does not define design-system tokens', !/--pl-(cream|green|brass|ink|amber|red)-\d/.test(strip(labCss)));
ok('A4: lab css introduces no raw brand hex', (strip(labCss).match(/#[0-9A-Fa-f]{3,8}\b/g) || []).length === 0);
// No circular local imports among motion JS modules.
(function () {
  const graph = { 'index.js': read(path.join(motionDir, 'index.js')), 'preference.js': preferenceJs, 'lifecycle.js': lifecycleJs, 'reveal.js': revealJs, 'sequence.js': sequenceJs };
  function requires(src) { return (src.match(/require\('\.\/([a-z]+\.js)'\)/g) || []).map(s => s.match(/\.\/([a-z]+\.js)/)[1]); }
  // index depends on others; others must NOT depend on index (no cycle).
  ['preference.js', 'lifecycle.js', 'reveal.js', 'sequence.js'].forEach(f => {
    ok('A5: ' + f + ' does not require index.js (no cycle)', requires(graph[f]).indexOf('index.js') === -1);
  });
  // reveal/sequence may reference lifecycle/preference via window at runtime, not via require cycle.
  ok('A5: no module requires itself', Object.keys(graph).every(f => requires(graph[f]).indexOf(f) === -1));
})();

// ======================================================================
// MOTION TOKENS
// ======================================================================
(function () {
  const durs = (strip(tokens).match(/--pl-motion-duration-[a-z]+\s*:/g) || []);
  const eases = (strip(tokens).match(/--pl-motion-ease-[a-z]+\s*:/g) || []);
  const dists = (strip(tokens).match(/--pl-motion-distance-[a-z]+\s*:/g) || []);
  ok('T1: finite duration set (exactly 5)', durs.length === 5, String(durs.length));
  ok('T2: finite easing set (3-5 curves)', eases.length >= 3 && eases.length <= 5, String(eases.length));
  ok('T3: finite distance set (exactly 3)', dists.length === 3, String(dists.length));
  ok('T4: stagger step + max are tokenised', /--pl-motion-stagger-step\s*:/.test(tokens) && /--pl-motion-stagger-max\s*:/.test(tokens));
  // No duplicate token definitions.
  const all = (strip(tokens).match(/(--pl-motion-[a-z0-9-]+)\s*:/g) || []).map(s => s.replace(/\s*:$/, ''));
  ok('T5: no duplicate motion-token definitions', new Set(all).size === all.length);
})();

// ======================================================================
// NO RAW MOTION VALUES in primitives (durations/easings come from tokens)
// ======================================================================
(function () {
  const body = strip(primitives);
  // No raw millisecond durations inside transition/animation declarations
  // (they must reference var(--pl-motion-duration-*)). transition-delay may use
  // 0ms (a no-delay reset) and calc() with the stagger token; we scan only the
  // duration position of transition/animation, not transition-delay.
  const rawMs = (body.match(/(?:^|[^-])(?:transition|animation)\s*:[^;{}]*?\b\d+ms/g) || []).filter(s => !/var\(--pl-motion-duration/.test(s));
  ok('R1: no raw ms duration in primitive transition/animation (use tokens)', rawMs.length === 0, rawMs.join(' | '));
  // No raw cubic-bezier in primitives (must use easing tokens).
  const rawBez = (body.match(/cubic-bezier\([^)]*\)/g) || []);
  ok('R2: no raw cubic-bezier in primitives (use easing tokens)', rawBez.length === 0, rawBez.join(' | '));
  // cubic-bezier only appears in tokens.css.
  ok('R2: cubic-bezier defined only in tokens.css', (strip(tokens).match(/cubic-bezier/g) || []).length >= 3);
})();

// ======================================================================
// CSS POLICY
// ======================================================================
(function () {
  const body = strip(motionCss);
  ok('C1: no `transition: all`', !/transition\s*:\s*all\b/.test(body) && !/transition-property\s*:\s*all\b/.test(body));
  ok('C2: no infinite animation-iteration-count', !/animation-iteration-count\s*:\s*infinite/.test(body));
  ok('C2: no `infinite` keyword in animation shorthand', !/animation\s*:[^;]*\binfinite\b/.test(body));
  // will-change: F4c ships NONE by default (no profiling has shown a need). The
  // contract forbids it entirely in the motion CSS; a future checkpoint may add a
  // scoped, lifecycle-limited one with evidence. We do NOT require it to exist.
  ok('C3: no will-change in motion CSS (no profiling evidence)', !/will-change\s*:/.test(body));
  ok('C3: certainly no universal (*) will-change', !/\*\s*\{[^}]*will-change/.test(body));
  // No unauthorized layout properties animated. Scan transition/animation values
  // and keyframes for forbidden properties.
  const forbidden = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding', 'grid-template', 'filter'];
  // transition-property lists
  const transProps = (body.match(/transition\s*:[^;{}]*/g) || []).join(' ') + ' ' + (body.match(/transition-property\s*:[^;{}]*/g) || []).join(' ');
  forbidden.forEach(p => ok('C4: motion does not transition layout property ' + p, !new RegExp('\\b' + p + '\\b').test(transProps.replace(/box-shadow/g, ''))));
  // keyframes animate only transform/opacity (compositor-friendly)
  const kfBlocks = body.match(/@keyframes[^{]+\{[\s\S]*?\}\s*\}/g) || [];
  kfBlocks.forEach((kf, idx) => {
    const props = (kf.match(/\b([a-z-]+)\s*:/g) || []).map(s => s.replace(/\s*:$/, '')).filter(p => p !== 'from' && p !== 'to');
    const bad = props.filter(p => forbidden.indexOf(p) !== -1);
    ok('C4: keyframe #' + (idx + 1) + ' animates no layout property', bad.length === 0, bad.join(','));
  });
  ok('C5: no remote url() in motion css', !/url\((?!['"]?\.\/)(?!['"]?\.\.\/)['"]?https?:/.test(body) && !/googleapis|gstatic/.test(body));
})();

// ======================================================================
// KEYFRAMES: each has a consumer and reduced handling
// ======================================================================
(function () {
  const names = (strip(primitives).match(/@keyframes\s+([a-z0-9-]+)/gi) || []).map(s => s.replace(/@keyframes\s+/i, ''));
  ok('K1: keyframes exist and are named', names.length >= 1, names.join(','));
  const reducedBlock = (strip(primitives).match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\}/) || [''])[0];
  names.forEach(n => {
    // consumer: some rule uses `animation: <name>` or `animation-name: <name>`
    const consumed = new RegExp('animation(?:-name)?\\s*:[^;]*\\b' + n + '\\b').test(strip(primitives));
    ok('K2: keyframe has a real consumer: ' + n, consumed);
    // reduced handling: the reduced block neutralises the consumer (animation:none) —
    // we require the reduced block to reference the consuming class or set animation:none.
    ok('K3: keyframe has reduced-motion handling: ' + n, /animation\s*:\s*none/.test(reducedBlock));
  });
  ok('K4: a reduced-motion block exists', /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(primitives));
})();

// ======================================================================
// PROGRESSIVE ENHANCEMENT
// ======================================================================
(function () {
  const body = strip(primitives);
  // FEATURE-SPECIFIC GATE (no global coupling). The reveal opacity:0 start-state
  // must apply ONLY to a target the reveal controller armed (.pl-reveal-armed),
  // NOT via a global `.pl-motion` gate. Likewise the state enter start-state must
  // require .pl-motion-state-armed.
  const revealGated = /\.pl-reveal\.pl-reveal-armed\s*\{[^}]*opacity\s*:\s*0/.test(body);
  const rules = body.match(/[^{}]+\{[^}]*\}/g) || [];
  // Ungated reveal: a `.pl-reveal` rule with opacity:0 that does NOT require the
  // armed flag.
  const revealUngated = rules.some(r => {
    const sel = r.split('{')[0]; const decl = r.split('{')[1] || '';
    return /(^|,|\s)\.pl-reveal\b/.test(sel) && !/\.pl-reveal-armed\b/.test(sel) && /opacity\s*:\s*0\b/.test(decl);
  });
  ok('E1: reveal start-state requires the feature-specific armed flag', revealGated && !revealUngated);
  // State enter start-state must require .pl-motion-state-armed (not global, not raw).
  const stateGated = /\.pl-motion-state-enter\.pl-motion-state-armed\s*\{[^}]*opacity\s*:\s*0/.test(body);
  const stateUngated = rules.some(r => {
    const sel = r.split('{')[0]; const decl = r.split('{')[1] || '';
    return /\.pl-motion-state-enter\b/.test(sel) && !/\.pl-motion-state-armed\b/.test(sel) && /opacity\s*:\s*0\b/.test(decl);
  });
  ok('E1b: state enter start-state requires the feature-specific armed flag', stateGated && !stateUngated);
  // NO global .pl-motion coupling anywhere: neither the CSS nor a controller may
  // add a global .pl-motion flag on <html> / documentElement.
  ok('E2: no global `.pl-motion ` descendant gate in motion CSS', !/\.pl-motion\s+\.pl-reveal/.test(body) && !/\.pl-motion\s+\.pl-seq/.test(body));
  ok('E2b: reveal controller adds NO global flag', !/documentElement\.classList\.add\('pl-motion'\)/.test(revealJs) && !/classList\.add\('pl-motion'\)/.test(revealJs));
  ok('E2c: sequence controller adds NO global flag', !/documentElement\.classList\.add\('pl-motion'\)/.test(sequenceJs) && !/classList\.add\('pl-motion'\)/.test(sequenceJs));
  // Lab HTML does not hardcode any enhancement flag or the state start-state.
  ok('E2d: lab HTML does not hardcode an armed/enhancement flag on <html>', !/<html[^>]*class="[^"]*pl-(motion|reveal-armed|seq--enhanced)/.test(labHtml));
  ok('E2e: lab HTML does not hardcode the state enter start-state class', !/class="[^"]*pl-motion-state-enter/.test(labHtml));
  // Reveal controller arms managed targets (feature-specific ownership).
  ok('E3: reveal controller arms managed targets with .pl-reveal-armed', /classList\.add\('pl-reveal-armed'\)/.test(revealJs));
  ok('E3b: reveal destroy un-arms targets (leaves them visible)', /classList\.remove\('pl-reveal-armed'\)/.test(revealJs));
  // Sequence enhancement is feature-specific (.pl-seq--enhanced), not global.
  ok('E3c: sequence enhancement uses .pl-seq--enhanced', /classList\.add\('pl-seq--enhanced'\)/.test(sequenceJs));
  // No-JS sequence readable: stages are not hidden by default in CSS.
  ok('E4: sequence stages are not hidden by default (readable without JS)', !rules.some(r => { const sel = r.split('{')[0]; const decl = r.split('{')[1] || ''; return /(^|,|\s)\.pl-seq__stage\b/.test(sel) && !/\.pl-seq--enhanced/.test(sel) && /display\s*:\s*none/.test(decl); }));
  // No-JS: interactive controls ARE hidden by default and revealed under enhancement.
  ok('E4b: sequence controls hidden by default (no dead controls without JS)', /\.pl-seq__controls\s*\{[^}]*display\s*:\s*none/.test(body) || /\.pl-seq__steps,\s*\n?\s*\.pl-seq__controls\s*\{[^}]*display\s*:\s*none/.test(body));
  ok('E4c: sequence controls shown under .pl-seq--enhanced', /\.pl-seq--enhanced\s+\.pl-seq__controls\s*\{[^}]*display/.test(body));

  // Sequence stage ENTER must be REAL motion, not a dead opacity transition that
  // cannot interpolate from display:none (audited final regression 1).
  // (a) No `.pl-seq__stage` rule may declare a bare opacity TRANSITION (the stage
  //     is toggled via the `hidden` attribute -> display:none, so it is dead CSS).
  const deadStageTransition = rules.some(r => {
    const sel = r.split('{')[0]; const decl = r.split('{')[1] || '';
    return /(^|,|\s)\.pl-seq__stage\b/.test(sel) && !/:not\(\[hidden\]\)/.test(sel) && /transition\s*:[^;]*opacity/.test(decl);
  });
  ok('E5: no dead opacity transition on .pl-seq__stage (hidden toggles display)', !deadStageTransition);
  // (b) The enter is a one-shot animation gated under .pl-seq--enhanced on the
  //     visible stage, with a real keyframe consumer.
  ok('E5b: enhanced visible stage runs a real one-shot enter animation', /\.pl-seq--enhanced\s+\.pl-seq__stage:not\(\[hidden\]\)\s*\{[^}]*animation\s*:\s*pl-seq-stage-in/.test(body));
  ok('E5c: pl-seq-stage-in keyframe exists', /@keyframes\s+pl-seq-stage-in\s*\{/.test(body));
  // (c) The keyframe animates ONLY opacity (no transform/layout).
  (function () {
    const kf = (body.match(/@keyframes\s+pl-seq-stage-in\s*\{[\s\S]*?\}\s*\}/) || [''])[0];
    ok('E5d: pl-seq-stage-in animates opacity only', /opacity/.test(kf) && !/transform|width|height|top|left|margin|padding/.test(kf));
  })();
  // (d) Reduced motion explicitly disables the stage enter (no animation).
  ok('E5e: reduced motion disables the sequence stage enter', /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pl-seq--enhanced\s+\.pl-seq__stage:not\(\[hidden\]\)\s*\{[^}]*animation\s*:\s*none/.test(body));
  // (e) Without .pl-seq--enhanced (no JS) the enter animation does not apply: the
  //     animation selector is scoped to .pl-seq--enhanced.
  const unscopedStageAnim = rules.some(r => {
    const sel = r.split('{')[0]; const decl = r.split('{')[1] || '';
    return /\.pl-seq__stage/.test(sel) && !/\.pl-seq--enhanced/.test(sel) && /animation\s*:\s*pl-seq-stage-in/.test(decl);
  });
  ok('E5f: stage enter animation is scoped to .pl-seq--enhanced (no-JS safe)', !unscopedStageAnim);
})();

// ======================================================================
// PREFERENCE controller
// ======================================================================
ok('P1: preference uses matchMedia', /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(preferenceJs));
ok('P2: preference listens for runtime change', /addEventListener\('change'/.test(preferenceJs) || /addListener\(/.test(preferenceJs));
ok('P3: preference cleans up its listener', /removeEventListener\('change'/.test(preferenceJs) || /removeListener\(/.test(preferenceJs));
ok('P4: preference destroy is idempotent (guards destroyed)', /destroyed\s*=\s*true/.test(preferenceJs) && /if\s*\(destroyed\)\s*return/.test(preferenceJs));

// ======================================================================
// OBSERVER
// ======================================================================
ok('O1: IntersectionObserver ownership in lifecycle', /new IO\(/.test(lifecycleJs) && /window\.IntersectionObserver/.test(lifecycleJs));
ok('O2: fallback when IntersectionObserver unavailable', /typeof IO === 'function'/.test(lifecycleJs) && /onEnter\(target\)/.test(lifecycleJs));
ok('O3: unobserve after one-shot', /\.unobserve\(/.test(lifecycleJs));
ok('O4: disconnect on destroy', /\.disconnect\(\)/.test(lifecycleJs));
ok('O5: no scroll listener used for reveal', !/addEventListener\('scroll'/.test(allJs));

// ======================================================================
// TIMERS
// ======================================================================
ok('X1: no setInterval anywhere in motion JS', !/setInterval\s*\(/.test(allJs));
ok('X2: timers can be cancelled', /clearTimeout\(/.test(lifecycleJs));
ok('X3: destroy clears pending timers', /timers\.destroy\(\)/.test(sequenceJs) && /clearTimeout/.test(lifecycleJs));
ok('X4: sequence uses a self-rescheduling timeout, not setInterval', /scheduleNext/.test(sequenceJs) && /timers\.after\(/.test(sequenceJs));

// ======================================================================
// PAUSE STATE (separate reasons)
// ======================================================================
ok('S1: userPaused reason exists', /userPaused/.test(sequenceJs));
ok('S1: viewportPaused reason exists', /viewportPaused/.test(sequenceJs));
ok('S1: documentPaused reason exists', /documentPaused/.test(sequenceJs));
ok('S1: reducedMotion reason exists', /reducedMotion/.test(sequenceJs));
ok('S2: reasons are separate fields (not one boolean)', /reasons\s*=\s*\{[^}]*userPaused[^}]*viewportPaused[^}]*documentPaused[^}]*reducedMotion/.test(sequenceJs));
// Viewport re-entry clears viewportPaused but not userPaused.
ok('S3: viewport re-entry does not clear userPaused', /reasons\.viewportPaused\s*=\s*false/.test(sequenceJs) && !/reasons\.userPaused\s*=\s*false;[\s\S]{0,40}isIntersecting/.test(sequenceJs));
ok('S4: canAutoplay requires none of the pause reasons', /!reasons\.userPaused\s*&&\s*!reasons\.viewportPaused\s*&&\s*!reasons\.documentPaused\s*&&\s*!reasons\.reducedMotion/.test(sequenceJs));

// ======================================================================
// SEQUENCE behaviour
// ======================================================================
ok('Q1: manual next/prev exist', /function next\(\)/.test(sequenceJs) && /function prev\(\)/.test(sequenceJs));
ok('Q2: pause + restart exist', /function userPause\(\)/.test(sequenceJs) && /function restart\(\)/.test(sequenceJs));
ok('Q3: autoplay stops at last step (no wrap-around)', /i >= stages\.length - 1/.test(sequenceJs) && !/%\s*stages\.length/.test(sequenceJs) && /if \(i >= stages\.length - 1\) \{ completed = true; stop\(\); return; \}/.test(sequenceJs));
ok('Q4: show() clamps and does not wrap', /Math\.max\(0, Math\.min\(stages\.length - 1/.test(sequenceJs));
ok('Q5: current step uses aria-current="step"', /setAttribute\('aria-current', 'step'\)/.test(sequenceJs));
ok('Q6: sequence never moves focus programmatically', !/\.focus\(\)/.test(stripJs(sequenceJs)));
ok('Q7: no aria-live per-frame announcement', !/aria-live/.test(stripJs(sequenceJs)));

// ======================================================================
// DOCUMENT-HIDDEN INITIALISATION (audited bug 3)
// ======================================================================
ok('D1: documentPaused is initialised from the real document.hidden', /documentPaused:\s*\(typeof document[^)]*!!document\.hidden\)/.test(sequenceJs) || /documentPaused:\s*[^,]*document\.hidden/.test(sequenceJs));
ok('D2: documentPaused is NOT hardcoded false', !/documentPaused:\s*false/.test(sequenceJs));

// ======================================================================
// HONEST CONTROLS (audited bug 4)
// ======================================================================
ok('N1: toggleOperable gates on autoplay, reduced motion and completion', /function toggleOperable\(\)\s*\{\s*return autoplay && !reasons\.reducedMotion && !completed;/.test(sequenceJs));
ok('N2: control label reflects the real playing state', /setLabel\(playBtn, playing \? 'pause' : 'play'\)/.test(sequenceJs));
ok('N3: non-operable toggle is disabled + aria-disabled (not a fake Pause)', /playBtn\.disabled = true/.test(sequenceJs) && /setAttribute\('aria-disabled', 'true'\)/.test(sequenceJs));
ok('N4: reduced/manual status is surfaced', /data-status-reduced/.test(sequenceJs) && /data-status-manual/.test(sequenceJs));
ok('N5: toggle() is a no-op when not operable', /function toggle\(\)\s*\{ if \(!toggleOperable\(\)\) return;/.test(sequenceJs));
// The lab HTML provides a real status element for honest messaging.
ok('N6: lab provides a sequence status element', /data-seq-status/.test(labHtml) && /role="status"/.test(labHtml));

// ======================================================================
// FINAL-STEP honesty (audited regression 3): no useless Play at the end
// ======================================================================
ok('N7: a completed latch exists', /var completed = false;/.test(sequenceJs));
ok('N8: autoplay marks completed at the final step', /completed = true; stop\(\);/.test(sequenceJs));
ok('N9: play() does not schedule a useless timer at the final step', /if \(autoplay && !completed && i >= stages\.length - 1\) \{ completed = true; syncControl\(\); return; \}/.test(sequenceJs));
ok('N10: canAutoplay requires not completed', /!completed/.test(sequenceJs.match(/function canAutoplay\(\)[^}]*}/)[0]));
ok('N11: completion status is surfaced', /data-status-complete/.test(sequenceJs));
ok('N11b: lab provides a completion status message', /data-status-complete/.test(labHtml));
ok('N12: restart clears the completed latch', /function restart\(\) \{ completed = false;/.test(sequenceJs));
ok('N13: manual goto to an earlier step clears completed', /function goto\(n\) \{ userPause\(\); if \(n < stages\.length - 1\) completed = false;/.test(sequenceJs));

// ======================================================================
// destroy() restores the static progressive fallback (audited regression 2)
// ======================================================================
ok('N14: destroy removes the .pl-seq--enhanced flag', /root\.classList\.remove\('pl-seq--enhanced'\)/.test(sequenceJs));
ok('N15: destroy un-hides every stage', /stages\.forEach\(function \(s\) \{ s\.hidden = false; \}\)/.test(sequenceJs));
ok('N16: destroy drops aria-current from steps and dots', /steps\.forEach\(function \(s\) \{ s\.removeAttribute\('aria-current'\)/.test(sequenceJs) && /dots\.forEach\(function \(dt\) \{ dt\.removeAttribute\('aria-current'\)/.test(sequenceJs));
ok('N17: destroy stays idempotent (guarded)', /if \(destroyed\) return;\s*destroyed = true;/.test(sequenceJs));
ok('N18: destroy does not move focus', !/\.focus\(\)/.test(stripJs(sequenceJs)));

// ======================================================================
// LAB no-JS: JS-only controls start hidden, activated after handler (block 1)
// ======================================================================
(function () {
  // Every lab control that needs JS is marked data-lab-jsonly AND starts hidden.
  const jsonly = labHtml.match(/<button[^>]*data-lab-jsonly[^>]*>/g) || [];
  ok('L1: JS-only lab controls exist and are marked', jsonly.length === 3, String(jsonly.length));
  ok('L1b: every JS-only control starts hidden', jsonly.length === 3 && jsonly.every(b => /\bhidden\b/.test(b)));
  // The three known JS-only buttons carry the marker.
  ['data-demo-state-run', 'data-reveal-reset', 'data-instrument-run'].forEach(function (attr) {
    const re = new RegExp('<button[^>]*' + attr + '[^>]*>');
    const m2 = labHtml.match(re);
    ok('L1c: ' + attr + ' is a hidden JS-only control', !!m2 && /data-lab-jsonly/.test(m2[0]) && /\bhidden\b/.test(m2[0]));
  });
  // lab.js activates them only after wiring a handler (removeAttribute('hidden')).
  ok('L2: lab.js reveals JS-only controls after handler setup', /removeAttribute\('hidden'\)/.test(labJs) && /addEventListener\('click'/.test(labJs));
  // CSS ensures the hidden attribute actually hides them over the button display.
  ok('L3: lab CSS forces [data-lab-jsonly][hidden] to display:none', /\[data-lab-jsonly\]\[hidden\]\s*\{[^}]*display:\s*none/.test(labCss));
})();

// ======================================================================
// CANONICAL JS ENTRY POINT is browser-safe AND Node-safe (audited bug 8)
// ======================================================================
(function () {
  const indexJs = read(path.join(motionDir, 'index.js'));
  // It must NOT call a bare top-level require() that throws in a browser: any
  // require use must be guarded by `typeof require === 'function'`.
  const bareRequire = /(^|[^.\w])require\(/.test(stripJs(indexJs));
  const guarded = /typeof require\s*[!=]==?\s*'function'/.test(indexJs);
  ok('IX1: index.js does not call require() unguarded', !bareRequire || guarded);
  ok('IX1b: index.js guards require with a typeof check', guarded);
  // It must expose the API for both CommonJS and browser globals.
  ok('IX2: index.js exports via module.exports', /module\.exports\s*=/.test(indexJs));
  ok('IX2b: index.js attaches a browser global (PlumlineMotion)', /PlumlineMotion\s*=/.test(indexJs));
  // Load in Node: full API present.
  let mod = null; try { mod = require(path.join(motionDir, 'index.js')); } catch (e) { /* handled below */ }
  ok('IX3: index.js loads in Node with the full API', !!mod && ['createMotionPreference', 'createTimerGroup', 'createVisibility', 'createRevealObserver', 'createReveal', 'createSequence'].every(k => typeof mod[k] === 'function'));
  // Execute in a browser-like sandbox WITHOUT require and assert no throw + API.
  try {
    const vm = require('vm');
    const code = read(path.join(motionDir, 'index.js'));
    const win = { PlumlineMotionPreference: { createMotionPreference: function () {} }, PlumlineMotionLifecycle: { createTimerGroup: function () {}, createVisibility: function () {}, createRevealObserver: function () {} }, PlumlineMotionReveal: { createReveal: function () {} }, PlumlineMotionSequence: { createSequence: function () {} } };
    const sandbox = { window: win, console: console };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox); // must not throw (no require defined)
    const api = sandbox.PlumlineMotion || win.PlumlineMotion;
    ok('IX4: index.js runs in a no-require browser context without throwing', !!api);
    ok('IX4b: browser context exposes the 6-function API', !!api && ['createMotionPreference', 'createTimerGroup', 'createVisibility', 'createRevealObserver', 'createReveal', 'createSequence'].every(k => typeof api[k] === 'function'));
  } catch (e) {
    ok('IX4: index.js runs in a no-require browser context without throwing', false, e.message);
  }
  // The lab consumes the canonical API (loads index.js and uses window.PlumlineMotion).
  ok('IX5: lab loads the canonical index.js', /src="\.\.\/\.\.\/src\/shared\/motion\/index\.js"/.test(labHtml));
  ok('IX5b: lab consumes window.PlumlineMotion', /window\.PlumlineMotion/.test(labJs));
})();

// ======================================================================
// ACCESSIBILITY (lab)
// ======================================================================
ok('Y1: exactly one H1 in the lab', (labHtml.match(/<h1\b/g) || []).length === 1);
ok('Y2: headings present (h2 sections)', (labHtml.match(/<h2\b/g) || []).length >= 5);
ok('Y3: pause control is a real button with a label', /data-seq-toggle[^>]*>/.test(labHtml) && /<button[^>]*data-seq-toggle/.test(labHtml));
ok('Y4: dots have accessible names', (labHtml.match(/aria-label="Go to step/g) || []).length >= 5);
ok('Y5: status not colour-only (badges carry text)', /pl-badge--proven">Optimal/.test(labHtml) || /Optimal proven/.test(labHtml));
ok('Y6: no fake href="#" in lab', !/href="#"/.test(labHtml));
// Fragment links resolve.
(function () {
  const frags = (labHtml.match(/href="#([\w-]+)"/g) || []).map(m => m.match(/#([\w-]+)/)[1]);
  const ids = (labHtml.match(/\sid="([\w-]+)"/g) || []).map(m => m.match(/id="([\w-]+)"/)[1]);
  frags.forEach(f => ok('Y7: fragment #' + f + ' resolves', ids.filter(x => x === f).length === 1));
})();
ok('Y8: solver link points at the real solver.html', !/href="[^"]*solver[^"]*"/.test(labHtml) || /href="\.\.\/\.\.\/solver\.html"/.test(labHtml));
ok('Y9: landmarks present (header/footer)', /<header\b/.test(labHtml) && /<footer\b/.test(labHtml));

// ======================================================================
// COPY HONESTY (lab reuses approved language)
// ======================================================================
ok('H1: lab avoids generic proof / hype language', !/into a proof\b/i.test(labHtml) && !/\bAI-powered\b/i.test(labHtml) && !/\bmost powerful\b/i.test(labHtml) && !/\bmagic\b/i.test(labHtml) && !/\bguaranteed\b/i.test(labHtml) && !/\bfastest\b/i.test(labHtml));
ok('H2: sequence is labelled a demonstration/preview', /demonstration|preview/i.test(labHtml) && /does not run the engine/i.test(labHtml));

// ======================================================================
// ISOLATION (dist)
// ======================================================================
(function () {
  const dist = path.join(siteDir, 'dist');
  ok('I1: dist has no design-review', !fs.existsSync(dist) || !fs.existsSync(path.join(dist, 'design-review')));
  ok('I2: dist has no motion source', !fs.existsSync(dist) || !fs.existsSync(path.join(dist, 'src', 'shared', 'motion')));
})();

// ======================================================================
// ROADMAP OWNERSHIP
// ======================================================================
(function () {
  const doc = read(path.join(siteDir, 'docs', 'checkpoint-f4c-motion-system.md'));
  ok('RM1: F4c is the motion system', /F4c/.test(doc) && /motion/i.test(doc));
  ok('RM2: Home remains F9', /Home[^.]*F9|F9[^.]*Home/.test(doc));
  ok('RM3: remaining page redesign remains F10', /F10/.test(doc));
  ok('RM4: examples library UI is F6', /F6/.test(doc));
  ok('RM5: Solver personalisation is F8', /F8/.test(doc));
  ok('RM6: lab does not claim to wire production', /no production wiring|production untouched|not.*production-wired/i.test(labHtml + doc));
})();

if (require.main === module) {
  failures.forEach(f => console.log('  FAIL: ' + f));
  console.log('F4C MOTION SYSTEM TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass, fail };
