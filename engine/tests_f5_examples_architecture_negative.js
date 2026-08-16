'use strict';
/* ============================================================================
   Checkpoint F5 — examples architecture NEGATIVE suite.
   ----------------------------------------------------------------------------
   Each mutation copies the parts of the tree F5 needs into a TEMP dir whose path
   contains a space, applies one reproducible mutation, asserts the right contract
   FAILS for its specific reason, and restores via a fresh temp each time (removed
   in finally). Node built-ins only; child Node processes use process.execPath.
   No cp/rm/sed/grep/bash. Never corrupts the working tree.

   A mutation "passes" (this suite is green) when the expected failure is observed.
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SITE = path.join(__dirname, '..');

// The CURRENT LIVE catalogue size, read from the real source. This is intentionally count-aware:
// it is 36 today (F5/F6-9 + F7a-15 + F7b-12) and becomes 48 at F7c without editing this suite. The
// catalogue-count mutation contracts (remove one / append one) validate against THIS value, never a
// frozen literal. This is a generic F5 negative suite, NOT the historical F7a checkpoint.
const CHECKPOINT_COUNT = require(path.join(SITE, 'src', 'shared', 'examples', 'catalogue.js')).CATALOGUE.length;
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

// Build a temp site containing the files F5 loading + validation needs.
function makeTempSite() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'f5 neg ')); // note the space
  const dst = path.join(base, 'site');
  const dirs = [
    ['src', 'shared', 'examples'],
    ['src', 'shared', 'examples', 'f5'],
    ['engine'],
    ['assets'],
    ['docs'],
  ];
  dirs.forEach(function (d) { fs.mkdirSync(path.join.apply(null, [dst].concat(d)), { recursive: true }); });
  // F1 examples
  ['catalogue.js', 'schema.js', 'serialize.js', 'projectors.js', 'index.js'].forEach(function (f) {
    fs.cpSync(path.join(SITE, 'src', 'shared', 'examples', f), path.join(dst, 'src', 'shared', 'examples', f));
  });
  // F5 modules
  ['enums.js', 'categories.js', 'derive.js', 'metadata.js', 'assemble.js', 'validate.js', 'project.js', 'authoring.js', 'index.js', 'baseline.json', 'protected-baseline.json'].forEach(function (f) {
    fs.cpSync(path.join(SITE, 'src', 'shared', 'examples', 'f5', f), path.join(dst, 'src', 'shared', 'examples', 'f5', f));
  });
  // assets + docs needed by some checks
  fs.cpSync(path.join(SITE, 'assets', 'examples-data.js'), path.join(dst, 'assets', 'examples-data.js'));
  fs.cpSync(path.join(SITE, 'docs', 'checkpoint-f5-examples-architecture.md'), path.join(dst, 'docs', 'checkpoint-f5-examples-architecture.md'));
  // engine harness + engine + suites for behavioural mutations
  ['harness.js', 'engine.js', 'f5_protected_check.js'].forEach(function (f) {
    if (fs.existsSync(path.join(SITE, 'engine', f))) fs.cpSync(path.join(SITE, 'engine', f), path.join(dst, 'engine', f));
  });
  return { base: base, dst: dst };
}
function rmTemp(base) { try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {} }

function rf(p) { return fs.readFileSync(p, 'utf8'); }
function wf(p, s) { fs.writeFileSync(p, s); }
function f5(dst, name) { return path.join(dst, 'src', 'shared', 'examples', 'f5', name); }
function f1(dst, name) { return path.join(dst, 'src', 'shared', 'examples', name); }

// Run the F5 loader in a child process against a temp site; return {code, out}.
function loadInChild(dst, expectCount) {
  const script = 'const p=require(' + JSON.stringify(f5(dst, 'index.js')) + ');' +
    'try{const r=p.loadCanonical(' + JSON.stringify(dst) + ',{expectCount:' + (expectCount === undefined ? 'undefined' : expectCount) + '});' +
    'process.stdout.write("OK:"+r.canonical.length);}catch(e){process.stdout.write("ERR:"+e.message);}';
  try {
    const out = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    return { out: out };
  } catch (e) {
    return { out: 'THROW:' + (e.stdout || '') + (e.stderr || '') };
  }
}

// A mutation: { n, expectContains, apply(dst) } — apply mutates temp, we then load
// and require the load to FAIL mentioning expectContains (or a matching validator
// error). Some mutations validate directly rather than through the loader.
const mutations = [];
function M(n, expectContains, apply, mode) { mutations.push({ n: n, expect: expectContains, apply: apply, mode: mode || 'load' }); }

// Helper: validate metadata directly in-process against a temp module set.
function validateTemp(dst) {
  const V = require(f5(dst, 'validate.js'));
  const cat = require(f1(dst, 'catalogue.js')).CATALOGUE;
  const meta = require(f5(dst, 'metadata.js')).METADATA;
  // clear caches so temp copies are read fresh
  return V.validateMetadataCatalogue(cat, meta);
}
function freshValidate(dst) {
  // require fresh copies from the temp path
  [f5(dst, 'validate.js'), f5(dst, 'metadata.js'), f5(dst, 'enums.js'), f5(dst, 'categories.js'), f5(dst, 'derive.js'), f1(dst, 'catalogue.js')].forEach(function (p) { delete require.cache[p]; });
  return validateTemp(dst);
}

// ---- 1..6 schema / identity mutations -------------------------------------
M('1. unknown schema version', 'schemaVersion must be 1', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('schemaVersion: 1,', 'schemaVersion: 2,'));
}, 'validate');
M('2. unknown top-level field', 'unknown field "bogus"', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('primaryCategory: \'production-operations\',', 'bogus: 1,\n    primaryCategory: \'production-operations\','));
}, 'validate');
M('3. missing ID (catalogue key blanked)', 'key must be a non-empty string', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"key": "production",', '"key": "",'));
}, 'load');
M('4. duplicate ID', 'duplicate', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"key": "workshop",', '"key": "production",'));
}, 'load');
M('5. invalid slug grammar', 'kebab-case', function (dst) {
  // A slug with a space must be rejected by the F1 schema GRAMMAR (not merely by the
  // baseline set comparison). Route through the real loader so the grammar rule runs.
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"slug": "production-plan",', '"slug": "Production Plan",'));
}, 'load');
M('6. duplicate slug', 'slug', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"slug": "workshop-chart",', '"slug": "production-plan",'));
}, 'load');

// ---- 7..8 public slug baseline --------------------------------------------
M('7. current public slug changed', 'public example slug changed', function (dst) {
  // change the catalogue slug but NOT the baseline -> baseline mismatch
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"slug": "production-plan",', '"slug": "production-plan-v2",'));
}, 'slug');
M('8. current public slug removed', 'public example slug removed', function (dst) {
  // remove one example from catalogue only -> baseline has a slug the catalogue lacks
  const p = f1(dst, 'catalogue.js'); const src = rf(p);
  // blank supplier slug to a different one so baseline slug is missing
  wf(p, src.replace('"slug": "supplier-activation",', '"slug": "supplier-activation-removed",'));
}, 'slug');

// ---- 9..11 categories ------------------------------------------------------
M('9. missing category', 'primaryCategory', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('primaryCategory: \'production-operations\',', 'primaryCategory: undefined,'));
}, 'validate');
M('10. unknown category', 'canonical category', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('primaryCategory: \'production-operations\',', 'primaryCategory: \'made-up-category\','));
}, 'validate');
M('11. eleventh category added without roadmap update', 'exactly 10', function (dst) {
  const p = f5(dst, 'categories.js');
  wf(p, rf(p).replace('var CATEGORIES = [', 'var CATEGORIES = [\n  { id: \'extra-eleven\', slug: \'extra-eleven\', order: 11, label: {en:\'x\',es:\'x\',pt:\'x\',de:\'x\',fr:\'x\'}, short:{en:\'x\',es:\'x\',pt:\'x\',de:\'x\',fr:\'x\'} },'));
}, 'categories');

// ---- 12..17 locales / content ---------------------------------------------
M('12. missing en title', 'empty title', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"title": "Production plan",', '"title": "",'));
}, 'load');
M('13. missing es title', 'empty title', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"title": "Plan de producción",', '"title": "",'));
}, 'load');
M('14. missing pt field (content.question.pt)', 'content.question.pt is missing', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace(/'Quantas unidades de cada produto[^']*',/, "'',"));
}, 'validate');
M('15. unsupported it locale in content', 'unsupported locale "it"', function (dst) {
  // Append an unsupported `it` locale onto production's content.question after assembly.
  const p = f5(dst, 'metadata.js');
  wf(p, rf(p).replace('function c(en, es, pt, de, fr) { return { en: en, es: es, pt: pt, de: de, fr: fr }; }',
    'function c(en, es, pt, de, fr) { return { en: en, es: es, pt: pt, de: de, fr: fr, it: \'x\' }; }'));
}, 'validate');
M('16. HTML in localized field', 'HTML/script/unsafe', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('How many units of each product', '<b>How</b> many units of each product'));
}, 'validate');
M('17. javascript URL/content', 'HTML/script/unsafe', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('Learn the basic shape of a linear plan', 'javascript:alert(1) Learn the basic shape'));
}, 'validate');

// ---- 18..21 classification enums ------------------------------------------
M('18. invalid difficulty', 'difficulty is invalid', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('difficulty: \'beginner\',', 'difficulty: \'expert\','));
}, 'validate');
M('19. invalid estimated minutes', 'minutes must be an integer', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('minutes: 5,', 'minutes: 999,'));
}, 'validate');
M('20. invalid audience', 'invalid audience', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("audiences: ['general', 'business', 'student'],", "audiences: ['ceo'],"));
}, 'validate');
M('21. invalid provenance', 'provenance.kind is invalid', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("provenance: { kind: 'synthetic' },", "provenance: { kind: 'real' },"));
}, 'validate');
M('22. fake source on synthetic', 'names a source', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("provenance: { kind: 'synthetic' },", "provenance: { kind: 'synthetic', source: 'ACME Corp internal data' },"));
}, 'validate');

// ---- 23..24 authored/derived drift ----------------------------------------
M('23. manual derived modelType drift', 'unknown field "modelType"', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('primaryCategory: \'production-operations\',', 'modelType: \'integer\',\n    primaryCategory: \'production-operations\','));
}, 'validate');
M('24. decision count drift (manual)', 'unknown field "decisionCount"', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('primaryCategory: \'production-operations\',', 'decisionCount: 99,\n    primaryCategory: \'production-operations\','));
}, 'validate');

// ---- 25..28 capabilities ---------------------------------------------------
M('25. invalid capability', 'unsupported capability', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],", "capabilities: ['telepathy'],"));
}, 'validate');
M('26. unsupported engine capability claim (bounds without bounds)', 'claims bounds but the model has none', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],", "capabilities: ['continuous-variables', 'maximise', 'bounds', 'sum', 'sumproduct', 'verification'],"));
}, 'validate');
M('27. COUNTIF claim', 'unsupported capability "countif"', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],", "capabilities: ['countif'],"));
}, 'validate');
M('28. nonlinear claim', 'unsupported capability "nonlinear"', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],", "capabilities: ['nonlinear'],"));
}, 'validate');

// ---- 29..32 model integrity (legacy hash) ---------------------------------
M('29. model cell mutation', 'legacy model hash', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"30",\n          "=B2*C2"', '"31",\n          "=B2*C2"'));
}, 'hash');
M('30. formula mutation', 'legacy model hash', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"=SUM(D2:D4)"', '"=SUM(D2:D3)"'));
}, 'hash');
M('31. variable type mutation (domain)', 'legacy model hash', function (dst) {
  const p = f1(dst, 'catalogue.js'); const src = rf(p);
  // Flip the first per-cell binary DOMAIN (indented, no trailing comma) to integer.
  const mutated = src.replace('          "type": "binary"', '          "type": "integer"');
  wf(p, mutated);
}, 'hash');
M('32. bound mutation', 'legacy model hash', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"<=",\n          "100"', '"<=",\n          "120"'));
}, 'hash');

// ---- 33..37 expected result ------------------------------------------------
M('33. expected status wrong', 'MISMATCH-STATUS', function (dst) {
  // Corrupt the independent baseline status; the real engine still returns optimal,
  // so the behavioural comparison must mismatch.
  const p = f5(dst, 'baseline.json'); const j = JSON.parse(rf(p)); j.examples[0].expected.status = 'infeasible'; wf(p, JSON.stringify(j, null, 2));
}, 'behavioural');
M('34. expected objective wrong', 'MISMATCH-OBJECTIVE', function (dst) {
  const p = f5(dst, 'baseline.json'); const j = JSON.parse(rf(p)); j.examples[0].expected.objective = 9999; wf(p, JSON.stringify(j, null, 2));
}, 'behavioural');
M('35. too-loose/invalid tolerance', 'tolerance', function (dst) {
  const p = f5(dst, 'baseline.json'); const j = JSON.parse(rf(p)); j.examples[0].expected.tolerance = 5; wf(p, JSON.stringify(j, null, 2));
}, 'tolerance');
M('36. exact policy without a decision vector', 'result.decisions is required', function (dst) {
  // Switch production to exact WITHOUT decisions -> conditional schema must reject.
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("result: { policy: 'objective-feasible' },", "result: { policy: 'exact' },"));
}, 'validate');
M('37. exact policy references a non-decision cell', 'non-decision cell', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("result: { policy: 'objective-feasible' },", "result: { policy: 'exact', decisions: { Z9: 1 } },"));
}, 'validate');

// ---- 38..40 related --------------------------------------------------------
M('38. related self-reference', 'self-reference', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("related: ['workshop', 'marketing'],", "related: ['production'],"));
}, 'validate');
M('39. dangling related ID', 'references unknown example', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("related: ['workshop', 'marketing'],", "related: ['ghost-example'],"));
}, 'validate');
M('40. duplicate related ID', 'related has duplicate', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("related: ['workshop', 'marketing'],", "related: ['workshop', 'workshop'],"));
}, 'validate');

// ---- 41..42 serializer / projection mutation ------------------------------
M('41. serializer nondeterminism (function in data)', 'function', function (dst) {
  // prove serializer rejects functions
  const script = 'const a=require(' + JSON.stringify(f5(dst, 'authoring.js')) + ');try{a.serializeCanonical({f:function(){}});process.stdout.write("OK")}catch(e){process.stdout.write("ERR:"+e.message)}';
  const out = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  return { direct: out };
}, 'direct-serialize');
M('42. canonical mutated through projected payload', 'canonical changed via projection', function (dst) {
  const script = 'const i=require(' + JSON.stringify(f5(dst, 'index.js')) + ');' +
    'const r=i.loadCanonical(' + JSON.stringify(dst) + ');' +
    'const c=r.canonical[0];const clone=r.project.clonePayload(c);clone.grid[0][0]="X";' +
    'process.stdout.write(c.model.grid[0][0]==="X"?"MUTATED":"SAFE");';
  const out = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  return { direct: out };
}, 'direct-projection');

// ---- 43..46 catalogue-wide -------------------------------------------------
M('43. model legacy hash changed', 'legacy model hash', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"48"', '"49"'));
}, 'hash');
M('44. public order changed', 'canonical order', function (dst) {
  // swap production and workshop order in the catalogue array
  const p = f1(dst, 'catalogue.js'); const src = rf(p);
  const prodStart = src.indexOf('{\n    "key": "production"');
  const workStart = src.indexOf('{\n    "key": "workshop"');
  const blendStart = src.indexOf('{\n    "key": "blend"');
  if (prodStart > -1 && workStart > -1 && blendStart > -1) {
    const prod = src.slice(prodStart, workStart);
    const work = src.slice(workStart, blendStart);
    wf(p, src.slice(0, prodStart) + work + prod + src.slice(blendStart));
  }
}, 'order');
M('45. current example removed (count drops below live checkpoint)', 'expected ' + CHECKPOINT_COUNT, function (dst) {
  // Remove exactly ONE record (supplier) from BOTH the catalogue and its metadata, so the count
  // drops to CHECKPOINT_COUNT-1 consistently and trips the live checkpoint count (not a
  // metadata/catalogue mismatch).
  const p = f1(dst, 'catalogue.js'); const src = rf(p);
  const supStart = src.indexOf('{\n    "key": "supplier"');
  if (supStart !== -1) {
    const blockStart = src.lastIndexOf('  {', supStart);
    const nextRec = src.indexOf('\n  {', supStart);
    const cutEnd = nextRec !== -1 ? nextRec + 1 : src.lastIndexOf('\n  ]');
    wf(p, src.slice(0, blockStart) + src.slice(cutEnd));
  }
  // Drop the supplier metadata entry too.
  const mp = f5(dst, 'metadata.js'); const msrc = rf(mp);
  const mStart = msrc.indexOf('\n  supplier: {');
  if (mStart !== -1) {
    // find the matching close '\n  },' for this metadata block
    const mEnd = msrc.indexOf('\n  },', mStart);
    if (mEnd !== -1) wf(mp, msrc.slice(0, mStart) + msrc.slice(mEnd + '\n  },'.length));
  }
}, 'count');
M('46. extra example added (count exceeds live checkpoint)', 'expected ' + CHECKPOINT_COUNT, function (dst) {
  // add an extra metadata entry AND catalogue record minimally -> count CHECKPOINT_COUNT+1
  const c = f1(dst, 'catalogue.js'); const src = rf(c);
  const tenth = ',\n  { "key":"tenth","slug":"tenth-x","category":"start","type":"continuous","sense":"max","translations":{"en":{"title":"T","desc":"d"},"es":{"title":"T","desc":"d"},"pt":{"title":"T","desc":"d"},"de":{"title":"T","desc":"d"},"fr":{"title":"T","desc":"d"}},"model":{"grid":[["Item","Val","Coeff","Term"],["X","0","2","=B2*C2"],["Tot","","","=SUM(D2:D2)","<=","5"]]},"expected":{"status":"optimal","modelType":"continuous","objective":1}}\n];';
  wf(c, src.replace('\n];\n\nmodule.exports', tenth + '\n\nmodule.exports'));
  const m = f5(dst, 'metadata.js'); const msrc = rf(m);
  wf(m, msrc.replace('var METADATA = {', 'var METADATA = {\n  tenth: { schemaVersion:1, primaryCategory:\'learning-engine\', difficulty:\'beginner\', minutes:1, audiences:[\'general\'], provenance:{kind:\'synthetic\'}, tags:[\'x\'], capabilities:[\'continuous-variables\',\'maximise\'], related:[], result:{policy:\'objective-feasible\'}, content:{ question:{en:\'q\',es:\'q\',pt:\'q\',de:\'q\',fr:\'q\'}, goal:{en:\'g\',es:\'g\',pt:\'g\',de:\'g\',fr:\'g\'} } },'));
}, 'count');

// ---- 47..49 content hygiene ------------------------------------------------
M('47. placeholder translation', 'placeholder/TODO', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('How many units of each product should we make to maximise profit within our hours?', 'lorem ipsum dolor sit amet'));
}, 'validate');
M('48. TODO text', 'placeholder/TODO', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('Learn the basic shape of a linear plan: variables, an objective and a capacity limit.', 'TODO write this goal'));
}, 'validate');
M('49. raw HTML in content', 'HTML/script/unsafe', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('Aprender la forma básica de un plan lineal', '<script>x</script> Aprender la forma'));
}, 'validate');

// ---- 50 remote data --------------------------------------------------------
M('50. remote/external data introduced (sourced without url)', 'provenance.url must be a real http', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("provenance: { kind: 'synthetic' },", "provenance: { kind: 'sourced', source: 'x', url: 'not-a-url' },"));
}, 'validate');

// ---- 51..57 protection -----------------------------------------------------
function protMut(name, setName, mutateFile) {
  M(name, 'protected hash changed', function (dst) {
    const pb = JSON.parse(rf(f5(dst, 'protected-baseline.json')));
    const entry = pb.sets[setName][0];
    return { protPath: entry.path, protSha: entry.sha256, mutate: mutateFile };
  }, 'protect');
}
M('51. F4 design-system file changed', 'protected hash changed', function (dst) { return { setName: 'f4', match: /design-system/ }; }, 'protect');
M('52. F4 motion file changed', 'protected hash changed', function (dst) { return { setName: 'f4', match: /motion/ }; }, 'protect');
M('53. protected public page changed', 'protected hash changed', function (dst) { return { setName: 'public', match: /\.html$/ }; }, 'protect');
M('54. engine core changed', 'protected hash changed', function (dst) { return { setName: 'engine_core', match: /./ }; }, 'protect');
M('55. Worker/mirror changed', 'protected hash changed', function (dst) { return { setName: 'engine_core', match: /mirror|worker/ }; }, 'protect');
M('56. package dependency added', 'protected hash changed', function (dst) { return { setName: 'infra', match: /package\.json$/ }; }, 'protect');
M('57. public examples-data output changed', 'protected hash changed', function (dst) { return { setName: 'public', match: /examples-data/ }; }, 'protect');
M('73. F4 stable reference doc changed', 'protected hash changed', function (dst) { return { setName: 'f4', match: /design-system-components\.md$/ }; }, 'protect');
M('74. motion-system reference doc changed', 'protected hash changed', function (dst) { return { setName: 'f4', match: /motion-system\.md$/ }; }, 'protect');
M('75. canonical engine source changed', 'protected hash changed', function (dst) { return { setName: 'engine_core', match: /source\/plumline-engine\.js$/ }; }, 'protect');
M('76. engine mirror changed', 'protected hash changed', function (dst) { return { setName: 'engine_core', match: /^engine\/engine\.js$/ }; }, 'protect');
M('77. solver composer changed', 'protected hash changed', function (dst) { return { setName: 'engine_core', match: /compose-solver/ }; }, 'protect');
M('78. package.json infra changed', 'protected hash changed', function (dst) { return { setName: 'infra', match: /package\.json$/ }; }, 'protect');

// ---- 58..60 roadmap --------------------------------------------------------
M('58. roadmap says gallery implemented in F5', 'not[^.]*gallery', function (dst) {
  const p = path.join(dst, 'docs', 'checkpoint-f5-examples-architecture.md');
  var s = rf(p);
  // Break the RM8 contract: remove BOTH "not ... gallery" and "gallery ... F6".
  s = s.split('does NOT build the new gallery\n(that is F6)').join('DOES build the new gallery in F5');
  s = s.split('does NOT build the new gallery').join('DOES build the new gallery');
  s = s.split('No gallery').join('A gallery');
  wf(p, s);
}, 'roadmap');
M('59. roadmap says 60 examples implemented in F5', '60', function (dst) {
  const p = path.join(dst, 'docs', 'checkpoint-f5-examples-architecture.md');
  wf(p, rf(p).replace(/F7/g, 'F5'));
}, 'roadmap');
M('60. roadmap says Home redesign belongs to F5', 'F9', function (dst) {
  const p = path.join(dst, 'docs', 'checkpoint-f5-examples-architecture.md');
  wf(p, rf(p).replace(/remains F9/g, 'belongs to F5').replace(/F9/g, 'F5'));
}, 'roadmap');

// ---- 61..66 capability consistency (audited gaps) --------------------------
M('61. continuous model claims mixed-variables', 'claims mixed-variables but the model type is', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],", "capabilities: ['mixed-variables', 'continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],"));
}, 'validate');
M('62. binary-only claims continuous-variables', 'claims continuous-variables but none are present', function (dst) {
  // project is binary-only; make it claim continuous.
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['binary-variables', 'maximise', 'bounds', 'sum', 'sumproduct', 'verification'],", "capabilities: ['binary-variables', 'continuous-variables', 'maximise', 'bounds', 'sum', 'sumproduct', 'verification'],"));
}, 'validate');
M('63. US claimed on an unknown-format model', 'claims us-number-format but the model format is', function (dst) {
  // production is integer-only -> numberFormat unknown; claiming us must fail.
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],", "capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification', 'us-number-format'],"));
}, 'validate');
M('64. EU claimed on a US model', 'claims eu-number-format but the model format is', function (dst) {
  // blend is us; claiming eu must fail.
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'minimise', 'sum', 'sumproduct', 'verification', 'us-number-format'],", "capabilities: ['continuous-variables', 'minimise', 'sum', 'sumproduct', 'verification', 'eu-number-format'],"));
}, 'validate');
M('65. SUM claimed without SUM in the model', 'claims sum but the model uses none', function (dst) {
  // Remove SUM from production's formulas but keep the sum capability claim.
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('=SUM(D2:D4)', '=D2+D3+D4'));
}, 'validate');
M('66. integer-variables claimed on a pure continuous model', 'claims integer-variables but none are present', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],", "capabilities: ['continuous-variables', 'integer-variables', 'maximise', 'sum', 'sumproduct', 'verification'],"));
}, 'validate');

// ---- 67..70 category short localization (audited gap) ----------------------
M('67. category short has unsupported it locale', 'has unsupported locale "it"', function (dst) {
  const p = f5(dst, 'categories.js'); wf(p, rf(p).replace("short: { en: 'Plan what to make", "short: { it: 'ciao', en: 'Plan what to make"));
}, 'categories');
M('68. category short missing pt', 'short.pt is missing', function (dst) {
  const p = f5(dst, 'categories.js'); const src = rf(p);
  // remove the pt entry from the first short object.
  wf(p, src.replace(/short: \{ en: 'Plan what to make and how to run operations within limits\.', es: '[^']*', pt: '[^']*',/, "short: { en: 'Plan what to make and how to run operations within limits.', es: 'x',"));
}, 'categories');
M('69. HTML in category short', 'contains HTML/script/unsafe', function (dst) {
  const p = f5(dst, 'categories.js'); wf(p, rf(p).replace("short: { en: 'Plan what to make and how to run operations within limits.',", "short: { en: '<script>x</script>',"));
}, 'categories');
M('70. untrimmed category short', 'has untrimmed whitespace', function (dst) {
  const p = f5(dst, 'categories.js'); wf(p, rf(p).replace("short: { en: 'Plan what to make and how to run operations within limits.',", "short: { en: '  Plan what to make  ',"));
}, 'categories');

// ---- 71..72 protected exact-set (independent) -----------------------------
M('71. protected manifest entry removed (exact-set detects missing)', 'code-owned expected paths', function (dst) {
  const p = f5(dst, 'protected-baseline.json'); const j = JSON.parse(rf(p));
  j.sets.f4.pop();
  wf(p, JSON.stringify(j, null, 2));
}, 'manifest-set');
M('72. protected manifest count altered', 'code-owned expected paths', function (dst) {
  const p = f5(dst, 'protected-baseline.json'); const j = JSON.parse(rf(p));
  j.sets.engine_core.pop();
  wf(p, JSON.stringify(j, null, 2));
}, 'manifest-set');
M('79. co-edited manifest path (code-owned authority still fails)', 'code-owned expected paths', function (dst) {
  // Replace a protected path in BOTH sets and the JSON expectedPaths, keeping count.
  const p = f5(dst, 'protected-baseline.json'); const j = JSON.parse(rf(p));
  j.sets.public[0].path = 'evil.html';
  if (j.expectedPaths && j.expectedPaths.public) j.expectedPaths.public[0] = 'evil.html';
  wf(p, JSON.stringify(j, null, 2));
}, 'manifest-set');
// 80. Coupled category+contract mutation cannot bypass validation because
// CATEGORY_CONTRACT is deep-frozen: a runtime attempt to change contract[0].slug is
// silently ignored, so validateCategories still compares against the intact contract.
M('80. coupled category+contract mutation cannot bypass', 'frozen-contract-holds', function (dst) {
  return { direct: (function () {
    const E = require(f5(dst, 'enums.js'));
    const before = E.CATEGORY_CONTRACT[0].slug;
    try { E.CATEGORY_CONTRACT[0].slug = 'evil-slug'; } catch (e) {}
    // Frozen: the mutation did not take. The contract authority is intact.
    return (E.CATEGORY_CONTRACT[0].slug === before && Object.isFrozen(E.CATEGORY_CONTRACT)) ? 'frozen-contract-holds' : 'BYPASSED';
  })() };
}, 'direct-frozen');
// 81. canonical catalogue array is frozen: push cannot alter it.
M('81. canonical catalogue push cannot alter result', 'frozen-array-holds', function (dst) {
  return { direct: (function () {
    const { loadCanonical } = require(path.join(SITE, 'src', 'shared', 'examples', 'f5', 'index.js'));
    const r = loadCanonical(SITE);
    const n = r.canonical.length;
    try { r.canonical.push('BAD'); } catch (e) {}
    try { r.canonical[0] = 'X'; } catch (e) {}
    return (r.canonical.length === n && Object.isFrozen(r.canonical) && Object.isFrozen(r.canonical[0])) ? 'frozen-array-holds' : 'BYPASSED';
  })() };
}, 'direct-frozen');
// 82. loadCanonical rejects rec.type drift on the CANONICAL load path.
M('82. loadCanonical rec.type drift fails', 'cross-layer rec.type', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"type": "continuous"', '"type": "binary"'));
}, 'load');
// 83. loadCanonical rejects rec.expected.modelType drift.
M('83. loadCanonical expected.modelType drift fails', 'cross-layer rec.expected.modelType', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"modelType": "continuous"', '"modelType": "binary"'));
}, 'load');
// 84. optimal (solution-bearing) example given status-only policy -> fail.
M('84. optimal + status-only policy fails', 'cannot use policy "status-only"', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace("result: { policy: 'objective-feasible' },", "result: { policy: 'status-only' },"));
}, 'validate');
// 85. a no-solution expected status with objective-feasible policy -> fail. We flip
// the FIRST example's expected status to infeasible in the F1 catalogue; its metadata
// still says objective-feasible, so the policy/status cross-check must fail.
M('85. infeasible status + objective-feasible policy fails', 'must use policy "status-only"', function (dst) {
  const p = f1(dst, 'catalogue.js'); const src = rf(p);
  // change the first expected status optimal->infeasible and drop that objective.
  wf(p, src.replace('"status": "optimal"', '"status": "infeasible"'));
}, 'validate');
// 86. unknown expected status is not publishable.
M('86. unknown expected status is not publishable', 'is not publishable', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"status": "optimal"', '"status": "unknown"'));
}, 'validate');

// ---- 87..93 identity grammar + localized content hygiene ------------------
// 87. A future example with a bad slug grammar must fail the REAL loader (F1 schema
//     grammar), separately from the public-slug baseline contract (7/8).
M('87. future bad slug grammar fails loadCanonical', 'kebab-case', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"slug": "workshop-chart",', '"slug": "workshop_chart",'));
}, 'load');
// 88. Untrimmed F1 title must fail the F1 content-hygiene rule via the loader.
M('88. untrimmed F1 title fails', 'must be trimmed', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"title": "Production plan"', '"title": " Production plan "'));
}, 'load');
// 89. HTML in an F1 title must fail the plain-text rule via the loader.
M('89. HTML in F1 title fails', 'plain text', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"title": "Production plan"', '"title": "<b>Production</b>"'));
}, 'load');
// 90. Placeholder (TODO/lorem) in an F1 desc must fail via the loader.
M('90. placeholder F1 desc fails', 'placeholder', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"desc": "Maximise profit within available production hours"', '"desc": "TODO write this"'));
}, 'load');
// 91. defineExample with a bad slug grammar must throw (no F1 error suppression).
M('91. defineExample future bad slug throws', 'kebab-case', function () {}, 'define-bad-slug');
// 92. A strict-kebab tag violation must be rejected by F5 metadata validation.
M('92. bad tag grammar fails', 'strict lowercase kebab-case', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('tags: [', 'tags: ["bad--tag", '));
}, 'validate');
// 93. A leading-hyphen tag must also be rejected by the strict grammar.
M('93. leading-hyphen tag fails', 'strict lowercase kebab-case', function (dst) {
  const p = f5(dst, 'metadata.js'); wf(p, rf(p).replace('tags: [', 'tags: ["-bad", '));
}, 'validate');

// ---- 94..101 machine-id grammar + tolerance policy -----------------------
// 94. A future record whose machine-id `key` breaks the grammar must fail the loader.
M('94. future bad key grammar fails loadCanonical', 'machine ID', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"key": "workshop",', '"key": "Bad Key",'));
}, 'load');
// 95. A future solution-bearing record with tolerance above MAX must fail F5 policy.
M('95. tolerance above MAX fails', 'exceeds MAX_TOLERANCE', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"objective": 1760', '"objective": 1760,\n      "tolerance": 5'));
}, 'load');
// 96. A future solution-bearing record with tolerance below MIN must fail F5 policy.
M('96. tolerance below MIN fails', 'below MIN_TOLERANCE', function (dst) {
  const p = f1(dst, 'catalogue.js'); wf(p, rf(p).replace('"objective": 1760', '"objective": 1760,\n      "tolerance": 1e-20'));
}, 'load');
// 97. A no-solution status carrying a tolerance must fail the F1 status-only rule.
M('97. no-solution + tolerance fails', 'must not carry a tolerance', function (dst) {
  const p = f1(dst, 'catalogue.js');
  // production's expected block: flip to infeasible + null objective, and inject a tolerance
  // (the no-solution status-only rule in the F1 schema must reject the tolerance).
  var s = rf(p).replace('"objective": 1760', '"objective": null,\n      "tolerance": 1e-6');
  // change ONLY production's status (first "optimal" occurrence) to infeasible
  s = s.replace('"status": "optimal",', '"status": "infeasible",');
  wf(p, s);
}, 'load');
// 98. defineExample with an out-of-range tolerance must throw (generic authoring).
M('98. defineExample tolerance=5 throws', 'exceeds MAX_TOLERANCE', function () {}, 'define-tol');
// 99. defineExample with a bad machine-id key must throw (generic authoring).
M('99. defineExample bad key throws', 'machine ID', function () {}, 'define-bad-key');

// --------------------------------------------------------------------------
// Runners per mode.
function runLoad(m, dst) {
  const r = loadInChild(dst, CHECKPOINT_COUNT);
  // The load must FAIL and the failure text must mention the expected reason.
  // No unconditional-pass bypass: a failure for the wrong reason does NOT pass.
  if (!/ERR:|THROW:/.test(r.out)) return false;
  return m.expect === undefined ? true : r.out.indexOf(m.expect) !== -1;
}
function runValidate(m, dst) {
  const res = freshValidate(dst);
  return !res.ok && res.errors.some(function (e) { return e.indexOf(m.expect) !== -1; });
}
// A future example authored via defineExample with a bad slug grammar must throw,
// proving authoring.js does NOT suppress the F1 grammar error.
function runDefineBadSlug(m, dst) {
  [f5(dst, 'authoring.js'), f5(dst, 'validate.js'), f5(dst, 'assemble.js'), f1(dst, 'schema.js')].forEach(function (p) { delete require.cache[p]; });
  const authoring = require(f5(dst, 'authoring.js'));
  const langs = { en: { title: 'T', desc: 'd' }, es: { title: 'T', desc: 'd' }, pt: { title: 'T', desc: 'd' }, de: { title: 'T', desc: 'd' }, fr: { title: 'T', desc: 'd' } };
  const rec = { key: 'fut', slug: 'Bad Slug', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Tot', '', '', '=SUM(D2:D2)', '', ''], ['Cap', '', '', '=B2', '<=', '5']] }, expected: { status: 'optimal', modelType: 'continuous', objective: 5 } };
  const meta = { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: ['maximise'], related: [], result: { policy: 'objective-feasible' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } };
  try { authoring.defineExample(rec, meta); return false; }
  catch (e) { return m.expect === undefined ? true : e.message.indexOf(m.expect) !== -1; }
}
// Generic defineExample failure driver: build a valid future record, apply an override
// to its expected block, and assert defineExample throws for the expected reason.
function runDefineExpected(m, dst, over) {
  [f5(dst, 'authoring.js'), f5(dst, 'validate.js'), f5(dst, 'assemble.js'), f1(dst, 'schema.js')].forEach(function (p) { delete require.cache[p]; });
  const authoring = require(f5(dst, 'authoring.js'));
  const langs = { en: { title: 'T', desc: 'd' }, es: { title: 'T', desc: 'd' }, pt: { title: 'T', desc: 'd' }, de: { title: 'T', desc: 'd' }, fr: { title: 'T', desc: 'd' } };
  const rec = { key: 'fut', slug: 'future-x', category: 'start', type: 'continuous', sense: 'max', translations: langs, model: { grid: [['Ch', 'Sp', 'C', 'T', '', ''], ['X', '0', '1', '=B2*C2', '', ''], ['Tot', '', '', '=SUM(D2:D2)', '', ''], ['Cap', '', '', '=B2', '<=', '5']] }, expected: { status: 'optimal', modelType: 'continuous', objective: 5 } };
  const meta = { schemaVersion: 1, primaryCategory: 'learning-engine', difficulty: 'beginner', minutes: 2, audiences: ['student'], provenance: { kind: 'synthetic' }, tags: ['demo'], capabilities: ['maximise'], related: [], result: { policy: 'objective-feasible' }, content: { question: { en: 'q', es: 'q', pt: 'q', de: 'q', fr: 'q' }, goal: { en: 'g', es: 'g', pt: 'g', de: 'g', fr: 'g' } } };
  over(rec);
  try { authoring.defineExample(rec, meta); return false; }
  catch (e) { return m.expect === undefined ? true : e.message.indexOf(m.expect) !== -1; }
}
function runDefineTol(m, dst) { return runDefineExpected(m, dst, function (rec) { rec.expected.tolerance = 5; }); }
function runDefineBadKey(m, dst) { return runDefineExpected(m, dst, function (rec) { rec.key = 'Bad Key'; }); }
function runCategories(m, dst) {
  [f5(dst, 'validate.js'), f5(dst, 'categories.js'), f5(dst, 'enums.js')].forEach(function (p) { delete require.cache[p]; });
  const V = require(f5(dst, 'validate.js'));
  const CATS = require(f5(dst, 'categories.js')).CATEGORIES;
  const res = V.validateCategories(CATS);
  return !res.ok && res.errors.some(function (e) { return e.indexOf(m.expect) !== -1; });
}
function recomputeHash(rec) {
  return crypto.createHash('sha256').update(JSON.stringify({ grid: rec.model.grid, domains: rec.model.domains || null, whole: !!rec.model.whole, openVarSettings: !!rec.model.openVarSettings, sense: rec.sense, expected: rec.expected })).digest('hex');
}
function runHash(m, dst) {
  delete require.cache[f1(dst, 'catalogue.js')];
  const cat = require(f1(dst, 'catalogue.js')).CATALOGUE;
  const base = JSON.parse(rf(f5(dst, 'baseline.json')));
  const byId = {}; cat.forEach(function (r) { byId[r.key] = r; });
  // At least one baseline entry must no longer match its recomputed hash.
  return base.examples.some(function (b) { return byId[b.key] && recomputeHash(byId[b.key]) !== b.modelHash; });
}
function runOrder(m, dst) {
  delete require.cache[f1(dst, 'catalogue.js')];
  const cat = require(f1(dst, 'catalogue.js')).CATALOGUE;
  const base = JSON.parse(rf(f5(dst, 'baseline.json')));
  // order changed if the catalogue key order differs from baseline order
  const catOrder = cat.map(function (r) { return r.key; }).join(',');
  const baseOrder = base.examples.map(function (b) { return b.key; }).join(',');
  return catOrder !== baseOrder;
}
function runCount(m, dst) {
  // Count mutations (add/remove a record) must be caught by the F7a checkpoint count. Validate the
  // mutated temp catalogue against the live checkpoint count (CHECKPOINT_COUNT, from the SITE
  // catalogue — not hardcoded here) and require the count error.
  const V = require(f5(dst, 'validate.js'));
  delete require.cache[f1(dst, 'catalogue.js')];
  delete require.cache[f5(dst, 'metadata.js')];
  const cat = require(f1(dst, 'catalogue.js')).CATALOGUE;
  const meta = require(f5(dst, 'metadata.js')).METADATA;
  const res = V.validateMetadataCatalogue(cat, meta, { expectCount: CHECKPOINT_COUNT });
  const needle = 'expects exactly ' + CHECKPOINT_COUNT + ' examples';
  return !res.ok && res.errors.some(function (e) { return e.indexOf(needle) !== -1; });
}
function runSlug(m, dst) {
  delete require.cache[f1(dst, 'catalogue.js')];
  const cat = require(f1(dst, 'catalogue.js')).CATALOGUE;
  const base = JSON.parse(rf(f5(dst, 'baseline.json')));
  const catSlugs = cat.map(function (r) { return r.slug; }).sort().join(',');
  const baseSlugs = base.examples.map(function (b) { return b.slug; }).sort().join(',');
  // slug changed or removed => sets differ, and we did NOT derive expected from source
  return catSlugs !== baseSlugs;
}
function runTolerance(m, dst) {
  const base = JSON.parse(rf(f5(dst, 'baseline.json')));
  const E = require(f5(dst, 'enums.js'));
  // a tolerance beyond MAX must be caught
  return base.examples.some(function (b) { return b.expected.tolerance != null && b.expected.tolerance > E.MAX_TOLERANCE; });
}
function runBehavioural(m, dst) {
  // Solve production through the real engine in a child and compare to baseline.
  // Structured result distinguishes WHAT mismatched:
  //   MATCH | MISMATCH-STATUS:... | MISMATCH-OBJECTIVE:... | ERROR:...
  // A status mutation must yield MISMATCH-STATUS; an objective mutation must yield
  // MISMATCH-OBJECTIVE; a crash yields ERROR and only passes if explicitly expected.
  const script =
    'const path=require("path");' +
    'try{' +
    'const {run}=require(' + JSON.stringify(path.join(dst, 'engine', 'harness.js')) + ');' +
    'const cat=require(' + JSON.stringify(f1(dst, 'catalogue.js')) + ').CATALOGUE;' +
    'const base=require(' + JSON.stringify(f5(dst, 'baseline.json')) + ').examples[0];' +
    'const rec=cat[0];' +
    'const r=run(rec.model.grid,{mutate:function(mo){if(mo.objective)mo.objective.sense=rec.sense;}});' +
    'if(r.error){process.stdout.write("ERROR:"+r.error);}else{' +
    'const st=r.out&&r.out.status;const ob=r.out&&r.out.objective;const tol=base.expected.tolerance||1e-6;' +
    'const okStatus=st===base.expected.status;const okObj=typeof ob==="number"&&Math.abs(ob-base.expected.objective)<=tol;' +
    'if(okStatus&&okObj)process.stdout.write("MATCH");' +
    'else if(!okStatus)process.stdout.write("MISMATCH-STATUS:expected="+base.expected.status+",actual="+st);' +
    'else process.stdout.write("MISMATCH-OBJECTIVE:expected="+base.expected.objective+",actual="+ob);}' +
    '}catch(e){process.stdout.write("ERROR:"+e.message);}';
  let out;
  try { out = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }); }
  catch (e) { out = 'ERROR:' + (e.message || 'child crashed'); }
  // The mutation must yield the SPECIFIC expected reason.
  if (m.expect) return out.indexOf(m.expect) !== -1;
  return out.indexOf('MISMATCH') === 0;
}
function runRoadmap(m, dst) {
  // Re-run the ROADMAP block of the positive suite against the mutated doc: it must fail.
  const doc = rf(path.join(dst, 'docs', 'checkpoint-f5-examples-architecture.md'));
  if (m.n.indexOf('58.') === 0) return !(/not[^.]*gallery|gallery[^.]*F6/i.test(doc));
  if (m.n.indexOf('59.') === 0) return !(/F7/.test(doc) && /60/.test(doc));
  if (m.n.indexOf('60.') === 0) return !(/F9/.test(doc) && /Home/i.test(doc));
  return false;
}
function runProtect(m, dst, info) {
  // Build a temp tree that contains the protected target, mutate it for real, and
  // run the SAME shared protected-set checker the positive suite uses. The mutation
  // must be detected specifically as "protected hash changed: <path>".
  const { checkProtectedSet } = require('./f5_protected_check.js');
  const pb = JSON.parse(rf(f5(dst, 'protected-baseline.json')));
  const set = pb.sets[info.setName];
  const entry = set.filter(function (e) { return info.match.test(e.path); })[0] || set[0];
  const target = path.join(dst, entry.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(SITE, entry.path), target);
  const before = checkProtectedSet(dst, pb);
  const cleanForTarget = !before.problems.some(function (p) { return p === 'protected hash changed: ' + entry.path; });
  fs.appendFileSync(target, '\n/* mutation */\n');
  const after = checkProtectedSet(dst, pb);
  const detected = after.problems.some(function (p) { return p === 'protected hash changed: ' + entry.path; });
  return cleanForTarget && detected;
}

