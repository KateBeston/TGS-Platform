import { createClient } from '@/lib/supabase/server';
import type { Card } from '@/lib/venues';

/* The modality hubs.
 *
 * One indexable page per category and per practice, rather than filter
 * states behind a query string. At eighteen categories and a hundred and
 * fourteen practices that is a hundred and thirty-two pages, each able
 * to rank for what it is actually about.
 *
 * Everything is a real route. The accordion on the index navigates
 * rather than toggling state, so a category link works without
 * JavaScript, survives a refresh, and can be sent to somebody. */

export type Category = {
  id: number; name: string; slug: string; description: string | null;
  in_retreat: boolean; in_wellness: boolean; display_order: number | null;
  venue_count: number; practice_count: number;
  hero_image_url?: string | null; tagline?: string | null; intro?: string | null;
};

export type Practice = {
  id: number; name: string; slug: string; description: string | null;
  category_id: number; category_slug: string; category: string;
  display_order: number | null; venue_count: number;
  intro?: string | null; tagline?: string | null; hero_image_url?: string | null;
  meta_title?: string | null; meta_description?: string | null; h1?: string | null;
  at_a_glance?: { label: string; value: string }[] | null;
};

/* ── when a category or practice exists on the marketplace ──────────
 *
 * When a live venue offers it. Nothing else: no second publish step and
 * no flag to remember to set, because venue_count is already counted
 * through venue_practices_public and venue_categories_public, both of
 * which join published_venues. A venue going live therefore brings its
 * practices with it, and a venue coming down takes them back.
 *
 * Until now nothing gated these at all. is_published is a column the
 * experience_* views return rather than one they filter on, and every
 * one of the 153 practices is a draft, so all 153 had a live page —
 * 113 of them listing no venues, and 146 with no body copy. The
 * sitemap already used this exact rule, so the pages and the sitemap
 * disagreed about which of them existed.
 *
 * Deliberately not is_published. A practice nobody offers is an empty
 * page whether or not somebody remembered to tick it, and a practice
 * three live venues offer should not wait on a tick.
 */
function live<T>(query: T): T {
  return (query as any).gt('venue_count', 0) as T;
}

export async function categories() {
  const supabase = await createClient();
  const { data } = await live(supabase.from('experience_categories')
    .select('*')).order('display_order', { nullsFirst: false }).order('name');
  return (data ?? []) as Category[];
}

export async function practicesIn(categoryId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('experience_practices')
    .select('*').eq('category_id', categoryId)
    .order('display_order', { nullsFirst: false }).order('name');
  return (data ?? []) as Practice[];
}

export async function categoryBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await live(supabase.from('experience_categories')
    .select('*').eq('slug', slug)).maybeSingle();
  return (data ?? null) as Category | null;
}

export async function practiceBySlug(categorySlug: string, slug: string) {
  const supabase = await createClient();
  const { data } = await live(supabase.from('experience_practices')
    .select('*').eq('category_slug', categorySlug).eq('slug', slug)).maybeSingle();
  return (data ?? null) as Practice | null;
}

/** Every practice in a category that has a live venue, for the pills.
 *
 *  Used by the index grid and the home rail, where a pill is a link and
 *  "+4 more" counts what is behind it. Both counted all 153 before, so
 *  the number on the pill promised pages that turned out empty. */
export async function livePracticesByCategory() {
  const supabase = await createClient();
  const { data } = await live(supabase.from('experience_practices')
    .select('name,slug,category_slug,venue_count'))
    .order('display_order', { nullsFirst: false }).order('name');

  const byCategory = new Map<string, any[]>();
  for (const p of (data ?? []) as any[]) {
    const list = byCategory.get(p.category_slug) ?? [];
    list.push(p);
    byCategory.set(p.category_slug, list);
  }
  return byCategory;
}

/** Venues offering a category, or one practice within it. */
export async function venuesFor(
  { categoryId, practiceId }: { categoryId?: number; practiceId?: number }
) {
  const supabase = await createClient();

  const from = practiceId
    ? supabase.from('venue_practices_public').select('venue_id').eq('practice_id', practiceId)
    : supabase.from('venue_categories_public').select('venue_id').eq('category_id', categoryId!);

  const { data: ids } = await from;
  const venueIds = [...new Set((ids ?? []).map((r: any) => r.venue_id))];
  if (!venueIds.length) return [] as Card[];

  const { data } = await supabase.from('venue_cards')
    .select('*').in('id', venueIds)
    .order('tier_order').order('rating', { ascending: false, nullsFirst: false })
    .order('venue_name');

  return (data ?? []) as Card[];
}

/** The practices a venue offers, for the pills on a result card. */
export async function practicesOfVenues(venueIds: number[]) {
  if (!venueIds.length) return new Map<number, string[]>();
  const supabase = await createClient();
  const { data } = await supabase.from('venue_practices_public')
    .select('venue_id,name').in('venue_id', venueIds);

  const map = new Map<number, string[]>();
  for (const r of (data ?? []) as any[]) {
    const list = map.get(r.venue_id) ?? [];
    list.push(r.name);
    map.set(r.venue_id, list);
  }
  return map;
}

/** Per-venue service for a practice — powers the svc block on cards. */
export async function servicesForPractice(practiceId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_practices_public')
    .select('venue_id,service_name,service_duration_minutes,service_price,service_price_currency,service_description')
    .eq('practice_id', practiceId);
  const map = new Map<number, any>();
  for (const r of (data ?? []) as any[]) {
    if (r.service_name || r.service_description) map.set(r.venue_id, r);
  }
  return map;
}
