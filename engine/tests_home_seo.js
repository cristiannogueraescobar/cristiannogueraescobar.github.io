/* tests_home_seo.js — protects the Home head/SEO invariants (Lote A) and the
 * rule that the public build must not ship a personal or unconfigured contact
 * address in the add-on call to action.
 */
const fs = require('fs');
const path = require('path');
const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name + (detail ? '  ' + detail : '')); }
}

const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
const isPublicBuild = process.env.PLUMLINE_PUBLIC_BUILD === '1';

// ---- Title ------------------------------------------------------------
const titleM = html.match(/<title>([^<]*)<\/title>/);
ok('home seo: has a <title>', !!titleM);
if (titleM) {
  const title = titleM[1];
  ok('home seo: title is the approved concise title',
     title === 'Plumline | Free Spreadsheet Optimisation Solver', title);
  // Descriptive and not overlong; and no "coming soon" marketing in the title.
  ok('home seo: title is not overlong', title.length <= 65, title.length + ' chars');
  ok('home seo: title has no "coming soon"', !/coming soon/i.test(title), title);
}

// ---- Meta description -------------------------------------------------
const descM = html.match(/<meta name="description" content="([^"]*)"/);
ok('home seo: has a meta description', !!descM);
if (descM) {
  const desc = descM[1];
  ok('home seo: description is the approved copy',
     desc === 'Solve continuous, integer, binary and mixed spreadsheet models in your browser. Paste from Excel or Google Sheets, verify every constraint and keep your data local.',
     desc);
  ok('home seo: description length is reasonable', desc.length >= 70 && desc.length <= 200, desc.length + ' chars');
}

// ---- No meta keywords -------------------------------------------------
ok('home seo: no <meta name="keywords"> (not a supported Search signal)',
   html.indexOf('name="keywords"') === -1);

// ---- f3P shadow-price copy is a complete sentence, normalised ---------
const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
g.window = g; g.globalThis = g;
new Function('window', 'navigator', 'location', 'document', 'globalThis',
  fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
  .call(g, g, g.navigator, g.location, g.document, g);
const DICT = g.Plumline.i18n.dict;

['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
  const v = DICT[lang].home.f3P;
  ok('home seo: f3P present in ' + lang, typeof v === 'string' && v.length > 0);
  if (v) {
    ok('home seo: f3P [' + lang + '] avoids "binding limit"', !/binding limit/i.test(v), v);
    ok('home seo: f3P [' + lang + '] avoids "yes/no"', !/yes\/no/i.test(v), v);
  }
});
// English f3P is the approved complete sentence, and the inline HTML matches it.
ok('home seo: f3P EN is the approved sentence',
   DICT.en.home.f3P === 'For eligible continuous models, Plumline estimates how the result may change when a binding constraint is relaxed by one unit. This sensitivity insight is often called a shadow price.',
   DICT.en.home.f3P);
const inlineF3 = html.match(/data-i18n="f3P">([\s\S]*?)<\/(?:p|em)>/);
ok('home seo: inline f3P equals the EN dictionary', inlineF3 && inlineF3[1] === DICT.en.home.f3P);

// ---- Hero screenshot guard (same assertion in both modes) ------------
// The hero must show an authentic screenshot before it ships. The assertion runs
// in BOTH modes for a stable count; only the condition differs: dev tolerates the
// placeholder while building, public rejects it so a placeholder can never ship.
const hasPlaceholder = html.indexOf('data-hero-placeholder="1"') !== -1;
ok('home seo: hero has no dev placeholder (enforced in public build)',
   isPublicBuild ? !hasPlaceholder : true,
   hasPlaceholder ? 'placeholder present' + (isPublicBuild ? '' : ' (dev: tolerated)') : 'real screenshot');

