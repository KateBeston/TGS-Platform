'use client';

import { useState, useTransition } from 'react';
import { calculateAllForVenue } from '@/app/actions/travelTime';
import { useSaveState } from './SaveState';

/** Works out travel times from the venue rather than accepting typed
 *  ones.
 *
 *  A typed figure goes stale quietly — a road closes, a ferry changes
 *  timetable, and the page keeps saying twenty minutes for three years.
 *  Anything already marked as stated by the venue is left alone; that is
 *  their claim, not a measurement.
 */
export default function TravelTimes({
  venueId, count, calculated,
}: { venueId: number; count: number; calculated: number }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  if (!count) return null;

  return (
    <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                  flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
      <button className="btn quiet" disabled={pending}
        onClick={() => start(async () => {
          report('saving');
          const r = await calculateAllForVenue(venueId);
          setMsg(r.ok ? (r.message ?? '') : (r as any).error);
          report(r.ok ? 'saved' : 'error');
        })}>
        {pending ? 'Asking Google…' : `Calculate ${count} travel time${count === 1 ? '' : 's'}`}
      </button>
      <span className="help" style={{ margin: 0 }}>
        {msg || (calculated
          ? `${calculated} of ${count} calculated`
          : 'Needs the venue to have coordinates first')}
      </span>
    </div>
  );
}
