'use client';

import { useState } from 'react';
import { updateVenueField } from '@/app/actions/venues';
import { useSaveState } from './SaveState';

export type Option = { id: number | string; name: string };

export default function AutosaveSelect({
  venueId, column, label, source, initial, options, blank = 'Not set', help, onChanged, disabled,
}: {
  venueId: number; column: string; label: string; source?: string;
  initial: number | string | null; options: Option[]; blank?: string; help?: string;
  onChanged?: (v: number | null) => void; disabled?: boolean;
}) {
  const { report } = useSaveState();
  const [val, setVal] = useState(initial === null || initial === undefined ? '' : String(initial));
  const [err, setErr] = useState('');

  async function change(next: string) {
    setVal(next); report('saving');
    const out = next === '' ? null : Number(next);
    const res = await updateVenueField(venueId, column, out);
    if (res.ok) { setErr(''); report('saved'); onChanged?.(out); }
    else { setErr(res.error); report('error', 'Not saved'); }
  }

  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      <label htmlFor={column}>{label}</label>
      <select id={column} value={val} disabled={disabled}
              onChange={(e) => change(e.target.value)}>
        <option value="">{blank}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      {help && !err && <span className="help">{help}</span>}
    </div>
  );
}
