'use strict';

/*
 * Checkpoint F3c — Home closing sections (audiences/capabilities, privacy,
 * limits, add-on, FAQ, final CTA, SEO).
 *
 * Pins the guarantees for the sections AFTER the F3a hero and the F3b core
 * sections: their presence and order, strict separation from F3a/F3b, product
 * truth (only real, verifiable capabilities; honest add-on; no COUNTIF; no fake
 * waitlist; no personal Gmail; honest privacy), five-language coverage with no
 * visible English fallback, FAQ ↔ JSON-LD parity, and valid JSON-LD.
 *
 * Windows-portable: no external commands; temp trees (none needed here) would use
 * fs.cpSync / fs.rmSync and process.execPath.
 */

const fs = require('fs');
const path = require('path');

function run(siteDir) {
  siteDir = siteDir || path.join(__dirname, '..');
  let pass = 0, fail = 0; const failures = [];
  function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  const mainM = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const main = mainM ? mainM[1] : '';

  // i18n dictionary.
  const g = { navigator: { language: 'en' }, location: { search: '' }, document: { documentElement: {} } };
  g.window = g; g.globalThis = g;
  new Function('window', 'navigator', 'location', 'document', 'globalThis',
    fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8'))
    .call(g, g, g.navigator, g.location, g.document, g);
  const DICT = g.Plumline.i18n.dict;
  const LANGS = ['en', 'es', 'pt', 'de', 'fr'];

  // Enumerate the top-level <section> blocks of <main> individually. The Home has
  // no nested <section>, so a non-greedy match per opening tag is exact and never
  // spans from one section across others.
  function enumerateSections() {
    const out = []; const re = /<section\b[\s\S]*?<\/section>/g; let m;
    while ((m = re.exec(main)) !== null) out.push(m[0]);
    return out;
  }
  const ALL_SECTIONS = enumerateSections();
  function sectionOf(id) {
    const re = new RegExp('id="' + id + '"');
    for (let i = 0; i < ALL_SECTIONS.length; i++) if (re.test(ALL_SECTIONS[i].match(/<section\b[^>]*>/)[0])) return ALL_SECTIONS[i];
    return '';
  }
  // Return exactly the ONE section whose OWN content contains the marker (e.g. the
  // final CTA, which has no id). Fails loudly (returns '') if zero or many match,
  // so it can never silently span F3a/F3b.
  function sectionContaining(marker) {
    const hits = ALL_SECTIONS.filter(function (s) { return s.indexOf(marker) !== -1; });
    return hits.length === 1 ? hits[0] : '';
  }
  function indexOfId(id) { return main.indexOf('id="' + id + '"'); }

  // ===== 1. Existence and order of all F3c sections =====
  const F3C_IDS = ['capabilities', 'privacy', 'limits', 'addon', 'help', 'faq'];
  F3C_IDS.forEach(function (id) { ok('1: F3c section present: #' + id, indexOfId(id) !== -1, id); });
  // final CTA (no id; identified by ctaTitle) exists and is last.
  ok('1: final CTA present', /data-i18n="ctaTitle"/.test(main));
  // order: capabilities < privacy < limits < addon < help < faq < cta.
  const positions = F3C_IDS.map(indexOfId);
  let ordered = true; for (let i = 1; i < positions.length; i++) if (positions[i] <= positions[i - 1]) ordered = false;
  ok('1: F3c sections appear in the approved order', ordered, positions.join(','));
  const ctaPos = main.indexOf('data-i18n="ctaTitle"');
  ok('1: final CTA comes after the FAQ', ctaPos > indexOfId('faq'), ctaPos + ' vs ' + indexOfId('faq'));

  // ===== 2 & 3 & 4. Strict separation: F3a hero and F3b sections intact, and
  // F3c comes strictly after them. =====
  ok('2: F3a hero present (figure.hero-demo)', /<figure class="hero-demo"/.test(main));
  ok('2: F3a proof strip present', /class="section proof-strip"/.test(main));
  ok('3: hero H1 count is exactly one', (main.match(/<h1\b/g) || []).length === 1);
  const F3B_IDS = ['how', 'use-cases', 'verify', 'example'];
  F3B_IDS.forEach(function (id) { ok('4: F3b section present: #' + id, indexOfId(id) !== -1, id); });
  // F3b featured example region intact (exactly one HOME_FEATURED region).
  ok('4: F3b HOME_FEATURED markers intact (once each)',
    (html.match(/<!-- HOME_FEATURED_START -->/g) || []).length === 1 &&
    (html.match(/<!-- HOME_FEATURED_END -->/g) || []).length === 1);
  // Ordering: every F3b section precedes every F3c section.
  const lastF3b = Math.max.apply(null, F3B_IDS.map(indexOfId));
  const firstF3c = Math.min.apply(null, F3C_IDS.map(indexOfId));
  ok('2/4: all F3b sections precede all F3c sections', lastF3b < firstF3c, lastF3b + ' < ' + firstF3c);
  // F3a hero precedes F3b which precedes F3c.
  ok('3: hero precedes the first F3b section', main.indexOf('hero-demo') < Math.min.apply(null, F3B_IDS.map(indexOfId)));

  // ===== 5 & 6. Five-language coverage, no visible English fallback. =====
  // Collect every data-i18n key used inside the F3c sections + CTA.
  // Build the F3c HTML from the six F3c sections plus the EXACT CTA section
  // (selected by its own content, never spanning F3a/F3b).
  const ctaSection = sectionContaining('data-i18n="ctaTitle"');
  ok('5: the final CTA section is uniquely identifiable', ctaSection.length > 0);
  const f3cHtml = F3C_IDS.map(sectionOf).concat([ctaSection]).join('\n');
  // Contract: f3cHtml must NOT contain any F3a/F3b-exclusive key or id — proof the
  // extraction did not span the hero or the F3b core sections.
  const F3AB_MARKERS = ['hero-demo', 'proof-strip', 'heroTitle', 'heroEyebrow', 'heroLead2',
    'id="how"', 'id="use-cases"', 'id="verify"', 'id="example"',
    'HOME_FEATURED', 'verify-flow', 'how3-step', 'uc-hero', 'featured-card',
    'howStep1H', 'ucLead', 'verFlow1H', 'exName_'];
  F3AB_MARKERS.forEach(function (mk) {
    ok('2: f3cHtml excludes F3a/F3b marker "' + mk + '"', f3cHtml.indexOf(mk) === -1, mk);
  });
  const f3cKeys = Array.from(new Set(Array.from(f3cHtml.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)).map(m => m[1])));
  ok('5: F3c sections declare i18n keys', f3cKeys.length > 0, String(f3cKeys.length));

  // Canonical resolution — identical to production's lookupTranslation — but
  // returning ORIGIN metadata so fallback is detected by SOURCE, not by comparing
  // text. A key that legitimately has the same text as English but exists in the
  // local dictionary is fine; a key that only resolves because it fell through to
  // English is a real fallback.
  const PAGE = 'home';
  const EXTRA = ['capabilities', 'examples'];
  function resolveMeta(lang, key) {
    const order = ['common', PAGE].concat(EXTRA);
    const L = DICT[lang];
    if (L) {
      for (let i = 0; i < order.length; i++) {
        if (L[order[i]] && L[order[i]][key] != null) {
          return { value: L[order[i]][key], namespace: order[i], requestedLanguage: lang, sourceLanguage: lang, usedEnglishFallback: false };
        }
      }
    }
    for (let j = 0; j < order.length; j++) {
      if (DICT.en[order[j]] && DICT.en[order[j]][key] != null) {
        return { value: DICT.en[order[j]][key], namespace: order[j], requestedLanguage: lang, sourceLanguage: 'en', usedEnglishFallback: lang !== 'en' };
      }
    }
    return { value: null, namespace: null, requestedLanguage: lang, sourceLanguage: null, usedEnglishFallback: false };
  }
  function resolve(lang, key) { return resolveMeta(lang, key).value; }

  // Every F3c key must resolve locally (no English fallback) and be non-empty in
  // all five languages.
  f3cKeys.forEach(function (k) {
    LANGS.forEach(function (lang) {
      const r = resolveMeta(lang, k);
      ok('5: ' + lang + ' resolves F3c key ' + k + ' locally, non-empty',
        typeof r.value === 'string' && r.value.trim().length > 0 && r.usedEnglishFallback === false,
        lang + '.' + k + (r.usedEnglishFallback ? ' [EN-FALLBACK]' : ''));
    });
  });

  // No accidental English fallback for any F3c key: for each non-English language,
  // the key must have a local entry (usedEnglishFallback === false). This is by
  // ORIGIN, so a legitimately-identical translation (a cognate) still passes
  // because it exists in the local dictionary; a missing key that fell back to
  // English fails. No word-count heuristic, no anyTranslated.
  f3cKeys.forEach(function (k) {
    ['es', 'pt', 'de', 'fr'].forEach(function (lang) {
      const r = resolveMeta(lang, k);
      ok('6: ' + lang + '.' + k + ' has a local entry (not English fallback)',
        r.usedEnglishFallback === false && typeof r.value === 'string' && r.value.trim().length > 0,
        lang + '.' + k + ' ns=' + r.namespace + ' src=' + r.sourceLanguage);
    });
  });

  // Prose keys (letters, not a bare number) — used only to target the semantic
  // truth scan below over the resolved text.
  function isProse(v) { return typeof v === 'string' && /[a-zA-Z]/.test(v) && v.trim().length >= 2 && !/^\d+$/.test(v.trim()); }
  const proseKeys = f3cKeys.filter(function (k) { const en = resolve('en', k); return isProse(en); });
  ok('6: F3c has prose keys to check', proseKeys.length >= 6, String(proseKeys.length));

  // Per-language semantic truth over the RESOLVED F3c prose text. Forbidden claims
  // are defined PER LANGUAGE across eight categories: absolute mathematical proof,
  // perfect/guaranteed answer, always correct, error-free, add-on available now,
  // waitlist/spot reservation, server/cloud processing, personal Gmail.
  const resolvedByLang = {};
  LANGS.forEach(function (lang) {
    resolvedByLang[lang] = proseKeys.map(function (k) { return resolve(lang, k); }).filter(Boolean).join('  ');
  });
  const FORBIDDEN_BY_LANG = {
    en: {
      absoluteProof: /\b(mathematical proof|mathematically proven|proven correct absolutely)\b/i,
      perfectGuaranteed: /\b(perfect answer|guaranteed (answer|result|correct)|guarantees? (a )?correct)\b/i,
      alwaysCorrect: /\balways correct\b/i,
      errorFree: /\berror[- ]free\b/i,
      availableNow: /\b(available now|download now|install now|get it now)\b/i,
      waitlist: /\b(waitlist|join the waitlist|reserve (your|a) (spot|place)|sign up to be notified)\b/i,
      remote: /\b(uploaded to (our|the) server|processed (in|on) the cloud|sent to our servers|runs on our servers)\b/i,
      gmail: /[a-z0-9._%+-]+@gmail\.com/i
    },
    es: {
      absoluteProof: /\b(prueba matem[aá]tica|demostraci[oó]n matem[aá]tica|matem[aá]ticamente demostrad)/i,
      perfectGuaranteed: /\b(respuesta perfecta|garantizad[ao]s?|resultado garantizado)\b/i,
      alwaysCorrect: /\bsiempre correct[ao]s?\b/i,
      errorFree: /\b(sin errores|libre de errores)\b/i,
      availableNow: /\b(disponible ahora|descarga ya|instala ya|desc[aá]rgalo ya)\b/i,
      waitlist: /\b(lista de espera|reserva tu (plaza|lugar)|ap[uú]ntate a la lista)\b/i,
      remote: /\b(sube (a|al) (nuestro |el )?servidor|se procesa en la nube|se env[ií]a a (nuestros|los) servidores)\b/i,
      gmail: /[a-z0-9._%+-]+@gmail\.com/i
    },
    pt: {
      absoluteProof: /\b(prova matem[aá]tica|demonstra[cç][aã]o matem[aá]tica|matematicamente provad)/i,
      perfectGuaranteed: /\b(resposta perfeita|garantid[ao]s?|resultado garantido)\b/i,
      alwaysCorrect: /\bsempre corret[ao]s?\b/i,
      errorFree: /\b(sem erros|livre de erros)\b/i,
      availableNow: /\b(dispon[ií]vel agora|descarrega j[aá]|instala j[aá]|transfere j[aá])\b/i,
      waitlist: /\b(lista de espera|reserva o teu (lugar|lugar)|inscreve-te na lista)\b/i,
      remote: /\b(envia(do)? para (o|os) servidor|processado na nuvem|enviad[oa]s? para os nossos servidores)\b/i,
      gmail: /[a-z0-9._%+-]+@gmail\.com/i
    },
    de: {
      absoluteProof: /\b(mathematischer beweis|mathematisch bewiesen|beweist absolut)/i,
      perfectGuaranteed: /\b(perfekte antwort|garantiert(e|es)?|garantiert korrekt)\b/i,
      alwaysCorrect: /\bimmer korrekt\b/i,
      errorFree: /\bfehlerfrei\b/i,
      availableNow: /\b(jetzt verf[uü]gbar|jetzt herunterladen|jetzt installieren)\b/i,
      waitlist: /\b(warteliste|sichere dir (deinen|einen) platz|melde dich für die liste)\b/i,
      remote: /\b(auf (unseren|den) server hochgeladen|in der cloud verarbeitet|an unsere server gesendet)\b/i,
      gmail: /[a-z0-9._%+-]+@gmail\.com/i
    },
    fr: {
      absoluteProof: /\b(preuve math[eé]matique|d[eé]montr[eé] math[eé]matiquement|prouv[eé] absolument)/i,
      perfectGuaranteed: /\b(r[eé]ponse parfaite|garanti(e|es)?|r[eé]sultat garanti)\b/i,
      alwaysCorrect: /\btoujours correct(e|s)?\b/i,
      errorFree: /\b(sans erreur|exempt d.?erreur)\b/i,
      availableNow: /\b(disponible maintenant|t[eé]l[eé]charger maintenant|installer maintenant)\b/i,
      waitlist: /\b(liste d.?attente|r[eé]servez votre place|inscrivez-vous à la liste)\b/i,
      remote: /\b(t[eé]l[eé]vers[eé] sur (nos|le) serveur|trait[eé] dans le cloud|envoy[eé] à nos serveurs)\b/i,
      gmail: /[a-z0-9._%+-]+@gmail\.com/i
    }
  };
  const CATEGORY_LABEL = {
    absoluteProof: 'absolute mathematical proof', perfectGuaranteed: 'perfect/guaranteed answer',
    alwaysCorrect: 'always correct', errorFree: 'error-free', availableNow: 'add-on available now',
    waitlist: 'waitlist/spot reservation', remote: 'server/cloud processing', gmail: 'personal Gmail'
  };
  LANGS.forEach(function (lang) {
    const txt = resolvedByLang[lang];
    ok('9: [' + lang + '] no COUNTIF in resolved F3c text', !/countif/i.test(txt));
    const rules = FORBIDDEN_BY_LANG[lang];
    Object.keys(rules).forEach(function (cat) {
      ok('8/10/11/12/13: [' + lang + '] no forbidden claim (' + CATEGORY_LABEL[cat] + ')',
        !rules[cat].test(txt), cat);
    });
  });

  // ===== 7 & 8 & 9. Product truth: capabilities/limits match real contracts;
  // no non-existent capability; no COUNTIF. =====
  // COUNTIF must not appear anywhere on the Home.
  ok('9: no COUNTIF anywhere on the Home', !/countif/i.test(html));
  // Approved solve-status vocabulary present in the limits copy; forbidden
  // absolute-proof claims absent across the F3c sections.
  const FORBIDDEN = ['mathematical proof', 'guaranteed', 'always correct', 'perfect answer', 'error-free', 'error free'];
  FORBIDDEN.forEach(function (bad) {
    ok('8: no forbidden claim on the Home: "' + bad + '"', html.toLowerCase().indexOf(bad) === -1, bad);
  });
  // Capabilities projected from product-capabilities.js (single owner); the Home
  // must not invent capability metadata by hand outside the generated region.
  const caps = sectionOf('capabilities');
  ok('7: capabilities region present (projected, not hand-authored)',
    /<!-- HOME_CAPABILITIES_START -->/.test(html) && /<!-- HOME_CAPABILITIES_END -->/.test(html));
  const capsRegion = (html.match(/<!-- HOME_CAPABILITIES_START -->([\s\S]*?)<!-- HOME_CAPABILITIES_END -->/) || ['', ''])[1];

  // EXACT model set from the canonical owner — same filter the projector uses
  // (isShown && group === 'models' && typeof homeSummaryRank === 'number', in rank
  // order). The Home must project exactly these model nameKeys and NO other model
  // type; a fifth card or an unknown type fails.
  const capOwner = require(path.join(siteDir, 'assets', 'product-capabilities.js'));
  const isShown = capOwner.isPublic;
  const canonicalModels = capOwner.CAPABILITIES
    .filter(function (c) { return isShown(c) && c.group === 'models' && typeof c.homeSummaryRank === 'number'; })
    .sort(function (a, b) { return a.homeSummaryRank - b.homeSummaryRank; });
  const canonicalModelNameKeys = canonicalModels.map(function (c) { return c.nameKey; });
  // Extract the ACTUAL projected model cards by structure: the models group is the
  // card whose <h3> carries capGroupModels; its <li> items are the model entries,
  // in document order, one array element per real <li> (duplicates preserved, so a
  // duplicated card is visible, and order is preserved for the order check).
  const modelsCardMatch = capsRegion.match(/<div class="card">\s*<h3[^>]*data-i18n="capGroupModels"[\s\S]*?<\/ul>/);
  const modelsCard = modelsCardMatch ? modelsCardMatch[0] : '';
  ok('7: models capability card is present', modelsCard.length > 0);
  // Extract the <ul> of the models card, then EVERY real <li> inside it — with or
  // without data-i18n — preserving count and order. A manual <li> without a model
  // key is therefore visible (it becomes an entry that fails the per-<li> check),
  // so it cannot slip past a data-i18n-only regex.
  const ulMatch = modelsCard.match(/<ul[^>]*>([\s\S]*?)<\/ul>/);
  const ulInner = ulMatch ? ulMatch[1] : '';
  const liItems = Array.from(ulInner.matchAll(/<li\b[\s\S]*?<\/li>/g)).map(function (m) { return m[0]; });
  ok('7: models card has at least one <li>', liItems.length > 0, String(liItems.length));

  // Per-<li> validation: exactly one model nameKey, and it is canonical.
  const projectedModelCards = liItems.map(function (li) {
    const keys = Array.from(li.matchAll(/data-i18n="(capModel[A-Za-z]+Name)"/g)).map(function (m) { return m[1]; });
    return { li: li, keys: keys };
  });
  projectedModelCards.forEach(function (entry, i) {
    ok('7: models <li> ' + i + ' has exactly one model nameKey',
      entry.keys.length === 1, 'keys=[' + entry.keys.join(',') + '] li=' + entry.li.replace(/\s+/g, ' ').slice(0, 60));
    ok('7: models <li> ' + i + ' key is canonical (no manual/unknown entry)',
      entry.keys.length === 1 && canonicalModelNameKeys.indexOf(entry.keys[0]) !== -1,
      entry.keys[0] || '(none)');
  });
  // The ordered list of one key per real <li> (missing keys become '' so a manual
  // entry shifts the array and fails the count/order comparison too).
  const projectedKeys = projectedModelCards.map(function (e) { return e.keys.length === 1 ? e.keys[0] : ''; });

  // Direct ordered array comparison against the canonical model nameKeys (no Set):
  // same count (one entry per real <li>), same key at each position, same order.
  ok('7: real <li> count equals the canonical model count',
    projectedKeys.length === canonicalModelNameKeys.length,
    projectedKeys.length + ' vs ' + canonicalModelNameKeys.length);
  let orderMatches = projectedKeys.length === canonicalModelNameKeys.length;
  for (let i = 0; i < canonicalModelNameKeys.length && orderMatches; i++) {
    if (projectedKeys[i] !== canonicalModelNameKeys[i]) orderMatches = false;
  }
  ok('7: projected model cards match canonical keys in exact order (no Set)',
    orderMatches, 'projected=[' + projectedKeys.join(',') + '] canonical=[' + canonicalModelNameKeys.join(',') + ']');
  // No duplicated card among the projected model entries.
  ok('7: no duplicated model capability card',
    new Set(projectedKeys).size === projectedKeys.length, projectedKeys.join(','));
  // Every canonical model nameKey is projected (membership, complementary).
  canonicalModelNameKeys.forEach(function (k) {
    ok('7: canonical model capability projected: ' + k, projectedKeys.indexOf(k) !== -1, k);
  });

  // Additional defence: no UNKNOWN capModel*Name anywhere in the region (a manual
  // card with a non-canonical key, even outside the models card).
  const anyModelKeysInRegion = Array.from(capsRegion.matchAll(/(capModel[A-Za-z]+Name)/g)).map(m => m[1]);
  ok('7: no capModel* key outside the canonical set anywhere in the region',
    anyModelKeysInRegion.every(function (k) { return canonicalModelNameKeys.indexOf(k) !== -1; }),
    Array.from(new Set(anyModelKeysInRegion)).join(','));

  // Limits: over the RESOLVED text of each language, the linear scope is stated and
  // non-linear support is DENIED (rejected/unsupported), and never claimed. Uses
  // per-language rules (the resolved limits prose, not just the presence of a key).
  const lim = sectionOf('limits');
  const LIMIT_KEYS = Array.from(new Set(Array.from(lim.matchAll(/data-i18n="(lim[A-Za-z0-9]+)"/g)).map(m => m[1])));
  function limitsText(lang) { return LIMIT_KEYS.map(function (k) { return resolve(lang, k); }).filter(Boolean).join('  '); }
  const LINEAR_TERM = { en: /linear/i, es: /lineal/i, pt: /linear/i, de: /linear/i, fr: /lin[eé]aire/i };
  // "non-linear is not supported / rejected" phrasing per language.
  const NONLINEAR_DENIED = {
    en: /reject[\s\S]{0,20}non[- ]?linear/i,
    es: /rechaz[\s\S]{0,20}no\s+lineal/i,
    pt: /rejeit[\s\S]{0,20}n[aã]o\s+linear/i,
    de: /(lehnt[\s\S]{0,40}nicht[- ]?linear|nicht[- ]?linear[\s\S]{0,40}(ab|abgelehnt|nicht unterst[uü]tzt))/i,
    fr: /rejett?e[\s\S]{0,20}non[- ]?lin[eé]aire/i
  };
  // A claim that non-linear IS supported (must never appear).
  const NONLINEAR_SUPPORTED = {
    en: /(non-linear|nonlinear)[\s\S]{0,30}(supported|handled|solved)/i,
    es: /(no lineal|no lineales)[\s\S]{0,30}(soportad|admit|resuelt|acept)/i,
    pt: /(n[aã]o linear|n[aã]o lineares)[\s\S]{0,30}(suportad|resolvid|aceit)/i,
    de: /(nichtlinear|nicht linear)[\s\S]{0,30}(unterst[uü]tzt|gel[oö]st)/i,
    fr: /(non lin[eé]aire|non-lin[eé]aire)[\s\S]{0,30}(support|pris en charge|r[eé]solu)/i
  };
  LANGS.forEach(function (lang) {
    const txt = limitsText(lang);
    ok('7: [' + lang + '] limits keep the linear-model scope', LINEAR_TERM[lang].test(txt), lang);
    ok('7: [' + lang + '] limits deny non-linear support', NONLINEAR_DENIED[lang].test(txt), lang + ' :: ' + txt.slice(0, 60));
    ok('7: [' + lang + '] limits never claim non-linear support', !NONLINEAR_SUPPORTED[lang].test(txt), lang);
  });

  // ===== 10 & 11. Add-on honest; no fake waitlist. =====
  const addon = sectionOf('addon');
  ok('10: add-on section present', addon.length > 0);
  ok('10: add-on is presented as not-yet-available (in review / soon)',
    /addonInReview|addonSoon/.test(addon));
  // It must NOT claim current availability.
  ok('10: add-on does not claim it is available now',
    !/available now|download now|install now|get it now/i.test(DICT.en.home.addonSoonP || '') &&
    !/available now|download now|install now/i.test(addon));
  ok('11: no fake waitlist', !/waitlist/i.test(html));
  ok('11: no "join the waitlist"/"sign up" pressure in the add-on',
    !/join the waitlist|sign up to be notified|reserve your spot/i.test(html));

  // ===== 12. No Gmail / personal email. =====
  // A contact address on a domain is fine; a personal @gmail.com is not.
  ok('12: no personal @gmail.com address', !/[a-z0-9._%+-]+@gmail\.com/i.test(html));
  const mails = Array.from(html.matchAll(/mailto:([^"?]+)/g)).map(m => m[1]);
  mails.forEach(function (m) {
    ok('12: contact email is on the product domain: ' + m, /@plumline\.online$/.test(m), m);
  });

  // ===== 13. Privacy / local execution claims match the implementation. =====
  const priv = sectionOf('privacy');
  ok('13: privacy section present', priv.length > 0);
  // The privacy copy must describe local, in-browser execution, not remote calls.
  ok('13: privacy states in-browser / nothing uploaded', /browser|uploaded|device/i.test(resolve('en', 'privP') || '') || /browser|device/i.test(priv));
  // No claim of a remote/cloud service anywhere on the Home.
  ok('13: Home makes no remote/cloud processing claim',
    !/(uploads to (our|the) server|processed (in|on) the cloud|sent to our servers)/i.test(html));
  // No runtime fetch / external endpoint introduced by ANY of the seven F3c areas
  // (capabilities, privacy, limits, add-on, help, faq, and the exact CTA section).
  const helpSection = sectionOf('help');
  const F3C_AREAS = [
    { name: 'capabilities', html: caps }, { name: 'privacy', html: priv },
    { name: 'limits', html: lim }, { name: 'addon', html: addon },
    { name: 'help', html: helpSection }, { name: 'faq', html: sectionOf('faq') },
    { name: 'cta', html: ctaSection }
  ];
  F3C_AREAS.forEach(function (area) {
    ok('13: F3c area "' + area.name + '" has no fetch/remote endpoint',
      !/fetch\s*\(|https?:\/\/(?!schema\.org|www\.w3\.org)/i.test(area.html), area.name);
  });

  // ===== 14 & 15. FAQ ↔ JSON-LD parity (questions AND answers); valid JSON-LD. =====
  const faq = sectionOf('faq');
  // Visible FAQ: each <details> carries a question key (summary) and an answer key
  // (p). Extract them in document order.
  const faqPairs = Array.from(faq.matchAll(/<summary[^>]*data-i18n="(faq\d+Q)"[^>]*>[\s\S]*?<p[^>]*data-i18n="(faq\d+A)"/g))
    .map(function (m) { return { qKey: m[1], aKey: m[2] }; });
  ok('14: FAQ has visible question/answer pairs', faqPairs.length >= 3, String(faqPairs.length));

  // Production text treatment: the visible HTML escapes &,<,> via escText, while
  // the JSON-LD carries the raw dictionary text. Compare both sides against the
  // SAME canonical source — the English dictionary value — so entities/whitespace
  // never cause artificial diffs.
  function escText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  const enQ = faqPairs.map(function (p) { return DICT.en.home[p.qKey]; });
  const enA = faqPairs.map(function (p) { return DICT.en.home[p.aKey]; });

  // Parse EVERY JSON-LD block strictly; locate exactly one FAQPage node across all
  // blocks and all @graph members.
  const jsonlds = Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)).map(m => m[1]);
  let allValid = true; const faqNodes = [];
  jsonlds.forEach(function (raw) {
    let o; try { o = JSON.parse(raw); } catch (e) { allValid = false; return; }
    const candidates = Array.isArray(o['@graph']) ? o['@graph'] : [o];
    candidates.forEach(function (n) { if (n && n['@type'] === 'FAQPage') faqNodes.push(n); });
  });
  ok('15: every JSON-LD block parses with strict JSON.parse', allValid);
  ok('14: exactly one FAQPage node across all JSON-LD blocks and @graph', faqNodes.length === 1, String(faqNodes.length));

  if (faqNodes.length === 1) {
    const entities = faqNodes[0].mainEntity;
    const list = Array.isArray(entities) ? entities : [];
    // Exact count parity.
    ok('14: FAQPage mainEntity count equals the visible FAQ', list.length === faqPairs.length, list.length + ' vs ' + faqPairs.length);
    // Each entity is a well-formed Question with an Answer.
    list.forEach(function (e, i) {
      ok('14: FAQ entity ' + i + ' is a Question with acceptedAnswer @type Answer',
        e && e['@type'] === 'Question' && e.acceptedAnswer && e.acceptedAnswer['@type'] === 'Answer',
        JSON.stringify(e && e['@type']));
    });
    const ldQ = list.map(function (e) { return e && e.name; });
    const ldA = list.map(function (e) { return e && e.acceptedAnswer && e.acceptedAnswer.text; });
    // Exact question parity: same set, same order, against the canonical EN text.
    ok('14: each JSON-LD question exactly matches the visible question (order + text)',
      ldQ.length === enQ.length && ldQ.every(function (q, i) { return q === enQ[i]; }),
      (ldQ[0] || '') + ' vs ' + (enQ[0] || ''));
    // Exact answer parity.
    ok('14: each JSON-LD answer exactly matches the visible answer (order + text)',
      ldA.length === enA.length && ldA.every(function (a, i) { return a === enA[i]; }),
      String(ldA[0] || '').slice(0, 40) + ' vs ' + String(enA[0] || '').slice(0, 40));
    // Every JSON-LD question must correspond to a visible one and vice versa (set).
    ok('14: JSON-LD questions and visible questions are the same set',
      ldQ.every(function (q) { return enQ.indexOf(q) !== -1; }) && enQ.every(function (q) { return ldQ.indexOf(q) !== -1; }));
    ok('14: JSON-LD answers and visible answers are the same set',
      ldA.every(function (a) { return enA.indexOf(a) !== -1; }) && enA.every(function (a) { return ldA.indexOf(a) !== -1; }));
    // No duplicates on either side.
    ok('14: no duplicated JSON-LD question', new Set(ldQ).size === ldQ.length);
    ok('14: no duplicated JSON-LD answer', new Set(ldA).size === ldA.length);
    ok('14: no duplicated visible question', new Set(enQ).size === enQ.length);
    ok('14: no duplicated visible answer', new Set(enA).size === enA.length);
    // The visible HTML text is the escaped form of the same canonical answer
    // (proves the production text treatment lines up, not an artificial diff).
    faqPairs.forEach(function (p, i) {
      const visMatch = faq.match(new RegExp('data-i18n="' + p.aKey + '"[^>]*>([\\s\\S]*?)</p>'));
      const visible = visMatch ? visMatch[1] : null;
      ok('14: visible answer ' + i + ' is the escaped canonical text',
        visible !== null && visible === escText(enA[i]), p.aKey);
    });
    // Equivalent check for the QUESTIONS: the real text inside each <summary> must
    // be the escaped canonical question, and — by explicit transitivity — the
    // JSON-LD Question.name matches that same canonical text (visible == canonical
    // == JSON-LD), so a tampered <summary> cannot slip past a dictionary-only comparison.
    faqPairs.forEach(function (p, i) {
      const sumMatch = faq.match(new RegExp('<summary[^>]*data-i18n="' + p.qKey + '"[^>]*>([\\s\\S]*?)</summary>'));
      const visibleQ = sumMatch ? sumMatch[1] : null;
      ok('14: visible question ' + i + ' is the escaped canonical text',
        visibleQ !== null && visibleQ === escText(enQ[i]), p.qKey + ' :: ' + String(visibleQ).slice(0, 40));
      // Transitivity: JSON-LD name equals the canonical text that the visible
      // summary was just shown to equal.
      ok('14: JSON-LD question ' + i + ' matches the canonical text shown visibly',
        ldQ[i] === enQ[i], p.qKey);
    });
  }

  // ===== 16. Headings, IDs, links, ARIA valid across the F3c sections. =====
  const ids = (html.match(/\bid="([^"]+)"/g) || []).map(s => s.replace(/.*id="/, '').replace(/"$/, ''));
  ok('16: no duplicate IDs on the Home', ids.filter(function (v, i) { return ids.indexOf(v) !== i; }).length === 0,
    ids.filter(function (v, i) { return ids.indexOf(v) !== i; }).join(','));
  ok('16: no empty links', !/<a\b[^>]*>\s*<\/a>/.test(html));
  // Every F3c section has an h2 (section heading) — scannable structure.
  F3C_IDS.filter(function (id) { return id !== 'help'; }).forEach(function (id) {
    const s = sectionOf(id);
    ok('16: #' + id + ' has a heading', /<h[23]\b/.test(s), id);
  });
  // FAQ uses <details>/<summary> for keyboard-accessible disclosure.
  ok('16: FAQ uses <details> disclosure', /<details/.test(faq) && /<summary/.test(faq));

  // Precise ARIA/link checks over f3cHtml — which includes ALL seven areas
  // (capabilities, privacy, limits, add-on, help, faq) AND the exact CTA section,
  // so help and the CTA are not left out.
  const idSet = new Set(ids);
  // (a) Every anchor has a non-empty href.
  const anchors = Array.from(f3cHtml.matchAll(/<a\b([^>]*)>/g)).map(m => m[1]);
  ok('16: every F3c anchor (incl. CTA/help) has a non-empty href',
    anchors.every(function (a) { const m = a.match(/href="([^"]*)"/); return m && m[1].trim().length > 0; }),
    String(anchors.length) + ' anchors');
  // (b) Internal #id link targets exist on the page.
  const internalTargets = Array.from(f3cHtml.matchAll(/href="#([^"]+)"/g)).map(m => m[1]);
  internalTargets.forEach(function (t) { ok('16: internal link target #' + t + ' exists', idSet.has(t), t); });
  // (c) aria-labelledby / aria-describedby references resolve to existing ids.
  ['aria-labelledby', 'aria-describedby'].forEach(function (attr) {
    const refs = Array.from(f3cHtml.matchAll(new RegExp(attr + '="([^"]+)"', 'g')))
      .reduce(function (acc, m) { return acc.concat(m[1].split(/\s+/)); }, []);
    refs.forEach(function (r) { ok('16: ' + attr + ' target #' + r + ' exists', idSet.has(r), r); });
  });
  // (d) Each FAQ <details> is well-formed: has exactly one <summary>.
  const details = Array.from(faq.matchAll(/<details\b[\s\S]*?<\/details>/g)).map(m => m[0]);
  ok('16: every FAQ <details> has exactly one <summary>',
    details.length > 0 && details.every(function (d) { return (d.match(/<summary\b/g) || []).length === 1; }),
    String(details.length) + ' details');
  // (e) No extra <h1> across all seven F3c areas + CTA (single hero H1 preserved).
  ok('16: f3cHtml (incl. CTA/help) declares no <h1>', !/<h1\b/.test(f3cHtml));

  // ===== 17. No remote resources / trackers / new requests introduced. =====
  // Scope note: this suite checks the Home HTML source directly for the specific
  // resource kinds F3c could plausibly add (trackers, remote <script>/<link
  // stylesheet>) and the six-request contract. Full remote-resource coverage
  // (images, fonts, iframes, every asset, and live HTTP 200s / broken-link
  // crawling) is owned by the canonical suites tests_assets.js, validate_html.js
  // and engine/test_dist_http.js, which run in the same battery — this suite does
  // not re-implement or claim that coverage.
  ok('17: no Google Analytics / gtag', !/gtag\(|googletagmanager|google-analytics/i.test(html));
  ok('17: no remote script/style on the Home', (function () {
    // Loadable remote resources only: <script src=...> and stylesheet links.
    // Exclude JSON-LD, and metadata links (canonical/og/alternate) which are not
    // loaded resources. The own domain (plumline.online) is not third-party.
    const noLd = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    const scriptRemote = /<script[^>]+src="https?:\/\/(?!([^"]*\.)?plumline\.online)/i.test(noLd);
    const styleRemote = /<link[^>]+rel="stylesheet"[^>]*href="https?:\/\/(?!([^"]*\.)?plumline\.online)/i.test(noLd);
    return !scriptRemote && !styleRemote;
  })());
  // Six requests contract (from the canonical fixture).
  ok('17: six canonical requests intact',
    JSON.parse(fs.readFileSync(path.join(siteDir, 'engine', 'fixtures', 'single-engine', 'engine-e6-worker-mirror-final.json'), 'utf8')).public_output.requests === 6);

  // ===== 18 & 19 & 20. Engine/mirror/Solver/catalogue/examples/pages intact. =====
  const crypto = require('crypto');
  ok('18: engine source intact',
    crypto.createHash('sha256').update(fs.readFileSync(path.join(siteDir, 'engine', 'source', 'plumline-engine.js'))).digest('hex') ===
    '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf');
  ok('18: mirror intact',
    crypto.createHash('sha256').update(fs.readFileSync(path.join(siteDir, 'engine', 'engine.js'))).digest('hex') ===
    'faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6');
  const catMod = require(path.join(siteDir, 'src', 'shared', 'examples', 'index.js'));
  const catalogue = catMod.loadAndValidateCatalogue(siteDir).catalogue;
  ok('19: exactly nine published examples', catalogue.length === 9, String(catalogue.length));

  // ===== 21 & 22. Windows portability of the F3c suite itself. =====
  const selfSrc = fs.readFileSync(path.join(__dirname, 'tests_f3c_home_sections.js'), 'utf8');
  ['cp', 'rm', 'mv', 'sed', 'grep', 'bash', 'sh', 'cmd', 'powershell'].forEach(function (cmd) {
    const re = new RegExp('(?:execFileSync|execSync|spawnSync|spawn|exec)\\s*\\(\\s*[\'"]' + cmd + '[\'"]');
    ok('21: F3c suite does not shell out to "' + cmd + '"', !re.test(selfSrc), cmd);
  });
  ok('22: F3c suite spawns no external process', (function () {
    // This positive suite never spawns a subprocess. Detect a real child_process
    // require without matching this very check: build the needle by concatenation
    // so the check's own source does not contain the literal.
    const needle = 'child' + '_process';
    const requiresCp = selfSrc.indexOf('require(') !== -1 && selfSrc.indexOf(needle) !== -1 &&
      new RegExp("require\\(\\s*['\"]" + needle + "['\"]").test(selfSrc);
    const spawns = /\b(execFileSync|execSync|spawnSync|spawn)\s*\(/.test(selfSrc);
    return !requiresCp && !spawns;
  })());

  return { pass: pass, fail: fail, failures: failures };
}

if (require.main === module) {
  const r = run();
  r.failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F3C HOME CLOSING SECTIONS TESTS  PASSED: ' + r.pass + '   FAILED: ' + r.fail);
  process.exit(r.fail === 0 ? 0 : 1);
}

module.exports = { run: run };
