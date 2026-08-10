import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { slug: 'subscriptions', label: 'Subscriptions and commission', live: true,
    blurb: 'What venues pay, what they are charged on a booking, and what is owed' },
  { slug: 'currencies', label: 'Currencies and rates', live: true,
    blurb: 'What TGS quotes in, and the rate on any given day' },
  { slug: 'invoices', label: 'Invoices', live: true,
    blurb: 'Commission raised against venues, a line per booking' },
  { slug: 'statements', label: 'Statements', live: true,
    blurb: 'What a venue earned, what commission cost, and what was left' },
  { slug: 'payments', label: 'Payments', live: false,
    blurb: 'Received, scheduled and outstanding', waiting: 'the first booking' },
  { slug: 'payouts', label: 'Payouts', live: false,
    blurb: 'What goes to venues, and when', waiting: 'the first booking' },
  { slug: 'statements', label: 'Venue statements', live: false,
    blurb: 'Per venue, per period', waiting: 'the first payout' },
  { slug: 'expenses', label: 'Expenses', live: false,
    blurb: '21 categories catalogued', waiting: 'an interface' },
];

export default async function FinancePage() {
  const supabase = await createClient();

  const [{ count: currencies }, { count: active }, { count: rates },
         { count: invoices }, { count: payments }] = await Promise.all([
    supabase.from('currencies').select('*', { count: 'exact', head: true }),
    supabase.from('currencies').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('exchange_rates').select('*', { count: 'exact', head: true }),
    supabase.from('invoices').select('*', { count: 'exact', head: true }),
    supabase.from('payments').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Finance</h2>
          <div className="ph-sub">Currencies, invoicing, payments and payouts</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="v">{active ?? 0}</div>
          <div className="l">Currencies quoted in</div>
        </div>
        <div className="stat">
          <div className="v">{(currencies ?? 0).toLocaleString('en-AU')}</div>
          <div className="l">Catalogued</div>
        </div>
        <div className="stat">
          <div className={`v ${!rates ? 'zero' : ''}`}>{(rates ?? 0).toLocaleString('en-AU')}</div>
          <div className="l">Exchange rates held</div>
        </div>
        <div className="stat">
          <div className={`v ${!invoices ? 'zero' : ''}`}>{invoices ?? 0}</div>
          <div className="l">Invoices</div>
        </div>
        <div className="stat">
          <div className={`v ${!payments ? 'zero' : ''}`}>{payments ?? 0}</div>
          <div className="l">Payments</div>
        </div>
      </div>

      <div className="note">
        The finance tables were built with the schema — invoices, payments, payouts, ledger
        entries, statements and refunds all exist.</div>

      <div className="tiles">
        {SECTIONS.map((s) => (
          s.live ? (
            <Link className="tile" key={s.slug} href={`/finance/${s.slug}`}
                  style={{ textAlign: 'left', padding: 'var(--s5)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{s.label}</div>
              <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>{s.blurb}</div>
            </Link>
          ) : (
            <span className="tile off" key={s.slug}
                  style={{ textAlign: 'left', padding: 'var(--s5)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{s.label}</div>
              <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
                {s.blurb} · waiting on {s.waiting}
              </div>
            </span>
          )
        ))}
      </div>
    </div></div>
  );
}
