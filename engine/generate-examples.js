#!/usr/bin/env node
/* generate:examples — the ONE generator/compositor for every catalogue projection
 * (Checkpoint F1). It regenerates the derivable regions of the served files from the
 * single validated catalogue authority and reports what would change.
 *
 * Covered projections:
 *   - assets/i18n.js       : the two exName_/exDesc_ sub-sections per language
 *                            (catalogue.length keys x 2 x 5 langs; the original
 *                            F1/F5 baseline was 9 keys = 180 occurrences),
 *                            regenerated in place by closed, validated structure (no markers).
 *   - assets/examples-data.js : the META lines (key/slug/category/type/sense), one per
 *                            catalogue record (append-only; the original baseline held 9).
 *   - examples.html        : the ItemList JSON-LD (position/name/url).
 *   - solver.html          : the EXAMPLES object is projected at COMPOSITION time
 *                            from the catalogue via a marker, so it is not a
 *                            versioned artifact this generator writes; it is listed
 *                            here for completeness and checked by the composer.
 *
 * Guarantees: loads + validates the catalogue first; builds every projection in
 * memory; compares against the current bytes; writes atomically (temp file + rename)
 * only files that actually change; UTF-8 + LF; no timestamps; no absolute paths in
 * output; never reads dist; never runs Vite; never touches the engine; works on
 * Windows/Linux and from paths with spaces; two runs produce identical output (zero
 * diff). With --check it writes nothing and exits non-zero if anything is stale.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function run(siteDir, opts) {
  opts = opts || {};
  const checkOnly = !!opts.check;
  const { loadAndValidateCatalogue } = require(path.resolve(siteDir, 'src', 'shared', 'examples', 'index.js'));
  const { catalogue, serialize } = loadAndValidateCatalogue(siteDir);

  const projections = [];

  // --- i18n.js: regenerate the example regions in place ---
  const i18nPath = path.join(siteDir, 'assets', 'i18n.js');
  const { regenerateI18nExampleRegions } = require(path.resolve(siteDir, 'src', 'shared', 'examples', 'projectors.js'));
  const i18nCurrent = fs.readFileSync(i18nPath, 'utf8');
  const i18nNext = regenerateI18nExampleRegions(i18nCurrent, catalogue, serialize, ['en', 'es', 'pt', 'de', 'fr']);
  projections.push({ file: 'assets/i18n.js', pathAbs: i18nPath, current: i18nCurrent, next: i18nNext });

  // --- examples-data.js: replace the META block lines in place ---
  const edPath = path.join(siteDir, 'assets', 'examples-data.js');
  const edCurrent = fs.readFileSync(edPath, 'utf8');
  const edNext = replaceMetaLines(edCurrent, serialize.examplesDataMetaLines(catalogue), catalogue.map(r => r.key));
  projections.push({ file: 'assets/examples-data.js', pathAbs: edPath, current: edCurrent, next: edNext });

  // --- examples.html: replace the ItemList JSON-LD in place ---
  const exPath = path.join(siteDir, 'examples.html');
  const exCurrent = fs.readFileSync(exPath, 'utf8');
  const exNext = replaceJsonLd(exCurrent, serialize.examplesJsonLd(catalogue));
  projections.push({ file: 'examples.html', pathAbs: exPath, current: exCurrent, next: exNext });

  const changed = [];
  projections.forEach(p => { if (p.current !== p.next) changed.push(p.file); });

  if (checkOnly) {
    return { ok: changed.length === 0, changed: changed, files: projections.map(p => p.file) };
  }

  // Atomic writes for changed files only.
  projections.forEach(p => {
    if (p.current !== p.next) {
      const tmp = p.pathAbs + '.tmp-gen';
      fs.writeFileSync(tmp, p.next, { encoding: 'utf8' });
      fs.renameSync(tmp, p.pathAbs);
    }
  });
  return { ok: true, changed: changed, files: projections.map(p => p.file) };
}

// Replace the contiguous META lines (each `{ key: '<k>' ... }`) with the projected lines.
// Count-agnostic (append-only growth): the old block is located by its REAL extent, validated as
// the exact historical PREFIX of the current canonical keys (no silent delete/reorder/shrink/dup),
// and replaced with a length-changing splice. Hardcodes no count.
function replaceMetaLines(source, metaLines, keys) {
  const lines = source.split('\n');
  const keyRe = /\{ key: '([^']+)'/;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp("\\{ key: '" + keys[0] + "'").test(lines[i])) { start = i; break; }
  }
  if (start === -1) throw new Error('generate: META block not found');
  // Read the block's REAL extent: the contiguous run of `{ key: '...' }` lines from start.
  const oldKeys = [];
  let end = start;
  while (end < lines.length) {
    const m = keyRe.exec(lines[end]);
    if (!m) break;
    oldKeys.push(m[1]);
    end++;
  }
  const oldLen = end - start;
  // Validate: no duplicates, not a shrink, and the old keys are the exact historical prefix.
  const seen = {};
  oldKeys.forEach(k => { if (seen[k]) throw new Error('generate: duplicate META key "' + k + '"'); seen[k] = true; });
  if (oldKeys.length > keys.length) throw new Error('generate: old META block longer than canonical (shrink)');
  oldKeys.forEach((k, j) => {
    if (k !== keys[j]) throw new Error('generate: META block is not the historical prefix of the canonical keys (position ' + j + ': found "' + k + '", expected "' + keys[j] + '")');
  });
  lines.splice(start, oldLen, ...metaLines);
  return lines.join('\n');
}

function replaceJsonLd(source, jsonld) {
  const a = source.indexOf('{"@context"');
  if (a === -1) throw new Error('generate: JSON-LD not found');
  const b = source.indexOf('</script>', a);
  if (b === -1) throw new Error('generate: JSON-LD end not found');
  return source.slice(0, a) + jsonld + source.slice(b);
}

if (require.main === module) {
  const siteDir = path.join(__dirname, '..');
  const check = process.argv.indexOf('--check') !== -1;
  const r = run(siteDir, { check: check });
  if (check) {
    if (r.ok) { console.log('generate:examples --check: all projections up to date (' + r.files.length + ' files)'); process.exit(0); }
    console.error('generate:examples --check: STALE projections: ' + r.changed.join(', ')); process.exit(1);
  } else {
    console.log('generate:examples: ' + (r.changed.length ? 'wrote ' + r.changed.join(', ') : 'no changes (all up to date)'));
  }
}

module.exports = { run: run, replaceMetaLines: replaceMetaLines };
