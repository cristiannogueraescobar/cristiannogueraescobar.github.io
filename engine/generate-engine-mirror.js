/* generate-engine-mirror.js — the single authoritative generator for the
 * Node/add-on mirror engine/engine.js.
 *
 * It reads ONLY the canonical source (engine/source/plumline-engine.js), applies
 * ONLY the platform adaptations declared in engine/source/engine-platform-adapter.json
 * (the header, the IIFE + CommonJS/global wrapper, and the two approved function
 * divergences newContext_ / readConstraint_), and emits a standalone module.
 *
 * It contains NO full copies of mathematical functions. Every transformation
 * checks it matches EXACTLY ONE site with the expected previous text and fails
 * loudly on zero or multiple matches. It is deterministic: LF, UTF-8, no
 * timestamps, no absolute paths, no variable versions, no network, and it never
 * runs the engine or reads dist / solver.html. It never modifies the canonical
 * file.
 *
 * Usage:
 *   node engine/generate-engine-mirror.js            # print generated mirror to stdout
 *   node engine/generate-engine-mirror.js --write    # atomically replace engine/engine.js
 *   const { generateMirror } = require('./generate-engine-mirror.js')
 */
'use strict';
const fs = require('fs');
const path = require('path');

function replaceExactlyOnce(src, from, to, label) {
  const idx = src.indexOf(from);
  if (idx === -1) throw new Error('adapter ' + label + ': expected text not found (zero matches)');
  if (src.indexOf(from, idx + 1) !== -1) throw new Error('adapter ' + label + ': expected text found more than once (multiple matches)');
  return src.slice(0, idx) + to + src.slice(idx + from.length);
}

// Build the mirror text from the canonical source + the adapter manifest.
function generateMirror(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  const canonPath = path.join(siteDir, 'engine', 'source', 'plumline-engine.js');
  const adapterPath = path.join(siteDir, 'engine', 'source', 'engine-platform-adapter.json');
  const canon = fs.readFileSync(canonPath, 'utf8');
  const adapter = JSON.parse(fs.readFileSync(adapterPath, 'utf8'));

  // 1. Strip the leading /* ENGINE_START */ marker line: the mirror is a
  //    standalone module, not a Worker slice, so it carries no ENGINE markers.
  const startMarker = adapter.header.canonical_first_line + '\n';
  if (canon.indexOf(startMarker) !== 0) throw new Error('canonical source must begin with ' + adapter.header.canonical_first_line);
  let body = canon.slice(startMarker.length);

  // The canonical body must NOT contain an ENGINE_END marker (approved convention).
  if (body.indexOf('/* ENGINE_END */') !== -1) throw new Error('canonical body unexpectedly contains ENGINE_END');

  // 2. Apply adaptation A1 (newContext_): options-aware signature + fallback.
  const a1 = adapter.adaptations.find(a => a.id === 'A1');
  body = replaceExactlyOnce(body, a1.canonical_signature + ' {', a1.mirror_signature + ' {', 'A1.signature');
  body = replaceExactlyOnce(body, a1.canonical_fallback_block, a1.mirror_fallback_block, 'A1.fallback');

  // 3. Apply adaptation A2 (readConstraint_): nest the variable-aware block.
  //    Canonical:  if (limitFormula !== null && variables) { <block> }
  //    Mirror:     if (limitFormula !== null) { if (variables) { <block> } }
  //    We rewrite the guard line and add the inner guard + a matching close brace.
  const a2 = adapter.adaptations.find(a => a.id === 'A2');
  body = replaceExactlyOnce(body, a2.canonical_guard, a2.mirror_guard_outer + '\n  ' + a2.mirror_guard_inner.trim(), 'A2.guard');
  // Close the extra inner brace: the block ends at the canonical close of the
  // combined guard. Locate the exact closing sequence of that block and add one
  // more brace. The block closes with the `}` that ends the try/catch region,
  // just before `  }\n\n  const current = cellAt_(grid, a1).value;`.
  const a2Close = '  }\n\n  const current = cellAt_(grid, a1).value;';
  body = replaceExactlyOnce(body, a2Close, '    }\n  }\n\n  const current = cellAt_(grid, a1).value;', 'A2.close');

  // 4. Wrap: generated-file header + platform header + body + IIFE/export tail.
  const w = adapter.wrapper;
  const genBanner =
    '/* GENERATED FILE — DO NOT EDIT MANUALLY.\n' +
    ' * Canonical source: engine/source/plumline-engine.js\n' +
    ' * Regenerate with: npm run generate:engine-mirror\n' +
    ' * This mirror is a deterministic derivation of the canonical engine plus the\n' +
    ' * two approved platform adaptations (newContext_, readConstraint_) and the\n' +
    ' * Node/add-on wrapper. Edit the canonical source, not this file. */\n';
  const header = genBanner + adapter.header.mirror_first_line + '\n';
  const apiLines = w.api_exports.map(function (name, i) {
    const comma = i === w.api_exports.length - 1 ? '' : ',';
    return '    ' + name + ': ' + name + comma;
  }).join('\n');
  const tail = '\n' + w.open + '\n' + w.api_var + '\n' + apiLines + '\n  };\n' + w.exports_tail + '\n' + w.close + '\n';

  return header + body + tail;
}

// Atomic write: generate into a temp file in the same directory, then rename.
function writeMirror(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  const out = path.join(siteDir, 'engine', 'engine.js');
  const text = generateMirror(siteDir);
  const tmp = out + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(tmp, text, { encoding: 'utf8' });
    fs.renameSync(tmp, out);
  } finally {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (e) {}
  }
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(text).digest('hex');
}

module.exports = { generateMirror: generateMirror, writeMirror: writeMirror };

if (require.main === module) {
  const write = process.argv.indexOf('--write') !== -1;
  if (write) {
    const sha = writeMirror(path.join(__dirname, '..'));
    console.log('engine/engine.js written; SHA-256: ' + sha);
  } else {
    process.stdout.write(generateMirror(path.join(__dirname, '..')));
  }
}
