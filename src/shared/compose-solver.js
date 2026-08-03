/* compose-solver.js — deterministic build-time composition of the solver.html
 * interface from REAL internal fragment files.
 *
 * Checkpoint D1 extracts contiguous, verbatim regions of the solver UI (starting
 * with the grid + input-interaction subsystem) out of the single inline <script>
 * in solver.html into internal fragments under engine/fragments/solver-ui/. The
 * SOURCE solver.html carries a marker pair per extracted region:
 *
 *   /* SOLVER_UI_<NAME>_START:<fragment-file> *␚/
 *   /* SOLVER_UI_<NAME>_END *␚/
 *
 * This module replaces each marker block with the EXACT bytes of the declared
 * fragment — no transformation, no reindent, no trailing-newline fixups. The
 * composed output is therefore byte-identical to the pre-D1 solver.html.
 *
 * It is the ONE canonical implementation used by BOTH Vite (dev + build) and the
 * Node test helpers, so dev, prod, and tests compose identically. Fragments live
 * OUTSIDE assets/ (they are never published, never fetched, never in dist, never
 * in the public manifest).
 *
 * Strictness: only fragments named in a CLOSED allowlist may be inserted, only
 * from the authorized directory, and only in the authorized order. Any anomaly
 * throws — this never silently produces a wrong solver.
 *
 * This module NEVER touches the engine region (/* ENGINE_START *␚/ ..
 * /* ENGINE_END *␚/): a marker found inside the engine region is fatal.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---- Authorized fragments (CLOSED allowlist) ----------------------------------
// name -> fragment filename (relative to FRAGMENT_DIR). Order in this array is the
// ONLY legal source order; composition throws if the source markers appear in a
// different order. Adding a region here is a deliberate, reviewed change.
const FRAGMENT_DIR = path.join('engine', 'fragments', 'solver-ui');
const SOLVER_FILE = 'solver.html';
const REGIONS = [
  { name: 'EXAMPLES_LOADING', file: 'examples-loading.js' },
  { name: 'GRID_INTERACTION', file: 'grid-interaction.js' },
  { name: 'SOLVE_WORKER_CLIENT', file: 'solve-worker-client.js' },
  { name: 'VARIABLE_SETTINGS', file: 'variable-settings.js' },
  { name: 'SOLVE_ORCHESTRATION', file: 'solve-orchestration.js' },
  { name: 'SOLVE_RESULTS', file: 'errors-results.js' },
  { name: 'RECEIPT_PLOT_EXPORTS', file: 'receipt-plot-exports.js' },
  { name: 'EXAMPLES_DRAWER', file: 'examples-drawer.js' },
  { name: 'BOOTSTRAP_ACCESSIBILITY', file: 'bootstrap-accessibility.js' },
];
const BY_NAME = Object.create(null);
REGIONS.forEach((r, i) => { BY_NAME[r.name] = { file: r.file, order: i }; });

const MARK_PREFIX = 'SOLVER_UI_';
const ENGINE_START = '/* ENGINE_START */';
const ENGINE_END = '/* ENGINE_END */';

// ---- Canonical engine source (Checkpoint E1) ----------------------------------
// The production engine mathematics live in ONE internal file. The source
// solver.html carries a single marker pair in place of the old inline engine:
//
//   /* SOLVER_ENGINE_SOURCE_START:plumline-engine.js */
//   /* SOLVER_ENGINE_SOURCE_END */
//
// composeEngineSource() replaces that block with the VERBATIM bytes of the
// canonical file (which are exactly the official slice: they START with
// /* ENGINE_START */ and END just before /* ENGINE_END */) followed by the
// /* ENGINE_END */ marker. The composed output therefore carries the historical
// ENGINE_START..END region byte-identically, and engineSource() in the Worker
// keeps finding the same slice. The canonical file lives OUTSIDE assets/ (never
// published, never fetched, never in dist, never in the public manifest) and is
// the ONLY editable source of the engine from E1 on.
const ENGINE_SOURCE_DIR = path.join('engine', 'source');
const ENGINE_SOURCE_FILE = 'plumline-engine.js';
const ENGINE_SRC_START_RE = /\/\* SOLVER_ENGINE_SOURCE_START:([^*\s]+) \*\//g;
const ENGINE_SRC_END_RE = /\/\* SOLVER_ENGINE_SOURCE_END \*\//g;

