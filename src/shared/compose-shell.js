/* compose-shell.js — deterministic build-time composition of the shared shell
 * (header + footer) from REAL fragment files.
 *
 * The markup lives in src/shared/fragments/{header,footer}.html, each split into
 * explicit @section blocks (one per pageType). This module reads those files,
 * parses the sections with a small strict parser (NOT a template framework), and
 * substitutes the only two placeholder kinds:
 *   {{AC:<key>}}           -> ' aria-current="page"' for the active nav link, else ''
 *   {{LEARN_CAPABILITIES}} -> the extra footer link when authorized, else ''
 *
 * Used by BOTH vite dev and vite build (via vite.config.mjs) and by the Node test
 * suites, so dev, prod, and tests share one implementation. NEVER fetched at
 * runtime; fragments are not shipped to dist.
 *
 * Page context is authoritative: PAGE_CONTEXT maps each of the 8 filenames to its
 * exact { pageType, active, learnCapabilities }. A page's marker attributes MUST
 * match its PAGE_CONTEXT entry, or composition throws. The footer variant is
 * DERIVED from PAGE_CONTEXT, never from a free-form footer attribute.
 */

'use strict';
const fs = require('fs');
const path = require('path');

// ---- Authoritative per-page context -------------------------------------------
const PAGE_CONTEXT = {
  'index.html':        { pageType: 'informational', active: '',         learnCapabilities: false },
  'solver.html':       { pageType: 'solver',        active: 'solver',   learnCapabilities: false },
  'guide.html':        { pageType: 'informational', active: 'guide',    learnCapabilities: false },
  'examples.html':     { pageType: 'informational', active: 'examples', learnCapabilities: false },
  'capabilities.html': { pageType: 'informational', active: '',         learnCapabilities: true  },
  'about.html':        { pageType: 'informational', active: 'about',    learnCapabilities: false },
  'privacy.html':      { pageType: 'informational', active: '',         learnCapabilities: false },
  'terms.html':        { pageType: 'informational', active: '',         learnCapabilities: false },
};

// Primary nav link keys, in order. The active key (if any) gets aria-current.
const NAV_KEYS = ['solver', 'addon', 'guide', 'examples', 'about'];
// active values map to a nav key; '' / 'none' means no active link.
const ACTIVE_TO_KEY = { solver: 'solver', guide: 'guide', examples: 'examples', about: 'about', '': null, none: null };
const VALID_PAGETYPE = new Set(['informational', 'solver']);

const LEARN_CAP_LINK = '<a href="capabilities.html" data-i18n="navCapabilities">Capabilities</a>';

const DEFAULT_FRAGMENT_DIR = path.join(__dirname, 'fragments');

// ---- Small strict fragment parser ---------------------------------------------
// Grammar (line-oriented):
//   <!-- @meta ... -->            optional, ignored
//   <!-- @section NAME -->        opens a section; NAME is header:informational etc
//   ...literal lines...           section body (verbatim)
//   <!-- @endsection -->          closes the current section
// Anything outside a section (besides the @meta block and blank lines) is an error.
function parseFragment(text, label) {
  const sections = {};
  const lines = text.split('\n');
  let i = 0;
  // Skip an optional @meta ... --> block.
  if (lines[i] && /^<!--\s*@meta\b/.test(lines[i])) {
    while (i < lines.length && !/-->/.test(lines[i])) i++;
    i++; // consume the line holding -->
  }
  let current = null, body = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    const open = line.match(/^<!--\s*@section\s+([A-Za-z]+:[A-Za-z]+)\s*-->$/);
    const close = /^<!--\s*@endsection\s*-->$/.test(line);
    if (open) {
      if (current) throw new Error('fragment ' + label + ': nested @section not allowed');
      current = open[1]; body = [];
    } else if (close) {
      if (!current) throw new Error('fragment ' + label + ': @endsection without @section');
      if (Object.prototype.hasOwnProperty.call(sections, current)) {
        throw new Error('fragment ' + label + ': duplicate section ' + current);
      }
      sections[current] = body.join('\n');
      current = null; body = [];
    } else if (current) {
      body.push(line);
    } else if (line.trim() === '') {
      // blank line between sections: ignore
    } else {
      throw new Error('fragment ' + label + ': content outside a @section: ' + line.slice(0, 40));
    }
  }
  if (current) throw new Error('fragment ' + label + ': unclosed @section ' + current);
  return sections;
}

