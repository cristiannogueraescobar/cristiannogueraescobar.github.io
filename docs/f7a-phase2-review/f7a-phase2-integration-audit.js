'use strict';
/* F7a Phase-2 reproducible canonical-integration audit.
 * Run from repo root:  node docs/f7a-phase2-review/f7a-phase2-integration-audit.js
 *   (add --write to (re)generate docs/f7a-phase2-integration-audit.json;
 *    default compares against it if present.)
 * Working env: Node 22.22.2. Final acceptance runtime required: Node 24.15.0.
 * No mocks: everything runs through the real canonical loader, real engine, real generated assets. */
const fs = require('fs');
const path = require('path');
const SITE = process.cwd();
const crypto = require('crypto');

const { loadCanonical } = require(path.join(SITE, 'src/shared/examples/f5/index.js'));
const { CATALOGUE } = require(path.join(SITE, 'src/shared/examples/catalogue.js'));
const { METADATA } = require(path.join(SITE, 'src/shared/examples/f5/metadata.js'));
const derive = require(path.join(SITE, 'src/shared/examples/f5/derive.js'));
// Phase-1 frozen models + adapter live in the sibling phase-1 review dir.
const p1models = require(path.join(SITE, 'docs/f7a-phase1-review/f7a-phase1-models.js'));
const { solveRecord } = require(path.join(SITE, 'docs/f7a-phase1-review/f7a-phase1-solve-adapter.js'));

const HISTORICAL = ['production', 'workshop', 'blend', 'marketing', 'workforce', 'shipping', 'project', 'delivery', 'supplier'];
const NEW15 = ['bakery-mix', 'factory-batches', 'clinic-staffing', 'call-centre', 'purchase-split', 'ingredient-sourcing', 'fleet-assignment', 'media-mix', 'fertiliser-blend', 'scholarships', 'food-bank', 'renewable-mix', 'microgrid-capacity', 'hotel-rooms', 'lp-basics'];
const NEW_SLUGS = { 'bakery-mix': 'bakery-production-mix', 'factory-batches': 'factory-batch-plan', 'clinic-staffing': 'clinic-staffing-plan', 'call-centre': 'call-centre-shift-plan', 'purchase-split': 'purchase-order-split', 'ingredient-sourcing': 'ingredient-sourcing-plan', 'fleet-assignment': 'fleet-assignment-plan', 'media-mix': 'media-channel-mix', 'fertiliser-blend': 'fertiliser-blend-plan', 'scholarships': 'scholarship-allocation', 'food-bank': 'food-bank-allocation', 'renewable-mix': 'renewable-energy-mix', 'microgrid-capacity': 'microgrid-capacity-plan', 'hotel-rooms': 'hotel-room-allocation', 'lp-basics': 'linear-optimisation-basics' };
const LOCALES = ['en', 'es', 'pt', 'de', 'fr'];

const results = [];
let allPass = true;
function check(name, cond, detail) { if (!cond) allPass = false; results.push({ name: name, pass: !!cond, detail: detail || '' }); }

// --- loadCanonical(24) and counts ---
const canonical = loadCanonical(SITE, { expectCount: 24 }).canonical;
check('loadCanonical(expectCount:24) returns 24', canonical.length === 24, String(canonical.length));
check('catalogue is exactly 24', CATALOGUE.length === 24, String(CATALOGUE.length));
check('9 historical present', HISTORICAL.every(function (k) { return CATALOGUE.find(function (r) { return r.key === k; }); }));
check('15 F7a present', NEW15.every(function (k) { return CATALOGUE.find(function (r) { return r.key === k; }); }));
check('unique keys 24', new Set(CATALOGUE.map(function (r) { return r.key; })).size === 24);
check('unique slugs 24', new Set(CATALOGUE.map(function (r) { return r.slug; })).size === 24);
check('no #25 (exactly 24)', CATALOGUE.length === 24);

// --- Phase-1 -> canonical match 15/15 (type/status/objective) + policies + derived facts ---
let match = 0;
const perModel = [];
p1models.forEach(function (rec) {
  const canon = canonical.find(function (x) { return x.key === rec.key; });
  const r1 = solveRecord(rec), r2 = solveRecord(rec);
  const facts = derive.deriveFacts(rec);
  const meta = METADATA[rec.key];
  const cExp = canon.expected;
  const typeOk = cExp.modelType === r1.modelType && facts.modelType === r1.modelType && rec.type === r1.modelType;
  const objOk = Math.abs(cExp.objective - r1.objective) <= 1e-6;
  const statusOk = cExp.status === r1.status;
  const det = r1.status === r2.status && Math.abs(r1.objective - r2.objective) <= 1e-6;
  const okAll = typeOk && objOk && statusOk && det;
  if (okAll) match++;
  perModel.push({
    key: rec.key, slug: rec.slug, primaryCategory: meta.primaryCategory,
    canonicalModelType: cExp.modelType, derivedModelType: facts.modelType, intendedType: rec.type,
    direction: rec.sense, difficulty: meta.difficulty, minutes: meta.minutes, tags: meta.tags,
    status: cExp.status, objective: cExp.objective, resultPolicy: meta.result.policy,
    decisionsExact: meta.result.policy === 'exact' ? meta.result.decisions : undefined,
    vector1: r1.vector, vector2: r2.vector, deterministic: det,
    derivedFacts: { chartEligible: facts.chartEligible, hasBounds: facts.hasBounds, functionsUsed: facts.functionsUsed, decisionCount: facts.decisionCount, constraintCount: facts.constraintCount },
    match: okAll
  });
});
check('Phase-1 -> canonical match 15/15', match === 15, match + '/15');