// ---- Every referenced image file exists, and matches the manifest ----
// Covers all <img src> AND <source srcset> (PNG and WebP), verifies each file is
// non-empty with the exact declared dimensions in both formats, reads the OG
// image as exactly 1200x630, and cross-checks against data/home-screenshots.json
// so a future swap for an illustration or a wrongly sized file fails here.
function pngSize(buf) {
  if (buf.length < 24 || buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function webpSize(buf) {
  if (buf.length < 30 || buf.slice(0, 4).toString('ascii') !== 'RIFF' ||
      buf.slice(8, 12).toString('ascii') !== 'WEBP') return null;
  const fmt = buf.slice(12, 16).toString('ascii');
  if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (fmt === 'VP8L') {
    const b = buf.slice(21, 25);
    const bits = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fmt === 'VP8X') {
    return { w: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
             h: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1 };
  }
  return null;
}
function imgSize(rel) {
  const p = path.join(siteDir, rel);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  return rel.endsWith('.webp') ? webpSize(buf) : pngSize(buf);
}

// 1. Every image the Home references (src or srcset) exists and is non-empty.
const imgRefs = [];
for (const m of html.matchAll(/(?:src|srcset)="(assets\/[^"]+\.(?:png|webp|jpg|jpeg|svg))"/g)) imgRefs.push(m[1]);
const uniqueRefs = [...new Set(imgRefs)];
ok('home seo: Home references the hero, mobile and verify screenshots (png+webp)',
   uniqueRefs.length >= 5, uniqueRefs.length + ' image refs');
uniqueRefs.forEach(function (ref) {
  const p = path.join(siteDir, ref);
  const exists = fs.existsSync(p);
  ok('home seo: referenced image exists: ' + ref, exists, ref);
  if (exists) ok('home seo: referenced image is non-empty: ' + ref, fs.statSync(p).size > 0);
});

// 2. Manifest: each screenshot exists in every declared format with EXACT dims.
const manifest = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home-screenshots.json'), 'utf8'));
manifest.screenshots.forEach(function (s) {
  ok('home seo: manifest entry ' + s.id + ' is an authentic product screenshot',
     s.kind === 'authentic-product-screenshot', s.kind);
  s.formats.forEach(function (ext) {
    const rel = 'assets/screenshots/' + s.file + '.' + ext;
    const p = path.join(siteDir, rel);
    const exists = fs.existsSync(p);
    ok('home seo: manifest file exists: ' + rel, exists);
    if (!exists) return;
    ok('home seo: manifest file non-empty: ' + rel, fs.statSync(p).size > 0);
    const dim = imgSize(rel);
    ok('home seo: ' + rel + ' is ' + s.width + 'x' + s.height,
       dim && dim.w === s.width && dim.h === s.height, dim ? dim.w + 'x' + dim.h : 'unreadable');
  });
});

// 3. The OG image is referenced and is EXACTLY 1200x630 on disk.
const ogRef = 'assets/screenshots/plumline-home-og.png';
const ogDim = imgSize(ogRef);
ok('home seo: OG image is exactly 1200x630', ogDim && ogDim.w === 1200 && ogDim.h === 630,
   ogDim ? ogDim.w + 'x' + ogDim.h : 'missing');

// 4. Every informative <img> under assets/screenshots is well-formed: exactly one
//    alt attribute, whose value equals the English dictionary and whose key exists
//    in all five languages, with no stray content leaking past the alt attribute
//    (the malformed-alt bug). Parsed with jsdom, not a partial regex, so trailing
//    junk after the closing quote cannot slip through.
let JSDOM_SEO = null;
try { ({ JSDOM: JSDOM_SEO } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { ok('home seo: jsdom available for alt parsing (CI)', false); }
  else { ok('home seo: alt parsing skipped (jsdom not installed locally)', true); }
}
if (JSDOM_SEO) {
  const doc = new JSDOM_SEO(html).window.document;
  const shots = [...doc.querySelectorAll('img[src*="assets/screenshots/"]')];
  ok('home seo: found the hero and verify <img> tags', shots.length >= 2, shots.length + ' screenshot imgs');
  shots.forEach(function (img) {
    const key = img.getAttribute('data-i18n-alt');
    ok('home seo: screenshot img has data-i18n-alt', !!key, img.getAttribute('src'));
    if (!key) return;
    // Exactly one alt attribute (getAttribute would silently take the first; count
    // occurrences in the serialized tag to catch a duplicated alt).
    const serialized = img.outerHTML;
    const altCount = (serialized.match(/(?:^|\s)alt=/g) || []).length;
    ok('home seo: ' + key + ' has exactly one alt attribute', altCount === 1, altCount + ' alt=');
    // No junk attributes such as optimal / solution / proven leaking from a broken
    // close-quote.
    const junk = Array.from(img.attributes).map(a => a.name).filter(n => /^(optimal|solution|proven)$/i.test(n));
    ok('home seo: ' + key + ' has no stray attributes from a broken alt', junk.length === 0, junk.join(','));
    // The serialized tag must end cleanly: ..."<alt value>"> with nothing between
    // the alt closing quote and the tag close.
    const wellFormed = new RegExp('data-i18n-alt="' + key + '"\\s+alt="[^"]*">$').test(serialized.trim()) ||
                       /alt="[^"]*"\s*\/?>$/.test(serialized.trim());
    ok('home seo: ' + key + ' tag closes cleanly after alt (no loose content)', wellFormed, serialized.slice(-60));
    // Alt value equals the English dictionary exactly.
    ok('home seo: inline EN alt for ' + key + ' matches the dictionary',
       img.getAttribute('alt') === DICT.en.home[key], key);
    ok('home seo: ' + key + ' alt is non-empty', (img.getAttribute('alt') || '').length >= 20);
    // Key exists in all five languages.
    ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
      ok('home seo: alt key ' + key + ' present in ' + lang,
         typeof DICT[lang].home[key] === 'string' && DICT[lang].home[key].length > 0, key);
    });
  });
}

