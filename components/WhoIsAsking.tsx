'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import {
  attachPerson, createPersonFrom, findPeople, historyFor,
} from '@/app/actions/concierge';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   WHO IS ASKING

   Somebody rings and is usually already here. Searching first is faster
   than typing their details again, and it keeps their history in one
   place rather than in two records that quietly disagree.

   What they have asked for before is the useful part. A host on their
   fourth enquiry is a different conversation from a first one, and
   without it every call starts from nothing.
   ═══════════════════════════════════════════════════════════════════════ */

export default function WhoIsAsking({
  enquiryId, kind, attached,
}: {
  enquiryId: number;
  kind: 'host' | 'guest';
  attached: { id: number; name: string } | null;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (attached) return;
    const t = setTimeout(() => { findPeople(search, kind).then(setPeople); }, 250);
    return () => clearTimeout(t);
  }, [search, kind, attached]);

  useEffect(() => {
    if (attached) historyFor(kind, attached.id).then(setHistory);
  }, [attached, kind]);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  const label = kind === 'host' ? 'retreat host' : 'wellness guest';

  if (attached) {
    const previous = history.filter((h) => h.id !== enquiryId);

    return (
      <div className="sect">
        <h3>Who is asking</h3>
        <div className="note">
          <strong>{attached.name}</strong>
          {' — '}
          <Link href={`/contacts?${kind}=${attached.id}`}>their profile</Link>
          {previous.length
            ? ` · ${previous.length} previous with us`
            : ' · new to us'}
        </div>

        {msg && <div className="note">{msg}</div>}

        {!!previous.length && (
          <table>
            <thead><tr><th>What</th><th>Venue</th><th>When</th><th>State</th></tr></thead>
            <tbody>
              {previous.map((h) => (
                <tr key={`${h.kind}-${h.id}`}>
                  <td>
                    <Link href={h.kind === 'Enquiry'
                      ? `/concierge/${h.id}` : `/bookings/${h.id}`}
                      style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 14 }}>
                        {h.reference ?? `${h.kind} ${h.id}`}
                      </span>
                    </Link>
                    <div className="v-slug">{h.kind}</div>
                  </td>
                  <td className="v-slug">{h.venue}</td>
                  <td className="v-slug">
                    {h.date_from
                      ? new Date(h.date_from).toLocaleDateString('en-AU',
                          { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                    {h.guest_count && <div>{h.guest_count} people</div>}
                  </td>
                  <td className="v-slug">{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="sect">
      <h3>Who is asking</h3>
      <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
        Search first — most people ringing are already on record
      </div>

      {msg && <div className="note">{msg}</div>}

      <div className="f">
        <label htmlFor="ps">Name, email, or business</label>
        <input id="ps" data-bwignore style={sel} value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <table>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="v-name" style={{ fontSize: 14 }}>
                  {[p.first_name, p.surname].filter(Boolean).join(' ')}
                </span>
                <div className="v-slug">
                  {[p.business_name, p.email, p.host_type, p.countries?.name]
                    .filter(Boolean).join(' · ')}
                </div>
              </td>
              <td style={{ textAlign: 'right' }}>
                <button className="link-btn" disabled={pending}
                  onClick={() => act(() => attachPerson(enquiryId, kind, p.id))}>
                  This one
                </button>
              </td>
            </tr>
          ))}
          {!people.length && (
            <tr><td className="v-slug">
              {search ? 'Nobody matching that.' : 'Start typing to search.'}
            </td></tr>
          )}
        </tbody>
      </table>

      <div className="note" style={{ marginTop: 'var(--s4)' }}>
        Not here yet? Fill in their name and email in the fields below, then record them as a
        new {label} — it uses what is already on this enquiry rather than asking twice.
      </div>

      <button className="btn quiet" disabled={pending}
        onClick={() => act(() => createPersonFrom(enquiryId, kind))}>
        Record them as a new {label}
      </button>
    </div>
  );
}
