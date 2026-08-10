'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  setServiceTaxon, renameService, addService, deleteService,
} from '@/app/actions/venueServices';

type Opt = { id: number; name: string; category_id?: number };
type Cat = { id: number; name: string };
type Service = {
  id: number; name: string; duration_minutes: number | null;
  base_price: number | null; currency: string | null;
  category_id: number | null; practice_id: number | null;
};

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '6px 8px', fontSize: 12.5, minWidth: 150,
};
const inp: React.CSSProperties = { ...sel, minWidth: 200 };

export default function VenueServicesEditor(
  { venueId, services, categories, practices, mapping }:
  {
    venueId: number; services: Service[]; categories: Cat[]; practices: Opt[];
    mapping: { categories: string[]; practices: string[] };
  },
) {
  const router = useRouter();
  const [adding, startAdd] = useTransition();
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');

  const add = () => {
    if (!newName.trim()) return;
    setErr('');
    startAdd(async () => {
      const r = await addService(venueId, newName);
      if (r.ok === false) { setErr(r.error); return; }
      setNewName(''); router.refresh();
    });
  };

  return (
    <>
      <div className="sect">
        <h3>Mapped to</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          The categories and practices this venue offers, drawn from its service
          attributions below. Read-only here &mdash; edit by attributing services, or on
          the Practices tab.
        </div>
        <div className="ph-sub" style={{ margin: 0 }}>
          <strong>Categories:</strong>{' '}
          {mapping.categories.length ? mapping.categories.join(', ') : '\u2014'}
        </div>
        <div className="ph-sub" style={{ margin: 0 }}>
          <strong>Practices:</strong>{' '}
          {mapping.practices.length ? mapping.practices.join(', ') : '\u2014'}
        </div>
      </div>

      <div className="sect">
        <h3>Wellness services</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          Attribute each service to a category, then a practice within it. That&rsquo;s
          what links the service to the right experience pages.
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--s3)' }}>
          <input data-bwignore style={inp} value={newName} placeholder="New service name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <button type="button" className="btn quiet" onClick={add} disabled={adding || !newName.trim()}>
            Add service
          </button>
          {err && <span className="ph-sub" style={{ margin: 0, color: 'var(--danger, #b23)' }}>{err}</span>}
        </div>

        {services.length ? (
          <table>
            <thead>
              <tr><th>Service</th><th>Duration</th><th>Category</th><th>Practice</th><th /></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <ServiceRow key={s.id} venueId={venueId} service={s}
                  categories={categories} practices={practices} />
              ))}
            </tbody>
          </table>
        ) : <span className="ph-sub">No services yet. Add one above.</span>}
      </div>
    </>
  );
}

function ServiceRow(
  { venueId, service, categories, practices }:
  { venueId: number; service: Service; categories: Cat[]; practices: Opt[] },
) {
  const router = useRouter();
  const [, start] = useTransition();
  const [catId, setCatId] = useState<number | null>(service.category_id);
  const [pracId, setPracId] = useState<number | null>(service.practice_id);
  const [note, setNote] = useState('');

  const inCat = practices.filter((p) => p.category_id === catId);

  const commit = (c: number | null, p: number | null) => start(async () => {
    setNote('');
    const r = await setServiceTaxon(service.id, c, p);
    setNote(r.ok === false ? r.error : 'Saved');
    if (r.ok) router.refresh();
  });

  const onCategory = (v: string) => {
    const c = v ? Number(v) : null;
    // if current practice isn't in the new category, drop it
    const keep = pracId && practices.find((p) => p.id === pracId)?.category_id === c ? pracId : null;
    setCatId(c); setPracId(keep);
    commit(c, keep);
  };
  const onPractice = (v: string) => {
    const p = v ? Number(v) : null;
    const c = p ? (practices.find((x) => x.id === p)?.category_id ?? catId) : catId;
    setCatId(c ?? null); setPracId(p);
    commit(c ?? null, p);
  };

  const remove = () => start(async () => {
    if (!confirm(`Delete service "${service.name}"?`)) return;
    const r = await deleteService(service.id, venueId);
    if (r.ok === false) setNote(r.error); else router.refresh();
  });

  return (
    <tr>
      <td>
        <input data-bwignore defaultValue={service.name}
          style={{ ...sel, minWidth: 180 }}
          onBlur={(e) => e.target.value.trim() && e.target.value !== service.name
            && start(async () => { await renameService(service.id, e.target.value); })} />
        {note && <div className="ph-sub" style={{ margin: '2px 0 0' }}>{note}</div>}
      </td>
      <td className="ph-sub">
        {service.duration_minutes ? `${service.duration_minutes} min` : '\u2014'}
      </td>
      <td>
        <select style={sel} value={catId ?? ''} onChange={(e) => onCategory(e.target.value)}>
          <option value="">\u2014 Category \u2014</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </td>
      <td>
        <select style={sel} value={pracId ?? ''} disabled={!catId}
          onChange={(e) => onPractice(e.target.value)}>
          <option value="">{catId ? '\u2014 Practice \u2014' : 'Pick a category first'}</option>
          {inCat.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>
      <td>
        <button type="button" className="btn quiet" onClick={remove}
          style={{ color: 'var(--danger, #b23)' }}>Delete</button>
      </td>
    </tr>
  );
}
