'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; id?: number; message?: string } | { ok: false; error: string };

/* ═══════════════════════════════════════════════════════════════════════
   VENUE SERVICES — attributing each wellness service to a practice

   A venue's individual services (venue_services) each carry a modality
   category_id and practice_id. Attributing a service to a practice also
   ensures the venue-level mapping (venue_categories / venue_practices)
   includes it, so the public practice pages and the read-only summary
   reflect what the venue actually offers. The mapping is only added to
   here, never stripped — the Practices tab remains the place to prune
   venue-level tags.
   ═══════════════════════════════════════════════════════════════════════ */

export async function venueServices(venueId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_services')
    .select('id,name,duration_minutes,base_price,currency,category_id,practice_id,display_order')
    .eq('venue_id', venueId)
    .order('display_order', { nullsFirst: false }).order('name');
  return data ?? [];
}

/** Categories + practices for the cascading dropdowns. */
export async function taxonomyOptions() {
  const supabase = await createClient();
  const [{ data: cats }, { data: pracs }] = await Promise.all([
    supabase.from('modality_categories').select('id,name,in_wellness,in_retreat')
      .order('display_order', { nullsFirst: false }).order('name'),
    supabase.from('modality_practices').select('id,name,category_id')
      .order('display_order', { nullsFirst: false }).order('name'),
  ]);
  return { categories: cats ?? [], practices: pracs ?? [] };
}

/** The venue's mapped categories & practices, for the read-only summary. */
export async function venueMapping(venueId: number) {
  const supabase = await createClient();
  const [{ data: cats }, { data: pracs }] = await Promise.all([
    supabase.from('venue_categories')
      .select('category_id, modality_categories(name)').eq('venue_id', venueId),
    supabase.from('venue_practices')
      .select('practice_id, modality_practices(name, category_id)').eq('venue_id', venueId),
  ]);
  return {
    categories: (cats ?? []).map((r: any) => r.modality_categories?.name).filter(Boolean).sort(),
    practices: (pracs ?? []).map((r: any) => r.modality_practices?.name).filter(Boolean).sort(),
  };
}

/* Services are the source of truth. Rebuild the venue-level mapping so it
 * reflects exactly the categories and practices its services cover:
 * practices no longer served are dropped, new ones added, and surviving
 * rows (with their is_primary / notes) are left untouched. */
async function recomputeVenueMapping(supabase: any, venueId: number) {
  const { data: svcs } = await supabase.from('venue_services')
    .select('category_id, practice_id').eq('venue_id', venueId);

  const practiceIds = [...new Set((svcs ?? []).map((s: any) => s.practice_id).filter(Boolean))] as number[];
  const categoryIds = new Set<number>((svcs ?? []).map((s: any) => s.category_id).filter(Boolean) as number[]);

  // a practice implies its parent category
  if (practiceIds.length) {
    const { data: pr } = await supabase.from('modality_practices')
      .select('category_id').in('id', practiceIds);
    for (const p of (pr ?? []) as any[]) if (p.category_id) categoryIds.add(p.category_id);
  }
  const catArr = [...categoryIds];

  // practices — drop those no longer served, add the rest
  let delP = supabase.from('venue_practices').delete().eq('venue_id', venueId);
  if (practiceIds.length) delP = delP.not('practice_id', 'in', `(${practiceIds.join(',')})`);
  await delP;
  if (practiceIds.length) {
    await supabase.from('venue_practices').upsert(
      practiceIds.map((practice_id) => ({ venue_id: venueId, practice_id })),
      { onConflict: 'venue_id,practice_id', ignoreDuplicates: true },
    );
  }

  // categories — same, preserving is_primary on survivors
  let delC = supabase.from('venue_categories').delete().eq('venue_id', venueId);
  if (catArr.length) delC = delC.not('category_id', 'in', `(${catArr.join(',')})`);
  await delC;
  if (catArr.length) {
    await supabase.from('venue_categories').upsert(
      catArr.map((category_id) => ({ venue_id: venueId, category_id })),
      { onConflict: 'venue_id,category_id', ignoreDuplicates: true },
    );
  }
}

export async function setServiceTaxon(
  serviceId: number, categoryId: number | null, practiceId: number | null,
): Promise<Result> {
  const supabase = await createClient();
  const { data: svc } = await supabase.from('venue_services')
    .select('venue_id').eq('id', serviceId).single();
  const { error } = await supabase.from('venue_services')
    .update({ category_id: categoryId, practice_id: practiceId }).eq('id', serviceId);
  if (error) return { ok: false, error: error.message };
  if (svc?.venue_id) {
    await recomputeVenueMapping(supabase, svc.venue_id);
    revalidatePath(`/venues/${svc.venue_id}/services`);
    revalidatePath(`/venues/${svc.venue_id}/taxonomy`);
  }
  return { ok: true };
}

export async function renameService(serviceId: number, name: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };
  const supabase = await createClient();
  const { error } = await supabase.from('venue_services').update({ name: name.trim() }).eq('id', serviceId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addService(venueId: number, name: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };
  const supabase = await createClient();
  const { data: top } = await supabase.from('venue_services')
    .select('display_order').eq('venue_id', venueId)
    .order('display_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('venue_services').insert({
    venue_id: venueId, name: name.trim(),
    display_order: ((top?.display_order as number) ?? 0) + 1,
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/services`);
  return { ok: true, id: data.id as number };
}

export async function deleteService(serviceId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_services').delete().eq('id', serviceId);
  if (error) return { ok: false, error: error.message };
  await recomputeVenueMapping(supabase, venueId);
  revalidatePath(`/venues/${venueId}/services`);
  revalidatePath(`/venues/${venueId}/taxonomy`);
  return { ok: true };
}
