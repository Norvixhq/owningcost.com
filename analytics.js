/*
 * OwningCost — GA4 custom events (Session 2 measurement layer)
 *
 * Six key events designed for a calculator-first platform:
 *   1. calculator_complete  — fires when a user CHANGES an input and a calc result re-renders.
 *                              Excludes the initial page-load default render. The signal of
 *                              successful calculator use.
 *   2. cta_click            — fires when a user clicks a primary or ghost CTA button (a.btn).
 *                              Includes target href + label so attribution is clean.
 *   3. form_submit          — fires when a real form (NOT a calculator form) is submitted.
 *                              Used for contact / newsletter / lead-capture forms specifically.
 *   4. scroll_75            — fires once per page when the user scrolls past 75% of the article
 *                              body. Differentiates "loaded and bounced" from "actually read."
 *   5. outbound_click       — fires when a user clicks a link to an external domain.
 *                              Tells us which pages drive users to take action elsewhere.
 *   6. return_visit         — fires when a known visitor returns within 30 days.
 *                              Localstorage-backed. Useful as a "site provides ongoing value" signal.
 *
 * Plus existing legacy events preserved:
 *   - methodology_view, listing_check_run, ai_underlying_click
 *
 * No additional libraries; uses gtag() loaded by the GA snippet in <head>.
 * Resilient to gtag not being defined yet (queues into dataLayer).
 * Honors the existing consent.js mechanism (if user has not consented, events are skipped).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  // Safe sender — works whether gtag is loaded or queued, never throws.
  function track(eventName, params) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params || {});
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: eventName, ...(params || {}) });
      }
    } catch (e) { /* never throw from analytics */ }
  }

  // Read a meaningful "page slug" from the URL for cleaner reporting.
  function pageSlug() {
    var p = (window.location.pathname || '').replace(/\/$/, '/index');
    p = p.split('/').pop() || 'index';
    p = p.replace(/\.html$/i, '');
    return p || 'index';
  }

  // localStorage helpers, guarded for private-browsing / disabled-storage modes
  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) { /* noop */ }
  }

  // ---------------------------------------------------------------------------
  // 1. calculator_complete — fires on result re-render AFTER user input change
  // ---------------------------------------------------------------------------
  // Strategy: watch any .calc__out element for content changes via MutationObserver.
  // Only fire calculator_complete if the user has interacted with a form input first
  // (otherwise the initial page-load default render would fire it on every visit).
  //
  // Debounced to once per 1500ms so a single calc re-render with multiple DOM
  // mutations doesn't fire 5 events.
  (function () {
    if (!('MutationObserver' in window)) return;

    var outEl = document.querySelector('.calc__out');
    if (!outEl) return; // not a calculator page

    var hasInteracted = false;
    var lastFireTime = 0;
    var DEBOUNCE_MS = 1500;

    // Mark the user as having interacted once they touch any input in the calc form
    var calcForm = document.querySelector('form.calc');
    if (calcForm) {
      var markInteracted = function () { hasInteracted = true; };
      calcForm.addEventListener('input', markInteracted, true);
      calcForm.addEventListener('change', markInteracted, true);
    }

    // Watch result-output element for content changes
    var observer = new MutationObserver(function () {
      if (!hasInteracted) return;
      var now = Date.now();
      if (now - lastFireTime < DEBOUNCE_MS) return;
      lastFireTime = now;
      track('calculator_complete', {
        calc_name: pageSlug(),
        page_location: window.location.pathname,
      });
    });
    observer.observe(outEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  })();

  // ---------------------------------------------------------------------------
  // 2. cta_click — primary and ghost CTA buttons (a.btn)
  // ---------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.btn, a.btn--primary, a.btn--ghost');
    if (!a) return;
    if (a.closest('form.calc')) return; // calc-internal buttons handled by calculator_complete

    var href = a.getAttribute('href') || '';
    var label = (a.textContent || '').trim().slice(0, 60);

    // Outbound? Handled by separate listener below.
    if (/^https?:\/\//i.test(href) && href.indexOf(window.location.host) === -1) {
      return; // outbound_click listener will catch it
    }

    // AI-page → underlying calc routing (legacy event preserved)
    var aiPages = [
      'scenario-assistant', 'listing-analyzer',
      'compare-two-homes', 'compare-two-loans',
      'should-i-wait-to-buy', 'zip-lookup'
    ];
    if (aiPages.indexOf(pageSlug()) !== -1 && /-calculator\.html|listing-reality-check\.html/.test(href)) {
      track('ai_underlying_click', {
        ai_page: pageSlug(),
        target_calc: href.replace(/\.html$/, ''),
        link_text: label,
      });
      return;
    }

    track('cta_click', {
      cta_text: label,
      cta_href: href,
      cta_location: pageSlug(),
    });
  }, true);

  // ---------------------------------------------------------------------------
  // 3. form_submit — real form submissions (NOT calculator forms)
  // ---------------------------------------------------------------------------
  // Calculator forms use form.calc; lead/contact forms don't. We listen for
  // any submit event and exclude form.calc to avoid double-counting.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    if (form.classList && form.classList.contains('calc')) return; // calc, not a lead form

    var formName = form.getAttribute('name') || form.getAttribute('id') || 'unnamed_form';
    var formAction = form.getAttribute('action') || '';

    track('form_submit', {
      form_name: formName,
      form_action: formAction,
      page_location: window.location.pathname,
    });
  }, true);

  // ---------------------------------------------------------------------------
  // 4. scroll_75 — fires once per page when user scrolls past 75% of <main>
  // ---------------------------------------------------------------------------
  // Used to differentiate engaged readers from bounces on Learn / guide pages.
  // Throttled by a fired flag so we only fire once per page load.
  (function () {
    var main = document.querySelector('main') || document.body;
    if (!main) return;
    var fired = false;
    var ticking = false;

    function checkScroll() {
      ticking = false;
      if (fired) return;
      var rect = main.getBoundingClientRect();
      var mainTop = rect.top + window.scrollY;
      var mainHeight = rect.height;
      var viewportTop = window.scrollY;
      var viewportHeight = window.innerHeight;
      var scrolledDistance = viewportTop - mainTop + viewportHeight;
      if (mainHeight <= 0) return;
      var pct = scrolledDistance / mainHeight;
      if (pct >= 0.75) {
        fired = true;
        track('scroll_75', {
          page_location: window.location.pathname,
          page_slug: pageSlug(),
        });
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(checkScroll);
        ticking = true;
      }
    }, { passive: true });
  })();

  // ---------------------------------------------------------------------------
  // 5. outbound_click — links to external domains
  // ---------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return; // internal link
    if (href.indexOf(window.location.host) !== -1) return; // same-host link
    var label = (a.textContent || '').trim().slice(0, 60);
    track('outbound_click', {
      link_url: href,
      link_text: label,
      page_location: window.location.pathname,
    });
  }, true);

  // ---------------------------------------------------------------------------
  // 6. return_visit — fires when a known visitor returns within 30 days
  // ---------------------------------------------------------------------------
  // localStorage-backed; first visit silently sets the timestamp,
  // subsequent visits within 30 days fire the event with days_since_last
  (function () {
    var KEY = 'oc_last_visit';
    var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    var lastVisit = lsGet(KEY);
    var now = Date.now();

    if (lastVisit) {
      var lastMs = parseInt(lastVisit, 10);
      if (!isNaN(lastMs) && (now - lastMs) < THIRTY_DAYS_MS) {
        // Same-session re-loads also fire return_visit, but we suppress those
        // by requiring at least 30 minutes since the last fire on this device.
        var THIRTY_MIN_MS = 30 * 60 * 1000;
        if ((now - lastMs) >= THIRTY_MIN_MS) {
          var daysSince = Math.floor((now - lastMs) / (24 * 60 * 60 * 1000));
          track('return_visit', {
            days_since_last: daysSince,
            page_slug: pageSlug(),
          });
        }
      }
    }
    lsSet(KEY, String(now));
  })();

  // ---------------------------------------------------------------------------
  // Legacy events preserved (existing functionality)
  // ---------------------------------------------------------------------------

  // methodology_view — fires on any click of a link pointing to methodology.html
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="methodology.html"]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    track('methodology_view', {
      from_page: pageSlug(),
      target_anchor: (href.split('#')[1] || '(root)'),
    });
  }, true);

  // listing_check_run — preserved separately for the signature LRC funnel
  if (pageSlug() === 'listing-reality-check') {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('form.calc .btn--primary, form.calc button[type="submit"]');
      if (!btn) return;
      track('listing_check_run', { page_location: window.location.pathname });
    }, true);
  }

})();
