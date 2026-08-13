/* tests_f7a_tranche_baseline_negative.js — F7a TRANCHE BASELINE negatives (permanent, HARDENED).
 *
 * Proves the per-record tranche contract bites by mutating the REAL records (catalogue.js + f5
 * metadata.js) in an isolated temp tree and re-checking them against the frozen fixture — not by
 * editing the fixture. For each guarded field a mutation to the real record must make EXACTLY that
 * record's contract fail, and must not make other records fail (isolation).
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
const FIXTURE = path.join(SITE, 'engine', 'fixtures', 'f7a-tranche', 'f7a-tranche-baseline.json');
const tranche = require(FIXTURE);

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const CHECKER = `
'use strict';
const path = require('path'), crypto = require('crypto'), fs = require('fs');
const SITE = process.argv[2], FIX = process.argv[3];
const tranche = require(FIX);
const { loadAndValidateCatalogue } = require(path.join(SITE,'src','shared','examples','index.js'));
const { loadCanonical } = require(path.join(SITE,'src','shared','examples','f5','index.js'));
const META = require(path.join(SITE,'src','shared','examples','f5','metadata.js')).METADATA;
function sha(v){ return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex'); }
function canonMeta(v){ if(Array.isArray(v))return v.map(canonMeta); if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{o[k]=canonMeta(v[k]);});return o;} return v; }
function metaSha(rec){ return crypto.createHash('sha256').update(JSON.stringify(canonMeta(rec))).digest('hex'); }
function modelHash(rec){ return crypto.createHash('sha256').update(JSON.stringify({grid:rec.model.grid,domains:rec.model.domains||null,whole:!!rec.model.whole,openVarSettings:!!rec.model.openVarSettings,sense:rec.sense,expected:rec.expected})).digest('hex'); }
function fieldOrderOf(src,key,keys,i){ const s=src.indexOf('"key": "'+key+'"'); const e=i+1<keys.length?src.indexOf('"key": "'+keys[i+1]+'"'):src.length; const m=src.slice(s,e).match(/"fieldOrder":\\s*\\[([^\\]]*)\\]/); return m?m[1].split(',').map(x=>x.trim().replace(/"/g,'')).filter(Boolean):null; }
let cat, canon;
try { const L=loadAndValidateCatalogue(SITE); cat=L.catalogue; canon=loadCanonical(SITE).canonical; }
catch(e){ const out={}; tranche.records.forEach(b=>out[b.key]=false); process.stdout.write(JSON.stringify(out)); process.exit(0); }
const catByKey={}; cat.forEach(r=>catByKey[r.key]=r);
const canonByKey={}; canon.forEach(c=>canonByKey[c.key]=c);
const catKeys=cat.map(r=>r.key);
const src=fs.readFileSync(path.join(SITE,'src','shared','examples','catalogue.js'),'utf8');
const out={};
tranche.records.forEach(b=>{
  const rec=catByKey[b.key], c=canonByKey[b.key], m=META[b.key];
  if(!rec||!c||!m){ out[b.key]=false; return; }
  const idx=catKeys.indexOf(b.key), fo=fieldOrderOf(src,b.key,catKeys,idx);
  let okAll = rec.slug===b.slug && rec.expected.modelType===b.modelType && c.resultPolicy===b.resultPolicy
    && Math.abs(rec.expected.objective-b.objective)<1e-9 && modelHash(rec)===b.modelHash
    && JSON.stringify(fo)===JSON.stringify(b.fieldOrder) && m.primaryCategory===b.category
    && m.difficulty===b.difficulty && m.minutes===b.minutes && JSON.stringify(m.tags)===JSON.stringify(b.tags)
    && rec.sense===b.direction && rec.expected.status===b.status
    && sha(rec.translations)===b.translationsSha256 && sha(m.content)===b.contentSha256
    && (b.metadataSha256===undefined || metaSha(m)===b.metadataSha256);
  if(b.exactDecisions) okAll = okAll && JSON.stringify(c.resultDecisions)===JSON.stringify(b.exactDecisions);
  out[b.key]=okAll;
});
process.stdout.write(JSON.stringify(out));
`;
const CHECKER_PATH = path.join(os.tmpdir(), 'f7a-tranche-checker-' + process.pid + '.js');
fs.writeFileSync(CHECKER_PATH, CHECKER);

function makeTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f7a-tranche-neg-'));
  ['src', 'engine', 'assets', 'docs'].forEach(function (d) { fs.cpSync(path.join(SITE, d), path.join(dir, d), { recursive: true }); });
  return dir;
}
function runChecker(dir) {
  var out = execFileSync(process.execPath, [CHECKER_PATH, dir, FIXTURE], { encoding: 'utf8' });
  return JSON.parse(out);
}
const CAT = function (dir) { return path.join(dir, 'src', 'shared', 'examples', 'catalogue.js'); };
const METAF = function (dir) { return path.join(dir, 'src', 'shared', 'examples', 'f5', 'metadata.js'); };
function rd(p) { return fs.readFileSync(p, 'utf8'); }
function wr(p, s) { fs.writeFileSync(p, s); }
function editCatBlock(dir, key, replacer) {
  var p = CAT(dir); var src = rd(p);
  var s = src.indexOf('"key": "' + key + '"');
  var e = src.indexOf('"key": "', s + 10); if (e === -1) e = src.length;
  wr(p, src.slice(0, s) + replacer(src.slice(s, e)) + src.slice(e));
}

function expectRecordFails(label, key, mutate) {
  var dir = makeTree();
  try {
    var clean = runChecker(dir);
    ok(label + ': clean tree, target passes', clean[key] === true);
    mutate(dir);
    var after = runChecker(dir);
    ok(label + ': mutation makes ' + key + ' fail', after[key] === false, 'target still passes');
    // Isolation: a local field edit must not fail OTHER records. Some mutations (e.g. flipping a
    // sense that is cross-validated against declared capabilities) legitimately break the whole load
    // — in that case every record fails, which is still valid detection, so we only require isolation
    // when the load did not break globally (at least one other record still passes).
    var others = Object.keys(after).filter(function (k) { return k !== key; });
    var stillOk = others.filter(function (k) { return after[k] === true; }).length;
    var loadBrokeGlobally = stillOk === 0;
    ok(label + ': isolation (other records unaffected, unless mutation breaks the whole load)',
       stillOk === others.length || loadBrokeGlobally, stillOk + '/' + others.length + ' others pass');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// slug
expectRecordFails('slug drift', 'bakery-mix', function (dir) {
  editCatBlock(dir, 'bakery-mix', function (b) { return b.replace('"slug": "bakery-production-mix"', '"slug": "bakery-production-mix-x"'); });
});
// objective
expectRecordFails('objective drift', 'scholarships', function (dir) {
  editCatBlock(dir, 'scholarships', function (b) { return b.replace(/"objective":\s*([\d.]+)/, function (a, n) { return '"objective": ' + (parseFloat(n) + 1); }); });
});
// model grid (modelHash)
expectRecordFails('model grid drift', 'renewable-mix', function (dir) {
  editCatBlock(dir, 'renewable-mix', function (b) { var m = b.replace(/"(\d+)"/, function (a, n) { return '"' + (parseInt(n, 10) + 7) + '"'; }); return m; });
});
// direction/sense
expectRecordFails('direction drift', 'fertiliser-blend', function (dir) {
  // fertiliser-blend is 'min'; flip to a valid-but-different sense so only its own hash/direction drifts.
  editCatBlock(dir, 'fertiliser-blend', function (b) { return b.replace(/("sense":\s*")(min|max)(")/, function (a, pre, d, post) { return pre + (d === 'min' ? 'max' : 'min') + post; }); });
});
// category (metadata)
expectRecordFails('category drift', 'food-bank', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("food-bank":[\s\S]*?primaryCategory:\s*')[^']+(')/, '$1logistics-transport$2'));
});
// difficulty (metadata)
expectRecordFails('difficulty drift', 'hotel-rooms', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("hotel-rooms":[\s\S]*?difficulty:\s*')[^']+(')/, '$1advanced$2'));
});
// minutes (metadata)
expectRecordFails('minutes drift', 'call-centre', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("call-centre":[\s\S]*?minutes:\s*)\d+/, '$199'));
});
// tags (metadata)
expectRecordFails('tags drift', 'media-mix', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("media-mix":[\s\S]*?tags:\s*\[)'[^']*'/, "$1'zzz-mutated'"));
});
// content (metadata question)
expectRecordFails('content drift', 'clinic-staffing', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("clinic-staffing":[\s\S]*?question:\s*c\(\s*')[^']*/, '$1MUTATED QUESTION'));
});
// translations (catalogue)
expectRecordFails('translations drift', 'purchase-split', function (dir) {
  editCatBlock(dir, 'purchase-split', function (b) { return b.replace(/("en":\s*\{\s*"title":\s*")[^"]*/, '$1MUTATED TITLE'); });
});
// exact decisions (metadata)
expectRecordFails('exact decisions drift', 'lp-basics', function (dir) {
  var p = METAF(dir); wr(p, rd(p).replace(/("lp-basics":[\s\S]*?decisions:\s*\{[^}]*?:\s*)(\d+)/, function (a, pre, num) { return pre + (parseInt(num, 10) + 3); }));
});
// fieldOrder (catalogue) — reversing a record's fieldOrder array must trip its contract.
expectRecordFails('fieldOrder drift', 'factory-batches', function (dir) {
  editCatBlock(dir, 'factory-batches', function (b) {
    return b.replace(/("fieldOrder":\s*\[)([\s\S]*?)(\])/, function (all, open, body, close) {
      var items = body.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      return open + items.reverse().join(', ') + close;
    });
  });
});
// Edit the authored metadata block of one F7a record (double-quoted key in metadata.js).
function editMetaBlock(dir, key, replacer) {
  var p = METAF(dir); var src = rd(p);
  var s = src.indexOf('"' + key + '":');
  if (s === -1) throw new Error('meta key not found: ' + key);
  var e = src.indexOf('\n  "', s + 3); if (e === -1) e = src.length;
  wr(p, src.slice(0, s) + replacer(src.slice(s, e)) + src.slice(e));
}
// capabilities drift — metadataSha256 must catch a changed capabilities array even though
// no other pinned field references capabilities.
expectRecordFails('capabilities drift', 'ingredient-sourcing', function (dir) {
  editMetaBlock(dir, 'ingredient-sourcing', function (b) {
    return b.replace(/(capabilities:\s*\[)/, '$1\'injected-capability\', ');
  });
});
// related drift — same, for the related array.
expectRecordFails('related drift', 'media-mix', function (dir) {
  editMetaBlock(dir, 'media-mix', function (b) {
    return b.replace(/(related:\s*\[)([\s\S]*?)(\])/, function (all, open, body, close) {
      return open + '\'production\'' + (body.trim() ? ', ' + body.trim() : '') + close;
    });
  });
});

try { fs.rmSync(CHECKER_PATH, { force: true }); } catch (e) {}

console.log('F7A TRANCHE BASELINE NEGATIVE  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(function (f) { console.log('  FAIL:', f); }); process.exit(1); }
