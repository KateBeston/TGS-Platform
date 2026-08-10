'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCollection } from '@/app/actions/curation';

export default function NewCollection() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  return (
    <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end' }}>
      <div className="f" style={{ minWidth: 300 }}>
        <label htmlFor="cn">Add a collection</label>
        <input id="cn" data-bwignore value={name} placeholder="Collection name"
          onChange={(e) => setName(e.target.value)}
          style={{ background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                   padding: '8px 10px', fontSize: 13 }} />
        {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      </div>
      <button className="btn" disabled={pending || !name.trim()}
        onClick={() => start(async () => {
          const res = await createCollection(name);
          if (res.ok && res.id) router.push(`/collections/${res.id}`);
          else if (!res.ok) setErr(res.error);
        })}>Create</button>
    </div>
  );
}
