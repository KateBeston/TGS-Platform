'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { verifyAddress } from '@/lib/geocode';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Builds the query from whatever geography the venue already has.
 *  A bare street address with no town geocodes badly; adding country and
 *  city dramatically improves the hit rate. */
function buildQuery(v: any): string | null {
  const parts = [
    v.street_address,
    v.cities?.name,
    v.states?.name,
    v.postcode,
    v.countries?.name,
  ].filter(Boolean);

  // Fall back to the venue name plus country — often enough for a named
  // property, and better than nothing.
  if (!v.street_address && v.countries?.name) {
    return [v.venue_name, v.countries.name].filter(Boolean).join(', ');
  }
  return parts.length >= 2 ? parts.join(', ') : null;
}

export async function checkVenueGeocode(venueId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: v, error } = await supabase
    .from('venues')
    .select('id,venue_name,street_address,postcode,country_id,countries(name,iso_code),states(name),cities(name)')
    .eq('id', venueId).single();

  if (error || !v) return { ok: false, error: error?.message ?? 'Venue not found.' };

  const query = buildQuery(v);
  if (!query) {
    return { ok: false, error: 'Not enough address detail to geocode. Add a street address or a country first.' };
  }

  const r = await verifyAddress(query, (v as any).countries?.iso_code ?? null);

  const { error: insErr } = await supabase.from('geocode_checks').insert({
    venue_id: venueId,
    query_address: query,
    google_lat: r.google?.lat ?? null,
    google_lng: r.google?.lng ?? null,
    google_precision: r.google?.precision ?? null,
    google_country: r.google?.country ?? null,
    osm_lat: r.osm?.lat ?? null,
    osm_lng: r.osm?.lng ?? null,
    osm_country: r.osm?.country ?? null,
    distance_metres: r.distanceMetres,
    verdict: r.verdict,
    chosen_lat: r.chosen?.lat ?? null,
    chosen_lng: r.chosen?.lng ?? null,
    chosen_source: r.chosenSource,
    notes: r.note ?? null,
    // Google's components are the more consistently structured, so it is
    // preferred where both answered.
    returned_city: r.google?.city ?? r.osm?.city ?? null,
    returned_state: r.google?.state ?? r.osm?.state ?? null,
    returned_postcode: r.google?.postcode ?? r.osm?.postcode ?? null,
    returned_country: r.google?.country ?? r.osm?.country ?? null,
    returned_formatted: r.google?.formatted ?? r.osm?.formatted ?? null,
    google_place_id: r.google?.placeId ?? null,
    precision_hint: r.google?.precision ?? r.osm?.precision ?? null,
  });

  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath(`/venues/${venueId}/location`);
  revalidatePath('/venues/geocode');

  const labels: Record<string, string> = {
    Agreed: `Both providers agree within ${r.distanceMetres}m.`,
    Close: `Providers within ${r.distanceMetres}m — same block or large property.`,
    Disagreed: r.note ?? 'Providers disagree.',
    SingleSource: 'Only one provider returned a result.',
    NoResult: 'Neither provider found this address.',
    CountryMismatch: r.note ?? 'Wrong country returned.',
  };
  return { ok: true, message: labels[r.verdict] };
}

/** Writes the chosen coordinates onto the venue. Deliberately separate
 *  from the check: verifying and applying are different decisions, and
 *  nothing should overwrite a coordinate without a person choosing to. */