// ---- Composer factory ---------------------------------------------------------
function createComposer(opts) {
  const fragmentDir = (opts && opts.fragmentDir) || DEFAULT_FRAGMENT_DIR;
  const headerPath = path.join(fragmentDir, 'header.html');
  const footerPath = path.join(fragmentDir, 'footer.html');

  function loadSections() {
    // Missing fragment files are a hard error.
    if (!fs.existsSync(headerPath)) throw new Error('compose-shell: missing fragment ' + headerPath);
    if (!fs.existsSync(footerPath)) throw new Error('compose-shell: missing fragment ' + footerPath);
    const header = parseFragment(fs.readFileSync(headerPath, 'utf8'), 'header.html');
    const footer = parseFragment(fs.readFileSync(footerPath, 'utf8'), 'footer.html');
    for (const s of ['header:informational', 'header:solver']) {
      if (!(s in header)) throw new Error('compose-shell: header.html missing section ' + s);
    }
    for (const s of ['footer:informational', 'footer:solver']) {
      if (!(s in footer)) throw new Error('compose-shell: footer.html missing section ' + s);
    }
    return { header, footer };
  }

  function applyActive(sectionHtml, active) {
    const activeKey = ACTIVE_TO_KEY[active];
    return sectionHtml.replace(/\{\{AC:([a-z]+)\}\}/g, function (m, key) {
      if (!NAV_KEYS.includes(key)) throw new Error('compose-shell: unknown AC key ' + key);
      return key === activeKey ? ' aria-current="page"' : '';
    });
  }

  function applyLearn(sectionHtml, learnCapabilities) {
    return sectionHtml.replace(/\{\{LEARN_CAPABILITIES\}\}/g,
      function () { return learnCapabilities ? LEARN_CAP_LINK : ''; });
  }

  function renderHeader(pageType, active) {
    if (!VALID_PAGETYPE.has(pageType)) throw new Error('compose-shell: unknown pageType "' + pageType + '"');
    if (!(active in ACTIVE_TO_KEY)) throw new Error('compose-shell: invalid active "' + active + '"');
    const sections = loadSections().header;
    const out = applyActive(sections['header:' + pageType], active);
    if (/\{\{/.test(out)) throw new Error('compose-shell: unresolved token in header ' + pageType);
    return out;
  }

  function renderFooter(pageType, learnCapabilities) {
    if (!VALID_PAGETYPE.has(pageType)) throw new Error('compose-shell: unknown pageType "' + pageType + '"');
    // Accept either a boolean or a { learnCapabilities } options object.
    var learn = (learnCapabilities && typeof learnCapabilities === 'object')
      ? !!learnCapabilities.learnCapabilities
      : !!learnCapabilities;
    const sections = loadSections().footer;
    let out = sections['footer:' + pageType];
    out = applyLearn(out, learn);
    if (/\{\{/.test(out)) throw new Error('compose-shell: unresolved token in footer ' + pageType);
    return out;
  }

  // Strict left-to-right attribute parser. Consumes the WHOLE marker body: only
  // whitespace is allowed between attributes and around them, and the only accepted
  // token shape is name="value" (double quotes). Anything else — a bare word, an
  // unquoted value, single quotes, stray punctuation, embedded HTML/comment text,
  // or leftover characters — throws. `allowed` is the set of permitted names,
  // `required` the set that must appear, `booleans` the names whose value must be
  // exactly "true"/"false".
  function parseAttrs(markerBody, label, allowed, required, booleans) {
    const attrs = {};
    const seen = new Set();
    const s = markerBody;
    let i = 0;
    const isWs = c => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
    const isNameChar = c => /[A-Za-z0-9_]/.test(c);
    while (i < s.length) {
      // Consume whitespace between/around attributes.
      if (isWs(s[i])) { i++; continue; }
      // Must be the start of a name="value" attribute.
      const nameStart = i;
      while (i < s.length && isNameChar(s[i])) i++;
      if (i === nameStart) {
        throw new Error('compose-shell: malformed attribute on ' + label + ' at "' + s.slice(i, i + 12) + '"');
      }
      const name = s.slice(nameStart, i);
      if (s[i] !== '=') {
        throw new Error('compose-shell: attribute "' + name + '" on ' + label + ' must be ' + name + '="value" (missing =)');
      }
      i++; // consume '='
      if (s[i] !== '"') {
        throw new Error('compose-shell: attribute "' + name + '" on ' + label + ' must use double quotes');
      }
      i++; // consume opening quote
      const valStart = i;
      while (i < s.length && s[i] !== '"') i++;
      if (i >= s.length) {
        throw new Error('compose-shell: attribute "' + name + '" on ' + label + ' has an unterminated value');
      }
      const value = s.slice(valStart, i);
      i++; // consume closing quote
      // The next char must be whitespace or end-of-body — no residue like name="x"y.
      if (i < s.length && !isWs(s[i])) {
        throw new Error('compose-shell: unexpected character after attribute "' + name + '" on ' + label + ' at "' + s.slice(i, i + 12) + '"');
      }
      if (!allowed.has(name)) throw new Error('compose-shell: unknown attribute "' + name + '" on ' + label);
      if (seen.has(name)) throw new Error('compose-shell: duplicate attribute "' + name + '" on ' + label);
      seen.add(name);
      if (booleans.has(name) && value !== 'true' && value !== 'false') {
        throw new Error('compose-shell: attribute "' + name + '" must be true or false on ' + label + ' (got "' + value + '")');
      }
      attrs[name] = value;
    }
    // Every required attribute must be present (active="" counts as present).
    for (const r of required) {
      if (!seen.has(r)) throw new Error('compose-shell: missing required attribute "' + r + '" on ' + label);
    }
    return attrs;
  }

  const HEADER_RE = /<!--\s*PLUMLINE:HEADER\b([^>]*?)-->/g;
  const FOOTER_RE = /<!--\s*PLUMLINE:FOOTER\b([^>]*?)-->/g;
  const ANY_MARKER_RE = /<!--\s*PLUMLINE:[A-Z]+\b/;

  // Compose one page's HTML. fileLabel MUST be the page's filename so its context
  // can be looked up in PAGE_CONTEXT.
  function composeHtml(html, fileLabel) {
    const label = fileLabel || 'page';
    const ctx = PAGE_CONTEXT[label];
    if (!ctx) throw new Error('compose-shell: no PAGE_CONTEXT entry for "' + label + '"');

    const headerMarkers = html.match(HEADER_RE) || [];
    const footerMarkers = html.match(FOOTER_RE) || [];
    if (headerMarkers.length === 0) throw new Error('compose-shell: no PLUMLINE:HEADER marker in ' + label);
    if (headerMarkers.length > 1) throw new Error('compose-shell: duplicate PLUMLINE:HEADER marker in ' + label);
    if (footerMarkers.length === 0) throw new Error('compose-shell: no PLUMLINE:FOOTER marker in ' + label);
    if (footerMarkers.length > 1) throw new Error('compose-shell: duplicate PLUMLINE:FOOTER marker in ' + label);

    // Extract attribute bodies.
    const hBody = /<!--\s*PLUMLINE:HEADER\b([^>]*?)-->/.exec(headerMarkers[0])[1];
    const fBody = /<!--\s*PLUMLINE:FOOTER\b([^>]*?)-->/.exec(footerMarkers[0])[1];

    // HEADER marker: pageType AND active must both be PRESENT (active may be "")
    // and must MATCH PAGE_CONTEXT exactly.
    const hAttrs = parseAttrs(hBody, label + ' HEADER',
      new Set(['pageType', 'active']), new Set(['pageType', 'active']), new Set());
    if (hAttrs.pageType !== ctx.pageType) {
      throw new Error('compose-shell: ' + label + ' HEADER pageType "' + hAttrs.pageType +
        '" does not match PAGE_CONTEXT "' + ctx.pageType + '"');
    }
    if (hAttrs.active !== ctx.active) {
      throw new Error('compose-shell: ' + label + ' HEADER active "' + hAttrs.active +
        '" does not match PAGE_CONTEXT "' + ctx.active + '"');
    }

    // FOOTER marker: the required attribute set depends on PAGE_CONTEXT.
    //   capabilities.html (learnCapabilities=true): EXACTLY learnCapabilities="true".
    //   the other 7 pages: EXACTLY zero attributes — learnCapabilities is not even
    //   an allowed name, so learnCapabilities="false" is rejected as unknown.
    let footerAllowed, footerRequired, footerBooleans;
    if (ctx.learnCapabilities) {
      footerAllowed = new Set(['learnCapabilities']);
      footerRequired = new Set(['learnCapabilities']);
      footerBooleans = new Set(['learnCapabilities']);
    } else {
      footerAllowed = new Set();
      footerRequired = new Set();
      footerBooleans = new Set();
    }
    const fAttrs = parseAttrs(fBody, label + ' FOOTER', footerAllowed, footerRequired, footerBooleans);
    if (ctx.learnCapabilities && fAttrs.learnCapabilities !== 'true') {
      throw new Error('compose-shell: ' + label + ' FOOTER must declare learnCapabilities="true" (got "' +
        fAttrs.learnCapabilities + '")');
    }

    // The variants are DERIVED from PAGE_CONTEXT, never from a footer attribute.
    const headerHtml = renderHeader(ctx.pageType, ctx.active);
    const footerHtml = renderFooter(ctx.pageType, ctx.learnCapabilities);

    let out = html.replace(HEADER_RE, function () { return headerHtml; });
    out = out.replace(FOOTER_RE, function () { return footerHtml; });
    if (ANY_MARKER_RE.test(out)) {
      throw new Error('compose-shell: unresolved PLUMLINE: marker remains in ' + label);
    }
    return out;
  }

  return { renderHeader, renderFooter, composeHtml, parseAttrs, loadSections, fragmentDir };
}

// Default composer (reads src/shared/fragments/).
const defaultComposer = createComposer();

module.exports = {
  PAGE_CONTEXT: PAGE_CONTEXT,
  NAV_KEYS: NAV_KEYS,
  ACTIVE_TO_KEY: ACTIVE_TO_KEY,
  VALID_PAGETYPE: VALID_PAGETYPE,
  LEARN_CAP_LINK: LEARN_CAP_LINK,
  createComposer: createComposer,
  parseFragment: parseFragment,
  // Convenience bindings to the default composer (backwards-compatible API).
  composeHtml: defaultComposer.composeHtml,
  renderHeader: defaultComposer.renderHeader,
  renderFooter: defaultComposer.renderFooter,
};
