'use client';

import { useState, useTransition } from 'react';
import { saveFacilityField, toggleFacility } from '@/app/actions/taxonomy';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

export default function FacilitiesEditor({
  venueId, categories, items, mine, relevance,
}: {
  venueId: number; categories: Row[]; items: Row[]; mine: Row[];
  /** Which items suit this venue type. Ordering only — everything stays
   *  available, because a venue with something unexpected must be able to
   *  record it. A meditation cave in rural Mexico is not an error. */
  relevance?: Record<number, string>;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [have, setHave] = useState<Row[]>(mine);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  const act = (fn: () => Promise<any>, undo?: () => void) => start(async () => {
    report('saving');
    const res = await fn();
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not saved');
    if (!res.ok) { undo?.(); alert(res.error); }
  });

  const rowFor = (itemId: number) => have.find((h) => h.facility_item_id === itemId);

  const toggle = (item: Row) => {
    const existing = rowFor(item.id);
    const prev = have;
    setHave(existing
      ? have.filter((h) => h.facility_item_id !== item.id)
      : [...have, { facility_item_id: item.id, venue_id: venueId, id: -Date.now() }]);
    act(() => toggleFacility(venueId, item.id, !existing), () => setHave(prev));
  };

  const q = filter.trim().toLowerCase();
  const inCat = (c: Row) => {
    // Ordered by how likely this venue type is to have it, so a bathhouse
    // sees thermal circuits first and a farmhouse sees them last. Nothing
    // is hidden — a venue with something unexpected must still be able to
    // record it.
    const rank = (x: Row) =>
      relevance?.[x.id] === 'Expected' ? 1
      : relevance?.[x.id] === 'Likely' ? 2 : 3;

    const list = items
      .filter((i) => i.facility_category_id === c.id)
      .sort((a, b) => rank(a) - rank(b)
        || (a.display_order ?? 999) - (b.display_order ?? 999));
    return q ? list.filter((i) => i.name.toLowerCase().includes(q)) : list;
  };

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Facilities</h2>
          <div className="ph-sub">
            {have.length} of {items.length} in the catalogue
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Only what is true is stored.</strong> This replaced roughly 470 boolean columns —
        a venue with 400 columns of "false" told you nothing about whether anyone had checked.</div>

      <div className="f" style={{ maxWidth: 320, marginBottom: 'var(--s5)' }}>
        <label htmlFor="ff">Find a facility</label>
        <input id="ff" data-bwignore value={filter} placeholder="Type to narrow"
               onChange={(e) => setFilter(e.target.value)}
               style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                        padding: '8px 10px', fontSize: 13 }} />
      </div>

      {categories.map((c) => {
        const list = inCat(c);
        if (q && !list.length) return null;
        const chosen = list.filter((i) => rowFor(i.id)).length;
        const isOpen = open === c.id || !!q;

        return (
          <div className="row-card" key={c.id} style={{ marginBottom: 'var(--s3)' }}>
            <header>
              <div>
                <div className="rt">{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-quiet)' }}>
                  {chosen ? `${chosen} of ${list.length} selected` : `None of ${list.length}`}
                </div>
              </div>
              <button className="link-btn" onClick={() => setOpen(open === c.id ? null : c.id)}>
                {isOpen ? 'Close' : 'Choose'}
              </button>
            </header>

            {isOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {list.map((i) => {
                  const row = rowFor(i.id);
                  const on = !!row;
                  return (
                    <span key={i.id} style={{ display: 'inline-flex', alignItems: 'stretch' }}>
                      <button type="button" disabled={pending}
                        className={`pill ${on ? 'gold' : ''}`}
                        style={{ cursor: 'pointer',
                                 background: on ? undefined : 'var(--warm-white)',
                                 borderRight: on ? 'none' : undefined }}
                        onClick={() => toggle(i)}
                        title={i.is_filterable ? 'Appears as a public search filter' : undefined}>
                        {i.name}{i.is_filterable ? ' \u2022' : ''}
                      </button>
                      {on && row && row.id > 0 && (
                        <button type="button" className="pill gold"
                          style={{ cursor: 'pointer', borderLeft: '1px solid rgba(0,0,0,.15)',
                                   padding: '3px 7px' }}
                          onClick={() => setDetail(detail === row.id ? null : row.id)}
                          title="Add detail">
                          {detail === row.id ? '\u2212' : '+'}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {isOpen && detail && list.some((i) => rowFor(i.id)?.id === detail) && (
              <FacilityDetail
                row={have.find((h) => h.id === detail)!}
                item={items.find((i) => i.id === have.find((h) => h.id === detail)!.facility_item_id)!}
                venueId={venueId} act={act} pending={pending} />
            )}
          </div>
        );
      })}

      <div className="note" style={{ marginTop: 'var(--s4)' }}>
        A dot marks a facility that appears as a public search filter. Use the plus beside a
        selected item to record quantity, size, temperature or a description for the listing.
      </div>
    </div></div>
  );
}

function FacilityDetail({
  row, item, venueId, act, pending,
}: {
  row: Row; item: Row; venueId: number; pending: boolean;
  act: (fn: () => Promise<any>) => void;
}) {
  const save = (col: string, v: unknown) =>
    act(() => saveFacilityField(row.id, venueId, col, v));

  return (
    <div style={{ marginTop: 'var(--s4)', paddingTop: 'var(--s4)',
                  borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                    color: 'var(--ink-quiet)', marginBottom: 'var(--s3)' }}>
        {item.name}
      </div>
      <div className="grid">
        <Fld label="Quantity" type="number" initial={row.quantity}
             onSave={(v) => save('quantity', v === null ? null : Number(v))} />
        <Fld label="Capacity" type="number" initial={row.capacity}
             onSave={(v) => save('capacity', v === null ? null : Number(v))} />
        <Fld label="Size" initial={row.size_value} onSave={(v) => save('size_value', v)} />
        <Fld label="Size unit" initial={row.size_unit} onSave={(v) => save('size_unit', v)} />
        <Fld label="Temperature" initial={row.temperature} onSave={(v) => save('temperature', v)} />
        <Fld label="Setting" initial={row.setting} onSave={(v) => save('setting', v)}
             help="Indoor, outdoor, covered" />
        <Fld label="Operating hours" initial={row.operating_hours}
             onSave={(v) => save('operating_hours', v)} />
        <Fld label="Water source" initial={row.water_source} onSave={(v) => save('water_source', v)} />
      </div>
      <div className="grid one" style={{ marginTop: 'var(--s3)' }}>
        <Fld label="Title on the listing" initial={row.website_title}
             onSave={(v) => save('website_title', v)}
             help="Leave blank to use the catalogue name" />
        <Fld label="Description on the listing" textarea initial={row.website_description}
             onSave={(v) => save('website_description', v)} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s3)' }}>
        <button type="button" disabled={pending}
          className={`pill ${row.show_on_website !== false ? 'gold' : ''}`}
          style={{ cursor: 'pointer',
                   background: row.show_on_website !== false ? undefined : 'var(--warm-white)' }}
          onClick={() => save('show_on_website', row.show_on_website === false)}>
          {row.show_on_website !== false ? 'Shown on listing' : 'Hidden'}
        </button>
        <button type="button" disabled={pending}
          className={`pill ${row.is_heated ? 'gold' : ''}`}
          style={{ cursor: 'pointer', background: row.is_heated ? undefined : 'var(--warm-white)' }}
          onClick={() => save('is_heated', !row.is_heated)}>Heated</button>
        <button type="button" disabled={pending}
          className={`pill ${row.is_private ? 'gold' : ''}`}
          style={{ cursor: 'pointer', background: row.is_private ? undefined : 'var(--warm-white)' }}
          onClick={() => save('is_private', !row.is_private)}>Private</button>
      </div>
    </div>
  );
}

function Fld({
  label, initial, onSave, type = 'text', help, textarea,
}: {
  label: string; initial: any; onSave: (v: string | null) => void;
  type?: string; help?: string; textarea?: boolean;
}) {
  const [v, setV] = useState(initial ?? '');
  const commit = () => { if (String(v) !== String(initial ?? '')) onSave(v === '' ? null : v); };
  return (
    <div className="f">
      <label>{label}</label>
      {textarea
        ? <textarea data-bwignore value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
        : <input data-bwignore type={type} value={v}
                 onChange={(e) => setV(e.target.value)} onBlur={commit} />}
      {help && <span className="help">{help}</span>}
    </div>
  );
}
