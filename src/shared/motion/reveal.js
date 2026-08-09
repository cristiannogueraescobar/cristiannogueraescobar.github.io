'use strict';
/* ============================================================================
   Plumline motion system — REVEAL CONTROLLER
   ----------------------------------------------------------------------------
   Opt-in, one-shot reveal. Progressive enhancement with FEATURE-SPECIFIC
   ownership (no global flag):
     - Without JS, targets are fully visible (the .pl-reveal start-state applies
       ONLY to .pl-reveal-armed, which only this controller adds).
     - With JS, we arm each managed target (.pl-reveal-armed → start-state) and
       reveal it once when it first enters the viewport (shared Intersection
       Observer). If IO is absent, every target is revealed immediately.
     - Reduced motion: the CSS layer replaces the offset with a short fade; we
       still reveal so nothing stays invisible.

   Guarantees:
     - createReveal(rootA) arms ONLY targets inside rootA; reveals elsewhere are
       untouched.
     - destroy BEFORE a target enters the viewport un-arms it (removes
       .pl-reveal-armed) → the target is visible.
     - destroy AFTER a target entered leaves it revealed and un-armed → visible.
     - No global class is ever added, so a reveal controller cannot hide another
       feature and leaves no residual global flag.

   No scroll listener. One shared observer. Full cleanup on destroy. Idempotent.
   ========================================================================== */

function createReveal(root, deps) {
  root = root || (typeof document !== 'undefined' ? document : null);
  var lifecycle = (deps && deps.lifecycle) || (typeof window !== 'undefined' && window.PlumlineMotionLifecycle) || (typeof require === 'function' ? safeRequire('./lifecycle.js') : null);
  if (!root || !lifecycle) return { destroy: function () {}, reset: function () {} };

  var targets = Array.prototype.slice.call(root.querySelectorAll('.pl-reveal'));
  var destroyed = false;

  function revealOne(target) {
    if (destroyed) return;
    target.classList.add('pl-reveal-in');
    // Un-arm: once revealed the start-state no longer applies (belt and braces).
    target.classList.remove('pl-reveal-armed');
  }

  var observer = lifecycle.createRevealObserver(revealOne, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

  targets.forEach(function (t) {
    t.classList.add('pl-reveal-armed'); // arming is what applies the start-state
    observer.observe(t);
  });

  return {
    /* Lab-only helper: re-arm all managed targets so a reviewer can replay. */
    reset: function () {
      if (destroyed) return;
      targets.forEach(function (t) {
        t.classList.remove('pl-reveal-in');
        t.classList.add('pl-reveal-armed');
        observer.observe(t);
      });
    },
    destroy: function () {
      if (destroyed) return;
      destroyed = true;
      observer.destroy();
      // Leave every managed target VISIBLE: remove the armed start-state flag.
      // A target that never entered the viewport is thus made visible, and a
      // revealed one stays visible. No global flag to clean up (there is none).
      targets.forEach(function (t) { t.classList.remove('pl-reveal-armed'); });
    },
  };
}

function safeRequire(p) { try { return require(p); } catch (e) { return null; } }

if (typeof module !== 'undefined' && module.exports) module.exports = { createReveal: createReveal };
if (typeof window !== 'undefined') window.PlumlineMotionReveal = { createReveal: createReveal };
