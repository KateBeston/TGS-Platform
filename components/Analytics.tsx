import Script from 'next/script';

/* Google Tag Manager.
 *
 * The container is loaded after ConsentDefaults, which is beforeInteractive
 * and has already set every category to denied. That ordering is the
 * whole arrangement: GTM starts with permission for nothing and is
 * updated when somebody answers the banner.
 *
 * The IDs are not secret — GTM-NBQCMQXG is in the page source of every
 * site that uses it — so they are constants rather than environment
 * variables. One less thing to misconfigure in Vercel.
 */

export const GTM_ID = 'GTM-NBQCMQXG';
export const GA4_ID = 'G-3Q4XXCZ3VQ';

export default function Analytics() {
  // Nothing loads in development. Otherwise a local click-through fills
  // the reports with traffic that was never a visitor.
  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <Script id="gtm" strategy="afterInteractive">
      {`
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
      `.trim()}
    </Script>
  );
}

/* The noscript fallback, immediately after body.
 *
 * Almost nobody has JavaScript off, but the tag is two lines and the
 * audit asks for it by position. */
export function AnalyticsNoScript() {
  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0" width="0" style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager" />
    </noscript>
  );
}
