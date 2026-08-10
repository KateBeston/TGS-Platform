'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const COLUMNS = new Set([
  'tier_id','partner_program_id','billing_period','list_price','discount_percent',
  'charged_price','currency','commission_rate','is_complimentary','complimentary_until',
  'stripe_customer_id','stripe_subscription_id','status','started_at',
  'current_period_end','trial_ends_at','cancelled_at','cancellation_reason','notes',
  'secondary_listing_fee','secondary_listing_included',
]);

function humanise(m: string) {
  if (/violates check constraint.*status/i.test(m))
    return 'Status must be Pending, Trialing, Active, Past Due, Cancelled or Expired.';
  if (/violates check constraint.*billing/i.test(m))
    return 'Billing period must be Monthly or Annual.';
  return m;
}

/** Recalculates list price, discount and charged price from the tier and
 *  partner program. Prices are derived rather than typed: a Founding
 *  Partner on Featured annual should never depend on someone remembering
 *  that 60% of $990 is $396. */
async function derive(supabase: any, sub: any) {
  if (!sub.tier_id) return {};

  const [{ data: tier }, { data: program }] = await Promise.all([
    supabase.from('subscription_tiers').select('*').eq('id', sub.tier_id).single(),
    sub.partner_program_id
      ? supabase.from('partner_programs').select('*').eq('id', sub.partner_program_id).single()
      : Promise.resolve({ data: null }),
  ]);
  if (!tier) return {};

  const annual = sub.billing_period === 'Annual';
  const list = Number(annual ? tier.annual_price : tier.monthly_price) || 0;
  const discount = Number(program?.discount_percent ?? 0);
  const charged = sub.is_complimentary ? 0
    : Math.round(list * (1 - discount / 100) * 100) / 100;

  return {
    list_price: list,
    discount_percent: discount || null,
    charged_price: charged,
    currency: tier.currency ?? 'AUD',
    // Commission comes from the tier, not typed. It is the number that
    // decides what TGS earns on every booking through this venue.
    commission_rate: tier.commission_rate,
    secondary_listing_fee: tier.secondary_listing_fee,
    secondary_listing_included: tier.secondary_listing_included,
  };
}

export async function createSubscription(venueId: number, tierId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('venue_subscriptions').select('id')
    .eq('venue_id', venueId).in('status', ['Pending', 'Trialing', 'Active', 'Past Due'])
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'This venue already has an active subscription. Cancel it first.' };
  }

  const base = { venue_id: venueId, tier_id: tierId, billing_period: 'Monthly',
                 status: 'Pending', started_at: new Date().toISOString() };
  const derived = await derive(supabase, base);

  const { error } = await supabase.from('venue_subscriptions').insert({ ...base, ...derived });
  if (error) return { ok: false, error: humanise(error.message) };

  revalidatePath(`/venues/${venueId}/subscription`);
  return { ok: true, message: 'Subscription created.' };
}

export async function saveSubscriptionField(
  subId: number, venueId: number, column: string, value: unknown
): Promise<Result> {
  if (!COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a subscription.` };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('venue_subscriptions').select('*').eq('id', subId).single();
  if (!current) return { ok: false, error: 'Subscription not found.' };

  const next = { ...current, [column]: value };

  // Anything affecting price triggers a recalculation, so the three
  // numbers can never disagree with each other.
  const affectsPrice = ['tier_id', 'partner_program_id', 'billing_period', 'is_complimentary']
    .includes(column);
  const derived = affectsPrice ? await derive(supabase, next) : {};

  const { error } = await supabase.from('venue_subscriptions')
    .update({ [column]: value, ...derived }).eq('id', subId);

  if (error) return { ok: false, error: humanise(error.message) };

  revalidatePath(`/venues/${venueId}/subscription`);
  revalidatePath('/venues');
  return { ok: true };
}

export async function cancelSubscription(
  subId: number, venueId: number, reason: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_subscriptions').update({
    status: 'Cancelled',
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason || null,
  }).eq('id', subId);

  if (error) return { ok: false, error: humanise(error.message) };
  revalidatePath(`/venues/${venueId}/subscription`);
  return { ok: true, message: 'Cancelled.' };
}
