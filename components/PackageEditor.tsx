'use client';

import { useState, useTransition } from 'react';
import {
  addPackage, addPackageItem, removePackage, removePackageItem,
  savePackage, savePackageItem,
} from '@/app/actions/packages';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 9px', fontSize: 13, width: '100%',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ═══════════════════════════════════════════════════════════════════════
   PACKAGES

   How spas actually sell. A named ritual at one price, made of several
   treatments — and the price point that converts.

   Each part is a row rather than a line of prose. That is what lets the
   listing show the practice tags beside a package, and what makes a venue
   selling hot stone massage only inside a ritual findable by somebody
   searching for hot stone massage.
   ═══════════════════════════════════════════════════════════════════════ */

export default function PackageEditor({
  venueId, packages, services,
}: { venueId: number; packages: Row[]; services: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newItem, setNewItem] = useState<Record<number, { service: string; label: string }>>({});
  const [msg, setMsg] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
  });

  /** What the parts cost separately, worked out here so the argument is
   *  visible while editing rather than only on the listing. */
  const separately = (items: Row[]) => items
    .filter((i) => !i.is_optional)
    .reduce((t, i) => t + Number(i.venue_services?.base_price ?? 0) * (i.quantity ?? 1), 0);

  const minutes = (items: Row[]) => items
    .filter((i) => !i.is_optional)
    .reduce((t, i) => t + Number(i.duration_minutes
      ?? i.venue_services?.duration_minutes ?? 0) * (i.quantity ?? 1), 0);

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>Packages</h3>
          <div className="ph-sub">
            {packages.length
              ? `${packages.length} · a named ritual at one price`
              : 'None yet'}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn quiet" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Add a package'}
          </button>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {adding && (
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                      marginBottom: 'var(--s4)' }}>
          <div className="f" style={{ flex: 1, maxWidth: 380 }}>
            <label>What is it called</label>
            <input data-bwignore style={sel} value={newName}
              placeholder="Restore &amp; Renew"
              onChange={(e) => setNewName(e.target.value)} />
          </div>
          <button className="btn" disabled={pending || !newName.trim()}
            onClick={() => act(async () => {
              const r = await addPackage(venueId, newName);
              if (r.ok) { setNewName(''); setAdding(false); setOpen(r.id ?? null); }
              return r;
            })}>Add</button>
        </div>
      )}

      {!packages.length ? (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing recorded. The listing shows &ldquo;no set packages at this venue, but a bespoke
          one can be arranged&rdquo; — which is a fair thing to say and better than an empty section.
        </div>
      ) : packages.map((p) => {
        const items = p.items ?? [];
        const alone = separately(items);
        const mins = minutes(items);
        const saving = alone > 0 && p.price ? alone - Number(p.price) : 0;

        return (
          <div className="row-card" key={p.id} style={{ marginBottom: 'var(--s2)' }}>
            <header>
              <div>
                <div className="rt" style={{ fontSize: 17 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                  {[
                    p.package_type,
                    items.length ? `${items.length} part${items.length === 1 ? '' : 's'}` : 'nothing in it yet',
                    mins ? `${mins} min` : null,
                    p.price ? `${p.currency ?? ''} ${p.price}` : null,
                    saving > 0 ? `saves ${p.currency ?? ''} ${saving.toFixed(0)}` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className="link-btn" onClick={() => setOpen(open === p.id ? null : p.id)}>
                {open === p.id ? 'Close' : 'Open'}
              </button>
            </header>

            {open === p.id && (
              <>
                <div className="grid">
                  {([['name','Name','text'],['package_type','Type','text'],
                     ['tagline','Tagline','text'],['duration_label','Duration as written','text'],
                     ['price','Price','number'],['price_per_person','Price per person','number'],
                     ['currency','Currency','text'],['max_participants','Maximum people','number'],
                    ] as [string,string,string][]).map(([col, label, kind]) => (
                    <div className="f" key={col}>
                      <label>{label}</label>
                      <input data-bwignore style={sel} type={kind === 'number' ? 'number' : 'text'}
                        defaultValue={p[col] ?? ''}
                        onBlur={(e) => {
                          const v = kind === 'number'
                            ? (e.target.value === '' ? null : Number(e.target.value))
                            : (e.target.value || null);
                          if (String(v ?? '') !== String(p[col] ?? '')) {
                            act(() => savePackage(p.id, col, v, venueId));
                          }
                        }} />
                    </div>
                  ))}

                  <div className="f" style={{ gridColumn: '1 / -1' }}>
                    <label>Description</label>
                    <textarea data-bwignore defaultValue={p.description ?? ''}
                      onBlur={(e) => e.target.value !== (p.description ?? '')
                        && act(() => savePackage(p.id, 'description',
                                                 e.target.value || null, venueId))} />
                  </div>

                  <div className="f" style={{ gridColumn: '1 / -1' }}>
                    <label>Months it runs</label>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {MONTHS.map((m, i) => {
                        const on = (p.available_months ?? []).includes(i + 1);
                        return (
                          <button key={m} type="button"
                            className={`pill ${on ? 'gold' : ''}`}
                            style={{ cursor: 'pointer',
                                     background: on ? undefined : 'var(--warm-white)' }}
                            onClick={() => {
                              const now: number[] = p.available_months ?? [];
                              const next = on ? now.filter((x) => x !== i + 1)
                                              : [...now, i + 1].sort((a, b) => a - b);
                              act(() => savePackage(p.id, 'available_months',
                                                    next.length ? next : null, venueId));
                            }}>{m}</button>
                        );
                      })}
                    </div>
                    <span className="help">
                      Leave all off for year round. A Winter Warmer is not a summer product.
                    </span>
                  </div>
                </div>

                {/* ── what is in it ───────────────────────────────── */}
                <div style={{ marginTop: 'var(--s5)' }}>
                  <div style={{ fontSize: 9, letterSpacing: '.14em',
                                textTransform: 'uppercase', color: 'var(--ink-quiet)',
                                marginBottom: 'var(--s3)' }}>
                    What is in it
                  </div>

                  {!items.length && (
                    <div className="note" style={{ fontSize: 12 }}>
                      Nothing yet. Each part is its own row — a ritual of three treatments is
                      three rows, which is what puts the practice tags on the listing.
                    </div>
                  )}

                  {items.map((i: Row) => (
                    <div key={i.id} style={{
                      display: 'flex', gap: 'var(--s3)', alignItems: 'center',
                      padding: '6px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13.5 }}>
                          {i.venue_services?.name ?? i.label}
                        </span>
                        <div className="v-slug">
                          {[
                            i.venue_services?.modality_practices?.name,
                            i.duration_minutes ?? i.venue_services?.duration_minutes
                              ? `${i.duration_minutes ?? i.venue_services.duration_minutes} min` : null,
                            i.venue_services?.base_price
                              ? `worth ${i.venue_services.base_price}` : null,
                            i.is_optional ? 'guest chooses' : null,
                            !i.service_id ? 'not a service' : null,
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <button className="link-btn" disabled={pending}
                        onClick={() => act(() => removePackageItem(i.id, venueId))}>
                        Remove
                      </button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                                marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
                    <div className="f" style={{ minWidth: 220, flex: 1 }}>
                      <label style={{ fontSize: 9 }}>Add a service</label>
                      <select style={sel}
                        value={newItem[p.id]?.service ?? ''}
                        onChange={(e) => setNewItem({
                          ...newItem,
                          [p.id]: { service: e.target.value, label: '' },
                        })}>
                        <option value="">Choose one</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="f" style={{ minWidth: 200, flex: 1 }}>
                      <label style={{ fontSize: 9 }}>Or describe it</label>
                      <input data-bwignore style={sel}
                        placeholder="Herbal tea on arrival"
                        value={newItem[p.id]?.label ?? ''}
                        onChange={(e) => setNewItem({
                          ...newItem,
                          [p.id]: { service: '', label: e.target.value },
                        })} />
                    </div>

                    <button className="btn quiet" disabled={pending}
                      onClick={() => {
                        const entry = newItem[p.id];
                        act(async () => {
                          const r = await addPackageItem(
                            p.id, venueId,
                            entry?.service ? Number(entry.service) : null,
                            entry?.label ?? null);
                          if (r.ok) setNewItem({ ...newItem, [p.id]: { service: '', label: '' } });
                          return r;
                        });
                      }}>Add</button>
                  </div>

                  {alone > 0 && (
                    <div className="note" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
                      Bought separately these come to <strong>{p.currency ?? ''} {alone.toFixed(2)}</strong>.
                      {p.price && saving > 0
                        ? ` The package saves ${saving.toFixed(2)}, which is the argument for it.`
                        : p.price
                          ? ' The package is priced at or above that, which is worth a look.'
                          : ' No package price set yet.'}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 'var(--s4)' }}>
                  <button className="link-btn" disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Remove "${p.name}" and everything in it?`)) return;
                      act(() => removePackage(p.id, venueId));
                    }}>Remove this package</button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
