'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Bookings a payment could be recorded against.
 *
 *  Searchable, since somebody on the phone has a name or a reference and
 *  not an id. */
export async function findBookings(search: string) {
  const supabase = await createClient();
  const term = search.trim();

  let q = supabase.from('bookings')
    .select('id,booking_reference,date_from,date_to,total,currency,status,'
          + 'guest_name,venues(venue_name)')
    .in('status', ['Draft', 'Pending', 'Confirmed'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (term) {
    q = q.or(`booking_reference.ilike.%${term}%,guest_name.ilike.%${term}%`);
  }

  const { data } = await q;
  return data ?? [];
}

/** What is still owing on one, so somebody knows what to take. */
export async function owingOn(bookingId: number) {
  const supabase = await createClient();

  const [{ data: plan }, { data: paid }] = await Promise.all([
    supabase.from('payment_schedules')
      .select('id,label,amount,due_date,status')
      .eq('booking_id', bookingId).order('sequence'),
    supabase.from('payments')
      .select('id,amount,method,paid_at,recorded_by_hand,reconciled_at,external_reference')
      .eq('booking_id', bookingId).eq('status', 'Succeeded').order('paid_at'),
  ]);

  return { schedule: plan ?? [], payments: paid ?? [] };
}

/** Records a payment that did not come through the site. */
export async function recordPayment(input: {
  bookingId: number;
  amount: number;
  method: string;
  paidOn: string;
  reference?: string;
  payerName?: string;
  payerEmail?: string;
  into?: string;
  why?: string;
  scheduleId?: number | null;
}): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('record_manual_payment', {
    p_booking_id: input.bookingId,
    p_amount: input.amount,
    p_method: input.method,
    p_paid_on: input.paidOn,
    p_reference: input.reference ?? null,
    p_payer_name: input.payerName ?? null,
    p_payer_email: input.payerEmail ?? null,
    p_into: input.into ?? null,
    p_why: input.why ?? null,
    p_schedule_id: input.scheduleId ?? null,
  });

  if (error) return { ok: false, error: error.message };
  if (data?.ok === false) return { ok: false, error: data.why };

  revalidatePath('/finance/payments');
  return {
    ok: true,
    message: `Recorded against ${data.against ?? 'the booking'}. `
      + (data.still_owing > 0 ? `${data.still_owing} still owing.` : 'Paid in full.'),
  };
}

export async function toReconcile() {
  const supabase = await createClient();
  const { data } = await supabase.from('payments_to_reconcile')
    .select('*').order('days_unchecked', { ascending: false });
  return data ?? [];
}

export async function markReconciled(
  paymentId: number, note?: string
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reconcile_payment', {
    p_payment_id: paymentId, p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'That is not a payment taken by hand.' };

  revalidatePath('/finance/payments');
  return { ok: true, message: 'Matched.' };
}

/** Creates a booking from the portal.
 *
 *  For a stay arranged by phone or email, which during the concierge
 *  period is all of them. The same record a booking made on the site
 *  produces — one shape, so nothing downstream has to know which door it
 *  came through.
 */
export async function createBooking(input: {
  venueId: number;
  bookedByType: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  hostTypeId?: number | null;
  dateFrom: string;
  dateTo: string;
  guestCount?: number | null;
  isExclusiveUse?: boolean;
  whatFor?: string;
  total: number;
  currency: string;
  templateId?: number | null;
  note?: string;
}): Promise<Result & { id?: number; reference?: string }> {
  const supabase = await createClient();

  if (new Date(input.dateTo) <= new Date(input.dateFrom)) {
    return { ok: false, error: 'It has to end after it begins.' };
  }
  if (!input.total || input.total <= 0) {
    return { ok: false, error: 'It needs a total.' };
  }

  // The rate as it stands, captured now rather than looked up later.
  // It returns rate, basis and source rather than a number, and reading
  // it as a scalar would have written a record into a numeric column.
  const { data: rateRows } = await supabase.rpc('venue_commission_rate', {
    p_venue_id: input.venueId,
  });
  const commission = Array.isArray(rateRows) ? rateRows[0] : rateRows;

  // Their terms as they stand, copied rather than referenced. A venue
  // that later shortens its refund window does not reach back into a
  // booking somebody already agreed to.
  const { data: policy } = await supabase.from('cancellation_policies')
    .select('id,tiers,deposit_is_refundable,admin_fee,transfer_allowed')
    .eq('venue_id', input.venueId).eq('is_default', true)
    .eq('is_active', true).maybeSingle();

  const { data: booking, error } = await supabase.from('bookings').insert({
    venue_id: input.venueId,
    booked_by_type: input.bookedByType,
    status: 'Confirmed',
    date_from: input.dateFrom,
    date_to: input.dateTo,
    guest_count: input.guestCount ?? null,
    subtotal: input.total,
    total: input.total,
    currency: input.currency,
    commission_rate: commission?.rate ?? null,
    commission_basis: commission?.basis ?? null,
    commission_source: commission?.source ?? null,
    cancellation_policy_id: policy?.id ?? null,
    cancellation_terms: policy ? {
      tiers: policy.tiers,
      deposit_is_refundable: policy.deposit_is_refundable,
      admin_fee: policy.admin_fee,
      transfer_allowed: policy.transfer_allowed,
    } : null,
    terms_captured_at: policy ? new Date().toISOString() : null,
    guest_name: input.guestName ?? null,
    guest_email: input.guestEmail ?? null,
    guest_phone: input.guestPhone ?? null,
    host_type_id: input.hostTypeId ?? null,
    is_exclusive_use: input.isExclusiveUse ?? null,
    what_they_want: input.whatFor ?? null,
    internal_notes: input.note ?? null,
    // How it arrived, since a booking made by hand and one made on the
    // site should not look identical afterwards.
    created_via: 'Added by hand',
  }).select('id,booking_reference').single();

  if (error) return { ok: false, error: error.message };

  // The instalments, from the venue's terms. Which is the thing that
  // makes this a booking rather than a note.
  const { data: schedule } = await supabase.rpc('build_payment_schedule', {
    p_booking_id: booking.id,
    p_template_id: input.templateId ?? null,
  });

  // The dates held, so nobody is offered them while this stands.
  await supabase.from('availability_blocks').insert({
    venue_id: input.venueId,
    block_type: 'Booked',
    date_from: input.dateFrom,
    date_to: input.dateTo,
    booking_id: booking.id,
    notes: `Booked by hand — ${booking.booking_reference ?? booking.id}`,
  });

  revalidatePath('/finance/payments');

  return {
    ok: true,
    id: booking.id,
    reference: booking.booking_reference ?? undefined,
    message: schedule?.error
      ? `Created, but no payment plan — ${schedule.error}`
      : `Created with ${schedule?.built ?? 0} instalments.`
        + (policy ? '' : ' No cancellation terms on this venue, so none were captured.'),
  };
}

/** Venues to book against. */
export async function venuesToBook(search: string) {
  const supabase = await createClient();
  let q = supabase.from('venues')
    .select('id,venue_name,price_currency,cities(name),countries(name)')
    .is('archived_at', null).order('venue_name').limit(20);

  if (search.trim()) q = q.ilike('venue_name', `%${search.trim()}%`);

  const { data } = await q;
  return data ?? [];
}

/** The payment plans a booking could use. */
export async function templatesFor(venueId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('payment_schedule_templates')
    .select('id,name,description,is_default,venue_id')
    .or(`venue_id.eq.${venueId},venue_id.is.null`)
    .order('venue_id', { nullsFirst: false });
  return data ?? [];
}
