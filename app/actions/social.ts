'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

export async function accounts() {
  const supabase = await createClient();
  const { data } = await supabase.from('social_overview')
    .select('*').order('platform');
  return data ?? [];
}

export async function snapshots(accountId?: number) {
  const supabase = await createClient();
  let q = supabase.from('social_snapshots')
    .select('*, social_accounts(platform,handle)')
    .order('taken_on', { ascending: false }).limit(120);
  if (accountId) q = q.eq('account_id', accountId);
  const { data } = await q;
  return data ?? [];
}

export async function posts(status?: string) {
  const supabase = await createClient();
  let q = supabase.from('social_posts')
    .select('*, social_accounts(platform,handle), venues(id,venue_name)')
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data } = await q;
  return data ?? [];
}

/** A month's figures, entered by hand.
 *
 *  No API connections, which sounds like a weakness and mostly is not —
 *  a monthly snapshot answers "is this growing" perfectly well, and an
 *  integration that breaks silently answers it worse. */
export async function recordSnapshot(
  accountId: number, takenOn: string, figures: Record<string, number | null>
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('social_snapshots').upsert({
    account_id: accountId,
    taken_on: takenOn,
    ...figures,
  }, { onConflict: 'account_id,taken_on' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing/social');
  return { ok: true, message: 'Recorded.' };
}

export async function addPost(
  title: string, accountIds: number[], category?: string
): Promise<Result> {
  if (!title.trim()) return { ok: false, error: 'A title is needed.' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('social_posts').insert({
    title: title.trim(),
    account_id: accountIds[0] ?? null,
    posts_to: accountIds.length > 1 ? accountIds : null,
    category: category || null,
    status: 'Idea',
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing/social');
  return { ok: true, id: data.id };
}

const POST_COLUMNS = new Set([
  'title', 'caption', 'hashtags', 'asset_note', 'asset_url', 'link_url',
  'category', 'status', 'scheduled_for', 'published_at', 'published_url',
  'venue_id', 'likes', 'comments', 'shares', 'saves', 'reach', 'account_id',
]);

export async function savePost(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!POST_COLUMNS.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();

  const patch: Record<string, unknown> = { [column]: value };
  // Publishing stamps the time, so "when did we post about them" has an
  // answer without anybody remembering.
  if (column === 'status' && value === 'Published') {
    patch.published_at = new Date().toISOString();
  }

  const { error } = await supabase.from('social_posts').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing/social');
  return { ok: true };
}

export async function removePost(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('social_posts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing/social');
  return { ok: true };
}

const ACCOUNT_COLUMNS = new Set([
  'handle', 'profile_url', 'purpose', 'audience', 'content_focus',
  'posting_rhythm', 'status', 'notes', 'is_verified', 'managed_by',
]);

export async function saveAccount(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!ACCOUNT_COLUMNS.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('social_accounts')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing/social');
  return { ok: true };
}

/** Venues that have never been posted about.
 *
 *  The useful question, and the one nobody can answer from memory once
 *  there are more than about twenty. */
export async function venuesNotFeatured(limit = 20) {
  const supabase = await createClient();
  const { data: featured } = await supabase.from('social_posts')
    .select('venue_id').not('venue_id', 'is', null).eq('status', 'Published');
  const done = new Set((featured ?? []).map((f: any) => f.venue_id));

  const { data } = await supabase.from('venues')
    .select('id,venue_name,primary_image_url,venue_status')
    .eq('venue_status', 'Published')
    .limit(200);

  return (data ?? []).filter((v: any) => !done.has(v.id)).slice(0, limit);
}
