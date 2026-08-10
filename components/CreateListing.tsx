'use client';

import { useTransition } from 'react';
import { createListing } from '@/app/actions/listings';
import { useSaveState } from './SaveState';

export default function CreateListing({
  venueId, canRetreat, canWellness,
}: { venueId: number; canRetreat: boolean; canWellness: boolean }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();

  const make = (m: 'Retreat' | 'Wellness') =>
    start(async () => {
      report('saving');
      const res = await createListing(venueId, m);
      report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not created');
    });

  if (!canRetreat && !canWellness) {
    return <div className="note">This venue has a listing in both marketplaces.</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--s3)' }}>
      {canRetreat && (
        <button className="btn" disabled={pending} onClick={() => make('Retreat')}>
          Create retreat listing
        </button>
      )}
      {canWellness && (
        <button className="btn" disabled={pending} onClick={() => make('Wellness')}>
          Create wellness listing
        </button>
      )}
    </div>
  );
}
