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
         distances, excursions, faqs, seasons, transfers, tabContent, related, promotions, ratePlans, extras, media, cancellationPolicy, legalDocuments, bookingSettings] =
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
      supabase.from('published_venue_media').select('*').eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      supabase.from('cancellation_policies')
        .select('id, wording, deposit_is_refundable, cancellation_rules(days_before_arrival, refund_percent, sequence, description)')
        .eq('venue_id', id).eq('is_active', true).eq('is_default', true).maybeSingle(),
      supabase.from('venue_acceptance_documents')
        .select('document_id,slug,name,summary,document_type,display_order,show_in_good_to_know,version_label,effective_from')
        .eq('venue_id', id)
        .order('display_order', { nullsFirst: false }),
      // What the venue will accept as dates. Read here rather than in the
      // component so the picker and submitBooking work from the same record.
      supabase.from('venue_booking_settings')
        .select('minimum_stay_default,minimum_stay_weekends,maximum_stay,max_advance_days,advance_notice_hours')
        .eq('venue_id', id).maybeSingle()
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

  // ── Images. Uploaded media (from the portal) is the source of truth; the
  // stock image_url / image_urls columns are the fallback for venues that
  // have not uploaded yet, so nothing breaks in the meantime.
  const mediaRows = (media.data ?? []) as any[];
  const uniq = (arr: (string | null | undefined)[]) =>
    arr.filter((v, i, a): v is string => !!v && a.indexOf(v) === i);

  const heroUploaded = uniq(
    mediaRows
      .filter((m) => m.placement_key === 'hero_primary' || m.placement_key === 'hero_gallery')
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
        || (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((m) => m.url),
  );
  const cardAny = card as Record<string, any>;
  const venueAny = (venue.data ?? {}) as Record<string, any>;
  const heroImages = heroUploaded.length
    ? heroUploaded
    : uniq([cardAny.image_url, venueAny.primary_image_url, ...(venueAny.image_urls ?? [])]);

  const roomsWithImages = ((rooms.data ?? []) as any[]).map((r) => {
    const uploaded = uniq(
      mediaRows
        .filter((m) => m.placement_key === 'room_card' && m.room_type_id === r.id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((m) => m.url),
    );
    const gallery_images = uploaded.length
      ? uploaded
      : uniq([r.primary_image_url, ...(r.image_urls ?? [])]);
    return { ...r, gallery_images };
  });

  // Cancellation — the free-cancellation window is the widest days_before_arrival
  // that still gives a full (100%) refund. Drives "Free cancellation until X"
  // from real per-venue tiers rather than a hardcoded string.
  const cpData = (cancellationPolicy.data ?? null) as any;
  const cpRules = (cpData?.cancellation_rules ?? []) as any[];
  const fullRefundDays = cpRules
    .filter((r) => Number(r.refund_percent) >= 100 && r.days_before_arrival != null)
    .map((r) => Number(r.days_before_arrival));
  const free_cancellation_days = fullRefundDays.length ? Math.max(...fullRefundDays) : null;

  return {
    ...(card as Record<string, any>),
    ...((venue.data ?? {}) as Record<string, any>),
    hero_images: heroImages,
    // Host and languages, from the profile view. The host block is already
    // gated in the view — it is null unless the venue chose to show it.
    ...((profile.data ?? {}) as Record<string, any>),
    spaces: spaces.data ?? [],
    rooms: roomsWithImages,
    services: services.data ?? [],
    facilities: facilities.data ?? [],
    settings: settings.data ?? [],
    categories: categories.data ?? [],
    reviews: reviews.data ?? [],
    packages: packages.data ?? [],
    practitioners: practitioners.data ?? [],
    opening_hours: openingHours.data ?? [],
    policies: policies.data ?? [],
    legal_documents: legalDocuments.data ?? [],
    booking_settings: bookingSettings.data ?? null,
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
    free_cancellation_days,
    cancellation_wording: cpData?.wording ?? null,
    marketplaceSegment: marketplace,
  } as Venue;
}

/** The accommodation subtitle, worked out from the rooms and phrased with the
 * right singular/plural: "1 room", "8 rooms", "12 rooms across 2 types". A
 * single room type drops the "across 1 type" that reads oddly. */
export function roomSummary(rooms: { quantity?: number | null }[]): string {
  const total = rooms.reduce((n, r) => n + (r.quantity ?? 1), 0);
  const types = rooms.length;
  const roomWord = total === 1 ? 'room' : 'rooms';
  if (types <= 1) return `${total} ${roomWord}`;
  return `${total} ${roomWord} across ${types} types`;
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