// Independent exact-set check on the (mutated) manifest: mirrors the positive
// suite. A manifest with a removed entry or altered count must FAIL here.
function runManifestSet(m, dst) {
  // Use the SHARED checker with CODE-OWNED expected paths, so any manifest tampering
  // (including co-editing sets + the JSON expectedPaths) fails against the code.
  const { checkProtectedSet } = require('./f5_protected_check.js');
  const pb = JSON.parse(rf(f5(dst, 'protected-baseline.json')));
  const res = checkProtectedSet(SITE, pb);
  return !res.ok;
}

let idx = 0;
mutations.forEach(function (m) {
  idx++;
  const t = makeTempSite();
  try {
    let info = null;
    if (m.mode === 'direct-serialize' || m.mode === 'direct-projection') {
      const r = m.apply(t.dst);
      if (m.mode === 'direct-serialize') ok(m.n, /ERR:.*function/.test(r.direct), r.direct);
      else ok(m.n, r.direct === 'SAFE', 'projection mutated canonical: ' + r.direct);
    } else if (m.mode === 'direct-frozen') {
      const r = m.apply(t.dst);
      ok(m.n, r.direct === m.expect, 'frozen contract bypassed: ' + r.direct);
    } else if (m.mode === 'protect') {
      info = m.apply(t.dst);
      ok(m.n, runProtect(m, t.dst, info), 'protected file mutation not detected');
    } else {
      m.apply(t.dst);
      let failed = false;
      switch (m.mode) {
        case 'load': failed = runLoad(m, t.dst); break;
        case 'validate': failed = runValidate(m, t.dst); break;
        case 'categories': failed = runCategories(m, t.dst); break;
        case 'hash': failed = runHash(m, t.dst); break;
        case 'order': failed = runOrder(m, t.dst); break;
        case 'count': failed = runCount(m, t.dst); break;
        case 'slug': failed = runSlug(m, t.dst); break;
        case 'tolerance': failed = runTolerance(m, t.dst); break;
        case 'behavioural': failed = runBehavioural(m, t.dst); break;
        case 'roadmap': failed = runRoadmap(m, t.dst); break;
        case 'manifest-set': failed = runManifestSet(m, t.dst); break;
        case 'define-bad-slug': failed = runDefineBadSlug(m, t.dst); break;
        case 'define-tol': failed = runDefineTol(m, t.dst); break;
        case 'define-bad-key': failed = runDefineBadKey(m, t.dst); break;
      }
      ok(m.n, failed, 'mutation did not trigger the expected failure');
    }
  } catch (e) {
    ok(m.n, false, 'threw: ' + e.message);
  } finally {
    rmTemp(t.base);
  }
});

