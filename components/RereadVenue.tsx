'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { refreshLinks, rereadVenue } from '@/app/actions/venueIntake';
import { useSaveState } from './SaveState';

/* ═══════════════════════════════════════════════════════════════════════
   RE-READ

   A venue redesigns its site, adds a shala, changes its rates. Reading it
   again should be one click.

   Nothing is overwritten. A re-read produces a list of what differs, and
   each difference is accepted or ignored — a re-read that silently
   replaced a corrected record would undo the checking that made it
   correct.
   ═══════════════════════════════════════════════════════════════════════ */

export default function RereadVenue({
  venueId, websiteUrl, lastReadAt, lastDraftId,
}: {
  venueId: number;
  websiteUrl: string | null;
  lastReadAt: string | null;
  lastDraftId: number | null;
}) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  if (!websiteUrl) {
    return (
      <div className="note" style={{ marginBottom: 0 }}>
        No website recorded, so there is nothing to read. Add one on the Details tab.
      </div>
    );
  }

  const monthsSince = lastReadAt
    ? Math.round((Date.now() - new Date(lastReadAt).getTime()) / 2_592_000_000)
    : null;

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                    flexWrap: 'wrap' }}>
        <button className="btn" disabled={pending}
          onClick={() => start(async () => {
            report('saving');
            const res = await rereadVenue(venueId);
            if (res.ok && res.draftId) {
              router.push(`/venues/${venueId}/reread?draft=${res.draftId}`);
            } else {
              setMsg((res as any).error);
              report('error', 'Failed');
            }
          })}>
          {pending ? 'Reading their site…' : 'Read their site again'}
        </button>

        <button className="btn quiet" disabled={pending}
          onClick={() => start(async () => {
            report('saving');
            const res = await refreshLinks({ venueId });
            setMsg(res.ok ? (res.message ?? '') : (res as any).error);
            report(res.ok ? 'saved' : 'error');
            if (res.ok) router.refresh();
          })}>
          Find their links — free
        </button>

        <a className="btn quiet" href={websiteUrl} target="_blank" rel="noopener">
          Open the site
        </a>

        {lastDraftId && (
          <Link className="btn quiet" href={`/venues/${venueId}/reread?draft=${lastDraftId}`}>
            Last read
          </Link>
        )}

        <span className="help" style={{ margin: 0 }}>
          {lastReadAt
            ? `Last read ${monthsSince === 0 ? 'this month'
                : monthsSince === 1 ? 'a month ago' : `${monthsSince} months ago`}`
            : 'Never read'}
        </span>
      </div>

      {lastReadAt && (
        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <strong>Costs nothing where their site has not changed.</strong> Each page is fetched and
          compared against the last read — that part is free. The model is only called where
          something has actually moved, so re-reading an unchanged site costs nothing at all.
        </div>
      )}

      {msg && (
        <div className={`note ${/could not|no /i.test(msg) ? 'bad' : ''}`}
             style={{ marginTop: 'var(--s4)' }}>{msg}</div>
      )}
    </>
  );
}
