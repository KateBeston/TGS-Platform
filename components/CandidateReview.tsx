'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  asAlias, asNewItem, reject, reopen, suggestFor,
} from '@/app/actions/facilityCandidates';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, width: '100%',
};

const TABS = [
  { key: 'Pending',  label: 'To decide' },
  { key: 'Alias',    label: 'Another wording' },
  { key: 'Added',    label: 'Added' },
  { key: 'Rejected', label: 'Rejected' },
];

/* ═══════════════════════════════════════════════════════════════════════
   UNRECOGNISED AMENITIES

   Phrases venues wrote that the catalogue did not know.

   Three outcomes, and the middle one is both the commonest and the most
   valuable. Most unmatched phrases are not new things — they are other
   ways of saying something already listed. "Aircon", "AC" and "climate
   controlled" are all Air Conditioning, and adding each as a new item
   would fragment the catalogue until nothing filtered properly.

   Recording one as another wording improves matching for every venue read
   afterwards.
   ═══════════════════════════════════════════════════════════════════════ */

export default function CandidateReview({
  rows, items, categories, counts, status,
}: {
  rows: Row[]; items: Row[]; categories: Row[];
  counts: Record<string, number>; status: string;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Row[]>([]);
  const [chosenItem, setChosenItem] = useState<number | ''>('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<number | ''>('');
  const [newScope, setNewScope] = useState('Room');
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res?.ok === false ? res.error : (res?.message ?? ''));
    report(res?.ok === false ? 'error' : 'saved');
    if (res?.ok !== false) { setOpen(null); setChosenItem(''); setNewName(''); }
  });

  const openRow = (r: Row) => {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id);
    setNewName(r.phrase);
    setChosenItem('');
    setSuggestions([]);
    start(async () => setSuggestions(await suggestFor(r.phrase)));
  };

  return (
    <>
      <div className="ph">
        <div>
          <h2>Unrecognised amenities</h2>
          <div className="ph-sub">
            {counts.Pending ?? 0} to decide
            {counts.Alias ? ` · ${counts.Alias} recorded as other wordings` : ''}
          </div>
        </div>
      </div>

      <div className="note">
        <strong>Most of these are not new things.</strong> They are other ways of saying something
        already catalogued — aircon, AC and climate controlled are all Air Conditioning.</div>

      <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap',
                    marginBottom: 'var(--s5)' }}>
        {TABS.map((t) => (
          <Link key={t.key}
                className={`btn ${status === t.key ? '' : 'quiet'}`}
                href={`/settings/catalogues/candidates?status=${t.key}`}>
            {t.label}{counts[t.key] ? ` · ${counts[t.key]}` : ''}
          </Link>
        ))}
      </div>

      {msg && <div className="note">{msg}</div>}

      {!rows.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          {status === 'Pending'
            ? 'Nothing waiting. Anything a venue writes that the catalogue does not recognise will appear here.'
            : 'Nothing in this state.'}
        </div>
      )}

      {rows.map((r) => {
        const isOpen = open === r.id;
        return (
          <div className="row-card" key={r.id} style={{ marginBottom: 'var(--s2)' }}>
            <header>
              <div>
                <div className="rt" style={{ fontSize: 18 }}>{r.phrase}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                  <span className="pill empty">{r.scope}</span>
                  {' '}
                  {r.times_seen === 1
                    ? 'seen once'
                    : `seen ${r.times_seen} times`}
                  {r.venue_ids?.length > 1 && ` across ${r.venue_ids.length} venues`}
                  {r.facility_items?.name && (
                    <span style={{ color: 'var(--ink-gold)' }}>
                      {' '}· {r.status === 'Alias' ? 'a wording of' : 'became'}{' '}
                      {r.facility_items.name}
                    </span>
                  )}
                  {r.decided_note && ` · ${r.decided_note}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--s3)' }}>
                {r.status === 'Pending' ? (
                  <>
                    <button className="link-btn" onClick={() => openRow(r)}>
                      {isOpen ? 'Close' : 'Decide'}
                    </button>
                    <button className="link-btn" disabled={pending}
                      onClick={() => act(() => reject(r.id))}>Reject</button>
                  </>
                ) : (
                  <button className="link-btn" disabled={pending}
                    onClick={() => act(() => reopen(r.id))}>Reconsider</button>
                )}
              </div>
            </header>

            {isOpen && (
              <div className="grid">
                <div>
                  <div className="f">
                    <label>Another wording of</label>
                    <select value={chosenItem} style={sel}
                      onChange={(e) => setChosenItem(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Choose an existing item</option>
                      {!!suggestions.length && (
                        <optgroup label="Closest">
                          {suggestions.map((i) => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Everything">
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} · {(i as any).facility_categories?.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <span className="help">
                      Improves matching everywhere from now on
                    </span>
                  </div>
                  <button className="btn" disabled={pending || !chosenItem}
                    style={{ marginTop: 'var(--s3)' }}
                    onClick={() => act(() => asAlias(r.id, Number(chosenItem)))}>
                    Record as another wording
                  </button>
                </div>

                <div>
                  <div className="f">
                    <label>Or add as a new item</label>
                    <input data-bwignore value={newName} style={sel}
                      onChange={(e) => setNewName(e.target.value)} />
                    <span className="help">
                      Tidy the wording — this becomes the catalogue name
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s3)' }}>
                    <div className="f" style={{ flex: 1 }}>
                      <label>Category</label>
                      <select value={newCategory} style={sel}
                        onChange={(e) => setNewCategory(
                          e.target.value ? Number(e.target.value) : '')}>
                        <option value="">Choose</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="f" style={{ width: 120 }}>
                      <label>Belongs to</label>
                      <select value={newScope} style={sel}
                        onChange={(e) => setNewScope(e.target.value)}>
                        <option value="Room">A room</option>
                        <option value="Venue">The venue</option>
                        <option value="Either">Either</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn quiet" disabled={pending || !newName.trim() || !newCategory}
                    style={{ marginTop: 'var(--s3)' }}
                    onClick={() => act(() =>
                      asNewItem(r.id, Number(newCategory), newName, newScope))}>
                    Add to the catalogue
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
