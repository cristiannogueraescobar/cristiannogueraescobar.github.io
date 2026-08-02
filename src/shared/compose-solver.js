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

function isSolverPage(label) {
  const base = String(label || '').replace(/\\/g, '/').split('/').pop();
  return base === SOLVER_FILE;
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

  // Engine boundary in the incoming source (must exist and be well-ordered).
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
  if (html.indexOf('/* ' + MARK_PREFIX) === -1) return html;
  return composeSolverInterface(html, rootDir);
}

module.exports = {
  composeSolverInterface: composeSolverInterface,
  composeSolverIfNeeded: composeSolverIfNeeded,
  FRAGMENT_DIR: FRAGMENT_DIR,
  REGIONS: REGIONS,
  isSolverPage: isSolverPage,
};
