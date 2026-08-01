/* gen_capabilities.js — generate the static capabilities.html page from the
 * product-capabilities inventory, with a distinct COMPOSITION per group.
 *
 * WHY STATIC: the page must be accessible, indexable and work with JavaScript
 * off, so English text is rendered INLINE (from the i18n `en` dictionary) with
 * data-i18n attributes; i18n.js swaps languages in the browser afterwards. The
 * page chrome (head, header, footer) comes from a real shared template
 * (engine/templates/capabilities.template.html), not a copy embedded here.
 *
 * COMPOSITION (not 16 identical blocks):
 *   - Models        -> a semantic table (4 model types) + a Maximise/minimise note
 *   - Spreadsheet   -> a three-step flow (Paste -> Adjust -> Export)
 *   - Verification  -> a real receipt image + three checks
 *   - Explanation   -> two columns: the feasible-region image + the explainers
 *
 * WHAT IS SHOWN: only capabilities that are public AND available AND not pending.
 * Product imagery comes from data/media.json; the generator checks each file
 * exists and that every altKey resolves in all five languages, and fails loudly
 * otherwise.
 *
 * Run: node engine/gen_capabilities.js         (writes capabilities.html)
 *      node engine/gen_capabilities.js --check  (exit non-zero if out of date)
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
const examples = require(path.join(siteDir, 'assets', 'examples-data.js'));
const media = require(path.join(siteDir, 'data', 'media.json'));

// Load every language dictionary (English is the inline source; the others are
// checked so a missing translation for image alt text fails the build).
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
new Function('window', 'navigator', 'location', 'document', 'globalThis', i18nSrc)
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;
const EN = DICT.en.capabilities;
const LANGS = caps.ALL_LANGS;

// Escaping — text content and attribute values escaped separately.
function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                  .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function en(key) {
  if (!Object.prototype.hasOwnProperty.call(EN, key)) {
    throw new Error('gen_capabilities: missing English i18n key: ' + key);
  }
  return EN[key];
}
// A translatable element: inline English + data-i18n for later swapping.
function t(tag, key, attrs) {
  const a = attrs ? ' ' + attrs : '';
  return '<' + tag + ' data-i18n="' + escAttr(key) + '"' + a + '>' + escText(en(key)) + '</' + tag + '>';
}
// Inline translatable text (no wrapper tag of its own beyond a span).
function tspan(key, cls) {
  const c = cls ? ' class="' + escAttr(cls) + '"' : '';
  return '<span' + c + ' data-i18n="' + escAttr(key) + '">' + escText(en(key)) + '</span>';
}

function isShown(c) {
  return c.public === true && c.status === 'available' && c.exampleStatus !== 'pending';
}
const SHOWN = caps.CAPABILITIES.filter(isShown);
function byId(id) { return SHOWN.find(c => c.id === id); }
function inGroup(grp) { return SHOWN.filter(c => c.group === grp); }

// A contextual example link, or '' when the capability has no solver CTA.
function exampleLink(c) {
  if (!c.exampleCtaKey || c.exampleStatus !== 'covered' || !c.exampleId) return '';
  const url = examples.buildExampleSolverUrl(c.exampleId);
  if (!url) throw new Error('gen_capabilities: no solver URL for example ' + c.exampleId);
  return '<a class="cap-example" href="' + escAttr(url) + '" data-i18n="' +
         escAttr(c.exampleCtaKey) + '">' + escText(en(c.exampleCtaKey)) + '</a>';
}

// A media image from data/media.json. Fails if the file is missing or any
// language lacks the alt text.
function image(slot) {
  const m = media.slots[slot];
  if (!m) throw new Error('gen_capabilities: no media slot ' + slot);
  const file = media.basePath + m.file;
  if (!fs.existsSync(path.join(siteDir, file))) {
    throw new Error('gen_capabilities: image file missing: ' + file);
  }
  LANGS.forEach(function (lang) {
    if (!DICT[lang].capabilities || !Object.prototype.hasOwnProperty.call(DICT[lang].capabilities, m.altKey)) {
      throw new Error('gen_capabilities: alt text ' + m.altKey + ' missing in language ' + lang);
    }
  });
  const alt = DICT.en.capabilities[m.altKey];
  const fp = m.fetchpriority && m.fetchpriority !== 'auto' ? ' fetchpriority="' + escAttr(m.fetchpriority) + '"' : '';
  return '<img src="' + escAttr(file) + '" width="' + m.width + '" height="' + m.height +
         '" alt="' + escAttr(alt) + '" data-i18n-alt="' + escAttr(m.altKey) + '"' +
         ' decoding="async" loading="' + escAttr(m.loading || 'lazy') + '"' + fp + '>';
}
// A figure with an optional visible caption, driven by the slot's captionKey.
// The image links to itself so that on small screens (where a 1600px-wide
// illustration shrinks below legibility) the reader can open the full-size
// version. The link carries a translatable label for screen readers.
function figure(slot) {
  const m = media.slots[slot];
  const file = media.basePath + m.file;
  const cap = m && m.captionKey ? '\n      ' + t('figcaption', m.captionKey) : '';
  // A translatable mobile hint on every figure (the hero has no caption, so this
  // is how it gets a full-size affordance too). Hidden on wide screens by CSS.
  const hint = '\n      ' + tspan('capFullSizeHint', 'cap-fullsize-hint');
  return '<figure class="cap-figure">\n' +
         '      <a class="cap-figure-link" href="' + escAttr(file) + '" ' +
         'aria-label="' + escAttr(en('capOpenFullImage')) + '" ' +
         'data-i18n-aria="capOpenFullImage">' + image(slot) + '</a>' + cap + hint +
         '\n    </figure>';
}

// The <head> metadata block, built from the page copy so title/description/OG/
// Twitter never go stale against i18n. Title and description carry data-i18n so
// the browser can localise them too; the static values are the English source.
function buildHead() {
  const title = en('capPageTitle');
  const desc = en('capPageMetaDesc');
  const L = [];
  L.push('<title data-i18n="capPageTitle">' + escText(title) + '</title>');
  L.push('<meta name="description" data-i18n="capPageMetaDesc" content="' + escAttr(desc) + '">');
  L.push('<meta property="og:title" content="' + escAttr(title) + '">');
  L.push('<meta property="og:description" content="' + escAttr(desc) + '">');
  L.push('<meta property="og:type" content="website">');
  L.push('<meta property="og:url" content="https://plumline.online/capabilities.html">');
  L.push('<meta property="og:image" content="https://plumline.online/assets/screenshots/plumline-home-og.png">');
  L.push('<meta property="og:image:type" content="image/png">');
  L.push('<meta property="og:image:width" content="1200">');
  L.push('<meta property="og:image:height" content="630">');
  L.push('<meta name="twitter:card" content="summary_large_image">');
  L.push('<meta name="twitter:image" content="https://plumline.online/assets/screenshots/plumline-home-og.png">');
  L.push('<meta name="twitter:title" content="' + escAttr(title) + '">');
  L.push('<meta name="twitter:description" content="' + escAttr(desc) + '">');
  // Structured data: a SoftwareApplication whose featureList is DERIVED from the
  // public inventory (same source as the page body), so search engines see the
  // same capabilities the page documents. Compact, deterministic JSON.
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://plumline.online/#software',
    name: 'Plumline',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    // One canonical url for the application (same @id, same url on both pages);
    // mainEntityOfPage says THIS page documents it.
    url: 'https://plumline.online/',
    mainEntityOfPage: 'https://plumline.online/capabilities.html',
    description: desc,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    inLanguage: caps.ALL_LANGS,
    featureList: featureList()
  };
  L.push('<script type="application/ld+json">' + JSON.stringify(jsonld) + '</script>');
  return L.join('\n');
}

// The public capabilities, as a plain feature-name list (English names), in
// inventory order. Shared shape used by index.html's featureList too.
function featureList() {
  return caps.CAPABILITIES
    .filter(isShown)
    .map(function (c) { return en(c.nameKey); });
}

/* ---- Per-group renderers ---------------------------------------------- */

