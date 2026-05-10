/* Meta Pixel — OwningCost
 * Pixel ID: 912670585135146
 * Fires PageView on every page load.
 *
 * Privacy: this file fires the base PageView event only. No custom events
 * with form-input parameters are added here. Adding custom events later
 * (e.g., calc completion) should be done deliberately in a separate file
 * or section, with no transmission of sensitive financial inputs.
 */
!function(f,b,e,v,n,t,s){
  if(f.fbq)return;
  n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)
}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '912670585135146');
fbq('track', 'PageView');
