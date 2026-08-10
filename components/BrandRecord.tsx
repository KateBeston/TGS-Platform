'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { addLocation, saveBrand, unlinkFromBrand } from '@/app/actions/brands';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   ONE BRAND

   Its locations, each a venue in its own right. They share a name and a
   standard; they share nothing else. Tokyo's facilities are not
   Melbourne's, and a spa menu differs by location because the therapists
   and the room do.

   Which is why the brand holds prose about how it works rather than a
   service list. A list here would put treatments on menus that do not
   carry them.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BrandRecord({ brand }: { brand: Row }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [location, setLocation] = useState({ name: '', url: '' });
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
    if (r?.ok !== false) setLocation({ name: '', url: '' });
  });

  const save = (col: string, v: unknown) => act(() => saveBrand(brand.id, col, v));
  const missing = brand.location_count
    ? brand.location_count - brand.locations.length : 0;
  const isOperator = brand.brand_kind === 'Operator brand';

  return (
    <>
      <div className="ph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
          {brand.logo_url && (
            <img src={brand.logo_url} alt=""
              style={{ height: 48, maxWidth: 170, objectFit: 'contain' }} />
          )}
          <div>
            <h2>{brand.name}</h2>
            <div className="ph-sub">
              {brand.brand_kind}
              {isOperator
                ? ` · runs a space in ${brand.operates.length} venue${brand.operates.length === 1 ? '' : 's'}`
                : ` · ${brand.locations.length} location${brand.locations.length === 1 ? '' : 's'} in the portal`}
            </div>
          </div>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {missing > 0 && (
        <div className="note">
          <strong>{missing} location{missing === 1 ? '' : 's'} not in the portal.</strong>{' '}
          Each needs its own venue — its own facilities, its own menu, its own listing. They
          share a name and a standard, and nothing else.
        </div>
      )}

      <div className="sect">
        <h3>The brand</h3>
        <div className="grid">
          <div className="f">
            <label>Name</label>
            <input data-bwignore style={sel} defaultValue={brand.name ?? ''}
              onBlur={(e) => e.target.value !== brand.name && save('name', e.target.value)} />
          </div>
          <div className="f">
            <label>What kind</label>
            <select style={sel} defaultValue={brand.brand_kind}
              onChange={(e) => save('brand_kind', e.target.value)}>
              <option>Venue brand</option>
              <option>Operator brand</option>
              <option>Both</option>
            </select>
            <span className="help">
              A venue brand owns its properties. An operator brand runs something inside
              somebody else&rsquo;s.
            </span>
          </div>
          <div className="f">
            <label>Website</label>
            <input data-bwignore style={sel} defaultValue={brand.website_url ?? ''}
              onBlur={(e) => e.target.value !== (brand.website_url ?? '')
                && save('website_url', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Logo</label>
            <input data-bwignore style={sel} defaultValue={brand.logo_url ?? ''}
              onBlur={(e) => e.target.value !== (brand.logo_url ?? '')
                && save('logo_url', e.target.value || null)} />
          </div>
          <div className="f">
            <label>How many locations they have</label>
            <input type="number" data-bwignore style={sel}
              defaultValue={brand.location_count ?? ''}
              onBlur={(e) => save('location_count',
                e.target.value === '' ? null : Number(e.target.value))} />
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea data-bwignore defaultValue={brand.description ?? ''}
              onBlur={(e) => e.target.value !== (brand.description ?? '')
                && save('description', e.target.value || null)} />
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>What they do everywhere</label>
            <textarea data-bwignore defaultValue={brand.standard_offering ?? ''}
              onBlur={(e) => e.target.value !== (brand.standard_offering ?? '')
                && save('standard_offering', e.target.value || null)} />
            <span className="help">
              In prose, not as a service list. Each location has its own menu, because the
              therapists and the rooms differ — a list here would put treatments on menus that
              do not carry them.
            </span>
          </div>
        </div>
      </div>

      {!isOperator && (
        <div className="sect">
          <h3>Locations</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Each is a venue in its own right, with its own listing
          </div>

          {!brand.locations.length ? (
            <div className="note">None yet.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Venue</th><th>Where</th><th>State</th><th></th></tr>
              </thead>
              <tbody>
                {brand.locations.map((v: Row) => (
                  <tr key={v.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {v.logo_url && (
                        <img src={v.logo_url} alt=""
                          style={{ height: 22, maxWidth: 60, objectFit: 'contain' }} />
                      )}
                      <Link href={`/venues/${v.id}/details`} style={{ textDecoration: 'none' }}>
                        <span className="v-name" style={{ fontSize: 15 }}>{v.venue_name}</span>
                      </Link>
                    </td>
                    <td className="v-slug">
                      {[v.cities?.name, v.countries?.name].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td><span className="pill empty">{v.venue_status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() => unlinkFromBrand(v.id))}>
                        Not part of this
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                        marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
            <div className="f" style={{ minWidth: 220 }}>
              <label style={{ fontSize: 9 }}>Add a location</label>
              <input data-bwignore style={sel} value={location.name}
                placeholder={`${brand.name} Tokyo`}
                onChange={(e) => setLocation({ ...location, name: e.target.value })} />
            </div>
            <div className="f" style={{ minWidth: 260, flex: 1 }}>
              <label style={{ fontSize: 9 }}>Its own page</label>
              <input data-bwignore style={sel} value={location.url}
                placeholder="https://"
                onChange={(e) => setLocation({ ...location, url: e.target.value })} />
            </div>
            <button className="btn quiet" disabled={pending || !location.name.trim()}
              onClick={() => act(() => addLocation(brand.id, location.name, location.url))}>
              Create it
            </button>
          </div>
        </div>
      )}

      {isOperator && (
        <div className="sect">
          <h3>Where they run a space</h3>
          {!brand.operates.length ? (
            <div className="note" style={{ marginBottom: 0 }}>
              Not recorded anywhere yet. Set this brand as the operator on a space, from that
              venue&rsquo;s Spaces tab.
            </div>
          ) : (
            <table>
              <thead><tr><th>Venue</th><th>The space</th><th>Where</th></tr></thead>
              <tbody>
                {brand.operates.map((sp: Row) => (
                  <tr key={sp.id}>
                    <td>
                      <Link href={`/venues/${sp.venues?.id}/details`}
                            style={{ textDecoration: 'none' }}>
                        <span className="v-name" style={{ fontSize: 15 }}>
                          {sp.venues?.venue_name}
                        </span>
                      </Link>
                    </td>
                    <td className="v-slug">{sp.name}</td>
                    <td className="v-slug">
                      {[sp.venues?.cities?.name, sp.venues?.countries?.name]
                        .filter(Boolean).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
