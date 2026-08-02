/* tests_needle_audit.js — static audit of the five solver negative suites.
 *
 * Contract (Checkpoint D v3): every checker-based negative (expectCheckFail) must
 * assert a SPECIFIC failure message, not just fail > 0, and not a generic global or
 * fragment-hash needle for a functional mutation. This suite parses the negative
 * suites statically and FAILS if:
 *   - an expectCheckFail call has no third argument (no needle);
 *   - a functional case uses ONLY "bytes match golden" / "sha matches golden" as its
 *     needle (proves a byte changed, not the specific contract);
 *   - a global needle (composed/body/head/script hash) is used for a functional case.
 *
 * A CLOSED allowlist of exactly 12 cases may keep a hash/bytes or golden-tamper
 * needle, because their DECLARED purpose is generic drift, a prior-phase fragment's
 * integrity, or deliberate golden tampering. Anything else must be functional.
 *
 * The suite also confirms the global tally: 170 expectCheckFail calls, 12 justified
 * generic exceptions, 158 functional-specific needles, and that within those 158 the
 * 43 corrected cases no longer depend on hash/bytes.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } }

const siteDir = path.join(__dirname, '..');

// The five checker-based negative suites and their expected expectCheckFail counts.
const SUITES = {
  'tests_solver_grid_negative.js': 20,
  'tests_solver_detection_negative.js': 36,
  'tests_solver_execution_negative.js': 43,
  'tests_solver_visualization_negative.js': 49,
  'tests_solver_interface_final_negative.js': 22,
};

// CLOSED allowlist — the ONLY cases permitted to keep a generic hash/bytes or
// golden-tamper needle, because their declared purpose IS generic integrity.
const ALLOWED_GENERIC = {
  'tests_solver_grid_negative.js': new Set([
    'N12 fragment bytes drift',
  ]),
  'tests_solver_detection_negative.js': new Set([
    'N14 D2 fragment bytes drift',
    'N46 D1 fragment modified',
  ]),
  'tests_solver_execution_negative.js': new Set([
    'N14 fragment bytes drift',
    'N55 D1 fragment modified',
    'N56 D2 fragment modified',
  ]),
  'tests_solver_visualization_negative.js': new Set([
    'N15 fragment bytes drift',
    'N61 D1 fragment modified',
    'N62 D2 fragment modified',
    'N63 D3 fragment modified',
  ]),
  'tests_solver_interface_final_negative.js': new Set([
    'N20 fragment bytes drift',
    'N26 golden tampered',
  ]),
};

// Needle patterns that are NOT acceptable for a functional case.
const GENERIC_HASH = /bytes match golden|sha matches golden/;
const GLOBAL_NEEDLE = /^(composed total sha matches golden|composed total bytes match golden|composed body matches golden|composed head matches golden|body matches golden|head matches golden|inline script matches golden|UI post-engine)/;

// Parse one expectCheckFail(...) call starting at index `idx`, returning
// { label, needle, hasThirdArg } or null. Handles nested parens/quotes/regex.
function parseCall(src, idx) {
  const popen = src.indexOf('(', idx);
  let depth = 0, i = popen, instr = null, esc = false;
  let prevSignif = '('; // last significant char, to disambiguate regex vs divide
  const argStops = []; // top-level comma positions
  for (; i < src.length; i++) {
    const ch = src[i];
    if (esc) { esc = false; continue; }
    if (instr) {
      if (ch === '\\') esc = true;
      else if (ch === instr) instr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { instr = ch; prevSignif = ch; continue; }
    // regex literal: a '/' following an operator/opening context starts one
    if (ch === '/' && src[i + 1] !== '/' && src[i + 1] !== '*' &&
        /[(,=:!&|?{;[]/.test(prevSignif)) {
      // consume to closing '/'
      let j = i + 1, e = false, incls = false;
      for (; j < src.length; j++) {
        const c = src[j];
        if (e) { e = false; continue; }
        if (c === '\\') { e = true; continue; }
        if (c === '[') incls = true;
        else if (c === ']') incls = false;
        else if (c === '/' && !incls) break;
      }
      i = j; prevSignif = '/'; continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) { break; } }
    else if (ch === ',' && depth === 1) argStops.push(i);
    if (!/\s/.test(ch)) prevSignif = ch;
  }
  const end = i;
  const call = src.slice(popen + 1, end);
  const labelM = call.match(/^\s*'((?:[^'\\]|\\.)*)'/);
  const label = labelM ? labelM[1] : null;
  const hasThirdArg = argStops.length >= 2;
  let needle = null;
  if (hasThirdArg) {
    const lastComma = argStops[argStops.length - 1] - popen - 1;
    const tail = call.slice(lastComma + 1);
    const nM = tail.match(/'((?:[^'\\]|\\.)*)'/);
    if (nM) needle = nM[1].replace(/\\'/g, "'");
  }
  return { label, needle, hasThirdArg, end };
}

let totalCalls = 0, totalGeneric = 0, totalFunctional = 0;
const correctedFunctional = []; // the 43 that were generic before v3

Object.keys(SUITES).forEach(file => {
  const p = path.join(siteDir, 'engine', file);
  const src = fs.readFileSync(p, 'utf8');
  const allowed = ALLOWED_GENERIC[file];
  let count = 0;
  let searchFrom = 0;
  while (true) {
    const idx = src.indexOf('expectCheckFail(', searchFrom);
    if (idx < 0) break;
    // skip the helper definition itself: "function expectCheckFail("
    const before = src.slice(Math.max(0, idx - 9), idx);
    if (/function\s*$/.test(before)) { searchFrom = idx + 16; continue; }
    const parsed = parseCall(src, idx);
    searchFrom = parsed.end + 1;
    if (!parsed.label) continue;
    count++; totalCalls++;
    const label = parsed.label;
    // 1) must have a third argument (a needle)
    ok(file + ' :: ' + label + ' has an expectedFailure needle', parsed.hasThirdArg,
      'no third argument');
    if (!parsed.hasThirdArg || parsed.needle == null) continue;
    const isGenericHash = GENERIC_HASH.test(parsed.needle);
    const isGlobal = GLOBAL_NEEDLE.test(parsed.needle);
    const isAllowed = allowed.has(label);
    if (isAllowed) {
      totalGeneric++;
      // allowed cases are expected to use a generic/hash/tamper needle
      ok(file + ' :: ' + label + ' (allowed generic) uses a hash/tamper needle',
        isGenericHash || /golden|tampered/.test(parsed.needle),
        'needle: ' + parsed.needle);
    } else {
      totalFunctional++;
      // 2) functional case must NOT use a bare hash/bytes needle
      ok(file + ' :: ' + label + ' uses a functional needle (not hash/bytes)',
        !isGenericHash, 'needle: ' + parsed.needle);
      // 3) functional case must NOT use a global needle
      ok(file + ' :: ' + label + ' does not use a global needle',
        !isGlobal, 'needle: ' + parsed.needle);
    }
  }
  ok(file + ' :: expectCheckFail count == ' + SUITES[file], count === SUITES[file],
    'got ' + count);
});

// Global tallies.
ok('170 checker-based expectCheckFail calls total', totalCalls === 170, 'got ' + totalCalls);
ok('12 justified generic exceptions', totalGeneric === 12, 'got ' + totalGeneric);
ok('158 functional-specific needles', totalFunctional === 158, 'got ' + totalFunctional);

// Determinism guard: the five POSITIVE solver checkers must NOT gate any assertion on
// the existence of a dist build, or their assertion count would depend on prior tree
// state. dist byte-identity is validated post-build by engine/validate_dist.js, not
// here. Fail if a checker reads dist/solver.html or branches on its existence.
const CHECKERS = [
  'tests_solver_grid.js', 'tests_solver_detection.js', 'tests_solver_execution.js',
  'tests_solver_visualization.js', 'tests_solver_interface_final.js',
];
CHECKERS.forEach(file => {
  const text = fs.readFileSync(path.join(siteDir, 'engine', file), 'utf8');
  // strip line comments so the explanatory notes mentioning "dist" don't trip us
  const code = text.replace(/\/\/[^\n]*/g, '');
  const readsDist = /dist['"]?\s*,\s*['"]solver\.html/.test(code) ||
    /['"]dist['"][^\n]*solver\.html/.test(code) ||
    /distSolver/.test(code);
  ok(file + ' :: no dist/solver.html read in positive checker', !readsDist,
    'positive checkers must be deterministic w.r.t. dist state');
  const branchesOnDist = /existsSync\([^)]*dist/.test(code);
  ok(file + ' :: no existsSync(dist...) branch in positive checker', !branchesOnDist,
    'assertion count must not depend on dist existence');
});

console.log('NEEDLE AUDIT  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1); }

module.exports = { auditNeedles: () => ({ pass, fail, failures, totalCalls, totalGeneric, totalFunctional }) };
