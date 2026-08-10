'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addPractice } from '@/app/actions/siteContent';
import { ShownInSelect, StatusSelect } from './SiteControls';

type Practice = {
  id: number; name: string; status: string;
  in_wellness: boolean; in_retreat: boolean;
};
type Category = Practice & { tagline?: string | null; practices: Practice[] };

/* The taxonomy overview: every category with its practices listed
   individually beneath it, each with its own Shown-in and Status, plus an
   inline field to add a practice straight into the category. */

export default function SiteTaxonomy({ categories }: { categories: Category[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      {categories.map((c) => <CategoryBlock key={c.id} c={c} />)}
    </div>
  );
}

function CategoryBlock({ c }: { c: Category }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: '1px solid var(--border-input)', background: 'var(--warm-white)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', background: 'var(--warm-cream)',
        borderBottom: open ? '1px solid var(--border-input)' : 'none',
      }}>
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}
          style={{ width: 22, height: 22, lineHeight: '20px', textAlign: 'center', cursor: 'pointer',
            border: '1px solid var(--border-input)', background: 'var(--warm-white)', fontSize: 14 }}>
          {open ? '\u2212' : '+'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/site/categories/${c.id}`} style={{ color: 'var(--ink-gold)', fontWeight: 600 }}>
            {c.name}
          </Link>
          {c.tagline && <div className="ph-sub" style={{ margin: 0 }}>{c.tagline}</div>}
        </div>
        <span className="ph-sub" style={{ margin: 0 }}>{c.practices.length} practice{c.practices.length === 1 ? '' : 's'}</span>
        <ShownInSelect kind="category" id={c.id} inWellness={!!c.in_wellness} inRetreat={!!c.in_retreat} />
        <StatusSelect kind="category" id={c.id} status={c.status} />
      </div>

      {open && (
        <div>
          {c.practices.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 14px 9px 44px', borderBottom: '1px solid var(--warm-cream)',
            }}>
              <Link href={`/site/practices/${p.id}`} style={{ flex: 1, minWidth: 0, color: 'var(--ink)' }}>
                {p.name}
              </Link>
              <ShownInSelect kind="practice" id={p.id} inWellness={!!p.in_wellness} inRetreat={!!p.in_retreat} />
              <StatusSelect kind="practice" id={p.id} status={p.status} />
            </div>
          ))}
          <AddPracticeInline categoryId={c.id} />
        </div>
      )}
    </div>
  );
}

function AddPracticeInline({ categoryId }: { categoryId: number }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    setErr('');
    start(async () => {
      const r = await addPractice(categoryId, name);
      if (r.ok === false) { setErr(r.error); return; }
      setName('');
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 12px 44px' }}>
      <input data-bwignore value={name} placeholder="Add a practice to this category\u2026"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
          padding: '6px 9px', fontSize: 13, minWidth: 260, opacity: pending ? 0.6 : 1 }} />
      <button type="button" className="btn quiet" onClick={submit} disabled={pending || !name.trim()}>
        Add
      </button>
      {err && <span className="ph-sub" style={{ margin: 0, color: 'var(--danger, #b23)' }}>{err}</span>}
    </div>
  );
}
