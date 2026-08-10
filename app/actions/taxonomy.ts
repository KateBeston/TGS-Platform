'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Simple venue_id + x_id join tables. Toggling is add or remove — there is
 *  no partial state, so no field to edit. */
const SIMPLE: Record<string, string> = {
  venue_categories: 'category_id',
  venue_practices: 'practice_id',
  venue_outcomes: 'outcome_id',
  venue_audiences: 'audience_id',
  venue_formats: 'format_id',
};

export async function toggleTaxonomy(
  table: string, venueId: number, itemId: number, on: boolean
): Promise<Result> {
  const col = SIMPLE[table];
  if (!col) return { ok: false, error: `"${table}" is not a taxonomy join.` };

  const supabase = await createClient();
  const { error } = on
    ? await supabase.from(table).upsert({ venue_id: venueId, [col]: itemId },
        { onConflict: `venue_id,${col}` })
    : await supabase.from(table).delete().eq('venue_id', venueId).eq(col, itemId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/taxonomy`);
  return { ok: true };
}

/** Selecting a practice implies its category. Doing it silently avoids the
 *  state where a venue offers Yin Yoga but does not appear under Yoga —
 *  which would be invisible until someone noticed the hub page was short. */
export async function togglePractice(
  venueId: number, practiceId: number, on: boolean
): Promise<Result> {
  const supabase = await createClient();

  const { error } = on
    ? await supabase.from('venue_practices')
        .upsert({ venue_id: venueId, practice_id: practiceId },
                { onConflict: 'venue_id,practice_id' })
    : await supabase.from('venue_practices')
        .delete().eq('venue_id', venueId).eq('practice_id', practiceId);

  if (error) return { ok: false, error: error.message };

  if (on) {
    const { data: practice } = await supabase
      .from('modality_practices').select('category_id').eq('id', practiceId).single();
    if (practice?.category_id) {
      await supabase.from('venue_categories')
        .upsert({ venue_id: venueId, category_id: practice.category_id },
                { onConflict: 'venue_id,category_id' });
    }
  }

  revalidatePath(`/venues/${venueId}/taxonomy`);
  return { ok: true };
}

/* ── facilities ──────────────────────────────────────────────────── */

const FACILITY_COLUMNS = new Set([
  'quantity','detail','notes','display_order','website_title','website_description',
  'show_on_website','setting','is_private','operating_hours','capacity',
  'size_value','size_unit','temperature','is_heated','water_source','features',
]);

export async function toggleFacility(
  venueId: number, itemId: number, on: boolean
): Promise<Result> {
  const supabase = await createClient();

  if (on) {
    const { error } = await supabase.from('venue_facilities')
      .insert({ venue_id: venueId, facility_item_id: itemId });
    if (error && !/duplicate/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from('venue_facilities')
      .delete().eq('venue_id', venueId).eq('facility_item_id', itemId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/venues/${venueId}/facilities`);
  return { ok: true };
}

export async function saveFacilityField(
  rowId: number, venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!FACILITY_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a facility.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venue_facilities')
    .update({ [column]: value }).eq('id', rowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/facilities`);
  return { ok: true };
}
