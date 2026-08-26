import { createClient } from '@/lib/supabase/server';

/* Reading bookable experiences for the public site — from the experience_cards
 * view only, never venue_services directly, so no internal field can leak. */

export type ExperienceCard = {
  id: number;
  slug: string | null;
  venue_id: number;
  name: string;
  description: string | null;
  price_includes: string | null;
  what_to_bring: string | null;
  duration_minutes: number | null;
  duration_options: string[] | null;
  base_price: number | null;
  currency: string | null;
  price_is_from: boolean | null;
  price_range_low: number | null;
  price_range_high: number | null;
  couples_available: boolean | null;
  available_in_room: boolean | null;
  in_room_surcharge: number | null;
  service_type: string | null;
  requires_time_slot: boolean | null;
  min_participants: number | null;
  max_participants: number | null;
  treatment_tags: string[] | null;
  expected_outcomes: string[] | null;
  is_featured: boolean | null;
  service_image_url: string | null;
  venue_image_url: string | null;
  category: string | null;
  category_slug: string | null;
  practice: string | null;
  practice_slug: string | null;
  venue_name: string | null;
  listing_slug: string | null;
  marketplace: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  country_slug: string | null;
  state_slug: string | null;
  city_slug: string | null;
  locality_slug: string | null;
  tier_order: number | null;
  is_test_record: boolean;
};

export function experienceImage(e: ExperienceCard): string | null {
  return e.service_image_url ?? e.venue_image_url;
}

export function experiencePlace(e: ExperienceCard): string {
  return [e.locality || e.city, e.country].filter(Boolean).join(', ');
}

export function experienceHref(e: ExperienceCard): string {
  return e.slug ? `/experiences/${e.slug}` : '#';
}

export async function listExperiences(filters: { category?: string; country?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from('experience_cards').select('*');
  if (filters.category) q = q.eq('category_slug', filters.category);
  if (filters.country) q = q.eq('country_slug', filters.country);
  const { data, error } = await q
    .order('is_featured', { ascending: false, nullsFirst: false })
    .order('tier_order', { ascending: true, nullsFirst: false })
    .order('display_order', { ascending: true, nullsFirst: false });
  return { experiences: (data ?? []) as ExperienceCard[], error };
}

export async function getExperience(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('experience_cards').select('*').eq('slug', slug).maybeSingle();
  return (data as ExperienceCard | null) ?? null;
}

/** Distinct categories present in the bookable set, for the filter row. */
export async function experienceCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from('experience_cards').select('category,category_slug');
  const seen = new Map<string, string>();
  for (const r of (data ?? []) as { category: string | null; category_slug: string | null }[]) {
    if (r.category && r.category_slug && !seen.has(r.category_slug)) seen.set(r.category_slug, r.category);
  }
  return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
}
