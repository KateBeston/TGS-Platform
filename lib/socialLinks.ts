/* ═══════════════════════════════════════════════════════════════════════
   SOCIAL AND EXTERNAL LINKS

   Read from the page rather than asked of the model. A link is a fact
   sitting in the markup — there is nothing to infer, and asking a model
   to repeat back a URL it can see is a way of introducing typos into
   something that was already correct.

   Matched on the domain, not the link text. A page may label a link
   "Follow us" or nothing at all, and the icon carries no text.
   ═══════════════════════════════════════════════════════════════════════ */

export type LinkTarget = {
  column: string;
  label: string;
  hosts: RegExp;
  /** Paths that are the platform's own pages rather than the venue's. */
  reject?: RegExp;
};

export const LINK_TARGETS: LinkTarget[] = [
  { column: 'instagram_url', label: 'Instagram',
    hosts: /(^|\.)instagram\.com$/i,
    reject: /^\/(p|reel|explore|accounts|stories)\b/i },
  { column: 'facebook_url', label: 'Facebook',
    hosts: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i,
    reject: /^\/(sharer|share|dialog|plugins|tr)\b/i },
  { column: 'linkedin_url', label: 'LinkedIn',
    hosts: /(^|\.)linkedin\.com$/i,
    reject: /^\/(share|sharing|shareArticle)\b/i },
  { column: 'youtube_url', label: 'YouTube',
    hosts: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { column: 'tiktok_url', label: 'TikTok',
    hosts: /(^|\.)tiktok\.com$/i },
  { column: 'pinterest_url', label: 'Pinterest',
    hosts: /(^|\.)pinterest\.[a-z.]+$/i,
    reject: /^\/pin\/create\b/i },
  { column: 'tripadvisor_url', label: 'TripAdvisor',
    hosts: /(^|\.)tripadvisor\.[a-z.]+$/i },
  { column: 'google_business_url', label: 'Google',
    hosts: /(^|\.)(goo\.gl|maps\.app\.goo\.gl|google\.[a-z.]+)$/i,
    // Analytics, fonts and tag manager are not the venue's listing.
    reject: /^\/(recaptcha|maps\/api)\b/i },
];

/** Which booking platform a venue runs on.
 *
 *  Not a competitive signal — every venue on Booking.com has its own
 *  booking page too, and direct booking has coexisted with marketplace
 *  distribution for twenty years because they serve different moments.
 *  Someone who already knows a venue books direct; someone deciding where
 *  in Bali to go does not.
 *
 *  Recorded because it says which system holds their calendar, which
 *  matters when availability sync arrives — Cloudbeds, Siteminder and
 *  Mews all expose it differently. */
const BOOKING_ENGINES = /(reserveonline|siteminder|littlehotelier|cloudbeds|resnexus|checkfront|bookeo|simplybook|guesty|lodgify|beds24|smoobu|hotelrunner|synxis|travelclick|profitroom|mews|roomraccoon|newbook|resly)\./i;

/** Platforms with no column. A Balinese venue publishes several and the
 *  next one will be something nobody here has heard of. */
const OTHER_PLATFORMS: { test: RegExp; label: string }[] = [
  { test: /xhslink|xiaohongshu/i, label: 'Xiaohongshu' },
  { test: /weixin|wechat/i, label: 'WeChat' },
  { test: /line\.me/i, label: 'LINE' },
  { test: /(^|\.)vk\.com$/i, label: 'VK' },
  { test: /(^|\.)(twitter\.com|x\.com)$/i, label: 'X' },
  { test: /(^|\.)threads\.net$/i, label: 'Threads' },
  { test: /(^|\.)(spotify|soundcloud)\.com$/i, label: 'Audio' },
  { test: /(^|\.)vimeo\.com$/i, label: 'Vimeo' },
  // A venue already listed on a marketplace understands commission and
  // third-party distribution, which makes the conversation shorter.
  { test: /(^|\.)(booking\.com|airbnb\.[a-z.]+|expedia\.[a-z.]+|agoda\.com|hostelworld\.com)$/i,
    label: 'Listed elsewhere' },
];

export type FoundLinks = {
  fields: Record<string, string>;
  whatsapp: string | null;
  other: { label: string; url: string }[];
};

/** WordPress and others write &#038; for & in href attributes, so a URL
 *  copied straight out of the markup carries entities that break it. */
function decodeEntities(url: string): string {
  return url
    .replace(/&#0?38;|&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function extractLinks(html: string, pageUrl: string): FoundLinks {
  const fields: Record<string, string> = {};
  const other = new Map<string, { label: string; url: string }>();
  let whatsapp: string | null = null;

  let siteHost = '';
  try { siteHost = new URL(pageUrl).hostname.replace(/^www\./, ''); } catch { /* ignore */ }

  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let url: URL;
    try { url = new URL(decodeEntities(m[1]), pageUrl); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;

    const host = url.hostname.replace(/^www\./, '');

    // wa.me and wa.link carry the number in the path.
    if (/(^|\.)(wa\.me|wa\.link|api\.whatsapp\.com)$/i.test(host)) {
      const digits = (url.pathname + url.search).replace(/\D/g, '');
      if (digits.length >= 8 && !whatsapp) whatsapp = `+${digits}`;
      continue;
    }

    // The venue's own domain is the website, not a social link.
    if (host === siteHost) continue;

    const target = LINK_TARGETS.find((t) => t.hosts.test(host));
    if (target) {
      if (target.reject?.test(url.pathname)) continue;
      // A profile has a path. facebook.com on its own is a share widget.
      if (url.pathname === '/' || url.pathname === '') continue;
      // First one wins — a footer link is the venue's, a link inside a
      // testimonial may not be.
      if (!fields[target.column]) fields[target.column] = url.href;
      continue;
    }

    if (BOOKING_ENGINES.test(host) && !fields.booking_engine_url) {
      fields.booking_engine_url = url.href;
      continue;
    }

    const platform = OTHER_PLATFORMS.find((p) => p.test.test(host));
    if (platform && !other.has(platform.label)) {
      other.set(platform.label, { label: platform.label, url: url.href });
    }
  }

  return { fields, whatsapp, other: [...other.values()] };
}
