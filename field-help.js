/* field-help.js — inline input education tooltip controller
 *
 * Hover and focus open the tooltip via CSS alone. Tap (touch) needs JS
 * because CSS :hover is unreliable on touch devices and may "stick" until
 * another tap elsewhere on the document.
 *
 * Behavior:
 *   - Tap a .field__help button → toggles data-open
 *   - Tap outside any open tooltip → closes all
 *   - ESC key → closes all
 *   - Only one tooltip open at a time
 *   - No-ops on environments without document (SSR-safe)
 */
(function(){
  'use strict';

  if (typeof document === 'undefined') return;

  function closeAll(except) {
    var open = document.querySelectorAll('.field__help[data-open="true"]');
    for (var i = 0; i < open.length; i++) {
      if (open[i] !== except) {
        open[i].removeAttribute('data-open');
      }
    }
  }

  // Click handler on each help button — toggles, closing others first
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.field__help');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var isOpen = btn.getAttribute('data-open') === 'true';
      closeAll(btn);
      if (isOpen) {
        btn.removeAttribute('data-open');
      } else {
        btn.setAttribute('data-open', 'true');
      }
      return;
    }
    // Click outside any help button — close everything
    closeAll(null);
  }, true);

  // ESC closes all open tooltips
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeAll(null);
    }
  });

  // When a help button loses focus and we're not on a touch device,
  // tidy up any lingering open state from a prior tap
  document.addEventListener('focusin', function(e){
    var t = e.target;
    if (!t.classList || !t.classList.contains('field__help')) {
      // Focus moved off any help button → close all
      // (CSS :focus-visible handles the keyboard-focus case)
      closeAll(null);
    }
  });
})();
