'use strict';
/* ============================================================================
   Plumline motion system — LIFECYCLE HELPERS
   ----------------------------------------------------------------------------
   Small reusable helpers so every controller cleans up the same way. No
   framework. Three pieces:

     createTimerGroup()  — cancelable setTimeout ownership (NO setInterval). A
                           repeating sequence is modelled as a self-rescheduling
                           timeout so it can pause/resume/cancel without stacking
                           callbacks or leaking a live interval after destroy.

     createVisibility()  — document visibility (document.hidden) with a change
                           listener and cleanup, so autoplay can pause when the
                           tab is hidden.

     createRevealObserver() — a SHARED IntersectionObserver (one per config, not
                           one per element) with observe/unobserve/disconnect and
                           a graceful fallback when IntersectionObserver is absent.
   ========================================================================== */

/* ---- Cancelable timers (no setInterval) -------------------------------- */
function createTimerGroup() {
  var timers = [];
  var destroyed = false;
  return {
    after: function (ms, fn) {
      if (destroyed) return null;
      var id = setTimeout(function () {
        // remove self from the live list before running
        var i = timers.indexOf(id);
        if (i !== -1) timers.splice(i, 1);
        if (!destroyed) fn();
      }, ms);
      timers.push(id);
      return id;
    },
    cancel: function (id) {
      var i = timers.indexOf(id);
      if (i !== -1) { clearTimeout(id); timers.splice(i, 1); }
    },
    clear: function () {
      timers.forEach(function (id) { clearTimeout(id); });
      timers.length = 0;
    },
    size: function () { return timers.length; },
    destroy: function () {
      destroyed = true;
      timers.forEach(function (id) { clearTimeout(id); });
      timers.length = 0;
    },
  };
}

/* ---- Document visibility ------------------------------------------------ */
function createVisibility(onChange) {
  var destroyed = false;
  var handler = function () { if (!destroyed) onChange(!!document.hidden); };
  var attached = false;
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', handler);
    attached = true;
  }
  return {
    hidden: function () { return typeof document !== 'undefined' && !!document.hidden; },
    destroy: function () {
      if (destroyed) return;
      destroyed = true;
      if (attached && document.removeEventListener) document.removeEventListener('visibilitychange', handler);
    },
  };
}

/* ---- Shared reveal observer (one per config) --------------------------- */
/* onEnter(target) is called once per target when it first intersects; the
   target is then unobserved (one-shot). If IntersectionObserver is missing,
   we call onEnter for every registered target immediately (content visible,
   no error) — real progressive enhancement. */
function createRevealObserver(onEnter, options) {
  var IO = (typeof window !== 'undefined') ? window.IntersectionObserver : (typeof IntersectionObserver !== 'undefined' ? IntersectionObserver : undefined);
  var supported = typeof IO === 'function';
  var opts = options || { threshold: 0.2, rootMargin: '0px 0px -10% 0px' };
  var io = null;
  var pendingWhenUnsupported = [];
  var destroyed = false;

  if (supported) {
    io = new IO(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          onEnter(en.target);
          io.unobserve(en.target); // one-shot
        }
      });
    }, opts);
  }

  return {
    supported: supported,
    observe: function (target) {
      if (destroyed || !target) return;
      if (io) io.observe(target);
      else { pendingWhenUnsupported.push(target); onEnter(target); } // fallback: reveal now
    },
    unobserve: function (target) { if (io && target) io.unobserve(target); },
    disconnect: function () { if (io) io.disconnect(); },
    destroy: function () {
      if (destroyed) return;
      destroyed = true;
      if (io) io.disconnect();
      pendingWhenUnsupported.length = 0;
    },
  };
}

var api = {
  createTimerGroup: createTimerGroup,
  createVisibility: createVisibility,
  createRevealObserver: createRevealObserver,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.PlumlineMotionLifecycle = api;
