/* ═══════════════════════════════════════════════════════════════════════
   WEBSITE HARVEST — no AI, no API cost

   Reads what a page already states about itself in machine-readable form:
     1. schema.org JSON-LD  — the richest source. Many hospitality sites
        carry LodgingBusiness or Hotel markup with a full postal address,
        coordinates, phone and price range already structured.
     2. Open Graph / meta   — title, description, image.
     3. Explicit links      — mailto:, tel:, and social profiles.

   Everything here is PARSED, never inferred. If the page does not state a
   value in one of these forms, nothing is proposed. That is the whole
   reason this pass needs no model and cannot hallucinate: it can only
   report what is literally present.

   Judgement fields — venue type, facilities, description quality — are
   deliberately out of scope. They need a model, and that is a later pass.
   ═══════════════════════════════════════════════════════════════════════ */

import { extractLinks } from './socialLinks';

export type Harvested = {
  ok: boolean;
  error?: string;
  bytes?: number;
  hadStructuredData?: boolean;
  fields: Record<string, { value: string; evidence: string; source: string }>;
};

const UA = 'Mozilla/5.0 (compatible; TheGlobalSanctumBot/1.0; +https://www.theglobalsanctum.com)';

function normaliseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.toString();
  } catch {
    return null;
  }
}

/** Pull every JSON-LD block and flatten @graph containers, which is how
 *  most CMS plugins emit it. */
function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        if (it['@graph'] && Array.isArray(it['@graph'])) out.push(...it['@graph']);
        else out.push(it);
      }
    } catch {
      // Malformed JSON-LD is common. Skip it rather than failing the harvest.
    }
  }
  return out;
}

const PLACE_TYPES = [
  'Hotel','Resort','LodgingBusiness','BedAndBreakfast','Campground','Motel',
  'HealthAndBeautyBusiness','DaySpa','HealthClub','LocalBusiness','Organization',
  'Place','TouristAttraction','Restaurant',
];

function pickPlaceNode(nodes: any[]): any | null {
  const typeOf = (n: any) => Array.isArray(n?.['@type']) ? n['@type'] : [n?.['@type']];
  // Prefer the most specific lodging or wellness type over a bare Organization
  for (const t of PLACE_TYPES) {
    const hit = nodes.find((n) => typeOf(n).includes(t));
    if (hit) return hit;
  }
  return null;
}

function meta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decode(m[1]).trim();
  }
  return null;
}

/** og:image is very often a logo rather than a photograph of the property.
 *  A logo as a hero image is worse than no hero image, so anything that
 *  looks like one is dropped rather than proposed. */
function looksLikeLogo(url: string): boolean {
  return /logo|icon|favicon|badge|avatar|placeholder|sprite|watermark/i.test(url);
}

/** Social links scraped from a page are unreliable — a share button, the
 *  web designer's profile, or the owner's personal account all look the
 *  same to a regex. Only schema.org sameAs is treated as authoritative;
 *  scraped links are proposed at Low confidence with a warning. */
function isShareLink(url: string): boolean {
  return /\/(sharer|share\.php|intent|dialog)/i.test(url);
}

/** Compares two values as the same thing rather than as two strings.
 *
 *  Most phone "conflicts" were not conflicts: 61405400696 and
 *  +61 405 400 696 are one number written twice. Comparing raw strings
 *  made every reformatting look like a disagreement and buried the few
 *  real ones in noise.
 *
 *  Australian and New Zealand numbers are the awkward case — a leading 0
 *  is dropped when the country code is present, so 0428939663 and
 *  61428939663 are the same. Comparing the last nine digits handles both. */
export function samePhone(a: string, b: string): boolean {
  const digits = (v: string) => v.replace(/\D/g, '');
  const x = digits(a), y = digits(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const tail = (v: string) => v.slice(-9);
  return tail(x) === tail(y) && Math.abs(x.length - y.length) <= 3;
}

/** Emails differ only if they are actually different addresses. Case is
 *  not significant in practice, and a trailing dot is a typo. */
export function sameEmail(a: string, b: string): boolean {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\.$/, '');
  return norm(a) === norm(b);
}

