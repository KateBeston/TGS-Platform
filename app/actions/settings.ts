'use server';

import { revalidatePath } from 'next/cache';
import { composeSentence, type ProseParts } from '@/lib/settingProse';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

function humanise(m: string) {
  if (/distance belongs to a Reachable/i.test(m)) {
    return 'A distance belongs to something the venue is near, not something it is in.';
  }
  if (/ux_venue_primary_setting/i.test(m)) {
    return 'Only one setting can lead. Clear the current one first.';
  }
  return m;
}

export async function settingCatalogue() {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_settings')
    .select('*').order('category').order('display_order');
  return data ?? [];
}

export async function venueSettings(venueId: number) {
  const supabase = await createClient();
  const [{ data: links }, { data: effective }] = await Promise.all([
    supabase.from('venue_setting_links')
      .select('*, venue_settings(id,name,category,slug)')
      .eq('venue_id', venueId).order('id'),
    supabase.from('venue_effective_settings')
      .select('*').eq('venue_id', venueId),
  ]);
  return {
    links: links ?? [],
    inherited: (effective ?? []).filter((e: any) => e.level !== 'Venue'),
  };
}

export async function addSetting(
  venueId: number, settingId: number, relation: 'Immediate' | 'Reachable'
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_setting_links').insert({
    venue_id: venueId, setting_id: settingId, relation, source: 'Manual',
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return { ok: false, error: 'That setting is already recorded for this venue.' };
    }
    return { ok: false, error: humanise(error.message) };
  }
  revalidatePath(`/venues/${venueId}/setting`);
  return { ok: true };
}

const EDITABLE = new Set([
  'relation', 'distance_m', 'travel_minutes', 'travel_mode', 'detail', 'is_primary',
]);

export async function saveSettingLink(
  linkId: number, venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!EDITABLE.has(column)) {
    return { ok: false, error: `"${column}" is not editable.` };
  }
  const supabase = await createClient();

  // Only one setting leads, so choosing a new one clears the old rather
  // than failing on the unique index and leaving the person to work out
  // why nothing happened.
  if (column === 'is_primary' && value === true) {
    await supabase.from('venue_setting_links')
      .update({ is_primary: false }).eq('venue_id', venueId);
  }

  // Moving a setting to Immediate drops its distance, since a venue that
  // IS riverside is not a distance from the river.
  const patch: Record<string, unknown> = { [column]: value };
  if (column === 'relation' && value === 'Immediate') {
    patch.distance_m = null;
    patch.travel_minutes = null;
    patch.travel_mode = null;
  }

  const { error } = await supabase.from('venue_setting_links')
    .update(patch).eq('id', linkId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/setting`);
  return { ok: true };
}

export async function removeSetting(linkId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_setting_links').delete().eq('id', linkId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/setting`);
  return { ok: true };
}

/* ── prose ───────────────────────────────────────────────────────── */

export async function settingSentence(venueId: number): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_setting_prose')
    .select('*').eq('venue_id', venueId).maybeSingle();
  if (!data) return null;
  return composeSentence(data as ProseParts);
}
