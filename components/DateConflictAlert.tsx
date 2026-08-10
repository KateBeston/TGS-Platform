'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { checkDateRange, type DateConflict } from '@/app/actions/scheduling';

/* ═══════════════════════════════════════════════════════════════════════
   DATE CONFLICT ALERT

   Fires when a chosen range contains a public holiday or a venue closure.

   Two levels on purpose. A blocking modal appears only where something is
   confirmed — a venue closure, or a holiday the venue has told us it
   shuts for. Everything else is an inline warning, because a modal that
   interrupts every date entry stops being read within a week.

   The three actions are the ones actually available: confirm with the
   venue, choose different dates, or look at what the venue's record
   already says.
   ═══════════════════════════════════════════════════════════════════════ */

export default function DateConflictAlert({
  dateFrom, dateTo, countryCode, venueIds, venueLinkId, onChooseDifferent,
}: {
  dateFrom: string | null;
  dateTo: string | null;
  countryCode?: string | null;
  venueIds?: number[];
  venueLinkId?: number;
  onChooseDifferent?: () => void;
}) {
  const [conflicts, setConflicts] = useState<DateConflict[]>([]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const key = `${dateFrom}|${dateTo}|${(venueIds ?? []).join(',')}`;

  useEffect(() => {
    if (!dateFrom) { setConflicts([]); return; }
    let cancelled = false;
    setChecking(true);
    checkDateRange(dateFrom, dateTo, { countryCode, venueIds })
      .then((c) => { if (!cancelled) { setConflicts(c); setChecking(false); } })
      .catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (checking || !conflicts.length) return null;

  const confirmed = conflicts.filter((c) => c.severity === 'confirmed' && c.kind !== 'holiday');
  const confirmedClosed = conflicts.filter(
    (c) => c.severity === 'confirmed' && /closed|closure|maintenance|private/i.test(c.detail ?? c.name));
  const assumed = conflicts.filter((c) => c.severity === 'assumed');
  const showModal = confirmedClosed.length > 0 && dismissed !== key;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

  const List = () => (
    <ul style={{ margin: '0 0 var(--s3)', paddingLeft: 18 }}>
      {conflicts.map((c, i) => (
        <li key={i} style={{ marginBottom: 5, fontSize: 13 }}>
          <strong>{fmt(c.date)}{c.dateTo && c.dateTo !== c.date ? ` to ${fmt(c.dateTo)}` : ''}</strong>
          {' · '}{c.name}
          {c.detail && (
            <span style={{ color: 'var(--ink-quiet)' }}> — {c.detail}</span>
          )}
          {c.severity === 'assumed' && (
            <span style={{ color: 'var(--warn)' }}> · not confirmed</span>
          )}
        </li>
      ))}
    </ul>
  );

  const Actions = () => (
    <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap',
                  alignItems: 'center', marginTop: 'var(--s3)' }}>
      {onChooseDifferent && (
        <button className="btn quiet" onClick={onChooseDifferent}>Choose other dates</button>
      )}
      {venueLinkId && (
        <Link className="btn quiet" href={`/venues/${venueLinkId}/scheduling`}>
          Venue holiday record
        </Link>
      )}
      <span style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
        Confirm directly with the venue before quoting these dates.
      </span>
    </div>
  );

  return (
    <>
      {showModal && (
        <div role="dialog" aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(49,49,49,.55)',
                   display: 'grid', placeItems: 'center', zIndex: 100, padding: 'var(--s5)' }}
          onClick={() => setDismissed(key)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--warm-white)', border: '1px solid var(--border)',
                     maxWidth: 560, width: '100%', padding: 'var(--s7) var(--s6) var(--s6)' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.3em', textTransform: 'uppercase',
                          color: 'var(--bad)' }}>
              Check before quoting
            </div>
            <h2 style={{ fontSize: 27, margin: 'var(--s2) 0 var(--s4)' }}>
              These dates fall on a closure
            </h2>
            <List />
            <div className="note" style={{ marginBottom: 0 }}>
              A closure is something the venue has told us. Quoting these dates without checking
              risks confirming a booking the venue cannot honour.
            </div>
            <Actions />
            <div style={{ marginTop: 'var(--s5)', textAlign: 'right' }}>
              <button className="btn" onClick={() => setDismissed(key)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="note bad" style={{ marginTop: 'var(--s3)' }}>
        <strong>
          {conflicts.length} {conflicts.length === 1 ? 'date' : 'dates'} in this range
          {confirmed.length ? ' are affected' : ' may be affected'}.
        </strong>
        <div style={{ marginTop: 'var(--s3)' }}><List /></div>
        {!!assumed.length && (
          <div style={{ fontSize: 12.5 }}>
            Items marked <em>not confirmed</em> are our working assumption — nobody has asked the
            venue. Confirming it on the venue's Scheduling tab records the answer for next time.
          </div>
        )}
        <Actions />
      </div>
    </>
  );
}
