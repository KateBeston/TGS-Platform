'use client';

import { useState, useTransition } from 'react';
import { addBenchmark, removeBenchmark, saveBenchmark } from '@/app/actions/property';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const BASES = ['Per person per session', 'Per person per day',
  'Per space per session', 'Per space per day'];
const CONFIDENCE = ['Observed', 'Estimate', 'Assumption'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   RATE BENCHMARKS

   What a person is worth in a space, per usage and per region. Paired
   with square metres per person, this turns a room's dimensions into an
   income figure.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BenchmarkEditor({
  usages, benchmarks, countries,
}: { usages: Row[]; benchmarks: Row[]; countries: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newUsage, setNewUsage] = useState<number | ''>('');
  const [newCountry, setNewCountry] = useState<number | ''>('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res?.ok === false ? 'error' : 'saved');
  });

  return (
    <>
      <div className="ph">
        <div>
          <h2>Rate benchmarks</h2>
          <div className="ph-sub">
            {benchmarks.length
              ? `${benchmarks.length} recorded`
              : 'Nothing yet — the model has capacity but no rates'}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Add a benchmark'}
          </button>
        </div>
      </div>

      <div className="note">
        <strong>Capacity × rate × utilisation.</strong> Capacity is already worked out from floor
        area. This is the second half — what one person in that space is worth, and how often it is
        actually used.</div>

      <div className="note">
        <strong>Utilisation is the number nobody records, and it is the one that decides.</strong></div>

      {adding && (
        <div className="sect">
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                        flexWrap: 'wrap' }}>
            <div className="f" style={{ minWidth: 220 }}>
              <label>Usage</label>
              <select value={newUsage} style={sel}
                onChange={(e) => setNewUsage(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Choose</option>
                {usages.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} · {u.sqm_per_person} m² each</option>
                ))}
              </select>
            </div>
            <div className="f" style={{ minWidth: 200 }}>
              <label>Where</label>
              <select value={newCountry} style={sel}
                onChange={(e) => setNewCountry(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Everywhere</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn" disabled={pending || !newUsage}
              onClick={() => act(async () => {
                const r = await addBenchmark(Number(newUsage), newCountry || null);
                if (r.ok) { setAdding(false); setNewUsage(''); setNewCountry(''); }
                return r;
              })}>Add</button>
          </div>
        </div>
      )}

      {!benchmarks.length && !adding && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing recorded. Add one whenever you learn what a venue charges — a day rate for the
          barn, a per-head figure for a workshop. Each one makes the model less theoretical.
        </div>
      )}

      {!!benchmarks.length && (
        <div className="sect">
          <table>
            <thead>
              <tr>
                <th>Usage</th><th>Where</th><th>Rate</th><th>Basis</th>
                <th>Utilisation</th><th>How sure</th><th></th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 16 }}>
                      {b.space_usages?.name}
                    </span>
                    <div className="v-slug">{b.space_usages?.sqm_per_person} m² each</div>
                  </td>
                  <td className="v-slug">{b.countries?.name ?? 'Everywhere'}</td>
                  <td style={{ minWidth: 140 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="number" step="0.01" data-bwignore
                        defaultValue={b.rate_per_person ?? ''} style={{ ...sel, width: 90 }}
                        onBlur={(e) => act(() => saveBenchmark(b.id, 'rate_per_person',
                          e.target.value ? Number(e.target.value) : null))} />
                      <input data-bwignore defaultValue={b.currency ?? 'AUD'}
                        style={{ ...sel, width: 62 }}
                        onBlur={(e) => act(() =>
                          saveBenchmark(b.id, 'currency', e.target.value || null))} />
                    </div>
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <select defaultValue={b.rate_basis} style={sel}
                      onChange={(e) => act(() =>
                        saveBenchmark(b.id, 'rate_basis', e.target.value))}>
                      {BASES.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </td>
                  <td style={{ minWidth: 90 }}>
                    <input type="number" step="0.05" min="0" max="1" data-bwignore
                      placeholder="—"
                      defaultValue={b.typical_utilisation ?? ''} style={sel}
                      onBlur={(e) => act(() => saveBenchmark(b.id, 'typical_utilisation',
                        e.target.value ? Number(e.target.value) : null))} />
                    <span className="help" style={{ fontSize: 10 }}>0 to 1</span>
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <select defaultValue={b.confidence} style={sel}
                      onChange={(e) => act(() =>
                        saveBenchmark(b.id, 'confidence', e.target.value))}>
                      {CONFIDENCE.map((x) => <option key={x}>{x}</option>)}
                    </select>
                    <input data-bwignore placeholder="Where from"
                      defaultValue={b.source ?? ''} style={{ ...sel, marginTop: 4 }}
                      onBlur={(e) => act(() =>
                        saveBenchmark(b.id, 'source', e.target.value || null))} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(() => removeBenchmark(b.id))}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
