/* cap-lightbox.js — accessible image lightbox for the capabilities page.
 *
 * Figure images link to their full-size file (progressive enhancement: with JS
 * off, the link just opens the image). With JS on, clicking opens the image in
 * an in-page dialog with a visible Close button, so the reader never has to use
 * the browser back button to return. The dialog:
 *   - is role="dialog" aria-modal="true" with a labelled Close control,
 *   - closes on the Close button, on backdrop click, and on Escape,
 *   - traps focus while open and restores focus to the trigger on close,
 *   - locks background scroll while open.
 *
 * No framework, no storage. Safe to load with `defer`.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  function t(key, fallback) {
    try {
      if (window.Plumline && Plumline.i18n && typeof Plumline.i18n.t === 'function') {
        var s = Plumline.i18n.t(key);
        if (s) return s;
      }
    } catch (e) {}
    return fallback;
  }

  var overlay, dialog, img, closeBtn, lastFocused;

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'cap-lightbox';
    overlay.hidden = true;

    dialog = document.createElement('div');
    dialog.className = 'cap-lightbox-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cap-lightbox-close';
    // A visible glyph plus an accessible label.
    closeBtn.innerHTML = '<span aria-hidden="true">\u00D7</span>';
    closeBtn.setAttribute('aria-label', t('capCloseImage', 'Close image'));

    img = document.createElement('img');
    img.className = 'cap-lightbox-img';
    img.alt = '';

    dialog.appendChild(closeBtn);
    dialog.appendChild(img);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      // Backdrop click (but not clicks inside the dialog) closes.
      if (e.target === overlay) close();
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (overlay.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { trapFocus(e); }
    });
  }

  // Focus stays on the Close button (the only focusable control in the dialog).
  function trapFocus(e) {
    e.preventDefault();
    closeBtn.focus();
  }

  function open(href, altText) {
    if (!overlay) build();
    lastFocused = document.activeElement;
    img.src = href;
    img.alt = altText || '';
    closeBtn.setAttribute('aria-label', t('capCloseImage', 'Close image'));
    overlay.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    img.src = '';
    document.documentElement.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function wire() {
    var links = document.querySelectorAll('a.cap-figure-link');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) {
        // Left-click, no modifier: open the in-page lightbox instead of
        // navigating. Modified clicks (new tab) keep their default behaviour.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        var link = e.currentTarget;
        var innerImg = link.querySelector('img');
        open(link.getAttribute('href'), innerImg ? innerImg.getAttribute('alt') : '');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
