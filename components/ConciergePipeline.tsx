'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { startEnquiry } from '@/app/actions/concierge';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   THE CONCIERGE PIPELINE

   Each state says who is being waited on. The old vocabulary had "In
   Progress" covering searching, presenting, waiting on a host and waiting
   on a venue — four things, three of which somebody else is holding up,
   and a list that cannot tell them apart cannot be worked.

   Wellness and retreat are separate from the first question, because they
   are different searches. A wellness guest wants a treatment on a
   Saturday; a retreat host wants a shala for eighteen people in November.
   ═══════════════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'Draft', label: 'Draft', who: 'Nobody has seen it' },
  { key: 'Searching', label: 'Searching', who: 'Us' },
  { key: 'With the host', label: 'With the host', who: 'Them' },
  { key: 'Accepted', label: 'Accepted', who: 'Us, to approach the venue' },
  { key: 'With the venue', label: 'With the venue', who: 'The venue' },
  { key: 'Booked', label: 'Booked', who: 'Done' },
  { key: 'Looking further afield', label: 'Off market', who: 'Us, going to market' },
  { key: 'Declined', label: 'Declined', who: 'Over' },
];

const when = (d: string | null) => d
  ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  : '—';

export default function ConciergePipeline({
  counts, rows, active, kind,
}: {
  counts: Row[]; rows: Row[]; active: string; kind: string | null;
}) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const countFor = (status: string) => counts
    .filter((c) => c.status === status && (!kind || c.enquiry_type === kind))
    .reduce((t, c) => t + Number(c.how_many ?? 0), 0);

  const overdueFor = (status: string) => counts
    .filter((c) => c.status === status && (!kind || c.enquiry_type === kind))
    .reduce((t, c) => t + Number(c.overdue ?? 0), 0);

  const go = (params: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const merged = { status: active, kind, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    router.push(`/concierge?${q.toString()}`);
  };

  const begin = (type: 'Retreat Host' | 'Wellness Guest') => start(async () => {
    report('saving');
    const r = await startEnquiry(type);
    report(r.ok ? 'saved' : 'error');
    if (r.ok && r.id) router.push(`/concierge/${r.id}`);
    else setMsg((r as any).error);
  });

  return (
    <>
      <div className="ph">
        <div>
          <h2>Concierge</h2>
          <div className="ph-sub">
            {TABS.reduce((t, x) => t + countFor(x.key), 0)} enquiries
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" disabled={pending}
            onClick={() => begin('Wellness Guest')}>New wellness enquiry</button>
          <button className="btn" disabled={pending}
            onClick={() => begin('Retreat Host')}>New retreat enquiry</button>
        </div>
      </div>

      {msg && <div className="note bad">{msg}</div>}

      {/* Wellness and retreat are different searches, so they are
          separated before anything else rather than filtered afterwards. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--s4)' }}>
        {[null, 'Retreat Host', 'Wellness Guest'].map((k) => (
          <button key={k ?? 'all'} type="button"
            className={`pill ${kind === k ? 'gold' : ''}`}
            style={{ cursor: 'pointer',
                     background: kind === k ? undefined : 'var(--warm-white)' }}
            onClick={() => go({ kind: k })}>
            {k === null ? 'Everything' : k === 'Retreat Host' ? 'Retreats' : 'Wellness'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
                    marginBottom: 'var(--s5)', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const n = countFor(t.key);
          const late = overdueFor(t.key);
          return (
            <button key={t.key} type="button"
              onClick={() => go({ status: t.key })}
              title={`Waiting on: ${t.who}`}
              style={{
                background: 'transparent', border: 0,
                borderBottom: active === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                padding: '10px 14px', fontSize: 12, letterSpacing: '.08em',
                textTransform: 'uppercase', cursor: 'pointer',
                color: active === t.key ? 'var(--charcoal)' : 'var(--ink-quiet)',
              }}>
              {t.label}
              {n > 0 && (
                <span style={{ marginLeft: 6, color: 'var(--muted)' }}>{n}</span>
              )}
              {late > 0 && (
                <span style={{ marginLeft: 4, color: 'var(--warn)' }}>·{late}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
        Waiting on {TABS.find((t) => t.key === active)?.who.toLowerCase()}
      </div>

      {!rows.length ? (
        <div className="note">Nothing here.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Who</th><th>What for</th><th>Where and when</th>
              <th>Worth</th><th>Waiting</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const late = e.response_due && new Date(e.response_due) < new Date();
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/concierge/${e.id}`} style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 15 }}>
                        {[e.first_name, e.surname].filter(Boolean).join(' ')
                          || e.email || `Enquiry ${e.id}`}
                      </span>
                    </Link>
                    <div className="v-slug">
                      {e.enquiry_reference ?? `#${e.id}`}
                      {e.host_types?.name ? ` · ${e.host_types.name}` : ''}
                    </div>
                  </td>
                  <td className="v-slug">
                    {e.notes ? String(e.notes).slice(0, 60) : '—'}
                  </td>
                  <td className="v-slug">
                    {e.countries?.name ?? 'Anywhere'}
                    {e.date_from && <div>{when(e.date_from)} to {when(e.date_to)}</div>}
                    {e.guest_count && <div>{e.guest_count} people</div>}
                  </td>
                  <td className="v-slug">
                    {e.estimated_value
                      ? `${e.currency ?? ''} ${Number(e.estimated_value).toLocaleString()}`
                      : e.budget_band ?? '—'}
                  </td>
                  <td className="v-slug"
                      style={{ color: late ? 'var(--bad)' : undefined }}>
                    {e.response_due
                      ? (late ? `Overdue since ${when(e.response_due)}`
                              : `Due ${when(e.response_due)}`)
                      : `${Math.round(
                          (Date.now() - new Date(e.created_at).getTime()) / 86_400_000)} days`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
