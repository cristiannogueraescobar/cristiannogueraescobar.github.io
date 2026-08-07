'use strict';
/* F4a product sequence — progressive enhancement.
 *
 * WITHOUT JS: all five stages are visible and readable (a stacked list). WITH JS:
 * the figure gets .seq--enhanced and shows one stage at a time, advancing on a
 * timer that
 *   (a) can be paused,
 *   (b) is driven by keyboard (left/right) and by the step/dot buttons,
 *   (c) never moves focus,
 *   (d) does not autoplay under prefers-reduced-motion,
 *   (e) never runs off-screen,
 *   (f) announces nothing repeatedly to screen readers,
 *   (g) respects an EXPLICIT user pause: once the user pauses or picks a stage,
 *       re-entering the viewport does NOT auto-resume.
 *
 * The active stage is communicated with aria-current="step" on the step and dot
 * buttons (not a data-* attribute alone). This is a DEMONSTRATION of the real
 * production-plan flow; it does not run the engine.
 */
(function () {
  var root = document.querySelector('[data-seq]');
  if (!root) return;

  var steps = Array.prototype.slice.call(root.querySelectorAll('.seq__step'));
  var stages = Array.prototype.slice.call(root.querySelectorAll('.seq__stage'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.seq__dot'));
  var playBtn = root.querySelector('[data-seq-toggle]');
  if (!stages.length) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var i = 0, timer = null, playing = false, userPaused = false;
  var PERIOD = 2600;

  // Enhance: from this point the single-stage view is active.
  root.classList.add('seq--enhanced');

  function markActive(list) {
    list.forEach(function (el, k) {
      if (k === i) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
  }
  function show(n) {
    i = (n + stages.length) % stages.length;
    stages.forEach(function (s, k) { s.hidden = k !== i; });
    markActive(steps);
    markActive(dots);
    // No focus move, no live-region announcement.
  }
  function next() { show(i + 1); }

  function play() {
    if (playing) return;
    playing = true;
    if (playBtn) { playBtn.setAttribute('data-playing', 'true'); playBtn.textContent = playBtn.getAttribute('data-label-pause') || 'Pause'; }
    if (timer) clearInterval(timer);
    timer = setInterval(next, PERIOD);
  }
  function pause(explicit) {
    playing = false;
    if (explicit) userPaused = true;
    if (playBtn) { playBtn.setAttribute('data-playing', 'false'); playBtn.textContent = playBtn.getAttribute('data-label-play') || 'Play'; }
    if (timer) { clearInterval(timer); timer = null; }
  }
  function toggle() {
    if (playing) { pause(true); }
    else { userPaused = false; play(); }   // pressing Play is an explicit resume
  }

  if (playBtn) playBtn.addEventListener('click', toggle);
  dots.forEach(function (d, k) { d.addEventListener('click', function () { pause(true); show(k); }); });
  steps.forEach(function (s, k) { s.addEventListener('click', function () { pause(true); show(k); }); });

  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { pause(true); next(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { pause(true); show(i - 1); e.preventDefault(); }
  });

  // Autoplay only when visible AND motion allowed AND the user has not paused.
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting && !reduce && !userPaused) play();
      else pause(false);   // leaving the viewport pauses WITHOUT marking userPaused
    });
  }, { threshold: 0.4 }) : null;

  show(0);
  if (io) io.observe(root); else if (!reduce) play();

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onChange = function () { reduce = mq.matches; if (reduce) pause(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }
})();
