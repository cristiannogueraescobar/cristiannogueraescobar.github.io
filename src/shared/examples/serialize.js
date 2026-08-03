/* Deterministic serializers that project the canonical catalogue into the exact
 * historical byte shapes of the public consumers.
 *
 * These functions produce strings only; they never read or write files and never
 * touch the engine. They exist so a single catalogue authority can reproduce the
 * original solver.html EXAMPLES object (and other projections) byte-for-byte.
 *
 * The formatting here is a HISTORICAL SERIALIZATION CONTRACT: it mirrors the exact
 * whitespace, quoting and field order of the current public source. model.fieldOrder
 * drives the field order; it is not a model authority.
 */

'use strict';

function q(v) { return "'" + String(v).replace(/'/g, "\\'") + "'"; }

function serExamplesGridRows(grid) {
  return grid.map(function (row) {
    return '        [' + row.map(q).join(',') + ']';
  }).join(',\n');
}

function serExamplesDomainCell(cell, d) {
  if (d.type === 'binary' && d.min === undefined && d.max === undefined) {
    return cell + ":{type:'binary'}";
  }
  var min = (d.min === null || d.min === undefined) ? 'null' : d.min;
  var max = (d.max === null || d.max === undefined) ? 'null' : d.max;
  return cell + ':{type:' + q(d.type) + ',min:' + min + ',max:' + max + '}';
}

// wrapAfter: the cell after which the original inserts a line break + 16-space indent
// (only supplier does this today). Derived from the catalogue's presentation, not
// hardcoded content.
function serExamplesDomains(dom, wrapAfter) {
  var cells = Object.keys(dom);
  var out = 'domains:{ ';
  cells.forEach(function (cell, i) {
    out += serExamplesDomainCell(cell, dom[cell]);
    if (i < cells.length - 1) {
      out += ',';
      out += (wrapAfter && wrapAfter === cell) ? '\n                ' : ' ';
    }
  });
  return out + ' }';
}

function serExamplesExpected(exp) {
  var p = 'status:' + q(exp.status) + ', modelType:' + q(exp.modelType) + ', objective:' + exp.objective;
  if (exp.tolerance !== undefined) p += ', tolerance:' + exp.tolerance;
  return 'expected:{ ' + p + ' }';
}

function serExamplesField(f, rec, domainWrap) {
  var m = rec.model;
  if (f === 'grid') return 'grid:[\n' + serExamplesGridRows(m.grid) + ']';
  if (f === 'domains') return serExamplesDomains(m.domains, domainWrap[rec.key]);
  if (f === 'openVarSettings') return 'openVarSettings:' + m.openVarSettings;
  if (f === 'whole') return 'whole:' + m.whole;
  if (f === 'expected') return serExamplesExpected(rec.expected);
  throw new Error('serialize: unknown EXAMPLES field "' + f + '"');
}

function serExamplesRecord(rec, domainWrap) {
  var order = rec.model.fieldOrder;
  if (!Array.isArray(order)) throw new Error('serialize: record ' + rec.key + ' has no fieldOrder');
  var out = '    ' + rec.key + ':{ ';
  order.forEach(function (f, idx) {
    var sf = serExamplesField(f, rec, domainWrap);
    if (idx === 0) { if (f === 'whole') out += sf; else out += '\n      ' + sf; }
    else out += ',\n      ' + sf;
  });
  return out + ' }';
}

/* Produce the exact historical `var EXAMPLES={...}` object body from the catalogue. */
function serializeSolverExamples(catalogue, domainWrap) {
  domainWrap = domainWrap || { supplier: 'B4' };
  return 'var EXAMPLES={\n' + catalogue.map(function (rec) {
    return serExamplesRecord(rec, domainWrap);
  }).join(',\n') + '\n  }';
}

module.exports = {
  serializeSolverExamples: serializeSolverExamples,
  serExamplesRecord: serExamplesRecord,
  q: q,
  i18nExampleLines: i18nExampleLines,
  examplesDataMetaLines: examplesDataMetaLines,
  examplesJsonLd: examplesJsonLd,
  examplesNoJsLinks: examplesNoJsLinks,
  i18nExpectedOccurrences: i18nExpectedOccurrences
};

/* i18n projection (F1 GATE C).
 *
 * The example title/description translations live once in the catalogue. i18n.js
 * historically repeats each in TWO sub-sections per language ("examples" and
 * "solver"), giving 9 keys x 2 sub-sections x 5 languages = 90 exName + 90 exDesc =
 * 180 occurrences. These helpers derive the exact historical lines and the exact
 * expected occurrence count, so a stale guard can assert i18n.js is a faithful
 * projection of the single catalogue authority without editing i18n.js.
 */

// The exact per-language exName_/exDesc_ lines for one sub-section (8-space indent,
// single-quoted, apostrophes escaped as \'). Order: all exName_ (catalogue order),
// then all exDesc_ (catalogue order) — the historical layout.
function i18nExampleLines(catalogue, lang, indent) {
  indent = indent === undefined ? '        ' : indent;
  var names = catalogue.map(function (rec) {
    return indent + 'exName_' + rec.key + ':' + q(rec.translations[lang].title) + ',';
  });
  var descs = catalogue.map(function (rec) {
    return indent + 'exDesc_' + rec.key + ':' + q(rec.translations[lang].desc) + ',';
  });
  return { names: names, descs: descs };
}

// examples.html ItemList JSON-LD (F1 GATE E). Fully derived from the catalogue:
// position = catalogue order, url = canonical base + slug, name = English title.
// The JSON-LD is compact (JSON.stringify with no spaces), matching the served file.
// The catalogue never stores the JSON-LD blob; only the semantic fields it needs.
function examplesJsonLd(catalogue, baseUrl) {
  baseUrl = baseUrl || 'https://plumline.online/solver.html?ex=';
  var obj = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Plumline optimisation examples',
    itemListElement: catalogue.map(function (rec, i) {
      return {
        '@type': 'ListItem',
        position: i + 1,
        url: baseUrl + rec.slug,
        name: rec.translations.en.title
      };
    })
  };
  return JSON.stringify(obj);
}

// The URL + name of each no-JS fallback <li> derive from the catalogue (slug, EN
// title). The fallback's own short description text is markup-owned copy (a lower-
// case variant + model type), NOT the canonical example description, so it stays in
// examples.html. This returns the derivable (href, name) pairs for the stale guard.
function examplesNoJsLinks(catalogue) {
  return catalogue.map(function (rec) {
    return { href: 'solver.html?ex=' + rec.slug, name: rec.translations.en.title };
  });
}

// examples-data.js META lines (F1 GATE D). The public file aligns columns at fixed
// positions: `slug:`@25, `category:`@55, `type:`@77, `sense:`@97, 4-space indent, a
// trailing comma on all but the last row. This reproduces those lines byte-for-byte.
function examplesDataMetaLines(catalogue) {
  var SLUG_COL = 25, CAT_COL = 55, TYPE_COL = 77, SENSE_COL = 97;
  return catalogue.map(function (rec, i) {
    var s = '    { key: ' + q(rec.key) + ',';
    s = padTo(s, SLUG_COL) + 'slug: ' + q(rec.slug) + ',';
    s = padTo(s, CAT_COL) + 'category: ' + q(rec.category) + ',';
    s = padTo(s, TYPE_COL) + 'type: ' + q(rec.type) + ',';
    s = padTo(s, SENSE_COL) + 'sense: ' + q(rec.sense) + ' }';
    if (i < catalogue.length - 1) s += ',';
    return s;
  });
}

function padTo(s, col) {
  if (s.length >= col) return s + ' ';
  return s + ' '.repeat(col - s.length);
}
// Returns a flat list of { literal, expected } for the stale guard to assert.
function i18nExpectedOccurrences(catalogue, langs) {
  var out = [];
  langs.forEach(function (lang) {
    catalogue.forEach(function (rec) {
      out.push({ literal: 'exName_' + rec.key + ':' + q(rec.translations[lang].title), expected: 2 });
      out.push({ literal: 'exDesc_' + rec.key + ':' + q(rec.translations[lang].desc), expected: 2 });
    });
  });
  return out;
}