// Resolve the canonical engine file from a CLOSED allowlist: exactly one name,
// exactly one directory, no absolute paths, no traversal, no subdirectories.
function resolveEngineSource(file, rootDir) {
  if (file !== ENGINE_SOURCE_FILE) {
    throw new Error('compose-solver: engine source must be ' + ENGINE_SOURCE_FILE +
      ' (got ' + file + ')');
  }
  if (path.isAbsolute(file) || file.indexOf('/') !== -1 || file.indexOf('\\') !== -1 ||
      file.indexOf('..') !== -1) {
    throw new Error('compose-solver: engine source path not allowed: ' + file);
  }
  return path.join(rootDir, ENGINE_SOURCE_DIR, file);
}

/**
 * composeEngineSource(html, rootDir) -> html with the engine inlined.
 * Replaces the single SOLVER_ENGINE_SOURCE_START:<file> .. SOLVER_ENGINE_SOURCE_END
 * block with (canonical bytes) + ENGINE_END. Deterministic; throws on any anomaly.
 * If the page carries no engine-source marker it is returned unchanged (a page
 * that already holds an inline ENGINE_START..END, e.g. a pre-E1 fixture, is left
 * to the UI step).
 */
function composeEngineSource(html, rootDir) {
  rootDir = rootDir || '.';
  const starts = [];
  let m;
  while ((m = ENGINE_SRC_START_RE.exec(html)) !== null) {
    starts.push({ file: m[1], index: m.index, len: m[0].length });
  }
  const ends = [];
  while ((m = ENGINE_SRC_END_RE.exec(html)) !== null) {
    ends.push({ index: m.index, len: m[0].length });
  }
  if (starts.length === 0 && ends.length === 0) {
    return html; // no engine-source marker: page not migrated to E1
  }
  if (starts.length !== ends.length) {
    throw new Error('compose-solver: unbalanced ENGINE_SOURCE markers (' +
      starts.length + ' start, ' + ends.length + ' end)');
  }
  if (starts.length > 1) {
    throw new Error('compose-solver: more than one ENGINE_SOURCE start marker');
  }
  const s = starts[0], e = ends[0];
  if (e.index < s.index) {
    throw new Error('compose-solver: ENGINE_SOURCE_END before START');
  }
  // Between the two markers the source holds only whitespace/newline.
  const between = html.slice(s.index + s.len, e.index);
  if (between.replace(/[\r\n]/g, '') !== '') {
    throw new Error('compose-solver: unexpected content between ENGINE_SOURCE markers');
  }
  // The migrated source must NOT already contain an inline engine region.
  if (html.indexOf(ENGINE_START) !== -1 || html.indexOf(ENGINE_END) !== -1) {
    throw new Error('compose-solver: source carries an ENGINE_SOURCE marker AND an inline engine region');
  }
  const full = resolveEngineSource(s.file, rootDir);
  if (!fs.existsSync(full)) {
    throw new Error('compose-solver: engine source file not found: ' + s.file);
  }
  const bytes = fs.readFileSync(full, 'utf8');
  if (bytes.length === 0) {
    throw new Error('compose-solver: engine source is empty: ' + s.file);
  }
  // The canonical file IS the official slice: it must start with ENGINE_START and
  // must NOT itself contain an ENGINE_END (that marker is added on composition).
  if (bytes.indexOf(ENGINE_START) !== 0) {
    throw new Error('compose-solver: engine source must begin with ENGINE_START');
  }
  if (bytes.indexOf(ENGINE_END) !== -1) {
    throw new Error('compose-solver: engine source must not contain ENGINE_END');
  }
  // Replace [START marker .. END marker] with canonical bytes + ENGINE_END.
  const out = html.slice(0, s.index) + bytes + ENGINE_END + html.slice(e.index + e.len);
  // No residual engine-source marker may survive.
  if (/\/\* SOLVER_ENGINE_SOURCE_(?:START|END)/.test(out)) {
    throw new Error('compose-solver: residual ENGINE_SOURCE marker after composition');
  }
  // The composed engine slice must equal the canonical bytes exactly.
  const s2 = out.indexOf(ENGINE_START), e2 = out.indexOf(ENGINE_END);
  if (s2 === -1 || e2 === -1 || out.slice(s2, e2) !== bytes) {
    throw new Error('compose-solver: composed engine slice does not match canonical source');
  }
  return out;
}

function isSolverPage(label) {
  const base = String(label || '').replace(/\\/g, '/').split('/').pop();
  return base === SOLVER_FILE;
}

