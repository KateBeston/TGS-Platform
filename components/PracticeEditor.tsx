'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { savePractice, deletePractice } from '@/app/actions/siteContent';
import { useSaveState } from './SaveState';
import { ShownInSelect, StatusSelect } from './SiteControls';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

/* at_a_glance is a jsonb array of { label, value }. Edited here as plain
   "Label: Value" lines, one per row, and parsed back on save. */
function factsToText(v: any): string {
  if (!Array.isArray(v)) return '';
  return v.map((f) => `${f?.label ?? ''}: ${f?.value ?? ''}`).join('\n');
}
function textToFacts(text: string): { label: string; value: string }[] {
  return text.split('\n').map((line) => {
    const i = line.indexOf(':');
    if (i === -1) return null;
    const label = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    return label ? { label, value } : null;
  }).filter(Boolean) as { label: string; value: string }[];
}

export default function PracticeEditor(
  { practice, category }: { practice: Row; category: Row | null },
) {
  const router = useRouter();
  const { report } = useSaveState();
  const [, start] = useTransition();
  const [msg, setMsg] = useState('');
  const active = practice.status === 'active';

  const save = (col: string, v: unknown) => start(async () => {
    report('saving');
    const r = await savePractice(practice.id, col, v);
    setMsg(r.ok === false ? r.error : '');
    report(r.ok === false ? 'error' : 'saved');
  });

  const remove = () => start(async () => {
    if (!confirm(`Delete "${practice.name}"? This cannot be undone.`)) return;
    const r = await deletePractice(practice.id);
    if (r.ok === false) setMsg(r.error); else router.push(category ? `/site/categories/${category.id}` : '/site');
  });

  return (
    <>
      <div className="ph">
        {category && (
          <div className="tb-crumb">
            <Link href="/site">Site</Link> ·{' '}
            <Link href={`/site/categories/${category.id}`}>{category.name}</Link>
          </div>
        )}
        <h2 style={{ marginTop: 'var(--s3)' }}>{practice.name}</h2>
        <div className="ph-sub">Practice · {titleCase(practice.status)}</div>
      </div>

      {msg && <div className="note">{msg}</div>}

      <div className="sect">
        <h3>The page</h3>
        <div className="grid">
          <div className="f">
            <label>Name</label>
            <input data-bwignore style={sel} defaultValue={practice.name ?? ''}
              onBlur={(e) => e.target.value !== practice.name && save('name', e.target.value)} />
          </div>
          <div className="f">
            <label>Slug{active && ' (locked while active)'}</label>
            <input data-bwignore style={{ ...sel, opacity: active ? 0.55 : 1 }}
              defaultValue={practice.slug ?? ''} readOnly={active}
              onBlur={(e) => !active && e.target.value !== practice.slug
                && save('slug', e.target.value)} />
            {active && <span className="help">
              Live pages keep their address. Set status away from Active to change it.
            </span>}
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Tagline</label>
            <input data-bwignore style={sel} defaultValue={practice.tagline ?? ''}
              onBlur={(e) => e.target.value !== (practice.tagline ?? '')
                && save('tagline', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Hero image URL</label>
            <input data-bwignore style={sel} defaultValue={practice.hero_image_url ?? ''}
              onBlur={(e) => e.target.value !== (practice.hero_image_url ?? '')
                && save('hero_image_url', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Display order</label>
            <input type="number" data-bwignore style={sel}
              defaultValue={practice.display_order ?? ''}
              onBlur={(e) => save('display_order', e.target.value === '' ? null : Number(e.target.value))} />
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Short description</label>
            <textarea data-bwignore defaultValue={practice.description ?? ''}
              onBlur={(e) => e.target.value !== (practice.description ?? '')
                && save('description', e.target.value || null)} />
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Intro (the written page body)</label>
            <textarea data-bwignore rows={8} defaultValue={practice.intro ?? ''}
              onBlur={(e) => e.target.value !== (practice.intro ?? '')
                && save('intro', e.target.value || null)} />
            <span className="help">
              The ~15% you write, so the page has a reason to rank. Blank line between paragraphs.
            </span>
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>At a glance</label>
            <textarea data-bwignore rows={5} defaultValue={factsToText(practice.at_a_glance)}
              onBlur={(e) => {
                const next = textToFacts(e.target.value);
                save('at_a_glance', next.length ? next : null);
              }} />
            <span className="help">
              One fact per line as <code>Label: Value</code> — e.g. <code>Typical session: 60–120 minutes</code>.
            </span>
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Search</h3>
        <div className="grid">
          <div className="f">
            <label>Meta title</label>
            <input data-bwignore style={sel} defaultValue={practice.meta_title ?? ''}
              onBlur={(e) => e.target.value !== (practice.meta_title ?? '')
                && save('meta_title', e.target.value || null)} />
          </div>
          <div className="f">
            <label>H1</label>
            <input data-bwignore style={sel} defaultValue={practice.h1 ?? ''}
              onBlur={(e) => e.target.value !== (practice.h1 ?? '')
                && save('h1', e.target.value || null)} />
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Meta description</label>
            <textarea data-bwignore defaultValue={practice.meta_description ?? ''}
              onBlur={(e) => e.target.value !== (practice.meta_description ?? '')
                && save('meta_description', e.target.value || null)} />
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Visibility</h3>
        <div className="grid">
          <div className="f">
            <label>Shown in</label>
            <ShownInSelect kind="practice" id={practice.id}
              inWellness={!!practice.in_wellness} inRetreat={!!practice.in_retreat} />
          </div>
          <div className="f">
            <label>Status</label>
            <StatusSelect kind="practice" id={practice.id} status={practice.status} />
            <span className="help">Only <strong>Active</strong> shows on the public site.</span>
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Danger zone</h3>
        <button className="btn quiet" onClick={remove}
          style={{ color: 'var(--danger, #b23)', borderColor: 'var(--danger, #b23)' }}>
          Delete practice
        </button>
        <span className="help">
          Only possible when no venues offer it. Otherwise set it to Redundant / Archived.
        </span>
      </div>
    </>
  );
}

function titleCase(s: string) {
  if (s === "archived") return "Redundant / Archived";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Draft";
}
