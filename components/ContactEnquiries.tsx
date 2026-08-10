'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { startEnquiryFor } from '@/app/actions/concierge';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   WHAT THIS PERSON HAS ASKED FOR

   The other door into the concierge. Somebody on the phone about a new
   retreat is already on record, and starting from their profile carries
   their details across rather than asking again.

   Their history is the useful part. A host on their fourth enquiry is a
   different conversation from a first one, and without it every call
   starts from nothing.
   ═══════════════════════════════════════════════════════════════════════ */

export default function ContactEnquiries({
  roles, history,
}: {
  roles: { host: Row | null; guest: Row | null };
  history: Row[];
}) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const begin = (kind: 'host' | 'guest', personId: number) => start(async () => {
    report('saving');
    const r = await startEnquiryFor(kind, personId);
    report(r.ok ? 'saved' : 'error');
    if (r.ok && r.id) router.push(`/concierge/${r.id}`);
    else setMsg((r as any).error);
  });

  if (!roles.host && !roles.guest) {
    return (
      <div className="sect">
        <h3>Enquiries and bookings</h3>
        <div className="note" style={{ marginBottom: 0 }}>
          This contact is not recorded as a retreat host or a wellness guest, so there is
          nothing to attach an enquiry to yet. One is created the first time they ask for
          something through the concierge.
        </div>
      </div>
    );
  }

  const enquiries = history.filter((h) => h.kind === 'Enquiry');
  const bookings = history.filter((h) => h.kind === 'Booking');

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
            Enquiries and bookings
          </h3>
          <div className="ph-sub">
            {enquiries.length} enquir{enquiries.length === 1 ? 'y' : 'ies'}
            {bookings.length ? ` · ${bookings.length} booked` : ''}
          </div>
        </div>
        <div className="ph-act">
          {roles.host && (
            <button className="btn" disabled={pending}
              onClick={() => begin('host', roles.host!.id)}>
              New retreat enquiry
            </button>
          )}
          {roles.guest && (
            <button className="btn quiet" disabled={pending}
              onClick={() => begin('guest', roles.guest!.id)}>
              New wellness enquiry
            </button>
          )}
        </div>
      </div>

      {msg && <div className="note bad">{msg}</div>}

      {!history.length ? (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing yet. Starting one from here carries their details across, so the first step
          is already answered.
        </div>
      ) : (
        <table>
          <thead>
            <tr><th>Reference</th><th>Venue</th><th>When</th><th>Worth</th><th>State</th></tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={`${h.kind}-${h.id}`}>
                <td>
                  <Link href={h.kind === 'Enquiry'
                    ? `/concierge/${h.id}` : `/bookings/${h.id}`}
                    style={{ textDecoration: 'none' }}>
                    <span className="v-name" style={{ fontSize: 14 }}>
                      {h.reference ?? `${h.kind} ${h.id}`}
                    </span>
                  </Link>
                  <div className="v-slug">{h.kind} · {h.enquiry_type}</div>
                </td>
                <td className="v-slug">{h.venue}</td>
                <td className="v-slug">
                  {h.date_from
                    ? new Date(h.date_from).toLocaleDateString('en-AU',
                        { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                  {h.guest_count && <div>{h.guest_count} people</div>}
                </td>
                <td className="v-slug">
                  {h.value ? `${h.currency ?? ''} ${Number(h.value).toLocaleString()}` : '—'}
                </td>
                <td><span className="pill empty">{h.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
