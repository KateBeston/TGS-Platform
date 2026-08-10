'use client';

import { useState } from 'react';
import { saveSetting } from '@/app/actions/catalogues';
import { useSaveState } from './SaveState';

type Row = { id: number; setting_group: string | null; setting_key: string;
             setting_value: string | null; description: string | null };

export default function OrgSettings({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return (
      <div className="note">
        No organisation settings recorded. Add rows to <code>tgs_settings</code> with a
        setting_group, setting_key and setting_value to have them appear here.
      </div>
    );
  }

  const groups = rows.reduce<Record<string, Row[]>>((acc, r) => {
    const g = r.setting_group ?? 'General';
    (acc[g] ||= []).push(r);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groups).map(([group, items]) => (
        <div className="sect" key={group}>
          <h3>{group}</h3>
          <div className="grid">
            {items.map((r) => <SettingField key={r.id} row={r} />)}
          </div>
        </div>
      ))}
    </>
  );
}

function SettingField({ row }: { row: Row }) {
  const { report } = useSaveState();
  const [value, setValue] = useState(row.setting_value ?? '');
  const [err, setErr] = useState('');

  const label = row.setting_key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`f ${err ? 'bad' : ''}`}>
      <label htmlFor={`s-${row.id}`}>{label}</label>
      <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id={`s-${row.id}`} value={value} onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          if (value === (row.setting_value ?? '')) return;
          report('saving');
          const res = await saveSetting(row.id, value === '' ? null : value);
          if (res.ok) { setErr(''); report('saved'); }
          else { setErr(res.error); report('error', 'Not saved'); }
        }} />
      {err && <span className="help" style={{ color: 'var(--bad)' }}>{err}</span>}
      {!err && row.description && <span className="help">{row.description}</span>}
    </div>
  );
}
