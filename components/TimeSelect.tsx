'use client';

import { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TIME SELECT

   A dropdown at 15-minute steps rather than a native time input, which is
   fiddly to type into and renders differently in every browser.

   Two modes, because the underlying columns differ:

   · strict  — for real `time` columns (arrival_time, opens_at). Returns
               HH:MM or null.
   · free    — for text columns (venues.check_in_time). Venues say things
               like "From 2pm, earlier on request", and forcing that into a
               time column would throw away the part that matters. The
               dropdown fills the common case; anything else can be typed.
   ═══════════════════════════════════════════════════════════════════════ */

const STEPS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    STEPS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

/** 14:30 reads as 2:30 pm, which is how anyone would say it on a call. */
export function readable(t: string): string {
  const [hs, ms] = t.split(':');
  const h = Number(hs);
  const suffix = h < 12 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return ms === '00' ? `${twelve} ${suffix}` : `${twelve}:${ms} ${suffix}`;
}

const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export default function TimeSelect({
  value, onChange, allowText, placeholder, disabled, id,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  allowText?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const current = value ? String(value).slice(0, 5) : '';
  const matches = isTime(current);
  const [custom, setCustom] = useState(!matches && !!current);
  const [text, setText] = useState(current);

  const sel: React.CSSProperties = {
    background: 'var(--warm-white)', border: '1px solid var(--border-input)',
    padding: '7px 9px', width: '100%', fontSize: 13,
  };

  if (custom) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input id={id} data-bwignore value={text} placeholder={placeholder ?? 'e.g. From 2pm'}
          disabled={disabled} style={sel}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== current && onChange(text || null)} />
        <button type="button" className="link-btn" disabled={disabled}
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => { setCustom(false); }}>Pick</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select id={id} value={matches ? current : ''} disabled={disabled} style={sel}
        onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{placeholder ?? 'Not set'}</option>
        {STEPS.map((t) => (
          <option key={t} value={t}>{readable(t)}</option>
        ))}
      </select>
      {allowText && (
        <button type="button" className="link-btn" disabled={disabled}
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => { setText(current); setCustom(true); }}>Type</button>
      )}
    </div>
  );
}
