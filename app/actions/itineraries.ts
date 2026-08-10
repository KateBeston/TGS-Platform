'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

const ITINERARY_COLUMNS = new Set([
  'name','date_from','date_to','guest_count','status','notes','base_venue_id','contact_id',
]);

const ITEM_COLUMNS = new Set([
  'item_date','starts_at','ends_at','duration_minutes','is_all_day',
  'item_type','title','description','venue_id','service_id','space_id',
  'practitioner_id','excursion_id','practice_id','location_note',
  'participant_count','is_optional','participant_notes',
  'price_per_person','price_total','currency','is_included','payable_to',
  'booking_status','confirmation_reference','travel_minutes_to_next','travel_notes',
  'display_order','notes',
]);

function humanise(m: string) {
  if (/ends_at > starts_at/i.test(m)) return 'The end time must be after the start time.';
  if (/date_to >= date_from/i.test(m)) return 'The end date cannot be before the start date.';
  return m;
}

/** Creates an itinerary from an enquiry, carrying across what is already
 *  known — dates from the preferred option, guests, and the selected venue
 *  as the base. Retyping any of that is a chance to get it wrong. */
export async function createItineraryFromEnquiry(enquiryId: number): Promise<Result> {
  const supabase = await createClient();

  const [{ data: enquiry }, { data: dates }, { data: selected }] = await Promise.all([
    supabase.from('enquiries').select('*').eq('id', enquiryId).single(),
    supabase.from('enquiry_date_options').select('*')
      .eq('enquiry_id', enquiryId).order('preference').limit(1),
    supabase.from('enquiry_venues').select('venue_id')
      .eq('enquiry_id', enquiryId).eq('match_status', 'Selected').maybeSingle(),
  ]);
  if (!enquiry) return { ok: false, error: 'Enquiry not found.' };

  const preferred = dates?.[0];

  const { data, error } = await supabase.from('itineraries').insert({
    enquiry_id: enquiryId,
    base_venue_id: selected?.venue_id ?? null,
    name: [enquiry.first_name, enquiry.surname].filter(Boolean).join(' ') || 'Itinerary',
    date_from: preferred?.date_from ?? enquiry.date_from ?? null,
    date_to: preferred?.date_to ?? enquiry.date_to ?? null,
    guest_count: enquiry.guest_count ?? null,
  }).select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true, id: data.id };
}

export async function saveItinerary(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!ITINERARY_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on an itinerary.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('itineraries').update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/itineraries/${id}`);
  return { ok: true };
}

export async function addItem(
  itineraryId: number, itemDate: string, itemType = 'Service'
): Promise<Result> {
  const supabase = await createClient();

  const { count } = await supabase.from('itinerary_items')
    .select('*', { count: 'exact', head: true })
    .eq('itinerary_id', itineraryId).eq('item_date', itemDate);

  const { data, error } = await supabase.from('itinerary_items').insert({
    itinerary_id: itineraryId,
    item_date: itemDate,
    item_type: itemType,
    title: itemType === 'Service' ? 'New item' : itemType,
    display_order: (count ?? 0) + 1,
  }).select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/itineraries/${itineraryId}`);
  return { ok: true, id: data.id };
}

/** Adding a service brings its own duration, price and venue with it, so
 *  an item is right from the moment it is created rather than needing
 *  three more fields filled in. */
