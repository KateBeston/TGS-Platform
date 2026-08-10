'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createLegalDocument } from '@/app/actions/legal';

const TYPES = ['Public', 'Venue', 'Host', 'Guest', 'Partner', 'Internal', 'Consent', 'Template'];
const CATEGORIES = ['Website', 'Booking', 'Data & privacy', 'Consent', 'Venue agreements',
  'Host agreements', 'Insurance & compliance', 'Internal policy', 'Templates'];

export default function NewLegalDocument() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [type, setType] = useState('Public');
  const [category, setCategory] = useState('Website');
  const [err, setErr] = useState('');

  const sel = { background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                padding: '8px 10px', fontSize: 13 };

  return (
    <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="f" style={{ minWidth: 280, flex: 1 }}>
        <label htmlFor="ld">Add a document</label>
        <input id="ld" data-bwignore value={name} placeholder="Document name" style={sel}
               onChange={(e) => setName(e.target.value)} />
        {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      </div>
      <div className="f" style={{ minWidth: 130 }}>
        <label htmlFor="lt">For</label>
        <select id="lt" value={type} style={sel} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="f" style={{ minWidth: 170 }}>
        <label htmlFor="lc">Category</label>
        <select id="lc" value={category} style={sel} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <button className="btn" disabled={pending || !name.trim()}
        onClick={() => start(async () => {
          const res = await createLegalDocument(name, type, category);
          if (res.ok && res.id) router.push(`/legal/${res.id}`);
          else if (!res.ok) setErr(res.error);
        })}>Create</button>
    </div>
  );
}