export async function applyGeocode(checkId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: c } = await supabase
    .from('geocode_checks').select('*').eq('id', checkId).single();
  if (!c) return { ok: false, error: 'Check not found.' };
  if (c.chosen_lat == null) return { ok: false, error: 'This check has no agreed coordinate to apply.' };

  const { data: venueRow } = await supabase
    .from('venues').select('id,country_id,city_id,state_id,postcode')
    .eq('id', c.venue_id).single();

  // Google's location_type maps onto the precision we record. A street
  // interpolation shown at house zoom claims more than it knows.
  const precision =
    /ROOFTOP/i.test(c.precision_hint ?? '') ? 'Rooftop'
    : /RANGE_INTERPOLATED/i.test(c.precision_hint ?? '') ? 'Street'
    : /GEOMETRIC_CENTER|building|house/i.test(c.precision_hint ?? '') ? 'Property'
    : /APPROXIMATE|administrative|city|town|village/i.test(c.precision_hint ?? '') ? 'Locality'
    : 'Approximate';

  // The locality and state come back from both providers and were being
  // discarded. state_id is null on every venue and nothing below country
  // level can publish without it, so this is where the geography layer
  // actually unblocks.
  const patch: Record<string, unknown> = {
    latitude: c.chosen_lat,
    longitude: c.chosen_lng,
    coordinates_verified_at: new Date().toISOString(),
    coordinates_source: `${c.chosen_source} · ${c.verdict}`,
    coordinates_precision: precision,
  };

  if (c.google_place_id) patch.google_place_id = c.google_place_id;
  if (c.returned_postcode && !venueRow?.postcode) patch.postcode = c.returned_postcode;

  if (c.returned_city && venueRow?.country_id && !venueRow?.city_id) {
    const { data: exact } = await supabase.rpc('match_city', {
      p_city: c.returned_city,
      p_state: c.returned_state,
      p_country_id: venueRow.country_id,
    });

    if (exact?.[0]?.city_id) {
      patch.city_id = exact[0].city_id;
      patch.state_id = exact[0].state_id;
    } else {
      // No state match, so try the name alone — but only where exactly
      // one city of that name exists in the country. Two Richmonds means
      // no answer, which is the correct answer.
      const { data: loose } = await supabase.rpc('match_city_loose', {
        p_city: c.returned_city,
        p_country_id: venueRow.country_id,
      });
      if (loose?.[0]?.city_id) {
        patch.city_id = loose[0].city_id;
        patch.state_id = loose[0].state_id;
      }
    }
  }

  const { error } = await supabase.from('venues').update({
    ...patch,
  }).eq('id', c.venue_id);

  if (error) return { ok: false, error: error.message };

  await supabase.from('geocode_checks').update({ applied: true }).eq('id', checkId);

  revalidatePath(`/venues/${c.venue_id}/location`);
  revalidatePath('/venues/geocode');
  return { ok: true, message: 'Coordinates applied.' };
}

/** Choose a provider explicitly where they disagreed. */
export async function chooseProvider(
  checkId: number, source: 'Google' | 'OSM'
): Promise<Result> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from('geocode_checks').select('*').eq('id', checkId).single();
  if (!c) return { ok: false, error: 'Check not found.' };

  const lat = source === 'Google' ? c.google_lat : c.osm_lat;
  const lng = source === 'Google' ? c.google_lng : c.osm_lng;
  if (lat == null) return { ok: false, error: `${source} returned no result for this address.` };

  const { error } = await supabase.from('geocode_checks')
    .update({ chosen_lat: lat, chosen_lng: lng, chosen_source: source })
    .eq('id', checkId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/venues/geocode');
  return { ok: true, message: `${source} selected.` };
}

/** Batch. Paced at just over one per second because Nominatim's usage
 *  policy permits roughly one request per second and blocks abusers.
 *  Deliberately small per run so a batch always finishes inside the
 *  serverless timeout. */
export async function batchGeocode(limit = 10): Promise<Result> {
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from('venues')
    .select('id')
    .is('latitude', null)
    .not('street_address', 'is', null)
    .order('id')
    .limit(Math.min(limit, 40));

  if (!venues?.length) return { ok: true, message: 'Nothing left to check.' };

  let ok = 0, failed = 0;
  for (const v of venues) {
    const r = await checkVenueGeocode(v.id);
    r.ok ? ok++ : failed++;
    await new Promise((res) => setTimeout(res, 1100));
  }

  revalidatePath('/venues/geocode');
  return { ok: true, message: `Checked ${ok} venue${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.` };
}

