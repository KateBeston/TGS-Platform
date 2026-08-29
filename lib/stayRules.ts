/* What a venue will and won't accept as dates.
 *
 * One module because the same rules run in two places: the picker, so a guest
 * cannot choose dates that will be refused, and submitBooking, because a date
 * arriving from a browser has been nowhere trustworthy. The picker is a
 * courtesy; the server check is the one that counts.
 *
 * Every field is optional. A venue that has set nothing gets no limits, which
 * is the same behaviour as before this existed.
 */

export type StayRules = {
  /** venue_booking_settings.minimum_stay_default, falling back to venues.minimum_stay_nights */
  minNights: number | null;
  /** venue_booking_settings.minimum_stay_weekends */
  minNightsWeekend: number | null;
  /** venue_booking_settings.maximum_stay */
  maxNights: number | null;
  /** venue_booking_settings.max_advance_days — how far ahead they take bookings */
  maxAdvanceDays: number | null;
  /** venue_booking_settings.advance_notice_hours */
  noticeHours: number | null;
};

export const NO_RULES: StayRules = {
  minNights: null, minNightsWeekend: null, maxNights: null,
  maxAdvanceDays: null, noticeHours: null,
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Midnight today, so comparisons are date-to-date rather than instant-to-instant. */
function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parsed as local midnight. A plain `new Date('2026-09-01')` is UTC midnight,
 *  which is the previous day in Australia and shifts every comparison by one. */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** The soonest arrival the venue will take, given the notice they need. */
export function earliestArrival(r: StayRules): string {
  const d = today();
  if (r.noticeHours && r.noticeHours > 0) {
    d.setDate(d.getDate() + Math.ceil(r.noticeHours / 24));
  }
  return iso(d);
}

/** The furthest ahead the venue will take a booking, if they've said. */
export function latestArrival(r: StayRules): string | null {
  if (!r.maxAdvanceDays || r.maxAdvanceDays <= 0) return null;
  const d = today();
  d.setDate(d.getDate() + r.maxAdvanceDays);
  return iso(d);
}

/* Weekend minimums key off the arrival day, treating Friday and Saturday as
   the weekend. That is the common reading of a two-night weekend minimum, but
   it is an assumption rather than something the data states, so it is in one
   place here to be changed once rather than hunted for. */
function isWeekendArrival(from: Date) {
  const day = from.getDay();
  return day === 5 || day === 6;
}

/** The minimum that applies to this particular arrival date. */
export function minNightsFor(r: StayRules, from: string): number | null {
  const d = parseDate(from);
  if (d && r.minNightsWeekend && isWeekendArrival(d)) {
    return Math.max(r.minNightsWeekend, r.minNights ?? 0);
  }
  return r.minNights ?? null;
}

/** The earliest departure that satisfies the minimum, for the `min` attribute
 *  on the departure field. */
export function earliestDeparture(r: StayRules, from: string): string | null {
  const d = parseDate(from);
  if (!d) return null;
  const min = minNightsFor(r, from) ?? 1;
  d.setDate(d.getDate() + Math.max(1, min));
  return iso(d);
}

/** The latest departure the maximum stay allows. */
export function latestDeparture(r: StayRules, from: string): string | null {
  const d = parseDate(from);
  if (!d || !r.maxNights || r.maxNights <= 0) return null;
  d.setDate(d.getDate() + r.maxNights);
  return iso(d);
}

const nights = (n: number) => `${n} night${n === 1 ? '' : 's'}`;

/**
 * Whether these dates are acceptable, and if not, what to tell the guest.
 *
 * `isStay` distinguishes accommodation, counted in nights, from a date range
 * with no rooms, where a same-day booking is legitimate and a nights minimum
 * would wrongly reject it.
 */
export function checkStay(
  r: StayRules,
  from: string,
  to: string | null,
  isStay: boolean,
): { ok: true } | { ok: false; error: string } {
  const start = parseDate(from);
  if (!start) return { ok: true }; // nothing chosen yet is not an error

  const earliest = parseDate(earliestArrival(r));
  if (earliest && start < earliest) {
    return r.noticeHours && r.noticeHours >= 24
      ? { ok: false, error: `This venue needs at least ${Math.ceil(r.noticeHours / 24)} days\u2019 notice. The earliest arrival is ${human(earliest)}.` }
      : { ok: false, error: `Arrival cannot be in the past. The earliest is ${human(earliest)}.` };
  }

  const latestIso = latestArrival(r);
  const latest = latestIso ? parseDate(latestIso) : null;
  if (latest && start > latest) {
    const years = r.maxAdvanceDays! / 365;
    const window = years >= 1.5
      ? `${Math.round(years)} years`
      : years >= 0.9 ? 'a year' : `${r.maxAdvanceDays} days`;
    return { ok: false, error: `This venue takes bookings up to ${window} ahead. The latest arrival is ${human(latest)}.` };
  }

  if (!to || !isStay) return { ok: true };

  const end = parseDate(to);
  if (!end) return { ok: true };
  if (end < start) return { ok: false, error: 'Departure cannot be before arrival.' };

  const stayed = Math.round((end.getTime() - start.getTime()) / DAY);
  const min = minNightsFor(r, from);
  if (min && stayed < min) {
    const weekend = r.minNightsWeekend && min === r.minNightsWeekend && min !== r.minNights;
    return {
      ok: false,
      error: weekend
        ? `Weekend arrivals need a minimum of ${nights(min)}. You\u2019ve chosen ${nights(stayed)}.`
        : `This venue has a minimum stay of ${nights(min)}. You\u2019ve chosen ${nights(stayed)}.`,
    };
  }
  if (r.maxNights && stayed > r.maxNights) {
    return { ok: false, error: `This venue has a maximum stay of ${nights(r.maxNights)}. You\u2019ve chosen ${nights(stayed)}.` };
  }

  return { ok: true };
}

function human(d: Date) {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Build the rules from the venue payload. Booking settings win where both
 *  exist, because that record is the one a venue actually maintains. */
export function stayRulesFrom(
  settings: Record<string, any> | null | undefined,
  venueMinimumStayNights?: number | null,
): StayRules {
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };
  return {
    minNights: num(settings?.minimum_stay_default) ?? num(venueMinimumStayNights),
    minNightsWeekend: num(settings?.minimum_stay_weekends),
    maxNights: num(settings?.maximum_stay),
    maxAdvanceDays: num(settings?.max_advance_days),
    noticeHours: num(settings?.advance_notice_hours),
  };
}
