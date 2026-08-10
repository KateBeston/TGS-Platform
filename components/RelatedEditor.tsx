'use client';

import { useState, useTransition } from 'react';
import { addRelated, removeRelated, reorderRelated, searchVenues } from '@/app/actions/curation';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;
const KINDS = ['Similar', 'Same group', 'Nearby', 'Alternative'];

export default function RelatedEditor({ venueId, rows }: { venueId: number; rows: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [list, setList] = useState(rows);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Row[]>([]);
  const [kind, setKind] = useState('Similar');
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? '' : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const search = () => start(async () => {
    setResults(await searchVenues(q, venueId));
  });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setList(next);
    act(() => reorderRelated(venueId, next.map((n) => n.id)));
  };

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Related venues</h2>
          <div className="ph-sub">
            {list.length} selected · three appear at the foot of the listing page
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Curated, not calculated.</strong> "Similar" in this market is a judgement — a
        coastal yoga retreat and a mountain silent retreat can serve the same person, and no
        distance or tag match would ever put them together.</div>

      {msg && <div className="note bad">{msg}</div>}

      <div className="sect">
        <h3>Add a venue</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      flexWrap: 'wrap' }}>
          <div className="f" style={{ minWidth: 260, flex: 1 }}>
            <label htmlFor="rq">Search</label>
            <input id="rq" data-bwignore value={q} placeholder="Venue name"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }} />
          </div>
          <div className="f" style={{ minWidth: 150 }}>
            <label htmlFor="rk">Relationship</label>
            <select id="rk" value={kind} onChange={(e) => setKind(e.target.value)}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }}>
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <button className="btn quiet" disabled={pending} onClick={search}>Search</button>
        </div>

        {!!results.length && (
          <table style={{ marginTop: 'var(--s4)' }}>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td><span className="v-name">{r.venue_name}</span></td>
                  <td className="v-slug">{r.country_name ?? '—'}</td>
                  <td className="v-slug">{r.venue_type_name ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(async () => {
                        const res = await addRelated(venueId, r.id, kind);
                        if (res.ok) {
                          setList([...list, { id: Date.now(), relationship: kind,
                            related: { id: r.id, venue_name: r.venue_name } }]);
                          setResults(results.filter((x) => x.id !== r.id));
                        }
                        return res;
                      })}>Add</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sect">
        <h3>Selected</h3>
        {!list.length && <div className="note">None yet.</div>}
        {!!list.length && (
          <table>
            <thead>
              <tr><th>Position</th><th>Venue</th><th>Relationship</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontSize: 11, color: i < 3 ? 'var(--ink-gold)' : 'var(--ink-quiet)' }}>
                      {i + 1}{i < 3 ? ' · shown' : ''}
                    </span>
                  </td>
                  <td><span className="v-name">{r.related?.venue_name ?? 'Venue'}</span></td>
                  <td><span className="pill">{r.relationship}</span></td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="link-btn" disabled={pending || i === 0}
                      onClick={() => move(i, i - 1)}>Up</button>{' · '}
                    <button className="link-btn" disabled={pending || i === list.length - 1}
                      onClick={() => move(i, i + 1)}>Down</button>{' · '}
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(async () => {
                        const res = await removeRelated(r.id, venueId);
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
    </div></div>
  );
}
