'use client';

import { useState, useTransition } from 'react';
import { confirmCoordinates } from '@/app/actions/geocode';
import { useSaveState } from './SaveState';

type Venue = Record<string, any>;

const HOW = [
  { key: 'Satellite view', note: 'Buildings visible where the pin sits' },
  { key: 'Street view', note: 'Recognised the entrance from the road' },
  { key: 'Site visit', note: 'Been there' },
  { key: 'Venue confirmed it', note: 'They told us the pin is right' },
  { key: 'Matched their own map', note: 'Agrees with the map on their site' },
];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

const when = (d: string) => new Date(d).toLocaleDateString('en-AU',
  { day: 'numeric', month: 'long', year: 'numeric' });

/* ═══════════════════════════════════════════════════════════════════════
   HAS ANYBODY LOOKED

   A geocoded coordinate is a geocoder's best answer for an address, not
   the venue's position. For a rural property with no street number it is
   often the road, or the middle of the suburb.

   The only thing that makes a coordinate verified is a person opening a
   satellite view and seeing the buildings. This records that they did —
   the difference between a guest finding the driveway and driving past
   it.

   Moving the pin clears the confirmation. Carrying it across a change
   would make the record claim somebody checked a position nobody has
   seen.
   ═══════════════════════════════════════════════════════════════════════ */

export default function ConfirmPlacement({ venue }: { venue: Venue }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [how, setHow] = useState('Satellite view');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  if (venue.latitude == null) {
    return (
      <div className="sect">
        <h3>Has anybody looked</h3>
        <div className="note" style={{ marginBottom: 0 }}>
          No coordinate yet. It will be placed when the site is read, or from Venues → Geocode.
        </div>
      </div>
    );
  }

  const confirmed = venue.coordinates_confirmed_at;
  const maps = `https://www.google.com/maps/@${venue.latitude},${venue.longitude},250m/data=!3m1!1e3`;

  return (
    <div className="sect">
      <h3>Has anybody looked</h3>

      {confirmed ? (
        <div className="note">
          <strong>Confirmed {when(confirmed)}</strong>
          {venue.coordinates_confirmed_how && ` · ${venue.coordinates_confirmed_how.toLowerCase()}`}
          {venue.coordinates_confirmed_by && ` · ${venue.coordinates_confirmed_by}`}
          {venue.coordinates_note && <div>{venue.coordinates_note}</div>}
        </div>
      ) : (
        <div className="note">
          <strong>Not yet.</strong> The coordinate came from{' '}
          {venue.coordinates_source
            ? venue.coordinates_source.toLowerCase()
            : 'a geocoder'}
          {venue.coordinates_precision
            ? ` at ${venue.coordinates_precision.toLowerCase()} precision`
            : ''}
          , which is a best answer for the address rather than the venue's position.
        </div>
      )}

      {msg && <div className="note">{msg}</div>}

      <a className="btn quiet" href={maps} target="_blank" rel="noopener"
         style={{ marginBottom: 'var(--s4)', display: 'inline-block' }}>
        Open the satellite view
      </a>

      <div className="grid">
        <div className="f">
          <label htmlFor="how">How it was checked</label>
          <select id="how" style={sel} value={how} disabled={pending}
            onChange={(e) => setHow(e.target.value)}>
            {HOW.map((h) => (
              <option key={h.key} value={h.key}>{h.key}</option>
            ))}
          </select>
          <span className="help">
            {HOW.find((h) => h.key === how)?.note}
          </span>
        </div>

        <div className="f">
          <label htmlFor="cnote">Anything worth noting</label>
          <input id="cnote" data-bwignore style={sel} value={note}
            placeholder="Entrance is 400m past the bridge"
            onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <button className="btn" disabled={pending}
        onClick={() => start(async () => {
          report('saving');
          const r = await confirmCoordinates(venue.id, how, note || undefined);
          setMsg(r.ok ? (r.message ?? '') : (r as any).error);
          report(r.ok ? 'saved' : 'error');
        })}>
        {confirmed ? 'Confirm again' : 'It is in the right place'}
      </button>

      {venue.entrance_latitude == null && (
        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          Where the entrance is a long way from the address point — a rural property with a
          kilometre of driveway — record it separately in Entrance latitude and longitude. That
          is the coordinate a guest actually needs.
        </div>
      )}
    </div>
  );
}
