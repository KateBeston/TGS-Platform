'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; url?: string } | { ok: false; error: string };

const BUCKET = 'venue-media';

const MEDIA_COLUMNS = new Set([
  'alt_text','caption','media_category','placement_id','tab','space_id','room_type_id',
  'is_primary','display_order','credit','is_approved','notes','media_type',
  'video_type','video_platform','duration_seconds','url','focal_x','focal_y',
]);

function humanise(m: string) {
  if (/exceeded the maximum allowed size/i.test(m))
    return 'That file is over the 20 MB limit. Resize it and try again.';
  if (/mime type.*not supported/i.test(m))
    return 'That file type is not accepted. Use JPEG, PNG, WebP, AVIF, SVG, PDF or MP4.';
  if (/duplicate/i.test(m)) return 'A file with that name already exists for this venue.';
  return m;
}

export async function saveMediaField(
  mediaId: number, venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!MEDIA_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a media item.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venue_media').update({ [column]: value }).eq('id', mediaId);
  if (error) return { ok: false, error: humanise(error.message) };
  return { ok: true };
}

/** Uploads to storage and records the row. The file goes to a path keyed by
 *  venue so everything for one property stays together and can be removed
 *  in one action if that venue ever leaves. */
export async function uploadMedia(formData: FormData): Promise<Result> {
  const venueId = Number(formData.get('venue_id'));
  const placementId = formData.get('placement_id')
    ? Number(formData.get('placement_id')) : null;
  const file = formData.get('file') as File | null;

  if (!venueId || !file || !file.size) return { ok: false, error: 'No file received.' };

  const supabase = await createClient();

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60);
  const path = `${venueId}/${Date.now()}-${safe}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: humanise(upErr.message) };

  const isVideo = file.type.startsWith('video/');
  const isDoc = file.type === 'application/pdf';

  // The bucket is private, so getPublicUrl would return an address that
  // 403s. The storage path is the canonical reference; signed URLs are
  // generated at display time and expire.
  const publicRef = `${BUCKET}/${path}`;

  // The hero placement holds exactly one image, so an upload there is by
  // definition the hero. Setting it here saves a second click and keeps
  // venues.primary_image_url in step.
  let makeHero = false;
  if (placementId) {
    const { data: pl } = await supabase
      .from('media_placements').select('placement_key').eq('id', placementId).single();
    makeHero = pl?.placement_key === 'hero_primary';
  }

  const { error: rowErr } = await supabase.from('venue_media').insert({
    venue_id: venueId,
    placement_id: placementId,
    media_type: isVideo ? 'video' : isDoc ? 'document' : 'image',
    url: publicRef,
    storage_path: path,
    file_size_bytes: file.size,
    alt_text: null,
    is_approved: false,
  });

  if (rowErr) {
    // Do not leave an orphan file in the bucket if the row fails.
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: humanise(rowErr.message) };
  }

  if (makeHero) {
    await supabase.from('venue_media').update({ is_primary: false })
      .eq('venue_id', venueId).neq('storage_path', path);
    await supabase.from('venue_media').update({ is_primary: true }).eq('storage_path', path);
    await supabase.from('venues').update({ primary_image_url: publicRef }).eq('id', venueId);
  }

  revalidatePath(`/venues/${venueId}/media`);
  return { ok: true, message: `${file.name} uploaded.` };
}

/** Records an externally hosted image without uploading anything. Useful
 *  for images the venue already publishes on its own site. */
export async function addMediaByUrl(
  venueId: number, url: string, placementId: number | null
): Promise<Result> {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) return { ok: false, error: 'That is not a usable URL.' };

  const supabase = await createClient();
  const { error } = await supabase.from('venue_media').insert({
    venue_id: venueId,
    placement_id: placementId,
    media_type: /\.(mp4|mov|webm)$/i.test(clean) ? 'video'
      : /\.pdf$/i.test(clean) ? 'document' : 'image',
    url: clean,
    is_approved: false,
  });

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/media`);
  return { ok: true, message: 'Added.' };
}

export async function deleteMedia(mediaId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('venue_media').select('storage_path').eq('id', mediaId).single();

  const { error } = await supabase.from('venue_media').delete().eq('id', mediaId);
  if (error) return { ok: false, error: humanise(error.message) };

  // Remove the file too, or the bucket fills with orphans nobody can see.
  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }

  revalidatePath(`/venues/${venueId}/media`);
  return { ok: true };
}

/** Exactly one primary per venue — the hero. Setting a new one clears the
 *  old rather than leaving two records both claiming to be first. */
export async function setPrimary(mediaId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  await supabase.from('venue_media').update({ is_primary: false }).eq('venue_id', venueId);
  const { error } = await supabase.from('venue_media')
    .update({ is_primary: true }).eq('id', mediaId);
  if (error) return { ok: false, error: humanise(error.message) };

  // Keep the convenience column on venues in step.
  const { data: row } = await supabase
    .from('venue_media').select('url').eq('id', mediaId).single();
  if (row) await supabase.from('venues').update({ primary_image_url: row.url }).eq('id', venueId);

  revalidatePath(`/venues/${venueId}/media`);
  return { ok: true };
}

export async function assignPlacement(
  mediaId: number, venueId: number, placementId: number | null
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_media')
    .update({ placement_id: placementId }).eq('id', mediaId);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/media`);
  return { ok: true };
}

/** Writes display_order from an array of ids. The whole slot is rewritten
 *  in one call rather than nudging one row at a time, so the order can
 *  never end up with gaps or duplicates after a failed move. */
export async function reorderMedia(
  venueId: number, orderedIds: number[]
): Promise<Result> {
  if (!orderedIds.length) return { ok: true };

  const supabase = await createClient();

  // Sequential rather than parallel: a handful of rows, and parallel
  // updates on the same table can interleave and land out of order.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('venue_media')
      .update({ display_order: i + 1 })
      .eq('id', orderedIds[i])
      .eq('venue_id', venueId);          // scope guard
    if (error) return { ok: false, error: humanise(error.message) };
  }

  revalidatePath(`/venues/${venueId}/media`);
  return { ok: true };
}