/** Geocodes a venue straight after it has been read, and applies the
 *  result only where there is nothing to argue about.
 *
 *  The two-step check-then-apply exists because an imported address may
 *  be wrong and somebody should look. A venue just read from its own
 *  website is a different case — the address came from the people who
 *  live there.
 *
 *  Applied on Agreed or Close only. Anything else is left as a check for
 *  a person, because a venue placed in the wrong country is worse than a
 *  venue with no coordinates.
 */
export async function geocodeAfterIntake(venueId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: v } = await supabase.from('venues')
    .select('latitude,street_address,country_id').eq('id', venueId).single();

  // Never overwrites. A coordinate already there was either checked or
  // chosen, and neither should be replaced by an automatic pass.
  if (v?.latitude != null) return { ok: true, message: 'Already placed.' };
  if (!v?.street_address && !v?.country_id) {
    return { ok: true, message: 'Not enough address to place it.' };
  }

  const checked = await checkVenueGeocode(venueId);
  if (!checked.ok) return checked;

  const { data: check } = await supabase.from('geocode_checks')
    .select('id,verdict,distance_metres')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  if (!check) return { ok: true, message: 'Nothing came back.' };

  if (check.verdict === 'Agreed' || check.verdict === 'Close') {
    const applied = await applyGeocode(check.id);
    if (!applied.ok) return applied;

    // A village is rarely in the cities table — 152,605 rows is every
    // place with a name and a retreat is usually somewhere smaller. The
    // coordinate knows which real place is nearest.
    const { data: placed } = await supabase.rpc('place_by_coordinates', {
      p_venue_id: venueId,
    });

    return {
      ok: true,
      message: `Placed — ${check.verdict.toLowerCase()}.`
        + (placed?.city ? ` ${placed.note}` : ''),
    };
  }

  return {
    ok: true,
    message: `Left for review — ${check.verdict}. `
      + 'Placing a venue in the wrong country is worse than leaving it unplaced.',
  };
}

/** Coordinates that do not match the address recorded against them.
 *
 *  Checked against the nearest of 152,605 cities rather than a country
 *  centre. A country centre said a Victorian venue was 1,564 km out of
 *  place, because Australia's middle is in the desert — the nearest city
 *  says which country a point is actually in, which is the real question.
 */
export async function coordinateProblems() {
  const supabase = await createClient();
  const { data } = await supabase.from('coordinate_problems')
    .select('*')
    .order('state')
    .limit(200);
  return data ?? [];
}

/** Records that a person looked at the position and it is right. */
export async function confirmCoordinates(
  venueId: number, how: string, note?: string
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_coordinates', {
    p_venue_id: venueId, p_how: how, p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'That venue has no coordinate to confirm.' };

  revalidatePath(`/venues/${venueId}/location`);
  return { ok: true, message: 'Confirmed.' };
}

/** Moves the pin, which clears any confirmation unless the same act
 *  confirms it. */
export async function setCoordinates(
  venueId: number, lat: number, lng: number, confirm = false
): Promise<Result> {
  const supabase = await createClient();

  const { error } = await supabase.from('venues').update({
    latitude: lat, longitude: lng,
    coordinates_source: 'Set by hand',
    coordinates_precision: 'Property',
    ...(confirm ? {
      coordinates_confirmed_at: new Date().toISOString().slice(0, 10),
      coordinates_confirmed_how: 'Satellite view',
    } : {}),
  }).eq('id', venueId);

  if (error) {
    // The guard raises rather than returning an error, so its message is
    // the useful one and should reach the person rather than a code.
    return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, '') };
  }

  revalidatePath(`/venues/${venueId}/location`);
  return { ok: true, message: confirm ? 'Moved and confirmed.' : 'Moved.' };
}
