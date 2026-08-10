'use client';

import { useState, useTransition } from 'react';
import { setBrandListings } from '@/app/actions/brands';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   WHAT A BRAND OFFERS, ACROSS ITS LOCATIONS

   Computed rather than kept. The moment one location adds a treatment a
   stored list is wrong and nothing says so.

   The useful column is not what exists but where — a service at nine of
   nine is a brand standard, and one at two of nine is a local thing that
   somebody might reasonably want everywhere.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BrandRollup({
  brandId, overview, services, facilities,
}: { brandId: number; overview: Row | null; services: Row[]; facilities: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
    if (r?.ok !== false) { setAsking(false); setReason(''); }
  });

  const total = overview?.in_the_portal ?? 0;
  const allowed = overview?.listings_allowed !== false;

  return (
    <>
      <div className="sect">
        <h3>Listings across the group</h3>

        {msg && <div className="note">{msg}</div>}

        <div className={allowed ? 'note' : 'note bad'}>
          {allowed ? (
            <>
              <strong>Listings allowed.</strong> Each location still decides for itself, per
              marketplace.
            </>
          ) : (
            <>
              <strong>Every location withheld.</strong> Their own settings are untouched and
              will apply again when this is turned back on.
            </>
          )}
        </div>

        {asking ? (
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                        flexWrap: 'wrap' }}>
            <div className="f" style={{ flex: 1, minWidth: 260 }}>
              <label>Why</label>
              <input data-bwignore value={reason}
                placeholder="Agreement ended, or under review"
                style={{ background: 'var(--warm-white)',
                         border: '1px solid var(--border-input)',
                         padding: '8px 10px', fontSize: 13.5, width: '100%' }}
                onChange={(e) => setReason(e.target.value)} />
            </div>
            <button className="btn" disabled={pending}
              onClick={() => act(() => setBrandListings(brandId, false, reason))}>
              Withhold all {total}
            </button>
            <button className="btn quiet" onClick={() => setAsking(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn quiet" disabled={pending}
            onClick={() => allowed ? setAsking(true)
                                   : act(() => setBrandListings(brandId, true))}>
            {allowed ? 'Withhold every location' : 'Allow listings again'}
          </button>
        )}

        <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          One act rather than {total || 'fifteen'}. When a chain leaves, separate switches means
          one gets missed — and a listing that should have gone is worse than one that never
          appeared.
        </div>
      </div>

      {!!overview && (
        <div className="stats" style={{ marginBottom: 'var(--s5)' }}>
          <div className="stat">
            <div className="v">{overview.in_the_portal}
              {overview.they_have ? ` / ${overview.they_have}` : ''}</div>
            <div className="l">Locations</div>
          </div>
          <div className="stat">
            <div className="v">{overview.read_from_their_site}</div>
            <div className="l">Read from their site</div>
          </div>
          <div className="stat">
            <div className="v">{overview.placed}</div>
            <div className="l">Placed on the map</div>
          </div>
          <div className="stat">
            <div className="v">{overview.distinct_services}</div>
            <div className="l">Distinct services</div>
          </div>
          <div className="stat">
            <div className="v">{overview.published}</div>
            <div className="l">Published</div>
          </div>
        </div>
      )}

      <div className="sect">
        <h3>What they offer</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          Worked out from the locations, not kept as a list — so it stays true when one changes
        </div>

        {!services.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            No services recorded at any location yet. Read a location&rsquo;s site, or use
            &ldquo;Read one page&rdquo; on its treatment menu.
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Service</th><th>Category</th><th>Where</th><th>Price range</th></tr>
            </thead>
            <tbody>
              {services.map((s, i) => {
                const everywhere = total > 0 && s.at_how_many_locations === total;
                return (
                  <tr key={i}>
                    <td>
                      <span className="v-name" style={{ fontSize: 15 }}>{s.service}</span>
                      {everywhere && (
                        <span className="pill gold" style={{ fontSize: 9, marginLeft: 8 }}>
                          everywhere
                        </span>
                      )}
                    </td>
                    <td className="v-slug">{s.category ?? '—'}</td>
                    <td className="v-slug" title={s.where_it_is}>
                      {s.at_how_many_locations} of {total || '?'}
                    </td>
                    <td className="v-slug">
                      {s.cheapest == null ? '—'
                        : s.cheapest === s.dearest ? Number(s.cheapest).toFixed(0)
                        : `${Number(s.cheapest).toFixed(0)} – ${Number(s.dearest).toFixed(0)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!!facilities.length && (
        <div className="sect">
          <h3>What they have</h3>
          <table>
            <thead><tr><th>Facility</th><th>Where</th></tr></thead>
            <tbody>
              {facilities.map((f, i) => (
                <tr key={i}>
                  <td>
                    <span className="v-name" style={{ fontSize: 15 }}>{f.facility}</span>
                  </td>
                  <td className="v-slug" title={f.where_it_is}>
                    {f.at_how_many_locations} of {f.of_locations}
                    {f.at_how_many_locations < f.of_locations && (
                      <span style={{ color: 'var(--muted)' }}> — not everywhere</span>
                    )}
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
