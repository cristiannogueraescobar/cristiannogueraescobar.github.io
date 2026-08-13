/* Reusable projection infrastructure for the canonical example catalogue.
 *
 * ONE marker-based region replacer, shared by every projection (solver EXAMPLES,
 * i18n example keys, examples cards/JSON-LD). It:
 *   - finds exactly one START/END marker pair for the given region name;
 *   - throws on zero or multiple matches;
 *   - requires the START to precede the END;
 *   - preserves everything outside the markers verbatim (indent, LF);
 *   - never uses an ambiguous global regex to swallow large JS regions.
 *
 * The replacement string is produced by a caller-supplied serializer that consumes
 * the catalogue; this module performs no serialization itself and never touches
 * the engine, files, or the network.
 */

'use strict';

// Build the START/END marker literals for a region. Kept as comment markers so
// they are inert JavaScript in the source file.
function markers(region) {
  return {
    start: '/* ' + region + '_START */',
    end: '/* ' + region + '_END */'
  };
}

/* Replace the single <region>_START .. <region>_END block in `source` with
 * `replacement`. Between the markers the source must hold only whitespace. */
function replaceRegion(source, region, replacement) {
  var mk = markers(region);
  var sIdx = indexOfOnce(source, mk.start, region + '_START');
  var eIdx = indexOfOnce(source, mk.end, region + '_END');
  if (eIdx < sIdx) throw new Error('projectors: ' + region + '_END before START');
  var between = source.slice(sIdx + mk.start.length, eIdx);
  if (between.replace(/[\r\n]/g, '') !== '') {
    throw new Error('projectors: unexpected content between ' + region + ' markers');
  }
  return source.slice(0, sIdx + mk.start.length) + replacement + source.slice(eIdx);
}

function indexOfOnce(source, needle, label) {
  var first = source.indexOf(needle);
  if (first === -1) throw new Error('projectors: zero matches for ' + label);
  var second = source.indexOf(needle, first + needle.length);
  if (second !== -1) throw new Error('projectors: multiple matches for ' + label);
  return first;
}

/* i18n region regeneration (F1 GATE C / CONDITION 2).
 *
 * assets/i18n.js repeats the exName_/exDesc_ example translations in TWO
 * sub-sections per language. This regenerates those regions from the catalogue,
 * byte-for-byte, without markers (i18n.js is a served asset). Regions are located
 * by a CLOSED, validated structure — never an ambiguous global regex:
 *
 *   - each exName block starts at `exName_<firstKey>:` and runs for exactly the
 *     catalogue keys it currently holds, in order; likewise each exDesc block.
 *     The block length is NOT assumed equal to the current catalogue.length — the
 *     old block may be shorter during append-only growth (the original F1/F5
 *     baseline held 9 records; the catalogue now grows past that). The old keys
 *     must be the exact historical PREFIX of the current canonical keys;
 *   - there must be exactly `langs.length * 2` blocks of each (two sub-sections per
 *     language);
 *   - order, 8-space indent, single-quote + escaped apostrophe, trailing comma and
 *     LF are preserved.
 *
 * Fails with zero, one, three or more sub-sections. Regenerating the current i18n.js
 * yields zero diff; two runs are identical.
 */