const GROUP_KEY = {
  models: 'capGroupModels', spreadsheet: 'capGroupSpreadsheet',
  verification: 'capGroupVerification', explanation: 'capGroupExplanation'
};
// Short labels for the in-page group nav, so it stays compact on small screens
// instead of repeating the long section headings.
const GROUP_NAV_KEY = {
  models: 'capNavModels', spreadsheet: 'capNavSpreadsheet',
  verification: 'capNavChecks', explanation: 'capNavExplanation'
};

// One "learn how this works" link per group, from GROUP_DOCS, pointing at the
// matching Guide section. Text comes from the group's learnKey (translated).
function learnLink(grp) {
  const doc = caps.GROUP_DOCS[grp];
  if (!doc) return '';
  const href = doc.guidePath + '#' + doc.guideAnchor;
  return '    <p class="doc-crosslink"><a href="' + escAttr(href) + '" data-i18n="' +
         escAttr(doc.learnKey) + '">' + escText(en(doc.learnKey)) + '</a></p>';
}

// Models: a table of the four model types, then the Maximise/minimise note.
function renderModels() {
  const L = [];
  L.push('  <section id="models" aria-labelledby="models-title">');
  L.push('    ' + t('h2', GROUP_KEY.models, 'id="models-title"'));
  L.push('    <table class="cap-table">');
  L.push('      <thead><tr>' +
         '<th scope="col" data-i18n="capModelsTableType">' + escText(en('capModelsTableType')) + '</th>' +
         '<th scope="col" data-i18n="capModelsTableWhen">' + escText(en('capModelsTableWhen')) + '</th>' +
         '<th scope="col" data-i18n="capModelsTableExample">' + escText(en('capModelsTableExample')) + '</th>' +
         '</tr></thead>');
  L.push('      <tbody>');
  ['model-continuous', 'model-integer', 'model-binary', 'model-mixed'].forEach(function (id) {
    const c = byId(id);
    const link = exampleLink(c);
    L.push('        <tr id="cap-' + escAttr(id) + '">');
    L.push('          <th scope="row" data-i18n="' + escAttr(c.nameKey) + '">' + escText(en(c.nameKey)) + '</th>');
    L.push('          <td data-i18n="' + escAttr(c.descriptionKey) + '">' + escText(en(c.descriptionKey)) + '</td>');
    L.push('          <td>' + (link || '') + '</td>');
    L.push('        </tr>');
  });
  L.push('      </tbody>');
  L.push('    </table>');
  // "Good to know" notes for continuous and integer sit BELOW the table, without
  // a repeated monospace label — just the model name and its note.
  const notes = ['model-continuous', 'model-integer']
    .map(byId).filter(c => c && c.limitationsKey);
  if (notes.length) {
    L.push('    <div class="cap-notes">');
    notes.forEach(function (c) {
      L.push('      <p class="cap-goodtoknow">' +
             '<strong data-i18n="' + escAttr(c.nameKey) + '">' + escText(en(c.nameKey)) + '</strong>: ' +
             '<span data-i18n="' + escAttr(c.limitationsKey) + '">' + escText(en(c.limitationsKey)) + '</span></p>');
    });
    L.push('    </div>');
  }
  // Maximise/minimise as a separate note, outside the table.
  const dir = byId('model-direction');
  L.push('    <div class="cap-direction" id="cap-model-direction">');
  L.push('      ' + t('h3', dir.nameKey));
  L.push('      ' + t('p', dir.descriptionKey));
  L.push('    </div>');
  L.push(learnLink('models'));
  L.push('  </section>');
  return L.join('\n');
}

