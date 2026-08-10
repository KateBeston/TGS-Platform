'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const CURRENCY_COLUMNS = new Set([
  'name','symbol','symbol_position','decimal_places','is_active','display_order',
]);

export async function saveCurrency(
  code: string, column: string, value: unknown
): Promise<Result> {
  if (!CURRENCY_COLUMNS.has(column)) {
    return { ok: false, error: `"${column}" is not editable on a currency.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('currencies')
    .update({ [column]: value }).eq('code', code);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance/currencies');
  return { ok: true };
}

/** Exactly one base currency. Everything converts through it, so two would
 *  make every figure ambiguous. */
export async function setBaseCurrency(code: string): Promise<Result> {
  const supabase = await createClient();
  await supabase.from('currencies').update({ is_base: false }).neq('code', code);
  const { error } = await supabase.from('currencies')
    .update({ is_base: true, is_active: true }).eq('code', code);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance/currencies');
  return { ok: true, message: `${code} is now the base currency.` };
}

/* ── rate sync ───────────────────────────────────────────────────── */

/** Pulls daily reference rates from Frankfurter — free, open source, no
 *  key, drawing on 84 central banks for 201 currencies.
 *
 *  These are daily reference rates, not live trading rates: no bid/ask
 *  spread, and nothing published at weekends. That is the right thing for
 *  quoting. A quote valid for fourteen days cannot be priced at a rate
 *  that moved while the email was being written — what matters is that the
 *  rate quoted at is recorded and can be pointed to later.
 *
 *  Rates are stored per day and never overwritten, so a booking taken in
 *  March still converts at March's rate in September. That is what makes
 *  an FX shortfall on a refund explainable rather than a mystery.
 */
export async function syncRates(forDate?: string): Promise<Result> {
  const supabase = await createClient();

  const { data: currencies } = await supabase
    .from('currencies').select('code,is_base,is_active');
  const base = currencies?.find((c: any) => c.is_base)?.code ?? 'AUD';
  const active = (currencies ?? []).filter((c: any) => c.is_active && c.code !== base)
    .map((c: any) => c.code);

  if (!active.length) {
    return { ok: false, error: 'No active currencies besides the base. Activate some first.' };
  }

  const dateParam = forDate ? `&date=${forDate}` : '';
  const url = `https://api.frankfurter.dev/v1/latest?base=${base}`
    + `&symbols=${active.join(',')}${dateParam}`;

  let json: any;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return { ok: false, error: `Frankfurter returned ${res.status}.` };
    json = await res.json();
  } catch {
    return { ok: false, error: 'Could not reach Frankfurter.' };
  }

  const rates = json?.rates ?? {};
  const effective = json?.date ?? new Date().toISOString().slice(0, 10);
  const codes = Object.keys(rates);

  if (!codes.length) {
    return { ok: false, error: 'No rates returned. The base or the currencies may not be covered.' };
  }

  const rows = codes.map((quote) => ({
    base_currency: base,
    quote_currency: quote,
    rate: rates[quote],
    effective_date: effective,
    source: 'Frankfurter (ECB and 84 central banks)',
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('exchange_rates')
    .upsert(rows, { onConflict: 'base_currency,quote_currency,effective_date' });

  if (error) return { ok: false, error: error.message };

  const missing = active.filter((c) => !codes.includes(c));
  revalidatePath('/finance/currencies');

  return {
    ok: true,
    message: `${rows.length} rates for ${effective}.`
      + (missing.length ? ` Not covered: ${missing.join(', ')}.` : ''),
  };
}

/** Backfills a run of days so historical conversions work. Frankfurter
 *  serves a whole range in one request, which is why this is cheap. */
export async function backfillRates(days = 90): Promise<Result> {
  const supabase = await createClient();

  const { data: currencies } = await supabase
    .from('currencies').select('code,is_base,is_active');
  const base = currencies?.find((c: any) => c.is_base)?.code ?? 'AUD';
  const active = (currencies ?? []).filter((c: any) => c.is_active && c.code !== base)
    .map((c: any) => c.code);
  if (!active.length) return { ok: false, error: 'No active currencies besides the base.' };

  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${from}..?base=${base}&symbols=${active.join(',')}`;

  let json: any;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return { ok: false, error: `Frankfurter returned ${res.status}.` };
    json = await res.json();
  } catch {
    return { ok: false, error: 'Could not reach Frankfurter.' };
  }

  const byDate = json?.rates ?? {};
  const rows: any[] = [];
  for (const [date, pairs] of Object.entries(byDate as Record<string, any>)) {
    for (const [quote, rate] of Object.entries(pairs as Record<string, number>)) {
      rows.push({
        base_currency: base, quote_currency: quote, rate,
        effective_date: date,
        source: 'Frankfurter (ECB and 84 central banks)',
        fetched_at: new Date().toISOString(),
      });
    }
  }

  if (!rows.length) return { ok: false, error: 'No rates returned for that range.' };

  // Chunked, because 90 days across a dozen currencies is over a thousand
  // rows and a single upsert that large times out.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('exchange_rates')
      .upsert(rows.slice(i, i + 500),
              { onConflict: 'base_currency,quote_currency,effective_date' });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/finance/currencies');
  return { ok: true, message: `${rows.length} rates across ${Object.keys(byDate).length} days.` };
}
