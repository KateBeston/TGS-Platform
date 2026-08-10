'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; id?: number; message?: string } | { ok: false; error: string };

export async function businessRecords(type?: string) {
  const supabase = await createClient();
  let q = supabase.from('business_records')
    .select('*, legal_documents(id,name)')
    .order('record_type').order('name');
  if (type && type !== 'all') q = q.eq('record_type', type);
  const { data } = await q;
  return data ?? [];
}

/** What is coming up, and when the decision actually has to be made.
 *
 *  A policy renewing on the 30th with 30 days' notice is decided on the
 *  1st. The expiry date is the wrong date to watch. */
export async function renewals() {
  const supabase = await createClient();
  const { data } = await supabase.from('business_renewals')
    .select('*').order('decide_by');
  return data ?? [];
}

export async function settings() {
  const supabase = await createClient();
  const { data } = await supabase.from('tgs_settings')
    .select('*').order('setting_group').order('setting_key');
  return data ?? [];
}

export async function addRecord(type: string, name: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: 'A name is needed.' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('business_records')
    .insert({ record_type: type, name: name.trim(), status: 'Pending' })
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business');
  return { ok: true, id: data.id };
}

const EDITABLE = new Set([
  'name','reference','provider','provider_contact','provider_phone','provider_email',
  'arranged_by','arranged_by_contact','cover_amount','excess_amount','currency',
  'cover_summary','exclusions','starts_on','expires_on','notice_days','auto_renews',
  'cost_amount','cost_period','status','notes','min_rank','external_url','record_type',
]);

export async function saveRecord(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!EDITABLE.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('business_records')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business');
  return { ok: true };
}

export async function removeRecord(id: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('business_records').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business');
  return { ok: true };
}

export async function saveSetting(key: string, value: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('tgs_settings')
    .update({ setting_value: value }).eq('setting_key', key);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business');
  return { ok: true };
}

/* ── email addresses ─────────────────────────────────────────────── */

export async function emailAliases() {
  const supabase = await createClient();
  const { data } = await supabase.from('email_aliases')
    .select('*').order('status').order('address');
  return data ?? [];
}

const ALIAS_COLUMNS = new Set([
  'purpose', 'receives', 'delivers_to', 'sends_from', 'sending_service',
  'is_monitored', 'monitored_by', 'status', 'notes', 'verified_at',
]);

export async function saveAlias(
  id: number, column: string, value: unknown
): Promise<Result> {
  if (!ALIAS_COLUMNS.has(column)) return { ok: false, error: `"${column}" is not editable.` };
  const supabase = await createClient();
  const { error } = await supabase.from('email_aliases')
    .update({ [column]: value }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/business');
  return { ok: true };
}

export async function addAlias(address: string, purpose: string): Promise<Result> {
  const clean = address.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return { ok: false, error: 'That does not look like an address.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('email_aliases')
    .insert({ address: clean, purpose: purpose.trim() || 'Not yet decided',
              status: 'Planned', receives: false, is_monitored: false });
  if (error) {
    return { ok: false, error: /duplicate/i.test(error.message)
      ? 'That address is already recorded.' : error.message };
  }
  revalidatePath('/business');
  return { ok: true };
}
