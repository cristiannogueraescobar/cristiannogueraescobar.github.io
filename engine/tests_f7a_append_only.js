/* tests_f7a_append_only.js — APPEND-ONLY proof (permanent).
 *
 * Proves that a future tranche (F7c) can append a 37th example WITHOUT re-pinning any earlier
 * tranche artefact:
 *
 *   1. The F7a tranche historical baseline still PASSES for the original 15 records
 *      (a pure append leaves every frozen per-record contract intact).
 *   2. The live checkpoint total-count contract (catalogue === 36) FAILS on the appended tree,
 *      because the live checkpoint must remain EXACTLY 36 until F7c formally moves the count —
 *      exactly as the F7a checkpoint (===24) behaved when F7b moved the count to 36.
 *
 * Both facts are checked on an isolated temp tree with a valid synthetic #37 record
 * appended to catalogue.js and metadata.js. The real source tree is never mutated.
 * Windows-safe: fs built-ins only; the two verdicts are produced by a child Node so the
 * require-cache of the mutated tree never leaks into this process.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const SITE = path.resolve(__dirname, '..');
const FIXTURE = path.join(SITE, 'engine', 'fixtures', 'f7a-tranche', 'f7a-tranche-baseline.json');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f7a-append-'));
  ['src', 'engine', 'assets', 'docs'].forEach(function (d) {
    fs.cpSync(path.join(SITE, d), path.join(dir, d), { recursive: true });
  });
  return dir;
}

// Append a valid synthetic 25th record to catalogue.js (clone lp-basics shape, unique key/slug).
function appendSyntheticCatalogue(dir) {
  const p = path.join(dir, 'src', 'shared', 'examples', 'catalogue.js');
  let src = fs.readFileSync(p, 'utf8');
  const rec = [
    '  ,{',
    '    "key": "synthetic-append",',
    '    "slug": "synthetic-append-check",',
    '    "category": "start",',
    '    "type": "continuous",',
    '    "sense": "max",',
    '    "translations": {',
    '      "en": { "title": "Synthetic append check", "desc": "A synthetic append-only proof record" },',
    '      "es": { "title": "Comprobacion de anexado sintetico", "desc": "Un registro sintetico de prueba append-only" },',
    '      "pt": { "title": "Verificacao de anexacao sintetica", "desc": "Um registro sintetico de prova append-only" },',
    '      "de": { "title": "Synthetische Anhaengepruefung", "desc": "Ein synthetischer Append-only-Nachweisdatensatz" },',
    '      "fr": { "title": "Verification d ajout synthetique", "desc": "Un enregistrement synthetique de preuve append-only" }',
    '    },',
    '    "model": { "grid": [["Product","Units","Term","",""],["Widgets","0","","",""],["","","","",""],["Objective","","=5*B2","",""],["Limit","","=1*B2","<=","3"]] },',
    '    "expected": { "status": "optimal", "modelType": "continuous", "objective": 15 }',
    '  }'
  ].join('\n');
  src = src.replace(/\n\];/, '\n' + rec + '\n];');
  fs.writeFileSync(p, src);
}

// Append the matching metadata record (double-quoted key form used by F7a records).
function appendSyntheticMetadata(dir) {
  const p = path.join(dir, 'src', 'shared', 'examples', 'f5', 'metadata.js');
  let src = fs.readFileSync(p, 'utf8');
  const rec = [
    '  ,"synthetic-append": {',
    '    schemaVersion: 1,',
    '    primaryCategory: "learning-engine",',
    '    difficulty: "beginner",',
    '    minutes: 1,',
    '    audiences: ["general"],',
    '    provenance: { kind: "synthetic" },',
    '    tags: ["synthetic"],',
    '    capabilities: ["continuous-variables"],',
    '    related: [],',
    '    result: { policy: "objective-feasible" },',
    '    content: {',
    '      question: c("Synthetic q en", "Synthetic q es", "Synthetic q pt", "Synthetic q de", "Synthetic q fr"),',
    '      goal: c("Synthetic g en", "Synthetic g es", "Synthetic g pt", "Synthetic g de", "Synthetic g fr")',
    '    }',
    '  }'
  ].join('\n');
  // insert before the final closing "};" of the METADATA object literal
  const idx = src.lastIndexOf('\n};');
  src = src.slice(0, idx) + '\n' + rec + src.slice(idx);
  fs.writeFileSync(p, src);
}

// Child-Node verdict script: reports catalogue length, whether the checkpoint (===24)
// would fail, and whether the 15 historical F7a tranche records still all pass.
const CHECKER = `
'use strict';
const path=require('path'), crypto=require('crypto'), fs=require('fs');
const SITE=process.argv[2], FIX=process.argv[3];
const tranche=require(FIX);
const { loadAndValidateCatalogue }=require(path.join(SITE,'src','shared','examples','index.js'));
const { loadCanonical }=require(path.join(SITE,'src','shared','examples','f5','index.js'));
const META=require(path.join(SITE,'src','shared','examples','f5','metadata.js')).METADATA;
function sha(v){ return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex'); }
function canonMeta(v){ if(Array.isArray(v))return v.map(canonMeta); if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{o[k]=canonMeta(v[k]);});return o;} return v; }
function metaSha(rec){ return crypto.createHash('sha256').update(JSON.stringify(canonMeta(rec))).digest('hex'); }
function modelHash(rec){ return crypto.createHash('sha256').update(JSON.stringify({grid:rec.model.grid,domains:rec.model.domains||null,whole:!!rec.model.whole,openVarSettings:!!rec.model.openVarSettings,sense:rec.sense,expected:rec.expected})).digest('hex'); }
function fieldOrderOf(src,key,keys,i){ const s=src.indexOf('"key": "'+key+'"'); const e=i+1<keys.length?src.indexOf('"key": "'+keys[i+1]+'"'):src.length; const m=src.slice(s,e).match(/"fieldOrder":\\s*\\[([^\\]]*)\\]/); return m?m[1].split(',').map(x=>x.trim().replace(/"/g,'')).filter(Boolean):null; }
let cat, canon;
try { cat=loadAndValidateCatalogue(SITE).catalogue; canon=loadCanonical(SITE).canonical; }
catch(e){ process.stdout.write(JSON.stringify({loadError:String(e&&e.message||e)})); process.exit(0); }
const catByKey={}; cat.forEach(r=>catByKey[r.key]=r);
const canonByKey={}; canon.forEach(c=>canonByKey[c.key]=c);
const catKeys=cat.map(r=>r.key);
const src=fs.readFileSync(path.join(SITE,'src','shared','examples','catalogue.js'),'utf8');
// Historical tranche: do the original 15 still all satisfy their frozen contract?
let historicalAllPass=true;
tranche.records.forEach(b=>{
  const rec=catByKey[b.key], c=canonByKey[b.key], m=META[b.key];
  if(!rec||!c||!m){ historicalAllPass=false; return; }
  const idx=catKeys.indexOf(b.key), fo=fieldOrderOf(src,b.key,catKeys,idx);
  let okAll = rec.slug===b.slug && rec.expected.modelType===b.modelType && c.resultPolicy===b.resultPolicy
    && Math.abs(rec.expected.objective-b.objective)<1e-9 && modelHash(rec)===b.modelHash
    && JSON.stringify(fo)===JSON.stringify(b.fieldOrder) && m.primaryCategory===b.category
    && m.difficulty===b.difficulty && m.minutes===b.minutes && JSON.stringify(m.tags)===JSON.stringify(b.tags)
    && rec.sense===b.direction && rec.expected.status===b.status
    && sha(rec.translations)===b.translationsSha256 && sha(m.content)===b.contentSha256
    && (b.metadataSha256===undefined || metaSha(m)===b.metadataSha256);
  if(b.exactDecisions) okAll = okAll && JSON.stringify(c.resultDecisions)===JSON.stringify(b.exactDecisions);
  if(!okAll) historicalAllPass=false;
});
process.stdout.write(JSON.stringify({
  catalogueLength: cat.length,
  checkpoint36Holds: cat.length===36,     // the live checkpoint assertion
  historicalTrancheAllPass: historicalAllPass
}));
`;

const CHECKER_PATH = path.join(os.tmpdir(), 'f7a-append-checker-' + process.pid + '.js');
fs.writeFileSync(CHECKER_PATH, CHECKER);

function runChecker(dir) {
  const out = execFileSync(process.execPath, [CHECKER_PATH, dir, FIXTURE], { encoding: 'utf8' });
  return JSON.parse(out);
}

// --- Baseline: clean tree at exactly 36, checkpoint holds, historical tranche passes.
(function () {
  const dir = makeTree();
  try {
    const v = runChecker(dir);
    ok('APPEND-ONLY: clean tree loads', !v.loadError, v.loadError);
    ok('APPEND-ONLY: clean catalogue length is 36', v.catalogueLength === 36, String(v.catalogueLength));
    ok('APPEND-ONLY: clean checkpoint (===36) holds', v.checkpoint36Holds === true);
    ok('APPEND-ONLY: clean historical tranche all-pass', v.historicalTrancheAllPass === true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

// --- Append #37: historical tranche must still PASS, checkpoint (===36) must FAIL.
(function () {
  const dir = makeTree();
  try {
    appendSyntheticCatalogue(dir);
    appendSyntheticMetadata(dir);
    const v = runChecker(dir);
    ok('APPEND-ONLY: appended tree still loads/validates', !v.loadError, v.loadError);
    ok('APPEND-ONLY: catalogue length becomes 37', v.catalogueLength === 37, String(v.catalogueLength));
    // (1) append is non-destructive to the frozen F7a tranche records
    ok('APPEND-ONLY: historical tranche STILL PASSES after append (F7a-15 untouched)', v.historicalTrancheAllPass === true);
    // (2) the live checkpoint must remain exactly 36 → the ===36 contract now FAILS
    ok('APPEND-ONLY: checkpoint (===36) now FAILS (must stay exactly 36 until F7c)', v.checkpoint36Holds === false, 'checkpoint still held at ' + v.catalogueLength);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})();

try { fs.rmSync(CHECKER_PATH, { force: true }); } catch (e) {}

console.log('\nF7A APPEND-ONLY  PASSED: ' + pass + '   FAILED: ' + fail);
if (failures.length) { failures.forEach(function (f) { console.log('  FAIL: ' + f); }); process.exitCode = 1; }
