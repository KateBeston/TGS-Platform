'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result =
  | { ok: true; message?: string; data?: Record<string, any> }
  | { ok: false; error: string };

const tidy = (m: string) => m.replace(/^.*?ERROR:\s*/, '').trim();

export async function invoices(status?: string) {
  const supabase = await createClient();
  let q = supabase.from('invoices')
    .select('*, venues(id,venue_name)')
    .order('issue_date', { ascending: false }).limit(200);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data } = await q;
  return data ?? [];
}

export async function invoiceLines(invoiceId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('invoice_lines')
    .select('*').eq('invoice_id', invoiceId).order('display_order');
  return data ?? [];
}

export async function statements() {
  const supabase = await createClient();
  const { data } = await supabase.from('venue_statements')
    .select('*, venues(id,venue_name)')
    .order('period_end', { ascending: false }).limit(200);
  return data ?? [];
}

export async function statementsDue() {
  const supabase = await createClient();
  const { data } = await supabase.from('statements_due')
    .select('*').lte('next_due', new Date().toISOString().slice(0, 10))
    .gt('bookings_since', 0)
    .order('next_due');
  return data ?? [];
}

/** Venues with commission due but nothing raised yet. */
export async function readyToInvoice() {
  const supabase = await createClient();
  const { data } = await supabase.from('commission_owing')
    .select('*').gt('due', 0).order('due', { ascending: false });
  return data ?? [];
}

export async function raiseInvoice(
  venueId: number, upTo?: string, dueDays = 14
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('raise_commission_invoice', {
    p_venue_id: venueId,
    p_up_to: upTo ?? new Date().toISOString().slice(0, 10),
    p_due_days: dueDays,
  });
  if (error) return { ok: false, error: tidy(error.message) };

  const r = data as any;
  if (r?.nothing_due) return { ok: false, error: r.message };

  revalidatePath('/finance/invoices');
  return {
    ok: true, data: r,
    message: `${r.invoice_number} raised — ${r.currency} ${Number(r.total).toFixed(2)} `
      + `across ${r.bookings} booking${r.bookings === 1 ? '' : 's'}.`,
  };
}

export async function buildStatement(
  venueId: number, from: string, to: string
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('build_venue_statement', {
    p_venue_id: venueId, p_from: from, p_to: to,
  });
  if (error) {
    return { ok: false, error: /duplicate|unique/i.test(error.message)
      ? 'A statement already exists for that venue and period.'
      : tidy(error.message) };
  }

  const r = data as any;
  revalidatePath('/finance/statements');
  return {
    ok: true, data: r,
    message: `${r.number} — ${r.currency} ${Number(r.gross).toLocaleString('en-AU')} `
      + `gross, ${Number(r.commission).toFixed(2)} commission.`,
  };
}

const INVOICE_STATUS = new Set(['Draft', 'Sent', 'Paid', 'Overdue', 'Void', 'Credited']);

export async function setInvoiceStatus(
  id: number, status: string
): Promise<Result> {
  if (!INVOICE_STATUS.has(status)) return { ok: false, error: 'Not a valid state.' };
  const supabase = await createClient();

  const patch: Record<string, unknown> = { status };
  if (status === 'Sent') patch.sent_at = new Date().toISOString();
  if (status === 'Paid') patch.paid_at = new Date().toISOString();

  const { data: inv, error } = await supabase.from('invoices')
    .update(patch).eq('id', id).select('id,total').single();
  if (error) return { ok: false, error: error.message };

  // The bookings behind it move with the invoice — otherwise the invoice
  // says paid and commission_owing still shows the money outstanding.
  if (status === 'Paid' || status === 'Void') {
    const { data: lines } = await supabase.from('invoice_lines')
      .select('item_code').eq('invoice_id', id);
    const refs = (lines ?? []).map((l: any) => l.item_code).filter(Boolean);
    if (refs.length) {
      await supabase.from('bookings')
        .update({ commission_status: status === 'Paid' ? 'Paid' : 'Due' })
        .in('booking_reference', refs);
    }
  }

  revalidatePath('/finance/invoices');
  return { ok: true, message: `Marked ${status.toLowerCase()}.` };
}

export async function setStatementStatus(id: number, status: string): Promise<Result> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'Issued') patch.issued_at = new Date().toISOString();
  if (status === 'Sent') patch.sent_at = new Date().toISOString();

  const { error } = await supabase.from('venue_statements')
    .update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance/statements');
  return { ok: true, message: `Marked ${status.toLowerCase()}.` };
}

export async function setStatementFrequency(
  venueId: number, frequency: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('venues')
    .update({ statement_frequency: frequency }).eq('id', venueId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance/statements');
  return { ok: true };
}
