import { createClient } from '@/lib/supabase/server';
import type { Card } from '@/lib/venues';

// The venue "settings" taxonomy — the natural environment a venue sits in
// (coastal, forest, mountain, urban…), grouped by category. Venues are tagged
// via venue_setting_links. Carries editorial fields for the SEO pages.
export type Setting = {
  id: number; name: string; slug: string; category: string | null;
  tagline: string | null; description: string | null; intro: string | null;
  hero_image_url: string | null; meta_title: string | null; meta_description: string | null;
  display_order: number | null;
};

const COLS = 'id,name,slug,category,tagline,description,intro,hero_image_url,meta_title,meta_description,display_order';

export async function settings() {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_settings').select(COLS)
    .eq('is_published', true)
    .order('display_order', { nullsFirst: false }).order('name');
  return (data ?? []) as Setting[];
}

export async function settingBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_settings').select(COLS)
    .eq('is_published', true).eq('slug', slug).maybeSingle();
  return (data ?? null) as Setting | null;
}

export async function venuesForSetting(settingId: number) {
  const supabase = await createClient();
  const { data: links } = await supabase.from('venue_setting_links_public')
    .select('venue_id').eq('setting_id', settingId);
  const ids = [...new Set((links ?? []).map((l: { venue_id: number }) => l.venue_id))];
  if (!ids.length) return [] as Card[];
  const { data } = await supabase.from('venue_cards').select('*').in('id', ids);
  return (data ?? []) as Card[];
}

const CAT_ORDER = ['Water', 'Landscape', 'Climate', 'Density', 'Character'];

export function groupByCategory(list: Setting[]) {
  const groups: Record<string, Setting[]> = {};
  for (const s of list) { const c = s.category ?? 'Other'; (groups[c] ||= []).push(s); }
  const ordered = [...CAT_ORDER, ...Object.keys(groups).filter((c) => !CAT_ORDER.includes(c))];
  return ordered.filter((c) => groups[c]).map((c) => ({ category: c, items: groups[c] }));
}
