'use client';

import { useState, useTransition } from 'react';
import {
  backfillRates, saveCurrency, setBaseCurrency, syncRates,
} from '@/app/actions/currencies';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5,
};

/** Formats using the currency's own decimal places. JPY and IDR have none,
 *  so ¥12,500.00 states a precision the currency does not have. */
function money(amount: number, c: Row) {
  const n = Number(amount).toLocaleString('en-AU', {
    minimumFractionDigits: c.decimal_places ?? 2,
    maximumFractionDigits: c.decimal_places ?? 2,
  });
  return c.symbol_position === 'after' ? `${n} ${c.symbol ?? ''}` : `${c.symbol ?? ''}${n}`;
}

export default function CurrencyManager({
  currencies, rates, venueCount, countryCount,
}: {
  currencies: Row[]; rates: Row[];
  venueCount: Record<string, number>;
  countryCount: Record<string, number>;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? 'Done.') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const base = currencies.find((c) => c.is_base);
  const active = currencies.filter((c) => c.is_active);
  const rateFor = (code: string) => rates.find((r) => r.quote_currency === code);
  const newest = rates.length
    ? rates.map((r) => r.effective_date).sort().reverse()[0] : null;

  const q = filter.trim().toUpperCase();
  const visible = currencies.filter((c) => {
    if (q && !c.code.includes(q) && !String(c.name).toUpperCase().includes(q)) return false;
    if (showAll) return true;
    return c.is_active || venueCount[c.code] || countryCount[c.code];
  });

  return (
    <>
      <div className="ph">
        <div>
          <h2>Currencies and rates</h2>
          <div className="ph-sub">
            {active.length} quoted in · {currencies.length} catalogued
            {newest && ` · rates to ${new Date(newest).toLocaleDateString('en-AU')}`}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn" disabled={pending} onClick={() => act(() => syncRates())}>
            {pending ? 'Fetching…' : 'Fetch today\u2019s rates'}
          </button>
          <button className="btn quiet" disabled={pending}
                  onClick={() => act(() => backfillRates(90))}>
            Backfill 90 days
          </button>
        </div>
      </div>

      <div className="note">
        <strong>Daily reference rates, not live trading rates.</strong> They come from
        Frankfurter, which draws on the European Central Bank and 83 other central banks — free,
        no key, 201 currencies. There is no bid-ask spread and nothing is published at weekends.</div>

      {msg && <div className="note">{msg}</div>}

      <div className="sect">
        <h3>Base currency</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          Everything converts through this. Currently <strong>{base?.code ?? 'none'}</strong>.
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {active.map((c) => (
            <button key={c.code} type="button" disabled={pending}
              className={`pill ${c.is_base ? 'gold' : ''}`}
              style={{ cursor: 'pointer',
                       background: c.is_base ? undefined : 'var(--warm-white)' }}
              onClick={() => act(() => setBaseCurrency(c.code))}>
              {c.code}
            </button>
          ))}
        </div>
      </div>

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Currencies</h3>
            <div className="ph-sub">
              Showing {visible.length}
              {!showAll && ' — those in use, plus any you quote in'}
            </div>
          </div>
          <div className="ph-act">
            <input data-bwignore value={filter} placeholder="Find a currency"
              style={sel} onChange={(e) => setFilter(e.target.value)} />
            <button className="btn quiet" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'In use only' : `All ${currencies.length}`}
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Currency</th><th>Quote in it</th><th>Rate</th>
              <th>Example</th><th>Venues</th><th>Countries</th><th>Decimals</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const r = rateFor(c.code);
              return (
                <tr key={c.code}>
                  <td>
                    <span className="v-name" style={{ fontSize: 18 }}>{c.code}</span>
                    <div className="v-slug">{c.name}</div>
                  </td>
                  <td>
                    <button type="button" disabled={pending || c.is_base}
                      className={`pill ${c.is_active ? 'gold' : ''}`}
                      style={{ cursor: c.is_base ? 'not-allowed' : 'pointer',
                               background: c.is_active ? undefined : 'var(--warm-white)' }}
                      onClick={() => act(() => saveCurrency(c.code, 'is_active', !c.is_active))}>
                      {c.is_base ? 'Base' : c.is_active ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td className="v-slug">
                    {c.is_base ? '—'
                      : r ? <>1 {base?.code} = {Number(r.rate).toLocaleString('en-AU',
                              { maximumFractionDigits: 4 })} {c.code}
                            <div>{new Date(r.effective_date).toLocaleDateString('en-AU')}</div></>
                      : c.is_active ? <span style={{ color: 'var(--warn)' }}>Not fetched</span>
                      : '—'}
                  </td>
                  <td className="v-slug">
                    {money(c.decimal_places === 0 ? 12500 : 1250.5, c)}
                  </td>
                  <td>{venueCount[c.code] ?? <span className="pill empty">0</span>}</td>
                  <td className="v-slug">{countryCount[c.code] ?? 0}</td>
                  <td>
                    <select defaultValue={c.decimal_places} disabled={pending} style={sel}
                      onChange={(e) => act(() =>
                        saveCurrency(c.code, 'decimal_places', Number(e.target.value)))}>
                      {[0, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <strong>Decimal places are not cosmetic.</strong> Yen, won, rupiah and dong have none,
          so formatting 12,500 IDR as Rp12,500.00 states a precision the currency does not have.</div>
      </div>

      <div className="sect">
        <h3>How a venue&rsquo;s currency is decided</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          In order, first match wins
        </div>
        <table>
          <tbody>
            <tr><td style={{ width: 260, color: 'var(--ink-quiet)' }}>The venue&rsquo;s own setting</td>
              <td>Its price currency, where one is recorded</td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>Its country</td>
              <td>Otherwise the country&rsquo;s currency — 152 are mapped</td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>Fallback</td>
              <td>{base?.code ?? 'AUD'}, so nothing is ever currency-less</td></tr>
          </tbody>
        </table>
        <div className="note" style={{ marginTop: 'var(--s3)', marginBottom: 0 }}>
          The venue setting comes first because it is common for a venue to price in something
          other than its country&rsquo;s currency — a Balinese retreat quoting in USD, or a
          Moroccan riad in euros.
        </div>
      </div>
    </>
  );
}
