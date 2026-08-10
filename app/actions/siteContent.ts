'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result =
  | { ok: true; id?: number; message?: string }
  | { ok: false; error: string };

/* ═══════════════════════════════════════════════════════════════════════
   PLATFORM SITE — categories, practices and their editorial content

   The taxonomy lives on the shared modality spine (modality_categories,
   modality_practices). The public site reads it through the experience_*
   views and filters on is_published.

   Status is the lifecycle control: active / inactive / draft / archived.
   Only "active" is public, so is_published is kept in step with it
   (is_published = status === 'active'). Slugs lock once active.

   "Shown in" writes the two flags (in_wellness, in_retreat) from a single
   choice, on categories and practices independently.
   ═══════════════════════════════════════════════════════════════════════ */

const CATEGORY_COLUMNS = new Set([
  'name', 'slug', 'tagline', 'description', 'intro', 'hero_image_url',
  'meta_title', 'meta_description', 'h1', 'display_order',
]);
const PRACTICE_COLUMNS = new Set([
  'name', 'slug', 'tagline', 'description', 'intro', 'hero_image_url',
  'meta_title', 'meta_description', 'h1', 'at_a_glance', 'display_order',
]);

const STATUSES = ['active', 'inactive', 'draft', 'archived'] as const;

function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shownInToFlags(value: string) {
  return {
    in_wellness: value === 'wellness' || value === 'both',
    in_retreat: value === 'retreat' || value === 'both',
  };
}

/* ── reads ─────────────────────────────────────────────────────────── */

export async function listCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_categories')
    .select('id,name,slug,tagline,status,in_wellness,in_retreat,display_order')
    .order('display_order', { nullsFirst: false }).order('name');
  return data ?? [];
}

export async function practiceCountsByCategory() {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_practices').select('category_id');
  const map = new Map<number, number>();
  for (const r of (data ?? []) as any[]) {
    map.set(r.category_id, (map.get(r.category_id) ?? 0) + 1);
  }
  return map;
}

export async function listAllPractices() {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_practices')
    .select('id,name,slug,status,in_wellness,in_retreat,category_id,display_order')
    .order('display_order', { nullsFirst: false }).order('name');
  return data ?? [];
}

export async function getCategory(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_categories')
    .select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

export async function practicesInCategory(categoryId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_practices')
    .select('id,name,slug,tagline,status,in_wellness,in_retreat,display_order')
    .eq('category_id', categoryId)
    .order('display_order', { nullsFirst: false }).order('name');
  return data ?? [];
}

export async function getPractice(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('modality_practices')
    .select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

/* ── field saves ───────────────────────────────────────────────────── */

function resolveUpdate(column: string, value: unknown, allow: Set<string>) {
  if (column === 'shown_in') return shownInToFlags(String(value));
  if (column === 'status') {
    const s = String(value);
    if (!STATUSES.includes(s as any)) return null;
    return { status: s, is_published: s === 'active' };
  }
  if (!allow.has(column)) return null;
  return { [column]: value };
}

export async function saveCategory(
  id: number, column: string, value: unknown,
): Promise<Result> {
  const patch = resolveUpdate(column, value, CATEGORY_COLUMNS);
  if (!patch) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('modality_categories').update(patch).eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/site');
  revalidatePath(`/site/categories/${id}`);
  return { ok: true };
}

export async function savePractice(
  id: number, column: string, value: unknown,
): Promise<Result> {
  const patch = resolveUpdate(column, value, PRACTICE_COLUMNS);
  if (!patch) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('modality_practices').update(patch).eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/site');
  revalidatePath(`/site/practices/${id}`);
  return { ok: true };
}

/* ── create ────────────────────────────────────────────────────────── */

export async function addCategory(name: string, shownIn = 'wellness'): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };
  const supabase = await createClient();
  const { data: top } = await supabase.from('modality_categories')
    .select('display_order').order('display_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('modality_categories').insert({
    name: name.trim(), slug: slugify(name),
    ...shownInToFlags(shownIn),
    status: 'draft', is_published: false,
    display_order: ((top?.display_order as number) ?? 0) + 1,
  }).select('id').single();
  if (error) return { ok: false, error: dupSlug(error.message) };
  revalidatePath('/site');
  return { ok: true, id: data.id as number };
}

export async function addPractice(
  categoryId: number, name: string, shownIn = 'wellness',
): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };
  const supabase = await createClient();
  const { data: top } = await supabase.from('modality_practices')
    .select('display_order').eq('category_id', categoryId)
    .order('display_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('modality_practices').insert({
    name: name.trim(), slug: slugify(name), category_id: categoryId,
    ...shownInToFlags(shownIn),
    status: 'draft', is_published: false,
    display_order: ((top?.display_order as number) ?? 0) + 1,
  }).select('id').single();
  if (error) return { ok: false, error: dupSlug(error.message) };
  revalidatePath('/site');
  revalidatePath(`/site/categories/${categoryId}`);
  return { ok: true, id: data.id as number };
}

/* ── delete (guarded — archive is the usual path) ──────────────────── */

export async function deletePractice(id: number): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase.from('venue_practices')
    .select('*', { count: 'exact', head: true }).eq('practice_id', id);
  if (count && count > 0) {
    return { ok: false, error: `${count} venue${count === 1 ? '' : 's'} still offer this. Set it to Redundant / Archived instead of deleting.` };
  }
  const { error } = await supabase.from('modality_practices').delete().eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/site');
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<Result> {
  const supabase = await createClient();
  const [{ count: practices }, { count: venues }] = await Promise.all([
    supabase.from('modality_practices').select('*', { count: 'exact', head: true }).eq('category_id', id),
    supabase.from('venue_categories').select('*', { count: 'exact', head: true }).eq('category_id', id),
  ]);
  if (practices && practices > 0) {
    return { ok: false, error: `This category still has ${practices} practice${practices === 1 ? '' : 's'}. Move or delete them first, or archive the category.` };
  }
  if (venues && venues > 0) {
    return { ok: false, error: `${venues} venue${venues === 1 ? '' : 's'} are tagged with this category. Archive it instead of deleting.` };
  }
  const { error } = await supabase.from('modality_categories').delete().eq('id', id);
  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath('/site');
  return { ok: true };
}

/* ── helpers ───────────────────────────────────────────────────────── */

function humanise(m: string) {
  if (/slug/i.test(m) && /publish/i.test(m)) {
    return 'A live page keeps its address. Set status away from Active first to change the slug.';
  }
  return m;
}
function dupSlug(m: string) {
  if (/duplicate|unique/i.test(m)) return 'That name makes a slug that already exists. Try a different name, or rename after creating.';
  return humanise(m);
}
