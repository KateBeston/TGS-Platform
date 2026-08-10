'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addCategory, addPractice } from '@/app/actions/siteContent';

const inp: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 10px', fontSize: 13, minWidth: 220,
};
const sel: React.CSSProperties = { ...inp, minWidth: 0 };

export function AddCategory() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [shownIn, setShownIn] = useState('wellness');
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input data-bwignore style={inp} placeholder="New category name" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      <select style={sel} value={shownIn} onChange={(e) => setShownIn(e.target.value)}>
        <option value="wellness">Wellness</option>
        <option value="retreat">Retreat</option>
        <option value="both">Both</option>
      </select>
      <button className="btn" disabled={pending || !name.trim()} onClick={submit}>Add category</button>
      {err && <span className="ph-sub" style={{ color: 'var(--danger, #b23)' }}>{err}</span>}
    </div>
  );
  function submit() {
    if (!name.trim()) return;
    setErr('');
    start(async () => {
      const r = await addCategory(name, shownIn);
      if (r.ok === false) { setErr(r.error); return; }
      if (r.id) router.push(`/site/categories/${r.id}`);
    });
  }
}

export function AddPractice({ categoryId }: { categoryId: number }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input data-bwignore style={inp} placeholder="New practice name" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      <button className="btn" disabled={pending || !name.trim()} onClick={submit}>Add practice</button>
      {err && <span className="ph-sub" style={{ color: 'var(--danger, #b23)' }}>{err}</span>}
    </div>
  );
  function submit() {
    if (!name.trim()) return;
    setErr('');
    start(async () => {
      const r = await addPractice(categoryId, name);
      if (r.ok === false) { setErr(r.error); return; }
      if (r.id) router.push(`/site/practices/${r.id}`);
    });
  }
}
