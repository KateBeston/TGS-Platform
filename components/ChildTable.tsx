'use client';

import { useState, useTransition } from 'react';
import Field from './Field';
import { addChildRow, deleteChildRow, saveChildField } from '@/app/actions/venue-crud';
import { useSaveState } from './SaveState';
import type { ChildTable as ChildDef } from '@/lib/venueSchema';

export default function ChildTable({
  venueId, def, rows, lookups,
}: {
  venueId: number; def: ChildDef; rows: Record<string, any>[];
  /** Options for fields declaring a lookup — practices, categories,
   *  venue types. Field already renders these; they were simply never
   *  passed down, so a select on a child row came out empty. */
  lookups?: Record<string, { id: number | string; name: string }[]>;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();

  const [problem, setProblem] = useState('');

  const add = () => start(async () => {
    report('saving');
    setProblem('');
    const res = await addChildRow(def.table, venueId);
    if (res.ok) { report('saved'); return; }
    // The real reason rather than "Not added", which sends somebody
    // looking at the button when the fault is in the database.
    report('error');
    setProblem((res as any).error ?? 'Could not add it.');
  });

  /* Singleton tables hold one row per venue. If it doesn't exist yet the
     first action creates it, so the form is never blocked by an absent row. */
  if (def.singleton) {
    const row = rows[0];
    return (
      <div className="sect">
        <h3>{def.title}</h3>
        {def.note && <div className="note">{def.note}</div>}
        {problem && <div className="note bad">{problem}</div>}
        {!row ? (
          <button className="btn" disabled={pending} onClick={add}>
            Create {def.singular}
          </button>
        ) : (
          <div className="grid">
            {def.fields.map((f) => (
              <div key={f.col} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                <Field def={f} value={row[f.col]}
                  options={f.lookup ? lookups?.[f.lookup] : undefined}
                  save={(c, v) => saveChildField(def.table, row.id, c, v, venueId)} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sect">
      <div className="ph" style={{ marginBottom: 'var(--s4)' }}>
        <div>
          <h3 style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>{def.title}</h3>
          <div className="ph-sub">
            {rows.length} record{rows.length === 1 ? '' : 's'} · <code>{def.table}</code>
          </div>
        </div>
        <div className="ph-act">
          <button className="btn" disabled={pending} onClick={add}>Add {def.singular}</button>
        </div>
      </div>

      {def.note && <div className="note">{def.note}</div>}

      {problem && <div className="note bad">{problem}</div>}

      {!rows.length && (
        <div className="note">No {def.title.toLowerCase()} recorded.</div>
      )}

      <div className="rows">
        {rows.map((row, i) => (
          <Row key={row.id} venueId={venueId} def={def} row={row} index={i + 1}
               lookups={lookups} />
        ))}
      </div>
    </div>
  );
}

function Row({
  venueId, def, row, index, lookups,
}: {
  venueId: number; def: ChildDef; row: Record<string, any>; index: number;
  lookups?: Record<string, { id: number | string; name: string }[]>;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();

  const title = row.name ?? row.title ?? row.full_name ?? row.label ?? row.question
    ?? row.rate_name ?? row.season_name ?? row.policy_name ?? row.url ?? `${def.singular} ${index}`;

  return (
    <div className="row-card">
      <header>
        <div className="rt">{String(title).slice(0, 90) || `${def.singular} ${index}`}</div>
        <button className="link-btn" disabled={pending}
          onClick={() => {
            if (!confirm(`Delete this ${def.singular}? This cannot be undone.`)) return;
            start(async () => {
              report('saving');
              const res = await deleteChildRow(def.table, row.id, venueId);
              report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Not deleted');
            });
          }}>Delete</button>
      </header>
      <div className="grid">
        {def.fields.map((f) => (
          <div key={f.col} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
            <Field def={f} value={row[f.col]}
              options={f.lookup ? lookups?.[f.lookup] : undefined}
              save={(c, v) => saveChildField(def.table, row.id, c, v, venueId)} />
          </div>
        ))}
      </div>
    </div>
  );
}