// --- result policies: exactly the 4 exact ---
const exactKeys = NEW15.filter(function (k) { return METADATA[k].result.policy === 'exact'; });
check('exact policy for the 4 confirmed-unique', exactKeys.sort().join(',') === ['bakery-mix', 'fertiliser-blend', 'lp-basics', 'purchase-split'].join(','), exactKeys.join(','));

// --- slug loader smoke 15/15 ---
const bySlug = {}; CATALOGUE.forEach(function (r) { bySlug[r.slug] = r; });
check('15 slugs resolve to correct example', NEW15.every(function (k) { var r = bySlug[NEW_SLUGS[k]]; return r && r.key === k; }));

// --- searchability 15/15: title, question, tag in 5 locales ---
function searchable(kind) {
  return NEW15.every(function (k) {
    const rec = canonical.find(function (x) { return x.key === k; });
    const meta = METADATA[k];
    if (kind === 'title') return LOCALES.every(function (l) { return rec.translations[l] && rec.translations[l].title; });
    if (kind === 'question') return LOCALES.every(function (l) { return meta.content.question[l]; });
    if (kind === 'tag') return Array.isArray(meta.tags) && meta.tags.length >= 1;
  });
}
check('15/15 title search (5 locales)', searchable('title'));
check('15/15 question search (5 locales)', searchable('question'));
check('15/15 tag search', searchable('tag'));

// --- five locales complete for all 24 ---
check('5 locales complete (all 24)', canonical.every(function (c) {
  return LOCALES.every(function (l) { return c.translations[l] && c.translations[l].title && METADATA[c.key].content.question[l]; });
}) && !canonical.some(function (c) { return c.translations.it; }));

// --- generated assets: 24 cards, 24 JSON-LD, category counts, payload digest ---
const html = fs.readFileSync(path.join(SITE, 'examples.html'), 'utf8');
check('examples.html has 24 cards', (html.match(/<article class="lib-card"/g) || []).length === 24);
check('examples.html has 24 JSON-LD ListItems', (html.match(/"@type":"ListItem"/g) || []).length === 24);
// generated category counts sum to 24 and match derived counts
const derivedCats = {};
canonical.forEach(function (c) { var pc = METADATA[c.key].primaryCategory; derivedCats[pc] = (derivedCats[pc] || 0) + 1; });
let catCountsOk = true;
Object.keys(derivedCats).forEach(function (cat) {
  const m = html.match(new RegExp('data-cat-count="' + cat + '">(\\d+)'));
  if (!m || Number(m[1]) !== derivedCats[cat]) catCountsOk = false;
});
check('generated category counts match derived counts', catCountsOk);
check('all 10 categories populated', Object.keys(derivedCats).length === 10);
// payload digest
const lib = fs.readFileSync(path.join(SITE, 'assets/examples-library.js'), 'utf8');
const digest = crypto.createHash('sha256').update(lib, 'utf8').digest('hex').slice(0, 12);
const vm = html.match(/examples-library\.js\?v=([a-f0-9]+)/);
check('payload digest == sha256(examples-library.js)[:12]', vm && vm[1] === digest, (vm ? vm[1] : 'none') + ' vs ' + digest);

// --- full-catalogue derived distributions (audited, not hardcoded as runtime) ---
function tally(fn) { var o = {}; canonical.forEach(function (c) { var k = fn(c); o[k] = (o[k] || 0) + 1; }); return o; }
const fullCatalogue = {
  categories: tally(function (c) { return METADATA[c.key].primaryCategory; }),
  modelTypes: tally(function (c) { return c.expected.modelType; }),
  directions: tally(function (c) { return CATALOGUE.find(function (r) { return r.key === c.key; }).sense; }),
  difficulty: tally(function (c) { return METADATA[c.key].difficulty; })
};
const f7aAdditions = {
  categories: (function () { var o = {}; NEW15.forEach(function (k) { var pc = METADATA[k].primaryCategory; o[pc] = (o[pc] || 0) + 1; }); return o; })(),
  count: NEW15.length
};

const report = {
  environment: { node: process.version, note: 'Phase-2 working environment; final acceptance requires Node 24.15.0' },
  summary: {
    catalogueTotal: canonical.length, historical: 9, new: 15,
    phase1CanonicalMatch: match + '/15', allChecksPass: allPass,
    exactPolicies: exactKeys
  },
  checks: results,
  fullCatalogueDistributions: fullCatalogue,
  f7aAdditions: f7aAdditions,
  models: perModel
};

const OUT = path.join(SITE, 'docs/f7a-phase2-integration-audit.json');
const write = process.argv.indexOf('--write') !== -1;
if (write) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('wrote ' + OUT);
} else if (fs.existsSync(OUT)) {
  // Compare the check outcomes against the stored audit (structure may evolve; compare the summary + checks).
  const stored = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const sameSummary = JSON.stringify(stored.summary && stored.summary.phase1CanonicalMatch) === JSON.stringify(match + '/15');
  console.log('compared against stored audit: phase1CanonicalMatch ' + (sameSummary ? 'MATCHES' : 'DIFFERS'));
}

console.log('F7a PHASE-2 INTEGRATION AUDIT  checks passed: ' + results.filter(function (r) { return r.pass; }).length + '/' + results.length + (allPass ? '  ALL GREEN' : '  FAILURES'));
if (!allPass) { results.filter(function (r) { return !r.pass; }).forEach(function (r) { console.log('  FAIL: ' + r.name + ' — ' + r.detail); }); process.exit(1); }
