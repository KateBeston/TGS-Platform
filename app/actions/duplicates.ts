'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result =
  | { ok: true; message?: string; keptId?: number }
  | { ok: false; error: string };

/** Venues that look like the one described.
 *
 *  Called before anything is created from a URL. A duplicate caught here
 *  costs a moment; one caught in three months means two sets of
 *  enquiries and a host booking the record nobody updated. */
export async function checkForDuplicates(
  name: string, website?: string | null, email?: string | null, phone?: string | null,
  excludeId?: number | null,
) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('find_similar_venues', {
    p_name: name,
    p_website: website ?? null,
    p_email: email ?? null,
    p_phone: phone ?? null,
    p_exclude_id: excludeId ?? null,
  });
  return data ?? [];
}

export async function duplicatePairs(status = 'Open') {
  const supabase = await createClient();
  const { data } = await supabase
    .from('venue_duplicates')
    .select('*')
    .eq('status', status)
    .order('score', { ascending: false })
    .limit(200);

  if (!data?.length) return [];

  // Both venues in one query rather than two per pair.
  const ids = [...new Set(data.flatMap((d: any) => [d.venue_id, d.other_venue_id]))];
  const { data: venues } = await supabase
    .from('venues')
    .select('id,venue_name,website_url,venue_status,contact_email,contact_phone,'
      + 'street_address,max_guests,total_bedrooms,created_at,'
      + 'cities(name),countries(name)')
    .in('id', ids);

  const byId = new Map((venues ?? []).map((v: any) => [v.id, v]));

  // How complete each record is, so the fuller one can be suggested as
  // the survivor rather than left to guesswork.
  const filled = (v: any) => v ? [
    v.website_url, v.contact_email, v.contact_phone, v.street_address,
    v.max_guests, v.total_bedrooms, v.cities?.name,
  ].filter(Boolean).length : 0;

  return data.map((d: any) => {
    const a = byId.get(d.venue_id);
    const b = byId.get(d.other_venue_id);
    return {
      ...d,
      a, b,
      aFilled: filled(a),
      bFilled: filled(b),
      // The fuller record survives by default. Where they tie, the older
      // one does — it is likelier to be the one already referenced.
      suggestKeep: filled(a) === filled(b)
        ? (a?.created_at <= b?.created_at ? d.venue_id : d.other_venue_id)
        : (filled(a) > filled(b) ? d.venue_id : d.other_venue_id),
    };
  });
}

/** Merges one into the other. Children move, blanks are filled, the
 *  losing record is removed. */
export async function mergeVenues(
  keepId: number, mergeId: number, note?: string
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('merge_venues', {
    p_keep_id: keepId, p_merge_id: mergeId, p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };

  const moved = (data as any)?.records_moved ?? {};
  const filled = (data as any)?.fields_filled ?? [];
  const movedCount = Object.values(moved)
    .filter((v) => typeof v === 'number')
    .reduce((a: number, b: any) => a + b, 0);

  revalidatePath('/venues/duplicates');
  revalidatePath('/venues');
  return {
    ok: true,
    keptId: keepId,
    message: `Merged. ${filled.length} blank field${filled.length === 1 ? '' : 's'} filled`
      + `${movedCount ? `, ${movedCount} record${movedCount === 1 ? '' : 's'} moved across` : ''}.`,
  };
}

export async function notDuplicates(pairId: number, note?: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_duplicates').update({
    status: 'Not duplicates', decided_at: new Date().toISOString(), decided_note: note ?? null,
  }).eq('id', pairId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/venues/duplicates');
  return { ok: true };
}

export async function runSweep(): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('sweep_duplicates', { p_limit: 500 });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: `${data ?? 0} pairs waiting.` };
}

/* ── field by field ──────────────────────────────────────────────── */

export type FieldDiff = {
  column_name: string;
  keep_value: string | null;
  merge_value: string | null;
  verdict: string;
  default_action: string;
};

/** Every field where there is something to decide.
 *
 *  Fields that agree, or are empty on both, are not decisions and are not
 *  returned — a list of two hundred rows where four matter is a list
 *  nobody reads. */
export async function mergeComparison(
  keepId: number, mergeId: number
): Promise<FieldDiff[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('venue_merge_comparison', {
    p_keep_id: keepId, p_merge_id: mergeId,
  });
  return (data ?? []) as FieldDiff[];
}

export async function mergeSelective(
  keepId: number, mergeId: number, takeColumns: string[], reason?: string
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('merge_venues_selective', {
    p_keep_id: keepId,
    p_merge_id: mergeId,
    p_take_columns: takeColumns,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };

  const taken = (data as any)?.columns_taken ?? [];
  const moved = (data as any)?.records_moved ?? {};
  const movedCount = Object.values(moved)
    .filter((v) => typeof v === 'number')
    .reduce((a: number, b: any) => a + b, 0);

  revalidatePath('/venues/duplicates');
  revalidatePath('/venues');
  return {
    ok: true,
    keptId: keepId,
    message: `Merged. ${taken.length} field${taken.length === 1 ? '' : 's'} taken across`
      + `${movedCount ? `, ${movedCount} record${movedCount === 1 ? '' : 's'} moved` : ''}.`,
  };
}
