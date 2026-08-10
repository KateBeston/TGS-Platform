'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string; id?: number } | { ok: false; error: string };

/** A venue's packages with what each contains.
 *
 *  Loaded together because a package without its items is a name and a
 *  price, and the items are the reason it exists. */
export async function packagesFor(venueId: number) {
  const supabase = await createClient();

  const { data: packages } = await supabase.from('venue_packages')
    .select('*').eq('venue_id', venueId).order('display_order').order('id');

  const ids = (packages ?? []).map((p) => p.id);

  const { data: items } = ids.length
    ? await supabase.from('venue_package_items')
        .select('*, venue_services(id,name,base_price,duration_minutes,'
              + 'modality_practices(name, modality_categories(name)))')
        .in('package_id', ids)
        .order('display_order')
    : { data: [] };

  return (packages ?? []).map((p) => ({
    ...p,
    items: (items ?? []).filter((i: any) => i.package_id === p.id),
  }));
}

/** The venue's own services, for choosing what goes in a package. */
export async function servicesFor(venueId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_services')
    .select('id,name,base_price,duration_minutes,currency')
    .eq('venue_id', venueId).order('name');
  return data ?? [];
}

export async function addPackage(venueId: number, name: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'It needs a name.' };
  const supabase = await createClient();

  const { data: last } = await supabase.from('venue_packages')
    .select('display_order').eq('venue_id', venueId)
    .order('display_order', { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase.from('venue_packages').insert({
    venue_id: venueId, name: name.trim(),
    display_order: (last?.display_order ?? 0) + 10,
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/pricing`);
  return { ok: true, id: data.id };
}

const PACKAGE_COLUMNS = new Set([
  'name', 'package_type', 'tagline', 'description', 'duration_label',
  'total_duration_minutes', 'price', 'price_per_person', 'price_couple',
  'currency', 'saving_amount', 'available_months', 'is_limited_edition',
  'max_participants', 'booking_notice_hours', 'is_featured', 'is_bookable',
  'show_on_website', 'image_url', 'display_order', 'inclusions', 'space_id',
]);

export async function savePackage(
  id: number, column: string, value: unknown, venueId: number
): Promise<Result> {
  if (!PACKAGE_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('venue_packages')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/pricing`);
  return { ok: true };
}

export async function removePackage(id: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_packages').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/pricing`);
  return { ok: true, message: 'Removed, with everything in it.' };
}

/** Adds a part to a package.
 *
 *  Either a real service or a described one. A glass of champagne on
 *  arrival is part of what is sold and is not a treatment. */
export async function addPackageItem(
  packageId: number, venueId: number,
  serviceId: number | null, label: string | null
): Promise<Result> {
  if (!serviceId && !label?.trim()) {
    return { ok: false, error: 'Choose a service or describe what it is.' };
  }

  const supabase = await createClient();
  const { data: last } = await supabase.from('venue_package_items')
    .select('display_order').eq('package_id', packageId)
    .order('display_order', { ascending: false }).limit(1).maybeSingle();

  const { error } = await supabase.from('venue_package_items').insert({
    package_id: packageId,
    service_id: serviceId,
    label: serviceId ? null : label?.trim(),
    display_order: (last?.display_order ?? 0) + 10,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/pricing`);
  return { ok: true };
}

const ITEM_COLUMNS = new Set([
  'service_id', 'label', 'duration_minutes', 'quantity', 'is_optional',
  'choice_group', 'notes', 'display_order',
]);

export async function savePackageItem(
  id: number, column: string, value: unknown, venueId: number
): Promise<Result> {
  if (!ITEM_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable.` };
  }
  const supabase = await createClient();

  const patch: Record<string, unknown> = { [column]: value };
  // Choosing a service replaces a typed label, since the service is the
  // better answer and two would disagree.
  if (column === 'service_id' && value) patch.label = null;

  const { error } = await supabase.from('venue_package_items')
    .update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/pricing`);
  return { ok: true };
}

export async function removePackageItem(id: number, venueId: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_package_items').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/pricing`);
  return { ok: true };
}

/** What the parts would cost bought separately.
 *
 *  The number that sells a package — a ritual at $290 against $340 of
 *  treatments is an argument. */
export async function packageValue(packageId: number) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('package_value', { p_package_id: packageId });
  return data as Record<string, any> | null;
}
