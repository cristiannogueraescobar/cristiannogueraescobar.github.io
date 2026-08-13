'use strict';
/* Solver UI golden canonicalisation (F7a option c-2).
 *
 * The composed solver.html carries a `var EXAMPLES={...}` object projected from the canonical
 * catalogue (compose-solver.js replaces the SOLVER_EXAMPLES_CATALOGUE markers with the serialized
 * catalogue). That object grows with the catalogue (9 -> 24 -> 36 ...), so any golden that pins the
 * SHA of a region CONTAINING it would break on every catalogue growth — even though the surrounding
 * Solver UI is unchanged.
 *
 * canonicaliseSolverExamplesRegion(text) replaces ONLY that catalogue-owned region with a fixed
 * sentinel, so the surrounding UI can be compared count-agnostically. It is applied to BOTH:
 *   A. the independent historical (post-F6, 9-example) composed solver text — to DERIVE the
 *      normalised UI golden authority, and
 *   B. the current (24-example) composed solver text — to COMPARE against that authority.
 *
 * The function knows NO catalogue count (never 9/24/36/48/60). It locates the region structurally:
 *   - the region starts at `var EXAMPLES={` and ends at the matching `\n  };` that closes the object
 *     (the serializer emits `...\n  }` and the source's trailing `;` follows);
 *   - exactly one such region must exist: zero, unbalanced, mis-ordered, or duplicate => throw.
 *
 * Only the catalogue region is replaced; every other byte of the composed page is preserved, so a UI
 * mutation outside the region still changes the canonicalised text (and thus still fails a UI golden).
 */

var SENTINEL = '/* SOLVER_EXAMPLES_CATALOGUE_CANONICAL */';
var REGION_START = 'var EXAMPLES={';
// The object is closed by a line that is exactly two spaces + '};' — the serializer produces
// `\n  }` and solver.html's marker line supplies the trailing `;`. We match `\n  };` as the close.
var REGION_END = '\n  };';

function canonicaliseSolverExamplesRegion(text) {
  if (typeof text !== 'string') throw new Error('solver-ui-canonical: text must be a string');

  // Exactly one start.
  var firstStart = text.indexOf(REGION_START);
  if (firstStart === -1) throw new Error('solver-ui-canonical: EXAMPLES region start not found');
  var dupStart = text.indexOf(REGION_START, firstStart + REGION_START.length);
  if (dupStart !== -1) throw new Error('solver-ui-canonical: more than one EXAMPLES region start');

  // The end is the first REGION_END at or after the start. It must exist and be ordered after start.
  var endIdx = text.indexOf(REGION_END, firstStart + REGION_START.length);
  if (endIdx === -1) throw new Error('solver-ui-canonical: EXAMPLES region end not found');
  // Guard against a second closing sentinel that would make the region ambiguous: there must be no
  // other `var EXAMPLES={` and this end must be the object's own close (no nested `var EXAMPLES={`
  // already excluded above). Ordering is guaranteed because endIdx is searched from after start.

  var regionEndExclusive = endIdx + REGION_END.length; // include the closing `\n  };`
  var before = text.slice(0, firstStart);
  var after = text.slice(regionEndExclusive);
  return before + SENTINEL + after;
}

module.exports = {
  SENTINEL: SENTINEL,
  canonicaliseSolverExamplesRegion: canonicaliseSolverExamplesRegion
};
