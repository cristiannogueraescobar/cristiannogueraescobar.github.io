/* tests_f7b_tranche_baseline_negative.js — F7b TRANCHE BASELINE negatives (permanent, HARDENED).
 *
 * Proves the per-record F7b tranche contract and the real catalogue validator both bite by mutating
 * the REAL records (catalogue.js + f5 metadata.js) and the localisation plan in an isolated temp tree
 * and re-checking against the frozen fixture / real schema — not by editing the fixture. For each
 * guarded aspect, the mutation must be DETECTED. Covers: duplicate key, duplicate slug, collision
 * with an existing F5/F6/F7a record, invalid category, invalid model type, invalid direction, invalid
 * result policy, missing locale, missing localisation field, unexpected localisation membership,
 * modelHash mutation, objective-contract mutation, and live/tranche inconsistency.
 *
 * Temp trees use fs built-ins (cpSync/mkdtempSync/rmSync); checks run in a child Node via
 * execFileSync(process.execPath) so require-cache never leaks between mutations. No shell.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = path.join(__dirname, '..');
const FIXTURE = path.join(SITE, 'engine', 'fixtures', 'f7b-tranche', 'f7b-tranche-baseline.json');
const tranche = require(FIXTURE);

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// Child checker: reports, per F7b key, whether its full tranche contract holds; plus a global
// catalogueLoads flag and a localisation-plan exactness flag. Runs in a child Node.
const CHECKER = `
'use strict';
const path = require('path'), crypto = require('crypto'), fs = require('fs');
const SITE = process.argv[2], FIX = process.argv[3];
const tranche = require(FIX);
function out(o){ process.stdout.write(JSON.stringify(o)); process.exit(0); }
let cat, canon, META, LOCPLAN, ENUMS;
try {
  const { loadAndValidateCatalogue } = require(path.join(SITE,'src','shared','examples','index.js'));
  const { loadCanonical } = require(path.join(SITE,'src','shared','examples','f5','index.js'));
  META = require(path.join(SITE,'src','shared','examples','f5','metadata.js')).METADATA;
  LOCPLAN = require(path.join(SITE,'engine','fixtures','f7b-tranche','f7b-localisation-plan.json'));
  ENUMS = require(path.join(SITE,'src','shared','examples','f5','enums.js'));
  cat = loadAndValidateCatalogue(SITE).catalogue; canon = loadCanonical(SITE).canonical;
} catch(e) {
  const rec={}; tranche.records.forEach(b=>rec[b.key]=false);
  out({ catalogueLoads:false, loadError:String(e&&e.message||e), records:rec, locplanExact:false });
}
function sha(v){ return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex'); }
function canonMeta(v){ if(Array.isArray(v))return v.map(canonMeta); if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{o[k]=canonMeta(v[k]);});return o;} return v; }
function metaSha(rec){ return crypto.createHash('sha256').update(JSON.stringify(canonMeta(rec))).digest('hex'); }
function modelHash(rec){ return crypto.createHash('sha256').update(JSON.stringify({grid:rec.model.grid,domains:rec.model.domains||null,whole:!!rec.model.whole,openVarSettings:!!rec.model.openVarSettings,sense:rec.sense,expected:rec.expected})).digest('hex'); }
function fieldOrderOf(src,key,keys,i){ const s=src.indexOf('"key": "'+key+'"'); const e=i+1<keys.length?src.indexOf('"key": "'+keys[i+1]+'"'):src.length; const m=src.slice(s,e).match(/"fieldOrder":\\s*\\[([^\\]]*)\\]/); return m?m[1].split(',').map(x=>x.trim().replace(/"/g,'')).filter(Boolean):null; }
const catByKey={}; cat.forEach(r=>catByKey[r.key]=r);
const canonByKey={}; canon.forEach(c=>canonByKey[c.key]=c);
const catKeys=cat.map(r=>r.key);
const src=fs.readFileSync(path.join(SITE,'src','shared','examples','catalogue.js'),'utf8');
const NON_EN = ENUMS.LOCALES.filter(l=>l!=='en');
const rec={};
tranche.records.forEach(b=>{
  const r=catByKey[b.key], c=canonByKey[b.key], m=META[b.key];
  if(!r||!c||!m){ rec[b.key]=false; return; }
  const idx=catKeys.indexOf(b.key), fo=fieldOrderOf(src,b.key,catKeys,idx);
  let okAll = r.slug===b.slug && r.expected.modelType===b.modelType && c.resultPolicy===b.resultPolicy
    && Math.abs(r.expected.objective-b.objective)<1e-9 && modelHash(r)===b.modelHash
    && JSON.stringify(fo)===JSON.stringify(b.fieldOrder) && m.primaryCategory===b.category
    && m.difficulty===b.difficulty && m.minutes===b.minutes && JSON.stringify(m.tags)===JSON.stringify(b.tags)
    && r.sense===b.direction && r.expected.status===b.status
    && sha(r.translations)===b.translationsSha256 && sha(m.content)===b.contentSha256
    && metaSha(m)===b.metadataSha256;
  // localisation surface: 4 non-EN locales x 4 fields present & distinct from English
  const plan = LOCPLAN.examples[b.key];
  if(!plan) okAll=false;
  else ['title','desc','question','goal'].forEach(f=>{ NON_EN.forEach(l=>{ if(!plan[f]||!plan[f][l]||!plan[f][l].trim()||plan[f][l]===plan[f].en) okAll=false; }); });
  rec[b.key]=okAll;
});
// localisation-plan exactness: keys(plan)===tranche keys
const planKeys=Object.keys(LOCPLAN.examples).sort();
const trKeys=tranche.records.map(b=>b.key).sort();
const locplanExact = JSON.stringify(planKeys)===JSON.stringify(trKeys);
// duplicate detection across the whole live catalogue
const allKeys=cat.map(r=>r.key), allSlugs=cat.map(r=>r.slug);
const noDupKeys = new Set(allKeys).size===allKeys.length;
const noDupSlugs = new Set(allSlugs).size===allSlugs.length;
out({ catalogueLoads:true, records:rec, locplanExact:locplanExact, noDupKeys:noDupKeys, noDupSlugs:noDupSlugs, catalogueLength:cat.length });
`;
const CHECKER_PATH = path.join(os.tmpdir(), 'f7b-tranche-neg-checker-' + process.pid + '.js');
fs.writeFileSync(CHECKER_PATH, CHECKER);

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f7b-tranche-neg-'));
  ['src', 'engine', 'assets', 'docs'].forEach(function (d) { fs.cpSync(path.join(SITE, d), path.join(dir, d), { recursive: true }); });
  return dir;
}
function runChecker(dir) {
  var out = execFileSync(process.execPath, [CHECKER_PATH, dir, FIXTURE], { encoding: 'utf8' });
  return JSON.parse(out);
}
const CAT = function (dir) { return path.join(dir, 'src', 'shared', 'examples', 'catalogue.js'); };
const METAF = function (dir) { return path.join(dir, 'src', 'shared', 'examples', 'f5', 'metadata.js'); };
const LOCF = function (dir) { return path.join(dir, 'engine', 'fixtures', 'f7b-tranche', 'f7b-localisation-plan.json'); };
function rd(p) { return fs.readFileSync(p, 'utf8'); }
function wr(p, s) { fs.writeFileSync(p, s); }
function editCatBlock(dir, key, replacer) {
  var p = CAT(dir); var src = rd(p);
  var s = src.indexOf('"key": "' + key + '"');
  var e = src.indexOf('"key": "', s + 10); if (e === -1) e = src.length;
  wr(p, src.slice(0, s) + replacer(src.slice(s, e)) + src.slice(e));
}

// A per-record mutation must make EXACTLY that record fail (unless it breaks the whole load, which is
// also valid detection).
function expectRecordFails(label, key, mutate) {
  var dir = makeTree();
  try {
    var clean = runChecker(dir);
    ok(label + ': clean tree, target passes', clean.records[key] === true);
    mutate(dir);
    var after = runChecker(dir);
    ok(label + ': mutation makes ' + key + ' fail (or breaks load)', after.records[key] === false, 'target still passes');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// A mutation that must break the whole catalogue LOAD (real validator rejects it).
function expectLoadFails(label, mutate) {
  var dir = makeTree();
  try {
    var clean = runChecker(dir);
    ok(label + ': clean tree loads', clean.catalogueLoads === true);
    mutate(dir);
    var after = runChecker(dir);
    ok(label + ': mutation is rejected by the real loader/validator', after.catalogueLoads === false, 'load still succeeded');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- 1. modelHash mutation (grid drift) ----
expectRecordFails('modelHash mutation', 'assembly-line-mix', function (dir) {
  editCatBlock(dir, 'assembly-line-mix', function (b) { return b.replace(/"(\d+)"/, function (a, n) { return '"' + (parseInt(n, 10) + 5) + '"'; }); });
});
// ---- 2. objective-contract mutation ----
expectRecordFails('objective mutation', 'menu-planning', function (dir) {
  editCatBlock(dir, 'menu-planning', function (b) { return b.replace(/"objective":\s*([\d.]+)/, function (a, n) { return '"objective": ' + (parseFloat(n) + 1); }); });
});
// ---- 3. slug drift ----
expectRecordFails('slug drift', 'battery-dispatch', function (dir) {
  editCatBlock(dir, 'battery-dispatch', function (b) { return b.replace('"slug": "battery-dispatch-plan"', '"slug": "battery-dispatch-plan-x"'); });
});
// ---- 4. category drift (metadata) ----
expectRecordFails('category drift', 'tutoring-hours', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("tutoring-hours":[\s\S]*?primaryCategory:\s*')[^']+(')/, '$1logistics-transport$2'));
});

// ---- 5. duplicate key (whole-catalogue): real loader must reject ----
expectLoadFails('duplicate key', function (dir) {
  // append a clone of assembly-line-mix's key onto retail-shelf-space (change its key to collide)
  editCatBlock(dir, 'retail-shelf-space', function (b) { return b.replace('"key": "retail-shelf-space"', '"key": "assembly-line-mix"'); });
});
// ---- 6. duplicate slug (whole-catalogue): real loader must reject ----
expectLoadFails('duplicate slug', function (dir) {
  editCatBlock(dir, 'menu-planning', function (b) { return b.replace('"slug": "menu-planning-mix"', '"slug": "assembly-line-mix"'); });
});
// ---- 7. collision with an existing F7a record key ----
expectLoadFails('collision with F7a key (bakery-mix)', function (dir) {
  editCatBlock(dir, 'assembly-line-mix', function (b) { return b.replace('"key": "assembly-line-mix"', '"key": "bakery-mix"'); });
});
// ---- 8. invalid category (grid-UI category enum) ----
expectLoadFails('invalid grid category', function (dir) {
  editCatBlock(dir, 'warehouse-dispatch', function (b) { return b.replace(/"category":\s*"(start|business|binary)"/, '"category": "not-a-category"'); });
});
// ---- 9. invalid model type ----
expectLoadFails('invalid model type', function (dir) {
  editCatBlock(dir, 'warehouse-dispatch', function (b) { return b.replace(/"type":\s*"continuous"/, '"type": "quantum"'); });
});
// ---- 10. invalid direction/sense ----
expectLoadFails('invalid direction', function (dir) {
  editCatBlock(dir, 'budget-allocation', function (b) { return b.replace(/"sense":\s*"(max|min)"/, '"sense": "sideways"'); });
});
// ---- 11. invalid result policy (metadata) ----
expectLoadFails('invalid result policy', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("raw-material-buy":[\s\S]*?result:\s*\{\s*policy:\s*')[^']+(')/, '$1teleport$2'));
});

// ---- 12. missing locale (localisation plan) — tranche contract must fail for that record ----
expectRecordFails('missing locale', 'feed-blend', function (dir) {
  var p = LOCF(dir); var j = JSON.parse(rd(p)); delete j.examples['feed-blend'].title.de; wr(p, JSON.stringify(j, null, 2));
});
// ---- 13. missing localisation field ----
expectRecordFails('missing localisation field', 'shift-coverage', function (dir) {
  var p = LOCF(dir); var j = JSON.parse(rd(p)); delete j.examples['shift-coverage'].goal; wr(p, JSON.stringify(j, null, 2));
});
// ---- 14. localised value silently equals English (fallback) ----
expectRecordFails('localisation English-fallback', 'container-loading', function (dir) {
  var p = LOCF(dir); var j = JSON.parse(rd(p)); j.examples['container-loading'].title.es = j.examples['container-loading'].title.en; wr(p, JSON.stringify(j, null, 2));
});

// ---- 15. unexpected localisation membership (extra key) — plan exactness must fail ----
(function () {
  var dir = makeTree();
  try {
    var clean = runChecker(dir);
    ok('unexpected localisation membership: clean plan is exact', clean.locplanExact === true);
    var p = LOCF(dir); var j = JSON.parse(rd(p));
    j.examples['ghost-example'] = JSON.parse(JSON.stringify(j.examples['feed-blend']));
    wr(p, JSON.stringify(j, null, 2));
    var after = runChecker(dir);
    ok('unexpected localisation membership: extra plan key is detected', after.locplanExact === false, 'plan still exact');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// ---- 16. live/tranche inconsistency: removing a live F7b record breaks membership+dup invariants ----
(function () {
  var dir = makeTree();
  try {
    var clean = runChecker(dir);
    ok('live/tranche consistency: clean live catalogue has all 12 F7b records', clean.records['assembly-line-mix'] === true && clean.catalogueLength === 36);
    // Remove assembly-line-mix from the live catalogue only (leave the tranche fixture asserting it).
    editCatBlock(dir, 'assembly-line-mix', function (b) { return ''; });
    var after = runChecker(dir);
    var inconsistent = (after.records['assembly-line-mix'] === false) || (after.catalogueLoads === false);
    ok('live/tranche inconsistency: a removed live F7b record is detected', inconsistent, 'not detected');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

try { fs.rmSync(CHECKER_PATH, { force: true }); } catch (e) {}

console.log('F7B TRANCHE BASELINE NEGATIVE  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
