import { createClient } from '@/lib/supabase/server';

/* Everything one venue page needs.
 *
 * Read in parallel from the published views, so a listing is one round
 * of queries rather than one per tab. Nothing here touches `venues` —
 * every read goes through a view that carries only public columns. */

export type Venue = Record<string, any>;

const MARKETPLACES: Record<string, string> = {
  'retreat-venues': 'Retreat',
  'wellness-venues': 'Wellness',
};

export function marketplaceOf(segment: string) {
  return MARKETPLACES[segment] ?? null;
}

export async function loadVenue(marketplace: string, slug: string) {
  const kind = marketplaceOf(marketplace);
  if (!kind) return null;

  const supabase = await createClient();

  const { data: card } = await supabase.from('venue_cards')
    .select('*').eq('marketplace', kind).eq('listing_slug', slug).maybeSingle();

  if (!card) return null;
  const id = (card as any).id as number;

  // Everything else at once. All tabs, one round trip.
  const [venue, spaces, rooms, services, facilities, settings, categories, reviews,
         packages, practitioners, openingHours, policies, profile,
         distances, excursions, faqs, seasons, transfers, tabContent, related, promotions, ratePlans, extras] =
    await Promise.all([
      supabase.from('published_venues').select('*').eq('id', id).maybeSingle(),
      supabase.from('published_venue_spaces').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('published_venue_rooms').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('published_venue_services').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('venue_facilities_public').select('*').eq('venue_id', id),
      supabase.from('venue_settings_public').select('*').eq('venue_id', id),
      supabase.from('venue_categories_public').select('*').eq('venue_id', id),
      supabase.from('published_reviews').select('*').eq('venue_id', id)
        .order('stayed_at', { ascending: false, nullsFirst: false }).limit(12),
      supabase.from('published_venue_packages').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('published_venue_practitioners').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('published_venue_opening_hours').select('*').eq('venue_id', id)
        .order('day_of_week', { nullsFirst: false }),
      supabase.from('published_venue_policies').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('published_venue_profile').select('*').eq('venue_id', id).maybeSingle(),
      supabase.from('venue_distances').select('*').eq('venue_id', id).eq('show_on_listing', true)
        .order('display_order', { nullsFirst: false }),
      supabase.from('venue_excursions').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('venue_faqs').select('*').eq('venue_id', id).eq('is_published', true)
        .order('display_order', { nullsFirst: false }),
      supabase.from('venue_seasons').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('venue_transfer_options').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('venue_tab_content').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('venue_related').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('published_venue_promotions').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('published_venue_rate_plans').select('*').eq('venue_id', id),
      supabase.from('published_venue_extras').select('*').eq('venue_id', id),
    ]);

  // You may also like — resolve the related ids to cards, keeping the
  // curated order. Only when there are any, so no extra query otherwise.
  const relatedIds = (related.data ?? []).map((r: any) => r.related_venue_id).filter(Boolean);
  let relatedCards: any[] = [];
  if (relatedIds.length) {
    const { data: rc } = await supabase.from('venue_cards').select('*').in('id', relatedIds);
    const order = new Map((related.data ?? []).map((r: any, i: number) => [r.related_venue_id, r.display_order ?? i]));
    relatedCards = (rc ?? []).sort((a: any, b: any) => (Number(order.get(a.id) ?? 0)) - (Number(order.get(b.id) ?? 0)));
  }

  return {
    ...(card as Record<string, any>),
    ...((venue.data ?? {}) as Record<string, any>),
    // Host and languages, from the profile view. The host block is already
    // gated in the view — it is null unless the venue chose to show it.
    ...((profile.data ?? {}) as Record<string, any>),
    spaces: spaces.data ?? [],
    rooms: rooms.data ?? [],
    services: services.data ?? [],
    facilities: facilities.data ?? [],
    settings: settings.data ?? [],
    categories: categories.data ?? [],
    reviews: reviews.data ?? [],
    packages: packages.data ?? [],
    practitioners: practitioners.data ?? [],
    opening_hours: openingHours.data ?? [],
    policies: policies.data ?? [],
    distances: distances.data ?? [],
    excursions: excursions.data ?? [],
    faqs: faqs.data ?? [],
    seasons: seasons.data ?? [],
    transfers: transfers.data ?? [],
    tab_content: tabContent.data ?? [],
    related: relatedCards,
    promotions: promotions.data ?? [],
    rate_plans: ratePlans.data ?? [],
    extras: extras.data ?? [],
    marketplaceSegment: marketplace,
  } as Venue;
}

/** Money, said the way a price should be read. */
export function money(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return null;
  if (Number(amount) === 0) return 'Included';
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency ?? 'AUD',
      maximumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
    }).format(Number(amount));
  } catch {
    return `${currency ?? ''} ${amount}`.trim();
  }
}

/** A duration, in words rather than minutes. */
export function duration(minutes: number | null) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!m) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h}h ${m}m`;
}
