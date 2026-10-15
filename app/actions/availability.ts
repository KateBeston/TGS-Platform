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
