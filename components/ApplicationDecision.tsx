'use client';

import { useState, useTransition } from 'react';
import { makeVenue, setStatus } from '@/app/actions/applications';

/* Reading an application through to a decision.
 *
 * Accepting and making the venue are two acts, not one. Accepting says
 * we want them; making the venue copies their claims across as a
 * starting point. Doing both at once would put unverified text into the
 * collection with nothing marking it as unread. */

export default function ApplicationDecision({
  id, status, venueId,
}: { id: number; status: string; venueId: number | null }) {
  const [busy, start] = useTransition();
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');

  const go = (s: string) => start(async () => {
    const r = await setStatus(id, s, note || undefined);
    setProblem(r.error ?? '');
  });

  const convert = () => start(async () => {
    const r = await makeVenue(id);
    setProblem(r.error ?? '');
  });

  return (
    <div className="card">
      <h3>Decision</h3>
      <div className="muted small" style={{ marginBottom: 'var(--s4)' }}>
        Currently {status}
      </div>

      <div className="f">
        <label htmlFor="note">A note, for whoever reads this next</label>
        <textarea id="note" rows={3} value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why, in a sentence" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'var(--s4)' }}>
        {status === 'Submitted' && (
          <button className="btn" disabled={busy} onClick={() => go('Reading it')}>
            Reading it
          </button>
        )}
        {status !== 'Accepted' && status !== 'Declined' && (
          <>
            <button className="btn" disabled={busy}
              onClick={() => go('Asked them something')}>
              Asked them something
            </button>
            <button className="btn primary" disabled={busy} onClick={() => go('Accepted')}>
              Accept
            </button>
            <button className="btn" disabled={busy} onClick={() => go('Declined')}>
              Decline
            </button>
          </>
        )}
        {status === 'Accepted' && !venueId && (
          <button className="btn primary" disabled={busy} onClick={convert}>
            Make the venue
          </button>
        )}
      </div>

      {status === 'Accepted' && !venueId && (
        <div className="note" style={{ marginTop: 'var(--s4)' }}>
          The venue is made as <strong>Sourced</strong>, not Live. Everything they
          wrote comes across as a starting point and none of it has been checked.
        </div>
      )}

      {venueId && (
        <div className="note" style={{ marginTop: 'var(--s4)' }}>
          Venue made. <a href={`/venues/${venueId}/overview`}>Open it</a>
        </div>
      )}

      {problem && <div className="note warn" style={{ marginTop: 'var(--s4)' }}>{problem}</div>}
    </div>
  );
}
