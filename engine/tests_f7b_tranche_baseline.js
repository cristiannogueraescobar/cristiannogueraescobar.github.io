/* tests_f7b_tranche_baseline.js — F7b TRANCHE BASELINE (permanent, per-record).
 *
 * Guards the 12 F7b records INDIVIDUALLY: model hash, slug, model type, direction, result policy,
 * fieldOrder, objective/status, taxonomic category, difficulty, minutes, tags, and SHA-256 digests
 * of translations, metadata content and the complete authored metadata record — each pinned per
 * record in engine/fixtures/f7b-tranche/f7b-tranche-baseline.json, plus the required localisation
 * surface (all 4 non-English locales present for title/desc/question/goal, distinct from English).
 *
 * This is deliberately NOT a whole-catalogue hash and pins no total count: F7c/F7d can append
 * records (37+) without touching this fixture, and F7b must not re-pin the F7a tranche. If an F7b
 * record's model, slug, type, direction, policy, fieldOrder, objective, metadata or localisation
 * drifts, exactly that record's contract fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));
const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));
const tranche = require(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-tranche-baseline.json'));
const META = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'metadata.js')).METADATA;
const ENUMS = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'enums.js'));
const LOCPLAN = require(path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-localisation-plan.json'));

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

function modelHash(rec) {
  const s = JSON.stringify({ grid: rec.model.grid, domains: rec.model.domains || null, whole: !!rec.model.whole, openVarSettings: !!rec.model.openVarSettings, sense: rec.sense, expected: rec.expected });
  return crypto.createHash('sha256').update(s).digest('hex');
}
function sha(v) { return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = canon(v[k]); }); return o; }
  return v;
}
function metaSha(rec) { return crypto.createHash('sha256').update(JSON.stringify(canon(rec))).digest('hex'); }
function fieldOrderOf(src, key, keys, i) {
  const s = src.indexOf('"key": "' + key + '"');
  const e = i + 1 < keys.length ? src.indexOf('"key": "' + keys[i + 1] + '"') : src.length;
  const m = src.slice(s, e).match(/"fieldOrder":\s*\[([^\]]*)\]/);
  return m ? m[1].split(',').map(function (x) { return x.trim().replace(/"/g, ''); }).filter(Boolean) : null;
}

const { catalogue } = loadAndValidateCatalogue(SITE);
const { canonical } = loadCanonical(SITE);
const canonByKey = {}; canonical.forEach(function (c) { canonByKey[c.key] = c; });
const catByKey = {}; catalogue.forEach(function (r) { catByKey[r.key] = r; });
const catKeys = catalogue.map(function (r) { return r.key; });
const src = fs.readFileSync(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js'), 'utf8');
const NON_EN = ENUMS.LOCALES.filter(function (l) { return l !== 'en'; });

ok('TRANCHE: fixture covers exactly the 12 F7b records', tranche.records.length === 12, String(tranche.records.length));
ok('TRANCHE: fixture declares membership count 12', tranche.membershipCount === 12, String(tranche.membershipCount));
ok('TRANCHE: fixture is not a whole-catalogue pin (no total/length field)', tranche.total === undefined && tranche.catalogueLength === undefined);

tranche.records.forEach(function (b) {
  var rec = catByKey[b.key];
  var c = canonByKey[b.key];
  ok('TRANCHE: ' + b.key + ' present in catalogue', !!rec);
  if (!rec) return;
  ok('TRANCHE: ' + b.key + ' slug matches', rec.slug === b.slug, rec.slug);
  ok('TRANCHE: ' + b.key + ' model type matches', rec.expected.modelType === b.modelType, rec.expected.modelType);
  ok('TRANCHE: ' + b.key + ' result policy matches', c && c.resultPolicy === b.resultPolicy, c ? c.resultPolicy : 'no canonical');
  ok('TRANCHE: ' + b.key + ' objective matches', Math.abs(rec.expected.objective - b.objective) < 1e-9, String(rec.expected.objective));
  ok('TRANCHE: ' + b.key + ' status matches', rec.expected.status === b.status, rec.expected.status);
  ok('TRANCHE: ' + b.key + ' model hash matches', modelHash(rec) === b.modelHash);
  var idx = catKeys.indexOf(b.key);
  var fo = fieldOrderOf(src, b.key, catKeys, idx);
  ok('TRANCHE: ' + b.key + ' fieldOrder matches', JSON.stringify(fo) === JSON.stringify(b.fieldOrder), JSON.stringify(fo));

  var m = META[b.key];
  ok('TRANCHE: ' + b.key + ' category matches', m && m.primaryCategory === b.category, m ? m.primaryCategory : 'no meta');
  ok('TRANCHE: ' + b.key + ' difficulty matches', m && m.difficulty === b.difficulty, m ? m.difficulty : 'no meta');
  ok('TRANCHE: ' + b.key + ' minutes matches', m && m.minutes === b.minutes, m ? String(m.minutes) : 'no meta');
  ok('TRANCHE: ' + b.key + ' tags match (order-sensitive)', m && JSON.stringify(m.tags) === JSON.stringify(b.tags), m ? JSON.stringify(m.tags) : 'no meta');
  ok('TRANCHE: ' + b.key + ' direction (sense) matches', rec.sense === b.direction, rec.sense);
  ok('TRANCHE: ' + b.key + ' translations SHA-256 matches', sha(rec.translations) === b.translationsSha256);
  ok('TRANCHE: ' + b.key + ' content SHA-256 matches', m && sha(m.content) === b.contentSha256);
  ok('TRANCHE: ' + b.key + ' metadata SHA-256 (complete authored record) matches', m && metaSha(m) === b.metadataSha256, m ? metaSha(m).slice(0, 16) : 'no meta');
  if (b.exactDecisions) {
    ok('TRANCHE: ' + b.key + ' (exact) resultDecisions match', c && JSON.stringify(c.resultDecisions) === JSON.stringify(b.exactDecisions), c ? JSON.stringify(c.resultDecisions) : 'no canonical');
  } else {
    ok('TRANCHE: ' + b.key + ' has no exactDecisions (non-exact policy)', b.resultPolicy !== 'exact');
  }

  // ---- required localisation surface: 4 non-English locales, 4 fields, distinct from English ----
  var plan = LOCPLAN.examples[b.key];
  ok('TRANCHE: ' + b.key + ' has an approved localisation plan entry', !!plan);
  if (plan) {
    ['title', 'desc', 'question', 'goal'].forEach(function (field) {
      NON_EN.forEach(function (loc) {
        var v = plan[field][loc];
        ok('TRANCHE: ' + b.key + ' localisation ' + field + '/' + loc + ' present & non-empty', !!v && v.trim().length > 0);
        ok('TRANCHE: ' + b.key + ' localisation ' + field + '/' + loc + ' distinct from English', v !== plan[field].en);
      });
    });
  }
});

console.log('F7B TRANCHE BASELINE  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
