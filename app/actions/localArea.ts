'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { proposeFromCoords, type DistanceProposal, type ExcursionProposal } from '@/lib/localArea';

/* Propose → review → apply. proposeLocalArea only reads external data and
 * returns suggestions; nothing touches the database until the curator
 * confirms a selection through applyLocalArea. */

export async function proposeLocalArea(venueId: number) {
  const supabase = await createClient();
  const { data: v, error } = await supabase
    .from('venues').select('latitude,longitude').eq('id', venueId).single();
  if (error || !v) return { ok: false as const, error: 'Venue not found.' };
  if (v.latitude == null || v.longitude == null) {
    return { ok: false as const, error: 'This venue has no coordinates yet — geocode it first, then harvest.' };
  }
  const r = await proposeFromCoords(Number(v.latitude), Number(v.longitude));
  if (r.error) return { ok: false as const, error: r.error };
  if (!r.distances.length && !r.excursions.length) {
    return { ok: false as const, error: 'Nothing found nearby. The coordinates may be off, or the region is sparse.' };
  }
  return { ok: true as const, distances: r.distances, excursions: r.excursions };
}

export async function applyLocalArea(
  venueId: number, distances: DistanceProposal[], excursions: ExcursionProposal[],
) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (distances.length) {
    // Continue the display order after whatever is already there.
    const { data: last } = await supabase.from('venue_distances')
      .select('display_order').eq('venue_id', venueId)
      .order('display_order', { ascending: false }).limit(1).maybeSingle();
    const start = (last?.display_order ?? 0);
    const { error } = await supabase.from('venue_distances').insert(distances.map((d, i) => ({
      venue_id: venueId, label: d.label, category: d.category,
      travel_value: d.travel_value, travel_unit: d.travel_unit,
      latitude: d.latitude, longitude: d.longitude, google_place_id: d.google_place_id,
      travel_mode: d.travel_mode, travel_source: 'google', travel_calculated_at: now,
      show_on_listing: true, display_order: start + i + 1,
    })));
    if (error) return { ok: false as const, error: error.message };
  }

  if (excursions.length) {
    const { data: last } = await supabase.from('venue_excursions')
      .select('display_order').eq('venue_id', venueId)
      .order('display_order', { ascending: false }).limit(1).maybeSingle();
    const start = (last?.display_order ?? 0);
    const { error } = await supabase.from('venue_excursions').insert(excursions.map((e, i) => ({
      venue_id: venueId, name: e.name, description: e.description || null,
      duration_label: e.duration_label || null, display_order: start + i + 1,
    })));
    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath(`/venues/${venueId}/location`);
  revalidatePath(`/venues/${venueId}/experiences`);
  return { ok: true as const, added: { distances: distances.length, excursions: excursions.length } };
}

/** Harvest the local area and add only what is new — the shared routine
 *  behind both the read-site harvest and the re-read, so a venue picks up
 *  its surroundings however it is processed. Returns how many rows landed;
 *  0 on no coordinates, no key, or nothing new. Never throws. */
export async function backfillLocalArea(venueId: number): Promise<number> {
  try {
    const supabase = await createClient();
    const { data: v } = await supabase
      .from('venues').select('latitude,longitude').eq('id', venueId).single();
    if (!v || v.latitude == null || v.longitude == null) return 0;

    const area = await proposeFromCoords(Number(v.latitude), Number(v.longitude));
    if (area.error || (!area.distances.length && !area.excursions.length)) return 0;

    const [{ data: exD }, { data: exE }] = await Promise.all([
      supabase.from('venue_distances').select('google_place_id').eq('venue_id', venueId),
      supabase.from('venue_excursions').select('name').eq('venue_id', venueId),
    ]);
    const haveD = new Set((exD ?? []).map((r: any) => r.google_place_id).filter(Boolean));
    const haveE = new Set((exE ?? []).map((r: any) => String(r.name).toLowerCase()));
    const newD = area.distances.filter((d) => d.google_place_id && !haveD.has(d.google_place_id));
    const newE = area.excursions.filter((e) => e.name && !haveE.has(e.name.toLowerCase()));
    if (!newD.length && !newE.length) return 0;

    const r = await applyLocalArea(venueId, newD, newE);
    return r.ok ? newD.length + newE.length : 0;
  } catch {
    return 0;
  }
}
