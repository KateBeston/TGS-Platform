import { createClient } from '@/lib/supabase/server';

/* Reading venues for the public site.
 *
 * Everything comes from views. The site never touches `venues` directly,
 * so a mistake here cannot reach a commission rate or an internal note. */

export type Card = {
  id: number;
  venue_name: string;
  listing_slug: string | null;
  marketplace: string | null;
  venue_type: string | null;
  headline: string | null;
  listing_description: string | null;
  venue_short_description: string | null;
  image_url: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  country_slug: string | null;
  city_slug: string | null;
  locality_slug: string | null;
  what_they_call_it: string | null;
  max_guests: number | null;
  total_bedrooms: number | null;
  tier_order: number;
  tier_slug: string | null;
  rating: number | null;
  review_count: number;
  is_test_record: boolean;
};

export type Filters = {
  marketplace?: string;
  country?: string;
  type?: string;
  setting?: string;
  practice?: string;
  guests?: number;
  sort?: string;
};

/** The filter lists, from the master tables.
 *
 *  Read rather than hardcoded. The audit blames the drift between the
 *  venues filter and the rest of the site on lists being written into
 *  each page — the venues filter carried eight settings, the database
 *  twenty-one, and a dead "Desert" option nobody could remove. */
export async function filterOptions() {
  const supabase = await createClient();

  const [countries, types, settings, categories] = await Promise.all([
    // Only countries that have something in them. Offering a filter that
    // returns nothing is worse than not offering it.
    supabase.from('venue_cards').select('country, country_slug')
      .not('country', 'is', null),
    supabase.from('venue_types').select('id,name,slug,applies_to').order('name'),
    supabase.from('venue_settings').select('id,name,slug').order('display_order'),
    supabase.from('modality_categories')
      .select('id,name,slug,in_retreat,in_wellness').order('display_order'),
  ]);

  const seen = new Map<string, { name: string; slug: string; count: number }>();
  for (const r of countries.data ?? []) {
    const key = String((r as any).country_slug ?? (r as any).country);
    const found = seen.get(key);
    if (found) found.count += 1;
    else seen.set(key, {
      name: (r as any).country, slug: key, count: 1,
    });
  }

  return {
    countries: [...seen.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    types: types.data ?? [],
    settings: settings.data ?? [],
    categories: categories.data ?? [],
  };
}

/** The cards, filtered and ordered.
 *
 *  Tier decides position. Premium first, Essentials last — and the guest
 *  is never told which is which, because "Essentials Listings" says a
 *  venue paid the least, which is unflattering to them and useless to a
 *  guest. */
export async function venueCards(f: Filters = {}) {
  const supabase = await createClient();

  let q = supabase.from('venue_cards').select('*');

  if (f.marketplace) q = q.eq('marketplace', f.marketplace);
  if (f.country) q = q.eq('country_slug', f.country);
  if (f.type) q = q.eq('venue_type', f.type);
  if (f.guests) q = q.gte('max_guests', f.guests);

  // Tier first unless somebody asked for something else. A venue paying
  // for position gets it, and a guest who has chosen an order gets that
  // instead — the commercial arrangement is about the default.
  if (f.sort === 'rating') {
    q = q.order('rating', { ascending: false, nullsFirst: false });
  } else if (f.sort === 'capacity') {
    q = q.order('max_guests', { ascending: false, nullsFirst: false });
  } else if (f.sort === 'name') {
    q = q.order('venue_name');
  } else {
    q = q.order('tier_order').order('rating', { ascending: false, nullsFirst: false })
         .order('venue_name');
  }

  const { data, error } = await q.limit(60);
  if (error) return { cards: [] as Card[], error: error.message };
  return { cards: (data ?? []) as Card[], error: null };
}

/** Where a card links to. */
export function venueHref(c: Card) {
  const base = c.marketplace === 'Wellness' ? 'wellness-venues' : 'retreat-venues';
  return `/${base}/${c.listing_slug ?? c.id}`;
}

/** Where a venue is, said the way somebody would say it.
 *
 *  The suburb where there is one, then the city, then the country. A
 *  venue in Canggu says Canggu — filed under Legian, which nobody
 *  searches for. */
export function placeOf(c: Card) {
  return [c.what_they_call_it ?? c.locality, c.city, c.country]
    .filter(Boolean)
    // A venue whose locality and city are the same should not say it
    // twice.
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
}
