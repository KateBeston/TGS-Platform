/* ═══════════════════════════════════════════════════════════════════════
   FORM INTAKE — shared shape and helpers

   One endpoint receives every form on the platform site. The `form` field
   decides what gets created; everything else is common.

   Attribution precedence, deliberately:
     1. heard_about_us  — what the person told us
     2. UTM / click ID  — what the tracking saw
     3. referrer        — where the browser came from
     4. nothing         — Unattributed

   Self-reported wins because tracking only ever sees the last click. A
   person who heard about TGS from a friend, searched the name three weeks
   later and clicked an ad records as paid search and means word of mouth.
   Both are stored; only the precedence differs.
   ═══════════════════════════════════════════════════════════════════════ */

export type IntakePayload = {
  form: string;
  first_name?: string;
  surname?: string;
  organisation?: string;
  email?: string;
  phone?: string;
  website_url?: string;
  venue_name?: string;
  country?: string;
  city?: string;
  message?: string;
  heard_about_us?: string;
  heard_about_us_detail?: string;
  attribution?: {
    first?: Record<string, string | undefined>;
    last?: Record<string, string | undefined>;
    click_id?: string;
    click_id_type?: string;
  };
  [key: string]: unknown;
};

export type GeoHeaders = {
  country?: string; region?: string; city?: string;
  timezone?: string; language?: string;
};

/** Vercel sets these at the edge. No IP lookup service, and the raw IP is
 *  deliberately never read or stored — country and city are what the
 *  business needs, and an IP is personal data under both GDPR and the
 *  Australian Privacy Act. */
export function readGeo(headers: Headers): GeoHeaders {
  const g = (k: string) => headers.get(k) || undefined;
  const decodeCity = (v?: string) => {
    if (!v) return undefined;
    try { return decodeURIComponent(v); } catch { return v; }
  };
  return {
    country: g('x-vercel-ip-country'),
    region: g('x-vercel-ip-country-region'),
    city: decodeCity(g('x-vercel-ip-city')),
    timezone: g('x-vercel-ip-timezone'),
    language: headers.get('accept-language')?.split(',')[0] || undefined,
  };
}

export function resolveAttribution(p: IntakePayload) {
  const first = p.attribution?.first ?? {};
  const last = p.attribution?.last ?? {};
  const hasTracking = !!(first.utm_source || last.utm_source ||
                         p.attribution?.click_id || first.referrer);

  const source = p.heard_about_us ? 'Self-reported' : hasTracking ? 'Tracked' : 'None';
  const confidence = p.heard_about_us ? 'Tracked'
    : first.utm_source ? 'Tracked'
    : first.referrer ? 'Partial'
    : 'Unattributed';

  return {
    attribution_source: source,
    attribution_confidence: confidence,
    heard_about_us: p.heard_about_us ?? null,
    heard_about_us_detail: p.heard_about_us_detail ?? null,
    first_utm_source: first.utm_source ?? null,
    first_utm_medium: first.utm_medium ?? null,
    first_utm_campaign: first.utm_campaign ?? null,
    first_utm_content: first.utm_content ?? null,
    first_utm_term: first.utm_term ?? null,
    first_referrer: first.referrer ?? null,
    first_landing_page: first.landing_page ?? null,
    first_touch_at: first.touch_at ?? null,
    last_utm_source: last.utm_source ?? null,
    last_utm_medium: last.utm_medium ?? null,
    last_utm_campaign: last.utm_campaign ?? null,
    last_referrer: last.referrer ?? null,
    last_landing_page: last.landing_page ?? null,
    click_id: p.attribution?.click_id ?? null,
    click_id_type: p.attribution?.click_id_type ?? null,
  };
}

export function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
}

/** Which forms create which record. Unknown forms are rejected rather than
 *  guessed at — a typo in the form name should fail loudly, not quietly
 *  create the wrong kind of record. */
export const FORMS: Record<string, { creates: 'venue' | 'contact'; roles?: string[]; label: string }> = {
  'list-your-venue':   { creates: 'venue', label: 'List your venue' },
  'venue-enquiry':     { creates: 'venue', label: 'Venue enquiry' },
  'retreat-host':      { creates: 'contact', roles: ['retreat_host'], label: 'Retreat host enquiry' },
  'wellness-guest':    { creates: 'contact', roles: ['wellness_guest'], label: 'Wellness guest enquiry' },
  'contact-us':        { creates: 'contact', label: 'Contact us' },
  'newsletter':        { creates: 'contact', roles: ['newsletter'], label: 'Newsletter signup' },
  'waitlist':          { creates: 'contact', label: 'Platform waitlist' },
  'partner-enquiry':   { creates: 'contact', roles: ['referral_partner'], label: 'Partner enquiry' },
  'media-enquiry':     { creates: 'contact', roles: ['media_partner'], label: 'Media enquiry' },
};
