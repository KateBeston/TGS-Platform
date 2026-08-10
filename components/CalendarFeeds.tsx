'use client';

import { useState, useTransition } from 'react';
import {
  addFeed, removeFeed, syncFeed,
} from '@/app/actions/calendar';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

const SOURCES = [
  'Airbnb', 'Booking.com', 'Vrbo', 'Google Calendar', 'Outlook',
  'Apple Calendar', 'Little Hotelier', 'Cloudbeds', 'SiteMinder',
  'Own system', 'Other',
];

const ago = (t: string | null) => {
  if (!t) return 'never';
  const mins = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return `${Math.floor(hrs / 24)} days ago`;
};

/* ═══════════════════════════════════════════════════════════════════════
   CALENDAR FEEDS

   Two directions, and they answer different questions. Reading somebody
   else's calendar tells us when a room is taken. Publishing ours lets
   them see the same. A venue on Airbnb needs both, or it will be double
   booked by whichever side is not looking.

   iCal carries dates and nothing else — no rates, no guest details — and
   is polled rather than pushed, so there is a window of a few hours where
   a night is sold twice and neither side knows. Fine while a person
   confirms every booking; not fine the day somebody can press book.
   ═══════════════════════════════════════════════════════════════════════ */

export default function CalendarFeeds({
  venueId, feeds, roomTypes, origin,
}: {
  venueId: number; feeds: Row[];
  roomTypes: { id: number; name: string }[];
  origin: string;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<'Read' | 'Publish' | null>(null);
  const [draft, setDraft] = useState({ source: 'Airbnb', url: '', roomType: '' });
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState<number | null>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
    if (r?.ok !== false) { setAdding(null); setDraft({ source: 'Airbnb', url: '', roomType: '' }); }
  });

  const reading = feeds.filter((f) => f.direction === 'Read');
  const publishing = feeds.filter((f) => f.direction === 'Publish');
  const broken = reading.filter((f) => (f.consecutive_failures ?? 0) >= 3);

  const Form = ({ direction }: { direction: 'Read' | 'Publish' }) => (
    <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                  flexWrap: 'wrap', marginTop: 'var(--s3)' }}>
      {direction === 'Read' && (
        <>
          <div className="f" style={{ minWidth: 170 }}>
            <label style={{ fontSize: 9 }}>Where from</label>
            <select style={sel} value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="f" style={{ minWidth: 300, flex: 1 }}>
            <label style={{ fontSize: 9 }}>The calendar address</label>
            <input data-bwignore style={sel} value={draft.url}
              placeholder="https://www.airbnb.com/calendar/ical/…"
              onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          </div>
        </>
      )}

      {!!roomTypes.length && (
        <div className="f" style={{ minWidth: 180 }}>
          <label style={{ fontSize: 9 }}>Which rooms</label>
          <select style={sel} value={draft.roomType}
            onChange={(e) => setDraft({ ...draft, roomType: e.target.value })}>
            <option value="">The whole venue</option>
            {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      <button className="btn" disabled={pending || (direction === 'Read' && !draft.url.trim())}
        onClick={() => act(() => addFeed(
          venueId, direction,
          direction === 'Read' ? draft.source : null,
          direction === 'Read' ? draft.url : null,
          draft.roomType ? Number(draft.roomType) : null))}>
        Add
      </button>
      <button className="btn quiet" onClick={() => setAdding(null)}>Cancel</button>
    </div>
  );

  return (
    <>
      {msg && <div className="note">{msg}</div>}

      {!!broken.length && (
        <div className="note bad">
          <strong>{broken.length} feed{broken.length === 1 ? ' has' : 's have'} been failing.</strong>
          {' '}A feed that fails quietly is worse than none — it reads as current and is not,
          and the first sign is usually a double booking.
        </div>
      )}

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
              Calendars we read
            </h3>
            <div className="ph-sub">
              When a room is taken elsewhere, so we do not offer it
            </div>
          </div>
          <div className="ph-act">
            <button className="btn quiet"
              onClick={() => setAdding(adding === 'Read' ? null : 'Read')}>
              {adding === 'Read' ? 'Close' : 'Add a calendar'}
            </button>
          </div>
        </div>

        {adding === 'Read' && <Form direction="Read" />}

        {!reading.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            None yet. Most platforms offer an export address — on Airbnb it is under
            Availability, then Connect calendars.
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Where from</th><th>Rooms</th><th>Last read</th><th>Dates held</th><th></th></tr>
            </thead>
            <tbody>
              {reading.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 14 }}>{f.source}</span>
                    <div className="v-slug" style={{ maxWidth: 320, overflow: 'hidden',
                                                     textOverflow: 'ellipsis' }}>
                      {f.url}
                    </div>
                  </td>
                  <td className="v-slug">
                    {f.venue_room_types?.name ?? f.venue_rooms?.name ?? 'The whole venue'}
                  </td>
                  <td className="v-slug">
                    {ago(f.last_synced_at)}
                    {f.last_sync_status === 'Failed' && (
                      <div style={{ color: 'var(--bad)' }}>{f.last_sync_note}</div>
                    )}
                  </td>
                  <td className="v-slug">{f.events_last_sync ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(() => syncFeed(f.id))}>Read now</button>
                    <button className="link-btn" disabled={pending}
                      style={{ marginLeft: 10 }}
                      onClick={() => {
                        if (!window.confirm(
                          'Remove this feed and the dates it was holding?')) return;
                        act(() => removeFeed(f.id, venueId));
                      }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sect">
        <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
          <div>
            <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
              Calendars we publish
            </h3>
            <div className="ph-sub">
              An address others fetch, so they do not sell a date we have taken
            </div>
          </div>
          <div className="ph-act">
            <button className="btn quiet"
              onClick={() => setAdding(adding === 'Publish' ? null : 'Publish')}>
              {adding === 'Publish' ? 'Close' : 'Create a feed'}
            </button>
          </div>
        </div>

        {adding === 'Publish' && <Form direction="Publish" />}

        {!publishing.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            None yet. Create one per platform, so a venue can revoke a single channel without
            breaking the others.
          </div>
        ) : (
          <table>
            <thead><tr><th>Rooms</th><th>The address</th><th>Last fetched</th><th></th></tr></thead>
            <tbody>
              {publishing.map((f) => {
                const address = `${origin}/api/calendar/${f.token}`;
                return (
                  <tr key={f.id}>
                    <td className="v-slug">
                      {f.venue_room_types?.name ?? f.venue_rooms?.name ?? 'The whole venue'}
                    </td>
                    <td>
                      <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{address}</code>
                    </td>
                    <td className="v-slug">{ago(f.last_synced_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="link-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(address);
                          setCopied(f.id);
                          setTimeout(() => setCopied(null), 2000);
                        }}>{copied === f.id ? 'Copied' : 'Copy'}</button>
                      <button className="link-btn" disabled={pending}
                        style={{ marginLeft: 10 }}
                        onClick={() => {
                          if (!window.confirm('Anybody using this address will stop receiving '
                            + 'updates. Remove it?')) return;
                          act(() => removeFeed(f.id, venueId));
                        }}>Revoke</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          The address is the only thing protecting a published feed, so treat it as a password.
          It says a period is unavailable and nothing more — no guest, no price.
        </div>
      </div>
    </>
  );
}
