'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

/* ── venue scheduling policy ─────────────────────────────────────── */

const SCHED_COLUMNS = new Set([
  'default_buffer_minutes','changeover_minutes','allows_back_to_back',
  'min_gap_between_clients','slot_interval_minutes','first_appointment_offset_minutes',
  'last_appointment_before_close_minutes','max_daily_bookings',
  'public_holiday_policy','public_holiday_notes','notes',
  'hours_apply_to','overnight_access','access_method','access_notes',
  'staffing_model','staff_on_site_from','staff_on_site_until',
  'emergency_contact_available','emergency_response_notes',
  'nearest_staff_distance_minutes','after_hours_arrival_permitted',
  'after_hours_arrival_notes','after_hours_departure_permitted',
  'arrival_only_during_hours',
]);

export async function saveScheduling(
  venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!SCHED_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on scheduling.` };
  }

  const supabase = await createClient();

  // Choosing anything other than the default means someone asked. Stamping
  // it is what turns an assumption into a confirmed answer — and keeps the
  // two visibly different afterwards.
  const extra = column === 'public_holiday_policy' && value !== 'Assumed closed'
    ? { public_holiday_confirmed_at: new Date().toISOString() }
    : column === 'public_holiday_policy'
      ? { public_holiday_confirmed_at: null }
      : {};

  const { error } = await supabase.from('venue_scheduling').upsert(
    { venue_id: venueId, [column]: value, ...extra },
    { onConflict: 'venue_id' }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true };
}

/* ── breaks ──────────────────────────────────────────────────────── */

const BREAK_COLUMNS = new Set([
  'day_of_week','break_type','label','starts_at','ends_at',
  'applies_to_service_id','valid_from','valid_to','notes',
]);

export async function addBreak(venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('venue_breaks')
    .insert({ venue_id: venueId, break_type: 'Lunch',
              starts_at: '12:30', ends_at: '13:30' })
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true, id: data.id };
}

export async function saveBreak(
  breakId: number, venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!BREAK_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a break.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venue_breaks')
    .update({ [column]: value }).eq('id', breakId);
  if (error) {
    if (/ends_at > starts_at/i.test(error.message)) {
      return { ok: false, error: 'The end time must be after the start time.' };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true };
}

export async function removeBreak(breakId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_breaks').delete().eq('id', breakId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true };
}

/* ── holiday overrides ───────────────────────────────────────────── */

export async function setHolidayOverride(
  venueId: number, holidayId: number | null, holidayName: string,
  status: string, confirmed: boolean
): Promise<Result> {
  const supabase = await createClient();

  const { data: existing } = await supabase.from('venue_holiday_overrides')
    .select('id').eq('venue_id', venueId)
    .eq('holiday_name', holidayName).maybeSingle();

  const row = {
    venue_id: venueId,
    public_holiday_id: holidayId,
    holiday_name: holidayName,
    status,
    is_confirmed: confirmed,
    confirmed_at: confirmed ? new Date().toISOString() : null,
  };

  const { error } = existing
    ? await supabase.from('venue_holiday_overrides').update(row).eq('id', existing.id)
    : await supabase.from('venue_holiday_overrides').insert(row);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true };
}

export async function removeHolidayOverride(id: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_holiday_overrides').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true };
}

/* ── closures ────────────────────────────────────────────────────── */

const CLOSURE_COLUMNS = new Set([
  'date_from','date_to','closure_type','reason','opens_at','closes_at',
  'is_recurring_annually','notes',
]);

export async function addClosure(venueId: number): Promise<Result> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('venue_closures')
    .insert({ venue_id: venueId, date_from: today, date_to: today })
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true, id: data.id };
}

export async function saveClosure(
  closureId: number, venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!CLOSURE_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a closure.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venue_closures')
    .update({ [column]: value }).eq('id', closureId);
  if (error) {
    if (/date_to >= date_from/i.test(error.message)) {
      return { ok: false, error: 'The end date cannot be before the start date.' };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true };
}

export async function removeClosure(closureId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_closures').delete().eq('id', closureId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/scheduling`);
  return { ok: true };
}

