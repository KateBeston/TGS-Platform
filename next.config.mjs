/** @type {import('next').NextConfig} */

/* ═══════════════════════════════════════════════════════════════════════
   SECURITY HEADERS

   The Platform is the public one, so these matter more here than on the
   portal, not less. Anyone can probe it, and the sign-in and sign-up forms
   are the only place on the whole stack where a stranger types a password.

   frame-ancestors is the one that earns its place: it stops somebody
   embedding the sign-in page in an invisible frame on their own site and
   collecting what is typed into it. That attack only makes sense against a
   public login.

   Two differences from the portal:

     The Platform is indexed and should be, so nothing here touches robots.

     Google Tag Manager loads other scripts by design, which is exactly
     what a content policy exists to prevent. Enforcing a strict policy
     against a tag manager breaks analytics quietly and at a moment nobody
     is watching, so the policy is REPORT ONLY. It records what it would
     have blocked and blocks nothing. Enforce it once it has been quiet for
     a week, and expect to widen it when a new tag is added.
   ═══════════════════════════════════════════════════════════════════════ */

const csp = [
  "default-src 'self'",

  // Next's runtime needs inline and eval. GTM and its tags come from
  // Google; Turnstile is the bot check on the forms.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    + ' https://www.googletagmanager.com https://www.google-analytics.com'
    + ' https://challenges.cloudflare.com https://maps.googleapis.com',

  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",

  // Venue photography from Supabase storage, stock from Unsplash, map
  // tiles and place photos from Google.
  "img-src 'self' data: blob:"
    + ' https://*.supabase.co https://images.unsplash.com'
    + ' https://*.googleapis.com https://maps.gstatic.com https://*.ggpht.com'
    + ' https://www.google-analytics.com https://www.googletagmanager.com',

  "connect-src 'self'"
    + ' https://*.supabase.co wss://*.supabase.co'
    + ' https://www.google-analytics.com https://analytics.google.com'
    + ' https://www.googletagmanager.com'
    + ' https://places.googleapis.com https://maps.googleapis.com',

  "frame-src 'self' https://challenges.cloudflare.com https://www.google.com https://www.googletagmanager.com",

  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

const nextConfig = {
  experimental: {
    serverActions: {
      // Server actions cap request bodies at 1 MB by default, which is
      // fine for a form and wrong for a file upload — the storage buckets
      // accept 20 to 25 MB, so without this a scanned agreement would be
      // rejected by the framework before it reached Supabase, with an
      // error that does not explain itself.
      bodySizeLimit: '25mb',
    },
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
