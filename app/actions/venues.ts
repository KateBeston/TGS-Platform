'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Columns the intake is allowed to write to `venues`.
 *  An allow-list rather than passing arbitrary keys through — a typo in a
 *  client component should fail loudly here, not write a stray column. */
const VENUE_COLUMNS = new Set([
  'venue_name','slug','website_url','instagram_url','facebook_url','linkedin_url',
  'established_year','venue_type_id','venue_short_description','venue_full_description',
  'street_address','postcode','latitude','longitude','maps_url','timezone',
  'country_id','state_id','city_id','climate_type',
  'contact_first_name','contact_surname','contact_email','contact_phone',
  'max_guests','min_guests','day_guest_capacity','minimum_stay_nights',
  'total_bedrooms','total_bathrooms','private_ensuites','shared_bathrooms',
  'check_in_time','check_out_time','early_checkin_available','late_checkout_available',
  'children_allowed','minimum_child_age','pets_allowed','smoking_allowed',
  'has_access_restriction','access_policy_type','access_policy_details',
  'hosting_restriction_details','cultural_protocol_details',
  'permits_ceremony','permits_plant_medicine',
  'elevator_access','accessible_rooms','accessible_bathrooms','ground_floor_rooms',
  'accessibility_summary','accessibility_notes',
  'property_size','property_size_unit','property_type','accommodation_description',
  'price_from','price_unit','price_currency','internal_notes',
]);

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function updateVenueField(
  venueId: number,
  column: string,
  value: string | number | boolean | null
): Promise<SaveResult> {
  if (!VENUE_COLUMNS.has(column)) {
    return { ok: false, error: `Column "${column}" is not writable from the intake.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('venues')
    .update({ [column]: value })
    .eq('id', venueId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/venues/${venueId}`, 'layout');
  return { ok: true };
}

/* ── child rows: venue_spaces ─────────────────────────────────────── */

const SPACE_COLUMNS = new Set([
  'name','space_type','capacity','capacity_unit','area','area_unit','outlook',
  'is_outdoor','is_covered','description','setting','view_type','flooring',
  'climate_control','lighting','acoustics','equipment_provided','suitable_for',
  'theatre_capacity','boardroom_capacity','classroom_capacity',
  'hire_price','price_basis','currency','is_included','minimum_hours','display_order',
]);

export async function updateSpaceField(
  spaceId: number,
  venueId: number,
  column: string,
  value: string | number | boolean | null
): Promise<SaveResult> {
  if (!SPACE_COLUMNS.has(column)) {
    return { ok: false, error: `Column "${column}" is not writable on a space.` };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('venue_spaces')
    .update({ [column]: value })
    .eq('id', spaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/spaces`);
  return { ok: true };
}

export async function addSpace(venueId: number): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('venue_spaces')
    .insert({ venue_id: venueId, name: 'New space' });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/spaces`);
  return { ok: true };
}

export async function deleteSpace(spaceId: number, venueId: number): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_spaces').delete().eq('id', spaceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/spaces`);
  return { ok: true };
}

/* ── geography cascade ────────────────────────────────────────────── */

export async function getStates(countryId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('states').select('id,name').eq('country_id', countryId).order('name');
  return data ?? [];
}

export async function getCities(stateId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cities').select('id,name').eq('state_id', stateId).order('name').limit(2000);
  return data ?? [];
}

/* ── space capacity ──────────────────────────────────────────────── */

export async function spaceUsages() {
  const supabase = await createClient();
  const { data } = await supabase.from('space_usages')
    .select('*').order('category').order('display_order');
  return data ?? [];
}

export async function spaceCapacities(spaceId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_space_capacities')
    .select('*').eq('space_id', spaceId);
  return data ?? [];
}

/** A figure typed by hand is a stated one, even where an estimate was
 *  there before. Somebody correcting a calculated number is telling us
 *  something, and it should stop being flagged as guesswork. */
export async function saveSpaceCapacity(
  spaceId: number, usageId: number, capacity: number | null
) {
  const supabase = await createClient();

  if (capacity === null) {
    const { error } = await supabase.from('venue_space_capacities')
      .delete().eq('space_id', spaceId).eq('usage_id', usageId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await supabase.from('venue_space_capacities').upsert({
    space_id: spaceId, usage_id: usageId, capacity, source: 'Venue stated', notes: null,
  }, { onConflict: 'space_id,usage_id' });

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function estimateCapacities(spaceId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('estimate_space_capacities', {
    p_space_id: spaceId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: `${data ?? 0} worked out from the floor area.` };
}

/* ── removing a venue ────────────────────────────────────────────── */

/** What would be lost, shown before the decision.
 *
 *  "Delete" on a record with thirty child rows is a different act from
 *  "delete" on an empty one, and the interface should not make them look
 *  the same. */
export async function deleteImpact(venueId: number) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('venue_delete_impact', { p_venue_id: venueId });
  return data as {
    child_records: Record<string, number>;
    total: number;
    enquiries: number;
    can_delete: boolean;
    recommendation: string;
  } | null;
}

export async function deleteVenue(venueId: number, reason: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('delete_venue', {
    p_venue_id: venueId, p_reason: reason || null,
  });
  if (error) {
    // The refusal where enquiries exist is deliberate and worth saying
    // plainly rather than as a database error.
    return { ok: false as const, error: error.message.replace(/^.*?ERROR:\s*/, '') };
  }
  revalidatePath('/venues');
  return { ok: true as const, message: `${(data as any)?.deleted} removed.` };
}

export async function archiveReasons() {
  const supabase = await createClient();
  const { data } = await supabase.from('archive_reasons')
    .select('*').order('display_order');
  return data ?? [];
}

/** Out of every list, but not destroyed, and always with a reason.
 *
 *  "Why did this disappear" is a question asked a year later, and a
 *  deleted row cannot answer it. An archived one can. */
export async function archiveVenue(
  venueId: number, reasonId: number, note?: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('archive_venue', {
    p_venue_id: venueId, p_reason_id: reasonId, p_note: note ?? null,
  });
  if (error) return { ok: false as const, error: tidyError(error.message) };
  revalidatePath('/venues');
  revalidatePath(`/venues/${venueId}/archive`);
  return { ok: true as const, message: `Archived — ${(data as any)?.reason}.` };
}

export async function restoreVenue(venueId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('restore_venue', { p_venue_id: venueId });
  if (error) return { ok: false as const, error: tidyError(error.message) };
  revalidatePath('/venues');
  return { ok: true as const, message: 'Back in the list.' };
}

/** Venues that look like this one, so a merge can be started from the
 *  record itself rather than only from the sweep. */
export async function similarTo(venueId: number) {
  const supabase = await createClient();
  const { data: v } = await supabase.from('venues')
    .select('venue_name,website_url,contact_email,contact_phone')
    .eq('id', venueId).single();
  if (!v) return [];

  const { data } = await supabase.rpc('find_similar_venues', {
    p_name: v.venue_name,
    p_website: v.website_url,
    p_email: v.contact_email,
    p_phone: v.contact_phone,
    p_exclude_id: venueId,
  });
  return data ?? [];
}

/** Database exceptions carry a prefix nobody needs to read. */
function tidyError(message: string): string {
  return message.replace(/^.*?ERROR:\s*/, '').trim();
}

/** A blank venue with a name, for when there is no site to read.
 *
 *  Deliberately on the Add a venue page rather than beside the venue
 *  search box, where it used to be — a bare text field labelled "Add a
 *  venue" next to a list invites typing a search into it, and that is
 *  exactly what happened. */
export async function createBlankVenue(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: 'A name is needed.' };

  const supabase = await createClient();

  // Checked first, since a venue typed by hand is the likeliest to
  // duplicate one already recorded.
  const { data: similar } = await supabase.rpc('find_similar_venues', {
    p_name: trimmed, p_website: null, p_email: null, p_phone: null, p_exclude_id: null,
  });
  const close = (similar ?? []).filter((d: any) => Number(d.name_similarity) > 0.75);
  if (close.length) {
    return {
      ok: false as const,
      error: `${close[0].venue_name} is already recorded and the names are nearly identical. `
        + 'Open that record, or use a name that distinguishes them.',
    };
  }

  const { data: name_normalised } = await supabase.rpc('normalise_name', { p: trimmed });

  const { data, error } = await supabase.from('venues')
    .insert({
      venue_name: name_normalised ?? trimmed,
      venue_status: 'Sourced',
      created_via: 'Added by hand',
    })
    .select('id').single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/venues');
  return { ok: true as const, venueId: data.id, message: `${trimmed} created.` };
}

/** Sets a venue's logo, from an upload or an address.
 *
 *  An uploaded one is stored rather than hotlinked. A logo read from
 *  their site is their file on their server, which disappears the day
 *  they redesign; one sent to us is ours to keep.
 */
export async function setLogo(
  venueId: number, url: string, source: 'Uploaded' | 'Set by hand'
): Promise<SaveResult> {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) {
    return { ok: false, error: 'That needs to be a full web address.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('venues')
    .update({ logo_url: clean, logo_source: source }).eq('id', venueId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/venues/${venueId}`, 'layout');
  return { ok: true };
}

/** Removes it, and records that this was deliberate.
 *
 *  Set by hand rather than null, so the next read does not helpfully put
 *  back the thing somebody just took off. */
export async function removeLogo(venueId: number): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('venues')
    .update({ logo_url: null, logo_source: 'Set by hand' }).eq('id', venueId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/venues/${venueId}`, 'layout');
  return { ok: true };
}
