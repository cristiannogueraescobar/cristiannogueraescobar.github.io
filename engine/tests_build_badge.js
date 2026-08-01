/* tests_build_badge.js — behavioral contract for assets/build-badge.js.
 *
 * The static tests only checked that every page INCLUDES build-badge.js. This
 * suite EXECUTES it in jsdom with a mocked fetch and drives every branch of the
 * pliego's build-badge contract: valid response, network error, 404, invalid
 * JSON, missing fields, missing element, double init (exactly ONE fetch),
 * non-blocking, and no unhandled rejection. A negative case removes the
 * idempotency guard and proves double init then makes TWO fetches.
 *
 * Requires jsdom (pinned; CI runs npm ci). Missing jsdom is a hard FAIL under CI
 * and a graceful skip locally. LF-only, no HTTP server, no open handles.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) {
    console.error('BUILD BADGE TESTS  FAILED: jsdom could not load under CI');
    console.error(e && e.message || e);
    process.exit(1);
  }
  console.log('BUILD BADGE TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const badge = fs.readFileSync(path.join(siteDir, 'assets', 'build-badge.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

// A Response-like object with the fields build-badge.js uses (r.ok, r.json()).
function jsonResponse(obj, okFlag) {
  return Promise.resolve({ ok: okFlag !== false, json: function () { return Promise.resolve(obj); } });
}

// Boot a minimal page in jsdom, install a fetch mock, run build-badge.js ONCE,
// and let the natural DOMContentLoaded settle. Returns the final state plus the
// fetch call count and unhandled-rejection count.
async function boot(fetchImpl, withBadge) {
  const bodyHtml = (withBadge === false)
    ? '<p>no badge here</p>'
    : '<footer><span id="buildBadge"></span></footer>';
  const dom = new JSDOM('<!DOCTYPE html><html><body>' + bodyHtml + '</body></html>',
    { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const { window } = dom;
  let calls = 0, unhandled = 0;
  window.addEventListener('unhandledrejection', function () { unhandled++; });
  window.fetch = function (url, opts) { calls++; return fetchImpl(url, opts); };
  window.eval(badge);
  // build-badge.js registers a DOMContentLoaded listener when readyState is
  // 'loading' (jsdom's initial state), then jsdom fires it ONCE naturally. We
  // let jsdom fire it rather than dispatching by hand, to reproduce a real load.
  await new Promise(function (r) { setTimeout(r, 0); });
  await new Promise(function (r) { setTimeout(r, 0); });
  await new Promise(function (r) { setTimeout(r, 0); });
  const el = window.document.getElementById('buildBadge');
  return { window: window, el: el, calls: calls, unhandled: unhandled,
           text: el ? el.textContent : null,
           title: el ? el.getAttribute('title') : null };
}

// Boot and run the module a SECOND time to exercise double initialization.
// `source` lets a negative case pass a mutated (guard-stripped) module.
async function bootDouble(fetchImpl, source, beforeDCL) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><footer><span id="buildBadge"></span></footer></body></html>',
    { runScripts: 'outside-only', url: 'https://plumline.online/' });
  const { window } = dom;
  let calls = 0, unhandled = 0;
  window.addEventListener('unhandledrejection', function () { unhandled++; });
  window.fetch = function (url, opts) { calls++; return fetchImpl(url, opts); };
  const mod = source || badge;
  if (beforeDCL) {
    // Both evaluations happen while readyState is 'loading', before jsdom fires
    // DOMContentLoaded: each registers a listener; the guard must still yield one
    // fetch when the single natural event runs both run() calls.
    window.eval(mod);
    window.eval(mod);
    await new Promise(function (r) { setTimeout(r, 0); });
    await new Promise(function (r) { setTimeout(r, 0); });
  } else {
    // First eval registers a listener; after the natural DOMContentLoaded the
    // badge is initialized, so the second eval runs run() immediately.
    window.eval(mod);
    await new Promise(function (r) { setTimeout(r, 0); });
    window.eval(mod);
    await new Promise(function (r) { setTimeout(r, 0); });
    await new Promise(function (r) { setTimeout(r, 0); });
  }
  const el = window.document.getElementById('buildBadge');
  return { calls: calls, unhandled: unhandled, text: el ? el.textContent : null };
}

(async function () {
  // 33. Valid response → badge shows build <sha7> · <date> · <n> tests.
  {
    const r = await boot(function () {
      return jsonResponse({ commit: 'abcdef1234567890', builtAt: '2026-07-30T12:00:00Z', testsPassed: 7000 });
    });
    ok('33. valid response fills the badge', /^build abcdef1/.test(r.text || ''), 'text=' + r.text);
    ok('33. valid response shows the date', /2026-07-30/.test(r.text || ''));
    ok('33. valid response shows the test count', /7000 tests/.test(r.text || ''));
    ok('33. valid response sets the title with the full commit', /abcdef1234567890/.test(r.title || ''));
    ok('33. one fetch was made', r.calls === 1, 'calls=' + r.calls);
  }

  // 34. Network error (fetch rejects) → badge stays empty, page not broken.
  {
    const r = await boot(function () { return Promise.reject(new Error('network down')); });
    ok('34. network error leaves the badge empty', (r.text || '') === '');
    ok('34. network error causes no unhandled rejection', r.unhandled === 0);
  }

  // 35. 404 (r.ok false) → badge empty.
  {
    const r = await boot(function () { return jsonResponse({}, false); });
    ok('35. 404 leaves the badge empty', (r.text || '') === '');
    ok('35. 404 causes no unhandled rejection', r.unhandled === 0);
  }

  // 36. Invalid JSON (r.json() rejects) → badge empty, no throw.
  {
    const r = await boot(function () {
      return Promise.resolve({ ok: true, json: function () { return Promise.reject(new Error('bad json')); } });
    });
    ok('36. invalid JSON leaves the badge empty', (r.text || '') === '');
    ok('36. invalid JSON causes no unhandled rejection', r.unhandled === 0);
  }

  // 37. Missing commit field → badge empty (nothing to show).
  {
    const r = await boot(function () { return jsonResponse({ builtAt: '2026-07-30', testsPassed: 10 }); });
    ok('37. missing commit leaves the badge empty', (r.text || '') === '');
  }

  // 37b. DEV-LOCAL commit → badge empty (never shows a misleading value).
  {
    const r = await boot(function () { return jsonResponse({ commit: 'DEV-LOCAL', builtAt: 'unbuilt', testsPassed: 0 }); });
    ok('37b. DEV-LOCAL commit leaves the badge empty', (r.text || '') === '');
  }

  // 38. Missing testsPassed field → badge still shows commit (+date), no "tests".
  {
    const r = await boot(function () { return jsonResponse({ commit: 'beef1234567', builtAt: '2026-07-30T00:00:00Z' }); });
    ok('38. missing testsPassed still shows the commit', /^build beef123/.test(r.text || ''), 'text=' + r.text);
    ok('38. missing testsPassed omits the tests suffix', !/tests/.test(r.text || ''));
  }

  // 39. Missing #buildBadge element → no fetch at all, no throw.
  {
    const r = await boot(function () { return jsonResponse({ commit: 'abc1234' }); }, false);
    ok('39. no #buildBadge element means no fetch', r.calls === 0, 'calls=' + r.calls);
    ok('39. no #buildBadge element causes no unhandled rejection', r.unhandled === 0);
  }

  // 40. Double init AFTER DOMContentLoaded → exactly ONE fetch, one clean value,
  //     zero unhandled rejection.
  {
    const r = await bootDouble(function () {
      return jsonResponse({ commit: 'dddeeef1234', builtAt: '2026-07-30T00:00:00Z', testsPassed: 5 });
    }, null, false);
    ok('40. double init (after DCL) makes exactly one fetch', r.calls === 1, 'calls=' + r.calls);
    ok('40. double init (after DCL) yields a single clean badge value',
       /^build dddeeef · 2026-07-30 · 5 tests$/.test(r.text || ''), 'text=' + r.text);
    ok('40. double init (after DCL) causes no unhandled rejection', r.unhandled === 0);
  }

  // 40b. Double init BEFORE DOMContentLoaded → exactly ONE fetch.
  {
    const r = await bootDouble(function () {
      return jsonResponse({ commit: 'ccc2223334', builtAt: '2026-07-30T00:00:00Z', testsPassed: 9 });
    }, null, true);
    ok('40b. double init (before DCL) makes exactly one fetch', r.calls === 1, 'calls=' + r.calls);
    ok('40b. double init (before DCL) yields a single clean badge value',
       /^build ccc2223 · 2026-07-30 · 9 tests$/.test(r.text || ''), 'text=' + r.text);
    ok('40b. double init (before DCL) causes no unhandled rejection', r.unhandled === 0);
  }

  // 41. Non-blocking: the module returns synchronously; the badge fills later.
  {
    const dom = new JSDOM('<!DOCTYPE html><html><body><footer><span id="buildBadge"></span></footer></body></html>',
      { runScripts: 'outside-only', url: 'https://plumline.online/' });
    const { window } = dom;
    window.fetch = function () { return jsonResponse({ commit: 'aaa1111222', testsPassed: 3 }); };
    window.eval(badge);
    const immediate = window.document.getElementById('buildBadge').textContent;
    ok('41. badge is empty synchronously (fetch is async, non-blocking)', immediate === '');
    await new Promise(function (r) { setTimeout(r, 0); });
    await new Promise(function (r) { setTimeout(r, 0); });
    const later = window.document.getElementById('buildBadge').textContent;
    ok('41. badge fills after the async fetch settles', /^build aaa1111/.test(later));
  }

  // 42/43 NEGATIVE. Remove the idempotency guard, run the module twice, and prove
  //       double init then makes TWO fetches. This confirms the guard (not luck)
  //       is what makes double init a single fetch.
  {
    const stripped = badge.replace(
      /if \(el\.getAttribute\('data-build-badge-init'\) === 'true'\) return;\s*\n\s*el\.setAttribute\('data-build-badge-init', 'true'\);/,
      '/* guard removed for negative test */');
    ok('42. the badge guard string was found and removed', stripped !== badge);
    const r = await bootDouble(function () {
      return jsonResponse({ commit: 'fff4445556', testsPassed: 1 });
    }, stripped, false);
    ok('43. WITHOUT the guard, double init makes two fetches', r.calls === 2, 'calls=' + r.calls);
  }

  console.log('BUILD BADGE TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  if (require.main === module) process.exit(fail ? 1 : 0);
})();

module.exports = { pass: pass, fail: fail };
