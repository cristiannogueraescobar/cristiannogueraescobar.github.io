'use strict';
/* ============================================================================
   Checkpoint F5 — examples architecture POSITIVE suite (static contracts).
   ----------------------------------------------------------------------------
   Validates the canonical F5 architecture: schema, identity, taxonomy, locales,
   authored-vs-derived separation, the nine-example migration, legacy projection
   and byte-compatibility, expected-result contract, search/facet projections,
   protection baselines and roadmap ownership. Behavioural engine solving lives in
   tests_f5_examples_behavioural.js; deep mutations in the negative suite.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = path.join(__dirname, '..');
const F5 = path.join(SITE, 'src', 'shared', 'examples', 'f5');
const { loadCanonical } = require(path.join(F5, 'index.js'));
const E = require(path.join(F5, 'enums.js'));
const { CATEGORIES } = require(path.join(F5, 'categories.js'));
const baseline = require(path.join(F5, 'baseline.json'));
const protectedBaseline = require(path.join(F5, 'protected-baseline.json'));
const { CATALOGUE } = require(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }
function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function read(p) { return fs.readFileSync(p, 'utf8'); }

const loaded = loadCanonical(SITE);
const canonical = loaded.canonical;
const byId = {}; canonical.forEach(function (c) { byId[c.key] = c; });

// ---------------------------------------------------------------- SCHEMA
ok('S1: every example declares schemaVersion 1', canonical.every(function (c) { return c.schemaVersion === E.SCHEMA_VERSION; }));
ok('S2: SCHEMA_VERSION is a positive integer', Number.isInteger(E.SCHEMA_VERSION) && E.SCHEMA_VERSION >= 1);
ok('S3: unknown top-level metadata field is rejected', (function () {
  const V = require(path.join(F5, 'validate.js'));
  const errs = []; V.validateMetaRecord('x', Object.assign({}, require(path.join(F5, 'metadata.js')).METADATA.production, { bogus: 1 }), CATALOGUE[0], errs);
  return errs.some(function (e) { return /unknown field "bogus"/.test(e); });
})());
ok('S4: unknown schemaVersion is rejected', (function () {
  const V = require(path.join(F5, 'validate.js'));
  const errs = []; V.validateMetaRecord('x', Object.assign({}, require(path.join(F5, 'metadata.js')).METADATA.production, { schemaVersion: 2 }), CATALOGUE[0], errs);
  return errs.some(function (e) { return /schemaVersion must be 1/.test(e); });
})());
ok('S5: serialization is deterministic', loaded.serialize(canonical[0]) === loaded.serialize(canonical[0]));
ok('S6: serialization rejects functions', (function () { try { loaded.serialize({ f: function () {} }); return false; } catch (e) { return /function/.test(e.message); } })());

// ---------------------------------------------------------------- IDENTITY
(function () {
  const ids = {}, slugs = {};
  canonical.forEach(function (c) {
    ok('I: id "' + c.key + '" unique', !ids[c.key]); ids[c.key] = true;
    ok('I: slug "' + c.slug + '" unique', !slugs[c.slug]); slugs[c.slug] = true;
    ok('I: slug "' + c.slug + '" is lowercase kebab-case', /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug));
  });
})();
// Public slug baseline (independent manifest): the nine current slugs are frozen.
(function () {
  const baselineSlugs = baseline.examples.map(function (b) { return b.slug; }).sort();
  const canonSlugs = canonical.map(function (c) { return c.slug; }).sort();
  ok('I-baseline: public slug set matches the independent baseline exactly', JSON.stringify(baselineSlugs) === JSON.stringify(canonSlugs), canonSlugs.join(','));
  baseline.examples.forEach(function (b) {
    ok('I-baseline: slug preserved for ' + b.key, byId[b.key] && byId[b.key].slug === b.slug);
  });
})();

// ---------------------------------------------------------------- TAXONOMY
ok('T1: exactly 10 canonical categories', CATEGORIES.length === 10);
ok('T2: category IDs are unique', (function () { const s = {}; return CATEGORIES.every(function (c) { if (s[c.id]) return false; s[c.id] = true; return true; }); })());
ok('T3: category IDs match the enum order', JSON.stringify(CATEGORIES.map(function (c) { return c.id; })) === JSON.stringify(E.CATEGORY_IDS));
ok('T4: every category has 5 localized labels + shorts', CATEGORIES.every(function (c) { return E.LOCALES.every(function (l) { return c.label[l] && c.short[l]; }); }));
ok('T5: no Italian in category labels', CATEGORIES.every(function (c) { return !c.label.it && !c.short.it; }));
ok('T6: every example primary category is canonical', canonical.every(function (c) { return E.CATEGORY_IDS.indexOf(c.primaryCategory) !== -1; }));
ok('T7: categories validate', loaded.validate.validateCategories(CATEGORIES).ok);

// Frozen owned category registry (source purity) — real assertions, not a comment.
(function () {
  ok('T-freeze: loaded.categories is not the source array', loaded.categories !== CATEGORIES);
  ok('T-freeze: loaded.categories is frozen', Object.isFrozen(loaded.categories));
  ok('T-freeze: loaded.categories[0] is frozen', Object.isFrozen(loaded.categories[0]));
  ok('T-freeze: loaded.categories[0].label is frozen', Object.isFrozen(loaded.categories[0].label));
  ok('T-freeze: loaded.categories[0].short is frozen', Object.isFrozen(loaded.categories[0].short));
  // Mutating the exposed registry does not change the source module array.
  const before = CATEGORIES[0].label.en;
  try { loaded.categories[0].label.en = 'BROKEN'; } catch (e) {}
  ok('T-freeze: mutating exposed registry never changes source', CATEGORIES[0].label.en === before);
  // A second loadCanonical still validates (state not corrupted).
  ok('T-freeze: a second loadCanonical still validates', loadCanonical(SITE).categories.length === 10);
})();

// Frozen ID/slug/order CONTRACT, independent of labels/shorts.
(function () {
  const contract = E.CATEGORY_CONTRACT;
  ok('T-contract: contract has exactly 10 entries', contract.length === 10);
  ok('T-contract: registry ids match the contract in order', JSON.stringify(CATEGORIES.map(function (c) { return c.id; })) === JSON.stringify(contract.map(function (x) { return x.id; })));
  ok('T-contract: registry slugs match the contract in order', JSON.stringify(CATEGORIES.map(function (c) { return c.slug; })) === JSON.stringify(contract.map(function (x) { return x.slug; })));
  ok('T-contract: registry orders match the contract in order', JSON.stringify(CATEGORIES.map(function (c) { return c.order; })) === JSON.stringify(contract.map(function (x) { return x.order; })));
  ok('T-contract: orders are the deterministic 1..10 sequence', JSON.stringify(CATEGORIES.map(function (c) { return c.order; })) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  // Validator rejects a changed slug / swapped order / reassigned id.
  function bad(mutate) { const copy = JSON.parse(JSON.stringify(CATEGORIES)); mutate(copy); return !loaded.validate.validateCategories(copy).ok; }
  ok('T-contract: changed slug is rejected', bad(function (c) { c[0].slug = 'different-slug'; }));
  ok('T-contract: order=99 is rejected', bad(function (c) { c[0].order = 99; }));
  ok('T-contract: swapped orders are rejected', bad(function (c) { const t = c[0].order; c[0].order = c[1].order; c[1].order = t; }));
  ok('T-contract: changed id is rejected', bad(function (c) { c[0].id = 'renamed-id'; }));
})();

// Frozen closed vocabularies (deep-frozen in enums.js).
(function () {
  ok('T-enum: CATEGORY_CONTRACT is frozen', Object.isFrozen(E.CATEGORY_CONTRACT));
  ok('T-enum: CATEGORY_CONTRACT[0] is frozen', Object.isFrozen(E.CATEGORY_CONTRACT[0]));
  ok('T-enum: CATEGORY_IDS is derived from the contract', JSON.stringify(E.CATEGORY_IDS) === JSON.stringify(E.CATEGORY_CONTRACT.map(function (c) { return c.id; })));
  ['LOCALES', 'DIFFICULTIES', 'AUDIENCES', 'PROVENANCE_KINDS', 'RESULT_POLICIES', 'MODEL_TYPES', 'SENSES', 'STATUSES', 'CAPABILITY_IDS'].forEach(function (name) {
    ok('T-enum: ' + name + ' is frozen', Object.isFrozen(E[name]));
  });
  const before = E.CATEGORY_CONTRACT[0].slug;
  try { E.CATEGORY_CONTRACT[0].slug = 'evil'; } catch (e) {}
  ok('T-enum: CATEGORY_CONTRACT mutation is ignored (frozen)', E.CATEGORY_CONTRACT[0].slug === before);
})();

// deriveFacts detects the model exactly ONCE (detect-once architecture).
(function () {
  const H = require('./harness.js');
  const orig = H.Engine.detectModel_;
  let count = 0;
  H.Engine.detectModel_ = function () { count++; return orig.apply(this, arguments); };
  try {
    const { deriveFacts } = require(path.join(F5, 'derive.js'));
    count = 0;
    deriveFacts(CATALOGUE[0]);
    ok('T-detect: deriveFacts calls detectModel_ exactly once', count === 1, 'called ' + count + ' times');
  } finally { H.Engine.detectModel_ = orig; }
})();

// Status/policy contract vocabulary.
(function () {
  ok('T-status: RESULT_POLICIES includes status-only', E.RESULT_POLICIES.indexOf('status-only') !== -1);
  ok('T-status: RESULT_POLICIES is exactly [exact, objective-feasible, status-only]', E.RESULT_POLICIES.join(',') === 'exact,objective-feasible,status-only');
  ok('T-status: PUBLISHABLE_EXPECTED_STATUSES excludes unknown/incomplete', E.PUBLISHABLE_EXPECTED_STATUSES.indexOf('unknown') === -1 && E.PUBLISHABLE_EXPECTED_STATUSES.indexOf('incomplete') === -1);
  ok('T-status: PUBLISHABLE_EXPECTED_STATUSES is optimal/feasible/infeasible/unbounded', E.PUBLISHABLE_EXPECTED_STATUSES.slice().sort().join(',') === 'feasible,infeasible,optimal,unbounded');
  ok('T-status: solution-bearing + no-solution partition the publishable statuses', E.SOLUTION_BEARING_STATUSES.concat(E.NO_SOLUTION_STATUSES).slice().sort().join(',') === E.PUBLISHABLE_EXPECTED_STATUSES.slice().sort().join(','));
  ok('T-status: ENGINE_STATUSES is the full six', E.ENGINE_STATUSES.length === 6);
  // The nine all use objective-feasible (solution-bearing).
  ok('T-status: historical nine all use objective-feasible', canonical.slice(0, 9).every(function (c) { return c.resultPolicy === 'objective-feasible'; }));
  ok('T-status: every record has a valid result policy', canonical.every(function (c) { return c.resultPolicy === 'objective-feasible' || c.resultPolicy === 'exact'; }));
  ok('T-status: F7a: exactly 4 exact policies (bakery-mix, purchase-split, fertiliser-blend, lp-basics)', canonical.filter(function (c) { return c.resultPolicy === 'exact'; }).map(function (c) { return c.key; }).sort().join(',') === ['bakery-mix','purchase-split','fertiliser-blend','lp-basics'].sort().join(','));
})();

// Category membership authority is the frozen E.CATEGORY_IDS (no mutable second list).
(function () {
  const validateSrc = fs.readFileSync(path.join(F5, 'validate.js'), 'utf8');
  ok('T-catauth: primaryCategory membership derives from E.CATEGORY_IDS', /CATEGORY_ID_SET = E\.CATEGORY_IDS/.test(validateSrc));
  // A non-canonical category is rejected; every canonical id is accepted.
  E.CATEGORY_IDS.forEach(function (id) {
    ok('T-catauth: canonical category accepted: ' + id, (function () { const errs = []; loaded.validate.validateMetaRecord('x', Object.assign({}, byId.production ? {} : {}, { schemaVersion: 1, primaryCategory: id, difficulty: 'beginner', minutes: 1, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: [], capabilities: [], related: [], result: { policy: 'objective-feasible' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } }), null, errs); return !errs.some(function (e) { return /not a canonical category/.test(e); }); })());
  });
})();

// Constraint count derivation source: the engine detector's own constraint list
// (isCompleteConstraint), not a parallel comparator-row heuristic.
(function () {
  const H = require('./harness.js');
  const { deriveConstraintCount } = require(path.join(F5, 'derive.js'));
  CATALOGUE.forEach(function (rec) {
    const sheet = H.mkSheet(rec.model.grid);
    const model = H.Engine.detectModel_(sheet);
    const detectorCount = (model.constraints || []).filter(function (c) { return c.isCompleteConstraint; }).length;
    ok('T-constraint: ' + rec.key + ' constraintCount equals the detector count', deriveConstraintCount(rec) === detectorCount, deriveConstraintCount(rec) + ' vs ' + detectorCount);
  });
})();

// ---------------------------------------------------------------- LOCALES
ok('L1: exactly en/es/pt/de/fr', JSON.stringify(E.LOCALES) === JSON.stringify(['en', 'es', 'pt', 'de', 'fr']));
ok('L2: no Italian locale supported', E.LOCALES.indexOf('it') === -1);
canonical.forEach(function (c) {
  E.LOCALES.forEach(function (l) {
    ok('L: ' + c.key + '.content.question.' + l + ' present', c.content.question[l] && c.content.question[l].trim());
    ok('L: ' + c.key + '.content.goal.' + l + ' present', c.content.goal[l] && c.content.goal[l].trim());
  });
  // No HTML in localized content.
  E.LOCALES.forEach(function (l) {
    ok('L: ' + c.key + '.content.question.' + l + ' has no HTML', !/<[^>]+>/.test(c.content.question[l]));
  });
});
ok('L3: catalogue validates with expectCount 36', loaded.validate.validateMetadataCatalogue(CATALOGUE, require(path.join(F5, 'metadata.js')).METADATA, { expectCount: 36 }).ok);

// ---------------------------------------------------------------- AUTHORED vs DERIVED
const derive = require(path.join(F5, 'derive.js'));
canonical.forEach(function (c) {
  const facts = derive.deriveFacts(CATALOGUE.filter(function (r) { return r.key === c.key; })[0]);
  ok('D: ' + c.key + ' derived facts are deterministic', JSON.stringify(facts) === JSON.stringify(c.facts));
  ok('D: ' + c.key + ' modelType derived equals expected contract', c.facts.modelType === c.expected.modelType);
  ok('D: ' + c.key + ' direction derived equals sense', c.facts.objectiveDirection === c.sense);
  ok('D: ' + c.key + ' decisionCount is a positive integer', Number.isInteger(c.facts.decisionCount) && c.facts.decisionCount > 0);
  ok('D: ' + c.key + ' constraintCount is a non-negative integer', Number.isInteger(c.facts.constraintCount) && c.facts.constraintCount >= 0);
  // No manually-stored derived fact on the metadata record.
  const meta = require(path.join(F5, 'metadata.js')).METADATA[c.key];
  ok('D: ' + c.key + ' metadata does not re-store modelType', meta.modelType === undefined && meta.decisionCount === undefined && meta.constraintCount === undefined);
});

// ---------------------------------------------------------------- CAPABILITIES
canonical.forEach(function (c) {
  c.capabilities.forEach(function (cap) {
    ok('C: ' + c.key + ' capability "' + cap + '" is engine-supported', E.CAPABILITY_IDS.indexOf(cap) !== -1);
  });
  // No unsupported feature claims.
  ok('C: ' + c.key + ' does not claim COUNTIF/nonlinear', c.capabilities.indexOf('countif') === -1 && c.capabilities.indexOf('nonlinear') === -1);
});

// ---------------------------------------------------------------- CURRENT 9
ok('M1: live checkpoint count is exactly 36', canonical.length === 36);
ok('M2: all catalogue keys are migrated', CATALOGUE.every(function (r) { return !!byId[r.key]; }));
ok('M3: canonical order equals catalogue order (stable)', JSON.stringify(canonical.map(function (c) { return c.key; })) === JSON.stringify(CATALOGUE.map(function (r) { return r.key; })));
// Legacy model hashes preserved (independent baseline recomputed here).
(function () {
  function modelHash(rec) {
    const canonicalStr = JSON.stringify({ grid: rec.model.grid, domains: rec.model.domains || null, whole: !!rec.model.whole, openVarSettings: !!rec.model.openVarSettings, sense: rec.sense, expected: rec.expected });
    return crypto.createHash('sha256').update(canonicalStr).digest('hex');
  }
  baseline.examples.forEach(function (b) {
    const rec = CATALOGUE.filter(function (r) { return r.key === b.key; })[0];
    ok('M-hash: ' + b.key + ' legacy model hash preserved', rec && modelHash(rec) === b.modelHash);
  });
})();

// ---------------------------------------------------------------- PROJECTION
canonical.forEach(function (c) {
  const legacy = loaded.project.legacyMeta(c);
  ok('P: ' + c.key + ' legacy projection has stable shape', legacy.key === c.key && legacy.slug === c.slug && ['start', 'business', 'binary'].indexOf(legacy.category) !== -1);
  // Mutating a projected payload does not mutate the canonical source.
  const clone = loaded.project.clonePayload(c);
  clone.grid[0][0] = 'MUTATED';
  ok('P: ' + c.key + ' projected payload is a clone (canonical unchanged)', c.model.grid[0][0] !== 'MUTATED');
  ok('P: ' + c.key + ' canonical is frozen', Object.isFrozen(c));
});
// Legacy examples-data.js byte compatibility: every META row is reproduced.
(function () {
  const src = read(path.join(SITE, 'assets', 'examples-data.js'));
  canonical.forEach(function (c) {
    const lm = loaded.project.legacyMeta(c);
    const hasSlug = src.indexOf("slug: '" + lm.slug + "'") !== -1;
    const hasCat = src.indexOf("category: '" + lm.category + "'") !== -1;
    ok('P-legacy: examples-data has ' + c.key + ' slug+category', hasSlug && hasCat);
  });
})();

// ---------------------------------------------------------------- EXPECTED RESULT
canonical.forEach(function (c) {
  ok('R: ' + c.key + ' has a result policy', E.RESULT_POLICIES.indexOf(c.resultPolicy) !== -1);
  ok('R: ' + c.key + ' expected status is engine-valid', E.STATUSES.indexOf(c.expected.status) !== -1);
  ok('R: ' + c.key + ' expected objective is finite', typeof c.expected.objective === 'number' && isFinite(c.expected.objective));
});
// Tolerance policy centralised.
ok('R-tol: default tolerance is sane', E.DEFAULT_TOLERANCE >= E.MIN_TOLERANCE && E.DEFAULT_TOLERANCE <= E.MAX_TOLERANCE);
baseline.examples.forEach(function (b) {
  if (b.expected.tolerance != null) ok('R-tol: ' + b.key + ' override within [min,max]', b.expected.tolerance >= E.MIN_TOLERANCE && b.expected.tolerance <= E.MAX_TOLERANCE);
});

// ---------------------------------------------------------------- SEARCH / FACETS
canonical.forEach(function (c) {
  const doc = loaded.project.searchDocument(c, 'en');
  ok('SR: ' + c.key + ' search doc has id/title/category', doc.id === c.key && !!doc.title && !!doc.category);
  const facet = loaded.project.facetFacts(c);
  ok('SR: ' + c.key + ' facet facts have category+modelType+difficulty', !!facet.category && !!facet.modelType && !!facet.difficulty);
  ok('SR: ' + c.key + ' facet studentFriendly is boolean', typeof facet.studentFriendly === 'boolean');
});

// ---------------------------------------------------------------- RELATED
canonical.forEach(function (c) {
  c.related.forEach(function (r) {
    ok('RL: ' + c.key + ' related "' + r + '" exists', !!byId[r]);
    ok('RL: ' + c.key + ' related "' + r + '" is not self', r !== c.key);
  });
});

// ---------------------------------------------------------------- PROTECTION
(function () {
  // Independent EXACT-SET contract via the SHARED checker (same code the negative
  // suite runs). Pins counts + expected paths, verifies byte identity.
  const { checkProtectedSet, EXPECTED_COUNTS } = require('./f5_protected_check.js');
  const res = checkProtectedSet(SITE, protectedBaseline);
  ok('PR-set: protected exact-set contract holds (counts/paths/bytes)', res.ok, res.problems.slice(0, 4).join(' | '));
  Object.keys(EXPECTED_COUNTS).forEach(function (setName) {
    ok('PR-set: ' + setName + ' declares expected count ' + EXPECTED_COUNTS[setName], (protectedBaseline.expectedCounts || {})[setName] === EXPECTED_COUNTS[setName]);
  });
  // F4 stable reference docs and engine core canonical files are IN the protected set.
  const f4paths = protectedBaseline.expectedPaths.f4;
  ok('PR: F4 protects docs/design-system-components.md', f4paths.indexOf('docs/design-system-components.md') !== -1);
  ok('PR: F4 protects docs/motion-system.md', f4paths.indexOf('docs/motion-system.md') !== -1);
  const enginePaths = protectedBaseline.expectedPaths.engine_core;
  ok('PR: engine_core protects the canonical engine source', enginePaths.indexOf('engine/source/plumline-engine.js') !== -1);
  ok('PR: engine_core protects the engine mirror', enginePaths.indexOf('engine/engine.js') !== -1);
  ok('PR: assets/examples-data.js is in the protected set', protectedBaseline.expectedPaths.public.indexOf('assets/examples-data.js') !== -1);
})();

// ---------------------------------------------------------------- SOURCE PURITY
(function () {
  // loadCanonical clears the per-siteDir require cache and re-requires the source
  // modules, so ownership must be checked against the CURRENTLY-LIVE instances, not
  // the ones this suite required earlier (which would be stale). Re-require here.
  const liveCatalogue = require(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js')).CATALOGUE;
  const liveCategories = require(path.join(F5, 'categories.js')).CATEGORIES;
  const liveMeta = require(path.join(F5, 'metadata.js')).METADATA;
  const prod = liveCatalogue.filter(function (r) { return r.key === 'production'; })[0];

  ok('SP: canonical example is frozen', Object.isFrozen(byId.production));
  ok('SP: canonical catalogue array is frozen', Object.isFrozen(canonical));
  // The assembler is pure: freezing the canonical must not freeze the LIVE F1/F5 source.
  ok('SP: live F1 model is NOT frozen', !Object.isFrozen(prod.model));
  ok('SP: live F1 model.grid is NOT frozen', !Object.isFrozen(prod.model.grid));
  ok('SP: live F1 translations are NOT frozen', !Object.isFrozen(prod.translations));
  ok('SP: live F1 expected is NOT frozen', !Object.isFrozen(prod.expected));
  ok('SP: live F5 content is NOT frozen', !Object.isFrozen(liveMeta.production.content));
  ok('SP: live F5 provenance is NOT frozen', !Object.isFrozen(liveMeta.production.provenance));
  // Canonical does not alias the live F1 model/translation structures.
  ok('SP: canonical model is not the same object as live F1 model', byId.production.model !== prod.model);
  ok('SP: canonical translations are not the same object as live F1 translations', byId.production.translations !== prod.translations);
  // The exposed category registry is an owned frozen copy of the live source.
  ok('SP: loaded.categories is not the live categories array', loaded.categories !== liveCategories);
  ok('SP: loaded.categories is frozen', Object.isFrozen(loaded.categories));
  ok('SP: live categories source is NOT frozen', !Object.isFrozen(liveCategories));
  // Mutating a projected payload never changes canonical.
  ok('SP: mutating a projected payload never changes canonical', (function () {
    const c = byId.production; const clone = loaded.project.clonePayload(c); clone.grid[0][0] = 'ZZZ'; return c.model.grid[0][0] !== 'ZZZ';
  })());
})();

// ---------------------------------------------------------------- NUMBER FORMAT
(function () {
  // numberFormat is DERIVED honestly: 'us'/'eu' only on an unambiguous decimal
  // literal, else 'unknown'. Integer-only models are 'unknown', never inferred US.
  const facts = {}; canonical.forEach(function (c) { facts[c.key] = c.facts.numberFormat; });
  ok('NF: blend is us (has decimal dots)', facts.blend === 'us');
  ok('NF: marketing is us (has decimal dots)', facts.marketing === 'us');
  ok('NF: production is unknown (integer-only, not inferred US)', facts.production === 'unknown');
  ok('NF: workforce is unknown (integer-only)', facts.workforce === 'unknown');
  // Capability consistency: only blend/marketing may claim us-number-format.
  canonical.forEach(function (c) {
    if (c.capabilities.indexOf('us-number-format') !== -1) ok('NF: ' + c.key + ' claims us only when derived us', c.facts.numberFormat === 'us');
    if (c.capabilities.indexOf('eu-number-format') !== -1) ok('NF: ' + c.key + ' claims eu only when derived eu', c.facts.numberFormat === 'eu');
  });
})();

// ---------------------------------------------------------------- SEARCH (no silent fallback)
(function () {
  const c = byId.production;
  E.LOCALES.forEach(function (l) {
    const doc = loaded.project.searchDocument(c, l);
    ok('SEARCH: locale ' + l + ' returns that locale content', doc.locale === l && !!doc.question);
  });
  // Unsupported locale throws (no English silently labelled as another language).
  let threw = false; try { loaded.project.searchDocument(c, 'it'); } catch (e) { threw = /unsupported locale/.test(e.message); }
  ok('SEARCH: unsupported locale "it" throws (no silent fallback)', threw);
})();

// ---------------------------------------------------------------- RESULT POLICY (no drift)
(function () {
  // The canonical metadata owns resultPolicy; the baseline owns only maths values.
  // The baseline must NOT carry a policy field (single authority).
  ok('RP: baseline does not duplicate result policy', baseline.examples.every(function (b) { return b.expected.policy === undefined; }));
  canonical.forEach(function (c) {
    ok('RP: ' + c.key + ' resultPolicy is a valid policy', E.RESULT_POLICIES.indexOf(c.resultPolicy) !== -1);
    // objective-feasible examples carry no decision vector.
    if (c.resultPolicy === 'objective-feasible') ok('RP: ' + c.key + ' objective-feasible has no decision vector', c.resultDecisions === null);
  });
})();


// ------------------------------------------------- IDENTITY GRAMMAR + HYGIENE
// The F1 schema owns strict slug grammar and localized title/desc content hygiene.
// These are enforced generically (any record), not only via the public-slug baseline.
(function () {
  const schema = require(path.join(SITE, 'src', 'shared', 'examples', 'schema.js'));
  const langs = { en: { title: 'T', desc: 'd' }, es: { title: 'T', desc: 'd' }, pt: { title: 'T', desc: 'd' }, de: { title: 'T', desc: 'd' }, fr: { title: 'T', desc: 'd' } };
  function futureRec(over) {
    const base = { key: 'fut', slug: 'example-10', category: 'start', type: 'continuous', sense: 'max', translations: JSON.parse(JSON.stringify(langs)), model: { grid: [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Tot', '', '', '=SUM(D2:D2)', '', ''], ['Cap', '', '', '=B2', '<=', '5']] }, expected: { status: 'optimal', modelType: 'continuous', objective: 5 } };
    return Object.assign(base, over || {});
  }
  function passes(rec) { return schema.validateCatalogue([rec], {}).ok; }
  function failsWith(rec, needle) { const r = schema.validateCatalogue([rec], {}); return !r.ok && r.errors.some(function (e) { return e.indexOf(needle) !== -1; }); }

  // Valid future slugs pass.
  ['production-plan', 'example-10', 'abc'].forEach(function (s) {
    ok('GR: valid future slug passes: ' + s, passes(futureRec({ slug: s })), s);
  });
  // Bad slug grammars fail with the grammar reason.
  ['Bad Slug', 'Bad-slug', 'bad_slug', '-bad', 'bad-', 'bad--slug'].forEach(function (s) {
    ok('GR: bad future slug fails grammar: ' + s, failsWith(futureRec({ slug: s }), 'kebab-case'), s);
  });
  // Machine-id `key` grammar: the same strict kebab-case, a SEPARATE field from slug.
  ['production', 'example-10', 'workforce-schedule', 'abc123'].forEach(function (k) {
    ok('KEY: valid future key passes: ' + k, passes(futureRec({ key: k })), k);
  });
  ['Bad Key', 'Bad-key', 'bad_key', '-bad', 'bad-', 'bad--key', 'bad key'].forEach(function (k) {
    ok('KEY: bad future key fails grammar: ' + k, failsWith(futureRec({ key: k }), 'machine ID'), k);
  });
  // Title/desc content hygiene on a future record.
  ok('HY: HTML title fails', failsWith(futureRec({ translations: Object.assign(JSON.parse(JSON.stringify(langs)), { en: { title: '<b>x</b>', desc: 'd' } }) }), 'plain text'));
  ok('HY: untrimmed desc fails', failsWith(futureRec({ translations: Object.assign(JSON.parse(JSON.stringify(langs)), { en: { title: 'x', desc: ' d ' } }) }), 'must be trimmed'));
  ok('HY: TODO placeholder fails', failsWith(futureRec({ translations: Object.assign(JSON.parse(JSON.stringify(langs)), { en: { title: 'TODO', desc: 'd' } }) }), 'placeholder'));
  ok('HY: raw field-name title fails', failsWith(futureRec({ translations: Object.assign(JSON.parse(JSON.stringify(langs)), { en: { title: 'title', desc: 'd' } }) }), 'raw field name'));
  ok('HY: valid technical title passes', passes(futureRec({ translations: Object.assign(JSON.parse(JSON.stringify(langs)), { en: { title: 'Maximise profit (MILP)', desc: 'A short clean description.' } }) })));

  // The nine current records satisfy grammar + hygiene unchanged.
  const liveCat = require(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js')).CATALOGUE;
  ok('GR/HY: all current records pass grammar + hygiene', schema.validateCatalogue(liveCat).ok);
})();

// ------------------------------------------------- STRICT TAG GRAMMAR
// F5 metadata tags use the SAME strict kebab-case grammar. Current tags all pass.
(function () {
  const RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  ['foo', 'foo-bar', 'foo-2'].forEach(function (t) { ok('TG: valid tag passes: ' + t, RE.test(t)); });
  ['-foo', 'foo-', 'foo--bar', 'foo_bar'].forEach(function (t) { ok('TG: invalid tag fails: ' + t, !RE.test(t)); });
  const META = require(path.join(F5, 'metadata.js')).METADATA;
  let allTagsOk = true;
  Object.keys(META).forEach(function (k) { (META[k].tags || []).forEach(function (t) { if (!RE.test(t)) allTagsOk = false; }); });
  ok('TG: every current tag is strict kebab-case', allTagsOk);
  // The validator source enforces the strict grammar (not the lax [a-z0-9-]+).
  const vsrc = read(path.join(F5, 'validate.js'));
  ok('TG: validate.js uses the strict tag grammar', /\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$/.test(vsrc) && vsrc.indexOf("/^[a-z0-9-]+$/.test(t)") === -1);
})();

// ------------------------------------------------- TOLERANCE POLICY (generic flow)
// The F5 layer enforces the MIN/MAX tolerance band on the generic authoring flow
// (schema structure + validateMetaRecord policy). A future solution-bearing record's
// EFFECTIVE tolerance (authored, or DEFAULT when absent) must lie in [MIN, MAX].
(function () {
  const schema = require(path.join(SITE, 'src', 'shared', 'examples', 'schema.js'));
  const V = require(path.join(F5, 'validate.js'));
  const E = require(path.join(F5, 'enums.js'));
  const langs = { en: { title: 'T', desc: 'd' }, es: { title: 'T', desc: 'd' }, pt: { title: 'T', desc: 'd' }, de: { title: 'T', desc: 'd' }, fr: { title: 'T', desc: 'd' } };
  function rec(tol, status) {
    const e = { status: status || 'optimal', modelType: 'continuous', objective: 5 };
    if (tol !== undefined) e.tolerance = tol;
    if (status === 'infeasible' || status === 'unbounded') e.objective = null;
    return { key: 'fut', slug: 'future-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Tot', '', '', '=SUM(D2:D2)', '', ''], ['Cap', '', '', '=B2', '<=', '5']] }, expected: e };
  }
  function meta(policy) { return { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: ['maximise'], related: [], result: { policy: policy || 'objective-feasible' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } }; }
  // Full generic validation = F1 schema record + F5 metadata policy.
  function genericOk(r, policy) {
    if (!schema.validateCatalogue([r], {}).ok) return false;
    const errs = []; V.validateMetaRecord(r.key, meta(policy), r, errs); return errs.length === 0;
  }
  function genericFailsWith(r, needle, policy) {
    const errs = []; V.validateMetaRecord(r.key, meta(policy), r, errs);
    const schemaErrs = schema.validateCatalogue([r], {}).errors || [];
    return errs.concat(schemaErrs).some(function (e) { return e.indexOf(needle) !== -1; });
  }
  ok('TOL: absent tolerance uses default (passes)', genericOk(rec(undefined)));
  ok('TOL: DEFAULT passes', genericOk(rec(E.DEFAULT_TOLERANCE)));
  ok('TOL: MIN passes', genericOk(rec(E.MIN_TOLERANCE)));
  ok('TOL: MAX passes', genericOk(rec(E.MAX_TOLERANCE)));
  ok('TOL: just below MIN fails', genericFailsWith(rec(E.MIN_TOLERANCE / 2), 'below MIN_TOLERANCE'));
  ok('TOL: just above MAX fails', genericFailsWith(rec(E.MAX_TOLERANCE * 2), 'exceeds MAX_TOLERANCE'));
  ok('TOL: 5 fails (above MAX)', genericFailsWith(rec(5), 'exceeds MAX_TOLERANCE'));
  ok('TOL: 1e-20 fails (below MIN)', genericFailsWith(rec(1e-20), 'below MIN_TOLERANCE'));
  ok('TOL: tolerance <= 0 fails at F1', genericFailsWith(rec(0), 'finite and positive'));
  ok('TOL: NaN fails at F1', genericFailsWith(rec(NaN), 'finite and positive'));
  ok('TOL: infeasible + tolerance fails at F1', genericFailsWith(rec(1e-6, 'infeasible'), 'must not carry a tolerance', 'status-only'));
  ok('TOL: unbounded + tolerance fails at F1', genericFailsWith(rec(1e-6, 'unbounded'), 'must not carry a tolerance', 'status-only'));
  // Current blend keeps its authored 1e-8 tolerance and stays valid.
  const liveCat = require(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js')).CATALOGUE;
  const blend = liveCat.find(function (r) { return r.key === 'blend'; });
  ok('TOL: current blend authored tolerance is 1e-8', blend && blend.expected.tolerance === 1e-8, blend && String(blend.expected.tolerance));
  ok('TOL: all current records pass tolerance policy', schema.validateCatalogue(liveCat).ok);
})();

// ---------------------------------------------------------------- ROADMAP
(function () {
  const doc = read(path.join(SITE, 'docs', 'checkpoint-f5-examples-architecture.md'));
  ok('RM1: F5 builds the architecture (not the gallery)', /architecture/i.test(doc) && /F6[^.]*librar/i.test(doc));
  ok('RM2: F6 owns the new library UI', /F6/.test(doc) && /librar/i.test(doc));
  ok('RM3: F7 owns 60 examples', /F7/.test(doc) && /60/.test(doc));
  ok('RM4: F8 remains Solver personalisation/UX', /F8[^.]*Solver|Solver[^.]*F8/i.test(doc));
  ok('RM5: Home remains F9', /F9/.test(doc) && /Home/i.test(doc));
  ok('RM6: remaining public pages remain F10', /F10/.test(doc));
  ok('RM7: SEO implementation remains F11', /F11/.test(doc) && /SEO/i.test(doc));
  ok('RM8: F5 does NOT build the gallery', /not[^.]*gallery|gallery[^.]*F6/i.test(doc));
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F5 EXAMPLES ARCHITECTURE  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail };
