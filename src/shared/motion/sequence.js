'use strict';
/* ============================================================================
   Plumline motion system — PRODUCT SEQUENCE CONTROLLER
   ----------------------------------------------------------------------------
   Formalises the F4a product-plan demonstration into a reusable primitive.
   Accepts N steps (not fixed at 5). It is a DEMONSTRATION of a real flow; it
   does NOT run the engine.

   Progressive enhancement (feature-specific, NO global flag):
     - Without JS, all stages are visible and readable (a stacked list) and the
       interactive controls are hidden by CSS (they only work after enhancement).
     - With JS, the controller adds `.pl-seq--enhanced`, which reveals the
       controls and enables the single-stage view. The active step/dot carry
       aria-current="step". Focus is never moved; nothing is announced per frame.

   Pause reasons are SEPARATE and each explains WHY playback is stopped:
       userPaused      — the user pressed Pause or picked a step (persists).
       viewportPaused  — the sequence is off-screen.
       documentPaused  — the tab is hidden (initialised from document.hidden).
       reducedMotion   — the user prefers reduced motion (no spatial autoplay).
   Autoplay runs only when NONE of these is set. Re-entering the viewport clears
   viewportPaused but NEVER clears userPaused, so a user pause always wins.

   Honest controls:
     - The Play/Pause toggle label ALWAYS reflects the real playing state.
     - When autoplay cannot run (reduced motion, or autoplay disabled), the toggle
       is not presented as an active control that does nothing: it is disabled with
       an explanatory status, and manual step/dot navigation still works.

   Timers: a self-rescheduling setTimeout (NO setInterval), fully cancelable, so
   repeated init/destroy never stacks loops and no timer survives destroy.

   Autoplay STOPS at the last step (no infinite loop). Restart/replay is manual.
   ========================================================================== */

