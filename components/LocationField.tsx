'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* Location type-ahead for the hero search.
 *
 * Debounced search across all geography levels via /api/geo-search. Picking
 * a result hands its params (the full slug path) up to the parent, which
 * merges them into the search URL. Typing again clears any prior pick.
 *
 * The results render in a portal on document.body, positioned under the
 * field, so the hero's overflow:hidden cannot clip them. */

type Result = {
  type: string;
  name: string;
  context: string | null;
  params: Record<string, string>;
};

export default function LocationField({
  onSelect,
}: {
  onSelect: (params: Record<string, string>, label: string) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // Debounced fetch.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setOpen(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo-search?q=${encodeURIComponent(term)}`);
        const out = await res.json();
        if (cancelled) return;
        setResults(out.results ?? []);
        setOpen(true);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  // Track the field position so the portal menu sits under it, and follows
  // the page as it scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 8, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, results]);

  // Close on click outside either the field or the (portaled) menu.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (r: Result) => {
    const label = r.context ? `${r.name}, ${r.context}` : r.name;
    setQ(label);
    setOpen(false);
    onSelect(r.params, label);
  };

  return (
    <div className="search-field search-location" ref={boxRef}>
      <label className="search-field-label" htmlFor="h-loc">Location</label>
      <div className="location-input-row">
        <input
          ref={inputRef}
          id="h-loc" type="text" autoComplete="off" placeholder="Type a location"
          value={q}
          onChange={(e) => { setQ(e.target.value); onSelect({}, ''); }}
          onFocus={() => { if (results.length) setOpen(true); }} />
        <svg className="location-icon" viewBox="0 0 24 24" width="14" height="14"
          fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="7" />
          <line x1="15.8" y1="15.8" x2="21" y2="21" />
        </svg>
      </div>

      {open && results.length > 0 && rect && createPortal(
        <ul className="location-results" ref={menuRef}
          style={{ position: 'fixed', top: rect.top, left: rect.left,
                   minWidth: Math.max(rect.width, 300) }}>
          {results.map((r, i) => (
            <li key={`${r.type}-${i}`} onMouseDown={() => pick(r)}>
              <span className="loc-name">{r.name}</span>
              {r.context && <span className="loc-context">{r.context}</span>}
              <span className="loc-type">{r.type}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
