'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Editorial columns on venue_listings. The facts live on `venues`; this
 *  table is presentation only — how one venue appears in one marketplace.
 *  A venue in both marketplaces has two listings over one set of facts. */
const LISTING_COLUMNS = new Set([
  'headline','short_description','full_description','hero_image_url',
  'meta_title','meta_description','listing_status','is_published',
  'is_primary_listing','venue_type_id','display_order','marketplace','slug',
  'focus_keyword','website_display_title','social_share_image_url','canonical_override',
  'featured_from','featured_until','featured_rank','featured_reason',
]);

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function updateListingField(
  listingId: number,
  column: string,
  value: string | number | boolean | null
): Promise<SaveResult> {
  if (!LISTING_COLUMNS.has(column)) {
    return { ok: false, error: `Column "${column}" is not writable on a listing.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('venue_listings')
    .update({ [column]: value })
    .eq('id', listingId);

  if (error) {
    // protect_published_slug() raises when a slug changes while published.
    // Surface that plainly rather than as a database exception.
    if (/slug/i.test(error.message) && /publish/i.test(error.message)) {
      return {
        ok: false,
        error: 'Slug is locked while the listing is published. Unpublish first if the change is intended.',
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function createListing(
  venueId: number,
  marketplace: 'Retreat' | 'Wellness'
): Promise<SaveResult> {
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from('venues').select('venue_name,slug,venue_type_id').eq('id', venueId).single();

  const { error } = await supabase.from('venue_listings').insert({
    venue_id: venueId,
    marketplace,
    slug: venue?.slug ?? null,
    headline: venue?.venue_name ?? null,
    venue_type_id: venue?.venue_type_id ?? null,
    listing_status: 'Draft',
    is_published: false,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/listings');
  revalidatePath(`/venues/${venueId}/listings`);
  return { ok: true };
}
