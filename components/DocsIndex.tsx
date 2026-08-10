'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createDoc } from '@/app/actions/internalDocs';
import { DOC_CATEGORIES } from '@/lib/docCategories';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

/* ═══════════════════════════════════════════════════════════════════════
   INTERNAL DOCS

   How things work, why they were decided that way, and what to do when
   something breaks.

   Distinct from Legal, which exists to prove what somebody agreed to.
   This is the other kind — and the reason for it is narrow: a great deal
   of how TGS works currently lives in one person's head and in the
   comments of SQL nobody else will read. Fine at one person, a liability
   at two.
   ═══════════════════════════════════════════════════════════════════════ */

export default function DocsIndex({
  docs, stale, category,
}: { docs: Row[]; stale: Row[]; category: string }) {
  const router = useRouter();
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<string>('How it works');

  const byCategory = new Map<string, Row[]>();
  for (const d of docs) {
    byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]);
  }
  const staleIds = new Set(stale.map((s) => s.id));

  const sel: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '7px 9px', fontSize: 13, width: '100%',
  };

  return (
    <>
      <div className="ph">
        <div>
          <h2>Internal docs</h2>
          <div className="ph-sub">
            {docs.length} document{docs.length === 1 ? '' : 's'}
            {stale.length ? ` · ${stale.length} due a look` : ''}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Write one'}
          </button>
        </div>
      </div>

      <div className="note">
        <strong>How things work, why they were decided that way, and what to do when something
        breaks.</strong> Not the Legal section — that exists to prove what somebody agreed to.</div>

      {adding && (
        <div className="sect">
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                        flexWrap: 'wrap' }}>
            <div className="f" style={{ minWidth: 280, flex: 1 }}>
              <label>Title</label>
              <input data-bwignore value={title} style={sel}
                placeholder="How commission works"
                onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="f" style={{ minWidth: 200 }}>
              <label>Kind</label>
              <select value={cat} style={sel} onChange={(e) => setCat(e.target.value)}>
                {DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn" disabled={pending || !title.trim()}
              onClick={() => start(async () => {
                report('saving');
                const res = await createDoc(title, cat);
                report(res.ok ? 'saved' : 'error');
                if (res.ok && res.message) router.push(`/docs/${res.message}`);
              })}>Create</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap',
                    marginBottom: 'var(--s5)' }}>
        <Link className={`btn ${category === 'all' ? '' : 'quiet'}`} href="/docs">
          Everything
        </Link>
        {DOC_CATEGORIES.filter((c) => byCategory.has(c)).map((c) => (
          <Link key={c} className={`btn ${category === c ? '' : 'quiet'}`}
                href={`/docs?category=${encodeURIComponent(c)}`}>
            {c}
          </Link>
        ))}
      </div>

      {!docs.length && (
        <div className="note" style={{ marginBottom: 0 }}>
          Nothing here yet. The first thing worth writing is usually whatever you have just
          explained to somebody twice.
        </div>
      )}

      {[...byCategory.entries()].map(([cat, items]) => (
        <div className="sect" key={cat}>
          <h3>{cat}</h3>
          {items.map((d) => (
            <div className="row-card" key={d.id} style={{ marginBottom: 'var(--s2)' }}>
              <header>
                <div>
                  <Link href={`/docs/${d.slug}`} style={{ textDecoration: 'none' }}>
                    <div className="rt" style={{ fontSize: 18 }}>{d.title}</div>
                  </Link>
                  {d.summary && (
                    <div style={{ fontSize: 13, color: 'var(--ink-quiet)', marginTop: 3,
                                  maxWidth: '72ch' }}>{d.summary}</div>
                  )}
                  <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {d.status !== 'Current' && (
                      <span className="pill empty" style={{ fontSize: 9 }}>{d.status}</span>
                    )}
                    {d.is_confidential && (
                      <span className="pill" style={{ fontSize: 9, borderColor: 'var(--warn)',
                                                      color: 'var(--warn)' }}>Confidential</span>
                    )}
                    {staleIds.has(d.id) && (
                      <span className="pill" style={{ fontSize: 9, borderColor: 'var(--warn)',
                                                      color: 'var(--warn)' }}>
                        {d.reviewed_at ? 'Due a look' : 'Never reviewed'}
                      </span>
                    )}
                    {(d.tags ?? []).map((t: string) => (
                      <span key={t} className="pill empty" style={{ fontSize: 9 }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="v-slug" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(d.updated_at).toLocaleDateString('en-AU',
                    { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </header>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
