'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/* The launch date, and what hangs off it.
 *
 * The complimentary period counts from here, and current_legal_phase()
 * reads it to decide whether the site serves the interim terms or the
 * subscription terms. One row, one date, and everything else derived. */

export async function setLaunchDate(wentLiveAt: string | null, months: number) {
  const supabase = await createClient();

  const { error } = await supabase.from('platform_milestones')
    .update({
      went_live_at: wentLiveAt,
      complimentary_months: months,
      updated_at: new Date().toISOString(),
    })
    .eq('singleton', true);

  // Everything that reads the phase.
  revalidatePath('/settings');
  revalidatePath('/legal');

  return { error: error?.message ?? null };
}