// findEngineRegion(html) -> { start, end } byte offsets of the STRUCTURAL engine
// markers in a COMPOSED solver, or null if none. The literals ENGINE_START/END
// also appear INSIDE engineSource() as quoted search strings; the structural
// markers stand on their own comment line (preceded by a newline). This is the
// ONE shared way to locate the engine region; tests must use it rather than a
// naive indexOf/lastIndexOf, which would confuse the literal for the marker.
function isStructuralMarkerAt(html, idx) {
  if (idx <= 0) return idx === 0;
  return html[idx - 1] === '\n';
}
function findEngineRegion(html) {
  const starts = [];
  let i = -1;
  while ((i = html.indexOf(ENGINE_START, i + 1)) !== -1) {
    if (isStructuralMarkerAt(html, i)) starts.push(i);
  }
  const ends = [];
  i = -1;
  while ((i = html.indexOf(ENGINE_END, i + 1)) !== -1) {
    if (isStructuralMarkerAt(html, i)) ends.push(i);
  }
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error('findEngineRegion: expected exactly one structural ENGINE_START and ENGINE_END, got ' +
      starts.length + '/' + ends.length);
  }
  if (ends[0] < starts[0]) throw new Error('findEngineRegion: ENGINE_END before ENGINE_START');
  return { start: starts[0], end: ends[0] };
}


// Validate a declared fragment path: closed allowlist name, no traversal, no
// absolute path, stays inside FRAGMENT_DIR. Returns the resolved absolute path.
function resolveFragment(name, declaredFile, rootDir) {
  const entry = BY_NAME[name];
  if (!entry) throw new Error('compose-solver: unknown marker SOLVER_UI_' + name);
  if (declaredFile !== entry.file) {
    throw new Error('compose-solver: marker SOLVER_UI_' + name +
      ' declares "' + declaredFile + '" but the allowlist fixes "' + entry.file + '"');
  }
  if (path.isAbsolute(declaredFile)) {
    throw new Error('compose-solver: fragment path must be relative: ' + declaredFile);
  }
  if (/[\\/]/.test(declaredFile) || declaredFile.indexOf('..') !== -1) {
    throw new Error('compose-solver: fragment name must be a bare filename in the authorized dir: ' + declaredFile);
  }
  const dir = path.resolve(rootDir, FRAGMENT_DIR);
  const full = path.resolve(dir, declaredFile);
  // Containment check (defends against traversal even if the above passed).
  const rel = path.relative(dir, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('compose-solver: fragment escapes the authorized directory: ' + declaredFile);
  }
  return full;
}

/**
 * composeSolverInterface(html, rootDir) -> composed HTML.
 * Replaces each SOLVER_UI_<NAME>_START:<file> .. SOLVER_UI_<NAME>_END block with
 * the verbatim bytes of the declared fragment. Deterministic; throws on any
 * anomaly. Does not modify pages other than solver.html (caller decides when to
 * call this; it only rewrites the string it is given).
 */
