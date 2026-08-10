'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; id?: number; message?: string } | { ok: false; error: string };

export async function docs(category?: string) {
  const supabase = await createClient();
  let q = supabase.from('internal_docs')
    .select('id,title,slug,category,summary,status,min_rank,is_confidential,'
      + 'reviewed_at,review_every_months,tags,updated_at')
    .neq('status', 'Archived')
    .order('category').order('title');
  if (category && category !== 'all') q = q.eq('category', category);
  const { data } = await q;
  return data ?? [];
}

export async function doc(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('internal_docs')
    .select('*').eq('slug', slug).maybeSingle();
  return data;
}

export async function docVersions(docId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('internal_doc_versions')
    .select('*').eq('doc_id', docId).order('version', { ascending: false }).limit(20);
  return data ?? [];
}

export async function createDoc(title: string, category: string): Promise<Result> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: 'A title is needed.' };

  const supabase = await createClient();
  const slug = trimmed.toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70);

  const { data, error } = await supabase.from('internal_docs').insert({
    title: trimmed, slug, category, status: 'Draft',
  }).select('id,slug').single();

  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'A document with that title already exists.' : error.message };
  }
  revalidatePath('/docs');
  return { ok: true, id: data.id, message: data.slug };
}

const EDITABLE = new Set([
  'title', 'summary', 'body', 'category', 'status', 'min_rank',
  'is_confidential', 'reviewed_at', 'review_every_months', 'owner_note', 'tags',
]);

export async function saveDoc(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!EDITABLE.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('internal_docs')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/docs');
  return { ok: true };
}

/** Marks a document as looked at today.
 *
 *  Documentation rots quietly. Nothing here stops that — a review date
 *  only makes the rot visible, which is the most any system can do. */
export async function markReviewed(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('internal_docs')
    .update({ reviewed_at: new Date().toISOString().slice(0, 10) }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/docs');
  return { ok: true, message: 'Marked as reviewed today.' };
}

export async function docsNeedingReview() {
  const supabase = await createClient();
  const { data } = await supabase.from('docs_needing_review').select('*');
  return data ?? [];
}
