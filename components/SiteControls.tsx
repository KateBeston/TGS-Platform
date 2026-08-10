'use client';

import { useState, useTransition } from 'react';
import { saveCategory, savePractice } from '@/app/actions/siteContent';

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '5px 8px', fontSize: 12.5,
};

type Kind = 'category' | 'practice';

function save(kind: Kind, id: number, col: string, value: string) {
  return kind === 'category' ? saveCategory(id, col, value) : savePractice(id, col, value);
}

/** Wellness / Retreat / Both — writes both flags. */
export function ShownInSelect(
  { kind, id, inWellness, inRetreat }:
  { kind: Kind; id: number; inWellness: boolean; inRetreat: boolean },
) {
  const initial = inWellness && inRetreat ? 'both' : inRetreat ? 'retreat' : 'wellness';
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: pending ? 0.5 : 1 }}>
      <select style={sel} value={value} title={err || undefined}
        onChange={(e) => {
          const v = e.target.value; setValue(v); setErr('');
          start(async () => { const r = await save(kind, id, 'shown_in', v); if (r.ok === false) setErr(r.error); });
        }}>
        <option value="wellness">Wellness</option>
        <option value="retreat">Retreat</option>
        <option value="both">Both</option>
      </select>
    </span>
  );
}

/** Active / Inactive / Draft / Redundant-Archived — writes status (and is_published). */
export function StatusSelect(
  { kind, id, status }: { kind: Kind; id: number; status: string },
) {
  const [value, setValue] = useState(status || 'draft');
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: pending ? 0.5 : 1 }}>
      <select style={sel} value={value} title={err || undefined}
        onChange={(e) => {
          const v = e.target.value; setValue(v); setErr('');
          start(async () => { const r = await save(kind, id, 'status', v); if (r.ok === false) setErr(r.error); });
        }}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="draft">Draft</option>
        <option value="archived">Redundant / Archived</option>
      </select>
    </span>
  );
}