/* ── holiday sync ────────────────────────────────────────────────── */

/** Pulls a year of public holidays from Nager.Date. No key, 200+ countries.
 *
 *  Nager deliberately omits Islamic holidays fixed by local moon sighting —
 *  Eid al-Fitr, Eid al-Adha — because they cannot be calculated ahead.
 *  That matters for Indonesia, Morocco, Türkiye and the UAE, so this only
 *  ever upserts rows marked source = 'Nager' and never touches manual ones.
 */
export async function syncHolidays(countryCode: string, year: number): Promise<Result> {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return { ok: false, error: 'Expected a two-letter country code.' };

  let items: any[];
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`,
      { cache: 'no-store', signal: AbortSignal.timeout(12_000) }
    );
    if (res.status === 404) {
      return { ok: false, error: `Nager.Date does not cover ${code}. Add holidays manually instead.` };
    }
    if (!res.ok) return { ok: false, error: `Nager.Date returned ${res.status}.` };
    items = await res.json();
  } catch {
    return { ok: false, error: 'Could not reach Nager.Date.' };
  }

  if (!Array.isArray(items) || !items.length) {
    return { ok: true, message: `No holidays returned for ${code} in ${year}.` };
  }

  const supabase = await createClient();
  const { data: country } = await supabase
    .from('countries').select('id').eq('iso_code', code).maybeSingle();

  const rows = items.map((h: any) => ({
    country_id: country?.id ?? null,
    country_code: code,
    holiday_date: h.date,
    name: h.name,
    local_name: h.localName ?? null,
    counties: h.counties ?? null,
    holiday_type: Array.isArray(h.types) ? h.types.join(', ') : h.type ?? null,
    is_global: h.global ?? true,
    is_fixed: h.fixed ?? null,
    source: 'Nager',
  }));

  const { error } = await supabase.from('public_holidays')
    .upsert(rows, { onConflict: 'country_code,holiday_date,name' });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/holidays');
  return { ok: true, message: `${rows.length} holidays synced for ${code} ${year}.` };
}

export async function addManualHoliday(
  countryCode: string, date: string, name: string
): Promise<Result> {
  const code = countryCode.trim().toUpperCase();
  if (!code || !date || !name.trim()) return { ok: false, error: 'Country, date and name are required.' };

  const supabase = await createClient();
  const { data: country } = await supabase
    .from('countries').select('id').eq('iso_code', code).maybeSingle();

  const { error } = await supabase.from('public_holidays').insert({
    country_id: country?.id ?? null,
    country_code: code,
    holiday_date: date,
    name: name.trim(),
    source: 'Manual',
    notes: 'Added by hand — likely a lunar-calendar date Nager.Date cannot calculate.',
  });

  if (error) {
    if (/duplicate/i.test(error.message)) return { ok: false, error: 'That holiday is already recorded.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/settings/holidays');
  return { ok: true, message: 'Added.' };
}

/* ── date range checking ─────────────────────────────────────────── */

export type DateConflict = {
  kind: 'holiday' | 'closure' | 'override';
  date: string;
  dateTo?: string;
  name: string;
  detail?: string;
  severity: 'confirmed' | 'assumed' | 'note';
  venueName?: string;
};

/** Checks a date range for anything that would affect availability.
 *
 *  Three sources, deliberately distinguished:
 *   · a confirmed venue closure or override — a fact
 *   · a public holiday with the venue on "Assumed closed" — a guess
 *   · a public holiday where the venue has confirmed it trades — a note
 *
 *  The distinction is the point. Telling a host a venue is shut on Anzac
 *  Day because nobody asked is a different failure from telling them
 *  because the venue said so, and the warning should say which it is.
 */
export async function checkDateRange(
  dateFrom: string | null,
  dateTo: string | null,
  opts: { countryCode?: string | null; venueIds?: number[] } = {}
): Promise<DateConflict[]> {
  if (!dateFrom) return [];
  const from = dateFrom;
  const to = dateTo || dateFrom;

  const supabase = await createClient();
  const conflicts: DateConflict[] = [];

  // Venues first, so the country-level holiday list can be resolved
  // against what each venue actually says.
  const venueIds = opts.venueIds ?? [];
  let venues: any[] = [];
  if (venueIds.length) {
    const { data } = await supabase
      .from('venues')
      .select('id,venue_name,countries(iso_code),venue_scheduling(public_holiday_policy,public_holiday_confirmed_at,hours_apply_to,overnight_access,access_method,staffing_model)')
      .in('id', venueIds);
    venues = data ?? [];
  }

  const codes = new Set<string>();
  if (opts.countryCode) codes.add(opts.countryCode.toUpperCase());
  venues.forEach((v) => { const c = v.countries?.iso_code; if (c) codes.add(c.toUpperCase()); });

  // ── public holidays in range ──────────────────────────────────────
  if (codes.size) {
    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('id,name,local_name,holiday_date,country_code,source')
      .in('country_code', Array.from(codes))
      .gte('holiday_date', from).lte('holiday_date', to)
      .order('holiday_date');

    const { data: overrides } = venueIds.length
      ? await supabase.from('venue_holiday_overrides')
          .select('venue_id,holiday_name,status,is_confirmed').in('venue_id', venueIds)
      : { data: [] as any[] };

    for (const h of holidays ?? []) {
      if (!venues.length) {
        conflicts.push({
          kind: 'holiday', date: h.holiday_date, name: h.name,
          detail: h.local_name && h.local_name !== h.name ? h.local_name : undefined,
          severity: 'assumed',
        });
        continue;
      }

      for (const v of venues) {
        if (v.countries?.iso_code?.toUpperCase() !== h.country_code) continue;

        const ov = (overrides ?? []).find(
          (o: any) => o.venue_id === v.id && o.holiday_name === h.name);
        const sched = Array.isArray(v.venue_scheduling)
          ? v.venue_scheduling[0] : v.venue_scheduling;
        const policy = sched?.public_holiday_policy ?? 'Assumed closed';

        // A venue whose hours are reception-only, with overnight access,
        // is not unavailable on a public holiday for a multi-day stay —
        // the desk is shut, the property is not. Reported as a note so it
        // is still visible without reading as a blocker.
        const receptionOnly = sched?.hours_apply_to === 'Reception'
          && sched?.overnight_access !== false;

        if (ov) {
          conflicts.push({
            kind: 'override', date: h.holiday_date, name: h.name,
            venueName: v.venue_name,
            detail: `${v.venue_name}: ${ov.status}`
              + (receptionOnly ? ' — reception only, access continues' : ''),
            severity: ov.is_confirmed
              ? (receptionOnly && ov.status === 'Closed' ? 'note' : 'confirmed')
              : 'assumed',
          });
        } else if (receptionOnly) {
          conflicts.push({
            kind: 'holiday', date: h.holiday_date, name: h.name,
            venueName: v.venue_name,
            detail: `${v.venue_name}: reception closed, ${
              sched?.access_method
                ? sched.access_method.toLowerCase()
                : 'access arrangements not recorded'}`,
            severity: 'note',
          });
        } else {
          conflicts.push({
            kind: 'holiday', date: h.holiday_date, name: h.name,
            venueName: v.venue_name,
            detail: `${v.venue_name}: ${policy.toLowerCase()}`,
            severity: policy === 'Assumed closed' ? 'assumed'
              : policy === 'Open' ? 'note' : 'confirmed',
          });
        }
      }
    }
  }

  // ── venue closures overlapping the range ──────────────────────────
  if (venueIds.length) {
    const { data: closures } = await supabase
      .from('venue_closures')
      .select('venue_id,date_from,date_to,closure_type,reason,venues(venue_name)')
      .in('venue_id', venueIds)
      .lte('date_from', to).gte('date_to', from);

    for (const c of closures ?? []) {
      conflicts.push({
        kind: 'closure', date: c.date_from, dateTo: c.date_to,
        name: c.reason || c.closure_type,
        venueName: (c as any).venues?.venue_name,
        detail: `${(c as any).venues?.venue_name}: ${c.closure_type}`,
        severity: 'confirmed',
      });
    }
  }

  return conflicts.sort((a, b) => a.date.localeCompare(b.date));
}
