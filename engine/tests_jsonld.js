/**
 * tests_jsonld.js — every <script type="application/ld+json"> block in every
 * page must be valid JSON (no literal newlines in strings, no trailing commas).
 * Structured data that doesn't parse is silently ignored by search engines.
 *
 * Run: node engine/tests_jsonld.js
 */
const fs = require('fs');
const path = require('path');
const { composedHtml } = require('./composed-html.js');

const siteDir = path.join(__dirname, '..');
const pages = fs.readdirSync(siteDir).filter(f => f.endsWith('.html'));

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

pages.forEach(function (page) {
  const html = composedHtml(siteDir, page);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  blocks.forEach(function (block, i) {
    let parsed = null, err = null;
    try { parsed = JSON.parse(block); } catch (e) { err = e.message; }
    ok(page + ' JSON-LD block ' + (i + 1) + ' parses', parsed !== null, err || '');
    // A well-formed block has an @context and @type.
    if (parsed) ok(page + ' block ' + (i + 1) + ' has @type', !!parsed['@type']);
  });
});

console.log('JSON-LD TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
if (fail > 0) process.exit(1);
