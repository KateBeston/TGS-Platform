'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function tiers() {
  const supabase = await createClient();
  const { data } = await supabase.from('subscription_tiers')
    .select('*').order('display_order');
  return data ?? [];
}

/** Every venue paying, and what it pays. */
export async function subscriptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('venue_subscriptions')
    .select('*, venues(id,venue_name), subscription_tiers(name,commission_rate,monthly_price)')
    .order('status')
    .limit(500);
  return data ?? [];
}

export async function owing() {
  const supabase = await createClient();
  const { data } = await supabase.from('commission_owing')
    .select('*').order('due', { ascending: false, nullsFirst: false });
  return data ?? [];
}

export async function subscriptionSummary() {
  const supabase = await createClient();
  const [{ data: subs }, { data: bookings }] = await Promise.all([
    supabase.from('venue_subscriptions')
      .select('status,charged_price,billing_period,tier_id,is_complimentary'),
    supabase.from('bookings')
      .select('commission_amount,commission_status,currency')
      .not('commission_amount', 'is', null),
  ]);

  const active = (subs ?? []).filter((s: any) => s.status === 'Active');
  // Annual plans are charged once, so a monthly figure has to divide
  // them out or the number is wrong by a factor of twelve.
  const monthly = active.reduce((sum: number, s: any) => {
    const p = Number(s.charged_price ?? 0);
    return sum + (s.billing_period === 'Annual' ? p / 12 : p);
  }, 0);

  const byStatus: Record<string, number> = {};
  (bookings ?? []).forEach((b: any) => {
    byStatus[b.commission_status] =
      (byStatus[b.commission_status] ?? 0) + Number(b.commission_amount ?? 0);
  });

  return {
    activeSubscriptions: active.length,
    complimentary: active.filter((s: any) => s.is_complimentary).length,
    monthlyRecurring: monthly,
    commission: byStatus,
    totalBookings: (bookings ?? []).length,
  };
}

const TIER_COLUMNS = new Set([
  'commission_rate', 'commission_basis', 'monthly_price', 'annual_price', 'tagline',
]);

export async function saveTier(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!TIER_COLUMNS.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('subscription_tiers')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/finance/subscriptions');
  return {
    ok: true,
    // Worth saying plainly: nobody expects a rate change to be
    // retrospective, and it isn't.
    message: 'Changed. Bookings already taken keep the rate they were made at.',
  };
}

export async function markMatured(): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mature_commission');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance/subscriptions');
  return {
    ok: true,
    message: `${data ?? 0} booking${data === 1 ? '' : 's'} moved to due.`,
  };
}

export async function setCommissionStatus(
  bookingIds: number[], status: string, reason?: string
): Promise<Result> {
  if (!bookingIds.length) return { ok: true, message: 'Nothing selected.' };
  const supabase = await createClient();
  const patch: Record<string, unknown> = { commission_status: status };
  if (status === 'Waived') patch.commission_waived_reason = reason ?? null;

  const { error } = await supabase.from('bookings').update(patch).in('id', bookingIds);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance/subscriptions');
  return { ok: true, message: `${bookingIds.length} updated.` };
}

/* ── changing tier ───────────────────────────────────────────────── */

/** What a change would cost, without doing anything.
 *
 *  Returns the numbers so a portal can show them before a venue
 *  commits — including what commission becomes, which is usually the
 *  figure they actually care about. */
export async function quoteTierChange(
  venueId: number, toTierId: number, billing?: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('quote_tier_change', {
    p_venue_id: venueId, p_to_tier_id: toTierId, p_billing: billing ?? null,
  });
  if (error) return { error: error.message };
  return data as Record<string, any>;
}

export async function requestTierChange(
  venueId: number, toTierId: number, billing?: string, reason?: string
): Promise<Result & { change?: Record<string, any> }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_tier_change', {
    p_venue_id: venueId,
    p_to_tier_id: toTierId,
    p_billing: billing ?? null,
    p_reason: reason ?? null,
    p_via: 'Internal',
  });
  if (error) {
    return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, '').trim() };
  }

  const q = data as any;
  revalidatePath(`/venues/${venueId}/subscription`);
  revalidatePath('/finance/subscriptions');

  return {
    ok: true,
    change: q,
    message: q.kind === 'Downgrade'
      ? `Scheduled. ${q.to_tier} applies from ${
          new Date(q.effective_at).toLocaleDateString('en-AU',
            { day: 'numeric', month: 'long', year: 'numeric' })}.`
      : `Now on ${q.to_tier}. ${q.amount_due > 0
          ? `${q.currency} ${q.amount_due} due`
          : 'Nothing to pay'}.`,
  };
}

export async function tierChanges(venueId?: number) {
  const supabase = await createClient();
  let q = supabase.from('subscription_changes')
    .select('*, venues(venue_name), '
      + 'from_tier:from_tier_id(name), to_tier:to_tier_id(name)')
    .order('requested_at', { ascending: false }).limit(100);
  if (venueId) q = q.eq('venue_id', venueId);
  const { data } = await q;
  return data ?? [];
}

export async function cancelScheduledChange(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('subscription_changes')
    .update({ status: 'Cancelled', failure_reason: 'Cancelled before it applied' })
    .eq('id', id).eq('status', 'Scheduled');
  if (error) return { ok: false, error: error.message };

  await supabase.from('venue_subscriptions')
    .update({ pending_change_id: null }).eq('pending_change_id', id);

  revalidatePath('/finance/subscriptions');
  return { ok: true, message: 'Cancelled. Nothing will change.' };
}

/** Applies whatever has come due. A scheduled downgrade does not apply
 *  itself — this needs running on a schedule. */
export async function applyDueChanges(): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('apply_due_changes');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance/subscriptions');
  return {
    ok: true,
    message: `${data ?? 0} change${data === 1 ? '' : 's'} applied.`,
  };
}
