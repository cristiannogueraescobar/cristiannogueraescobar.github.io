'use strict';

/*
 * Checkpoint F4c — motion system contracts (negative mutations).
 *
 * Each mutation copies everything the suites read — the motion system, the lab,
 * the docs, the F4b design system, the two baseline manifests AND the real
 * production/infra files the protected contract pins — into an isolated temp
 * directory whose path contains a SPACE, applies one breaking change, runs the
 * TARGET suite (the positive static suite, or the behavioural suite for runtime
 * bugs) against that copy, and asserts it now FAILS naming the expected contract.
 * The copy is always removed in finally. Windows-portable: Node
 * fs/path/child_process.execFileSync(process.execPath) only.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const siteDir = path.join(__dirname, '..');
const posSuite = path.join(__dirname, 'tests_f4c_motion_system.js');
const behSuite = path.join(__dirname, 'tests_f4c_motion_behavioural.js');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function rf(p) { return fs.readFileSync(p, 'utf8'); }
function wf(p, s) { fs.writeFileSync(p, s); }

function runSuiteIn(tmpSite, which) {
  const tmpEngine = path.join(tmpSite, 'engine');
  fs.mkdirSync(tmpEngine, { recursive: true });
  fs.copyFileSync(posSuite, path.join(tmpEngine, 'tests_f4c_motion_system.js'));
  fs.copyFileSync(behSuite, path.join(tmpEngine, 'tests_f4c_motion_behavioural.js'));
  const target = which === 'behavioural' ? 'tests_f4c_motion_behavioural.js' : 'tests_f4c_motion_system.js';
  try {
    const out = execFileSync(process.execPath, [path.join(tmpEngine, target)], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status || 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const prodManifest = (function () { try { return JSON.parse(rf(path.join(__dirname, 'f4b-protected-baseline.json'))); } catch (e) { return { files: [] }; } })();
const f4bManifest = (function () { try { return JSON.parse(rf(path.join(__dirname, 'f4c-protected-baseline.json'))); } catch (e) { return { files: [] }; } })();

function makeCopy() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'f4c neg ')); // note the space
  const site = path.join(base, 'site');
  fs.mkdirSync(site, { recursive: true });
  fs.cpSync(path.join(siteDir, 'src'), path.join(site, 'src'), { recursive: true });
  fs.cpSync(path.join(siteDir, 'design-review'), path.join(site, 'design-review'), { recursive: true });
  fs.mkdirSync(path.join(site, 'docs'), { recursive: true });
  ['checkpoint-f4c-motion-system.md', 'motion-system.md', 'design-system-components.md'].forEach(f => {
    const src = path.join(siteDir, 'docs', f); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(site, 'docs', f));
  });
  fs.mkdirSync(path.join(site, 'engine'), { recursive: true });
  fs.copyFileSync(path.join(siteDir, 'engine', 'f4b-protected-baseline.json'), path.join(site, 'engine', 'f4b-protected-baseline.json'));
  fs.copyFileSync(path.join(siteDir, 'engine', 'f4c-protected-baseline.json'), path.join(site, 'engine', 'f4c-protected-baseline.json'));
  const all = (prodManifest.files || []).concat(f4bManifest.files || []);
  all.forEach(entry => {
    const src = path.join(siteDir, entry.path);
    if (!fs.existsSync(src)) return;
    const dst = path.join(site, entry.path);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  });
  return { base, site };
}

const M = ['src', 'shared', 'motion'];
function mFile(s, name) { return path.join(s, ...M, name); }
function labFile(s, name) { return path.join(s, 'design-review', 'f4c', name); }
function docFile(s) { return path.join(s, 'docs', 'checkpoint-f4c-motion-system.md'); }

// which: 'positive' (default) or 'behavioural'
const mutations = [
  // ---- Protection ------------------------------------------------------
  { n: 'protected production file changed (index.html)', expect: 'protected production hash changed? index.html',
    mut: s => { const p = path.join(s, 'index.html'); if (fs.existsSync(p)) wf(p, rf(p).replace('</body>', '<!--x-->\n</body>')); } },
  { n: 'protected production file changed (assets/plumline.css)', expect: 'protected production hash changed? assets/plumline.css',
    mut: s => { const p = path.join(s, 'assets', 'plumline.css'); if (fs.existsSync(p)) wf(p, rf(p) + '\n.x{}\n'); } },
  { n: 'protected F4b static file changed (06-components.css)', expect: 'protected F4b-static hash changed? src/shared/design-system/06-components.css',
    mut: s => { const p = path.join(s, 'src', 'shared', 'design-system', '06-components.css'); if (fs.existsSync(p)) wf(p, rf(p) + '\n.x{}\n'); } },
  { n: 'stable component reference doc changed', expect: 'protected F4b-static hash changed? docs/design-system-components.md',
    mut: s => { const p = path.join(s, 'docs', 'design-system-components.md'); if (fs.existsSync(p)) wf(p, rf(p) + '\nx\n'); } },
  { n: 'remove stable component reference doc from protected set', expect: 'expected protected path missing: docs/design-system-components.md',
    mut: s => { const p = path.join(s, 'engine', 'f4c-protected-baseline.json'); const m = JSON.parse(rf(p)); m.files = m.files.filter(f => f.path !== 'docs/design-system-components.md'); wf(p, JSON.stringify(m, null, 2)); } },
  { n: 'expected F4b protected path removed from manifest', expect: 'expected protected path missing: src/shared/design-system/index.css',
    mut: s => { const p = path.join(s, 'engine', 'f4c-protected-baseline.json'); const m = JSON.parse(rf(p)); m.files = m.files.filter(f => f.path !== 'src/shared/design-system/index.css'); wf(p, JSON.stringify(m, null, 2)); } },
  { n: 'expected production protected path removed from manifest', expect: 'expected protected path missing: solver.html',
    mut: s => { const p = path.join(s, 'engine', 'f4b-protected-baseline.json'); const m = JSON.parse(rf(p)); m.files = m.files.filter(f => f.path !== 'solver.html'); wf(p, JSON.stringify(m, null, 2)); } },
  // ---- Remote / library ------------------------------------------------
  { n: 'remote animation library link in lab', expect: 'lab imports canonical motion system',
    mut: s => { const p = labFile(s, 'index.html'); wf(p, rf(p).replace('<link rel="stylesheet" href="../../src/shared/motion/index.css">', '<link rel="stylesheet" href="https://cdn.example.com/anim.css">')); } },
  { n: 'GSAP import in a motion module', expect: 'no remote url() in motion css',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, "@import url('https://cdn.jsdelivr.net/npm/gsap/index.css');\n" + rf(p)); } },
  // ---- CSS policy ------------------------------------------------------
  { n: '`transition: all` in primitives', expect: 'no `transition: all`',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-motion-press {', '.pl-motion-press { transition: all 1s;')); } },
  { n: 'animation-iteration-count: infinite', expect: 'no infinite animation-iteration-count',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p) + '\n.pulse{animation-iteration-count:infinite;}\n'); } },
  { n: 'infinite keyword in animation shorthand', expect: 'no `infinite` keyword',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p) + '\n.spin{animation:pl-plumb-settle 1s infinite;}\n'); } },
  { n: 'animate width', expect: 'motion does not transition layout property width',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-motion-state {\n  transition:', '.pl-motion-state {\n  transition: width var(--pl-motion-duration-normal) var(--pl-motion-ease-standard),')); } },
  { n: 'animate height', expect: 'motion does not transition layout property height',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-motion-state {\n  transition:', '.pl-motion-state {\n  transition: height var(--pl-motion-duration-normal) var(--pl-motion-ease-standard),')); } },
  { n: 'animate left/top', expect: 'motion does not transition layout property left',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-motion-state {\n  transition:', '.pl-motion-state {\n  transition: left var(--pl-motion-duration-normal) var(--pl-motion-ease-standard),')); } },
  { n: 'global will-change on *', expect: 'certainly no universal (*) will-change',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, '* { will-change: transform; }\n' + rf(p)); } },
  { n: 'any will-change reintroduced (no profiling)', expect: 'no will-change in motion CSS',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-reveal.pl-reveal-armed {', '.pl-reveal.pl-reveal-armed { will-change: transform, opacity;')); } },
  // ---- Raw values ------------------------------------------------------
  { n: 'raw ms duration outside tokens', expect: 'no raw ms duration',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-motion-feedback {\n  transition:', '.pl-motion-feedback {\n  transition: opacity 173ms linear,')); } },
  { n: 'raw cubic-bezier outside tokens', expect: 'no raw cubic-bezier in primitives',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('var(--pl-motion-ease-standard);\n}', 'cubic-bezier(0.1,0.2,0.3,0.4);\n}')); } },
  // ---- Progressive enhancement / global coupling ------------------------
  { n: 'content opacity 0 without feature-specific gate', expect: 'reveal start-state requires the feature-specific armed flag',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p) + '\n.pl-reveal{opacity:0;}\n'); } },
  { n: 'reintroduce global .pl-motion reveal gate (coupling)', expect: 'no global `.pl-motion ` descendant gate',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p) + '\n.pl-motion .pl-reveal{opacity:0;}\n'); } },
  { n: 'reveal controller adds a global .pl-motion flag', expect: 'reveal controller adds NO global flag',
    mut: s => { const p = mFile(s, 'reveal.js'); wf(p, rf(p).replace('var targets =', "document.documentElement.classList.add('pl-motion');\n  var targets =")); } },
  { n: 'sequence controller adds a global .pl-motion flag', expect: 'sequence controller adds NO global flag',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace("root.classList.add('pl-seq--enhanced');", "document.documentElement.classList.add('pl-motion');\n  root.classList.add('pl-seq--enhanced');")); } },
  { n: 'state enter start-state ungated', expect: 'state enter start-state requires the feature-specific armed flag',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p) + '\n.pl-motion-state-enter{opacity:0;}\n'); } },
  { n: 'lab hardcodes the state enter start-state', expect: 'lab HTML does not hardcode the state enter start-state class',
    mut: s => { const p = labFile(s, 'index.html'); wf(p, rf(p).replace('class="pl-surface pl-motion-state" data-demo-state', 'class="pl-surface pl-motion-state pl-motion-state-enter" data-demo-state')); } },
  { n: 'sequence controls not hidden by default (dead controls no-JS)', expect: 'sequence controls hidden by default',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-seq__steps,\n.pl-seq__controls {\n  display: none;\n}', '.pl-seq__steps { display: flex; }\n.pl-seq__controls { display: flex; }')); } },
  // ---- Reduced motion --------------------------------------------------
  { n: 'missing reduced-motion block', expect: 'a reduced-motion block exists',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\}\s*$/, '')); } },
  // ---- Preference controller ------------------------------------------
  { n: 'remove matchMedia', expect: 'preference uses matchMedia',
    mut: s => { const p = mFile(s, 'preference.js'); wf(p, rf(p).replace("window.matchMedia('(prefers-reduced-motion: reduce)')", 'null')); } },
  { n: 'remove preference change listener', expect: 'preference listens for runtime change',
    mut: s => { const p = mFile(s, 'preference.js'); wf(p, rf(p).replace("if (mq.addEventListener) mq.addEventListener('change', onChange);", 'if (false) {}').replace('else if (mq.addListener) mq.addListener(onChange);', '')); } },
  { n: 'remove listener cleanup', expect: 'preference cleans up its listener',
    mut: s => { const p = mFile(s, 'preference.js'); wf(p, rf(p).replace("if (mq.removeEventListener) mq.removeEventListener('change', onChange);", '').replace('else if (mq.removeListener) mq.removeListener(onChange);', '')); } },
  // ---- Observer --------------------------------------------------------
  { n: 'remove IntersectionObserver fallback', expect: 'fallback when IntersectionObserver unavailable',
    mut: s => { const p = mFile(s, 'lifecycle.js'); wf(p, rf(p).replace('var supported = typeof IO === \'function\';', 'var supported = true;')); } },
  { n: 'remove disconnect', expect: 'disconnect on destroy',
    mut: s => { const p = mFile(s, 'lifecycle.js'); wf(p, rf(p).replace(/\.disconnect\(\)/g, '.noop()')); } },
  { n: 'add scroll listener for reveal', expect: 'no scroll listener used for reveal',
    mut: s => { const p = mFile(s, 'reveal.js'); wf(p, rf(p).replace('var targets =', "window.addEventListener('scroll', function () {});\n  var targets =")); } },
  // ---- Timers ----------------------------------------------------------
  { n: 'add setInterval', expect: 'no setInterval anywhere in motion JS',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('function scheduleNext() {', 'function scheduleNext() { setInterval(function(){}, 1000);')); } },
  { n: 'remove timer cleanup on destroy (static)', expect: 'destroy clears pending timers',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('timers.destroy();', '/* timers not cleared */')); } },
  // ---- Pause state (static) -------------------------------------------
  { n: 'viewport re-entry overrides userPaused (static)', expect: 'canAutoplay requires none of the pause reasons',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('return autoplay && !completed && !reasons.userPaused && !reasons.viewportPaused && !reasons.documentPaused && !reasons.reducedMotion;', 'return autoplay && !reasons.viewportPaused;')); } },
  { n: 'collapse pause reasons into one boolean', expect: 'reasons are separate fields',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace(/var reasons = \{\s*userPaused: false,\s*viewportPaused: false,\s*documentPaused: \(typeof document[\s\S]*?reducedMotion: preference\.reduced\(\),\s*\};/, 'var reasons = { paused: false };')); } },
  // ---- documentPaused init (audited bug 3) -----------------------------
  { n: 'documentPaused hardcoded false (ignores document.hidden)', expect: 'documentPaused is initialised from the real document.hidden',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace(/documentPaused: \(typeof document !== 'undefined' && !!document\.hidden\)/, 'documentPaused: false')); } },
  // ---- Honest controls (audited bug 4) ---------------------------------
  { n: 'toggle label always Pause (dishonest control)', expect: 'control label reflects the real playing state',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace("setLabel(playBtn, playing ? 'pause' : 'play');", "setLabel(playBtn, 'pause');")); } },
  { n: 'reduced/autoplay-off toggle stays operable', expect: 'toggleOperable gates on autoplay, reduced motion and completion',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('return autoplay && !reasons.reducedMotion && !completed;', 'return true;')); } },
  // ---- Sequence (static) ----------------------------------------------
  { n: 'autoplay loops from last step to first', expect: 'autoplay stops at last step',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('if (i >= stages.length - 1) { completed = true; stop(); return; }', 'if (i >= stages.length - 1) { show(0); scheduleNext(); return; }')); } },
  { n: 'pause button missing in lab', expect: 'pause control is a real button',
    mut: s => { const p = labFile(s, 'index.html'); wf(p, rf(p).replace(/<button class="pl-button pl-button--secondary" type="button" data-seq-toggle[^>]*>Pause<\/button>/, '<span>Pause</span>')); } },
  { n: 'sequence moves focus (static)', expect: 'sequence never moves focus programmatically',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('markActive(dots);', 'markActive(dots); if (stages[i]) stages[i].focus();')); } },
  { n: 'sequence stages hidden by default (unreadable without JS)', expect: 'sequence stages are not hidden by default',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p) + '\n.pl-seq__stage{display:none;}\n'); } },
  // ---- Links / isolation ----------------------------------------------
  { n: 'fake href="#" in lab', expect: 'no fake href="#" in lab',
    mut: s => { const p = labFile(s, 'index.html'); wf(p, rf(p).replace('href="../../solver.html"', 'href="#"')); } },
  { n: 'broken fragment target', expect: 'fragment #s1 resolves',
    mut: s => { const p = labFile(s, 'index.html'); wf(p, rf(p).replace('id="s1"', 'id="s1-renamed"')); } },
  { n: 'third-party remote asset in lab', expect: 'lab imports canonical design system',
    mut: s => { const p = labFile(s, 'index.html'); wf(p, rf(p).replace('<link rel="stylesheet" href="../../src/shared/design-system/index.css">', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">')); } },
  { n: 'lab duplicates F4b tokens', expect: 'lab does not define design-system tokens',
    mut: s => { const p = labFile(s, 'lab.css'); wf(p, ':root{--pl-cream-100:#fff;}\n' + rf(p)); } },
  { n: 'design-review enters dist', expect: 'dist has no design-review',
    mut: s => { fs.mkdirSync(path.join(s, 'dist', 'design-review', 'f4c'), { recursive: true }); wf(path.join(s, 'dist', 'design-review', 'f4c', 'index.html'), '<!doctype html>'); } },
  // ---- Keyframes -------------------------------------------------------
  { n: 'keyframe without consumer', expect: 'keyframe has a real consumer',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p) + '\n@keyframes pl-orphan { from { opacity: 0; } to { opacity: 1; } }\n'); } },
  { n: 'keyframe without reduced handling', expect: 'a reduced-motion block exists',
    mut: s => { const p = mFile(s, 'primitives.css'); let t = rf(p); t = t.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\}\s*$/, ''); t += '\n@keyframes pl-extra { from{opacity:0} to{opacity:1} }\n.pl-extra-run{animation:pl-extra var(--pl-motion-duration-fast) var(--pl-motion-ease-standard) both;}\n'; wf(p, t); } },
  // ---- index.js browser-safety (audited bug 8) -------------------------
  { n: 'index.js calls require() unguarded (browser ReferenceError)', expect: 'index.js runs in a no-require browser context without throwing',
    mut: s => { const p = mFile(s, 'index.js'); wf(p, "var x = require('./preference.js');\n" + rf(p)); } },
  // ---- Roadmap ---------------------------------------------------------
  { n: 'roadmap says Home = F4c', expect: 'Home remains F9',
    mut: s => { const p = docFile(s); wf(p, rf(p).replace(/The narrative Home redesign is F9\./g, 'The narrative Home redesign is F4c.').replace(/Home[^.]*F9|F9[^.]*Home/g, 'Home is F4c')); } },
  { n: 'roadmap says Solver redesign = F4c', expect: 'Solver personalisation is F8',
    mut: s => { const p = docFile(s); wf(p, rf(p).replace(/F8/g, 'F4c')); } },
  { n: 'roadmap drops F10 ownership', expect: 'remaining page redesign remains F10',
    mut: s => { const p = docFile(s); wf(p, rf(p).replace(/F10/g, 'F4c')); } },
  { n: 'roadmap drops F6 ownership', expect: 'examples library UI is F6',
    mut: s => { const p = docFile(s); wf(p, rf(p).replace(/F6/g, 'F4c')); } },

  // ===================================================================
  // BEHAVIOURAL mutations (run against the behavioural harness)
  // ===================================================================
  { n: 'BEHAVIOURAL: initial documentPaused false while hidden', which: 'behavioural', expect: 'BS4: hidden init documentPaused=true',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace(/documentPaused: \(typeof document !== 'undefined' && !!document\.hidden\)/, 'documentPaused: false')); } },
  { n: 'BEHAVIOURAL: reduced leaves autoplay running', which: 'behavioural', expect: 'BS11: reduced init NOT playing',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('return autoplay && !completed && !reasons.userPaused && !reasons.viewportPaused && !reasons.documentPaused && !reasons.reducedMotion;', 'return autoplay && !completed && !reasons.userPaused && !reasons.viewportPaused && !reasons.documentPaused;')); } },
  { n: 'BEHAVIOURAL: destroy not idempotent (preference throws on 2nd call)', which: 'behavioural', expect: 'BP6: destroy twice is safe',
    mut: s => { const p = mFile(s, 'preference.js'); wf(p, rf(p).replace('      if (destroyed) return;\n      destroyed = true;\n      if (mq) {\n        if (mq.removeEventListener) mq.removeEventListener(\'change\', onChange);\n        else if (mq.removeListener) mq.removeListener(onChange);\n      }\n      subscribers.length = 0;', '      mq.removeEventListener(\'change\', onChange);\n      mq = null;\n      subscribers.length = 0;')); } },
  { n: 'BEHAVIOURAL: document visible overrides userPaused', which: 'behavioural', expect: 'BS8: user pause wins over document visible',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('else { play(); } // play() re-checks canAutoplay(), so userPaused still wins', 'else { reasons.userPaused = false; playing = true; scheduleNext(); }')); } },
  { n: 'BEHAVIOURAL: reduce->normal overrides userPaused', which: 'behavioural', expect: 'BS24: reduce->normal does not override userPaused',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('play(); // does NOT auto-resume if userPaused (canAutoplay re-checks it)', 'reasons.userPaused = false; playing = true; scheduleNext();')); } },
  { n: 'BEHAVIOURAL: viewport re-entry overrides userPaused', which: 'behavioural', expect: 'BS20: user pause wins over viewport re-entry',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('if (en.isIntersecting) { reasons.viewportPaused = false; play(); }', 'if (en.isIntersecting) { reasons.viewportPaused = false; reasons.userPaused = false; playing = true; scheduleNext(); }')); } },
  { n: 'BEHAVIOURAL: timer survives destroy', which: 'behavioural', expect: 'BT5: destroy leaves size 0',
    mut: s => { const p = mFile(s, 'lifecycle.js'); wf(p, rf(p).replace('    destroy: function () {\n      destroyed = true;\n      timers.forEach(function (id) { clearTimeout(id); });\n      timers.length = 0;\n    },', '    destroy: function () { destroyed = true; },')); } },
  { n: 'BEHAVIOURAL: reveal destroy leaves target armed (invisible)', which: 'behavioural', expect: 'BR8: destroy before enter leaves ALL targets visible',
    mut: s => { const p = mFile(s, 'reveal.js'); wf(p, rf(p).replace("targets.forEach(function (t) { t.classList.remove('pl-reveal-armed'); });", '/* leaves armed */')); } },
  { n: 'BEHAVIOURAL: autoplay wraps at final step', which: 'behavioural', expect: 'BS25: no wrap past final step',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('i = Math.max(0, Math.min(stages.length - 1, n)); // clamp; no wrap-around', 'i = ((n % stages.length) + stages.length) % stages.length;')); } },
  { n: 'BEHAVIOURAL: repeated init/destroy multiplies timers', which: 'behavioural', expect: 'BS28: repeated init/destroy leaves 0 pending timers',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('      stop();\n      timers.destroy();', '      /* no stop, no timer cleanup */')); } },

  // ---- LAB no-JS controls (audited regression 1) -----------------------
  { n: 'lab JS-only control not hidden initially', expect: 'every JS-only control starts hidden',
    mut: s => { const p = labFile(s, 'index.html'); wf(p, rf(p).replace('data-demo-state-run data-lab-jsonly hidden', 'data-demo-state-run data-lab-jsonly')); } },
  { n: 'lab CSS does not force [data-lab-jsonly][hidden] display none', expect: 'lab CSS forces [data-lab-jsonly][hidden] to display:none',
    mut: s => { const p = labFile(s, 'lab.css'); wf(p, rf(p).replace('[data-lab-jsonly][hidden] { display: none !important; }', '/* removed */')); } },

  // ---- destroy restores static fallback (audited regression 2) ---------
  { n: 'BEHAVIOURAL: destroy leaves .pl-seq--enhanced (zombie controls)', which: 'behavioural', expect: 'BS33: after destroy enhanced=false',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace("root.classList.remove('pl-seq--enhanced');", '/* enhancement flag left on */')); } },
  { n: 'BEHAVIOURAL: destroy leaves stages hidden (unreadable)', which: 'behavioural', expect: 'BS34: after destroy every stage is visible',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('stages.forEach(function (s) { s.hidden = false; });', '/* stages left hidden */')); } },

  // ---- final-step Play (audited regression 3) --------------------------
  { n: 'BEHAVIOURAL: final-step Play starts a useless timer', which: 'behavioural', expect: 'BS43: toggle at final does not start a useless timer',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('    if (autoplay && !completed && i >= stages.length - 1) { completed = true; syncControl(); return; }', '')); } },
  { n: 'BEHAVIOURAL: completed never latches (toggle stays operable at final)', which: 'behavioural', expect: 'BS46: completed makes toggleOperable=false',
    mut: s => { const p = mFile(s, 'sequence.js'); wf(p, rf(p).replace('return autoplay && !reasons.reducedMotion && !completed;', 'return autoplay && !reasons.reducedMotion;')); } },

  // ---- Sequence stage ENTER real motion (audited final regression 1) ---
  { n: 'remove the real stage-enter consumer', expect: 'enhanced visible stage runs a real one-shot enter animation',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-seq--enhanced .pl-seq__stage:not([hidden]) {\n  animation: pl-seq-stage-in var(--pl-motion-duration-normal) var(--pl-motion-ease-enter) both;\n}', '/* consumer removed */')); } },
  { n: 'reintroduce dead opacity transition on .pl-seq__stage', expect: 'no dead opacity transition on .pl-seq__stage',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-seq__steps,\n.pl-seq__controls {', '.pl-seq__stage { transition: opacity var(--pl-motion-duration-normal) var(--pl-motion-ease-enter); }\n.pl-seq__steps,\n.pl-seq__controls {')); } },
  { n: 'stage enter animation not scoped to enhanced (runs without JS)', expect: 'stage enter animation is scoped to .pl-seq--enhanced',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('.pl-seq--enhanced .pl-seq__stage:not([hidden]) {\n  animation: pl-seq-stage-in', '.pl-seq__stage:not([hidden]) {\n  animation: pl-seq-stage-in')); } },
  { n: 'stage enter not disabled under reduced motion', expect: 'reduced motion disables the sequence stage enter',
    mut: s => { const p = mFile(s, 'primitives.css'); wf(p, rf(p).replace('  .pl-seq--enhanced .pl-seq__stage:not([hidden]) {\n    animation: none;\n    opacity: 1;\n  }', '')); } },
];

mutations.forEach((m, i) => {
  const { base, site } = makeCopy();
  try {
    m.mut(site);
    const res = runSuiteIn(site, m.which || 'positive');
    const broke = res.code !== 0;
    const named = m.expect ? res.out.indexOf(m.expect) !== -1 : true;
    ok('M' + (i + 1) + ': "' + m.n + '" breaks the contract', broke, 'exit=' + res.code);
    ok('M' + (i + 1) + ': "' + m.n + '" fails for the expected reason', broke && named, 'expected "' + m.expect + '"');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

if (require.main === module) {
  failures.forEach(f => console.log('  FAIL: ' + f));
  console.log('F4C MOTION SYSTEM NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail + '   (mutations: ' + mutations.length + ')');
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass, fail, mutations: mutations.length };
