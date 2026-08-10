'use client';

import { useState, useTransition } from 'react';
import { addComparable, removeComparable, saveComparable } from '@/app/actions/property';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const EVENTS = ['Sold', 'Listed', 'Withdrawn', 'Leased', 'Valued'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   COMPARABLES

   Recorded when noticed, not when a valuation needs one.

   Listings disappear. A price written down today is worth more than a
   search through old pages in three years, by which time the page is gone
   and the figure with it.
   ═══════════════════════════════════════════════════════════════════════ */

export default function ComparablesEditor({
  rows, countries,
}: { rows: Row[]; countries: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    report(res?.ok === false ? 'error' : 'saved');
  });

  const save = (id: number, col: string, v: unknown) =>
    act(() => saveComparable(id, col, v));

  /** Price over annual revenue. The number that turns a sale price into
   *  something comparable rather than a curiosity. */
  const multiple = (r: Row) =>
    r.price && r.annual_revenue && Number(r.annual_revenue) > 0
      ? (Number(r.price) / Number(r.annual_revenue)).toFixed(1) : null;

  return (
    <>
      <div className="ph">
        <div>
          <h2>Comparables</h2>
          <div className="ph-sub">
            {rows.length ? `${rows.length} recorded` : 'Nothing yet'}
          </div>
        </div>
        <div className="ph-act">
          <input data-bwignore value={name} placeholder="Property name"
            style={{ ...sel, width: 220 }}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && act(async () => {
              const r = await addComparable(name);
              if (r.ok) { setName(''); setOpen(r.id ?? null); }
              return r;
            })} />
          <button className="btn" disabled={pending || !name.trim()}
            onClick={() => act(async () => {
              const r = await addComparable(name);
              if (r.ok) { setName(''); setOpen(r.id ?? null); }
              return r;
            })}>Record it</button>
        </div>
      </div>

      <div className="note">
        <strong>Write one down whenever you see one.</strong> A retreat venue listed, sold or
        withdrawn — the price, the land, how many it sleeps. It takes a minute now and cannot be
        recovered later, because listings are taken down and the figures go with them.</div>

      {!rows.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing recorded. Even a rough entry — name, country, asking price — is worth more than
          nothing, and the detail can be filled in later.
        </div>
      )}

      {rows.map((r) => {
        const isOpen = open === r.id;
        const m = multiple(r);
        return (
          <div className="row-card" key={r.id} style={{ marginBottom: 'var(--s2)' }}>
            <header>
              <div>
                <div className="rt" style={{ fontSize: 18 }}>{r.property_name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-quiet)', marginTop: 2 }}>
                  <span className="pill empty">{r.event_type}</span>
                  {r.event_date && ` · ${new Date(r.event_date).toLocaleDateString('en-AU')}`}
                  {r.countries?.name && ` · ${r.countries.name}`}
                  {r.price && ` · ${r.currency ?? ''} ${Number(r.price).toLocaleString('en-AU')}`}
                  {m && (
                    <span style={{ color: 'var(--ink-gold)' }}>
                      {' '}· {m}× revenue
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--s3)' }}>
                <button className="link-btn" onClick={() => setOpen(isOpen ? null : r.id)}>
                  {isOpen ? 'Close' : 'Edit'}
                </button>
                <button className="link-btn" disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Remove ${r.property_name}?`)) return;
                    act(() => removeComparable(r.id));
                  }}>Remove</button>
              </div>
            </header>

            {isOpen && (
              <>
                <div className="grid">
                  <div className="f">
                    <label>Name</label>
                    <input data-bwignore defaultValue={r.property_name} style={sel}
                      onBlur={(e) => save(r.id, 'property_name', e.target.value)} />
                  </div>
                  <div className="f">
                    <label>Sale or transaction</label>
                    <select defaultValue={r.event_type} style={sel}
                      onChange={(e) => save(r.id, 'event_type', e.target.value)}>
                      {EVENTS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="f">
                    <label>Date</label>
                    <input type="date" data-bwignore defaultValue={r.event_date ?? ''} style={sel}
                      onBlur={(e) => save(r.id, 'event_date', e.target.value || null)} />
                  </div>
                  <div className="f">
                    <label>Country</label>
                    <select defaultValue={r.country_id ?? ''} style={sel}
                      onChange={(e) => save(r.id, 'country_id',
                        e.target.value ? Number(e.target.value) : null)}>
                      <option value="">—</option>
                      {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="f">
                    <label>Locality</label>
                    <input data-bwignore defaultValue={r.locality ?? ''} style={sel}
                      onBlur={(e) => save(r.id, 'locality', e.target.value || null)} />
                  </div>
                  <div className="f">
                    <label>Price</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="number" data-bwignore defaultValue={r.price ?? ''}
                        style={{ ...sel, flex: 1 }}
                        onBlur={(e) => save(r.id, 'price',
                          e.target.value ? Number(e.target.value) : null)} />
                      <input data-bwignore defaultValue={r.currency ?? 'AUD'}
                        style={{ ...sel, width: 66 }}
                        onBlur={(e) => save(r.id, 'currency', e.target.value || null)} />
                    </div>
                  </div>
                </div>

                <div className="grid" style={{ marginTop: 'var(--s3)' }}>
                  <div className="f">
                    <label>Annual revenue, if known</label>
                    <input type="number" data-bwignore defaultValue={r.annual_revenue ?? ''}
                      style={sel}
                      onBlur={(e) => save(r.id, 'annual_revenue',
                        e.target.value ? Number(e.target.value) : null)} />
                    <span className="help">
                      Annual revenue, if known
                    </span>
                  </div>
                  <div className="f">
                    <label>Source</label>
                    <input data-bwignore defaultValue={r.revenue_note ?? ''} style={sel}
                      placeholder="Agent, listing, the owner"
                      onBlur={(e) => save(r.id, 'revenue_note', e.target.value || null)} />
                  </div>
                  <div className="f">
                    <label>Sleeps</label>
                    <input type="number" data-bwignore defaultValue={r.max_guests ?? ''} style={sel}
                      onBlur={(e) => save(r.id, 'max_guests',
                        e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div className="f">
                    <label>Bedrooms</label>
                    <input type="number" data-bwignore defaultValue={r.bedrooms ?? ''} style={sel}
                      onBlur={(e) => save(r.id, 'bedrooms',
                        e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div className="f">
                    <label>Practice spaces</label>
                    <input type="number" data-bwignore defaultValue={r.practice_spaces ?? ''}
                      style={sel}
                      onBlur={(e) => save(r.id, 'practice_spaces',
                        e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div className="f">
                    <label>Land</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="number" data-bwignore defaultValue={r.land_area ?? ''}
                        style={{ ...sel, flex: 1 }}
                        onBlur={(e) => save(r.id, 'land_area',
                          e.target.value ? Number(e.target.value) : null)} />
                      <input data-bwignore defaultValue={r.land_area_unit ?? 'acres'}
                        style={{ ...sel, width: 80 }}
                        onBlur={(e) => save(r.id, 'land_area_unit', e.target.value || null)} />
                    </div>
                  </div>
                </div>

                <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
                  <div className="f">
                    <label>Source</label>
                    <input data-bwignore defaultValue={r.source_url ?? ''} style={sel}
                      placeholder="https://…"
                      onBlur={(e) => save(r.id, 'source_url', e.target.value || null)} />
                    <span className="help">
                      Worth keeping even though it will stop working — it says where the figure
                      came from
                    </span>
                  </div>
                  <div className="f">
                    <label>Notes</label>
                    <textarea data-bwignore defaultValue={r.notes ?? ''}
                      onBlur={(e) => save(r.id, 'notes', e.target.value || null)} />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
