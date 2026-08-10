'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Option = {
  id: number;
  name: string;
  /** Shown beside the name — a region, a native name, a code. */
  note?: string | null;
  /** Sorted above the rest. The ones somebody actually needs first. */
  common?: boolean;
};

/* ═══════════════════════════════════════════════════════════════════════
   A LIST YOU CAN TYPE INTO

   A dropdown of 78 languages or 53 insurers is unusable by scrolling and
   perfect once you can type. Both at once: the whole list is there, and
   three characters gets you to the one you want.

   The point of a list rather than free text is not tidiness. It is that
   "how many venues are with QBE" cannot be answered when it has been
   typed six ways.
   ═══════════════════════════════════════════════════════════════════════ */

export default function SearchableSelect({
  options, value, onChange, placeholder, allowAdd, onAdd, disabled,
}: {
  options: Option[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  /** Where the list will never be complete — insurers, mainly. */
  allowAdd?: boolean;
  onAdd?: (name: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const chosen = options.find((o) => o.id === value);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? options.filter((o) =>
          o.name.toLowerCase().includes(term)
          || (o.note ?? '').toLowerCase().includes(term))
      : options;

    // Common ones first when nothing is typed, so the list does not open
    // on Abkhazian. Once somebody types, the match is what matters.
    return term
      ? list.slice(0, 60)
      : [...list].sort((a, b) =>
          Number(b.common ?? false) - Number(a.common ?? false)
          || a.name.localeCompare(b.name)).slice(0, 60);
  }, [options, q]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const pick = (id: number | null) => {
    onChange(id); setOpen(false); setQ('');
  };

  const exact = matches.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" disabled={disabled}
        onClick={() => { setOpen(!open); setQ(''); }}
        style={{
          background: 'var(--warm-white)', border: '1px solid var(--border-input)',
          padding: '8px 10px', fontSize: 13.5, width: '100%', textAlign: 'left',
          cursor: disabled ? 'default' : 'pointer',
          color: chosen ? 'var(--charcoal)' : 'var(--muted)',
        }}>
        {chosen?.name ?? placeholder ?? 'Choose'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--warm-white)', border: '1px solid var(--border)',
          borderTop: '2px solid var(--gold)', marginTop: 2,
          maxHeight: 320, overflowY: 'auto',
          boxShadow: '0 6px 24px rgba(49,49,49,.10)',
        }}>
          <input autoFocus data-bwignore value={q} placeholder="Type to narrow"
            onChange={(e) => { setQ(e.target.value); setHighlight(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                setHighlight((h) => Math.min(h + 1, matches.length - 1)); e.preventDefault();
              }
              if (e.key === 'ArrowUp') {
                setHighlight((h) => Math.max(h - 1, 0)); e.preventDefault();
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (matches[highlight]) pick(matches[highlight].id);
                else if (allowAdd && q.trim() && onAdd) { onAdd(q.trim()); setOpen(false); }
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            style={{
              width: '100%', border: 0, borderBottom: '1px solid var(--border)',
              padding: '10px 12px', fontSize: 13.5, background: 'var(--warm-cream)',
            }} />

          {value != null && (
            <button type="button" onClick={() => pick(null)}
              style={{ ...row, color: 'var(--muted)' }}>Clear</button>
          )}

          {matches.map((o, i) => (
            <button key={o.id} type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(o.id)}
              style={{
                ...row,
                background: i === highlight ? 'var(--warm-cream)' : 'transparent',
                fontWeight: o.id === value ? 500 : 400,
              }}>
              {o.name}
              {o.note && (
                <span style={{ color: 'var(--muted)', fontSize: 11.5, marginLeft: 8 }}>
                  {o.note}
                </span>
              )}
            </button>
          ))}

          {!matches.length && !allowAdd && (
            <div style={{ padding: '12px', fontSize: 12.5, color: 'var(--muted)' }}>
              Nothing matches that.
            </div>
          )}

          {/* Only where the list genuinely cannot be complete. Adding to a
              closed list is how a taxonomy becomes a mess. */}
          {allowAdd && q.trim() && !exact && (
            <button type="button" onClick={() => { onAdd?.(q.trim()); setOpen(false); }}
              style={{ ...row, borderTop: '1px solid var(--border)',
                       color: 'var(--ink-gold)' }}>
              Add “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const row: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', border: 0,
  padding: '9px 12px', fontSize: 13.5, cursor: 'pointer',
  background: 'transparent',
};