// ---- Contact address guard -------------------------------------------
// The public build must not ship a personal address or an unconfigured domain
// address in the Home. Only approved domain addresses are allowed. During
// development the personal Gmail may remain elsewhere, but the Home add-on CTA
// must not carry it once the redesign lands. We scan the WHOLE Home for
// personal-provider mailto links and fail the PUBLIC build on any hit.
// ---- Contact address guard (same assertion count in both modes) ------
// The Home must not ship a personal or unapproved mailto. The assertion runs in
// BOTH dev and public so the test count is stable (build-info.json publishes it);
// only the pass condition differs: dev tolerates a personal Gmail while building,
// public rejects it. There are currently no mailto links on the Home, so this is
// a single stable assertion either way.
const APPROVED_DOMAINS = ['plumline.online'];
const mailtos = [...html.matchAll(/mailto:([^"'?&\s]+@[^"'?&\s]+)/g)].map(m => m[1]);
const personalProviders = /@(gmail|googlemail|yahoo|hotmail|outlook|proton|protonmail|icloud|me)\.com$/i;
const isPublic = isPublicBuild;
const badMailtos = mailtos.filter(function (addr) {
  const domain = addr.split('@')[1];
  return personalProviders.test(addr) || APPROVED_DOMAINS.indexOf(domain) === -1;
});
// Public: any bad mailto fails. Dev: allowed, so this passes regardless.
ok('home seo: Home has no personal/unapproved mailto (enforced in public build)',
   isPublic ? badMailtos.length === 0 : true,
   badMailtos.join(', ') + (isPublic ? '' : ' (dev: tolerated)'));

// ---- No waitlist / personal-email remnants anywhere on the Home ------
// The redesign removed the add-on waitlist. Guard against any remnant in the
// Home HTML, its inline JS, and the generated FAQ regions, in every language via
// the dictionary. These strings must not reappear.
const remnants = ['addonWaitlist', 'addonEmailSubject', 'addonEmailBody',
                  'Get notified', 'Leave your email', 'gmail.com'];
remnants.forEach(function (needle) {
  ok('home seo: Home HTML has no "' + needle + '"', html.indexOf(needle) === -1, needle);
});
// And the home dictionary carries none of the removed keys, in any language.
['addonWaitlist', 'addonEmailSubject', 'addonEmailBody'].forEach(function (key) {
  ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
    ok('home seo: dict has no removed key ' + key + ' [' + lang + ']',
       !(DICT[lang].home && DICT[lang].home[key]), key);
  });
});

// ---- OG / Twitter image metadata is complete -------------------------
const OG_URL = 'https://plumline.online/assets/screenshots/plumline-home-og.png';
[
  ['og:image', OG_URL],
  ['og:image:type', 'image/png'],
  ['og:image:width', '1200'],
  ['og:image:height', '630']
].forEach(function (pair) {
  const re = new RegExp('<meta property="' + pair[0].replace(/:/g, ':') + '" content="' + pair[1].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '"');
  ok('home seo: has ' + pair[0] + ' = ' + pair[1], re.test(html));
});
ok('home seo: has og:image:alt', /<meta property="og:image:alt" content="[^"]{20,}"/.test(html));
ok('home seo: twitter:image points at the Home OG image',
   html.indexOf('<meta name="twitter:image" content="' + OG_URL + '"') !== -1);
ok('home seo: has twitter:image:alt', /<meta name="twitter:image:alt" content="[^"]{20,}"/.test(html));
ok('home seo: no stale og-image.png reference', html.indexOf('assets/og-image.png') === -1);

// ---- Proof language guard --------------------------------------------
// "Proof" must stay precise: the Home distinguishes verification (recomputing the
// objective and constraints) from proof of optimality (the algorithm showing no
// better solution exists). These old absolute phrasings must never come back, and
// the corrected copy must be present in the HTML and in all five languages.
const FORBIDDEN_PROOF = [
  'comes with its proof',              // old verTitle
  'refuses what it cannot prove',      // old limUnsupportedH
  'the best allocation it can prove',  // old heroLead2 / howSolveP
  'A proven status',                   // old verStatusH
  'separates proven from feasible'     // interim limUnsupportedH
];
FORBIDDEN_PROOF.forEach(function (phrase) {
  ok('home seo: Home HTML no longer says "' + phrase + '"', html.indexOf(phrase) === -1, phrase);
  ['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
    const hit = Object.keys(DICT[lang].home).some(function (k) {
      const v = DICT[lang].home[k];
      return typeof v === 'string' && v.indexOf(phrase) !== -1;
    });
    ok('home seo: dict[' + lang + '] no longer says "' + phrase + '"', !hit, phrase);
  });
});
// The corrected English copy must be present (both dict and inline).
// The corrected copy must be present in EVERY language, checked by exact equality
// against the approved text — not just the English needle. This prevents an old
// translation (e.g. Spanish "Un estado demostrado") from creeping back into a
// non-English dictionary, which an English-only needle check would miss.
const EXPECTED_PROOF_COPY = {
  en: {
    heroLead2: 'Paste a model from Excel or Google Sheets, or build one in the grid. Plumline searches for the best allocation, checks it against your formulas, and tells you whether optimality was proven.',
    howSolveP: 'It searches for the best allocation.',
    verStatusH: 'A clear solve status',
    limUnsupportedH: 'It distinguishes optimal, feasible and incomplete results'
  },
  es: {
    heroLead2: 'Pega un modelo desde Excel o Google Sheets, o constrúyelo en la cuadrícula. Plumline busca la mejor asignación, la comprueba contra tus fórmulas y te dice si se demostró la optimalidad.',
    howSolveP: 'Busca la mejor asignación.',
    verStatusH: 'Un estado de resolución claro',
    limUnsupportedH: 'Distingue resultados óptimos, viables e incompletos'
  },
  pt: {
    heroLead2: 'Cola um modelo do Excel ou do Google Sheets, ou constrói um na grelha. O Plumline procura a melhor alocação, verifica-a com as tuas fórmulas e diz-te se a otimalidade foi comprovada.',
    howSolveP: 'Procura a melhor alocação.',
    verStatusH: 'Um estado de resolução claro',
    limUnsupportedH: 'Distingue resultados ótimos, viáveis e incompletos'
  },
  de: {
    heroLead2: 'Füge ein Modell aus Excel oder Google Sheets ein oder erstelle eines im Raster. Plumline sucht die beste Zuteilung, prüft sie anhand deiner Formeln und sagt dir, ob die Optimalität bewiesen wurde.',
    howSolveP: 'Es sucht die beste Zuteilung.',
    verStatusH: 'Ein klarer Lösungsstatus',
    limUnsupportedH: 'Es unterscheidet optimale, zulässige und unvollständige Ergebnisse'
  },
  fr: {
    heroLead2: "Collez un modèle depuis Excel ou Google Sheets, ou construisez-en un dans la grille. Plumline cherche la meilleure répartition, la vérifie avec vos formules et vous indique si l'optimalité a été prouvée.",
    howSolveP: 'Il cherche la meilleure répartition.',
    verStatusH: 'Un statut de résolution clair',
    limUnsupportedH: 'Il distingue les résultats optimaux, réalisables et incomplets'
  }
};
['en', 'es', 'pt', 'de', 'fr'].forEach(function (lang) {
  Object.keys(EXPECTED_PROOF_COPY[lang]).forEach(function (key) {
    ok('home seo: dict.' + lang + '.home.' + key + ' is the approved copy',
       DICT[lang].home[key] === EXPECTED_PROOF_COPY[lang][key], key + ' [' + lang + ']');
  });
});
// And the inline English HTML carries the corrected copy (first paint / no-JS).
['heroLead2', 'howSolveP', 'verStatusH', 'limUnsupportedH'].forEach(function (key) {
  ok('home seo: inline HTML carries the corrected ' + key, html.indexOf(EXPECTED_PROOF_COPY.en[key]) !== -1, key);
});

console.log('HOME SEO TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (typeof module !== 'undefined') module.exports = { pass, fail };
