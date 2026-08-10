'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

/** Brands, with how many locations are actually in the portal.
 *
 *  The gap between what a brand says it has and what exists is the useful
 *  number — 1 Hotels has fifteen properties and one venue record, and
 *  nothing said so. */
export async function brands() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('venue_brands')
    .select('*, venues(id)')
    .order('name');

  return (data ?? []).map((b: any) => ({
    ...b,
    in_portal: (b.venues ?? []).length,
    missing: b.location_count ? b.location_count - (b.venues ?? []).length : null,
  }));
}

export async function brand(id: number) {
  const supabase = await createClient();

  const { data: b } = await supabase.from('venue_brands')
    .select('*').eq('id', id).maybeSingle();
  if (!b) return null;

  const { data: locations } = await supabase.from('venues')
    .select('id,venue_name,venue_status,website_url,logo_url,'
          + 'cities(name), countries(name)')
    .eq('brand_id', id)
    .is('archived_at', null)
    .order('venue_name');

  // Spaces this brand runs inside somebody else's venue — the Bamford
  // case, where the brand owns nothing and appears everywhere.
  const { data: operates } = await supabase.from('venue_spaces')
    .select('id,name,venues(id,venue_name,cities(name),countries(name))')
    .eq('operator_brand_id', id);

  return { ...b, locations: locations ?? [], operates: operates ?? [] };
}

const BRAND_COLUMNS = new Set([
  'name', 'slug', 'website_url', 'description', 'brand_kind',
  'standard_offering', 'brand_notes', 'location_count', 'is_expanding',
  'expansion_note', 'logo_url', 'primary_contact_email', 'primary_contact_phone',
  'head_office_country_id',
]);

export async function saveBrand(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!BRAND_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venue_brands')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/venues/brands');
  return { ok: true };
}

export async function addBrand(name: string, kind: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };
  const supabase = await createClient();

  const { data, error } = await supabase.from('venue_brands').insert({
    name: name.trim(),
    slug: name.trim().toLowerCase().replace(/&/g, 'and')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 60),
    brand_kind: kind,
  }).select('id').single();

  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'A brand with that name exists.' : error.message };
  }
  revalidatePath('/venues/brands');
  return { ok: true, id: data.id };
}

/** Creates a location under a brand.
 *
 *  Its own venue with its own everything — services, facilities, prices.
 *  A brand is what they share, not a thing they are part of. */
export async function addLocation(
  brandId: number, name: string, websiteUrl?: string
): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };
  const supabase = await createClient();

  const { data: b } = await supabase.from('venue_brands')
    .select('name').eq('id', brandId).single();

  const { data, error } = await supabase.from('venues').insert({
    venue_name: name.trim(),
    brand_id: brandId,
    website_url: websiteUrl?.trim() || null,
    venue_status: 'Sourced',
    created_via: 'Brand location',
    created_via_detail: `Added under ${b?.name ?? 'a brand'}`,
  }).select('id').single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/venues/brands');
  return {
    ok: true, id: data.id,
    message: `${name.trim()} created. Read its site to fill it in.`,
  };
}

