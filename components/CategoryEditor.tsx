'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveCategory, deleteCategory } from '@/app/actions/siteContent';
import { useSaveState } from './SaveState';
import { ShownInSelect, StatusSelect } from './SiteControls';
import { AddPractice } from './SiteCreate';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

export default function CategoryEditor(
  { category, practices }: { category: Row; practices: Row[] },
) {
  const router = useRouter();
  const { report } = useSaveState();
  const [, start] = useTransition();
  const [msg, setMsg] = useState('');
  const active = category.status === 'active';

  const save = (col: string, v: unknown) => start(async () => {
    report('saving');
    const r = await saveCategory(category.id, col, v);
    setMsg(r.ok === false ? r.error : '');
    report(r.ok === false ? 'error' : 'saved');
  });

  const remove = () => start(async () => {
    if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    const r = await deleteCategory(category.id);
    if (r.ok === false) setMsg(r.error); else router.push('/site');
  });

  return (
    <>
      <div className="ph">
        <h2>{category.name}</h2>
        <div className="ph-sub">
          Category · {practices.length} practice{practices.length === 1 ? '' : 's'}
          {' · '}{titleCase(category.status)}
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      <div className="sect">
        <h3>The page</h3>
        <div className="grid">
          <div className="f">
            <label>Name</label>
            <input data-bwignore style={sel} defaultValue={category.name ?? ''}
              onBlur={(e) => e.target.value !== category.name && save('name', e.target.value)} />
          </div>
          <div className="f">
            <label>Slug{active && ' (locked while active)'}</label>
            <input data-bwignore style={{ ...sel, opacity: active ? 0.55 : 1 }}
              defaultValue={category.slug ?? ''} readOnly={active}
              onBlur={(e) => !active && e.target.value !== category.slug
                && save('slug', e.target.value)} />
            {active && <span className="help">
              Live pages keep their address. Set status away from Active to change it.
            </span>}
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Tagline</label>
            <input data-bwignore style={sel} defaultValue={category.tagline ?? ''}
              onBlur={(e) => e.target.value !== (category.tagline ?? '')
                && save('tagline', e.target.value || null)} />
            <span className="help">One line, shown under the name on the experiences index.</span>
          </div>
          <div className="f">
            <label>Hero image URL</label>
            <input data-bwignore style={sel} defaultValue={category.hero_image_url ?? ''}
              onBlur={(e) => e.target.value !== (category.hero_image_url ?? '')
                && save('hero_image_url', e.target.value || null)} />
          </div>
          <div className="f">
            <label>Display order</label>
            <input type="number" data-bwignore style={sel}
              defaultValue={category.display_order ?? ''}
              onBlur={(e) => save('display_order', e.target.value === '' ? null : Number(e.target.value))} />
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Short description</label>
            <textarea data-bwignore defaultValue={category.description ?? ''}
              onBlur={(e) => e.target.value !== (category.description ?? '')
                && save('description', e.target.value || null)} />
            <span className="help">The intro shown inside the category panel on the index.</span>
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Intro (page body)</label>
            <textarea data-bwignore rows={6} defaultValue={category.intro ?? ''}
              onBlur={(e) => e.target.value !== (category.intro ?? '')
                && save('intro', e.target.value || null)} />
            <span className="help">Blank line between paragraphs.</span>
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Search</h3>
        <div className="grid">
          <div className="f">
            <label>Meta title</label>
            <input data-bwignore style={sel} defaultValue={category.meta_title ?? ''}
              onBlur={(e) => e.target.value !== (category.meta_title ?? '')
                && save('meta_title', e.target.value || null)} />
          </div>
          <div className="f">
            <label>H1</label>
            <input data-bwignore style={sel} defaultValue={category.h1 ?? ''}
              onBlur={(e) => e.target.value !== (category.h1 ?? '')
                && save('h1', e.target.value || null)} />
          </div>
          <div className="f" style={{ gridColumn: '1 / -1' }}>
            <label>Meta description</label>
            <textarea data-bwignore defaultValue={category.meta_description ?? ''}
              onBlur={(e) => e.target.value !== (category.meta_description ?? '')
                && save('meta_description', e.target.value || null)} />
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Visibility</h3>
        <div className="grid">
          <div className="f">
            <label>Shown in</label>
            <ShownInSelect kind="category" id={category.id}
              inWellness={!!category.in_wellness} inRetreat={!!category.in_retreat} />
            <span className="help">Where this category appears. Retreat and wellness can both apply.</span>
          </div>
          <div className="f">
            <label>Status</label>
            <StatusSelect kind="category" id={category.id} status={category.status} />
            <span className="help">Only <strong>Active</strong> shows on the public site.</span>
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Practices in this category</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          Each has its own page and editorial. Set where it shows and its status here,
          or open it to write the page.
        </div>
        <div style={{ marginBottom: 'var(--s3)' }}>
          <AddPractice categoryId={category.id} />
        </div>
        {practices.length ? (
          <table>
            <thead>
              <tr><th>Practice</th><th>Shown in</th><th>Status</th></tr>
            </thead>
            <tbody>
              {practices.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/site/practices/${p.id}`} style={{ color: 'var(--ink-gold)' }}>{p.name}</Link>
                  </td>
                  <td><ShownInSelect kind="practice" id={p.id} inWellness={!!p.in_wellness} inRetreat={!!p.in_retreat} /></td>
                  <td><StatusSelect kind="practice" id={p.id} status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <span className="ph-sub">None yet.</span>}
      </div>

      <div className="sect">
        <h3>Danger zone</h3>
        <button className="btn quiet" onClick={remove}
          style={{ color: 'var(--danger, #b23)', borderColor: 'var(--danger, #b23)' }}>
          Delete category
        </button>
        <span className="help">
          Only possible when it has no practices and no venues tagged. Otherwise set it to
          Redundant / Archived.
        </span>
      </div>
    </>
  );
}

function titleCase(s: string) {
  if (s === "archived") return "Redundant / Archived";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Draft";
}