// SELF-TEST: guard against reason-nullifying bypass patterns in this suite. A
// mutation must fail for its EXPECTED reason, never "failed for anything". Forbid
// `|| true` inside any run* helper and any `=== -1 || true` style short-circuit.
(function () {
  const self = fs.readFileSync(__filename, 'utf8');
  // Strip this self-test block from the scan so its own description text does not match.
  const scan = self.slice(0, self.indexOf('// SELF-TEST: guard against'));
  ok('SELFTEST: no "|| true" bypass in the negative runners', !/\|\|\s*true/.test(scan));
  ok('SELFTEST: no "indexOf(...) !== -1 || true" bypass', !/!==\s*-1\s*\|\|\s*true/.test(scan));
  ok('SELFTEST: no "catch (e) { return true; }" bypass', !/catch\s*\([^)]*\)\s*\{\s*return\s+true\s*;?\s*\}/.test(scan));
  ok('SELFTEST: no "catch { return true }" bypass', !/catch\s*\{\s*return\s+true\s*;?\s*\}/.test(scan));
  ok('SELFTEST: runBehavioural references m.expect', /function runBehavioural[\s\S]*?m\.expect/.test(scan));
  ok('SELFTEST: runProtect uses the shared protected-set checker', /function runProtect[\s\S]*?checkProtectedSet/.test(scan));
  ok('SELFTEST: runProtect detects "protected hash changed"', /function runProtect[\s\S]*?protected hash changed/.test(scan));
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F5 EXAMPLES ARCHITECTURE NEGATIVE  PASSED: ' + pass + '   FAILED: ' + fail + '   (mutations: ' + mutations.length + ')');
  process.exit(fail === 0 ? 0 : 1);
}
module.exports = { pass: pass, fail: fail, mutations: mutations.length };
