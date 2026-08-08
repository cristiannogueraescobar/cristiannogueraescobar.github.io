'use strict';

/*
 * Checkpoint F4b — design system contracts (positive).
 *
 * Validates the canonical token architecture, component token discipline, font
 * infrastructure, isolation from production, accessibility/responsive contracts
 * and roadmap ownership. Windows-portable: Node fs/path only, no external
 * process, runs from a path with spaces.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const siteDir = path.join(__dirname, '..');
const dsDir = path.join(siteDir, 'src', 'shared', 'design-system');
const showDir = path.join(siteDir, 'design-review', 'f4b');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }
function read(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }
function sha256(p) { return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null; }

// ---------- WCAG contrast helper -------------------------------------------
function relLum(hex) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  const f = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { const l1 = relLum(a), l2 = relLum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }

// Load layers.
const primitives = read(path.join(dsDir, '01-primitives.css'));
const semantic = read(path.join(dsDir, '02-semantic.css'));
const base = read(path.join(dsDir, '03-base.css'));
const layout = read(path.join(dsDir, '04-layout.css'));
const fonts = read(path.join(dsDir, '05-fonts.css'));
const components = read(path.join(dsDir, '06-components.css'));
const forms = read(path.join(dsDir, '07-forms.css'));
const instrument = read(path.join(dsDir, '08-instrument.css'));
const utilities = read(path.join(dsDir, '09-utilities.css'));
const indexCss = read(path.join(dsDir, 'index.css'));
const consumerLayers = semantic + base + layout + components + forms + instrument + utilities;
const componentLayers = components + forms + instrument;
const html = read(path.join(showDir, 'index.html'));
const showcaseCss = read(path.join(showDir, 'showcase.css'));

// Strip CSS comments for value checks.
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

// ======================================================================
// TOKENS
// ======================================================================
ok('T1: canonical source directory exists', fs.existsSync(dsDir));
ok('T1: canonical entry point index.css exists', indexCss.length > 0);
ok('T1: primitive layer exists', primitives.length > 0);
ok('T1: semantic layer exists', semantic.length > 0);

// Collect defined tokens.
const defPrim = new Set((primitives.match(/(--pl-[a-z0-9-]+)\s*:/g) || []).map(s => s.replace(/\s*:$/, '')));
const defSem = new Set((semantic.match(/(--pl-[a-z0-9-]+)\s*:/g) || []).map(s => s.replace(/\s*:$/, '')));
const defined = new Set([...defPrim, ...defSem]);
ok('T2: primitive layer defines raw values', defPrim.size >= 20, String(defPrim.size));
ok('T2: semantic layer defines roles', defSem.size >= 20, String(defSem.size));

// Primitives must not alias other pl tokens (they are the raw floor). Allow
// var() only inside the font-family stacks (families reference nothing).
const primAliases = (strip(primitives).match(/var\(--pl-/g) || []).length;
ok('T3: primitive layer has no var(--pl-*) aliases', primAliases === 0, String(primAliases));

// Semantic aliases must reference existing tokens only.
const semRefs = new Set((strip(semantic).match(/var\((--pl-[a-z0-9-]+)/g) || []).map(s => s.replace('var(', '')));
const missingSem = [...semRefs].filter(r => !defined.has(r));
ok('T4: no semantic alias references a nonexistent token', missingSem.length === 0, missingSem.join(','));

// No self-reference (--x: var(--x)).
const selfRef = (strip(semantic).match(/(--pl-[a-z0-9-]+)\s*:\s*var\(\1\b/g) || []);
ok('T5: no token self-references itself', selfRef.length === 0, selfRef.join(','));

// No alias cycles (simple 2-cycle / DFS over semantic+primitive alias graph).
(function () {
  const edges = {};
  const allDefs = strip(primitives) + strip(semantic);
  const re = /(--pl-[a-z0-9-]+)\s*:\s*([^;]+);/g; let m;
  while ((m = re.exec(allDefs))) {
    const from = m[1];
    const tos = (m[2].match(/var\((--pl-[a-z0-9-]+)/g) || []).map(s => s.replace('var(', ''));
    edges[from] = tos;
  }
  let cyclic = false;
  const WHITE = 0, GREY = 1, BLACK = 2; const colour = {};
  function dfs(n) {
    colour[n] = GREY;
    for (const to of (edges[n] || [])) {
      if (colour[to] === GREY) { cyclic = true; return; }
      if (colour[to] === undefined || colour[to] === WHITE) dfs(to);
    }
    colour[n] = BLACK;
  }
  Object.keys(edges).forEach(n => { if (!colour[n]) dfs(n); });
  ok('T6: no alias cycles in the token graph', !cyclic);
})();

// Key semantic roles must be defined.
['--pl-color-bg-canvas', '--pl-color-bg-surface', '--pl-color-bg-inverse',
 '--pl-color-text-primary', '--pl-color-text-secondary', '--pl-color-text-inverse',
 '--pl-color-border-subtle', '--pl-color-action-primary', '--pl-color-process',
 '--pl-color-verified', '--pl-color-warning', '--pl-color-error', '--pl-color-focus'
].forEach(r => ok('T7: key semantic role defined: ' + r, defSem.has(r), r));

// Values syntactically valid: every declaration ends with ; and colours are
// 6-hex or var()/rgba/clamp/etc (no obvious typos like ## or trailing colons).
ok('T8: no double-hash colour typos', !/##/.test(primitives + semantic));
ok('T8: primitive colours are 6-digit hex', (primitives.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).every(h => h.length === 7));

// T9 (semantic re-theming integrity): the semantic layer must derive every value
// from primitives. It may not reintroduce a raw brand colour (hex) disconnected
// from the primitive palette; any translucent colour it composes must be derived
// from a primitive COLOUR token (color-mix()/rgb()/rgba() built on var(--pl-*)),
// never from literal channels or a hard-coded colour.
ok('T9: semantic layer contains no raw hex colour', (strip(semantic).match(/#[0-9A-Fa-f]{3,8}\b/g) || []).length === 0,
  (strip(semantic).match(/#[0-9A-Fa-f]{3,8}\b/g) || []).join(','));
ok('T9: any colour composition in semantic is derived from a primitive colour token', (function () {
  const calls = strip(semantic).match(/\b(?:color-mix|rgba?|hsla?)\([^)]*\)/g) || [];
  // Every colour function must reference a primitive colour token and must NOT
  // contain a bare literal channel triple like "245,242,235".
  return calls.every(c => /var\(--pl-[a-z0-9-]+\)/.test(c) && !/\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/.test(c));
})(), (strip(semantic).match(/\b(?:color-mix|rgba?|hsla?)\([^)]*\)/g) || []).filter(c => /\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/.test(c) || !/var\(/.test(c)).join(' ; '));

// T10 (single canonical source for cream-100): exactly ONE primitive defines
// cream-100, and there is no manually-synchronised RGB sibling. The translucent
// inverse-muted role must derive from that single canonical token, so a cream
// re-theme cannot desynchronise. color-mix(in srgb, ...) is used deliberately and
// is supported by the project's Chromium (141; color-mix ships in Chromium 111+).
ok('T10: exactly one canonical --pl-cream-100 definition', (primitives.match(/--pl-cream-100\s*:/g) || []).length === 1);
ok('T10: no duplicated --pl-cream-100-rgb sibling to keep in sync', !/--pl-cream-100-rgb\s*:/.test(primitives) && !/--pl-cream-100-rgb/.test(semantic));
ok('T10: no "keep in sync" manual-duplication note remains', !/keep in sync/i.test(primitives));
ok('T10: inverse-muted derives from the single canonical cream-100', /--pl-color-text-inverse-muted\s*:\s*color-mix\([^)]*var\(--pl-cream-100\)[^)]*\)/.test(strip(semantic)));

// ======================================================================
// COMPONENTS
// ======================================================================
// C1 (REAL token-policy enforcement): consumer layers that are "semantic-only"
// must NOT reference a token defined in 01-primitives.css. The single deliberate
// exception is 04-layout, which may reference ONLY the primitive layout
// MEASUREMENTS (widths/rails/tap targets) — a structural measure is not a
// re-themable colour/spacing decision. Any other direct primitive use fails,
// naming the file and the offending token ("direct primitive token use").
(function () {
  const primNames = new Set((primitives.match(/(--pl-[a-z0-9-]+)\s*:/g) || []).map(s => s.replace(/\s*:$/, '')));
  const layoutMeasureAllow = new Set(['--pl-width-edge', '--pl-width-reading', '--pl-width-data', '--pl-rail', '--pl-rail-sm', '--pl-tap-min', '--pl-tap-min-strict']);
  const semanticOnly = { '03-base.css': base, '06-components.css': components, '07-forms.css': forms, '08-instrument.css': instrument, '09-utilities.css': utilities };
  Object.keys(semanticOnly).forEach(fname => {
    const refs = (strip(semanticOnly[fname]).match(/var\((--pl-[a-z0-9-]+)/g) || []).map(s => s.replace('var(', ''));
    const offenders = [...new Set(refs.filter(r => primNames.has(r)))];
    ok('C1: ' + fname + ' has no direct primitive token use', offenders.length === 0, offenders.join(','));
  });
  // Layout exception: layout may use primitives, but only layout-measurement ones.
  const layoutRefs = (strip(layout).match(/var\((--pl-[a-z0-9-]+)/g) || []).map(s => s.replace('var(', ''));
  const layoutOffenders = [...new Set(layoutRefs.filter(r => primNames.has(r) && !layoutMeasureAllow.has(r)))];
  ok('C1: 04-layout uses only the allowed layout-measurement primitives (documented exception)', layoutOffenders.length === 0, 'direct primitive token use: ' + layoutOffenders.join(','));
})();
// Components consume semantic tokens (a component still references at least one
// semantic colour role — the policy above proves they use ONLY semantic ones).
ok('C1: components reference semantic colour roles', /var\(--pl-color-/.test(components));
// No raw brand hex/rgb/hsl inside component/forms/instrument styles.
ok('C2: no raw hex inside component layers', (strip(componentLayers).match(/#[0-9A-Fa-f]{3,8}\b/g) || []).length === 0,
  (strip(componentLayers).match(/#[0-9A-Fa-f]{3,8}\b/g) || []).join(','));
ok('C2: no raw rgb()/hsl() inside component layers', !/\b(rgb|hsl)a?\(/.test(strip(componentLayers)));
// No remote assets / fonts anywhere in the system.
ok('C3: no remote url() in the design system', !/url\(\s*['"]?https?:/i.test(primitives + semantic + base + layout + fonts + componentLayers + utilities));
ok('C3: no remote @import', !/@import[^;]*https?:/i.test(indexCss + consumerLayers));
// No third webfont: only Newsreader + Manrope families declared.
const faceFamilies = Array.from(fonts.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*'([^']+)'/g)).map(m => m[1]);
const webfontFamilies = faceFamilies.filter(f => !/Fallback/.test(f));
ok('C4: only Newsreader + Manrope webfonts', new Set(webfontFamilies).size === 2 && webfontFamilies.includes('Newsreader') && webfontFamilies.includes('Manrope'), webfontFamilies.join(','));
// No styling by IDs.
ok('C5: design system does not style by ID', !/#[a-zA-Z][\w-]*\s*\{/.test(strip(consumerLayers)) && !/#[a-zA-Z][\w-]*\s*,/.test(strip(consumerLayers)));
// No !important (documented exceptions would be explicit; there are none).
ok('C6: no !important in the design system', !/!important/.test(consumerLayers + primitives));
// No motion: no keyframes, no animation, no transition property, no autoplay.
ok('C7: no @keyframes in the design system', !/@keyframes/.test(consumerLayers));
ok('C7: no animation property', !/\banimation\s*:/.test(strip(consumerLayers)));
ok('C7: no transition property (F4c owns motion)', !/\btransition\s*:/.test(strip(consumerLayers)));
// Focus-visible exists.
ok('C8: focus-visible styling exists', /:focus-visible/.test(base) && /:focus-visible/.test(forms));
// Disabled state exists.
ok('C9: disabled state defined for buttons and inputs', /\.pl-button:disabled|\.pl-button\[aria-disabled/.test(components) && /\.pl-input:disabled/.test(forms));
// Form semantics demonstrated in showcase (label + describedby + aria-invalid).
ok('C10: forms use real labels', (html.match(/<label[^>]*class="pl-field__label"/g) || []).length >= 2 || (html.match(/class="pl-field__label"[^>]*for=/g) || []).length >= 1);
ok('C10: showcase demonstrates aria-describedby and aria-invalid', /aria-describedby=/.test(html) && /aria-invalid="true"/.test(html));
// Statuses not colour-only: each badge variant has a ::before shape marker, AND
// the six markers are geometrically DISTINCT (not just six rules that share a
// shape). We derive a shape signature per variant from its ::before declaration
// (ignoring colour) and require all six signatures to differ.
ok('C11: status badges carry a shape marker (not colour-only)', /\.pl-badge::before\s*\{[^}]*content/.test(strip(components)) &&
  (strip(components).match(/\.pl-badge--\w+::before/g) || []).length >= 6);
ok('C11: the six status markers are geometrically distinct', (function () {
  const variants = ['proven', 'feasible', 'incomplete', 'infeasible', 'unbounded', 'neutral'];
  const sigs = {};
  variants.forEach(v => {
    const m = strip(components).match(new RegExp('\\.pl-badge--' + v + '::before\\s*\\{([^}]*)\\}'));
    if (!m) { sigs[v] = 'MISSING-' + v; return; }
    // Signature = shape-defining declarations only (strip colours/backgrounds/borders-colour).
    const decl = m[1];
    const shape = (decl.match(/\b(border-radius|clip-path|transform|width|height|border-left|border-right|border-bottom|border-top|border)\s*:[^;]*/g) || [])
      .map(d => d.replace(/var\([^)]*\)/g, 'C').replace(/\s+/g, '').replace(/#[0-9A-Fa-f]{3,8}/g, 'C'))
      // drop pure colour borders like "border:1.5px solid C" keeping geometry (width/style)
      .join('|');
    sigs[v] = shape || 'EMPTY';
  });
  const values = variants.map(v => sigs[v]);
  return new Set(values).size === variants.length;
})(), 'markers not all distinct');

