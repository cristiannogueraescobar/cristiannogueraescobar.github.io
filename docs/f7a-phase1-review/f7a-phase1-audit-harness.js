'use strict';
/* F7a Phase-1 reproducible audit harness (external-audit corrections).
 * Run from repo root:  node docs/f7a-phase1-review/f7a-phase1-audit-harness.js
 * Working environment: Node 22.22.2. Final acceptance runtime required: Node 24.15.0.
 * Real pipeline, no mocks. Independent verifier recomputes constraints + objective from the vector.
 * Chart eligibility uses the real F5 deriveChartEligible. */
const fs = require('fs');
const path = require('path');
const { solveRecord } = require('./f7a-phase1-solve-adapter.js');
const { verifySolution } = require('./f7a-phase1-verify.js');
const derive = require(path.join(__dirname, '..', '..', 'src', 'shared', 'examples', 'f5', 'derive.js'));
const models = require('./f7a-phase1-models.js');

const reservedType = {
  'bakery-mix':'continuous','factory-batches':'integer','clinic-staffing':'integer','call-centre':'integer',
  'purchase-split':'continuous','ingredient-sourcing':'mixed','fleet-assignment':'binary','media-mix':'continuous',
  'fertiliser-blend':'continuous','scholarships':'integer','food-bank':'integer','renewable-mix':'continuous',
  'microgrid-capacity':'continuous','hotel-rooms':'integer','lp-basics':'continuous'
};

function strictSameVector(a, b) {
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return false;
  for (const k of ka) { if (!Number.isFinite(a[k]) || !Number.isFinite(b[k])) return false; if (Math.abs(a[k] - b[k]) > 1e-6) return false; }
  return true;
}
function clone(rec) { return JSON.parse(JSON.stringify(rec)); }
function withoutRow(rec, prefix) { const c = clone(rec); c.model.grid = c.model.grid.filter(function (r) { return String(r[0]).indexOf(prefix) !== 0; }); return c; }
function vstr(v) { return Object.entries(v).map(function (e) { return e[0] + '=' + Math.round(e[1] * 1000) / 1000; }).join(', '); }

const out = [];
let allOptimal = true, allTypeMatch = true, allDeterministic = true, allVerified = true;
models.forEach(function (rec) {
  const r1 = solveRecord(rec), r2 = solveRecord(rec);
  const typeOk = (r1.modelType === rec.type) && (rec.type === reservedType[rec.key]);
  const optimal = r1.status === 'optimal';
  const detOk = !r1.error && !r2.error && r1.status === r2.status && Math.abs(r1.objective - r2.objective) <= 1e-6 && strictSameVector(r1.vector, r2.vector);
  const ver = verifySolution(r1.out, rec, reservedType[rec.key]);
  const facts = derive.deriveFacts(rec);
  if (!optimal) allOptimal = false;
  if (!typeOk) allTypeMatch = false;
  if (!detOk) allDeterministic = false;
  if (!ver.verified) allVerified = false;
  out.push({
    key: rec.key, slug: rec.slug, category: rec.category,
    intendedType: rec.type, reservedType: reservedType[rec.key], detectedType: r1.modelType, typeMatch: typeOk,
    direction: rec.sense, variables: r1.variables.length, constraints: r1.constraints,
    domains: rec.model.domains || null, bounds: facts.hasBounds, functionsUsed: facts.functionsUsed,
    gridCells: facts.gridCells, gridRows: rec.model.grid.length, gridCols: rec.model.grid[0].length,
    status1: r1.status, objective1: r1.objective, vector1: r1.vector,
    status2: r2.status, objective2: r2.objective,
    deterministic: detOk, verified: ver.verified, verifyReasons: ver.reasons, recomputedObjective: ver.recomputedObjective,
    chartEligible: facts.chartEligible, optimalityProven: r1.optimalityProven
  });
});

// rule-consequence checks
const ruleChecks = [
  { key:'scholarships', label:'Vocational capacity' }, { key:'food-bank', label:'Food stock' },
  { key:'food-bank', label:'Volunteer hours' }, { key:'renewable-mix', label:'Min renewable' },
  { key:'hotel-rooms', label:'Min OTA' }, { key:'microgrid-capacity', label:'Backup dependence' },
];
const ruleResults = ruleChecks.map(function (rc) {
  const rec = models.find(function (m) { return m.key === rc.key; });
  const w = solveRecord(rec), wo = solveRecord(withoutRow(rec, rc.label));
  return { key: rc.key, rule: rc.label, withObj: w.objective, withVec: w.vector, withoutObj: wo.objective, withoutVec: wo.vector, matters: w.objective !== wo.objective || vstr(w.vector) !== vstr(wo.vector) };
});
const allRulesMatter = ruleResults.every(function (r) { return r.matters; });

const report = {
  environment: { node: process.version, note: 'Phase-1 working environment; final acceptance requires Node 24.15.0' },
  summary: { total: out.length, allOptimal, allTypeMatch, allVerified, allDeterministic, allRulesMatter },
  models: out,
  ruleConsequence: ruleResults,
  exactCandidates: { note: 'Uniqueness confirmed externally; exact recommended only for these four.', keys: ['bakery-mix','purchase-split','fertiliser-blend','lp-basics'] }
};
fs.writeFileSync(path.join(__dirname, '..', 'f7a-phase1-engine-audit.json'), JSON.stringify(report, null, 2));
console.log('15/15 optimal:', allOptimal, '| type match:', allTypeMatch, '| verified:', allVerified, '| deterministic:', allDeterministic, '| all rules matter:', allRulesMatter);
