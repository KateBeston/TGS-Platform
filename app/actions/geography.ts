'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
export type Place = {
  id: number;
  name: string;
  /** Shown beside the name — how many venues, what kind of place. */
  note?: string | null;
};

/** The geography, one level at a time.
 *
 *  Loaded on demand rather than all at once. There are 152,605 cities —
 *  sending them to a browser to be filtered there would be a twelve
 *  megabyte page for a field somebody uses once.
 */
export async function continents(): Promise<Place[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('continents')
    .select('id,name').order('name');
  return data ?? [];
}

export async function countriesIn(continentId: number | null): Promise<Place[]> {
  const supabase = await createClient();
  let q = supabase.from('countries').select('id,name').order('name');
  if (continentId) q = q.eq('continent_id', continentId);
  const { data } = await q;
  return data ?? [];
}

export async function statesIn(countryId: number | null): Promise<Place[]> {
  if (!countryId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('states')
    .select('id,name').eq('country_id', countryId).order('name');
  return data ?? [];
}

/** Cities, narrowed and searchable.
 *
 *  A state can hold thousands, so this takes a search term as well —
 *  scrolling to find Tallebudgera Valley among Queensland's is not a
 *  thing anybody should have to do.
 */
export async function citiesIn(
  stateId: number | null, countryId: number | null, search?: string
): Promise<Place[]> {
  const supabase = await createClient();
  let q = supabase.from('cities').select('id,name').order('name').limit(200);

  if (stateId) q = q.eq('state_id', stateId);
  else if (countryId) q = q.eq('country_id', countryId);
  else return [];

  if (search?.trim()) q = q.ilike('name', `%${search.trim()}%`);

  const { data } = await q;
  return data ?? [];
}

/** Suburbs and areas within a city.
 *
 *  The level venues actually sit at. Bali has twenty-five cities and none
 *  is Canggu; Brisbane is one city and a venue there is in Paddington. */
export async function localitiesIn(
  cityId: number | null, search?: string
): Promise<Place[]> {
  if (!cityId) return [];
  const supabase = await createClient();

  let q = supabase.from('localities')
    .select('id,name,kind,venue_count').eq('city_id', cityId)
    .order('venue_count', { ascending: false }).order('name').limit(150);

  if (search?.trim()) q = q.ilike('name', `%${search.trim()}%`);

  const { data } = await q;
  return (data ?? []).map((l: any) => ({
    id: l.id,
    name: l.name,
    note: [l.kind, l.venue_count ? `${l.venue_count} venues` : null]
      .filter(Boolean).join(' · ') || null,
  })) as Place[];
}

/** Records a suburb nobody had listed.
 *
 *  Canggu is a real place and a list that has never heard of it is the
 *  thing that is wrong. */
export async function addLocality(
  name: string, cityId: number, kind?: string
): Promise<Result & { id?: number }> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('find_or_add_locality', {
    p_name: name.trim(), p_city_id: cityId,
    p_kind: kind ?? null, p_source: 'Added by hand',
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data as number };
}

/** Where a venue sits, resolved upwards.
 *
 *  A venue stores a city; the continent and country come from it. Asking
 *  the venue for its continent would mean storing the same fact four
 *  times and letting three of them go stale.
 */
export async function placeOf(venueId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('venues')
    .select(`city_id, state_id, country_id, locality_id, locality,
             cities(id,name,state_id,country_id),
             states(id,name,country_id),
             countries(id,name,continent_id, continents(id,name))`)
    .eq('id', venueId).maybeSingle();

  const country = data?.countries as any;
  return {
    continent_id: country?.continent_id ?? null,
    country_id: data?.country_id ?? null,
    state_id: data?.state_id ?? null,
    city_id: data?.city_id ?? null,
    locality_id: data?.locality_id ?? null,
    their_wording: data?.locality ?? null,
    continent_name: country?.continents?.name ?? null,
  };
}

/** Sets a venue's place, and keeps the levels honest.
 *
 *  Choosing a city sets its state and country too — they are facts about
 *  the city, not separate answers, and letting somebody set a city in one
 *  country and a country in another is how the geography breaks.
 */
export async function setPlace(
  venueId: number, level: 'country' | 'state' | 'city' | 'locality',
  id: number | null
): Promise<Result> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};

  if (level === 'locality') {
    patch.locality_id = id;
    // The locality knows its city, so choosing one fills the level above.
    if (id) {
      const { data: l } = await supabase.from('localities')
        .select('city_id,state_id,country_id').eq('id', id).single();
      if (l?.city_id) patch.city_id = l.city_id;
      if (l?.state_id) patch.state_id = l.state_id;
      if (l?.country_id) patch.country_id = l.country_id;
    }
  }

  if (level === 'city') {
    patch.city_id = id;
    // The locality belonged to the old city.
    patch.locality_id = null;
    if (id) {
      const { data: c } = await supabase.from('cities')
        .select('state_id,country_id').eq('id', id).single();
      if (c?.state_id) patch.state_id = c.state_id;
      if (c?.country_id) patch.country_id = c.country_id;
    }
  }

  if (level === 'state') {
    patch.state_id = id;
    // The city belonged to the old state and no longer fits.
    patch.city_id = null;
    patch.locality_id = null;
    if (id) {
      const { data: s } = await supabase.from('states')
        .select('country_id').eq('id', id).single();
      if (s?.country_id) patch.country_id = s.country_id;
    }
  }

  if (level === 'country') {
    patch.country_id = id;
    patch.state_id = null;
    patch.city_id = null;
    patch.locality_id = null;
  }

  const { error } = await supabase.from('venues').update(patch).eq('id', venueId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/venues/${venueId}/location`);
  return { ok: true };
}