function composeSolverInterface(html, rootDir) {
  if (typeof html !== 'string') throw new Error('compose-solver: html must be a string');
  rootDir = rootDir || '.';

  // CANONICAL COMPOSITION SEQUENCE (Checkpoint E1):
  //   1. engine source  -> restores the ENGINE_START..END region from the
  //      internal canonical file (this step is a no-op for a pre-E1 page that
  //      still holds the engine inline).
  //   2. solver UI       -> restores the 9 UI regions from their fragments.
  // Vite's own HTML transform runs afterwards on the composed result. This is
  // the ONE canonical order; dev, build, tests and validate_dist all use it.
  html = composeEngineSource(html, rootDir);

  // Engine boundary in the (now engine-composed) source: must exist and be
  // well-ordered before the UI step runs.
  const engS = html.indexOf(ENGINE_START);
  const engE = html.indexOf(ENGINE_END);
  if (engS === -1 || engE === -1 || engE < engS) {
    throw new Error('compose-solver: engine markers missing or out of order');
  }

  // Find all SOLVER_UI_* START/END markers, in document order.
  const startRe = /\/\* SOLVER_UI_([A-Z0-9_]+)_START:([^*\s]+) \*\//g;
  const endRe = /\/\* SOLVER_UI_([A-Z0-9_]+)_END \*\//g;

  const starts = [];
  let m;
  while ((m = startRe.exec(html)) !== null) {
    starts.push({ name: m[1], file: m[2], index: m.index, len: m[0].length });
  }
  const ends = [];
  while ((m = endRe.exec(html)) !== null) {
    ends.push({ name: m[1], index: m.index, len: m[0].length });
  }

  if (starts.length === 0 && ends.length === 0) {
    // No solver-UI markers at all: nothing to compose (page not yet migrated).
    return html;
  }
  if (starts.length !== ends.length) {
    throw new Error('compose-solver: unbalanced START/END markers (' +
      starts.length + ' start, ' + ends.length + ' end)');
  }

  // No marker of either kind may fall inside the engine region.
  const engEndAbs = engE + ENGINE_END.length;
  for (const s of starts.concat(ends)) {
    if (s.index >= engS && s.index < engEndAbs) {
      throw new Error('compose-solver: a SOLVER_UI marker lies inside the engine region');
    }
  }

  // Pair START/END by document order and validate structure.
  // Each START must be immediately followed (in order) by its matching END with
  // the SAME name, and pairs must not nest or overlap.
  const seen = Object.create(null);
  const observedOrder = [];
  const replacements = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = ends[i];
    if (s.name !== e.name) {
      throw new Error('compose-solver: START ' + s.name + ' does not match END ' + e.name +
        ' (markers must be in order, not nested)');
    }
    if (e.index < s.index) {
      throw new Error('compose-solver: END before START for ' + s.name);
    }
    if (seen[s.name]) {
      throw new Error('compose-solver: duplicate marker SOLVER_UI_' + s.name);
    }
    seen[s.name] = true;
    observedOrder.push(s.name);
    // Between START and its END, the source holds only whitespace/newline (the
    // fragment content is what we insert). Reject residual content.
    const between = html.slice(s.index + s.len, e.index);
    if (between.replace(/[\r\n]/g, '') !== '') {
      throw new Error('compose-solver: unexpected content between markers for ' + s.name);
    }
    const full = resolveFragment(s.name, s.file, rootDir);
    if (!fs.existsSync(full)) {
      throw new Error('compose-solver: fragment file not found: ' + s.file);
    }
    const bytes = fs.readFileSync(full, 'utf8');
    if (bytes.length === 0) {
      throw new Error('compose-solver: fragment is empty: ' + s.file);
    }
    // Replace from START marker through END marker (inclusive) with fragment bytes.
    replacements.push({ from: s.index, to: e.index + e.len, text: bytes });
  }

  // Order check: observed source order must equal the allowlist order.
  const expectedOrder = observedOrder.slice().sort((a, b) => BY_NAME[a].order - BY_NAME[b].order);
  for (let i = 0; i < observedOrder.length; i++) {
    if (observedOrder[i] !== expectedOrder[i]) {
      throw new Error('compose-solver: markers out of order (expected ' +
        expectedOrder.join(',') + ', got ' + observedOrder.join(',') + ')');
    }
  }

  // Completeness check: once a page carries ANY solver-UI marker it must carry a
  // marker for EVERY declared region — a region declared in REGIONS but missing
  // from the source would silently drop its fragment. (A page with zero markers is
  // "not yet migrated" and is handled earlier, so this never trips on those.)
  if (observedOrder.length > 0) {
    for (const r of REGIONS) {
      if (observedOrder.indexOf(r.name) === -1) {
        throw new Error('compose-solver: declared region SOLVER_UI_' + r.name +
          ' has no marker in the source');
      }
    }
  }

  // Apply replacements right-to-left so indices stay valid.
  replacements.sort((a, b) => b.from - a.from);
  let out = html;
  for (const r of replacements) {
    out = out.slice(0, r.from) + r.text + out.slice(r.to);
  }

  // No residual SOLVER_UI marker may survive composition.
  if (/\/\* SOLVER_UI_[A-Z0-9_]+_(?:START|END)/.test(out)) {
    throw new Error('compose-solver: residual SOLVER_UI marker after composition');
  }

  // Engine region must be byte-identical after composition (defensive).
  const s2 = out.indexOf(ENGINE_START);
  const e2 = out.indexOf(ENGINE_END);
  if (s2 === -1 || e2 === -1 || out.slice(s2, e2) !== html.slice(engS, engE)) {
    throw new Error('compose-solver: engine region changed during composition');
  }

  return out;
}

// Convenience: compose only when the page is solver.html AND it carries markers.
function composeSolverIfNeeded(html, label, rootDir) {
  if (!isSolverPage(label)) return html;
  // Compose when the page carries either a solver-UI marker or the engine-source
  // marker (an E1 source has both; either alone is enough to trigger).
  const hasUi = html.indexOf('/* ' + MARK_PREFIX) !== -1;
  const hasEngineSrc = html.indexOf('/* SOLVER_ENGINE_SOURCE_START:') !== -1;
  if (!hasUi && !hasEngineSrc) return html;
  return composeSolverInterface(html, rootDir);
}

module.exports = {
  composeSolverInterface: composeSolverInterface,
  composeSolverIfNeeded: composeSolverIfNeeded,
  composeEngineSource: composeEngineSource,
  FRAGMENT_DIR: FRAGMENT_DIR,
  REGIONS: REGIONS,
  ENGINE_SOURCE_DIR: ENGINE_SOURCE_DIR,
  ENGINE_SOURCE_FILE: ENGINE_SOURCE_FILE,
  isSolverPage: isSolverPage,
  findEngineRegion: findEngineRegion,
};