function createSequence(root, deps) {
  if (!root) return nullController();
  var d = deps || {};
  var lifecycle = d.lifecycle || (typeof window !== 'undefined' && window.PlumlineMotionLifecycle) || safeRequire('./lifecycle.js');
  var prefApi = d.preference || (typeof window !== 'undefined' && window.PlumlineMotionPreference) || safeRequire('./preference.js');
  if (!lifecycle) return nullController();

  var stages = Array.prototype.slice.call(root.querySelectorAll('.pl-seq__stage'));
  var steps = Array.prototype.slice.call(root.querySelectorAll('.pl-seq__step'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.pl-seq__dot'));
  var playBtn = root.querySelector('[data-seq-toggle]');
  var statusEl = root.querySelector('[data-seq-status]');
  if (!stages.length) return nullController();

  var autoplay = root.getAttribute('data-seq-autoplay') === 'true';

  var timers = lifecycle.createTimerGroup();
  var preference = prefApi ? prefApi.createMotionPreference() : { reduced: function () { return false; }, subscribe: function () { return function () {}; }, destroy: function () {} };

  var i = 0;
  var playing = false;
  var pendingTimer = null;
  var destroyed = false;
  var completed = false; // true once autoplay has finished at the final step

  // Separate pause reasons. documentPaused is initialised from the REAL document
  // state, not assumed false.
  var reasons = {
    userPaused: false,
    viewportPaused: false,
    documentPaused: (typeof document !== 'undefined' && !!document.hidden),
    reducedMotion: preference.reduced(),
  };

  function canAutoplay() {
    return autoplay && !completed && !reasons.userPaused && !reasons.viewportPaused && !reasons.documentPaused && !reasons.reducedMotion;
  }
  // The toggle can be operated only if autoplay is configured, reduced motion is
  // not blocking it, AND the sequence has not already completed at the final step.
  // Otherwise it is disabled with an explanatory status (Restart replays).
  function toggleOperable() {
    return autoplay && !reasons.reducedMotion && !completed;
  }

  // Enhancement: reveals the controls (hidden without JS) and single-stage view.
  root.classList.add('pl-seq--enhanced');

  function markActive(list) {
    list.forEach(function (el, k) {
      if (k === i) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
  }
  function show(n) {
    i = Math.max(0, Math.min(stages.length - 1, n)); // clamp; no wrap-around
    stages.forEach(function (s, k) { s.hidden = k !== i; });
    markActive(steps);
    markActive(dots);
    // No focus move. No aria-live announcement per step.
  }

  function scheduleNext() {
    if (pendingTimer) { timers.cancel(pendingTimer); pendingTimer = null; }
    pendingTimer = timers.after(readDwell(), function () {
      pendingTimer = null;
      if (destroyed || !playing) return;
      if (i >= stages.length - 1) { completed = true; stop(); return; } // STOP + mark complete at last step
      show(i + 1);
      scheduleNext();
    });
  }
  function readDwell() {
    if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return 2600;
    var v = getComputedStyle(document.documentElement).getPropertyValue('--pl-motion-duration-sequence');
    var ms = parseInt(v, 10);
    return isNaN(ms) ? 2600 : ms;
  }

  function play() {
    if (playing || destroyed) return;
    // At the final step with autoplay finished, do NOT start a useless timer.
    if (autoplay && !completed && i >= stages.length - 1) { completed = true; syncControl(); return; }
    if (!canAutoplay()) { syncControl(); return; }
    playing = true;
    scheduleNext();
    syncControl();
  }
  function stop() {
    playing = false;
    if (pendingTimer) { timers.cancel(pendingTimer); pendingTimer = null; }
    syncControl();
  }

  // The control label/state ALWAYS reflects reality.
  function syncControl() {
    if (playBtn) {
      var operable = toggleOperable();
      if (!operable) {
        // Not a live control: disable it and explain, rather than a fake "Pause".
        playBtn.disabled = true;
        playBtn.setAttribute('data-playing', 'false');
        playBtn.setAttribute('aria-disabled', 'true');
        setLabel(playBtn, 'play');
      } else {
        playBtn.disabled = false;
        playBtn.removeAttribute('aria-disabled');
        playBtn.setAttribute('data-playing', playing ? 'true' : 'false');
        setLabel(playBtn, playing ? 'pause' : 'play');
      }
    }
    if (statusEl) {
      if (!autoplay) statusEl.textContent = statusEl.getAttribute('data-status-manual') || 'Step through manually.';
      else if (reasons.reducedMotion) statusEl.textContent = statusEl.getAttribute('data-status-reduced') || 'Autoplay off (reduced motion). Step through manually.';
      else if (completed) statusEl.textContent = statusEl.getAttribute('data-status-complete') || 'Sequence complete. Restart to replay.';
      else statusEl.textContent = '';
    }
  }
  function setLabel(btn, which) {
    var label = which === 'pause' ? (btn.getAttribute('data-label-pause') || 'Pause') : (btn.getAttribute('data-label-play') || 'Play');
    btn.textContent = label;
  }

  function userPause() { reasons.userPaused = true; stop(); }
  function userResume() { reasons.userPaused = false; play(); }
  function toggle() { if (!toggleOperable()) return; if (playing) userPause(); else userResume(); }
  // Manual navigation to any step clears the "completed" latch (unless we land on
  // the final step again) and is an explicit user pause.
  function goto(n) { userPause(); if (n < stages.length - 1) completed = false; show(n); syncControl(); }
  function next() { userPause(); if (i + 1 < stages.length - 1) completed = false; show(i + 1); syncControl(); }
  function prev() { userPause(); completed = false; show(i - 1); syncControl(); }
  function restart() { completed = false; reasons.userPaused = false; show(0); syncControl(); if (autoplay && toggleOperable()) { play(); } }

  // Controls.
  if (playBtn) playBtn.addEventListener('click', toggle);
  var stepHandlers = [];
  steps.forEach(function (s, k) { var h = function () { goto(k); }; s.addEventListener('click', h); stepHandlers.push([s, h]); });
  var dotHandlers = [];
  dots.forEach(function (dt, k) { var h = function () { goto(k); }; dt.addEventListener('click', h); dotHandlers.push([dt, h]); });
  var restartBtn = root.querySelector('[data-seq-restart]');
  var restartHandler = null;
  if (restartBtn) { restartHandler = function () { restart(); }; restartBtn.addEventListener('click', restartHandler); }
  var keyHandler = function (e) {
    if (e.key === 'ArrowRight') { next(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
  };
  root.addEventListener('keydown', keyHandler);

  // Viewport pause (single element here).
  var SeqIO = (typeof window !== 'undefined') ? window.IntersectionObserver : undefined;
  var io = (typeof SeqIO === 'function') ? new SeqIO(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { reasons.viewportPaused = false; play(); }
      else { reasons.viewportPaused = true; if (playing) stop(); } // never touches userPaused
    });
  }, { threshold: 0.4 }) : null;

  // Document visibility pause.
  var visibility = lifecycle.createVisibility(function (hidden) {
    reasons.documentPaused = hidden;
    if (hidden) { if (playing) stop(); }
    else { play(); } // play() re-checks canAutoplay(), so userPaused still wins
  });

  // Runtime reduced-motion changes.
  var unsubscribe = preference.subscribe(function (isReduced) {
    reasons.reducedMotion = isReduced;
    if (isReduced) {
      if (playing) stop(); // stop non-essential autoplay; stay on current step
    } else {
      play(); // does NOT auto-resume if userPaused (canAutoplay re-checks it)
    }
    syncControl();
  });

  // Initial state.
  show(0);
  syncControl();
  if (io) io.observe(root);
  else if (canAutoplay()) play(); // no IO: content usable, autoplay only if allowed

  return {
    state: function () { return { index: i, playing: playing, completed: completed, enhanced: root.classList.contains('pl-seq--enhanced'), toggleOperable: toggleOperable(), reasons: { userPaused: reasons.userPaused, viewportPaused: reasons.viewportPaused, documentPaused: reasons.documentPaused, reducedMotion: reasons.reducedMotion } }; },
    next: next, prev: prev, goto: goto, toggle: toggle, restart: restart,
    pendingTimers: function () { return timers.size(); },
    toggleOperable: toggleOperable,
    stagesHidden: function () { return stages.map(function (s) { return !!s.hidden; }); },
    destroy: function () {
      if (destroyed) return;
      destroyed = true;
      stop();
      timers.destroy();
      if (io) io.disconnect();
      visibility.destroy();
      if (unsubscribe) unsubscribe();
      preference.destroy();
      if (playBtn) playBtn.removeEventListener('click', toggle);
      stepHandlers.forEach(function (p) { p[0].removeEventListener('click', p[1]); });
      dotHandlers.forEach(function (p) { p[0].removeEventListener('click', p[1]); });
      if (restartBtn && restartHandler) restartBtn.removeEventListener('click', restartHandler);
      root.removeEventListener('keydown', keyHandler);
      // Restore the static, progressively-safe fallback: remove the enhancement
      // flag (so the JS-only controls return to their no-JS hidden state via CSS),
      // un-hide EVERY stage (readable stacked list), and drop aria-current. No
      // focused-element manipulation. Idempotent.
      root.classList.remove('pl-seq--enhanced');
      stages.forEach(function (s) { s.hidden = false; });
      steps.forEach(function (s) { s.removeAttribute('aria-current'); });
      dots.forEach(function (dt) { dt.removeAttribute('aria-current'); });
    },
  };
}

function nullController() { return { destroy: function () {}, state: function () { return { index: 0, playing: false, reasons: {} }; }, pendingTimers: function () { return 0; }, next: function () {}, prev: function () {}, goto: function () {}, toggle: function () {}, restart: function () {}, toggleOperable: function () { return false; } }; }
function safeRequire(p) { try { return require(p); } catch (e) { return null; } }

if (typeof module !== 'undefined' && module.exports) module.exports = { createSequence: createSequence };
if (typeof window !== 'undefined') window.PlumlineMotionSequence = { createSequence: createSequence };