/** A postcode that only gains a leading zero is a repair, not a
 *  disagreement — New Zealand postcodes are four digits and imports
 *  routinely strip the zero by treating them as numbers. */
export function isPostcodeRepair(current: string, proposed: string): boolean {
  return proposed.replace(/^0+/, '') === current.replace(/^0+/, '')
    && proposed.length > current.length;
}

/** Which mailto on a page is the right one.
 *
 *  Taking the first was wrong often enough to make things worse: it turned
 *  stay@venue.com into a personal gmail, and reservations@ into
 *  golf.bookings@.
 *
 *  Free webmail is ranked last but never excluded. A small owner-run
 *  retreat may genuinely publish a gmail address as its only contact, and
 *  refusing it leaves the venue with no email at all — which is worse than
 *  one that needs checking. It is flagged in the evidence instead, so the
 *  reviewer knows what they are accepting. */
const EMAIL_PREFERENCE = [
  /^(reservations|bookings|book|stay|enquiries|enquiry|inquiries|hello|info|contact)@/i,
];
const FREE_MAIL = /@(gmail|hotmail|outlook|yahoo|bigpond|icloud|live|aol)\./i;

export type EmailPick = { email: string; personal: boolean; considered: number } | null;

/** Addresses that belong to nobody in particular — a webmaster, a site
 *  builder, a stock template. These are excluded outright because they are
 *  never the venue. */
const NOT_A_VENUE = /^(webmaster|postmaster|noreply|no-reply|donotreply|abuse|privacy|dpo|hostmaster|admin@wordpress|wordpress|example|your.?email|name@)/i;

function pickEmail(candidates: string[], siteHost: string | null): EmailPick {
  const clean = Array.from(new Set(candidates.map((c) => c.trim().toLowerCase())))
    .filter((c) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(c))
    .filter((c) => !NOT_A_VENUE.test(c))
    .filter((c) => !/\.(png|jpg|gif|svg|css|js)$/i.test(c));
  if (!clean.length) return null;

  const bare = siteHost ? siteHost.replace(/^www\./, '') : null;
  const onDomain = bare
    ? clean.filter((c) => c.split('@')[1]?.includes(bare))
    : [];
  const otherBusiness = clean.filter((c) => !FREE_MAIL.test(c) && !onDomain.includes(c));
  const personal = clean.filter((c) => FREE_MAIL.test(c));

  // Ranked, not filtered: the venue's own domain first, then any other
  // business address, then personal webmail. A gmail is a last resort
  // rather than a disqualification.
  const ranked = [...onDomain, ...otherBusiness, ...personal];
  if (!ranked.length) return null;

  const prefer = (pool: string[]) => {
    for (const pattern of EMAIL_PREFERENCE) {
      const hit = pool.find((c) => pattern.test(c));
      if (hit) return hit;
    }
    return pool[0];
  };

  const chosen = onDomain.length ? prefer(onDomain)
    : otherBusiness.length ? prefer(otherBusiness)
    : personal[0];

  return { email: chosen, personal: FREE_MAIL.test(chosen), considered: clean.length };
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'");
}