// Spreadsheet: a three-step flow. Each step maps to a real capability; its
// anchor lives on the step. Only the middle step has a solver example.
function renderSpreadsheet() {
  const L = [];
  L.push('  <section id="spreadsheet" aria-labelledby="spreadsheet-title">');
  L.push('    ' + t('h2', GROUP_KEY.spreadsheet, 'id="spreadsheet-title"'));
  L.push('    <ol class="cap-steps">');
  const steps = [
    { id: 'sheet-paste', titleKey: 'capStepPaste', descKey: 'capStepPasteDesc' },
    { id: 'sheet-formula-limits', titleKey: 'capStepAdjust', descKey: 'capStepAdjustDesc' },
    { id: 'sheet-export', titleKey: 'capStepExport', descKey: 'capStepExportDesc' }
  ];
  steps.forEach(function (s) {
    const c = byId(s.id);
    L.push('      <li class="cap-step" id="cap-' + escAttr(s.id) + '">');
    L.push('        ' + t('h3', s.titleKey));
    L.push('        ' + t('p', s.descKey));
    const link = exampleLink(c);
    if (link) L.push('        ' + link);
    L.push('      </li>');
  });
  L.push('    </ol>');
  L.push(learnLink('spreadsheet'));
  L.push('  </section>');
  return L.join('\n');
}

