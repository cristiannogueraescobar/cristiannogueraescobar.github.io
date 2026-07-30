/* gen_capabilities.js — generate the static capabilities.html page from the
 * product-capabilities inventory.
 *
 * WHY STATIC: the page must be accessible, indexable and work with JavaScript
 * off, so the English text is rendered INLINE (from the i18n `en` dictionary)
 * with data-i18n attributes; i18n.js swaps languages in the browser afterwards.
 * The page chrome (head, header, footer) comes from a real shared template
 * (engine/templates/capabilities.template.html), NOT a copy embedded in this
 * script, so there is no second hand-maintained copy to drift.
 *
 * WHAT IS SHOWN: only capabilities that are public AND available AND not pending
 * — defence in depth on top of the validator. Pending/planned/non-public
 * capabilities never reach the HTML.
 *
 * Run: node engine/gen_capabilities.js         (writes capabilities.html)
 *      node engine/gen_capabilities.js --check  (exit non-zero if out of date)
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.join(__dirname, '..');
const caps = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
const examples = require(path.join(siteDir, 'assets', 'examples-data.js'));

// Load the English dictionary (inline text source) the same way the tests do.
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');
new Function('window', 'navigator', 'location', 'document', 'globalThis', i18nSrc)
  .call(g, g, g.navigator, g.location, g.document, g);
const EN = g.Plumline.i18n.dict.en.capabilities;

// Escape helpers — text content and attribute values are escaped SEPARATELY.
function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                  .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Look up an English string; throw if missing so generation fails loudly rather
// than emitting an empty element.
function en(key) {
  if (!Object.prototype.hasOwnProperty.call(EN, key)) {
    throw new Error('gen_capabilities: missing English i18n key: ' + key);
  }
  return EN[key];
}
// Render a translatable element: inline English + data-i18n for later swapping.
function t(tag, key, attrs) {
  const a = attrs ? ' ' + attrs : '';
  return '<' + tag + ' data-i18n="' + escAttr(key) + '"' + a + '>' + escText(en(key)) + '</' + tag + '>';
}

const GROUP_KEY = {
  models: 'capGroupModels',
  spreadsheet: 'capGroupSpreadsheet',
  verification: 'capGroupVerification',
  explanation: 'capGroupExplanation'
};

function isPublicShown(c) {
  // Defence in depth: every condition, not just `public`.
  return c.public === true && c.status === 'available' && c.exampleStatus !== 'pending';
}

function buildContent() {
  const shown = caps.CAPABILITIES.filter(isPublicShown);
  const lines = [];
  lines.push('<main>');

  // Hero.
  lines.push('  <div class="capabilities-hero">');
  lines.push('    ' + t('h1', 'capPageH1'));
  lines.push('    ' + t('p', 'capPageIntro'));
  lines.push('  </div>');

  // In-page nav across the (non-empty) groups.
  const nonEmptyGroups = caps.GROUP_ORDER.filter(grp => shown.some(c => c.group === grp));
  lines.push('  <nav aria-label="' + escAttr(en('capGroupsNavLabel')) +
             '" data-i18n-aria="capGroupsNavLabel">');
  nonEmptyGroups.forEach(function (grp) {
    lines.push('    <a href="#' + escAttr(grp) + '">' +
               escText(en(GROUP_KEY[grp])) + '</a>');
  });
  lines.push('  </nav>');

  // One section per non-empty group, capabilities in inventory order.
  nonEmptyGroups.forEach(function (grp) {
    const inGroup = shown.filter(c => c.group === grp);
    const titleId = grp + '-title';
    lines.push('  <section id="' + escAttr(grp) + '" aria-labelledby="' + escAttr(titleId) + '">');
    lines.push('    ' + t('h2', GROUP_KEY[grp], 'id="' + escAttr(titleId) + '"'));
    inGroup.forEach(function (c) {
      const anchor = 'cap-' + c.id;
      lines.push('    <article id="' + escAttr(anchor) + '">');
      lines.push('      ' + t('h3', c.nameKey));
      lines.push('      ' + t('p', c.descriptionKey));
      if (c.limitationsKey) {
        lines.push('      <p class="capability-limit"><span class="capability-limit-label" data-i18n="capLimitLabel">' +
                   escText(en('capLimitLabel')) + '</span>: <span data-i18n="' + escAttr(c.limitationsKey) +
                   '">' + escText(en(c.limitationsKey)) + '</span></p>');
      }
      if (c.exampleStatus === 'covered' && c.exampleId) {
        const url = examples.buildExampleSolverUrl(c.exampleId);
        if (url) {
          lines.push('      <a class="capability-example" href="' + escAttr(url) +
                     '" data-i18n="capOpenExample">' + escText(en('capOpenExample')) + '</a>');
        }
      }
      lines.push('    </article>');
    });
    lines.push('  </section>');
  });

  // Final CTA.
  lines.push('  <section class="capabilities-cta" aria-labelledby="cap-cta-title">');
  lines.push('    ' + t('h2', 'capPageCtaTitle', 'id="cap-cta-title"'));
  lines.push('    ' + t('p', 'capPageCtaBody'));
  lines.push('    <a class="btn" href="solver.html" data-i18n="capPageCtaButton">' +
             escText(en('capPageCtaButton')) + '</a>');
  lines.push('  </section>');

  lines.push('</main>');
  return lines.join('\n');
}

function buildPage() {
  const templatePath = path.join(siteDir, 'engine', 'templates', 'capabilities.template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const marker = '<!-- CAPABILITIES_CONTENT -->';
  if (template.indexOf(marker) === -1) {
    throw new Error('gen_capabilities: template is missing the ' + marker + ' marker');
  }
  return template.replace(marker, buildContent());
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
  const shown = caps.CAPABILITIES.filter(isPublicShown).length;
  console.log('wrote capabilities.html (' + shown + ' public capabilities shown)');
}
