'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const COLUMNS = new Set([
  'hero_image_url','break_image_url','section_label','section_title',
  'section_subtitle','intro_paragraph','intro_paragraph_2',
  'show_section','display_order',
]);

/** Upsert on (venue_id, tab_key) — the row is created the first time a
 *  field on that tab is touched, so there is no "create this tab" step
 *  before you can type. */
export async function saveTabContent(
  venueId: number, tabKey: string, column: string, value: unknown
): Promise<Result> {
  if (!COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on tab content.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('venue_tab_content')
    .upsert(
      { venue_id: venueId, tab_key: tabKey, [column]: value },
      { onConflict: 'venue_id,tab_key' }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/content`);
  return { ok: true };
}

/** Copies every tab's editorial from one venue to another. Useful where a
 *  group runs several properties with the same voice — the structure is
 *  identical and only the specifics change. */
export async function copyTabContent(
  fromVenueId: number, toVenueId: number
): Promise<Result> {
  if (fromVenueId === toVenueId) return { ok: false, error: 'Same venue.' };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('venue_tab_content').select('*').eq('venue_id', fromVenueId);

  if (!rows?.length) return { ok: false, error: 'That venue has no tab content to copy.' };

  const copies = rows.map((r: any) => ({
    venue_id: toVenueId,
    tab_key: r.tab_key,
    section_label: r.section_label,
    section_title: r.section_title,
    section_subtitle: r.section_subtitle,
    intro_paragraph: r.intro_paragraph,
    intro_paragraph_2: r.intro_paragraph_2,
    show_section: r.show_section,
    display_order: r.display_order,
    // Images are deliberately not copied — they are of a specific property.
  }));

  const { error } = await supabase
    .from('venue_tab_content').upsert(copies, { onConflict: 'venue_id,tab_key' });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${toVenueId}/content`);
  return { ok: true, message: `${copies.length} tabs copied. Images were not — those are specific to a property.` };
}
