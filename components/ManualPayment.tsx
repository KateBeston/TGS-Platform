'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  findBookings, markReconciled, owingOn, recordPayment,
} from '@/app/actions/manualPayments';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

const METHODS = [
  'Bank transfer', 'International transfer', 'Card by phone', 'PayPal',
  'Cash', 'Cheque', 'Paid direct to the venue', 'Credit or voucher', 'Other',
];

const money = (n: any, c?: string) =>
  n == null ? '—' : `${c ?? ''} ${Number(n).toLocaleString('en-AU',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   A PAYMENT THAT DID NOT COME THROUGH THE SITE

   The site being down is one reason. A bank transfer, a card taken over
   the phone, and a venue that collected a deposit directly are the
   others, and they happen more often.

   A payment Stripe confirmed is a fact. A payment somebody typed is a
   claim that money arrived — usually right, and not the same thing. So
   it counts as paid and sits on a list until somebody has seen it on a
   statement.
   ═══════════════════════════════════════════════════════════════════════ */

export default function ManualPayment({ unreconciled }: { unreconciled: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Row[]>([]);
  const [chosen, setChosen] = useState<Row | null>(null);
  const [detail, setDetail] = useState<{ schedule: Row[]; payments: Row[] } | null>(null);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({
    amount: '', method: 'Bank transfer',
    paidOn: new Date().toISOString().slice(0, 10),
    reference: '', payerName: '', payerEmail: '', into: '', why: '',
    scheduleId: '' as string,
  });

  useEffect(() => {
    const t = setTimeout(() => { findBookings(search).then(setResults); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (chosen) owingOn(chosen.id).then(setDetail);
    else setDetail(null);
  }, [chosen]);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  const owing = (detail?.schedule ?? []).filter((s) => s.status === 'Scheduled');

  return (
    <>
      <div className="ph">
        <div>
          <h2>Take a payment by hand</h2>
          <div className="ph-sub">
            For a bank transfer, a card over the phone, or a site that is not answering
          </div>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      <div className="sect">
        <h3>Which booking</h3>
        <div className="f">
          <label htmlFor="search">Reference or name</label>
          <input id="search" data-bwignore style={sel} value={search}
            placeholder="TGS26-00014, or Sarah Chen"
            onChange={(e) => { setSearch(e.target.value); setChosen(null); }} />
        </div>

        {!chosen ? (
          <table>
            <thead>
              <tr><th>Reference</th><th>Venue</th><th>Dates</th><th>Total</th><th></th></tr>
            </thead>
            <tbody>
              {results.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>
                      {b.booking_reference ?? `#${b.id}`}
                    </span>
                    {b.guest_name && <div className="v-slug">{b.guest_name}</div>}
                  </td>
                  <td className="v-slug">{b.venues?.venue_name}</td>
                  <td className="v-slug">{b.date_from} to {b.date_to}</td>
                  <td className="v-slug">{money(b.total, b.currency)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn" onClick={() => setChosen(b)}>Choose</button>
                  </td>
                </tr>
              ))}
              {!results.length && (
                <tr><td colSpan={5} className="v-slug">Nothing matching that.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <>
            <div className="note">
              <strong>{chosen.booking_reference ?? `#${chosen.id}`}</strong>
              {' · '}{chosen.venues?.venue_name}
              {' · '}{money(chosen.total, chosen.currency)}
              <button className="link-btn" style={{ marginLeft: 12 }}
                onClick={() => setChosen(null)}>Change</button>
            </div>

            {!!owing.length && (
              <table>
                <thead><tr><th>Still owing</th><th>Due</th><th>Amount</th></tr></thead>
                <tbody>
                  {owing.map((s) => (
                    <tr key={s.id}>
                      <td className="v-slug">{s.label}</td>
                      <td className="v-slug">{s.due_date}</td>
                      <td className="v-slug">{money(s.amount, chosen.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="grid" style={{ marginTop: 'var(--s4)' }}>
              <div className="f">
                <label htmlFor="amount">How much</label>
                <input id="amount" type="number" data-bwignore style={sel}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <span className="help">
                  {owing.length
                    ? `Matches itself to an instalment where the amount fits.`
                    : 'Nothing is scheduled on this booking.'}
                </span>
              </div>

              <div className="f">
                <label htmlFor="method">How it came</label>
                <select id="method" style={sel} value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>

              <div className="f">
                <label htmlFor="paidOn">When it arrived</label>
                <input id="paidOn" type="date" data-bwignore style={sel}
                  value={form.paidOn}
                  onChange={(e) => setForm({ ...form, paidOn: e.target.value })} />
              </div>

              <div className="f">
                <label htmlFor="reference">Their reference</label>
                <input id="reference" data-bwignore style={sel} value={form.reference}
                  placeholder="CBA-8842119"
                  onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                <span className="help">What appears on the statement, so it can be found again.</span>
              </div>

              <div className="f">
                <label htmlFor="into">Which account</label>
                <input id="into" data-bwignore style={sel} value={form.into}
                  onChange={(e) => setForm({ ...form, into: e.target.value })} />
                <span className="help">
                  A transfer to the wrong entity happens and is hard to trace without this.
                </span>
              </div>

              <div className="f">
                <label htmlFor="payerName">Who paid</label>
                <input id="payerName" data-bwignore style={sel} value={form.payerName}
                  onChange={(e) => setForm({ ...form, payerName: e.target.value })} />
              </div>

              <div className="f" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="why">Why by hand</label>
                <input id="why" data-bwignore style={sel} value={form.why}
                  placeholder="Site was down, host transferred directly"
                  onChange={(e) => setForm({ ...form, why: e.target.value })} />
              </div>
            </div>

            <button className="btn" disabled={pending || !form.amount}
              style={{ marginTop: 'var(--s3)' }}
              onClick={() => act(async () => {
                const r = await recordPayment({
                  bookingId: chosen.id,
                  amount: Number(form.amount),
                  method: form.method,
                  paidOn: form.paidOn,
                  reference: form.reference || undefined,
                  payerName: form.payerName || undefined,
                  into: form.into || undefined,
                  why: form.why || undefined,
                });
                if (r.ok) {
                  setForm({ ...form, amount: '', reference: '', why: '' });
                  owingOn(chosen.id).then(setDetail);
                }
                return r;
              })}>
              Record it
            </button>

            <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
              It counts as paid straight away and goes on the list below until somebody has
              seen it on a statement. A payment Stripe confirmed is a fact; this is somebody&rsquo;s
              word, which is usually right and is not the same thing.
            </div>
          </>
        )}
      </div>

      <div className="sect">
        <h3>Not yet matched to a statement</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          {unreconciled.length
            ? `${unreconciled.length} waiting`
            : 'Nothing waiting'}
        </div>

        {!!unreconciled.length && (
          <table>
            <thead>
              <tr><th>Booking</th><th>Amount</th><th>How</th><th>Reference</th>
                  <th>Waiting</th><th></th></tr>
            </thead>
            <tbody>
              {unreconciled.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>
                      {p.booking_reference}
                    </span>
                    <div className="v-slug">{p.venue_name}</div>
                  </td>
                  <td className="v-slug">{money(p.amount, p.currency)}</td>
                  <td className="v-slug">
                    {p.method}
                    {p.received_into && <div>into {p.received_into}</div>}
                  </td>
                  <td className="v-slug">{p.external_reference ?? '—'}</td>
                  <td className="v-slug"
                      style={{ color: p.days_unchecked > 14 ? 'var(--warn)' : undefined }}>
                    {p.days_unchecked} days
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(() => markReconciled(p.id))}>
                      Seen it
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