function regenerateI18nExampleRegions(i18nSource, catalogue, serialize, langs) {
  // F5 projection regenerator count-agnostic correction required by append-only catalogue growth.
  // The previous implementation assumed the old projection block already had exactly
  // catalogue.length lines and overwrote line-by-line (lines[s+j] = repl[j]). That breaks on any
  // growth (9->24->36->48->60): old block length != new block length. This version locates each
  // block by its REAL extent (the contiguous run of <prefix>* lines actually present), validates
  // the old keys are the exact historical PREFIX of the current canonical keys (so historical
  // identity, order, and completeness are enforced — no silent delete/reorder/shrink/duplicate),
  // and replaces the whole block with a length-changing splice, processing blocks in descending
  // start order so earlier offsets stay valid after a length change. It hardcodes NO count: the
  // serializer produces N lines and the checkpoint tests pin N (24 for F7a, 36 for F7b, ...).
  var keys = catalogue.map(function (r) { return r.key; });
  var firstKey = keys[0];
  var expectedBlocks = langs.length * 2;
  var lines = i18nSource.split('\n');
  // A projected line is either a bare key `  exName_foo:` or a quoted key `  'exName_bar-baz':`
  // (appended keys may contain hyphens and must be quoted). Capture the key either way.
  var lineRe = function (prefix) { return new RegExp("^\\s*'?" + prefix + "([A-Za-z0-9_-]+)'?:"); };

  // Build the replacement lines per language once (serializer is already count-dynamic).
  var byLang = {};
  langs.forEach(function (lang) { byLang[lang] = serialize.i18nExampleLines(catalogue, lang); });

  // Locate each block for a prefix by its REAL extent, and read the keys it actually contains.
  // A block starts at `<prefix><firstKey>:` and runs while consecutive lines are `<prefix>...:`.
  function locate(prefix) {
    var re = lineRe(prefix);
    var blocks = [];
    for (var i = 0; i < lines.length; i++) {
      var startM = new RegExp('^\\s*' + prefix + firstKey + ':').test(lines[i]);
      if (!startM) continue;
      // Walk the contiguous run of this prefix's lines from i.
      var oldKeys = [];
      var j = i;
      while (j < lines.length) {
        var m = re.exec(lines[j]);
        if (!m) break;
        oldKeys.push(m[1]);
        j++;
      }
      blocks.push({ start: i, end: j - 1, oldKeys: oldKeys });
      i = j - 1;
    }
    if (blocks.length !== expectedBlocks) {
      throw new Error('i18n regen: expected ' + expectedBlocks + ' ' + prefix +
        ' blocks (2 per language), found ' + blocks.length);
    }
    // Validate each old block against the current canonical keys: append-only growth means the
    // old keys must be the EXACT historical prefix of the new canonical keys (same keys, same
    // order, from the start). This fails a removed/reordered historical key, a duplicate, an
    // unknown inserted key, or a shrink (old longer than new).
    blocks.forEach(function (b) {
      var seen = {};
      b.oldKeys.forEach(function (k) {
        if (seen[k]) throw new Error('i18n regen: duplicate projection key "' + prefix + k + '"');
        seen[k] = true;
      });
      if (b.oldKeys.length > keys.length) {
        throw new Error('i18n regen: old ' + prefix + ' block has ' + b.oldKeys.length +
          ' keys but canonical has only ' + keys.length + ' (shrink is not an append-only growth)');
      }
      b.oldKeys.forEach(function (k, idx) {
        if (k !== keys[idx]) {
          throw new Error('i18n regen: old ' + prefix + ' block is not the historical prefix of the ' +
            'canonical keys (position ' + idx + ': found "' + k + '", expected "' + keys[idx] + '")');
        }
      });
    });
    return blocks;
  }

  var nameBlocks = locate('exName_');
  var descBlocks = locate('exDesc_');

  // Cross-check: the name block and desc block for each language must describe the SAME old key
  // sequence (names/descs cannot disagree), and there must be one of each per language.
  if (nameBlocks.length !== descBlocks.length) {
    throw new Error('i18n regen: exName_/exDesc_ block counts disagree');
  }
  nameBlocks.forEach(function (nb, idx) {
    var db = descBlocks[idx];
    if (nb.oldKeys.length !== db.oldKeys.length ||
        nb.oldKeys.some(function (k, j) { return k !== db.oldKeys[j]; })) {
      throw new Error('i18n regen: exName_/exDesc_ key sequences disagree in block ' + idx);
    }
  });

  // Replace every block with its new (possibly longer) content. Interleave order in the file is
  // name-block then desc-block per language sub-section: blocks 0,1 -> langs[0]; 2,3 -> langs[1]...
  // Gather all replacements, then apply them in DESCENDING start order so a length change never
  // invalidates an earlier block's start index.
  var edits = [];
  nameBlocks.forEach(function (b, blockIdx) {
    var lang = langs[Math.floor(blockIdx / 2)];
    edits.push({ start: b.start, oldLen: b.end - b.start + 1, repl: byLang[lang].names });
  });
  descBlocks.forEach(function (b, blockIdx) {
    var lang = langs[Math.floor(blockIdx / 2)];
    edits.push({ start: b.start, oldLen: b.end - b.start + 1, repl: byLang[lang].descs });
  });
  edits.sort(function (a, b) { return b.start - a.start; });
  edits.forEach(function (e) {
    Array.prototype.splice.apply(lines, [e.start, e.oldLen].concat(e.repl));
  });

  return lines.join('\n');
}

module.exports = {
  markers: markers,
  replaceRegion: replaceRegion,
  regenerateI18nExampleRegions: regenerateI18nExampleRegions
};
