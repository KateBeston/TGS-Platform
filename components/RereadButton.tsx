'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { rereadVenue } from '@/app/actions/venueIntake';
import { useSaveState } from './SaveState';

/* ═══════════════════════════════════════════════════════════════════════
   READ IT AGAIN, FROM ANYWHERE

   The same thing the Site reads tab does, put where somebody actually
   notices a record is stale — which is while looking at it, not after
   navigating to a tab about reading.

   Costs nothing where nothing has changed. Pages are hashed and compared,
   so an untouched site is a few fetches and no model call.
   ═══════════════════════════════════════════════════════════════════════ */

export default function RereadButton({
  venueId, hasWebsite, lastRead,
}: { venueId: number; hasWebsite: boolean; lastRead: string | null }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  if (!hasWebsite) return null;

  const days = lastRead
    ? Math.floor((Date.now() - new Date(lastRead).getTime()) / 86_400_000)
    : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                  flexWrap: 'wrap' }}>
      <button className="btn quiet" disabled={pending}
        onClick={() => start(async () => {
          report('saving');
          const r = await rereadVenue(venueId);
          setMsg(r.ok ? (r.message ?? 'Read.') : (r as any).error);
          report(r.ok ? 'saved' : 'error');

          if (!r.ok) return;

          // Where something changed there is a decision to make, so go to
          // it. Where nothing did, stay put — sending somebody to a
          // screen that says "no differences" is a wasted click.
          const draftId = (r as any).draftId;
          const nothingChanged = /nothing has changed/i.test(r.message ?? '');

          if (draftId && !nothingChanged) {
            router.push(`/venues/${venueId}/reread?draft=${draftId}`);
          } else {
            router.refresh();
          }
        })}>
        {pending ? 'Reading their site…' : 'Read their site again'}
      </button>

      <span style={{ fontSize: 11.5, color: 'var(--ink-quiet)' }}>
        {msg || (days === null
          ? 'Never read'
          : days === 0 ? 'Read today'
          : days === 1 ? 'Read yesterday'
          : `Last read ${days} days ago`)}
      </span>
    </div>
  );
}
