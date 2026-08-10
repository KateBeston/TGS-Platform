'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { addBrand, addLocation, saveBrand } from '@/app/actions/brands';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 9px', fontSize: 13, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   BRANDS AND CHAINS

   Two relationships that look alike.

   A venue brand owns its properties — 1 Hotels, AIRE, Sofitel. Each
   location is its own venue with its own services, facilities and prices,
   and its own listing. The brand is what they share, not a thing they are
   part of.

   An operator brand runs something inside somebody else's venue —
   Bamford in a hotel. It owns no property and appears as a space in
   several.

   The number worth watching is the gap between what a brand has and what
   is in the portal. 1 Hotels has fifteen properties and one venue record,
   and nothing said so until this screen existed.
   ═══════════════════════════════════════════════════════════════════════ */

export default function BrandList({ brands }: { brands: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: '', kind: 'Venue brand' });
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [location, setLocation] = useState({ name: '', url: '' });
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  const owners = brands.filter((b) => b.brand_kind !== 'Operator brand');
  const operators = brands.filter((b) => b.brand_kind === 'Operator brand');
  const incomplete = owners.filter((b) => (b.missing ?? 0) > 0);

  return (
    <>
      <div className="ph">
        <div>
          <h2>Brands</h2>
          <div className="ph-sub">
            {owners.length} chains · {operators.length} operator brands
            {incomplete.length ? ` · ${incomplete.length} missing locations` : ''}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Add a brand'}
          </button>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {adding && (
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
          <div className="f" style={{ minWidth: 240 }}>
            <label>Name</label>
            <input data-bwignore style={sel} value={newBrand.name}
              onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} />
          </div>
          <div className="f" style={{ minWidth: 200 }}>
            <label>What kind</label>
            <select style={sel} value={newBrand.kind}
              onChange={(e) => setNewBrand({ ...newBrand, kind: e.target.value })}>
              <option>Venue brand</option>
              <option>Operator brand</option>
              <option>Both</option>
            </select>
            <span className="help">
              {newBrand.kind === 'Operator brand'
                ? 'Runs something inside somebody else\u2019s venue'
                : 'Owns its properties'}
            </span>
          </div>
          <button className="btn" disabled={pending || !newBrand.name.trim()}
            onClick={() => act(async () => {
              const r = await addBrand(newBrand.name, newBrand.kind);
              if (r.ok) { setNewBrand({ name: '', kind: 'Venue brand' }); setAdding(false); }
              return r;
            })}>Add</button>
        </div>
      )}

      {!!incomplete.length && (
        <div className="note">
          <strong>
            {incomplete.map((b) => `${b.name} (${b.in_portal} of ${b.location_count})`).join(', ')}
          </strong>
          {' '}— locations the brand has that the portal does not. Each needs its own venue, with
          its own services and prices.
        </div>
      )}

      <div className="sect">
        <h3>Chains</h3>
        <table>
          <thead>
            <tr><th>Brand</th><th>In the portal</th><th>They have</th><th></th></tr>
          </thead>
          <tbody>
            {owners.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/venues/brands/${b.id}`} style={{ textDecoration: 'none' }}>
                    <span className="v-name" style={{ fontSize: 15 }}>{b.name}</span>
                  </Link>
                  {b.website_url && (
                    <div className="v-slug">{b.website_url.replace(/^https?:\/\//, '')}</div>
                  )}
                </td>
                <td className="v-slug">{b.in_portal}</td>
                <td>
                  <input type="number" data-bwignore style={{ ...sel, width: 70 }}
                    defaultValue={b.location_count ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      if (String(v ?? '') !== String(b.location_count ?? '')) {
                        act(() => saveBrand(b.id, 'location_count', v));
                      }
                    }} />
                  {(b.missing ?? 0) > 0 && (
                    <div className="v-slug" style={{ color: 'var(--warn)' }}>
                      {b.missing} missing
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="link-btn"
                    onClick={() => setAddingTo(addingTo === b.id ? null : b.id)}>
                    Add a location
                  </button>

                  {addingTo === b.id && (
                    <div style={{ marginTop: 'var(--s3)', textAlign: 'left' }}>
                      <div className="f">
                        <label style={{ fontSize: 9 }}>Name</label>
                        <input data-bwignore style={sel} value={location.name}
                          placeholder={`${b.name} Tokyo`}
                          onChange={(e) => setLocation({ ...location, name: e.target.value })} />
                      </div>
                      <div className="f">
                        <label style={{ fontSize: 9 }}>Its own page</label>
                        <input data-bwignore style={sel} value={location.url}
                          placeholder="https://"
                          onChange={(e) => setLocation({ ...location, url: e.target.value })} />
                      </div>
                      <button className="btn quiet" disabled={pending || !location.name.trim()}
                        onClick={() => act(async () => {
                          const r = await addLocation(b.id, location.name, location.url);
                          if (r.ok) { setLocation({ name: '', url: '' }); setAddingTo(null); }
                          return r;
                        })}>Create it</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!!operators.length && (
        <div className="sect">
          <h3>Operator brands</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            They own no property. They run a space inside somebody else&rsquo;s.
          </div>
          <table>
            <thead><tr><th>Brand</th><th>Runs a space in</th></tr></thead>
            <tbody>
              {operators.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/venues/brands/${b.id}`} style={{ textDecoration: 'none' }}>
                      <span className="v-name" style={{ fontSize: 15 }}>{b.name}</span>
                    </Link>
                    {b.standard_offering && (
                      <div className="v-slug" style={{ maxWidth: 460 }}>
                        {b.standard_offering}
                      </div>
                    )}
                  </td>
                  <td className="v-slug">{b.in_portal || 'nowhere yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
