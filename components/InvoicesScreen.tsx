'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { raiseInvoice, setInvoiceStatus } from '@/app/actions/billing';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const money = (n: unknown, ccy = 'AUD') =>
  n == null ? '—' : `${ccy} ${Number(n).toLocaleString('en-AU',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS: Record<string, string> = {
  Draft: 'var(--muted)', Sent: 'var(--ink-gold)', Paid: 'var(--ok)',
  Overdue: 'var(--bad)', Void: 'var(--muted)', Credited: 'var(--warn)',
};

const TABS = ['all', 'Draft', 'Sent', 'Paid', 'Overdue'];

export default function InvoicesScreen({
  invoices, ready, status,
}: { invoices: Row[]; ready: Row[]; status: string }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  const outstanding = invoices
    .filter((i) => ['Sent', 'Overdue'].includes(i.status))
    .reduce((s, i) => s + Number(i.total ?? 0) - Number(i.amount_paid ?? 0), 0);

  return (
    <>
      <div className="ph">
        <div>
          <h2>Invoices</h2>
          <div className="ph-sub">
            {invoices.length} raised
            {outstanding > 0 ? ` · ${money(outstanding)} outstanding` : ''}
          </div>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {!!ready.length && (
        <div className="sect">
          <h3>Ready to invoice</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Commission that has fallen due — one invoice per venue, a line per booking
          </div>
          <table>
            <thead>
              <tr><th>Venue</th><th>Bookings</th><th>Due</th><th>Oldest</th><th></th></tr>
            </thead>
            <tbody>
              {ready.map((r) => (
                <tr key={r.venue_id}>
                  <td>
                    <Link href={`/venues/${r.venue_id}/details`}
                          style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 15 }}>{r.venue_name}</span>
                    </Link>
                  </td>
                  <td className="v-slug">{r.bookings}</td>
                  <td style={{ color: 'var(--warn)' }}>{money(r.due, r.currency)}</td>
                  <td className="v-slug">
                    {r.oldest_due
                      ? new Date(r.oldest_due).toLocaleDateString('en-AU',
                          { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn quiet" disabled={pending}
                      onClick={() => act(() => raiseInvoice(r.venue_id))}>
                      Raise it
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap',
                    margin: 'var(--s5) 0' }}>
        {TABS.map((t) => (
          <Link key={t} className={`btn ${status === t ? '' : 'quiet'}`}
                href={t === 'all' ? '/finance/invoices' : `/finance/invoices?status=${t}`}>
            {t === 'all' ? 'Everything' : t}
          </Link>
        ))}
      </div>

      {!invoices.length ? (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing raised yet.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Number</th><th>Venue</th><th>Issued</th><th>Due</th>
              <th>Total</th><th>State</th><th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => {
              const overdue = i.status === 'Sent'
                && new Date(i.due_date) < new Date();
              return (
                <tr key={i.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>
                      {i.invoice_number}
                    </span>
                    <div className="v-slug">{i.invoice_type}</div>
                  </td>
                  <td>{i.venues?.venue_name ?? i.bill_to_name}</td>
                  <td className="v-slug">
                    {new Date(i.issue_date).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="v-slug" style={{ color: overdue ? 'var(--bad)' : undefined }}>
                    {new Date(i.due_date).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short' })}
                  </td>
                  <td>{money(i.total, i.currency)}</td>
                  <td>
                    <span className="pill" style={{
                      borderColor: STATUS[overdue ? 'Overdue' : i.status],
                      color: STATUS[overdue ? 'Overdue' : i.status],
                    }}>
                      {overdue ? 'Overdue' : i.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {i.status === 'Draft' && (
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() => setInvoiceStatus(i.id, 'Sent'))}>
                        Mark sent
                      </button>
                    )}
                    {['Sent'].includes(i.status) && (
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() => setInvoiceStatus(i.id, 'Paid'))}>
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="note" style={{ marginTop: 'var(--s5)', marginBottom: 0 }}>
        Marking an invoice paid moves the bookings behind it too, so nothing shows as owing twice.
      </div>
    </>
  );
}
