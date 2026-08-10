'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { removeVenueFromContact, saveVenueToContact } from '@/app/actions/search';
import { useSaveState } from './SaveState';
import VenueSearchPanel from './VenueSearchPanel';

type Row = Record<string, any>;

const KINDS = ['Saved', 'Favourite', 'Suggested', 'Visited', 'Booked', 'Declined', 'Avoid'];

/** What you know about a person across all their enquiries, rather than
 *  within one. Venues they have used, liked and did not book, or will not
 *  go back to — it is what makes their second enquiry faster than their
 *  first. */
export default function ContactVenues({
  contactId, rows, options,
}: { contactId: number; rows: Row[]; options: Record<string, Row[]> }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [list, setList] = useState(rows);
  const [kind, setKind] = useState('Saved');
  const [showSearch, setShowSearch] = useState(false);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
    if (!res.ok) alert(res.error);
  });

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Venues</h3>
          <div className="ph-sub">
            {list.length ? `${list.length} recorded` : 'None recorded'}
          </div>
        </div>
        <div className="ph-act">
          <select value={kind} onChange={(e) => setKind(e.target.value)}
            style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                     padding: '7px 9px', fontSize: 13 }}>
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <button className="btn quiet" onClick={() => setShowSearch(!showSearch)}>
            {showSearch ? 'Close search' : 'Find venues'}
          </button>
        </div>
      </div>

      <div className="note">
        <strong>This belongs to the person, not to one enquiry.</strong> Somewhere they loved,
        somewhere that did not work, somewhere they will not go back to. Recording the reason is
        the useful part — the link on its own tells you nothing next time.
      </div>

      {showSearch && (
        <div style={{ border: '1px solid var(--border)', padding: 'var(--s4)',
                      marginBottom: 'var(--s5)', background: 'var(--warm-cream)' }}>
          <VenueSearchPanel
            options={options} saved={[]} compact pickLabel={`Mark ${kind.toLowerCase()}`}
            alreadyPicked={list.map((r) => r.venue_id)}
            onPick={(venueId, venueName) => act(async () => {
              const res = await saveVenueToContact(contactId, venueId, kind);
              if (res.ok) setList([...list, { id: Date.now(), venue_id: venueId,
                relationship: kind, venues: { id: venueId, venue_name: venueName } }]);
              return res;
            })}
          />
        </div>
      )}

      {!list.length && !showSearch && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing yet. Use Find venues to add one.
        </div>
      )}

      {!!list.length && (
        <table>
          <thead><tr><th>Venue</th><th>Relationship</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/venues/${r.venue_id}/details`} style={{ textDecoration: 'none' }}>
                    <span className="v-name">{r.venues?.venue_name ?? 'Venue'}</span>
                  </Link>
                </td>
                <td>
                  <span className={`pill ${r.relationship === 'Avoid' ? '' : 'gold'}`}
                        style={r.relationship === 'Avoid'
                          ? { borderColor: 'var(--bad)', color: 'var(--bad)' } : undefined}>
                    {r.relationship}
                  </span>
                </td>
                <td>
                  <input data-bwignore defaultValue={r.reason ?? ''} placeholder="Why"
                    style={{ border: '1px solid var(--border)', padding: '5px 7px',
                             fontSize: 12, width: '100%', background: 'var(--warm-white)' }}
                    onBlur={(e) => e.target.value !== (r.reason ?? '') &&
                      act(() => saveVenueToContact(contactId, r.venue_id, r.relationship,
                                                   e.target.value))} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="link-btn" disabled={pending}
                    onClick={() => act(async () => {
                      const res = await removeVenueFromContact(r.id);
                      if (res.ok) setList(list.filter((x) => x.id !== r.id));
                      return res;
                    })}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
