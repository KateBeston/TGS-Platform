import { createClient } from '@/lib/supabase/server';
import type { Card } from '@/lib/venues';

// Retreat "styles" are the shared category spine filtered to in_retreat — the same
// modality_categories the venues are tagged against (venue_categories). Carries the
// editorial SEO fields (h1, intro, hero_image_url) so the pages read as invitations.
export type RetreatStyle = {
  id: number; name: string; slug: string; description: string | null;
  h1: string | null; intro: string | null; hero_image_url: string | null;
  meta_title: string | null; meta_description: string | null;
  venue_count: number | null; display_order: number | null;
};

export async function retreatStyles() {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_categories')
    .select('id,name,slug,description,h1,intro,hero_image_url,meta_title,meta_description,venue_count,display_order')
    .eq('in_retreat', true)
    .order('display_order', { nullsFirst: false }).order('name');
  return (data ?? []) as RetreatStyle[];
}

export async function styleBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_categories')
    .select('id,name,slug,description,h1,intro,hero_image_url,meta_title,meta_description,venue_count,display_order')
    .eq('in_retreat', true).eq('slug', slug).maybeSingle();
  return (data ?? null) as RetreatStyle | null;
}

export async function venuesForStyle(categoryId: number) {
  const supabase = await createClient();
  const { data: links } = await supabase.from('venue_categories_public')
    .select('venue_id').eq('category_id', categoryId);
  const venueIds = (links ?? []).map((l: { venue_id: number }) => l.venue_id);
  if (!venueIds.length) return [] as Card[];
  const { data } = await supabase.from('venue_cards').select('*').in('id', venueIds);
  return (data ?? []) as Card[];
}
