'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result =
  | { ok: true; message?: string; id?: number; path?: string }
  | { ok: false; error: string };

export async function areas() {
  const supabase = await createClient();
  const { data } = await supabase.from('file_area_tree')
    .select('*').order('display_order');
  return data ?? [];
}

export async function files(areaSlug?: string, search?: string) {
  const supabase = await createClient();
  let q = supabase.from('business_files')
    .select('*, file_areas(name,slug,parent_id), venues(id,venue_name)')
    .eq('is_current', true)
    .order('created_at', { ascending: false })
    .limit(300);

  if (areaSlug && areaSlug !== 'all') {
    const { data: area } = await supabase.from('file_areas')
      .select('id').eq('slug', areaSlug).single();
    if (area) {
      // A parent shows everything beneath it — otherwise clicking "Brand
      // and design" shows nothing while five sub-areas hold the files.
      const { data: children } = await supabase.from('file_areas')
        .select('id').eq('parent_id', area.id);
      const ids = [area.id, ...(children ?? []).map((c: any) => c.id)];
      q = q.in('area_id', ids);
    }
  }

  if (search?.trim()) {
    q = q.or(`name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
  }

  const { data } = await q;
  return data ?? [];
}

/** A signed URL, valid briefly.
 *
 *  The bucket is private, so nothing is reachable without one — and a
 *  short expiry means a link forwarded by accident stops working. */
export async function fileUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from('business-files').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function recordFile(
  areaId: number,
  name: string,
  storagePath: string,
  details: Record<string, unknown> = {}
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('business_files').insert({
    area_id: areaId,
    name: name.trim(),
    storage_path: storagePath,
    ...details,
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business/files');
  return { ok: true, id: data.id };
}

/** Records something held elsewhere.
 *
 *  Not everything should be uploaded. A shared drive folder or a Figma
 *  file belongs where it is — what matters is that somebody looking for
 *  it can find out where that is. */
export async function recordLink(
  areaId: number, name: string, url: string, description?: string
): Promise<Result> {
  if (!/^https?:\/\//i.test(url.trim())) {
    return { ok: false, error: 'That needs to be a full web address.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('business_files').insert({
    area_id: areaId, name: name.trim(), external_url: url.trim(),
    description: description?.trim() || null, file_kind: 'Link',
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business/files');
  return { ok: true, message: 'Recorded.' };
}

const EDITABLE = new Set([
  'name', 'description', 'version_label', 'document_date', 'expires_on',
  'tags', 'notes', 'min_rank', 'area_id', 'is_current', 'venue_id', 'external_url',
]);

export async function saveFile(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!EDITABLE.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('business_files')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business/files');
  return { ok: true };
}

/** Marks a file superseded rather than deleting it.
 *
 *  The old version stays findable, which is the whole reason for a
 *  version field. */
export async function supersedeFile(
  oldId: number, newId: number
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('business_files')
    .update({ is_current: false }).eq('id', oldId);
  if (error) return { ok: false, error: error.message };
  await supabase.from('business_files')
    .update({ supersedes_id: oldId }).eq('id', newId);
  revalidatePath('/business/files');
  return { ok: true, message: 'Superseded. The old one is still there.' };
}

export async function removeFile(id: number): Promise<Result> {
  const supabase = await createClient();
  const { data: f } = await supabase.from('business_files')
    .select('storage_path').eq('id', id).single();

  if (f?.storage_path) {
    await supabase.storage.from('business-files').remove([f.storage_path]);
  }
  const { error } = await supabase.from('business_files').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business/files');
  return { ok: true, message: 'Removed.' };
}

export async function addArea(
  name: string, parentId: number | null, minRank = 30
): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'A name is needed.' };
  const supabase = await createClient();
  const slug = name.trim().toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').slice(0, 50);

  const { error } = await supabase.from('file_areas').insert({
    name: name.trim(), slug, parent_id: parentId, min_rank: minRank,
    display_order: 999,
  });
  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'An area with that name exists.' : error.message };
  }
  revalidatePath('/business/files');
  return { ok: true };
}
