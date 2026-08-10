'use client';

import Link from 'next/link';
import { useState } from 'react';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   SANCTUM PROPERTY

   Built before there is work to put through it, deliberately.

   The capacity model gives capacity from floor area. Revenue per square
   metre is one step further, and it only works if rate data is captured
   alongside capacity data — capture one now and the other in two years
   and you have two datasets that never line up.

   The calculator below is the whole idea, made visible. Everything else
   here is somewhere to put what it needs.
   ═══════════════════════════════════════════════════════════════════════ */

export default function PropertyOverview({
  usages, counts,
}: { usages: Row[]; counts: Record<string, number> }) {
  const [area, setArea] = useState(40);

  return (
    <>
      <div className="ph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s5)' }}>
          <div className="lockup" style={{ color: 'var(--charcoal)' }}>
            <div className="lk-rule" style={{ color: 'var(--charcoal)', marginTop: 0 }}>
              <span className="lk-word script"
                    style={{ color: 'var(--charcoal)', fontSize: 34 }}>Property</span>
            </div>
          </div>
          <div>
            <div className="ph-sub" style={{ marginTop: 0 }}>
              Sales, management and valuation of retreat and wellness venues
            </div>
          </div>
        </div>
      </div>

      <div className="note">
        <strong>A retreat venue is an income-producing asset, and almost nobody values one as
        such.</strong></div>

      <div className="stats">
        <div className="stat">
          <div className={`v ${counts.benchmarks ? '' : 'zero'}`}>{counts.benchmarks}</div>
          <div className="l">Rate benchmarks</div>
        </div>
        <div className="stat">
          <div className={`v ${counts.comparables ? '' : 'zero'}`}>{counts.comparables}</div>
          <div className="l">Comparables recorded</div>
        </div>
        <div className="stat">
          <div className={`v ${counts.valuations ? '' : 'zero'}`}>{counts.valuations}</div>
          <div className="l">Valuations</div>
        </div>
        <div className="stat">
          <div className="v">{usages.length}</div>
          <div className="l">Usage types modelled</div>
        </div>
      </div>

      {/* ── the idea, made visible ───────────────────────────────── */}
      <div className="sect">
        <h3>What a room holds</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
          The same floor area, by what it is used for
        </div>

        <div className="f" style={{ maxWidth: 220, marginBottom: 'var(--s4)' }}>
          <label htmlFor="area">Floor area, square metres</label>
          <input id="area" type="number" data-bwignore value={area}
            style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                     padding: '9px 11px', width: '100%', fontSize: 15 }}
            onChange={(e) => setArea(Math.max(0, Number(e.target.value) || 0))} />
          <span className="help">
            Curraweena&rsquo;s barn is about 40 — they say 18 for yoga, 40 seated
          </span>
        </div>

        <table>
          <thead>
            <tr><th>Used for</th><th>Each person needs</th><th>Fits</th><th></th></tr>
          </thead>
          <tbody>
            {usages.map((u) => {
              const fits = u.sqm_per_person
                ? Math.floor(area / Number(u.sqm_per_person)) : null;
              return (
                <tr key={u.id}>
                  <td>
                    <span className="v-name" style={{ fontSize: 16 }}>{u.name}</span>
                    <div className="v-slug" style={{ maxWidth: 400 }}>{u.description}</div>
                  </td>
                  <td className="v-slug">{u.sqm_per_person} m²</td>
                  <td>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>
                      {fits ?? '—'}
                    </span>
                  </td>
                  <td className="v-slug" style={{ maxWidth: 200 }}>
                    {u.slug === 'yoga-mats' && area === 40 && 'Curraweena states 18'}
                    {u.slug === 'seated-theatre' && area === 40 && 'Curraweena states 40'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <strong>Checked against a real room.</strong> Curraweena&rsquo;s barn is roughly 40 m²
          and they state 18 for yoga and 40 seated — both land exactly.</div>
      </div>

      <div className="sect">
        <h3>Where this goes</h3>
        <div className="tiles">
          <Link className="tile" href="/property/benchmarks"
                style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Rate benchmarks</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
              What a person is worth, per usage and per region. Capacity times rate times
              utilisation is the revenue model.
            </div>
          </Link>
          <Link className="tile" href="/property/comparables"
                style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Comparables</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
              Record one whenever you notice it. Listings disappear, and a price written down today
              beats a search through old pages in three years.
            </div>
          </Link>
          <span className="tile off" style={{ textAlign: 'left', padding: 'var(--s5)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Valuations</div>
            <div className="tile-meta" style={{ marginTop: 'var(--s2)' }}>
              Income, comparable and replacement side by side — waiting on benchmarks
            </div>
          </span>
        </div>
      </div>

      <div className="note" style={{ marginBottom: 0 }}>
        <strong>Why this exists before there is anything in it.</strong></div>
    </>
  );
}
