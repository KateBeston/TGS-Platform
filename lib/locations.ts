import { createClient } from '@/lib/supabase/server';

/* Resolving a location path against the geography tables.
 *
 * A path under a marketplace is one of:
 *   [continent]                          → continent
 *   [continent, country]                 → country
 *   [continent, country, state]          → state
 *   [continent, country, state, city]    → city
 *
 * Every level is validated against its parent, so /asia/thailand is only a
 * page if Thailand is genuinely in Asia and both are published. A path that
 * does not resolve is not a location (the caller then tries a venue slug, or
 * 404s). Live URLs never change, so this is deliberately strict. */

export type LocRow = {
  id: number; name: string; slug: string;
  meta_title: string | null; meta_description: string | null;
  h1: string | null; intro: string | null; hero_image_url: string | null;
};
export type LocLevel = 'continent' | 'country' | 'state' | 'city';
export type Resolved = {
  level: LocLevel;
  continent: LocRow; country?: LocRow; state?: LocRow; city?: LocRow;
  row: LocRow;                 // the deepest level's row
  filter: { continent?: string; country?: string; state?: string; city?: string };
};

const COLS = 'id, name, slug, meta_title, meta_description, h1, intro, hero_image_url';

let _continentSlugs: Set<string> | null = null;
export async function continentSlugs(): Promise<Set<string>> {
  if (_continentSlugs) return _continentSlugs;
  const s = await createClient();
  const { data } = await s.from('continents').select('slug').eq('is_published', true);
  _continentSlugs = new Set((data ?? []).map((r: any) => r.slug as string));
  return _continentSlugs;
}

export async function resolveLocation(path: string[]): Promise<Resolved | null> {
  if (path.length === 0 || path.length > 4) return null;
  const s = await createClient();

  const continent = await one(s, 'continents', { slug: path[0] });
  if (!continent) return null;
  if (path.length === 1) {
    return { level: 'continent', continent, row: continent, filter: { continent: continent.slug } };
  }

  const country = await one(s, 'countries', { slug: path[1], continent_id: continent.id });
  if (!country) return null;
  if (path.length === 2) {
    return { level: 'country', continent, country, row: country, filter: { country: country.slug } };
  }

  const state = await one(s, 'states', { slug: path[2], country_id: country.id });
  if (!state) return null;
  if (path.length === 3) {
    return { level: 'state', continent, country, state, row: state, filter: { state: state.slug } };
  }

  const city = await one(s, 'cities', { slug: path[3], state_id: state.id });
  if (!city) return null;
  return { level: 'city', continent, country, state, city, row: city, filter: { city: city.slug } };
}

async function one(s: any, table: string, match: Record<string, any>): Promise<LocRow | null> {
  const { data } = await s.from(table).select(COLS).match({ ...match, is_published: true }).maybeSingle();
  return (data as LocRow) ?? null;
}

/* Published children of a place that actually have venues, for the browse
 * lists. filter_counts holds a venue tally per location slug. */
export async function locationChildren(
  r: Resolved,
): Promise<{ label: string; items: { name: string; slug: string; count: number; href: string }[] }> {
  const s = await createClient();
  const counts = await venueCounts(s);
  const base = ''; // href prefix is added by the caller (marketplace-aware)

  if (r.level === 'continent') {
    const { data } = await s.from('countries').select('name, slug')
      .eq('continent_id', r.continent.id).eq('is_published', true).order('display_order', { nullsFirst: false });
    return {
      label: 'Countries',
      items: (data ?? []).map((c: any) => ({
        name: c.name, slug: c.slug, count: counts.get(`country:${c.slug}`) ?? 0,
        href: `${base}/${r.continent.slug}/${c.slug}`,
      })).filter((c: any) => c.count > 0),
    };
  }
  if (r.level === 'country') {
    const { data } = await s.from('states').select('name, slug')
      .eq('country_id', r.country!.id).eq('is_published', true).order('display_order', { nullsFirst: false });
    return {
      label: 'Regions',
      items: (data ?? []).map((st: any) => ({
        name: st.name, slug: st.slug, count: counts.get(`state:${st.slug}`) ?? 0,
        href: `${base}/${r.continent.slug}/${r.country!.slug}/${st.slug}`,
      })).filter((c: any) => c.count > 0),
    };
  }
  if (r.level === 'state') {
    const { data } = await s.from('cities').select('name, slug')
      .eq('state_id', r.state!.id).eq('is_published', true).order('display_order', { nullsFirst: false });
    return {
      label: 'Cities',
      items: (data ?? []).map((ci: any) => ({
        name: ci.name, slug: ci.slug, count: counts.get(`city:${ci.slug}`) ?? 0,
        href: `${base}/${r.continent.slug}/${r.country!.slug}/${r.state!.slug}/${ci.slug}`,
      })).filter((c: any) => c.count > 0),
    };
  }
  return { label: '', items: [] };
}

async function venueCounts(s: any): Promise<Map<string, number>> {
  const { data } = await s.from('filter_counts').select('kind, slug, venues');
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(`${(r as any).kind}:${(r as any).slug}`, Number((r as any).venues) || 0);
  return m;
}