// ======================================================================
// COPY HONESTY (component laboratory + canonical F4b docs are reused references)
// ======================================================================
// Neither the showcase nor the canonical F4b docs may reintroduce copy we have
// decided against ("into a proof", "Measured, not estimated", "continue the
// search", or a generic "verification proof"). "proven" is allowed only when
// tied to optimality.
const catalogueDoc = read(path.join(siteDir, 'docs', 'design-system-components.md'));
const copySurfaces = { showcase: html, checkpointDoc: read(path.join(siteDir, 'docs', 'checkpoint-f4b-design-system-components.md')), catalogue: catalogueDoc };
Object.keys(copySurfaces).forEach(name => {
  const t = copySurfaces[name];
  ok('H1: ' + name + ' avoids the generic "into a proof" claim', !/into a proof\b/i.test(t) && !/decisions into proofs\b/i.test(t));
  ok('H1: ' + name + ' avoids "Measured, not estimated"', !/Measured,\s*not\s*estimated/i.test(t));
  ok('H1: ' + name + ' does not claim solve-again continues a prior search', !/continue the search/i.test(t));
  ok('H1: ' + name + ' avoids a generic "verification proof" label', !/verification proof\b/i.test(t));
});
// "proven" is allowed ONLY when tied to optimality ("solution proven"/"optimal ... proven").
ok('H2: any "proven" in the showcase is tied to optimality', (function () {
  // Strip tags first so class names like pl-badge--proven are not counted; we
  // only judge the visible copy.
  const text = html.replace(/<[^>]*>/g, ' ');
  const ctx = text.match(/[^.]{0,40}\bproven\b/gi) || [];
  return ctx.every(c => /optimal|solution|optimum/i.test(c));
})());

