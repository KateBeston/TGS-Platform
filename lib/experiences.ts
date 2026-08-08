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
};

export type Practice = {
  id: number; name: string; slug: string; description: string | null;
  category_id: number; category_slug: string; category: string;
  display_order: number | null; venue_count: number;
};

export async function categories() {
  const supabase = await createClient();
  const { data } = await supabase.from('experience_categories')
    .select('*').order('display_order', { nullsFirst: false }).order('name');
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
  const { data } = await supabase.from('experience_categories')
    .select('*').eq('slug', slug).maybeSingle();
  return (data ?? null) as Category | null;
}

export async function practiceBySlug(categorySlug: string, slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('experience_practices')
    .select('*').eq('category_slug', categorySlug).eq('slug', slug).maybeSingle();
  return (data ?? null) as Practice | null;
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
