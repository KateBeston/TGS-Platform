import Script from 'next/script';

/* Consent Mode defaults, set before anything else runs.
 *
 * Denied, every category, before the first tag loads. That ordering is
 * the whole point — a default of granted with an update afterwards means
 * every visitor is measured for the moment between the two, which is
 * exactly what the regime exists to prevent.
 *
 * beforeInteractive so it runs ahead of GTM. Written as a raw script
 * rather than a component effect because an effect runs after hydration,
 * by which time a tag may already have fired.
 */

export default function ConsentDefaults() {
  return (
    <Script id="consent-defaults" strategy="beforeInteractive">
      {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  analytics_storage:'denied',
  functionality_storage:'denied',
  personalization_storage:'denied',
  security_storage:'granted',
  wait_for_update: 600
});
try {
  var s = localStorage.getItem('tgs.consent');
  if (s) {
    var c = JSON.parse(s);
    if (c && c.version === 1) {
      gtag('consent','update',{
        ad_storage: c.marketing ? 'granted':'denied',
        ad_user_data: c.marketing ? 'granted':'denied',
        ad_personalization: c.marketing ? 'granted':'denied',
        analytics_storage: c.analytics ? 'granted':'denied',
        functionality_storage: c.functional ? 'granted':'denied',
        personalization_storage: c.functional ? 'granted':'denied',
        security_storage:'granted'
      });
    }
  }
} catch (e) {}
      `.trim()}
    </Script>
  );
}