export async function harvest(rawUrl: string): Promise<Harvested> {
  const url = normaliseUrl(rawUrl);
  if (!url) return { ok: false, error: 'Not a usable URL.', fields: {} };

  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, error: `Site returned ${res.status}.`, fields: {} };
    html = await res.text();
  } catch (e: any) {
    return {
      ok: false,
      error: e?.name === 'TimeoutError' ? 'Site did not respond within 12 seconds.'
        : 'Could not reach the site.',
      fields: {},
    };
  }

  const fields: Harvested['fields'] = {};
  const add = (col: string, value: unknown, evidence: string, source: string) => {
    if (value === null || value === undefined) return;
    const v = String(value).trim();
    if (!v || fields[col]) return;           // first source wins; JSON-LD runs first
    fields[col] = { value: v, evidence: evidence.slice(0, 300), source };
  };

  /* ── 1 · schema.org ─────────────────────────────────────────────── */
  const nodes = extractJsonLd(html);
  const place = pickPlaceNode(nodes);
  const hadStructuredData = !!place;

  if (place) {
    const ev = 'schema.org JSON-LD';
    add('venue_name', place.name, `name: ${place.name}`, 'StructuredData');
    add('venue_short_description', place.description,
        `description: ${String(place.description).slice(0, 120)}…`, 'StructuredData');

    const a = place.address;
    if (a && typeof a === 'object') {
      add('street_address', a.streetAddress, `streetAddress: ${a.streetAddress}`, 'StructuredData');
      add('postcode', a.postalCode, `postalCode: ${a.postalCode}`, 'StructuredData');
    }

    const g = place.geo;
    if (g && typeof g === 'object') {
      add('latitude', g.latitude, `geo.latitude: ${g.latitude}`, 'StructuredData');
      add('longitude', g.longitude, `geo.longitude: ${g.longitude}`, 'StructuredData');
    }

    add('contact_phone', place.telephone, `telephone: ${place.telephone}`, 'StructuredData');
    add('contact_email', place.email, `email: ${place.email}`, 'StructuredData');
    const img = typeof place.image === 'string'
      ? place.image : place.image?.url ?? place.image?.[0];
    if (img && !looksLikeLogo(String(img))) {
      add('primary_image_url', img, `schema.org image: ${img}`, 'StructuredData');
    }

    if (Array.isArray(place.sameAs)) {
      for (const s of place.sameAs) {
        if (/instagram\.com/i.test(s)) add('instagram_url', s, `sameAs: ${s}`, 'StructuredData');
        if (/facebook\.com/i.test(s))  add('facebook_url', s, `sameAs: ${s}`, 'StructuredData');
        if (/linkedin\.com/i.test(s))  add('linkedin_url', s, `sameAs: ${s}`, 'StructuredData');
      }
    }
    void ev;
  }

  /* ── 2 · Open Graph and meta ────────────────────────────────────── */
  const ogTitle = meta(html, 'og:site_name') ?? meta(html, 'og:title');
  const ogDesc = meta(html, 'og:description') ?? meta(html, 'description');
  const ogImage = meta(html, 'og:image');

  add('venue_name', ogTitle, `og:title / og:site_name: ${ogTitle}`, 'PageText');
  add('venue_short_description', ogDesc, `meta description: ${String(ogDesc).slice(0, 120)}…`, 'PageText');
  if (ogImage && !looksLikeLogo(ogImage)) {
    add('primary_image_url', ogImage, `og:image: ${ogImage}`, 'PageText');
  }

  /* ── 3 · explicit links ─────────────────────────────────────────── */
  const mail = html.match(/mailto:([^"'?\s>]+@[^"'?\s>]+)/i);
  if (mail) add('contact_email', decode(mail[1]), `mailto link: ${mail[1]}`, 'PageText');

  const tel = html.match(/tel:([+0-9()\s-]{6,20})/i);
  if (tel) add('contact_phone', tel[1].trim(), `tel link: ${tel[1].trim()}`, 'PageText');

  // Every link the page carries, matched on domain rather than on the
  // text beside it — an icon has no text, and "Follow us" says nothing
  // about which platform.
  const links = extractLinks(html, url);

  for (const [col, found] of Object.entries(links.fields)) {
    add(col, found,
        `Link on the page: ${found}`,
        // A share widget or the designer's own account looks the same as
        // the venue's from the markup, so a person still decides.
        'Unverified');
  }

  if (links.whatsapp) {
    add('whatsapp_number', links.whatsapp,
        `WhatsApp link: ${links.whatsapp}`, 'PageText');
  }

  if (links.other.length) {
    add('other_links', JSON.stringify(links.other),
        `${links.other.length} link${links.other.length === 1 ? '' : 's'} to platforms `
        + `with no field of their own: ${links.other.map((o) => o.label).join(', ')}`,
        'PageText');
  }

  return { ok: true, bytes: html.length, hadStructuredData, fields };
}
