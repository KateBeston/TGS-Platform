'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type TaxRow = { kind: string; id: number; name: string; group_id: number | null; group_name: string | null; sort_order: number };
export type HostData = {
  taxonomy: TaxRow[];
  selectedStyles: number[];
  selectedPractices: number[];
  selectedAmenities: number[];
};

export async function getHostData(): Promise<HostData> {
  const supabase = await createClient();
  const [{ data: tax }, { data: st }, { data: pr }, { data: am }] = await Promise.all([
    supabase.rpc('get_host_taxonomy'),
    supabase.from('host_retreat_styles').select('category_id'),
    supabase.from('host_teaches').select('practice_id'),
    supabase.from('host_amenity_preferences').select('facility_item_id'),
  ]);
  return {
    taxonomy: (tax ?? []) as TaxRow[],
    selectedStyles: (st ?? []).map((r: { category_id: number }) => r.category_id),
    selectedPractices: (pr ?? []).map((r: { practice_id: number }) => r.practice_id),
    selectedAmenities: (am ?? []).map((r: { facility_item_id: number }) => r.facility_item_id),
  };
}

type State = { ok?: boolean; error?: string } | null;

export async function saveHostProfile(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const nums = (k: string) => formData.getAll(k).map((v) => Number(v)).filter((n) => Number.isFinite(n));
  const styles = nums('style'), practices = nums('practice'), amenities = nums('amenity');

  // replace-in-full: delete the person's rows, insert the new selection
  const e1 = await supabase.from('host_retreat_styles').delete().eq('user_id', user.id);
  const e2 = await supabase.from('host_teaches').delete().eq('user_id', user.id);
  const e3 = await supabase.from('host_amenity_preferences').delete().eq('user_id', user.id);
  if (e1.error || e2.error || e3.error) return { error: 'Could not update — please try again.' };

  if (styles.length) {
    const { error } = await supabase.from('host_retreat_styles').insert(styles.map((id) => ({ user_id: user.id, category_id: id })));
    if (error) return { error: error.message };
  }
  if (practices.length) {
    const { error } = await supabase.from('host_teaches').insert(practices.map((id) => ({ user_id: user.id, practice_id: id })));
    if (error) return { error: error.message };
  }
  if (amenities.length) {
    const { error } = await supabase.from('host_amenity_preferences').insert(amenities.map((id) => ({ user_id: user.id, facility_item_id: id })));
    if (error) return { error: error.message };
  }
  revalidatePath('/account');
  return { ok: true };
}
