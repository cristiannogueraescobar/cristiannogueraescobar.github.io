/* tests_f7a_tranche_baseline.js — F7a TRANCHE BASELINE (permanent, per-record).
 *
 * Guards the 15 F7a records INDIVIDUALLY: model hash, slug, model type, result policy, fieldOrder,
 * and objective, each pinned per record in engine/fixtures/f7a-tranche/f7a-tranche-baseline.json.
 * This is deliberately NOT a whole-catalogue hash: F7b/F7c can append records without touching this
 * fixture, and F7b must not re-pin the F7a tranche. If an F7a record's model, slug, type, policy,
 * fieldOrder or objective drifts, exactly that record's contract fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = path.join(__dirname, '..');
const { loadAndValidateCatalogue } = require(path.join(SITE, 'src', 'shared', 'examples', 'index.js'));
const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));
const tranche = require(path.join(SITE, 'engine', 'fixtures', 'f7a-tranche', 'f7a-tranche-baseline.json'));
const META = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'metadata.js')).METADATA;

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

function modelHash(rec) {
  const s = JSON.stringify({ grid: rec.model.grid, domains: rec.model.domains || null, whole: !!rec.model.whole, openVarSettings: !!rec.model.openVarSettings, sense: rec.sense, expected: rec.expected });
  return crypto.createHash('sha256').update(s).digest('hex');
}
function sha(v) { return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
// Deterministic canonicaliser: recursively sort object keys so metadataSha256 is stable
// regardless of authored key order. Freezes the COMPLETE authored metadata record
// (schemaVersion, primaryCategory, difficulty, minutes, audiences, provenance, tags,
// capabilities, related, result, content).
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

ok('TRANCHE: fixture covers the 15 F7a records', tranche.records.length === 15, String(tranche.records.length));
ok('TRANCHE: fixture is not a whole-catalogue pin (no total field)', tranche.total === undefined && tranche.catalogueLength === undefined);

tranche.records.forEach(function (b) {
  var rec = catByKey[b.key];
  var c = canonByKey[b.key];
  ok('TRANCHE: ' + b.key + ' present in catalogue', !!rec);
  if (!rec) return;
  ok('TRANCHE: ' + b.key + ' slug matches', rec.slug === b.slug, rec.slug);
  ok('TRANCHE: ' + b.key + ' model type matches', rec.expected.modelType === b.modelType, rec.expected.modelType);
  ok('TRANCHE: ' + b.key + ' result policy matches', c && c.resultPolicy === b.resultPolicy, c ? c.resultPolicy : 'no canonical');
  ok('TRANCHE: ' + b.key + ' objective matches', Math.abs(rec.expected.objective - b.objective) < 1e-9, String(rec.expected.objective));
  ok('TRANCHE: ' + b.key + ' model hash matches', modelHash(rec) === b.modelHash);
  var idx = catKeys.indexOf(b.key);
  var fo = fieldOrderOf(src, b.key, catKeys, idx);
  ok('TRANCHE: ' + b.key + ' fieldOrder matches', JSON.stringify(fo) === JSON.stringify(b.fieldOrder), JSON.stringify(fo));

  // ---- expanded frozen fields (schemaVersion 2) ----
  var m = META[b.key];
  ok('TRANCHE: ' + b.key + ' category matches', m && m.primaryCategory === b.category, m ? m.primaryCategory : 'no meta');
  ok('TRANCHE: ' + b.key + ' difficulty matches', m && m.difficulty === b.difficulty, m ? m.difficulty : 'no meta');
  ok('TRANCHE: ' + b.key + ' minutes matches', m && m.minutes === b.minutes, m ? String(m.minutes) : 'no meta');
  ok('TRANCHE: ' + b.key + ' tags match (order-sensitive)', m && JSON.stringify(m.tags) === JSON.stringify(b.tags), m ? JSON.stringify(m.tags) : 'no meta');
  ok('TRANCHE: ' + b.key + ' direction (sense) matches', rec.sense === b.direction, rec.sense);
  ok('TRANCHE: ' + b.key + ' status matches', rec.expected.status === b.status, rec.expected.status);
  ok('TRANCHE: ' + b.key + ' translations SHA-256 matches', sha(rec.translations) === b.translationsSha256);
  ok('TRANCHE: ' + b.key + ' content SHA-256 matches', m && sha(m.content) === b.contentSha256);
  // Complete authored-metadata freeze: covers schemaVersion, audiences, provenance,
  // capabilities, related and every other authored field not individually pinned above.
  ok('TRANCHE: ' + b.key + ' metadata SHA-256 (complete authored record) matches', m && metaSha(m) === b.metadataSha256, m ? metaSha(m).slice(0, 16) : 'no meta');
  if (b.exactDecisions) {
    ok('TRANCHE: ' + b.key + ' (exact) resultDecisions match', c && JSON.stringify(c.resultDecisions) === JSON.stringify(b.exactDecisions), c ? JSON.stringify(c.resultDecisions) : 'no canonical');
  } else {
    ok('TRANCHE: ' + b.key + ' has no exactDecisions (non-exact policy)', b.resultPolicy !== 'exact');
  }
});

console.log('F7A TRANCHE BASELINE  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
