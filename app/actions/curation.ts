'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

function humanise(m: string) {
  if (/venue_related_venue_id_related_venue_id_key|unique/i.test(m))
    return 'That venue is already related.';
  if (/venue_id <> related_venue_id|check constraint/i.test(m))
    return 'A venue cannot be related to itself.';
  if (/duplicate key.*slug/i.test(m)) return 'That slug is already in use.';
  return m;
}

/* ── related venues ──────────────────────────────────────────────── */

export async function addRelated(
  venueId: number, relatedId: number, relationship: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_related')
    .insert({ venue_id: venueId, related_venue_id: relatedId, relationship });
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/related`);
  return { ok: true };
}

export async function removeRelated(rowId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_related').delete().eq('id', rowId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/related`);
  return { ok: true };
}

export async function reorderRelated(venueId: number, orderedIds: number[]): Promise<Result> {
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('venue_related')
      .update({ display_order: i + 1 }).eq('id', orderedIds[i]).eq('venue_id', venueId);
    if (error) return { ok: false, error: humanise(error.message) };
  }
  revalidatePath(`/venues/${venueId}/related`);
  return { ok: true };
}

/* ── reviews ─────────────────────────────────────────────────────── */

const REVIEW_COLUMNS = new Set([
  'reviewer_name','reviewer_context','rating_overall','rating_communication',
  'rating_spaces','rating_amenities','rating_location','rating_value',
  'title','body','is_verified','is_published','stayed_at','response_body',
]);

export async function addReview(venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('reviews')
    .insert({ venue_id: venueId, is_published: false, is_verified: false })
    .select('id').single();
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/reviews`);
  return { ok: true, id: data.id };
}

export async function saveReviewField(
  reviewId: number, venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!REVIEW_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a review.` };
  }
  const supabase = await createClient();

  // Recording a venue response stamps the time, so "responded" and "when"
  // can never disagree.
  const extra = column === 'response_body' && value
    ? { responded_at: new Date().toISOString() } : {};

  const { error } = await supabase.from('reviews')
    .update({ [column]: value, ...extra }).eq('id', reviewId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/reviews`);
  return { ok: true };
}

export async function deleteReview(reviewId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/reviews`);
  return { ok: true };
}

/* ── collections ─────────────────────────────────────────────────── */

const COLLECTION_COLUMNS = new Set([
  'name','slug','tagline','description','hero_image_url','meta_title',
  'meta_description','intro','marketplace','is_featured','is_published','display_order',
]);

export async function createCollection(name: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'A name is required.' };

  const slug = trimmed.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

  const supabase = await createClient();
  const { data, error } = await supabase.from('collections')
    .insert({ name: trimmed, slug }).select('id').single();
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/collections');
  return { ok: true, id: data.id };
}

export async function saveCollectionField(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!COLLECTION_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a collection.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('collections').update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/collections');
  revalidatePath(`/collections/${id}`);
  return { ok: true };
}

export async function toggleCollectionVenue(
  collectionId: number, venueId: number, on: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from('collection_venues')
        .upsert({ collection_id: collectionId, venue_id: venueId },
                { onConflict: 'collection_id,venue_id' })
    : await supabase.from('collection_venues')
        .delete().eq('collection_id', collectionId).eq('venue_id', venueId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/collections/${collectionId}`);
  return { ok: true };
}

export async function deleteCollection(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/collections');
  return { ok: true };
}

/** Venue search for the pickers. Deliberately server-side and limited —
 *  a client holding 5,886 venues to filter would be slower than asking. */
export async function searchVenues(q: string, excludeId?: number) {
  const supabase = await createClient();
  let query = supabase.from('venue_list')
    .select('id,venue_name,country_name,venue_type_name')
    .order('venue_name').limit(20);
  if (q.trim()) query = query.ilike('venue_name', `%${q.trim()}%`);
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query;
  return data ?? [];
}

/* ── similar venues, worked out ──────────────────────────────────── */

export type Kind = 'Nearby' | 'Like this' | 'Instead';

/** What would show on the listing, pinned first then calculated.
 *
 *  Three kinds, because "similar" is three questions. A guest looking at
 *  a bathhouse wants another bathhouse nearby. A retreat host whose dates
 *  failed wants the same capacity in the same region. Somebody who
 *  arrived searching for breathwork wants breathwork elsewhere. */
export async function alternatives(venueId: number, kind: Kind = 'Like this') {
  const supabase = await createClient();
  const { data } = await supabase.rpc('venue_alternatives', {
    p_venue_id: venueId, p_kind: kind, p_limit: 8,
  });
  return data ?? [];
}

/** Pins a suggestion, so it always shows and always first.
 *
 *  A deliberate pairing is a judgement and a score is not — two venues
 *  with the same owner, or one that takes the overflow every summer,
 *  are facts no scoring function can see. */
export async function pinAlternative(
  venueId: number, relatedId: number, reason?: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_related').insert({
    venue_id: venueId, related_venue_id: relatedId,
    is_pinned: true, relationship: 'Similar',
    reason: reason?.trim() || null,
  });
  if (error) return { ok: false as const, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/related`);
  return { ok: true as const, message: 'Pinned. It will always show first.' };
}

/** Records that two venues are NOT alternatives.
 *
 *  Without this the same wrong suggestion returns every time the page
 *  loads, and there is nowhere to say so. */
export async function excludeAlternative(
  venueId: number, relatedId: number, reason?: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_related').insert({
    venue_id: venueId, related_venue_id: relatedId,
    is_pinned: false, relationship: 'Not an alternative',
    reason: reason?.trim() || null,
  });
  if (error) return { ok: false as const, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/related`);
  return { ok: true as const, message: 'It will not be suggested again.' };
}
