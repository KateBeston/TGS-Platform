'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { switchListing } from '@/app/actions/brands';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   WHICH LOCATIONS ARE LISTED, AND WHERE

   Every location, both marketplaces, in one grid — because deciding that
   the Tokyo property belongs on the wellness side and the Bali one on
   both is a comparison, and a comparison needs them side by side.

   Nothing here assumes a naming pattern. Amanzoe and Amanjena share no
   words at all, and the brand link is what holds them together.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BrandListings({ rows }: { rows: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  if (!rows.length) return null;

  const venues = Array.from(new Set(rows.map((r) => r.venue_id)))
    .map((id) => {
      const forVenue = rows.filter((r) => r.venue_id === id);
      return {
        id,
        name: forVenue[0].venue_name,
        where: [forVenue[0].city, forVenue[0].country].filter(Boolean).join(', '),
        status: forVenue[0].venue_status,
        brandAllows: forVenue[0].brand_allows,
        retreat: forVenue.find((r) => r.marketplace === 'Retreat'),
        wellness: forVenue.find((r) => r.marketplace === 'Wellness'),
      };
    });

  const toggle = (venueId: number, marketplace: string, next: boolean) =>
    start(async () => {
      report('saving');
      const r = await switchListing(venueId, marketplace, next);
      setMsg(r.ok ? '' : (r as any).error);
      report(r.ok ? 'saved' : 'error');
    });

  const live = rows.filter((r) => r.is_published).length;

  return (
    <div className="sect">
      <h3>Where each location is listed</h3>
      <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
        {venues.length} location{venues.length === 1 ? '' : 's'} ·{' '}
        {live} live listing{live === 1 ? '' : 's'}
      </div>

      {msg && <div className="note bad">{msg}</div>}

      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th style={{ width: 110, textAlign: 'center' }}>Retreat</th>
            <th style={{ width: 110, textAlign: 'center' }}>Wellness</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {venues.map((v) => (
            <tr key={v.id} style={{ opacity: v.brandAllows ? 1 : 0.55 }}>
              <td>
                <Link href={`/venues/${v.id}/details`} style={{ textDecoration: 'none' }}>
                  <span className="v-name" style={{ fontSize: 15 }}>{v.name}</span>
                </Link>
                {v.where && <div className="v-slug">{v.where}</div>}
              </td>

              {(['retreat', 'wellness'] as const).map((key) => {
                const cell = key === 'retreat' ? v.retreat : v.wellness;
                const marketplace = key === 'retreat' ? 'Retreat' : 'Wellness';
                return (
                  <td key={key} style={{ textAlign: 'center' }}>
                    <input type="checkbox" data-bwignore
                      checked={!!cell?.is_published}
                      disabled={pending || !v.brandAllows}
                      style={{ cursor: v.brandAllows ? 'pointer' : 'not-allowed' }}
                      onChange={(e) => toggle(v.id, marketplace, e.target.checked)} />
                  </td>
                );
              })}

              <td className="v-slug">
                {!v.brandAllows
                  ? 'Withheld by the brand'
                  : [v.retreat?.state, v.wellness?.state]
                      .filter((x, i, a) => x && a.indexOf(x) === i)
                      .join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
        A location can appear on one marketplace and not the other — a bathhouse belongs on the
        wellness side and not the retreat one, and forcing both would put it in front of the
        wrong person.
      </div>
    </div>
  );
}
