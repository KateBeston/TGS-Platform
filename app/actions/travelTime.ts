'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** How long it takes to get somewhere, from Google.
 *
 *  Calculated rather than typed, because a typed figure goes stale
 *  quietly — a road closes, a ferry changes timetable, and the venue page
 *  keeps saying twenty minutes for three years.
 *
 *  Also records where the figure came from. A venue saying "twenty
 *  minutes" usually means twenty minutes at their pace on a quiet road,
 *  which matters when somebody arrives on a Sunday in February.
 */
export async function calculateTravelTime(distanceId: number): Promise<Result> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { ok: false, error: 'GOOGLE_MAPS_API_KEY is not set.' };

  const supabase = await createClient();

  const { data: row } = await supabase
    .from('venue_distances')
    .select('*, venues(latitude,longitude,venue_name,street_address)')
    .eq('id', distanceId).single();

  if (!row) return { ok: false, error: 'That entry could not be found.' };

  const venue = row.venues as any;
  if (!venue?.latitude || !venue?.longitude) {
    return { ok: false, error: 'The venue has no coordinates — geocode it first.' };
  }

  // The destination: its own coordinates if known, otherwise its name
  // resolved against the venue's area so "Cathedral Cove" finds the one
  // twenty minutes away rather than any of the others.
  const destination = row.latitude && row.longitude
    ? `${row.latitude},${row.longitude}`
    : encodeURIComponent(`${row.label}, near ${venue.street_address ?? venue.venue_name}`);

  const mode = (row.travel_mode ?? 'Driving').toLowerCase()
    .replace('cycling', 'bicycling').replace('flying', 'driving');

  try {
    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
      + `?origins=${venue.latitude},${venue.longitude}`
      + `&destinations=${destination}`
      + `&mode=${mode === 'ferry' ? 'driving' : mode}`
      + `&units=metric&key=${key}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    const element = data?.rows?.[0]?.elements?.[0];
    if (element?.status !== 'OK') {
      return { ok: false, error: `Google could not route that — ${element?.status ?? 'no answer'}.` };
    }

    const minutes = Math.round(element.duration.value / 60);
    const km = Math.round(element.distance.value / 100) / 10;

    await supabase.from('venue_distances').update({
      travel_value: minutes,
      travel_unit: 'minutes',
      travel_calculated_at: new Date().toISOString(),
      travel_source: 'Calculated',
      // The distance goes in the note where nothing is written, since a
      // time without a distance hides whether it is close and slow or far
      // and fast.
      notes: row.notes ?? `${km} km by road`,
    }).eq('id', distanceId);

    revalidatePath('/venues');
    return {
      ok: true,
      message: `${minutes} minutes, ${km} km — ${element.duration.text}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error && e.name === 'TimeoutError'
        ? 'Google did not answer in time.'
        : 'Could not reach Google.',
    };
  }
}

/** Everything on one venue, in a batch. */
export async function calculateAllForVenue(venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from('venue_distances')
    .select('id').eq('venue_id', venueId);

  if (!rows?.length) return { ok: true, message: 'Nothing to calculate.' };

  let done = 0, failed = 0;
  for (const r of rows) {
    const res = await calculateTravelTime(r.id);
    res.ok ? done++ : failed++;
    // Google's free tier is generous but not unlimited, and a burst from
    // one venue is not worth risking a rate limit for.
    await new Promise((s) => setTimeout(s, 120));
  }

  revalidatePath(`/venues/${venueId}/location`);
  return {
    ok: true,
    message: `${done} calculated${failed ? `, ${failed} could not be` : ''}.`,
  };
}
