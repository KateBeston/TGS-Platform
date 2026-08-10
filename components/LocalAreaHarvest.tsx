'use client';

import { useState } from 'react';
import { proposeLocalArea, applyLocalArea } from '@/app/actions/localArea';
import type { DistanceProposal, ExcursionProposal } from '@/lib/localArea';

/* Review screen for the local-area harvest. The curator runs it, ticks the
 * suggestions that fit, and applies — nothing is written until they do. */

export default function LocalAreaHarvest({ venueId, hasCoords }: { venueId: number; hasCoords: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [dist, setDist] = useState<DistanceProposal[]>([]);
  const [exc, setExc] = useState<ExcursionProposal[]>([]);
  const [distOn, setDistOn] = useState<boolean[]>([]);
  const [excOn, setExcOn] = useState<boolean[]>([]);

  const run = async () => {
    setBusy(true); setError(null); setDone(null);
    const r = await proposeLocalArea(venueId);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setDist(r.distances); setExc(r.excursions);
    setDistOn(r.distances.map(() => true)); setExcOn(r.excursions.map(() => true));
  };

  const apply = async () => {
    setBusy(true); setError(null);
    const d = dist.filter((_, i) => distOn[i]);
    const e = exc.filter((_, i) => excOn[i]);
    const r = await applyLocalArea(venueId, d, e);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setDone(`Added ${d.length} ${d.length === 1 ? 'distance' : 'distances'} and ${e.length} ${e.length === 1 ? 'excursion' : 'excursions'}. Refresh the tab to see them in the tables below.`);
    setDist([]); setExc([]);
  };

  const has = dist.length > 0 || exc.length > 0;

  if (!hasCoords) {
    return <div className="note">Add coordinates to this venue (geocode it on this tab) before harvesting the local area.</div>;
  }

  return (
    <div>
      {!has && (
        <button type="button" className="btn" onClick={run} disabled={busy}>
          {busy ? 'Searching nearby…' : 'Harvest local area'}
        </button>
      )}

      {error && <div className="note" style={{ marginTop: 'var(--s3)' }}><strong>Couldn&rsquo;t harvest:</strong> {error}</div>}
      {done && <div className="note" style={{ marginTop: 'var(--s3)' }}>{done}</div>}

      {has && (
        <div style={{ marginTop: 'var(--s3)' }}>
          {dist.length > 0 && (
            <div style={{ marginBottom: 'var(--s4)' }}>
              <h4>Distances &amp; travel times</h4>
              {dist.map((d, i) => (
                <label key={d.google_place_id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0' }}>
                  <input type="checkbox" checked={distOn[i]}
                    onChange={() => setDistOn((s) => s.map((v, j) => (j === i ? !v : v)))} />
                  <span>{d.label}{d.travel_value != null
                    ? <> — <strong>{d.travel_value} {d.travel_unit}</strong> <span className="ph-sub">({d.travel_mode})</span></>
                    : <span className="ph-sub"> — drive time unavailable</span>}</span>
                </label>
              ))}
            </div>
          )}

          {exc.length > 0 && (
            <div style={{ marginBottom: 'var(--s4)' }}>
              <h4>Local excursions</h4>
              {exc.map((e, i) => (
                <label key={e.google_place_id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0' }}>
                  <input type="checkbox" checked={excOn[i]}
                    onChange={() => setExcOn((s) => s.map((v, j) => (j === i ? !v : v)))} />
                  <span>{e.name}{e.duration_label ? <span className="ph-sub"> — {e.duration_label}</span> : null}</span>
                </label>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--s3)' }}>
            <button type="button" className="btn" onClick={apply} disabled={busy}>
              {busy ? 'Adding…' : 'Apply selected'}
            </button>
            <button type="button" className="btn quiet" onClick={() => { setDist([]); setExc([]); }} disabled={busy}>
              Discard
            </button>
          </div>
          <div className="ph-sub" style={{ marginTop: 'var(--s3)' }}>
            Applied rows land in the Distances and Excursions tables on this venue, tagged as Google-sourced. Edit or delete any of them there.
          </div>
        </div>
      )}
    </div>
  );
}
