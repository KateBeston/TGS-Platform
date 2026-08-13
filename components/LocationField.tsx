'use client';

import { useEffect, useRef, useState } from 'react';

/* Location type-ahead for the hero search.
 *
 * Debounced search across all geography levels via /api/geo-search. Picking
 * a result hands its params (the full slug path) up to the parent, which
 * merges them into the search URL. Typing again clears any prior pick. */

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
  const boxRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
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
      <input
        id="h-loc" type="text" autoComplete="off" placeholder="Anywhere"
        value={q}
        onChange={(e) => { setQ(e.target.value); onSelect({}, ''); }}
        onFocus={() => { if (results.length) setOpen(true); }} />
      {open && results.length > 0 && (
        <ul className="location-results">
          {results.map((r, i) => (
            <li key={`${r.type}-${i}`} onMouseDown={() => pick(r)}>
              <span className="loc-name">{r.name}</span>
              {r.context && <span className="loc-context">{r.context}</span>}
              <span className="loc-type">{r.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
