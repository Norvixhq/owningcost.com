/*
 * OwningCost — GA4 custom events
 *
 * Listens for events that matter to a calculator-first platform:
 *   calc_run             — user submitted a calculator (any form.calc)
 *   cta_click            — user clicked a primary or ghost CTA button (.btn)
 *   methodology_view     — user opened a methodology link
 *   listing_check_run    — user ran the signature Listing Reality Check tool
 *   ai_underlying_click  — user clicked through from an AI page to its underlying calc
 *   outbound_click       — user clicked an external (http/https) link
 *
 * No additional libraries; uses gtag() loaded by the GA snippet in <head>.
 * Resilient to gtag not being defined yet (queues into dataLayer).
 */
(function () {
  'use strict';

  // Safe sender — works whether gtag is loaded or queued
  function track(eventName, params) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params || {});
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: eventName, ...(params || {}) });
      }
    } catch (e) { /* never throw from analytics */ }
  }

  // Read a meaningful "page name" from the URL for cleaner reporting
  function pageSlug() {
    var p = (window.location.pathname || '').replace(/\/$/, '/index');
    p = p.split('/').pop() || 'index';
    p = p.replace(/\.html$/i, '');
    return p || 'index';
  }

  // --- 1. Calculator submissions -----------------------------------------
  // Every form.calc is a calculator. Listen for submit at the document
  // level to catch any form, including those rendered after page load.
  document.addEventListener('submit', function (e) {
    var form = e.target.closest && e.target.closest('form.calc');
    if (!form) return;
    track('calc_run', {
      calc_name: pageSlug(),
      page_location: window.location.pathname,
    });
  }, true);

  // Some calcs use buttons that don't submit (onsubmit="return false").
  // Catch those by listening for clicks on .btn--primary / [data-calc-go]
  // inside .calc forms.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('form.calc button, form.calc [type="submit"], form.calc .btn--primary');
    if (!btn) return;
    track('calc_run', {
      calc_name: pageSlug(),
      page_location: window.location.pathname,
    });
  }, true);

  // --- 2. CTA clicks ------------------------------------------------------
  // .btn elements outside of forms (form-internal calc buttons handled above)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.btn, a.btn--primary, a.btn--ghost');
    if (!a) return;
    if (a.closest('form.calc')) return; // already counted above

    var href = a.getAttribute('href') || '';
    var label = (a.textContent || '').trim().slice(0, 60);

    // Outbound link?
    if (/^https?:\/\//i.test(href) && href.indexOf(window.location.host) === -1) {
      track('outbound_click', { link_url: href, link_text: label });
      return;
    }

    // AI-page → underlying calculator path:
    // detect the "Use the calculator now" / underlying-tool pattern by
    // checking if we're on one of the 6 AI pages and clicking to a calc.
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
      page_location: window.location.pathname,
    });
  }, true);

  // --- 3. Methodology link views -----------------------------------------
  // Any <a> pointing at methodology.html, including deep-anchors
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="methodology.html"]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    track('methodology_view', {
      from_page: pageSlug(),
      target_anchor: (href.split('#')[1] || '(root)'),
    });
  }, true);

  // --- 4. Listing Reality Check — special-case the signature tool --------
  // Track a distinct event when the LRC's run-check button is fired,
  // separately from generic calc_run, so the signature tool's funnel is
  // visible in GA reports.
  if (pageSlug() === 'listing-reality-check') {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('form.calc .btn--primary, form.calc button[type="submit"]');
      if (!btn) return;
      track('listing_check_run', { page_location: window.location.pathname });
    }, true);
  }

})();
