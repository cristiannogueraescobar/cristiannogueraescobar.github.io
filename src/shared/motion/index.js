'use strict';
/* ============================================================================
   Plumline motion system — CANONICAL PUBLIC API (browser-safe AND Node-safe)
   ----------------------------------------------------------------------------
   This is the single public entry point. It works in BOTH environments without
   any external dependency or bundler:
     - Node/CommonJS (tests, tooling): the individual modules are require()'d.
     - Classic browser <script>: no `require` exists; the API is assembled from
       the window globals the module scripts attach (window.PlumlineMotion*).
   Load order for browser use: include preference.js, lifecycle.js, reveal.js,
   sequence.js (each attaches a window global), then index.js exposes the
   aggregated API as window.PlumlineMotion. index.js never assumes CommonJS.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PlumlineMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  // Resolve each module from CommonJS if available, else from the browser global.
  function fromRequire(rel) {
    if (typeof require !== 'function') return null;
    try { return require(rel); } catch (e) { return null; }
  }
  function pick(cjs, globalName, key) {
    if (cjs && cjs[key]) return cjs[key];
    if (typeof window !== 'undefined' && window[globalName] && window[globalName][key]) return window[globalName][key];
    return undefined;
  }

  var pref = fromRequire('./preference.js');
  var life = fromRequire('./lifecycle.js');
  var rev = fromRequire('./reveal.js');
  var seq = fromRequire('./sequence.js');

  return {
    createMotionPreference: pick(pref, 'PlumlineMotionPreference', 'createMotionPreference'),
    createTimerGroup: pick(life, 'PlumlineMotionLifecycle', 'createTimerGroup'),
    createVisibility: pick(life, 'PlumlineMotionLifecycle', 'createVisibility'),
    createRevealObserver: pick(life, 'PlumlineMotionLifecycle', 'createRevealObserver'),
    createReveal: pick(rev, 'PlumlineMotionReveal', 'createReveal'),
    createSequence: pick(seq, 'PlumlineMotionSequence', 'createSequence'),
  };
});
