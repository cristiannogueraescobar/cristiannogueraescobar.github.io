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
 * assets/i18n.js repeats the nine exName_/exDesc_ example translations in TWO
 * sub-sections per language. This regenerates those regions from the catalogue,
 * byte-for-byte, without markers (i18n.js is a served asset). Regions are located
 * by a CLOSED, validated structure — never an ambiguous global regex:
 *
 *   - each exName block starts at `exName_<firstKey>:` and runs for exactly the
 *     nine catalogue keys, in order; likewise each exDesc block;
 *   - there must be exactly `langs.length * 2` blocks of each (two sub-sections per
 *     language);
 *   - order, 8-space indent, single-quote + escaped apostrophe, trailing comma and
 *     LF are preserved.
 *
 * Fails with zero, one, three or more sub-sections. Regenerating the current i18n.js
 * yields zero diff; two runs are identical.
 */
function regenerateI18nExampleRegions(i18nSource, catalogue, serialize, langs) {
  var keys = catalogue.map(function (r) { return r.key; });
  var firstKey = keys[0];
  var expectedBlocks = langs.length * 2;
  var lines = i18nSource.split('\n');

  // Build the expected replacement lines per language once.
  var byLang = {};
  langs.forEach(function (lang) { byLang[lang] = serialize.i18nExampleLines(catalogue, lang); });

  // Locate blocks for a given prefix ('exName_' | 'exDesc_'): each starts at the
  // line matching `<prefix><firstKey>:`.
  function locate(prefix) {
    var starts = [];
    for (var i = 0; i < lines.length; i++) {
      if (new RegExp('^\\s*' + prefix + firstKey + ':').test(lines[i])) starts.push(i);
    }
    if (starts.length !== expectedBlocks) {
      throw new Error('i18n regen: expected ' + expectedBlocks + ' ' + prefix +
        ' blocks (2 per language), found ' + starts.length);
    }
    // Each block must contain exactly the nine keys, in order, contiguous.
    starts.forEach(function (s) {
      keys.forEach(function (k, j) {
        var re = new RegExp('^\\s*' + prefix + k + ':');
        if (!re.test(lines[s + j])) {
          throw new Error('i18n regen: ' + prefix + ' block at line ' + (s + 1) +
            ' is not the nine catalogue keys in order (offset ' + j + ')');
        }
      });
    });
    return starts;
  }

  var nameStarts = locate('exName_');
  var descStarts = locate('exDesc_');

  // The two sub-sections per language appear in language order, name-block then
  // desc-block interleaved per sub-section. We map each block index to its language
  // by dividing the ordered starts into pairs: blocks 0,1 -> langs[0]; 2,3 -> langs[1]; ...
  function replaceBlocks(starts, kind) {
    // starts are in file order: 2 per language.
    starts.forEach(function (s, blockIdx) {
      var lang = langs[Math.floor(blockIdx / 2)];
      var repl = byLang[lang][kind]; // 9 lines
      for (var j = 0; j < keys.length; j++) lines[s + j] = repl[j];
    });
  }
  replaceBlocks(nameStarts, 'names');
  replaceBlocks(descStarts, 'descs');

  return lines.join('\n');
}

module.exports = {
  markers: markers,
  replaceRegion: replaceRegion,
  regenerateI18nExampleRegions: regenerateI18nExampleRegions
};
