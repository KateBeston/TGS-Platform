import { createClient } from '@/lib/supabase/server';

/* What belongs in a sitemap.
 *
 * Two rules, and both are about not damaging the thing the sitemap is
 * meant to help.
 *
 * Test records never appear. Nine of the nine venues currently
 * published carry "(Test)" in the name, and submitting them tells Google
 * the collection is nine made-up places.
 *
 * A page with nothing on it never appears. There are 114 practices and
 * 42 have venues; submitting the other 72 is submitting 72 empty pages,
 * which is how a site teaches a crawler that its pages are thin.
 *
 * The pages still exist and still render — they are simply not
 * advertised until there is something on them.
 */

export const SITE = 'https://www.theglobalsanctum.com';

export type Entry = {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly'
                  | 'yearly' | 'never';
  priority?: number;
};

export const STATIC_PAGES: Entry[] = [
  { url: '/', changeFrequency: 'weekly', priority: 1 },
  { url: '/venues', changeFrequency: 'daily', priority: 0.9 },
  { url: '/wellness-experiences', changeFrequency: 'weekly', priority: 0.8 },
  { url: '/the-wellness-edit', changeFrequency: 'weekly', priority: 0.8 },
  { url: '/list-your-venue', changeFrequency: 'monthly', priority: 0.8 },
  { url: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { url: '/how-it-works', changeFrequency: 'monthly', priority: 0.6 },
  { url: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { url: '/legal', changeFrequency: 'monthly', priority: 0.3 },
];

export async function venueEntries(): Promise<Entry[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_cards')
    .select('listing_slug, marketplace, is_test_record, country_slug, city_slug')
    .eq('is_test_record', false);

  return (data ?? [])
    .filter((v: any) => v.listing_slug)
    .map((v: any) => ({
      url: `/${v.marketplace === 'Wellness' ? 'wellness-venues' : 'retreat-venues'}`
         + `/${v.listing_slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
}

/** Marketplace-scoped location pages — /wellness-venues/{continent}/{country}
 *  /{state}/{city} and the retreat mirror. Every level is emitted only when
 *  the place is published and a real venue sits behind it, so the sitemap
 *  never advertises an empty page or an unpublished one. The continent is
 *  resolved from the country, since venues carry the country slug, not the
 *  continent. */
/* Pre-launch, the only published venues are the test records, so the location
 * sitemap would otherwise be empty. This lets it model the real URL shapes
 * from the test data. Flip to false the moment real venues are live — a
 * sitemap of test places tells Google the collection is made up. */
const LOCATION_SITEMAP_INCLUDES_TEST = true;

export async function locationEntries(): Promise<Entry[]> {
  const supabase = await createClient();

  let venuesQuery = supabase.from('venue_cards')
    .select('marketplace, country_slug, state_slug, city_slug, is_test_record');
  if (!LOCATION_SITEMAP_INCLUDES_TEST) venuesQuery = venuesQuery.eq('is_test_record', false);

  const [conts, countries, states, cities, venues] = await Promise.all([
    supabase.from('continents').select('id, slug').eq('is_published', true),
    supabase.from('countries').select('slug, continent_id').eq('is_published', true),
    supabase.from('states').select('slug').eq('is_published', true),
    supabase.from('cities').select('slug').eq('is_published', true),
    venuesQuery,
  ]);

  const continentById = new Map<number, string>((conts.data ?? []).map((c: any) => [c.id, c.slug]));
  const countryToContinent = new Map<string, string>();
  for (const c of (countries.data ?? []) as any[]) {
    const cont = continentById.get(c.continent_id);
    if (cont) countryToContinent.set(c.slug, cont);
  }
  const pubState = new Set((states.data ?? []).map((s: any) => s.slug));
  const pubCity = new Set((cities.data ?? []).map((c: any) => c.slug));

  const urls = new Set<string>();
  for (const v of (venues.data ?? []) as any[]) {
    const mkt = v.marketplace === 'Wellness' ? 'wellness-venues' : 'retreat-venues';
    const continent = v.country_slug ? countryToContinent.get(v.country_slug) : undefined;
    if (!continent) continue; // country unpublished or missing → not advertised
    urls.add(`/${mkt}/${continent}`);
    urls.add(`/${mkt}/${continent}/${v.country_slug}`);
    if (v.state_slug && pubState.has(v.state_slug)) {
      urls.add(`/${mkt}/${continent}/${v.country_slug}/${v.state_slug}`);
      if (v.city_slug && pubCity.has(v.city_slug)) {
        urls.add(`/${mkt}/${continent}/${v.country_slug}/${v.state_slug}/${v.city_slug}`);
      }
    }
  }

  return [...urls].sort().map((url) => ({
    url, changeFrequency: 'weekly' as const, priority: 0.6,
  }));
}

export async function practiceEntries(): Promise<Entry[]> {
  const supabase = await createClient();

  const [{ data: cats }, { data: practices }] = await Promise.all([
    supabase.from('experience_categories').select('slug, venue_count').gt('venue_count', 0),
    supabase.from('experience_practices')
      .select('slug, category_slug, venue_count').gt('venue_count', 0),
  ]);

  return [
    ...(cats ?? []).map((c: any) => ({
      url: `/wellness-experiences/${c.slug}`,
      changeFrequency: 'weekly' as const, priority: 0.7,
    })),
    ...(practices ?? []).filter((p: any) => p.category_slug).map((p: any) => ({
      url: `/wellness-experiences/${p.category_slug}/${p.slug}`,
      changeFrequency: 'weekly' as const, priority: 0.6,
    })),
  ];
}

export async function legalEntries(): Promise<Entry[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('public_legal_documents')
    .select('slug, updated_at, on_legal_page');

  return (data ?? []).map((d: any) => ({
    url: `/legal/${d.slug}`,
    lastModified: d.updated_at ?? undefined,
    changeFrequency: 'yearly' as const,
    // A policy is not something to rank for; it is something to find
    // when looked for.
    priority: d.on_legal_page ? 0.3 : 0.2,
  }));
}

/** Serialises entries as an XML sitemap.
 *
 *  Written rather than generated by the framework, because the six files
 *  robots.txt already names have to exist at those exact paths and
 *  Next's own sitemap route cannot produce arbitrary filenames. */
export function toXml(entries: Entry[]) {
  const urls = entries.map((e) => {
    const loc = `${SITE}${e.url}`
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const last = e.lastModified
      ? `\n    <lastmod>${new Date(e.lastModified).toISOString().slice(0, 10)}</lastmod>`
      : '';
    const freq = e.changeFrequency
      ? `\n    <changefreq>${e.changeFrequency}</changefreq>` : '';
    const pri = e.priority !== undefined
      ? `\n    <priority>${e.priority.toFixed(1)}</priority>` : '';
    return `  <url>\n    <loc>${loc}</loc>${last}${freq}${pri}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // An hour is often enough for a site that gains a venue a day, and
      // it stops a crawler's repeat visit costing a full rebuild.
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
