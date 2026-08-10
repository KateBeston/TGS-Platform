'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; id?: number; message?: string } | { ok: false; error: string };

/* ── benchmarks ──────────────────────────────────────────────────── */

const BENCHMARK_COLUMNS = new Set([
  'rate_per_person', 'rate_basis', 'currency', 'typical_utilisation',
  'sample_size', 'confidence', 'source', 'notes', 'country_id',
]);

export async function saveBenchmark(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!BENCHMARK_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('space_revenue_benchmarks')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/property/benchmarks');
  return { ok: true };
}

export async function addBenchmark(
  usageId: number, countryId: number | null
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('space_revenue_benchmarks').insert({
    usage_id: usageId, country_id: countryId, currency: 'AUD',
    confidence: 'Assumption',
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/property/benchmarks');
  return { ok: true, id: data.id };
}

export async function removeBenchmark(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('space_revenue_benchmarks').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/property/benchmarks');
  return { ok: true };
}

/* ── comparables ─────────────────────────────────────────────────── */

/** Recorded when noticed, not when a valuation needs one.
 *
 *  Listings disappear. A comparable written down today is worth more than
 *  a search through old ones in three years, because by then the page is
 *  gone and the price with it. */
export async function addComparable(name: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'A name is needed.' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('property_comparables').insert({
    property_name: name.trim(), event_type: 'Listed', currency: 'AUD',
    event_date: new Date().toISOString().slice(0, 10),
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/property/comparables');
  return { ok: true, id: data.id };
}

const COMPARABLE_COLUMNS = new Set([
  'property_name', 'country_id', 'state_id', 'locality', 'event_type', 'event_date',
  'price', 'currency', 'land_area', 'land_area_unit', 'building_area', 'bedrooms',
  'max_guests', 'practice_spaces', 'has_accommodation', 'annual_revenue',
  'revenue_note', 'source_url', 'source_note', 'observed_by', 'notes',
]);

export async function saveComparable(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!COMPARABLE_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('property_comparables')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/property/comparables');
  return { ok: true };
}

export async function removeComparable(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('property_comparables').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/property/comparables');
  return { ok: true };
}

/* ── the model, run for one space ────────────────────────────────── */

/** What a room's dimensions imply about what it earns.
 *
 *  Shown as a worked calculation rather than a figure, because the point
 *  is that it can be taken apart. A valuation nobody can interrogate is
 *  an opinion. */
export async function modelSpace(areaSqm: number, countryId?: number | null) {
  const supabase = await createClient();

  const [{ data: usages }, { data: benchmarks }] = await Promise.all([
    supabase.from('space_usages').select('*').order('sqm_per_person'),
    supabase.from('space_revenue_benchmarks').select('*'),
  ]);

  const forUsage = (usageId: number) =>
    (benchmarks ?? []).find((b: any) =>
      b.usage_id === usageId && (b.country_id === countryId || b.country_id === null));

  return (usages ?? []).map((u: any) => {
    const capacity = u.sqm_per_person
      ? Math.floor(areaSqm / Number(u.sqm_per_person)) : null;
    const b = forUsage(u.id);
    const rate = b?.rate_per_person ? Number(b.rate_per_person) : null;
    const util = b?.typical_utilisation ? Number(b.typical_utilisation) : null;

    return {
      usage: u.name,
      slug: u.slug,
      category: u.category,
      sqmPerPerson: Number(u.sqm_per_person),
      capacity,
      rate,
      utilisation: util,
      currency: b?.currency ?? null,
      confidence: b?.confidence ?? null,
      atFull: capacity && rate ? capacity * rate : null,
      expected: capacity && rate ? capacity * rate * (util ?? 1) : null,
      perSqm: capacity && rate && areaSqm
        ? (capacity * rate * (util ?? 1)) / areaSqm : null,
    };
  });
}
