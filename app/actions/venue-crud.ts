'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CHILD_TABLES, VENUE_COLUMNS } from '@/lib/venueSchema';

export type SaveResult = { ok: true; id?: number } | { ok: false; error: string };

/** Shared error translation. The database enforces rules the interface
 *  should explain rather than leak as a Postgres exception. */
function humanise(message: string): string {
  if (/slug/i.test(message) && /publish/i.test(message)) {
    return 'Slug is locked while published. Unpublish first if the change is intended.';
  }
  if (/duplicate key/i.test(message)) return 'That value already exists and must be unique.';
  if (/violates foreign key/i.test(message)) return 'That reference does not exist.';
  if (/violates check constraint/i.test(message)) return 'That value is not one of the permitted options.';
  return message;
}

/* ── venue: single column ──────────────────────────────────────────── */

export async function saveVenueField(
  venueId: number, column: string, value: unknown
): Promise<SaveResult> {
  if (!VENUE_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not an editable venue column.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venues').update({ [column]: value }).eq('id', venueId);
  if (error) return { ok: false, error: humanise(error.message) };
  // Deliberately no revalidatePath. The field already holds the new value in
  // client state, so re-rendering the whole route on every blur means a full
  // server round trip and a fresh set of queries for a value nothing is
  // waiting on. That is what made a long form feel sluggish to type in.
  return { ok: true };
}

/* ── venue: create and delete ──────────────────────────────────────── */

export async function createVenue(formData: FormData) {
  const name = String(formData.get('venue_name') ?? '').trim();
  if (!name) return { error: 'A venue name is required.' };

  const supabase = await createClient();
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);

  const { data, error } = await supabase
    .from('venues')
    // Sourced: catalogued by TGS, not yet approached. A venue that comes
    // to us through a form is set to Applied by the intake endpoint, and
    // that distinction is what keeps the new-lead queue meaningful.
    .insert({ venue_name: name, slug, venue_status: 'Sourced' })
    .select('id')
    .single();

  if (error) return { error: humanise(error.message) };
  redirect(`/venues/${data.id}/details`);
}

export async function deleteVenue(venueId: number): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('venues').delete().eq('id', venueId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/venues');
  return { ok: true };
}

/* ── child rows: generic ───────────────────────────────────────────── */

export async function saveChildField(
  table: string, rowId: number, column: string, value: unknown, venueId: number
): Promise<SaveResult> {
  const def = CHILD_TABLES[table];
  if (!def) return { ok: false, error: `"${table}" is not an editable child table.` };
  if (!def.cols.has(column)) return { ok: false, error: `"${column}" is not editable on ${table}.` };

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ [column]: value }).eq('id', rowId);
  if (error) return { ok: false, error: humanise(error.message) };
  // Same reasoning as saveVenueField — no revalidation on a field edit.
  return { ok: true };
}

export async function addChildRow(table: string, venueId: number): Promise<SaveResult> {
  const def = CHILD_TABLES[table];
  if (!def) return { ok: false, error: `"${table}" is not an editable child table.` };

  const supabase = await createClient();

  // Inserting only venue_id fails on any table with a required column,
  // which is twenty of them — and the button then appears to do nothing
  // at all rather than saying why.
  //
  // A placeholder that reads as a placeholder, so an unfinished row is
  // obvious in a list rather than looking like a real record called "".
  const SEEDS: Record<string, Record<string, unknown>> = {
    venue_services:        { name: 'New service' },
    venue_spaces:          { name: 'New space' },
    venue_room_types:      { name: 'New room type' },
    venue_packages:        { name: 'New package' },
    venue_excursions:      { name: 'New excursion' },
    venue_extras:          { name: 'New extra', extra_category: 'Other' },
    venue_fees:            { name: 'New fee' },
    venue_meals:           { name: 'New meal', meal_period: 'Lunch' },
    venue_practitioners:   { full_name: 'New practitioner' },
    venue_distances:       { label: 'New place' },
    venue_transfer_options:{ title: 'New transfer' },
    venue_setting_features:{ title: 'New feature' },
    venue_values:          { title: 'New value' },
    venue_faqs:            { question: 'New question' },
    venue_notes:           { body: '' },
    venue_media:           { url: '' },
    venue_policies:        { policy_type: 'Other' },
    venue_seasons:         { season_name: 'New season' },
    venue_seasonal_rates:  { rate_name: 'New rate' },
    // Monday, since a week has to start somewhere and 0 is Sunday.
    venue_opening_hours:   { day_of_week: 1 },
    venue_service_categories: { name: 'New category' },
  };

  const seed: Record<string, unknown> = {
    venue_id: venueId,
    ...(SEEDS[table] ?? {}),
  };

  const { data, error } = await supabase
    .from(table).insert(seed).select('id').single();

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/[tab]`, 'page');
  return { ok: true, id: data?.id };
}

export async function deleteChildRow(
  table: string, rowId: number, venueId: number
): Promise<SaveResult> {
  if (!CHILD_TABLES[table]) return { ok: false, error: `"${table}" is not an editable child table.` };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq('id', rowId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/[tab]`, 'page');
  return { ok: true };
}
