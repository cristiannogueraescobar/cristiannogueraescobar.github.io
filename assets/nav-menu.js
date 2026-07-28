/* nav-menu.js — accessible mobile navigation drawer, shared by every page.
 *
 * Below the 820px breakpoint the five core links are hidden (hide-sm). This
 * wires a "Menu" button that opens a drawer holding the SAME five links in the
 * SAME order, with full keyboard support:
 *   - The trigger is a native <button>, so Enter and Space open it for free.
 *   - Escape closes it and returns focus to the trigger.
 *   - Opening moves focus to the first link; Tab/Shift+Tab are trapped inside
 *     the drawer while it is open.
 *   - Clicking the backdrop or any link closes it.
 * Touch targets in the drawer are >=44px (see .mobile-menu a in the CSS).
 *
 * The drawer markup is built here from the page's own Primary nav, so the link
 * set can never drift from the desktop nav — there is a single source of truth.
 */
(function () {
  'use strict';
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var toggle = document.querySelector('.menu-toggle');
    var primary = document.querySelector('nav[aria-label="Primary"], nav[data-i18n-aria="ariaPrimary"]');
    if (!toggle || !primary) return;

    // Build the drawer once, cloning the five core links from the Primary nav.
    var drawer = document.getElementById('mobile-menu');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'mobile-menu';
      drawer.className = 'mobile-menu';
      drawer.setAttribute('hidden', '');
      var backdrop = document.createElement('div');
      backdrop.className = 'mobile-menu-backdrop';
      var panel = document.createElement('nav');
      panel.className = 'mobile-menu-panel';
      // Mirror the Primary label so the drawer reads as the same region.
      panel.setAttribute('aria-label', primary.getAttribute('aria-label') || 'Primary');
      var pk = primary.getAttribute('data-i18n-aria');
      if (pk) panel.setAttribute('data-i18n-aria', pk);
      // Clone the core links (anchors carrying data-i18n="nav...").
      var links = primary.querySelectorAll('a[data-i18n^="nav"]');
      for (var i = 0; i < links.length; i++) {
        var a = links[i].cloneNode(true);
        a.classList.remove('hide-sm');
        panel.appendChild(a);
      }
      drawer.appendChild(backdrop);
      drawer.appendChild(panel);
      toggle.parentNode.insertBefore(drawer, toggle.nextSibling);
    }

    var panelEl = drawer.querySelector('.mobile-menu-panel');
    var backdropEl = drawer.querySelector('.mobile-menu-backdrop');

    function focusables() {
      return Array.prototype.slice.call(panelEl.querySelectorAll('a[href], button:not([disabled])'));
    }

    function open() {
      drawer.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', onKey, true);
      var f = focusables();
      if (f.length) f[0].focus();
    }

    function close(returnFocus) {
      drawer.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKey, true);
      if (returnFocus !== false) toggle.focus();
    }

    function isOpen() { return !drawer.hasAttribute('hidden'); }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    toggle.addEventListener('click', function () { isOpen() ? close(true) : open(); });
    backdropEl.addEventListener('click', function () { close(true); });
    // A link click navigates away; close without stealing focus back.
    panelEl.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') close(false);
    });
  });
})();
