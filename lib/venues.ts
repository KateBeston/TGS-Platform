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
  /** In our voice rather than the venue's, on the Premium card. A venue
   *  describing itself is marketing; a line saying why we chose it is
   *  the reason somebody comes here rather than searching. */
  editor_note: string | null;
  /** What the venue is in, not what it is near. */
  tags: string[] | null;
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

  const [countries, types, settings, categories, counts] = await Promise.all([
    supabase.from('venue_cards').select('country, country_slug')
      .not('country', 'is', null),
    supabase.from('venue_types').select('id,name,slug,applies_to').order('name'),
    supabase.from('venue_settings').select('id,name,slug').order('display_order'),
    supabase.from('modality_categories')
      .select('id,name,slug,in_retreat,in_wellness').order('display_order'),
    // How many published venues sit behind each. A filter that returns
    // nothing is worse than one that is not offered, so the count is
    // shown and the empty ones are pushed down.
    supabase.from('filter_counts').select('kind,slug,venues'),
  ]);

  const countFor = (kind: string, slug: string) =>
    (counts.data ?? []).find((c: any) => c.kind === kind && c.slug === slug)?.venues ?? 0;

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
    // Every setting is offered, ordered so the ones with venues come
    // first. The empty ones stay listed rather than disappearing, since
    // a list that changes shape as venues are added is confusing.
    settings: (settings.data ?? []).map((s: any) => ({
      ...s, count: countFor('setting', s.slug),
    })).sort((a: any, b: any) => b.count - a.count),
    categories: (categories.data ?? []).map((c: any) => ({
      ...c, count: countFor('category', c.slug),
    })),
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

  // Setting and modality are many-to-many, so they cannot be a column on
  // the card. The ids are fetched first and the cards filtered to them —
  // two round trips rather than a join the browser would have to do.
  let only: number[] | null = null;

  const narrow = async (ids: number[]) => {
    only = only === null ? ids : only.filter((i) => ids.includes(i));
  };

  if (f.setting) {
    const { data } = await supabase.from('venue_settings_public')
      .select('venue_id')
      // Immediate only. A venue twenty minutes from a beach is not
      // beachfront, and returning it when somebody asked for beachfront
      // is how a filter loses trust in one click.
      .eq('slug', f.setting).eq('relation', 'Immediate');
    await narrow((data ?? []).map((r: any) => r.venue_id));
  }

  if (f.practice) {
    const { data } = await supabase.from('venue_categories_public')
      .select('venue_id').eq('slug', f.practice);
    await narrow((data ?? []).map((r: any) => r.venue_id));
  }

  // Nothing matched one of them, so nothing matches all of them.
  if (only !== null && (only as number[]).length === 0) {
    return { cards: [] as Card[], error: null };
  }

  let q = supabase.from('venue_cards').select('*');

  if (only !== null) q = q.in('id', only as number[]);
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
