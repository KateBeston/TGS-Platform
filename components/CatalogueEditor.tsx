'use client';

import { useState, useTransition } from 'react';
import Field from './Field';
import { addCatalogueRow, deleteCatalogueRow, saveCatalogueField } from '@/app/actions/catalogues';
import { useSaveState } from './SaveState';
import type { Catalogue } from '@/lib/catalogueSchema';

export default function CatalogueEditor({
  def, rows, parents,
}: {
  def: Catalogue;
  rows: Record<string, any>[];
  parents: { id: number; name: string }[];
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const add = () => start(async () => {
    report('saving');
    const res = await addCatalogueRow(def.table, name);
    if (res.ok) { setName(''); setErr(''); report('saved'); }
    else { setErr(res.error); report('error', 'Not added'); }
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                    marginBottom: 'var(--s6)', paddingBottom: 'var(--s5)',
                    borderBottom: '1px solid var(--border)' }}>
        <div className="f" style={{ minWidth: 320 }}>
          <label htmlFor="newname">Add to this catalogue</label>
          <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="newname" value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="Name" />
          {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
          {!err && <span className="help">A slug is generated from the name and can be edited after.</span>}
        </div>
        <button className="btn" disabled={pending || !name.trim()} onClick={add}>Add</button>
      </div>

      <div className="ph-sub" style={{ marginBottom: 'var(--s4)' }}>
        {rows.length} record{rows.length === 1 ? '' : 's'} · <code>{def.table}</code>
      </div>

      <div className="rows">
        {rows.map((row) => (
          <Row key={row.id} def={def} row={row} parents={parents}
               open={open === row.id} onToggle={() => setOpen(open === row.id ? null : row.id)} />
        ))}
      </div>
    </>
  );
}

function Row({
  def, row, parents, open, onToggle,
}: {
  def: Catalogue; row: Record<string, any>;
  parents: { id: number; name: string }[]; open: boolean; onToggle: () => void;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [unlocked, setUnlocked] = useState(false);

  const save = (column: string, value: unknown) =>
    saveCatalogueField(def.table, row.id, column, value);

  const parentName = def.parent
    ? parents.find((p) => p.id === row[def.parent!.column])?.name
    : null;

  return (
    <div className="row-card">
      <header>
        <div>
          <div className="rt" style={{ cursor: 'pointer' }} onClick={onToggle}>
            {row.name ?? 'Untitled'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-quiet)' }}>
            {row.slug ?? 'no slug'}
            {parentName && ` · ${parentName}`}
            {row.is_published === true && ' · published'}
            {row.is_published === false && ' · unpublished'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center' }}>
          <button className="link-btn" onClick={onToggle}>{open ? 'Close' : 'Edit'}</button>
          <button className="link-btn" disabled={pending}
            onClick={() => {
              if (!confirm(`Delete "${row.name}"? Records referencing it will block the delete.`)) return;
              start(async () => {
                report('saving');
                const res = await deleteCatalogueRow(def.table, row.id);
                report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not deleted');
                if (!res.ok) alert(res.error);
              });
            }}>Delete</button>
        </div>
      </header>

      {open && (
        <div className="grid">
          {def.parent && (
            <Field
              def={{ col: def.parent.column, label: def.parent.label, type: 'select' }}
              value={row[def.parent.column]} save={save} options={parents}
            />
          )}
          {def.fields.map((f) => {
            if (f.col === 'slug' && def.protected && !unlocked) {
              return (
                <div className="f" key="slug-locked">
                  <label>
                    <span>Slug</span>
                    <button type="button" className="link-btn"
                            onClick={() => setUnlocked(true)}>Unlock</button>
                  </label>
                  <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" value={row.slug ?? ''} readOnly
                         style={{ background: 'var(--warm-cream)', color: 'var(--ink-quiet)' }} />
                  <span className="help">Locked. Permanent once published.</span>
                </div>
              );
            }
            return (
              <div key={f.col} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                <Field def={f} value={row[f.col]} save={save} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