export async function unlinkFromBrand(venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venues')
    .update({ brand_id: null }).eq('id', venueId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/venues/brands');
  return { ok: true, message: 'Unlinked. The venue is untouched.' };
}

/** Everything a brand offers, worked out across its locations.
 *
 *  Computed rather than kept. The moment one location adds a treatment a
 *  stored list is wrong and nothing says so. */
export async function brandServices(brandId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('brand_services')
    .select('*').eq('brand_id', brandId)
    .order('at_how_many_locations', { ascending: false })
    .order('service');
  return data ?? [];
}

export async function brandFacilities(brandId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('brand_facilities')
    .select('*').eq('brand_id', brandId)
    .order('at_how_many_locations', { ascending: false });
  return data ?? [];
}

export async function brandOverview(brandId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('brand_overview')
    .select('*').eq('id', brandId).maybeSingle();
  return data;
}

/** The other locations under the same brand.
 *
 *  For the switcher on a venue — somebody comparing Melbourne with Tokyo
 *  should not have to go out through a list to do it. */
export async function siblingLocations(venueId: number) {
  const supabase = await createClient();

  const { data: v } = await supabase.from('venues')
    .select('brand_id, venue_brands(id,name)').eq('id', venueId).maybeSingle();

  if (!v?.brand_id) return null;

  const { data: siblings } = await supabase.from('venues')
    .select('id,venue_name,cities(name),countries(name)')
    .eq('brand_id', v.brand_id)
    .is('archived_at', null)
    .order('venue_name');

  return {
    brand: (v.venue_brands as any),
    locations: siblings ?? [],
  };
}

/** Turns a whole chain off, or back on.
 *
 *  One act rather than fifteen. When a chain leaves, fifteen separate
 *  switches means one gets missed — and a listing that should have gone
 *  is worse than one that never appeared. */
export async function setBrandListings(
  brandId: number, allowed: boolean, reason?: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_brands').update({
    listings_allowed: allowed,
    listings_paused_reason: allowed ? null : (reason?.trim() || null),
    listings_paused_at: allowed ? null : new Date().toISOString(),
  }).eq('id', brandId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/venues/brands');
  return {
    ok: true,
    message: allowed
      ? 'Listings allowed again. Each location still decides for itself.'
      : 'Every location withheld. Their own settings are untouched.',
  };
}

/** Every location under a brand, and where each is listed. */
export async function listingGrid(brandId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('brand_listing_grid')
    .select('*').eq('brand_id', brandId)
    .order('venue_name').order('marketplace');
  return data ?? [];
}

/** Switches one location on or off for one marketplace. */
export async function switchListing(
  venueId: number, marketplace: string, published: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_listing', {
    p_venue_id: venueId, p_marketplace: marketplace, p_published: published,
  });
  if (error) {
    return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, '').trim() };
  }
  revalidatePath('/venues/brands');
  return { ok: true };
}

/** Venues that look like they belong to a brand but are not linked.
 *
 *  Matched on the name, since most of these have no website recorded.
 *  Nothing is linked without somebody agreeing — a wrong adoption is
 *  harder to unpick than a missing one. */
export async function candidatesFor(brandId: number) {
  const supabase = await createClient();

  const { data: b } = await supabase.from('venue_brands')
    .select('name').eq('id', brandId).single();
  if (!b) return [];

  const { data } = await supabase.rpc('venues_matching_brand', {
    p_brand_name: b.name, p_limit: 120,
  });

  return (data ?? []).filter((r: any) => !r.already_branded && r.score > 0.15);
}

export async function adoptVenues(
  brandId: number, venueIds: number[]
): Promise<Result> {
  if (!venueIds.length) return { ok: true, message: 'Nothing chosen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('adopt_into_brand', {
    p_brand_id: brandId, p_venue_ids: venueIds,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/venues/brands');
  return {
    ok: true,
    message: `${data ?? 0} taken into the brand. Each keeps its own record.`,
  };
}

/** Everything wrong across a brand's records, in one list.
 *
 *  Not linked, duplicated, wrong country, no website. Looked at together
 *  because they compound — a duplicate with no website is two records
 *  neither of which will ever be filled in. */
export async function tidyFor(brandName: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('brand_tidy', { p_brand_name: brandName });
  return data ?? [];
}

/** Fixes a country from what the name says. */
export async function correctCountry(
  venueId: number, countryName: string
): Promise<Result> {
  const supabase = await createClient();
  const { data: c } = await supabase.from('countries')
    .select('id').ilike('name', countryName).limit(1).maybeSingle();

  if (!c) return { ok: false, error: `No country called ${countryName}.` };

  // The city belonged to the old country and will not fit the new one.
  const { error } = await supabase.from('venues')
    .update({ country_id: c.id, city_id: null, state_id: null })
    .eq('id', venueId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/venues/brands');
  return { ok: true, message: 'Corrected. The city was cleared, since it belonged elsewhere.' };
}

/** Sets a location's own page, so a read has something to read. */
export async function setWebsite(venueId: number, url: string): Promise<Result> {
  const clean = url.trim();
  if (clean && !/^https?:\/\//i.test(clean)) {
    return { ok: false, error: 'That needs to be a full web address.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venues')
    .update({ website_url: clean || null }).eq('id', venueId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/venues/brands');
  return { ok: true };
}
