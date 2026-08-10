'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { markMatured, saveTier } from '@/app/actions/commission';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const money = (n: unknown, ccy = 'AUD') =>
  n == null ? '—'
    : `${ccy} ${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2 })}`;

const STATUS_COLOUR: Record<string, string> = {
  Accruing: 'var(--muted)', Due: 'var(--warn)', Invoiced: 'var(--ink-gold)',
  Paid: 'var(--ok)', Waived: 'var(--muted)', 'Written off': 'var(--bad)',
};

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   SUBSCRIPTIONS AND COMMISSION

   The rate is captured when a booking is made and never recalculated. A
   venue moving from Essentials to Premium keeps the old rate on
   everything booked before the change — that is what was agreed at the
   time, and recalculating would rewrite history in TGS's favour.
   ═══════════════════════════════════════════════════════════════════════ */

export default function SubscriptionsAndCommission({
  tiers, subscriptions, owing, summary,
}: { tiers: Row[]; subscriptions: Row[]; owing: Row[]; summary: Row }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : (res?.message ?? ''));
    report(res?.ok === false ? 'error' : 'saved');
  });

  const active = subscriptions.filter((s) => s.status === 'Active');
  const byTier = new Map<string, Row[]>();
  for (const s of active) {
    const n = s.subscription_tiers?.name ?? 'No tier';
    byTier.set(n, [...(byTier.get(n) ?? []), s]);
  }

  const c = summary.commission ?? {};
  const totalDue = Number(c.Due ?? 0) + Number(c.Invoiced ?? 0);

  return (
    <>
      <div className="ph">
        <div>
          <h2>Subscriptions &amp; commission</h2>
          <div className="ph-sub">
            {summary.activeSubscriptions} active
            {summary.complimentary ? ` · ${summary.complimentary} complimentary` : ''}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
            onClick={() => act(markMatured)}>
            Mature what has been stayed
          </button>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      <div className="stats" style={{ marginBottom: 'var(--s5)' }}>
        <div className="stat">
          <div className="v">{money(summary.monthlyRecurring)}</div>
          <div className="l">Monthly recurring</div>
        </div>
        <div className="stat">
          <div className="v">{summary.activeSubscriptions}</div>
          <div className="l">Paying venues</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: totalDue ? 'var(--warn)' : undefined }}>
            {money(totalDue)}
          </div>
          <div className="l">Commission owed</div>
        </div>
        <div className="stat">
          <div className="v">{money(c.Accruing ?? 0)}</div>
          <div className="l">Still accruing</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: 'var(--ok)' }}>{money(c.Paid ?? 0)}</div>
          <div className="l">Collected</div>
        </div>
      </div>

      {/* ── the tiers ─────────────────────────────────────────── */}
      <div className="sect">
        <h3>Tiers</h3>
        <div className="note">
          Changing a rate applies to bookings made from now on. Bookings already taken keep the
          rate they were made at.
        </div>
        <table>
          <thead>
            <tr>
              <th>Tier</th><th>Monthly</th><th>Annual</th>
              <th style={{ width: 110 }}>Commission</th>
              <th style={{ width: 190 }}>Charged on</th>
              <th>Venues</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className="v-name" style={{ fontSize: 16 }}>{t.name}</span>
                  {t.tagline && <div className="v-slug">{t.tagline}</div>}
                </td>
                <td className="v-slug">
                  {Number(t.monthly_price) === 0 ? 'Free' : money(t.monthly_price, t.currency)}
                </td>
                <td className="v-slug">
                  {Number(t.annual_price) === 0 ? '—' : money(t.annual_price, t.currency)}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="number" step="0.5" data-bwignore
                      defaultValue={t.commission_rate} style={{ ...sel, width: 62 }}
                      onBlur={(e) => Number(e.target.value) !== Number(t.commission_rate)
                        && act(() => saveTier(t.id, 'commission_rate',
                                              Number(e.target.value)))} />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>
                </td>
                <td>
                  <select defaultValue={t.commission_basis ?? 'Subtotal'} style={sel}
                    onChange={(e) => act(() => saveTier(t.id, 'commission_basis',
                                                        e.target.value))}>
                    <option value="Subtotal">Subtotal, less tax and fees</option>
                    <option value="Total">The whole total</option>
                    <option value="Accommodation only">Accommodation only</option>
                  </select>
                </td>
                <td className="v-slug">
                  {(byTier.get(t.name) ?? []).length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <strong>Charged on the subtotal less tax and fees, by default.</strong> A venue quoting
          $4,276 including a tourism levy and a card fee has not earned $4,276.
        </div>
      </div>

      {/* ── what is owed ──────────────────────────────────────── */}
      <div className="sect">
        <h3>Commission owing</h3>
        {!owing.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            Nothing yet. Commission is written onto each booking as it is made, and falls due
            seven days after the stay ends.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Venue</th><th>Bookings</th><th>Accruing</th><th>Due</th>
                <th>Invoiced</th><th>Paid</th><th>Oldest</th>
              </tr>
            </thead>
            <tbody>
              {owing.map((o) => (
                <tr key={`${o.venue_id}-${o.currency}`}>
                  <td>
                    <Link href={`/venues/${o.venue_id}/subscription`}
                          style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 15 }}>{o.venue_name}</span>
                    </Link>
                  </td>
                  <td className="v-slug">{o.bookings}</td>
                  <td className="v-slug">{money(o.accruing, o.currency)}</td>
                  <td style={{ color: Number(o.due) ? 'var(--warn)' : undefined }}>
                    {money(o.due, o.currency)}
                  </td>
                  <td className="v-slug">{money(o.invoiced, o.currency)}</td>
                  <td style={{ color: Number(o.paid) ? 'var(--ok)' : undefined }}>
                    {money(o.paid, o.currency)}
                  </td>
                  <td className="v-slug">
                    {o.oldest_due
                      ? new Date(o.oldest_due).toLocaleDateString('en-AU',
                          { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── who is on what ────────────────────────────────────── */}
      <div className="sect">
        <h3>Who is on what</h3>
        {!active.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            No active subscriptions. A venue without one is charged Essentials terms at 20%.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Venue</th><th>Tier</th><th>Paying</th>
                <th>Commission</th><th>Renews</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => {
                const negotiated = s.commission_rate != null
                  && Number(s.commission_rate) !== Number(s.subscription_tiers?.commission_rate);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/venues/${s.venues?.id}/subscription`}
                            style={{ textDecoration: 'none' }}>
                        <span className="v-name" style={{ fontSize: 15 }}>
                          {s.venues?.venue_name}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="pill gold">{s.subscription_tiers?.name}</span>
                      {s.is_complimentary && (
                        <div className="v-slug">Complimentary</div>
                      )}
                    </td>
                    <td className="v-slug">
                      {s.is_complimentary ? '—'
                        : `${money(s.charged_price, s.currency)} ${
                            s.billing_period === 'Annual' ? 'a year' : 'a month'}`}
                    </td>
                    <td>
                      {s.commission_rate ?? s.subscription_tiers?.commission_rate}%
                      {negotiated && (
                        <div className="v-slug" style={{ color: 'var(--ink-gold)' }}>
                          negotiated
                        </div>
                      )}
                    </td>
                    <td className="v-slug">
                      {s.current_period_end
                        ? new Date(s.current_period_end).toLocaleDateString('en-AU',
                            { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
