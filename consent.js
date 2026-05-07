/*
 * OwningCost — Optional cookie consent scaffold
 *
 * This is OFF by default. To turn it on, include this script on a page:
 *   <script src="consent.js" defer></script>
 *
 * Behavior:
 *   - On first visit, shows a small banner at the bottom of the page
 *   - If user clicks Accept, calls gtag('consent','update',{...granted})
 *   - If user clicks Decline, calls gtag('consent','update',{...denied})
 *     and prevents the GA gtag from setting analytics cookies
 *   - Choice is stored in localStorage; banner doesn't reappear
 *
 * NOTES:
 *   - Texas (Frisco) does not require this banner today (no state law)
 *   - California (CCPA/CPRA) requires a "Do Not Sell" link, not a
 *     banner; OwningCost doesn't sell data, so the obligation is light
 *   - EU/UK visitors: GDPR/UK-GDPR require this banner; if you target
 *     those markets, enable this scaffold
 *
 * For full compliance with all U.S. state privacy laws (and to be
 * forward-compatible with future regulation), enabling this banner is
 * the safe default once traffic starts coming in.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'oc_consent_v1';
  var existing = null;
  try { existing = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  // Set the default consent state immediately (for late gtag init compat)
  if (typeof window.gtag === 'function') {
    if (existing === 'granted') {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',  // OwningCost shows no ads
        analytics_storage: 'granted',
      });
    } else if (existing === 'denied') {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
      });
    }
  }

  // If user has already chosen, don't show the banner
  if (existing === 'granted' || existing === 'denied') return;

  // Build the banner
  var banner = document.createElement('div');
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.style.cssText = [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:9999',
    'background:#FFFFFF', 'border-top:1px solid #E1E0DA',
    'box-shadow:0 -4px 14px rgba(0,0,0,0.06)',
    'padding:1rem 1.25rem', 'display:flex', 'flex-wrap:wrap',
    'gap:1rem', 'align-items:center', 'justify-content:space-between',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Manrope",sans-serif',
    'font-size:0.92rem', 'color:#0d1321', 'line-height:1.5',
  ].join(';');
  banner.innerHTML = (
    '<div style="flex:1 1 320px;min-width:0">' +
      '<strong>Analytics cookies.</strong> ' +
      "OwningCost uses Google Analytics to understand which tools and articles people find useful. " +
      'We don\'t run ads, sell data, or send you to a lender. ' +
      '<a href="privacy-policy.html" style="color:#1C6DD9">More about how we handle data</a>.' +
    '</div>' +
    '<div style="display:flex;gap:.5rem;flex-shrink:0">' +
      '<button type="button" data-oc-consent="denied" style="padding:.6rem 1rem;border:1px solid #C8C7C0;background:#fff;border-radius:6px;cursor:pointer;font:inherit;color:#0d1321">Decline</button>' +
      '<button type="button" data-oc-consent="granted" style="padding:.6rem 1.05rem;border:0;background:#1C6DD9;color:#fff;border-radius:6px;cursor:pointer;font:inherit;font-weight:500">Accept</button>' +
    '</div>'
  );

  function dismiss(decision) {
    try { localStorage.setItem(STORAGE_KEY, decision); } catch (e) {}
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: decision === 'granted' ? 'granted' : 'denied',
      });
    }
    if (banner.parentNode) banner.parentNode.removeChild(banner);
  }

  banner.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-oc-consent]');
    if (!btn) return;
    dismiss(btn.getAttribute('data-oc-consent'));
  });

  if (document.body) document.body.appendChild(banner);
  else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(banner); });
})();
