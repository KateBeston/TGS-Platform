'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function candidates(status = 'Pending') {
  const supabase = await createClient();
  const { data } = await supabase
    .from('facility_candidates')
    .select('*, facility_items(name)')
    .eq('status', status)
    .order('times_seen', { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function catalogueItems() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('facility_items')
    .select('id,name,room_scope,synonyms,facility_categories(name)')
    .order('name');
  return data ?? [];
}

/** Another wording of something already catalogued.
 *
 *  The commonest outcome, and the most valuable: it improves matching for
 *  every venue read afterwards, where adding a new item would fragment
 *  the catalogue into three ways of saying air conditioning. */
export async function asAlias(
  candidateId: number, itemId: number, note?: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_as_alias', {
    p_candidate_id: candidateId, p_item_id: itemId, p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/catalogues/candidates');
  return { ok: true, message: 'Recorded as another wording. It will match from now on.' };
}

/** Genuinely missing from the catalogue. A cold plunge is not a pool. */
export async function asNewItem(
  candidateId: number, categoryId: number, name: string, scope: string
): Promise<Result> {
  const supabase = await createClient();

  const { data: c } = await supabase
    .from('facility_candidates').select('normalised').eq('id', candidateId).single();

  const slug = name.trim().toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);

  const { data: item, error } = await supabase.from('facility_items').insert({
    facility_category_id: categoryId,
    name: name.trim(),
    slug,
    room_scope: scope,
    // The phrase that prompted it becomes its first synonym, so the same
    // wording matches immediately.
    synonyms: c?.normalised ? [c.normalised] : null,
  }).select('id').single();

  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'An item with that name already exists — record it as another wording instead.'
      : error.message };
  }

  await supabase.from('facility_candidates').update({
    status: 'Added', facility_item_id: item.id, decided_at: new Date().toISOString(),
  }).eq('id', candidateId);

  revalidatePath('/settings/catalogues/candidates');
  return { ok: true, message: `${name} added to the catalogue.` };
}

/** Marketing, or too vague to filter on. Kept rather than deleted, so the
 *  same phrase is not reconsidered every time it appears. */
export async function reject(candidateId: number, note?: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('facility_candidates').update({
    status: 'Rejected', decided_at: new Date().toISOString(), decided_note: note ?? null,
  }).eq('id', candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/catalogues/candidates');
  return { ok: true };
}

export async function reopen(candidateId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('facility_candidates').update({
    status: 'Pending', decided_at: null, decided_note: null, facility_item_id: null,
  }).eq('id', candidateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/catalogues/candidates');
  return { ok: true };
}

/** Items whose name is closest to the phrase, so the likely alias is
 *  offered first rather than hunted for in a list of 250. */
export async function suggestFor(phrase: string) {
  const supabase = await createClient();
  const words = phrase.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return [];

  const { data } = await supabase
    .from('facility_items')
    .select('id,name,room_scope,facility_categories(name)')
    .or(words.map((w) => `name.ilike.%${w}%`).join(','))
    .limit(8);
  return data ?? [];
}
