'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { applyGeocode, batchGeocode, chooseProvider } from '@/app/actions/geocode';
import { useSaveState } from './SaveState';

type Check = Record<string, any>;

const VERDICT: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' | 'quiet' }> = {
  Agreed:          { label: 'Agreed',           tone: 'good' },
  Close:           { label: 'Close',            tone: 'warn' },
  Disagreed:       { label: 'Disagreed',        tone: 'bad' },
  SingleSource:    { label: 'One source only',  tone: 'warn' },
  NoResult:        { label: 'Not found',        tone: 'quiet' },
  CountryMismatch: { label: 'Wrong country',    tone: 'bad' },
};

export default function GeocodeQueue({
  checks, readyCount,
}: { checks: Check[]; readyCount: number }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [batch, setBatch] = useState(25);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? 'Done.') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const tone = (t: string) =>
    t === 'good' ? { borderColor: 'var(--ok)', color: 'var(--ok)' }
    : t === 'bad' ? { borderColor: 'var(--bad)', color: 'var(--bad)' }
    : t === 'warn' ? { borderColor: 'var(--warn)', color: 'var(--warn)' }
    : {};

  return (
    <>
      <div className="sect">
        <h3>Run a batch</h3>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end' }}>
          <div className="f" style={{ maxWidth: 140 }}>
            <label htmlFor="n">Venues to check</label>
            <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="n" value={batch} onChange={(e) => setBatch(Number(e.target.value))}
              style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                       padding: '8px 10px', fontSize: 13 }}>
              {[10, 25, 40].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn" disabled={pending || !readyCount}
                  onClick={() => act(() => batchGeocode(batch))}>
            {pending ? 'Checking…' : 'Check next batch'}
          </button>
        </div>
        <div className="note" style={{ marginTop: 'var(--s4)' }}>
          Paced at roughly one venue per second — OpenStreetMap's usage policy permits about one
          request per second and blocks anything faster. Forty takes about three quarters of a
          minute. Nothing is written to a venue until you apply it below.</div>
        {msg && <div className="note" style={{ marginTop: 'var(--s3)' }}>{msg}</div>}
      </div>

      <div className="sect">
        <h3>Recent checks</h3>

        {!checks.length && (
          <div className="note">No checks run yet.</div>
        )}

        {!!checks.length && (
          <table>
            <thead>
              <tr>
                <th>Venue</th><th>Result</th><th>Apart</th>
                <th>Google</th><th>OpenStreetMap</th><th></th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => {
                const v = VERDICT[c.verdict] ?? { label: c.verdict, tone: 'quiet' as const };
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/venues/${c.venue_id}/location`} style={{ textDecoration: 'none' }}>
                        <div className="v-name">{c.venues?.venue_name ?? 'Venue'}</div>
                      </Link>
                      <div className="v-slug">{c.query_address}</div>
                    </td>
                    <td>
                      <span className="pill" style={tone(v.tone)}>{v.label}</span>
                      {c.applied && <div className="v-slug" style={{ marginTop: 3 }}>Applied</div>}
                    </td>
                    <td>{c.distance_metres != null
                      ? (c.distance_metres > 1000
                          ? `${(c.distance_metres / 1000).toFixed(1)} km`
                          : `${c.distance_metres} m`)
                      : '—'}</td>
                    <td className="v-slug">
                      {c.google_lat != null
                        ? <>{Number(c.google_lat).toFixed(5)}, {Number(c.google_lng).toFixed(5)}
                            <div>{c.google_precision}</div></>
                        : 'No result'}
                    </td>
                    <td className="v-slug">
                      {c.osm_lat != null
                        ? <>{Number(c.osm_lat).toFixed(5)}, {Number(c.osm_lng).toFixed(5)}
                            <div>{c.osm_precision}</div></>
                        : 'No result'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c.verdict === 'Disagreed' && !c.applied && (
                        <>
                          <button className="link-btn" disabled={pending}
                            onClick={() => act(() => chooseProvider(c.id, 'Google'))}>Use Google</button>
                          {' · '}
                          <button className="link-btn" disabled={pending}
                            onClick={() => act(() => chooseProvider(c.id, 'OSM'))}>Use OSM</button>
                        </>
                      )}
                      {c.chosen_lat != null && !c.applied && (
                        <>
                          {c.verdict === 'Disagreed' && <br />}
                          <button className="link-btn" disabled={pending}
                            onClick={() => act(() => applyGeocode(c.id))}>Apply</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
