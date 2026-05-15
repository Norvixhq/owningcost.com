/* calc-url-state.js — universal URL state for calculators
 *
 * Drop-in module. Auto-attaches to any page with a #calcForm element.
 *
 * On load:  Reads URL hash → sets matching input values, fires 'input' to recompute.
 * On input: Writes the current input states to the URL hash (debounced).
 * Share:    Exposes window.calcURL.copyShareLink() which copies the current URL.
 *           If an element with id="copyShareBtn" exists, it's wired automatically.
 *
 * URL format: #v=1&inpPrice=425000&inpDown=20&...
 *   v=1 is a version tag so we can change the format later without breaking old links.
 *
 * Design constraints:
 *   - Pure vanilla JS, no dependencies, IE11-compatible syntax intentionally avoided
 *     (we target modern browsers — defer load means no blocking).
 *   - Each calc page already has its own inline script that wires inputs and runs
 *     recompute(). This module observes the same inputs without interfering.
 *   - Idempotent and safe to defer-load. No-ops if #calcForm isn't present.
 *   - Doesn't write hash for default values (keeps URLs clean when no edits).
 */
(function(){
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  var WRITE_DEBOUNCE_MS = 200;
  var VERSION = '1';

  // Initialize after DOMContentLoaded so all inputs are present
  function init(){
    var form = document.getElementById('calcForm');
    if (!form) return;

    // Find all inputs with an id that starts with a calc-input prefix
    // (any <input> inside #calcForm with an id)
    var inputs = Array.prototype.slice.call(
      form.querySelectorAll('input[id], select[id]')
    ).filter(function(el){
      // Only inputs that look like calc state — skip range mirrors (rng*)
      // because they shadow inpXxx values. We persist the inp side only.
      if (el.id.indexOf('rng') === 0) return false;
      return true;
    });

    if (inputs.length === 0) return;

    // Capture defaults (the page's initial values) BEFORE we apply hash
    // so we know what's "modified" vs. default.
    var defaults = {};
    inputs.forEach(function(el){
      defaults[el.id] = el.value;
    });

    // Apply hash → inputs on load
    applyHashToInputs(inputs);

    // Listen for input changes; write back to hash (debounced)
    var writeTimer = null;
    inputs.forEach(function(el){
      el.addEventListener('input', function(){
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(function(){
          writeInputsToHash(inputs, defaults);
        }, WRITE_DEBOUNCE_MS);
      });
      el.addEventListener('change', function(){
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(function(){
          writeInputsToHash(inputs, defaults);
        }, WRITE_DEBOUNCE_MS);
      });
    });

    // Wire up the share button if present
    var btn = document.getElementById('copyShareBtn');
    if (btn) {
      btn.addEventListener('click', function(e){
        e.preventDefault();
        copyShareLink(btn);
      });
    }

    // Public API
    window.calcURL = {
      copyShareLink: copyShareLink,
      _resetToDefaults: function(){
        // Used by future "reset" buttons if added
        inputs.forEach(function(el){
          if (defaults[el.id] !== undefined && el.value !== defaults[el.id]) {
            el.value = defaults[el.id];
            el.dispatchEvent(new Event('input', {bubbles: true}));
          }
        });
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
  }

  function applyHashToInputs(inputs){
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    var params = parseHash(hash);
    if (!params || params.v !== VERSION) return;

    var inputsById = {};
    inputs.forEach(function(el){ inputsById[el.id] = el; });

    var changed = false;
    Object.keys(params).forEach(function(key){
      if (key === 'v') return;
      var el = inputsById[key];
      if (!el) return;
      var value = params[key];
      // Sanity-check numeric inputs against their min/max
      if (el.type === 'number' || el.type === 'range') {
        var num = parseFloat(value);
        if (isNaN(num)) return;
        if (el.min !== '' && num < parseFloat(el.min)) num = parseFloat(el.min);
        if (el.max !== '' && num > parseFloat(el.max)) num = parseFloat(el.max);
        value = String(num);
      }
      if (el.value !== value) {
        el.value = value;
        changed = true;
      }
    });

    if (changed) {
      // Trigger recompute by firing 'input' on the first modified input
      // Each calc has its own listener on 'input' that calls recompute()
      // Firing once is enough since recompute reads all inputs from scratch.
      var anyInput = inputs[0];
      if (anyInput) {
        anyInput.dispatchEvent(new Event('input', {bubbles: true}));
      }
      // Also sync any range mirror inputs (rngXxx ←→ inpXxx)
      inputs.forEach(function(el){
        if (el.id.indexOf('inp') === 0) {
          var rngId = 'rng' + el.id.substring(3);
          var rng = document.getElementById(rngId);
          if (rng) rng.value = el.value;
        }
      });
    }
  }

  function writeInputsToHash(inputs, defaults){
    var parts = ['v=' + VERSION];
    var hasDiff = false;
    inputs.forEach(function(el){
      if (el.value !== defaults[el.id]) {
        parts.push(encodeURIComponent(el.id) + '=' + encodeURIComponent(el.value));
        hasDiff = true;
      }
    });

    if (!hasDiff) {
      // No diffs — clear the hash
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }

    var newHash = '#' + parts.join('&');
    if (newHash !== window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
    }
  }

  function parseHash(hash){
    // Strip leading #
    var s = hash.charAt(0) === '#' ? hash.substring(1) : hash;
    if (!s) return null;
    var out = {};
    var pairs = s.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      if (!p) continue;
      var eq = p.indexOf('=');
      if (eq < 0) continue;
      var k = decodeURIComponent(p.substring(0, eq));
      var v = decodeURIComponent(p.substring(eq + 1));
      out[k] = v;
    }
    return out;
  }

  function copyShareLink(btnOrNull){
    var url = window.location.href;
    // Modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function(){
        flashBtn(btnOrNull, 'Copied!');
      }).catch(function(){
        fallbackCopy(url, btnOrNull);
      });
    } else {
      fallbackCopy(url, btnOrNull);
    }
  }

  function fallbackCopy(text, btnOrNull){
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    flashBtn(btnOrNull, ok ? 'Copied!' : 'Copy failed');
  }

  function flashBtn(btn, msg){
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('is-flashed');
    setTimeout(function(){
      btn.textContent = orig;
      btn.classList.remove('is-flashed');
    }, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
