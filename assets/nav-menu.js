/* nav-menu.js — accessible mobile navigation drawer, shared by every page.
 *
 * Below the 820px breakpoint the five core links are hidden (hide-sm, gated on
 * the `js` class so a JS-less page keeps them visible). This wires a "Menu"
 * button that opens a drawer holding the SAME links in the SAME order.
 *
 * Accessibility:
 *   - Trigger is a native <button>: Enter and Space open it for free.
 *   - The panel is role="dialog" aria-modal="true": a real modal region.
 *   - While open, every other top-level element is made `inert` (removed from
 *     the a11y tree and pointer/tab flow) and body scroll is locked — so a
 *     screen-reader virtual cursor and touch scroll can't reach the background.
 *   - Opening moves focus to the first link; Tab / Shift+Tab wrap inside.
 *   - Escape closes and returns focus to the trigger; a link click closes and,
 *     for a same-document #hash link, moves focus to the target instead.
 *
 * The drawer's links are cloned from the page's own Primary nav (every direct
 * anchor child), so the drawer link set is exactly the Primary link set — it
 * cannot drift. Touch targets are >=44px (see .mobile-menu-panel a in the CSS).
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

    // Build the drawer once, cloning every direct anchor child of Primary.
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
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      // Mirror the Primary label so the modal reads as the navigation region.
      panel.setAttribute('aria-label', primary.getAttribute('aria-label') || 'Primary');
      var pk = primary.getAttribute('data-i18n-aria');
      if (pk) panel.setAttribute('data-i18n-aria', pk);
      // A visible close control inside the dialog — the WAI modal pattern
      // expects the dialog to be dismissable from its own descendants, not only
      // via Escape/backdrop (which a touch or screen-reader user may not find).
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'mobile-menu-close';
      closeBtn.setAttribute('data-i18n', 'closeMenu');
      closeBtn.setAttribute('data-i18n-aria', 'ariaCloseMenu');
      closeBtn.setAttribute('aria-label', 'Close menu');
      closeBtn.textContent = 'Close';
      panel.appendChild(closeBtn);
      // Clone the direct anchor children — not a data-i18n subset, so a link
      // that lost its data-i18n still appears; the drawer matches Primary exactly.
      var links = primary.querySelectorAll(':scope > a[href]');
      for (var i = 0; i < links.length; i++) {
        var a = links[i].cloneNode(true);
        a.classList.remove('hide-sm');
        panel.appendChild(a);
      }
      drawer.appendChild(backdrop);
      drawer.appendChild(panel);

      // If the page has a second "On this page" nav (solver's "How to use"),
      // mirror it into the drawer under its own heading, so those links stay
      // reachable on very small screens where the header hides that nav.
      var onpage = document.querySelector('nav.nav-onpage, nav[aria-label="On this page"], nav[data-i18n-aria="ariaOnPage"]');
      if (onpage) {
        var opLinks = onpage.querySelectorAll(':scope > a[href]');
        if (opLinks.length) {
          var opNav = document.createElement('nav');
          opNav.className = 'mobile-menu-panel mobile-menu-onpage';
          opNav.setAttribute('aria-label', onpage.getAttribute('aria-label') || 'On this page');
          var ok2 = onpage.getAttribute('data-i18n-aria');
          if (ok2) opNav.setAttribute('data-i18n-aria', ok2);
          for (var j = 0; j < opLinks.length; j++) {
            var oa = opLinks[j].cloneNode(true);
            oa.classList.remove('hide-sm');
            opNav.appendChild(oa);
          }
          panel.appendChild(opNav);
        }
      }
      // The drawer MUST be a direct child of <body>, not inside the header:
      // backgroundEls() makes every top-level element except the drawer inert,
      // and an inert ancestor would make the drawer's own links unfocusable.
      document.body.appendChild(drawer);
    }

    var panelEl = drawer.querySelector('.mobile-menu-panel');
    var backdropEl = drawer.querySelector('.mobile-menu-backdrop');
    var prevOverflow = '';

    function focusables() {
      return Array.prototype.slice.call(panelEl.querySelectorAll('a[href], button:not([disabled])'));
    }

    // Top-level elements to isolate while the drawer is open: everything except
    // the drawer itself and scripts. We save each one's prior inert state and
    // restore it on close, so this is safe even if something was already inert.
    function backgroundEls() {
      var out = [], kids = document.body.children;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el === drawer || el.tagName === 'SCRIPT') continue;
        out.push(el);
      }
      return out;
    }

    function open() {
      drawer.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';                 // lock background scroll
      backgroundEls().forEach(function (el) { el.__prevInert = el.inert; el.inert = true; });
      document.addEventListener('keydown', onKey, true);
      var f = focusables();
      if (f.length) f[0].focus();
    }

    function close(returnFocus) {
      drawer.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = prevOverflow;             // restore scroll
      backgroundEls().forEach(function (el) { el.inert = (el.__prevInert === true); delete el.__prevInert; });
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
    var closeButton = panelEl.querySelector('.mobile-menu-close');
    if (closeButton) closeButton.addEventListener('click', function () { close(true); });

    // A link click closes the drawer. For a link that stays in this document
    // (a #hash on the same page), don't fling focus back to the toggle — move
    // it to the fragment target so keyboard/AT users land where they navigated.
    panelEl.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[href]') : null;
      if (!link) return;
      var url;
      try { url = new URL(link.href, location.href); } catch (err) { url = null; }
      var sameDoc = url && url.pathname === location.pathname && url.search === location.search;
      close(!sameDoc);
      if (sameDoc && url.hash) {
        var target = document.querySelector(url.hash);
        if (target) { target.setAttribute('tabindex', '-1'); target.focus(); }
      }
    });

    // Signal that the drawer is fully built and wired. The CSS only collapses
    // the nav into the drawer once THIS class is present — so if this script
    // fails to load or throws before here, the class is never added and the
    // links stay visible (no dead Menu button). This is a stronger guarantee
    // than the `js` class, which only proves scripting is on, not that the
    // drawer actually initialised.
    document.documentElement.classList.add('nav-menu-ready');
  });
})();
