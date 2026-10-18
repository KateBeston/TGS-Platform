'use server';

import { createClient } from '@/lib/supabase/server';

/* ═══════════════════════════════════════════════════════════════════════
   WHAT TIMES A GUEST CAN ACTUALLY CHOOSE

   Until now the guest picked "Morning" from a list of four words and the
   venue worked out what that meant by email. This reads the real answer.

   All of the thinking is in the database, in free_slots(): opening hours
   for the day, minus the service's season, minus any venue-wide block
   (including what the venue's own calendar feed wrote), minus slots
   already sold, stepped by duration plus turnaround. One round trip, and
   nothing about availability is decided in the browser where it could be
   edited.

   Every time comes back in the VENUE's clock with the zone named. That
   matters more than it sounds: a 9am class in the Blue Mountains is 1am
   in Athens and 6pm the previous day in Toronto. Showing the guest a bare
   "09:00" is how somebody books a session for a day they think is Monday.
   ═══════════════════════════════════════════════════════════════════════ */

export type Slot = {
  /** The day, in the venue's own clock. YYYY-MM-DD. */
  date: string;
  /** Start and end in the venue's own clock. HH:MM. */
  startsLocal: string;
  endsLocal: string;
  /** The instant, for showing the guest their own time. */
  startsUtc: string;
  /** The venue's zone, e.g. Australia/Sydney. */
  tz: string;
  /** Null where the slot would have to be created on booking. */
  slotId: number | null;
  placesLeft: number;
};

export type SlotsResult = {
  slots: Slot[];
  tz: string | null;
  /** True when the venue has no hours, no timezone, or nothing bookable in
   *  the window — the caller then falls back to asking for a preference. */
  unavailable: boolean;
};

/* Two months. Long enough to plan around, short enough that one fetch
   covers the whole picker without paging. */
const MAX_DAYS = 62;

const hhmm = (t: unknown): string => String(t ?? '').slice(0, 5);

export async function slotsFor(
  venueId: number,
  serviceId: number,
  people = 1,
  fromDate?: string,
): Promise<SlotsResult> {
  const empty: SlotsResult = { slots: [], tz: null, unavailable: true };

  if (!Number.isFinite(venueId) || !Number.isFinite(serviceId)) return empty;
  if (venueId <= 0 || serviceId <= 0) return empty;

  const today = new Date().toISOString().slice(0, 10);
  /* A date from the browser is a request, not a fact: anything before
     today is ignored rather than trusted, and free_slots refuses the past
     again on its own account. */
  const from = fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate) && fromDate > today
    ? fromDate : today;
  const to = new Date(new Date(`${from}T00:00:00Z`).getTime() + MAX_DAYS * 86_400_000)
    .toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('free_slots', {
    p_venue_id: venueId,
    p_service_id: serviceId,
    p_from: from,
    p_to: to,
    p_people: Math.max(1, Math.floor(people) || 1),
  });

  if (error || !data?.length) return empty;

  const slots: Slot[] = (data as any[]).map((r) => ({
    date: String(r.on_date),
    startsLocal: hhmm(r.starts_local),
    endsLocal: hhmm(r.ends_local),
    startsUtc: new Date(r.starts_utc).toISOString(),
    tz: String(r.tz_name),
    slotId: r.slot_id == null ? null : Number(r.slot_id),
    placesLeft: Number(r.places_left ?? 0),
  }));

  return { slots, tz: slots[0]?.tz ?? null, unavailable: slots.length === 0 };
}

/* ═══════════════════════════════════════════════════════════════════════
   WHICH NIGHTS ARE ALREADY GONE

   The other half of the same question. free_slots answers it for a
   treatment at eleven o'clock; this answers it for a week in March.

   The database decides, in public_availability(), and it is deliberately
   tight-lipped: a date comes back Taken or Closed and nothing else. No
   reference, no note, no block type. A guest choosing dates needs to
   know a week has gone; they do not need to know it went for forty
   thousand dollars, and neither does anyone else reading the same page.

   Absent means free. A year of availability is a handful of rows rather
   than three hundred and sixty-five.
   ═══════════════════════════════════════════════════════════════════════ */

export type Unavailable = { date: string; reason: 'Taken' | 'Closed' };

/** Dates a published venue cannot take, between two days.
 *
 *  Returns nothing at all for a venue the public cannot already see —
 *  not an error, nothing — so the shape of the answer never reveals
 *  whether an unlisted venue exists. */
export async function stayAvailability(
  venue: { id?: number | null; name?: string | null },
  from: string,
  to: string,
): Promise<Unavailable[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];

  const supabase = await createClient();
  let id = Number(venue.id ?? 0);

  /* Older carts were written before the venue id was kept on the slice,
     so the name is the fallback. Resolved against the published list
     only, which is the same gate the function itself applies. */
  if (!Number.isFinite(id) || id <= 0) {
    if (!venue.name) return [];
    const { data } = await supabase
      .from('published_venues').select('id').eq('venue_name', venue.name).limit(2);
    /* Two venues of the same name is exactly the duplicate problem, and
       guessing which one the guest meant would be worse than saying
       nothing. */
    if (!data || data.length !== 1) return [];
    id = Number(data[0].id);
  }

  const { data, error } = await supabase.rpc('public_availability', {
    p_venue_id: id, p_from: from, p_to: to,
  });
  if (error || !data) return [];

  return (data as { on_date: string; reason: string }[]).map((r) => ({
    date: String(r.on_date),
    reason: r.reason === 'Taken' ? 'Taken' : 'Closed',
  }));
}

/** Does a stay run across anything already gone?
 *
 *  Checkout asks this again before it files anything, because the cart
 *  is the guest's own browser storage and the week may have sold while
 *  it sat there. */
export async function stayClashes(
  venue: { id?: number | null; name?: string | null },
  from: string,
  to: string,
): Promise<Unavailable[]> {
  if (!from) return [];
  /* Departure day is not a night, so it is not checked. */
  const last = to && to > from
    ? new Date(new Date(`${to}T00:00:00Z`).getTime() - 86_400_000)
        .toISOString().slice(0, 10)
    : from;
  const found = await stayAvailability(venue, from, last);
  return found.filter((u) => u.date >= from && u.date <= last);
}