// Verification: the real receipt image + three checks, and run-local.
function renderVerification() {
  const L = [];
  L.push('  <section id="verification" aria-labelledby="verification-title">');
  L.push('    ' + t('h2', GROUP_KEY.verification, 'id="verification-title"'));
  L.push('    <div class="cap-verify">');
  L.push('      <div class="cap-verify-media">');
  L.push('        ' + figure('verification-receipt'));
  L.push('      </div>');
  L.push('      <div class="cap-verify-points">');
  L.push('        ' + t('h3', 'capVerifyHeading'));
  ['verify-objective', 'verify-constraints', 'run-local'].forEach(function (id) {
    const c = byId(id);
    L.push('        <div class="cap-check" id="cap-' + escAttr(id) + '">');
    L.push('          ' + t('h4', c.nameKey));
    L.push('          ' + t('p', c.descriptionKey));
    L.push('        </div>');
  });
  L.push('      </div>');
  L.push('    </div>');
  L.push(learnLink('verification'));
  L.push('  </section>');
  return L.join('\n');
}

// Explanation: two columns — the feasible-region image and the explainers.
function renderExplanation() {
  const L = [];
  L.push('  <section id="explanation" aria-labelledby="explanation-title">');
  L.push('    ' + t('h2', GROUP_KEY.explanation, 'id="explanation-title"'));
  L.push('    <div class="cap-explain">');
  L.push('      <div class="cap-explain-media">');
  L.push('        ' + figure('feasible-region'));
  L.push('      </div>');
  L.push('      <div class="cap-explain-list">');
  inGroup('explanation').forEach(function (c) {
    L.push('        <article class="cap-explainer" id="cap-' + escAttr(c.id) + '">');
    L.push('          ' + t('h3', c.nameKey));
    L.push('          ' + t('p', c.descriptionKey));
    if (c.limitationsKey) {
      L.push('          <p class="cap-goodtoknow"><span class="cap-gtk-label" data-i18n="capWhenAppears">' +
             escText(en('capWhenAppears')) + '</span> ' +
             '<span data-i18n="' + escAttr(c.limitationsKey) + '">' + escText(en(c.limitationsKey)) + '</span></p>');
    }
    const link = exampleLink(c);
    if (link) L.push('          ' + link);
    L.push('        </article>');
  });
  L.push('      </div>');
  L.push('    </div>');
  L.push(learnLink('explanation'));
  L.push('  </section>');
  return L.join('\n');
}

