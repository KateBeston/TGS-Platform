'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  buildStatement, setStatementFrequency, setStatementStatus,
} from '@/app/actions/billing';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const money = (n: unknown, ccy = 'AUD') =>
  n == null ? '—' : `${ccy} ${Number(n).toLocaleString('en-AU',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FREQUENCIES = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'On request'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '5px 7px', fontSize: 12, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   STATEMENTS

   Not invoices. A statement says what happened over a period — what was
   booked, what commission cost, what was left — and asks for nothing. It
   is the document a venue forwards to their accountant.

   How often is the venue's choice. One taking two bookings a year does
   not want twelve statements, and one taking forty does not want one.
   ═══════════════════════════════════════════════════════════════════════ */

export default function StatementsScreen({
  statements, due,
}: { statements: Row[]; due: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  /** The period a statement should cover, from the venue's own
   *  frequency — back from today by however long they asked for. */
  const periodFor = (frequency: string) => {
    const to = new Date();
    const from = new Date(to);
    const months = frequency === 'Monthly' ? 1
      : frequency === 'Quarterly' ? 3
      : frequency === 'Half-yearly' ? 6 : 12;
    from.setMonth(from.getMonth() - months);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  };

  return (
    <>
      <div className="ph">
        <div>
          <h2>Statements</h2>
          <div className="ph-sub">
            {statements.length} issued
            {due.length ? ` · ${due.length} due` : ''}
          </div>
        </div>
      </div>

      <div className="note">
        A statement says what happened over a period and asks for nothing — it is the document a
        venue forwards to their accountant. Invoices are separate.
      </div>

      {msg && <div className="note">{msg}</div>}

      {!!due.length && (
        <div className="sect">
          <h3>Due now</h3>
          <table>
            <thead>
              <tr>
                <th>Venue</th><th style={{ width: 150 }}>How often</th>
                <th>Last one</th><th>Bookings since</th><th></th>
              </tr>
            </thead>
            <tbody>
              {due.map((d) => (
                <tr key={d.venue_id}>
                  <td>
                    <Link href={`/venues/${d.venue_id}/details`}
                          style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 15 }}>{d.venue_name}</span>
                    </Link>
                  </td>
                  <td>
                    <select defaultValue={d.statement_frequency} style={sel}
                      onChange={(e) => act(() =>
                        setStatementFrequency(d.venue_id, e.target.value))}>
                      {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </td>
                  <td className="v-slug">
                    {d.last_statement_at
                      ? new Date(d.last_statement_at).toLocaleDateString('en-AU',
                          { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Never'}
                  </td>
                  <td className="v-slug">{d.bookings_since}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn quiet" disabled={pending}
                      onClick={() => {
                        const p = periodFor(d.statement_frequency);
                        act(() => buildStatement(d.venue_id, p.from, p.to));
                      }}>
                      Build it
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sect">
        <h3>Issued</h3>
        {!statements.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            None yet. A statement covers a period, so there has to be a period with something in it.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Number</th><th>Venue</th><th>Period</th><th>Bookings</th>
                <th>Gross</th><th>Commission</th><th>Net</th><th>State</th><th></th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>
                      {s.statement_number}
                    </span>
                  </td>
                  <td>{s.venues?.venue_name}</td>
                  <td className="v-slug" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(s.period_start).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short' })}
                    {' to '}
                    {new Date(s.period_end).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="v-slug">{s.booking_count}</td>
                  <td>{money(s.gross_bookings, s.currency)}</td>
                  <td style={{ color: 'var(--ink-gold)' }}>
                    {money(s.commission_charged, s.currency)}
                  </td>
                  <td>{money(s.net_paid_out, s.currency)}</td>
                  <td>
                    <span className="pill empty">{s.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {s.status === 'Draft' && (
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() => setStatementStatus(s.id, 'Issued'))}>
                        Issue
                      </button>
                    )}
                    {s.status === 'Issued' && (
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() => setStatementStatus(s.id, 'Sent'))}>
                        Mark sent
                      </button>
                    )}
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
