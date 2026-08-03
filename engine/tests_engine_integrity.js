// tests_engine_integrity.js — pins the inline solver engine by its canonical SHA.
//
// Canonical engine block convention (consistent with tests_worker_parity.js and
// tests_structure.js): slice from the ENGINE_START marker up to — but NOT
// including — the ENGINE_END marker, i.e. html.slice(indexOf(START), indexOf(END)).
// Under this convention the approved engine is:
//   length: 82657 characters
//   SHA-256: 5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf
//
// NOTE ON THE OTHER CONVENTION: if the END marker is INCLUDED in the slice
// (html.slice(indexOf(START), indexOf(END) + END.length)) the block is 82673
// characters and hashes to
// bf93e3ca011b79ffb69c21b13dd7ed3812c753cff1035c22169b36a588a098da. That is a
// different, documented value — this suite uses the canonical (END-excluded)
// convention above and does not silently switch between them.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const siteDir = path.join(__dirname, '..');
const START = '/* ENGINE_START */';
const END = '/* ENGINE_END */';
const CANONICAL_LEN = 82657;
const CANONICAL_SHA = '5d68ed17d44a02700dce2cc6df862dfd13d3bf97e3a3bb7af1242651266cd3cf';

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// Checkpoint E1: the engine no longer lives inline in the solver.html SOURCE
// (it is the internal canonical file engine/source/plumline-engine.js, composed
// build-time into ENGINE_START..END). Read the COMPOSED solver so the integrity
// check runs against the engine bytes as they actually ship. composedHtml is the
// one canonical compositor (same one Vite/validate_dist use); this is a
// composed read, not a raw one, so it needs no RAW_SOURCE_ALLOWLIST entry.
const { composedHtml } = require('./composed-html.js');
const html = composedHtml(siteDir, 'solver.html');
const a = html.indexOf(START), b = html.indexOf(END);
ok('engine markers present and ordered', a >= 0 && b > a, 'a=' + a + ' b=' + b);
const engine = html.slice(a, b); // canonical: START .. before END
ok('engine block length is the canonical 82657 chars', engine.length === CANONICAL_LEN,
   'got ' + engine.length);
const sha = crypto.createHash('sha256').update(engine).digest('hex');
ok('engine block SHA-256 matches the approved canonical value', sha === CANONICAL_SHA,
   'got ' + sha);

console.log('ENGINE INTEGRITY  PASSED: ' + pass + '   FAILED: ' + fail);
if (require.main === module) process.exit(fail ? 1 : 0);
module.exports = { pass, fail };