function buildContent() {
  const L = [];
  L.push('<main class="plumb">');

  // Hero: two columns (text + CTA on the left, real product image on the right).
  L.push('  <div class="cap-hero">');
  L.push('    <div class="cap-hero-text">');
  L.push('      ' + t('h1', 'capPageH1'));
  L.push('      ' + t('p', 'capPageIntro'));
  L.push('      <a class="btn" href="solver.html" data-i18n="capPageCtaButton">' +
         escText(en('capPageCtaButton')) + '</a>');
  L.push('      <ul class="cap-trust">');
  ['capTrustLocal', 'capTrustNoAccount', 'capTrustLanguages', 'capTrustChecked'].forEach(function (k) {
    L.push('        <li data-i18n="' + escAttr(k) + '">' + escText(en(k)) + '</li>');
  });
  L.push('      </ul>');
  L.push('    </div>');
  L.push('    <div class="cap-hero-media">');
  // Hero image: no visible caption (the hero text already explains it).
  L.push('      ' + figure('hero-model'));
  L.push('    </div>');
  L.push('  </div>');

  // In-page nav across the groups.
  const nonEmpty = caps.GROUP_ORDER.filter(grp => inGroup(grp).length > 0);
  L.push('  <nav class="cap-groupnav" aria-label="' + escAttr(en('capGroupsNavLabel')) +
         '" data-i18n-aria="capGroupsNavLabel">');
  nonEmpty.forEach(function (grp) {
    L.push('    <a href="#' + escAttr(grp) + '" data-i18n="' + escAttr(GROUP_NAV_KEY[grp]) + '">' +
           escText(en(GROUP_NAV_KEY[grp])) + '</a>');
  });
  L.push('  </nav>');

  L.push(renderModels());
  L.push(renderSpreadsheet());
  L.push(renderVerification());
  L.push(renderExplanation());

  // Final CTA — a simple block, not another card.
  L.push('  <section class="cap-cta" aria-labelledby="cap-cta-title">');
  L.push('    ' + t('h2', 'capPageCtaTitle', 'id="cap-cta-title"'));
  L.push('    ' + t('p', 'capPageCtaBody'));
  L.push('    <a class="btn" href="solver.html" data-i18n="capPageCtaButton">' +
         escText(en('capPageCtaButton')) + '</a>');
  L.push('  </section>');

  L.push('</main>');
  return L.join('\n');
}

function buildPage() {
  const templatePath = path.join(siteDir, 'engine', 'templates', 'capabilities.template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const contentMarker = '<!-- CAPABILITIES_CONTENT -->';
  const headMarker = '<!-- CAPABILITIES_HEAD -->';
  // Each region marker must appear EXACTLY once. String.replace only substitutes
  // the first occurrence, so a duplicated marker would silently leave an
  // unfilled placeholder in the output; a missing marker means nothing is filled.
  // Both are fatal.
  function occurrences(hay, needle) {
    let n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
    return n;
  }
  [['CAPABILITIES_CONTENT', contentMarker], ['CAPABILITIES_HEAD', headMarker]].forEach(function (pair) {
    const count = occurrences(template, pair[1]);
    if (count === 0) {
      throw new Error('gen_capabilities: template is missing the ' + pair[1] + ' marker');
    }
    if (count > 1) {
      throw new Error('gen_capabilities: template has the ' + pair[1] + ' marker ' + count +
        ' times (must be exactly once)');
    }
  });
  return template.replace(headMarker, buildHead()).replace(contentMarker, buildContent());
}

const outPath = path.join(siteDir, 'capabilities.html');
const page = buildPage();

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current !== page) {
    console.error('capabilities.html is out of date — run: node engine/gen_capabilities.js');
    process.exit(1);
  }
  console.log('capabilities.html is up to date');
} else {
  fs.writeFileSync(outPath, page);
  console.log('wrote capabilities.html (' + SHOWN.length + ' public capabilities shown)');
}
