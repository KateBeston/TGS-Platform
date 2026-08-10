import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CurrencyManager from '@/components/CurrencyManager';

export const dynamic = 'force-dynamic';

export default async function CurrenciesPage() {
  const supabase = await createClient();

  const [{ data: currencies }, { data: rates }, { data: venueCurrencies },
         { data: countryUse }] = await Promise.all([
    supabase.from('currencies').select('*').order('display_order').order('code'),
    supabase.from('current_rates').select('*'),
    supabase.from('venues').select('price_currency').not('price_currency', 'is', null),
    supabase.from('countries')
      .select('currency_code, id')
      .not('currency_code', 'is', null),
  ]);

  // Which currencies actually matter — the ones venues price in, plus the
  // ones their countries use.
  const venueCount = new Map<string, number>();
  (venueCurrencies ?? []).forEach((v: any) =>
    venueCount.set(v.price_currency, (venueCount.get(v.price_currency) ?? 0) + 1));

  const countryCount = new Map<string, number>();
  (countryUse ?? []).forEach((c: any) =>
    countryCount.set(c.currency_code, (countryCount.get(c.currency_code) ?? 0) + 1));

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/finance">Finance</Link> · Currencies and rates
      </div>
      <CurrencyManager
        currencies={currencies ?? []}
        rates={rates ?? []}
        venueCount={Object.fromEntries(venueCount)}
        countryCount={Object.fromEntries(countryCount)}
      />
    </div></div>
  );
}
