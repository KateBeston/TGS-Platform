'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  alternatives, excludeAlternative, pinAlternative, type Kind,
} from '@/app/actions/curation';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const KINDS: { key: Kind; label: string; asks: string }[] = [
  { key: 'Nearby', label: 'Nearby',
    asks: 'Somewhere else in the same area, whatever it is. What a guest wants when the place is right and the dates are not.' },
  { key: 'Like this', label: 'Like this',
    asks: 'The same kind of venue, wherever it is. What somebody browsing a bathhouse wants next.' },
  { key: 'Instead', label: 'Instead',
    asks: 'Same capacity, same region. What a retreat host wants when their dates could not be held.' },
];

/* ═══════════════════════════════════════════════════════════════════════
   SIMILAR VENUES

   Worked out rather than chosen, because 5,888 venues cannot be paired by
   hand and an empty section on every listing is worse than an imperfect
   one.

   But "similar" is three questions, not one, and they give different
   answers. Scored separately.

   Anything pinned wins outright — a deliberate pairing is a judgement and
   a score is not. Two venues with the same owner, or one that takes the
   overflow every summer, are facts no function can see.
   ═══════════════════════════════════════════════════════════════════════ */

export default function SimilarVenues({
  venueId, initial,
}: { venueId: number; initial: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<Kind>('Like this');
  const [rows, setRows] = useState<Row[]>(initial);
  const [msg, setMsg] = useState('');

  const load = (k: Kind) => start(async () => {
    setKind(k);
    setRows(await alternatives(venueId, k));
  });

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
    if (r?.ok !== false) setRows(await alternatives(venueId, kind));
  });

  const current = KINDS.find((k) => k.key === kind)!;

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
            What else to show
          </h3>
          <div className="ph-sub">
            Worked out from location, type, practices and size
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap',
                    marginBottom: 'var(--s3)' }}>
        {KINDS.map((k) => (
          <button key={k.key} type="button"
            className={`btn ${kind === k.key ? '' : 'quiet'}`}
            disabled={pending}
            onClick={() => load(k.key)}>
            {k.label}
          </button>
        ))}
      </div>

      <div className="note">{current.asks}</div>

      {msg && <div className="note">{msg}</div>}

      {!rows.length ? (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing scores high enough. Usually means the venue has no type, no
          practices and no location recorded — the three things this reads.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Venue</th><th>Why</th><th>Sleeps</th>
              <th style={{ width: 150 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.venue_id}>
                <td>
                  <Link href={`/venues/${r.venue_id}/details`}
                        style={{ textDecoration: 'none' }}>
                    <span className="v-name" style={{ fontSize: 15 }}>
                      {r.venue_name}
                    </span>
                  </Link>
                  <div className="v-slug">
                    {[r.city, r.country].filter(Boolean).join(', ')}
                    {r.venue_type && ` · ${r.venue_type}`}
                  </div>
                </td>
                <td>
                  {r.is_pinned ? (
                    <span className="pill gold" style={{ fontSize: 9 }}>
                      Pinned{r.why && r.why !== 'Chosen' ? ` · ${r.why}` : ''}
                    </span>
                  ) : (
                    <>
                      <div className="v-slug">{r.why}</div>
                      <div className="v-slug" style={{ color: 'var(--muted)' }}>
                        {Math.round(Number(r.score) * 100)}%
                      </div>
                    </>
                  )}
                </td>
                <td className="v-slug">{r.max_guests ?? '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {!r.is_pinned && (
                    <>
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() =>
                          pinAlternative(venueId, r.venue_id))}>
                        Pin
                      </button>
                      {' · '}
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() =>
                          excludeAlternative(venueId, r.venue_id))}>
                        Never
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
        Pinned venues always show, and always first. Everything else is recalculated each
        time, so a venue that improves its record starts appearing on its own.
      </div>
    </div>
  );
}
