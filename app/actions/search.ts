'use server';

import { createClient } from '@/lib/supabase/server';

export type SearchParams = Record<string, unknown>;

/** Calls search_venues_advanced. Every parameter is optional and null means
 *  "do not filter on this", so the caller only sends what is actually set —
 *  the query shape never changes as conditions are added. */
export async function runAdvancedSearch(params: SearchParams) {
  const supabase = await createClient();

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    clean[k] = v;
  }

  const { data, error } = await supabase.rpc('search_venues_advanced', clean);
  if (error) return { ok: false as const, error: error.message, rows: [], total: 0 };

  const rows = data ?? [];
  return {
    ok: true as const,
    rows,
    total: rows.length ? Number(rows[0].total_count) : 0,
  };
}

/** Everything the filter panel needs, in one call. */
export async function searchOptions() {
  const supabase = await createClient();

  const [countries, types, hireTypes, categories, practices, facilityCats,
         facilities, outcomes, audiences, tiers, continents] = await Promise.all([
    supabase.from('countries').select('id,name,continent_id,iso_code').order('name'),
    supabase.from('venue_types').select('id,name,applies_to').order('name'),
    supabase.from('hire_types').select('id,name').order('name'),
    supabase.from('modality_categories').select('id,name').order('display_order'),
    supabase.from('modality_practices').select('id,name,category_id').order('name'),
    supabase.from('facility_categories').select('id,name').order('display_order'),
    supabase.from('facility_items').select('id,name,facility_category_id').order('name'),
    supabase.from('outcomes').select('id,name').order('display_order'),
    supabase.from('audiences').select('id,name').order('display_order'),
    supabase.from('subscription_tiers').select('id,name').order('display_order'),
    supabase.from('continents').select('id,name').order('name'),
  ]);

  return {
    countries: countries.data ?? [],
    types: types.data ?? [],
    hireTypes: hireTypes.data ?? [],
    categories: categories.data ?? [],
    practices: practices.data ?? [],
    facilityCats: facilityCats.data ?? [],
    facilities: facilities.data ?? [],
    outcomes: outcomes.data ?? [],
    audiences: audiences.data ?? [],
    tiers: tiers.data ?? [],
    continents: continents.data ?? [],
  };
}

/** Saves a search so a good one can be returned to. Stored as the parameter
 *  object rather than a description, so it re-runs exactly. */
export async function saveSearch(name: string, params: SearchParams): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { error } = await supabase.from('saved_searches')
    .insert({ name: name.trim(), params });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listSavedSearches() {
  const supabase = await createClient();
  const { data } = await supabase.from('saved_searches')
    .select('*').order('created_at', { ascending: false }).limit(50);
  return data ?? [];
}

export async function deleteSavedSearch(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('saved_searches').delete().eq('id', id);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/* ── saving a venue against a person ─────────────────────────────── */

export async function saveVenueToContact(
  contactId: number, venueId: number, relationship: string,
  reason?: string, enquiryId?: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('contact_venues').upsert(
    { contact_id: contactId, venue_id: venueId, relationship,
      reason: reason || null, enquiry_id: enquiryId ?? null },
    { onConflict: 'contact_id,venue_id,relationship' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeVenueFromContact(rowId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('contact_venues').delete().eq('id', rowId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/* ── geography cascade ───────────────────────────────────────────── */

/** States for the chosen countries. 5,244 exist in total, so they load on
 *  demand rather than being shipped to the browser up front. */
export async function statesFor(countryIds: number[]) {
  if (!countryIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('states')
    .select('id,name,country_id,state_type,state_code')
    .in('country_id', countryIds)
    .order('name')
    .limit(1200);
  return data ?? [];
}

/** Cities for the chosen states. There are 152,605, so this is never
 *  loaded without a state to scope it — and it stays searchable by name
 *  because even one state can hold hundreds. */
export async function citiesFor(stateIds: number[], q = '') {
  if (!stateIds.length) return [];
  const supabase = await createClient();
  let query = supabase
    .from('cities')
    .select('id,name,state_id')
    .in('state_id', stateIds)
    .order('name')
    .limit(300);
  if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
  const { data } = await query;
  return data ?? [];
}

/** Countries that actually hold venues, so the filter can offer a shorter
 *  list where that is more useful than the full 245. */
export async function countriesWithVenues() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('venue_list').select('country_id').not('country_id', 'is', null);
  return Array.from(new Set((data ?? []).map((r: any) => r.country_id)));
}

