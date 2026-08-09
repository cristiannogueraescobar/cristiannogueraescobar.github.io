'use strict';
/* F4c motion lab wiring. Consumes the CANONICAL public API (window.PlumlineMotion,
 * assembled by index.js from the module globals). No duplicated logic. Every
 * controller created here is torn down on pagehide to prove cleanup works. */
(function () {
  var api = window.PlumlineMotion || {};
  var controllers = [];

  // State-transition demo: arm the surface (feature-specific flag) then settle.
  // The logical content is already present and readable without JS; arming only
  // happens here, after enhancement.
  function runStateEnter() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-demo-state]'), function (el) {
      el.classList.add('pl-motion-state-enter', 'pl-motion-state-armed');
      el.classList.remove('pl-motion-in');
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('pl-motion-in'); }); });
    });
  }

  function runInstrument() {
    var plumb = document.querySelector('[data-plumb]');
    var measure = document.querySelector('[data-measure]');
    if (plumb) { plumb.classList.remove('pl-plumb-run'); void plumb.offsetWidth; plumb.classList.add('pl-plumb-run'); }
    if (measure) { measure.classList.remove('pl-measure-run'); void measure.offsetWidth; measure.classList.add('pl-measure-run'); }
  }

  // Reveal controller (one-shot; observer-owned; feature-specific arming).
  if (api.createReveal) controllers.push(api.createReveal(document));

  // Sequence controller.
  var seqRoot = document.querySelector('[data-seq]');
  var seqCtrl = null;
  if (api.createSequence && seqRoot) { seqCtrl = api.createSequence(seqRoot); controllers.push(seqCtrl); }

  // Lab-only replay buttons. Each starts `hidden` in the HTML (so without JS it
  // is not a dead visible control); we remove `hidden` ONLY after its click
  // handler is registered, so an activated button always works.
  function activate(el) { if (el) el.removeAttribute('hidden'); }
  var stateRun = document.querySelector('[data-demo-state-run]');
  if (stateRun) { stateRun.addEventListener('click', runStateEnter); activate(stateRun); }
  var instrRun = document.querySelector('[data-instrument-run]');
  if (instrRun) { instrRun.addEventListener('click', runInstrument); activate(instrRun); }
  var revealReset = document.querySelector('[data-reveal-reset]');
  if (revealReset) {
    revealReset.addEventListener('click', function () {
      controllers.forEach(function (c) { if (c && c.reset) c.reset(); });
    });
    activate(revealReset);
  }

  // Kick the initial one-shots (after enhancement).
  runStateEnter();
  runInstrument();

  // Prove cleanup: tear everything down when the page is being hidden/unloaded.
  window.addEventListener('pagehide', function () {
    controllers.forEach(function (c) { if (c && c.destroy) c.destroy(); });
  });
})();
