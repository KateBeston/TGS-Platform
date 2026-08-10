'use client';

import { useState, useTransition } from 'react';
import { setLaunchDate } from '@/app/actions/milestones';

/* When the platform went live.
 *
 * One date, and a surprising amount depends on it. The complimentary
 * six months counts from here, and the legal wording switches from the
 * interim terms to the subscription terms on the day it ends.
 *
 * Deliberately empty until it is true. A guessed date would put a wrong
 * one in front of venues, and a date told to venues and then moved is
 * one somebody has to apologise for. */

export default function LaunchDate({
  wentLiveAt, months, inWords,
}: { wentLiveAt: string | null; months: number; inWords: string }) {
  const [date, setDate] = useState(wentLiveAt ?? '');
  const [busy, start] = useTransition();
  const [said, setSaid] = useState('');

  const save = () => start(async () => {
    const r = await setLaunchDate(date || null, months);
    setSaid(r.error ?? 'Saved.');
  });

  return (
    <div className="card">
      <h3>Launch date</h3>

      <div className="note">
        {inWords}
      </div>

      <div className="f">
        <label htmlFor="live">The platform went live on</label>
        <input id="live" type="date" value={date}
          onChange={(e) => setDate(e.target.value)} />
        <span className="help">
          Leave empty until it is actually true. The complimentary {months} months
          counts from this date, and the venue agreements switch from the concierge
          wording to the subscription wording when it ends.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center',
                    marginTop: 'var(--s4)' }}>
        <button className="btn primary" disabled={busy} onClick={save}>
          {busy ? 'Saving' : 'Save'}
        </button>
        {said && <span className="muted small">{said}</span>}
      </div>

      {!wentLiveAt && (
        <div className="note" style={{ marginTop: 'var(--s4)' }}>
          Setting this changes what venues see on <strong>List your venue</strong> and
          starts the clock on the concierge period. Worth being sure before you do.
        </div>
      )}
    </div>
  );
}
