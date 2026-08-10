'use client';

import Link from 'next/link';

type Row = Record<string, any>;

const TONE: Record<string, string> = {
  'Wrong country': 'var(--bad)',
  'Probably wrong': 'var(--warn)',
  'Worth a look': 'var(--ink-gold)',
  'Nowhere near a known place': 'var(--muted)',
};

/* ═══════════════════════════════════════════════════════════════════════
   COORDINATES THAT DO NOT MATCH THEIR ADDRESS

   The two common mistakes are invisible in a number field: a missing
   minus sign flips the hemisphere, and swapping the two numbers moves a
   venue thousands of kilometres. Neither looks wrong on screen.

   Checked against the nearest of 152,605 cities rather than a country
   centre — a centre said a Victorian venue was 1,564 km out of place,
   because Australia's middle is in the desert.
   ═══════════════════════════════════════════════════════════════════════ */

export default function CoordinateProblems({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return (
      <div className="sect">
        <h3>Coordinates worth checking</h3>
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing looks misplaced. Every venue with a coordinate lands in the country it says
          it is in.
        </div>
      </div>
    );
  }

  const wrongCountry = rows.filter((r) => r.state === 'Wrong country').length;

  return (
    <div className="sect">
      <h3>Coordinates worth checking</h3>
      <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
        {rows.length} to look at
        {wrongCountry ? ` · ${wrongCountry} in the wrong country` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Venue</th><th>Recorded as</th><th>Lands in</th>
            <th>What it looks like</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.venue_id}>
              <td>
                <Link href={`/venues/${r.venue_id}/location`}
                      style={{ textDecoration: 'none' }}>
                  <span className="v-name" style={{ fontSize: 15 }}>{r.venue_name}</span>
                </Link>
                <div className="v-slug">
                  {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                  {r.coordinates_source && ` · ${r.coordinates_source}`}
                </div>
              </td>
              <td className="v-slug">
                {[r.recorded_city, r.recorded_country].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="v-slug">
                {r.lands_in ?? '—'}
                {r.nearest_place && (
                  <div style={{ color: 'var(--muted)' }}>near {r.nearest_place}</div>
                )}
              </td>
              <td>
                <span style={{ color: TONE[r.state] ?? 'var(--charcoal)', fontSize: 12.5 }}>
                  {r.state}
                </span>
                {r.likely_cause && (
                  <div className="v-slug" style={{ maxWidth: 380, marginTop: 2 }}>
                    {r.likely_cause}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
        A coordinate more than 4,000 km from its own country is refused outright when saved.
        Everything else appears here, because a venue near a border or in a country with two
        places of the same name is a question rather than a fault.
      </div>
    </div>
  );
}