// ======================================================================
// FONTS
// ======================================================================
['newsreader-latin-wght-normal.woff2', 'newsreader-latin-ext-wght-normal.woff2',
 'manrope-latin-wght-normal.woff2', 'manrope-latin-ext-wght-normal.woff2',
 'Newsreader-OFL.txt', 'Manrope-OFL.txt'].forEach(f => {
  ok('F1: font asset exists: ' + f, fs.existsSync(path.join(dsDir, 'fonts', f)), f);
});
ok('F2: OFL licenses present and correct', /SIL Open Font License/i.test(read(path.join(dsDir, 'fonts', 'Newsreader-OFL.txt'))) && /SIL Open Font License/i.test(read(path.join(dsDir, 'fonts', 'Manrope-OFL.txt'))));
ok('F3: @font-face uses only local ./fonts/ src', (fonts.match(/@font-face\s*\{[\s\S]*?\}/g) || []).filter(f => /url\(/.test(f)).every(f => /url\(\s*['"]?\.\/fonts\//.test(f)));
ok('F4: variable weight range declared', /font-weight\s*:\s*200 800/.test(fonts));
ok('F4: font-display swap set', (fonts.match(/@font-face\s*\{[\s\S]*?\}/g) || []).filter(f => /url\(/.test(f)).every(f => /font-display\s*:\s*swap/.test(f)));
// Derived fallback metrics present.
ok('F5: metric-matched fallback faces exist', /'Newsreader Fallback'/.test(fonts) && /'Manrope Fallback'/.test(fonts));
ok('F5: ascent/descent/line-gap overrides derived', /ascent-override:73\.50%/.test(fonts) && /descent-override:26\.50%/.test(fonts) && /ascent-override:106\.60%/.test(fonts) && /descent-override:30\.00%/.test(fonts));
// Glyph honesty: five-language coverage claimed, ≤≥→ documented as mono.
ok('F6: fonts documented for en/es/pt/de/fr Latin text', /en\/es\/pt\/de\/fr/.test(fonts));
ok('F6: fonts do NOT claim to cover the maths operators', (function () {
  // Flag a POSITIVE coverage claim: "cover/contain/include ... ≤≥→" that is NOT
  // preceded by a negation (not / NOT / no / do not) within the same clause.
  const re = /([^.\n]{0,60}?)\b(covers?|contains?|includes?)\b[^.\n]{0,40}(?:≤|≥|→)/g;
  let m;
  while ((m = re.exec(fonts))) {
    const before = m[1];
    if (!/\b(not|no|never)\b/i.test(before)) return false;
  }
  return true;
})());
ok('F6: .pl-mathsym assigns operators to the mono stack', /\.pl-mathsym\s*\{[^}]*var\(--pl-font-family-data\)/.test(strip(utilities)));
ok('F6: arrow in action link uses mono deliberately', /\.pl-action-link::after\s*\{[^}]*var\(--pl-font-family-data\)/.test(strip(components)));
ok('F7: no remote font URL claim in docs/fonts', !/fonts\.googleapis|fonts\.gstatic/.test(fonts));

// F8 (audited font asset integrity): a canonical FONT-AUDIT.json pins the exact
// audited woff2 by SHA-256. The metadata (family, wght axis, metrics, glyph
// coverage) was audited on the real binaries during the checkpoint; here we do
// NOT re-parse the fonts (no fonttools, no external process) — we re-compute the
// SHA-256 of the shipped woff2 and require them to match the manifest, so the
// audited metadata is cryptographically bound to the exact files inspected.
(function () {
  const auditPath = path.join(dsDir, 'fonts', 'FONT-AUDIT.json');
  ok('F8: FONT-AUDIT.json manifest exists', fs.existsSync(auditPath));
  if (!fs.existsSync(auditPath)) return;
  let audit;
  try { audit = JSON.parse(read(auditPath)); } catch (e) { ok('F8: FONT-AUDIT.json parses', false, e.message); return; }
  ok('F8: manifest documents four woff2', Array.isArray(audit.fonts) && audit.fonts.length === 4, String(audit.fonts && audit.fonts.length));
  (audit.fonts || []).forEach(entry => {
    const fp = path.join(dsDir, 'fonts', entry.filename);
    ok('F8: audited font present: ' + entry.filename, fs.existsSync(fp));
    if (!fs.existsSync(fp)) return;
    const real = sha256(fp);
    ok('F8: SHA-256 matches audited manifest: ' + entry.filename, real === entry.sha256, real + ' vs ' + entry.sha256);
    ok('F8: byte size matches audited manifest: ' + entry.filename, fs.statSync(fp).size === entry.bytes, fs.statSync(fp).size + ' vs ' + entry.bytes);
    // The audited metadata itself must be internally consistent with F4b claims.
    ok('F8: audited wght axis is 200-800: ' + entry.filename, entry.wght_min === 200 && entry.wght_max === 800);
    ok('F8: audited glyph coverage marks ≤ ≥ → absent: ' + entry.filename, entry.has_le === false && entry.has_ge === false && entry.has_arrow === false);
  });
  ok('F8: manifest states the language coverage', /en\/es\/pt\/de\/fr/.test(audit.language_coverage || ''));
  ok('F8: manifest distinguishes audit-performed vs assets-pinned-by-hash', /audited/i.test(audit.audit_note || '') && /SHA-256/i.test(audit.audit_note || ''));
})();

// ======================================================================
// ISOLATION
// ======================================================================
ok('I1: showcase directory exists', fs.existsSync(showDir));
ok('I2: showcase imports the canonical design system', /href="\.\.\/\.\.\/src\/shared\/design-system\/index\.css"/.test(html));
// Showcase must NOT define design-system tokens itself.
ok('I3: showcase css does not define --pl-* tokens', (showcaseCss.match(/--pl-[a-z0-9-]+\s*:/g) || []).length === 0);
// Showcase css does not redeclare component classes.
ok('I3: showcase css does not redefine .pl- components', !/\.pl-button\s*\{|\.pl-receipt\s*\{|\.pl-badge\s*\{/.test(showcaseCss));
// Vite config must not reference design-review (so it is excluded from dist).
const vite = read(path.join(siteDir, 'vite.config.mjs')) || read(path.join(siteDir, 'vite.config.js'));
ok('I4: vite config found', vite.length > 0);
ok('I4: vite PAGES list excludes the showcase', /const PAGES\s*=/.test(vite) && vite.indexOf('design-review') === -1 && vite.indexOf('f4b') === -1);
// dist (if built) has no design-review and no design-system leakage.
const dist = path.join(siteDir, 'dist');
ok('I5: dist has no design-review', !fs.existsSync(dist) || !fs.existsSync(path.join(dist, 'design-review')));
ok('I5: dist has no design-system directory', !fs.existsSync(dist) || !fs.existsSync(path.join(dist, 'src')));

// ======================================================================
// PROTECTED PRODUCTION (exact set of 22 + existence + SHA-256 + bytes)
// ======================================================================
// The EXPECTED protected set is fixed HERE, in the contract, independently of the
// manifest — so the manifest cannot silently drop a path and quietly stop
// protecting it. The manifest supplies the baseline SHA-256/bytes; the contract
// supplies the authoritative list of what must be protected. We check: exactly 22
// entries, no duplicate path, no unexpected path, no expected path missing, and
// for each: the file exists and its real SHA-256 (and byte size) matches baseline.
(function () {
  const EXPECTED = [
    // 12 core production
    'index.html', 'solver.html', 'examples.html', 'capabilities.html', 'guide.html',
    'about.html', 'privacy.html', 'terms.html',
    'assets/plumline.css', 'assets/i18n.js', 'assets/examples-data.js', 'assets/product-capabilities.js',
    // 3 infra
    'vite.config.mjs', 'package.json', 'package-lock.json',
    // 2 engine/worker
    'engine/fragments/solver-ui/solve-worker-client.js', 'engine/generate-engine-mirror.js',
    // 5 catalogue
    'src/shared/examples/catalogue.js', 'src/shared/examples/index.js',
    'src/shared/examples/projectors.js', 'src/shared/examples/schema.js', 'src/shared/examples/serialize.js',
  ];
  ok('PP0: expected protected set is exactly 22 paths', EXPECTED.length === 22, String(EXPECTED.length));

  const mPath = path.join(__dirname, 'f4b-protected-baseline.json');
  ok('PP1: protected-baseline manifest exists', fs.existsSync(mPath));
  if (!fs.existsSync(mPath)) return;
  let man;
  try { man = JSON.parse(read(mPath)); } catch (e) { ok('PP1: manifest parses', false, e.message); return; }
  const files = man.files || [];
  const manifestPaths = files.map(f => f.path);
  const manifestSet = new Set(manifestPaths);
  const expectedSet = new Set(EXPECTED);

  // Exactly 22 entries, no duplicates.
  ok('PP1: manifest has exactly 22 entries', files.length === 22, String(files.length));
  ok('PP1: manifest has no duplicate path', manifestSet.size === manifestPaths.length, String(manifestPaths.length - manifestSet.size) + ' dup(s)');
  // No expected path missing from the manifest.
  EXPECTED.forEach(p => ok('PP1: expected protected path present in manifest: ' + p, manifestSet.has(p), 'expected protected path missing: ' + p));
  // No unexpected path in the manifest.
  manifestPaths.forEach(p => ok('PP1: manifest path is an expected protected path: ' + p, expectedSet.has(p), 'unexpected protected path: ' + p));

  // Each expected file exists and matches baseline SHA-256 (+ byte size).
  EXPECTED.forEach(p => {
    const entry = files.find(f => f.path === p);
    const fp = path.join(siteDir, p);
    ok('PP2: protected file exists: ' + p, fs.existsSync(fp));
    if (!fs.existsSync(fp) || !entry) return;
    const real = sha256(fp);
    ok('PP2: protected production hash changed? ' + p, real === entry.sha256, real + ' vs ' + entry.sha256);
    ok('PP2: protected production byte size matches: ' + p, fs.statSync(fp).size === entry.bytes, fs.statSync(fp).size + ' vs ' + entry.bytes);
  });
})();

// ======================================================================
// RESPONSIVE / ACCESSIBILITY
// ======================================================================
// Contrast: compute for critical semantic pairs using primitive values.
function prim(name) { const m = primitives.match(new RegExp('(' + name + ')\\s*:\\s*(#[0-9A-Fa-f]{6})')); return m ? m[2] : null; }
const cream100 = prim('--pl-cream-100'), white = prim('--pl-white'), green900 = prim('--pl-green-900'),
  green600 = prim('--pl-green-600'), green100 = prim('--pl-green-100'), brass700 = prim('--pl-brass-700'),
  brass500 = prim('--pl-brass-500'), brass100 = prim('--pl-brass-100'), ink900 = prim('--pl-ink-900'),
  ink700 = prim('--pl-ink-700'), ink500 = prim('--pl-ink-500'), ink400 = prim('--pl-ink-400'),
  amber700 = prim('--pl-amber-700'), amber100 = prim('--pl-amber-100'), red700 = prim('--pl-red-700'), red100 = prim('--pl-red-100');
const AA = 4.5;
[['text-primary/canvas', ink900, cream100], ['text-secondary/canvas', ink700, cream100],
 ['text-muted/canvas', ink500, cream100], ['text-faint/canvas', ink400, cream100],
 ['text-primary/surface', ink900, white], ['action text on brass fill', green900, brass500],
 ['process-text/canvas', brass700, cream100], ['process-text/brass-tint', brass700, brass100],
 ['verified/verified-tint', green600, green100], ['warning/warning-tint', amber700, amber100],
 ['error/error-tint', red700, red100], ['inverse text/inverse ground', cream100, green900]
].forEach(c => {
  const r = (c[1] && c[2]) ? contrast(c[1], c[2]) : 0;
  ok('A1: AA contrast >= 4.5 — ' + c[0], r >= AA, r ? r.toFixed(2) + ':1' : 'token missing');
});
// Target size: buttons and native controls meet a comfortable target.
ok('A2: buttons use the comfortable tap-min target', /\.pl-button\s*\{[^}]*min-height:var\(--pl-target-comfortable\)/.test(strip(components)));
ok('A2: inputs use the comfortable tap-min target', /min-height:var\(--pl-target-comfortable\)/.test(strip(forms)));
ok('A2: checkbox rows meet tap-min', /\.pl-check\s*\{[^}]*min-height:var\(--pl-target-comfortable\)/.test(strip(forms)));
// Local-scroll matrix pattern.
ok('A3: matrix wrapper provides accessible local scroll', /\.pl-matrix-scroll\s*\{[^}]*overflow-x:auto/.test(strip(components)));
ok('A3: showcase matrix wrapper is a labelled focusable region', /class="pl-matrix-scroll"[^>]*tabindex="0"[^>]*role="region"/.test(html) || /class="pl-matrix-scroll"[^>]*role="region"[^>]*tabindex="0"/.test(html));
// Heading hierarchy: one H1, no skipped level.
const h1s = (html.match(/<h1[\s>]/g) || []).length;
ok('A4: exactly one H1 in showcase', h1s === 1, String(h1s));
const seq = (html.match(/<h([1-6])[\s>]/g) || []).map(h => Number(h.match(/h([1-6])/)[1]));
let orderOk = true, prev = 0; seq.forEach(l => { if (prev && l > prev + 1) orderOk = false; prev = l; });
ok('A4: heading order never skips a level', orderOk, seq.join(','));
// Landmarks.
ok('A5: showcase has main and footer landmarks', /<main[\s>]/.test(html) && /<footer[\s>]/.test(html));
// No fake links. "Not fake" means more than "the fragment exists":
//  - no href="#" placeholders;
//  - every in-page fragment link resolves to exactly one id;
//  - any link whose label promises to open the Solver must navigate to the REAL
//    solver.html, not back to a showcase section (an existing fragment that does
//    not do what the label says is still a fake destination).
ok('A6: no href="#" placeholder links', !/href="#"/.test(html));
const fragTargets = (html.match(/href="#([A-Za-z][\w-]*)"/g) || []).map(m => m.match(/#([\w-]+)/)[1]);
const ids = (html.match(/\sid="([\w-]+)"/g) || []).map(m => m.match(/id="([\w-]+)"/)[1]);
fragTargets.forEach(t => ok('A6: fragment #' + t + ' resolves to one id', ids.filter(x => x === t).length === 1, 'matches=' + ids.filter(x => x === t).length));
// Links whose visible text mentions "solver" must point at solver.html, not a fragment.
(function () {
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
  anchors.forEach(a => {
    const label = a.replace(/<[^>]*>/g, '').trim();
    const hrefM = a.match(/href="([^"]*)"/);
    const href = hrefM ? hrefM[1] : '';
    if (/\bsolver\b/i.test(label)) {
      ok('A6: solver link navigates to the real solver.html: "' + label + '"', /solver\.html/.test(href) && href.charAt(0) !== '#', 'href=' + href);
    }
  });
})();

// ======================================================================
// ROADMAP OWNERSHIP
// ======================================================================
const dsDoc = read(path.join(siteDir, 'docs', 'checkpoint-f4b-design-system-components.md'));
ok('R1: F4b doc exists', dsDoc.length > 0);
ok('R2: F4b owns tokens/components', /F4b[^.]*tokens[^.]*components|tokens and (reusable )?components/i.test(dsDoc));
ok('R3: motion is deferred to F4c', /F4c[^.]*motion|motion[^.]*F4c/i.test(dsDoc));
ok('R4: Home redesign remains F9', /F9 owns the narrative Home|Home[^.]{0,30}F9|F9[^.]{0,30}Home/i.test(dsDoc) && !/F4b (redesigns|owns|does)[^.]{0,20}the Home redesign\b/i.test(dsDoc));
ok('R5: public/internal page redesign remains F10', /F10 owns[^.]{0,40}(public|rest)|F10/.test(dsDoc) && !/F4c (redesigns|owns|rolls)[^.]{0,40}(public|Solver|Examples)/i.test(strip(dsDoc)));
// No doc may reassign owners.
ok('R6: doc does not say Home belongs to F4b', !/Home[^.]{0,20}(belongs to|is)\s*F4b/i.test(dsDoc));
ok('R6: doc does not say public pages belong to F4c', !/public pages[^.]{0,20}(belong to|are)\s*F4c/i.test(dsDoc));

// ---- Portability self-check -----------------------------------------------
ok('P1: suite spawns no external process', (function () {
  const self = read(path.join(__dirname, 'tests_f4b_design_system.js'));
  const needle = 'child' + '_process';
  return self.indexOf(needle) === -1 && !/\b(execSync|execFileSync|spawnSync|spawn)\s*\(/.test(self);
})());

if (require.main === module) {
  failures.forEach(f => console.log('  FAIL: ' + f));
  console.log('F4B DESIGN SYSTEM TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass, fail };
