'use strict';

/*
 * Checkpoint F3c — negative mutation suite (hardened).
 *
 * Proves the F3c contracts (tests_f3c_home_sections.js) FAIL for the right reason
 * when product truth is violated. Each mutation declares an edit, an expected
 * change (proof the file was modified) and an expectedFailure (the specific
 * contract that must fail). A mutation passes ONLY when: the edit applied, the
 * suite exited non-zero, its output contains the expected contract, and the
 * output has NO SyntaxError / MODULE_NOT_FOUND / other infrastructure failure. A
 * clean control tree must pass.
 *
 * Windows-portable: temp trees via fs.cpSync / fs.rmSync into an mkdtemp path with
 * a space; the suite runs via process.execPath; cleanup in finally. No external
 * shell tools.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const siteDir = path.join(__dirname, '..');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); } }

function makeTree() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'f3c neg-'));
  ['engine', 'assets', 'src'].forEach(function (rel) {
    fs.cpSync(path.join(siteDir, rel), path.join(base, rel), { recursive: true });
  });
  fs.copyFileSync(path.join(siteDir, 'index.html'), path.join(base, 'index.html'));
  return base;
}
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }

function runSuite(dir) {
  try {
    const out = cp.execFileSync(process.execPath, [path.join(dir, 'engine', 'tests_f3c_home_sections.js')],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: out.toString(), err: '' };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: (e.stdout || '').toString(), err: (e.stderr || '').toString() };
  }
}
function read(dir, file) { return fs.readFileSync(path.join(dir, file), 'utf8'); }
function write(dir, file, s) { fs.writeFileSync(path.join(dir, file), s); }

const MUTATIONS = [
  {
    name: 'COUNTIF introduced in the Home',
    file: 'index.html',
    apply: function (s) { return s.replace('Export the result', 'Export the result via COUNTIF'); },
    expectedFailure: 'no COUNTIF'
  },
  {
    name: 'fake waitlist (EN add-on copy)',
    file: 'assets/i18n.js',
    apply: function (s) { return s.replace('currently in review', 'join the waitlist to reserve your spot'); },
    expectedFailure: '[en] no forbidden claim (waitlist/spot reservation)'
  },
  {
    name: 'personal @gmail.com in the Home',
    file: 'index.html',
    apply: function (s) { return s.replace('contact@plumline.online', 'plumline.dev@gmail.com'); },
    expectedFailure: 'no personal @gmail.com'
  },
  {
    name: 'forbidden absolute claim (EN limits prose)',
    file: 'assets/i18n.js',
    apply: function (s) {
      return s.replace(
        "limSolvesP:'Continuous, integer, binary and mixed models where the objective and constraints are linear.'",
        "limSolvesP:'A guaranteed perfect answer, always correct and error-free.'"
      );
    },
    expectedFailure: '[en] no forbidden claim'
  },
  {
    name: 'F3c section removed (privacy)',
    file: 'index.html',
    apply: function (s) { return s.replace(/<section class="section" id="privacy">[\s\S]*?<\/section>/, ''); },
    expectedFailure: 'F3c section present: #privacy'
  },
  {
    name: 'add-on presented as available now (EN)',
    file: 'assets/i18n.js',
    apply: function (s) { return s.replace('The Google Sheets add-on is currently in review.', 'The Google Sheets add-on is available now, download now.'); },
    expectedFailure: '[en] no forbidden claim (add-on available now)'
  },
  {
    name: 'forbidden claim in SPANISH translation only',
    file: 'assets/i18n.js',
    apply: function (s) {
      return s.replace(
        "limSolvesP:'Modelos continuos, enteros, binarios y mixtos donde el objetivo y las restricciones son lineales.'",
        "limSolvesP:'Respuesta perfecta y siempre correcta, totalmente garantizada.'"
      );
    },
    expectedFailure: '[es] no forbidden claim'
  },
  {
    name: 'forbidden claim in GERMAN translation only',
    file: 'assets/i18n.js',
    apply: function (s) {
      return s.replace(
        "limSolvesP:'Kontinuierliche, ganzzahlige, binäre und gemischte Modelle, bei denen Zielsetzung und Nebenbedingungen linear sind.'",
        "limSolvesP:'Perfekte, immer korrekte und garantierte Antwort.'"
      );
    },
    expectedFailure: '[de] no forbidden claim'
  },
  {
    // Alter ONLY a JSON-LD answer text so it no longer matches the visible answer.
    name: 'JSON-LD answer text altered (breaks answer parity)',
    file: 'index.html',
    apply: function (s) {
      // The FAQ JSON-LD is one line of JSON; change the first acceptedAnswer text.
      return s.replace(/("acceptedAnswer":\{"@type":"Answer","text":")([^"]+)(")/, '$1TAMPERED ANSWER TEXT$3');
    },
    expectedFailure: 'each JSON-LD answer exactly matches the visible answer'
  },
  {
    // Empty href on the final CTA anchor.
    name: 'empty href introduced in the CTA',
    file: 'index.html',
    apply: function (s) {
      // Find the CTA section and blank the first anchor href within it.
      return s.replace(/(data-i18n="ctaTitle"[\s\S]*?<a\b[^>]*href=")([^"]*)(")/, '$1$3');
    },
    expectedFailure: 'has a non-empty href'
  },
  {
    // Internal link to a non-existent #id in the CTA.
    name: 'broken internal #id target in the CTA',
    file: 'index.html',
    apply: function (s) {
      return s.replace(/(data-i18n="ctaTitle"[\s\S]*?<a\b[^>]*href=")([^"]*)(")/, '$1#does-not-exist$3');
    },
    expectedFailure: 'internal link target #does-not-exist exists'
  },
  {
    // Inject a fifth, invented model capability card INSIDE the models card.
    name: 'invented fifth model capability card',
    file: 'index.html',
    apply: function (s) {
      // Add an extra <li> just before the </ul> of the models group card.
      return s.replace(
        /(<h3[^>]*data-i18n="capGroupModels"[\s\S]*?)(<\/ul>)/,
        '$1  <li><span data-i18n="capModelQuantumName">Quantum models</span></li>\n        $2'
      );
    },
    expectedFailure: 'real <li> count equals the canonical model count'
  },
  {
    // Duplicate an existing canonical card as a fifth entry (Set would hide this).
    name: 'duplicated canonical model card as a fifth entry',
    file: 'index.html',
    apply: function (s) {
      return s.replace(
        /(<h3[^>]*data-i18n="capGroupModels"[\s\S]*?)(<\/ul>)/,
        '$1  <li><span data-i18n="capModelContinuousName">Continuous models</span></li>\n        $2'
      );
    },
    expectedFailure: 'real <li> count equals the canonical model count'
  },
  {
    // Swap the order of the first two canonical model cards (order contract).
    name: 'swapped order of two canonical model cards',
    file: 'index.html',
    apply: function (s) {
      return s.replace(
        /(<li><span data-i18n="capModelContinuousName">[^<]*<\/span><\/li>\s*)(<li><span data-i18n="capModelIntegerName">[^<]*<\/span><\/li>)/,
        '$2\n          $1'
      );
    },
    expectedFailure: 'match canonical keys in exact order'
  },
  {
    // Change ONLY the visible text inside a <summary>, keeping its data-i18n, and
    // touching neither the dictionary nor the JSON-LD. Must trip the visible-
    // question canonical contract.
    name: 'visible <summary> question text tampered (dictionary/JSON-LD intact)',
    file: 'index.html',
    apply: function (s) {
      return s.replace(
        /(<summary data-i18n="faq1Q">)([^<]*)(<\/summary>)/,
        '$1Tampered visible question text$3'
      );
    },
    expectedFailure: 'visible question 0 is the escaped canonical text'
  },
  {
    // Insert a fifth, manual <li> WITHOUT data-i18n inside the models card. The
    // per-<li> extraction must see it and fail (no model nameKey / count).
    name: 'manual <li> without data-i18n in the models card',
    file: 'index.html',
    apply: function (s) {
      return s.replace(
        /(<h3[^>]*data-i18n="capGroupModels"[\s\S]*?)(<\/ul>)/,
        '$1  <li><span>Non-linear models</span></li>\n        $2'
      );
    },
    expectedFailure: 'has exactly one model nameKey'
  },
  {
    // Claim in Portuguese that non-linear models ARE supported.
    name: 'non-linear claimed supported in PORTUGUESE only',
    file: 'assets/i18n.js',
    apply: function (s) {
      return s.replace(
        "limUnsupportedP:'Indica se um resultado é comprovadamente ótimo, apenas viável ou incompleto, e rejeita termos não lineares e desigualdades estritas em vez de adivinhar.'",
        "limUnsupportedP:'Os modelos não lineares são totalmente suportados e resolvidos.'"
      );
    },
    expectedFailure: '[pt] limits'
  }
];

const INFRA = /(SyntaxError|MODULE_NOT_FOUND|Cannot find module|ReferenceError|TypeError:)/;

MUTATIONS.forEach(function (m) {
  const dir = makeTree();
  try {
    const before = read(dir, m.file);
    const after = m.apply(before);
    ok('negative[' + m.name + ']: mutation changes the file', after !== before, 'no change');
    write(dir, m.file, after);
    const r = runSuite(dir);
    const combined = r.out + '\n' + r.err;
    ok('negative[' + m.name + ']: suite exits non-zero', r.code === 1, 'code=' + r.code);
    ok('negative[' + m.name + ']: expected contract failed (' + m.expectedFailure + ')',
      combined.indexOf('FAIL: ') !== -1 && combined.indexOf(m.expectedFailure) !== -1,
      'expected "' + m.expectedFailure + '"');
    ok('negative[' + m.name + ']: no infrastructure error', !INFRA.test(combined),
      (combined.match(INFRA) || [''])[0]);
  } catch (e) {
    ok('negative[' + m.name + ']: harness ran', false, 'threw: ' + String(e.message).slice(0, 80));
  } finally {
    cleanup(dir);
  }
});

(function () {
  const dir = makeTree();
  try {
    const r = runSuite(dir);
    ok('negative[control]: clean temp tree passes', r.code === 0 && (r.out + r.err).indexOf('FAIL: ') === -1, 'code=' + r.code);
    ok('negative[control]: clean run has no infrastructure error', !INFRA.test(r.out + r.err));
  } finally { cleanup(dir); }
})();

(function () {
  const self = fs.readFileSync(path.join(__dirname, 'tests_f3c_home_sections_negative.js'), 'utf8');
  ['cp', 'rm', 'mv', 'sed', 'grep', 'bash', 'sh', 'cmd', 'powershell'].forEach(function (cmd) {
    const re = new RegExp('(?:execFileSync|execSync|spawnSync|spawn)\\s*\\(\\s*[\x27"]' + cmd + '[\x27"]');
    ok('negative: suite does not shell out to "' + cmd + '"', !re.test(self), cmd);
  });
  ok('negative: suite runs the F3c suite via process.execPath', /execFileSync\(process\.execPath/.test(self) || /cp\.execFileSync\(process\.execPath/.test(self));
})();

if (require.main === module) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f); });
  console.log('F3C HOME NEGATIVE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
}

module.exports = { pass: pass, fail: fail };
