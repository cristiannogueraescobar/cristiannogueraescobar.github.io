'use strict';
/* ============================================================================
   Plumline motion system — PREFERENCE CONTROLLER
   ----------------------------------------------------------------------------
   A tiny reusable controller around `prefers-reduced-motion`. It:
     - reads the CURRENT state via matchMedia;
     - listens for runtime `change`;
     - notifies subscribers so the system can update live;
     - can clean up its listener (destroy), idempotently.

   No framework, no dependency. This is the single source of truth for whether
   the user currently prefers reduced motion. It never persists or overrides the
   real OS preference; the lab must not fake it in production.
   ========================================================================== */

function createMotionPreference() {
  var supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  var mq = supported ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var subscribers = [];
  var destroyed = false;

  function reduced() {
    return !!(mq && mq.matches);
  }

  var onChange = function () {
    if (destroyed) return;
    var value = reduced();
    subscribers.forEach(function (fn) { try { fn(value); } catch (e) { /* isolate */ } });
  };

  if (mq) {
    // addEventListener is the modern API; guard for older engines.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  return {
    /* Current reduced-motion state (live). */
    reduced: reduced,
    /* Subscribe to runtime changes; returns an unsubscribe function. */
    subscribe: function (fn) {
      if (typeof fn !== 'function' || destroyed) return function () {};
      subscribers.push(fn);
      return function () {
        var i = subscribers.indexOf(fn);
        if (i !== -1) subscribers.splice(i, 1);
      };
    },
    /* Remove the media listener and drop subscribers. Safe to call twice. */
    destroy: function () {
      if (destroyed) return;
      destroyed = true;
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener('change', onChange);
        else if (mq.removeListener) mq.removeListener(onChange);
      }
      subscribers.length = 0;
    },
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createMotionPreference: createMotionPreference };
if (typeof window !== 'undefined') window.PlumlineMotionPreference = { createMotionPreference: createMotionPreference };
