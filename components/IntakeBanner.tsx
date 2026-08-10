'use client';

import Link from 'next/link';
import { useState } from 'react';

type Summary = {
  draftId: number;
  sourceUrl: string;
  pagesRead: number;
  pagesFailed: number;
  cost: number | null;
  createdAt: string;
  flags: string[];
  counts: {
    rooms: number; spaces: number; services: number;
    facilities: number; unmatchedServices: number;
  };
};

/* ═══════════════════════════════════════════════════════════════════════
   WHAT THE READ PRODUCED

   Shown on arrival at a venue built from a website. Says what came
   through and what still needs a person, then gets out of the way.

   Deliberately not a permanent panel. The venue record is the venue
   record; where it came from matters for a few minutes and then stops
   mattering.
   ═══════════════════════════════════════════════════════════════════════ */

export default function IntakeBanner({
  summary, venueId,
}: { summary: Summary; venueId: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { counts } = summary;
  const empty = !counts.rooms && !counts.spaces && !counts.services;

  const needsAttention = [
    counts.unmatchedServices > 0
      && `${counts.unmatchedServices} service${counts.unmatchedServices === 1 ? '' : 's'} with no practice`,
    summary.pagesFailed > 0
      && `${summary.pagesFailed} page${summary.pagesFailed === 1 ? '' : 's'} could not be read`,
    !counts.facilities && 'no facilities matched',
  ].filter(Boolean) as string[];

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--gold)',
      padding: 'var(--s5)',
      marginBottom: 'var(--s5)',
      background: 'var(--warm-cream)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 'var(--s4)' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
                        color: 'var(--ink-gold)' }}>
            Built from their website
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-quiet)', marginTop: 5 }}>
            <a href={summary.sourceUrl} target="_blank" rel="noopener">
              {summary.sourceUrl.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
            {' · '}{summary.pagesRead} page{summary.pagesRead === 1 ? '' : 's'} read
            {summary.cost ? ` · $${Number(summary.cost).toFixed(3)}` : ''}
          </div>
        </div>
        <button className="link-btn" onClick={() => setDismissed(true)}>Dismiss</button>
      </div>

      {!empty && (
        <div style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap',
                      marginTop: 'var(--s4)' }}>
          {([
            ['rooms', counts.rooms, 'capacity'],
            ['spaces', counts.spaces, 'capacity'],
            ['services', counts.services, 'services'],
            ['facilities', counts.facilities, 'facilities'],
          ] as [string, number, string][]).filter(([, n]) => n > 0).map(([label, n, tab]) => (
            <Link key={label} href={`/venues/${venueId}/${tab}`}
                  style={{ textDecoration: 'none' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                            color: 'var(--ink-quiet)', marginTop: 4 }}>{label}</div>
            </Link>
          ))}
        </div>
      )}

      {empty && (
        <div style={{ fontSize: 13, marginTop: 'var(--s3)' }}>
          Venue detail only — no rooms, spaces or services came through. Their site may hold them
          on pages the crawl did not reach, or may not publish them at all.
        </div>
      )}

      {!!needsAttention.length && (
        <div style={{ fontSize: 12.5, marginTop: 'var(--s4)', paddingTop: 'var(--s3)',
                      borderTop: '1px solid var(--border)' }}>
          <strong>Worth a look:</strong> {needsAttention.join(' · ')}
        </div>
      )}

      {!!summary.flags.length && (
        <ul style={{ margin: 'var(--s3) 0 0', paddingLeft: 18, fontSize: 12.5,
                     lineHeight: 1.6 }}>
          {summary.flags.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 'var(--s4)' }}>
        Everything is editable in the tabs above — this is the venue record now.{' '}
        <Link href={`/venues/${venueId}/reread`}>Read their site again</Link> when it changes, or
        see <Link href="/venues/intake">every read</Link>.
      </div>
    </div>
  );
}