export async function addServiceItem(
  itineraryId: number, itemDate: string, serviceId: number, startsAt: string | null
): Promise<Result> {
  const supabase = await createClient();

  const { data: svc } = await supabase
    .from('venue_services')
    .select('*, venues(id,venue_name), venue_scheduling:venues(venue_scheduling(default_buffer_minutes))')
    .eq('id', serviceId).single();
  if (!svc) return { ok: false, error: 'Service not found.' };

  const duration = svc.duration_minutes ?? null;
  const ends = startsAt && duration
    ? new Date(new Date(`2000-01-01T${startsAt}`).getTime() + duration * 60_000)
        .toISOString().slice(11, 16)
    : null;

  const { count } = await supabase.from('itinerary_items')
    .select('*', { count: 'exact', head: true })
    .eq('itinerary_id', itineraryId).eq('item_date', itemDate);

  const { data, error } = await supabase.from('itinerary_items').insert({
    itinerary_id: itineraryId,
    item_date: itemDate,
    item_type: 'Service',
    title: svc.website_display_name || svc.name,
    description: svc.description ?? null,
    venue_id: svc.venue_id,
    service_id: serviceId,
    starts_at: startsAt,
    ends_at: ends,
    duration_minutes: duration,
    price_per_person: svc.base_price ?? null,
    currency: svc.currency ?? 'AUD',
    display_order: (count ?? 0) + 1,
  }).select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/itineraries/${itineraryId}`);
  return { ok: true, id: data.id };
}

export async function saveItem(
  itemId: number, itineraryId: number, column: string, value: unknown
): Promise<Result> {
  if (!ITEM_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on an item.` };
  }

  const supabase = await createClient();
  const extra: Record<string, unknown> = {};

  // End time follows from start plus duration rather than being typed
  // twice and drifting apart.
  if (column === 'starts_at' || column === 'duration_minutes') {
    const { data: row } = await supabase.from('itinerary_items')
      .select('starts_at,duration_minutes').eq('id', itemId).single();
    const start = column === 'starts_at' ? value : row?.starts_at;
    const mins = column === 'duration_minutes' ? value : row?.duration_minutes;
    if (start && mins) {
      extra.ends_at = new Date(
        new Date(`2000-01-01T${String(start).slice(0, 5)}`).getTime() + Number(mins) * 60_000
      ).toISOString().slice(11, 16);
    }
  }

  if (column === 'booking_status') {
    if (value === 'Requested') extra.requested_at = new Date().toISOString();
    if (value === 'Confirmed') extra.confirmed_at = new Date().toISOString();
  }

  const { error } = await supabase.from('itinerary_items')
    .update({ [column]: value, ...extra }).eq('id', itemId);

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/itineraries/${itineraryId}`);
  return { ok: true };
}

export async function removeItem(itemId: number, itineraryId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('itinerary_items').delete().eq('id', itemId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/itineraries/${itineraryId}`);
  return { ok: true };
}

/** Services bookable near the base venue. Same country and, where the base
 *  has coordinates, ordered by distance — because "local wellness
 *  experience" means reachable, not merely elsewhere. */
export async function nearbyServices(
  baseVenueId: number | null, q: string, countryId?: number | null
) {
  const supabase = await createClient();

  let base: any = null;
  if (baseVenueId) {
    const { data } = await supabase.from('venues')
      .select('id,latitude,longitude,country_id').eq('id', baseVenueId).single();
    base = data;
  }

  let query = supabase
    .from('venue_services')
    .select('id,name,website_display_name,duration_minutes,base_price,currency,venue_id,venues!inner(id,venue_name,latitude,longitude,country_id,venue_category,cities(name))')
    .limit(60);

  if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);

  const cid = base?.country_id ?? countryId;
  if (cid) query = query.eq('venues.country_id', cid);

  const { data } = await query;
  const rows = data ?? [];

  if (!base?.latitude) return rows.slice(0, 30);

  // Straight-line distance is enough to rank candidates; the real travel
  // time is recorded per item once someone has actually checked.
  const km = (a: any) => {
    if (!a.venues?.latitude) return Number.POSITIVE_INFINITY;
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(a.venues.latitude - base.latitude);
    const dLng = toRad(a.venues.longitude - base.longitude);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(base.latitude)) * Math.cos(toRad(a.venues.latitude))
      * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  return rows
    .map((r: any) => ({ ...r, distance_km: Math.round(km(r)) }))
    .sort((a: any, b: any) => a.distance_km - b.distance_km)
    .slice(0, 30);
}
