'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { markReviewed, saveDoc } from '@/app/actions/internalDocs';
import { DOC_CATEGORIES } from '@/lib/docCategories';
import { renderLegal } from '@/lib/legalRender';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const RANKS = [
  { value: 5,   label: 'Anybody signed in' },
  { value: 30,  label: 'Assistant and above' },
  { value: 50,  label: 'Concierge and above' },
  { value: 60,  label: 'Finance, Legal and above' },
  { value: 80,  label: 'Administrators only' },
  { value: 100, label: 'Owner only' },
];

/* ═══════════════════════════════════════════════════════════════════════
   ONE DOCUMENT

   Read by default, edited by choice. Most visits are somebody looking
   something up, and an editing interface makes that harder than it needs
   to be.

   The previous text is kept whenever the body changes — not a full
   history system, just enough that a paragraph rewritten in haste can be
   recovered, which is the failure that actually happens.
   ═══════════════════════════════════════════════════════════════════════ */

export default function DocEditor({ doc, versions }: { doc: Row; versions: Row[] }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!doc.body);
  const [body, setBody] = useState(doc.body ?? '');
  const [msg, setMsg] = useState('');

  const save = (column: string, value: unknown) => start(async () => {
    report('saving');
    const res = await saveDoc(doc.id, column, value);
    report(res.ok ? 'saved' : 'error');
    if (!res.ok) setMsg((res as any).error);
  });

  const sel: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '7px 9px', fontSize: 13, width: '100%',
  };

  const overdue = doc.reviewed_at
    && new Date(doc.reviewed_at).getTime()
       + (doc.review_every_months ?? 12) * 2_592_000_000 < Date.now();

  return (
    <>
      <div className="ph">
        <div>
          <h2>{doc.title}</h2>
          <div className="ph-sub">
            {doc.category}
            {doc.reviewed_at
              ? ` · looked at ${new Date(doc.reviewed_at).toLocaleDateString('en-AU',
                  { day: 'numeric', month: 'short', year: 'numeric' })}`
              : ' · never reviewed'}
            {doc.status !== 'Current' && ` · ${doc.status}`}
          </div>
        </div>
        <div className="ph-act">
          <button className={`btn ${editing ? '' : 'quiet'}`}
            onClick={() => setEditing(!editing)}>
            {editing ? 'Done editing' : 'Edit'}
          </button>
        </div>
      </div>

      {msg && <div className="note bad">{msg}</div>}

      {(overdue || !doc.reviewed_at) && (
        <div className="note">
          <strong>
            {doc.reviewed_at ? 'This is due a look.' : 'This has never been reviewed.'}
          </strong>{' '}
          Documentation rots quietly — a review date does not stop that, it only makes it visible.
          {' '}
          <button className="link-btn" disabled={pending}
            onClick={() => start(async () => {
              report('saving');
              const res = await markReviewed(doc.id);
              report(res.ok ? 'saved' : 'error');
              if (res.ok) setMsg('Marked as reviewed today.');
            })}>
            Still accurate
          </button>
        </div>
      )}

      {editing ? (
        <>
          <div className="grid">
            <div className="f">
              <label>Title</label>
              <input data-bwignore defaultValue={doc.title} style={sel}
                onBlur={(e) => e.target.value !== doc.title && save('title', e.target.value)} />
            </div>
            <div className="f">
              <label>Kind</label>
              <select defaultValue={doc.category} style={sel}
                onChange={(e) => save('category', e.target.value)}>
                {DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="f">
              <label>Visible to</label>
              <select defaultValue={doc.min_rank} style={sel}
                onChange={(e) => save('min_rank', Number(e.target.value))}>
                {RANKS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <span className="help">
                Most internal documentation is not sensitive. Some of it names rates or people.
              </span>
            </div>
            <div className="f">
              <label>State</label>
              <select defaultValue={doc.status} style={sel}
                onChange={(e) => save('status', e.target.value)}>
                {['Draft', 'Current', 'Superseded', 'Archived'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label>Summary</label>
              <input data-bwignore defaultValue={doc.summary ?? ''} style={sel}
                placeholder="One line describing what this covers"
                onBlur={(e) => e.target.value !== (doc.summary ?? '')
                  && save('summary', e.target.value || null)} />
            </div>
          </div>

          <div className="f" style={{ marginTop: 'var(--s4)' }}>
            <label>Body</label>
            <textarea data-bwignore value={body}
              style={{ minHeight: 460, fontFamily: 'ui-monospace, monospace',
                       fontSize: 12.5, lineHeight: 1.65 }}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => body !== (doc.body ?? '') && save('body', body)} />
            <span className="help">
              Markdown — ## for headings, ** for bold, - for lists. Saved when you click away, and
              the previous text is kept.
            </span>
          </div>
        </>
      ) : (
        <div className="sect">
          {doc.summary && (
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-quiet)',
                        maxWidth: '70ch', marginTop: 0 }}>{doc.summary}</p>
          )}
          <div className="legal-body"
               dangerouslySetInnerHTML={{ __html: renderLegal(doc.body ?? '') }} />
        </div>
      )}

      {!!(doc.related_tables ?? []).length && (
        <div className="sect">
          <h3>Tables this describes</h3>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {doc.related_tables.map((t: string) => (
              <span key={t} className="pill empty" style={{ fontSize: 10 }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {!!versions.length && (
        <div className="sect">
          <h3>Earlier versions</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Kept so a paragraph rewritten in haste can be recovered
          </div>
          <table>
            <thead><tr><th>Version</th><th>When</th><th>By</th><th></th></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="v-slug">v{v.version}</td>
                  <td className="v-slug">
                    {new Date(v.created_at).toLocaleDateString('en-AU',
                      { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="v-slug">{v.changed_by}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link-btn"
                      onClick={() => { setBody(v.body ?? ''); setEditing(true); }}>
                      Load it back
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
